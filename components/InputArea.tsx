"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableTextarea } from "@/components/ui/resizable-textarea";
import {
  Brain,
  Lightbulb,
  Target,
  Zap,
  Paperclip,
  MicOff,
  X,
  Camera,
  Clock,
  Mic,
  Video,
  Square,
  Send,
  Search,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Globe,
  Copy,
  Folder,
  Edit3,
  Trash2,
  Check,
  Plus,
  Download,
  Circle,
  Upload,
  MapPin,
  Code,
  Cpu,
  Wind,
  Bot,
  Image,
  FileText,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useCamera, useAudioRecording, useIsMobile } from "@/hooks";
import { UploadedFilesList } from "@/features/chat/components/input/UploadedFilesList";
import { StatusIndicators } from "@/features/chat/components/input/StatusIndicators";
import { CameraPanel } from "@/features/chat/components/input/CameraPanel";
import { AudioRecordingPanel } from "@/features/chat/components/input/AudioRecordingPanel";
import type { AttachmentItem } from "@/types";
import { GENERAL_MODEL_ID } from "@/utils/model-limits";
import { IS_DOMESTIC_VERSION } from "@/config";

interface InputAreaProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  handleTextSelection: () => void;
  setTextareaHeight: (height: string) => void;
  selectedText: string;
  copySelectedText: () => void;
  deleteSelectedText: () => void;
  textareaRef: any;
  handleSubmit: () => void;
  isLoading: boolean;
  appUser: any;
  checkHotkeyMatch: (e: React.KeyboardEvent<HTMLTextAreaElement>, hotkey: string) => boolean;
  handleQuickAction: (action: string) => void;
  getLocalizedText: (key: string) => string;
  uploadedFiles: AttachmentItem[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<AttachmentItem[]>>;
  MAX_FILES: number;
  MAX_TOTAL_SIZE: number;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
  removeFile: (index: number) => void;
  formatFileSize: (bytes: number) => string;
  getFileIcon: (type: string) => string;
  isRecording: boolean;
  toggleVoiceRecording: () => void;
  resetVoiceRecording: () => void;
  currentLocation: any;
  isGettingLocation: boolean;
  getCurrentLocation: () => void;
  clearLocation: () => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  isAskGPTOpen: boolean;
  setIsAskGPTOpen: (open: boolean) => void;
  jumpToMessage: (id: string) => void;
  messageSearchQuery: string;
  setMessageSearchQuery: (query: string) => void;
  getFilteredMessages: () => any[];
  jumpToScrollRef: any;
  bookmarkSearchQuery: string;
  setBookmarkSearchQuery: (query: string) => void;
  bookmarkScrollRef: any;
  bookmarkedMessages: any[];
  bookmarkFolders: any[];
  selectedBookmarkFolder: string;
  setSelectedBookmarkFolder: (folder: string) => void;
  exportBookmarks: () => void;
  importBookmarks: () => void;
  setShowCreateFolderDialog: (show: boolean) => void;
  editingBookmarkId: string | null;
  editingBookmarkName: string;
  setEditingBookmarkName: (name: string) => void;
  saveBookmarkName: () => void;
  cancelBookmarkEditing: () => void;
  getFilteredBookmarks: () => any[];
  jumpToBookmark: (bookmark: any) => void;
  removeBookmark: (id: string) => void;
  moveBookmarkToFolder: (bookmarkId: string, folderId: string) => void;
  deleteBookmarkFolder: (id: string) => void;
  promptSearchQuery: string;
  setPromptSearchQuery: (query: string) => void;
  promptScrollRef: any;
  getFilteredPrompts: () => any[];
  handlePromptSelect: (prompt: string) => void;
  truncateText: (text: string, maxLength: number) => string;
  isProVoiceChatActive: boolean;
  stopProVoiceChat: () => void;
  scrollToInputArea: () => void;
  startProVoiceChat: () => void;
  isProVideoChatActive: boolean;
  stopProVideoChat: () => void;
  startProVideoChat: () => void;
  getModelIcon: () => any;
  getSelectedModelDisplay: () => string;
  isModelSelectorOpen: boolean;
  setIsModelSelectorOpen: (open: boolean) => void;
  isModelLocked: boolean;
  selectedModelType: string;
  setSelectedModelType: (type: string) => void;
  handleModelChange: (
    type: string,
    category?: string,
    modelId?: string
  ) => void;
  selectedCategory: string;
  mornGPTCategories: any[];
  selectedAPI: string;
  setSelectedAPI: (api: string) => void;
  externalAPIs: any[];
  externalModels: any[];
  isStreaming: boolean;
  stopStreaming: () => void;
  uploadError: string;
  setUploadError: (error: string) => void;
  voiceError: string;
  locationError: string;
  proChatError: string;
  selectedLanguage: string;
  allowAudioUpload: boolean;
}

