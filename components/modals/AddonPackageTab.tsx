"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Image, Video, Zap, Loader2, Sparkles, CreditCard, Rocket } from "lucide-react";
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

// 为不同加油包获取颜色
const getPackageColors = (tier: string) => {
  if (tier === "starter") return { bg: "from-emerald-500 to-teal-600", light: "emerald", ring: "ring-emerald-500/50" };
  if (tier === "standard") return { bg: "from-violet-500 to-purple-600", light: "violet", ring: "ring-violet-500/50" };
  if (tier === "premium") return { bg: "from-amber-500 to-orange-600", light: "amber", ring: "ring-amber-500/50" };
  return { bg: "from-blue-500 to-blue-600", light: "blue", ring: "ring-blue-500/50" };
};

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

  const formatPrice = (pkg: AddonPackage) => {
    if (isDomesticVersion) return `￥${pkg.priceZh}`;
    return `$${pkg.price}`;
  };

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

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setIsProcessing(true);
    try {
      const endpoint = paymentMethod === "stripe" ? "/api/payment/stripe/create" : "/api/payment/paypal/create";

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
    <div className="space-y-4">
      {/* 当前余额 + 说明 */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/50 dark:border-amber-700/50">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
              {isZh ? "额度永久有效" : "Never expires"}
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
              {isZh ? "与订阅叠加" : "Stacks with subscription"}
            </span>
          </div>
        </div>
        {appUserId && (
          <div className="text-right">
            {loadingWallet ? (
              <span className="text-xs text-amber-600">...</span>
            ) : (walletStats?.addon.image || 0) + (walletStats?.addon.video || 0) === 0 ? (
              <span className="text-xs text-amber-600 dark:text-amber-400">{isZh ? "暂无余额" : "No credits"}</span>
            ) : (
              <div className="flex items-center space-x-2 text-xs font-medium text-amber-700 dark:text-amber-200">
                <span className="flex items-center">
                  <Image className="w-3 h-3 mr-0.5" />{walletStats?.addon.image ?? 0}
                </span>
                <span className="text-amber-400">·</span>
                <span className="flex items-center">
                  <Video className="w-3 h-3 mr-0.5" />{walletStats?.addon.video ?? 0}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 加油包卡片 - 紧凑横向布局 */}
      <div className="grid grid-cols-3 gap-3">
        {ADDON_PACKAGES.map((pkg) => {
          const isSelected = selectedPackage?.id === pkg.id;
          const colors = getPackageColors(pkg.tier);
          
          return (
            <div
              key={pkg.id}
              onClick={() => setSelectedPackage(pkg)}
              className={`relative cursor-pointer transition-all duration-300 ${
                isSelected ? "scale-[1.02]" : "hover:scale-[1.01]"
              }`}
            >
              {/* 选中发光效果 */}
              {isSelected && (
                <div className={`absolute inset-0 bg-gradient-to-r ${colors.bg} opacity-10 blur-xl rounded-xl`} />
              )}
              
              <div className={`relative p-4 rounded-xl border-2 transition-all h-full ${
                isSelected
                  ? `border-transparent bg-white dark:bg-[#2a2b38] shadow-xl ring-2 ${colors.ring}`
                  : "border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-[#2a2b38]/80 hover:shadow-lg"
              }`}>
                {/* 热门标签 */}
                {pkg.popular && (
                  <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-2 py-0.5 text-[9px] font-bold shadow-md border-0">
                      <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                      {isZh ? "超值" : "Best"}
                    </Badge>
                  </div>
                )}

                {/* 选中指示 */}
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <div className={`w-5 h-5 rounded-full bg-gradient-to-r ${colors.bg} flex items-center justify-center shadow-md`}>
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  </div>
                )}

                {/* 套餐名称 */}
                <div className="text-center mb-3 pt-1">
                  <div className={`w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-br ${colors.bg} flex items-center justify-center shadow-md`}>
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {isZh ? pkg.nameZh : pkg.name}
                  </h3>
                </div>

                {/* 价格 */}
                <div className="text-center mb-3">
                  <span className="text-2xl font-extrabold bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">
                    {formatPrice(pkg)}
                  </span>
                </div>

                {/* 额度详情 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-[#3a3b48] rounded-lg">
                    <div className="flex items-center space-x-1.5">
                      <Image className="w-3.5 h-3.5 text-purple-500" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {isZh ? "图片" : "Image"}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">+{pkg.imageCredits}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-[#3a3b48] rounded-lg">
                    <div className="flex items-center space-x-1.5">
                      <Video className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {isZh ? "视频/音频" : "Video/Audio"}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">+{pkg.videoAudioCredits}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 支付区域 */}
      <div className={`transition-all duration-300 ${selectedPackage ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        <div className="p-4 bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-xl border border-amber-200/50 dark:border-amber-700/50">
          <div className="flex items-center justify-between gap-4">
            {/* 支付方式选择 */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                <CreditCard className="w-3.5 h-3.5 inline mr-1" />
                {isZh ? "支付：" : "Pay:"}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("stripe")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    paymentMethod === "stripe"
                      ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 ring-1 ring-violet-400"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  💳 Stripe
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("paypal")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    paymentMethod === "paypal"
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  🅿️ PayPal
                </button>
              </div>
            </div>

            {/* 支付按钮 */}
            <Button
              disabled={isProcessing || !selectedPackage}
              onClick={handlePurchase}
              className="h-10 px-6 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:shadow-xl"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Rocket className="w-4 h-4 mr-2" />
              )}
              {isProcessing
                ? (isZh ? "处理中..." : "Processing...")
                : selectedPackage
                  ? `${isZh ? "购买" : "Buy"} ${formatPrice(selectedPackage)}`
                  : (isZh ? "选择加油包" : "Select pack")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddonPackageTab;

