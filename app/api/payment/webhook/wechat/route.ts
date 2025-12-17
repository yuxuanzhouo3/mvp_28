// app/api/payment/webhook/wechat/route.ts
// 微信支付 Webhook 回调处理 (API v3)

import { NextRequest, NextResponse } from "next/server";
import { WechatProviderV3 } from "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";

// WeChat Webhook 依赖 Node.js 运行时
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // 1. 获取 Webhook 签名信息
    const signature = request.headers.get("Wechatpay-Signature") || "";
    const timestamp = request.headers.get("Wechatpay-Timestamp") || "";
    const nonce = request.headers.get("Wechatpay-Nonce") || "";

    // 2. 读取请求体
    const body = await request.text();

    console.log("📥 [WeChat Webhook] Received:", {
      timestamp,
      nonce,
      bodyLength: body.length,
    });

    // 3. 初始化微信支付提供商用于验证签名
    const wechatProvider = new WechatProviderV3({
      appId: process.env.WECHAT_APP_ID!,
      mchId: process.env.WECHAT_PAY_MCH_ID!,
      apiV3Key: process.env.WECHAT_PAY_API_V3_KEY!,
      privateKey: process.env.WECHAT_PAY_PRIVATE_KEY!,
      serialNo: process.env.WECHAT_PAY_SERIAL_NO!,
      notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL}/api/payment/webhook/wechat`,
    });

    // 4. 验证签名（生产环境启用）
    if (process.env.NODE_ENV === "production") {
      const isValidSignature = wechatProvider.verifyWebhookSignature(body, signature, timestamp, nonce);
      if (!isValidSignature) {
        console.error("❌ [WeChat Webhook] Signature verification failed");
        return NextResponse.json(
          { code: "FAIL", message: "Invalid signature" },
          { status: 401 }
        );
      }
      console.log("✅ [WeChat Webhook] Signature verified");
    } else {
      console.log("⚠️ [WeChat Webhook] Skipping signature verification (non-production)");
    }

    // 5. 解析 Webhook 数据
    const webhookData = JSON.parse(body);

    console.log("📥 [WeChat Webhook] Event type:", webhookData.event_type);

    // 6. 仅处理支付成功事件
    if (webhookData.event_type !== "TRANSACTION.SUCCESS") {
      console.log(
        "⏭️ [WeChat Webhook] Ignoring event:",
        webhookData.event_type
      );
      return NextResponse.json(
        { code: "SUCCESS", message: "Ok" },
        { status: 200 }
      );
    }

    // 7. 解密回调数据
    let paymentData: any;
    try {
      paymentData = await wechatProvider.handleWebhookNotification(webhookData);
    } catch (error) {
      console.error("❌ [WeChat Webhook] Failed to decrypt data:", error);
      return NextResponse.json(
        { code: "FAIL", message: "Decryption failed" },
        { status: 400 }
      );
    }

    console.log("🔓 [WeChat Webhook] Decrypted payment data:", {
      out_trade_no: paymentData.out_trade_no,
      transaction_id: paymentData.transaction_id,
      trade_state: paymentData.trade_state,
      amount: paymentData.amount?.total,
      attach: paymentData.attach,
    });

    // 8. 检查交易状态
    if (paymentData.trade_state !== "SUCCESS") {
      console.log(
        "⏭️ [WeChat Webhook] Payment not successful:",
        paymentData.trade_state
      );
      return NextResponse.json(
        { code: "SUCCESS", message: "Ok" },
        { status: 200 }
      );
    }

    // 9. 幂等性检查：防止重复处理（只跳过已处理的事件）
    const webhookEventId = `wechat_${paymentData.transaction_id}`;
    let eventProcessed = false;

    if (IS_DOMESTIC_VERSION) {
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        const result = await db
          .collection("webhook_events")
          .where({ id: webhookEventId, processed: true })
          .get();
        eventProcessed = (result.data?.length || 0) > 0;
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error checking CloudBase event:",
          error
        );
      }
    } else {
      try {
        const { data } = await supabaseAdmin
          .from("webhook_events")
          .select("id")
          .eq("id", webhookEventId)
          .eq("processed", true)
          .maybeSingle();
        eventProcessed = !!data;
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error checking Supabase event:",
          error
        );
      }
    }

    if (eventProcessed) {
      console.log(
        "⏭️ [WeChat Webhook] Event already processed:",
        webhookEventId
      );
      return NextResponse.json(
        { code: "SUCCESS", message: "Ok" },
        { status: 200 }
      );
    }

    // 10. 记录 Webhook 事件
    const webhookEvent = {
      id: webhookEventId,
      provider: "wechat",
      event_type: "TRANSACTION.SUCCESS",
      event_data: paymentData,
      processed: false,
      created_at: new Date().toISOString(),
    };

    if (IS_DOMESTIC_VERSION) {
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        await db.collection("webhook_events").add(webhookEvent);
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error saving CloudBase event:",
          error
        );
      }
    } else {
      try {
        await supabaseAdmin.from("webhook_events").insert([webhookEvent]);
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error saving Supabase event:",
          error
        );
      }
    }

    // 11. 获取支付订单信息
    const amount = paymentData.amount?.total
      ? paymentData.amount.total / 100
      : 0;
    let paymentRecord: any = null;
    const userId = paymentData.attach || ""; // 从附加数据获取用户ID

    if (IS_DOMESTIC_VERSION) {
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        const result = await db
          .collection("payments")
          .where({ out_trade_no: paymentData.out_trade_no })
          .get();
        paymentRecord = result.data?.[0];
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error querying CloudBase payment:",
          error
        );
      }
    } else {
      try {
        const { data } = await supabaseAdmin
          .from("payments")
          .select("*")
          .eq("transaction_id", paymentData.out_trade_no)
          .maybeSingle();
        paymentRecord = data;
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error querying Supabase payment:",
          error
        );
      }
    }

    const effectiveUserId = paymentRecord?.user_id || userId;

    if (!effectiveUserId) {
      console.error(
        "❌ [WeChat Webhook] Payment record not found or missing user_id"
      );
      return NextResponse.json(
        { code: "FAIL", message: "Payment record not found" },
        { status: 400 }
      );
    }

    // 12. 检查是否是加油包购买
    const isAddon = paymentRecord?.metadata?.productType === "ADDON";

    if (isAddon) {
      // 加油包购买 - 增加用户额度
      const imageCredits = paymentRecord?.metadata?.imageCredits || 0;
      const videoAudioCredits = paymentRecord?.metadata?.videoAudioCredits || 0;

      console.log("📦 [WeChat Webhook] Processing addon purchase:", {
        userId: effectiveUserId,
        imageCredits,
        videoAudioCredits,
      });

      await addAddonCredits(
        effectiveUserId,
        paymentData.out_trade_no,
        imageCredits,
        videoAudioCredits
      );
    } else {
      // 订阅购买 - 更新订阅状态
      const days = paymentRecord?.metadata?.days || 30;
      const planName = paymentRecord?.metadata?.planName || "Pro";

      console.log("📦 [WeChat Webhook] Processing subscription:", {
        userId: effectiveUserId,
        days,
        planName,
        paymentRecordFound: !!paymentRecord,
        metadata: paymentRecord?.metadata,
      });

      await updateSubscription(
        effectiveUserId,
        paymentData.out_trade_no,
        paymentData.transaction_id,
        days,
        planName
      );
    }

    // 13. 更新支付订单状态
    const updateData = {
      status: "completed",
      transaction_id: paymentData.transaction_id,
      updated_at: new Date().toISOString(),
    };

    if (IS_DOMESTIC_VERSION) {
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        await db
          .collection("payments")
          .where({ out_trade_no: paymentData.out_trade_no })
          .update(updateData);
        console.log(
          "✅ [WeChat Webhook] Updated CloudBase payment:",
          paymentData.out_trade_no
        );
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error updating CloudBase payment:",
          error
        );
      }
    } else {
      try {
        await supabaseAdmin
          .from("payments")
          .update(updateData)
          .eq("transaction_id", paymentData.out_trade_no);
        console.log(
          "✅ [WeChat Webhook] Updated Supabase payment:",
          paymentData.out_trade_no
        );
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error updating Supabase payment:",
          error
        );
      }
    }

    // 14. 标记 Webhook 事件为已处理
    if (IS_DOMESTIC_VERSION) {
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        await db
          .collection("webhook_events")
          .where({ id: webhookEventId })
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
          });
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error updating CloudBase event:",
          error
        );
      }
    } else {
      try {
        await supabaseAdmin
          .from("webhook_events")
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq("id", webhookEventId);
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error updating Supabase event:",
          error
        );
      }
    }

    console.log("✅ [WeChat Webhook] Successfully processed:", webhookEventId);

    // 15. 返回成功响应给微信
    return NextResponse.json(
      {
        code: "SUCCESS",
        message: "Ok",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ [WeChat Webhook] Processing error:", error);

    // 返回失败响应，微信会继续重试
    return NextResponse.json(
      {
        code: "FAIL",
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * 增加加油包额度
 */
async function addAddonCredits(
  userId: string,
  transactionId: string,
  imageCredits: number,
  videoAudioCredits: number
): Promise<void> {
  const now = new Date();

  if (IS_DOMESTIC_VERSION) {
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();

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
        await db
          .collection("users")
          .doc(userId)
          .update({
            wallet: {
              ...currentWallet,
              addon: {
                image: (currentWallet.addon?.image || 0) + imageCredits,
                video: (currentWallet.addon?.video || 0) + videoAudioCredits,
              },
            },
            updated_at: now.toISOString(),
          });

        console.log("✅ [WeChat Webhook] CloudBase user wallet updated:", {
          userId,
          imageCredits,
          videoAudioCredits,
        });
      }
    } catch (error) {
      console.error(
        "❌ [WeChat Webhook] Error updating CloudBase wallet:",
        error
      );
    }
  } else {
    try {
      const { data: userData } = await supabaseAdmin
        .from("users")
        .select("wallet")
        .eq("id", userId)
        .maybeSingle();

      const currentWallet = userData?.wallet || {
        addon: { image: 0, video: 0 },
      };

      const newWallet = {
        ...currentWallet,
        addon: {
          image: (currentWallet.addon?.image || 0) + imageCredits,
          video: (currentWallet.addon?.video || 0) + videoAudioCredits,
        },
      };

      await supabaseAdmin
        .from("users")
        .update({
          wallet: newWallet,
          updated_at: now.toISOString(),
        })
        .eq("id", userId);

      console.log("✅ [WeChat Webhook] Supabase user wallet updated:", {
        userId,
        imageCredits,
        videoAudioCredits,
      });
    } catch (error) {
      console.error(
        "❌ [WeChat Webhook] Error updating Supabase wallet:",
        error
      );
    }
  }
}

/**
 * 更新订阅状态
 */
async function updateSubscription(
  userId: string,
  outTradeNo: string,
  transactionId: string,
  days: number,
  planName: string = "Pro"
): Promise<void> {
  const now = new Date();
  let newExpiresAt: Date;
  const planId = planName.toLowerCase(); // basic, pro, enterprise

  if (IS_DOMESTIC_VERSION) {
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();

      // 获取现有订阅（查询该用户的任何活跃订阅）
      const existingSubscription = await db
        .collection("subscriptions")
        .where({
          user_id: userId,
          status: "active",
        })
        .get();

      if (
        existingSubscription.data &&
        existingSubscription.data.length > 0
      ) {
        const subscription = existingSubscription.data[0];
        const currentExpiresAt = new Date(subscription.current_period_end);

        console.log("📊 [WeChat Webhook] Existing subscription found:", {
          subscriptionId: subscription._id,
          currentExpiresAt: currentExpiresAt.toISOString(),
          now: now.toISOString(),
          isExpired: currentExpiresAt <= now,
          daysToAdd: days,
        });

        if (currentExpiresAt > now) {
          // 延长现有订阅
          newExpiresAt = new Date(currentExpiresAt);
          newExpiresAt.setDate(newExpiresAt.getDate() + days);
          console.log("📈 [WeChat Webhook] Extending subscription:", {
            from: currentExpiresAt.toISOString(),
            to: newExpiresAt.toISOString(),
            daysAdded: days,
          });
        } else {
          // 从现在开始
          newExpiresAt = new Date();
          newExpiresAt.setDate(newExpiresAt.getDate() + days);
          console.log("🆕 [WeChat Webhook] Starting fresh subscription:", {
            from: now.toISOString(),
            to: newExpiresAt.toISOString(),
            daysAdded: days,
          });
        }

        await db
          .collection("subscriptions")
          .doc(subscription._id)
          .update({
            plan_id: planId,
            current_period_end: newExpiresAt.toISOString(),
            transaction_id: transactionId,
            updated_at: now.toISOString(),
          });

        console.log(
          "✅ [WeChat Webhook] Updated CloudBase subscription:",
          userId,
          "new expires at:",
          newExpiresAt.toISOString()
        );
      } else {
        // 创建新订阅
        newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + days);

        await db.collection("subscriptions").add({
          user_id: userId,
          plan_id: planId,
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: newExpiresAt.toISOString(),
          cancel_at_period_end: false,
          payment_method: "wechat",
          transaction_id: transactionId,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        });

        console.log(
          "✅ [WeChat Webhook] Created CloudBase subscription:",
          userId
        );
      }

      // 同步到 web_users
      try {
        const userQuery = await db
          .collection("web_users")
          .where({ _id: userId })
          .get();

        if (userQuery.data && userQuery.data.length > 0) {
          // 根据套餐设置会员等级
          const membershipLevel = planId; // basic, pro, enterprise
          await db.collection("web_users").doc(userId).update({
            membership_expires_at: newExpiresAt.toISOString(),
            membership_level: membershipLevel,
            pro: planId === "pro" || planId === "enterprise",
            updated_at: now.toISOString(),
          });
        }
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error syncing to web_users:",
          error
        );
      }
    } catch (error) {
      console.error(
        "❌ [WeChat Webhook] Error updating CloudBase subscription:",
        error
      );
    }
  } else {
    try {
      // Supabase 订阅更新
      const { data: existingSubscription } = await supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (existingSubscription) {
        const currentExpiresAt = new Date(
          existingSubscription.current_period_end
        );

        if (currentExpiresAt > now) {
          newExpiresAt = new Date(currentExpiresAt);
          newExpiresAt.setDate(newExpiresAt.getDate() + days);
        } else {
          newExpiresAt = new Date();
          newExpiresAt.setDate(newExpiresAt.getDate() + days);
        }

        await supabaseAdmin
          .from("subscriptions")
          .update({
            plan_id: planId,
            current_period_end: newExpiresAt.toISOString(),
            provider_subscription_id: outTradeNo,
            updated_at: now.toISOString(),
          })
          .eq("id", existingSubscription.id);

        console.log(
          "✅ [WeChat Webhook] Updated Supabase subscription:",
          userId
        );
      } else {
        newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + days);

        await supabaseAdmin.from("subscriptions").insert({
          user_id: userId,
          plan_id: planId,
          status: "active",
          provider_subscription_id: outTradeNo,
          current_period_start: now.toISOString(),
          current_period_end: newExpiresAt.toISOString(),
        });

        console.log(
          "✅ [WeChat Webhook] Created Supabase subscription:",
          userId
        );
      }
    } catch (error) {
      console.error(
        "❌ [WeChat Webhook] Error updating Supabase subscription:",
        error
      );
    }
  }
}
