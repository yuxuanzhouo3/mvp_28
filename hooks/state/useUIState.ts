import { useState } from "react";

export const useUIState = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showFolders, setShowFolders] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showRegistrationPrompt, setShowRegistrationPrompt] = useState(false);
  const [showDataCollectionNotice, setShowDataCollectionNotice] =
    useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showDownloadSection, setShowDownloadSection] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<{
    platform: string;
    variant?: string;
  } | null>(null);
  const [makeDiscoverable, setMakeDiscoverable] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPaidModel, setSelectedPaidModel] = useState<any>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">(
    "annual"
  );
  const [selectedPlanInDialog, setSelectedPlanInDialog] = useState<any>(null);
  const [showBillingDialog, setShowBillingDialog] = useState(false);
  const [showPaymentEditDialog, setShowPaymentEditDialog] = useState(false);
  const [isProVideoChatActive, setIsProVideoChatActive] = useState(false);
  const [proVideoChatStream, setProVideoChatStream] =
    useState<MediaStream | null>(null);
  const [proChatError, setProChatError] = useState<string>("");
  const [proChatTrialCount, setProChatTrialCount] = useState<{
    voice: number;
    video: number;
  }>({ voice: 0, video: 0 });
  const [showProUpgradeDialog, setShowProUpgradeDialog] = useState(false);
  const [proChatType, setProChatType] = useState<"voice" | "video" | null>(
    null
  );
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showLogoutConfirmDialog, setShowLogoutConfirmDialog] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [fontFamily, setFontFamily] = useState("arial");
  const [fontSize, setFontSize] = useState("14");
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [showFontDialog, setShowFontDialog] = useState(false);
  const [showShortcutDialog, setShowShortcutDialog] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [isEditingSecret, setIsEditingSecret] = useState(false);
  const [customSecret, setCustomSecret] = useState("");
  const [showSecretConfirm, setShowSecretConfirm] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string>("");
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);
  const [isSidebarLoading, setIsSidebarLoading] = useState(false);

  // 全局广告显示状态（默认显示广告，刷新后恢复）
  const [showGlobalAds, setShowGlobalAds] = useState(true);

  // 下载版本数据
  const [releases, setReleases] = useState<Array<{
    id: string;
    version: string;
    platform: string;
    variant?: string;
    file_url: string;
    file_size?: number;
    release_notes?: string;
  }>>([]);
  const [isLoadingReleases, setIsLoadingReleases] = useState(false);

  return {
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
  };
};
