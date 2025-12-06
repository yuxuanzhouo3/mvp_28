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
  Sun,
  Moon,
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
  Volume2,
  Upload,
  MapPin,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useCamera } from "@/hooks";
import { UploadedFilesList } from "@/features/chat/components/input/UploadedFilesList";
import { StatusIndicators } from "@/features/chat/components/input/StatusIndicators";
import { CameraPanel } from "@/features/chat/components/input/CameraPanel";

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
  uploadedFiles: File[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<File[]>>;
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
}: InputAreaProps) {
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
  } = useCamera();

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
  
  // Filter models based on deployment version
  const filteredExternalModels = externalModels.filter((model) =>
    isDomesticVersion ? model.category === "domestic" : model.category === "international"
  );

  const filteredExternalAPIs = externalAPIs.filter((api) =>
    filteredExternalModels.some(
      (model) => model.provider.toLowerCase() === api.name.toLowerCase()
    )
  );
  
  return (
    <div className="border-t border-gray-200 dark:border-[#565869] bg-white dark:bg-[#40414f] flex-shrink-0 p-6 sticky bottom-0">
      <div className="max-w-4xl mx-auto">
        {/* Input Container Box with Modern Styling */}
        <div className="border border-gray-200 dark:border-[#565869] rounded-2xl p-4 bg-white dark:bg-[#40414f] shadow-lg relative">
          <div className="flex flex-col space-y-4">
            {/* Main Input Field */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                placeholder={getLocalizedText("placeholder")}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onSelect={handleTextSelection}
                className="w-full resize-none overflow-hidden text-sm py-3 px-3 text-gray-900 dark:text-[#ececf1] bg-transparent border-0 focus:ring-0 focus:border-0 focus:outline-none outline-none rounded-xl selection:bg-blue-200 dark:selection:bg-blue-800 selection:text-gray-900 dark:selection:text-[#ececf1] min-h-[96px] max-h-[384px] pr-4"
                onKeyDown={(e) => {
                  const currentHotkey =
                    appUser?.settings?.sendHotkey || "enter";
                  const shouldSend =
                    checkHotkeyMatch(e, currentHotkey) &&
                    prompt.trim().length > 0 &&
                    !isLoading &&
                    !isStreaming;
                  if (shouldSend) {
                    e.preventDefault();
                    handleSubmit();
                  }

                  // Text selection shortcuts
                  if (e.ctrlKey || e.metaKey) {
                    if (e.key === "c" && selectedText) {
                      e.preventDefault();
                      copySelectedText();
                    } else if (e.key === "x" && selectedText) {
                      e.preventDefault();
                      copySelectedText();
                      deleteSelectedText();
                    } else if (e.key === "a") {
                      e.preventDefault();
                      if (textareaRef.current) {
                        textareaRef.current.select();
                        handleTextSelection();
                      }
                    }
                  }

                  // Delete key for selected text
                  if (e.key === "Delete" && selectedText) {
                    e.preventDefault();
                    deleteSelectedText();
                  }
                }}
              />

              {/* Text Selection Controls */}
              {selectedText && (
                <div className="absolute top-2 right-2 flex items-center space-x-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-10">
                  <button
                    onClick={copySelectedText}
                    className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                    title="Copy selected text"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={deleteSelectedText}
                    className="p-1 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                    title="Delete selected text"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400 px-1">
                    {selectedText.length} chars
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons Section */}
            <div className="flex flex-col space-y-4">
              {/* Input Controls Row */}
              <div className="flex items-center justify-between">
                {/* Left Side - Quick Action Buttons */}
                <div className="flex items-center space-x-0.5 w-1/3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction("deep-thinking")}
                    className="h-7 flex items-center justify-center space-x-0.5 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-[#565869] hover:text-gray-900 dark:hover:text-[#ececf1] bg-white dark:bg-[#40414f] hover:bg-gray-50 dark:hover:bg-[#565869] rounded px-1 transition-all duration-200"
                  >
                    <Brain className="w-3 h-3" />
                    <span className="text-xs font-medium">
                      {getLocalizedText("deepThinkingBtn")}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction("creative")}
                    className="h-7 flex items-center justify-center space-x-0.5 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-[#565869] hover:text-gray-900 dark:hover:text-[#ececf1] bg-white dark:bg-[#40414f] hover:bg-gray-50 dark:hover:bg-[#565869] rounded px-1 transition-all duration-200"
                  >
                    <Lightbulb className="w-3 h-3" />
                    <span className="text-xs font-medium">
                      {getLocalizedText("creativeIdeasBtn")}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction("analyze")}
                    className="h-7 flex items-center justify-center space-x-0.5 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-[#565869] hover:text-gray-900 dark:hover:text-[#ececf1] bg-white dark:bg-[#40414f] hover:bg-gray-50 dark:hover:bg-[#565869] rounded px-1 transition-all duration-200"
                  >
                    <Target className="w-3 h-3" />
                    <span className="text-xs font-medium">
                      {getLocalizedText("analyzeBtn")}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction("solve")}
                    className="h-7 flex items-center justify-center space-x-0.5 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-[#565869] hover:text-gray-900 dark:hover:text-[#ececf1] bg-white dark:bg-[#40414f] hover:bg-gray-50 dark:hover:bg-[#565869] rounded px-1 transition-all duration-200"
                  >
                    <Zap className="w-3 h-3" />
                    <span className="text-xs font-medium">
                      {getLocalizedText("problemSolveBtn")}
                    </span>
                  </Button>
                </div>

                {/* Right Side - Input Controls */}
                <div className="flex items-center space-x-1 w-1/2 justify-end">
                  {/* File Upload */}
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    accept={[
                      "image/*",
                      "text/*",
                      "application/pdf",
                      ".doc",
                      ".docx",
                      ".xls",
                      ".xlsx",
                      ".ppt",
                      ".pptx",
                      ".txt",
                      ".md",
                      ".json",
                      ".xml",
                      ".csv",
                      ".tsv",
                      ".log",
                    ].join(",")}
                    disabled={isUploading}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-7 w-7 p-0 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#565869] transition-all duration-200 rounded-full border border-gray-300 dark:border-[#565869] ${
                      isUploading ? "animate-pulse" : ""
                    }`}
                    title={
                      uploadedFiles.length >= MAX_FILES
                        ? getLocalizedText("maximumFilesReached").replace(
                            "{count}",
                            MAX_FILES.toString()
                          )
                        : isUploading
                        ? getLocalizedText("uploading")
                        : getLocalizedText("uploadFilesMax")
                            .replace("{count}", MAX_FILES.toString())
                            .replace(
                              "{size}",
                              (MAX_TOTAL_SIZE / (1024 * 1024)).toString()
                            )
                    }
                    type="button"
                    disabled={isUploading}
                    onClick={() => {
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
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                    ) : (
                      <Paperclip className="w-3 h-3" />
                    )}
                  </Button>

                  {/* Voice Input Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-7 w-7 p-0 transition-all duration-200 rounded-full border border-gray-300 dark:border-[#565869] ${
                      isRecording
                        ? "text-red-600 dark:text-red-400 animate-pulse"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#565869]"
                    }`}
                    title={
                      isRecording
                        ? "Stop voice recording"
                        : "Start voice recording"
                    }
                    type="button"
                    onClick={toggleVoiceRecording}
                  >
                    {isRecording ? (
                      <MicOff className="w-3 h-3" />
                    ) : (
                      <Volume2 className="w-3 h-3" />
                    )}
                  </Button>

                  {/* Reset Voice Recording Button (shown when stuck) */}
                  {isRecording && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all duration-200 rounded-full border border-orange-300 dark:border-orange-600"
                      title="Reset voice recording (if stuck)"
                      type="button"
                      onClick={resetVoiceRecording}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}

                  {/* Camera Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-7 w-7 p-0 transition-all duration-200 rounded-full border border-gray-300 dark:border-[#565869] ${
                      !isCameraSupported
                        ? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
                        : isCameraActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#565869]"
                    }`}
                    title={
                      !isCameraSupported
                        ? "Camera not available in this browser/device."
                        : isCameraActive
                        ? "Close camera"
                        : "Open camera"
                    }
                    type="button"
                    onClick={isCameraSupported ? toggleCamera : undefined}
                    disabled={!isCameraSupported}
                  >
                    <Camera className="w-3 h-3" />
                  </Button>

                  {/* Location Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={getCurrentLocation}
                    disabled={isGettingLocation}
                    className={`h-7 w-7 p-0 transition-all duration-200 rounded-full border border-gray-300 dark:border-[#565869] ${
                      currentLocation
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#565869]"
                    }`}
                    title={
                      currentLocation
                        ? "Location added - Click to get new location"
                        : "Get current location"
                    }
                  >
                    {isGettingLocation ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                    ) : (
                      <MapPin className="w-3 h-3" />
                    )}
                  </Button>

                  {/* Dark Mode Toggle Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={toggleTheme}
                    className={`h-7 w-7 p-0 transition-all duration-200 rounded-full border border-gray-300 dark:border-[#565869] ${
                      isDarkMode
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#565869]"
                    }`}
                    title={
                      isDarkMode
                        ? "Switch to light mode"
                        : "Switch to dark mode"
                    }
                  >
                    {isDarkMode ? (
                      <Sun className="w-3 h-3" />
                    ) : (
                      <Moon className="w-3 h-3" />
                    )}
                  </Button>

                  {/* Ask GPT Button */}
                  <Popover open={isAskGPTOpen} onOpenChange={setIsAskGPTOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#565869] rounded-full border border-gray-300 dark:border-[#565869]"
                        title="Navigate conversation"
                        disabled={!appUser}
                      >
                        <Clock className="w-3 h-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-80 p-2 bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]"
                      align="end"
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

                  {/* Pro Voice Chat Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-9 w-9 p-0 transition-all duration-200 rounded-full border border-gray-300 dark:border-[#565869] ${
                      isProVoiceChatActive
                        ? "text-purple-600 dark:text-purple-400 animate-pulse"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#565869]"
                    }`}
                    title={
                      isProVoiceChatActive
                        ? "Stop Pro Voice Chat"
                        : "Pro Voice Chat"
                    }
                    type="button"
                    onClick={
                      isProVoiceChatActive
                        ? stopProVoiceChat
                        : () => {
                            startProVoiceChat();
                            scrollToInputArea();
                          }
                    }
                    disabled={!appUser}
                  >
                    {isProVoiceChatActive ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                    ) : (
                      <Mic className="w-3 h-3" />
                    )}
                  </Button>

                  {/* Pro Video Chat Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-9 w-9 p-0 transition-all duration-200 rounded-full border border-gray-300 dark:border-[#565869] ${
                      isProVideoChatActive
                        ? "text-purple-600 dark:text-purple-400 animate-pulse"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#565869]"
                    }`}
                    title={
                      isProVideoChatActive
                        ? "Stop Pro Video Chat"
                        : "Pro Video Chat"
                    }
                    type="button"
                    onClick={
                      isProVideoChatActive
                        ? stopProVideoChat
                        : startProVideoChat
                    }
                    disabled={!appUser}
                  >
                    {isProVideoChatActive ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                    ) : (
                      <Video className="w-3 h-3" />
                    )}
                  </Button>

                  {/* Model Selector */}
                  <Popover
                    open={isModelSelectorOpen}
                    onOpenChange={setIsModelSelectorOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs border-gray-300 dark:border-[#565869] hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] rounded-md transition-all duration-200"
                        disabled={isModelLocked}
                        title={getLocalizedText("selectModel")}
                      >
                        <div className="flex items-center space-x-1">
                          {getModelIcon()}
                          <span className="max-w-16 truncate">
                            {getSelectedModelDisplay()}
                          </span>
                          {!isModelLocked && (
                            <ChevronDown className="w-2.5 h-2.5" />
                          )}
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[850px] p-0 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl"
                      align="end"
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {getLocalizedText("selectModel")}
                          </h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        <Tabs
                          value={selectedModelType}
                          onValueChange={setSelectedModelType}
                          className="w-full"
                        >
                          <TabsList className="grid w-full grid-cols-3 bg-gray-100 dark:bg-[#565869]">
                            <TabsTrigger
                              value="general"
                              className="text-xs text-gray-900 dark:text-[#ececf1]"
                            >
                              <MessageSquare className="w-3 h-3 mr-1" />
                              {getLocalizedText("general")}
                            </TabsTrigger>
                            <TabsTrigger
                              value="morngpt"
                              className="text-xs text-gray-900 dark:text-[#ececf1]"
                            >
                              <Sparkles className="w-3 h-3 mr-1" />
                              {getLocalizedText("mornGPT")}
                            </TabsTrigger>
                            <TabsTrigger
                              value="external"
                              className="text-xs text-gray-900 dark:text-[#ececf1]"
                            >
                              <Globe className="w-3 h-3 mr-1" />
                              {getLocalizedText("external")}
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent value="general" className="p-2">
                            <div className="h-32 flex items-center justify-center">
                              <div
                                className="w-full h-full cursor-pointer p-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-[#565869] hover:bg-gray-100 dark:hover:bg-[#444654] transition-all duration-200 hover:shadow-sm flex flex-col items-center justify-center"
                                onClick={() => handleModelSelect("general")}
                              >
                                <MessageSquare className="w-4 h-4 mx-auto text-gray-500 dark:text-gray-400 mb-1" />
                                <h3 className="text-xs font-semibold text-gray-900 dark:text-[#ececf1] mb-1">
                                  General Model
                                </h3>
                                <p className="text-[8px] text-gray-600 dark:text-gray-400 text-center">
                                  Auto select AI assistant for general
                                  conversations
                                </p>
                              </div>
                            </div>
                          </TabsContent>

                          <TabsContent value="morngpt" className="p-2">
                            <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5 h-32 overflow-y-auto">
                              {mornGPTCategories.map((category) => {
                                const IconComponent = category.icon;
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
                                          className={`p-0.5 rounded ${category.color} text-white shadow-sm`}
                                        >
                                          <IconComponent className="w-2 h-2" />
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

                          <TabsContent value="external" className="p-2">
                            <div className="space-y-1 max-h-60 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-md p-2 bg-gray-50/50 dark:bg-[#2f3037]">
                              <div className="text-[10px] font-semibold text-gray-700 dark:text-gray-200 mb-1">
                                {isDomesticVersion ? "可用外部模型（国内版）" : "Available External Models (International)"}
                              </div>
                              {filteredExternalModels.map((model) => (
                                <button
                                  key={model.id}
                                  onClick={() =>
                                    handleModelSelect("external", undefined, model.id)
                                  }
                                  className="w-full text-left px-2 py-1 rounded hover:bg-white dark:hover:bg-[#3a3b44] transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                                >
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
                                </button>
                              ))}
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Button
                    size="sm"
                    onClick={isStreaming ? stopStreaming : handleSubmit}
                    disabled={isStreaming ? false : !prompt.trim() || isLoading}
                    className={`h-8 w-8 ${
                      isStreaming
                        ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/25"
                        : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25"
                    } text-white rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95`}
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
                      <Square className="w-3 h-3" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Unified Error Display (only the most recent one) */}
            {latestError && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-xs text-red-600 dark:text-red-400">
                  {latestError}
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
              capturedMedia={capturedMedia}
              switchCameraMode={switchCameraMode}
              capturePhoto={capturePhoto}
              toggleVideoRecording={toggleVideoRecording}
              stopCamera={stopCamera}
              formatRecordingTime={formatRecordingTime}
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
      </div>
    </div>
  );
});

export default InputArea;
