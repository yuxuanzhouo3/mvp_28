"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { Image, Video, MessageSquare, Zap, AlertCircle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import {
  ADVANCED_MULTIMODAL_MODELS,
  EXTERNAL_MODELS,
  GENERAL_MODELS,
} from "@/utils/model-limits";

// =============================================================================
// 类型定义
// =============================================================================

interface QuotaData {
  plan: string;
  period?: string | null;
  used?: number;
  limit?: number | null;
  remaining?: number | null;
  quotaType?: string;
  modelCategory?: string | null;
  contextMsgLimit?: number | null;
  displayText?: string;
  // 月度媒体配额 (高级多模态模型)
  photoUsed?: number;
  photoLimit?: number;
  photoRemaining?: number;
  videoAudioUsed?: number;
  videoAudioLimit?: number;
  videoAudioRemaining?: number;
  textConsumesDaily?: boolean;
  // 完整配额信息 (无特定模型时)
  daily?: {
    period: string;
    used: number;
    limit: number;
    remaining: number;
  };
  monthlyMedia?: {
    period: string;
    photoUsed: number;
    photoLimit: number;
    photoRemaining: number;
    videoAudioUsed: number;
    videoAudioLimit: number;
    videoAudioRemaining: number;
  };
}

interface QuotaDisplayProps {
  selectedModel: string;
  appUser: any;
  currentPlan?: string;
  className?: string;
  onQuotaExceeded?: (quotaType: string) => void;
}

// =============================================================================
// 模型分类判断 (前端版本)
// =============================================================================

function getModelCategory(modelId: string): "general" | "external" | "advanced_multimodal" | "unknown" {
  const id = modelId.toLowerCase();
  if (GENERAL_MODELS.some(m => m.toLowerCase() === id)) return "general";
  if (EXTERNAL_MODELS.some(m => m.toLowerCase() === id)) return "external";
  if (ADVANCED_MULTIMODAL_MODELS.some(m => m.toLowerCase() === id)) return "advanced_multimodal";
  return "unknown";
}

// =============================================================================
// 主组件
// =============================================================================

