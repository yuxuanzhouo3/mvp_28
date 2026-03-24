// lib/payment/payment-record-helper.ts
// 支付记录数据库操作共享模块

import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";

/** 支付记录类型 */
export interface PaymentRecord {
  _id?: string;
  id?: string;
  userId?: string;
  user_id?: string;
  status?: string;
  amount?: number;
  type?: string;
  plan?: string;
  period?: string;
  imageCredits?: number;
  videoAudioCredits?: number;
  metadata?: Record<string, any>;
  [key: string]: any;
}

/** Webhook 事件类型 */
export interface WebhookEvent {
  id: string;
  provider: string;
  event_type: string;
  event_data: any;
  processed: boolean;
  created_at: string;
  processed_at?: string;
}

/**
 * 查询支付记录
 */
export async function queryPaymentRecord(
  provider: string,
  providerOrderId: string
): Promise<PaymentRecord | null> {
  if (IS_DOMESTIC_VERSION) {
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      const result = await db
        .collection("payments")
        .where({ provider, providerOrderId })
        .get();
      return result.data?.[0] || null;
    } catch (error) {
      console.error(`[payment-record-helper] CloudBase query error:`, error);
      return null;
    }
  } else {
    try {
      const { data } = await supabaseAdmin!
        .from("payments")
        .select("*")
        .eq("provider_order_id", providerOrderId)
        .maybeSingle();
      return data || null;
    } catch (error) {
      console.error(`[payment-record-helper] Supabase query error:`, error);
      return null;
    }
  }
}

/**
 * 更新支付记录
 */
export async function updatePaymentRecord(
  provider: string,
  providerOrderId: string,
  updateData: Record<string, any>,
  docId?: string
): Promise<boolean> {
  if (IS_DOMESTIC_VERSION) {
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      if (docId) {
        await db.collection("payments").doc(docId).update(updateData);
      } else {
        await db
          .collection("payments")
          .where({ provider, providerOrderId })
          .update(updateData);
      }
      return true;
    } catch (error) {
      console.error(`[payment-record-helper] CloudBase update error:`, error);
      return false;
    }
  } else {
    try {
      await supabaseAdmin!
        .from("payments")
        .update(updateData)
        .eq("provider_order_id", providerOrderId);
      return true;
    } catch (error) {
      console.error(`[payment-record-helper] Supabase update error:`, error);
      return false;
    }
  }
}

/**
 * 检查 webhook 事件是否已处理（幂等性检查）
 */
export async function isWebhookEventProcessed(eventId: string): Promise<boolean> {
  if (IS_DOMESTIC_VERSION) {
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      const result = await db
        .collection("webhook_events")
        .where({ id: eventId, processed: true })
        .get();
      return (result.data?.length || 0) > 0;
    } catch (error) {
      console.error(`[payment-record-helper] CloudBase event check error:`, error);
      return false;
    }
  } else {
    try {
      const { data } = await supabaseAdmin!
        .from("webhook_events")
        .select("id")
        .eq("id", eventId)
        .eq("processed", true)
        .maybeSingle();
      return !!data;
    } catch (error) {
      console.error(`[payment-record-helper] Supabase event check error:`, error);
      return false;
    }
  }
}

/**
 * 保存 webhook 事件
 */
export async function saveWebhookEvent(event: WebhookEvent): Promise<boolean> {
  if (IS_DOMESTIC_VERSION) {
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      await db.collection("webhook_events").add(event);
      return true;
    } catch (error) {
      console.error(`[payment-record-helper] CloudBase event save error:`, error);
      return false;
    }
  } else {
    try {
      await supabaseAdmin!.from("webhook_events").insert([event]);
      return true;
    } catch (error) {
      console.error(`[payment-record-helper] Supabase event save error:`, error);
      return false;
    }
  }
}

/**
 * 标记 webhook 事件为已处理
 */
export async function markWebhookEventProcessed(eventId: string): Promise<boolean> {
  const updateData = {
    processed: true,
    processed_at: new Date().toISOString(),
  };

  if (IS_DOMESTIC_VERSION) {
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      await db
        .collection("webhook_events")
        .where({ id: eventId })
        .update(updateData);
      return true;
    } catch (error) {
      console.error(`[payment-record-helper] CloudBase event update error:`, error);
      return false;
    }
  } else {
    try {
      await supabaseAdmin!
        .from("webhook_events")
        .update(updateData)
        .eq("id", eventId);
      return true;
    } catch (error) {
      console.error(`[payment-record-helper] Supabase event update error:`, error);
      return false;
    }
  }
}

