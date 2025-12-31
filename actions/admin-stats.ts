"use server";

/**
 * 用户数据统计 Server Actions
 * 支持国内版 (CloudBase) 和国际版 (Supabase) 数据源
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

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
 * 支持从 Supabase (global) 和 CloudBase (cn) 获取并合并数据
 */
async function getAdminStatsFallback(
  source: "all" | "global" | "cn"
): Promise<AdminStatsResult> {
  try {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date(today).toISOString();

    // 初始化统计结果
    let userStats: UserStats = { total: 0, newToday: 0, newThisWeek: 0, newThisMonth: 0 };
    let paymentStats: PaymentStats = {
      totalAmount: 0, totalCount: 0, payingUsers: 0, todayAmount: 0, thisMonthAmount: 0, currency: "USD"
    };
    let subscriptionStats: SubscriptionStats = { total: 0, active: 0, byPlan: {} };
    let activeUserStats: ActiveUserStats = { dau: 0, wau: 0, mau: 0 };
    let deviceStats: DeviceStats = { byType: {}, byOS: {} };
    let sourceComparison: SourceComparison = {
      global: { users: 0, revenue: 0 },
      cn: { users: 0, revenue: 0 },
    };

    // 收集所有活跃用户分析数据用于设备统计
    const allAnalytics: Array<{ user_id: string; created_at: string; device_type?: string; os?: string }> = [];

    // ========== 查询 Supabase (国际版) ==========
    if ((source === "all" || source === "global") && supabaseAdmin) {
      const sourceFilter = source === "global" ? { source: "global" } : {};

      const [
        profilesResult,
        paymentsResult,
        subscriptionsResult,
        analyticsResult,
      ] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, created_at, source", { count: "exact" })
          .match(sourceFilter),
        supabaseAdmin
          .from("payments")
          .select("amount, user_id, created_at, source")
          .in("status", ["success", "completed"])
          .match(sourceFilter),
        supabaseAdmin
          .from("subscriptions")
          .select("plan, status, source")
          .match(sourceFilter),
        supabaseAdmin
          .from("user_analytics")
          .select("user_id, created_at, device_type, os, source")
          .gte("created_at", monthAgo)
          .match(sourceFilter),
      ]);

      const profiles = profilesResult.data || [];
      const payments = paymentsResult.data || [];
      const subscriptions = subscriptionsResult.data || [];
      const analytics = analyticsResult.data || [];

      // 累加用户统计
      userStats.total += profilesResult.count || profiles.length;
      userStats.newToday += profiles.filter((p) => p.created_at?.startsWith(today)).length;
      userStats.newThisWeek += profiles.filter((p) => p.created_at >= weekAgo).length;
      userStats.newThisMonth += profiles.filter((p) => p.created_at >= monthAgo).length;

      // 累加支付统计
      paymentStats.totalAmount += payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      paymentStats.totalCount += payments.length;
      paymentStats.payingUsers += new Set(payments.map((p) => p.user_id)).size;
      paymentStats.todayAmount += payments
        .filter((p) => p.created_at?.startsWith(today))
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      paymentStats.thisMonthAmount += payments
        .filter((p) => p.created_at >= monthAgo)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      // 累加订阅统计
      subscriptionStats.total += subscriptions.length;
      subscriptionStats.active += subscriptions.filter((s) => s.status === "active").length;
      subscriptions.forEach((s) => {
        subscriptionStats.byPlan[s.plan] = (subscriptionStats.byPlan[s.plan] || 0) + 1;
      });

      // 累加活跃用户统计
      const dauSet = new Set(analytics.filter((a) => a.created_at >= todayStart).map((a) => a.user_id));
      const wauSet = new Set(analytics.filter((a) => a.created_at >= weekAgo).map((a) => a.user_id));
      const mauSet = new Set(analytics.map((a) => a.user_id));
      activeUserStats.dau += dauSet.size;
      activeUserStats.wau += wauSet.size;
      activeUserStats.mau += mauSet.size;

      // 收集分析数据
      allAnalytics.push(...analytics);

      // 来源对比 - global
      if (source === "all") {
        const globalProfiles = profiles.filter((p) => p.source === "global" || !p.source);
        const globalPayments = payments.filter((p) => p.source === "global" || !p.source);
        sourceComparison.global.users = globalProfiles.length;
        sourceComparison.global.revenue = globalPayments.reduce(
          (sum, p) => sum + (Number(p.amount) || 0), 0
        );
      }
    }

    // ========== 查询 CloudBase (国内版) ==========
    if (source === "all" || source === "cn") {
      const cbStats = await getCloudBaseStats();
      if (cbStats) {
        // 累加用户统计
        userStats.total += cbStats.users.total;
        userStats.newToday += cbStats.users.newToday;
        userStats.newThisWeek += cbStats.users.newThisWeek;
        userStats.newThisMonth += cbStats.users.newThisMonth;

        // 累加支付统计 (国内版使用 CNY)
        paymentStats.totalAmount += cbStats.payments.totalAmount;
        paymentStats.totalCount += cbStats.payments.totalCount;
        paymentStats.payingUsers += cbStats.payments.payingUsers;
        paymentStats.todayAmount += cbStats.payments.todayAmount;
        paymentStats.thisMonthAmount += cbStats.payments.thisMonthAmount;

        // 累加订阅统计
        subscriptionStats.total += cbStats.subscriptions.total;
        subscriptionStats.active += cbStats.subscriptions.active;
        Object.entries(cbStats.subscriptions.byPlan).forEach(([plan, count]) => {
          subscriptionStats.byPlan[plan] = (subscriptionStats.byPlan[plan] || 0) + count;
        });

        // 累加活跃用户统计
        const cbAnalytics = cbStats.analytics;
        const dauSet = new Set(cbAnalytics.filter((a) => a.created_at >= todayStart).map((a) => a.user_id));
        const wauSet = new Set(cbAnalytics.filter((a) => a.created_at >= weekAgo).map((a) => a.user_id));
        const mauSet = new Set(cbAnalytics.map((a) => a.user_id));
        activeUserStats.dau += dauSet.size;
        activeUserStats.wau += wauSet.size;
        activeUserStats.mau += mauSet.size;

        // 收集分析数据
        allAnalytics.push(...cbAnalytics);

        // 来源对比 - cn
        if (source === "all") {
          sourceComparison.cn.users = cbStats.users.total;
          sourceComparison.cn.revenue = cbStats.payments.totalAmount;
        }
      }
    }

    // 处理设备统计 (合并后的数据)
    const deviceTypeCounts: Record<string, number> = {};
    const osCounts: Record<string, number> = {};
    const userDevices = new Map<string, { type?: string; os?: string }>();

    allAnalytics.forEach((a) => {
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

    deviceStats = { byType: deviceTypeCounts, byOS: osCounts };

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
 * 支持从 Supabase (global) 和 CloudBase (cn) 获取并合并数据
 * @param days - 获取最近多少天的数据
 * @param source - 数据来源
 */
export async function getDailyStats(
  days: number = 30,
  source: "all" | "global" | "cn" = "all"
): Promise<DailyStatsResult> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

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

    // ========== 查询 Supabase (国际版) ==========
    if ((source === "all" || source === "global") && supabaseAdmin) {
      const [profilesResult, paymentsResult, analyticsResult] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("created_at, source")
          .gte("created_at", startDateStr),
        supabaseAdmin
          .from("payments")
          .select("created_at, amount, source")
          .gte("created_at", startDateStr)
          .in("status", ["success", "completed"]),
        supabaseAdmin
          .from("user_analytics")
          .select("created_at, user_id, source")
          .gte("created_at", startDateStr),
      ]);

      const profiles = profilesResult.data || [];
      const payments = paymentsResult.data || [];
      const analytics = analyticsResult.data || [];

      // 填充新用户数据
      profiles.forEach((p) => {
        const dateStr = p.created_at?.split("T")[0];
        const s = p.source || "global";
        if (source === "global" && s !== "global") return;

        const key = `${dateStr}_${s}`;
        const entry = dailyMap.get(key);
        if (entry) {
          entry.newUsers++;
        }
      });

      // 填充支付数据
      payments.forEach((p) => {
        const dateStr = p.created_at?.split("T")[0];
        const s = p.source || "global";
        if (source === "global" && s !== "global") return;

        const key = `${dateStr}_${s}`;
        const entry = dailyMap.get(key);
        if (entry) {
          entry.revenue += Number(p.amount) || 0;
        }
      });

      // 填充活跃用户数据
      analytics.forEach((a) => {
        const dateStr = a.created_at?.split("T")[0];
        const s = a.source || "global";
        if (source === "global" && s !== "global") return;

        const key = `${dateStr}_${s}`;
        const entry = dailyMap.get(key);
        if (entry) {
          entry.activeUsers.add(a.user_id);
          entry.sessions++;
        }
      });
    }

    // ========== 查询 CloudBase (国内版) ==========
    if (source === "all" || source === "cn") {
      const cbDailyStats = await getCloudBaseDailyStats(days);

      // 合并 CloudBase 数据到 dailyMap
      cbDailyStats.forEach((stat) => {
        const key = `${stat.date}_cn`;
        const entry = dailyMap.get(key);
        if (entry) {
          entry.newUsers += stat.newUsers;
          entry.revenue += stat.revenue;
          entry.sessions += stat.sessions;
          // 活跃用户需要特殊处理（CloudBase 返回的是数量，无法去重）
          // 这里用一个临时 ID 来表示
          for (let i = 0; i < stat.activeUsers; i++) {
            entry.activeUsers.add(`cb_${stat.date}_${i}`);
          }
        }
      });
    }

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

