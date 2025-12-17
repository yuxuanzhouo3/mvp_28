// lib/payment/webhook-handler.ts - 统一 Webhook 处理器
import { supabaseAdmin } from "../integrations/supabase-admin";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export interface WebhookEvent {
  id: string;
  provider: "paypal" | "stripe" | "alipay" | "wechat";
  eventType: string;
  eventData: any;
  processed: boolean;
  createdAt: string;
  processedAt?: string;
}

export class WebhookHandler {
  private static instance: WebhookHandler;

  static getInstance(): WebhookHandler {
    if (!WebhookHandler.instance) {
      WebhookHandler.instance = new WebhookHandler();
    }
    return WebhookHandler.instance;
  }

  /**
   * 处理 webhook 事件
   */
  async processWebhook(
    provider: string,
    eventType: string,
    eventData: any
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      // 生成事件ID（基于提供商和事件数据）
      const eventId = this.generateEventId(provider, eventData);

      console.log(`📥 [WebhookHandler] Processing: ${provider} ${eventType}`, {
        eventId,
      });

      // 检查事件是否已处理（幂等性）
      const existingEvent = await this.getProcessedEvent(eventId);
      if (existingEvent) {
        console.log(`⏭️  [WebhookHandler] Event already processed:`, { eventId });
        return true;
      }

      // 记录事件
      await this.recordEvent(eventId, provider, eventType, eventData);

      // 根据提供商和事件类型处理
      const success = await this.handleEvent(provider, eventType, eventData);

      // 标记为已处理
      if (success) {
        await this.markEventProcessed(eventId);
        console.log(`✅ [WebhookHandler] Processed successfully`, {
          eventId,
          duration: `${Date.now() - startTime}ms`,
        });
      } else {
        console.error(`❌ [WebhookHandler] Processing failed`, {
          eventId,
          duration: `${Date.now() - startTime}ms`,
        });
      }

      return success;
    } catch (error) {
      console.error(`❌ [WebhookHandler] Error:`, error);
      return false;
    }
  }

  /**
   * 生成事件唯一ID
   */
  private generateEventId(provider: string, eventData: any): string {
    let uniqueKey = "";

    switch (provider) {
      case "paypal":
        uniqueKey =
          eventData._paypal_transmission_id ||
          eventData.id ||
          eventData.resource?.id ||
          JSON.stringify(eventData);
        break;
      case "stripe":
        uniqueKey =
          eventData.id ||
          eventData.data?.object?.id ||
          JSON.stringify(eventData);
        break;
      case "alipay":
        uniqueKey =
          eventData.out_trade_no ||
          eventData.trade_no ||
          JSON.stringify(eventData);
        break;
      case "wechat":
        uniqueKey =
          eventData.out_trade_no ||
          eventData.transaction_id ||
          JSON.stringify(eventData);
        break;
      default:
        uniqueKey = JSON.stringify(eventData);
    }

    return `${provider}_${uniqueKey}`;
  }

  /**
   * 检查事件是否已处理
   */
  private async getProcessedEvent(
    eventId: string
  ): Promise<WebhookEvent | null> {
    try {
      if (IS_DOMESTIC_VERSION) {
        // CloudBase 查询
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        const result = await db
          .collection("webhook_events")
          .where({ id: eventId, processed: true })
          .get();
        if (result.data && result.data.length > 0) {
          return result.data[0] as WebhookEvent;
        }
        return null;
      } else {
        // Supabase 查询
        const { data, error } = await supabaseAdmin
          .from("webhook_events")
          .select("*")
          .eq("id", eventId)
          .eq("processed", true)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          console.error("Error checking processed event:", error);
          return null;
        }

        return data;
      }
    } catch (error) {
      console.error("Error getting processed event:", error);
      return null;
    }
  }

  /**
   * 记录 webhook 事件
   */
  private async recordEvent(
    eventId: string,
    provider: string,
    eventType: string,
    eventData: any
  ): Promise<void> {
    try {
      const eventRecord = {
        id: eventId,
        provider,
        event_type: eventType,
        event_data: eventData,
        processed: false,
        created_at: new Date().toISOString(),
      };

      if (IS_DOMESTIC_VERSION) {
        // CloudBase 插入/更新
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();

        // 检查是否已存在
        const existing = await db
          .collection("webhook_events")
          .where({ id: eventId })
          .get();

        if (existing.data && existing.data.length > 0) {
          // 更新现有记录
          await db
            .collection("webhook_events")
            .doc(existing.data[0]._id)
            .update(eventRecord);
        } else {
          // 插入新记录
          await db.collection("webhook_events").add(eventRecord);
        }
      } else {
        // Supabase upsert
        const { error } = await supabaseAdmin.from("webhook_events").upsert(eventRecord);

        if (error) {
          console.error("Error recording webhook event:", error);
        }
      }
    } catch (error) {
      console.error("Error recording webhook event:", error);
    }
  }

  /**
   * 标记事件为已处理
   */
  private async markEventProcessed(eventId: string): Promise<void> {
    try {
      const updateData = {
        processed: true,
        processed_at: new Date().toISOString(),
      };

      if (IS_DOMESTIC_VERSION) {
        // CloudBase 更新
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();

        const existing = await db
          .collection("webhook_events")
          .where({ id: eventId })
          .get();

        if (existing.data && existing.data.length > 0) {
          await db
            .collection("webhook_events")
            .doc(existing.data[0]._id)
            .update(updateData);
        }
      } else {
        // Supabase 更新
        const { error } = await supabaseAdmin
          .from("webhook_events")
          .update(updateData)
          .eq("id", eventId);

        if (error) {
          console.error("Error marking event processed:", error);
        }
      }
    } catch (error) {
      console.error("Error marking event processed:", error);
    }
  }

  /**
   * 处理具体事件
   */
  private async handleEvent(
    provider: string,
    eventType: string,
    eventData: any
  ): Promise<boolean> {
    try {
      switch (provider) {
        case "alipay":
          return await this.handleAlipayEvent(eventType, eventData);
        case "wechat":
          return await this.handleWechatEvent(eventType, eventData);
        default:
          console.log(`Unknown provider: ${provider}`);
          return false;
      }
    } catch (error) {
      console.error(`Error handling ${provider} event:`, error);
      return false;
    }
  }

  /**
   * 处理支付宝事件
   */
  private async handleAlipayEvent(
    eventType: string,
    eventData: any
  ): Promise<boolean> {
    switch (eventType) {
      case "TRADE_SUCCESS":
      case "TRADE_FINISHED":
        return await this.handlePaymentSuccess("alipay", eventData);

      default:
        console.log(`Unhandled Alipay event: ${eventType}`);
        return true;
    }
  }

  /**
   * 处理微信支付事件
   */
  private async handleWechatEvent(
    eventType: string,
    eventData: any
  ): Promise<boolean> {
    switch (eventType) {
      case "SUCCESS":
        return await this.handlePaymentSuccess("wechat", eventData);

      default:
        console.log(`Unhandled WeChat event: ${eventType}`);
        return true;
    }
  }

  /**
   * 处理支付成功事件
   */
  private async handlePaymentSuccess(
    provider: string,
    data: any
  ): Promise<boolean> {
    console.log("🔥 [WebhookHandler] handlePaymentSuccess", {
      provider,
      dataKeys: Object.keys(data).slice(0, 10),
    });

    try {
      let subscriptionId = "";
      let userId = "";
      let amount = 0;
      let currency = "CNY";
      let days = 30;

      // 根据提供商提取数据
      switch (provider) {
        case "alipay":
          subscriptionId = data.out_trade_no;
          // passback_params 是支付宝原样返回的字符串，包含 userId
          userId = data.passback_params || "";
          amount = parseFloat(data.total_amount || "0");
          currency = "CNY";
          break;

        case "wechat":
          subscriptionId = data.out_trade_no;
          userId = data.attach?.userId || "";
          amount = (data.amount?.total || 0) / 100; // 微信使用分
          currency = "CNY";
          break;
      }

      if (!userId || !subscriptionId) {
        console.error(
          `Missing userId or subscriptionId for ${provider} payment`,
          { subscriptionId, userId }
        );
        return false;
      }

      // 从 payments 表读取已存储的支付信息
      let paymentData: any = null;
      try {
        if (IS_DOMESTIC_VERSION) {
          // CloudBase 查询
          const connector = new CloudBaseConnector();
          await connector.initialize();
          const db = connector.getClient();
          const result = await db
            .collection("payments")
            .where({ transaction_id: subscriptionId })
            .orderBy("created_at", "desc")
            .limit(1)
            .get();
          if (result.data && result.data.length > 0) {
            paymentData = result.data[0];
          }
        } else {
          // Supabase 查询
          const { data: queryData } = await supabaseAdmin
            .from("payments")
            .select("*")
            .eq("transaction_id", subscriptionId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          paymentData = queryData;
        }

        if (paymentData?.metadata?.days) {
          days =
            typeof paymentData.metadata.days === "string"
              ? parseInt(paymentData.metadata.days, 10)
              : paymentData.metadata.days;
          console.log(`Days extracted from payment metadata:`, {
            subscriptionId,
            userId,
            days,
          });
        }
      } catch (error) {
        console.error(`Error reading payment record:`, error);
      }

      // 检查是否是加油包购买
      const isAddon = paymentData?.metadata?.productType === "ADDON";

      if (isAddon) {
        // 加油包购买 - 增加用户额度
        const imageCredits = paymentData?.metadata?.imageCredits || 0;
        const videoAudioCredits = paymentData?.metadata?.videoAudioCredits || 0;

        console.log("📦 [WebhookHandler] Processing addon purchase:", {
          userId,
          subscriptionId,
          imageCredits,
          videoAudioCredits,
        });

        const success = await this.addAddonCredits(
          userId,
          subscriptionId,
          imageCredits,
          videoAudioCredits,
          provider,
          amount,
          currency
        );

        if (success) {
          console.log("✅ [WebhookHandler] Addon credits added successfully", {
            provider,
            subscriptionId,
            userId,
            imageCredits,
            videoAudioCredits,
          });
        }

        return success;
      } else {
        // 订阅购买 - 更新订阅状态
        const success = await this.updateSubscriptionStatus(
          userId,
          subscriptionId,
          "active",
          provider,
          amount,
          currency,
          days
        );

        if (success) {
          console.log("✅ [WebhookHandler] Payment success processed", {
            provider,
            subscriptionId,
            userId,
            amount,
            days,
          });
        }

        return success;
      }
    } catch (error) {
      console.error(`Error handling payment success for ${provider}:`, error);
      return false;
    }
  }

  /**
   * 增加加油包额度
   */
  private async addAddonCredits(
    userId: string,
    transactionId: string,
    imageCredits: number,
    videoAudioCredits: number,
    provider: string,
    amount: number,
    currency: string
  ): Promise<boolean> {
    console.log("💎 [WebhookHandler] addAddonCredits", {
      userId,
      transactionId,
      imageCredits,
      videoAudioCredits,
      provider,
      amount,
    });

    const now = new Date();

    try {
      if (IS_DOMESTIC_VERSION) {
        // CloudBase 更新用户钱包
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        const _ = db.command;

        // 获取当前用户数据
        const userResult = await db
          .collection("users")
          .where({ _id: userId })
          .get();

        if (userResult.data && userResult.data.length > 0) {
          const currentUser = userResult.data[0];
          const currentWallet = currentUser.wallet || {
            addon: { image: 0, video: 0 },
          };

          // 更新钱包额度
          await db.collection("users").doc(userId).update({
            wallet: {
              ...currentWallet,
              addon: {
                image: (currentWallet.addon?.image || 0) + imageCredits,
                video: (currentWallet.addon?.video || 0) + videoAudioCredits,
              },
            },
            updated_at: now.toISOString(),
          });

          console.log("✅ CloudBase user wallet updated:", {
            userId,
            imageCredits,
            videoAudioCredits,
          });
        } else {
          console.error("User not found in CloudBase:", userId);
          return false;
        }

        // 更新支付记录状态
        const paymentsResult = await db
          .collection("payments")
          .where({ transaction_id: transactionId })
          .get();

        if (paymentsResult.data && paymentsResult.data.length > 0) {
          await db.collection("payments").doc(paymentsResult.data[0]._id).update({
            status: "completed",
            updated_at: now.toISOString(),
          });
        }
      } else {
        // Supabase 更新用户钱包
        // 先获取当前用户的钱包数据
        const { data: userData, error: userError } = await supabaseAdmin
          .from("users")
          .select("wallet")
          .eq("id", userId)
          .maybeSingle();

        if (userError) {
          console.error("Failed to get user wallet:", userError);
          return false;
        }

        const currentWallet = userData?.wallet || {
          addon: { image: 0, video: 0 },
        };

        // 更新钱包额度
        const newWallet = {
          ...currentWallet,
          addon: {
            image: (currentWallet.addon?.image || 0) + imageCredits,
            video: (currentWallet.addon?.video || 0) + videoAudioCredits,
          },
        };

        const { error: updateError } = await supabaseAdmin
          .from("users")
          .update({
            wallet: newWallet,
            updated_at: now.toISOString(),
          })
          .eq("id", userId);

        if (updateError) {
          console.error("Failed to update user wallet:", updateError);
          return false;
        }

        console.log("✅ Supabase user wallet updated:", {
          userId,
          imageCredits,
          videoAudioCredits,
          newWallet,
        });

        // 更新支付记录状态
        const { error: paymentError } = await supabaseAdmin
          .from("payments")
          .update({
            status: "completed",
            updated_at: now.toISOString(),
          })
          .eq("transaction_id", transactionId)
          .eq("status", "pending");

        if (paymentError) {
          console.error("Failed to update payment record:", paymentError);
        } else {
          console.log("✅ Payment record updated to completed");
        }
      }

      return true;
    } catch (error) {
      console.error("Error adding addon credits:", error);
      return false;
    }
  }

  /**
   * 更新订阅状态
   */
  private async updateSubscriptionStatus(
    userId: string,
    subscriptionId: string,
    status: string,
    provider: string,
    amount?: number,
    currency?: string,
    days?: number
  ): Promise<boolean> {
    console.log("💎 [WebhookHandler] updateSubscriptionStatus", {
      userId,
      subscriptionId,
      status,
      provider,
      amount,
      currency,
      days,
    });

    const now = new Date();

    try {
      // 检查是否已有活跃订阅
      const { data: existingSubscriptionData, error: checkError } =
        await supabaseAdmin
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();

      if (checkError) {
        console.error("Failed to check existing subscriptions:", checkError);
        return false;
      }

      let existingSubscription = existingSubscriptionData;
      let subscription;
      const daysNum = days || 30;

      if (existingSubscription) {
        // 更新现有订阅 - 累加订阅时长
        const existingEnd = new Date(existingSubscription.current_period_end);
        let newPeriodEnd: string;

        if (existingEnd > now) {
          // 现有期限还没过期，从它的基础上累加新购买的天数
          newPeriodEnd = new Date(
            existingEnd.getTime() + daysNum * 24 * 60 * 60 * 1000
          ).toISOString();
          console.log("Subscription: extending from existing period end", {
            existingEnd: existingSubscription.current_period_end,
            newPeriodEnd,
            daysAdded: daysNum,
          });
        } else {
          // 现有期限已过期，从现在开始重新计算
          newPeriodEnd = new Date(
            now.getTime() + daysNum * 24 * 60 * 60 * 1000
          ).toISOString();
          console.log("Subscription: existing period expired, starting fresh", {
            existingEnd: existingSubscription.current_period_end,
            newPeriodEnd,
            daysAdded: daysNum,
          });
        }

        const { data: updatedSubscription, error: updateError } =
          await supabaseAdmin
            .from("subscriptions")
            .update({
              status,
              provider_subscription_id: subscriptionId,
              current_period_end: newPeriodEnd,
              updated_at: now.toISOString(),
            })
            .eq("id", existingSubscription.id)
            .select()
            .single();

        if (updateError) {
          console.error("Failed to update existing subscription:", updateError);
          return false;
        }

        console.log("✅ Subscription updated:", {
          subscriptionId: updatedSubscription.id,
          newPeriodEnd,
          daysAdded: daysNum,
        });

        subscription = updatedSubscription;
      } else if (status === "active") {
        // 创建新订阅
        const currentPeriodEnd = new Date(
          now.getTime() + daysNum * 24 * 60 * 60 * 1000
        ).toISOString();

        console.log("📝 Creating new subscription:", {
          userId,
          daysToAdd: daysNum,
          currentPeriodEnd,
        });

        const { data: newSubscription, error: insertError } =
          await supabaseAdmin
            .from("subscriptions")
            .insert({
              user_id: userId,
              plan_id: "pro",
              status,
              provider_subscription_id: subscriptionId,
              current_period_start: now.toISOString(),
              current_period_end: currentPeriodEnd,
            })
            .select()
            .single();

        if (insertError) {
          console.error("Failed to create new subscription:", insertError);
          return false;
        }

        console.log("✅ New subscription created:", {
          subscriptionId: newSubscription.id,
          currentPeriodEnd,
          daysAdded: daysNum,
        });

        subscription = newSubscription;
      }

      // 更新 payment 记录为 completed
      if (amount && currency && subscription) {
        // 检查是否已存在 completed 的支付记录
        const { data: existingPayment } = await supabaseAdmin
          .from("payments")
          .select("id, status")
          .eq("transaction_id", subscriptionId)
          .eq("status", "completed")
          .maybeSingle();

        if (existingPayment) {
          console.log("Payment already completed, skipping:", {
            paymentId: existingPayment.id,
          });
        } else {
          // 更新 pending 记录为 completed
          const { error: updateError } = await supabaseAdmin
            .from("payments")
            .update({
              status: "completed",
              subscription_id: subscription.id,
              updated_at: now.toISOString(),
            })
            .eq("transaction_id", subscriptionId)
            .eq("status", "pending");

          if (updateError) {
            console.error("Failed to update payment record:", updateError);
          } else {
            console.log("✅ Payment record updated to completed");
          }
        }
      }

      return true;
    } catch (error) {
      console.error("Error updating subscription status:", error);
      return false;
    }
  }
}
