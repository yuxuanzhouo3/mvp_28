/**
 * 套餐相关工具函数 - 统一定义，消除代码重复
 * 遵循 DRY 原则，将多处重复的函数集中管理
 */

import { isAfter } from "date-fns";

// =============================================================================
// 套餐等级定义
// =============================================================================

export const PLAN_RANK: Record<string, number> = {
  Free: 0,
  Basic: 1,
  Pro: 2,
  Enterprise: 3,
};

// =============================================================================
// 套餐名称标准化
// =============================================================================

/**
 * 统一套餐名称，兼容中文/英文，返回英文 canonical key
 * @param planName 原始套餐名称（可能是中文或英文）
 * @returns 标准化的英文套餐名称
 */
export function normalizePlanName(planName?: string | null): string {
  if (!planName) return "";
  const lower = planName.toLowerCase().trim();

  if (lower === "basic" || lower === "基础版") return "Basic";
  if (lower === "pro" || lower === "专业版") return "Pro";
  if (lower === "enterprise" || lower === "企业版") return "Enterprise";
  if (lower === "free" || lower === "免费版") return "Free";

  return planName;
}

/**
 * 获取套餐的显示标签（首字母大写）
 */
export function getPlanLabel(planLower: string): string {
  const normalized = normalizePlanName(planLower);
  if (!normalized) return "Free";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

// =============================================================================
// 套餐信息解析
// =============================================================================

export interface PlanInfo {
  planLower: string;
  planLabel: string;
  planExp: Date | null;
  planActive: boolean;
  isPro: boolean;
  isBasic: boolean;
  isEnterprise: boolean;
  isFree: boolean;
  isUnlimited: boolean;
  rank: number;
}

/**
 * 从用户元数据或钱包数据中解析套餐信息
 * 统一的套餐信息解析逻辑，避免在多个文件中重复实现
 *
 * @param userMeta 用户元数据（来自 auth 或 user_metadata）
 * @param wallet 钱包数据（来自 user_wallets 表）
 * @returns 标准化的套餐信息
 */
export function getPlanInfo(
  userMeta?: Record<string, any> | null,
  wallet?: Record<string, any> | null
): PlanInfo {
  // 优先从 wallet 获取（避免 user_metadata 缓存问题）
  const rawPlan =
    wallet?.plan ||
    wallet?.subscription_tier ||
    userMeta?.plan ||
    userMeta?.subscriptionTier ||
    "";

  const rawPlanLower = typeof rawPlan === "string" ? rawPlan.toLowerCase().trim() : "";

  // 解析到期时间
  const planExpStr = wallet?.plan_exp || userMeta?.plan_exp;
  const planExp = planExpStr ? new Date(planExpStr) : null;

  // 判断套餐是否有效
  const planActive = planExp ? isAfter(planExp, new Date()) : !planExpStr;

  // 有效套餐等级（过期则降为 free）
  const planLower = planActive ? rawPlanLower : "free";
  const planLabel = getPlanLabel(planLower);

  // 套餐类型判断
  const isBasic = planLower === "basic";
  const isPro = planLower === "pro";
  const isEnterprise = planLower === "enterprise";
  const isFree = !isBasic && !isPro && !isEnterprise;

  // 无限制标记（特殊用户）
  const isUnlimited = !!(wallet?.pro || userMeta?.pro) && isFree;

  // 套餐等级
  const rank = PLAN_RANK[normalizePlanName(planLower)] || 0;

  return {
    planLower,
    planLabel,
    planExp,
    planActive,
    isPro,
    isBasic,
    isEnterprise,
    isFree,
    isUnlimited,
    rank,
  };
}

// =============================================================================
// 套餐比较工具
// =============================================================================

/**
 * 比较两个套餐的等级
 * @returns 正数表示 planA 更高，负数表示 planB 更高，0 表示相同
 */
export function comparePlanRank(planA: string, planB: string): number {
  const rankA = PLAN_RANK[normalizePlanName(planA)] || 0;
  const rankB = PLAN_RANK[normalizePlanName(planB)] || 0;
  return rankA - rankB;
}

/**
 * 判断是否为升级操作
 */
export function isUpgrade(currentPlan: string, targetPlan: string, currentActive: boolean): boolean {
  if (!currentActive) return false;
  return comparePlanRank(targetPlan, currentPlan) > 0;
}

/**
 * 判断是否为降级操作
 */
export function isDowngrade(currentPlan: string, targetPlan: string, currentActive: boolean): boolean {
  if (!currentActive) return false;
  return comparePlanRank(targetPlan, currentPlan) < 0;
}

/**
 * 判断是否为同级续费
 */
export function isSamePlanRenewal(currentPlan: string, targetPlan: string, currentActive: boolean): boolean {
  if (!currentActive) return false;
  return comparePlanRank(targetPlan, currentPlan) === 0;
}

// =============================================================================
// 订阅状态验证（防止订阅到期判断错误）
// =============================================================================

/**
 * 检查用户���否为有效的付费用户
 *
 * ⚠️ 重要：此函数用于防止订阅到期后的状态判断错误
 *
 * 问题背景：
 * - 订阅到期后，appUser.isPaid 可能未及时更新（缓存问题）
 * - 导致前端错误地将过期用户识别为付费用户
 * - 最终导致Free用户额度显示为"--"等问题
 *
 * 解决方案：
 * - 同时检查 isPaid 标志和 planExp 过期时间
 * - 只有两者都满足条件才认为是有效付费用户
 *
 * @param appUser 用���对象（包含 isPaid 和 planExp 字段）
 * @returns true 表示有效付费用户，false 表示Free用户或订阅已过期
 *
 * @example
 * ```typescript
 * // 正确用法：在判断用户类型时使用此函数
 * if (isValidPaidUser(appUser)) {
 *   // 处理付费用户逻辑
 * } else {
 *   // 处理Free用户逻辑
 * }
 *
 * // 错误用法：只检查 isPaid（可能导致订阅到期判断错误）
 * if (appUser?.isPaid) {  // ❌ 不推荐
 *   // ...
 * }
 * ```
 */
export function isValidPaidUser(appUser?: { isPaid?: boolean; planExp?: string | null } | null): boolean {
  if (!appUser?.isPaid) return false;

  // 如果没有 planExp，认为订阅无效（保守策略）
  if (!appUser.planExp) return false;

  // 检查订阅是否过期
  const planExpDate = new Date(appUser.planExp);
  const now = new Date();

  return planExpDate > now;
}

/**
 * 检查用户是否为有效的Pro用户
 *
 * @param appUser 用户对象
 * @returns true 表示有效Pro用户
 */
export function isValidProUser(appUser?: { isPro?: boolean; planExp?: string | null } | null): boolean {
  if (!appUser?.isPro) return false;

  // 如果没有 planExp，认为订阅无效
  if (!appUser.planExp) return false;

  // 检查订阅是否过期
  const planExpDate = new Date(appUser.planExp);
  const now = new Date();

  return planExpDate > now;
}

// =============================================================================
// 上下文消息截断
// =============================================================================

/**
 * 截断消息历史以符合上下文限制
 * 保留最新的消息（从末尾截取）
 *
 * @param messages 消息数组
 * @param limit 最大消息数量
 * @returns 截断后的消息数组
 */
export function truncateContextMessages<T>(messages: T[], limit: number): T[] {
  if (!Array.isArray(messages)) return [];
  if (messages.length <= limit) return messages;
  return messages.slice(-limit);
}
