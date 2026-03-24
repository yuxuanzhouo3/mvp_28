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
  Crown,
  LogIn,
  LogOut,
  Settings,
  Sun,
  Moon,
  Upload,
  ChevronDown,
  User,
  Menu,
  ChevronLeft,
  Languages,
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchQuotaShared } from "@/utils/quota-fetcher";
import AdBanner from "@/components/AdBanner";
import { useIsIOSMobile } from "@/hooks";

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
  // 全局广告显示状态
  showGlobalAds?: boolean;
  // 移动端访客试用信息
  mobileGuestTrialEnabled?: boolean;
  mobileGuestTrialRemaining?: number;
  mobileGuestTrialMax?: number;
  // 未登录时点击关闭广告按钮的回调
  onLoginRequired?: () => void;
  // 侧边栏控制
  sidebarCollapsed?: boolean;
  setSidebarCollapsed?: (collapsed: boolean) => void;
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
  showGlobalAds = true,
  mobileGuestTrialEnabled = false,
  mobileGuestTrialRemaining = 0,
  mobileGuestTrialMax = 10,
  onLoginRequired,
  sidebarCollapsed = false,
  setSidebarCollapsed,
}: HeaderProps) {
  const isIOSMobile = useIsIOSMobile();

  // 检查订阅是否过期
  const rawPlanLower = (
    currentPlan ||
    appUserPlan ||
    (appUser?.isPro ? "Pro" : "")
  )
    .toLowerCase();

  const planExpDate = planExp ? new Date(planExp) : null;
  const isPlanActive = planExpDate ? planExpDate > new Date() : true;

  // 如果订阅过期,降级为Free
  const planLower = isPlanActive ? rawPlanLower : "free";

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
  // 所有用户都可以关闭广告，但只有免费用户会看到升级弹窗
  const shouldShowUpgradeDialogOnAdClose = !appUser?.isPaid;

  const quotaText = isUnlimited ? "∞/∞" : null;
  // 实时钱包（用于显示加油包最新额度）
  const [liveWallet, setLiveWallet] = useState<{
    addon_image_balance: number;
    addon_video_balance: number;
    monthly_image_balance?: number;
    monthly_video_balance?: number;
  } | null>(
    appUser?.wallet
      ? {
          addon_image_balance: appUser.wallet.addon_image_balance ?? 0,
          addon_video_balance: appUser.wallet.addon_video_balance ?? 0,
          monthly_image_balance: appUser.wallet.monthly_image_balance ?? undefined,
          monthly_video_balance: appUser.wallet.monthly_video_balance ?? undefined,
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
            monthly_image_balance: data.wallet.monthly?.image,
            monthly_video_balance: data.wallet.monthly?.video,
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
    const monthlyImageBalance = liveWallet?.monthly_image_balance;
    const monthlyVideoBalance = liveWallet?.monthly_video_balance;
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
    const photoRemainingRaw =
      monthlyImageBalance ??
      (isBasic
        ? basicPhotoRemaining
        : isPro
          ? proPhotoRemaining
          : isEnterprise
            ? enterprisePhotoRemaining
            : freePhotoRemaining);
    const photoRemainingSafe = typeof photoRemainingRaw === "number" ? photoRemainingRaw : photoLimitSafe;
    const photoBaseLimit = Math.max(
      photoRemainingSafe,
      photoLimitSafe > 0 ? photoLimitSafe - addonImage : 0
    );
    const videoLimitSafe = isBasic
      ? basicVideoAudioLimit ?? 0
      : isPro
        ? proVideoAudioLimit ?? 0
        : isEnterprise
          ? enterpriseVideoAudioLimit ?? 0
          : freeVideoAudioLimit ?? 0;
    const videoRemainingRaw =
      monthlyVideoBalance ??
      (isBasic
        ? basicVideoAudioRemaining
        : isPro
          ? proVideoAudioRemaining
          : isEnterprise
            ? enterpriseVideoAudioRemaining
            : freeVideoAudioRemaining);
    const videoRemainingSafe = typeof videoRemainingRaw === "number" ? videoRemainingRaw : videoLimitSafe;
    const videoBaseLimit = Math.max(
      videoRemainingSafe,
      videoLimitSafe > 0 ? videoLimitSafe - addonVideo : 0
    );
    const photoPercent =
      photoBaseLimit > 0 ? Math.min(100, Math.max(0, (photoRemainingSafe / photoBaseLimit) * 100)) : 0;
    const videoPercent =
      videoBaseLimit > 0 ? Math.min(100, Math.max(0, (videoRemainingSafe / videoBaseLimit) * 100)) : 0;
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
      <div className="space-y-3 pt-1 border-t border-gray-200 dark:border-gray-700">
        {/* 订阅额度 */}
        <div className="space-y-2">
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
            {photoBaseLimit ? `${Math.max(0, photoRemainingSafe)} / ${photoBaseLimit}` : "—"}
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
            {videoBaseLimit ? `${Math.max(0, videoRemainingSafe)} / ${videoBaseLimit}` : "—"}
          </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-300 via-orange-400 to-red-500 transition-[width] duration-300"
              style={{ width: `${videoPercent}%` }}
            />
          </div>
        </div>

        {/* 加油包额度 */}
        <div className="space-y-2 pt-2 border-t border-dashed border-amber-200 dark:border-amber-900/50">
          <div className="flex items-center justify-between text-[11px] text-amber-700 dark:text-amber-300">
            <span className="font-medium">
              {selectedLanguage === "zh" ? "加油包图片额度" : "Add-on images"}
            </span>
            <span className="font-semibold text-gray-900 dark:text-gray-50">
              {`${addonImage}`}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-amber-700 dark:text-amber-300">
            <span className="font-medium">
              {selectedLanguage === "zh" ? "加油包视频/音频额度" : "Add-on video/audio"}
            </span>
            <span className="font-semibold text-gray-900 dark:text-gray-50">
              {`${addonVideo}`}
            </span>
          </div>
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
    <header className="bg-white dark:bg-[#40414f] border-b border-gray-200 dark:border-[#40414f] shadow-sm transition-colors overflow-x-hidden">
      <div className="max-w-full mx-auto px-2 sm:px-3 lg:px-4 overflow-x-hidden">
        <div className="flex items-center h-11 sm:h-14 md:h-16 overflow-x-hidden gap-1.5 sm:gap-2">
          {/* 侧边栏切换按钮 - 最左侧 */}
          {setSidebarCollapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="h-8 w-8 p-0 text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869] flex-shrink-0 transition-all duration-200"
              title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
            >
              {sidebarCollapsed ? (
                <Menu className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </Button>
          )}

          {/* 左侧：Logo + 身份牌 - 不截断 */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-[#ececf1] whitespace-nowrap leading-none">
              {getLocalizedText("mornGPT")}
            </h1>
            {/* 移动端使用 Popover 点击展示，桌面端使用 Tooltip 悬浮显示 */}
            {!isIOSMobile && (
              <div className="hidden md:flex items-center">
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
                              {planExp ? (
                                isPlanActive ? (
                                  `${selectedLanguage === "zh" ? "到期" : "Expires"}: ${new Date(planExp).toLocaleString()}`
                                ) : (
                                  <span className="text-red-600 dark:text-red-400">
                                    {selectedLanguage === "zh" ? "已过期" : "Expired"}
                                  </span>
                                )
                              ) : (
                                selectedLanguage === "zh" ? "订阅中" : "Active subscription"
                              )}
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
                      <div className="space-y-2 w-56">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-900 dark:text-gray-50">
                            {selectedLanguage === "zh" ? "访客用户" : "Guest User"}
                          </span>
                        </div>
                        {mobileGuestTrialEnabled ? (
                          <>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-gray-700 dark:text-gray-200">
                                {selectedLanguage === "zh" ? "今日试用额度" : "Daily trial quota"}
                              </span>
                              <span className="font-semibold text-gray-900 dark:text-gray-50">
                                {mobileGuestTrialRemaining} / {mobileGuestTrialMax}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-green-400 via-blue-400 to-blue-600 transition-[width] duration-300"
                                style={{ width: `${(mobileGuestTrialRemaining / mobileGuestTrialMax) * 100}%` }}
                              />
                            </div>
                            <div className="text-[11px] text-gray-600 dark:text-gray-300">
                              {selectedLanguage === "zh"
                                ? "每日重置，仅限通用模型"
                                : "Resets daily, General Model only"}
                            </div>
                          </>
                        ) : (
                          <div className="text-[11px] text-gray-600 dark:text-gray-300">
                            {selectedLanguage === "zh"
                              ? "游客模式（不会保存数据）"
                              : "Guest session (data not saved)"}
                          </div>
                        )}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              </div>
            )}
            {/* 移动端使用 Popover */}
            {!isIOSMobile && (
              <div className="flex md:hidden items-center self-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Badge
                    variant="outline"
                    className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 border-0 cursor-pointer leading-tight ${
                      appUser
                        ? tierClass
                        : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {tierDisplay}
                  </Badge>
                </PopoverTrigger>
                <PopoverContent side="bottom" className="text-xs w-64">
                  {appUser ? (
                    isUnlimited ? (
                    <div className="space-y-2">
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
                      <div className="space-y-2">
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
                            {planExp ? (
                              isPlanActive ? (
                                `${selectedLanguage === "zh" ? "到期" : "Expires"}: ${new Date(planExp).toLocaleString()}`
                              ) : (
                                <span className="text-red-600 dark:text-red-400">
                                  {selectedLanguage === "zh" ? "已过期" : "Expired"}
                                </span>
                              )
                            ) : (
                              selectedLanguage === "zh" ? "订阅中" : "Active subscription"
                            )}
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
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 dark:text-gray-50">
                          {selectedLanguage === "zh" ? "访客用户" : "Guest User"}
                        </span>
                      </div>
                      {mobileGuestTrialEnabled ? (
                        <>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-700 dark:text-gray-200">
                              {selectedLanguage === "zh" ? "今日试用额度" : "Daily trial quota"}
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-gray-50">
                              {mobileGuestTrialRemaining} / {mobileGuestTrialMax}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-green-400 via-blue-400 to-blue-600 transition-[width] duration-300"
                              style={{ width: `${(mobileGuestTrialRemaining / mobileGuestTrialMax) * 100}%` }}
                            />
                          </div>
                          <div className="text-[11px] text-gray-600 dark:text-gray-300">
                            {selectedLanguage === "zh"
                              ? "每日重置，仅限通用模型"
                              : "Resets daily, General Model only"}
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] text-gray-600 dark:text-gray-300">
                          {selectedLanguage === "zh"
                            ? "游客模式（不会保存数据）"
                            : "Guest session (data not saved)"}
                        </div>
                      )}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              </div>
            )}
            {currentChat && (
              <span className="hidden sm:inline text-sm text-gray-500 dark:text-gray-400 truncate">
                - {currentChat.title}
              </span>
            )}
          </div>

          {/* 右侧按钮组 - 使用 ml-auto 推到最右侧 */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 ml-auto">
            {/* Share Link Button - 所有设备显示 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (!appUser) {
                  return;
                }
                await generateShareLink();
              }}
              disabled={
                !currentChat || messages.length === 0
              }
              className="flex text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869] disabled:opacity-50 disabled:cursor-not-allowed h-8 w-8 p-0"
              title={
                !appUser
                  ? getLocalizedText("signUpToShare")
                  : !currentChat
                  ? getLocalizedText("noChatSelected")
                  : messages.length === 0
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

            {/* 设置组：语言切换 + 主题切换 */}
            <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-[#565869]/50 rounded-md p-0.5">
              {/* Language Toggle Button */}
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedLanguage(selectedLanguage === "en" ? "zh" : "en")}
                      className="h-7 w-7 p-0 text-gray-900 dark:text-[#ececf1] hover:bg-white dark:hover:bg-[#40414f] flex-shrink-0"
                    >
                      <Languages className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {selectedLanguage === "zh" ? "切换到英文" : "Switch to Chinese"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Theme Toggle Button */}
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleTheme}
                      className="h-7 w-7 p-0 text-gray-900 dark:text-[#ececf1] hover:bg-white dark:hover:bg-[#40414f] flex-shrink-0"
                    >
                      {isDarkMode ? (
                        <Sun className="w-3.5 h-3.5" />
                      ) : (
                        <Moon className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {isDarkMode
                      ? (selectedLanguage === "zh" ? "切换到亮色模式" : "Switch to light mode")
                      : (selectedLanguage === "zh" ? "切换到暗色模式" : "Switch to dark mode")
                    }
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* 订阅按钮 - 所有设备显示，移动端仅图标 */}
            {appUser && !isIOSMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUpgradeDialog(true)}
                className="flex bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700 h-8 sm:h-8 w-8 sm:w-auto px-0 sm:px-2 flex-shrink-0"
                title={
                  selectedLanguage === "zh"
                    ? "开通订阅，解锁更多用量与高级模型"
                    : getLocalizedText("Choose Your MornGPT Plan")
                }
              >
                <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="ml-1 text-[10px] sm:text-xs hidden sm:inline">
                  {selectedLanguage === "zh" ? "订阅" : "Pro"}
                </span>
              </Button>
            )}

            {/* 用户中心 - 简化移动端宽度 */}
            {appUser ? (
              <div className="relative flex-shrink-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-20 sm:w-20 md:w-28 lg:w-36 h-8 sm:h-8 bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869] text-xs px-1.5 sm:px-2"
                    >
                      <div className="flex items-center space-x-0.5 sm:space-x-1 w-full justify-center">
                        {!isIOSMobile && (appUser.isPro || appUser.isPaid) && (
                          <Crown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-900 dark:text-gray-100 flex-shrink-0" />
                        )}
                        <User className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                        <span className="truncate text-[10px] sm:text-[10px] md:text-xs max-w-[40px] sm:max-w-[40px] md:max-w-[60px]">{appUser.name}</span>
                        <ChevronDown className="w-2.5 h-2.5 sm:w-2.5 sm:h-2.5 flex-shrink-0" />
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 sm:w-40 md:w-48 bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] p-1">
                    <div className="space-y-1">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-xs text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869]"
                        onClick={() => setShowSettingsDialog(true)}
                      >
                        <Settings className="w-3 h-3 mr-2" />
                        {getLocalizedText("setting")}
                      </Button>

                      <Button
                        variant="ghost"
                        className="w-full justify-start text-xs text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869]"
                        onClick={confirmLogout}
                      >
                        <LogOut className="w-3 h-3 mr-2" />
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
                className="h-7 text-[10px] sm:text-xs bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869] flex-shrink-0 px-2"
              >
                <LogIn className="w-3 h-3 mr-0.5 sm:mr-1" />
                <span className="text-[10px] sm:text-xs">{getLocalizedText("login")}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