const InputArea = React.memo(function InputArea({
  prompt,
  setPrompt,
  handleTextSelection,
  setTextareaHeight,
  selectedText,
  copySelectedText,
  deleteSelectedText,
  textareaRef,
  handleSubmit,
  isLoading,
  appUser,
  checkHotkeyMatch,
  handleQuickAction,
  getLocalizedText,
  uploadedFiles,
  setUploadedFiles,
  MAX_FILES,
  MAX_TOTAL_SIZE,
  handleFileUpload,
  isUploading,
  removeFile,
  formatFileSize,
  getFileIcon,
  isRecording,
  toggleVoiceRecording,
  resetVoiceRecording,
  currentLocation,
  isGettingLocation,
  getCurrentLocation,
  clearLocation,
  isDarkMode,
  toggleTheme,
  isAskGPTOpen,
  setIsAskGPTOpen,
  jumpToMessage,
  messageSearchQuery,
  setMessageSearchQuery,
  getFilteredMessages,
  jumpToScrollRef,
  bookmarkSearchQuery,
  setBookmarkSearchQuery,
  bookmarkScrollRef,
  bookmarkedMessages,
  bookmarkFolders,
  selectedBookmarkFolder,
  setSelectedBookmarkFolder,
  exportBookmarks,
  importBookmarks,
  setShowCreateFolderDialog,
  editingBookmarkId,
  editingBookmarkName,
  setEditingBookmarkName,
  saveBookmarkName,
  cancelBookmarkEditing,
  getFilteredBookmarks,
  jumpToBookmark,
  removeBookmark,
  moveBookmarkToFolder,
  deleteBookmarkFolder,
  promptSearchQuery,
  setPromptSearchQuery,
  promptScrollRef,
  getFilteredPrompts,
  handlePromptSelect,
  truncateText,
  isProVoiceChatActive,
  stopProVoiceChat,
  scrollToInputArea,
  startProVoiceChat,
  isProVideoChatActive,
  stopProVideoChat,
  startProVideoChat,
  getModelIcon,
  getSelectedModelDisplay,
  isModelSelectorOpen,
  setIsModelSelectorOpen,
    isModelLocked,
  selectedModelType,
  setSelectedModelType,
  handleModelChange,
  selectedCategory,
  mornGPTCategories,
  selectedAPI,
  setSelectedAPI,
  externalAPIs,
  externalModels,
  isStreaming,
  stopStreaming,
  uploadError,
  setUploadError,
  voiceError,
  locationError,
  proChatError,
  selectedLanguage,
  allowAudioUpload,
}: InputAreaProps) {
  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    // Calculate new height (min 24px, max 240px for 10 lines)
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 24), 240);
    textarea.style.height = `${newHeight}px`;
  }, [prompt, textareaRef]);

  // Use camera hook
  const {
    isCameraActive,
    toggleCamera,
    cameraStream,
    isCameraSupported,
    isVideoRecording,
    recordingTime,
    formatRecordingTime,
    cameraMode,
    switchCameraMode,
    capturePhoto,
    toggleVideoRecording,
    stopCamera,
    capturedMedia,
    cameraError,
    isCapturing,
    isConverting,
    convertProgress,
  } = useCamera();

  // 音频录制 hook（用于录制音频文件上传）
  const {
    isAudioRecording,
    audioRecordingTime,
    startAudioRecording,
    stopAudioRecording,
    formatRecordingTime: formatAudioTime,
  } = useAudioRecording();

  // 录音面板状态
  const [isAudioPanelActive, setIsAudioPanelActive] = React.useState(false);

  // 国际版功能开发中提示（必须在 handleMediaCaptured 之前定义）
  const [featureInDevMessage, setFeatureInDevMessage] = React.useState<string>("");

  const showFeatureInDevelopment = React.useCallback(() => {
    const message = selectedLanguage === "zh"
      ? "该功能正在开发中，敬请期待..."
      : "This feature is under development, stay tuned...";
    setFeatureInDevMessage(message);
    setTimeout(() => setFeatureInDevMessage(""), 4000);
  }, [selectedLanguage]);

  // 辅助函数：直接调用 handleFileUpload（最可靠的方法）
  const triggerFileUpload = React.useCallback((file: File) => {
    const input = document.getElementById("file-upload") as HTMLInputElement;
    if (!input) {
      console.error("[triggerFileUpload] file-upload input not found");
      return;
    }

    try {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;

      // 创建模拟的 React ChangeEvent 并直接调用 handleFileUpload
      const mockEvent = {
        target: input,
        currentTarget: input,
      } as React.ChangeEvent<HTMLInputElement>;

      handleFileUpload(mockEvent);
      console.log("[triggerFileUpload] File upload triggered:", file.name, file.type, file.size);
    } catch (error) {
      console.error("[triggerFileUpload] Failed to trigger upload:", error);
    }
  }, [handleFileUpload]);

  // 处理音频录制完成
  const handleAudioRecordingComplete = React.useCallback(
    (result: { blob: Blob; url: string; name: string }) => {
      console.log("[handleAudioRecordingComplete] Audio recording completed:", result.name, result.blob.type, result.blob.size);
      const file = new File([result.blob], result.name, { type: result.blob.type });
      triggerFileUpload(file);
    },
    [triggerFileUpload]
  );

  // 切换音频录制状态
  const toggleAudioRecording = React.useCallback(() => {
    if (isAudioRecording) {
      stopAudioRecording();
    } else {
      startAudioRecording(handleAudioRecordingComplete);
    }
  }, [isAudioRecording, startAudioRecording, stopAudioRecording, handleAudioRecordingComplete]);

  // 处理摄像头捕获的媒体
  const handleMediaCaptured = React.useCallback(
    (media: { type: "image" | "video"; data: string; blob?: Blob; name: string }) => {
      console.log("[handleMediaCaptured] Media captured:", media.type, media.name, media.blob?.size);

      if (!media.blob) {
        console.error("[handleMediaCaptured] No blob provided");
        return;
      }

      // 国际版：显示功能开发中提示
      if (!IS_DOMESTIC_VERSION) {
        console.log("[handleMediaCaptured] International version, feature in development");
        showFeatureInDevelopment();
        return;
      }

      // 创建 File 对象并复用文件上传逻辑
      const mimeType = media.type === "image" ? "image/jpeg" : "video/webm";
      const file = new File([media.blob], media.name, { type: mimeType });
      console.log("[handleMediaCaptured] File created:", file.name, file.type, file.size);
      triggerFileUpload(file);
    },
    [showFeatureInDevelopment, triggerFileUpload]
  );

  const allowedTypesHint =
    selectedLanguage === "zh"
      ? "支持：图片、视频、音频（不可混合类型上传）"
      : "Allowed: image, video, or audio only (single type at a time)";
  const fileUploadDisabledReason = !IS_DOMESTIC_VERSION
    ? selectedLanguage === "zh"
      ? "国际版暂未接入多模态模型，文件上传已禁用"
      : "File upload is disabled on the international build (multimodal not yet supported)."
    : null;

  const attachmentButtonTitle = React.useMemo(() => {
    if (fileUploadDisabledReason) return fileUploadDisabledReason;
    const base =
      uploadedFiles.length >= MAX_FILES
        ? getLocalizedText("maximumFilesReached").replace("{count}", MAX_FILES.toString())
        : isUploading
        ? getLocalizedText("uploading")
        : getLocalizedText("uploadFilesMaxCount").replace("{count}", MAX_FILES.toString());
    return `${base}\n${allowedTypesHint}`;
  }, [
    fileUploadDisabledReason,
    uploadedFiles.length,
    MAX_FILES,
    isUploading,
    getLocalizedText,
    MAX_TOTAL_SIZE,
    allowedTypesHint,
  ]);

  const focusTextarea = React.useCallback(() => {
    if (textareaRef?.current) {
      textareaRef.current.focus();
    }
  }, [textareaRef]);

  const handleModelSelect = (
    type: string,
    category?: string,
    modelId?: string
  ) => {
    setModelSelectorTab(type);
    handleModelChange(type, category, modelId);
    // Focus input so user can type immediately after selecting model
    setTimeout(() => focusTextarea(), 0);
  };

  // Track and show the latest error across voice/camera/upload/location/pro chat
  const errorSeq = React.useRef<number>(0);
  const errorSeqMap = React.useRef<Record<string, number>>({});
  const [latestError, setLatestError] = React.useState<string>("");

  React.useEffect(() => {
    const errorEntries = [
      { key: "voice", value: voiceError },
      { key: "camera", value: cameraError },
      { key: "upload", value: uploadError },
      { key: "location", value: locationError },
      { key: "prochat", value: proChatError },
    ];

    let changed = false;

    for (const { key, value } of errorEntries) {
      if (value) {
        errorSeq.current += 1;
        errorSeqMap.current[key] = errorSeq.current;
        changed = true;
      } else if (errorSeqMap.current[key]) {
        delete errorSeqMap.current[key];
        changed = true;
      }
    }

    if (!changed) return;

    const entries = Object.entries(errorSeqMap.current);
    if (!entries.length) {
      setLatestError("");
      return;
    }

    const [latestKey] = entries.reduce((a, b) => (a[1] > b[1] ? a : b));
    const latestValue = errorEntries.find((e) => e.key === latestKey)?.value || "";
    setLatestError(latestValue);
  }, [voiceError, cameraError, uploadError, locationError, proChatError]);

  // Get language context
  const { isDomesticVersion } = useLanguage();

  // 检测移动端
  const isMobile = useIsMobile();
  // 国内版移动端隐藏 MornGPT 专家模型
  const hideMornGPTModels = IS_DOMESTIC_VERSION && isMobile;

  // 独立的模型选择 Tab 状态（仅用于弹窗切换，不影响当前已选模型）
  const [modelSelectorTab, setModelSelectorTab] = React.useState(selectedModelType);

  // 国内版移动端访客模式：禁用外部模型选择
  const isGuestMode = IS_DOMESTIC_VERSION && isMobile && !appUser;

  // 弹窗打开时同步当前模型到本地 Tab，避免误切换
  React.useEffect(() => {
    if (isModelSelectorOpen) {
      setModelSelectorTab(selectedModelType);
    }
  }, [isModelSelectorOpen, selectedModelType]);
  
  // Filter models based on deployment version
  const filteredExternalModels = externalModels.filter((model) =>
    isDomesticVersion ? model.category === "domestic" : model.category === "international"
  );

  const filteredExternalAPIs = externalAPIs.filter((api) =>
    filteredExternalModels.some(
      (model) => model.provider.toLowerCase() === api.name.toLowerCase()
    )
  );

  const domesticMultimodalModels = isDomesticVersion
    ? filteredExternalModels.filter((model) => model.modality === "multimodal")
    : [];

  const domesticTextModels = isDomesticVersion
    ? filteredExternalModels.filter((model) => model.modality !== "multimodal")
    : [];

  // 获取外部模型图标
  const getExternalModelIcon = (model: any) => {
    // 多模态模型使用图像图标
    if (model.modality === "multimodal") {
      return <Image className="w-3 h-3" />;
    }
    // 代码模型
    if (model.id.toLowerCase().includes("coder") || model.id.toLowerCase().includes("codestral")) {
      return <Code className="w-3 h-3" />;
    }
    // 根据提供商返回图标
    const provider = model.provider?.toLowerCase();
    switch (provider) {
      case "qwen":
        return <Brain className="w-3 h-3" />;
      case "deepseek":
        return <Search className="w-3 h-3" />;
      case "kimi":
        return <MessageSquare className="w-3 h-3" />;
      case "glm":
        return <Cpu className="w-3 h-3" />;
      case "mistral":
        return <Wind className="w-3 h-3" />;
      default:
        return <Bot className="w-3 h-3" />;
    }
  };

  // 获取外部模型图标背景色
  const getExternalModelIconColor = (model: any) => {
    if (model.modality === "multimodal") {
      return "bg-purple-500";
    }
    if (model.id.toLowerCase().includes("coder") || model.id.toLowerCase().includes("codestral")) {
      return "bg-emerald-500";
    }
    const provider = model.provider?.toLowerCase();
    switch (provider) {
      case "qwen":
        return "bg-blue-500";
      case "deepseek":
        return "bg-indigo-500";
      case "kimi":
        return "bg-cyan-500";
      case "glm":
        return "bg-orange-500";
      case "mistral":
        return "bg-teal-500";
      default:
        return "bg-gray-500";
    }
  };

  const renderExternalModelButton = (model: any) => (
    <button
      key={model.id}
      onClick={() =>
        handleModelSelect("external", undefined, model.id)
      }
      className="w-full text-left px-2 py-1.5 rounded hover:bg-white dark:hover:bg-[#3a3b44] transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
    >
      <div className="flex items-center gap-2">
        <div className={`p-1 rounded ${getExternalModelIconColor(model)} text-white shadow-sm flex-shrink-0`}>
          {getExternalModelIcon(model)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-900 dark:text-[#ececf1]">
              {model.name}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {model.provider}
            </span>
          </div>
          {model.description && (
            <p className="text-[9px] text-gray-500 dark:text-gray-400 truncate">
              {model.description}
            </p>
          )}
        </div>
      </div>
    </button>
  );
  
  return (
    <div className="flex-shrink-0 overflow-x-hidden max-w-full">
      {/* Hidden file input - must be outside Popover to always exist in DOM */}
      <input
        type="file"
        onChange={handleFileUpload}
        className="hidden"
        id="file-upload"
        accept={["image/*", "video/*", "audio/*"].join(",")}
        disabled={isUploading || !IS_DOMESTIC_VERSION}
      />

      <div className="max-w-4xl mx-auto px-4">
        {/* Single Row Input Layout with Rounded Rectangle */}
        <div className="flex items-center gap-2 sm:gap-3 bg-white dark:bg-[#40414f] border border-gray-200 dark:border-[#565869] rounded-2xl px-2 sm:px-4 py-2 sm:py-3 shadow-sm hover:shadow-md transition-shadow">
          {/* Left Side - Plus Button with Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                disabled={!appUser}
                className="h-9 w-9 p-0 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#565869] rounded-full flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-gray-400"
                title={!appUser ? (selectedLanguage === "zh" ? "请先登录后使用" : "Please login to use this feature") : (selectedLanguage === "zh" ? "更多功能" : "More Options")}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[calc(100vw-2rem)] sm:w-64 p-2 bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]"
              align="start"
              side="top"
            >
              <div className="grid grid-cols-2 gap-2">
                {/* File Upload */}
                <Button
                  size="sm"
                  variant="ghost"
                  className={`justify-start gap-2 ${isUploading ? "animate-pulse" : ""}`}
                  title={attachmentButtonTitle}
                  type="button"
                  disabled={isUploading || !IS_DOMESTIC_VERSION}
                  onClick={() => {
                    if (!IS_DOMESTIC_VERSION) return;
                    if (uploadedFiles.length >= MAX_FILES) {
                      setUploadError(
                        `Maximum ${MAX_FILES} files reached. Please remove some files first.`
                      );
                      setTimeout(() => setUploadError(""), 3000);
                      return;
                    }
                    document.getElementById("file-upload")?.click();
                  }}
                >
                  {isUploading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  ) : (
                    <Paperclip className="w-4 h-4" />
                  )}
                  <span className="text-xs">{selectedLanguage === "zh" ? "上传文件" : "Upload"}</span>
                </Button>

                {/* Voice Recording */}
                <Button
                  size="sm"
                  variant="ghost"
                  className={`justify-start gap-2 ${
                    isAudioPanelActive
                      ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
                      : ""
                  }`}
                  title={selectedLanguage === "zh" ? "语音录制" : "Voice Recording"}
                  type="button"
                  onClick={() => setIsAudioPanelActive(!isAudioPanelActive)}
                >
                  <Circle className={`w-4 h-4 ${isAudioPanelActive ? "fill-current" : ""}`} />
                  <span className="text-xs">{selectedLanguage === "zh" ? "语音录制" : "Voice"}</span>
                </Button>

                {/* Camera */}
                <Button
                  size="sm"
                  variant="ghost"
                  className={`justify-start gap-2 ${
                    !isCameraSupported
                      ? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
                      : isCameraActive
                      ? "text-blue-600 dark:text-blue-400"
                      : ""
                  }`}
                  title={
                    !isCameraSupported
                      ? getLocalizedText("cameraUnavailable")
                      : isCameraActive
                      ? getLocalizedText("cameraClose")
                      : getLocalizedText("cameraOpen")
                  }
                  type="button"
                  onClick={isCameraSupported ? toggleCamera : undefined}
                  disabled={!isCameraSupported}
                >
                  <Camera className="w-4 h-4" />
                  <span className="text-xs">{selectedLanguage === "zh" ? "摄像头" : "Camera"}</span>
                </Button>

                {/* Location */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={getCurrentLocation}
                  disabled={isGettingLocation}
                  className={`justify-start gap-2 ${
                    currentLocation
                      ? "text-green-600 dark:text-green-400"
                      : ""
                  }`}
                  title={
                    currentLocation
                      ? getLocalizedText("locationAdded")
                      : getLocalizedText("getLocation")
                  }
                >
                  {isGettingLocation ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                  <span className="text-xs">{selectedLanguage === "zh" ? "位置" : "Location"}</span>
                </Button>

                {/* Conversation History */}
                <Popover open={isAskGPTOpen} onOpenChange={setIsAskGPTOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="justify-start gap-2"
                      title={getLocalizedText("navigateConversation")}
                      disabled={!appUser}
                    >
                      <Clock className="w-4 h-4" />
                      <span className="text-xs">{selectedLanguage === "zh" ? "对话历史" : "History"}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[calc(100vw-2rem)] sm:w-80 p-2 bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]"
                    align="start"
                    side="top"
                  >
                      <Tabs defaultValue="messages" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-2 bg-gray-100 dark:bg-[#565869]">
                          <TabsTrigger
                            value="messages"
                            className="text-xs text-gray-900 dark:text-[#ececf1]"
                          >
                            {getLocalizedText("conversationTab")}
                          </TabsTrigger>
                          <TabsTrigger
                            value="bookmarks"
                            className="text-xs text-gray-900 dark:text-[#ececf1]"
                          >
                            {getLocalizedText("bookmarksTab")}
                          </TabsTrigger>
                          <TabsTrigger
                            value="prompts"
                            className="text-xs text-gray-900 dark:text-[#ececf1]"
                          >
                            {getLocalizedText("promptsTab")}
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="messages" className="space-y-1">
                          <div className="mb-2">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
                              {getLocalizedText("jumpToConversation")}
                            </h4>
                          </div>

                          {/* Search input for messages */}
                          <div className="relative mb-2">
                            <Search className="w-3 h-3 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                            <Input
                              placeholder={getLocalizedText("searchConversations")}
                              value={messageSearchQuery}
                              onChange={(e) =>
                                setMessageSearchQuery(e.target.value)
                              }
                              className="pl-7 h-7 text-xs bg-white dark:bg-[#565869] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
                            />
                          </div>

                          <ScrollArea
                            className="max-h-60 overflow-y-auto"
                            ref={jumpToScrollRef}
                          >
                            {getFilteredMessages().length === 0 ? (
                              <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                                {messageSearchQuery.trim()
                                  ? getLocalizedText("noConversationsFound")
                                  : getLocalizedText("noConversationsYet")}
                              </div>
                            ) : (
                              getFilteredMessages()
                                .slice()
                                .reverse()
                                .map((message, index) => (
                                  <div
                                    key={message.id}
                                    className="p-2 text-xs bg-gray-50 dark:bg-[#565869] rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-[#444654] mb-1"
                                    onClick={() => jumpToMessage(message.id)}
                                  >
                                    <div className="flex items-center space-x-2">
                                      <span
                                        className={`w-2 h-2 rounded-full ${
                                          message.role === "user"
                                            ? "bg-blue-500"
                                            : "bg-green-500"
                                        }`}
                                      />
                                      <span className="font-medium text-gray-900 dark:text-[#ececf1]">
                                        {message.role === "user"
                                          ? getLocalizedText("youLabel")
                                          : getLocalizedText("aiLabel")}
                                        :
                                      </span>
                                    </div>
                                    <div className="truncate mt-1 text-gray-600 dark:text-gray-300">
                                      {message.content.slice(0, 60)}
                                      ...
                                    </div>
                                  </div>
                                ))
                            )}
                          </ScrollArea>
                        </TabsContent>

                        <TabsContent value="bookmarks" className="space-y-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
                              {getLocalizedText("bookmarkedMessages")}
                            </h4>
                            <div className="flex items-center space-x-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#565869]"
                                onClick={exportBookmarks}
                                title={getLocalizedText("exportBookmarks")}
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#565869]"
                                onClick={importBookmarks}
                                title={getLocalizedText("importBookmarks")}
                              >
                                <Upload className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#565869]"
                                onClick={() => setShowCreateFolderDialog(true)}
                                title={getLocalizedText("createFolder")}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Folder selector */}
                          <div className="mb-2">
                            <Select
                              value={selectedBookmarkFolder}
                              onValueChange={setSelectedBookmarkFolder}
                            >
                              <SelectTrigger className="h-7 text-xs bg-white dark:bg-[#565869] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]">
                                <SelectContent>
                                  {bookmarkFolders.map((folder) => (
                                    <SelectItem
                                      key={folder.id}
                                      value={folder.id}
                                      className="text-xs"
                                    >
                                      <div className="flex items-center space-x-2">
                                        <div
                                          className="w-3 h-3 rounded-full"
                                          style={{
                                            backgroundColor: folder.color,
                                          }}
                                        />
                                        <span>{folder.name}</span>
                                        {folder.id !== "default" && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-4 w-4 p-0 ml-auto text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              deleteBookmarkFolder(folder.id);
                                            }}
                                          >
                                            <X className="w-2 h-2" />
                                          </Button>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </SelectTrigger>
                            </Select>
                          </div>

                          {/* Search input for bookmarks */}
                          <div className="relative mb-2">
                            <Search className="w-3 h-3 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                            <Input
                              placeholder={getLocalizedText("searchBookmarks")}
                              value={bookmarkSearchQuery}
                              onChange={(e) =>
                                setBookmarkSearchQuery(e.target.value)
                              }
                              className="pl-7 h-7 text-xs bg-white dark:bg-[#565869] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
                            />
                          </div>

                          <ScrollArea
                            className="max-h-60 overflow-y-auto"
                            ref={bookmarkScrollRef}
                          >
                            {getFilteredBookmarks().length === 0 ? (
                              <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                                {bookmarkSearchQuery.trim()
                                  ? getLocalizedText("noBookmarksFound")
                                  : getLocalizedText("noBookmarksYet")}
                              </div>
                            ) : (
                              getFilteredBookmarks().map((bookmark) => (
                                <div
                                  key={bookmark.id}
                                  className="p-2 text-xs bg-gray-50 dark:bg-[#565869] rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-[#444654] mb-1 group"
                                  onClick={() => jumpToBookmark(bookmark)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2 flex-1">
                                      <svg className="w-3 h-3 text-yellow-500 fill-current shrink-0" viewBox="0 0 24 24">
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                      </svg>
                                      {editingBookmarkId === bookmark.id ? (
                                        <div className="flex items-center space-x-1 flex-1">
                                          <Input
                                            value={editingBookmarkName}
                                            onChange={(e) =>
                                              setEditingBookmarkName(
                                                e.target.value
                                              )
                                            }
                                            className="h-5 text-xs bg-white dark:bg-[#444654] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter")
                                                saveBookmarkName();
                                              if (e.key === "Escape")
                                                cancelBookmarkEditing();
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            autoFocus
                                          />
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-4 w-4 p-0"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              saveBookmarkName();
                                            }}
                                          >
                                            <Check className="w-2 h-2" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-4 w-4 p-0"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              cancelBookmarkEditing();
                                            }}
                                          >
                                            <X className="w-2 h-2" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <span className="font-medium text-gray-900 dark:text-[#ececf1] truncate">
                                          {bookmark.customName ||
                                            bookmark.title}
                                        </span>
                                      )}
                                    </div>
                                    {editingBookmarkId !== bookmark.id && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeBookmark(bookmark.id);
                                        }}
                                      >
                                        <X className="w-2 h-2" />
                                      </Button>
                                    )}
                                  </div>
                                  {editingBookmarkId !== bookmark.id && (
                                    <div className="truncate mt-1 text-gray-600 dark:text-gray-300">
                                      {bookmark.content.slice(0, 60)}
                                      ...
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </ScrollArea>
                        </TabsContent>

                        <TabsContent value="prompts" className="space-y-1">
                          <div className="mb-2">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
                              {getLocalizedText("recentPromptsHistory")}
                            </h4>
                          </div>

                          {/* Search input for prompts */}
                          <div className="relative mb-2">
                            <Search className="w-3 h-3 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                            <Input
                              placeholder={getLocalizedText("searchPrompts")}
                              value={promptSearchQuery}
                              onChange={(e) =>
                                setPromptSearchQuery(e.target.value)
                              }
                              className="pl-7 h-7 text-xs bg-white dark:bg-[#565869] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
                            />
                          </div>

                          <ScrollArea
                            className="max-h-60 overflow-y-auto"
                            ref={promptScrollRef}
                          >
                            {getFilteredPrompts().length === 0 ? (
                              <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                                {promptSearchQuery.trim()
                                  ? getLocalizedText("noPromptsFound")
                                  : getLocalizedText("noRecentPrompts")}
                              </div>
                            ) : (
                              getFilteredPrompts().map(
                                (historyPrompt, index) => (
                                  <div
                                    key={index}
                                    className="p-2 text-xs bg-gray-50 dark:bg-[#565869] rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-[#444654] mb-1 text-gray-900 dark:text-[#ececf1]"
                                    onClick={() =>
                                      handlePromptSelect(historyPrompt)
                                    }
                                    title={historyPrompt}
                                  >
                                    <div className="flex items-center space-x-2">
                                      <MessageSquare className="w-3 h-3 text-blue-500 shrink-0" />
                                      <span className="truncate">
                                        {truncateText(historyPrompt, 60)}
                                      </span>
                                    </div>
                                  </div>
                                )
                              )
                            )}
                          </ScrollArea>
                        </TabsContent>
                      </Tabs>
                    </PopoverContent>
                  </Popover>

                {/* Pro Voice Chat - Disabled */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="justify-start gap-2 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50"
                  title={selectedLanguage === "zh" ? "实时语音通话（开发中）" : "Pro Voice Chat (Coming Soon)"}
                  type="button"
                  disabled={true}
                >
                  <Mic className="w-4 h-4" />
                  <span className="text-xs">{selectedLanguage === "zh" ? "语音通话" : "Voice Call"}</span>
                </Button>

                {/* Pro Video Chat - Disabled */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="justify-start gap-2 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50"
                  title={selectedLanguage === "zh" ? "实时视频通话（开发中）" : "Pro Video Chat (Coming Soon)"}
                  type="button"
                  disabled={true}
                >
                  <Video className="w-4 h-4" />
                  <span className="text-xs">{selectedLanguage === "zh" ? "视频通话" : "Video Call"}</span>
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Multi-line Input (max 10 lines) */}
          <div className="flex-1 min-w-[120px]">
            <textarea
              ref={textareaRef}
              placeholder={getLocalizedText("placeholder")}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={2000}
              className="w-full text-sm py-2 px-2 text-gray-900 dark:text-[#ececf1] bg-transparent border-0 focus:ring-0 focus:outline-none resize-none overflow-y-auto"
              style={{ maxHeight: '240px', minHeight: '24px' }}
              rows={1}
              onKeyDown={(e) => {
                // Ctrl+Enter: 换行
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  return; // 允许默认换行行为
                }

                // Enter: 发送消息
                if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                  if (prompt.trim().length > 0 && !isLoading && !isStreaming) {
                    e.preventDefault();
                    handleSubmit();
                  } else {
                    e.preventDefault(); // 防止空消息换行
                  }
                }
              }}
            />
          </div>

          {/* Model Selector */}
          <Popover
            open={isModelSelectorOpen}
            onOpenChange={setIsModelSelectorOpen}
          >
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 px-2 text-xs text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869] rounded-full flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isModelLocked || !appUser}
                title={!appUser ? (selectedLanguage === "zh" ? "请先登录后切换模型" : "Please login to switch models") : getLocalizedText("selectModel")}
              >
                <div className="flex items-center gap-1">
                  {getModelIcon()}
                  <span className="hidden sm:inline max-w-24 truncate">
                    {getSelectedModelDisplay()}
                  </span>
                  {!isModelLocked && (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[calc(100vw-2rem)] sm:w-[500px] md:w-[650px] lg:w-[850px] max-w-[850px] p-0 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl"
              align="end"
              side="top"
              sideOffset={8}
            >
              <div className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                    {getLocalizedText("selectModel")}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    onClick={() => setIsModelSelectorOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <Tabs
                  value={modelSelectorTab}
                  onValueChange={setModelSelectorTab}
                  className="w-full"
                >
                  <TabsList className={`grid w-full ${hideMornGPTModels ? "grid-cols-2" : "grid-cols-3"} bg-gray-100 dark:bg-[#565869]`}>
                    <TabsTrigger
                      value="general"
                      className="text-xs text-gray-900 dark:text-[#ececf1]"
                    >
                      <MessageSquare className="w-3 h-3 mr-1" />
                      {getLocalizedText("general")}
                    </TabsTrigger>
                    {!hideMornGPTModels && (
                      <TabsTrigger
                        value="morngpt"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        {getLocalizedText("mornGPT")}
                      </TabsTrigger>
                    )}
                    <TabsTrigger
                      value="external"
                      className={`text-xs ${isGuestMode ? "text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50" : "text-gray-900 dark:text-[#ececf1]"}`}
                      disabled={isGuestMode}
                      title={isGuestMode ? (selectedLanguage === "zh" ? "请先登录后使用外部模型" : "Please login to use external models") : undefined}
                    >
                      <Globe className="w-3 h-3 mr-1" />
                      {getLocalizedText("external")}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="p-2">
                    <div className="h-32 flex items-center justify-center">
                      <div
                        className="w-full h-full cursor-pointer p-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-[#565869] hover:bg-gray-100 dark:hover:bg-[#444654] transition-all duration-200 hover:shadow-sm flex flex-col items-center justify-center"
                        onClick={() => handleModelSelect("general", undefined, GENERAL_MODEL_ID)}
                      >
                        <MessageSquare className="w-4 h-4 mx-auto text-gray-500 dark:text-gray-400 mb-1" />
                        <h3 className="text-xs font-semibold text-gray-900 dark:text-[#ececf1] mb-1">
                          {getLocalizedText("generalModelTitle")}
                        </h3>
                        <p className="text-[8px] text-gray-600 dark:text-gray-400 text-center">
                          {getLocalizedText("generalModelDesc")}
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  {!hideMornGPTModels && (
                    <TabsContent value="morngpt" className="p-2">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5 h-32 overflow-y-auto">
                        {mornGPTCategories.map((category) => {
                          const IconComponent = category.icon || Bot;
                          return (
                            <div
                              key={category.id}
                              className={`p-1.5 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-[#565869] hover:shadow-sm border ${
                                selectedCategory === category.id
                                  ? "bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 shadow-md"
                                  : "border-gray-100 dark:border-gray-700"
                              }`}
                              onClick={() =>
                                handleModelSelect("morngpt", category.id)
                              }
                            >
                              <div className="flex flex-col space-y-1">
                                <div className="flex items-center space-x-1.5">
                                  <div
                                    className={`p-1 rounded ${category.color} text-white shadow-sm flex items-center justify-center`}
                                  >
                                    <IconComponent className="w-3 h-3" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[8px] font-semibold truncate text-gray-900 dark:text-[#ececf1] leading-tight">
                                        {category.name}
                                      </p>
                                      <Badge
                                        variant="secondary"
                                        className="text-[2px] px-0.5 py-0 h-2"
                                      >
                                        {category.id.toUpperCase()}1
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                <p className="text-[7px] text-gray-600 dark:text-gray-400 truncate leading-tight">
                                  {category.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </TabsContent>
                  )}

                  <TabsContent value="external" className="p-2">
                    <div className="space-y-1 max-h-60 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-md p-2 bg-gray-50/50 dark:bg-[#2f3037]">
                      <div className="text-[10px] font-semibold text-gray-700 dark:text-gray-200 mb-1">
                        {isDomesticVersion ? "可用外部模型（国内版）" : "Available External Models (International)"}
                      </div>
                      {isDomesticVersion ? (
                        <>
                          <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 mt-1">
                            多模态模型
                          </div>
                          {domesticMultimodalModels.map(renderExternalModelButton)}

                          <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 mt-2">
                            文本模型
                          </div>
                          {domesticTextModels.map(renderExternalModelButton)}
                        </>
                      ) : (
                        filteredExternalModels.map(renderExternalModelButton)
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </PopoverContent>
          </Popover>

          {/* Send Button */}
          <Button
            size="sm"
            onClick={isStreaming ? stopStreaming : handleSubmit}
            disabled={isStreaming ? false : !prompt.trim() || isLoading}
            className={`h-8 w-8 sm:h-9 sm:w-9 ${
              isStreaming
                ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/25"
                : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25"
            } text-white rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 flex-shrink-0`}
            title={
              isStreaming
                ? selectedLanguage === "zh"
                  ? "停止生成"
                  : "Stop Generation"
                : selectedLanguage === "zh"
                ? "发送消息"
                : "Send Message"
            }
          >
            {isStreaming ? (
              <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            ) : (
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </Button>
        </div>

        {/* Error Messages and Other Components */}
        {latestError && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-xs text-red-600 dark:text-red-400">
              {latestError}
            </p>
          </div>
        )}

        {featureInDevMessage && (
          <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              {featureInDevMessage}
            </p>
          </div>
        )}

        <StatusIndicators
          isRecording={isRecording}
          isProVoiceChatActive={isProVoiceChatActive}
          stopProVoiceChat={stopProVoiceChat}
          isProVideoChatActive={isProVideoChatActive}
          stopProVideoChat={stopProVideoChat}
          currentLocation={currentLocation}
          clearLocation={clearLocation}
        />

        <CameraPanel
          isCameraActive={isCameraActive}
          cameraStream={cameraStream}
          isVideoRecording={isVideoRecording}
          recordingTime={recordingTime}
          cameraMode={cameraMode}
          isCapturing={isCapturing}
          isConverting={isConverting}
          convertProgress={convertProgress}
          switchCameraMode={switchCameraMode}
          capturePhoto={capturePhoto}
          toggleVideoRecording={toggleVideoRecording}
          stopCamera={stopCamera}
          formatRecordingTime={formatRecordingTime}
          onMediaCaptured={handleMediaCaptured}
          onFeatureInDev={showFeatureInDevelopment}
          selectedLanguage={selectedLanguage}
        />

        <AudioRecordingPanel
          isActive={isAudioPanelActive}
          onClose={() => setIsAudioPanelActive(false)}
          onUpload={(result) => {
            const file = new File([result.blob], result.name, { type: result.blob.type });
            triggerFileUpload(file);
          }}
          onFeatureInDev={showFeatureInDevelopment}
          selectedLanguage={selectedLanguage}
        />

        <UploadedFilesList
          uploadedFiles={uploadedFiles}
          maxFiles={MAX_FILES}
          formatFileSize={formatFileSize}
          setUploadedFiles={setUploadedFiles}
          removeFile={removeFile}
          getFileIcon={getFileIcon}
        />
      </div>
    </div>
  );
});

export default InputArea;
