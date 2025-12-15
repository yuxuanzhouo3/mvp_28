"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Image, Video, Zap, Loader2, Sparkles } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { ADDON_PACKAGES, type AddonPackage } from "@/constants/addon-packages";
import { fetchQuotaShared } from "@/utils/quota-fetcher";

interface AddonPackageTabProps {
  appUserId?: string | null;
  onPurchaseComplete?: () => void;
}

interface WalletStats {
  addon: { image: number; video: number };
}

/**
 * 加油包购买 Tab
 * 展示三档加油包商品，并显示当前加油包余额
 */
export function AddonPackageTab({
  appUserId,
  onPurchaseComplete,
}: AddonPackageTabProps) {
  const { currentLanguage, isDomesticVersion } = useLanguage();
  const isZh = currentLanguage === "zh";
  const [selectedPackage, setSelectedPackage] = useState<AddonPackage | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "paypal">("stripe");
  const [isProcessing, setIsProcessing] = useState(false);
  const [walletStats, setWalletStats] = useState<WalletStats | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

  // 显示价格
  const formatPrice = (pkg: AddonPackage) => {
    if (isDomesticVersion) {
      return `￥${pkg.priceZh}`;
    }
    return `$${pkg.price}`;
  };

  // 拉取当前加油包余额
  const fetchWallet = async () => {
    if (!appUserId) return;
    try {
      setLoadingWallet(true);
      const data = await fetchQuotaShared("/api/account/quota");
      if (data?.wallet) {
        setWalletStats({ addon: data.wallet.addon });
      }
    } catch (err) {
      console.warn("addon wallet fetch error", err);
    } finally {
      setLoadingWallet(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [appUserId]);

  // 处理购买
  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setIsProcessing(true);
    try {
      const endpoint =
        paymentMethod === "stripe" ? "/api/payment/stripe/create" : "/api/payment/paypal/create";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType: "ADDON",
          addonPackageId: selectedPackage.id,
          userId: appUserId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const redirectUrl = paymentMethod === "stripe" ? data.url : data.approvalUrl;
        if (redirectUrl) {
          window.location.href = redirectUrl;
        }
      } else {
        alert(data.error || (isZh ? "支付创建失败" : "Failed to create payment"));
      }
    } catch (err) {
      console.error("Payment error:", err);
      alert(isZh ? "网络错误，请重试" : "Network error, please try again");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 当前加油包余额 */}
      {appUserId && (
        <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {isZh ? "当前加油包余额" : "Your add-on credits"}
            </div>
            <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              {isZh ? "额度永久有效，可与订阅配额叠加" : "Never expires, stacks with subscription"}
            </div>
          </div>
          <div className="text-right">
            {loadingWallet ? (
              <div className="text-sm font-semibold text-amber-700 dark:text-amber-200">...</div>
            ) : (walletStats?.addon.image || 0) + (walletStats?.addon.video || 0) === 0 ? (
              <div className="text-sm font-semibold text-amber-700 dark:text-amber-200">
                {isZh ? "暂无加油包" : "No add-on yet"}
              </div>
            ) : (
              <div className="flex items-center justify-end space-x-2 text-sm font-semibold text-amber-700 dark:text-amber-200">
                <span className="flex items-center space-x-1">
                  <Image className="w-4 h-4" />
                  <span>{walletStats?.addon.image ?? 0} {isZh ? "图" : "img"}</span>
                </span>
                <span className="text-amber-400">·</span>
                <span className="flex items-center space-x-1">
                  <Video className="w-4 h-4" />
                  <span>{walletStats?.addon.video ?? 0} {isZh ? "视频/音频" : "video/audio"}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 说明区域 */}
      <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
            <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-[#ececf1]">
              {isZh ? "额度加油包" : "Credit Add-on Packs"}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {isZh
                ? "额度永久有效，不随订阅周期重置。适合临时需要更多配额的用户。"
                : "Credits never expire and don't reset with your subscription. Perfect for occasional heavy usage."}
            </p>
          </div>
        </div>
      </div>

      {/* 加油包列表 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ADDON_PACKAGES.map((pkg) => (
          <div
            key={pkg.id}
            onClick={() => setSelectedPackage(pkg)}
            className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${
              selectedPackage?.id === pkg.id
                ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-lg"
                : "border-gray-200 dark:border-[#565869] bg-white dark:bg-[#40414f] hover:border-gray-300 dark:hover:border-[#565869]"
            }`}
          >
            {/* 热门标签 */}
            {pkg.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-amber-500 text-white">
                  {isZh ? "最受欢迎" : "Best Value"}
                </Badge>
              </div>
            )}

            {/* 套餐名称和价格 */}
            <div className="text-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-[#ececf1]">
                {isZh ? pkg.nameZh : pkg.name}
              </h3>
              <div className="mt-2">
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {formatPrice(pkg)}
                </span>
              </div>
            </div>

            {/* 额度详情 */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-[#565869] rounded-lg">
                <div className="flex items-center space-x-2">
                  <Image className="w-4 h-4 text-purple-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {isZh ? "图片额度" : "Image Credits"}
                  </span>
                </div>
                <span className="font-bold text-gray-900 dark:text-[#ececf1]">+{pkg.imageCredits}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-[#565869] rounded-lg">
                <div className="flex items-center space-x-2">
                  <Video className="w-4 h-4 text-purple-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {isZh ? "视频/音频" : "Video/Audio"}
                  </span>
                </div>
                <span className="font-bold text-gray-900 dark:text-[#ececf1]">
                  +{pkg.videoAudioCredits}
                </span>
              </div>
            </div>

            {/* 特性说明 */}
            <ul className="space-y-1 mb-4">
              <li className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                <Check className="w-3 h-3 mr-1 text-green-500" />
                {isZh ? "永久有效" : "Never expires"}
              </li>
              <li className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                <Check className="w-3 h-3 mr-1 text-green-500" />
                {isZh ? "与订阅配额叠加" : "Stacks with subscription"}
              </li>
            </ul>

            {/* 选中状态指示 */}
            {selectedPackage?.id === pkg.id && (
              <div className="absolute top-3 right-3">
                <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 支付方式选择 */}
      {selectedPackage && (
        <div className="p-4 bg-gray-50 dark:bg-[#565869] rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 dark:text-[#ececf1] mb-3">
            {isZh ? "选择支付方式" : "Select Payment Method"}
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod("stripe")}
              className={`p-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center space-x-2 ${
                paymentMethod === "stripe"
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                  : "border-gray-200 dark:border-[#565869] bg-white dark:bg-[#40414f] text-gray-700 dark:text-gray-300 hover:border-gray-300"
              }`}
            >
              <span className="text-xs font-semibold">Card</span>
              <span>Stripe</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("paypal")}
              className={`p-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center space-x-2 ${
                paymentMethod === "paypal"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "border-gray-200 dark:border-[#565869] bg-white dark:bg-[#40414f] text-gray-700 dark:text-gray-300 hover:border-gray-300"
              }`}
            >
              <span className="text-xs font-semibold">Pay</span>
              <span>PayPal</span>
            </button>
          </div>

          {/* 购买按钮 */}
          <Button
            onClick={handlePurchase}
            disabled={isProcessing}
            className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isZh ? "处理中..." : "Processing..."}
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                {isZh ? `立即购买 ${formatPrice(selectedPackage)}` : `Buy Now ${formatPrice(selectedPackage)}`}
              </>
            )}
          </Button>

          <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
            {isZh ? "购买后额度立即生效，不影响现有订阅" : "Credits are added immediately without affecting your subscription"}
          </p>
        </div>
      )}
    </div>
  );
}

export default AddonPackageTab;














