import React from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Video, MapPin, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { createLocalizedTextGetter } from "@/lib/localization";

interface StatusIndicatorsProps {
  isRecording: boolean;
  isProVoiceChatActive: boolean;
  stopProVoiceChat: () => void;
  isProVideoChatActive: boolean;
  stopProVideoChat: () => void;
  currentLocation: any;
  clearLocation: () => void;
}

export function StatusIndicators({
  isRecording,
  isProVoiceChatActive,
  stopProVoiceChat,
  isProVideoChatActive,
  stopProVideoChat,
  currentLocation,
  clearLocation,
}: StatusIndicatorsProps) {
  const { currentLanguage } = useLanguage();
  const t = React.useMemo(() => createLocalizedTextGetter(currentLanguage), [currentLanguage]);

  return (
    <>
      {/* Voice Recording Indicator */}
      {isRecording && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <p className="text-xs text-red-600 dark:text-red-400">
              Voice recording active... Speak now
            </p>
          </div>
        </div>
      )}

      {/* Pro Voice Chat Indicator */}
      {isProVoiceChatActive && (
        <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
              <Volume2 className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              <p className="text-xs text-purple-600 dark:text-purple-400">
                {t("proVoiceChat")} {currentLanguage === "zh" ? "进行中，AI 正在聆听" : "active... AI is listening"}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={stopProVoiceChat}
              className="h-4 w-4 p-0 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30"
              title={t("stopProVoiceChat")}
            >
              <X className="w-2 h-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Pro Video Chat Indicator */}
      {isProVideoChatActive && (
        <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
              <Video className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              <p className="text-xs text-purple-600 dark:text-purple-400">
                {t("proVideoChat")}{" "}
                {currentLanguage === "zh" ? "进行中，AI 正在观看并聆听" : "active... AI is watching and listening"}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={stopProVideoChat}
              className="h-4 w-4 p-0 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30"
              title={t("stopProVideoChat")}
            >
              <X className="w-2 h-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Location Indicator */}
      {currentLocation && (
        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MapPin className="w-3 h-3 text-green-600 dark:text-green-400" />
              <p className="text-xs text-green-600 dark:text-green-400">
                {currentLanguage === "zh" ? "已添加位置信息" : "Location added to prompt"}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearLocation}
              className="h-4 w-4 p-0 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
              title={currentLanguage === "zh" ? "移除定位" : "Remove location"}
            >
              <X className="w-2 h-2" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
