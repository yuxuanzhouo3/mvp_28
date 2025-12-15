import React, { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Check, MessageSquare, Zap, CreditCard, Sparkles, Star, Shield, Rocket } from "lucide-react";
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

// 为不同套餐获取不同的图标
const getPlanIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes("basic") || lower.includes("基础")) return <Star className="w-6 h-6" />;
  if (lower.includes("pro") || lower.includes("专业")) return <Rocket className="w-6 h-6" />;
  if (lower.includes("enterprise") || lower.includes("企业")) return <Shield className="w-6 h-6" />;
  return <Crown className="w-6 h-6" />;
};

// 为不同套餐获取渐变色
const getPlanGradient = (name: string, isSelected: boolean) => {
  const lower = name.toLowerCase();
  if (isSelected) {
    if (lower.includes("basic") || lower.includes("基础")) 
      return "from-emerald-500 to-teal-600";
    if (lower.includes("pro") || lower.includes("专业")) 
      return "from-violet-500 to-purple-600";
    if (lower.includes("enterprise") || lower.includes("企业")) 
      return "from-amber-500 to-orange-600";
  }
  return "";
};

// 为不同套餐获取边框色
const getPlanBorderColor = (name: string, isSelected: boolean) => {
  if (!isSelected) return "border-gray-200 dark:border-gray-700";
  const lower = name.toLowerCase();
  if (lower.includes("basic") || lower.includes("基础")) return "border-emerald-500";
  if (lower.includes("pro") || lower.includes("专业")) return "border-violet-500";
  if (lower.includes("enterprise") || lower.includes("企业")) return "border-amber-500";
  return "border-blue-500";
};

