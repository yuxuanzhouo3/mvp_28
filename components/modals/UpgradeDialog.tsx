import React, { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Check, Zap, CreditCard, Sparkles, Star, Shield, Rocket, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { pricingPlans as pricingPlansRaw } from "@/constants/pricing";
import { AddonPackageTab } from "./AddonPackageTab";

type UpgradeTabType = "subscription" | "addon";

interface PricingPlan {
  name: string;
  nameZh?: string;
  price: string;
  priceZh?: string;
  annualPrice: string;
  annualPriceZh?: string;
  period: string;
  features: string[];
  popular?: boolean;
}

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPaidModel?: any;
  billingPeriod: "monthly" | "annual";
  setBillingPeriod: (period: "monthly" | "annual") => void;
  pricingPlans: PricingPlan[];
  selectedPlanInDialog?: PricingPlan;
  setSelectedPlanInDialog: (plan: PricingPlan | undefined) => void;
  handleUpgradeClick?: (plan: PricingPlan) => void;
  appUserId?: string | null;
  defaultTab?: UpgradeTabType;
  currentPlan?: string | null;
  currentPlanExp?: string | null;
}

// 套餐配色方案
const getPlanTheme = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes("basic") || lower.includes("基础"))
    return {
      gradient: "from-emerald-500 to-teal-600",
      bgGradient: "from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30",
      border: "border-emerald-200 dark:border-emerald-800",
      selectedBorder: "border-emerald-500",
      ring: "ring-emerald-500/30",
      text: "text-emerald-600 dark:text-emerald-400",
      check: "text-emerald-500",
      icon: <Star className="w-6 h-6" />,
    };
  if (lower.includes("pro") || lower.includes("专业"))
    return {
      gradient: "from-violet-500 to-purple-600",
      bgGradient: "from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30",
      border: "border-violet-200 dark:border-violet-800",
      selectedBorder: "border-violet-500",
      ring: "ring-violet-500/30",
      text: "text-violet-600 dark:text-violet-400",
      check: "text-violet-500",
      icon: <Rocket className="w-6 h-6" />,
    };
  if (lower.includes("enterprise") || lower.includes("企业"))
    return {
      gradient: "from-amber-500 to-orange-600",
      bgGradient: "from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30",
      border: "border-amber-200 dark:border-amber-800",
      selectedBorder: "border-amber-500",
      ring: "ring-amber-500/30",
      text: "text-amber-600 dark:text-amber-400",
      check: "text-amber-500",
      icon: <Shield className="w-6 h-6" />,
    };
  return {
    gradient: "from-blue-500 to-indigo-600",
    bgGradient: "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
    border: "border-blue-200 dark:border-blue-800",
    selectedBorder: "border-blue-500",
    ring: "ring-blue-500/30",
    text: "text-blue-600 dark:text-blue-400",
    check: "text-blue-500",
    icon: <Crown className="w-6 h-6" />,
  };
};

