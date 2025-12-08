import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getDomesticUser(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return null;
  const auth = new CloudBaseAuthService();
  return await auth.validateToken(token);
}

function getPlanInfo(meta: any) {
  const rawPlan =
    (meta?.plan as string | undefined) ||
    (meta?.plan_exp && meta?.plan) || // keep plan if present alongside plan_exp
    (meta?.subscriptionTier as string | undefined) ||
    "";
  const planLower = typeof rawPlan === "string" ? rawPlan.toLowerCase() : "";
  const isProFlag = !!meta?.pro && planLower !== "free" && planLower !== "basic";
  const isBasic = planLower === "basic";
  const isPro = planLower === "pro" || planLower === "enterprise" || isProFlag;
  const isFree = !isPro && !isBasic;
  return { planLower, isPro, isBasic, isFree };
}

// 动态判定是否走国内逻辑：环境为 zh 或请求携带 auth-token 即视为国内
function isDomesticRequest(req: NextRequest) {
  const langIsZh = IS_DOMESTIC_VERSION;
  const hasCloudToken = !!req.cookies.get("auth-token");
  return langIsZh || hasCloudToken;
}

// List conversations for current user
export async function GET(req: NextRequest) {
  if (!isDomesticRequest(req)) {
    // international -> Supabase (unchanged)
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response("Unauthorized", { status: 401 });
    }
    const userPlan =
      (userData.user.user_metadata as any)?.plan ||
      ((userData.user.user_metadata as any)?.pro ? "Pro" : null);
    const isFreeUser =
      !userPlan ||
      (typeof userPlan === "string" &&
        userPlan.toLowerCase() === "free");

    // Free 用户不返回历史记录（不读库）
    if (isFreeUser) {
      return Response.json([]);
    }

    const { data, error } = await supabase
      .from("conversations")
      .select("id, title, model, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("List conversations error", error);
      return new Response("Failed to list conversations", { status: 500 });
    }

    return Response.json(data ?? []);
  }

  // domestic -> CloudBase
  const user = await getDomesticUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const plan = getPlanInfo(user.metadata);

  // Free 用户不返回历史记录，保持与国际版一致
  if (plan.isFree) {
    return Response.json([]);
  }

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  try {
    let res = await db.collection("conversations").where({ userId: user.id }).get();
    let records = res?.data || [];

    // 防御性兜底：如果按 userId 查询为空，再全表过滤一次，避免索引/类型问题
    if (!records.length) {
      const all = await db.collection("conversations").get();
      records = (all?.data || []).filter((c: any) => c.userId === user.id);
    }

    console.log("[cloudbase] conversations list size", records.length || 0, "for", user.id);

    const list =
      records
        .map((c: any) => ({
          id: c._id,
          title: c.title,
          model: c.model || null,
          updated_at: c.updatedAt || c.createdAt,
        }))
        .sort(
          (a: any, b: any) =>
            new Date(b.updated_at || b.created_at || 0).getTime() -
            new Date(a.updated_at || a.created_at || 0).getTime(),
        );

    return Response.json(list);
  } catch (error) {
    console.error("CloudBase list conversations error", error);
    return new Response("Failed to list conversations", { status: 500 });
  }
}

// Create conversation
export async function POST(req: NextRequest) {
  if (!isDomesticRequest(req)) {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response("Unauthorized", { status: 401 });
    }
    const userId = userData.user.id;
    const { title, model } = await req.json();
    const userPlan =
      (userData.user.user_metadata as any)?.plan ||
      ((userData.user.user_metadata as any)?.pro ? "Pro" : null);
    const isFreeUser =
      !userPlan ||
      (typeof userPlan === "string" &&
        userPlan.toLowerCase() === "free");

    // Free 用户：不落库，返回本地临时会话 ID
    if (isFreeUser) {
      const now = new Date().toISOString();
      return Response.json({
        id: `local-${Date.now()}`,
        title: title || "New Chat",
        model: model || null,
        created_at: now,
        updated_at: now,
      });
    }

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: userId,
        title: title || "新对话",
        model: model || null,
      })
      .select("id, title, model, created_at, updated_at")
      .single();

    if (error) {
      console.error("Create conversation error", error);
      return new Response("Failed to create conversation", { status: 500 });
    }

    return Response.json(data);
  }

  // domestic -> CloudBase
  const user = await getDomesticUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const plan = getPlanInfo(user.metadata);

  const { title, model } = await req.json();

  // Free 用户：不落库，返回本地临时会话 ID
  if (plan.isFree) {
    const now = new Date().toISOString();
    return Response.json({
      id: `local-${Date.now()}`,
      title: title || "新对话",
      model: model || null,
      created_at: now,
      updated_at: now,
    });
  }

  const now = new Date().toISOString();

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  try {
    const addRes = await db.collection("conversations").add({
      userId: user.id,
      title: title || "新对话",
      model: model || null,
      createdAt: now,
      updatedAt: now,
    });

    const conversation = {
      id: addRes.id,
      title: title || "新对话",
      model: model || null,
      created_at: now,
      updated_at: now,
    };

    return Response.json(conversation);
  } catch (error) {
    console.error("CloudBase create conversation error", error);
    return new Response("Failed to create conversation", { status: 500 });
  }
}
