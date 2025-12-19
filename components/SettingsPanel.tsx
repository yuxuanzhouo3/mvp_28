// SettingsPanel component - handles user settings UI
import React from "react";
import { AppUser, UserSettings } from "../types";
import { useLanguage } from "@/context/LanguageContext";
import { createLocalizedTextGetter } from "@/lib/localization";

interface SettingsPanelProps {
  user: AppUser | null;
  userSettings: UserSettings;
  onUpdateSettings: (settings: Partial<UserSettings>) => void;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  user,
  userSettings,
  onUpdateSettings,
  onClose,
}) => {
  const { currentLanguage } = useLanguage();
  const t = createLocalizedTextGetter(currentLanguage);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">{t("settingsTitle")}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6">
            {/* Theme Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("themeLabel")}
              </label>
              <select
                value={userSettings.theme}
                onChange={(e) =>
                  onUpdateSettings({ theme: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="light">{t("themeLight")}</option>
                <option value="dark">{t("themeDark")}</option>
                <option value="auto">{t("themeSystem")}</option>
              </select>
            </div>

            {/* Language Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("languageLabel")}
              </label>
              <select
                value={userSettings.language}
                onChange={(e) => onUpdateSettings({ language: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="en">{t("languageEnglish")}</option>
                <option value="zh">{t("languageChinese")}</option>
              </select>
            </div>

            {/* Notification Settings */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                {t("notificationsLabel")}
              </label>
              <input
                type="checkbox"
                checked={userSettings.notifications}
                onChange={(e) =>
                  onUpdateSettings({ notifications: e.target.checked })
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>

            {/* Sound Settings */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                {t("soundLabel")}
              </label>
              <input
                type="checkbox"
                checked={userSettings.soundEnabled}
                onChange={(e) =>
                  onUpdateSettings({ soundEnabled: e.target.checked })
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>

            {/* Auto Save Settings */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                {t("autoSaveLabel")}
              </label>
              <input
                type="checkbox"
                checked={userSettings.autoSave}
                onChange={(e) =>
                  onUpdateSettings({ autoSave: e.target.checked })
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>

            {/* Send Hotkey Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("sendHotkeyLabel")}
              </label>
              <select
                value={userSettings.sendHotkey || "enter"}
                onChange={(e) =>
                  onUpdateSettings({ sendHotkey: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="enter">{t("enterOption")}</option>
                <option value="shift+enter">{t("shiftEnterOption")}</option>
                <option value="ctrl+enter">{t("ctrlEnterOption")}</option>
                <option value="cmd+enter">{t("cmdEnterOption")}</option>
              </select>
            </div>

            {/* Ads Settings */}
            {user?.isPro && (
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  {t("showAds")}
                </label>
                <input
                  type="checkbox"
                  checked={userSettings.adsEnabled ?? false}
                  onChange={(e) =>
                    onUpdateSettings({ adsEnabled: e.target.checked })
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              {t("close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
