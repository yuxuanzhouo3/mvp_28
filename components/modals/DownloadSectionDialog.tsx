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

interface Platform {
  platform: string;
  variant?: string;
}

interface AppUser {
  settings?: {
    adsEnabled?: boolean;
    hideAds?: boolean; // 订阅用户是否开启去除广告功能
  };
  isPro?: boolean;
  planExp?: string; // 订阅到期时间
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
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";
  const tr = useCallback((en: string, zh: string) => (isZh ? zh : en), [isZh]);

  const isBrowser = (p?: string | null) =>
    !!p &&
    ["chrome", "firefox", "edge", "opera", "safari"].includes(p.toLowerCase());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-screen overflow-y-auto bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] data-[state=open]:animate-none data-[state=closed]:animate-none transition-none">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <Download className="w-5 h-5 text-blue-600" />
            <span>{tr("Download MornGPT", "下载 MornGPT")}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 平台选择 */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
              {tr("Select Your Platform", "选择你的平台")}
            </h3>

            {selectedPlatform && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      {selectedPlatform.platform.toUpperCase()}
                      {selectedPlatform.variant &&
                        ` - ${selectedPlatform.variant.toUpperCase()}`}
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
                    {isBrowser(selectedPlatform.platform)
                      ? tr("Install Now", "立即安装")
                      : tr("Download Now", "立即下载")}
                  </Button>
                </div>
              </div>
            )}

            {/* 移动端 */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {tr("Mobile Apps", "移动端")}
              </h4>

              <div className="p-2 bg-gray-50 dark:bg-[#565869] rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
                        {tr("Mobile", "移动端")}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {tr("iOS & Android", "iOS 与 Android")}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className={`text-xs h-7 px-2 ${
                      selectedPlatform?.platform === "ios" ||
                      selectedPlatform?.platform === "android"
                        ? "bg-purple-700 border-2 border-purple-300"
                        : "bg-purple-600 hover:bg-purple-700"
                    }`}
                    onClick={() => {
                      if (
                        selectedPlatform?.platform === "ios" ||
                        selectedPlatform?.platform === "android"
                      ) {
                        onPlatformSelect("");
                      } else {
                        onPlatformSelect("ios");
                      }
                    }}
                  >
                    {selectedPlatform?.platform === "ios" ||
                    selectedPlatform?.platform === "android"
                      ? tr("Selected", "已选择")
                      : tr("Select", "选择")}
                  </Button>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {tr(
                      "iOS 14.0+ · Android 8.0+ · 45-50MB",
                      "iOS 14.0+ · Android 8.0+ · 45-50MB"
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-5 px-1 ${
                        selectedPlatform?.platform === "ios"
                          ? "bg-purple-100 border-purple-300"
                          : ""
                      }`}
                      onClick={() => onPlatformSelect("ios")}
                    >
                      iOS
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-5 px-1 ${
                        selectedPlatform?.platform === "android"
                          ? "bg-purple-100 border-purple-300"
                          : ""
                      }`}
                      onClick={() => onPlatformSelect("android")}
                    >
                      Android
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 桌面端 */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {tr("Desktop Apps", "桌面端")}
              </h4>

              {/* macOS */}
              <div className="p-2 bg-gray-50 dark:bg-[#565869] rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <Monitor className="w-4 h-4 text-gray-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
                        macOS
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {tr("Desktop App", "桌面应用")}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className={`text-xs h-7 px-2 ${
                      selectedPlatform?.platform === "macos"
                        ? "bg-gray-700 border-2 border-gray-300"
                        : "bg-gray-600 hover:bg-gray-700"
                    }`}
                    onClick={() => {
                      if (selectedPlatform?.platform === "macos") {
                        onPlatformSelect("");
                      } else {
                        onPlatformSelect("macos", "intel");
                      }
                    }}
                  >
                    {selectedPlatform?.platform === "macos"
                      ? tr("Selected", "已选择")
                      : tr("Select", "选择")}
                  </Button>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    macOS 11.0+ · 65MB
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-5 px-1 ${
                        selectedPlatform?.platform === "macos" &&
                        selectedPlatform?.variant === "intel"
                          ? "bg-blue-100 border-blue-300"
                          : ""
                      }`}
                      onClick={() => onPlatformSelect("macos", "intel")}
                    >
                      {tr("macOS (Intel)", "macOS（Intel）")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-5 px-1 ${
                        selectedPlatform?.platform === "macos" &&
                        selectedPlatform?.variant === "m"
                          ? "bg-blue-100 border-blue-300"
                          : ""
                      }`}
                      onClick={() => onPlatformSelect("macos", "m")}
                    >
                      {tr("macOS (Apple Silicon)", "macOS（Apple 芯片）")}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Windows */}
              <div className="p-2 bg-gray-50 dark:bg-[#565869] rounded-lg min-w-[340px]">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <Laptop className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
                        Windows
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {tr("Desktop App", "桌面应用")}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className={`text-xs h-7 px-2 ${
                      selectedPlatform?.platform === "windows"
                        ? "bg-blue-700 border-2 border-blue-300"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                    onClick={() => {
                      if (selectedPlatform?.platform === "windows") {
                        onPlatformSelect("");
                      } else {
                        onPlatformSelect("windows", "x64");
                      }
                    }}
                  >
                    {selectedPlatform?.platform === "windows"
                      ? tr("Selected", "已选择")
                      : tr("Select", "选择")}
                  </Button>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Windows 10+ · 60MB
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-5 px-1 ${
                        selectedPlatform?.platform === "windows" &&
                        selectedPlatform?.variant === "x64"
                          ? "bg-blue-100 border-blue-300"
                          : ""
                      }`}
                      onClick={() => onPlatformSelect("windows", "x64")}
                    >
                      x64
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-5 px-1 ${
                        selectedPlatform?.platform === "windows" &&
                        selectedPlatform?.variant === "x86"
                          ? "bg-blue-100 border-blue-300"
                          : ""
                      }`}
                      onClick={() => onPlatformSelect("windows", "x86")}
                    >
                      x86
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-5 px-1 ${
                        selectedPlatform?.platform === "windows" &&
                        selectedPlatform?.variant === "arm64"
                          ? "bg-blue-100 border-blue-300"
                          : ""
                      }`}
                      onClick={() => onPlatformSelect("windows", "arm64")}
                    >
                      ARM64
                    </Button>
                  </div>
                </div>
              </div>

              {/* Linux */}
              <div className="p-2 bg-gray-50 dark:bg-[#565869] rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <Monitor className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
                        Linux
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {tr("Desktop App", "桌面应用")}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className={`text-xs h-7 px-2 ${
                      selectedPlatform?.platform === "linux"
                        ? "bg-green-700 border-2 border-green-300"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                    onClick={() => {
                      if (selectedPlatform?.platform === "linux") {
                        onPlatformSelect("");
                      } else {
                        onPlatformSelect("linux", "deb");
                      }
                    }}
                  >
                    {selectedPlatform?.platform === "linux"
                      ? tr("Selected", "已选择")
                      : tr("Select", "选择")}
                  </Button>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Ubuntu 20.04+ · 55MB
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-5 px-1 ${
                        selectedPlatform?.platform === "linux" &&
                        selectedPlatform?.variant === "deb"
                          ? "bg-green-100 border-green-300"
                          : ""
                      }`}
                      onClick={() => onPlatformSelect("linux", "deb")}
                    >
                      {tr("Debian/Ubuntu (.deb)", "Debian/Ubuntu (.deb)")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-5 px-1 ${
                        selectedPlatform?.platform === "linux" &&
                        selectedPlatform?.variant === "appimage"
                          ? "bg-green-100 border-green-300"
                          : ""
                      }`}
                      onClick={() => onPlatformSelect("linux", "appimage")}
                    >
                      AppImage
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-5 px-1 ${
                        selectedPlatform?.platform === "linux" &&
                        selectedPlatform?.variant === "snap"
                          ? "bg-green-100 border-green-300"
                          : ""
                      }`}
                      onClick={() => onPlatformSelect("linux", "snap")}
                    >
                      Snap
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-5 px-1 ${
                        selectedPlatform?.platform === "linux" &&
                        selectedPlatform?.variant === "flatpak"
                          ? "bg-green-100 border-green-300"
                          : ""
                      }`}
                      onClick={() => onPlatformSelect("linux", "flatpak")}
                    >
                      Flatpak
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-5 px-1 ${
                        selectedPlatform?.platform === "linux" &&
                        selectedPlatform?.variant === "aur"
                          ? "bg-green-100 border-green-300"
                          : ""
                      }`}
                      onClick={() => onPlatformSelect("linux", "aur")}
                    >
                      AUR
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 浏览器扩展 */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {tr("Browser Extensions", "浏览器扩展")}
              </h4>

              <div className="p-2 bg-gray-50 dark:bg-[#565869] rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-indigo-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
                        {tr("Browser Extensions", "浏览器扩展")}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {tr("All Major Browsers", "适配主流浏览器")}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className={`text-xs h-7 px-2 ${
                      isBrowser(selectedPlatform?.platform || "")
                        ? "bg-indigo-700 border-2 border-indigo-300"
                        : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                    onClick={() => {
                      if (isBrowser(selectedPlatform?.platform)) {
                        onPlatformSelect("");
                      } else {
                        onPlatformSelect("chrome");
                      }
                    }}
                  >
                    {isBrowser(selectedPlatform?.platform || "")
                      ? tr("Selected", "已选择")
                      : tr("Select", "选择")}
                  </Button>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {tr("Free · All Major Browsers", "免费 · 适配主流浏览器")}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-5 px-1 ${
                        selectedPlatform?.platform === "chrome"
                          ? "bg-indigo-100 border-indigo-300"
                          : ""
                      }`}
                      onClick={() => onPlatformSelect("chrome")}
                    >
                      Chrome
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-5 px-1 ${
                        selectedPlatform?.platform === "firefox"
                          ? "bg-indigo-100 border-indigo-300"
                          : ""
                      }`}
                      onClick={() => onPlatformSelect("firefox")}
                    >
                      Firefox
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-5 px-1 ${
                        selectedPlatform?.platform === "edge"
                          ? "bg-indigo-100 border-indigo-300"
                          : ""
                      }`}
                      onClick={() => onPlatformSelect("edge")}
                    >
                      Edge
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-5 px-1 ${
                        selectedPlatform?.platform === "opera"
                          ? "bg-indigo-100 border-indigo-300"
                          : ""
                      }`}
                      onClick={() => onPlatformSelect("opera")}
                    >
                      Opera
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-5 px-1 ${
                        selectedPlatform?.platform === "safari"
                          ? "bg-indigo-100 border-indigo-300"
                          : ""
                      }`}
                      onClick={() => onPlatformSelect("safari")}
                    >
                      Safari
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 广告设置 */}
          {appUser && (
            <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-[#565869]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
                    {tr("Hide Ads", "去除广告")}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {appUser.isPro
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
                    // Free 用户点击开关时跳转到订阅页面
                    if (!appUser.isPro) {
                      onUpgradeFromAds();
                      return;
                    }
                    // 订阅用户正常切换
                    onUpdateUserSettings({ hideAds: checked });
                  }}
                />
              </div>
              {/* 非订阅用户提示升级 */}
              {!appUser.isPro && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-start space-x-2 mb-2">
                    <Crown className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
                      {tr("Upgrade to Remove Ads", "升级以去除广告")}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
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
              {/* 订阅用户开启了去除广告但快到期时提示 */}
              {appUser.isPro && appUser.settings?.hideAds && appUser.planExp && (
                <div className="p-2 bg-gray-50 dark:bg-[#565869] rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {tr("Subscription expires: ", "订阅到期时间：")}
                    {new Date(appUser.planExp).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex space-x-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-gray-300 dark:border-[#565869]"
            >
              {tr("Close", "关闭")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