/**
 * 检查支付是否已完成
 */
export function isPaymentCompleted(paymentRecord: PaymentRecord | null): boolean {
  if (!paymentRecord) return false;
  const status = (paymentRecord.status || "").toString().toUpperCase();
  return status === "COMPLETED";
}

/**
 * 验证支付金额
 */
export function validatePaymentAmount(
  expectedAmount: number,
  paidAmount: number,
  tolerance: number = 0.01
): boolean {
  if (expectedAmount <= 0) return true;
  return Math.abs(expectedAmount - paidAmount) <= tolerance;
}

/**
 * 从支付记录中提取用户 ID
 */
export function extractUserId(paymentRecord: PaymentRecord | null, fallbackUserId?: string): string {
  return (paymentRecord?.userId || paymentRecord?.user_id || fallbackUserId || "") as string;
}

/**
 * 从支付记录中提取加油包额度
 */
export function extractAddonCredits(paymentRecord: PaymentRecord | null): {
  imageCredits: number;
  videoAudioCredits: number;
} {
  return {
    imageCredits: Number(paymentRecord?.imageCredits ?? paymentRecord?.metadata?.imageCredits ?? 0),
    videoAudioCredits: Number(paymentRecord?.videoAudioCredits ?? paymentRecord?.metadata?.videoAudioCredits ?? 0),
  };
}

/**
 * 判断是否为加油包购买
 */
export function isAddonPayment(paymentRecord: PaymentRecord | null): boolean {
  const type = (paymentRecord?.type || paymentRecord?.metadata?.productType || "").toString().toUpperCase();
  return type === "ADDON";
}

/**
 * 检查支付记录是否已存在（幂等性检查）
 */
export async function checkPaymentExists(
  provider: string,
  providerOrderId: string
): Promise<boolean> {
  if (IS_DOMESTIC_VERSION) {
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      const result = await db
        .collection("payments")
        .where({ provider, providerOrderId })
        .limit(1)
        .get();
      return (result.data?.length || 0) > 0;
    } catch (error) {
      console.error(`[payment-record-helper] CloudBase check error:`, error);
      return false;
    }
  } else {
    try {
      const { data } = await supabaseAdmin!
        .from("payments")
        .select("id")
        .eq("provider_order_id", providerOrderId)
        .eq("provider", provider)
        .maybeSingle();
      return !!data;
    } catch (error) {
      console.error(`[payment-record-helper] Supabase check error:`, error);
      return false;
    }
  }
}

/** 支付记录插入参数 */
export interface InsertPaymentParams {
  userId: string;
  provider: string;
  providerOrderId: string;
  amount: number;
  currency: string;
  status?: string;
  type: "ADDON" | "SUBSCRIPTION";
  plan?: string | null;
  period?: string | null;
  addonPackageId?: string | null;
  imageCredits?: number;
  videoAudioCredits?: number;
}

/**
 * 插入支付记录
 */
export async function insertPaymentRecord(params: InsertPaymentParams): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const {
    userId, provider, providerOrderId, amount, currency,
    status = "COMPLETED", type, plan, period,
    addonPackageId, imageCredits = 0, videoAudioCredits = 0,
  } = params;

  if (IS_DOMESTIC_VERSION) {
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      await db.collection("payments").add({
        userId,
        provider,
        providerOrderId,
        amount,
        currency,
        status,
        type,
        plan: plan || null,
        period: period || null,
        addonPackageId: addonPackageId || null,
        imageCredits,
        videoAudioCredits,
        createdAt: nowIso,
        source: "cn",
      });
      return true;
    } catch (error) {
      console.error(`[payment-record-helper] CloudBase insert error:`, error);
      return false;
    }
  } else {
    try {
      await supabaseAdmin!.from("payments").insert({
        user_id: userId,
        provider,
        provider_order_id: providerOrderId,
        amount,
        currency,
        status,
        type,
        plan: plan || null,
        period: period || null,
        addon_package_id: addonPackageId || null,
        image_credits: imageCredits,
        video_audio_credits: videoAudioCredits,
        source: "global",
      });
      return true;
    } catch (error) {
      console.error(`[payment-record-helper] Supabase insert error:`, error);
      return false;
    }
  }
}

/**
 * 验证支付金额（分为单位）
 */
export function validatePaymentAmountCents(
  expectedCents: number,
  actualCents: number
): boolean {
  if (expectedCents <= 0 || Number.isNaN(expectedCents)) return true;
  return expectedCents === actualCents;
}