// =============================================================================
// CloudBase (国内版) 数据查询
// =============================================================================

interface CloudBaseStatsData {
  users: { total: number; newToday: number; newThisWeek: number; newThisMonth: number };
  payments: { totalAmount: number; totalCount: number; payingUsers: number; todayAmount: number; thisMonthAmount: number };
  subscriptions: { total: number; active: number; byPlan: Record<string, number> };
  analytics: Array<{ user_id: string; created_at: string; device_type?: string; os?: string }>;
}

async function getCloudBaseStats(): Promise<CloudBaseStatsData | null> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 查询用户
    const usersResult = await db.collection("users").get();
    const users = usersResult.data || [];

    // 查询支付
    const paymentsResult = await db.collection("payments")
      .where({ status: db.command.in(["COMPLETED", "success", "completed"]) })
      .get();
    const payments = paymentsResult.data || [];

    // 查询订阅
    const subscriptionsResult = await db.collection("subscriptions").get();
    const subscriptions = subscriptionsResult.data || [];

    // 查询分析数据
    const analyticsResult = await db.collection("user_analytics")
      .where({ created_at: db.command.gte(monthAgo) })
      .get();
    const analytics = analyticsResult.data || [];

    // 处理用户统计
    const userStats = {
      total: users.length,
      newToday: users.filter((u: any) => u.createdAt?.startsWith(today)).length,
      newThisWeek: users.filter((u: any) => u.createdAt >= weekAgo).length,
      newThisMonth: users.filter((u: any) => u.createdAt >= monthAgo).length,
    };

    // 处理支付统计
    const payingUserIds = new Set(payments.map((p: any) => p.userId));
    const paymentStats = {
      totalAmount: payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0),
      totalCount: payments.length,
      payingUsers: payingUserIds.size,
      todayAmount: payments
        .filter((p: any) => p.createdAt?.startsWith(today))
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0),
      thisMonthAmount: payments
        .filter((p: any) => p.createdAt >= monthAgo)
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0),
    };

    // 处理订阅统计
    const planCounts: Record<string, number> = {};
    subscriptions.forEach((s: any) => {
      const plan = s.plan || "Free";
      planCounts[plan] = (planCounts[plan] || 0) + 1;
    });
    const subscriptionStats = {
      total: subscriptions.length,
      active: subscriptions.filter((s: any) => s.status === "active").length,
      byPlan: planCounts,
    };

    return {
      users: userStats,
      payments: paymentStats,
      subscriptions: subscriptionStats,
      analytics: analytics.map((a: any) => ({
        user_id: a.user_id,
        created_at: a.created_at,
        device_type: a.device_type,
        os: a.os,
      })),
    };
  } catch (err) {
    console.error("[getCloudBaseStats] Error:", err);
    return null;
  }
}

