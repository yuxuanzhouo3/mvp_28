"use client";

/**
 * © 2026 MornGPT. All rights reserved.
 *
 * This file is part of the MornGPT Homepage application.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Import toast for quota notifications
import { toast } from "sonner";

// Import types and constants
import {
  Message,
  ChatSession,
  AppUser,
  BookmarkedMessage,
  BookmarkFolder,
  AttachmentItem,
} from "@/types";
import {
  mornGPTCategories,
  externalAPIs,
  externalModels,
  pricingPlans,
  MAX_FILES,
  MAX_FILE_SIZE,
  MAX_TOTAL_SIZE,
  ALLOWED_FILE_TYPES,
} from "@/constants";
import {
  detectLanguage,
  copyToClipboard,
  formatFileSize,
  getFileIcon,
  getSelectedModelDisplay as getSelectedModelDisplayUtil,
  shareMessage,
  downloadMessage,
} from "@/utils";
import { GENERAL_MODEL_ID } from "@/utils/model-limits";
import { useLanguage } from "@/context/LanguageContext";
import { createLocalizedTextGetter } from "@/lib/localization";
import { IS_DOMESTIC_VERSION } from "@/config";
import { fetchQuotaShared } from "@/utils/quota-fetcher";
import {
  checkEmailCooldown,
  setEmailCooldown,
  getCooldownMessage,
} from "@/lib/utils/email-rate-limit";
import { signInWithGoogle } from "@/actions/oauth";
import {
  parseWxMpLoginCallback,
  clearWxMpLoginParams,
  exchangeCodeForToken,
} from "@/lib/wechat-mp";

const FREE_DAILY_LIMIT = (() => {
  const raw = process.env.NEXT_PUBLIC_FREE_DAILY_LIMIT || "10";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(1000, n); // safety clamp
})();
const BASIC_DAILY_LIMIT = (() => {
  const raw = process.env.NEXT_PUBLIC_BASIC_DAILY_LIMIT || "100";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(10000, n); // safety clamp
})();
const PRO_DAILY_LIMIT = (() => {
  const raw = process.env.NEXT_PUBLIC_PRO_DAILY_LIMIT || "200";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 200;
  return Math.min(20000, n); // safety clamp
})();

const ENTERPRISE_DAILY_LIMIT = (() => {
  const raw = process.env.NEXT_PUBLIC_ENTERPRISE_DAILY_LIMIT || "500";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 500;
  return Math.min(50000, n); // safety clamp
})();

// Import hooks
import {
  useChatState,
  useUIState,
  useUserState,
  useFileAttachments,
  useSpeechRecognition,
  useBookmarkState,
  usePaymentState,
  useShareState,
  useResetState,
  useKeyboardShortcuts,
  useMessageSubmission,
  useVoiceRecording,
  useCamera,
  useMobileGuestTrial,
} from "@/hooks";

// Import components
import { SettingsPanel, FileUploadPanel, VoiceInputPanel } from "@/components";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  createContext,
  useContext,
} from "react";
import dynamic from "next/dynamic";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
type SidebarProps = Record<string, any>;
type HeaderProps = Record<string, any>;
type ChatInterfaceProps = Record<string, any>;
type InputAreaProps = Record<string, any>;
type ModalHubProps = Record<string, any>;

type ChatUIContextValue = {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean) => void;
  sidebarProps: SidebarProps;
  headerProps: HeaderProps;
  chatInterfaceProps: ChatInterfaceProps;
  inputAreaProps: InputAreaProps;
  modalProps: ModalHubProps;
  ChatInterfaceComponent: React.ComponentType<any>;
  InputAreaComponent: React.ComponentType<any>;
};

const ChatUIContext = createContext<ChatUIContextValue | null>(null);

export const useChatUI = () => {
  const ctx = useContext(ChatUIContext);
  if (!ctx) {
    throw new Error("useChatUI must be used within ChatProvider");
  }
  return ctx;
};

// Dynamic imports for client components (moved outside component to prevent reloading on every render)
const ChatInterface = dynamic(() => import("@/components/ChatInterface"), {
  ssr: false,
});
const InputArea = dynamic(() => import("@/components/InputArea"), {
  ssr: false,
});

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ResizableTextarea } from "@/components/ui/resizable-textarea";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { Switch } from "@/components/ui/switch";
import {
  TrendingUp,
  Briefcase,
  Code,
  Shield,
  Heart,
  Bot,
  Home,
  Users,
  GraduationCap,
  Plane,
  Search,
  Shirt,
  UtensilsCrossed,
  Palette,
  ShieldCheck,
  Sparkles,
  Globe,
  ChevronDown,
  Send,
  Settings,
  Paperclip,
  MessageSquare,
  ChevronRight,
  Plus,
  X,
  Folder,
  FolderOpen,
  Trash2,
  Edit3,
  Check,
  ChevronLeft,
  Zap,
  Brain,
  Lightbulb,
  Target,
  LogIn,
  UserPlus,
  LogOut,
  User,
  Crown,
  CreditCard,
  Lock,
  Eye,
  EyeOff,
  Copy,
  History,
  MapPin,
  Sun,
  Moon,
  Share,
  Download,
  Upload,
  Star,
  ChevronUp,
  Bell,
  PaletteIcon,
  HelpCircle,
  ShieldIcon,
  Key,
  Mail,
  Phone,
  Calendar,
  Globe2,
  Volume2,
  VolumeX,
  Save,
  AlertTriangle,
  RefreshCw,
  Receipt,
  Smartphone,
  Monitor,
  Laptop,
  Tablet,
  Database,
  Link,
  XCircle,
  Keyboard,
  Navigation,
  Chrome,
  Scale,
  Film,
  Mic,
  MicOff,
  Clock,
  Camera,
  Cpu,
  Wind,
  Image,
  FileText,
  Video,
  VideoOff,
  Square,
} from "lucide-react";

export default function ChatProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => createSupabaseClient(), []);

  // Use custom hooks for state management
  const chatState = useChatState();
  const uiState = useUIState();
  const userState = useUserState();
  const fileAttachments = useFileAttachments();
  const speechRecognition = useSpeechRecognition();
  const bookmarkState = useBookmarkState();
  const paymentState = usePaymentState();
  const shareState = useShareState();
  const resetState = useResetState();

  // Destructure state from hooks for easier access
  const {
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
  } = chatState;

  const { currentLanguage, isDomesticVersion, setCurrentLanguage } = useLanguage();
  const activeLanguage = selectedLanguage || currentLanguage;
  const isZh = activeLanguage === "zh"; // UI 文案
  const isDomestic = isDomesticVersion; // 后端/版本判定

  // Use voice recording hook (after selectedLanguage is available)
  const voiceRecording = useVoiceRecording(selectedLanguage);

  // Use camera hook
  const camera = useCamera();
  const defaultExternalModelId = useMemo(() => {
    const targetCategory = isDomesticVersion ? "domestic" : "international";
    const candidates = externalModels.filter((m) => m.category === targetCategory);
    const multi = candidates.find((m) => m.modality === "multimodal");
    return multi?.id || candidates[0]?.id || "qwen3-omni-flash";
  }, [externalModels, isDomesticVersion]);

  // Destructure camera state
  const {
    isCameraActive,
    cameraStream,
    cameraError,
    capturedMedia,
    setCapturedMedia,
    isCapturing,
    cameraMode,
    recordingTime,
    isVideoRecording,
    initializeCamera,
    stopCamera,
    toggleCamera,
    capturePhoto,
    startVideoRecording,
    stopVideoRecording,
    toggleVideoRecording,
    formatRecordingTime,
    switchCameraMode,
  } = camera;

  // Destructure voice recording state
  const {
    isRecording,
    voiceError,
    startVoiceRecording,
    stopVoiceRecording,
    toggleVoiceRecording,
    resetVoiceRecording,
  } = voiceRecording;

  const {
    showSettings,
    setShowSettings,
    showPaymentModal,
    setShowPaymentModal,
    showBookmarks,
    setShowBookmarks,
    showFolders,
    setShowFolders,
    showFileUpload,
    setShowFileUpload,
    showVoiceInput,
    setShowVoiceInput,
    showCamera,
    setShowCamera,
    showLocation,
    setShowLocation,
    sidebarOpen,
    setSidebarOpen,
    isMobile,
    setIsMobile,
    showAuthDialog,
    setShowAuthDialog,
    showSettingsDialog,
    setShowSettingsDialog,
    showUpgradeDialog,
    setShowUpgradeDialog,
    showRegistrationPrompt,
    setShowRegistrationPrompt,
    showDataCollectionNotice,
    setShowDataCollectionNotice,
    showResetConfirm,
    setShowResetConfirm,
    showCreateFolderDialog,
    setShowCreateFolderDialog,
    showShareDialog,
    setShowShareDialog,
    showDownloadSection,
    setShowDownloadSection,
    selectedPlatform,
    setSelectedPlatform,
    makeDiscoverable,
    setMakeDiscoverable,
    isGeneratingLink,
    setIsGeneratingLink,
    showPaymentDialog,
    setShowPaymentDialog,
    selectedPaidModel,
    setSelectedPaidModel,
    billingPeriod,
    setBillingPeriod,
    selectedPlanInDialog,
    setSelectedPlanInDialog,
    showBillingDialog,
    setShowBillingDialog,
    showPaymentEditDialog,
    setShowPaymentEditDialog,
    isProVideoChatActive,
    setIsProVideoChatActive,
    proVideoChatStream,
    setProVideoChatStream,
    proChatError,
    setProChatError,
    proChatTrialCount,
    setProChatTrialCount,
    showProUpgradeDialog,
    setShowProUpgradeDialog,
    proChatType,
    setProChatType,
    selectedPlan,
    setSelectedPlan,
    isDarkMode,
    setIsDarkMode,
    isResizing,
    setIsResizing,
    showLogoutConfirmDialog,
    setShowLogoutConfirmDialog,
    showDeleteAccountDialog,
    setShowDeleteAccountDialog,
    isDeletingAccount,
    setIsDeletingAccount,
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
    showPrivacyDialog,
    setShowPrivacyDialog,
    showFontDialog,
    setShowFontDialog,
    showShortcutDialog,
    setShowShortcutDialog,
    showShortcutsHelp,
    setShowShortcutsHelp,
    isEditingSecret,
    setIsEditingSecret,
    customSecret,
    setCustomSecret,
    showSecretConfirm,
    setShowSecretConfirm,
    isGettingLocation,
    setIsGettingLocation,
    locationError,
    setLocationError,
    currentLocation,
    setCurrentLocation,
    isSidebarLoading,
    setIsSidebarLoading,
    showGlobalAds,
    setShowGlobalAds,
    releases,
    setReleases,
    isLoadingReleases,
    setIsLoadingReleases,
  } = uiState;

  // 移动端检测
  useEffect(() => {
    const MOBILE_BREAKPOINT = 768;
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // 初始检测
    checkMobile();

    // 监听窗口大小变化
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => checkMobile();
    mql.addEventListener("change", onChange);

    return () => mql.removeEventListener("change", onChange);
  }, [setIsMobile]);

  // 移动端访客试用 Hook（仅在国内版移动端生效）
  const mobileGuestTrial = useMobileGuestTrial(isMobile);

  // Listen for quota exceeded/warning events and show toast notifications
  useEffect(() => {
    const handleQuotaExceeded = (e: CustomEvent<{ type: string; message: string }>) => {
      toast.error(e.detail.message, {
        duration: 6000,
      });
    };

    const handleQuotaWarning = (e: CustomEvent<{ type: string; message: string }>) => {
      toast.warning(e.detail.message, {
        duration: 5000,
        action: {
          label: isZh ? "升级" : "Upgrade",
          onClick: () => setShowUpgradeDialog(true),
        },
      });
    };

    window.addEventListener("quota:exceeded", handleQuotaExceeded as EventListener);
    window.addEventListener("quota:warning", handleQuotaWarning as EventListener);

    return () => {
      window.removeEventListener("quota:exceeded", handleQuotaExceeded as EventListener);
      window.removeEventListener("quota:warning", handleQuotaWarning as EventListener);
    };
  }, [isZh, setShowUpgradeDialog]);

  // Auto-clear upload error after 5s to avoid lingering prompts
  useEffect(() => {
    if (!uploadError) return;
    const timer = setTimeout(() => setUploadError(""), 5000);
    return () => clearTimeout(timer);
  }, [uploadError, setUploadError]);

  // Auto-clear Pro voice/video error after 5s
  useEffect(() => {
    if (!proChatError) return;
    const timer = setTimeout(() => setProChatError(""), 5000);
    return () => clearTimeout(timer);
  }, [proChatError, setProChatError]);

  const {
    appUser,
    setAppUser,
    isLoggedIn,
    setIsLoggedIn,
    userSettings,
    setUserSettings,
    isEditingProfile,
    setIsEditingProfile,
    userProfileForm,
    setUserProfileForm,
    editingShortcut,
    setEditingShortcut,
    customShortcuts,
    setCustomShortcuts,
    autoRenewEnabled,
    setAutoRenewEnabled,
    nextBillingDate,
    setNextBillingDate,
    paymentMethod,
    setPaymentMethod,
    authMode,
    setAuthMode,
    authForm,
    setAuthForm,
    showPassword,
    setShowPassword,
    promptHistory,
    setPromptHistory,
    selectedBookmarkFolder,
    setSelectedBookmarkFolder,
    editingShortcutValue,
    setEditingShortcutValue,
    shortcutConflict,
    setShortcutConflict,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    currentPlan,
    setCurrentPlan,
  guestChatSessions,
  setGuestChatSessions,
  guestSessionTimeout,
  setGuestSessionTimeout,
} = userState;

  const [freeQuotaUsed, setFreeQuotaUsed] = useState<number>(0);
  const [freeQuotaDate, setFreeQuotaDate] = useState<string>("");
  const [freeQuotaLimit, setFreeQuotaLimit] = useState<number>(FREE_DAILY_LIMIT);
  const [freePhotoRemaining, setFreePhotoRemaining] = useState<number | null>(null);
  const [freePhotoLimit, setFreePhotoLimit] = useState<number | null>(null);
  const [freeVideoAudioRemaining, setFreeVideoAudioRemaining] = useState<number | null>(null);
  const [freeVideoAudioLimit, setFreeVideoAudioLimit] = useState<number | null>(null);
  const [freeContextLimit, setFreeContextLimit] = useState<number | null>(null);
  const [basicQuotaUsed, setBasicQuotaUsed] = useState<number>(0);
  const [basicQuotaDate, setBasicQuotaDate] = useState<string>("");
  const [basicQuotaLimit, setBasicQuotaLimit] = useState<number>(BASIC_DAILY_LIMIT);
  const [basicPhotoRemaining, setBasicPhotoRemaining] = useState<number | null>(null);
  const [basicPhotoLimit, setBasicPhotoLimit] = useState<number | null>(null);
  const [basicVideoAudioRemaining, setBasicVideoAudioRemaining] = useState<number | null>(null);
  const [basicVideoAudioLimit, setBasicVideoAudioLimit] = useState<number | null>(null);
  const [basicContextLimit, setBasicContextLimit] = useState<number | null>(null);
  const [proQuotaUsed, setProQuotaUsed] = useState<number>(0);
  const [proQuotaDate, setProQuotaDate] = useState<string>("");
  const [proQuotaLimit, setProQuotaLimit] = useState<number>(PRO_DAILY_LIMIT);
  const [proPhotoRemaining, setProPhotoRemaining] = useState<number | null>(null);
  const [proPhotoLimit, setProPhotoLimit] = useState<number | null>(null);
  const [proVideoAudioRemaining, setProVideoAudioRemaining] = useState<number | null>(null);
  const [proVideoAudioLimit, setProVideoAudioLimit] = useState<number | null>(null);
  const [proContextLimit, setProContextLimit] = useState<number | null>(null);
  const [enterpriseQuotaUsed, setEnterpriseQuotaUsed] = useState<number>(0);
  const [enterpriseQuotaDate, setEnterpriseQuotaDate] = useState<string>("");
  const [enterpriseQuotaLimit, setEnterpriseQuotaLimit] = useState<number>(ENTERPRISE_DAILY_LIMIT);
  const [enterprisePhotoRemaining, setEnterprisePhotoRemaining] = useState<number | null>(null);
  const [enterprisePhotoLimit, setEnterprisePhotoLimit] = useState<number | null>(null);
  const [enterpriseVideoAudioRemaining, setEnterpriseVideoAudioRemaining] = useState<number | null>(null);
  const [enterpriseVideoAudioLimit, setEnterpriseVideoAudioLimit] = useState<number | null>(null);
  const [enterpriseContextLimit, setEnterpriseContextLimit] = useState<number | null>(null);

const loadMessagesForConversation = useCallback(
  async (conversationId: string) => {
    const token = ++messagesLoadTokenRef.current;
    // Local-only (unsaved) conversations have no server history; skip fetch
    if (conversationId.startsWith("local-")) {
      setMessages([]);
      setChatSessions((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, messages: [], isModelLocked: false }
            : c
        )
      );
      setIsConversationLoading(false);
      return;
    }

    setIsConversationLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        cache: "no-store",
        credentials: "include",
      });
      if (res.status === 401) {
        setAppUser(null);
        setIsLoggedIn(false);
        setShowAuthDialog(true);
        return;
      }
      if (res.status === 404) {
        // Conversation no longer exists server-side; clear local copy
        setMessages([]);
        setChatSessions((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? { ...c, messages: [], isModelLocked: false }
              : c
          )
        );
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed to load messages ${res.status}`);
      }
      const data = await res.json();

      // stale request guard (only token)
      if (token !== messagesLoadTokenRef.current) {
        return;
      }

      const chatMeta = chatSessionsRef.current.find((c) => c.id === conversationId);
      const chatModelTypeLower = (chatMeta?.modelType || "").toLowerCase();
      const assistantModelLabel = (() => {
        if (chatModelTypeLower === "morngpt") {
          const expertId = chatMeta?.category || "";
          const expert = mornGPTCategories.find((c) => c.id === expertId);
          return expert?.name || "MornGPT";
        }
        if (chatModelTypeLower === "general") return "General Model";
        return chatMeta?.model || "";
      })();

      const fetchedMessages: Message[] =
        data?.map((m: any) => ({
          id: m.id,
          role: m.role as Message["role"],
          content: m.content,
          timestamp: new Date(m.created_at),
          model:
            m.role === "assistant" && assistantModelLabel
              ? assistantModelLabel
              : undefined,
          images: m.imageFileIds || m.images || [],
          videos: m.videoFileIds || m.videos || [],
          audios: (m.audioFileIds || (m as any).audios || []) as any,
        })) || [];

      setMessages(fetchedMessages);
      setChatSessions((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: fetchedMessages,
                lastUpdated: new Date(),
                isModelLocked: fetchedMessages.length > 0,
              }
            : c,
        ),
      );
    } catch (err) {
      // Ignore stale requests; for current chat, clear stale messages and log
      if (currentChatIdRef.current === conversationId) {
        setMessages([]);
        setChatSessions((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? { ...c, messages: [], isModelLocked: false }
              : c
          )
        );
        console.error("Failed to load messages", err);
      }
    } finally {
      if (token === messagesLoadTokenRef.current) {
        setIsConversationLoading(false);
      }
    }
  },
  [setChatSessions, setMessages, setAppUser, setIsLoggedIn, setShowAuthDialog],
);

  const loadConversations = useCallback(
    async (userOverride?: AppUser | null) => {
      const user = userOverride ?? appUserRef.current;
      if (!user) return;
      if (loadConversationsPendingRef.current) return;
      if (
        hasLoadedConversationsRef.current &&
        loadedConversationsForUserRef.current === user.id
      )
        return;
      // Free 用户现在也支持对话落库，不再跳过加载
      loadConversationsPendingRef.current = true;
      setIsSidebarLoading(true);
      try {
        const res = await fetch("/api/conversations", {
          cache: "no-store",
          credentials: "include",
        });
        if (res.status === 401) {
          setAppUser(null);
          setIsLoggedIn(false);
          setShowAuthDialog(true);
          hasLoadedConversationsRef.current = false;
          loadedConversationsForUserRef.current = null;
          return;
        }
        if (!res.ok) {
          throw new Error(`Failed to load conversations ${res.status}`);
        }
        const data = await res.json();

        // 支持新的返回格式 { conversations, conversationLimit, totalCount }
        const conversationsList = Array.isArray(data) ? data : (data?.conversations || []);

        const mapped: ChatSession[] =
          conversationsList?.map((c: any) => {
            const rawModel = c.model || GENERAL_MODEL_ID;
            const isGeneralModel =
              (rawModel || "").toLowerCase() === GENERAL_MODEL_ID.toLowerCase();
            const serverModelType =
              (typeof c.modelType === "string" && c.modelType) ||
              (typeof c.model_type === "string" && c.model_type) ||
              "";
            const modelType = serverModelType || (isGeneralModel ? "general" : c.model ? "external" : "general");
            const expertModelId =
              (typeof c.expertModelId === "string" && c.expertModelId) ||
              (typeof c.expert_model_id === "string" && c.expert_model_id) ||
              "";
            return {
              id: c.id,
              title: c.title || "New Chat",
              messages: [],
              model: rawModel,
              modelType,
              category:
                String(modelType).toLowerCase() === "morngpt"
                  ? expertModelId || c.category || "general"
                  : "general",
              lastUpdated: c.updated_at ? new Date(c.updated_at) : new Date(),
              isModelLocked: false, // allow model selection before messages load
            };
          }) || [];

        setChatSessions(mapped);
        hasLoadedConversationsRef.current = true;
        loadedConversationsForUserRef.current = user.id;

        const currentId = currentChatIdRef.current;
        const stillExists = currentId && mapped.some((c) => c.id === currentId);

        // New flow: default select nothing, only load when user clicks
        if (mapped.length === 0) {
          setMessages([]);
          setCurrentChatId("");
          currentChatIdRef.current = "";
        } else if (!stillExists) {
          setMessages([]);
          setCurrentChatId("");
          currentChatIdRef.current = "";
        } else {
          // keep current selection but do not auto-load messages
          const current = mapped.find((c) => c.id === currentId);
          if (current) {
            setSelectedModelType(current.modelType || "external");
            setSelectedModel(
              current.model ||
                (current.modelType === "general" || current.modelType === "morngpt"
                  ? GENERAL_MODEL_ID
                  : defaultExternalModelId)
            );
            setSelectedCategory(
              (current.modelType || "").toLowerCase() === "morngpt"
                ? current.category || "general"
                : "general"
            );
          }
        }
      } catch (err) {
        console.error("Failed to load conversations", err);
        hasLoadedConversationsRef.current = false;
        loadedConversationsForUserRef.current = null;
      } finally {
        loadConversationsPendingRef.current = false;
        setIsSidebarLoading(false);
      }
    },
    [
      setChatSessions,
      setCurrentChatId,
      setMessages,
      setSelectedCategory,
      setSelectedModel,
      setSelectedModelType,
      setIsSidebarLoading,
    ],
  );

  useEffect(() => {
    let mounted = true;

    const syncSession = async () => {
      console.log("[syncSession] Starting, isDomestic:", isDomestic);
      console.log("[syncSession] Current URL:", typeof window !== "undefined" ? window.location.href : "SSR");

      // 处理小程序登录回调（国内版）
      if (isDomestic && typeof window !== "undefined") {
        const mpCallback = parseWxMpLoginCallback();
        console.log("[syncSession] mpCallback:", mpCallback);
        if (mpCallback) {
          console.log("[syncSession] Processing mini program login callback:", mpCallback);
          try {
            // 如果直接收到 token，调用 mp-callback API 设置 cookie
            if (mpCallback.token && mpCallback.openid) {
              console.log("[syncSession] Direct token received from mini program");
              const res = await fetch("/api/auth/mp-callback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  token: mpCallback.token,
                  openid: mpCallback.openid,
                  expiresIn: mpCallback.expiresIn,
                  // 传递用户资料，用于更新数据库（新用户首次登录）
                  nickName: mpCallback.nickName,
                  avatarUrl: mpCallback.avatarUrl,
                }),
              });
              if (!res.ok) {
                const data = await res.json();
                console.error("[syncSession] mp-callback failed:", data.error);
              } else {
                console.log("[syncSession] mp-callback success");
              }
              clearWxMpLoginParams();
            }
            // 如果收到 code，需要换取 token
            else if (mpCallback.code) {
              console.log("[syncSession] Exchanging code for token, code:", mpCallback.code);
              console.log("[syncSession] nickName:", mpCallback.nickName, "avatarUrl:", mpCallback.avatarUrl);
              const result = await exchangeCodeForToken(
                mpCallback.code,
                mpCallback.nickName,
                mpCallback.avatarUrl
              );
              console.log("[syncSession] exchangeCodeForToken result:", result);
              if (!result.success) {
                console.error("[syncSession] exchangeCodeForToken failed:", result.error);
              } else {
                console.log("[syncSession] exchangeCodeForToken success, token:", result.token);
                // 登录成功后，清除 URL 参数并刷新页面以加载新会话
                clearWxMpLoginParams();
                window.location.reload();
                return;
              }
              clearWxMpLoginParams();
            }
          } catch (err) {
            console.error("[syncSession] Mini program login callback error:", err);
            clearWxMpLoginParams();
          }
        }
      }

      const hasCloudToken =
        typeof document !== "undefined" &&
        /(^|; )auth-token=/.test(document.cookie || "");

      // 优先尝试 CloudBase 会话（国内版或持有 cloud token）
      if (isDomestic || hasCloudToken) {
        // 检测支付完成标记
        const paymentCompleted = typeof window !== "undefined" && sessionStorage.getItem("payment_completed");
        if (paymentCompleted) {
          console.log("[syncSession] Domestic: Payment completed detected");
          sessionStorage.removeItem("payment_completed");
        }

        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          const user = data.user;
          const planExp = user.metadata?.plan_exp || null;
          const planLower = (user.metadata?.plan || "").toLowerCase();
          // 检查用户是否有付费订阅（Basic/Pro/Enterprise）
          const isPaid = planLower === "basic" || planLower === "pro" || planLower === "enterprise";
          const isPro = isPaid && planLower !== "basic";
          // 检查订阅是否过期
          const isExpired = planExp ? new Date(planExp) < new Date() : false;
          const hasActiveSubscription = isPaid && !isExpired; // 有效订阅（用于 hideAds 判断）
          const effectiveIsPro = isPro && !isExpired;

          // 获取 hide_ads 设置和订阅状态（从服务器获取更准确）
          let hideAds = user.metadata?.hide_ads ?? false;
          let serverHasActiveSubscription = hasActiveSubscription;
          try {
            const settingsRes = await fetch("/api/account/settings", { credentials: "include" });
            if (settingsRes.ok) {
              const settingsData = await settingsRes.json();
              hideAds = settingsData?.data?.hide_ads ?? hideAds;
              // 使用服务器返回的订阅状态
              if (settingsData?.data?.subscription) {
                serverHasActiveSubscription = settingsData.data.subscription.hasActiveSubscription ?? hasActiveSubscription;
                console.log("[syncSession] Domestic server subscription status:", settingsData.data.subscription);
              }
            }
          } catch (e) {
            console.error("[syncSession] Failed to load settings from server:", e);
          }

          // 仅当服务器确认订阅已过期时才自动关闭 hideAds
          if (hideAds && !serverHasActiveSubscription) {
            console.log("[syncSession] Domestic: Auto-disabling hideAds due to expired subscription");
            hideAds = false;
            // 异步同步到数据库
            fetch("/api/account/settings", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ hideAds: false }),
            }).catch((err) => console.error("[syncSession] Failed to reset hideAds on expired subscription:", err));
          }
          const mappedUser: AppUser = {
            id: user.id,
            email: user.email || "",
            name: user.name || user.email || "User",
            avatar: user.avatar || undefined, // 用户头像
            // Basic 不是无限制，忽略 pro 标记
            isPro: effectiveIsPro,
            isPaid: serverHasActiveSubscription, // 使用服务器返回的订阅状态
            plan: user.metadata?.plan || undefined,
            planExp: planExp || undefined,
            settings: {
              theme: "light",
              language: "zh",
              notifications: true,
              soundEnabled: true,
              autoSave: true,
              hideAds: hideAds, // 从服务器加载 hide_ads 设置
            },
          };
          isDomesticSessionRef.current = true;
          setAppUser(mappedUser);
          setIsLoggedIn(true);
          setShowAuthDialog(false);
          if (mappedUser.plan) {
            setCurrentPlan(mappedUser.plan as "Basic" | "Pro" | "Enterprise");
            localStorage.setItem("morngpt_current_plan", mappedUser.plan);
            if (mappedUser.planExp) {
              localStorage.setItem("morngpt_current_plan_exp", mappedUser.planExp);
            }
          }

          // 支付完成后，立即触发额度刷新事件，确保所有配额相关组件更新
          if (paymentCompleted) {
            console.log("[syncSession] Domestic: Dispatching quota:refresh after payment completion");
            setTimeout(() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("quota:refresh"));
              }
            }, 100);
          }

          void refreshQuota(mappedUser);
          void loadConversations(mappedUser);
          return;
        }
      }

      // Supabase（国际版）
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;
      if (error) {
        console.error("Supabase session error", error);
        return;
      }
      if (data.session?.user) {
        const user = data.session.user;
        // 获取用户元数据中的订阅信息
        const userMeta = user.user_metadata as any;

        // 检测支付完成标记，如果存在则从 /api/auth/me 获取最新数据
        const paymentCompleted = typeof window !== "undefined" && sessionStorage.getItem("payment_completed");
        let walletPlan: string | null = null;
        let walletPlanExp: string | null = null;

        if (paymentCompleted) {
          console.log("[syncSession] Payment completed detected, fetching latest user data...");
          sessionStorage.removeItem("payment_completed");
          try {
            const meRes = await fetch("/api/auth/me", { credentials: "include" });
            if (meRes.ok) {
              const meData = await meRes.json();
              const wallet = meData.wallet;
              if (wallet) {
                walletPlan = wallet.plan || wallet.subscription_tier || null;
                walletPlanExp = wallet.plan_exp || null;
                console.log("[syncSession] Got wallet data:", { walletPlan, walletPlanExp });
              }
            }
          } catch (e) {
            console.error("[syncSession] Failed to fetch /api/auth/me:", e);
          }
        }

        // 优先使用 wallet 数据（支付后最新），否则回退到 userMeta
        const planExp = walletPlanExp || userMeta?.plan_exp || null;
        const plan = walletPlan || userMeta?.plan || null;
        const planLower = (plan || "").toLowerCase();
        // 检查用户是否有付费订阅（Basic/Pro/Enterprise）
        const isPaid = planLower === "basic" || planLower === "pro" || planLower === "enterprise";
        const isPro = isPaid && planLower !== "basic";
        // 检查订阅是否过期
        const isExpired = planExp ? new Date(planExp) < new Date() : false;
        const hasActiveSubscription = isPaid && !isExpired; // 有效订阅（用于 hideAds 判断）
        const effectiveIsPro = isPro && !isExpired;

        // 获取 hide_ads 设置和订阅状态（从服务器获取更准确）
        let hideAds = false;
        let serverHasActiveSubscription = hasActiveSubscription; // 默认使用本地计算的值
        try {
          const settingsRes = await fetch("/api/account/settings", { credentials: "include" });
          if (settingsRes.ok) {
            const settingsData = await settingsRes.json();
            hideAds = settingsData?.data?.hide_ads ?? false;
            // 使用服务器返回的订阅状态（比 user_metadata 更准确）
            if (settingsData?.data?.subscription) {
              serverHasActiveSubscription = settingsData.data.subscription.hasActiveSubscription ?? hasActiveSubscription;
              console.log("[syncSession] Server subscription status:", settingsData.data.subscription);
            }
          }
        } catch (e) {
          console.error("Failed to load hide_ads setting", e);
        }

        // 仅当服务器确认订阅已过期时才自动关闭 hideAds
        if (hideAds && !serverHasActiveSubscription) {
          console.log("[syncSession] Auto-disabling hideAds due to expired subscription (server confirmed)");
          hideAds = false;
          // 异步同步到数据库
          fetch("/api/account/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ hideAds: false }),
          }).catch((err) => console.error("[syncSession] Failed to reset hideAds on expired subscription:", err));
        }

        const mappedUser: AppUser = {
          id: user.id,
          email: user.email || "",
          name:
            userMeta?.full_name ||
            user.email?.split("@")[0] ||
            "User",
          avatar: userMeta?.avatar_url || undefined, // 用户头像
          isPro: effectiveIsPro,
          isPaid: serverHasActiveSubscription, // 使用服务器返回的订阅状态（更准确）
          plan: plan || undefined,
          planExp: planExp || undefined,
          settings: {
            theme: "light",
            language: "en",
            notifications: true,
            soundEnabled: true,
            autoSave: true,
            hideAds: hideAds, // 从数据库加载 hide_ads 设置，过期用户自动关闭
          },
        };
        isDomesticSessionRef.current = false;
        setAppUser(mappedUser);
        setIsLoggedIn(true);
        setShowAuthDialog(false);
        if (plan) {
          setCurrentPlan(plan as "Basic" | "Pro" | "Enterprise");
          localStorage.setItem("morngpt_current_plan", plan);
          if (planExp) {
            localStorage.setItem("morngpt_current_plan_exp", planExp);
          }
        } else if (mappedUser.isPro) {
          setCurrentPlan("Pro");
        }

        // 支付完成后，立即触发额度刷新事件，确保所有配额相关组件更新
        if (paymentCompleted) {
          console.log("[syncSession] Dispatching quota:refresh after payment completion");
          // 延迟一小段时间确保状态更新完成后再刷新
          setTimeout(() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("quota:refresh"));
            }
          }, 100);
        }

        void loadConversations(mappedUser);
      } else {
        setAppUser(null);
        setIsLoggedIn(false);
        setChatSessions([]);
        setMessages([]);
        setCurrentChatId("");
        // 国内版移动端不自动弹出登录弹窗，允许访客试用
        const isMobileDevice = typeof window !== "undefined" && window.innerWidth < 768;
        if (!(isDomestic && isMobileDevice)) {
          setShowAuthDialog(true);
        }
        setCurrentPlan(null);
        hasLoadedConversationsRef.current = false;
        loadConversationsPendingRef.current = false;
        loadedConversationsForUserRef.current = null;
      }
    };

    void syncSession();

    const authSub = isDomestic
      ? null
      : supabase.auth.onAuthStateChange(async (event: string, session: { user?: any } | null) => {
          if (!mounted) return;
          if (event === "SIGNED_IN" && session?.user) {
            const user = session.user;
            const userMeta = user.user_metadata as any;
            const planLower = (userMeta?.plan || "").toLowerCase();
            const planExp = userMeta?.plan_exp || null;

            // 正确计算 isPaid：Basic/Pro/Enterprise 都是付费用户
            const isPaidCalc = planLower === "basic" || planLower === "pro" || planLower === "enterprise";
            const isExpired = planExp ? new Date(planExp) < new Date() : false;

            // 从服务器获取 hideAds 设置和准确的订阅状态
            let hideAds = false;
            let serverIsPaid = isPaidCalc && !isExpired;
            let serverIsPro = isPaidCalc && planLower !== "basic" && !isExpired;
            try {
              const settingsRes = await fetch("/api/account/settings", { credentials: "include" });
              if (settingsRes.ok) {
                const settingsData = await settingsRes.json();
                hideAds = settingsData?.data?.hide_ads ?? false;
                if (settingsData?.data?.subscription) {
                  serverIsPaid = settingsData.data.subscription.hasActiveSubscription ?? serverIsPaid;
                  serverIsPro = settingsData.data.subscription.isPro ?? serverIsPro;
                }
              }
            } catch (e) {
              console.error("[onAuthStateChange] Failed to load settings:", e);
            }

            const mappedUser: AppUser = {
              id: user.id,
              email: user.email || "",
              name:
                (user.user_metadata as any)?.full_name ||
                user.email?.split("@")[0] ||
                "User",
              avatar: (user.user_metadata as any)?.avatar_url || undefined, // 用户头像
              isPro: serverIsPro,
              isPaid: serverIsPaid,
              plan: userMeta?.plan,
              planExp: planExp,
              settings: {
                theme: "light",
                language: "en",
                notifications: true,
                soundEnabled: true,
                autoSave: true,
                hideAds: hideAds,
              },
            };
            setAppUser(mappedUser);
            setIsLoggedIn(true);
            setShowAuthDialog(false);
            const planMeta = userMeta?.plan;
            if (planMeta) {
              setCurrentPlan(planMeta as "Basic" | "Pro" | "Enterprise");
              localStorage.setItem("morngpt_current_plan", planMeta);
              const expMeta = userMeta?.plan_exp;
              if (expMeta) {
                localStorage.setItem("morngpt_current_plan_exp", expMeta);
              }
            } else if (mappedUser.isPro) {
              setCurrentPlan("Pro");
            }
            void loadConversations(mappedUser);
          }
          if (event === "SIGNED_OUT") {
            setAppUser(null);
            setIsLoggedIn(false);
            setChatSessions([]);
            setMessages([]);
            setCurrentChatId("");
            setShowAuthDialog(true);
            setCurrentPlan(null);
            hasLoadedConversationsRef.current = false;
            loadConversationsPendingRef.current = false;
            loadedConversationsForUserRef.current = null;
          }
        });

    return () => {
      mounted = false;
      authSub?.data?.subscription?.unsubscribe();
    };
  }, [
    loadConversations,
    setAppUser,
    setChatSessions,
    setCurrentChatId,
    setIsLoggedIn,
    setMessages,
    setShowAuthDialog,
    supabase,
    isDomestic,
  ]);

  const {
    uploadedFiles,
    setUploadedFiles,
    fileInputRef,
  } = fileAttachments;
  const allowAudioUpload = isDomestic;

  // Upload size limits (exposed to client via NEXT_PUBLIC_*, fallback to server vars)
  const rawImageLimit =
    Number(process.env.NEXT_PUBLIC_MAX_IMAGE_UPLOAD_MB ?? process.env.MAX_IMAGE_UPLOAD_MB ?? 6) || 0;
  const IMAGE_LIMIT_MB = Number.isFinite(rawImageLimit) ? rawImageLimit : 6;
  const IMAGE_LIMIT_BYTES = Math.max(0, IMAGE_LIMIT_MB * 1024 * 1024);
  const IMAGE_UPLOAD_DISABLED = IMAGE_LIMIT_MB <= 0;

  const rawVideoLimit =
    Number(process.env.NEXT_PUBLIC_MAX_VIDEO_UPLOAD_MB ?? process.env.MAX_VIDEO_UPLOAD_MB ?? 256) || 0;
  const VIDEO_LIMIT_MB = Number.isFinite(rawVideoLimit) ? rawVideoLimit : 256;
  const VIDEO_LIMIT_BYTES = Math.max(0, VIDEO_LIMIT_MB * 1024 * 1024);
  const VIDEO_UPLOAD_DISABLED = VIDEO_LIMIT_MB <= 0;

  const rawMaxFiles =
    Number(process.env.NEXT_PUBLIC_MAX_FILE_COUNT ?? process.env.MAX_FILE_COUNT ?? MAX_FILES) || MAX_FILES;
  const MAX_FILES_LIMIT = Number.isFinite(rawMaxFiles) ? Math.max(1, rawMaxFiles) : MAX_FILES;

  const rawAudioLimit =
    Number(process.env.NEXT_PUBLIC_MAX_AUDIO_UPLOAD_MB ?? process.env.MAX_AUDIO_UPLOAD_MB ?? 100) || 0;
  const AUDIO_LIMIT_MB = Number.isFinite(rawAudioLimit) ? rawAudioLimit : 100;
  const AUDIO_LIMIT_BYTES = Math.max(0, AUDIO_LIMIT_MB * 1024 * 1024);
  const AUDIO_UPLOAD_DISABLED = AUDIO_LIMIT_MB <= 0;

  const uploadToCloudbase = async (file: File, kind: "image" | "video" | "audio") => {
    const endpoint =
      kind === "video"
        ? "/api/domestic/video/upload"
        : kind === "audio"
          ? "/api/domestic/audio/upload"
          : "/api/domestic/upload";
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(endpoint, {
      method: "POST",
      body: form,
      credentials: "include",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "upload failed");
    }
    return (await res.json()) as { fileId: string; tempUrl?: string };
  };

  const clearUploadsAndRemote = useCallback(async () => {
    const fileIds = uploadedFiles.map((f) => f.fileId).filter(Boolean) as string[];
    setUploadedFiles([]);
    if (!IS_DOMESTIC_VERSION) return;
    if (!fileIds.length) return;
    try {
      await fetch("/api/domestic/media/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileIds }),
      });
    } catch (err) {
      if (false) console.warn("[media/delete] client cleanup failed", err);
    }
  }, [uploadedFiles, setUploadedFiles]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    if (!IS_DOMESTIC_VERSION) {
      setUploadError(
        activeLanguage === "zh"
          ? "国际版暂未接入多模态模型，文件上传已禁用。"
          : "File upload is disabled on the international build."
      );
      event.target.value = "";
      return;
    }
    const currentChat = chatSessions.find((c) => c.id === currentChatId);
    const incoming = Array.from(files);
    if (uploadedFiles.length >= MAX_FILES_LIMIT) {
      setUploadError(
        `Maximum ${MAX_FILES_LIMIT} files reached. Please remove some files first.`
      );
      event.target.value = "";
      return;
    }
    const availableSlots = Math.max(0, MAX_FILES_LIMIT - uploadedFiles.length);
    const slice = incoming.slice(0, availableSlots);

    // Enforce single media category at a time
    const existingKind = uploadedFiles[0]?.kind ?? null;
    let sessionKind: AttachmentItem["kind"] | null = existingKind ?? null;
    const typeMismatchMessage =
      activeLanguage === "zh"
        ? "不同类型的文件不能同时上传，请先清空已选文件。"
        : "Please upload only one media type at a time. Clear existing files first.";

    for (const file of slice) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const isAudio = file.type.startsWith("audio/");
      const baseItem: AttachmentItem = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        kind: isImage ? "image" : isVideo ? "video" : isAudio ? "audio" : "file",
        file,
      };

      const currentKind = baseItem.kind;
      if (!["image", "video", "audio"].includes(currentKind)) {
        setUploadError(
          activeLanguage === "zh"
            ? "仅支持上传图片、视频或音频文件。"
            : "Only image, video, or audio files are allowed."
        );
        continue;
      }

      if (!sessionKind) {
        sessionKind = currentKind;
      } else if (currentKind !== sessionKind) {
      setUploadError(typeMismatchMessage);
      continue;
    }

      // 如果当前对话已锁定为非 omni，阻止上传
      const lockedNonOmni =
        currentChat &&
        currentChat.isModelLocked &&
        (currentChat.model || "").toLowerCase() !== "qwen3-omni-flash";
      if (lockedNonOmni) {
        setUploadError(
          activeLanguage === "zh"
            ? "当前对话已锁定为文字模型，无法上传图片/视频/音频。请新建对话并选择 Qwen3-Omni-Flash。"
            : "This chat is locked to a text model. Start a new chat with Qwen3-Omni-Flash to upload media."
        );
        event.target.value = "";
        return;
      }
      // 自动切换到 omni 模型，保证 UI 立即更新
      setSelectedModelType("advanced_multimodal");
      setSelectedModel("qwen3-omni-flash");

      if (isAudio) {
        if (!allowAudioUpload) {
          setUploadError("当前环境仅国内版支持音频上传。");
          continue;
        }
        if (AUDIO_UPLOAD_DISABLED) {
          setUploadError("音频上传已禁用，请调整 MAX_AUDIO_UPLOAD_MB。");
          continue;
        }
        const existingAudio = uploadedFiles.some((f) => f.kind === "audio");
        const hasOtherMedia = uploadedFiles.some((f) => f.kind === "image" || f.kind === "video");
        if (existingAudio) {
          setUploadError("一次仅支持添加一个音频文件，请先移除已选音频。");
          continue;
        }
        if (hasOtherMedia) {
          setUploadError("音频暂不支持与图片/视频同时发送，请先移除其他附件。");
          continue;
        }
        if (file.size > AUDIO_LIMIT_BYTES) {
          setUploadError(`音频大小超出限制（最大 ${AUDIO_LIMIT_MB} MB）`);
          continue;
        }
        const preview = URL.createObjectURL(file);
        setIsUploading(true);
        try {
          const { fileId, tempUrl } = await uploadToCloudbase(file, "audio");
          setUploadedFiles((prev) => [
            ...prev,
            {
              ...baseItem,
              fileId,
              preview: tempUrl || preview,
              format: file.name.split(".").pop()?.toLowerCase(),
            },
          ]);
        } catch (err) {
          URL.revokeObjectURL(preview);
          setUploadError("音频上传失败，请重试。");
        } finally {
          setIsUploading(false);
        }
        continue;
      }

      // 非音频时，如已存在音频，阻止混发（已在上方 sessionKind 保障，此处保留文案）
      if (uploadedFiles.some((f) => f.kind === "audio")) {
        setUploadError("当前已选择音频，请先移除音频再上传其他文件。");
        continue;
      }

      if (isImage) {
        if (IMAGE_UPLOAD_DISABLED) {
          setUploadError("图片上传已禁用，请调整 MAX_IMAGE_UPLOAD_MB。");
          continue;
        }
        if (file.size > IMAGE_LIMIT_BYTES) {
          setUploadError(`图片大小超出限制（最大 ${IMAGE_LIMIT_MB} MB）`);
          continue;
        }
        const preview = URL.createObjectURL(file);
        setIsUploading(true);
        try {
          const { fileId, tempUrl } = await uploadToCloudbase(file, "image");
          setUploadedFiles((prev) => [
            ...prev,
            { ...baseItem, fileId, preview: tempUrl || preview },
          ]);
        } catch (err) {
          URL.revokeObjectURL(preview);
          setUploadError("图片上传失败，请重试。");
        } finally {
          setIsUploading(false);
        }
      } else if (isVideo) {
        if (VIDEO_UPLOAD_DISABLED) {
          setUploadError("视频上传已禁用，请调整 MAX_VIDEO_UPLOAD_MB。");
          continue;
        }
        if (file.size > VIDEO_LIMIT_BYTES) {
          setUploadError(`视频大小超出限制（最大 ${VIDEO_LIMIT_MB} MB）`);
          continue;
        }
        const preview = URL.createObjectURL(file);
        setIsUploading(true);
        try {
          const { fileId, tempUrl } = await uploadToCloudbase(file, "video");
          setUploadedFiles((prev) => [
            ...prev,
            { ...baseItem, fileId, preview: tempUrl || preview },
          ]);
        } catch (err) {
          URL.revokeObjectURL(preview);
          setUploadError("视频上传失败，请重试。");
        } finally {
          setIsUploading(false);
        }
      } else {
        setUploadedFiles((prev) => [...prev, baseItem]);
      }
    }

    event.target.value = "";
  };

  const removeAttachment = async (index: number) => {
    const target = uploadedFiles[index];
    if (!target) return;

    // Clean remote file if uploaded
    try {
      if (target.fileId && target.kind === "image") {
        await fetch(
          `/api/domestic/upload?fileId=${encodeURIComponent(target.fileId)}`,
          { method: "DELETE", credentials: "include" }
        );
      } else if (target.fileId && target.kind === "video") {
        await fetch(
          `/api/domestic/video/upload?fileId=${encodeURIComponent(target.fileId)}`,
          { method: "DELETE", credentials: "include" }
        );
      } else if (target.fileId && target.kind === "audio") {
        await fetch(
          `/api/domestic/audio/upload?fileId=${encodeURIComponent(target.fileId)}`,
          { method: "DELETE", credentials: "include" }
        );
      }
    } catch (err) {
      if(false) console.warn("Failed to delete remote file", err);
    }

    if (target.preview?.startsWith("blob:")) {
      URL.revokeObjectURL(target.preview);
    }

    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const {
    isListening,
    transcript,
    setTranscript,
    startListening,
    stopListening,
  } = speechRecognition;

  const {
    bookmarkedMessages,
    setBookmarkedMessages,
    bookmarkFolders,
    setBookmarkFolders,
    editingBookmarkId,
    setEditingBookmarkId,
    editingBookmarkName,
    setEditingBookmarkName,
    newFolderName,
    setNewFolderName,
    newFolderColor,
    setNewFolderColor,
  } = bookmarkState;

  const { paymentError, setPaymentError } = paymentState;

  const { shareLink, setShareLink, shareSecret, setShareSecret } = shareState;

  const {
    resetConfirmData,
    setResetConfirmData,
    registrationPromptType,
    setRegistrationPromptType,
  } = resetState;

  // keep chat state's language in sync with global language selection
  useEffect(() => {
    if (activeLanguage && activeLanguage !== selectedLanguage) {
      setSelectedLanguage(activeLanguage);
    }
  }, [activeLanguage, selectedLanguage, setSelectedLanguage]);

  // Sync plan expiration from localStorage after login without refresh
  useEffect(() => {
    if (!appUser || !currentPlan) return;
    const storedExp = localStorage.getItem("morngpt_current_plan_exp");
    if (storedExp && !appUser.planExp) {
      setAppUser((prev) => (prev ? { ...prev, planExp: storedExp } : prev));
    }
  }, [appUser, currentPlan, setAppUser]);
  // propagate selection back to global language so auth screens & dialogs stay aligned
  useEffect(() => {
    if (selectedLanguage && selectedLanguage !== currentLanguage) {
      setCurrentLanguage(selectedLanguage);
    }
  }, [selectedLanguage, currentLanguage, setCurrentLanguage]);
  
  // Get current model configuration
  // 国内版移动端：使用"晨佑AI平台"替代"MornGPT"
  const useDomesticMobileBrand = IS_DOMESTIC_VERSION && isMobile;
  const getLocalizedText = useMemo<(key: string) => string>(
    () =>
      createLocalizedTextGetter(
        activeLanguage,
        useDomesticMobileBrand,
      ) as unknown as (key: string) => string,
    [activeLanguage, useDomesticMobileBrand],
  );

  // Ref for the textarea to enable reliable scrolling
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const jumpToScrollRef = useRef<HTMLDivElement>(null);
  const promptScrollRef = useRef<HTMLDivElement>(null);
  const bookmarkScrollRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const appUserRef = useRef<AppUser | null>(null);
  const isDomesticSessionRef = useRef<boolean>(IS_DOMESTIC_VERSION);
  const currentChatIdRef = useRef<string>("");
  const messagesLoadTokenRef = useRef<number>(0);
  const chatSessionsRef = useRef<ChatSession[]>([]);
  const loadConversationsPendingRef = useRef<boolean>(false);
  const hasLoadedConversationsRef = useRef<boolean>(false);
  const loadedConversationsForUserRef = useRef<string | null>(null);
  const [isConversationLoading, setIsConversationLoading] =
    useState<boolean>(false);

  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  useEffect(() => {
    appUserRef.current = appUser as AppUser | null;
  }, [appUser]);

  // 登录后默认选择通用模型（General Model），避免默认选中外部模型
  useEffect(() => {
    if (appUser && (!currentChatId || chatSessions.length === 0)) {
      setSelectedModelType("general");
      setSelectedModel(GENERAL_MODEL_ID);
      setSelectedCategory("general");
    }
  }, [appUser, currentChatId, chatSessions.length, setSelectedModel, setSelectedModelType, setSelectedCategory]);

  // 用户登录后自动展开侧边栏，未登录时保持收起
  useEffect(() => {
    if (appUser && isLoggedIn) {
      // 用户已登录，展开侧边栏
      setSidebarCollapsed(false);
    } else if (!appUser && !isLoggedIn) {
      // 用户未登录，收起侧边栏
      setSidebarCollapsed(true);
    }
  }, [appUser, isLoggedIn, setSidebarCollapsed]);

  useEffect(() => {
    chatSessionsRef.current = chatSessions;
  }, [chatSessions]);

  const getToday = () => new Date().toISOString().split("T")[0];

  const refreshQuota = useCallback(
    async (userOverride?: AppUser | null) => {
      const today = getToday();
      setFreeQuotaDate(today);

      const targetUser = userOverride ?? appUserRef.current ?? appUser;
      if(false) console.log("/*quota*/ refreshQuota start", {
        targetUserId: targetUser?.id,
        targetPlan: targetUser?.plan,
        currentPlan,
        isPro: targetUser?.isPro,
      });
      const planLower = (targetUser?.plan || "").toLowerCase?.() || "";
      const isUnlimited = planLower === "unlimited";
      if (!targetUser?.id) {
        setFreeQuotaUsed(0);
        setFreeQuotaLimit(FREE_DAILY_LIMIT);
        setBasicQuotaUsed(0);
        setBasicQuotaLimit(BASIC_DAILY_LIMIT);
        setBasicQuotaDate(getToday());
        // Pro 也重置
        setProQuotaUsed(0);
        setProQuotaLimit(PRO_DAILY_LIMIT);
        setProQuotaDate(getToday());
        setEnterpriseQuotaUsed(0);
        setEnterpriseQuotaLimit(ENTERPRISE_DAILY_LIMIT);
        setEnterpriseQuotaDate(getToday());
        return;
      }

      try {
        const data = await fetchQuotaShared("/api/account/quota");
        if(false) console.log("/*quota*/ refreshQuota response", data);
        if (data?.plan === "basic" || data?.plan === "pro" || data?.plan === "enterprise") {
          const dailyLimit =
            typeof data.daily?.limit === "number"
              ? data.daily.limit
              : typeof data.limit === "number"
                ? data.limit
                : data?.plan === "pro"
                  ? PRO_DAILY_LIMIT
                  : data?.plan === "enterprise"
                    ? ENTERPRISE_DAILY_LIMIT
                    : BASIC_DAILY_LIMIT;
          const dailyUsed =
            typeof data.daily?.used === "number"
              ? data.daily.used
              : typeof data.used === "number"
                ? data.used
              : typeof data.daily?.remaining === "number"
                  ? dailyLimit - data.daily.remaining
                  : typeof data.remaining === "number" && typeof dailyLimit === "number"
                    ? dailyLimit - data.remaining
                    : 0;

          const limitSetter =
            data?.plan === "pro"
              ? setProQuotaLimit
              : data?.plan === "enterprise"
                ? setEnterpriseQuotaLimit
                : setBasicQuotaLimit;
          const usedSetter =
            data?.plan === "pro"
              ? setProQuotaUsed
              : data?.plan === "enterprise"
                ? setEnterpriseQuotaUsed
                : setBasicQuotaUsed;
          const dateSetter =
            data?.plan === "pro"
              ? setProQuotaDate
              : data?.plan === "enterprise"
                ? setEnterpriseQuotaDate
                : setBasicQuotaDate;

          dateSetter(today);
          usedSetter((prev) => Math.max(prev, dailyUsed));
          limitSetter(dailyLimit || (data?.plan === "pro" ? PRO_DAILY_LIMIT : data?.plan === "enterprise" ? ENTERPRISE_DAILY_LIMIT : BASIC_DAILY_LIMIT));

          const setPhotoLimit =
            data?.plan === "pro"
              ? setProPhotoLimit
              : data?.plan === "enterprise"
                ? setEnterprisePhotoLimit
                : setBasicPhotoLimit;
          const setPhotoRemaining =
            data?.plan === "pro"
              ? setProPhotoRemaining
              : data?.plan === "enterprise"
                ? setEnterprisePhotoRemaining
                : setBasicPhotoRemaining;
          const setVideoLimit =
            data?.plan === "pro"
              ? setProVideoAudioLimit
              : data?.plan === "enterprise"
                ? setEnterpriseVideoAudioLimit
                : setBasicVideoAudioLimit;
          const setVideoRemaining =
            data?.plan === "pro"
              ? setProVideoAudioRemaining
              : data?.plan === "enterprise"
                ? setEnterpriseVideoAudioRemaining
                : setBasicVideoAudioRemaining;
          const setContextLimit =
            data?.plan === "pro"
              ? setProContextLimit
              : data?.plan === "enterprise"
                ? setEnterpriseContextLimit
                : setBasicContextLimit;

          setPhotoLimit(
            typeof data.photoLimit === "number"
              ? data.photoLimit
              : typeof data.monthlyMedia?.photoLimit === "number"
                ? data.monthlyMedia.photoLimit
                : null
          );
          setPhotoRemaining(
            typeof data.photoRemaining === "number"
              ? data.photoRemaining
              : typeof data.monthlyMedia?.photoRemaining === "number"
                ? data.monthlyMedia.photoRemaining
                : null
          );
          setVideoLimit(
            typeof data.videoAudioLimit === "number"
              ? data.videoAudioLimit
              : typeof data.monthlyMedia?.videoAudioLimit === "number"
                ? data.monthlyMedia.videoAudioLimit
                : null
          );
          setVideoRemaining(
            typeof data.videoAudioRemaining === "number"
              ? data.videoAudioRemaining
              : typeof data.monthlyMedia?.videoAudioRemaining === "number"
                ? data.monthlyMedia.videoAudioRemaining
                : null
          );
          setContextLimit(
            typeof data.contextMsgLimit === "number" ? data.contextMsgLimit : null
          );

          // 将 Pro 视为独立存储
          // 已通过 setter 分支处理，无需额外同步

          // 清空 Free 显示以免串用
          setFreeQuotaUsed(0);
          setFreePhotoLimit(null);
          setFreePhotoRemaining(null);
          setFreeVideoAudioLimit(null);
          setFreeVideoAudioRemaining(null);
          setFreeContextLimit(null);
          if(false) console.log("/*quota*/ refreshQuota applied basic/pro", {
            used: dailyUsed,
            limit: dailyLimit || (data?.plan === "pro" ? PRO_DAILY_LIMIT : BASIC_DAILY_LIMIT),
            period: data.period,
            plan: data?.plan,
          });
        } else {
          const usedVal =
            typeof data.used === "number"
              ? data.used
              : typeof data.limit === "number" && typeof data.remaining === "number"
                ? data.limit - data.remaining
                : typeof data.daily?.used === "number"
                  ? data.daily.used
                  : typeof data.daily?.limit === "number" && typeof data.daily?.remaining === "number"
                    ? data.daily.limit - data.daily.remaining
                    : 0;
          const limitVal =
            typeof data.limit === "number"
              ? data.limit
              : typeof data.daily?.limit === "number"
                ? data.daily.limit
                : FREE_DAILY_LIMIT;

          setFreeQuotaUsed((prev) => Math.max(prev, usedVal));
          setFreeQuotaLimit(limitVal);
          setFreePhotoLimit(
            typeof data.photoLimit === "number"
              ? data.photoLimit
              : typeof data.monthlyMedia?.photoLimit === "number"
                ? data.monthlyMedia.photoLimit
                : null
          );
          setFreePhotoRemaining(
            typeof data.photoRemaining === "number"
              ? data.photoRemaining
              : typeof data.monthlyMedia?.photoRemaining === "number"
                ? data.monthlyMedia.photoRemaining
                : null
          );
          setFreeVideoAudioLimit(
            typeof data.videoAudioLimit === "number"
              ? data.videoAudioLimit
              : typeof data.monthlyMedia?.videoAudioLimit === "number"
                ? data.monthlyMedia.videoAudioLimit
                : null
          );
          setFreeVideoAudioRemaining(
            typeof data.videoAudioRemaining === "number"
              ? data.videoAudioRemaining
              : typeof data.monthlyMedia?.videoAudioRemaining === "number"
                ? data.monthlyMedia.videoAudioRemaining
                : null
          );
          setFreeContextLimit(
            typeof data.contextMsgLimit === "number" ? data.contextMsgLimit : null
          );
          // Free 模式下避免使用旧的 Basic 上下文限制（订阅到期但 plan 字段未及时同步时会串用）
          setBasicContextLimit(null);
          setBasicQuotaUsed(0);
          setBasicQuotaDate(today);
          setProQuotaUsed(0);
          setProQuotaDate(today);
          setEnterpriseQuotaUsed(0);
          setEnterpriseQuotaDate(today);
          setEnterprisePhotoLimit(null);
          setEnterprisePhotoRemaining(null);
          setEnterpriseVideoAudioLimit(null);
          setEnterpriseVideoAudioRemaining(null);
          setEnterpriseContextLimit(null);
          setProPhotoLimit(null);
          setProPhotoRemaining(null);
          setProVideoAudioLimit(null);
          setProVideoAudioRemaining(null);
          setProContextLimit(null);
          if(false) console.log("/*quota*/ refreshQuota applied free", {
            used: usedVal,
            limit: limitVal,
            period: data.period,
          });
        }

        // 通知需要实时刷新的前端组件（悬浮层/额度弹层/铭牌）
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("quota:refresh"));
        }
      } catch (err) {
        // 失败时保持当前显示，避免误将额度重置为 0 导致进度条回弹
        if(false) console.warn("/*quota*/ refresh failed", err);
        if(false) console.warn("/*quota*/ keeping previous quota state");
      }
    },
    [appUser, basicQuotaLimit, currentPlan],
  );

  useEffect(() => {
    void refreshQuota(appUserRef.current);
    // 仅在用户或当前计划变化时主动刷新，避免重复请求
  }, [currentPlan, appUser?.id]);

  const requireLogin = useCallback(() => {
    setAuthMode("login");
    setAuthForm((prev) => ({ ...prev, password: "" }));
    setShowAuthDialog(true);
    alert("Please sign in to start chatting.");
  }, [setAuthMode, setAuthForm, setShowAuthDialog]);

  const consumeFreeQuota = useCallback(() => {
    // 通用模型（General Model）不扣减每日外部额度（国内/国际一致）
    if (selectedModelType === "general" || selectedModel === GENERAL_MODEL_ID) {
      return true;
    }

    if (!appUser) return false;
    const planLower = (currentPlan || appUser?.plan || "").toLowerCase?.() || "";
    const isBasicOrPro = planLower === "basic" || planLower === "pro" || planLower === "enterprise";

    if (isBasicOrPro) {
      const today = getToday();
      const baseUsed =
        planLower === "pro"
          ? proQuotaDate === today ? proQuotaUsed : 0
          : planLower === "enterprise"
            ? enterpriseQuotaDate === today ? enterpriseQuotaUsed : 0
            : basicQuotaDate === today
              ? basicQuotaUsed
              : 0;
      const limit =
        planLower === "pro"
          ? proQuotaLimit || PRO_DAILY_LIMIT
          : planLower === "enterprise"
            ? enterpriseQuotaLimit || ENTERPRISE_DAILY_LIMIT
            : basicQuotaLimit || BASIC_DAILY_LIMIT;
      if (baseUsed >= limit) {
        alert(
          planLower === "pro"
            ? `You have reached today's ${limit}-message limit on Pro. Please upgrade to continue.`
            : planLower === "enterprise"
              ? `You have reached today's ${limit}-message limit on Enterprise. Please contact support to extend your quota.`
              : `You have reached today's ${limit}-message limit on Basic. Please upgrade to continue.`
        );
        setShowUpgradeDialog(true);
        return false;
      }
      if (planLower === "pro") {
        setProQuotaDate(today);
        setProQuotaUsed((prev) => {
          const safePrev = proQuotaDate === today ? prev : 0;
          const next = Math.min(limit, safePrev + 1);
          if(false) console.log("/*quota*/ local pro consume", { prev, next, limit });
          return next;
        });
      } else {
        setBasicQuotaDate(today);
        setBasicQuotaUsed((prev) => {
          const safePrev = basicQuotaDate === today ? prev : 0;
          const next = Math.min(limit, safePrev + 1);
          if(false) console.log("/*quota*/ local basic consume", { prev, next, limit });
          return next;
        });
      }
      void refreshQuota();
      return true;
    } else {
      const today = getToday();
      const baseUsed = freeQuotaDate === today ? freeQuotaUsed : 0;
      const limit = freeQuotaLimit || FREE_DAILY_LIMIT;
      if (baseUsed >= limit) {
        alert(
          `You have reached today's ${limit}-message limit on Free. Please upgrade to continue.`
        );
        setShowUpgradeDialog(true);
        return false;
      }

      const nextUsed = baseUsed + 1;
      setFreeQuotaDate(today);
      setFreeQuotaUsed(nextUsed);
      void refreshQuota();
      return true;
    }
  }, [
    appUser,
    currentPlan,
    selectedModelType,
    selectedModel,
    freeQuotaDate,
    freeQuotaUsed,
    freeQuotaLimit,
    basicQuotaLimit,
    basicQuotaUsed,
    setShowUpgradeDialog,
    refreshQuota,
  ]);

  // reset conversation loading guards when user switches
  useEffect(() => {
    if (!appUser?.id) {
      hasLoadedConversationsRef.current = false;
      loadConversationsPendingRef.current = false;
      loadedConversationsForUserRef.current = null;
    } else if (loadedConversationsForUserRef.current !== appUser.id) {
      hasLoadedConversationsRef.current = false;
      loadConversationsPendingRef.current = false;
    }
  }, [appUser?.id]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // Auto-scroll to input area when voice recording starts
  const scrollToInputArea = useCallback(() => {
    // Immediate scroll to bottom
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth",
    });

    setTimeout(() => {
      // Use the ref if available, otherwise fall back to querySelector
      const inputArea =
        textareaRef.current ||
        document.querySelector(
          'textarea[placeholder="Start a conversation with MornGPT..."]'
        ) ||
        document.querySelector(".min-h-20") ||
        document.querySelector("textarea");

      if (inputArea) {
        // Scroll the input area into view
        inputArea.scrollIntoView({
          behavior: "smooth",
          block: "end",
          inline: "nearest",
        });

        // Focus the textarea to ensure it's ready for input
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }
    }, 200); // Reduced delay for faster response
  }, [textareaRef]);

  // Use keyboard shortcuts hook (after all functions are declared)
  const keyboardShortcuts = useKeyboardShortcuts(
    shortcutsEnabled,
    appUser,
    customShortcuts,
    setCustomShortcuts,
    createNewChat,
    setSidebarCollapsed,
    toggleTheme,
    setShowSettingsDialog,
    setShowBillingDialog,
    setShowPrivacyDialog,
    setShowDownloadSection,
    setShowShortcutsHelp,
    setIsAskGPTOpen,
    setIsPromptHistoryOpen,
    toggleVoiceRecording,
    toggleCamera,
    getCurrentLocation,
    handleQuickAction,
    deleteChat,
    currentChatId,
    messagesEndRef,
    scrollToInputArea
  );

  // Use message submission hook
  const {
    handleSubmit: handleMessageSubmit,
    forceUpdate,
    replaceConversationState,
    cancelReplaceConversation,
    confirmReplaceConversation,
  } = useMessageSubmission(
      prompt,
      setPrompt,
      uploadedFiles,
      setUploadedFiles,
      messages,
      setMessages,
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
      selectedModelType,
      selectedModel,
      setSelectedModel,
      setSelectedModelType,
      selectedCategory,
      selectedLanguage,
      setSelectedLanguage,
      appUser,
      guestChatSessions,
      setGuestChatSessions,
      guestSessionTimeout,
      setGuestSessionTimeout,
      streamingController,
      setStreamingController,
      scrollAreaRef,
      getFileIcon,
      formatFileSize,
      getLocalizedText,
      mornGPTCategories,
      expandedFolders,
      setExpandedFolders,
      externalModels,
      supabase,
      requireLogin,
      consumeFreeQuota,
      refreshQuota,
      () => setShowUpgradeDialog(true),
      !appUser && mobileGuestTrial.isEnabled, // 移动端访客试用：仅未登录用户才允许跳过登录检查
    );

  // Guest session timeout management
  useEffect(() => {
    // Clear any existing timeout
    if (guestSessionTimeout) {
      clearTimeout(guestSessionTimeout);
    }

    // Set new timeout for guest sessions (3 hours of inactivity)
    if (!appUser && guestChatSessions.length > 0) {
      const timeout = setTimeout(() => {
        setGuestChatSessions([]);
        setMessages([]);
        setCurrentChatId("");
        alert(getLocalizedText("guestSessionExpired"));
      }, 3 * 60 * 60 * 1000); // 3 hours

      setGuestSessionTimeout(timeout);
    }

    // Cleanup function
    return () => {
      if (guestSessionTimeout) {
        clearTimeout(guestSessionTimeout);
      }
    };
  }, [guestChatSessions, appUser]);

  // Camera cleanup on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      if ((window as any).recordingTimer) {
        clearInterval((window as any).recordingTimer);
      }
    };
  }, [cameraStream]);

  // Clear guest sessions on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!appUser && guestChatSessions.length > 0) {
        // Clear guest sessions from localStorage
        localStorage.removeItem("morngpt_guest_sessions");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [guestChatSessions, appUser]);

  // Load user data and theme from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("morngpt_user");
    const savedTheme = localStorage.getItem("morngpt_theme");
    const savedPlan = localStorage.getItem("morngpt_current_plan");
    const savedPlanExp = localStorage.getItem("morngpt_current_plan_exp");
    const savedCustomShortcuts = localStorage.getItem("customShortcuts");

    // Check for shared conversation in URL
    const urlParams = new URLSearchParams(window.location.search);
    const shareKey = urlParams.get("share");

    if (shareKey) {
      try {
        const sharedData = localStorage.getItem(shareKey);
        if (sharedData) {
          const parsedData = JSON.parse(sharedData);

          // Create a new chat session from shared data
          const sharedChat: ChatSession = {
            id: `shared_${Date.now()}`,
            title: `Shared: ${parsedData.title}`,
            messages: parsedData.messages,
            model: parsedData.model,
            modelType: parsedData.modelType,
            category: parsedData.category,
            lastUpdated: new Date(parsedData.createdAt),
            isModelLocked: true,
          };

          // Add to chat sessions and select it
          if (appUser) {
            setChatSessions((prev) => [sharedChat, ...prev]);
          } else {
            setGuestChatSessions((prev) => [sharedChat, ...prev]);
          }
          setCurrentChatId(sharedChat.id);
          setMessages(parsedData.messages);

          // Clear the share parameter from URL
          const newUrl = window.location.pathname;
          window.history.replaceState({}, "", newUrl);

          // Show success message
          alert(
            getLocalizedText("sharedConversationLoaded")
              .replace("{title}", parsedData.title)
              .replace("{author}", parsedData.createdBy)
          );
        }
      } catch (error) {
        console.error("Error loading shared conversation:", error);
        alert(getLocalizedText("errorLoadingShared"));
      }
    }

    if (savedPlan) {
      setCurrentPlan(savedPlan as "Basic" | "Pro" | "Enterprise");
    }
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.planExp || savedPlanExp) {
          parsed.planExp = parsed.planExp || savedPlanExp;
          setAppUser((prev) =>
            prev
              ? { ...prev, planExp: parsed.planExp }
              : (parsed as AppUser),
          );
        }
      } catch (e) {
        // ignore malformed local data
      }
    }

    if (savedTheme === "dark") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    }

    // Load custom shortcuts
    if (savedCustomShortcuts) {
      try {
        setCustomShortcuts(JSON.parse(savedCustomShortcuts));
      } catch (error) {
        console.error("Error loading custom shortcuts:", error);
      }
    }
  }, []);

  // Save chat sessions when they change
  useEffect(() => {
    if (appUser) {
      localStorage.setItem(
        `morngpt_chats_${appUser.id}`,
        JSON.stringify(chatSessions)
      );
    }
  }, [chatSessions, appUser]);

  // Save bookmarked messages when they change
  useEffect(() => {
    if (appUser) {
      localStorage.setItem(
        `morngpt_bookmarks_${appUser.id}`,
        JSON.stringify(bookmarkedMessages)
      );
    }
  }, [bookmarkedMessages, appUser]);

  // Update prompt history when current chat changes
  useEffect(() => {
    const currentChat = chatSessions.find((c) => c.id === currentChatId);
    if (currentChat) {
      const userPrompts = currentChat.messages
        .filter((msg) => msg.role === "user")
        .map((msg) => msg.content)
        .slice(-50) // Keep last 50 prompts instead of 10
        .reverse(); // Reverse to show newest first
      setPromptHistory(userPrompts);
    }
  }, [currentChatId, chatSessions]);

  // Handle sidebar resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(200, Math.min(400, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  function toggleTheme() {
    setTheme(isDarkMode ? "light" : "dark");
  }

  function setTheme(mode: "light" | "dark") {
    const newThemeIsDark = mode === "dark";
    setIsDarkMode(newThemeIsDark);
    if (typeof window !== "undefined") {
      localStorage.setItem("morngpt_theme", newThemeIsDark ? "dark" : "light");
    }
    document.documentElement.classList.toggle("dark", newThemeIsDark);
    document.body.classList.toggle("dark", newThemeIsDark);
  }

  const applyFontSettings = useCallback(
    (family: string, sizePx: string) => {
      const resolvedSize = /^\d+$/.test(sizePx) ? `${sizePx}px` : sizePx;
      // 保持全局字体为固定的14px，不受用户设置影响
      document.documentElement.style.fontSize = "14px";
      document.body.style.fontSize = "14px";
      // 设置聊天消息专用的可调节字体变量
      document.documentElement.style.setProperty("--chat-font-size", resolvedSize);
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTheme = localStorage.getItem("morngpt_theme");
    if (storedTheme === "dark" || storedTheme === "light") {
      setTheme(storedTheme);
    }
    const storedFamily = localStorage.getItem("morngpt_font_family");
    const storedSize = localStorage.getItem("morngpt_font_size");
    const family = storedFamily || fontFamily;
    const size = storedSize || fontSize;
    setFontFamily(family);
    setFontSize(size);
    applyFontSettings(family, size);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    applyFontSettings(fontFamily, fontSize);
  }, [fontFamily, fontSize, applyFontSettings]);

  // 清理非 omni 模型下的已上传媒体
  useEffect(() => {
    const isOmni = (selectedModel || "").toLowerCase() === "qwen3-omni-flash";
    if (!isOmni && uploadedFiles.length > 0) {
      void clearUploadsAndRemote();
    }
  }, [selectedModel, selectedModelType, uploadedFiles, clearUploadsAndRemote]);

  const handleFontFamilyChange = (family: string) => {
    setFontFamily(family);
    if (typeof window !== "undefined") {
      localStorage.setItem("morngpt_font_family", family);
    }
  };

  const handleFontSizeChange = (size: string) => {
    setFontSize(size);
    if (typeof window !== "undefined") {
      localStorage.setItem("morngpt_font_size", size);
    }
  };

  const getSelectedModelDisplayLabel = () => {
    return getSelectedModelDisplayUtil(
      selectedModelType,
      selectedModel,
      selectedCategory,
      mornGPTCategories
    );
  };

  const getModelIcon = () => {
    if (selectedModelType === "general") {
      return <MessageSquare className="w-3 h-3" />;
    }
    if (selectedModelType === "morngpt" && selectedCategory) {
      const category = mornGPTCategories.find((c) => c.id === selectedCategory);
      const IconComponent = category?.icon || MessageSquare;
      return <IconComponent className="w-3 h-3" />;
    }
    if (selectedModelType === "external" && selectedModel) {
      // 查找选中的外部模型
      const model = externalModels.find(
        (m) => m.id.toLowerCase() === selectedModel.toLowerCase() ||
               m.name.toLowerCase() === selectedModel.toLowerCase()
      );
      if (model) {
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
      }
      return <Globe className="w-3 h-3" />;
    }
    return <MessageSquare className="w-3 h-3" />;
  };

  // Clipboard functions moved to utils

  // Share and download functions moved to utils

  const bookmarkMessage = (message: Message) => {
    if (!appUser) {
      setRegistrationPromptType("feature");
      setShowRegistrationPrompt(true);
      return;
    }

    const bookmark: BookmarkedMessage = {
      id: Date.now().toString(),
      messageId: message.id,
      chatId: currentChatId,
      title: message.content.slice(0, 50) + "...",
      content: message.content,
      timestamp: new Date(),
      customName: `Bookmark ${bookmarkedMessages.length + 1}`,
      folder: selectedBookmarkFolder,
    };

    setBookmarkedMessages((prev) => [bookmark, ...prev]);
  };

  const removeBookmark = (bookmarkId: string) => {
    setBookmarkedMessages((prev) => prev.filter((b) => b.id !== bookmarkId));
  };

  const isMessageBookmarked = (messageId: string) => {
    return bookmarkedMessages.some((b) => b.messageId === messageId);
  };

  const startEditingBookmark = (bookmarkId: string, currentName: string) => {
    setEditingBookmarkId(bookmarkId);
    setEditingBookmarkName(currentName);
  };

  const saveBookmarkName = () => {
    setBookmarkedMessages((prev) =>
      prev.map((bookmark) =>
        bookmark.id === editingBookmarkId
          ? { ...bookmark, customName: editingBookmarkName }
          : bookmark
      )
    );
    setEditingBookmarkId("");
    setEditingBookmarkName("");
  };

  const cancelBookmarkEditing = () => {
    setEditingBookmarkId("");
    setEditingBookmarkName("");
  };

  // Bookmark folder functions
  const createBookmarkFolder = () => {
    if (!newFolderName.trim()) return;

    const newFolder: BookmarkFolder = {
      id: `folder_${Date.now()}`,
      name: newFolderName.trim(),
      color: newFolderColor,
      createdAt: new Date(),
    };

    setBookmarkFolders((prev) => [...prev, newFolder]);
    setNewFolderName("");
    setNewFolderColor("#6B7280");
    setShowCreateFolderDialog(false);

    // Save to localStorage
    localStorage.setItem(
      "bookmarkFolders",
      JSON.stringify([...bookmarkFolders, newFolder])
    );
  };

  const deleteBookmarkFolder = (folderId: string) => {
    if (folderId === "default") return; // Don't delete default folder

    // Move bookmarks from deleted folder to default folder
    setBookmarkedMessages((prev) =>
      prev.map((bookmark) =>
        bookmark.folder === folderId
          ? { ...bookmark, folder: "default" }
          : bookmark
      )
    );

    // Remove folder
    setBookmarkFolders((prev) =>
      prev.filter((folder) => folder.id !== folderId)
    );

    // Update selected folder if it was the deleted one
    if (selectedBookmarkFolder === folderId) {
      setSelectedBookmarkFolder("default");
    }

    // Save to localStorage
    const updatedFolders = bookmarkFolders.filter(
      (folder) => folder.id !== folderId
    );
    localStorage.setItem("bookmarkFolders", JSON.stringify(updatedFolders));
  };

  const getBookmarksByFolder = (folderId: string) => {
    return bookmarkedMessages.filter(
      (bookmark) => bookmark.folder === folderId
    );
  };

  const moveBookmarkToFolder = (bookmarkId: string, folderId: string) => {
    setBookmarkedMessages((prev) =>
      prev.map((bookmark) =>
        bookmark.id === bookmarkId
          ? { ...bookmark, folder: folderId }
          : bookmark
      )
    );
  };

  const exportBookmarks = () => {
    const exportData = {
      bookmarks: bookmarkedMessages,
      folders: bookmarkFolders,
      exportDate: new Date().toISOString(),
      version: "1.0",
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `morngpt-bookmarks-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importBookmarks = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const importData = JSON.parse(event.target?.result as string);

            if (importData.bookmarks && importData.folders) {
              // Import folders first
              setBookmarkFolders((prev) => {
                const existingFolderIds = new Set(prev.map((f) => f.id));
                const newFolders = importData.folders.filter(
                  (f: BookmarkFolder) => !existingFolderIds.has(f.id)
                );
                return [...prev, ...newFolders];
              });

              // Import bookmarks
              setBookmarkedMessages((prev) => {
                const existingBookmarkIds = new Set(prev.map((b) => b.id));
                const newBookmarks = importData.bookmarks.filter(
                  (b: BookmarkedMessage) => !existingBookmarkIds.has(b.id)
                );
                return [...prev, ...newBookmarks];
              });

              alert(
                `Successfully imported ${importData.bookmarks.length} bookmarks and ${importData.folders.length} folders!`
              );
            } else {
              alert("Invalid bookmark file format");
            }
          } catch (error) {
            alert("Error importing bookmarks: Invalid JSON file");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const scrollJumpToMessages = (direction: "up" | "down") => {
    if (!jumpToScrollRef.current) return;
    const scrollAmount = 100;
    const currentScroll = jumpToScrollRef.current.scrollTop;
    const newScroll =
      direction === "up"
        ? currentScroll - scrollAmount
        : currentScroll + scrollAmount;
    jumpToScrollRef.current.scrollTo({ top: newScroll, behavior: "smooth" });
    setJumpToScrollPosition(newScroll);
  };

  const scrollPromptHistory = (direction: "up" | "down") => {
    if (!promptScrollRef.current) return;
    const scrollAmount = 100;
    const currentScroll = promptScrollRef.current.scrollTop;
    const newScroll =
      direction === "up"
        ? currentScroll - scrollAmount
        : currentScroll + scrollAmount;
    promptScrollRef.current.scrollTo({ top: newScroll, behavior: "smooth" });
    setPromptScrollPosition(newScroll);
  };

  const scrollBookmarks = (direction: "up" | "down") => {
    if (!bookmarkScrollRef.current) return;
    const scrollAmount = 100;
    const currentScroll = bookmarkScrollRef.current.scrollTop;
    const newScroll =
      direction === "up"
        ? currentScroll - scrollAmount
        : currentScroll + scrollAmount;
    bookmarkScrollRef.current.scrollTo({ top: newScroll, behavior: "smooth" });
    setBookmarkScrollPosition(newScroll);
  };

  const scrollSidebar = (direction: "up" | "down") => {
    if (!sidebarScrollRef.current) return;
    const scrollAmount = 100;
    const currentScroll = sidebarScrollRef.current.scrollTop;
    const newScroll =
      direction === "up"
        ? currentScroll - scrollAmount
        : currentScroll + scrollAmount;
    sidebarScrollRef.current.scrollTo({ top: newScroll, behavior: "smooth" });
    setSidebarScrollPosition(newScroll);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (authMode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          authForm.email,
          { redirectTo: `${window.location.origin}/auth/update-password` },
        );
        if (error) throw error;
        alert("Password reset link sent to your email.");
        setAuthMode("login");
        return;
      }

      if (authMode === "signup") {
        if (isDomestic) {
          const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              email: authForm.email,
              password: authForm.password,
              name: authForm.name,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Register failed");
          // CloudBase 返回用户对象
          const storedExp = localStorage.getItem("morngpt_current_plan_exp");
          // 正确判断 isPaid：Basic/Pro/Enterprise 都是付费用户
          const planLower = (data.user.metadata?.plan || "").toLowerCase();
          const isProMeta = !!data.user.metadata?.pro;
          const isPaidUser = planLower === "basic" || planLower === "pro" || planLower === "enterprise" || isProMeta;
          const mappedUser: AppUser = {
            id: data.user.id,
            email: data.user.email || "",
            name: data.user.name || data.user.email || "User",
            avatar: data.user.avatar || undefined, // 用户头像
            isPro: isProMeta && planLower !== "basic",
            isPaid: isPaidUser,
            plan: data.user.metadata?.plan,
            planExp: data.user.metadata?.plan_exp || storedExp || undefined,
            settings: {
              theme: "light",
              language: "zh",
              notifications: true,
              soundEnabled: true,
              autoSave: true,
              hideAds: data.user.metadata?.hide_ads ?? false,
            },
          };
          setAppUser(mappedUser);
          setIsLoggedIn(true);
          setShowAuthDialog(false);
          if (mappedUser.plan) {
            setCurrentPlan(mappedUser.plan as "Basic" | "Pro" | "Enterprise");
            localStorage.setItem("morngpt_current_plan", mappedUser.plan);
          }
          if (mappedUser.planExp) {
            localStorage.setItem("morngpt_current_plan_exp", mappedUser.planExp);
          }
          appUserRef.current = mappedUser;
          void loadConversations(mappedUser);
          alert(isZh ? "注册成功" : "Sign up successful");
        } else {
          // 检查邮件发送冷却时间
          const { canSend, remainingSeconds } = checkEmailCooldown(authForm.email);
          if (!canSend) {
            alert(getCooldownMessage(remainingSeconds, isZh));
            return;
          }

          const { data, error } = await supabase.auth.signUp({
            email: authForm.email,
            password: authForm.password,
            options: {
              data: { full_name: authForm.name },
              emailRedirectTo: `${window.location.origin}/auth/confirm?next=/`,
            },
          });
          if (error) throw error;

          // 检测是否是已存在的用户
          // Supabase 对于已注册的邮箱不会返回错误，而是返回空的 identities 数组
          if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
            throw new Error(
              isZh
                ? "该邮箱已被注册，请直接登录"
                : "This email is already registered. Please sign in instead."
            );
          }

          // 记录邮件发送时间，设置冷却期
          setEmailCooldown(authForm.email);

          // 重要：注册成功后立即登出，防止用户在未验证邮箱的情况下访问应用
          // Supabase 默认会在注册后创建 session，但我们要求用户必须先验证邮箱
          await supabase.auth.signOut();

          // 不要设置用户状态，只显示提示信息
          // 用户必须先验证邮箱才能登录
          alert(
            isZh
              ? "注册成功，请查收邮箱并完成验证后再登录。"
              : "Sign up successful. Please check your email to verify before logging in.",
          );
        }
      } else {
        if (isDomestic) {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              email: authForm.email,
              password: authForm.password,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Login failed");
          const storedExp = localStorage.getItem("morngpt_current_plan_exp");
          // 正确判断 isPaid：Basic/Pro/Enterprise 都是付费用户
          const planLower = (data.user.metadata?.plan || "").toLowerCase();
          const isProMeta = !!data.user.metadata?.pro;
          const isPaidUser = planLower === "basic" || planLower === "pro" || planLower === "enterprise" || isProMeta;
          const mappedUser: AppUser = {
            id: data.user.id,
            email: data.user.email || "",
            name: data.user.name || data.user.email || "User",
            avatar: data.user.avatar || undefined, // 用户头像
            isPro: isProMeta && planLower !== "basic",
            isPaid: isPaidUser,
            plan: data.user.metadata?.plan,
            planExp: data.user.metadata?.plan_exp || storedExp || undefined,
            settings: {
              theme: "light",
              language: "zh",
              notifications: true,
              soundEnabled: true,
              autoSave: true,
              hideAds: data.user.metadata?.hide_ads ?? false,
            },
          };
          setAppUser(mappedUser);
          setIsLoggedIn(true);
          setShowAuthDialog(false);
          if (mappedUser.plan) {
            setCurrentPlan(mappedUser.plan as "Basic" | "Pro" | "Enterprise");
            localStorage.setItem("morngpt_current_plan", mappedUser.plan);
          }
          if (mappedUser.planExp) {
            localStorage.setItem("morngpt_current_plan_exp", mappedUser.planExp);
          }
          appUserRef.current = mappedUser;
          void loadConversations(mappedUser);
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: authForm.email,
            password: authForm.password,
          });
          if (error) {
            const msg = (error.message || "").toLowerCase();
            if (msg.includes("email not confirmed")) {
              // 未验证邮箱：检查冷却时间后重发验证邮件
              const { canSend, remainingSeconds } = checkEmailCooldown(authForm.email);
              if (canSend) {
                try {
                  await supabase.auth.resend({
                    type: "signup",
                    email: authForm.email,
                    options: {
                      emailRedirectTo: `${window.location.origin}/auth/confirm?next=/`,
                    },
                  });
                  setEmailCooldown(authForm.email);
                  alert(
                    isZh
                      ? "邮箱尚未验证，已重新发送验证邮件，请验证后再登录。"
                      : "Email not confirmed. We just sent another verification email. Please verify before signing in.",
                  );
                } catch (resendErr) {
                  console.error("Resend verify email failed", resendErr);
                  alert(
                    isZh
                      ? "邮箱尚未验证，请查看您的收件箱或稍后再试。"
                      : "Email not confirmed. Please check your inbox or try again later.",
                  );
                }
              } else {
                alert(
                  isZh
                    ? `邮箱尚未验证。${getCooldownMessage(remainingSeconds, isZh)}`
                    : `Email not confirmed. ${getCooldownMessage(remainingSeconds, isZh)}`,
                );
              }
              return;
            }
            console.error("[ChatProvider] EN login error", error);
            throw error;
          }
          console.info("[ChatProvider] EN login success", { userId: data.user?.id, email: data.user?.email });

          // 记录登录埋点
          if (data.user?.id) {
            fetch("/api/analytics/track", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: data.user.id,
                eventType: "session_start",
                eventData: { loginMethod: "email", source: "ChatProvider" },
              }),
            }).catch((err) => console.warn("[ChatProvider] Analytics track error:", err));
          }

          if (data.user) {
            // 检查邮箱是否已验证
            if (!data.user.email_confirmed_at) {
              console.warn("[ChatProvider] EN login: email not confirmed, signing out");
              await supabase.auth.signOut();
              // 检查冷却时间后重新发送验证邮件
              const { canSend, remainingSeconds } = checkEmailCooldown(authForm.email);
              if (canSend) {
                try {
                  await supabase.auth.resend({
                    type: "signup",
                    email: authForm.email,
                    options: {
                      emailRedirectTo: `${window.location.origin}/auth/confirm?next=/`,
                    },
                  });
                  setEmailCooldown(authForm.email);
                  alert(
                    isZh
                      ? "请先验证您的邮箱，我们已重新发送验证邮件。"
                      : "Please verify your email first. We've sent another verification email.",
                  );
                } catch (resendErr) {
                  console.error("Resend verify email failed", resendErr);
                  alert(
                    isZh
                      ? "请先验证您的邮箱。"
                      : "Please verify your email first.",
                  );
                }
              } else {
                alert(
                  isZh
                    ? `请先验证您的邮箱。${getCooldownMessage(remainingSeconds, isZh)}`
                    : `Please verify your email first. ${getCooldownMessage(remainingSeconds, isZh)}`,
                );
              }
              return;
            }

            const user = data.user;
            // 从服务器获取用户设置和订阅状态
            let hideAds = false;
            let serverIsPaid = false;
            let serverIsPro = false;
            try {
              const settingsRes = await fetch("/api/account/settings", { credentials: "include" });
              if (settingsRes.ok) {
                const settingsData = await settingsRes.json();
                hideAds = settingsData?.data?.hide_ads ?? false;
                if (settingsData?.data?.subscription) {
                  serverIsPaid = settingsData.data.subscription.hasActiveSubscription ?? false;
                  serverIsPro = settingsData.data.subscription.isPro ?? false;
                }
              }
            } catch (e) {
              console.error("[handleAuthSubmit] Failed to load settings:", e);
            }

            const mappedUser: AppUser = {
              id: user.id,
              email: user.email || "",
              name:
                (user.user_metadata as any)?.full_name ||
                user.email?.split("@")[0] ||
                "User",
              avatar: (user.user_metadata as any)?.avatar_url || undefined, // 用户头像
              isPro: serverIsPro,
              isPaid: serverIsPaid,
              settings: {
                theme: "light",
                language: "en",
                notifications: true,
                soundEnabled: true,
                autoSave: true,
                hideAds: hideAds,
              },
            };
          setAppUser(mappedUser);
          setIsLoggedIn(true);
          setShowAuthDialog(false);
          appUserRef.current = mappedUser;
          void loadConversations(mappedUser);
        }
      }
      }
      setAuthForm({ email: "", password: "", name: "" });
    } catch (err) {
      console.error("Auth error", err);
      alert(
        isZh
          ? `操作失败：${err instanceof Error ? err.message : "未知错误"}`
          : `Authentication failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  };

  const handleGoogleAuth = async () => {
      if (isDomestic) {
      alert("当前语言下仅支持邮箱登录/注册");
      return;
    }
    try {
      // 使用 Server Action 启动 OAuth（Supabase 官方推荐方式）
      await signInWithGoogle();
    } catch (err) {
      // Server Action 中的 redirect() 会抛出 NEXT_REDIRECT 错误，这是正常行为
      if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) {
        return;
      }
      console.error("Google OAuth error", err);
      alert(
        isZh ? "Google 登录失败，请稍后再试" : "Google sign-in failed. Please try again.",
      );
    }
  };

  const handleWechatAuth = async () => {
    if (!isDomestic) {
      alert(isZh ? "当前为国际版，请使用 Google 登录" : "WeChat is only available in CN build");
      return;
    }
    try {
      // 首先检测是否真正在小程序环境中（通过 userAgent 或全局标识）
      const ua = navigator.userAgent.toLowerCase();
      const isInMiniProgram = ua.includes("miniprogram") ||
                               (window as any).__wxjs_environment === "miniprogram";

      // 只有确认在小程序环境中，才尝试使用原生登录
      if (isInMiniProgram) {
        const wx = (window as any).wx;
        const mp = wx?.miniProgram;

        if (mp && typeof mp.navigateTo === "function") {
          console.log("[ChatProvider] In MiniProgram environment, using native login");
          const returnUrl = window.location.href;
          const loginUrl = `/pages/webshell/login?returnUrl=${encodeURIComponent(returnUrl)}`;
          mp.navigateTo({ url: loginUrl });
          return;
        }
      }

      // PC/手机浏览器环境，使用扫码登录
      console.log("[ChatProvider] Not in MiniProgram, using QR code login");
      const nextPath = typeof window !== "undefined" ? window.location.pathname : "/";
      const res = await fetch(
        `/api/auth/wechat/qrcode${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`,
      );
      const data = await res.json();
      if (!res.ok || !data.qrcodeUrl) {
        throw new Error(data.error || (isZh ? "微信登录失败" : "WeChat login failed"));
      }
      window.location.href = data.qrcodeUrl as string;
    } catch (err) {
      console.error("WeChat OAuth error", err);
      alert(isZh ? "微信登录失败，请稍后再试" : "WeChat sign-in failed. Please try again.");
    }
  };

  const handleLogout = async () => {
    if(false) console.log("handleLogout called"); // Debug log
    if (isDomestic) {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } else {
      await supabase.auth.signOut();
    }
    setAppUser(null);
    setCurrentPlan(null);

    // Clear all user-specific data
    Object.keys(localStorage).forEach((key) => {
      if (
        key.startsWith("morngpt_chats_") ||
        key.startsWith("morngpt_bookmarks_")
      ) {
        localStorage.removeItem(key);
      }
    });
    localStorage.removeItem("morngpt_current_plan");
    localStorage.removeItem("morngpt_current_plan_exp");
    localStorage.removeItem("morngpt_user");

    setChatSessions([]);
    setCurrentChatId("");
    setMessages([]);
    setPromptHistory([]);
    setBookmarkedMessages([]);
    setCurrentPlan(null);
    hasLoadedConversationsRef.current = false;
    loadConversationsPendingRef.current = false;
    loadedConversationsForUserRef.current = null;
    try {
      localStorage.removeItem("morngpt_user");
      localStorage.removeItem("morngpt_current_plan");
    } catch (e) {
      // ignore
    }

    // Close any open dialogs
    setShowSettingsDialog(false);
    setShowUpgradeDialog(false);
    setShowPaymentDialog(false);

    alert(isZh ? "已退出登录" : "Successfully logged out!");
  };

  const handleUpgradeClick = (plan: (typeof pricingPlans)[0]) => {
    // 旧逻辑：打开二次支付弹窗。现改为在套餐弹窗内直接支付，仅记录选中套餐。
    setSelectedPlan(plan);
    setSelectedPlanInDialog(plan);
    setShowUpgradeDialog(true);
  };

  const handlePaymentModalUpgrade = () => {
    setShowPaymentModal(false);
    setPaymentError(null);
    // Redirect to upgrade page or show upgrade options
    setShowUpgradeDialog(true);
  };

  const handlePaymentModalClose = () => {
    setShowPaymentModal(false);
    setPaymentError(null);
  };

  // Test function to simulate token limit exceeded
  const testTokenLimit = () => {
    setPaymentError({
      currentUsage: 950,
      limit: 1000,
      modelName: "GPT-3.5 Turbo",
    });
    setShowPaymentModal(true);
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser || !selectedPlan) return;

    if (selectedPaymentMethod === "paypal") {
      // PayPal checkout (international + domestic)
      (async () => {
        try {
          const res = await fetch("/api/payment/paypal/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              planName: selectedPlan.name,
              billingPeriod,
              userId: appUser.id,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.approvalUrl) {
            throw new Error(data.error || "Failed to create PayPal order");
          }
          // redirect to PayPal
          window.location.href = data.approvalUrl as string;
        } catch (err) {
          console.error("PayPal create order error", err);
          alert(
            isZh
              ? "创建 PayPal 支付失败，请稍后再试"
              : "Failed to start PayPal checkout. Please try again.",
          );
        }
      })();
      return;
    }

    // fallback: simulate success for non-PayPal methods (still unsupported)
    const updatedUser = { ...appUser, isPro: true, isPaid: true };
    setAppUser(updatedUser);
    setCurrentPlan(selectedPlan.name as "Basic" | "Pro" | "Enterprise");
    localStorage.setItem("morngpt_user", JSON.stringify(updatedUser));
    localStorage.setItem("morngpt_current_plan", selectedPlan.name);
    setShowPaymentDialog(false);

    if (selectedPaidModel) {
      handleModelChange("external", undefined, selectedPaidModel.name);
      setSelectedPaidModel(null);
      alert(
        `Successfully upgraded to ${selectedPlan.name} plan! You now have access to ${selectedPaidModel.name} and other premium models.`
      );
    } else {
      alert(
        `Successfully upgraded to ${selectedPlan.name} plan! Welcome to MornGPT Pro!`
      );
    }
  };

  const updateUserSettings = async (newSettings: Partial<AppUser["settings"]>) => {
    if (appUser) {
      const updatedUser = {
        ...appUser,
        settings: {
          theme: "light" as const,
          language: "en",
          notifications: true,
          soundEnabled: true,
          autoSave: true,
          sendHotkey: "enter" as const,
          shortcutsEnabled: true,
          adsEnabled: false,
          hideAds: false, // 默认不隐藏广告，订阅用户需手动开启
          ...appUser.settings,
          ...newSettings,
        },
      };
      setAppUser(updatedUser);
      localStorage.setItem("morngpt_user", JSON.stringify(updatedUser));

      // 如果更新了 hideAds 设置，同步到数据库
      if (typeof newSettings.hideAds === "boolean") {
        try {
          const res = await fetch("/api/account/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ hideAds: newSettings.hideAds }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            console.error("[updateUserSettings] Failed to sync hideAds:", data.error);
            // 如果是权限错误（Free用户尝试开启），回滚本地状态
            if (res.status === 403) {
              setAppUser((prev) =>
                prev
                  ? {
                      ...prev,
                      settings: { ...prev.settings, hideAds: false },
                    }
                  : prev
              );
              toast.error(
                isZh
                  ? "仅订阅用户可开启去除广告功能"
                  : "Only subscribed users can enable hide ads"
              );
            }
          }
        } catch (err) {
          console.error("[updateUserSettings] hideAds sync error:", err);
        }
      }
    }
  };

  const confirmLogout = () => {
    if(false) console.log("confirmLogout called"); // Debug log
    setShowLogoutConfirmDialog(true);
  };

  const confirmDeleteAccount = () => {
    setShowDeleteAccountDialog(true);
  };

  const deleteUserAccount = async () => {
    if (isDeletingAccount) return;
    setIsDeletingAccount(true);

    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail =
          body?.details?.join?.(", ") ||
          (Array.isArray(body?.details) ? body.details.join(", ") : body?.hint);
        throw new Error(body?.error || detail || "Delete failed");
      }

      // Sign out locally and clear cached data
      await supabase.auth.signOut();
      localStorage.clear();
      setAppUser(null);
      setIsLoggedIn(false);
      setShowDeleteAccountDialog(false);

      // Reset in-memory chat state to a minimal welcome message to avoid dangling refs
      setChatSessions([
        {
          id: "1",
          title: isZh ? "欢迎使用 MornGPT" : "Welcome to MornGPT",
          messages: [],
          model: "General",
          modelType: "general",
          category: "general",
          lastUpdated: new Date(),
          isModelLocked: false,
        },
      ]);
      setCurrentChatId("1");
      setMessages([]);
      setPromptHistory([]);
      setBookmarkedMessages([]);

      alert(isZh ? "账户已删除" : "Account deleted successfully");
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } catch (err: any) {
      console.error("Failed to delete account", err);
      alert(
        isZh
          ? `删除失败：${err?.message || "未知错误"}`
          : `Failed to delete account: ${err?.message || "Unknown error"}`
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const startEditingProfile = () => {
    if (!appUser) return;
    setUserProfileForm({
      name: appUser.name,
      email: appUser.email || "",
      bio: appUser.bio || "",
    });
    setIsEditingProfile(true);
  };

  const saveUserProfile = async () => {
    if (!appUser) return;

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const updatedUser = {
        ...appUser,
        name: userProfileForm.name,
        email: userProfileForm.email,
        bio: userProfileForm.bio,
      };

      setAppUser(updatedUser);
      localStorage.setItem("morngpt_user", JSON.stringify(updatedUser));
      setIsEditingProfile(false);
    } catch (error) {
      console.error("Failed to save profile:", error);
    }
  };

  const cancelEditingProfile = () => {
    setIsEditingProfile(false);
    setUserProfileForm({
      name: "",
      email: "",
      bio: "",
    });
  };

  const stopStreaming = () => {
    // snapshot current streaming message
    let streamingMsg: Message | undefined;
    setMessages((prev) => {
      const updated = prev.map((msg) => {
        if (msg.isStreaming && !streamingMsg) {
          streamingMsg = msg;
          return {
            ...msg,
            isStreaming: false,
            content:
              msg.content +
              (selectedLanguage === "zh" ? "\n\n[已停止]" : "\n\n[Stopped]"),
          };
        }
        return msg;
      });
      return updated;
    });

    // Persist the partial assistant message if available
    if (streamingMsg && streamingMsg.content && currentChatId) {
      fetch(`/api/conversations/${currentChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          role: "assistant",
          content: streamingMsg.content,
          client_id: streamingMsg.id,
        }),
      }).catch((err) =>
        console.error("Failed to persist stopped assistant message", err),
      );
    }

    if (streamingController) {
      streamingController.abort();
      setStreamingController(null);
    }
    setIsStreaming(false);
    setIsLoading(false);
  };

  // File handling functions moved to utils

  // Location functions
  async function getCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser");
      setTimeout(() => setLocationError(""), 5000);
      return;
    }

    setIsGettingLocation(true);
    setLocationError("");

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          });
        }
      );

      const { latitude, longitude } = position.coords;

      // Try to get address from coordinates using reverse geocoding
      let address = "";
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
        );
        const data = await response.json();
        if (data.display_name) {
          address = data.display_name;
        }
      } catch (error) {
        if(false) console.log("Could not get address, using coordinates only");
      }

      const location = { latitude, longitude, address };
      setCurrentLocation(location);

      // Add location to prompt
      const locationText = address
        ? `📍 **Location:** ${address}\n🌐 **Coordinates:** ${latitude.toFixed(
            6
          )}, ${longitude.toFixed(6)}`
        : `🌐 **Coordinates:** ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

      setPrompt((prev) => prev + (prev ? "\n\n" : "") + locationText);
    } catch (error) {
      console.error("Location error:", error);
      let errorMessage = "Failed to get location";

      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage =
              "Location access denied. Please enable location permissions.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            break;
        }
      }

      setLocationError(errorMessage);
      setTimeout(() => setLocationError(""), 5000);
    } finally {
      setIsGettingLocation(false);
    }
  }

  const clearLocation = () => {
    setCurrentLocation(null);
    setLocationError("");
  };

  // Pro Voice/Video Chat Functions
  const MAX_TRIAL_ATTEMPTS = 3;

  const checkProAccess = (type: "voice" | "video") => {
    if (appUser?.isPro) return true;
    return proChatTrialCount[type] < MAX_TRIAL_ATTEMPTS;
  };

  const incrementTrialCount = (type: "voice" | "video") => {
    setProChatTrialCount((prev) => ({
      ...prev,
      [type]: prev[type] + 1,
    }));
  };

  const startProVoiceChat = async () => {
    if (!checkProAccess("voice")) {
      setProChatType("voice");
      // 直接打开正式的升级弹窗，避免先弹试用提示再弹套餐选择造成的双弹窗体验
      setShowUpgradeDialog(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setProVoiceChatStream(stream);
      setIsProVoiceChatActive(true);
      setProChatError("");

      if (!appUser?.isPro) {
        incrementTrialCount("voice");
      }

      scrollToInputArea(); // Auto-scroll when Pro voice chat starts

      // Simulate AI voice response
      setTimeout(() => {
        const aiResponse =
          "Hello! I'm your AI assistant. I can hear you clearly. How can I help you today?";
        const newMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: aiResponse,
          timestamp: new Date(),
          model: "Pro Voice Chat",
        };
        setMessages((prev) => [...prev, newMessage]);
      }, 2000);
    } catch (error) {
      setProChatError(getLocalizedText("proVoiceError"));
    }
  };

  const startProVideoChat = async () => {
    if (!checkProAccess("video")) {
      setProChatType("video");
      // 直接打开正式的升级弹窗，避免双重弹窗
      setShowUpgradeDialog(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      setProVideoChatStream(stream);
      setIsProVideoChatActive(true);
      setProChatError("");

      if (!appUser?.isPro) {
        incrementTrialCount("video");
      }

      // Simulate AI video response
      setTimeout(() => {
        const aiResponse =
          "Hello! I can see and hear you. This is a premium video chat experience. How can I assist you?";
        const newMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: aiResponse,
          timestamp: new Date(),
          model: "Pro Video Chat",
        };
        setMessages((prev) => [...prev, newMessage]);
      }, 2000);
    } catch (error) {
      setProChatError(getLocalizedText("proVideoError"));
    }
  };

  const stopProVoiceChat = () => {
    if (proVoiceChatStream) {
      proVoiceChatStream.getTracks().forEach((track) => track.stop());
      setProVoiceChatStream(null);
    }
    setIsProVoiceChatActive(false);
  };

  const stopProVideoChat = () => {
    if (proVideoChatStream) {
      proVideoChatStream.getTracks().forEach((track) => track.stop());
      setProVideoChatStream(null);
    }
    setIsProVideoChatActive(false);
  };

  const getTrialCountDisplay = (type: "voice" | "video") => {
    const remaining = MAX_TRIAL_ATTEMPTS - proChatTrialCount[type];
    return remaining > 0 ? `${remaining} trials left` : "No trials left";
  };

  // Handle text selection in textarea
  const handleTextSelection = useCallback(() => {
    if (textareaRef.current) {
      const selection = textareaRef.current.value.substring(
        textareaRef.current.selectionStart,
        textareaRef.current.selectionEnd
      );
      setSelectedText(selection);
    }
  }, [textareaRef, setSelectedText]);

  // Copy selected text
  const copySelectedText = useCallback(() => {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText);
      // Show toast notification
      const toast = document.createElement("div");
      toast.className =
        "fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full";
      toast.textContent = `${getLocalizedText("textCopied")}: ${
        selectedText.length
      } ${getLocalizedText("characters")}`;
      document.body.appendChild(toast);

      // Animate in
      setTimeout(() => {
        toast.classList.remove("translate-x-full");
      }, 100);

      // Remove after 3 seconds
      setTimeout(() => {
        toast.classList.add("translate-x-full");
        setTimeout(() => {
          document.body.removeChild(toast);
        }, 300);
      }, 3000);
    }
  }, [selectedText, getLocalizedText]);

  // Delete selected text
  const deleteSelectedText = useCallback(() => {
    if (textareaRef.current && selectedText) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newValue = prompt.substring(0, start) + prompt.substring(end);
      setPrompt(newValue);
      setSelectedText("");

      // Set cursor position after deletion
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(start, start);
          textareaRef.current.focus();
        }
      }, 0);

      // Show toast notification
      const toast = document.createElement("div");
      toast.className =
        "fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full";
      toast.textContent = `${getLocalizedText("textDeleted")}: ${
        selectedText.length
      } ${getLocalizedText("characters")}`;
      document.body.appendChild(toast);

      // Animate in
      setTimeout(() => {
        toast.classList.remove("translate-x-full");
      }, 100);

      // Remove after 3 seconds
      setTimeout(() => {
        toast.classList.add("translate-x-full");
        setTimeout(() => {
          document.body.removeChild(toast);
        }, 300);
      }, 3000);
    }
  }, [textareaRef, selectedText, prompt, setPrompt, setSelectedText, getLocalizedText]);

  // Sidebar resize functionality
  const handleSidebarResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    setStartX(e.clientX);
    setStartWidth(sidebarWidth);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  };

  const handleSidebarResizeMove = React.useCallback(
    (e: MouseEvent) => {
      if (!isResizingSidebar) return;

      const deltaX = e.clientX - startX;
      const newWidth = Math.max(200, Math.min(400, startWidth + deltaX));
      setSidebarWidth(newWidth);
    },
    [isResizingSidebar, startX, startWidth]
  );

  const handleSidebarResizeEnd = React.useCallback(() => {
    setIsResizingSidebar(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  React.useEffect(() => {
    if (isResizingSidebar) {
      document.addEventListener("mousemove", handleSidebarResizeMove);
      document.addEventListener("mouseup", handleSidebarResizeEnd);
      return () => {
        document.removeEventListener("mousemove", handleSidebarResizeMove);
        document.removeEventListener("mouseup", handleSidebarResizeEnd);
      };
    }
  }, [isResizingSidebar, handleSidebarResizeMove, handleSidebarResizeEnd]);

  const handleModelChange = (
    modelType: string,
    category?: string,
    model?: string
  ) => {
    // MornGPT expert models should use the same underlying model as General Model
    const isExpertModel = modelType === "morngpt";
    const isGeneral = modelType === "general";
    const fallbackModel = isGeneral ? GENERAL_MODEL_ID : defaultExternalModelId;
    const chosenModel = isExpertModel || isGeneral ? GENERAL_MODEL_ID : model || fallbackModel;
    // If current chat already locked, start a new chat with the chosen model
    if (currentChat && currentChat.isModelLocked) {
      void createNewChat(category, modelType, chosenModel);
      setIsModelSelectorOpen(false);
      return;
    }

    setSelectedModelType(modelType);
    // Reset folder/category when leaving Expert(MornGPT)
    if (modelType === "morngpt") {
      if (category) setSelectedCategory(category);
    } else {
      setSelectedCategory("general");
    }
    setSelectedModel(chosenModel);
    setIsModelSelectorOpen(false);
  };

  async function createNewChat(
    category?: string,
    modelType?: string,
    model?: string
  ) {
    if (!appUser) {
      requireLogin();
      return;
    }

    // block creating another chat if current chat has no messages (except when list empty)
    const currentChat = chatSessions.find((c) => c.id === currentChatId);
    if (chatSessions.length > 0 && currentChat && currentChat.messages.length === 0) {
      alert(
        selectedLanguage === "zh"
          ? "请先在当前对话发送消息，再创建新的对话。"
          : "Please send a message in the current chat before creating a new one."
      );
      return;
    }

    const chosenModelType = modelType || "general";
    const chosenModel =
      chosenModelType === "general" || chosenModelType === "morngpt"
        ? GENERAL_MODEL_ID
        : model || defaultExternalModelId;
    const folderKey =
      chosenModelType === "general"
        ? "general"
        : chosenModelType === "morngpt"
          ? "morngpt"
          : "external";
    // Use a temporary local ID; real ID will be created on first message send
    const newChatId = `local-${Date.now()}`;

    const newChat: ChatSession = {
      id: newChatId,
      title: getLocalizedText("newChat"),
      messages: [],
      model: chosenModel,
      modelType: chosenModelType,
      // Category is used by Expert(MornGPT) chats to store expert id (a/b/c...).
      category: chosenModelType === "morngpt" ? category || selectedCategory || "general" : "general",
      lastUpdated: new Date(),
      isModelLocked: false, // allow changing model before first message
    };
    setChatSessions((prev) => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    setMessages([]);

    setSelectedModelType(chosenModelType);
    setSelectedModel(chosenModel);
    setSelectedCategory(
      chosenModelType === "morngpt" ? category || selectedCategory || "general" : "general"
    );

    // Expand the folder for the new chat's category
    setExpandedFolders([folderKey]);
  }

  const selectChat = (chatId: string) => {
    setCurrentChatId(chatId);
    currentChatIdRef.current = chatId;
    const chat = chatSessions.find((c) => c.id === chatId);
    if (chat) {
      // Immediately reflect locally stored messages (may be empty) before fetch
          setMessages(chat.messages || []);
          // Load messages only when user selects
          void loadMessagesForConversation(chatId);
          setSelectedModelType(chat.modelType || "general");
          setSelectedModel(
            chat.model ||
              (chat.modelType === "general" || chat.modelType === "morngpt"
                ? GENERAL_MODEL_ID
                : defaultExternalModelId)
          );
      setSelectedCategory(
        (chat.modelType || "").toLowerCase() === "morngpt"
          ? chat.category || "general"
          : "general"
      );

      // Auto-collapse all folders except the chat's category
      const folderKey =
        chat.modelType === "general"
          ? "general"
          : chat.modelType === "morngpt"
            ? "morngpt"
            : "external";
      setExpandedFolders([folderKey]);
    }
  };

  async function deleteChat(chatId: string) {
    const isLocalChat = chatId.startsWith("local-");

    try {
      if (!appUser) {
        // guests are not allowed to manage conversations; prompt login
        requireLogin();
        return;
      }

      // Local-only conversations (free quota) are never persisted; skip remote delete
      if (isLocalChat) {
        // no remote call needed
      } else if (isDomestic) {
        const res = await fetch(`/api/conversations/${chatId}`, {
          method: "DELETE",
          credentials: "include",
        });
        // 404: conversation may already be deleted or belong to another session/user; treat as idempotent success.
        if (res.status === 404) {
          // no-op
        } else if (!res.ok) {
          const msg = await res.text();
          throw new Error(`Delete failed ${res.status}: ${msg || "unknown"}`);
        }
      } else {
        const { error } = await supabase
          .from("conversations")
          .delete()
          .eq("id", chatId)
          .eq("user_id", appUser.id);
        if (error) throw error;
      }
    } catch (err) {
      console.error("Failed to delete conversation", err);
      alert(
        isZh
          ? "删除对话失败，请稍后再试。"
          : "Failed to delete conversation. Please try again."
      );
    }

    // Remove locally and move off the deleted chat to avoid stale fetches
    const updatedChats = chatSessions.filter((chat) => chat.id !== chatId);
    setChatSessions(updatedChats);

      if (currentChatId === chatId) {
        if (updatedChats.length > 0) {
          const nextChat = updatedChats[0];
          setCurrentChatId(nextChat.id);
          currentChatIdRef.current = nextChat.id;
          setSelectedModelType(nextChat.modelType || "external");
          setSelectedModel(
            nextChat.model ||
              (nextChat.modelType === "general" || nextChat.modelType === "morngpt"
                ? GENERAL_MODEL_ID
                : defaultExternalModelId)
          );
        setSelectedCategory(
          (nextChat.modelType || "").toLowerCase() === "morngpt"
            ? nextChat.category || "general"
            : "general"
        );
        const folderKey =
          nextChat.modelType === "general"
            ? "general"
            : nextChat.modelType === "morngpt"
              ? "morngpt"
              : "external";
        setExpandedFolders([folderKey]);
        setMessages(nextChat.messages || []);
        void loadMessagesForConversation(nextChat.id);
      } else {
        // No chats left: clear selection; user can start a fresh one
        setCurrentChatId("");
        currentChatIdRef.current = "";
        setMessages([]);
      }
    }
  }

  const startEditingTitle = (chatId: string, currentTitle: string) => {
    setEditingChatId(chatId);
    setEditingTitle(currentTitle);
  };

  const saveTitle = async () => {
    setChatSessions((prev) =>
      prev.map((chat) =>
        chat.id === editingChatId ? { ...chat, title: editingTitle } : chat
      )
    );
    if (appUser && editingChatId) {
      try {
        if (isDomestic) {
          const res = await fetch(`/api/conversations/${editingChatId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ title: editingTitle }),
          });
          if (!res.ok) {
            const msg = await res.text();
            throw new Error(msg || `HTTP ${res.status}`);
          }
        } else {
          await supabase
            .from("conversations")
            .update({ title: editingTitle })
            .eq("id", editingChatId)
            .eq("user_id", appUser.id);
        }
      } catch (err) {
        console.error("Failed to update title", err);
      }
    }
    setEditingChatId("");
    setEditingTitle("");
  };

  const cancelEditing = () => {
    setEditingChatId("");
    setEditingTitle("");
  };

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) =>
      prev.includes(folder)
        ? prev.filter((f) => f !== folder)
        : [...prev, folder]
    );
  };

  const filteredChats = chatSessions.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFolderKeyForChat = (chat: ChatSession): "general" | "morngpt" | "external" => {
    const modelTypeLower = (chat.modelType || "").toLowerCase();
    if (modelTypeLower === "morngpt") return "morngpt";
    if (modelTypeLower === "general") return "general";
    if (!modelTypeLower) {
      const isGeneral = (chat.model || "").toLowerCase() === GENERAL_MODEL_ID.toLowerCase();
      return isGeneral ? "general" : "external";
    }
    return "external";
  };

  const groupedChats = filteredChats.reduce((acc, chat) => {
    const folderKey = getFolderKeyForChat(chat);
    if (!acc[folderKey]) {
      acc[folderKey] = [];
    }
    acc[folderKey].push(chat);
    return acc;
  }, {} as Record<string, ChatSession[]>);

  const currentChat = chatSessions.find((c) => c.id === currentChatId);
  const isModelLocked = currentChat ? currentChat.isModelLocked !== false : false;

  function handleQuickAction(action: string) {
    let promptText = "";
    const isZh = (selectedLanguage || currentLanguage) === "zh";
    switch (action) {
      case "deep-thinking":
        promptText = isZh
          ? "请用多轮深度思考、多模型协作分析："
          : "Use deep thinking and multiple AI models to analyze: ";
        setSelectedModelType("morngpt");
        setSelectedCategory("h");
        break;
      case "creative":
        promptText = isZh
          ? "请为下列主题生成有创意的想法："
          : "Generate creative and innovative ideas for: ";
        setSelectedModelType("morngpt");
        setSelectedCategory("w");
        break;
      case "analyze":
        promptText = isZh
          ? "请针对以下内容提供详细分析与见解："
          : "Provide detailed analysis and insights about: ";
        break;
      case "solve":
        promptText = isZh
          ? "请分步骤帮我解决这个问题："
          : "Help me solve this problem step by step: ";
        break;
      default:
        promptText = action + ": ";
    }
    setPrompt(promptText);
  }

  const handlePromptSelect = (selectedPrompt: string) => {
    setPrompt(selectedPrompt);
    setIsPromptHistoryOpen(false);
  };

  const jumpToMessage = (messageId: string) => {
    const highlight = () => {
      setJumpToScrollPosition(Date.now());
      setTimeout(() => setJumpToScrollPosition(0), 2000);
    };

    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
      highlight();
      setIsAskGPTOpen(false);
      return;
    }

    // Virtualized list fallback: approximate scroll to the item position
    // 移动端访客模式也使用 messages（与 chatSessions 一致）
    const list =
      (appUser || mobileGuestTrial.isEnabled) && currentChatId
        ? messages
        : guestChatSessions.find((c) => c.id === currentChatId)?.messages || [];
    const targetIndex = list.findIndex((m) => m.id === messageId);

    if (targetIndex >= 0 && scrollAreaRef.current) {
      const approxOffset = Math.max(0, targetIndex * 200 - 120);
      scrollAreaRef.current.scrollTo({ top: approxOffset, behavior: "smooth" });
      setTimeout(() => {
        const el = document.getElementById(`message-${messageId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          highlight();
        }
      }, 140);
    }

    setIsAskGPTOpen(false);
  };

  const jumpToBookmark = (bookmark: BookmarkedMessage) => {
    // Switch to the correct chat if needed
    if (bookmark.chatId !== currentChatId) {
      selectChat(bookmark.chatId);
    }
    // Jump to the bookmarked message
    setTimeout(() => jumpToMessage(bookmark.messageId), 100);
    setIsAskGPTOpen(false);
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  // Search functionality functions
  const getFilteredBookmarks = () => {
    let filtered = bookmarkedMessages;

    // If search query is provided, search across all folders
    if (bookmarkSearchQuery.trim()) {
      const query = bookmarkSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (bookmark) =>
          bookmark.customName?.toLowerCase().includes(query) ||
          bookmark.title.toLowerCase().includes(query) ||
          bookmark.content.toLowerCase().includes(query) ||
          // Search in folder names too
          bookmarkFolders
            .find((folder) => folder.id === bookmark.folder)
            ?.name.toLowerCase()
            .includes(query)
      );
    } else {
      // If no search query, filter by selected folder
      filtered = filtered.filter(
        (bookmark) =>
          bookmark.folder === selectedBookmarkFolder || !bookmark.folder
      );
    }

    return filtered;
  };

  const getFilteredPrompts = () => {
    if (!promptSearchQuery.trim()) return promptHistory;
    const query = promptSearchQuery.toLowerCase();
    return promptHistory.filter((prompt) =>
      prompt.toLowerCase().includes(query)
    );
  };

  const getFilteredMessages = () => {
    if (!messageSearchQuery.trim()) return messages;
    const query = messageSearchQuery.toLowerCase();
    return messages.filter(
      (message) =>
        message.content.toLowerCase().includes(query) ||
        message.role.toLowerCase().includes(query)
    );
  };

  // Download helper functions - 加载 releases
  useEffect(() => {
    if (!showDownloadSection) return;

    const controller = new AbortController();
    let isCanceled = false;

    const loadReleases = async () => {
      setIsLoadingReleases(true);
      try {
        const res = await fetch(`/api/releases/active?isDomestic=${isDomestic}`, {
          signal: controller.signal,
        });

        if (!res.ok) return;

        const data = await res.json();
        if (!isCanceled && data.success && Array.isArray(data.data)) {
          setReleases(data.data);
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        console.error("Failed to load releases:", err);
      } finally {
        if (!isCanceled) {
          setIsLoadingReleases(false);
        }
      }
    };

    loadReleases();

    return () => {
      isCanceled = true;
      controller.abort();
    };
  }, [showDownloadSection, isDomestic, setIsLoadingReleases, setReleases]);

  // Download helper functions
  const handleDownload = () => {
    if (!selectedPlatform) return;

    // 首先尝试从动态 releases 中获取 URL
    const matchedRelease = releases.find((r) => {
      if (r.platform !== selectedPlatform.platform) return false;
      // 如果有 variant，需要匹配
      if (selectedPlatform.variant) {
        return r.variant === selectedPlatform.variant;
      }
      // 没有 variant 的情况，匹配无 variant 的记录或默认记录
      return !r.variant || r.variant === "default";
    });

    let url: string | undefined = matchedRelease?.file_url;

    // 如果没有找到动态 URL，使用硬编码的备用 URL（浏览器扩展和应用商店链接）
    if (!url) {
      const fallbackUrls: Record<string, string | Record<string, string>> = {
        ios: "https://apps.apple.com/app/morngpt",
        android: "https://play.google.com/store/apps/details?id=com.morngpt.app",
        chrome: "https://chrome.google.com/webstore/detail/morngpt",
        firefox: "https://addons.mozilla.org/en-US/firefox/addon/morngpt",
        edge: "https://microsoftedge.microsoft.com/addons/detail/morngpt",
        opera: "https://addons.opera.com/en/extensions/details/morngpt",
        safari: "https://apps.apple.com/app/morngpt-safari-extension",
        macos: {
          intel: "https://morngpt.com/downloads/morngpt-macos-intel.dmg",
          m: "https://morngpt.com/downloads/morngpt-macos-m.dmg",
        },
        windows: {
          x64: "https://morngpt.com/downloads/morngpt-windows-x64.exe",
          arm64: "https://morngpt.com/downloads/morngpt-windows-arm64.exe",
          x86: "https://morngpt.com/downloads/morngpt-windows-x86.exe",
        },
        linux: {
          deb: "https://morngpt.com/downloads/morngpt-linux.deb",
          appimage: "https://morngpt.com/downloads/morngpt-linux.AppImage",
          snap: "https://snapcraft.io/morngpt",
          flatpak: "https://flathub.org/apps/com.morngpt.app",
          aur: "https://aur.archlinux.org/packages/morngpt",
        },
      };

      if (selectedPlatform.platform === "macos" && selectedPlatform.variant) {
        const macosUrls = fallbackUrls.macos as Record<string, string>;
        url = macosUrls[selectedPlatform.variant];
      } else if (selectedPlatform.platform === "windows" && selectedPlatform.variant) {
        const windowsUrls = fallbackUrls.windows as Record<string, string>;
        url = windowsUrls[selectedPlatform.variant];
      } else if (selectedPlatform.platform === "linux" && selectedPlatform.variant) {
        const linuxUrls = fallbackUrls.linux as Record<string, string>;
        url = linuxUrls[selectedPlatform.variant];
      } else {
        url = fallbackUrls[selectedPlatform.platform] as string;
      }
    }

    if (url) {
      window.open(url, "_blank");
    }

    // Close the download dialog and reset selection
    setShowDownloadSection(false);
    setSelectedPlatform(null);
  };

  const handlePlatformSelect = (platform: string, variant?: string) => {
    // If clicking the same platform/variant, deselect it
    if (
      selectedPlatform?.platform === platform &&
      selectedPlatform?.variant === variant
    ) {
      setSelectedPlatform(null);
    } else {
      // Otherwise, select the new platform/variant
      setSelectedPlatform({ platform, variant });
    }
  };

  // const handleUpgradeFromAds = () => {
  //   setShowDownloadSection(false);
  //   setShowUpgradeDialog(true);
  // };

  // const handleSpecializedProductSelect = (
  //   product: (typeof specializedProducts)[0]
  // ) => {
  //   // Navigate to the product URL if available
  //   if (product.url) {
  //     window.open(product.url, "_blank");
  //     return;
  //   }

  //   // Fallback to creating a new chat if no URL
  //   const model = externalModels.find((m) => m.name === product.model);
  //   if (model) {
  //     createNewChat(product.category, "general", product.model);
  //     const newChatId = Date.now().toString();
  //     const newChat: ChatSession = {
  //       id: newChatId,
  //       title: `${product.name} - ${product.description}`,
  //       messages: [],
  //       model: product.model,
  //       modelType: "general",
  //       category: product.category,
  //       lastUpdated: new Date(),
  //       isModelLocked: false,
  //     };
  //     setChatSessions((prev) => [newChat, ...prev]);
  //     setCurrentChatId(newChatId);
  //   }
  // };

  // Helper function to check if the current key combination matches the hotkey setting
  // const checkHotkeyMatch = (e: React.KeyboardEvent, hotkey: string) => {
  //   switch (hotkey) {
  //     case "enter":
  //       return e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey;
  //     case "shift+enter":
  //       return e.key === "Enter" && e.shiftKey && !e.ctrlKey && !e.metaKey;
  //     case "ctrl+enter":
  //       return e.key === "Enter" && e.ctrlKey && !e.shiftKey && !e.metaKey;
  //     case "cmd+enter":
  //       return e.key === "Enter" && e.metaKey && !e.shiftKey && !e.ctrlKey;
  //     default:
  //       return false;
  //   }
  // };

  // Missing functions that need to be added
  const generateShareLink = async () => {
    if (!currentChatId || messages.length === 0) return;

    setIsGeneratingLink(true);
    try {
      const res = await fetch("/api/share/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          chatId: currentChatId,
          makePublic: makeDiscoverable,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShareLink(data.shareLink);
        setShareSecret(data.secret || "");
        setShowShareDialog(true);
      } else {
        alert(data.error || (selectedLanguage === "zh" ? "生成分享链接失败" : "Failed to generate share link"));
      }
    } catch (err) {
      console.error("Share link generation error:", err);
      alert(selectedLanguage === "zh" ? "网络错误，请重试" : "Network error, please try again");
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // 监听 makeDiscoverable 变化,自动刷新分享链接
  useEffect(() => {
    // 只有在已经生成了分享链接的情况下才重新生成
    if (shareLink && showShareDialog) {
      generateShareLink();
    }
  }, [makeDiscoverable]);

  const copyShareLink = () => {
    copyToClipboard(shareLink);
  };

  const copyShareSecret = () => {
    copyToClipboard(shareSecret);
  };

  const regenerateSecretKey = async () => {
    if (!shareLink) return;
    await generateShareLink();
  };

  const shareToSocialMedia = (platform: string) => {
    const text = selectedLanguage === "zh"
      ? `查看我的 AI 对话`
      : `Check out my AI conversation`;
    const url = shareLink;

    const shareUrls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      reddit: `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
      email: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`,
    };

    const shareUrl = shareUrls[platform];
    if (shareUrl) {
      window.open(shareUrl, "_blank");
    }
  };

  const handleResetCancel = () => {
    // Implementation for reset cancel
    if(false) console.log("handleResetCancel called");
  };

  const handleResetConfirm = () => {
    // Implementation for reset confirm
    if(false) console.log("handleResetConfirm called");
  };

  const showResetConfirmation = () => {
    // Implementation for showing reset confirmation
    if(false) console.log("showResetConfirmation called");
  };

  const handleUpgradeFromAds = () => {
    // 关闭下载弹窗，打开订阅弹窗
    setShowDownloadSection(false);
    setShowUpgradeDialog(true);
  };

  const handleSpecializedProductSelect = () => {
    // Implementation for specialized product select
    if(false) console.log("handleSpecializedProductSelect called");
  };

  const freeQuotaRemaining = useMemo(() => {
    const planLower = (currentPlan || appUser?.plan || "").toLowerCase?.() || "";
    if (!appUser || planLower === "basic" || planLower === "pro" || planLower === "enterprise") return null;
    const today = getToday();
    const used = freeQuotaDate === today ? freeQuotaUsed : 0;
    const limit = freeQuotaLimit || FREE_DAILY_LIMIT;
    return Math.max(0, limit - used);
  }, [appUser, currentPlan, freeQuotaDate, freeQuotaUsed, freeQuotaLimit]);

  const basicQuotaRemaining = useMemo(() => {
    const planLower = (currentPlan || appUser?.plan || "").toLowerCase?.() || "";
    if (!appUser || (planLower !== "basic" && planLower !== "pro")) return null;
    const today = getToday();
    const used =
      planLower === "pro"
        ? proQuotaDate === today ? proQuotaUsed : 0
        : basicQuotaDate === today ? basicQuotaUsed : 0;
    const limit =
      planLower === "pro"
        ? proQuotaLimit || PRO_DAILY_LIMIT
        : basicQuotaLimit || BASIC_DAILY_LIMIT;
    return Math.max(0, limit - used);
  }, [appUser, currentPlan, basicQuotaLimit, basicQuotaUsed, basicQuotaDate, proQuotaLimit, proQuotaUsed, proQuotaDate]);

  const enterpriseQuotaRemaining = useMemo(() => {
    const planLower = (currentPlan || appUser?.plan || "").toLowerCase?.() || "";
    if (!appUser || planLower !== "enterprise") return null;
    const today = getToday();
    const used = enterpriseQuotaDate === today ? enterpriseQuotaUsed : 0;
    const limit = enterpriseQuotaLimit || ENTERPRISE_DAILY_LIMIT;
    return Math.max(0, limit - used);
  }, [appUser, currentPlan, enterpriseQuotaDate, enterpriseQuotaLimit, enterpriseQuotaUsed]);

  const isUnlimitedPlan =
    !!appUser &&
    ((currentPlan || appUser?.plan || "").toLowerCase?.() === "unlimited");

  const downloadConversation = useCallback(
    (chatId: string, title: string, messages: Message[]) => {
      const lines = messages
        .map((m) => {
          const ts =
            m.timestamp instanceof Date
              ? m.timestamp.toISOString()
              : new Date(m.timestamp).toISOString();
          return `[${ts}] ${m.role.toUpperCase()}: ${m.content}`;
        })
        .join("\n\n");
      const blob = new Blob([lines], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "conversation"}-${chatId}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    []
  );

  const exportChat = useCallback(
    async (chatId: string) => {
      const chat =
        chatSessions.find((c) => c.id === chatId) ||
        guestChatSessions.find((c) => c.id === chatId);
      if (!chat) return;

      let messagesToExport = chat.messages;

      // If no messages cached, try fetching (paid users only)
      if ((!messagesToExport || messagesToExport.length === 0) && appUser) {
        try {
          const res = await fetch(`/api/conversations/${chatId}/messages`, {
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            messagesToExport =
              data?.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: new Date(m.created_at),
              })) || [];
          }
        } catch (err) {
          console.error("Failed to fetch messages for export", err);
        }
      }

      if (!messagesToExport || messagesToExport.length === 0) {
        alert("No messages to export.");
        return;
      }

      downloadConversation(chatId, chat.title || "conversation", messagesToExport);
    },
    [chatSessions, guestChatSessions, appUser, downloadConversation]
  );

  // Handle message submission
  const handleSubmit = useCallback(async () => {
    // 调试日志
    console.log("[ChatProvider.handleSubmit] called", {
      hasAppUser: !!appUser,
      mobileGuestEnabled: mobileGuestTrial.isEnabled,
      hasTrialRemaining: mobileGuestTrial.hasTrialRemaining(),
      remainingTrials: mobileGuestTrial.getRemainingTrials(),
      selectedModelType,
      prompt: prompt?.substring(0, 50),
    });

    // 移动端访客试用逻辑（仅国内版移动端生效）
    if (!appUser && mobileGuestTrial.isEnabled) {
      // 检查是否还有试用次数
      if (mobileGuestTrial.hasTrialRemaining()) {
        console.log("[ChatProvider.handleSubmit] Guest mode: proceeding with trial");
        // 强制使用 General Model
        if (selectedModelType !== "general") {
          setSelectedModelType("general");
        }
        // 消耗一次试用次数
        mobileGuestTrial.consumeTrial();
        // 继续发送消息
        await handleMessageSubmit();

        // 检查是否用完试用次数，提示用户
        const remaining = mobileGuestTrial.getRemainingTrials();
        if (remaining <= 0) {
          // 试用次数用完，延迟弹出登录弹窗
          setTimeout(() => {
            toast.info(
              isZh
                ? "体验次数已用完，请登录以继续使用"
                : "Trial ended. Please sign in to continue.",
              { duration: 5000 }
            );
            setShowAuthDialog(true);
          }, 1500);
        } else if (remaining <= 3) {
          // 剩余3次时提示
          toast.info(
            isZh
              ? `剩余 ${remaining} 次免费体验`
              : `${remaining} free trials remaining`,
            { duration: 3000 }
          );
        }
        return;
      } else {
        // 没有试用次数了，弹出登录弹窗
        toast.info(
          isZh
            ? "体验次数已用完，请登录以继续使用"
            : "Trial ended. Please sign in to continue.",
          { duration: 5000 }
        );
        setShowAuthDialog(true);
        return;
      }
    }

    // 非移动端或已登录用户的原有逻辑
    if (!appUser) {
      setShowAuthDialog(true);
      return;
    }
    await handleMessageSubmit();
  }, [appUser, handleMessageSubmit, setShowAuthDialog, mobileGuestTrial, selectedModelType, setSelectedModelType, isZh, prompt]);

  // 移动端访客模式也使用 chatSessions（与 useMessageSubmission 一致）
  const activeChat =
    (appUser || mobileGuestTrial.isEnabled) && currentChatId
      ? chatSessions.find((c) => c.id === currentChatId)
      : guestChatSessions.find((c) => c.id === currentChatId);
  const activeChatId = activeChat?.id;

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!activeChatId) return;

      // Guest or local unsynced chat：仅本地删除，不调接口
      const isLocalChat = activeChatId.startsWith("local-");
      // 移动端访客模式使用 chatSessions，非移动端访客使用 guestChatSessions
      const isGuestWithoutMobileTrial = !appUser && !mobileGuestTrial.isEnabled;
      if (isGuestWithoutMobileTrial || isLocalChat) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        if (isGuestWithoutMobileTrial) {
          setGuestChatSessions((prev) =>
            prev.map((c) =>
              c.id === activeChatId
                ? { ...c, messages: (c.messages || []).filter((m: any) => m.id !== messageId) }
                : c,
            ),
          );
        } else {
          // 移动端访客或登录用户的本地对话
          setChatSessions((prev) =>
            prev.map((c) =>
              c.id === activeChatId
                ? { ...c, messages: (c.messages || []).filter((m: any) => m.id !== messageId) }
                : c,
            ),
          );
        }
        return;
      }

      try {
        const res = await fetch(`/api/conversations/${activeChatId}/messages`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ messageId }),
        });
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(`Delete failed ${res.status}: ${msg}`);
        }
        // Optimistically remove locally after success
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        setChatSessions((prev) =>
          prev.map((c) =>
            c.id === activeChatId
              ? {
                  ...c,
                  messages: (c.messages || []).filter((m: any) => m.id !== messageId),
                  lastUpdated: new Date(),
                }
              : c,
          ),
        );
      } catch (err) {
        console.error("Failed to delete message", err);
        alert(
          selectedLanguage === "zh"
            ? "删除消息失败，请稍后再试。"
            : "Failed to delete message, please try again."
        );
      }
    },
    [activeChatId, appUser, selectedLanguage, setMessages, setChatSessions, setGuestChatSessions, mobileGuestTrial.isEnabled],
  );

  const sidebarProps = {
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarWidth,
    handleSidebarResizeStart,
    createNewChat,
    searchQuery,
    setSearchQuery,
    expandedFolders,
    toggleFolder,
    groupedChats,
    currentChatId,
    selectChat,
    editingChatId,
    setEditingChatId,
    editingTitle,
    setEditingTitle,
    saveTitle,
    cancelEditing,
    deleteChat,
    exportChat,
    setShowShareDialog,
    truncateText,
    appUser,
    updateUserSettings,
    showDownloadSection,
    setShowDownloadSection,
    handleSpecializedProductSelect,
    setIsResizing: setIsResizingSidebar,
    getLocalizedText,
    isSidebarLoading,
    showGlobalAds,
    setShowGlobalAds,
    setShowUpgradeDialog,
  };

  const headerProps = {
    currentChat: activeChat,
    appUser,
    isGeneratingLink,
    selectedLanguage,
    isDomestic,
    setSelectedLanguage,
    currentPlan,
    planExp: appUser?.planExp || null,
    appUserPlan: appUser?.plan || currentPlan || null,
    isUnlimitedPlan,
    prompt,
    detectLanguage,
    toggleTheme,
    isDarkMode,
    setShowSettingsDialog,
    confirmLogout,
    setShowAuthDialog,
    generateShareLink,
    getLocalizedText,
    messages,
    guestChatSessions,
    currentChatId,
    setShowUpgradeDialog,
    freeQuotaRemaining,
    freeQuotaLimit,
    basicQuotaRemaining,
    basicQuotaLimit,
    freePhotoRemaining,
    freePhotoLimit,
    freeVideoAudioRemaining,
    freeVideoAudioLimit,
    freeContextLimit,
    basicPhotoRemaining,
    basicPhotoLimit,
    basicVideoAudioRemaining,
    basicVideoAudioLimit,
    basicContextLimit,
    proQuotaRemaining:
      (appUser?.plan || currentPlan || "").toLowerCase?.() === "pro"
        ? Math.max(0, (proQuotaLimit || PRO_DAILY_LIMIT) - (proQuotaDate === getToday() ? proQuotaUsed : 0))
        : null,
    proQuotaLimit,
    proPhotoRemaining,
    proPhotoLimit,
    proVideoAudioRemaining,
    proVideoAudioLimit,
    proContextLimit,
    enterpriseQuotaRemaining:
      (appUser?.plan || currentPlan || "").toLowerCase?.() === "enterprise"
        ? Math.max(
            0,
            (enterpriseQuotaLimit || ENTERPRISE_DAILY_LIMIT) -
              (enterpriseQuotaDate === getToday() ? enterpriseQuotaUsed : 0),
          )
        : null,
    enterpriseQuotaLimit,
    enterprisePhotoRemaining,
    enterprisePhotoLimit,
    enterpriseVideoAudioRemaining,
    enterpriseVideoAudioLimit,
    enterpriseContextLimit,
    showGlobalAds,
    // 移动端访客试用信息
    mobileGuestTrialEnabled: mobileGuestTrial.isEnabled,
    mobileGuestTrialRemaining: mobileGuestTrial.getRemainingTrials(),
    mobileGuestTrialMax: mobileGuestTrial.maxRounds,
  };

  const planLowerForContextRaw = (currentPlan || appUser?.plan || "").toLowerCase?.() || "";
  // 以“是否有有效订阅”为准：过期订阅按 Free 处理（与服务端 plan_exp 逻辑一致）
  const planLowerForContext = appUser && !appUser.isPaid ? "free" : planLowerForContextRaw;
  const effectiveContextLimit =
    planLowerForContext === "basic"
      ? basicContextLimit ?? undefined
      : planLowerForContext === "pro"
        ? proContextLimit ?? undefined
        : planLowerForContext === "enterprise"
          ? enterpriseContextLimit ?? undefined
          : freeContextLimit ?? undefined;

  const chatInterfaceProps = {
    messages,
    appUser,
    guestChatSessions,
    currentChatId,
    contextLimit: effectiveContextLimit,
    setShowUpgradeDialog,
    selectedLanguage,
    jumpToScrollPosition,
    scrollAreaRef,
    messagesEndRef,
    isLoading,
    isConversationLoading,
    thinkingText,
    currentChat: activeChat,
    getLocalizedText,
    copyToClipboard,
    shareMessage,
    downloadMessage,
    isMessageBookmarked,
    bookmarkMessage,
    removeBookmark,
    setShowShareDialog,
    bookmarkedMessages,
    onDeleteMessage: handleDeleteMessage,
  };

  const inputAreaProps = {
    prompt,
    setPrompt,
    setShowUpgradeDialog,
    handleTextSelection,
    setTextareaHeight,
    selectedText,
    copySelectedText,
    deleteSelectedText,
    textareaRef,
    handleSubmit,
    isLoading,
    appUser,
    checkHotkeyMatch: (e: React.KeyboardEvent<HTMLTextAreaElement>, hotkey: string) => {
      if (hotkey === "enter") {
        return e.key === "Enter" && !e.shiftKey;
      } else if (hotkey === "ctrl-enter") {
        return (e.ctrlKey || e.metaKey) && e.key === "Enter";
      }
      return false;
    },
    handleQuickAction,
    getLocalizedText,
    uploadedFiles,
    setUploadedFiles,
    MAX_FILES: MAX_FILES_LIMIT,
    MAX_TOTAL_SIZE,
    handleFileUpload,
    isUploading,
    removeFile: removeAttachment,
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
    getSelectedModelDisplay: getSelectedModelDisplayLabel,
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
  };

  const modalProps = {
    showAuthDialog,
    setShowAuthDialog,
    authMode,
    setAuthMode,
    authForm,
    setAuthForm,
    showPassword,
    setShowPassword,
    handleAuth,
    handleGoogleAuth,
    handleWechatAuth,
    isMobile, // 传递移动端标识给 AuthDialog，用于隐藏微信登录按钮
    showSettingsDialog,
    setShowSettingsDialog,
    isEditingProfile,
    userProfileForm,
    setUserProfileForm,
    saveUserProfile,
    cancelEditingProfile,
    isDarkMode,
    setIsDarkMode,
    appUser,
    currentPlan,
    setShowUpgradeDialog,
    updateUserSettings,
    shortcutsEnabled,
    setShortcutsEnabled,
    setShowShortcutsHelp,
    showShortcutsHelp,
    showResetConfirmation,
    showUpgradeDialog,
    selectedPaidModel,
    billingPeriod,
    setBillingPeriod,
    pricingPlans,
    selectedPlanInDialog,
    setSelectedPlanInDialog,
    handleUpgradeClick,
    showProUpgradeDialog,
    setShowProUpgradeDialog,
    proChatType,
    proChatTrialCount,
    MAX_TRIAL_ATTEMPTS,
    showPaymentDialog,
    setShowPaymentDialog,
    selectedPlan,
    setSelectedPlan,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    handlePayment,
    showLogoutConfirmDialog,
    setShowLogoutConfirmDialog,
    handleLogout,
    showDeleteAccountDialog,
    setShowDeleteAccountDialog,
    isDeletingAccount,
    deleteUserAccount,
    setTheme,
    fontFamily,
    fontSize,
    handleFontFamilyChange,
    handleFontSizeChange,
    onLanguageChange: setSelectedLanguage,
    showPrivacyDialog,
    setShowPrivacyDialog,
    showBillingDialog,
    setShowBillingDialog,
    autoRenewEnabled,
    setAutoRenewEnabled,
    nextBillingDate,
    setNextBillingDate,
    showPaymentEditDialog,
    setShowPaymentEditDialog,
    paymentMethod,
    setPaymentMethod,
    showFontDialog,
    setShowFontDialog,
    showShortcutDialog,
    setShowShortcutDialog,
    showDownloadSection,
    setShowDownloadSection,
    selectedPlatform,
    handlePlatformSelect,
    handleDownload,
    handleUpgradeFromAds,
    showSecretConfirm,
    setShowSecretConfirm,
    shareSecret,
    shareLink,
    copyShareSecret,
    copyShareLink,
    showShareDialog,
    setShowShareDialog,
    isGeneratingLink,
    makeDiscoverable,
    setMakeDiscoverable,
    regenerateSecretKey,
    shareToSocialMedia,
    showRegistrationPrompt,
    setShowRegistrationPrompt,
    registrationPromptType,
    showDataCollectionNotice,
    setShowDataCollectionNotice,
    showResetConfirm,
    setShowResetConfirm,
    resetConfirmData,
    handleResetCancel,
    handleResetConfirm,
    showCreateFolderDialog,
    setShowCreateFolderDialog,
    newFolderName,
    setNewFolderName,
    newFolderColor,
    setNewFolderColor,
    createBookmarkFolder,
    showPaymentModal,
    handlePaymentModalClose,
    handlePaymentModalUpgrade,
    paymentError,
    // 覆盖对话确认相关
    replaceConversationState,
    cancelReplaceConversation,
    confirmReplaceConversation,
  };

  const contextValue: ChatUIContextValue = {
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarProps,
    headerProps,
    chatInterfaceProps,
    inputAreaProps,
    modalProps,
    ChatInterfaceComponent: ChatInterface,
    InputAreaComponent: InputArea,
  };

  return (
    <ChatUIContext.Provider value={contextValue}>
      {children}
    </ChatUIContext.Provider>
  );
}
