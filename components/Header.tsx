"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Crown,
  LogIn,
  LogOut,
  Settings,
  Sun,
  Moon,
  Upload,
  ChevronDown,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchQuotaShared } from "@/utils/quota-fetcher";

interface HeaderProps {
  currentChat: any;
  appUser: any;
  isGeneratingLink: boolean;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  prompt: string;
  detectLanguage: (text: string) => string;
  toggleTheme: () => void;
  isDarkMode: boolean;
  setShowSettingsDialog: (show: boolean) => void;
  confirmLogout: () => void;
  setShowAuthDialog: (show: boolean) => void;
  generateShareLink: () => Promise<void>;
  getLocalizedText: (key: string) => string;
  messages: any[];
  guestChatSessions: any[];
  currentChatId: string;
  currentPlan?: "Basic" | "Pro" | "Enterprise" | null;
  planExp?: string | null;
  appUserPlan?: string | null;
  isUnlimitedPlan?: boolean;
  setShowUpgradeDialog: (show: boolean) => void;
  isDomestic: boolean;
  freeQuotaRemaining?: number | null;
  freeQuotaLimit?: number;
  basicQuotaRemaining?: number | null;
  basicQuotaLimit?: number;
  freePhotoRemaining?: number | null;
  freePhotoLimit?: number | null;
  freeVideoAudioRemaining?: number | null;
  freeVideoAudioLimit?: number | null;
  freeContextLimit?: number | null;
  basicPhotoRemaining?: number | null;
  basicPhotoLimit?: number | null;
  basicVideoAudioRemaining?: number | null;
  basicVideoAudioLimit?: number | null;
  basicContextLimit?: number | null;
  proQuotaRemaining?: number | null;
  proQuotaLimit?: number;
  proPhotoRemaining?: number | null;
  proPhotoLimit?: number | null;
  proVideoAudioRemaining?: number | null;
  proVideoAudioLimit?: number | null;
  proContextLimit?: number | null;
  enterpriseQuotaRemaining?: number | null;
  enterpriseQuotaLimit?: number;
  enterprisePhotoRemaining?: number | null;
  enterprisePhotoLimit?: number | null;
  enterpriseVideoAudioRemaining?: number | null;
  enterpriseVideoAudioLimit?: number | null;
  enterpriseContextLimit?: number | null;
}

