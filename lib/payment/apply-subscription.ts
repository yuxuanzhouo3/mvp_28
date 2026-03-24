// lib/payment/apply-subscription.ts
// 共享订阅支付处理逻辑（微信/支付宝 Webhook 共用）

import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { isAfter } from "date-fns";
import {
  addCalendarMonths,
  getBeijingYMD,
  getPlanMediaLimits,
  renewMonthlyQuota,
  seedWalletForPlan,
  upgradeMonthlyQuota,
} from "@/services/wallet";
import { PLAN_RANK, normalizePlanName } from "@/utils/plan-utils";

export type PaymentProvider = "wechat" | "alipay";

export interface ApplySubscriptionParams {
  userId: string;
  providerOrderId: string;
  provider: PaymentProvider;
  period: "monthly" | "annual";
  days: number;
  planName: string;
}

/**
 * 国内版：应用订阅购买结果（同级顺延 / 升级立即生效并重置周期 / 降级延期生效）
 * 说明：微信/支付宝支付为一次性购买周期，本函数仅负责落库与配额初始化/刷新。
 */
export async function applySubscriptionPayment(params: ApplySubscriptionParams): Promise<void> {
  const { userId, providerOrderId, provider, period, planName } = params;
  const logPrefix = provider === "wechat" ? "[WeChat Webhook]" : "[Alipay Webhook]";

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  const now = new Date();
  const nowIso = now.toISOString();
  const plan = normalizePlanName(planName) || "Pro";
  const planLower = plan.toLowerCase();

  const userRes = await db.collection("users").doc(userId).get();
  const userDoc = userRes?.data?.[0] || null;
  if (!userDoc) {
    console.error(`${logPrefix} user not found:`, userId);
    return;
  }

  const currentPlanKey = normalizePlanName(userDoc?.plan || userDoc?.subscriptionTier || "");
  const currentPlanExp = userDoc?.plan_exp ? new Date(userDoc.plan_exp) : null;
  const currentPlanActive = currentPlanExp ? isAfter(currentPlanExp, now) : false;

  const purchasePlanKey = normalizePlanName(plan);
  const purchaseRank = PLAN_RANK[purchasePlanKey] || 0;
  const currentRank = PLAN_RANK[currentPlanKey] || 0;
  const isUpgrade = purchaseRank > currentRank && currentPlanActive;
  const isDowngrade = purchaseRank < currentRank && currentPlanActive;
  const isSameActive = purchaseRank === currentRank && currentPlanActive;
  const isNewOrExpired = !currentPlanActive || !currentPlanKey;

  const { imageLimit, videoLimit } = getPlanMediaLimits(planLower);
  const anchorDayNow = getBeijingYMD(now).day;
  const existingAnchorDay =
    userDoc?.wallet?.billing_cycle_anchor ||
    (userDoc?.wallet?.monthly_reset_at
      ? getBeijingYMD(new Date(userDoc.wallet.monthly_reset_at)).day
      : null) ||
    (currentPlanExp ? getBeijingYMD(currentPlanExp).day : null) ||
    anchorDayNow;

  const monthsToAdd = period === "annual" ? 12 : 1;
  const anchorDay = isUpgrade || isNewOrExpired ? anchorDayNow : existingAnchorDay;
  const baseDate = isSameActive && currentPlanExp ? currentPlanExp : now;
  const purchaseExpiresAt = addCalendarMonths(baseDate, monthsToAdd, anchorDay);

  const subsColl = db.collection("subscriptions");

  // 降级：延期生效（支持多重降级队列，按等级排序：高级先生效）
  if (isDowngrade) {
    // 1. 查询用户所有待生效的 pending 订阅
    const existingPendingRes = await subsColl.where({ userId, status: "pending" }).get();
    const existingPendingSubs = existingPendingRes?.data || [];

    // 2. 创建新的 pending 订阅记录（先用临时时间，后面会重新计算）
    const tempStart = currentPlanExp && currentPlanActive ? currentPlanExp : now;
    const newSubRes = await subsColl.add({
      userId,
      plan,
      period,
      status: "pending",
      provider,
      providerOrderId,
      startedAt: tempStart.toISOString(),
      expiresAt: addCalendarMonths(tempStart, monthsToAdd, existingAnchorDay).toISOString(),
      updatedAt: nowIso,
      createdAt: nowIso,
      type: "SUBSCRIPTION",
    });

    // 3. 将所有 pending 订阅（包括新的）按等级降序排列，同等级按创建时间升序
    const allPendingSubs = [
      ...existingPendingSubs.map((s: any) => ({
        _id: s._id,
        plan: normalizePlanName(s.plan),
        period: s.period,
        rank: PLAN_RANK[normalizePlanName(s.plan)] || 0,
        createdAt: s.createdAt || nowIso,
      })),
      {
        _id: newSubRes?.id,
        plan,
        period,
        rank: purchaseRank,
        createdAt: nowIso,
      },
    ].sort((a, b) => {
      // 先按等级降序（高级先生效）
      if (b.rank !== a.rank) return b.rank - a.rank;
      // 同等级按创建时间升序（先买的先生效）
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // 4. 重新计算每个订阅的 startedAt 和 expiresAt
    let nextStartDate = currentPlanExp && currentPlanActive ? currentPlanExp : now;
    const updatedQueue: { targetPlan: string; effectiveAt: string; expiresAt: string }[] = [];

    for (const pendingSub of allPendingSubs) {
      const subPeriod = pendingSub.period === "annual" ? 12 : 1;
      const subExpires = addCalendarMonths(nextStartDate, subPeriod, existingAnchorDay);

      // 更新订阅记录的时间
      if (pendingSub._id) {
        await subsColl.doc(pendingSub._id).update({
          startedAt: nextStartDate.toISOString(),
          expiresAt: subExpires.toISOString(),
          updatedAt: nowIso,
        });
      }

      updatedQueue.push({
        targetPlan: pendingSub.plan,
        effectiveAt: nextStartDate.toISOString(),
        expiresAt: subExpires.toISOString(),
      });

      // 下一个订阅从这个订阅到期后开始
      nextStartDate = subExpires;
    }

    // 5. 更新用户的 pendingDowngrade 为数组（按生效顺序）
    await db.collection("users").doc(userId).update({
      pendingDowngrade: updatedQueue.length > 0 ? updatedQueue : null,
      updatedAt: nowIso,
    });

    console.log(`${logPrefix} Downgrade queue updated:`, {
      userId,
      newPlan: plan,
      queue: updatedQueue,
    });

    return;
  }

  // 新购/续费/升级：立即生效
  const subPayload = {
    userId,
    plan,
    period,
    status: "active",
    provider,
    providerOrderId,
    startedAt: nowIso,
    expiresAt: purchaseExpiresAt.toISOString(),
    updatedAt: nowIso,
    type: "SUBSCRIPTION",
  };

  const existing = await subsColl
    .where({ userId, provider, plan })
    .limit(1)
    .get();

  if (existing?.data?.[0]?._id) {
    await subsColl.doc(existing.data[0]._id).update(subPayload);
  } else {
    await subsColl.add({ ...subPayload, createdAt: nowIso });
  }

  // 升级时清理低等级的待生效降级订阅
  // 注意：同级续费不清理，因为用户已经为这些降级付费，应该让它们在当前订阅到期后依次生效
  if (isUpgrade) {
    const pendingRes = await subsColl.where({ userId, status: "pending" }).get();
    const pendingSubs = pendingRes?.data || [];
    const toDeleteIds: string[] = [];
    const toKeepSubs: { targetPlan: string; effectiveAt: string; expiresAt: string }[] = [];

    for (const pendingSub of pendingSubs) {
      const pendingRank = PLAN_RANK[normalizePlanName(pendingSub.plan)] || 0;
      if (pendingRank <= purchaseRank) {
        // 等级低于或等于当前购买的订阅，删除
        toDeleteIds.push(pendingSub._id);
      } else {
        // 等级高于当前购买的订阅，保留但需要重新计算时间
        toKeepSubs.push({
          targetPlan: normalizePlanName(pendingSub.plan),
          effectiveAt: purchaseExpiresAt.toISOString(),
          expiresAt: addCalendarMonths(purchaseExpiresAt, pendingSub.period === "annual" ? 12 : 1, anchorDay).toISOString(),
        });
      }
    }

    // 删除低等级的 pending 订阅
    for (const docId of toDeleteIds) {
      try {
        await subsColl.doc(docId).remove();
      } catch (e) {
        console.warn(`${logPrefix} Failed to remove pending subscription:`, docId, e);
      }
    }

    // 更新保留的高等级 pending 订阅的生效时间
    let nextStart = purchaseExpiresAt;
    for (let i = 0; i < toKeepSubs.length; i++) {
      const keep = toKeepSubs[i];
      const matchRes = await subsColl.where({ userId, plan: keep.targetPlan, status: "pending" }).limit(1).get();
      if (matchRes?.data?.[0]?._id) {
        const subPeriod = matchRes.data[0].period === "annual" ? 12 : 1;
        const newExpire = addCalendarMonths(nextStart, subPeriod, anchorDay);
        await subsColl.doc(matchRes.data[0]._id).update({
          startedAt: nextStart.toISOString(),
          expiresAt: newExpire.toISOString(),
          updatedAt: nowIso,
        });
        toKeepSubs[i] = {
          targetPlan: keep.targetPlan,
          effectiveAt: nextStart.toISOString(),
          expiresAt: newExpire.toISOString(),
        };
        nextStart = newExpire;
      }
    }

    console.log(`${logPrefix} Cleaned pending subscriptions:`, {
      userId,
      deleted: toDeleteIds.length,
      kept: toKeepSubs.length,
    });
  }

  await db.collection("users").doc(userId).update({
    pro: planLower !== "basic",
    plan,
    plan_exp: purchaseExpiresAt.toISOString(),
    subscriptionTier: plan,
    pendingDowngrade: null,
    updatedAt: nowIso,
  });

  if (isUpgrade || isNewOrExpired) {
    await upgradeMonthlyQuota(userId, imageLimit, videoLimit);
  } else if (isSameActive) {
    await renewMonthlyQuota(userId);
  }

  await seedWalletForPlan(userId, planLower, {
    forceReset: isUpgrade || isNewOrExpired,
  });
}
