"use server";

/**
 * 用户数据统计 Server Actions
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 统计数据类型定义
export interface UserStats {
  total: number;
  newToday: number;
  newThisWeek: number;
  newThisMonth: number;
}

export interface PaymentStats {
  totalAmount: number;
  totalCount: number;
  payingUsers: number;
  todayAmount: number;
  thisMonthAmount: number;
  currency: string;
}

export interface SubscriptionStats {
  total: number;
  active: number;
  byPlan: Record<string, number>;
}

export interface ActiveUserStats {
  dau: number; // 日活
  wau: number; // 周活
  mau: number; // 月活
}

export interface DeviceStats {
  byType: Record<string, number>;
  byOS: Record<string, number>;
}

export interface SourceComparison {
  global: { users: number; revenue: number };
  cn: { users: number; revenue: number };
}

export interface AdminStatsResult {
  success: boolean;
  error?: string;
  data?: {
    users: UserStats;
    payments: PaymentStats;
    subscriptions: SubscriptionStats;
    activeUsers: ActiveUserStats;
    devices: DeviceStats;
    sourceComparison: SourceComparison;
    generatedAt: string;
  };
}

export interface DailyStatsResult {
  success: boolean;
  error?: string;
  data?: Array<{
    date: string;
    source: string;
    activeUsers: number;
    sessions: number;
    newUsers: number;
    revenue: number;
  }>;
}

/**
 * 获取整体统计数据
 * @param source - 数据来源: 'all' | 'global' | 'cn'
 */
export async function getAdminStats(
  source: "all" | "global" | "cn" = "all"
): Promise<AdminStatsResult> {
  if (!supabaseAdmin) {
    return { success: false, error: "数据库连接失败" };
  }

  try {
    // 尝试调用数据库函数
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
      "get_admin_stats",
      { p_source: source }
    );

    if (!rpcError && rpcData) {
      return {
        success: true,
        data: {
          users: {
            total: rpcData.users?.total || 0,
            newToday: rpcData.users?.new_today || 0,
            newThisWeek: rpcData.users?.new_this_week || 0,
            newThisMonth: rpcData.users?.new_this_month || 0,
          },
          payments: {
            totalAmount: rpcData.payments?.total_amount || 0,
            totalCount: rpcData.payments?.total_count || 0,
            payingUsers: rpcData.payments?.paying_users || 0,
            todayAmount: rpcData.payments?.today_amount || 0,
            thisMonthAmount: rpcData.payments?.this_month_amount || 0,
            currency: "USD",
          },
          subscriptions: {
            total: rpcData.subscriptions?.total || 0,
            active: rpcData.subscriptions?.active || 0,
            byPlan: rpcData.subscriptions?.by_plan || {},
          },
          activeUsers: {
            dau: rpcData.active_users?.dau || 0,
            wau: rpcData.active_users?.wau || 0,
            mau: rpcData.active_users?.mau || 0,
          },
          devices: {
            byType: rpcData.devices?.by_type || {},
            byOS: rpcData.devices?.by_os || {},
          },
          sourceComparison: {
            global: { users: 0, revenue: 0 },
            cn: { users: 0, revenue: 0 },
          },
          generatedAt: rpcData.query_params?.generated_at || new Date().toISOString(),
        },
      };
    }

    // 如果 RPC 调用失败，使用直接查询作为后备方案
    console.warn("[getAdminStats] RPC failed, using fallback queries:", rpcError?.message);
    return await getAdminStatsFallback(source);
  } catch (err) {
    console.error("[getAdminStats] Error:", err);
    return { success: false, error: "获取统计数据失败" };
  }
}

/**
 * 后备方案：直接查询各表获取统计数据
 */
