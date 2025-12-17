"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Image, Video, Zap, Loader2, Sparkles, CreditCard, Rocket } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { ADDON_PACKAGES, type AddonPackage } from "@/constants/addon-packages";
import { fetchQuotaShared } from "@/utils/quota-fetcher";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [showPrivacy, setShowPrivacy] = useState(false);
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
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300 max-w-md">
                <input
                  type="checkbox"
                  checked={agreeRules}
                  onChange={(e) => setAgreeRules(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:bg-transparent dark:border-gray-600"
                />
                <span className="leading-snug flex flex-wrap items-center gap-1">
                  {isZh ? "我已阅读并同意" : "I have read and agree to"}
                  <button type="button" className="underline hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => setShowPrivacy(true)}>
                    {isZh ? "《隐私条款》" : "Privacy Policy"}
                  </button>
                  {isZh ? "和" : "and"}
                  <button type="button" className="underline hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => setShowTerms(true)}>
                    {isZh ? "《订阅规则》" : "Subscription Terms"}
                  </button>
                </span>
              </label>

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

    {/* 隐私条款弹窗 */}
    <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isZh ? "隐私条款" : "Privacy Policy"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-gray-700 dark:text-gray-200">
          <p className="font-semibold">{isZh ? "🔒 隐私政策 (Privacy Policy)" : "🔒 Privacy Policy"}</p>
          <p>{isZh ? "生效日期：2025年12月01日" : "Effective: 2025-12-01"}</p>
          <p>{isZh ? "尊重并保护您的隐私是 MornGPT 的核心原则。" : "We respect and protect your privacy as a core principle of MornGPT."}</p>

          <div className="space-y-1">
            <p className="font-semibold">{isZh ? "中文（摘要）" : "Chinese (Summary)"}</p>
            <ul className="list-disc list-inside space-y-1">
              <li>{isZh ? "双轨存储：大陆用户在 CloudBase（境内），国际用户在 Supabase（境外）。" : "Dual storage: CN users on CloudBase (mainland), Intl users on Supabase (abroad)."} </li>
              <li>{isZh ? "支付安全：不存储完整卡号/口令，支付由 Stripe/微信/支付宝/PayPal 处理。" : "Payment safety: No full card data stored; Stripe/WeChat/Alipay/PayPal handle payments."}</li>
              <li>{isZh ? "AI 交互：提示词/内容仅用于生成，不用于训练公共模型。" : "AI usage: Prompts/content used for generation, not for public model training."}</li>
              <li>{isZh ? "IP 合规：基于 IP 做区域合规（如受限地区拦截）。" : "IP compliance: Region checks (e.g., restricted/GDPR areas) may block access."}</li>
              <li>{isZh ? "数据权利：可随时导出、更正或删除账户数据。" : "Your rights: Export, correct, or delete your data anytime."}</li>
            </ul>
          </div>

          <div className="space-y-1">
            <p className="font-semibold">{isZh ? "English (Summary)" : "English (Summary)"}</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Dual storage: CN users on CloudBase (mainland), Intl users on Supabase (abroad).</li>
              <li>Payment safety: No full card data stored; Stripe/WeChat/Alipay/PayPal handle payments.</li>
              <li>AI usage: Prompts/content go to model providers for generation, not for public training.</li>
              <li>IP compliance: Region checks (e.g., restricted/GDPR areas) may block access.</li>
              <li>Your rights: Export, correct, or delete your data anytime.</li>
            </ul>
          </div>

          <div className="space-y-1">
            <p className="font-semibold">{isZh ? "简要说明" : "Quick Notes"}</p>
            <ul className="list-disc list-inside space-y-1">
              <li>{isZh ? "收集：账户/订阅/支付流水、配额使用、对话/提示词、IP 与设备信息。" : "Collect: account/subscription/payments, quota usage, prompts/content, IP & device info."}</li>
              <li>{isZh ? "用途：提供服务、计费续费、合规风控、通知与客服。" : "Use: service delivery, billing/renewal, compliance/abuse checks, notifications/support."}</li>
              <li>{isZh ? "共享：仅在必要时与基础设施、支付方、模型方、法律要求的场景共享。" : "Sharing: only when needed with infra, payment, model providers, or legal requests."}</li>
              <li>{isZh ? "存储与删除：账户活跃期间保留；注销后删除账户与历史，流水按法规保留。" : "Retention: kept while active; deleting account wipes data, payment records kept per law."}</li>
              <li>{isZh ? "安全：全程 TLS，行级安全与权限控制，防越权/双花。" : "Security: TLS in transit; RLS/permissions to prevent IDOR/double-spend."}</li>
              <li>{isZh ? "未成年人：不面向 18 岁以下用户，若误收集将删除。" : "Minors: not for users under 18; delete if collected inadvertently."}</li>
              <li>{isZh ? "Cookies：用于会话、偏好、匿名统计。" : "Cookies: session, preferences, anonymous analytics."}</li>
              <li>{isZh ? "更新与联系：重大变更会通知；联系邮箱 mornscience@gmail.com。" : "Updates & contact: major changes notified; reach us at mornscience@gmail.com."}</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* 订阅规则弹窗 */}
    <Dialog open={showTerms} onOpenChange={setShowTerms}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isZh ? "订阅规则" : "Subscription Terms"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-gray-700 dark:text-gray-200">
          <p className="font-semibold">📜 订阅会员与加油包使用规则</p>

          <div className="space-y-2">
            <p className="font-semibold">📅 订阅周期说明 (Subscription Cycle)</p>
            <p>您的订阅服务按<strong>“自然月”</strong>周期计算，而非简单的 30 天。系统会根据您首次开通的日期锁定您的“专属账单日”。</p>
            <p>账单日锁定：如果您在 15 号开通，后续每月的 15 号为您的扣费和额度刷新日。</p>
            <p>月末自动对齐：</p>
            <p>若您在 1月31日 订阅，因 2 月无 31 日，下个账单日将自动调整为 2月28日（或29日）。</p>
            <p>再下个月，账单日将自动回调至 3月31日。我们承诺不会因大小月差异导致您的账单日永久提前。</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">⚡ 额度扣除顺序 (Deduction Priority)</p>
            <p>为了最大化保障您的权益，系统严格遵循 “优先消耗限时额度” 的原则：</p>
            <p>第一优先级：月度订阅额度 🟢</p>
            <p>系统会优先扣除您套餐内包含的月度额度。</p>
            <p>注：月度额度当期有效，不可结转至下月。账单日刷新时，未用完的月度额度将重置。</p>
            <p>第二优先级：加油包额度 🔵</p>
            <p>仅当您的月度额度全部耗尽（或您当前未订阅任何套餐）时，系统才会开始扣除加油包额度。</p>
            <p>加油包额度永久有效，直到用完为止，不会随时间过期。</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">🔋 加油包特殊规则 (Add-on Rules)</p>
            <p>加油包是独立于订阅套餐的额外用量补充包。</p>
            <p>永久有效期：购买后若未使用，额度将永久保留在您的账户中。</p>
            <p>独立使用：即使您的月度订阅已过期或取消，您依然可以单独使用剩余的加油包额度。</p>
            <p>叠加规则：多次购买加油包，额度将直接累加。</p>
            <p>不可退款：加油包属于数字化虚拟商品，一经售出（或开始消耗），不支持退款。</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">🔄 变更与续费 (Change & Renewal)</p>
            <p>升级套餐 (Upgrade)：</p>
            <p>升级立即生效。</p>
            <p>账单日重置：升级当天将成为您新的账单日。</p>
            <p>额度处理：您将立即获得新套餐的完整月度额度，旧套餐未用完的月度额度将被覆盖（加油包额度不受影响，继续保留）。</p>
            <p>续费 (Renewal)：</p>
            <p>续费成功后，您的账单日保持不变。</p>
            <p>月度额度将在账单日自动重置为满额。</p>
            <p>过期/取消 (Expiration)：</p>
            <p>订阅过期后，未用完的月度额度将失效并清零。</p>
            <p>账户内的加油包额度依然保留，可继续使用。</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">🚫 异常与限制</p>
            <p>扣款失败：若自动续费失败，系统将暂停您的订阅权益（月度额度归零），直到重新支付成功。期间您仍可消耗加油包额度。</p>
            <p>合规检测：系统会对访问 IP 进行合规检测，若检测到异常区域（如部分受限地区），可能会限制服务的连接。</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

export default AddonPackageTab;