async function getCloudBaseDailyStats(days: number): Promise<Array<{
  date: string;
  source: string;
  newUsers: number;
  revenue: number;
  activeUsers: number;
  sessions: number;
}>> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    // 查询用户
    const usersResult = await db.collection("users")
      .where({ createdAt: db.command.gte(startDateStr) })
      .get();
    const users = usersResult.data || [];

    // 查询支付
    const paymentsResult = await db.collection("payments")
      .where({
        createdAt: db.command.gte(startDateStr),
        status: db.command.in(["COMPLETED", "success", "completed"]),
      })
      .get();
    const payments = paymentsResult.data || [];

    // 查询分析
    const analyticsResult = await db.collection("user_analytics")
      .where({ created_at: db.command.gte(startDateStr) })
      .get();
    const analytics = analyticsResult.data || [];

    // 按日期聚合
    const dailyMap = new Map<string, {
      date: string;
      newUsers: number;
      revenue: number;
      activeUsers: Set<string>;
      sessions: number;
    }>();

    // 初始化日期
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      dailyMap.set(dateStr, {
        date: dateStr,
        newUsers: 0,
        revenue: 0,
        activeUsers: new Set(),
        sessions: 0,
      });
    }

    // 填充新用户
    users.forEach((u: any) => {
      const dateStr = u.createdAt?.split("T")[0];
      const entry = dailyMap.get(dateStr);
      if (entry) entry.newUsers++;
    });

    // 填充支付
    payments.forEach((p: any) => {
      const dateStr = p.createdAt?.split("T")[0];
      const entry = dailyMap.get(dateStr);
      if (entry) entry.revenue += Number(p.amount) || 0;
    });

    // 填充活跃用户
    analytics.forEach((a: any) => {
      const dateStr = a.created_at?.split("T")[0];
      const entry = dailyMap.get(dateStr);
      if (entry) {
        entry.activeUsers.add(a.user_id);
        entry.sessions++;
      }
    });

    return Array.from(dailyMap.values()).map((entry) => ({
      date: entry.date,
      source: "cn",
      newUsers: entry.newUsers,
      revenue: entry.revenue,
      activeUsers: entry.activeUsers.size,
      sessions: entry.sessions,
    }));
  } catch (err) {
    console.error("[getCloudBaseDailyStats] Error:", err);
    return [];
  }
}
