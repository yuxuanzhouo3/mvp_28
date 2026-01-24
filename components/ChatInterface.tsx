"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Copy, Share, Download, Star, Zap, Bot, User, Trash2 } from "lucide-react";
import { AudioPlayer } from "./AudioPlayer";
import { Message } from "../types";
import type { ReactNode } from "react";
import { externalModels } from "@/constants";
import { GENERAL_MODEL_ID } from "@/utils/model-limits";
import { formatMessageDate, isSameDay } from "@/lib/utils";
import { useState, memo, useEffect, useRef, useMemo } from "react";
import React from "react";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import "katex/dist/katex.min.css";

// 配置 marked 使用 katex 扩展（只配置一次）
marked.use(markedKatex({
  throwOnError: false
}));

interface ChatInterfaceProps {
  messages: Message[];
  appUser: any;
  guestChatSessions: any[];
  currentChatId: string;
  contextLimit?: number | null;
  setShowUpgradeDialog: (show: boolean) => void;
  selectedLanguage: string;
  jumpToScrollPosition: number | null;
  scrollAreaRef: any;
  messagesEndRef: any;
  isLoading: boolean;
  isConversationLoading: boolean;
  thinkingText: string;
  currentChat: any;
  getLocalizedText: (key: string) => string;
  copyToClipboard: (text: string) => void;
  shareMessage: (text: string) => void;
  downloadMessage: (content: string, id: string) => void;
  isMessageBookmarked: (id: string) => boolean;
  bookmarkMessage: (message: Message) => void;
  removeBookmark: (id: string) => void;
  setShowShareDialog: (show: boolean) => void;
  bookmarkedMessages: any[];
  onDeleteMessage: (messageId: string) => void;
}

const formatModelName = (raw: string) => {
  if (!raw) return "";
  const streaming = /\(streaming\.\.\.\)/i.test(raw);
  const cleaned = raw.replace(/\(streaming\.\.\.\)/i, "").trim();
  const normalized = cleaned.toLowerCase();
  const isGeneral =
    normalized === "general model" || normalized === GENERAL_MODEL_ID.toLowerCase();
  const mapped = isGeneral
    ? "General Model"
    : externalModels.find(
        (m) =>
          m.id.toLowerCase() === normalized ||
          m.name.toLowerCase() === normalized
      )?.name || cleaned;
  return streaming ? `${mapped} (Streaming...)` : mapped;
};

