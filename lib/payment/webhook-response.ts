// lib/payment/webhook-response.ts
// Webhook 响应格式化共享模块

import { NextResponse } from "next/server";

/** 微信支付响应格式 */
export interface WechatWebhookResponse {
  code: "SUCCESS" | "FAIL";
  message: string;
}

/**
 * 微信 Webhook 成功响应
 */
export function wechatSuccess(): NextResponse<WechatWebhookResponse> {
  return NextResponse.json({ code: "SUCCESS", message: "Ok" }, { status: 200 });
}

/**
 * 微信 Webhook 失败响应
 */
export function wechatFail(message: string, status: number = 400): NextResponse<WechatWebhookResponse> {
  return NextResponse.json({ code: "FAIL", message }, { status });
}

/**
 * 支付宝 Webhook 成功响应
 */
export function alipaySuccess(): NextResponse {
  return new NextResponse("success");
}

/**
 * 支付宝 Webhook 失败响应
 */
export function alipayFail(): NextResponse {
  return new NextResponse("failure");
}

/**
 * Stripe/PayPal Webhook 成功响应
 */
export function stripeSuccess(): Response {
  return new Response(null, { status: 200 });
}

/**
 * Stripe/PayPal Webhook 失败响应
 */
export function stripeFail(message: string, status: number = 400): Response {
  return new Response(`Webhook Error: ${message}`, { status });
}
