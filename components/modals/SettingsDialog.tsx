import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Crown,
  Keyboard,
  Settings,
  RefreshCw,
  Upload,
  Download,
  X,
  Navigation,
  Bot,
  MessageSquare,
  Check,
  Edit3,
  ShieldIcon,
  Lock,
  AlertTriangle,
  CreditCard,
  Video,
  Volume2,
  LogOut,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { createLocalizedTextGetter } from "@/lib/localization";
import { useIsIOSMobile } from "@/hooks";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditingProfile: boolean;
  userProfileForm: { name: string; email: string; bio: string };
  setUserProfileForm: React.Dispatch<React.SetStateAction<{ name: string; email: string; bio: string }>>;
  saveUserProfile: () => void;
  cancelEditingProfile: () => void;
  isDarkMode: boolean;
  onThemeChange: (mode: "light" | "dark") => void;
  fontFamily: string;
  fontSize: string;
  onFontFamilyChange: (font: string) => void;
  onFontSizeChange: (size: string) => void;
  appUser: any;
  currentPlan: string | null;
  setShowUpgradeDialog: (show: boolean) => void;
  updateUserSettings: (settings: any) => void;
  shortcutsEnabled: boolean;
  setShortcutsEnabled: (enabled: boolean) => void;
  setShowShortcutsHelp: (show: boolean) => void;
  setShowBillingDialog: (show: boolean) => void;
  setShowPrivacyDialog: (show: boolean) => void;
  onLanguageChange: (lang: string) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onOpenChange,
  isEditingProfile,
  userProfileForm,
  setUserProfileForm,
  saveUserProfile,
  cancelEditingProfile,
  isDarkMode,
  onThemeChange,
  fontFamily,
  fontSize,
  onFontFamilyChange,
  onFontSizeChange,
  appUser,
  currentPlan,
  setShowUpgradeDialog,
  updateUserSettings,
  shortcutsEnabled,
  setShortcutsEnabled,
  setShowShortcutsHelp,
  setShowBillingDialog,
  setShowPrivacyDialog,
  onLanguageChange,
}) => {
  const { currentLanguage, setCurrentLanguage, isDomesticVersion } = useLanguage();
  const isIOSMobile = useIsIOSMobile();
  const t = createLocalizedTextGetter(currentLanguage);
  const openSubDialog = (openFn: () => void) => {
    openFn();
    // defer closing current dialog to next frame to avoid flicker
    requestAnimationFrame(() => onOpenChange(false));
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg bg-gradient-to-br from-white to-gray-50 dark:from-[#40414f] dark:to-[#2d2d30] border-gray-200 dark:border-[#565869] shadow-2xl rounded-2xl sm:rounded-3xl data-[state=open]:animate-none data-[state=closed]:animate-none transition-none">
        <DialogHeader className="pb-3 sm:pb-4">
          <DialogTitle className="sr-only">{t("settingsTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 py-1 px-1 sm:px-0">
          {/* Username Section - Moved Up */}
          {isEditingProfile && (
            <div className="bg-white dark:bg-[#40414f] rounded-xl p-4 border border-gray-100 dark:border-[#565869] shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label
                    htmlFor="name"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {t("username")}
                  </Label>
                  <Input
                    id="name"
                    value={userProfileForm.name}
                    onChange={(e) =>
                      setUserProfileForm({
                        ...userProfileForm,
                        name: e.target.value,
                      })
                    }
                    className="mt-1 bg-white dark:bg-[#40414f] border-gray-300 dark:border-[#565869] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t("username")}
                  />
                </div>
                <div className="flex flex-col space-y-1 ml-4">
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    onClick={saveUserProfile}
                  >
                    {t("save")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869] shadow-sm"
                    onClick={cancelEditingProfile}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 5 Organized Settings Sections - 2 Column Layout - Compact */}
          <div className="flex flex-col space-y-2">
            {/* Account Section - Outside */}
            <div className="bg-white dark:bg-[#40414f] rounded-lg p-3 border border-gray-100 dark:border-[#565869] shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-shrink-0 min-w-0 flex-1">
                  <Label className="text-sm text-gray-700 dark:text-gray-300">
                    {t("account")}
                  </Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {!isDomesticVersion && isIOSMobile ? (currentLanguage === "zh" ? "个人资料" : "Your profile") : t("profileSubtitle")}
                  </p>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <span className="text-sm text-gray-900 dark:text-[#ececf1] truncate max-w-[120px] sm:max-w-[180px]" title={appUser?.email}>
                    {appUser?.email}
                  </span>
                  <div className="w-4 h-4 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                      {appUser?.isPaid
                        ? currentPlan === "Basic"
                          ? "B"
                          : currentPlan === "Pro"
                          ? "P"
                          : currentPlan === "Enterprise"
                          ? "E"
                          : "$"
                        : "F"}
                    </span>
                  </div>
                  {!isDomesticVersion && !isIOSMobile && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-6 h-6 p-0 bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700 flex-shrink-0"
                      onClick={() => setShowUpgradeDialog(true)}
                    >
                      <Crown className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Settings Section */}
            <div className="bg-white dark:bg-[#40414f] rounded-lg p-3 border border-gray-100 dark:border-[#565869] shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm text-gray-700 dark:text-gray-300">
                      {t("themeLabel")}
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t("themeDescription")}
                    </p>
                  </div>
                  <Select
                    value={isDarkMode ? "dark" : "light"}
                    onValueChange={(value) => {
                      if (value === "light" || value === "dark") onThemeChange(value);
                    }}
                  >
                    <SelectTrigger className="w-32 h-7 bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]">
                      <span className="text-xs">
                        {isDarkMode ? t("themeDark") : t("themeLight")}
                      </span>
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
                      <SelectItem
                        value="light"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        {t("themeLight")}
                      </SelectItem>
                      <SelectItem
                        value="dark"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        {t("themeDark")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm text-gray-700 dark:text-gray-300">
                      {t("languageLabel")}
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t("languageDescription")}
                    </p>
                  </div>
                  <Select
                    value={currentLanguage}
                    onValueChange={(value) => {
                      // Update language in context
                      setCurrentLanguage(value);
                      onLanguageChange(value);
                    }}
                  >
                    <SelectTrigger className="w-32 h-7 bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]">
                      <span className="text-xs">{currentLanguage.toUpperCase()}</span>
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
                      <SelectItem
                        value="en"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        {t("languageEnglish")}
                      </SelectItem>
                      <SelectItem
                        value="zh"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        {t("languageChinese")}
                      </SelectItem>
                      <SelectItem
                        value="es"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        Español (Spanish)
                      </SelectItem>
                      <SelectItem
                        value="fr"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        Français (French)
                      </SelectItem>
                      <SelectItem
                        value="de"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        Deutsch (German)
                      </SelectItem>
                      <SelectItem
                        value="ja"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        日本語 (Japanese)
                      </SelectItem>
                      <SelectItem
                        value="ko"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        한국어 (Korean)
                      </SelectItem>
                      <SelectItem
                        value="pt"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        Português (Portuguese)
                      </SelectItem>
                      <SelectItem
                        value="ru"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        Русский (Russian)
                      </SelectItem>
                      <SelectItem
                        value="ar"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        العربية (Arabic)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm text-gray-700 dark:text-gray-300">
                      {t("fontFamily")}
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t("fontFamilyDescription")}
                    </p>
                  </div>
                  <Select value={fontFamily} onValueChange={onFontFamilyChange}>
                    <SelectTrigger className="w-32 h-7 bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]">
                      <span className="text-xs">
                        {
                          {
                            arial: "Arial",
                            helvetica: "Helvetica",
                            times: "Times New Roman",
                            georgia: "Georgia",
                            verdana: "Verdana",
                            courier: "Courier New",
                          }[fontFamily] || "Default"
                        }
                      </span>
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
                      <SelectItem
                        value="arial"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        Arial
                      </SelectItem>
                      <SelectItem
                        value="helvetica"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        Helvetica
                      </SelectItem>
                      <SelectItem
                        value="times"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        Times New Roman
                      </SelectItem>
                      <SelectItem
                        value="georgia"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        Georgia
                      </SelectItem>
                      <SelectItem
                        value="verdana"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        Verdana
                      </SelectItem>
                      <SelectItem
                        value="courier"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        Courier New
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm text-gray-700 dark:text-gray-300">
                      {t("fontSize")}
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t("fontSizeDescription")}
                    </p>
                  </div>
                  <Select value={fontSize} onValueChange={onFontSizeChange}>
                    <SelectTrigger className="w-32 h-7 bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]">
                      <span className="text-xs">{fontSize}px</span>
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
                      <SelectItem
                        value="12"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        12px
                      </SelectItem>
                      <SelectItem
                        value="14"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        14px
                      </SelectItem>
                      <SelectItem
                        value="16"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        16px
                      </SelectItem>
                      <SelectItem
                        value="18"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        18px
                      </SelectItem>
                      <SelectItem
                        value="20"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        20px
                      </SelectItem>
                      <SelectItem
                        value="24"
                        className="text-xs text-gray-900 dark:text-[#ececf1]"
                      >
                        24px
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!(!isDomesticVersion && isIOSMobile) && (
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm text-gray-700 dark:text-gray-300">
                        {t("turnOffAds")}
                      </Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {appUser?.isPaid ? t("billingDescription") : t("proFeatureOnly")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-32 h-7 bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]"
                      onClick={() => {
                        if (!appUser?.isPaid) {
                          // Free 用户点击时弹出订阅弹窗
                          setShowUpgradeDialog(true);
                        } else {
                          // 订阅用户（Basic/Pro/Enterprise）正常切换
                          updateUserSettings({
                            hideAds: !(appUser?.settings?.hideAds ?? false),
                          });
                        }
                      }}
                    >
                      <span className="text-xs">
                        {appUser?.settings?.hideAds ?? false
                          ? t("turnOnAds")
                          : t("turnOffAds")}
                      </span>
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm text-gray-700 dark:text-gray-300">
                      {t("hotkeysTitle")}
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t("hotkeysDescription")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-32 h-7 bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]"
                    onClick={() => openSubDialog(() => setShowShortcutsHelp(true))}
                  >
                    <span className="text-xs">
                      {shortcutsEnabled ? t("enabled") : t("disabled")}
                    </span>
                  </Button>
                </div>
                {!(!isDomesticVersion && isIOSMobile) && (
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm text-gray-700 dark:text-gray-300">
                        {t("billing")}
                      </Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t("billingDescription")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-32 h-7 bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]"
                      onClick={() => openSubDialog(() => setShowBillingDialog(true))}
                    >
                      <span className="text-xs">{t("billing")}</span>
                    </Button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm text-gray-700 dark:text-gray-300">
                      {t("privacy")}
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t("privacyDescription")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-32 h-7 bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]"
                    onClick={() => openSubDialog(() => setShowPrivacyDialog(true))}
                  >
                    <span className="text-xs">{t("settingsTitle")}</span>
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm text-gray-700 dark:text-gray-300">
                      {t("support")}
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t("supportDescription")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-32 h-7 bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]"
                  >
                    <span className="text-xs">{t("support")}</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
