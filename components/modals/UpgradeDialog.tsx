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
      icon: <Star className="w-5 h-5" />,
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
      icon: <Rocket className="w-5 h-5" />,
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
      icon: <Shield className="w-5 h-5" />,
    };
  return { 
    gradient: "from-blue-500 to-indigo-600",
    bgGradient: "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
    border: "border-blue-200 dark:border-blue-800",
    selectedBorder: "border-blue-500",
    ring: "ring-blue-500/30",
    text: "text-blue-600 dark:text-blue-400",
    check: "text-blue-500",
    icon: <Crown className="w-5 h-5" />,
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
  const [selectedPayment, setSelectedPayment] = useState<"stripe" | "paypal">("stripe");
  const [isProcessing, setIsProcessing] = useState(false);
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
    const isStripe = selectedPayment === "stripe";
    const endpoint = isStripe ? "/api/payment/stripe/create" : "/api/payment/paypal/create";
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
      const redirect = isStripe ? data?.url : data?.approvalUrl;
      if (data?.success && redirect) {
        window.location.href = redirect as string;
      } else {
        alert(data?.error || tr("Failed to create payment", "支付创建失败"));
      }
    } catch (err) {
      alert(tr("Network error, please try again", "网络错误，请重试"));
    } finally {
      setIsProcessing(false);
    }
  };

  const pricingInfo = React.useMemo(() => {
    if (!selectedPlanInDialog) {
      return { payable: null, targetAmount: null, isUpgrade: false, remainingDays: 0, deduction: 0, symbol: "" };
    }

    const target = resolvePlanByName(selectedPlanInDialog.name);
    if (!target) {
      return { payable: null, targetAmount: null, isUpgrade: false, remainingDays: 0, deduction: 0, symbol: "" };
    }

    const targetAmount = getPlanAmount(target.name, billingPeriod, useRmb);
    const priceLabel = billingPeriod === "annual" ? selectedPlanInDialog.annualPrice || selectedPlanInDialog.price : selectedPlanInDialog.price;
    const trimmed = priceLabel.trim();
    const symbol = trimmed.startsWith("￥") ? "￥" : trimmed.startsWith("$") ? "$" : "";

    if (!isDomesticVersion) {
      return { payable: targetAmount, targetAmount, isUpgrade: false, remainingDays: 0, deduction: 0, symbol };
    }

    const currentKey = normalizePlanName(currentPlan);
    const currentRank = planRank[currentKey.toLowerCase()] || 0;
    const targetRank = planRank[target.name.toLowerCase()] || 0;
    const now = Date.now();
    const exp = currentPlanExp ? new Date(currentPlanExp).getTime() : null;
    const currentActive = exp ? exp > now : false;
    const isUpgrade = currentActive && targetRank > currentRank && currentRank > 0;

    if (!isUpgrade) {
      return { payable: targetAmount, targetAmount, isUpgrade: false, remainingDays: 0, deduction: 0, symbol };
    }

    const remainingDays = Math.max(0, Math.ceil(((exp || now) - now) / msPerDay));
    const currentMonthly = getPlanAmount(currentKey, "monthly", true);
    const deduction = (currentMonthly / 30) * remainingDays;
    const upgradePrice = Math.max(0, targetAmount - deduction);
    const payable = Math.round(upgradePrice * 100) / 100;

    return { payable, targetAmount, isUpgrade: true, remainingDays, deduction: Math.round(deduction * 100) / 100, symbol };
  }, [billingPeriod, currentPlan, currentPlanExp, getPlanAmount, isDomesticVersion, normalizePlanName, planRank, selectedPlanInDialog, useRmb, resolvePlanByName, msPerDay]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-[#0f1015] dark:via-[#14151a] dark:to-[#0f1015] border-0 p-0 overflow-hidden shadow-2xl max-h-[92vh]">
        {/* 装饰性背景 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-400/8 to-purple-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-br from-emerald-400/8 to-teal-500/8 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-violet-400/5 to-amber-400/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 p-6">
          {/* 标题区 */}
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center justify-center space-x-3 text-xl font-bold">
              <div className="p-2 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-xl shadow-lg shadow-orange-500/25">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-100 dark:to-white bg-clip-text text-transparent">
                {selectedPaidModel
                  ? tr(`Upgrade to Access ${selectedPaidModel.name}`, `升级以解锁 ${selectedPaidModel.name}`)
                  : tr("Choose Your MornGPT Plan", "选择你的 MornGPT 套餐")}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Tab 切换 */}
          <div className="flex items-center justify-center mb-5">
            <div className="bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-2xl p-1.5 flex shadow-lg border border-gray-200/50 dark:border-white/10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setActiveTab("subscription"); setSelectedPlanInDialog?.(undefined); }}
                className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all duration-300 ${
                  activeTab === "subscription"
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-white/5"
                }`}
              >
                <Crown className="w-4 h-4 mr-2" />
                {tr("Subscription Plans", "订阅套餐")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setActiveTab("addon"); setSelectedPlanInDialog?.(undefined); }}
                className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all duration-300 ${
                  activeTab === "addon"
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-white/5"
                }`}
              >
                <Zap className="w-4 h-4 mr-2" />
                {tr("Credit Packs", "额度加油包")}
              </Button>
            </div>
          </div>

          {/* 加油包 Tab */}
          {activeTab === "addon" && <AddonPackageTab appUserId={appUserId} />}

          {/* 订阅套餐 Tab */}
          {activeTab === "subscription" && (
            <div className="space-y-5">
              {/* 月付/年付切换 */}
              <div className="flex items-center justify-center">
                <div className="bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-2xl p-1 flex shadow-lg border border-gray-200/50 dark:border-white/10">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBillingPeriod("monthly")}
                    className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all duration-300 ${
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
                    className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all duration-300 ${
                      billingPeriod === "annual"
                        ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    {tr("Annual", "年付")}
                    <Badge className="ml-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] px-2 py-0.5 font-bold border-0">
                      -30%
                    </Badge>
                  </Button>
                </div>
              </div>

              {/* 套餐卡片 - 横向宽布局 */}
              <div className="grid grid-cols-3 gap-4">
                {localizedPlans.map((plan, index) => {
                  const isSelected = selectedPlanInDialog?.name === plan.name;
                  const theme = getPlanTheme(plan.name);
                  
                  return (
                    <div
                      key={plan.name}
                      onClick={() => { setSelectedPlanInDialog(plan); handleUpgradeClick(plan); }}
                      className={`relative cursor-pointer transition-all duration-500 group`}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* 选中时的外发光效果 */}
                      {isSelected && (
                        <div className={`absolute -inset-1 bg-gradient-to-r ${theme.gradient} opacity-20 blur-lg rounded-2xl`} />
                      )}
                      
                      <div className={`relative h-full rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
                        isSelected
                          ? `${theme.selectedBorder} shadow-2xl ring-4 ${theme.ring}`
                          : `${theme.border} hover:shadow-xl hover:-translate-y-1`
                      }`}>
                        {/* 卡片背景渐变 */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${theme.bgGradient} opacity-50`} />
                        <div className="absolute inset-0 bg-white/60 dark:bg-[#14151a]/60 backdrop-blur-sm" />
                        
                        {/* 热门标签 */}
                        {plan.popular && (
                          <div className="absolute -top-px left-1/2 transform -translate-x-1/2">
                            <div className="relative">
                              <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} blur-sm opacity-50`} />
                              <Badge className={`relative bg-gradient-to-r ${theme.gradient} text-white px-4 py-1 text-[10px] font-bold shadow-lg border-0 rounded-b-xl rounded-t-none`}>
                                <Sparkles className="w-3 h-3 mr-1" />
                                {tr("Most Popular", "人气推荐")}
                              </Badge>
                            </div>
                          </div>
                        )}

                        {/* 选中指示器 */}
                        {isSelected && (
                          <div className="absolute top-3 right-3 z-10">
                            <div className={`w-7 h-7 rounded-full bg-gradient-to-r ${theme.gradient} flex items-center justify-center shadow-lg`}>
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}

                        <div className="relative p-5">
                          {/* 套餐图标和名称 */}
                          <div className="text-center mb-4">
                            <div className={`w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-lg shadow-current/20 transform transition-transform group-hover:scale-110`}>
                              <div className="text-white">{theme.icon}</div>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                          </div>

                          {/* 价格区域 */}
                          <div className="text-center mb-4 py-3 border-y border-gray-200/50 dark:border-white/10">
                            <div className="flex items-baseline justify-center gap-1">
                              <span className={`text-3xl font-extrabold bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}>
                                {billingPeriod === "annual" ? plan.annualPrice : plan.price}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                                /{tr("month", "月")}
                              </span>
                            </div>
                            {billingPeriod === "annual" && (
                              <div className="mt-1.5 flex items-center justify-center gap-2">
                                <span className="text-xs text-gray-400 line-through">{plan.price}/mo</span>
                                <Badge className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[9px] px-1.5 py-0 font-bold border-0">
                                  {tr("Save 30%", "省30%")}
                                </Badge>
                              </div>
                            )}
                          </div>

                          {/* 完整特性列表 */}
                          <ul className="space-y-2.5">
                            {plan.features.map((feature, idx) => (
                              <li key={idx} className="flex items-start gap-2.5">
                                <div className={`w-5 h-5 rounded-full bg-gradient-to-r ${theme.gradient} flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm`}>
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                                <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feature}</span>
                              </li>
                            ))}
                          </ul>

                          {/* 选择提示 */}
                          <div className={`mt-4 pt-4 border-t border-gray-200/50 dark:border-white/10 text-center`}>
                            <span className={`text-sm font-medium transition-colors ${
                              isSelected 
                                ? theme.text
                                : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"
                            }`}>
                              {isSelected 
                                ? (isZh ? "✓ 已选择" : "✓ Selected") 
                                : (isZh ? "点击选择" : "Click to select")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 支付区域 */}
              <div className={`transition-all duration-300 ${selectedPlanInDialog ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <div className="p-5 bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-lg">
                  <div className="flex items-center justify-between gap-6">
                    {/* 支付方式选择 */}
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                        <CreditCard className="w-4 h-4 mr-2" />
                        {tr("Payment:", "支付方式：")}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPayment("stripe")}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                            selectedPayment === "stripe"
                              ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25"
                              : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/15"
                          }`}
                        >
                          💳 Stripe
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPayment("paypal")}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                            selectedPayment === "paypal"
                              ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
                              : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/15"
                          }`}
                        >
                          🅿️ PayPal
                        </button>
                      </div>
                    </div>

                    {/* 支付按钮 */}
                    <Button
                      disabled={isProcessing || !selectedPlanInDialog}
                      onClick={handleSubscribe}
                      className="h-12 px-8 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-700 text-white font-bold text-base rounded-xl shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-[1.02]"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          {tr("Processing...", "处理中...")}
                        </>
                      ) : (
                        <>
                          <Rocket className="w-5 h-5 mr-2" />
                          {pricingInfo.payable !== null
                            ? `${tr("Pay Now", "立即支付")} ${pricingInfo.symbol}${pricingInfo.payable.toFixed(2)}`
                            : tr("Select a Plan", "请选择套餐")}
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* 升级优惠提示 */}
                  {pricingInfo.isUpgrade && (
                    <div className="mt-4 p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-xl border border-amber-200/50 dark:border-amber-700/50 text-center">
                      <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                        🎁 {tr("Upgrade discount applied", "升级优惠已应用")}：
                        <span className="font-bold">-{pricingInfo.symbol}{pricingInfo.deduction.toFixed(2)}</span>
                        <span className="text-amber-600 dark:text-amber-400 ml-2">
                          ({pricingInfo.remainingDays} {tr("days remaining", "天剩余价值")})
                        </span>
                      </p>
                    </div>
                  )}
                  
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3 flex items-center justify-center gap-1">
                    <Shield className="w-3 h-3" />
                    {tr("Secure payment · Instant activation · Cancel anytime", "安全支付 · 即时生效 · 随时取消")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
