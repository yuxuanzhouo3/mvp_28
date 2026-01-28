"use client";

import React, { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Download,
  Smartphone,
  Monitor,
  Laptop,
  Globe,
  Crown,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useIsMobile, useIsIOSMobile } from "@/hooks";

interface Platform {
  platform: string;
  variant?: string;
}

interface AppUser {
  settings?: {
    adsEnabled?: boolean;
    hideAds?: boolean;
  };
  isPro?: boolean;
  isPaid?: boolean;
  planExp?: string;
}

interface DownloadSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPlatform: Platform | null;
  appUser: AppUser | null;
  onPlatformSelect: (platform: string, variant?: string) => void;
  onDownload: () => void;
  onUpdateUserSettings: (settings: { hideAds?: boolean; adsEnabled?: boolean }) => void;
  onUpgradeFromAds: () => void;
}

export default function DownloadSectionDialog({
  open,
  onOpenChange,
  selectedPlatform,
  appUser,
  onPlatformSelect,
  onDownload,
  onUpdateUserSettings,
  onUpgradeFromAds,
}: DownloadSectionDialogProps) {
  const { currentLanguage, isDomesticVersion } = useLanguage();
  const isMobile = useIsMobile();
  const isIOSMobile = useIsIOSMobile();
  const isZh = currentLanguage === "zh";
  const brandName = isDomesticVersion && isMobile ? "晨佑 AI" : "MornGPT";
  const tr = useCallback((en: string, zh: string) => (isZh ? zh : en), [isZh]);

  // 获取平台显示名称
  const getPlatformDisplayName = (platform: string): string => {
    const platformNames: Record<string, string> = {
      android: "Android",
      ios: "iOS",
      harmonyos: "HarmonyOS",
      windows: "Windows",
      macos: "macOS",
      linux: "Linux",
      chrome: "Chrome",
    };
    return platformNames[platform] || platform;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:max-w-lg bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] rounded-2xl sm:rounded-3xl flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <Download className="w-4 h-4 text-blue-600" />
            <span className="text-base">{tr(`Download ${brandName}`, `下载 ${brandName}`)}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1">
          {/* 平台选择 */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-900 dark:text-[#ececf1]">
              {tr("Select Your Platform", "选择你的平台")}
            </h3>

            {selectedPlatform && (
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      {getPlatformDisplayName(selectedPlatform.platform)}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      {tr("Ready to download", "准备好下载")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={onDownload}
                  >
                    {selectedPlatform.platform === "chrome"
                      ? tr("Install Now", "立即安装")
                      : tr("Download Now", "立即下载")}
                  </Button>
                </div>
              </div>
            )}

            {/* 移动端 */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {tr("Mobile Apps", "移动端")}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className={`text-xs h-8 px-3 ${
                    selectedPlatform?.platform === "android"
                      ? "bg-purple-100 border-purple-300 dark:bg-purple-900/30"
                      : ""
                  }`}
                  onClick={() => onPlatformSelect("android")}
                >
                  <Smartphone className="w-3.5 h-3.5 mr-1.5" />
                  Android
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`text-xs h-8 px-3 ${
                    selectedPlatform?.platform === "ios"
                      ? "bg-purple-100 border-purple-300 dark:bg-purple-900/30"
                      : ""
                  }`}
                  onClick={() => onPlatformSelect("ios")}
                >
                  <Smartphone className="w-3.5 h-3.5 mr-1.5" />
                  iOS
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`text-xs h-8 px-3 ${
                    selectedPlatform?.platform === "harmonyos"
                      ? "bg-purple-100 border-purple-300 dark:bg-purple-900/30"
                      : ""
                  }`}
                  onClick={() => onPlatformSelect("harmonyos")}
                >
                  <Smartphone className="w-3.5 h-3.5 mr-1.5" />
                  HarmonyOS
                </Button>
              </div>
            </div>

            {/* 桌面端 */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {tr("Desktop Apps", "桌面端")}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className={`text-xs h-8 px-3 ${
                    selectedPlatform?.platform === "windows"
                      ? "bg-blue-100 border-blue-300 dark:bg-blue-900/30"
                      : ""
                  }`}
                  onClick={() => onPlatformSelect("windows")}
                >
                  <Laptop className="w-3.5 h-3.5 mr-1.5" />
                  Windows
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`text-xs h-8 px-3 ${
                    selectedPlatform?.platform === "macos"
                      ? "bg-blue-100 border-blue-300 dark:bg-blue-900/30"
                      : ""
                  }`}
                  onClick={() => onPlatformSelect("macos")}
                >
                  <Monitor className="w-3.5 h-3.5 mr-1.5" />
                  macOS
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`text-xs h-8 px-3 ${
                    selectedPlatform?.platform === "linux"
                      ? "bg-blue-100 border-blue-300 dark:bg-blue-900/30"
                      : ""
                  }`}
                  onClick={() => onPlatformSelect("linux")}
                >
                  <Monitor className="w-3.5 h-3.5 mr-1.5" />
                  Linux
                </Button>
              </div>
            </div>

            {/* 浏览器扩展 */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {tr("Browser Extensions", "浏览器扩展")}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className={`text-xs h-8 px-3 ${
                    selectedPlatform?.platform === "chrome"
                      ? "bg-indigo-100 border-indigo-300 dark:bg-indigo-900/30"
                      : ""
                  }`}
                  onClick={() => onPlatformSelect("chrome")}
                >
                  <Globe className="w-3.5 h-3.5 mr-1.5" />
                  Chrome
                </Button>
              </div>
            </div>
          </div>

          {/* 广告设置 */}
          {appUser && !(!isDomesticVersion && isIOSMobile) && (
            <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-[#565869]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-medium text-gray-900 dark:text-[#ececf1]">
                    {tr("Hide Ads", "去除广告")}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {appUser.isPaid
                      ? tr(
                          "Turn on to remove all ads during your subscription",
                          "开启后在订阅有效期内不显示广告"
                        )
                      : tr(
                          "Upgrade to Pro to enable this feature",
                          "升级到订阅计划以启用此功能"
                        )}
                  </p>
                </div>
                <Switch
                  checked={appUser?.settings?.hideAds ?? false}
                  onCheckedChange={(checked) => {
                    if (!appUser.isPaid) {
                      onUpgradeFromAds();
                      return;
                    }
                    onUpdateUserSettings({ hideAds: checked });
                  }}
                />
              </div>
              {!appUser.isPaid && (
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-start space-x-2 mb-1">
                    <Crown className="w-3.5 h-3.5 text-yellow-600" />
                    <span className="text-xs font-medium text-gray-900 dark:text-[#ececf1]">
                      {tr("Upgrade to Remove Ads", "升级以去除广告")}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                    {tr(
                      "Subscribe to unlock ad-free experience and premium features",
                      "订阅以解锁无广告体验和高级功能"
                    )}
                  </p>
                  <Button
                    size="sm"
                    className="w-full bg-yellow-600 hover:bg-yellow-700"
                    onClick={onUpgradeFromAds}
                  >
                    {tr("Upgrade Now", "立即升级")}
                  </Button>
                </div>
              )}
              {appUser.isPaid && appUser.settings?.hideAds && appUser.planExp && (
                <div className="p-2 bg-gray-50 dark:bg-[#565869] rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {tr("Subscription expires: ", "订阅到期时间：")}
                    {new Date(appUser.planExp).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex space-x-2 pt-2 flex-shrink-0 border-t border-gray-100 dark:border-[#565869]">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 border-gray-300 dark:border-[#565869]"
          >
            {tr("Close", "关闭")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
