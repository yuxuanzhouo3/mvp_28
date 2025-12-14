import { useMemo, useState, useRef } from "react";
import { IS_DOMESTIC_VERSION } from "../config";
import { Message, ChatSession, ExternalModel, AttachmentItem } from "../types";
import { simulateMultiGPTResponse } from "../services";
import { apiService } from "../lib/api";
import { detectLanguage, getSelectedModelDisplay } from "../utils";
import { createClient } from "@/lib/supabase/client";
import { GENERAL_MODEL_ID } from "@/utils/model-limits";
import {
  getFreeContextMsgLimit,
  getBasicContextMsgLimit,
  getProContextMsgLimit,
  getEnterpriseContextMsgLimit,
} from "@/utils/model-limits";
import type { SupabaseClient } from "@supabase/supabase-js";

export const useMessageSubmission = (
  prompt: string,
  setPrompt: React.Dispatch<React.SetStateAction<string>>,
  uploadedFiles: AttachmentItem[],
  setUploadedFiles: React.Dispatch<React.SetStateAction<AttachmentItem[]>>,
  messages: Message[],
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  isLoading: boolean,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  thinkingText: string,
  setThinkingText: React.Dispatch<React.SetStateAction<string>>,
  isStreaming: boolean,
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>,
  chatSessions: ChatSession[],
  setChatSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>,
  currentChatId: string,
  setCurrentChatId: React.Dispatch<React.SetStateAction<string>>,
  selectedModelType: string,
  selectedModel: string,
  setSelectedModel: React.Dispatch<React.SetStateAction<string>>,
  setSelectedModelType: React.Dispatch<React.SetStateAction<string>>,
  selectedCategory: string,
  selectedLanguage: string,
  setSelectedLanguage: React.Dispatch<React.SetStateAction<string>>,
  appUser: any,
  guestChatSessions: ChatSession[],
  setGuestChatSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>,
  guestSessionTimeout: NodeJS.Timeout | null,
  setGuestSessionTimeout: React.Dispatch<React.SetStateAction<NodeJS.Timeout | null>>,
  streamingController: AbortController | null,
  setStreamingController: React.Dispatch<React.SetStateAction<AbortController | null>>,
  scrollAreaRef: React.RefObject<HTMLDivElement | null>,
  getFileIcon: (type: string) => string,
  formatFileSize: (bytes: number) => string,
  getLocalizedText: (key: string) => string,
  mornGPTCategories: any[],
  expandedFolders: string[],
  setExpandedFolders: React.Dispatch<React.SetStateAction<string[]>>,
  externalModels: Array<{ id: string; name: string; provider: string; description: string; category: string; type: string; price: string; }>,
  supabaseClient?: SupabaseClient | null,
  onRequireAuth?: () => void,
  consumeFreeQuota?: () => boolean,
  refreshQuota?: () => void,
  openUpgrade?: () => void,
) => {
  const [forceUpdate, setForceUpdate] = useState(0);
  const supabase = useMemo(() => supabaseClient || createClient(), [supabaseClient]);
  const submitLock = useRef(false);

  const formatStreamingError = (error: string, lang: string) => {
    const isZh = lang === "zh";
    if (/model_not_found/i.test(error) || /does not exist/i.test(error)) {
      return isZh
        ? "当前环境无法访问该模型，可能是地区或账号权限限制。请切换模型或更换线路后再试。"
        : "This model isn’t available in the current region/account. Please switch to another model or try a different region.";
    }
    if (/capacity/i.test(error) || /3505/.test(error)) {
      return isZh
        ? "该模型当前容量已满，请稍后再试或更换模型。"
        : "This model is at capacity; please retry later or switch models.";
    }
    if (/401|403|unauthorized/i.test(error)) {
      return isZh ? "登录已失效，请重新登录。" : "Session expired — please sign in again.";
    }
    if (/429|too many/i.test(error)) {
      return isZh
        ? "请求过快或线路限流，请等待几秒后点击重新发送，或切换其他模型/线路。当前对话已保留。"
        : "This request was rate-limited. Wait a few seconds and hit resend, or switch to another model/region. Your conversation is saved.";
    }
    if (/500|503|server/i.test(error)) {
      return isZh ? "服务器暂不可用，请稍后重试。" : "Server is unavailable, please try again soon.";
    }
    return isZh ? `抱歉，发生了错误: ${error}` : `Sorry, an error occurred: ${error}`;
  };

  const getSelectedModelDisplayLocal = () => {
    return getSelectedModelDisplay(
      selectedModelType,
      selectedModel,
      selectedCategory,
      mornGPTCategories
    );
  };

  const createServerConversation = async (title: string, model: string) => {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title, model }),
    });

    if (!res.ok) throw new Error(`Create conversation failed ${res.status}`);
    const data = await res.json();
    return data.id as string;
  };

  const handleSubmit = async () => {
    if (submitLock.current) return;
    submitLock.current = true;
    const releaseLock = () => {
      submitLock.current = false;
    };

    try {
    if (!prompt.trim() && uploadedFiles.length === 0) {
      releaseLock();
      return;
    }

    // Require login
    if (!appUser) {
      onRequireAuth?.();
      releaseLock();
      return;
    }

    // Determine language for request headers; keep UI language unchanged
    const detectedLanguage = selectedLanguage || detectLanguage(prompt);
    // Effective model (may switch to omni when uploading media)
    let effectiveModelType = selectedModelType;
    let effectiveSelectedModel = selectedModel;

    // Prevent duplicate submissions
    if (isLoading) {
      console.log("Already loading, skipping duplicate call");
      releaseLock();
      return;
    }

    // Block region-mismatched models early to avoid hitting backend and creating bad chats
    const selectedExternal = externalModels.find((m) => m.id === effectiveSelectedModel);
    const isCrossRegionModel =
      (IS_DOMESTIC_VERSION && selectedExternal?.category === "international") ||
      (!IS_DOMESTIC_VERSION && selectedExternal?.category === "domestic");

    if (isCrossRegionModel) {
      const friendlyMessage =
        selectedLanguage === "zh"
          ? "当前为国内版，无法直接调用国际模型。请切换英语版或改用国内模型后再试。"
          : "You’re on the domestic build; this model is only available on the international build. Switch model/region and resend.";

      const warningMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: friendlyMessage,
        timestamp: new Date(),
        model: selectedModel || getSelectedModelDisplayLocal(),
        isStreaming: false,
      };

      setMessages((prev) => [...prev, warningMessage]);
      releaseLock();
      return;
    }

    // Collect uploaded media IDs (CloudBase fileId); only images/videos/audios are sent to the model
    const hasMediaUpload = uploadedFiles.some(
      (f) => f.kind === "image" || f.kind === "video" || f.kind === "audio"
    );

    const imageFileIds = uploadedFiles
      .filter((f) => f.kind === "image" && f.fileId)
      .map((f) => f.fileId as string);
    const videoFileIds = uploadedFiles
      .filter((f) => f.kind === "video" && f.fileId)
      .map((f) => f.fileId as string);
    const audioFileIds = uploadedFiles
      .filter((f) => f.kind === "audio" && f.fileId)
      .map((f) => f.fileId as string);

    // 限制：音频不可与图片/视频混合，同一条消息仅支持一个音频
    if (audioFileIds.length > 0) {
      if (audioFileIds.length > 1) {
        setIsLoading(false);
        alert("一次仅支持发送一个音频文件，请移除多余音频。");
        releaseLock();
        return;
      }
      if (imageFileIds.length || videoFileIds.length) {
        setIsLoading(false);
        alert("音频暂不支持与图片或视频同时发送，请分开发送。");
        releaseLock();
        return;
      }
    }

    // Keep text clean; media previews are shown separately in the UI
    const messageContent = prompt || uploadedFiles.map((f) => f.name).join(", ");
    const imagePreviews = uploadedFiles
      .filter((f) => f.kind === "image")
      .map((f) => f.preview || f.fileId || "")
      .filter(Boolean);
    const videoPreviews = uploadedFiles
      .filter((f) => f.kind === "video")
      .map((f) => f.preview || f.fileId || "")
      .filter(Boolean);
    const audioPreviews = uploadedFiles
      .filter((f) => f.kind === "audio")
      .map((f) => f.preview || f.fileId || "")
      .filter(Boolean);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
      images: imageFileIds,
      videos: videoFileIds,
      imagePreviews,
      videoPreviews,
      audios: audioFileIds,
      audioPreviews,
    };
    const displayModelName = getSelectedModelDisplayLocal();
    let persistedModelId =
      effectiveModelType === "general"
        ? GENERAL_MODEL_ID
        : effectiveSelectedModel || "qwen3-omni-flash";
    let currentModel =
      effectiveModelType === "general"
        ? displayModelName
        : effectiveSelectedModel || displayModelName;
    const currentChat = chatSessions.find((c) => c.id === currentChatId);
    let conversationId = currentChatId || "";
    const newChatCategory = selectedCategory || "general";
    const planLower = (appUser?.plan || "").toLowerCase?.() || "";
    const isFreeUser = !!appUser && (planLower === "" || planLower === "free");

    // 如果已有对话锁定为文字模型，阻止媒体上传；新建/未锁定则自动切换到 Qwen3-Omni-Flash
    if (hasMediaUpload) {
      if (currentChat && currentChat.isModelLocked && (currentChat.model || "").toLowerCase() !== "qwen3-omni-flash") {
        alert(
          selectedLanguage === "zh"
            ? "当前对话已锁定为文字模型，无法上传图片/视频/音频。请新建对话并选择 Qwen3-Omni-Flash。"
            : "This conversation is locked to a text model. Start a new chat with Qwen3-Omni-Flash to upload media."
        );
        releaseLock();
        return;
      }
      effectiveModelType = "advanced_multimodal";
      effectiveSelectedModel = "qwen3-omni-flash";
      persistedModelId = "qwen3-omni-flash";
      currentModel = "qwen3-omni-flash";
      setSelectedModelType("advanced_multimodal");
      setSelectedModel("qwen3-omni-flash");
    }

    try {
      if (!currentChat) {
        if (isFreeUser) {
          conversationId = `local-${Date.now()}`;
        } else {
          conversationId = await createServerConversation(
            userMessage.content.slice(0, 30) + "...",
            persistedModelId
          );
        }

        const newChat: ChatSession = {
          id: conversationId,
          title: userMessage.content.slice(0, 30) + "...",
          messages: [userMessage],
          model: persistedModelId,
          modelType: effectiveModelType,
          category: newChatCategory,
          lastUpdated: new Date(),
          isModelLocked: true,
        };

        setChatSessions((prev) => [newChat, ...prev]);
        setCurrentChatId(conversationId);
        setMessages([userMessage]);

        if (!expandedFolders.includes(newChatCategory)) {
          setExpandedFolders([newChatCategory]);
        }
      } else if (!currentChat.isModelLocked) {
        if (isFreeUser) {
          conversationId = `local-${Date.now()}`;
        } else {
          conversationId = await createServerConversation(
            userMessage.content.slice(0, 30) + "...",
            persistedModelId
          );
        }

        const newChat: ChatSession = {
          id: conversationId,
          title: userMessage.content.slice(0, 30) + "...",
          messages: [userMessage],
          model: persistedModelId,
          modelType: effectiveModelType,
          category: newChatCategory,
          lastUpdated: new Date(),
          isModelLocked: true,
        };

        setChatSessions((prev) => [
          newChat,
          ...prev.filter((c) => c.id !== currentChatId),
        ]);
        setCurrentChatId(conversationId);
        setMessages([userMessage]);

        if (!expandedFolders.includes(newChatCategory)) {
          setExpandedFolders([newChatCategory]);
        }
      } else {
        conversationId = currentChatId;
        setChatSessions((prev) =>
          prev.map((session) =>
            session.id === conversationId
              ? {
                  ...session,
                  isModelLocked: true,
                  messages: [...session.messages, userMessage],
                  lastUpdated: new Date(),
                }
              : session
          )
        );
        setMessages((prev) => [...prev, userMessage]);
      }
    } catch (err) {
      console.error("Failed to create conversation", err);
      alert(
        selectedLanguage === "zh"
          ? "创建会话失败，请稍后再试"
          : "Failed to create conversation, please try again.",
      );
      setIsLoading(false);
      releaseLock();
      return;
    }

    setPrompt("");
    setUploadedFiles([]); // Clear uploaded files after sending
    // Note: setIsLoading(true) is now handled in the streaming logic to prevent duplicates

    // Prevent duplicate streaming calls
    if (isLoading) {
      console.log("Already loading, skipping duplicate call");
      return;
    }

    setIsLoading(true);

    // =============================
    // 上下文限额（按“轮次”计：一问一答算 1 条）
    // =============================
    const ctxLimit =
      planLower === "basic"
        ? getBasicContextMsgLimit()
        : planLower === "pro"
          ? getProContextMsgLimit()
          : planLower === "enterprise"
            ? getEnterpriseContextMsgLimit()
            : getFreeContextMsgLimit();

    const assistantCount = messages.filter((m) => m.role === "assistant").length;
    const remainingRounds = Math.max(0, ctxLimit - assistantCount);
    if (remainingRounds <= 0) {
      openUpgrade?.();
      alert(
        selectedLanguage === "zh"
          ? `上下文已达上限（${ctxLimit}条）。请升级或新建对话后再试。`
          : `Context limit reached (${ctxLimit} messages). Please upgrade or start a new chat.`
      );
      releaseLock();
      return;
    }
    if (remainingRounds <= 10) {
      alert(
        selectedLanguage === "zh"
          ? `上下文剩余 ${remainingRounds} 条（上限 ${ctxLimit} 条）。为避免中断，请尽快升级或新建对话。`
          : `Context remaining ${remainingRounds} of ${ctxLimit}. Please upgrade or start a new chat soon.`
      );
    }

    // 准备上下文（仅保留最近 ctxLimit 轮：用户+助手≈2条/轮）
    let preparedHistory = [...messages, userMessage];
    const maxHistoryMessages = ctxLimit * 2;
    if (preparedHistory.length > maxHistoryMessages) {
      preparedHistory = preparedHistory.slice(-maxHistoryMessages);
    }

    const historyMessages = preparedHistory.map((msg) => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
      images: msg.images,
      videos: msg.videos,
      audios: (msg as any).audios,
    }));

    // Persist user message via API
    if (conversationId && !conversationId.startsWith("local-")) {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            role: "user",
            content: userMessage.content,
            client_id: userMessage.id,
            images: userMessage.images || [],
            videos: userMessage.videos || [],
            audios: (userMessage as any).audios || [],
            modelId: persistedModelId, // 传递模型 ID 用于分级配额
          }),
        });
        if (res.status === 402) {
          const body = await res.json().catch(() => ({}));
          // 根据配额类型显示不同的错误提示（Free/Basic 同一逻辑，统一触发订阅弹窗）
          const quotaType = body?.quotaType || "daily";
          const planLower = (appUser?.plan || "").toLowerCase?.() || "";
          const isBasic = planLower === "basic";
          const isPro = planLower === "pro";
          const isEnterprise = planLower === "enterprise";
          let msg: string;
          openUpgrade?.();
          if (quotaType === "monthly_photo") {
            msg = selectedLanguage === "zh"
              ? "本月图片配额已用完，请升级套餐或下月再试。"
              : body?.error || "Monthly photo quota reached. Please upgrade or try next month.";
          } else if (quotaType === "monthly_video_audio") {
            msg = selectedLanguage === "zh"
              ? "本月视频/音频配额已用完，请升级套餐或下月再试。"
              : body?.error || "Monthly video/audio quota reached. Please upgrade or try next month.";
          } else {
            const defaultZh = isBasic
              ? "今日基础版额度已用完，请升级套餐或切换到通用模型（General Model）继续使用。"
              : isPro || isEnterprise
                ? "当前套餐额度已用完，请升级更高套餐或切换到通用模型（General Model）继续使用。"
                : "今日免费额度已用完，请升级套餐或切换到通用模型（General Model）继续使用。";
            const defaultEn = isBasic
              ? "Today's Basic quota is used up. Please upgrade or switch to the General Model."
              : isPro || isEnterprise
                ? "Your current plan quota is used up. Please upgrade to a higher plan or switch to the General Model."
                : "Today's free quota is used up. Please upgrade or switch to the General Model.";
            msg = selectedLanguage === "zh"
              ? body?.error || defaultZh
              : body?.error || defaultEn;
          }
          alert(msg);
          setIsLoading(false);
          releaseLock();
          return;
        }
        if (!res.ok) throw new Error(`Save message failed ${res.status}`);
        // refresh quota after server accepted the user message
        refreshQuota?.();
      } catch (err) {
        console.error("Failed to persist user message", err);
        alert(
          selectedLanguage === "zh"
            ? "保存消息到数据库失败，请检查网络或重试。"
            : "Failed to save message to database. Please retry."
        );
        setIsLoading(false);
        releaseLock();
        return;
      }
    }

    // 国际版：本地预扣免费额度；国内版/通用模型跳过（由服务端或无限制处理）
    if (!IS_DOMESTIC_VERSION && effectiveModelType !== "general") {
      if (consumeFreeQuota && !consumeFreeQuota()) {
        setIsLoading(false);
        releaseLock();
        return;
      }
    }

    try {
      if (selectedCategory === "h") {
        // MultiGPT response - also use streaming for consistency
        const aiMessageId = (Date.now() + 1).toString();
        // Don't add initial message - wait for real content
        let messageCreated = false;
        setIsStreaming(true);
        setIsLoading(false); // Stop showing "Thinking..." once streaming starts

        // Simulate streaming for MultiGPT
        const multiGPTResponse = await simulateMultiGPTResponse(
          userMessage.content
        );
        let streamedContent = "";
        const words = multiGPTResponse.content.split(" ");

        // Create message on first word (skip thinking)
        if (words.length > 0) {
          const initialMessage: Message = {
            id: aiMessageId,
            role: "assistant" as const,
            content: words[0],
            timestamp: new Date(),
            model: currentModel,
            isStreaming: true,
            isMultiGPT: true,
          };
          setMessages((prev) => [...prev, initialMessage]);
          streamedContent = words[0];
        }

        for (let i = 1; i < words.length; i++) {
          streamedContent += " " + words[i];
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? { ...msg, content: streamedContent }
                : msg
            )
          );

          // Auto-scroll
          setTimeout(() => {
            if (scrollAreaRef.current) {
              scrollAreaRef.current.scrollTo({
                top: scrollAreaRef.current.scrollHeight,
                behavior: "smooth",
              });
            }
          }, 5);

          // Much faster delay between words for MultiGPT
          await new Promise((resolve) => setTimeout(resolve, 15));
        }

        // Final update
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, isStreaming: false, content: streamedContent }
              : msg
          )
        );

        // Update chat sessions and persist
        const finalMessage = {
          id: aiMessageId,
          role: "assistant" as const,
          content: streamedContent,
          timestamp: new Date(),
          model: currentModel,
          isStreaming: false,
          isMultiGPT: true,
        };

        setChatSessions((prev) =>
          prev.map((session) =>
            session.id === conversationId
              ? {
                  ...session,
                  messages: session.messages.map((msg) =>
                    msg.id === aiMessageId ? finalMessage : msg
                  ),
                  lastUpdated: new Date(),
                }
              : session
          )
        );

        if (conversationId && !conversationId.startsWith("local-")) {
          fetch(`/api/conversations/${conversationId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              role: "assistant",
              content: streamedContent,
              client_id: aiMessageId,
            }),
          }).catch((err) =>
            console.error("Failed to persist assistant message", err)
          );
        }

        setIsLoading(false);
        setIsStreaming(false);
      } else {
        // Use real API calls for external models
        let modelId =
          effectiveModelType === "general" ? GENERAL_MODEL_ID : persistedModelId;

        // Prefer selected external model
        if (effectiveModelType === "external" && effectiveSelectedModel) {
          const model = externalModels.find((m) => m.id === effectiveSelectedModel);
          if (model) {
            modelId = model.id;
          }
        } else if (effectiveModelType === "general") {
          modelId = GENERAL_MODEL_ID;
        } else if (effectiveSelectedModel) {
          modelId = effectiveSelectedModel;
        }

        // If包含图片/视频，强制用多模态模型（对标 Qwen Demo）
        const hasMedia = uploadedFiles.some(
          (f) => f.kind === "image" || f.kind === "video" || f.kind === "audio",
        );
        if (hasMedia) {
          modelId = "qwen3-omni-flash";
        }

        // Create message ID for tracking
        const aiMessageId = (Date.now() + 1).toString();
        let streamedContent = "";
        let isStreamingComplete = false;
        let messageCreated = false;

        // Detect if user input contains Chinese characters for thinking text
        const isChinese = /[\u4e00-\u9fff]/.test(userMessage.content);
        const thinkingText = isChinese ? "思考中..." : "Thinking...";

        // Set thinking state with circle indicator (no message box)
        setIsLoading(true);
        setThinkingText(thinkingText);
        messageCreated = false;

        // Make streaming API call
        // Create abort controller for stopping streaming
        const controller = new AbortController();
        setStreamingController(controller);

        // No timeout - let thinking continue until response arrives
        let thinkingTimeout: NodeJS.Timeout | null = null;
        setIsStreaming(true);
        // Keep isLoading true to show thinking indicator until first chunk arrives

        // 国际版接口不接受多模态字段，将历史与媒体字段裁剪为纯文本
        const historyForSend = IS_DOMESTIC_VERSION
          ? historyMessages
          : historyMessages.map((msg) => ({
              role: msg.role as "user" | "assistant" | "system",
              content: msg.content,
            }));
        const sendImages = IS_DOMESTIC_VERSION ? userMessage.images : undefined;
        const sendVideos = IS_DOMESTIC_VERSION ? userMessage.videos : undefined;
        const sendAudios = IS_DOMESTIC_VERSION ? (userMessage as any).audios : undefined;

        // Minimal terminal log to help diagnose media payload
        console.log("[media][client] sendMessageStream payload", {
          modelId,
          images: sendImages?.length || 0,
          videos: sendVideos?.length || 0,
          historyCount: historyForSend.length,
        });

        try {
          await apiService.sendMessageStream(
            userMessage.content,
            modelId,
            undefined,
            undefined,
            detectedLanguage,
            historyForSend,
            sendImages,
            sendVideos,
            sendAudios,
            true, // quota already checked & persisted via /messages
            // onChunk callback
            (chunk: string) => {
              streamedContent += chunk;

              // If this is the first chunk, create the message and stop thinking
              if (!messageCreated) {
                setIsLoading(false);
                setThinkingText("");
                const initialMessage: Message = {
                  id: aiMessageId,
                  role: "assistant" as const,
                  content: streamedContent,
                  timestamp: new Date(),
                  model: currentModel,
                  isStreaming: true,
                };
                setMessages((prev) => [...prev, initialMessage]);
                messageCreated = true;
              } else {
                // Update existing message
                setMessages((prev) => {
                  return prev.map((msg) =>
                    msg.id === aiMessageId
                      ? {
                          ...msg,
                          content: streamedContent,
                          isStreaming: true,
                          // Add visual indicator for streaming
                          model:
                            streamedContent.length < 50
                              ? `${currentModel} (Streaming...)`
                              : currentModel,
                        }
                      : msg
                  );
                });
              }

              // Force React to re-render immediately
              setForceUpdate((prev) => prev + 1);

              // Auto-scroll to bottom for smooth experience
              setTimeout(() => {
                if (scrollAreaRef.current) {
                  scrollAreaRef.current.scrollTo({
                    top: scrollAreaRef.current.scrollHeight,
                    behavior: "smooth",
                  });
                }
              }, 2); // Faster auto-scroll
            },
            // onEnd callback
            async () => {
              // Clear the thinking timeout if it exists
              if (thinkingTimeout) {
                clearTimeout(thinkingTimeout);
              }
              isStreamingComplete = true;
              setIsLoading(false);
              setIsStreaming(false);
              setStreamingController(null);
              // 流结束后立即刷新配额（服务端已扣费）
              if (refreshQuota) {
                await refreshQuota();
              }
              // 通知需要实时刷新的组件（悬浮层/铭牌/额度弹层）
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("quota:refresh"));
              }

              // Remove streaming indicator when complete and update final message
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId
                    ? {
                        ...msg,
                        isStreaming: false,
                        content: streamedContent || "No response received",
                        model: currentModel, // Reset model name
                      }
                    : msg
                )
              );

              // Update chat sessions with the final AI message
              const finalMessage = {
                id: aiMessageId,
                role: "assistant" as const,
                content: streamedContent,
                timestamp: new Date(),
                model: currentModel,
                isStreaming: false,
              };

              setChatSessions((prev) =>
                prev.map((session) =>
                  session.id === conversationId
                    ? {
                        ...session,
                        messages: session.messages.map((msg) =>
                          msg.id === aiMessageId ? finalMessage : msg
                        ),
                        lastUpdated: new Date(),
                      }
                    : session
                )
              );

              if (conversationId) {
                fetch(`/api/conversations/${conversationId}/messages`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    role: "assistant",
                    content: streamedContent,
                    client_id: aiMessageId,
                  }),
                }).catch((err) =>
                  console.error("Failed to persist assistant message", err)
                );
              }
            },
            // onError callback
            (error: string) => {
              console.warn("Streaming error:", error);
              const errorContent = formatStreamingError(error, selectedLanguage);

              if (messageCreated) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId
                      ? { ...msg, content: errorContent, isStreaming: false }
                      : msg
                  )
                );
              } else {
                const errorMessage: Message = {
                  id: aiMessageId,
                  role: "assistant" as const,
                  content: errorContent,
                  timestamp: new Date(),
                  model: currentModel,
                  isStreaming: false,
                };
                setMessages((prev) => [...prev, errorMessage]);
              }
              setIsLoading(false);
              setIsStreaming(false);
              setStreamingController(null);
            },
            // signal for aborting
            controller.signal
          );

          // Wait for streaming to complete
          while (!isStreamingComplete) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

    // 如果用户中途点击“停止”，sendMessageStream 会提前返回且 isStreamingComplete 仍为 false
          // 此处兜底：将已生成内容落库，并清理状态
          if (!isStreamingComplete && messageCreated) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId
                  ? {
                      ...msg,
                      isStreaming: false,
                      content: streamedContent || msg.content,
                      model: currentModel,
                    }
                  : msg
              )
            );

            if (conversationId && streamedContent) {
              fetch(`/api/conversations/${conversationId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  role: "assistant",
                  content: streamedContent,
                  client_id: aiMessageId,
                }),
              }).catch((err) =>
                console.error("Failed to persist assistant message after abort", err)
              );
            }

            setIsLoading(false);
            setIsStreaming(false);
            setStreamingController(null);
          }
        } catch (error) {
          // 用户主动停止会触发 AbortError：收尾并落库当前已流出的内容
          if (error instanceof DOMException && error.name === "AbortError") {
            if (messageCreated) {
              // 更新本地消息状态，去掉 streaming 标记
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId
                    ? {
                        ...msg,
                        isStreaming: false,
                        content: streamedContent || msg.content,
                        model: currentModel,
                      }
                    : msg
                )
              );

              // 持久化当前已生成的内容
              if (conversationId && streamedContent) {
                fetch(`/api/conversations/${conversationId}/messages`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    role: "assistant",
                    content: streamedContent,
                    client_id: aiMessageId,
                  }),
                }).catch((err) =>
                  console.error("Failed to persist aborted assistant message", err)
                );
              }
            }

            setIsLoading(false);
            setIsStreaming(false);
            setStreamingController(null);
            return;
          }
          console.error("Streaming API call failed:", error);
          const errorContent = formatStreamingError(
            error instanceof Error ? error.message : String(error),
            selectedLanguage
          );

          if (messageCreated) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId
                  ? { ...msg, content: errorContent, isStreaming: false }
                  : msg
              )
            );
          } else {
            const errorMessage: Message = {
              id: aiMessageId,
              role: "assistant" as const,
              content: errorContent,
              timestamp: new Date(),
              model: currentModel,
              isStreaming: false,
            };
            setMessages((prev) => [...prev, errorMessage]);
          }
          setIsLoading(false);
          setIsStreaming(false);
          setStreamingController(null);
        }
      }

      // Note: Messages and chat sessions are already updated during streaming in the onEnd callback
    } catch (error) {
      console.error("Error getting AI response:", error);

      // Only create fallback message if we're not in streaming mode
      if (!isStreaming) {
        // Fallback response on error
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            selectedLanguage === "zh"
              ? `抱歉，我现在无法连接到AI服务。请稍后再试。（错误�?{
                  error instanceof Error ? error.message : "未知错误"
                }）`
              : `I apologize, but I'm having trouble connecting to the AI service right now. Please try again in a moment. (Error: ${
                  error instanceof Error ? error.message : "Unknown error"
                })`,
          timestamp: new Date(),
          model: currentModel,
        };

        setMessages((prev) => [...prev, errorMessage]);
      }
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingController(null);

      // Update chat sessions with error message (only if not in streaming mode)
      if (!isStreaming) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            selectedLanguage === "zh"
              ? `抱歉，我现在无法连接到AI服务。请稍后再试。（错误�?{
                  error instanceof Error ? error.message : "未知错误"
                }）`
              : `I apologize, but I'm having trouble connecting to the AI service right now. Please try again in a moment. (Error: ${
                  error instanceof Error ? error.message : "Unknown error"
                })`,
          timestamp: new Date(),
          model: currentModel,
        };

        setChatSessions((prev) =>
          prev.map((session) =>
            session.id === conversationId
              ? {
                  ...session,
                  messages: [...session.messages, errorMessage],
                  lastUpdated: new Date(),
                }
              : session
          )
        );
      }

      releaseLock();
    }
    } finally {
      releaseLock();
    }
  };

  return {
    handleSubmit,
    forceUpdate,
  };
};