// AI消息内容组件，使用memo防止不必要的重新渲染
const AIMessageContent = memo(({ content, isStreaming }: {
  content: string;
  isStreaming?: boolean;
}) => {
  // 使用 marked 解析 markdown，避免 ReactMarkdown 的文本选择问题
  const htmlContent = useMemo(() => {
    try {
      // 预处理内容
      let processedContent = content;

      // 1. 修复标题格式（###1 -> ### 1）
      processedContent = processedContent.replace(/^(#{1,6})(\d)/gm, '$1 $2');

      // 2. 修复列表格式（-文字 -> - 文字，包括缩进的列表项）
      processedContent = processedContent.replace(/^(\s*)-([^\s])/gm, '$1- $2');

      // 3. 转换LaTeX分隔符为marked-katex支持的格式
      // 块级公式：\[ ... \] -> $$...$$（确保在同一行）
      processedContent = processedContent.replace(/\\\[\s*/g, '$$');
      processedContent = processedContent.replace(/\s*\\\]/g, '$$');

      // 行内公式：\( ... \) -> $ ... $
      processedContent = processedContent.replace(/\\\(/g, '$');
      processedContent = processedContent.replace(/\\\)/g, '$');

      // 3. 转换 \boxed{...} 为带CSS样式的span
      processedContent = processedContent.replace(/\\boxed\{([^}]+)\}/g, '<span class="math-boxed">$1</span>');

      return marked.parse(processedContent, {
        breaks: true,
        gfm: true,
      });
    } catch (error) {
      console.error('Markdown parsing error:', error);
      return content;
    }
  }, [content]);

  return (
    <div
      className="text-sm leading-relaxed space-y-2 markdown-content"
      style={{
        fontSize: 'var(--chat-font-size, 14px)',
        userSelect: 'text',
        WebkitUserSelect: 'text',
        MozUserSelect: 'text',
        msUserSelect: 'text'
      }}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
});

AIMessageContent.displayName = 'AIMessageContent';

export default memo(ChatInterface);

function ChatInterface({
  messages,
  appUser,
  guestChatSessions,
  currentChatId,
  contextLimit,
  setShowUpgradeDialog,
  selectedLanguage,
  jumpToScrollPosition,
  scrollAreaRef,
  messagesEndRef,
  isLoading,
  isConversationLoading,
  thinkingText,
  currentChat,
  getLocalizedText,
  copyToClipboard,
  shareMessage,
  downloadMessage,
  isMessageBookmarked,
  bookmarkMessage,
  removeBookmark,
  setShowShareDialog,
  bookmarkedMessages,
  onDeleteMessage,
}: ChatInterfaceProps) {
  const isFreeUser = !!appUser && !appUser.isPro && (appUser.plan || "").toLowerCase() === "free";
  // 直接使用 messages prop，ChatProvider 已正确处理消息来源（包括移动端访客试用模式）
  const activeMessages = messages;
  const ctxLimit = typeof contextLimit === "number" ? contextLimit : null;
  const roundsUsed =
    ctxLimit !== null
      ? Math.min(ctxLimit, activeMessages.filter((m) => m.role === "assistant").length)
      : null;
  const ctxRemaining =
    ctxLimit !== null && roundsUsed !== null ? Math.max(0, ctxLimit - roundsUsed) : null;
  // 只在剩余上下文 ≤ 5 条时显示固定横幅，减少冗余提示
  const showContextBanner =
    ctxLimit !== null && ctxRemaining !== null && ctxRemaining <= 5 && ctxRemaining > 0;
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [downloadedMessageId, setDownloadedMessageId] = useState<string | null>(null);
  const [mediaPreviewMap, setMediaPreviewMap] = useState<Record<string, string>>({});
  const [imagePreviewSrc, setImagePreviewSrc] = useState<string | null>(null);
  const resolvingIdsRef = useRef<Set<string>>(new Set());
  const [showCopyButton, setShowCopyButton] = useState(false);
  const [copyButtonPosition, setCopyButtonPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState("");

  const isDirectUrl = (val: string) =>
    /^https?:\/\//i.test(val || "") || (val || "").startsWith("blob:");

  const resolveMediaSrc = (val?: string) => {
    if (!val) return null;
    if (isDirectUrl(val)) return val;
    return mediaPreviewMap[val] || null;
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 0) {
      try {
        const range = selection?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();

        if (rect && rect.width > 0 && rect.height > 0) {
          // 计算按钮位置，考虑滚动偏移
          const scrollY = window.scrollY || window.pageYOffset;
          const buttonX = rect.left + rect.width / 2;
          const buttonY = rect.top + scrollY - 45;

          // 边界检查，确保按钮在视口内
          const finalX = Math.max(80, Math.min(buttonX, window.innerWidth - 80));
          const finalY = Math.max(10, buttonY);

          setCopyButtonPosition({ x: finalX, y: finalY });
          setSelectedText(text);
          setShowCopyButton(true);
        }
      } catch (error) {
        // 静默处理选择错误
        setShowCopyButton(false);
      }
    } else {
      setShowCopyButton(false);
    }
  };

  const handleCopySelected = () => {
    copyToClipboard(selectedText);
    setShowCopyButton(false);
  };

  // 关闭大图预览（含 Esc 支持）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImagePreviewSrc(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 监听鼠标松开事件来检测文本选择
  useEffect(() => {
    const handleMouseUp = () => {
      // 延迟执行,确保选择已完成
      setTimeout(() => {
        handleTextSelection();
      }, 10);
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  useEffect(() => {
    const pending: string[] = [];

    messages.forEach((m) => {
      const needImages = !(m as any).imagePreviews || (m as any).imagePreviews?.length === 0;
      const needVideos = !(m as any).videoPreviews || (m as any).videoPreviews?.length === 0;
      const needAudios = !(m as any).audioPreviews || (m as any).audioPreviews?.length === 0;

      if (needImages) {
        (m.images || []).forEach((id) => {
          if (
            typeof id === "string" &&
            id &&
            !isDirectUrl(id) &&
            !mediaPreviewMap[id] &&
            !resolvingIdsRef.current.has(id)
          ) {
            pending.push(id);
          }
        });
      }

      if (needVideos) {
        (m.videos || []).forEach((id) => {
          if (
            typeof id === "string" &&
            id &&
            !isDirectUrl(id) &&
            !mediaPreviewMap[id] &&
            !resolvingIdsRef.current.has(id)
          ) {
            pending.push(id);
          }
        });
      }

      if (needAudios) {
        (m as any).audios?.forEach((id: string) => {
          if (
            typeof id === "string" &&
            id &&
            !isDirectUrl(id) &&
            !mediaPreviewMap[id] &&
            !resolvingIdsRef.current.has(id)
          ) {
            pending.push(id);
          }
        });
      }
    });

    if (!pending.length) return;

    const unique = Array.from(new Set(pending));
    unique.forEach((id) => resolvingIdsRef.current.add(id));

    fetch("/api/domestic/media/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ids: unique }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.data) return;
        setMediaPreviewMap((prev) => ({ ...prev, ...data.data }));
      })
      .catch((err) => console.warn("[media][resolve] failed", err))
      .finally(() => {
        unique.forEach((id) => resolvingIdsRef.current.delete(id));
      });
  }, [messages, mediaPreviewMap]);

  // Normalize common AI 输出的"[\\vec{F} = m \\vec{a}]"或"\\[ ... \\]"为 math 块，仅在原文完全没有 $ 时执行，避免重复渲染
  const normalizeMathContent = (text: string) => {
    // 临时调试：查看包含答案的原始内容
    if (text.includes('答案')) {
      console.log('[DEBUG] 原始内容:', text.substring(text.indexOf('答案') - 20, text.indexOf('答案') + 50));
    }

    // If user已写 $, 不处理，避免重复
    if (/\$/.test(text)) return text;
    let out = text;

    // 修复Markdown标题语法问题 - 全面处理各种格式
    // 1. 移除标题前的多余空格和#: "  ## # 2." => "## 2."
    out = out.replace(/^[\s#]*(#{1,6})\s*#+\s*/gm, '$1 ');
    // 2. 确保标题符号后有且仅有一个空格: "###1." => "### 1.", "##  2." => "## 2."
    out = out.replace(/^(#{1,6})\s*/gm, '$1 ');
    // 3. 清理标题内容开头的多余#: "### # 标题" => "### 标题"
    out = out.replace(/^(#{1,6}\s+)#+\s*/gm, '$1');

    // 修复列表标记格式: "-项目" => "- 项目", "+项目" => "+ 项目", "*项目" => "* 项目"
    out = out.replace(/^([-+*])(?!\s)/gm, '$1 ');

    // \boxed{...} 转换为HTML边框样式（避免KaTeX渲染问题）
    out = out.replace(/\\boxed\{([^}]+)\}/g, '<span style="display:inline-block;border:1.5px solid currentColor;padding:3px 8px;border-radius:3px;margin:0 2px;">$1</span>');

    // \[ ... \]  => $$ ... $$
    out = out.replace(/\\\[(.+?)\\\]/gs, (_m, inner) => `$$${inner}$$`);

    // \( ... \)  => $ ... $
    out = out.replace(/\\\((.+?)\\\)/g, (_m, inner) => `$${inner}$`);

    // ( \vec{F} ) 样式 => $...$ 仅替换包含反斜杠命令的括号
    out = out.replace(/\((\\[a-zA-Z][^)]*?)\)/g, (_m, inner) => `$${inner}$`);

    // [\vec{F}] => $...$ （避免整段包裹中文）
    out = out.replace(/\[(\\[^\]]+)\]/g, (_m, inner) => `$${inner}$`);

    return out;
  };

  const stripAttachmentSummary = (text: string) => {
    if (!text) return "";

    // If the message contains a trailing attachment section (with or without **bold**),
    // drop everything from that line to the end so only the main text is shown.
    const lines = text.split(/\r?\n/);
    const attachmentLineIdx = lines.findIndex((line) => {
      const trimmed = line.trim().replace(/^\*\*|\*\*$/g, "");
      return /^附件文件[:：]?/i.test(trimmed) || /^attached files[:：]?/i.test(trimmed);
    });

    if (attachmentLineIdx !== -1) {
      return lines.slice(0, attachmentLineIdx).join("\n").trimEnd();
    }

    // Fallback: remove markdown "**附件文件:**" style blocks if present
    return text
      .replace(/\n\n[^\n]*\*\*(附件文件|Attached Files)\*\*[:：]?\s*\n[\s\S]*$/i, "")
      .trimEnd();
  };

  const markdownComponents = {
    h1: ({ ...props }) => (
      <h1
        className="text-xl font-semibold mt-2 mb-1 leading-snug text-gray-900 dark:text-[#ececf1]"
        {...props}
      />
    ),
    h2: ({ ...props }) => (
      <h2
        className="text-lg font-semibold mt-2 mb-1 leading-snug text-gray-900 dark:text-[#ececf1]"
        {...props}
      />
    ),
    h3: ({ ...props }) => (
      <h3 className="font-semibold mt-2 mb-1 leading-snug text-gray-900 dark:text-[#ececf1]" {...props} />
    ),
    p: ({ ...props }) => (
      <p className="mb-2 leading-relaxed whitespace-pre-wrap" {...props} />
    ),
    strong: ({ ...props }) => <strong className="font-semibold" {...props} />,
    em: ({ ...props }) => <em className="italic" {...props} />,
    ul: ({ ...props }) => (
      <ul className="list-disc pl-5 space-y-1 mb-2" {...props} />
    ),
    ol: ({ ...props }) => (
      <ol className="list-decimal pl-5 space-y-1 mb-2" {...props} />
    ),
    li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
    blockquote: ({ ...props }) => (
      <blockquote
        className="border-l-4 border-gray-200 dark:border-gray-600 pl-3 italic text-gray-700 dark:text-gray-200 mb-2"
        {...props}
      />
    ),
    code: (props: any) => {
      const { inline, className, children, node, ...rest } = props;
      if (inline) {
        return (
          <code
            className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#2f3037] text-[0.95em]"
            {...rest}
          >
            {children}
          </code>
        );
      }
      const codeText = String(children).replace(/\n$/, "");
      const blockId = `${node?.position?.start?.offset ?? 0}-${codeText.length}`;
      const isCopied = copiedCodeId === blockId;

      return (
        <div className="relative group">
          <pre
            className="bg-gray-900/90 text-gray-100 rounded-md p-3 overflow-x-auto text-sm mb-3"
            {...rest}
          >
            <code className={className}>{children}</code>
          </pre>
          <button
            type="button"
            onClick={() => {
              copyToClipboard(codeText);
              setCopiedCodeId(blockId);
              setTimeout(() => setCopiedCodeId(null), 1600);
            }}
            className="absolute top-2 right-2 text-[11px] px-2 py-1 rounded-md bg-white/90 text-gray-800 shadow-sm border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity dark:bg-[#2f3037] dark:text-gray-100 dark:border-gray-600"
          >
            {isCopied ? getLocalizedText("copied") || "Copied" : getLocalizedText("copy") || "Copy"}
          </button>
        </div>
      );
    },
    a: ({ ...props }) => (
      <a
        className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300"
        target="_blank"
        rel="noreferrer"
        {...props}
      />
    ),
    table: ({ ...props }) => (
      <table
        className="border-collapse border border-gray-300 dark:border-gray-600 my-2 text-sm"
        {...props}
      />
    ),
    thead: ({ ...props }) => (
      <thead className="bg-gray-100 dark:bg-[#3a3b42]" {...props} />
    ),
    td: ({ ...props }) => (
      <td
        className="border border-gray-300 dark:border-gray-600 px-2 py-1"
        {...props}
      />
    ),
    th: ({ ...props }) => (
      <th
        className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left font-semibold"
        {...props}
      />
    ),
  };

  return (
    <div className="flex-1 overflow-hidden min-h-0 bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-[#1c1d24] dark:via-[#181920] dark:to-[#0f1016] transition-colors relative">
      {isConversationLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 dark:bg-black/60 backdrop-blur-sm">
          <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-200">
            <div className="h-5 w-5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
            <span className="text-sm">
              {getLocalizedText("loading") || "Loading conversation..."}
            </span>
          </div>
        </div>
      )}
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-[#2d2d30] transition-colors">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-[#ececf1] mb-4">
              {getLocalizedText("appName")}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              {getLocalizedText("heroTagline")}
            </p>

            {/* Compact Tips */}
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-2 sm:p-3 max-w-4xl mx-auto">
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:gap-x-5 text-[10px] sm:text-xs text-blue-800 dark:text-blue-200">
                <span>🧭 {getLocalizedText("beSpecific")}</span>
                <span>🚀 {getLocalizedText("chooseSpecialized")}</span>
                <span>📎 {getLocalizedText("uploadFilesWith")}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <ScrollArea
          className={`h-full ${
            isConversationLoading ? "pointer-events-none blur-[1px]" : ""
          }`}
          ref={scrollAreaRef}
        >
          <div
            className={`p-2 sm:p-4 transition-colors duration-500 ${
              jumpToScrollPosition !== null && jumpToScrollPosition > 0
                ? "bg-blue-50 dark:bg-blue-900/30"
                : ""
            }`}
          >
            <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4">
              {showContextBanner && (
                <div className="sticky top-0 z-10 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-50/90 to-orange-50/90 dark:from-amber-900/30 dark:to-orange-900/30 backdrop-blur-sm border border-amber-200/50 dark:border-amber-700/50 text-[11px] text-amber-700 dark:text-amber-200 flex items-center justify-center gap-2 shadow-sm mx-auto w-fit">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {selectedLanguage === "zh"
                      ? `上下文剩余 ${ctxRemaining} 条`
                      : `${ctxRemaining} context left`}
                  </span>
                  <span className="text-amber-400">·</span>
                  <button
                    type="button"
                    onClick={() => setShowUpgradeDialog(true)}
                    className="font-medium text-amber-600 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-100 transition-colors underline-offset-2 hover:underline"
                  >
                    {selectedLanguage === "zh" ? "升级获取更多" : "Upgrade"}
                  </button>
                </div>
              )}
              {activeMessages.map((message: Message, index: number) => {
                    const isUser = message.role === "user";
                    const prevMessage = index > 0 ? activeMessages[index - 1] : null;
                    const showDateSeparator = !prevMessage || !isSameDay(message.timestamp, prevMessage.timestamp);
                    const dateLabel = showDateSeparator ? formatMessageDate(message.timestamp, selectedLanguage) : null;
                    const userDisplayName =
                      (appUser?.name || "").trim() ||
                      getLocalizedText("you") ||
                      "You";
                    const assistantDisplayName =
                      formatModelName(
                        (message.model || currentChat?.model || "").trim()
                      ) ||
                      getLocalizedText("assistant") ||
                      "Assistant";
                    const timeLabel = new Date(message.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const baseImages =
                      (message.imagePreviews && message.imagePreviews.length
                        ? message.imagePreviews
                        : message.images) || [];
                    const baseVideos =
                      (message.videoPreviews && message.videoPreviews.length
                        ? message.videoPreviews
                        : message.videos) || [];
                    const baseAudios =
                      (message.audioPreviews && message.audioPreviews.length
                        ? message.audioPreviews
                        : (message as any).audios) || [];
                    const resolvedImages = Array.from(
                      new Set(
                        (baseImages as string[])
                          .map((src) => resolveMediaSrc(src))
                          .filter((v): v is string => !!v),
                      ),
                    );
                    const resolvedVideos = Array.from(
                      new Set(
                        (baseVideos as string[])
                          .map((src) => resolveMediaSrc(src))
                          .filter((v): v is string => !!v),
                      ),
                    );
                    const resolvedAudios = Array.from(
                      new Set(
                        (baseAudios as string[])
                          .map((src) => resolveMediaSrc(src))
                          .filter((v): v is string => !!v),
                      ),
                    );
                    const unresolvedMedia = Array.from(
                      new Set(
                        [...baseImages, ...baseVideos, ...baseAudios].filter(
                          (src) => typeof src === "string" && !resolveMediaSrc(src),
                        ) as string[],
                      ),
                    );

                    const bubble = (
                      <div
                        className={`w-full sm:max-w-3xl p-3 sm:p-4 rounded-xl sm:rounded-2xl relative group shadow-lg ${
                          isUser
                            ? "bg-gradient-to-br from-indigo-500 via-blue-500 to-blue-600 text-white shadow-blue-500/25"
                            : "bg-white/90 dark:bg-[#2f3039] border border-white/70 dark:border-[#3f4150] text-gray-900 dark:text-[#e7e9f3] backdrop-blur"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                          <span
                            className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-semibold rounded-full ${
                              isUser
                                ? "bg-white/20 text-white"
                                : "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-100"
                            }`}
                          >
                            {isUser ? userDisplayName : assistantDisplayName}
                          </span>
                          <span
                            className={`ml-auto text-[10px] sm:text-[11px] ${
                              isUser ? "text-white/80" : "text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            {timeLabel}
                          </span>
                        </div>

                        {message.isMultiGPT && (
                          <div className="flex items-center space-x-2 mb-3 text-indigo-200 dark:text-indigo-300">
                            <Zap className="w-4 h-4" />
                            <span className="text-sm font-medium">
                              {getLocalizedText("multiGPTDeepThinking")}
                            </span>
                          </div>
                        )}
                        {isUser ? (
                          <p className="whitespace-pre-wrap leading-relaxed" style={{ fontSize: 'var(--chat-font-size, 14px)' }}>
                            {stripAttachmentSummary(message.content)}
                            {message.isStreaming && (
                              <span className="inline-block w-0.5 h-4 bg-white/90 ml-1 animate-pulse"></span>
                            )}
                          </p>
                        ) : (
                          <AIMessageContent
                            content={message.content}
                            isStreaming={message.isStreaming}
                          />
                        )}
                        {(resolvedImages.length > 0 ||
                          resolvedVideos.length > 0 ||
                          resolvedAudios.length > 0 ||
                          unresolvedMedia.length > 0) && (
                          <div className="mt-3 space-y-2">
                            {(resolvedImages.length > 0 ||
                              resolvedVideos.length > 0 ||
                              resolvedAudios.length > 0) && (
                              <div className="flex flex-wrap gap-3">
                                {resolvedImages.map((src) => (
                                  <img
                                    key={src}
                                    src={src}
                                    alt="attachment"
                                    className="max-h-44 rounded-lg border border-gray-200 dark:border-[#4a4c5c] object-cover bg-black/5 cursor-zoom-in"
                                    onClick={() => setImagePreviewSrc(src)}
                                  />
                                ))}
                                {resolvedVideos.map((src, idx) => (
                                  <video
                                    key={`${src}-${idx}`}
                                    controls
                                    src={src}
                                    className="h-44 rounded-lg border border-gray-200 dark:border-[#4a4c5c] bg-black"
                                  >
                                    {getLocalizedText("videoNotSupported") || "Video not supported"}
                                  </video>
                                ))}
                                {resolvedAudios.map((src, idx) => (
                                  <AudioPlayer
                                    key={`audio-${src}-${idx}`}
                                    src={src}
                                    className="w-72"
                                  />
                                ))}
                              </div>
                            )}
                            {unresolvedMedia.length > 0 && (
                              <div
                                className={`flex flex-wrap gap-2 text-xs ${
                                  isUser ? "text-white/80" : "text-gray-500 dark:text-gray-400"
                                }`}
                              >
                                {unresolvedMedia.map((id) => (
                                  <span
                                    key={id}
                                    className="px-2 py-1 rounded border border-current/40 bg-white/10 dark:bg-white/5"
                                  >
                                    {id.split("/").pop()?.slice(-24) || id.slice(-18)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {!isUser && (
                          <div className="flex items-center flex-wrap gap-1 sm:gap-2 mt-3 pt-3 border-t border-gray-200/70 dark:border-[#4a4c5c]">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869]"
                              onClick={() => {
                                copyToClipboard(message.content);
                                setCopiedMessageId(message.id);
                                setTimeout(() => setCopiedMessageId(null), 2000);
                              }}
                              title={getLocalizedText("copyResponse")}
                            >
                              <Copy className="w-3 h-3 sm:mr-1" />
                              <span className="hidden sm:inline">
                                {copiedMessageId === message.id
                                  ? (getLocalizedText("copied") || "已复制")
                                  : (getLocalizedText("copy") || "复制")}
                              </span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869]"
                              onClick={() => {
                                downloadMessage(message.content, message.id);
                                setDownloadedMessageId(message.id);
                                setTimeout(() => setDownloadedMessageId(null), 2000);
                              }}
                              title={getLocalizedText("downloadResponse")}
                            >
                              <Download className="w-3 h-3 sm:mr-1" />
                              <span className="hidden sm:inline">
                                {downloadedMessageId === message.id
                                  ? (getLocalizedText("downloaded") || "已下载")
                                  : (getLocalizedText("download") || "下载")}
                              </span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs ${
                                isMessageBookmarked(message.id)
                                  ? "text-yellow-600 dark:text-yellow-400"
                                  : "text-gray-700 dark:text-gray-300"
                              } hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-gray-100 dark:hover:bg-[#565869]`}
                              onClick={() =>
                                isMessageBookmarked(message.id)
                                  ? removeBookmark(
                                      bookmarkedMessages.find((b) => b.messageId === message.id)?.id || ""
                                    )
                                  : bookmarkMessage(message)
                              }
                              title={
                                isMessageBookmarked(message.id)
                                  ? getLocalizedText("removeBookmark")
                                  : getLocalizedText("bookmarkMessage")
                              }
                            >
                              <Star
                                className={`w-3 h-3 sm:mr-1 ${
                                  isMessageBookmarked(message.id) ? "fill-current" : ""
                                }`}
                              />
                              <span className="hidden sm:inline">
                                {isMessageBookmarked(message.id)
                                  ? getLocalizedText("bookmarked")
                                  : getLocalizedText("bookmark")}
                              </span>
                            </Button>
                          </div>
                        )}
                      </div>
                    );

                    return (
                      <React.Fragment key={message.id}>
                        {showDateSeparator && (
                          <div className="flex items-center justify-center my-4">
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
                            <span className="px-4 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-gray-800/80 rounded-full backdrop-blur-sm">
                              {dateLabel}
                            </span>
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
                          </div>
                        )}
                        <div
                          id={`message-${message.id}`}
                          className={`flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-3 ${
                            isUser ? "items-end sm:flex-row-reverse" : "items-start sm:flex-row"
                          } transition-colors duration-500`}
                        >
                        {/* 头像：移动端在上方小尺寸，桌面端在侧边 */}
                        {isUser && appUser?.avatar ? (
                          <img
                            src={appUser.avatar}
                            alt={appUser.name || "User"}
                            className="h-6 w-6 sm:mt-1 sm:h-10 sm:w-10 sm:min-w-[2.5rem] sm:min-h-[2.5rem] flex-shrink-0 rounded-full sm:rounded-xl object-cover shadow-md shadow-blue-400/30"
                          />
                        ) : (
                          <div
                            className={`h-6 w-6 sm:mt-1 sm:h-10 sm:w-10 sm:min-w-[2.5rem] sm:min-h-[2.5rem] flex-shrink-0 rounded-full sm:rounded-xl flex items-center justify-center text-white shadow-md ${
                              isUser
                                ? "bg-gradient-to-br from-indigo-500 to-blue-600 shadow-blue-400/30"
                                : "bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-400/30"
                            }`}
                          >
                            {isUser ? <User className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> : <Bot className="w-3.5 h-3.5 sm:w-5 sm:h-5" />}
                          </div>
                        )}

                        {isUser ? (
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div onContextMenu={(e) => {
                                // 只有在没有选中文本时才触发右键菜单
                                if (!isUser && window.getSelection()?.toString()) {
                                  e.preventDefault();
                                }
                              }}>
                                {bubble}
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
                              <ContextMenuItem
                                onClick={() => onDeleteMessage(message.id)}
                                className="text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {getLocalizedText("delete") || "Delete"}
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        ) : (
                          bubble
                        )}
                      </div>
                      </React.Fragment>
                    );
                  })}
              {isLoading && thinkingText && (
                <div className="flex justify-start">
                  <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-gray-400"></div>
                    <span className="text-sm">{thinkingText}</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </ScrollArea>
      )}
      {imagePreviewSrc && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setImagePreviewSrc(null)}
          role="presentation"
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2"
            onClick={(e) => {
              e.stopPropagation();
              setImagePreviewSrc(null);
            }}
            aria-label="关闭预览"
          >
            ✕
          </button>
          <img
            src={imagePreviewSrc}
            alt="预览"
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl border border-white/20 object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      {showCopyButton && (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleCopySelected}
          className="fixed z-[9999] px-3 py-2 bg-white dark:bg-[#2f3039] text-gray-900 dark:text-gray-100 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-[#3a3b44] transition-colors flex items-center gap-2"
          style={{
            left: `${copyButtonPosition.x}px`,
            top: `${copyButtonPosition.y}px`,
            transform: 'translateX(-50%)'
          }}
        >
          <Copy className="w-4 h-4" />
          <span className="text-sm">{getLocalizedText("copy") || "Copy"}</span>
        </button>
      )}
    </div>
  );
}
