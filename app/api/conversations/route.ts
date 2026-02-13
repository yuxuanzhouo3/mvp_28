import { NextRequest } from "next/server";
import { isAfter } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getFreeConversationLimit } from "@/utils/model-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getDomesticUser(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return null;
  const auth = new CloudBaseAuthService();
  return await auth.validateToken(token);
}

function getPlanInfo(meta: any) {
  // 优先使用 subscriptionTier，其次使用 plan
  const rawPlan =
    (meta?.subscriptionTier as string | undefined) ||
    (meta?.plan as string | undefined) ||
    "";
  const rawPlanLower = typeof rawPlan === "string" ? rawPlan.toLowerCase() : "";
  const planExp = meta?.plan_exp ? new Date(meta.plan_exp) : null;
  const planActive = planExp ? isAfter(planExp, new Date()) : true;

  // 如果套餐类型明确为 enterprise/pro/basic，即使过期也保留套餐类型（仅影响功能限制，不影响对话数量限制）
  const planLower = rawPlanLower || "free";
  const isProFlag = !!meta?.pro && planLower !== "free" && planLower !== "basic";
  const isBasic = planLower === "basic";
  const isPro = planLower === "pro" || planLower === "enterprise" || isProFlag;
  const isFree = !isPro && !isBasic;
  return { planLower, isPro, isBasic, isFree, planActive, planExp };
}

// 版本隔离：仅根据部署环境决定（避免通过 cookie / header 旁路访问另一套数据源）
function isDomesticRequest(req: NextRequest) {
  // 版本隔离：仅根据部署环境决定（避免 en 环境因残留 auth-token 误访问国内数据）
  return IS_DOMESTIC_VERSION;
}

// List conversations for current user
export async function GET(req: NextRequest) {
  if (!isDomesticRequest(req)) {
    // international -> Supabase + Android Native Google Sign-In
    let userId: string;
    let userMeta: any = {};
    let supabase: any;

    // 尝试从 Authorization header 获取自定义 JWT token（Android Native Google Sign-In）
    const authHeader = req.headers.get("authorization");
    const customToken = authHeader?.replace(/^Bearer\s+/i, "");

    if (customToken) {
      // 使用自定义 JWT 认证（Android Native Google Sign-In）
      try {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
        const decoded = jwt.verify(customToken, JWT_SECRET) as any;
        userId = decoded.sub;
        console.log('[conversations] Using custom JWT auth for user:', userId);
        supabase = await createClient();
      } catch (error) {
        console.error('[conversations] Custom JWT verification failed:', error);
        return new Response("Unauthorized", { status: 401 });
      }
    } else {
      // 使用 Supabase 认证
      supabase = await createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        return new Response("Unauthorized", { status: 401 });
      }
      userId = userData.user.id;
      userMeta = userData.user.user_metadata as any;
    }

    const plan = getPlanInfo(userMeta);
    const conversationLimit = plan.isFree ? getFreeConversationLimit() : undefined;

    const { data, error } = await supabase
      .from("conversations")
      .select("id, title, model, created_at, updated_at, model_type, expert_model_id")
      .eq("user_id", userId) // 🔒 关键：只查询当前用户的对话
      .order("created_at", { ascending: true }); // 按创建时间升序，方便找最早的

    if (error) {
      console.error("List conversations error", error);
      return new Response("Failed to list conversations", { status: 500 });
    }

    let list = (data ?? []).map((c: any) => ({
      id: c.id,
      title: c.title,
      model: c.model,
      created_at: c.created_at,
      updated_at: c.updated_at,
      modelType: c.model_type || null,
      expertModelId: c.expert_model_id || null,
    }));

    // 按 updated_at 降序排列返回给前端
    list.sort((a: any, b: any) =>
      new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
    );

    return Response.json({
      conversations: list,
      conversationLimit,
      totalCount: list.length,
    });
  }

  // domestic -> CloudBase
  const user = await getDomesticUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const plan = getPlanInfo(user.metadata);
  const conversationLimit = plan.isFree ? getFreeConversationLimit() : undefined;

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

    let list = records.map((c: any) => ({
      id: c._id,
      title: c.title,
      model: c.model || null,
      created_at: c.createdAt,
      updated_at: c.updatedAt || c.createdAt,
      modelType: c.modelType || null,
      expertModelId: c.expertModelId || null,
    }));

    // 按 updated_at 降序排列返回给前端
    list.sort((a: any, b: any) =>
      new Date(b.updated_at || b.created_at || 0).getTime() -
      new Date(a.updated_at || a.created_at || 0).getTime()
    );

    return Response.json({
      conversations: list,
      conversationLimit,
      totalCount: list.length,
    });
  } catch (error) {
    console.error("CloudBase list conversations error", error);
    return new Response("Failed to list conversations", { status: 500 });
  }
}

