import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { isAfter } from "date-fns";
import { normalizePlanName } from "@/utils/plan-utils";
import { upgradeMonthlyQuota, seedWalletForPlan, getPlanMediaLimits } from "@/services/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 定时任务：应用待生效的订阅
 * 每小时执行一次，检查所有用户的订阅状态，应用已到生效时间的待生效订阅
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // 验证定时任务密钥
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  const now = new Date();
  const nowIso = now.toISOString();
  let processedCount = 0;
  let errorCount = 0;

  try {
    // 查询所有有 pendingDowngrade 的用户，或者订阅已过期的用户
    const usersRes = await db
      .collection("users")
      .where(
        db.command.or([
          { pendingDowngrade: db.command.exists(true) },
          { plan_exp: db.command.lt(nowIso) }, // 订阅已过期
        ])
      )
      .get();

    const users = usersRes?.data || [];

    for (const user of users) {
      try {
        const userId = user._id;
        const currentPlanExp = user.plan_exp ? new Date(user.plan_exp) : null;
        const currentPlanActive = currentPlanExp ? isAfter(currentPlanExp, now) : false;
        const pendingQueue = user.pendingDowngrade || [];

        // 如果当前订阅仍然有效，跳过
        if (currentPlanActive) {
          continue;
        }

        // 如果用户已经是 Free 用户且没有待生效订阅，跳过（避免重复处理）
        const currentPlan = normalizePlanName(user.plan);
        if (currentPlan === "Free" && (!pendingQueue || pendingQueue.length === 0)) {
          continue;
        }

        // 如果没有待生效订阅，清理字段并降级为Free
        if (!pendingQueue || pendingQueue.length === 0) {
          await db.collection("users").doc(userId).update({
            pro: false,
            plan: "Free",
            subscriptionTier: "Free",
            pendingDowngrade: null,
            updatedAt: nowIso,
          });

          // 降级配额到Free级别
          const { imageLimit, videoLimit } = getPlanMediaLimits("free");
          await upgradeMonthlyQuota(userId, imageLimit, videoLimit);
          await seedWalletForPlan(userId, "free", { forceReset: true });

          processedCount++;
          console.log(`[Cron] Downgraded expired user ${userId} to Free`);
          continue;
        }

        // 获取第一个待生效订阅
        const nextSub = pendingQueue[0];
        const effectiveAt = new Date(nextSub.effectiveAt);

        // 如果还未到生效时间，跳过
        if (isAfter(effectiveAt, now)) {
          continue;
        }

        // 应用订阅
        const targetPlan = normalizePlanName(nextSub.targetPlan);
        const expiresAt = new Date(nextSub.expiresAt);

        // 更新用户订阅信息
        await db.collection("users").doc(userId).update({
          pro: targetPlan.toLowerCase() !== "basic",
          plan: targetPlan,
          plan_exp: expiresAt.toISOString(),
          subscriptionTier: targetPlan,
          pendingDowngrade: pendingQueue.length > 1 ? pendingQueue.slice(1) : null,
          updatedAt: nowIso,
        });

        // 更新订阅记录状态
        const subRes = await db
          .collection("subscriptions")
          .where({
            userId,
            plan: targetPlan,
            status: "pending",
          })
          .limit(1)
          .get();

        if (subRes?.data?.[0]?._id) {
          await db.collection("subscriptions").doc(subRes.data[0]._id).update({
            status: "active",
            updatedAt: nowIso,
          });
        }

        // 升级配额
        const planLower = targetPlan.toLowerCase();
        const { imageLimit, videoLimit } = getPlanMediaLimits(planLower);

        await upgradeMonthlyQuota(userId, imageLimit, videoLimit);
        await seedWalletForPlan(userId, planLower, { forceReset: true });

        processedCount++;
        console.log(`[Cron] Applied pending subscription for user ${userId}: ${targetPlan}`);
      } catch (err) {
        errorCount++;
        console.error(`[Cron] Error processing user ${user._id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      processedCount,
      errorCount,
      timestamp: nowIso,
    });
  } catch (err) {
    console.error("[Cron] Fatal error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        timestamp: nowIso,
      },
      { status: 500 }
    );
  }
}
