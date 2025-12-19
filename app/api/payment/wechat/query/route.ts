// app/api/payment/wechat/query/route.ts
// 微信支付订单查询 API

import { NextRequest, NextResponse } from "next/server";
import { WechatProviderV3 } from "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const outTradeNo = searchParams.get("out_trade_no");

    if (!outTradeNo) {
      return NextResponse.json(
        { success: false, error: "Missing out_trade_no" },
        { status: 400 }
      );
    }

    // 初始化微信支付提供商
    const wechatProvider = new WechatProviderV3({
      appId: process.env.WECHAT_APP_ID!,
      mchId: process.env.WECHAT_PAY_MCH_ID!,
      apiV3Key: process.env.WECHAT_PAY_API_V3_KEY!,
      privateKey: process.env.WECHAT_PAY_PRIVATE_KEY!,
      serialNo: process.env.WECHAT_PAY_SERIAL_NO!,
      notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL}/api/payment/webhook/wechat`,
    });

    // 查询订单状态
    const result = await wechatProvider.queryOrderByOutTradeNo(outTradeNo);

    console.log("📝 [WeChat Query] Order status:", {
      outTradeNo,
      tradeState: result.tradeState,
    });

    return NextResponse.json({
      success: true,
      out_trade_no: outTradeNo,
      trade_state: result.tradeState,
      transaction_id: result.transactionId,
      amount: result.amount,
      success_time: result.successTime,
    });
  } catch (err) {
    console.error("❌ [WeChat Query] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "查询失败",
      },
      { status: 500 }
    );
  }
}
