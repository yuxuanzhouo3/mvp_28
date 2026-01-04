// lib/payment/upgrade-calculator.ts
// 国内版升级价格计算逻辑

import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { isAfter } from "date-fns";
import { PLAN_RANK, normalizePlanName } from "@/utils/plan-utils";
import { extractPlanAmount, resolvePlan } from "@/lib/payment/plan-resolver";
import type { PricingPlan } from "@/constants/pricing";

/** 支付常量 */
export const PAYMENT_CONSTANTS = {
  DAYS_PER_MONTH: 30,
  DAYS_PER_YEAR: 365,
  MIN_PAYMENT_AMOUNT: 0.01,
  MS_PER_DAY: 1000 * 60 * 60 * 24,
} as const;

/** 升级计算结果 */
export interface UpgradeCalculationResult {
  amount: number;
  days: number;
  isUpgrade: boolean;
  freeUpgrade?: boolean;
  remainingDays?: number;
  remainingValue?: number;
}

/** 升级计算参数 */
export interface UpgradeCalculationParams {
  userId: string;
  targetPlan: PricingPlan;
  billingPeriod: "monthly" | "annual";
  baseAmount: number;
  useDomesticPrice?: boolean;
}

/**
 * 计算国内版升级价格
 * @returns 升级计算结果，包含金额和天数
 */
export async function calculateDomesticUpgradePrice(
  params: UpgradeCalculationParams
): Promise<UpgradeCalculationResult> {
  const { userId, targetPlan, billingPeriod, baseAmount, useDomesticPrice = true } = params;
  const { DAYS_PER_MONTH, DAYS_PER_YEAR, MIN_PAYMENT_AMOUNT, MS_PER_DAY } = PAYMENT_CONSTANTS;

  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();
    const userRes = await db.collection("users").doc(userId).get();
    const userDoc = userRes?.data?.[0] || null;

    const currentPlanKey = normalizePlanName(
      userDoc?.plan || userDoc?.subscriptionTier || ""
    );
    const currentPlanExp = userDoc?.plan_exp ? new Date(userDoc.plan_exp) : null;
    const now = new Date();
    const currentActive = currentPlanExp ? isAfter(currentPlanExp, now) : false;
    const purchaseRank = PLAN_RANK[normalizePlanName(targetPlan.name)] || 0;
    const currentRank = PLAN_RANK[currentPlanKey] || 0;
    const isUpgrade = currentActive && purchaseRank > currentRank;

    if (!isUpgrade || !currentPlanKey) {
      return {
        amount: baseAmount,
        days: billingPeriod === "annual" ? DAYS_PER_YEAR : DAYS_PER_MONTH,
        isUpgrade: false,
      };
    }

    // 计算剩余天数
    const remainingDays = Math.max(
      0,
      Math.ceil(((currentPlanExp?.getTime() || 0) - now.getTime()) / MS_PER_DAY)
    );

    const currentPlanDef = resolvePlan(currentPlanKey);
    const currentPlanMonthlyPrice = extractPlanAmount(currentPlanDef, "monthly", useDomesticPrice);
    const targetPlanMonthlyPrice = extractPlanAmount(targetPlan, "monthly", useDomesticPrice);
    const targetPrice = extractPlanAmount(targetPlan, billingPeriod, useDomesticPrice);

    const currentDailyPrice = currentPlanMonthlyPrice / DAYS_PER_MONTH;
    const targetDailyPrice = targetPlanMonthlyPrice / DAYS_PER_MONTH;
    const remainingValue = remainingDays * currentDailyPrice;
    const targetDays = billingPeriod === "annual" ? DAYS_PER_YEAR : DAYS_PER_MONTH;

    // 升级逻辑：剩余价值 >= 目标价格则免费升级，否则补差价
    const freeUpgrade = remainingValue >= targetPrice;
    let amount: number;
    let days: number;

    if (freeUpgrade) {
      amount = MIN_PAYMENT_AMOUNT;
      days = Math.floor(remainingValue / targetDailyPrice);
    } else {
      amount = Math.max(MIN_PAYMENT_AMOUNT, targetPrice - remainingValue);
      days = targetDays;
    }

    return {
      amount: Math.round(amount * 100) / 100,
      days,
      isUpgrade: true,
      freeUpgrade,
      remainingDays,
      remainingValue: Math.round(remainingValue * 100) / 100,
    };
  } catch (error) {
    console.error("[upgrade-calculator] calculation failed", error);
    return {
      amount: baseAmount,
      days: billingPeriod === "annual" ? DAYS_PER_YEAR : DAYS_PER_MONTH,
      isUpgrade: false,
    };
  }
}