// Create conversation
export async function POST(req: NextRequest) {
  const reqBody = await req.json();
  const { title, model, modelType, expertModelId, replaceOldest } = reqBody;

  if (!isDomesticRequest(req)) {
    let userId: string;
    let userMeta: any = {};
    let supabase: any;

    // 尝试从 Authorization header 获取自定义 JWT token（Android Native Google Sign-In）
    const authHeader = req.headers.get("authorization");
    const customToken = authHeader?.replace(/^Bearer\s+/i, "");

    if (customToken) {
      // 使用自定义 JWT 认证（Android Native Google Sign-In）
      try {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
        const decoded = jwt.verify(customToken, JWT_SECRET) as any;
        userId = decoded.sub;
        console.log('[conversations] Using custom JWT auth for user:', userId);
        supabase = await createClient();
      } catch (error) {
        console.error('[conversations] Custom JWT verification failed:', error);
        return new Response("Unauthorized", { status: 401 });
      }
    } else {
      // 使用 Supabase 认证
      supabase = await createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        return new Response("Unauthorized", { status: 401 });
      }
      userId = userData.user.id;
      userMeta = userData.user.user_metadata as any;
    }

    const plan = getPlanInfo(userMeta);

    // 调试日志
    console.log("[conversations] User plan detection:", {
      userId,
      planLower: plan.planLower,
      planActive: plan.planActive,
      isFree: plan.isFree,
    });

    // Free 用户对话数量限制检查
    if (plan.isFree) {
      const conversationLimit = getFreeConversationLimit();

      // 获取当前对话数量
      const { data: existingConvs, error: countError } = await supabase
        .from("conversations")
        .select("id, created_at")
        .eq("user_id", userId) // 🔒 关键：只查询当前用户的对话
        .order("created_at", { ascending: true });

      if (countError) {
        console.error("Count conversations error", countError);
        return new Response("Failed to count conversations", { status: 500 });
      }

      const currentCount = existingConvs?.length || 0;

      // 如果达到限制且未确认覆盖
      if (currentCount >= conversationLimit && !replaceOldest) {
        const oldestConv = existingConvs?.[0];
        return Response.json({
          needConfirmReplace: true,
          oldestConversation: oldestConv,
          currentCount,
          conversationLimit,
          message: "对话数量已达上限，需要覆盖最早的对话才能创建新对话",
        }, { status: 409 });
      }

      // 如果确认覆盖，删除最早的对话及其消息
      if (currentCount >= conversationLimit && replaceOldest) {
        const oldestConv = existingConvs?.[0];
        if (oldestConv) {
          // 先删除该对话的所有消息
          await supabase
            .from("messages")
            .delete()
            .eq("conversation_id", oldestConv.id);
          // 再删除对话
          await supabase
            .from("conversations")
            .delete()
            .eq("id", oldestConv.id);
        }
      }
    }

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: userId,
        title: title || "新对话",
        model: model || null,
        model_type: modelType || null,
        expert_model_id: expertModelId || null,
      })
      .select("id, title, model, created_at, updated_at, model_type, expert_model_id")
      .single();

    if (error) {
      console.error("Create conversation error", error);
      return new Response("Failed to create conversation", { status: 500 });
    }

    return Response.json({
      id: data.id,
      title: data.title,
      model: data.model,
      created_at: data.created_at,
      updated_at: data.updated_at,
      modelType: data.model_type || null,
      expertModelId: data.expert_model_id || null,
    });
  }

  // domestic -> CloudBase
  const user = await getDomesticUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const plan = getPlanInfo(user.metadata);

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  try {
    // Free 用户对话数量限制检查
    if (plan.isFree) {
      const conversationLimit = getFreeConversationLimit();

      // 获取当前对话数量
      let res = await db.collection("conversations").where({ userId: user.id }).get();
      let existingConvs = res?.data || [];

      // 防御性兜底
      if (!existingConvs.length) {
        const all = await db.collection("conversations").get();
        existingConvs = (all?.data || []).filter((c: any) => c.userId === user.id);
      }

      // 按创建时间升序排列
      existingConvs.sort((a: any, b: any) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      );

      const currentCount = existingConvs.length;

      // 如果达到限制且未确认覆盖
      if (currentCount >= conversationLimit && !replaceOldest) {
        const oldestConv = existingConvs[0];
        return Response.json({
          needConfirmReplace: true,
          oldestConversation: {
            id: oldestConv._id,
            title: oldestConv.title,
            created_at: oldestConv.createdAt,
          },
          currentCount,
          conversationLimit,
          message: "对话数量已达上限，需要覆盖最早的对话才能创建新对话",
        }, { status: 409 });
      }

      // 如果确认覆盖，删除最早的对话及其消息
      if (currentCount >= conversationLimit && replaceOldest) {
        const oldestConv = existingConvs[0];
        if (oldestConv?._id) {
          // 先删除该对话的所有消息
          const messagesRes = await db.collection("messages").where({ conversationId: oldestConv._id }).get();
          const messages = messagesRes?.data || [];
          for (const msg of messages) {
            await db.collection("messages").doc(msg._id).remove();
          }
          // 再删除对话
          await db.collection("conversations").doc(oldestConv._id).remove();
        }
      }
    }

    const now = new Date().toISOString();

    const addRes = await db.collection("conversations").add({
      userId: user.id,
      title: title || "新对话",
      model: model || null,
      modelType: modelType || null,
      expertModelId: expertModelId || null,
      createdAt: now,
      updatedAt: now,
    });

    const conversation = {
      id: addRes.id,
      title: title || "新对话",
      model: model || null,
      created_at: now,
      updated_at: now,
      modelType: modelType || null,
      expertModelId: expertModelId || null,
    };

    return Response.json(conversation);
  } catch (error) {
    console.error("CloudBase create conversation error", error);
    return new Response("Failed to create conversation", { status: 500 });
  }
}
