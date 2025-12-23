"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Image, Video, Zap, Loader2, Sparkles, CreditCard, Rocket } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { ADDON_PACKAGES, type AddonPackage } from "@/constants/addon-packages";
import { fetchQuotaShared } from "@/utils/quota-fetcher";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SubscriptionTermsContent } from "@/components/legal";

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
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "paypal" | "alipay" | "wechat">(
    isDomesticVersion ? "alipay" : "stripe"
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [agreeRules, setAgreeRules] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [walletStats, setWalletStats] = useState<WalletStats | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

  const formatPrice = (pkg: AddonPackage) => {
    // 显示层：国内版一律人民币（含 PayPal），国际版美元
    const useRmb = isDomesticVersion;
    const amount = useRmb ? pkg.priceZh : pkg.price;
    return `${useRmb ? "￥" : "$"}${amount.toFixed(2)}`;
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
      // 根据支付方式选择不同的端点
      let endpoint = "/api/payment/stripe/create";
      if (paymentMethod === "paypal") {
        endpoint = "/api/payment/paypal/create";
      } else if (paymentMethod === "alipay") {
        endpoint = "/api/payment/alipay/create";
      } else if (paymentMethod === "wechat") {
        endpoint = "/api/payment/wechat/create";
      }

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
        // 支付宝返回 HTML 表单，需要特殊处理
        if (paymentMethod === "alipay" && data.formHtml) {
          const div = document.createElement("div");
          div.innerHTML = data.formHtml;
          document.body.appendChild(div);
          const form = div.querySelector("form");
          if (form) {
            form.submit();
          }
        } else if (paymentMethod === "wechat" && data.code_url) {
          // 微信支付返回二维码链接
          const paymentUrl = `/payment/wechat?code_url=${encodeURIComponent(data.code_url)}&out_trade_no=${data.out_trade_no}&amount=${data.amount}`;
          window.location.href = paymentUrl;
        } else {
          // Stripe/PayPal 返回重定向 URL
          const redirectUrl = paymentMethod === "stripe" ? data.url : data.approvalUrl;
          if (redirectUrl) {
            window.location.href = redirectUrl;
          }
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
    <>
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

      {/* 移动端滑动提示 */}
      <div className="md:hidden flex items-center justify-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
        <span>←</span>
        <span>{isZh ? "左右滑动查看加油包" : "Swipe to view packs"}</span>
        <span>→</span>
      </div>

      {/* 加油包卡片 - 响应式横向布局 */}
      <div className="flex md:grid md:grid-cols-3 gap-3 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none scrollbar-hide py-2 pb-4 px-2 -mx-2">
        {ADDON_PACKAGES.map((pkg) => {
          const isSelected = selectedPackage?.id === pkg.id;
          const colors = getPackageColors(pkg.tier);
          
          return (
            <div
              key={pkg.id}
              onClick={() => setSelectedPackage(pkg)}
              className={`relative cursor-pointer transition-all duration-300 flex-shrink-0 w-[260px] md:w-auto snap-center ${
                isSelected ? "scale-[1.02]" : "hover:scale-[1.01]"
              }`}
            >
              {/* 选中发光效果 */}
              {isSelected && (
                <div className={`absolute inset-0 bg-gradient-to-r ${colors.bg} opacity-10 blur-xl rounded-xl -z-10`} />
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
                  <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
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
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* 支付方式选择 */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                <CreditCard className="w-3.5 h-3.5 inline mr-1" />
                {isZh ? "支付：" : "Pay:"}
              </span>
              <div className="flex gap-1.5">
                {isDomesticVersion ? (
                  <>
                    {/* 国内版：支付宝和微信支付 */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("alipay")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        paymentMethod === "alipay"
                          ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                      }`}
                    >
                      💳 支付宝
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("wechat")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        paymentMethod === "wechat"
                          ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 ring-1 ring-green-400"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                      }`}
                    >
                      💬 微信支付
                    </button>
                  </>
                ) : (
                  <>
                    {/* 国际版：Stripe 和 PayPal */}
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
                  </>
                )}
              </div>
            </div>

            {/* 支付按钮 */}
            <div className="flex flex-col gap-3">
              {/* 隐私与订阅确认 - 独立一行 */}
              <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={agreeRules}
                  onChange={(e) => setAgreeRules(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:bg-transparent dark:border-gray-600"
                />
                <span className="leading-snug flex flex-wrap items-center gap-1">
                  {isZh ? "我已阅读并同意" : "I have read and agree to the"}
                  <button type="button" className="underline hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => setShowTerms(true)}>
                    {isZh ? "《订阅规则》" : "Subscription Terms"}
                  </button>
                </span>
              </label>

              {/* 支付按钮 - 独立一行 */}
              <div className="flex justify-end">
                <Button
                  disabled={isProcessing || !selectedPackage || !agreeRules}
                  onClick={handlePurchase}
                  className="h-10 px-6 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:shadow-xl"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {isZh ? "处理中..." : "Processing..."}
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4 mr-2" />
                      {selectedPackage
                        ? `${isZh ? "购买" : "Buy"} ${formatPrice(selectedPackage)}`
                        : isZh
                          ? "选择加油包"
                          : "Select pack"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* 订阅规则弹窗 */}
    <Dialog open={showTerms} onOpenChange={setShowTerms}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl p-0 border-0 shadow-2xl">
        {/* 装饰性背景 */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-400/10 to-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-br from-blue-400/10 to-cyan-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col h-full max-h-[85vh]">
          <DialogHeader className="px-6 py-4 border-b border-gray-200/80 dark:border-gray-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex-shrink-0">
            <DialogTitle className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/25">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span>{isZh ? "订阅规则" : "Subscription Terms"}</span>
            </DialogTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-12">
              {isZh ? "请仔细阅读以下订阅规则" : "Please read the following subscription terms carefully"}
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 bg-white/50 dark:bg-slate-800/50">
            <SubscriptionTermsContent isDomestic={isDomesticVersion} />
          </div>

          <div className="px-6 py-4 border-t border-gray-200/80 dark:border-gray-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex-shrink-0">
            <button
              onClick={() => {
                setShowTerms(false);
                setAgreeRules(true);
              }}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all duration-300 hover:-translate-y-0.5"
            >
              {isZh ? "我已阅读并同意" : "I have read and agree"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

export default AddonPackageTab;
