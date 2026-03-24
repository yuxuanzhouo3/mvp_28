// lib/payment/addon-handler.ts
// 加油包处理共享模块

import { NextResponse } from "next/server";
import { getAddonPackageById, getAddonDescription, type AddonPackage } from "@/constants/addon-packages";

/** 加油包支付元数据 */
export interface AddonPaymentMetadata {
  userId: string;
  productType: "ADDON";
  addonPackageId: string;
  imageCredits: number;
  videoAudioCredits: number;
}

/** 加油包处理结果 */
export interface AddonHandleResult {
  success: true;
  amount: number;
  description: string;
  metadata: AddonPaymentMetadata;
  addonPackage: AddonPackage;
}

/** 加油包处理错误 */
export interface AddonHandleError {
  success: false;
  response: NextResponse;
}

/**
 * 处理加油包购买请求
 * @param addonPackageId 加油包 ID
 * @param userId 用户 ID
 * @param useDomesticPrice 是否使用国内价格（人民币）
 * @returns 处理结果或错误响应
 */
export function handleAddonPurchase(
  addonPackageId: string,
  userId: string,
  useDomesticPrice: boolean = true
): AddonHandleResult | AddonHandleError {
  const addonPackage = getAddonPackageById(addonPackageId);

  if (!addonPackage) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: "无效的加油包ID" },
        { status: 400 }
      ),
    };
  }

  const amount = useDomesticPrice ? addonPackage.priceZh : addonPackage.price;
  const description = getAddonDescription(addonPackage, useDomesticPrice);

  return {
    success: true,
    amount,
    description,
    metadata: {
      userId,
      productType: "ADDON",
      addonPackageId: addonPackage.id,
      imageCredits: addonPackage.imageCredits,
      videoAudioCredits: addonPackage.videoAudioCredits,
    },
    addonPackage,
  };
}

/**
 * 判断是否为加油包购买
 */
export function isAddonPurchase(productType?: string, addonPackageId?: string): boolean {
  return productType === "ADDON" || (!!addonPackageId && addonPackageId.startsWith("addon_"));
}