export function QuotaDisplay({
  selectedModel,
  appUser,
  currentPlan,
  className = "",
  onQuotaExceeded,
}: QuotaDisplayProps) {
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";
  
  const [quotaData, setQuotaData] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取配额信息
  const fetchQuota = useCallback(async () => {
    if (!appUser) {
      setQuotaData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = selectedModel
        ? `/api/account/quota?modelId=${encodeURIComponent(selectedModel)}`
        : "/api/account/quota";
      
      const res = await fetch(url, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch quota: ${res.status}`);
      }

      const data = await res.json();
      setQuotaData(data);

      // 检查配额是否超限
      const remainingForCheck =
        typeof data?.remaining === "number"
          ? data.remaining
          : typeof data?.daily?.remaining === "number"
            ? data.daily.remaining
            : null;
      if (
        onQuotaExceeded &&
        data.quotaType !== "unlimited" &&
        remainingForCheck === 0
      ) {
        const quotaTypeHint =
          data.quotaType === "monthly_media" && data.daily ? "daily" : data.quotaType;
        onQuotaExceeded(quotaTypeHint);
      }
    } catch (err) {
      console.error("Quota fetch error:", err);
      setError(isZh ? "获取配额失败" : "Failed to fetch quota");
    } finally {
      setLoading(false);
    }
  }, [appUser, selectedModel, isZh, onQuotaExceeded]);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  // 刷新配额的公开方法
  const refreshQuota = useCallback(() => {
    fetchQuota();
  }, [fetchQuota]);

  // 未登录或加载中
  if (!appUser) {
    return null;
  }

  // 计划判断
  const planLower = (currentPlan || quotaData?.plan || "").toLowerCase();
  const isEnterprise = planLower === "enterprise";
  const isProLimited = planLower === "pro" || planLower === "enterprise";
  const isBasic = planLower === "basic";
  const isFree = !isEnterprise && !isProLimited && !isBasic;

  // Free / Basic 用户：根据模型类型显示不同配额
  if ((isFree || isBasic || isProLimited) && quotaData) {
    const modelCategory = getModelCategory(selectedModel);

    // 通用模型：无限畅聊
    if (modelCategory === "general") {
      return (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={`text-xs px-2 py-0.5 border-0 bg-gradient-to-r from-green-400 to-emerald-500 text-white cursor-pointer ${className}`}
              >
                <Zap className="w-3 h-3 mr-1" />
                {isZh ? "无限畅聊" : "Unlimited"}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-xs">
              <div className="space-y-2">
                <div className="font-semibold flex items-center">
                  <Zap className="w-4 h-4 mr-1 text-green-500" />
                  {isZh ? "通用模型 - 无限制" : "General Model - Unlimited"}
                </div>
                <div className="text-gray-600 dark:text-gray-300">
                  {isZh
                    ? "该模型属于通用模型，Free 用户可无限使用。"
                    : "This model is a general model with unlimited usage for Free users."}
                </div>
                {quotaData.contextMsgLimit && (
                  <div className="text-amber-600 dark:text-amber-400 text-[11px]">
                    <AlertCircle className="w-3 h-3 inline mr-1" />
                    {isZh
                      ? `上下文限制: 最近 ${quotaData.contextMsgLimit} 条消息`
                      : `Context limit: Last ${quotaData.contextMsgLimit} messages`}
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    // 外部模型：每日配额
    if (modelCategory === "external" && quotaData.daily) {
      const { used, limit, remaining } = quotaData.daily;
      const percent = limit > 0 ? Math.min(100, (remaining / limit) * 100) : 0;
      const isLow = remaining <= 2;

      return (
        <Popover>
          <PopoverTrigger asChild>
            <Badge
              variant="outline"
              className={`text-xs px-2 py-0.5 border-0 cursor-pointer ${
                isLow
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              } ${className}`}
            >
              <MessageSquare className="w-3 h-3 mr-1" />
              {remaining}/{limit}
            </Badge>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" side="bottom">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">
                  {isZh ? "外部模型配额" : "External Model Quota"}
                </span>
                <span className={`text-sm font-bold ${isLow ? "text-red-600" : "text-blue-600"}`}>
                  {remaining}/{limit}
                </span>
              </div>
              <Progress value={percent} className="h-2" />
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {isZh
                  ? `今日剩余 ${remaining} 次，每日 0 点重置`
                  : `${remaining} remaining today, resets at midnight`}
              </div>
              {quotaData.contextMsgLimit && (
                <div className="text-amber-600 dark:text-amber-400 text-[11px] border-t pt-2">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  {isZh
                    ? `上下文限制: 最近 ${quotaData.contextMsgLimit} 条消息`
                    : `Context limit: Last ${quotaData.contextMsgLimit} messages`}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    // 高级多模态模型：文本每日限额 + 月度媒体配额
    if (modelCategory === "advanced_multimodal" && quotaData.monthlyMedia) {
      const dailyLimit = quotaData.daily?.limit ?? 0;
      const dailyRemaining = quotaData.daily?.remaining ?? 0;
      const dailyPercent =
        dailyLimit > 0 ? Math.min(100, (dailyRemaining / dailyLimit) * 100) : 0;
      const isDailyLow = dailyRemaining <= 2;

      const { photoRemaining, photoLimit, videoAudioRemaining, videoAudioLimit } = quotaData.monthlyMedia;
      const photoPercent = photoLimit > 0 ? Math.min(100, (photoRemaining / photoLimit) * 100) : 0;
      const videoPercent = videoAudioLimit > 0 ? Math.min(100, (videoAudioRemaining / videoAudioLimit) * 100) : 0;
      const isPhotoLow = photoRemaining <= 5;
      const isVideoLow = videoAudioRemaining <= 1;

      return (
        <Popover>
          <PopoverTrigger asChild>
            <Badge
              variant="outline"
              className={`text-xs px-2 py-0.5 border-0 cursor-pointer bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 ${className}`}
            >
              <Image className="w-3 h-3 mr-1" />
              {photoRemaining}
              <span className="mx-1">|</span>
              <Video className="w-3 h-3 mr-1" />
              {videoAudioRemaining}
            </Badge>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" side="bottom">
            <div className="space-y-3">
              <div className="font-semibold text-sm">
                {isZh ? "高级多模态配额" : "Advanced Multimodal Quota"}
              </div>

              {quotaData.daily && (
                <div className="space-y-1 border-b pb-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center">
                      <MessageSquare className="w-3 h-3 mr-1 text-blue-500" />
                      {isZh ? "纯文本（每日）" : "Text (daily)"}
                    </span>
                    <span className={`font-bold ${isDailyLow ? "text-red-600" : "text-blue-600"}`}>
                      {dailyRemaining}/{dailyLimit}
                    </span>
                  </div>
                  <Progress value={dailyPercent} className="h-1.5" />
                </div>
              )}
              
              {/* 图片配额 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center">
                    <Image className="w-3 h-3 mr-1 text-purple-500" />
                    {isZh ? "图片" : "Photos"}
                  </span>
                  <span className={`font-bold ${isPhotoLow ? "text-red-600" : "text-purple-600"}`}>
                    {photoRemaining}/{photoLimit}
                  </span>
                </div>
                <Progress value={photoPercent} className="h-1.5" />
              </div>

              {/* 视频/音频配额 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center">
                    <Video className="w-3 h-3 mr-1 text-purple-500" />
                    {isZh ? "视频/音频" : "Video/Audio"}
                  </span>
                  <span className={`font-bold ${isVideoLow ? "text-red-600" : "text-purple-600"}`}>
                    {videoAudioRemaining}/{videoAudioLimit}
                  </span>
                </div>
                <Progress value={videoPercent} className="h-1.5" />
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400 border-t pt-2">
                {isZh
                  ? "文本对话消耗每日配额；图片/视频/音频消耗月度媒体配额，每月 1 日重置。"
                  : "Text chats use the daily quota; images/video/audio use monthly media quota and reset on the 1st."}
              </div>

              {quotaData.contextMsgLimit && (
                <div className="text-amber-600 dark:text-amber-400 text-[11px]">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  {isZh
                    ? `上下文限制: 最近 ${quotaData.contextMsgLimit} 条消息`
                    : `Context limit: Last ${quotaData.contextMsgLimit} messages`}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    // 默认显示（无特定模型或未知类型）
    if (quotaData.daily) {
      const { remaining, limit } = quotaData.daily;
      return (
        <Badge
          variant="outline"
          className={`text-xs px-2 py-0.5 border-0 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 ${className}`}
        >
          {remaining}/{limit}
        </Badge>
      );
    }
  }

  // Basic / Pro 用户（未匹配模型类型时）：显示每日 + 月度媒体
  if ((isBasic || isProLimited) && quotaData?.daily) {
    const { remaining, limit } = quotaData.daily;
    const remainingSafe = typeof remaining === "number" ? remaining : 0;
    const limitSafe = limit ?? 0;
    const percent = limitSafe > 0 ? Math.min(100, Math.max(0, (remainingSafe / limitSafe) * 100)) : 0;
    const photoLimit = quotaData.monthlyMedia?.photoLimit ?? 0;
    const photoRemaining = quotaData.monthlyMedia?.photoRemaining ?? photoLimit;
    const videoLimit = quotaData.monthlyMedia?.videoAudioLimit ?? 0;
    const videoRemaining = quotaData.monthlyMedia?.videoAudioRemaining ?? videoLimit;
    const photoPercent = photoLimit > 0 ? Math.min(100, Math.max(0, (photoRemaining / photoLimit) * 100)) : 0;
    const videoPercent = videoLimit > 0 ? Math.min(100, Math.max(0, (videoRemaining / videoLimit) * 100)) : 0;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Badge
            variant="outline"
            className={`text-xs px-2 py-0.5 border-0 cursor-pointer bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 ${className}`}
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            {remainingSafe}/{limitSafe}
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" side="bottom">
          <div className="space-y-3">
            <div className="font-semibold text-sm">
            {isZh ? (isProLimited ? "Pro 配额" : "Basic 配额") : (isProLimited ? "Pro Quota" : "Basic Quota")}
            </div>
            <div className="space-y-1 border-b pb-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center">
                  <MessageSquare className="w-3 h-3 mr-1 text-amber-500" />
                  {isZh ? "每日外部模型" : "External (daily)"}
                </span>
                <span className="font-bold text-amber-600">
                  {remainingSafe}/{limitSafe}
                </span>
              </div>
              <Progress value={percent} className="h-1.5" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center">
                  <Image className="w-3 h-3 mr-1 text-purple-500" />
                  {isZh ? "本月图片" : "Photos (monthly)"}
                </span>
                <span className="font-bold text-purple-600">
                  {photoRemaining}/{photoLimit}
                </span>
              </div>
              <Progress value={photoPercent} className="h-1.5" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center">
                  <Video className="w-3 h-3 mr-1 text-purple-500" />
                  {isZh ? "本月视频/音频" : "Video/Audio (monthly)"}
                </span>
                <span className="font-bold text-purple-600">
                  {videoRemaining}/{videoLimit}
                </span>
              </div>
              <Progress value={videoPercent} className="h-1.5" />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // 加载中或错误状态
  if (loading) {
    return (
      <Badge
        variant="outline"
        className={`text-xs px-2 py-0.5 border-0 bg-gray-100 text-gray-500 animate-pulse ${className}`}
      >
        ...
      </Badge>
    );
  }

  if (error) {
    return (
      <Badge
        variant="outline"
        className={`text-xs px-2 py-0.5 border-0 bg-red-50 text-red-500 ${className}`}
      >
        !
      </Badge>
    );
  }

  return null;
}

export default QuotaDisplay;
