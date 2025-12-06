import { useMemo, useState, useRef } from "react";
import { IS_DOMESTIC_VERSION } from "../config";
import { Message, ChatSession, ExternalModel } from "../types";
import { simulateMultiGPTResponse } from "../services";
import { apiService } from "../lib/api";
import { detectLanguage, getSelectedModelDisplay } from "../utils";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export const useMessageSubmission = (
  prompt: string,
  setPrompt: React.Dispatch<React.SetStateAction<string>>,
  uploadedFiles: File[],
  setUploadedFiles: React.Dispatch<React.SetStateAction<File[]>>,
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
  onRequireAuth?: () => void
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

    // Prevent duplicate submissions
    if (isLoading) {
      console.log("Already loading, skipping duplicate call");
      releaseLock();
      return;
    }

    // Block region-mismatched models early to avoid hitting backend and creating bad chats
    const selectedExternal = externalModels.find((m) => m.id === selectedModel);
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

    // Create message content with files
    let messageContent = prompt;
    if (uploadedFiles.length > 0) {
      const fileList = uploadedFiles
        .map(
          (file) =>
            `${getFileIcon(file.type)} ${file.name} (${formatFileSize(
              file.size
            )})`
        )
        .join("\n");
      messageContent = `${prompt}\n\n📎 **${getLocalizedText(
        "attachedFiles"
      )}:**\n${fileList}`;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
    };
    const currentModel = selectedModel || getSelectedModelDisplayLocal();
    const currentChat = chatSessions.find((c) => c.id === currentChatId);
    let conversationId = currentChatId || "";
    const newChatCategory = selectedCategory || "general";

    try {
      if (!currentChat) {
        conversationId = await createServerConversation(
          userMessage.content.slice(0, 30) + "...",
          selectedModel || currentModel
        );

        const newChat: ChatSession = {
          id: conversationId,
          title: userMessage.content.slice(0, 30) + "...",
          messages: [userMessage],
          model: selectedModel || currentModel,
          modelType: selectedModelType,
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
        conversationId = await createServerConversation(
          userMessage.content.slice(0, 30) + "...",
          selectedModel || currentModel
        );

        const newChat: ChatSession = {
          id: conversationId,
          title: userMessage.content.slice(0, 30) + "...",
          messages: [userMessage],
          model: selectedModel || currentModel,
          modelType: selectedModelType,
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

    // 准备上下文（用户与助手消息）用于流式接口
    const historyMessages = [...messages, userMessage].map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Persist user message via API
    if (conversationId) {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            role: "user",
            content: userMessage.content,
            client_id: userMessage.id,
          }),
        });
        if (!res.ok) throw new Error(`Save message failed ${res.status}`);
      } catch (err) {
        console.error("Failed to persist user message", err);
        alert(
          selectedLanguage === "zh"
            ? "保存消息到数据库失败，请检查网络或重试。"
            : "Failed to save message to database. Please retry."
        );
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

        setIsLoading(false);
        setIsStreaming(false);
      } else {
        // Use real API calls for external models
        let modelId = "llama3.1-8b"; // default model

        // Map selected model to backend model ID
        if (selectedModelType === "external" && selectedModel) {
          // Find the model in externalModels array and use its ID
          const model = externalModels.find((m) => m.id === selectedModel);
          if (model) {
            modelId = model.id;
          }
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

        try {
          await apiService.sendMessageStream(
            userMessage.content,
            modelId,
            undefined,
            undefined,
            detectedLanguage,
            historyMessages,
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
                console.log(
                  "Created initial message with content:",
                  streamedContent
                );
              } else {
                // Update existing message
                setMessages((prev) => {
                  const updated = prev.map((msg) =>
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
                  console.log("Updated messages:", updated);
                  return updated;
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
        } catch (error) {
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
