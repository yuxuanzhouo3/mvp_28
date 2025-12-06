import { useState } from "react";
import type { Message, ChatSession, ExternalModel } from "../../types";
import { DEFAULT_LANGUAGE, getCurrentModelConfig } from "../../config";
import { externalModels } from "../../constants";

export const useChatState = () => {
  const currentModelConfig = getCurrentModelConfig();
  // When default language is non-en (e.g., zh/ch), pick the first external model as default
  const defaultModelId =
    DEFAULT_LANGUAGE === "en"
      ? currentModelConfig.defaultModel
      : externalModels[0]?.id || currentModelConfig.defaultModel;
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState("");
  // 国内版默认模型：取配置中的 defaultModel（例如 qwen3-max）
  const [selectedModel, setSelectedModel] = useState(defaultModelId);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [isProVoiceChatActive, setIsProVoiceChatActive] = useState(false);
  const [proVoiceChatStream, setProVoiceChatStream] =
    useState<MediaStream | null>(null);
  const [textareaHeight, setTextareaHeight] = useState("auto");
  const [selectedText, setSelectedText] = useState("");
  const [jumpToScrollPosition, setJumpToScrollPosition] = useState<
    number | null
  >(null);
  const [promptScrollPosition, setPromptScrollPosition] = useState(0);
  const [bookmarkScrollPosition, setBookmarkScrollPosition] = useState(0);
  const [sidebarScrollPosition, setSidebarScrollPosition] = useState(0);
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<string>("");
  const [selectedModelFilter, setSelectedModelFilter] = useState<string>("");
  // 国内版默认按外部模型（Qwen/DeepSeek 等）走 external
  const [selectedModelType, setSelectedModelType] =
    useState<string>("external");
  const [selectedLanguage, setSelectedLanguage] =
    useState<string>(DEFAULT_LANGUAGE);
  const [shortcutsEnabled, setShortcutsEnabled] = useState<boolean>(false);
  const [selectedAPI, setSelectedAPI] = useState<string>("");
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isPromptHistoryOpen, setIsPromptHistoryOpen] = useState(false);
  const [isAskGPTOpen, setIsAskGPTOpen] = useState(false);
  const [showModelSelectorModal, setShowModelSelectorModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [modalModel, setModalModel] = useState<ExternalModel | null>(null);
  const [modalModelResponse, setModalModelResponse] = useState("");
  const [modalModelLoading, setModalModelLoading] = useState(false);
  const [modalModelError, setModalModelError] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<string[]>(["general"]);
  const [uploadError, setUploadError] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [bookmarkSearchQuery, setBookmarkSearchQuery] = useState("");
  const [promptSearchQuery, setPromptSearchQuery] = useState("");
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [streamingController, setStreamingController] =
    useState<AbortController | null>(null);

  return {
    messages,
    setMessages,
    prompt,
    setPrompt,
    isLoading,
    setIsLoading,
    thinkingText,
    setThinkingText,
    isStreaming,
    setIsStreaming,
    chatSessions,
    setChatSessions,
    currentChatId,
    setCurrentChatId,
    selectedModel,
    setSelectedModel,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    editingChatId,
    setEditingChatId,
    isProVoiceChatActive,
    setIsProVoiceChatActive,
    proVoiceChatStream,
    setProVoiceChatStream,
    textareaHeight,
    setTextareaHeight,
    selectedText,
    setSelectedText,
    jumpToScrollPosition,
    setJumpToScrollPosition,
    promptScrollPosition,
    setPromptScrollPosition,
    bookmarkScrollPosition,
    setBookmarkScrollPosition,
    sidebarScrollPosition,
    setSidebarScrollPosition,
    selectedCategoryFilter,
    setSelectedCategoryFilter,
    selectedModelFilter,
    setSelectedModelFilter,
    selectedModelType,
    setSelectedModelType,
    selectedLanguage,
    setSelectedLanguage,
    shortcutsEnabled,
    setShortcutsEnabled,
    selectedAPI,
    setSelectedAPI,
    isModelSelectorOpen,
    setIsModelSelectorOpen,
    isPromptHistoryOpen,
    setIsPromptHistoryOpen,
    isAskGPTOpen,
    setIsAskGPTOpen,
    showModelSelectorModal,
    setShowModelSelectorModal,
    showModelModal,
    setShowModelModal,
    modalModel,
    setModalModel,
    modalModelResponse,
    setModalModelResponse,
    modalModelLoading,
    setModalModelLoading,
    modalModelError,
    setModalModelError,
    expandedFolders,
    setExpandedFolders,
    uploadError,
    setUploadError,
    isUploading,
    setIsUploading,
    editingTitle,
    setEditingTitle,
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarWidth,
    setSidebarWidth,
    isResizingSidebar,
    setIsResizingSidebar,
    startX,
    setStartX,
    startWidth,
    setStartWidth,
    bookmarkSearchQuery,
    setBookmarkSearchQuery,
    promptSearchQuery,
    setPromptSearchQuery,
    messageSearchQuery,
    setMessageSearchQuery,
    streamingController,
    setStreamingController,
  };
};
