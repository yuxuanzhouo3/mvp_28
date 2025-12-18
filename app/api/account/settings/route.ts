import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/account/settings
 * 更新用户设置（如 hide_ads）到数据库
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { hideAds } = body;

    // 验证参数
    if (typeof hideAds !== "boolean") {
      return NextResponse.json(
        { error: "Invalid parameter: hideAds must be a boolean" },
        { status: 400 }
      );
    }

    if (IS_DOMESTIC_VERSION) {
      // 国内版：更新 CloudBase users 集合
      const cookieStore = await cookies();
      const token =
        cookieStore.get("auth-token")?.value ||
        req.headers.get("x-auth-token") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
        "";

      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const auth = new CloudBaseAuthService();
      const user = await auth.validateToken(token);
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // 检查用户是否为订阅用户
      if (!user.metadata?.pro && (user.metadata?.plan || "").toLowerCase() === "free") {
        return NextResponse.json(
          { error: "Only subscribed users can enable hide_ads" },
          { status: 403 }
        );
      }

      // 更新 users 集合中的 hide_ads 字段
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();

      await db.collection("users").doc(user.id).update({
        hide_ads: hideAds,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        data: { hide_ads: hideAds },
      });
    } else {
      // 国际版：更新 Supabase profiles 表
      const supabase = await createServerClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // 获取用户 wallet 信息检查是否为订阅用户
      const { data: wallet } = await supabase
        .from("user_wallets")
        .select("pro, plan")
        .eq("user_id", user.id)
        .single();

      const isPro = wallet?.pro || false;
      const plan = (wallet?.plan || "").toLowerCase();

      if (!isPro && plan === "free") {
        return NextResponse.json(
          { error: "Only subscribed users can enable hide_ads" },
          { status: 403 }
        );
      }

      // 更新 profiles 表中的 hide_ads 字段
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          hide_ads: hideAds,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("[account/settings] Update error:", updateError);
        return NextResponse.json(
          { error: "Failed to update settings" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { hide_ads: hideAds },
      });
    }
  } catch (error) {
    console.error("[account/settings] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/account/settings
 * 获取用户设置
 */
export async function GET(req: NextRequest) {
  try {
    if (IS_DOMESTIC_VERSION) {
      // 国内版
      const cookieStore = await cookies();
      const token =
        cookieStore.get("auth-token")?.value ||
        req.headers.get("x-auth-token") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
        "";

      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const auth = new CloudBaseAuthService();
      const user = await auth.validateToken(token);
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // 从 users 集合获取 hide_ads
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();

      const result = await db.collection("users").doc(user.id).get();
      const userData = result?.data?.[0] || result?.data;

      // 获取订阅状态
      const plan = (userData?.plan || user.metadata?.plan || "").toLowerCase();
      const planExp = userData?.plan_exp || user.metadata?.plan_exp || null;
      const isPro = userData?.pro || user.metadata?.pro || false;

      // 判断是否为付费用户
      const isPaid = plan === "basic" || plan === "pro" || plan === "enterprise" || isPro;
      const isExpired = planExp ? new Date(planExp) < new Date() : false;
      const hasActiveSubscription = isPaid && !isExpired;

      return NextResponse.json({
        success: true,
        data: {
          hide_ads: userData?.hide_ads ?? false,
          // 返回订阅状态供前端使用
          subscription: {
            plan: userData?.plan || user.metadata?.plan || "Free",
            planExp: planExp,
            isPro: isPro,
            isPaid: isPaid,
            isExpired: isExpired,
            hasActiveSubscription: hasActiveSubscription,
          },
        },
      });
    } else {
      // 国际版
      const supabase = await createServerClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // 从 profiles 表获取 hide_ads
      const { data: profile } = await supabase
        .from("profiles")
        .select("hide_ads")
        .eq("id", user.id)
        .single();

      // 从 user_wallets 表获取订阅状态（比 user_metadata 更准确）
      const { data: wallet } = await supabase
        .from("user_wallets")
        .select("plan, plan_exp, pro, subscription_tier")
        .eq("user_id", user.id)
        .single();

      const plan = (wallet?.plan || "").toLowerCase();
      const subscriptionTier = (wallet?.subscription_tier || "").toLowerCase();
      const planExp = wallet?.plan_exp || null;
      const isPro = wallet?.pro || false;

      // 判断是否为付费用户（Basic/Pro/Enterprise）
      const isPaid = plan === "basic" || plan === "pro" || plan === "enterprise" ||
                     subscriptionTier === "basic" || subscriptionTier === "pro" || subscriptionTier === "enterprise";

      // 判断订阅是否过期
      const isExpired = planExp ? new Date(planExp) < new Date() : false;
      const hasActiveSubscription = isPaid && !isExpired;

      return NextResponse.json({
        success: true,
        data: {
          hide_ads: profile?.hide_ads ?? false,
          // 返回订阅状态供前端使用
          subscription: {
            plan: wallet?.plan || "Free",
            planExp: planExp,
            isPro: isPro,
            isPaid: isPaid,
            isExpired: isExpired,
            hasActiveSubscription: hasActiveSubscription,
          },
        },
      });
    }
  } catch (error) {
    console.error("[account/settings] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
