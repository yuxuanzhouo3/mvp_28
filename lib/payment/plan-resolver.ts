// lib/payment/plan-resolver.ts
// 支付相关的套餐解析工具函数

import { pricingPlans, type PricingPlan } from "@/constants/pricing";

/**
 * 从套餐中提取金额
 * @param plan 套餐对象
 * @param period 计费周期
 * @param useDomesticPrice 是否使用国内价格
 * @returns 金额数值
 */
export const extractPlanAmount = (
  plan: PricingPlan,
  period: "monthly" | "annual",
  useDomesticPrice: boolean
): number => {
  const priceLabel =
    period === "annual"
      ? useDomesticPrice
        ? plan.annualPriceZh || plan.annualPrice
        : plan.annualPrice
      : useDomesticPrice
        ? plan.priceZh || plan.price
        : plan.price;
  const numeric = parseFloat(priceLabel.replace(/[^0-9.]/g, "") || "0");
  return period === "annual" ? numeric * 12 : numeric;
};

/**
 * 根据英文/中文名称解析套餐，始终返回英文 name 作为 canonical key
 * @param planName 套餐名称（可选）
 * @returns 套餐对象，默认返回 Pro
 */
export function resolvePlan(planName?: string): PricingPlan {
  if (!planName) return pricingPlans[1]; // 默认 Pro
  const lower = planName.toLowerCase();
  const found = pricingPlans.find(
    (p) =>
      p.name.toLowerCase() === lower ||
      (p.nameZh && p.nameZh.toLowerCase() === lower)
  );
  return found || pricingPlans[1];
}
