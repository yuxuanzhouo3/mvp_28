"use client";

/**
 * Copyright © 2025 Yuxuan Zhou. All rights reserved.
 *
 * This file is part of the MornGPT Homepage application.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Import types and constants
import {
  Message,
  ChatSession,
  AppUser,
  BookmarkedMessage,
  BookmarkFolder,
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
import { useLanguage } from "@/context/LanguageContext";
import { createLocalizedTextGetter } from "@/lib/localization";

const FREE_DAILY_LIMIT = (() => {
  const raw = process.env.NEXT_PUBLIC_FREE_DAILY_LIMIT || "10";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(1000, n); // safety clamp
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
    return (
      externalModels.find((m) => m.category === targetCategory)?.id ||
      externalModels[0]?.id ||
      "qwen3-max"
    );
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
  } = uiState;

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
  const [basicQuotaUsed, setBasicQuotaUsed] = useState<number>(0);
  const [basicQuotaLimit, setBasicQuotaLimit] = useState<number>(
    Number.parseInt(process.env.NEXT_PUBLIC_BASIC_MONTHLY_LIMIT || "100", 10) || 100
  );
  const [basicQuotaPeriod, setBasicQuotaPeriod] = useState<string>("");

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

      const fetchedMessages: Message[] =
        data?.map((m: any) => ({
          id: m.id,
          role: m.role as Message["role"],
          content: m.content,
          timestamp: new Date(m.created_at),
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

        const mapped: ChatSession[] =
          data?.map((c: any) => ({
            id: c.id,
            title: c.title || "New Chat",
            messages: [],
            model: c.model || defaultExternalModelId,
            modelType: "external",
            category: "general",
            lastUpdated: c.updated_at ? new Date(c.updated_at) : new Date(),
            isModelLocked: false, // allow model selection before messages load
          })) || [];

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
            setSelectedModel(current.model || defaultExternalModelId);
            setSelectedCategory(current.category || "general");
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
      if (isDomestic) {
        // 每次挂载都尝试同步，避免初次 401 后不再重试
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          const user = data.user;
          const planExp = user.metadata?.plan_exp || null;
          const mappedUser: AppUser = {
            id: user.id,
            email: user.email || "",
            name: user.name || user.email || "User",
            isPro: !!user.metadata?.pro,
            isPaid: !!user.metadata?.pro,
            plan: user.metadata?.plan || undefined,
            planExp: planExp || undefined,
          };
          setAppUser(mappedUser);
          setIsLoggedIn(true);
          if (mappedUser.plan) {
            setCurrentPlan(mappedUser.plan as "Basic" | "Pro" | "Enterprise");
            localStorage.setItem("morngpt_current_plan", mappedUser.plan);
            if (mappedUser.planExp) {
              localStorage.setItem("morngpt_current_plan_exp", mappedUser.planExp);
            }
          }
          await loadConversations(mappedUser);
        } else {
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
      } else {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) {
          console.error("Supabase session error", error);
          return;
        }
        if (data.session?.user) {
          const user = data.session.user;
          const mappedUser: AppUser = {
            id: user.id,
            email: user.email || "",
            name:
              (user.user_metadata as any)?.full_name ||
              user.email?.split("@")[0] ||
              "User",
            isPro: false,
            isPaid: false,
            plan: (user.user_metadata as any)?.plan,
            planExp: (user.user_metadata as any)?.plan_exp,
          };
          setAppUser(mappedUser);
          setIsLoggedIn(true);
          const planMeta = (user.user_metadata as any)?.plan;
          if (planMeta) {
            setCurrentPlan(planMeta as "Basic" | "Pro" | "Enterprise");
            localStorage.setItem("morngpt_current_plan", planMeta);
            const expMeta = (user.user_metadata as any)?.plan_exp;
            if (expMeta) {
              localStorage.setItem("morngpt_current_plan_exp", expMeta);
            }
          } else if (mappedUser.isPro) {
            setCurrentPlan("Pro");
          }
          await loadConversations(mappedUser);
        } else {
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
      }
    };

    void syncSession();

    const authSub = isDomestic
      ? null
      : supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return;
          if (event === "SIGNED_IN" && session?.user) {
            const user = session.user;
            const mappedUser: AppUser = {
              id: user.id,
              email: user.email || "",
              name:
                (user.user_metadata as any)?.full_name ||
                user.email?.split("@")[0] ||
                "User",
              isPro: false,
              isPaid: false,
              plan: (user.user_metadata as any)?.plan,
              planExp: (user.user_metadata as any)?.plan_exp,
            };
            setAppUser(mappedUser);
            setIsLoggedIn(true);
            const planMeta = (user.user_metadata as any)?.plan;
            if (planMeta) {
              setCurrentPlan(planMeta as "Basic" | "Pro" | "Enterprise");
              localStorage.setItem("morngpt_current_plan", planMeta);
              const expMeta = (user.user_metadata as any)?.plan_exp;
              if (expMeta) {
                localStorage.setItem("morngpt_current_plan_exp", expMeta);
              }
            } else if (mappedUser.isPro) {
              setCurrentPlan("Pro");
            }
            await loadConversations(mappedUser);
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
    filePreviews,
    setFilePreviews,
    fileInputRef,
    handleFileUpload: handleFileUploadHook,
    removeFile,
  } = fileAttachments;

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
  const getLocalizedText = useMemo<(key: string) => string>(
    () =>
      createLocalizedTextGetter(
        activeLanguage,
      ) as unknown as (key: string) => string,
    [activeLanguage],
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
  const currentChatIdRef = useRef<string>("");
  const messagesLoadTokenRef = useRef<number>(0);
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

  const getToday = () => new Date().toISOString().split("T")[0];

  useEffect(() => {
    const today = getToday();
    setFreeQuotaDate(today);

    if (!appUser?.id || appUser.isPro) {
      setFreeQuotaUsed(0);
      setFreeQuotaLimit(FREE_DAILY_LIMIT);
      setBasicQuotaUsed(0);
      setBasicQuotaLimit(
        Number.parseInt(process.env.NEXT_PUBLIC_BASIC_MONTHLY_LIMIT || "100", 10) || 100
      );
      setBasicQuotaPeriod("");
      return;
    }

    const fetchQuota = async () => {
      try {
        const res = await fetch("/api/account/quota", { credentials: "include" });
        if (!res.ok) throw new Error(`quota ${res.status}`);
        const data = await res.json();
        if (data?.plan === "basic") {
          setBasicQuotaUsed(data.used ?? 0);
          setBasicQuotaLimit(data.limit ?? basicQuotaLimit);
          setBasicQuotaPeriod(data.period ?? "");
          // 清空 free 计数，避免误显示
          setFreeQuotaUsed(0);
          setFreeQuotaLimit(FREE_DAILY_LIMIT);
        } else {
          setFreeQuotaUsed(data.used ?? 0);
          setFreeQuotaLimit(data.limit ?? FREE_DAILY_LIMIT);
          setBasicQuotaUsed(0);
          setBasicQuotaPeriod("");
        }
      } catch {
        // fallback: keep defaults
        setFreeQuotaUsed(0);
        setFreeQuotaLimit(FREE_DAILY_LIMIT);
        setBasicQuotaUsed(0);
        setBasicQuotaPeriod("");
      }
    };

    void fetchQuota();
  }, [appUser?.id, appUser?.isPro, currentPlan, basicQuotaLimit]);

  const requireLogin = useCallback(() => {
    setAuthMode("login");
    setAuthForm((prev) => ({ ...prev, password: "" }));
    setShowAuthDialog(true);
    alert("Please sign in to start chatting.");
  }, [setAuthMode, setAuthForm, setShowAuthDialog]);

  const consumeFreeQuota = useCallback(() => {
    if (!appUser) return false;
    const planLower = (currentPlan || appUser?.plan || "").toLowerCase?.() || "";
    const isBasic = planLower === "basic";
    if (appUser.isPro) return true;

    if (isBasic) {
      const limit = basicQuotaLimit || 100;
      if (basicQuotaUsed >= limit) {
        alert(
          `You have reached this month's ${limit}-message limit on Basic. Please upgrade to continue.`
        );
        setShowUpgradeDialog(true);
        return false;
      }
      setBasicQuotaUsed((prev) => prev + 1);
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
      return true;
    }
  }, [
    appUser,
    currentPlan,
    freeQuotaDate,
    freeQuotaUsed,
    freeQuotaLimit,
    basicQuotaLimit,
    basicQuotaUsed,
    setShowUpgradeDialog,
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
  const { handleSubmit: handleMessageSubmit, forceUpdate } = useMessageSubmission(
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
      consumeFreeQuota
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
      const map: Record<string, string> = {
        arial: "Arial, sans-serif",
        helvetica: "Helvetica, Arial, sans-serif",
        times: '"Times New Roman", Times, serif',
        georgia: "Georgia, serif",
        verdana: "Verdana, sans-serif",
        courier: '"Courier New", monospace',
        default: "var(--font-sans, sans-serif)",
      };
      const resolvedFamily = map[family] || map.default;
      const resolvedSize = /^\d+$/.test(sizePx) ? `${sizePx}px` : sizePx;
      document.documentElement.style.setProperty("--app-font-family", resolvedFamily);
      document.documentElement.style.setProperty("--app-font-size", resolvedSize);
      document.documentElement.style.fontFamily = resolvedFamily;
      document.documentElement.style.fontSize = resolvedSize;
      document.body.style.fontFamily = resolvedFamily;
      document.body.style.fontSize = resolvedSize;
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
    if (selectedModelType === "external") {
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
          const mappedUser: AppUser = {
            id: data.user.id,
            email: data.user.email || "",
            name: data.user.name || data.user.email || "User",
            isPro: !!data.user.metadata?.pro,
            isPaid: !!data.user.metadata?.pro,
            plan: data.user.metadata?.plan,
            planExp: data.user.metadata?.plan_exp || storedExp || undefined,
          };
          setAppUser(mappedUser);
          setIsLoggedIn(true);
          if (mappedUser.plan) {
            setCurrentPlan(mappedUser.plan as "Basic" | "Pro" | "Enterprise");
            localStorage.setItem("morngpt_current_plan", mappedUser.plan);
          }
          if (mappedUser.planExp) {
            localStorage.setItem("morngpt_current_plan_exp", mappedUser.planExp);
          }
          appUserRef.current = mappedUser;
          await loadConversations(mappedUser);
          alert(isZh ? "注册成功" : "Sign up successful");
        } else {
          const { data, error } = await supabase.auth.signUp({
            email: authForm.email,
            password: authForm.password,
            options: {
              data: { full_name: authForm.name },
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });
          if (error) throw error;
          if (data.user) {
            const user = data.user;
            const mappedUser: AppUser = {
              id: user.id,
              email: user.email || "",
              name:
                (user.user_metadata as any)?.full_name ||
                user.email?.split("@")[0] ||
                "User",
              isPro: false,
            isPaid: false,
          };
          setAppUser(mappedUser);
          setIsLoggedIn(true);
          appUserRef.current = mappedUser;
          await loadConversations(mappedUser);
        }
        alert(
          isZh
            ? "注册成功，请查收邮箱并完成验证。"
            : "Sign up successful. Please check your email to confirm.",
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
          const mappedUser: AppUser = {
            id: data.user.id,
            email: data.user.email || "",
            name: data.user.name || data.user.email || "User",
            isPro: !!data.user.metadata?.pro,
            isPaid: !!data.user.metadata?.pro,
            plan: data.user.metadata?.plan,
            planExp: data.user.metadata?.plan_exp || storedExp || undefined,
          };
          setAppUser(mappedUser);
          setIsLoggedIn(true);
          if (mappedUser.plan) {
            setCurrentPlan(mappedUser.plan as "Basic" | "Pro" | "Enterprise");
            localStorage.setItem("morngpt_current_plan", mappedUser.plan);
          }
          if (mappedUser.planExp) {
            localStorage.setItem("morngpt_current_plan_exp", mappedUser.planExp);
          }
          appUserRef.current = mappedUser;
          await loadConversations(mappedUser);
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: authForm.email,
            password: authForm.password,
          });
          if (error) throw error;
          if (data.user) {
            const user = data.user;
            const mappedUser: AppUser = {
              id: user.id,
              email: user.email || "",
              name:
                (user.user_metadata as any)?.full_name ||
                user.email?.split("@")[0] ||
                "User",
              isPro: false,
            isPaid: false,
          };
          setAppUser(mappedUser);
          setIsLoggedIn(true);
          appUserRef.current = mappedUser;
          await loadConversations(mappedUser);
        }
      }
      }
      setShowAuthDialog(false);
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err) {
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
    console.log("handleLogout called"); // Debug log
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
    setSelectedPlan(plan);
    setShowUpgradeDialog(false);
    setShowPaymentDialog(true);
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

    if (selectedPaymentMethod === "paypal" && !isDomestic) {
      // Real PayPal checkout for international users
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

    // fallback: simulate success (other methods not implemented)
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

  const updateUserSettings = (newSettings: Partial<AppUser["settings"]>) => {
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
          ...appUser.settings,
          ...newSettings,
        },
      };
      setAppUser(updatedUser);
      localStorage.setItem("morngpt_user", JSON.stringify(updatedUser));
    }
  };

  const confirmLogout = () => {
    console.log("confirmLogout called"); // Debug log
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
        console.log("Could not get address, using coordinates only");
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
      setProChatError("Failed to access microphone. Please check permissions.");
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
      setProChatError(
        "Failed to access camera and microphone. Please check permissions."
      );
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
    // If current chat already locked, start a new chat with the chosen model
    if (currentChat && currentChat.isModelLocked) {
      const chosenModel = model || defaultExternalModelId;
      void createNewChat(category, modelType, chosenModel);
      setIsModelSelectorOpen(false);
      return;
    }

    setSelectedModelType(modelType);
    if (category) setSelectedCategory(category);
    if (model) setSelectedModel(model);
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

    const chosenModel = model || defaultExternalModelId;
    const chosenModelType = modelType || "external";
    // Use a temporary local ID; real ID will be created on first message send
    const newChatId = `local-${Date.now()}`;

    const newChat: ChatSession = {
      id: newChatId,
      title: getLocalizedText("newChat"),
      messages: [],
      model: chosenModel,
      modelType: chosenModelType,
      category: category || "general",
      lastUpdated: new Date(),
      isModelLocked: false, // allow changing model before first message
    };
    setChatSessions((prev) => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    setMessages([]);

    setSelectedModelType(chosenModelType);
    setSelectedModel(chosenModel);
    if (category) setSelectedCategory(category);

    // Expand the folder for the new chat's category
    setExpandedFolders([category || "general"]);
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
      setSelectedModelType(chat.modelType || "external");
      setSelectedModel(chat.model || defaultExternalModelId);
      setSelectedCategory(chat.category || "general");

      // Auto-collapse all folders except the chat's category
      setExpandedFolders([chat.category]);
    }
  };

  async function deleteChat(chatId: string) {
    try {
      if (appUser) {
        if (isDomestic) {
          const res = await fetch(`/api/conversations/${chatId}`, {
            method: "DELETE",
            credentials: "include",
          });
          if (!res.ok) {
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
      } else {
        // guests are not allowed to manage conversations; prompt login
        requireLogin();
        return;
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
        setSelectedModel(nextChat.model || defaultExternalModelId);
        setSelectedCategory(nextChat.category || "general");
        setExpandedFolders([nextChat.category || "general"]);
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
        await supabase
          .from("conversations")
          .update({ title: editingTitle })
          .eq("id", editingChatId)
          .eq("user_id", appUser.id);
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

  const groupedChats = filteredChats.reduce((acc, chat) => {
    const category = chat.category || "general";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(chat);
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
    const list =
      appUser && currentChatId
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

  // Download helper functions
  const handleDownload = () => {
    if (!selectedPlatform) return;

    // Simulate download for different platforms and variants
    const downloadUrls = {
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

    let url: string | undefined;

    if (selectedPlatform.platform === "macos" && selectedPlatform.variant) {
      url =
        downloadUrls.macos[
          selectedPlatform.variant as keyof typeof downloadUrls.macos
        ];
    } else if (
      selectedPlatform.platform === "windows" &&
      selectedPlatform.variant
    ) {
      url =
        downloadUrls.windows[
          selectedPlatform.variant as keyof typeof downloadUrls.windows
        ];
    } else if (
      selectedPlatform.platform === "linux" &&
      selectedPlatform.variant
    ) {
      url =
        downloadUrls.linux[
          selectedPlatform.variant as keyof typeof downloadUrls.linux
        ];
    } else {
      url = downloadUrls[
        selectedPlatform.platform as keyof typeof downloadUrls
      ] as string;
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
    // Implementation for generating share link
    console.log("generateShareLink called");
  };

  const copyShareLink = () => {
    // Implementation for copying share link
    console.log("copyShareLink called");
  };

  const copyShareSecret = () => {
    // Implementation for copying share secret
    console.log("copyShareSecret called");
  };

  const regenerateSecretKey = () => {
    // Implementation for regenerating secret key
    console.log("regenerateSecretKey called");
  };

  const shareToSocialMedia = () => {
    // Implementation for sharing to social media
    console.log("shareToSocialMedia called");
  };

  const handleResetCancel = () => {
    // Implementation for reset cancel
    console.log("handleResetCancel called");
  };

  const handleResetConfirm = () => {
    // Implementation for reset confirm
    console.log("handleResetConfirm called");
  };

  const showResetConfirmation = () => {
    // Implementation for showing reset confirmation
    console.log("showResetConfirmation called");
  };

  const handleUpgradeFromAds = () => {
    // Implementation for upgrade from ads
    console.log("handleUpgradeFromAds called");
  };

  const handleSpecializedProductSelect = () => {
    // Implementation for specialized product select
    console.log("handleSpecializedProductSelect called");
  };

  const freeQuotaRemaining = useMemo(() => {
    const planLower = (currentPlan || appUser?.plan || "").toLowerCase?.() || "";
    if (!appUser || appUser.isPro || planLower === "basic" || planLower === "pro" || planLower === "enterprise") return null;
    const today = getToday();
    const used = freeQuotaDate === today ? freeQuotaUsed : 0;
    const limit = freeQuotaLimit || FREE_DAILY_LIMIT;
    return Math.max(0, limit - used);
  }, [appUser, currentPlan, freeQuotaDate, freeQuotaUsed, freeQuotaLimit]);

  const basicQuotaRemaining = useMemo(() => {
    const planLower = (currentPlan || appUser?.plan || "").toLowerCase?.() || "";
    if (!appUser || appUser.isPro || planLower !== "basic") return null;
    const limit = basicQuotaLimit || 100;
    return Math.max(0, limit - basicQuotaUsed);
  }, [appUser, currentPlan, basicQuotaLimit, basicQuotaUsed]);

  const isUnlimitedPlan =
    !!appUser &&
    (appUser.isPro ||
      (currentPlan || appUser?.plan || "").toLowerCase?.() === "pro" ||
      (currentPlan || appUser?.plan || "").toLowerCase?.() === "enterprise");

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
    if (!appUser) {
      setShowAuthDialog(true);
      return;
    }
    await handleMessageSubmit();
  }, [appUser, handleMessageSubmit, setShowAuthDialog]);

  const activeChat =
    appUser && currentChatId
      ? chatSessions.find((c) => c.id === currentChatId)
      : guestChatSessions.find((c) => c.id === currentChatId);
  const activeChatId = activeChat?.id;

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!activeChatId) return;

      // Guest or local unsynced chat：仅本地删除，不调接口
      const isLocalChat = activeChatId.startsWith("local-");
      if (!appUser || isLocalChat) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        setGuestChatSessions((prev) =>
          prev.map((c) =>
            c.id === activeChatId
              ? { ...c, messages: (c.messages || []).filter((m: any) => m.id !== messageId) }
              : c,
          ),
        );
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
    [activeChatId, appUser, selectedLanguage, setMessages, setChatSessions, setGuestChatSessions],
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
  };

  const headerProps = {
    currentChat: activeChat,
    appUser,
    isGeneratingLink,
    selectedLanguage,
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
    isDomestic,
    freeQuotaRemaining,
    freeQuotaLimit: FREE_DAILY_LIMIT,
    basicQuotaRemaining,
    basicQuotaLimit,
  };

  const chatInterfaceProps = {
    messages,
    appUser,
    guestChatSessions,
    currentChatId,
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
    MAX_FILES,
    MAX_TOTAL_SIZE,
    handleFileUpload: handleFileUploadHook,
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