// 为不同套餐获取图标背景色
const getPlanIconBg = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes("basic") || lower.includes("基础")) 
    return "bg-gradient-to-br from-emerald-400 to-teal-500";
  if (lower.includes("pro") || lower.includes("专业")) 
    return "bg-gradient-to-br from-violet-400 to-purple-500";
  if (lower.includes("enterprise") || lower.includes("企业")) 
    return "bg-gradient-to-br from-amber-400 to-orange-500";
  return "bg-gradient-to-br from-blue-400 to-blue-500";
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

  const getPeriodLabel = useCallback(
    (val: string) => {
      if (!isZh) return val;
      const lower = val.toLowerCase();
      if (lower === "month" || lower === "monthly") return "月";
      if (lower === "year" || lower === "annual") return "年";
      return val;
    },
    [isZh],
  );

  // 对标加油包：选中套餐后才展示支付方式，直接创建 Stripe/PayPal 订单
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
      return {
        payable: null,
        targetAmount: null,
        isUpgrade: false,
        remainingDays: 0,
        deduction: 0,
        symbol: "",
      };
    }

    const target = resolvePlanByName(selectedPlanInDialog.name);
    if (!target) {
      return {
        payable: null,
        targetAmount: null,
        isUpgrade: false,
        remainingDays: 0,
        deduction: 0,
        symbol: "",
      };
    }

    const targetAmount = getPlanAmount(target.name, billingPeriod, useRmb);
    const priceLabel =
      billingPeriod === "annual"
        ? selectedPlanInDialog.annualPrice || selectedPlanInDialog.price
        : selectedPlanInDialog.price;
    const trimmed = priceLabel.trim();
    const symbol = trimmed.startsWith("￥") ? "￥" : trimmed.startsWith("$") ? "$" : "";

    if (!isDomesticVersion) {
      return {
        payable: targetAmount,
        targetAmount,
        isUpgrade: false,
        remainingDays: 0,
        deduction: 0,
        symbol,
      };
    }

    const currentKey = normalizePlanName(currentPlan);
    const currentRank = planRank[currentKey.toLowerCase()] || 0;
    const targetRank = planRank[target.name.toLowerCase()] || 0;
    const now = Date.now();
    const exp = currentPlanExp ? new Date(currentPlanExp).getTime() : null;
    const currentActive = exp ? exp > now : false;
    const isUpgrade = currentActive && targetRank > currentRank && currentRank > 0;

    if (!isUpgrade) {
      return {
        payable: targetAmount,
        targetAmount,
        isUpgrade: false,
        remainingDays: 0,
        deduction: 0,
        symbol,
      };
    }

    const remainingDays = Math.max(0, Math.ceil(((exp || now) - now) / msPerDay));
    const currentMonthly = getPlanAmount(currentKey, "monthly", true);
    const deduction = (currentMonthly / 30) * remainingDays;
    const upgradePrice = Math.max(0, targetAmount - deduction);
    const payable = Math.round(upgradePrice * 100) / 100;

    return {
      payable,
      targetAmount,
      isUpgrade: true,
      remainingDays,
      deduction: Math.round(deduction * 100) / 100,
      symbol,
    };
  }, [
    billingPeriod,
    currentPlan,
    currentPlanExp,
    getPlanAmount,
    isDomesticVersion,
    normalizePlanName,
    planRank,
    selectedPlanInDialog,
    useRmb,
    resolvePlanByName,
    msPerDay,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-[#1a1b26] dark:via-[#1f2029] dark:to-[#252836] border-0 max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* 装饰性背景元素 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-gradient-to-br from-emerald-400/20 to-teal-500/20 rounded-full blur-3xl" />
        </div>

        <DialogHeader className="relative z-10">
          <DialogTitle className="flex items-center justify-center space-x-3 text-2xl font-bold">
            <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-lg">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <span className="bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-200 dark:to-white bg-clip-text text-transparent">
              {selectedPaidModel
                ? tr(`Upgrade to Access ${selectedPaidModel.name}`, `升级以解锁 ${selectedPaidModel.name}`)
                : tr("Choose Your MornGPT Plan", "选择你的 MornGPT 套餐")}
            </span>
          </DialogTitle>
          {selectedPaidModel && (
            <DialogDescription className="text-center text-gray-600 dark:text-gray-400 mt-2">
              {tr(
                "This premium model requires a paid subscription. Upgrade now to unlock access and other advanced features.",
                "该高级模型需要付费订阅。升级后即可解锁该模型及其他高级能力。"
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Tab 切换：订阅套餐 / 额度加油包 */}
        <div className="flex items-center justify-center mb-6 relative z-10">
          <div className="bg-white/80 dark:bg-[#2a2b38]/80 backdrop-blur-sm rounded-2xl p-1.5 flex shadow-lg border border-gray-200/50 dark:border-gray-700/50">
            <Button
              variant={activeTab === "subscription" ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setActiveTab("subscription");
                setSelectedPlanInDialog?.(undefined);
              }}
              className={`px-6 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
                activeTab === "subscription"
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50"
              }`}
            >
              <Crown className="w-4 h-4 mr-2" />
              {tr("Subscription Plans", "订阅套餐")}
            </Button>
            <Button
              variant={activeTab === "addon" ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setActiveTab("addon");
                setSelectedPlanInDialog?.(undefined);
              }}
              className={`px-6 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
                activeTab === "addon"
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50"
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
          <div className="relative z-10">
            {selectedPaidModel && (
              <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-2xl border border-blue-200/50 dark:border-blue-700/50 shadow-sm">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                      {selectedPaidModel.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedPaidModel.description}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 月付 / 年付 切换 */}
            <div className="flex items-center justify-center mb-8">
              <div className="bg-white/80 dark:bg-[#2a2b38]/80 backdrop-blur-sm rounded-2xl p-1.5 flex shadow-lg border border-gray-200/50 dark:border-gray-700/50">
                <Button
                  variant={billingPeriod === "monthly" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setBillingPeriod("monthly")}
                  className={`px-6 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
                    billingPeriod === "monthly"
                      ? "bg-gradient-to-r from-gray-800 to-gray-900 dark:from-white dark:to-gray-200 text-white dark:text-gray-900 shadow-lg"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50"
                  }`}
                >
                  {tr("Monthly", "月付")}
                </Button>
                <Button
                  variant={billingPeriod === "annual" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setBillingPeriod("annual")}
                  className={`px-6 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
                    billingPeriod === "annual"
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span>{tr("Annual", "年付")}</span>
                    <Badge className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] px-2 py-0.5 font-bold border-0">
                      -30%
                    </Badge>
                  </div>
                </Button>
              </div>
            </div>

            {/* 套餐卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {localizedPlans.map((plan, index) => {
                const isSelected = selectedPlanInDialog?.name === plan.name;
                const gradient = getPlanGradient(plan.name, isSelected);
                const borderColor = getPlanBorderColor(plan.name, isSelected);
                const iconBg = getPlanIconBg(plan.name);
                
                return (
                  <div
                    key={plan.name}
                    className={`relative group cursor-pointer transition-all duration-500 ${
                      isSelected ? "scale-[1.02]" : "hover:scale-[1.01]"
                    }`}
                    onClick={() => {
                      setSelectedPlanInDialog(plan);
                      handleUpgradeClick(plan);
                    }}
                    style={{
                      animationDelay: `${index * 100}ms`,
                    }}
                  >
                    {/* 发光效果 */}
                    {isSelected && (
                      <div className={`absolute inset-0 bg-gradient-to-r ${gradient} opacity-20 blur-xl rounded-3xl`} />
                    )}
                    
                    <div
                      className={`relative p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col h-full backdrop-blur-sm ${borderColor} ${
                        isSelected
                          ? "bg-white dark:bg-[#2a2b38] shadow-2xl"
                          : "bg-white/70 dark:bg-[#2a2b38]/70 hover:bg-white dark:hover:bg-[#2a2b38] hover:shadow-xl"
                      }`}
                    >
                      {/* 热门标签 */}
                      {plan.popular && (
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                          <Badge className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-4 py-1.5 text-xs font-bold shadow-lg border-0 flex items-center space-x-1">
                            <Sparkles className="w-3 h-3" />
                            <span>{tr("Most Popular", "人气推荐")}</span>
                          </Badge>
                        </div>
                      )}

                      {/* 选中指示器 */}
                      {isSelected && (
                        <div className="absolute top-4 right-4">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${gradient || "from-blue-500 to-blue-600"} flex items-center justify-center shadow-lg`}>
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      )}

                      {/* 套餐图标和名称 */}
                      <div className="text-center mb-6 pt-2">
                        <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl ${iconBg} flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110`}>
                          <div className="text-white">
                            {getPlanIcon(plan.name)}
                          </div>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                      </div>

                      {/* 价格区域 */}
                      <div className="text-center mb-6">
                        <div className="flex items-baseline justify-center space-x-1">
                          <span className="text-4xl font-extrabold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                            {billingPeriod === "annual" ? plan.annualPrice : plan.price}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                            /{billingPeriod === "annual" ? tr("month", "月") : getPeriodLabel(plan.period)}
                          </span>
                        </div>
                        {billingPeriod === "annual" && (
                          <div className="mt-2 flex items-center justify-center space-x-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400 line-through">
                              {plan.price}/mo
                            </span>
                            <Badge className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] px-2 py-0.5 font-bold border-0">
                              {tr("Save 30%", "省30%")}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* 功能列表 */}
                      <ul className="space-y-3 mb-6 flex-grow">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start space-x-3">
                            <div className={`w-5 h-5 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                              <Check className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {/* 选择按钮（视觉提示） */}
                      <div className={`mt-auto pt-4 border-t border-gray-200 dark:border-gray-700`}>
                        <div className={`text-center text-sm font-medium ${
                          isSelected 
                            ? "text-emerald-600 dark:text-emerald-400" 
                            : "text-gray-500 dark:text-gray-400"
                        }`}>
                          {isSelected 
                            ? (isZh ? "✓ 已选择此套餐" : "✓ Selected") 
                            : (isZh ? "点击选择" : "Click to select")}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 支付入口 */}
            {selectedPlanInDialog && (
              <div className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-[#2a2b38] dark:to-[#2d2e3d] rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                  <CreditCard className="w-5 h-5 mr-2 text-blue-500" />
                  {isZh ? "选择支付方式" : "Select Payment Method"}
                </h4>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <button
                    type="button"
                    onClick={() => setSelectedPayment("stripe")}
                    className={`p-4 rounded-xl border-2 text-sm font-semibold transition-all duration-300 flex items-center justify-center space-x-3 ${
                      selectedPayment === "stripe"
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 shadow-lg shadow-violet-500/10"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2a2b38] text-gray-700 dark:text-gray-300 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md"
                    }`}
                  >
                    <span className="text-lg">💳</span>
                    <span>Stripe</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPayment("paypal")}
                    className={`p-4 rounded-xl border-2 text-sm font-semibold transition-all duration-300 flex items-center justify-center space-x-3 ${
                      selectedPayment === "paypal"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-lg shadow-blue-500/10"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2a2b38] text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md"
                    }`}
                  >
                    <span className="text-lg">🅿️</span>
                    <span>PayPal</span>
                  </button>
                </div>

                <Button
                  disabled={isProcessing}
                  onClick={handleSubscribe}
                  className="w-full h-14 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30"
                >
                  {isProcessing ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{tr("Processing...", "处理中...")}</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Rocket className="w-5 h-5" />
                      <span>
                        {pricingInfo.payable !== null
                          ? isZh
                            ? `立即支付 ${pricingInfo.symbol}${pricingInfo.payable.toFixed(2)}`
                            : `Pay ${pricingInfo.symbol}${pricingInfo.payable.toFixed(2)}`
                          : isZh
                            ? "立即支付"
                            : "Pay Now"}
                      </span>
                    </div>
                  )}
                </Button>
                
                {pricingInfo.isUpgrade && (
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2">
                    {isZh
                      ? `🎁 升级优惠：目标价 ${pricingInfo.symbol}${pricingInfo.targetAmount?.toFixed(2) ?? ""} - 剩余${pricingInfo.remainingDays}天抵扣 ${pricingInfo.symbol}${pricingInfo.deduction.toFixed(2)} = ${pricingInfo.symbol}${pricingInfo.payable?.toFixed(2)}`
                      : `🎁 Upgrade discount: ${pricingInfo.symbol}${pricingInfo.targetAmount?.toFixed(2) ?? ""} - ${pricingInfo.remainingDays} days credit ${pricingInfo.symbol}${pricingInfo.deduction.toFixed(2)} = ${pricingInfo.symbol}${pricingInfo.payable?.toFixed(2)}`}
                  </p>
                )}
                
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3 flex items-center justify-center space-x-1">
                  <Shield className="w-3 h-3" />
                  <span>{isZh ? "安全支付，订阅立即生效" : "Secure payment · Instant activation"}</span>
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
