/**
 * 模型分类与配额限制工具
 * 用于国内版 Free 用户的分级配额策略
 */

// =============================================================================
// 模型分类定义
// =============================================================================

// 默认通用模型（前端展示为 General Model，实际使用 Qwen-Turbo）
export const GENERAL_MODEL_ID = "qwen-turbo";

/**
 * 通用模型列表 (General/Internal Models)
 * 这些模型对 Free 用户无限制使用
 */
export const GENERAL_MODELS = [GENERAL_MODEL_ID];

/**
 * 外部模型列表 (External Models)
 * 这些模型受每日配额限制
 */
export const EXTERNAL_MODELS = [
  "qwen3-max",
  "qwen-plus",
  "qwen-flash",
  "qwen3-coder-plus",
  "qwen3-coder-flash",
  "deepseek-r1",
  "deepseek-v3",
  "deepseek-v3.1",
  "deepseek-v3.2-exp",
  "Moonshot-Kimi-K2-Instruct",
  "glm-4.6",
];

/**
 * 高级多模态模型列表 (Advanced Multimodal Models)
 * 这些模型受每月媒体配额限制
 */
export const ADVANCED_MULTIMODAL_MODELS = [
  "qwen3-omni-flash",
];

// =============================================================================
// 模型分类判断函数
// =============================================================================

/**
 * 判断是否为通用模型 (无限制)
 */
export function isGeneralModel(modelId: string): boolean {
  return GENERAL_MODELS.some(
    (m) => m.toLowerCase() === modelId.toLowerCase()
  );
}

/**
 * 判断是否为外部模型 (每日配额限制)
 */
export function isExternalModel(modelId: string): boolean {
  return EXTERNAL_MODELS.some(
    (m) => m.toLowerCase() === modelId.toLowerCase()
  );
}

/**
 * 判断是否为高级多模态模型 (每月媒体配额限制)
 */
export function isAdvancedMultimodalModel(modelId: string): boolean {
  return ADVANCED_MULTIMODAL_MODELS.some(
    (m) => m.toLowerCase() === modelId.toLowerCase()
  );
}

/**
 * 获取模型分类类型
 */
export type ModelCategory = "general" | "external" | "advanced_multimodal" | "unknown";

export function getModelCategory(modelId: string): ModelCategory {
  if (isGeneralModel(modelId)) return "general";
  if (isExternalModel(modelId)) return "external";
  if (isAdvancedMultimodalModel(modelId)) return "advanced_multimodal";
  return "unknown";
}

// =============================================================================
// 配额限制常量获取
// =============================================================================

/**
 * 获取外部模型每日限制
 */
export function getFreeDailyLimit(): number {
  const raw = process.env.NEXT_PUBLIC_FREE_DAILY_LIMIT || "10";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(1000, n);
}

/**
 * 获取高级多模态模型每月图片限制
 */
export function getFreeMonthlyPhotoLimit(): number {
  const raw = process.env.NEXT_PUBLIC_FREE_MONTHLY_PHOTO_LIMIT || "30";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 30;
  return Math.min(10000, n);
}

/**
 * 获取高级多模态模型每月视频/音频限制
 */
export function getFreeMonthlyVideoAudioLimit(): number {
  const raw = process.env.NEXT_PUBLIC_FREE_MONTHLY_VIDEO_AUDIO_LIMIT || "5";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 5;
  return Math.min(1000, n);
}

/**
 * 获取 Free 用户上下文消息限制 (非消耗型，仅用于截断历史)
 */
export function getFreeContextMsgLimit(): number {
  const raw = process.env.NEXT_PUBLIC_FREE_CONTEXT_MSG_LIMIT || "10";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(100, n);
}

// =============================================================================
// 媒体类型检测
// =============================================================================

export interface MediaPayload {
  images?: string[];
  videos?: string[];
  audios?: string[];
}

/**
 * 检测请求中是否包含图片
 */
export function hasImages(payload: MediaPayload): boolean {
  return Array.isArray(payload.images) && payload.images.length > 0;
}

/**
 * 检测请求中是否包含视频或音频
 */
export function hasVideoOrAudio(payload: MediaPayload): boolean {
  const hasVideo = Array.isArray(payload.videos) && payload.videos.length > 0;
  const hasAudio = Array.isArray(payload.audios) && payload.audios.length > 0;
  return hasVideo || hasAudio;
}

/**
 * 获取图片数量
 */
export function getImageCount(payload: MediaPayload): number {
  return Array.isArray(payload.images) ? payload.images.length : 0;
}

/**
 * 获取视频/音频数量 (合并计算)
 */
export function getVideoAudioCount(payload: MediaPayload): number {
  const videoCount = Array.isArray(payload.videos) ? payload.videos.length : 0;
  const audioCount = Array.isArray(payload.audios) ? payload.audios.length : 0;
  return videoCount + audioCount;
}

// =============================================================================
// 配额检查结果类型
// =============================================================================

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  quotaType?: "unlimited" | "daily" | "monthly_photo" | "monthly_video_audio";
  remaining?: number;
  limit?: number;
}

/**
 * 生成配额不足的错误消息
 */
export function getQuotaExceededMessage(
  quotaType: string,
  language: string = "zh"
): string {
  const isZh = language === "zh";
  
  switch (quotaType) {
    case "daily":
      return isZh
        ? "今日外部模型配额已用完，请升级套餐或明天再试，或切换到通用模型（General Model）继续使用。"
        : "Daily external model quota exceeded. Please upgrade your plan, try again tomorrow, or switch to the General Model.";
    case "monthly_photo":
      return isZh
        ? "本月图片配额已用完，请升级套餐或下月再试。"
        : "Monthly photo quota exceeded. Please upgrade your plan or try again next month.";
    case "monthly_video_audio":
      return isZh
        ? "本月视频/音频配额已用完，请升级套餐或下月再试。"
        : "Monthly video/audio quota exceeded. Please upgrade your plan or try again next month.";
    default:
      return isZh
        ? "配额已用完，请升级套餐继续使用。"
        : "Quota exceeded. Please upgrade your plan to continue.";
  }
}

/**
 * 获取上下文截断提示消息
 */
export function getContextTruncationMessage(
  limit: number,
  language: string = "zh"
): string {
  const isZh = language === "zh";
  return isZh
    ? `已仅保留最近 ${limit} 条消息作为上下文记忆。`
    : `Only the most recent ${limit} messages are kept as context memory.`;
}

// =============================================================================
// 日期工具函数
// =============================================================================

/**
 * 获取今天的日期字符串 (YYYY-MM-DD)
 */
export function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * 获取当月第一天的日期字符串 (YYYY-MM-DD)
 */
export function getMonthStartString(): string {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return monthStart.toISOString().split("T")[0];
}

/**
 * 获取当前年月字符串 (YYYY-MM)
 */
export function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
