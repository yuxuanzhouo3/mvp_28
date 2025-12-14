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
import { Crown, Check, MessageSquare, Zap, CreditCard } from "lucide-react";
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
}

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
}) => {
  const { currentLanguage, isDomesticVersion } = useLanguage();
  const isZh = currentLanguage === "zh";
  const tr = useCallback((en: string, zh: string) => (isZh ? zh : en), [isZh]);
  const [activeTab, setActiveTab] = useState<UpgradeTabType>(defaultTab);
  const [selectedPayment, setSelectedPayment] = useState<"stripe" | "paypal">("stripe");
  const [isProcessing, setIsProcessing] = useState(false);
  const useRmb = isDomesticVersion;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <Crown className="w-5 h-5 text-blue-500" />
            <span>
              {selectedPaidModel
                ? tr(`Upgrade to Access ${selectedPaidModel.name}`, `升级以解锁 ${selectedPaidModel.name}`)
                : tr("Choose Your MornGPT Plan", "选择你的 MornGPT 套餐")}
            </span>
          </DialogTitle>
          {selectedPaidModel && (
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              {tr(
                "This premium model requires a paid subscription. Upgrade now to unlock access and other advanced features.",
                "该高级模型需要付费订阅。升级后即可解锁该模型及其他高级能力。"
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Tab 切换：订阅套餐 / 额度加油包 */}
        <div className="flex items-center justify-center mb-4">
          <div className="bg-gray-100 dark:bg-[#565869] rounded-lg p-1 flex">
            <Button
              variant={activeTab === "subscription" ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setActiveTab("subscription");
                setSelectedPlanInDialog?.(undefined);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === "subscription"
                  ? "bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-[#ececf1]"
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
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === "addon"
                  ? "bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-[#ececf1]"
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
          <>
            {selectedPaidModel && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-500 rounded flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-[#ececf1]">
                      {selectedPaidModel.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedPaidModel.description}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 月付 / 年付 */}
            <div className="flex items-center justify-center mb-6">
              <div className="bg-gray-100 dark:bg-[#565869] rounded-lg p-1 flex">
                <Button
                  variant={billingPeriod === "monthly" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setBillingPeriod("monthly")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    billingPeriod === "monthly"
                      ? "bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-[#ececf1]"
                  }`}
                >
                  {tr("Monthly", "月付")}
                </Button>
                <Button
                  variant={billingPeriod === "annual" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setBillingPeriod("annual")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    billingPeriod === "annual"
                      ? "bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-[#ececf1]"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span>{tr("Annual", "年付")}</span>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 text-xs px-2 py-0.5">
                      {tr("Save 30%", "立省 30%")}
                    </Badge>
                  </div>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {localizedPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative p-6 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-lg flex flex-col h-full ${
                    selectedPlanInDialog?.name === plan.name
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg"
                      : "border-gray-200 dark:border-[#565869] bg-white dark:bg-[#40414f] hover:border-gray-300 dark:hover:border-[#40414f]"
                  }`}
                  onClick={() => {
                    setSelectedPlanInDialog(plan);
                    handleUpgradeClick(plan);
                  }}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-blue-500 text-white">{tr("Most Popular", "人气套餐")}</Badge>
                    </div>
                  )}
                  {selectedPlanInDialog?.name === plan.name && (
                    <div className="absolute top-3 right-3">
                      <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shadow">
                        <Check className="w-4 h-4" />
                      </div>
                    </div>
                  )}
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-[#ececf1]">{plan.name}</h3>
                    <div className="mt-2">
                      <div className="flex items-baseline justify-center">
                        <span className="text-3xl font-bold text-gray-900 dark:text-[#ececf1]">
                          {billingPeriod === "annual" ? plan.annualPrice : plan.price}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 ml-1">
                          /{billingPeriod === "annual" ? tr("month", "月") : getPeriodLabel(plan.period)}
                        </span>
                      </div>
                      {billingPeriod === "annual" && (
                        <div className="mt-1">
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 text-xs">
                            {tr("Save 30%", "立省 30%")}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  <ul className="space-y-2 mb-6 flex-grow">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-gray-900 dark:text-[#ececf1]">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {/* 卡片即为选择，移除底部按钮，选中样式保持蓝色 */}
                </div>
              ))}
            </div>

            {/* 支付入口：完全对标额度加油包“选择支付方式” */}
            {selectedPlanInDialog && (
              <div className="p-4 bg-gray-50 dark:bg-[#565869] rounded-lg mt-6">
                <h4 className="text-sm font-medium text-gray-900 dark:text-[#ececf1] mb-3">
                  {isZh ? "选择支付方式" : "Select Payment Method"}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedPayment("stripe")}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center space-x-2 ${
                      selectedPayment === "stripe"
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                        : "border-gray-200 dark:border-[#565869] bg-white dark:bg-[#40414f] text-gray-700 dark:text-gray-300 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-xs font-semibold">Card</span>
                    <span>Stripe</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPayment("paypal")}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center space-x-2 ${
                      selectedPayment === "paypal"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                        : "border-gray-200 dark:border-[#565869] bg-white dark:bg-[#40414f] text-gray-700 dark:text-gray-300 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-xs font-semibold">Pay</span>
                    <span>PayPal</span>
                  </button>
                </div>

                <Button
                  disabled={isProcessing}
                  onClick={handleSubscribe}
                  className="w-full mt-4 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white"
                >
                  {isProcessing ? (
                    tr("Processing...", "处理中...")
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      {(() => {
                        const monthly = selectedPlanInDialog.price;
                        const annual = selectedPlanInDialog.annualPrice || monthly;
                        if (billingPeriod === "annual") {
                          const unit = parseFloat(annual.replace(/[^0-9.]/g, "") || "0");
                          const total = (unit * 12).toFixed(2);
                          const symbol = annual.trim().startsWith("￥") ? "￥" : annual.trim().startsWith("$") ? "$" : "";
                          return isZh ? `立即支付 ${symbol}${total}` : `Pay ${symbol}${total}`;
                        }
                        return isZh ? `立即支付 ${monthly}` : `Pay ${monthly}`;
                      })()}
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
                  {isZh ? "购买后订阅立即生效" : "Subscription activates immediately after payment"}
                </p>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