async function getAdminStatsFallback(
  source: "all" | "global" | "cn"
): Promise<AdminStatsResult> {
  if (!supabaseAdmin) {
    return { success: false, error: "数据库连接失败" };
  }

  try {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 构建查询条件
    const sourceFilter = source === "all" ? {} : { source };

    // 并行查询各项统计
    const [
      profilesResult,
      paymentsResult,
      subscriptionsResult,
      analyticsResult,
      sourceCompResult,
    ] = await Promise.all([
      // 用户统计
      supabaseAdmin
        .from("profiles")
        .select("id, created_at, source", { count: "exact" })
        .match(sourceFilter),

      // 支付统计
      supabaseAdmin
        .from("payments")
        .select("amount, user_id, created_at, source")
        .in("status", ["success", "completed"])
        .match(sourceFilter),

      // 订阅统计
      supabaseAdmin
        .from("subscriptions")
        .select("plan, status, source")
        .match(sourceFilter),

      // 活跃用户统计 (从 user_analytics 表)
      supabaseAdmin
        .from("user_analytics")
        .select("user_id, created_at, device_type, os, source")
        .gte("created_at", monthAgo)
        .match(sourceFilter),

      // 来源对比统计
      source === "all"
        ? Promise.all([
            supabaseAdmin.from("profiles").select("id", { count: "exact" }).eq("source", "global"),
            supabaseAdmin.from("profiles").select("id", { count: "exact" }).eq("source", "cn"),
            supabaseAdmin
              .from("payments")
              .select("amount")
              .eq("source", "global")
              .in("status", ["success", "completed"]),
            supabaseAdmin
              .from("payments")
              .select("amount")
              .eq("source", "cn")
              .in("status", ["success", "completed"]),
          ])
        : Promise.resolve(null),
    ]);

    // 处理用户统计
    const profiles = profilesResult.data || [];
    const userStats: UserStats = {
      total: profilesResult.count || profiles.length,
      newToday: profiles.filter((p) => p.created_at?.startsWith(today)).length,
      newThisWeek: profiles.filter((p) => p.created_at >= weekAgo).length,
      newThisMonth: profiles.filter((p) => p.created_at >= monthAgo).length,
    };

    // 处理支付统计
    const payments = paymentsResult.data || [];
    const paymentStats: PaymentStats = {
      totalAmount: payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      totalCount: payments.length,
      payingUsers: new Set(payments.map((p) => p.user_id)).size,
      todayAmount: payments
        .filter((p) => p.created_at?.startsWith(today))
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      thisMonthAmount: payments
        .filter((p) => p.created_at >= monthAgo)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      currency: "USD",
    };

    // 处理订阅统计
    const subscriptions = subscriptionsResult.data || [];
    const planCounts: Record<string, number> = {};
    subscriptions.forEach((s) => {
      planCounts[s.plan] = (planCounts[s.plan] || 0) + 1;
    });
    const subscriptionStats: SubscriptionStats = {
      total: subscriptions.length,
      active: subscriptions.filter((s) => s.status === "active").length,
      byPlan: planCounts,
    };

    // 处理活跃用户统计
    const analytics = analyticsResult.data || [];
    const todayStart = new Date(today).toISOString();
    const activeUserStats: ActiveUserStats = {
      dau: new Set(analytics.filter((a) => a.created_at >= todayStart).map((a) => a.user_id)).size,
      wau: new Set(analytics.filter((a) => a.created_at >= weekAgo).map((a) => a.user_id)).size,
      mau: new Set(analytics.map((a) => a.user_id)).size,
    };

    // 处理设备统计
    const deviceTypeCounts: Record<string, number> = {};
    const osCounts: Record<string, number> = {};
    const userDevices = new Map<string, { type?: string; os?: string }>();

    analytics.forEach((a) => {
      if (!userDevices.has(a.user_id)) {
        userDevices.set(a.user_id, { type: a.device_type, os: a.os });
      }
    });

    userDevices.forEach(({ type, os }) => {
      const deviceType = type || "unknown";
      const osName = os || "unknown";
      deviceTypeCounts[deviceType] = (deviceTypeCounts[deviceType] || 0) + 1;
      osCounts[osName] = (osCounts[osName] || 0) + 1;
    });

    const deviceStats: DeviceStats = {
      byType: deviceTypeCounts,
      byOS: osCounts,
    };

    // 处理来源对比
    let sourceComparison: SourceComparison = {
      global: { users: 0, revenue: 0 },
      cn: { users: 0, revenue: 0 },
    };

    if (sourceCompResult && Array.isArray(sourceCompResult)) {
      const [globalUsers, cnUsers, globalPayments, cnPayments] = sourceCompResult;
      sourceComparison = {
        global: {
          users: globalUsers?.count || 0,
          revenue: (globalPayments?.data || []).reduce(
            (sum: number, p: { amount: number }) => sum + (Number(p.amount) || 0),
            0
          ),
        },
        cn: {
          users: cnUsers?.count || 0,
          revenue: (cnPayments?.data || []).reduce(
            (sum: number, p: { amount: number }) => sum + (Number(p.amount) || 0),
            0
          ),
        },
      };
    }

    return {
      success: true,
      data: {
        users: userStats,
        payments: paymentStats,
        subscriptions: subscriptionStats,
        activeUsers: activeUserStats,
        devices: deviceStats,
        sourceComparison,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    console.error("[getAdminStatsFallback] Error:", err);
    return { success: false, error: "获取统计数据失败" };
  }
}

/**
 * 获取每日统计数据（用于图表）
 * @param days - 获取最近多少天的数据
 * @param source - 数据来源
 */
export async function getDailyStats(
  days: number = 30,
  source: "all" | "global" | "cn" = "all"
): Promise<DailyStatsResult> {
  if (!supabaseAdmin) {
    return { success: false, error: "数据库连接失败" };
  }

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    // 查询每日用户注册数
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("created_at, source")
      .gte("created_at", startDateStr);

    // 查询每日支付数据
    const { data: payments } = await supabaseAdmin
      .from("payments")
      .select("created_at, amount, source")
      .gte("created_at", startDateStr)
      .in("status", ["success", "completed"]);

    // 查询每日活跃用户
    const { data: analytics } = await supabaseAdmin
      .from("user_analytics")
      .select("created_at, user_id, source")
      .gte("created_at", startDateStr);

    // 按日期聚合数据
    const dailyMap = new Map<string, {
      date: string;
      source: string;
      activeUsers: Set<string>;
      sessions: number;
      newUsers: number;
      revenue: number;
    }>();

    // 生成日期列表
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const sources = source === "all" ? ["global", "cn"] : [source];
      sources.forEach((s) => {
        const key = `${dateStr}_${s}`;
        dailyMap.set(key, {
          date: dateStr,
          source: s,
          activeUsers: new Set(),
          sessions: 0,
          newUsers: 0,
          revenue: 0,
        });
      });
    }

    // 填充新用户数据
    (profiles || []).forEach((p) => {
      const dateStr = p.created_at?.split("T")[0];
      const s = p.source || "global";
      if (source !== "all" && s !== source) return;

      const key = `${dateStr}_${s}`;
      const entry = dailyMap.get(key);
      if (entry) {
        entry.newUsers++;
      }
    });

    // 填充支付数据
    (payments || []).forEach((p) => {
      const dateStr = p.created_at?.split("T")[0];
      const s = p.source || "global";
      if (source !== "all" && s !== source) return;

      const key = `${dateStr}_${s}`;
      const entry = dailyMap.get(key);
      if (entry) {
        entry.revenue += Number(p.amount) || 0;
      }
    });

    // 填充活跃用户数据
    (analytics || []).forEach((a) => {
      const dateStr = a.created_at?.split("T")[0];
      const s = a.source || "global";
      if (source !== "all" && s !== source) return;

      const key = `${dateStr}_${s}`;
      const entry = dailyMap.get(key);
      if (entry) {
        entry.activeUsers.add(a.user_id);
        entry.sessions++;
      }
    });

    // 转换为数组
    const result = Array.from(dailyMap.values())
      .map((entry) => ({
        date: entry.date,
        source: entry.source,
        activeUsers: entry.activeUsers.size,
        sessions: entry.sessions,
        newUsers: entry.newUsers,
        revenue: entry.revenue,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { success: true, data: result };
  } catch (err) {
    console.error("[getDailyStats] Error:", err);
    return { success: false, error: "获取每日统计失败" };
  }
}

/**
 * 记录用户分析事件
 */
export async function trackAnalyticsEvent(params: {
  userId: string;
  source: "global" | "cn";
  eventType: string;
  deviceType?: string;
  os?: string;
  browser?: string;
  appVersion?: string;
  eventData?: Record<string, unknown>;
  sessionId?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) {
    return { success: false, error: "数据库连接失败" };
  }

  try {
    const { error } = await supabaseAdmin.from("user_analytics").insert({
      user_id: params.userId,
      source: params.source,
      event_type: params.eventType,
      device_type: params.deviceType,
      os: params.os,
      browser: params.browser,
      app_version: params.appVersion,
      event_data: params.eventData || {},
      session_id: params.sessionId,
    });

    if (error) {
      console.error("[trackAnalyticsEvent] Error:", error);
      return { success: false, error: "记录事件失败" };
    }

    return { success: true };
  } catch (err) {
    console.error("[trackAnalyticsEvent] Error:", err);
    return { success: false, error: "记录事件失败" };
  }
}
