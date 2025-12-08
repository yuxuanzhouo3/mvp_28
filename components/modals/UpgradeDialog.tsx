import React, { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Check, CreditCard, MessageSquare } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { pricingPlans as pricingPlansRaw } from "@/constants/pricing";

interface PricingPlan {
  name: string;
  price: string;
  annualPrice: string;
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
  handleUpgradeClick: (plan: PricingPlan) => void;
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
  handleUpgradeClick,
}) => {
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";
  const tr = useCallback((en: string, zh: string) => (isZh ? zh : en), [isZh]);

  const periodLabel = (planPeriod: string) => {
    if (!isZh) return planPeriod;
    if (planPeriod === "month" || planPeriod === "monthly") return "月";
    if (planPeriod === "year" || planPeriod === "annual") return "年";
    return planPeriod;
  };

  // 本地化 features 文案（支持 “英文|中文” 形式）
  const basePlans = pricingPlans || pricingPlansRaw;
  const localizedPlans = basePlans.map((p) => ({
    ...p,
    name: isZh ? p.nameZh || p.name : p.name,
    features: p.features.map((f) => {
      if (!f.includes("|")) return f;
      const [en, zh] = f.split("|");
      return isZh ? zh || en : en;
    }),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <Crown className="w-5 h-5 text-blue-500" />
            <span>
              {selectedPaidModel
                ? tr(
                    `Upgrade to Access ${selectedPaidModel.name}`,
                    `升级以解锁 ${selectedPaidModel.name}`
                  )
                : tr("Choose Your MornGPT Plan", "选择你的 MornGPT 套餐")}
            </span>
          </DialogTitle>
          {selectedPaidModel && (
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              {tr(
                `This premium model requires a paid subscription. Upgrade now to unlock access to ${selectedPaidModel.name} and other advanced features.`,
                `该高级模型需要付费订阅。立即升级即可解锁 ${selectedPaidModel.name} 及其它高级功能。`
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Model Info Section */}
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
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedPaidModel.description}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Billing Period Toggle */}
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

        <div className="grid grid-cols-3 gap-6">
          {localizedPlans.map((plan) => (
            <div
              key={plan.name}
              className={`relative p-6 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-lg flex flex-col h-full ${
                selectedPlanInDialog?.name === plan.name
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg"
                  : "border-gray-200 dark:border-[#565869] bg-white dark:bg-[#40414f] hover:border-gray-300 dark:hover:border-[#40414f]"
              }`}
              onClick={() => setSelectedPlanInDialog(plan)}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-500 text-white">
                    {tr("Most Popular", "人气套餐")}
                  </Badge>
                </div>
              )}
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-[#ececf1]">
                  {plan.name}
                </h3>
                <div className="mt-2">
                  <div className="flex items-baseline justify-center">
                    <span className="text-3xl font-bold text-gray-900 dark:text-[#ececf1]">
                      {billingPeriod === "annual"
                        ? plan.annualPrice
                        : plan.price}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 ml-1">
                      /
                      {billingPeriod === "annual"
                        ? tr("month", "月")
                        : periodLabel(plan.period)}
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
                    <span className="text-sm text-gray-900 dark:text-[#ececf1]">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleUpgradeClick(plan)}
                className={`w-full mt-auto ${
                  selectedPlanInDialog?.name === plan.name
                    ? "bg-blue-500 hover:bg-blue-600 text-white"
                    : "bg-gray-800 hover:bg-gray-900 dark:bg-gray-200 dark:text-gray-800 dark:hover:bg-gray-300 text-white"
                }`}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {selectedPlanInDialog?.name === plan.name
                  ? tr("Selected", "已选择")
                  : tr(`Choose ${plan.name}`, `选择 ${plan.name}`)}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