export default function Header({
  currentChat,
  appUser,
  isGeneratingLink,
  selectedLanguage,
  setSelectedLanguage,
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
  currentPlan,
  planExp,
  appUserPlan,
  isUnlimitedPlan,
  isDomestic,
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
  proQuotaRemaining,
  proQuotaLimit,
  proPhotoRemaining,
  proPhotoLimit,
  proVideoAudioRemaining,
  proVideoAudioLimit,
  proContextLimit,
  enterpriseQuotaRemaining,
  enterpriseQuotaLimit,
  enterprisePhotoRemaining,
  enterprisePhotoLimit,
  enterpriseVideoAudioRemaining,
  enterpriseVideoAudioLimit,
  enterpriseContextLimit,
}: HeaderProps) {
  const planLower = (
    currentPlan ||
    appUserPlan ||
    (appUser?.isPro ? "Pro" : "")
  )
    .toLowerCase();

  const tierDisplay = (() => {
    if (!appUser) return "Guest User";
    if (planLower === "enterprise") return "Enterprise";
    if (planLower === "pro") return "Pro";
    if (planLower === "basic") return "Basic";
    return "Free";
  })();

  const tierClass =
    planLower === "enterprise"
      ? "bg-purple-600 text-white"
      : planLower === "pro"
      ? "bg-blue-600 text-white"
      : planLower === "basic"
      ? "bg-amber-500 text-white"
      : "bg-gray-200 text-gray-800";
  const isBasicUser = !!appUser && planLower === "basic";
  const isProUserLimited = !!appUser && planLower === "pro";
  const isEnterpriseUser = !!appUser && planLower === "enterprise";
  const isUnlimited =
    !!appUser &&
    !isBasicUser &&
    !isProUserLimited &&
    !isEnterpriseUser &&
    (isUnlimitedPlan && planLower !== "free" && planLower !== "");
  const isFreeUser =
    !!appUser &&
    !isUnlimited &&
    !isBasicUser &&
    !isProUserLimited &&
    !isEnterpriseUser &&
    (planLower === "" || planLower === "free");

  const quotaText = isUnlimited ? "∞/∞" : null;
  // 实时钱包（用于显示加油包最新额度）
  const [liveWallet, setLiveWallet] = useState<{ addon_image_balance: number; addon_video_balance: number } | null>(
    appUser?.wallet
      ? {
          addon_image_balance: appUser.wallet.addon_image_balance ?? 0,
          addon_video_balance: appUser.wallet.addon_video_balance ?? 0,
        }
      : null
  );

  // 定时轮询 + 聚焦刷新，加油包额度实时更新
  useEffect(() => {
    if (!appUser?.id) return;
    let cancelled = false;
    const fetchWallet = async () => {
      try {
        const data = await fetchQuotaShared("/api/account/quota");
        if (cancelled) return;
        if (data?.wallet) {
          setLiveWallet({
            addon_image_balance: data.wallet.addon?.image ?? 0,
            addon_video_balance: data.wallet.addon?.video ?? 0,
          });
        }
      } catch {
        // ignore
      }
    };

    fetchWallet();
    const onFocus = () => fetchWallet();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchWallet();
      }
    };
    const onQuotaRefresh = () => fetchWallet();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("quota:refresh", onQuotaRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("quota:refresh", onQuotaRefresh);
    };
  }, [appUser?.id]);

  const renderQuotaBars = () => {
    if (!isFreeUser && !isBasicUser && !isProUserLimited && !isEnterpriseUser) return null;
    const addonImage = liveWallet?.addon_image_balance ?? 0;
    const addonVideo = liveWallet?.addon_video_balance ?? 0;
    const isBasic = isBasicUser;
    const isPro = isProUserLimited;
    const isEnterprise = isEnterpriseUser;
    const dailyLimit = isBasic
      ? basicQuotaLimit ?? 0
      : isPro
        ? proQuotaLimit ?? 0
        : isEnterprise
          ? enterpriseQuotaLimit ?? 0
          : freeQuotaLimit ?? 0;
    const dailyRemainingRaw = isBasic
      ? basicQuotaRemaining
      : isPro
        ? proQuotaRemaining
        : isEnterprise
          ? enterpriseQuotaRemaining
          : freeQuotaRemaining;
    const dailyRemaining =
      typeof dailyRemainingRaw === "number"
        ? Math.max(0, dailyRemainingRaw as number)
        : dailyLimit;
    const dailyPercent =
      dailyLimit > 0 ? Math.min(100, Math.max(0, (dailyRemaining / dailyLimit) * 100)) : 0;

    const photoLimitSafe = isBasic
      ? basicPhotoLimit ?? 0
      : isPro
        ? proPhotoLimit ?? 0
        : isEnterprise
          ? enterprisePhotoLimit ?? 0
          : freePhotoLimit ?? 0;
    const photoRemainingSafe = isBasic
      ? basicPhotoRemaining ?? photoLimitSafe
      : isPro
        ? proPhotoRemaining ?? photoLimitSafe
        : isEnterprise
          ? enterprisePhotoRemaining ?? photoLimitSafe
          : freePhotoRemaining ?? photoLimitSafe;
    const videoLimitSafe = isBasic
      ? basicVideoAudioLimit ?? 0
      : isPro
        ? proVideoAudioLimit ?? 0
        : isEnterprise
          ? enterpriseVideoAudioLimit ?? 0
          : freeVideoAudioLimit ?? 0;
    const videoRemainingSafe = isBasic
      ? basicVideoAudioRemaining ?? videoLimitSafe
      : isPro
        ? proVideoAudioRemaining ?? videoLimitSafe
        : isEnterprise
          ? enterpriseVideoAudioRemaining ?? videoLimitSafe
          : freeVideoAudioRemaining ?? videoLimitSafe;
    const photoPercent =
      photoLimitSafe > 0 ? Math.min(100, Math.max(0, (photoRemainingSafe / photoLimitSafe) * 100)) : 0;
    const videoPercent =
      videoLimitSafe > 0 ? Math.min(100, Math.max(0, (videoRemainingSafe / videoLimitSafe) * 100)) : 0;
    const dailyText =
      dailyLimit > 0 && dailyRemaining !== Infinity
        ? `${Math.max(0, Math.min(dailyLimit, Math.ceil(dailyRemaining)))} / ${dailyLimit}`
        : "—";
    const parseLimit = (val: any, fallback: number) =>
      typeof val === "number" && Number.isFinite(val) ? val : fallback;
    const contextLimit = isBasic
      ? parseLimit(basicContextLimit, parseInt(process.env.NEXT_PUBLIC_BASIC_CONTEXT_MSG_LIMIT || "50", 10) || 50)
      : isPro
        ? parseLimit(proContextLimit, parseInt(process.env.NEXT_PUBLIC_PRO_CONTEXT_MSG_LIMIT || "100", 10) || 100)
        : isEnterprise
          ? parseLimit(
              enterpriseContextLimit,
              parseInt(process.env.NEXT_PUBLIC_ENTERPRISE_CONTEXT_MSG_LIMIT || "200", 10) || 200
            )
          : parseLimit(freeContextLimit, parseInt(process.env.NEXT_PUBLIC_FREE_CONTEXT_MSG_LIMIT || "10", 10) || 10);

    return (
      <div className="space-y-2 pt-1 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-700 dark:text-gray-200">
            {selectedLanguage === "zh" ? "每日外部模型额度" : "Daily external quota"}
          </span>
          <span className="font-semibold text-gray-900 dark:text-gray-50">{dailyText}</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 via-blue-400 to-blue-600 transition-[width] duration-300"
            style={{ width: `${dailyPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-700 dark:text-gray-200">
            {selectedLanguage === "zh" ? "本月图片额度" : "Monthly photos"}
          </span>
          <span className="font-semibold text-gray-900 dark:text-gray-50">
            {photoLimitSafe ? `${Math.max(0, photoRemainingSafe)} / ${photoLimitSafe}` : "—"}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-300 via-purple-400 to-purple-600 transition-[width] duration-300"
            style={{ width: `${photoPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-700 dark:text-gray-200">
            {selectedLanguage === "zh" ? "本月视频/音频额度" : "Monthly video/audio"}
          </span>
          <span className="font-semibold text-gray-900 dark:text-gray-50">
            {videoLimitSafe ? `${Math.max(0, videoRemainingSafe)} / ${videoLimitSafe}` : "—"}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-300 via-orange-400 to-red-500 transition-[width] duration-300"
            style={{ width: `${videoPercent}%` }}
          />
        </div>

        {/* 加油包永久额度展示 */}
        <div className="flex items-center justify-between text-[11px] text-amber-700 dark:text-amber-300 pt-1 border-t border-gray-200 dark:border-gray-700">
          <span className="font-medium">
            {selectedLanguage === "zh" ? "加油包（永久）" : "Add-on credits"}
          </span>
          <span className="flex items-center space-x-2">
            <span className="flex items-center space-x-1">
              <span>📷</span>
              <span>{addonImage}</span>
            </span>
            <span className="flex items-center space-x-1">
              <span>🎬</span>
              <span>{addonVideo}</span>
            </span>
          </span>
        </div>

        {typeof contextLimit === "number" && contextLimit > 0 && (
          <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
            <span>{selectedLanguage === "zh" ? "上下文限制" : "Context limit"}</span>
            <span>{contextLimit}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <header className="bg-white dark:bg-[#40414f] border-b border-gray-200 dark:border-[#40414f] shadow-sm transition-colors">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-[#ececf1]">
              {getLocalizedText("mornGPT")}
            </h1>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={`text-xs px-2 py-0.5 border-0 ${
                      appUser
                        ? tierClass
                        : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {tierDisplay}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {appUser ? (
                    isUnlimited ? (
                    <div className="space-y-2 w-56">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 dark:text-gray-50">
                          {tierDisplay}
                        </span>
                        <span className="text-gray-700 dark:text-gray-200 font-semibold">
                          ∞/∞
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-500"
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div className="text-[11px] text-gray-600 dark:text-gray-300">
                        {selectedLanguage === "zh"
                          ? "无限制消息额度"
                          : "Unlimited messages on your plan."}
                      </div>
                      <div className="text-[11px] text-gray-600 dark:text-gray-300">
                        {planExp
                          ? `${selectedLanguage === "zh" ? "到期" : "Expires"}: ${new Date(
                              planExp,
                            ).toLocaleString()}`
                            : selectedLanguage === "zh"
                              ? "订阅中"
                              : "Active subscription"}
                        </div>
                      </div>
                    ) : isFreeUser || isBasicUser || isProUserLimited || isEnterpriseUser ? (
                      <div className="space-y-2 w-56">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-900 dark:text-gray-50">
                            {selectedLanguage === "zh"
                              ? isEnterpriseUser
                                ? "企业版"
                                : isProUserLimited
                                  ? "专业版"
                                  : isBasicUser
                                    ? "基础版"
                                    : "Free"
                              : isEnterpriseUser
                                ? "Enterprise"
                                : isProUserLimited
                                  ? "Pro Plan"
                                  : isBasicUser
                                    ? "Basic Plan"
                                    : "Free"}
                          </span>
                          {quotaText && (
                            <span className="text-gray-700 dark:text-gray-200 font-semibold">
                              {quotaText}
                            </span>
                          )}
                        </div>
                        {renderQuotaBars()}
                        {(isBasicUser || isProUserLimited || isEnterpriseUser) && (
                          <div className="text-[11px] text-gray-600 dark:text-gray-300 pt-1 border-t border-gray-200 dark:border-gray-700">
                            {planExp
                              ? `${selectedLanguage === "zh" ? "到期" : "Expires"}: ${new Date(
                                  planExp,
                                ).toLocaleString()}`
                              : selectedLanguage === "zh"
                                ? "订阅中"
                                : "Active subscription"}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="font-semibold text-gray-900 dark:text-gray-50">
                          {tierDisplay}
                        </div>
                        {planExp ? (
                          <div className="text-gray-600 dark:text-gray-300">
                            {selectedLanguage === "zh" ? "到期" : "Expires"}:{" "}
                            {new Date(planExp).toLocaleString()}
                          </div>
                        ) : (
                          <div className="text-gray-600 dark:text-gray-300">
                            {selectedLanguage === "zh" ? "订阅中" : "Active subscription"}
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="text-gray-700 dark:text-gray-200">
                      {selectedLanguage === "zh"
                        ? "游客模式（不会保存数据）"
                        : "Guest session (data not saved)"}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {currentChat && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                - {currentChat.title}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {/* Share Link Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (!appUser) {
                  // setRegistrationPromptType("feature");
                  // setShowRegistrationPrompt(true);
                  return;
                }
                await generateShareLink();
              }}
              disabled={
                !currentChat ||
                (appUser
                  ? messages.length === 0
                  : guestChatSessions.find((c) => c.id === currentChatId)
                      ?.messages.length === 0)
              }
              className="text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869] disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                !appUser
                  ? getLocalizedText("signUpToShare")
                  : !currentChat
                  ? getLocalizedText("noChatSelected")
                  : (
                      appUser
                        ? messages.length === 0
                        : guestChatSessions.find((c) => c.id === currentChatId)
                            ?.messages.length === 0
                    )
                  ? getLocalizedText("noConversationToShare")
                  : getLocalizedText("shareConversation")
              }
            >
              {isGeneratingLink ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
            </Button>
            {/* Language Selector */}
            <div className="flex items-center space-x-1">
              <Select
                value={selectedLanguage}
                onValueChange={setSelectedLanguage}
              >
                <SelectTrigger className="h-8 w-20 text-xs bg-white dark:bg-[#40414f] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]">
                  <span>{selectedLanguage === "en" ? "EN" : "中文"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                </SelectContent>
              </Select>
              {prompt && detectLanguage(prompt) !== selectedLanguage && (
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
                  title="Language will be auto-detected from your input"
                ></div>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869]"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
            {appUser && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUpgradeDialog(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700"
                title={
                  selectedLanguage === "zh"
                    ? "开通订阅，解锁更多用量与高级模型"
                    : getLocalizedText("Choose Your MornGPT Plan")
                }
              >
                <Crown className="w-4 h-4" />
                <span className="ml-2 text-xs">
                  {selectedLanguage === "zh" ? "开通订阅" : "Upgrade"}
                </span>
              </Button>
            )}
            {appUser ? (
              <div className="relative">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-40 bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]"
                    >
                      <div className="flex items-center space-x-2">
                        {appUser.isPro && (
                          <Crown className="w-4 h-4 text-gray-900 dark:text-gray-100" />
                        )}
                        <User className="w-4 h-4" />
                        <span className="truncate">{appUser.name}</span>
                        <ChevronDown className="w-3 h-3" />
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] p-1">
                    <div className="space-y-1">
                      {appUser && (
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869]"
                          onClick={() => setShowSettingsDialog(true)}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          {getLocalizedText("setting")}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        className="w-full justify-start text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869]"
                        onClick={confirmLogout}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        {getLocalizedText("signOut")}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <Button
                onClick={() => setShowAuthDialog(true)}
                variant="outline"
                size="sm"
                className="bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]"
              >
                <LogIn className="w-4 h-4 mr-2" />
                {getLocalizedText("login")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
