"use client";

import React, { useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Volume2, Video, Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useIsMobile } from "@/hooks";

interface ProUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "voice" | "video" | null;
  trialCount: number;
  maxTrials: number;
  onMaybeLater: () => void;
  onUpgrade: () => void;
}

const ProUpgradeDialogClient: React.FC<ProUpgradeDialogProps> = ({
  open,
  onOpenChange,
  type,
  trialCount,
  maxTrials,
  onMaybeLater,
  onUpgrade,
}) => {
  const effectiveType = type ?? "voice";
  const isVoice = effectiveType === "voice";
  const { currentLanguage, isDomesticVersion } = useLanguage();
  const isMobile = useIsMobile();
  const isZh = currentLanguage === "zh";
  // 国内版移动端品牌名
  const brandName = isDomesticVersion && isMobile ? "晨佑 AI" : "MornGPT";
  const tr = useCallback((en: string, zh: string) => (isZh ? zh : en), [isZh]);

  const benefits = useMemo(
    () => [
      isVoice
        ? tr("Unlimited voice chat sessions", "不限次数语音聊天")
        : tr("Unlimited video chat sessions", "不限次数视频聊天"),
      tr("Priority processing and faster responses", "更高优先级与更快响应"),
      tr("Access to all premium AI models", "访问全部高级 AI 模型"),
    ],
    [isVoice, tr]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] rounded-2xl sm:rounded-3xl shadow-md data-[state=open]:animate-none data-[state=closed]:animate-none transition-none">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <Crown className="w-5 h-5 text-purple-500" />
            <span>{tr(`Choose Your ${brandName} Plan`, `选择你的 ${brandName} 套餐`)}</span>
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            {tr(
              isVoice
                ? "Unlock unlimited Pro Voice Chat with AI"
                : "Unlock unlimited Pro Video Chat with AI",
              isVoice ? "解锁不限量的 Pro 语音聊天" : "解锁不限量的 Pro 视频聊天"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
            <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg">
              {isVoice ? (
                <Volume2 className="w-5 h-5 text-purple-600 dark:text-purple-300" />
              ) : (
                <Video className="w-5 h-5 text-purple-600 dark:text-purple-300" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-[#ececf1]">
                {tr("Pro Features", "Pro 专属功能")}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {tr("Faster responses · Premium models · No limits", "更快响应 · 高级模型 · 不限次数")}
              </p>
            </div>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-[#565869] rounded-lg">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>
                {tr(
                  `${isVoice ? "Voice" : "Video"} trials used`,
                  `${isVoice ? "语音" : "视频"}试用已用`
                )}
              </span>
              <span className="font-semibold text-gray-900 dark:text-[#ececf1]">
                {trialCount}/{maxTrials}
              </span>
            </div>
            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full"
                style={{ width: `${(trialCount / maxTrials) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-[#ececf1]">{tr("What you get", "你将获得")}</h4>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="flex space-x-2 pt-2">
          <Button variant="outline" onClick={onMaybeLater} className="flex-1">
            {tr("Maybe later", "以后再说")}
          </Button>
          <Button onClick={onUpgrade} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white">
            {tr("Upgrade now", "立即升级")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProUpgradeDialogClient;
