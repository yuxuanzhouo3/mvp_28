/**
 * 用户分析服务 - 统一支持国内版 (CloudBase) 和国际版 (Supabase)
 * 用于记录用户行为、登录、注册等事件
 */

import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// =============================================================================
// 类型定义
// =============================================================================

export type AnalyticsEventType =
  | "session_start"      // 会话开始（登录）
  | "session_end"        // 会话结束（登出）
  | "register"           // 用户注册
  | "page_view"          // 页面访问
  | "feature_use"        // 功能使用
  | "payment"            // 支付行为
  | "subscription"       // 订阅变更
  | "error";             // 错误上报

export interface AnalyticsEventParams {
  userId: string;
  eventType: AnalyticsEventType;
  source?: "global" | "cn";
  deviceType?: string;       // 'desktop', 'mobile', 'tablet'
  os?: string;               // 'Windows', 'macOS', 'iOS', 'Android', 'Linux'
  browser?: string;          // 'Chrome', 'Safari', 'Firefox', 'Edge', 'App'
  appVersion?: string;       // 客户端版本号
  screenResolution?: string; // 屏幕分辨率
  language?: string;         // 浏览器语言
  country?: string;          // 国家代码
  region?: string;           // 地区/省份
  city?: string;             // 城市
  eventData?: Record<string, unknown>;
  sessionId?: string;
  referrer?: string;
}

export interface TrackResult {
  success: boolean;
  error?: string;
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 从 User-Agent 解析设备信息
 */
export function parseUserAgent(userAgent?: string): {
  deviceType: string;
  os: string;
  browser: string;
} {
  if (!userAgent) {
    return { deviceType: "unknown", os: "unknown", browser: "unknown" };
  }

  const ua = userAgent.toLowerCase();

  // 检测设备类型
  let deviceType = "desktop";
  if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceType = /ipad|tablet/i.test(ua) ? "tablet" : "mobile";
  }

  // 检测操作系统
  let os = "unknown";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/linux/i.test(ua)) os = "Linux";

  // 检测浏览器
  let browser = "unknown";
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua)) browser = "Safari";
  else if (/firefox/i.test(ua)) browser = "Firefox";
  else if (/opera|opr/i.test(ua)) browser = "Opera";

  return { deviceType, os, browser };
}

/**
 * 生成会话 ID
 */
export function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// =============================================================================
// CloudBase (国内版) 实现
// =============================================================================

async function trackCloudBaseEvent(params: AnalyticsEventParams): Promise<TrackResult> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const eventData = {
      user_id: params.userId,
      source: params.source || "cn",
      event_type: params.eventType,
      device_type: params.deviceType || null,
      os: params.os || null,
      browser: params.browser || null,
      app_version: params.appVersion || null,
      screen_resolution: params.screenResolution || null,
      language: params.language || null,
      country: params.country || null,
      region: params.region || null,
      city: params.city || null,
      event_data: params.eventData || {},
      session_id: params.sessionId || null,
      referrer: params.referrer || null,
      created_at: new Date().toISOString(),
    };

    await db.collection("user_analytics").add(eventData);

    return { success: true };
  } catch (error) {
    console.error("[analytics] CloudBase track error:", error);
    return { success: false, error: error instanceof Error ? error.message : "记录事件失败" };
  }
}

// =============================================================================
// Supabase (国际版) 实现
// =============================================================================

async function trackSupabaseEvent(params: AnalyticsEventParams): Promise<TrackResult> {
  if (!supabaseAdmin) {
    return { success: false, error: "supabaseAdmin not available" };
  }

  try {
    const { error } = await supabaseAdmin.from("user_analytics").insert({
      user_id: params.userId,
      source: params.source || "global",
      event_type: params.eventType,
      device_type: params.deviceType || null,
      os: params.os || null,
      browser: params.browser || null,
      app_version: params.appVersion || null,
      screen_resolution: params.screenResolution || null,
      language: params.language || null,
      country: params.country || null,
      region: params.region || null,
      city: params.city || null,
      event_data: params.eventData || {},
      session_id: params.sessionId || null,
      referrer: params.referrer || null,
    });

    if (error) {
      console.error("[analytics] Supabase track error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("[analytics] Supabase track error:", error);
    return { success: false, error: error instanceof Error ? error.message : "记录事件失败" };
  }
}

// =============================================================================
// 统一导出函数
// =============================================================================

/**
 * 记录用户分析事件
 * 自动根据版本选择 CloudBase 或 Supabase
 */
export async function trackAnalyticsEvent(params: AnalyticsEventParams): Promise<TrackResult> {
  // 根据版本自动设置 source
  if (!params.source) {
    params.source = IS_DOMESTIC_VERSION ? "cn" : "global";
  }

  if (IS_DOMESTIC_VERSION) {
    return trackCloudBaseEvent(params);
  } else {
    return trackSupabaseEvent(params);
  }
}

/**
 * 记录用户登录事件
 */
export async function trackLoginEvent(
  userId: string,
  options?: {
    userAgent?: string;
    language?: string;
    referrer?: string;
  }
): Promise<TrackResult> {
  const deviceInfo = parseUserAgent(options?.userAgent);

  return trackAnalyticsEvent({
    userId,
    eventType: "session_start",
    ...deviceInfo,
    language: options?.language,
    referrer: options?.referrer,
    sessionId: generateSessionId(),
    eventData: {
      loginMethod: "email",
    },
  });
}

/**
 * 记录用户注册事件
 */
export async function trackRegisterEvent(
  userId: string,
  options?: {
    userAgent?: string;
    language?: string;
    referrer?: string;
    registerMethod?: string;
  }
): Promise<TrackResult> {
  const deviceInfo = parseUserAgent(options?.userAgent);

  return trackAnalyticsEvent({
    userId,
    eventType: "register",
    ...deviceInfo,
    language: options?.language,
    referrer: options?.referrer,
    sessionId: generateSessionId(),
    eventData: {
      registerMethod: options?.registerMethod || "email",
    },
  });
}

/**
 * 记录微信登录事件
 */
export async function trackWechatLoginEvent(
  userId: string,
  options?: {
    userAgent?: string;
    language?: string;
    isNewUser?: boolean;
  }
): Promise<TrackResult> {
  const deviceInfo = parseUserAgent(options?.userAgent);

  return trackAnalyticsEvent({
    userId,
    eventType: options?.isNewUser ? "register" : "session_start",
    ...deviceInfo,
    language: options?.language,
    sessionId: generateSessionId(),
    eventData: {
      loginMethod: "wechat",
      isNewUser: options?.isNewUser || false,
    },
  });
}

/**
 * 记录支付事件
 */
export async function trackPaymentEvent(
  userId: string,
  paymentData: {
    amount: number;
    currency: string;
    plan?: string;
    provider: string;
    orderId?: string;
  }
): Promise<TrackResult> {
  return trackAnalyticsEvent({
    userId,
    eventType: "payment",
    eventData: paymentData,
  });
}

/**
 * 记录订阅变更事件
 */
export async function trackSubscriptionEvent(
  userId: string,
  subscriptionData: {
    action: "subscribe" | "upgrade" | "downgrade" | "cancel" | "renew";
    fromPlan?: string;
    toPlan: string;
    period?: string;
  }
): Promise<TrackResult> {
  return trackAnalyticsEvent({
    userId,
    eventType: "subscription",
    eventData: subscriptionData,
  });
}
