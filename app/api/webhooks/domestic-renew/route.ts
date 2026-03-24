import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import {
  getUserWallet,
  ensureUserWallet,
  renewMonthlyQuota,
  addCalendarMonths,
  getBeijingYMD,
} from "@/services/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const userId = body.userId as string | undefined;
  const plan = (body.plan as string | undefined)?.toLowerCase() || "basic";
  const secret = req.headers.get("x-webhook-secret") || "";
  if (process.env.DOMESTIC_WEBHOOK_SECRET && secret !== process.env.DOMESTIC_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!userId) {
    return NextResponse.json({ error: "No UserId" }, { status: 400 });
  }

  try {
    const now = new Date();
    // 1) 获取钱包
    const wallet = (await getUserWallet(userId)) ?? (await ensureUserWallet(userId));

    // 2) 锚点（北京时间）
    const todayBJ = getBeijingYMD(now);
    let anchorDay =
      wallet.billing_cycle_anchor ||
      (wallet.monthly_reset_at ? getBeijingYMD(new Date(wallet.monthly_reset_at)).day : todayBJ.day);

    // 3) 基准时间：未过期用 plan_exp，否则用 now
    const currentExp = (wallet as any).plan_exp;
    const baseDate =
      currentExp && new Date(currentExp) > now ? new Date(currentExp) : now;

    // 4) 计算新过期时间（+1 日历月，含月末粘性）
    const newExpIso = addCalendarMonths(baseDate, 1, anchorDay).toISOString();

    // 5) 更新合同期和锚点（不在这里写 monthly_reset_at）
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    await db.collection("users").doc(userId).update({
      plan_exp: newExpIso,
      "wallet.billing_cycle_anchor": anchorDay,
      plan: plan === "free" ? "Free" : plan.charAt(0).toUpperCase() + plan.slice(1),
      subscriptionTier: plan === "free" ? "Free" : plan.charAt(0).toUpperCase() + plan.slice(1),
      // 记录支付流水
      // 可在此处加入 payments/subscriptions 集合更新逻辑，依据你的 CloudBase schema
      updatedAt: new Date().toISOString(),
    });

    // 6) 刷新额度时间戳（使用内部防漂移算法）
    await renewMonthlyQuota(userId);

    console.log(`✅ [Domestic Webhook] Renewed for ${userId}, new exp: ${newExpIso}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ Domestic Renew Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
