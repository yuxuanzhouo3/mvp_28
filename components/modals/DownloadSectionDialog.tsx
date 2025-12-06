"use client";

import React from "react";
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

interface Platform {
  platform: string;
  variant?: string;
}

interface AppUser {
  settings?: {
    adsEnabled?: boolean;
  };
  isPro?: boolean;
}

interface DownloadSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPlatform: Platform | null;
  appUser: AppUser | null;
  onPlatformSelect: (platform: string, variant?: string) => void;
  onDownload: () => void;
  onUpdateUserSettings: (settings: { adsEnabled: boolean }) => void;
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-screen overflow-y-auto bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] data-[state=open]:animate-none data-[state=closed]:animate-none transition-none">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <Download className="w-5 h-5 text-blue-600" />
            <span>Download MornGPT</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Platform Downloads */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
              Select Your Platform
            </h3>

            {/* Selected Platform Display */}
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
                      Ready to download
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={onDownload}
                  >
                    {selectedPlatform &&
                    ["chrome", "firefox", "edge", "opera", "safari"].includes(
                      selectedPlatform.platform
                    )
                      ? "Install Now"
                      : "Download Now"}
                  </Button>
                </div>
              </div>
            )}

            {/* Mobile Apps */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Mobile Apps
              </h4>

              <div className="p-2 bg-gray-50 dark:bg-[#565869] rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
                        Mobile
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        iOS & Android
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
                        onPlatformSelect(""); // Clear selection
                      } else {
                        onPlatformSelect("ios");
                      }
                    }}
                  >
                    {selectedPlatform?.platform === "ios" ||
                    selectedPlatform?.platform === "android"
                      ? "Selected"
                      : "Select"}
                  </Button>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    iOS 14.0+ • Android 8.0+ • 45-50MB
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

            {/* Desktop Apps */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Desktop Apps
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
                        Desktop App
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
                        onPlatformSelect(""); // Clear selection
                      } else {
                        onPlatformSelect("macos", "intel");
                      }
                    }}
                  >
                    {selectedPlatform?.platform === "macos"
                      ? "Selected"
                      : "Select"}
                  </Button>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    macOS 11.0+ • 65MB
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
                      Intel
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
                      M Series
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
                        Desktop App
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
                        onPlatformSelect(""); // Clear selection
                      } else {
                        onPlatformSelect("windows", "x64");
                      }
                    }}
                  >
                    {selectedPlatform?.platform === "windows"
                      ? "Selected"
                      : "Select"}
                  </Button>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Windows 10+ • 60MB
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
                        Desktop App
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
                        onPlatformSelect(""); // Clear selection
                      } else {
                        onPlatformSelect("linux", "deb");
                      }
                    }}
                  >
                    {selectedPlatform?.platform === "linux"
                      ? "Selected"
                      : "Select"}
                  </Button>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Ubuntu 20.04+ • 55MB
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
                      .deb
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

            {/* Browser Extensions */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Browser Extensions
              </h4>

              <div className="p-2 bg-gray-50 dark:bg-[#565869] rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-indigo-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
                        Browser Extensions
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        All Major Browsers
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className={`text-xs h-7 px-2 ${
                      selectedPlatform &&
                      ["chrome", "firefox", "edge", "opera", "safari"].includes(
                        selectedPlatform.platform
                      )
                        ? "bg-indigo-700 border-2 border-indigo-300"
                        : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                    onClick={() => {
                      if (
                        selectedPlatform &&
                        [
                          "chrome",
                          "firefox",
                          "edge",
                          "opera",
                          "safari",
                        ].includes(selectedPlatform.platform)
                      ) {
                        onPlatformSelect(""); // Clear selection
                      } else {
                        onPlatformSelect("chrome");
                      }
                    }}
                  >
                    {selectedPlatform &&
                    ["chrome", "firefox", "edge", "opera", "safari"].includes(
                      selectedPlatform.platform
                    )
                      ? "Selected"
                      : "Select"}
                  </Button>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Free • All Major Browsers
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

          {/* Ads Section (for all users) */}
          {appUser && (
            <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-[#565869]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
                  Advertisement
                </h3>
                <Switch
                  checked={appUser?.settings?.adsEnabled ?? false}
                  onCheckedChange={(checked) =>
                    onUpdateUserSettings({ adsEnabled: checked })
                  }
                />
              </div>
              {(appUser?.settings?.adsEnabled ?? false) && !appUser.isPro && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-start space-x-2 mb-2">
                    <Crown className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
                      Upgrade
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    Remove ads and unlock premium features
                  </p>
                  <Button
                    size="sm"
                    className="w-full bg-yellow-600 hover:bg-yellow-700"
                    onClick={onUpgradeFromAds}
                  >
                    Upgrade Now
                  </Button>
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
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