export const UpgradeDialog: React.FC<UpgradeDialogProps> = ({
  open,
  onOpenChange,
  selectedPaidModel,
  billingPeriod,
  setBillingPeriod,
  pricingPlans,
  selectedPlanInDialog,
  setSelectedPlanInDialog,
  handleUpgradeClick = () => {},
  appUserId,
  defaultTab = "subscription",
  currentPlan,
  currentPlanExp,
}) => {
  const { currentLanguage, isDomesticVersion } = useLanguage();
  const isZh = currentLanguage === "zh";
  const tr = useCallback((en: string, zh: string) => (isZh ? zh : en), [isZh]);
  const [activeTab, setActiveTab] = useState<UpgradeTabType>(defaultTab);
  // 国内版默认支付宝，国际版默认 Stripe
  const [selectedPayment, setSelectedPayment] = useState<"stripe" | "paypal" | "alipay" | "wechat">(
    isDomesticVersion ? "alipay" : "stripe"
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [agreeRules, setAgreeRules] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  // 显示层：国内版一律用人民币展示（PayPal 也显示人民币），国际版用美元
  const useRmb = isDomesticVersion;
  const planRank: Record<string, number> = { basic: 1, pro: 2, enterprise: 3 };
  const msPerDay = 1000 * 60 * 60 * 24;

  const normalizePlanName = useCallback((p?: string | null) => {
    const lower = (p || "").toLowerCase();
    if (lower === "basic" || lower === "基础版") return "Basic";
    if (lower === "pro" || lower === "专业版") return "Pro";
    if (lower === "enterprise" || lower === "企业版") return "Enterprise";
    return p || "";
  }, []);

  const resolvePlanByName = useCallback(
    (name?: string | null) => {
      if (!name) return undefined;
      const lower = name.toLowerCase();
      return pricingPlansRaw.find(
        (p) =>
          p.name.toLowerCase() === lower ||
          (p.nameZh && p.nameZh.toLowerCase() === lower),
      );
    },
    [],
  );

  const getPlanAmount = useCallback(
    (planKey: string, period: "monthly" | "annual", useDomesticPrice: boolean) => {
      const plan = resolvePlanByName(planKey);
      if (!plan) return 0;
      const label =
        period === "annual"
          ? useDomesticPrice
            ? plan.annualPriceZh || plan.annualPrice
            : plan.annualPrice
          : useDomesticPrice
            ? plan.priceZh || plan.price
            : plan.price;
      const numeric = parseFloat(label.replace(/[^0-9.]/g, "") || "0");
      return period === "annual" ? numeric * 12 : numeric;
    },
    [resolvePlanByName],
  );

  const localizedPlans = (pricingPlans || pricingPlansRaw).map((p) => ({
    ...p,
    name: isZh ? p.nameZh || p.name : p.name,
    price: useRmb && p.priceZh ? p.priceZh : p.price,
    annualPrice: useRmb && p.annualPriceZh ? p.annualPriceZh : p.annualPrice,
    features: p.features.map((f) => {
      if (!f.includes("|")) return f;
      const [en, zh] = f.split("|");
      return isZh ? zh || en : en;
    }),
  }));

  const handleSubscribe = async () => {
    if (!selectedPlanInDialog) return;
    setIsProcessing(true);

    // 根据支付方式选择不同的 API 端点
    let endpoint = "/api/payment/stripe/create";
    if (selectedPayment === "paypal") {
      endpoint = "/api/payment/paypal/create";
    } else if (selectedPayment === "alipay") {
      endpoint = "/api/payment/alipay/create";
    } else if (selectedPayment === "wechat") {
      endpoint = "/api/payment/wechat/create";
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType: "SUBSCRIPTION",
          planName: selectedPlanInDialog.name,
          billingPeriod: billingPeriod === "annual" ? "annual" : "monthly",
          userId: appUserId || undefined,
        }),
      });
      const data = await res.json();

      if (selectedPayment === "alipay") {
        // 支付宝返回 HTML 表单
        if (data?.success && data?.formHtml) {
          const div = document.createElement("div");
          div.innerHTML = data.formHtml;
          document.body.appendChild(div);
          const form = div.querySelector("form");
          if (form) {
            form.submit();
          } else if (data.formHtml.startsWith("http")) {
            window.location.href = data.formHtml;
          } else {
            alert(tr("Failed to create payment", "支付创建失败"));
          }
        } else {
          alert(data?.error || tr("Failed to create payment", "支付创建失败"));
        }
      } else if (selectedPayment === "wechat") {
        // 微信支付返回二维码链接
        if (data?.success && data?.code_url) {
          // 跳转到支付页面显示二维码
          const paymentUrl = `/payment/wechat?code_url=${encodeURIComponent(data.code_url)}&out_trade_no=${data.out_trade_no}&amount=${data.amount}`;
          window.location.href = paymentUrl;
        } else {
          alert(data?.error || tr("Failed to create payment", "支付创建失败"));
        }
      } else {
        // Stripe 和 PayPal 使用 URL 跳转
        const redirect = selectedPayment === "stripe" ? data?.url : data?.approvalUrl;
        if (data?.success && redirect) {
          window.location.href = redirect as string;
        } else {
          alert(data?.error || tr("Failed to create payment", "支付创建失败"));
        }
      }
    } catch (err) {
      alert(tr("Network error, please try again", "网络错误，请重试"));
    } finally {
      setIsProcessing(false);
    }
  };

  const pricingInfo = React.useMemo(() => {
    if (!selectedPlanInDialog) {
      return { payable: null, targetAmount: null, isUpgrade: false, remainingDays: 0, convertedDays: 0, remainingValue: 0, freeUpgrade: false, symbol: "" };
    }

    const target = resolvePlanByName(selectedPlanInDialog.name);
    if (!target) {
      return { payable: null, targetAmount: null, isUpgrade: false, remainingDays: 0, convertedDays: 0, remainingValue: 0, freeUpgrade: false, symbol: "" };
    }

    const symbol = useRmb ? "￥" : "$";
    const baseTargetAmount = getPlanAmount(target.name, billingPeriod, useRmb);
    const targetAmount = baseTargetAmount;
    const priceLabel = billingPeriod === "annual" ? selectedPlanInDialog.annualPrice || selectedPlanInDialog.price : selectedPlanInDialog.price;
    const trimmed = priceLabel.trim();

    const currentKey = normalizePlanName(currentPlan);
    const currentRank = planRank[currentKey.toLowerCase()] || 0;
    const targetRank = planRank[target.name.toLowerCase()] || 0;
    const now = Date.now();
    const exp = currentPlanExp ? new Date(currentPlanExp).getTime() : null;
    const currentActive = exp ? exp > now : false;
    const isUpgrade = currentActive && targetRank > currentRank && currentRank > 0;

    if (!isUpgrade) {
      return { payable: targetAmount, targetAmount, isUpgrade: false, remainingDays: 0, convertedDays: 0, freeUpgrade: false, symbol };
    }

    const remainingDays = Math.max(0, Math.ceil(((exp || now) - now) / msPerDay));
    const currentMonthly = getPlanAmount(currentKey, "monthly", useRmb);
    // 目标套餐价格：根据用户选择的计费周期（月费或年费总价）
    const targetPrice = getPlanAmount(target.name, billingPeriod, useRmb);
    const targetMonthly = getPlanAmount(target.name, "monthly", useRmb);

    // 计算当前套餐剩余价值
    const currentDailyPrice = currentMonthly / 30;
    const targetDailyPrice = targetMonthly / 30;
    const remainingValue = remainingDays * currentDailyPrice;

    // 目标套餐天数
    const targetDays = billingPeriod === "annual" ? 365 : 30;

    // 新升级逻辑：
    // 1. 如果剩余价值 ≥ 目标套餐价格：免费升级，剩余价值全部折算成目标套餐天数
    // 2. 如果剩余价值 < 目标套餐价格：补差价，获得目标套餐天数（30天或365天）
    const freeUpgrade = remainingValue >= targetPrice;

    let payable: number;
    let convertedDays: number;

    if (freeUpgrade) {
      // 免费升级：剩余价值全部折算成目标套餐天数
      payable = 0.01; // 最低支付金额
      convertedDays = Math.floor(remainingValue / targetDailyPrice);
    } else {
      // 补差价：支付差额，获得目标套餐天数
      payable = Math.max(0.01, targetPrice - remainingValue);
      convertedDays = targetDays;
    }

    payable = Math.round(payable * 100) / 100;

    return {
      payable,
      targetAmount,
      isUpgrade: true,
      remainingDays,
      convertedDays,
      remainingValue: Math.round(remainingValue * 100) / 100,
      freeUpgrade,
      symbol
    };
  }, [billingPeriod, currentPlan, currentPlanExp, getPlanAmount, isDomesticVersion, normalizePlanName, planRank, selectedPayment, selectedPlanInDialog, useRmb, resolvePlanByName, msPerDay]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[92vh] bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-[#0f1015] dark:via-[#14151a] dark:to-[#0f1015] border-0 overflow-hidden shadow-2xl rounded-3xl">
          {/* 装饰性背景 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-br from-emerald-400/10 to-teal-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 p-3 md:p-6 overflow-y-auto overflow-x-visible max-h-[88vh]">
          {/* 标题区 */}
          <DialogHeader className="text-center mb-4 md:mb-6">
            <DialogTitle className="flex items-center justify-center space-x-2 md:space-x-3 text-lg md:text-2xl font-bold">
              <div className="p-1.5 md:p-2 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-lg md:rounded-xl shadow-lg shadow-orange-500/25">
                <Crown className="w-4 h-4 md:w-6 md:h-6 text-white" />
              </div>
              <span className="text-gray-900 dark:text-white font-bold">
              {selectedPaidModel
                ? tr(`Upgrade to Access ${selectedPaidModel.name}`, `升级以解锁 ${selectedPaidModel.name}`)
                : tr("Choose Your MornGPT Plan", "选择你的 MornGPT 套餐")}
            </span>
          </DialogTitle>
        </DialogHeader>

          {/* Tab 切换 */}
          <div className="flex items-center justify-center mb-4 md:mb-6">
            <div className="bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-xl md:rounded-2xl p-1 flex shadow-lg border border-gray-200/50 dark:border-white/10">
            <Button
                variant="ghost"
              size="sm"
                onClick={() => { setActiveTab("subscription"); setSelectedPlanInDialog?.(undefined); }}
                className={`px-3 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-semibold rounded-lg md:rounded-xl transition-all duration-300 ${
                activeTab === "subscription"
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-white/5"
              }`}
            >
              <Crown className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              {tr("Subscription Plans", "订阅套餐")}
            </Button>
            <Button
                variant="ghost"
              size="sm"
                onClick={() => { setActiveTab("addon"); setSelectedPlanInDialog?.(undefined); }}
                className={`px-3 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-semibold rounded-lg md:rounded-xl transition-all duration-300 ${
                activeTab === "addon"
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-white/5"
              }`}
            >
              <Zap className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              {tr("Credit Packs", "额度加油包")}
            </Button>
          </div>
        </div>

        {/* 加油包 Tab */}
        {activeTab === "addon" && (
          <AddonPackageTab appUserId={appUserId} />
        )}

        {/* 订阅套餐 Tab */}
        {activeTab === "subscription" && (
            <>
              {/* 月付/年付切换 */}
              <div className="flex items-center justify-center mb-4 md:mb-6">
                <div className="bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-xl md:rounded-2xl p-1 flex shadow-lg border border-gray-200/50 dark:border-white/10">
                <Button
                    variant="ghost"
                  size="sm"
                  onClick={() => setBillingPeriod("monthly")}
                    className={`px-3 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-semibold rounded-lg md:rounded-xl transition-all duration-300 ${
                    billingPeriod === "monthly"
                        ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-lg"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {tr("Monthly", "月付")}
                </Button>
                <Button
                    variant="ghost"
                  size="sm"
                  onClick={() => setBillingPeriod("annual")}
                    className={`px-3 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-semibold rounded-lg md:rounded-xl transition-all duration-300 ${
                    billingPeriod === "annual"
                        ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                    {tr("Annual", "年付")}
                    <Badge className="ml-1 md:ml-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[9px] md:text-[10px] px-1.5 py-0 font-bold border-0">
                      -30%
                    </Badge>
                </Button>
              </div>
            </div>

              {/* 移动端滑动提示 */}
              <div className="md:hidden flex items-center justify-center gap-2 mb-3 text-[10px] text-gray-500 dark:text-gray-400">
                <span>←</span>
                <span>{isZh ? "左右滑动查看套餐" : "Swipe to view plans"}</span>
                <span>→</span>
              </div>

              {/* 套餐卡片 - 移动端横向滑动，桌面端三列网格 */}
              <div className="flex md:grid md:grid-cols-3 gap-3 md:gap-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none scrollbar-hide py-2 pb-4 mb-4 md:mb-6 px-2 -mx-2">
                {localizedPlans.map((plan, index) => {
                  const isSelected = selectedPlanInDialog?.name === plan.name;
                  const theme = getPlanTheme(plan.name);

                  return (
                <div
                  key={plan.name}
                      onClick={() => { setSelectedPlanInDialog(plan); handleUpgradeClick(plan); }}
                      className={`relative cursor-pointer transition-all duration-300 group flex-shrink-0 w-[240px] md:w-auto snap-center ${
                        isSelected ? "scale-[1.02]" : "hover:scale-[1.01]"
                      }`}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* 选中时的外发光效果 */}
                      {isSelected && (
                        <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} opacity-20 blur-xl rounded-2xl -z-10`} />
                      )}

                      <div className={`relative h-full rounded-xl md:rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
                        isSelected
                          ? `${theme.selectedBorder} shadow-2xl ring-4 ${theme.ring}`
                          : `${theme.border} hover:shadow-xl`
                      }`}>
                        {/* 卡片背景渐变 */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${theme.bgGradient} opacity-50`} />
                        <div className="absolute inset-0 bg-white/60 dark:bg-[#14151a]/60 backdrop-blur-sm" />

                        {/* 热门标签 */}
                  {plan.popular && (
                          <div className="absolute -top-px left-1/2 transform -translate-x-1/2">
                              <Badge className={`bg-gradient-to-r ${theme.gradient} text-white px-2 md:px-4 py-0.5 md:py-1 text-[10px] md:text-xs font-bold shadow-lg border-0 rounded-b-lg md:rounded-b-xl rounded-t-none`}>
                                <Sparkles className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                                {tr("Most Popular", "最受欢迎")}
                              </Badge>
                    </div>
                  )}

                        {/* 选中指示器 */}
                        {isSelected && (
                          <div className="absolute top-3 right-3 z-10">
                            <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full bg-gradient-to-r ${theme.gradient} flex items-center justify-center shadow-lg`}>
                              <Check className="w-3 h-3 md:w-5 md:h-5 text-white" />
                      </div>
                    </div>
                  )}

                        <div className={`relative p-3 md:p-5 ${plan.popular ? "pt-6 md:pt-8" : ""}`}>
                          {/* 套餐图标和名称 */}
                          <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                            <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-lg`}>
                              <div className="text-white scale-75 md:scale-100">{theme.icon}</div>
                            </div>
                            <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                          </div>

                          {/* 价格区域 */}
                          <div className="mb-4 md:mb-5 py-3 md:py-4 border-y border-gray-200/50 dark:border-white/10">
                            <div className="flex items-baseline gap-1">
                              <span className={`text-2xl md:text-3xl font-extrabold ${theme.text}`}>
                          {billingPeriod === "annual" ? plan.annualPrice : plan.price}
                        </span>
                              <span className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">
                                /{tr("mo", "月")}
                        </span>
                      </div>
                      {billingPeriod === "annual" && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs md:text-sm text-gray-400 line-through">
                                  {plan.price}
                                </span>
                                <Badge className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[9px] md:text-xs px-1.5 md:px-2 py-0 font-bold border-0">
                                  {tr("Save 30%", "省30%")}
                          </Badge>
                        </div>
                      )}
                    </div>

                          {/* 特性列表 */}
                          <ul className="space-y-2 md:space-y-2.5">
                            {plan.features.map((feature, idx) => (
                              <li key={idx} className="flex items-start gap-2 md:gap-2.5">
                                <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full bg-gradient-to-r ${theme.gradient} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                  <Check className="w-2.5 h-2.5 md:w-3 md:h-3 text-white" />
                                </div>
                                <span className="text-xs md:text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                          {/* 选择提示 */}
                          <div className={`mt-4 md:mt-5 pt-3 md:pt-4 border-t border-gray-200/50 dark:border-white/10 text-center`}>
                            <span className={`text-xs md:text-sm font-medium transition-colors ${
                              isSelected
                                ? theme.text
                                : "text-gray-400 dark:text-gray-500"
                            }`}>
                              {isSelected
                                ? (isZh ? "✓ 已选择此套餐" : "✓ Selected")
                                : (isZh ? "点击选择此套餐" : "Click to select")}
                            </span>
                          </div>
                        </div>
                      </div>
                </div>
                  );
                })}
              </div>

              {/* 支付区域 */}
              <div className={`transition-all duration-300 ${selectedPlanInDialog ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div className="p-3 md:p-4 bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-xl md:rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-lg">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
                      {/* 支付方式选择 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                          <CreditCard className="w-4 h-4 mr-1.5" />
                          {tr("Payment:", "支付方式:")}
                        </span>
                        <div className="flex gap-2">
                          {/* 国内版：支付宝、微信 */}
                          {isDomesticVersion && (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedPayment("alipay")}
                                className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all duration-300 ${
                                  selectedPayment === "alipay"
                                    ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
                                    : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                                }`}
                              >
                                💙 支付宝
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedPayment("wechat")}
                                className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all duration-300 ${
                                  selectedPayment === "wechat"
                                    ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg"
                                    : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                                }`}
                              >
                                💚 微信支付
                              </button>
                            </>
                          )}
                          {/* 国际版：Stripe、PayPal */}
                          {!isDomesticVersion && (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedPayment("stripe")}
                                className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all duration-300 ${
                                  selectedPayment === "stripe"
                                    ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg"
                                    : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                                }`}
                              >
                                💳 Stripe
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedPayment("paypal")}
                                className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all duration-300 ${
                                  selectedPayment === "paypal"
                                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg"
                                    : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                                }`}
                              >
                                🅿️ PayPal
                              </button>
                            </>
                          )}
                        </div>
                      </div>

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
                            {tr("I have read and agree to", "我已阅读并同意")}
                            <button type="button" className="underline hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => setShowPrivacy(true)}>
                              {tr("Privacy Policy", "《隐私条款》")}
                            </button>
                            {tr("and", "和")}
                            <button type="button" className="underline hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => setShowTerms(true)}>
                              {tr("Subscription Terms", "《订阅规则》")}
                            </button>
                          </span>
                        </label>

                        {/* 支付按钮 - 独立一行 */}
                        <div className="flex justify-end">
                          <Button
                            disabled={isProcessing || !selectedPlanInDialog || !agreeRules}
                            onClick={handleSubscribe}
                            className="h-10 md:h-12 px-5 md:px-8 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-700 text-white font-bold text-sm md:text-base rounded-xl shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin mr-2" />
                                {tr("Processing...", "处理中...")}
                              </>
                            ) : (
                              <>
                                <Rocket className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                                {pricingInfo.payable !== null
                                  ? `${tr("Subscribe", "订阅")} ${pricingInfo.symbol}${pricingInfo.payable.toFixed(2)}`
                                  : tr("Select a Plan", "请选择套餐")}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                  {/* 升级折算提示 */}
                {pricingInfo.isUpgrade && (
                    <div className={`mt-3 md:mt-4 p-3 rounded-xl border text-center text-xs md:text-sm ${
                      pricingInfo.freeUpgrade
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/50"
                        : "bg-blue-50 dark:bg-blue-950/30 border-blue-200/50"
                    }`}>
                      {pricingInfo.freeUpgrade ? (
                        <span className="text-emerald-700 dark:text-emerald-300">
                          🎁 {tr("Free upgrade! Your remaining", "免费升级！剩余")} {pricingInfo.remainingDays} {tr("days converted to", "天折算为")} {pricingInfo.convertedDays} {tr("days on new plan", "天新套餐")}
                        </span>
                      ) : (
                        <span className="text-blue-700 dark:text-blue-300">
                          📊 {tr("Your remaining", "剩余")} {pricingInfo.remainingDays} {tr("days deducted. Pay only", "天已抵扣，仅需支付")} {pricingInfo.symbol}{pricingInfo.payable?.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </>
          )}
        </div>
        </DialogContent>
      </Dialog>

      {/* 隐私条款弹窗 */}
      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader className="pb-3 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{tr("Privacy Policy", "隐私条款")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-gray-700 dark:text-gray-200 pt-3">
        <p className="font-semibold">🔒 隐私政策 (Privacy Policy)</p>
        <p>生效日期：2025年12月01日</p>
        <p>尊重并保护您的隐私是 MornGPT（以下简称"我们"）的核心原则。</p>

        <div className="space-y-1">
          <p className="font-semibold">中文（摘要）</p>
          <ul className="list-disc list-inside space-y-1">
            <li>双轨存储：大陆用户在 CloudBase（境内），国际用户在 Supabase（境外）。</li>
            <li>支付安全：不存储完整卡号/口令，支付由 Stripe/微信/支付宝/PayPal 处理。</li>
            <li>AI 交互：提示词/内容仅用于生成，不用于训练公共模型。</li>
            <li>IP 合规：基于 IP 做区域合规（如受限地区拦截）。</li>
            <li>数据权利：可随时导出、更正或删除账户数据。</li>
          </ul>
        </div>

        <div className="space-y-1">
          <p className="font-semibold">English (Summary)</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Dual storage: CN users on CloudBase (mainland), Intl users on Supabase (abroad).</li>
            <li>Payment safety: No full card data stored; Stripe/WeChat/Alipay/PayPal process payments.</li>
            <li>AI usage: Prompts/content go to model providers for generation, not for public model training.</li>
            <li>IP compliance: Region checks (e.g., restricted/GDPR areas) may block access.</li>
            <li>Your rights: Export, correct, or delete your data anytime.</li>
          </ul>
        </div>

        <div className="space-y-1">
          <p className="font-semibold">简要说明</p>
          <ul className="list-disc list-inside space-y-1">
            <li>收集：账户信息、订阅/支付流水、配额使用、对话/提示词、IP 与设备信息。</li>
            <li>用途：提供服务、计费续费、合规风控、通知与客服支持。</li>
            <li>共享：仅在必要时与基础设施（Supabase/CloudBase/Vercel）、支付方、AI 模型方、法律要求的场景共享。</li>
            <li>存储与删除：账户活跃期间保留；注销后删除账户与历史，对账/税务流水按法规保留。</li>
            <li>安全：全程 TLS，数据库行级安全与权限控制，防止越权与双花。</li>
            <li>未成年人：不面向 18 岁以下用户，如误收集将删除。</li>
            <li>Cookies：用于会话、偏好、匿名统计。</li>
            <li>更新与联系：重大变更会通知；问题或数据请求请联系 mornscience@gmail.com。</li>
          </ul>
        </div>
      </div>
    </DialogContent>
  </Dialog>

      {/* 订阅规则弹窗 */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader className="pb-3 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{tr("Subscription Terms", "订阅规则")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-gray-700 dark:text-gray-200 pt-3">
        <p className="font-semibold">📜 订阅会员与加油包使用规则</p>

        <div className="space-y-2">
          <p className="font-semibold">📅 订阅周期说明 (Subscription Cycle)</p>
          <p>您的订阅服务按<strong>"自然月"</strong>周期计算，而非简单的 30 天。系统会根据您首次开通的日期锁定您的"专属账单日"。</p>
          <p>账单日锁定：如果您在 15 号开通，后续每月的 15 号为您的扣费和额度刷新日。</p>
          <p>月末自动对齐：</p>
          <p>若您在 1月31日 订阅，因 2 月无 31 日，下个账单日将自动调整为 2月28日（或29日）。</p>
          <p>再下个月，账单日将自动回调至 3月31日。我们承诺不会因大小月差异导致您的账单日永久提前。</p>
        </div>

        <div className="space-y-2">
          <p className="font-semibold">⚡ 额度扣除顺序 (Deduction Priority)</p>
          <p>为了最大化保障您的权益，系统严格遵循 "优先消耗限时额度" 的原则：</p>
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
};
