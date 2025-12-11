import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { CreditCard, MessageSquare, Lock } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface PricingPlan {
  name: string;
  nameZh?: string;
  price: string;
  priceZh?: string;
  annualPrice: string;
  annualPriceZh?: string;
  features: string[];
}

interface PaidModel {
  name: string;
  description: string;
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPaidModel?: PaidModel | null;
  selectedPlan?: PricingPlan | null;
  setSelectedPlan: (plan: PricingPlan | null) => void;
  selectedPaymentMethod: string;
  setSelectedPaymentMethod: (method: string) => void;
  billingPeriod: string;
  pricingPlans: PricingPlan[];
  handlePayment: (e: React.FormEvent) => void;
}

export function PaymentDialog({
  open,
  onOpenChange,
  selectedPaidModel,
  selectedPlan,
  setSelectedPlan,
  selectedPaymentMethod,
  setSelectedPaymentMethod,
  billingPeriod,
  pricingPlans,
  handlePayment,
}: PaymentDialogProps) {
  const { currentLanguage, isDomesticVersion } = useLanguage();
  const isZh = currentLanguage === "zh";
  const useRmb = isDomesticVersion;
  const localizedPlans = React.useMemo(
    () =>
      pricingPlans.map((p) => ({
        ...p,
        name: isZh ? p.nameZh || p.name : p.name,
        price: useRmb && p.priceZh ? p.priceZh : p.price,
        annualPrice: useRmb && p.annualPriceZh ? p.annualPriceZh : p.annualPrice,
      })),
    [pricingPlans, isZh, useRmb],
  );

  const annualMonthlyPrice = selectedPlan
    ? parseFloat(
        (useRmb && selectedPlan.annualPriceZh ? selectedPlan.annualPriceZh : selectedPlan.annualPrice).replace(
          /[^0-9.]/g,
          "",
        ) || "0",
      )
    : 0;
  const annualTotal = (annualMonthlyPrice * 12).toFixed(2);
  const currencySymbol = useRmb ? "￥" : "$";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm-max-w-md sm:max-w-md bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] data-[state=open]:animate-none data-[state=closed]:animate-none transition-none">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <CreditCard className="w-5 h-5" />
            <span>
              {selectedPaidModel
                ? isZh
                  ? `升级以解锁 ${selectedPaidModel.name}`
                  : `Upgrade to Access ${selectedPaidModel.name}`
                : isZh
                ? "完成您的购买"
                : "Complete Your Purchase"}
            </span>
          </DialogTitle>
          {selectedPaidModel && (
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              {isZh
                ? `该高级模型需要付费订阅。升级后即可解锁 ${selectedPaidModel.name} 及其他高级功能。`
                : `This premium model requires a paid subscription. Upgrade now to unlock access to ${selectedPaidModel.name} and other advanced features.`}
            </DialogDescription>
          )}
        </DialogHeader>

        {selectedPaidModel ? (
          <div className="space-y-4">
            {/* Model Info */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-[#ececf1]">
                    {selectedPaidModel.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedPaidModel.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Upgrade Plans */}
            <div className="space-y-2">
              <Label className="text-gray-900 dark:text-[#ececf1] text-sm">
                {isZh ? "选择套餐" : "Choose Your Plan"}
              </Label>
              {localizedPlans.map((plan) => (
                <div
                  key={plan.name}
                  onClick={() => setSelectedPlan(plan)}
                  className={`p-3 rounded-lg cursor-pointer border-2 transition-all ${
                    selectedPlan?.name === plan.name
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-[#565869] hover:border-gray-300"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-[#ececf1]">
                        {isZh ? plan.nameZh || plan.name : plan.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {plan.features[0]}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900 dark:text-[#ececf1]">
                        {billingPeriod === "annual"
                          ? useRmb && plan.annualPriceZh
                            ? plan.annualPriceZh
                            : plan.annualPrice
                          : useRmb && plan.priceZh
                          ? plan.priceZh
                          : plan.price}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {isZh ? "每月" : "per month"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          selectedPlan && (
            <div className="space-y-2">
              {/* Plan Summary */}
              <div className="p-3 bg-gray-50 dark:bg-[#565869] rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-[#ececf1]">
                      {(isZh ? selectedPlan.nameZh || selectedPlan.name : selectedPlan.name) +
                        (isZh ? " 套餐" : " Plan")}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {billingPeriod === "annual"
                        ? isZh
                          ? "按年订阅"
                          : "Annual subscription"
                        : isZh
                        ? "按月订阅"
                        : "Monthly subscription"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900 dark:text-[#ececf1]">
                      {billingPeriod === "annual"
                        ? useRmb && selectedPlan.annualPriceZh
                          ? selectedPlan.annualPriceZh
                          : selectedPlan.annualPrice
                        : useRmb && selectedPlan.priceZh
                        ? selectedPlan.priceZh
                        : selectedPlan.price}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {isZh ? "每月" : "per month"}
                    </div>
                    {billingPeriod === "annual" && (
                      <div className="text-xs text-green-600 dark:text-green-400">
                        {isZh ? "按年计费（立省30%）" : "Billed annually (Save 30%)"}
                        <span className="block text-[11px] text-gray-500 dark:text-gray-300">
                          {isZh ? `总计 ${annualTotal}` : `Total $${annualTotal}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-1">
                <Label className="text-gray-900 dark:text-[#ececf1] text-sm">
                  {isZh ? "支付方式" : "Payment Method"}
                </Label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("credit-card")}
                    className={`p-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                      selectedPaymentMethod === "credit-card"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                        : "border-gray-200 dark:border-[#565869] bg-white dark:bg-[#565869] text-gray-700 dark:text-gray-300 hover:border-gray-300"
                    }`}
                  >
                    💳 Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("paypal")}
                    className={`p-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                      selectedPaymentMethod === "paypal"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                        : "border-gray-200 dark:border-[#565869] bg-white dark:bg-[#565869] text-gray-700 dark:text-gray-300 hover:border-gray-300"
                    }`}
                  >
                    💰 PayPal
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("stripe")}
                    className={`p-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                      selectedPaymentMethod === "stripe"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                        : "border-gray-200 dark:border-[#565869] bg-white dark:bg-[#565869] text-gray-700 dark:text-gray-300 hover:border-gray-300"
                    }`}
                  >
                    💳 Stripe
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("wechat")}
                    className={`p-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                      selectedPaymentMethod === "wechat"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                        : "border-gray-200 dark:border-[#565869] bg-white dark:bg-[#565869] text-gray-700 dark:text-gray-300 hover:border-gray-300"
                    }`}
                  >
                    💬 WeChat
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("alipay")}
                    className={`p-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                      selectedPaymentMethod === "alipay"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                        : "border-gray-200 dark:border-[#565869] bg-white dark:bg-[#565869] text-gray-700 dark:text-gray-300 hover:border-gray-300"
                    }`}
                  >
                    💳 Alipay
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("usdt")}
                    className={`p-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                      selectedPaymentMethod === "usdt"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                        : "border-gray-200 dark:border-[#565869] bg-white dark:bg-[#565869] text-gray-700 dark:text-gray-300 hover:border-gray-300"
                    }`}
                  >
                    ₿ USDT
                  </button>
                </div>
              </div>

              {/* Payment Form */}
              <form onSubmit={handlePayment} className="space-y-2">
                {selectedPaymentMethod === "credit-card" && (
                  <>
                    <div>
                      <Label
                        htmlFor="cardNumber"
                        className="text-gray-900 dark:text-[#ececf1] text-sm"
                      >
                        Card Number
                      </Label>
                      <Input
                        id="cardNumber"
                        type="text"
                        placeholder="1234 5678 9012 3456"
                        className="bg-white dark:bg-[#565869] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label
                          htmlFor="expiry"
                          className="text-gray-900 dark:text-[#ececf1] text-sm"
                        >
                          Expiry Date
                        </Label>
                        <Input
                          id="expiry"
                          type="text"
                          placeholder="MM/YY"
                          className="bg-white dark:bg-[#565869] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
                          required
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="cvc"
                          className="text-gray-900 dark:text-[#ececf1] text-sm"
                        >
                          CVC
                        </Label>
                        <Input
                          id="cvc"
                          type="text"
                          placeholder="123"
                          className="bg-white dark:bg-[#565869] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label
                        htmlFor="billingName"
                        className="text-gray-900 dark:text-[#ececf1] text-sm"
                      >
                        Billing Name
                      </Label>
                      <Input
                        id="billingName"
                        type="text"
                        placeholder="John Doe"
                        className="bg-white dark:bg-[#565869] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
                        required
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="billingAddress"
                        className="text-gray-900 dark:text-[#ececf1] text-sm"
                      >
                        Billing Address
                      </Label>
                      <Input
                        id="billingAddress"
                        type="text"
                        placeholder="123 Main St, City, State 12345"
                        className="bg-white dark:bg-[#565869] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
                        required
                      />
                    </div>
                  </>
                )}

                {selectedPaymentMethod === "paypal" && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {isZh
                        ? "将跳转至 PayPal 完成支付"
                        : "You will be redirected to PayPal to complete your payment"}
                    </p>
                  </div>
                )}

                {selectedPaymentMethod === "stripe" && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      {isZh ? "由 Stripe 提供安全支付" : "Secure payment powered by Stripe"}
                    </p>
                  </div>
                )}

                {selectedPaymentMethod === "wechat" && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {isZh ? "使用微信扫码完成支付" : "Scan QR code with WeChat to pay"}
                    </p>
                  </div>
                )}

                {selectedPaymentMethod === "alipay" && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {isZh ? "使用支付宝扫码完成支付" : "Scan QR code with Alipay to pay"}
                    </p>
                  </div>
                )}

                {selectedPaymentMethod === "usdt" && (
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center">
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      {isZh ? "使用 USDT 支付" : "Pay with USDT (Tether)"}
                    </p>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="terms"
                    required
                    className="rounded"
                  />
                  <Label
                    htmlFor="terms"
                    className="text-xs text-gray-700 dark:text-gray-300"
                  >
                    {isZh ? "我同意服务条款和隐私政策" : "I agree to the Terms of Service and Privacy Policy"}
                  </Label>
                </div>

                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="flex-1 bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
                  >
                    {isZh ? "取消" : "Cancel"}
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isZh ? "支付 " : "Pay "}
                    {billingPeriod === "annual"
                      ? `${currencySymbol}${annualTotal}`
                      : selectedPlan.price}
                  </Button>
                </div>
              </form>

              <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                <Lock className="w-3 h-3 inline mr-1" />
                {isZh ? "您的支付信息已加密并安全传输" : "Your payment information is secure and encrypted"}
              </div>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
