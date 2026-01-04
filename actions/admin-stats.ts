"use server";

/**
 * 用户数据统计 Server Actions
 * 支持国内版 (CloudBase) 和国际版 (Supabase) 数据源
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getAdminSession } from "@/utils/session";

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
  global: { users: number; revenue: number; todayRevenue: number };
  cn: { users: number; revenue: number; todayRevenue: number };
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
  // 权限验证：仅管理员可访问
  const session = await getAdminSession();
  if (!session) {
    return { success: false, error: "未授权访问" };
  }

  return await getAdminStatsFallback(source);
}

/**
 * 后备方案：直接查询各表获取统计数据
 * 支持从 Supabase (global) 和 CloudBase (cn) 获取并合并数据
 * 兼容缺少 source 字段和 user_analytics 表的情况
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
      global: { users: 0, revenue: 0, todayRevenue: 0 },
      cn: { users: 0, revenue: 0, todayRevenue: 0 },
    };

    // 收集所有活跃用户分析数据用于设备统计
    const allAnalytics: Array<{ user_id: string; created_at: string; device_type?: string; os?: string }> = [];

    // ========== 查询 Supabase (国际版) ==========
    if ((source === "all" || source === "global") && supabaseAdmin) {
      // 分别查询各表，避免因某个表/字段不存在导致整体失败
      let profiles: any[] = [];
      let payments: any[] = [];
      let subscriptions: any[] = [];
      let analytics: any[] = [];
      let profilesCount = 0;

      // 查询 profiles（不依赖 source 字段）
      try {
        const profilesResult = await supabaseAdmin
          .from("profiles")
          .select("id, created_at", { count: "exact" });
        profiles = profilesResult.data || [];
        profilesCount = profilesResult.count || profiles.length;
      } catch (err) {
        console.warn("[getAdminStatsFallback] profiles query failed:", err);
      }

      // 查询 payments（不依赖 source 字段）
      try {
        const paymentsResult = await supabaseAdmin
          .from("payments")
          .select("amount, user_id, created_at")
          .in("status", ["success", "completed", "SUCCESS", "COMPLETED"]);
        payments = paymentsResult.data || [];
      } catch (err) {
        console.warn("[getAdminStatsFallback] payments query failed:", err);
      }

      // 查询 subscriptions（不依赖 source 字段）
      try {
        const subscriptionsResult = await supabaseAdmin
          .from("subscriptions")
          .select("plan, status");
        subscriptions = subscriptionsResult.data || [];
      } catch (err) {
        console.warn("[getAdminStatsFallback] subscriptions query failed:", err);
      }

      // 查询 user_analytics（可能不存在）
      try {
        const analyticsResult = await supabaseAdmin
          .from("user_analytics")
          .select("user_id, created_at, device_type, os")
          .gte("created_at", monthAgo);
        analytics = analyticsResult.data || [];
      } catch (err) {
        console.warn("[getAdminStatsFallback] user_analytics query failed (table may not exist):", err);
      }

      // 累加用户统计
      userStats.total += profilesCount;
      userStats.newToday += profiles.filter((p) => p.created_at?.startsWith(today)).length;
      userStats.newThisWeek += profiles.filter((p) => p.created_at >= weekAgo).length;
      userStats.newThisMonth += profiles.filter((p) => p.created_at >= monthAgo).length;

      // 累加支付统计（单次遍历优化）
      const payingUserSet = new Set<string>();
      let totalAmt = 0, todayAmt = 0, monthAmt = 0;
      for (const p of payments) {
        const amt = Number(p.amount) || 0;
        totalAmt += amt;
        if (p.user_id) payingUserSet.add(p.user_id);
        if (p.created_at?.startsWith(today)) todayAmt += amt;
        if (p.created_at >= monthAgo) monthAmt += amt;
      }
      paymentStats.totalAmount += totalAmt;
      paymentStats.totalCount += payments.length;
      paymentStats.payingUsers += payingUserSet.size;
      paymentStats.todayAmount += todayAmt;
      paymentStats.thisMonthAmount += monthAmt;

      // 累加订阅统计
      subscriptionStats.total += subscriptions.length;
      subscriptionStats.active += subscriptions.filter((s) => s.status === "active").length;
      subscriptions.forEach((s) => {
        subscriptionStats.byPlan[s.plan] = (subscriptionStats.byPlan[s.plan] || 0) + 1;
      });

      // 累加活跃用户统计（如果 user_analytics 表存在）
      if (analytics.length > 0) {
        const dauSet = new Set(analytics.filter((a) => a.created_at >= todayStart).map((a) => a.user_id));
        const wauSet = new Set(analytics.filter((a) => a.created_at >= weekAgo).map((a) => a.user_id));
        const mauSet = new Set(analytics.map((a) => a.user_id));
        activeUserStats.dau += dauSet.size;
        activeUserStats.wau += wauSet.size;
        activeUserStats.mau += mauSet.size;
        allAnalytics.push(...analytics);
      } else {
        // 如果没有 user_analytics 数据，使用 profiles 作为活跃用户的近似值
        activeUserStats.mau = profilesCount;
      }

      // 来源对比 - global（复用已计算的值）
      if (source === "all") {
        sourceComparison.global.users = profilesCount;
        sourceComparison.global.revenue = totalAmt;
        sourceComparison.global.todayRevenue = todayAmt;
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
          sourceComparison.cn.todayRevenue = cbStats.payments.todayAmount;
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
  // 权限验证：仅管理员可访问
  const session = await getAdminSession();
  if (!session) {
    return { success: false, error: "未授权访问" };
  }

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
      // 分别查询各表，避免因某个表/字段不存在导致整体失败
      let profiles: any[] = [];
      let payments: any[] = [];
      let analytics: any[] = [];

      try {
        const profilesResult = await supabaseAdmin
          .from("profiles")
          .select("created_at")
          .gte("created_at", startDateStr);
        profiles = profilesResult.data || [];
      } catch (err) {
        console.warn("[getDailyStats] profiles query failed:", err);
      }

      try {
        const paymentsResult = await supabaseAdmin
          .from("payments")
          .select("created_at, amount")
          .gte("created_at", startDateStr)
          .in("status", ["success", "completed", "SUCCESS", "COMPLETED"]);
        payments = paymentsResult.data || [];
      } catch (err) {
        console.warn("[getDailyStats] payments query failed:", err);
      }

      try {
        const analyticsResult = await supabaseAdmin
          .from("user_analytics")
          .select("created_at, user_id")
          .gte("created_at", startDateStr);
        analytics = analyticsResult.data || [];
      } catch (err) {
        console.warn("[getDailyStats] user_analytics query failed (table may not exist):", err);
      }

      // 填充新用户数据（所有 Supabase 数据视为 global）
      profiles.forEach((p) => {
        const dateStr = p.created_at?.split("T")[0];
        const key = `${dateStr}_global`;
        const entry = dailyMap.get(key);
        if (entry) {
          entry.newUsers++;
        }
      });

      // 填充支付数据
      payments.forEach((p) => {
        const dateStr = p.created_at?.split("T")[0];
        const key = `${dateStr}_global`;
        const entry = dailyMap.get(key);
        if (entry) {
          entry.revenue += Number(p.amount) || 0;
        }
      });

      // 填充活跃用户数据
      analytics.forEach((a) => {
        const dateStr = a.created_at?.split("T")[0];
        const key = `${dateStr}_global`;
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

    // 分别查询各集合，避免因某个集合不存在导致整体失败
    let users: any[] = [];
    let payments: any[] = [];
    let subscriptions: any[] = [];
    let analytics: any[] = [];

    // 查询用户（CloudBase 需要 where 条件才能正常查询）
    try {
      const usersResult = await db.collection("users").where({}).limit(1000).get();
      users = usersResult.data || [];
    } catch (err) {
      console.warn("[getCloudBaseStats] users collection query failed:", err);
    }

    // 查���支付（获取所有记录后在内存中过滤）
    try {
      const paymentsResult = await db.collection("payments").where({}).limit(1000).get();
      const allPayments = paymentsResult.data || [];
      // 在内存中过滤已完成的支付
      payments = allPayments.filter((p: any) => {
        const status = (p.status || "").toString().toUpperCase();
        return status === "COMPLETED" || status === "SUCCESS";
      });
    } catch (err) {
      console.warn("[getCloudBaseStats] payments collection query failed:", err);
    }

    // 查询订阅
    try {
      const subscriptionsResult = await db.collection("subscriptions").where({}).limit(1000).get();
      subscriptions = subscriptionsResult.data || [];
    } catch (err) {
      console.warn("[getCloudBaseStats] subscriptions collection query failed:", err);
    }

    // 查询分析数据（可能不存在）
    try {
      const analyticsResult = await db.collection("user_analytics")
        .where({ created_at: db.command.gte(monthAgo) })
        .limit(1000)
        .get();
      analytics = analyticsResult.data || [];
    } catch (err) {
      console.warn("[getCloudBaseStats] user_analytics collection query failed (may not exist):", err);
    }

    // 处理用户统计
    const userStats = {
      total: users.length,
      newToday: users.filter((u: any) => u.createdAt?.startsWith(today)).length,
      newThisWeek: users.filter((u: any) => u.createdAt >= weekAgo).length,
      newThisMonth: users.filter((u: any) => u.createdAt >= monthAgo).length,
    };

    // 处理支付统计（单次遍历优化）
    const payingUserIds = new Set<string>();
    let totalAmount = 0, todayAmount = 0, thisMonthAmount = 0;
    for (const p of payments) {
      const amount = Number(p.amount) || 0;
      totalAmount += amount;
      if (p.userId) payingUserIds.add(p.userId);
      if (p.createdAt?.startsWith(today)) todayAmount += amount;
      if (p.createdAt >= monthAgo) thisMonthAmount += amount;
    }
    const paymentStats = {
      totalAmount,
      totalCount: payments.length,
      payingUsers: payingUserIds.size,
      todayAmount,
      thisMonthAmount,
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

    // 分别查询各集合，避免因某个集合不存在导致整体失败
    let users: any[] = [];
    let payments: any[] = [];
    let analytics: any[] = [];

    // 查询用户（CloudBase 默认只返回 20 条，需要设置 limit）
    try {
      const usersResult = await db.collection("users")
        .where({ createdAt: db.command.gte(startDateStr) })
        .limit(1000)
        .get();
      users = usersResult.data || [];
    } catch (err) {
      console.warn("[getCloudBaseDailyStats] users collection query failed:", err);
    }

    // 查询支付（不使用 where 条件，获取所有记录后在内存中过滤）
    try {
      const paymentsResult = await db.collection("payments").limit(1000).get();
      const allPayments = paymentsResult.data || [];
      // 在内存中过滤：时间范围内且已完成的支付
      payments = allPayments.filter((p: any) => {
        const status = (p.status || "").toString().toUpperCase();
        const isCompleted = status === "COMPLETED" || status === "SUCCESS";
        const inRange = p.createdAt && p.createdAt >= startDateStr;
        return isCompleted && inRange;
      });
    } catch (err) {
      console.warn("[getCloudBaseDailyStats] payments collection query failed:", err);
    }

    // 查询分析（可能不存在）
    try {
      const analyticsResult = await db.collection("user_analytics")
        .where({ created_at: db.command.gte(startDateStr) })
        .limit(1000)
        .get();
      analytics = analyticsResult.data || [];
    } catch (err) {
      console.warn("[getCloudBaseDailyStats] user_analytics collection query failed (may not exist):", err);
    }

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
