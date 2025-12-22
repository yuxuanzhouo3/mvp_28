import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { CreditCard, Crown, Edit3, Receipt, RefreshCw } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface BillingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appUser: any;
  currentPlan: string | null;
  autoRenewEnabled: boolean;
  setAutoRenewEnabled: (enabled: boolean) => void;
  nextBillingDate: string;
  setNextBillingDate: (date: string) => void;
  showUpgradeDialog: boolean;
  setShowUpgradeDialog: (show: boolean) => void;
  showPaymentEditDialog: boolean;
  setShowPaymentEditDialog: (show: boolean) => void;
  paymentMethod: { type: string; last4: string; brand: string; expiry: string };
  setPaymentMethod: React.Dispatch<React.SetStateAction<{ type: string; last4: string; brand: string; expiry: string }>>;
}

export function BillingDialog({
  open,
  onOpenChange,
  appUser,
  currentPlan,
  autoRenewEnabled,
  setAutoRenewEnabled,
  nextBillingDate,
  setNextBillingDate,
  showUpgradeDialog,
  setShowUpgradeDialog,
  showPaymentEditDialog,
  setShowPaymentEditDialog,
  paymentMethod,
  setPaymentMethod,
}: BillingDialogProps) {
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";
  const tr = (en: string, zh: string) => (isZh ? zh : en);
  return (
    <>
      {/* Billing Management Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] rounded-2xl sm:rounded-3xl data-[state=open]:animate-none data-[state=closed]:animate-none transition-none">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
              <CreditCard className="w-5 h-5" />
              <span>{tr("Billing Management", "账单与订阅管理")}</span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-6 p-1">
              {/* Upgrade Plan Section */}
              <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                      <Crown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-[#ececf1]">
                        {appUser?.isPro
                          ? tr("Upgrade Your Plan", "升级您的套餐")
                          : tr("Upgrade", "升级")}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {appUser?.isPro
                          ? tr("Explore higher tier plans", "探索更高等级套餐")
                          : tr("Unlock premium features and remove ads", "解锁高级功能并移除广告")}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      setShowUpgradeDialog(true);
                    }}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    {appUser?.isPro
                      ? tr("Upgrade Plan", "升级套餐")
                      : tr("Upgrade", "升级")}
                  </Button>
                </div>
              </div>

              {/* Payment Method */}
              <div className="p-3 bg-gray-50 dark:bg-[#40414f] rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-[#ececf1]">
                        {tr("Payment Method", "支付方式")}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {tr("Manage your payment information", "管理您的支付信息")}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (appUser?.isPro) {
                        setShowPaymentEditDialog(true);
                      } else {
                        // For free users, redirect to upgrade
                        onOpenChange(false);
                        setShowUpgradeDialog(true);
                      }
                    }}
                    className="text-gray-600 dark:text-gray-400"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    {tr("Edit", "编辑")}
                  </Button>
                </div>

                {appUser?.isPro ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 p-2 bg-white dark:bg-[#565869] rounded border">
                      <div className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center">
                        <CreditCard className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
                          {tr("Visa ending in 4242", "Visa 尾号 4242")}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {tr("Expires 12/25", "到期 12/25")}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {tr("Default", "默认")}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <div className="flex items-center space-x-2">
                      <CreditCard className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                      <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        {isZh ? "尚未添加支付方式" : "No payment method added"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Billing Information */}
              {appUser?.isPro && (
                <div className="p-3 bg-gray-50 dark:bg-[#40414f] rounded-lg">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
                      <Receipt className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-[#ececf1]">
                        {isZh ? "账单信息" : "Billing Information"}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {isZh ? "查看账单详情与历史" : "Your billing details and history"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {isZh ? "当前套餐：" : "Current Plan:"}
                      </span>
                      <span className="text-gray-900 dark:text-[#ececf1] font-medium">
                        {currentPlan || "Pro"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {isZh ? "下次扣款日期：" : "Next billing date:"}
                      </span>
                      <span className="text-gray-900 dark:text-[#ececf1]">
                        March 15, 2025
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {isZh ? "金额：" : "Amount:"}
                      </span>
                      <span className="text-gray-900 dark:text-[#ececf1]">
                        {currentPlan === "Basic"
                          ? "$6.99"
                          : currentPlan === "Pro"
                          ? "$27.99"
                          : currentPlan === "Enterprise"
                          ? "$69.99"
                          : "$27.99"}
                        /month
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {isZh ? "计费周期：" : "Billing Cycle:"}
                      </span>
                      <span className="text-gray-900 dark:text-[#ececf1]">
                        Annual (Save 30%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {isZh ? "状态：" : "Status:"}
                      </span>
                      <Badge variant="default" className="text-xs">
                        {isZh ? "有效" : "Active"}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Auto Renew Option - Moved to bottom */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#40414f] rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-[#ececf1]">
                      {isZh ? "自动续订" : "Auto Renew"}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isZh ? "自动续订你的订阅" : "Automatically renew your subscription"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={appUser?.isPro ? autoRenewEnabled : false}
                  onCheckedChange={(checked) => {
                    if (checked && !appUser?.isPro) {
                      onOpenChange(false);
                      setShowUpgradeDialog(true);
                    } else if (appUser?.isPro) {
                      setAutoRenewEnabled(checked);
                      if (checked) {
                        // Calculate next billing date (30 days from now)
                        const nextDate = new Date();
                        nextDate.setDate(nextDate.getDate() + 30);
                        setNextBillingDate(
                          nextDate.toISOString().split("T")[0]
                        );
                      }
                    }
                  }}
                />
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Payment Method Edit Dialog */}
      <Dialog
        open={showPaymentEditDialog}
        onOpenChange={setShowPaymentEditDialog}
      >
        <DialogContent className="sm:max-w-md bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
              <CreditCard className="w-5 h-5" />
              <span>{isZh ? "编辑支付方式" : "Edit Payment Method"}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Payment Method Options */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center space-x-2 p-2 border border-gray-200 dark:border-[#565869] rounded-lg">
                <input
                  type="radio"
                  id="card"
                  name="paymentMethod"
                  value="card"
                  checked={paymentMethod.type === "card"}
                  onChange={(e) =>
                    setPaymentMethod({
                      type: e.target.value,
                      last4: paymentMethod.last4 || "",
                      brand: paymentMethod.brand || "",
                      expiry: paymentMethod.expiry || "",
                    })
                  }
                  className="w-3 h-3 text-blue-600"
                />
                <CreditCard className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <label
                  htmlFor="card"
                  className="text-xs text-gray-900 dark:text-[#ececf1]"
                >
                  {isZh ? "银行卡" : "Card"}
                </label>
              </div>

              <div className="flex items-center space-x-2 p-2 border border-gray-200 dark:border-[#565869] rounded-lg">
                <input
                  type="radio"
                  id="paypal"
                  name="paymentMethod"
                  value="paypal"
                  checked={paymentMethod.type === "paypal"}
                  onChange={(e) =>
                    setPaymentMethod({
                      type: e.target.value,
                      last4: paymentMethod.last4 || "",
                      brand: paymentMethod.brand || "",
                      expiry: paymentMethod.expiry || "",
                    })
                  }
                  className="w-3 h-3 text-blue-600"
                />
                <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-bold">
                  P
                </div>
                <label
                  htmlFor="paypal"
                  className="text-xs text-gray-900 dark:text-[#ececf1]"
                >
                  {isZh ? "PayPal" : "PayPal"}
                </label>
              </div>

              <div className="flex items-center space-x-2 p-2 border border-gray-200 dark:border-[#565869] rounded-lg">
                <input
                  type="radio"
                  id="wechat"
                  name="paymentMethod"
                  value="wechat"
                  checked={paymentMethod.type === "wechat"}
                  onChange={(e) =>
                    setPaymentMethod({
                      type: e.target.value,
                      last4: paymentMethod.last4 || "",
                      brand: paymentMethod.brand || "",
                      expiry: paymentMethod.expiry || "",
                    })
                  }
                  className="w-3 h-3 text-blue-600"
                />
                <div className="w-4 h-4 bg-green-500 rounded flex items-center justify-center text-white text-xs font-bold">
                  W
                </div>
                <label
                  htmlFor="wechat"
                  className="text-xs text-gray-900 dark:text-[#ececf1]"
                >
                  {isZh ? "微信" : "WeChat"}
                </label>
              </div>

              <div className="flex items-center space-x-2 p-2 border border-gray-200 dark:border-[#565869] rounded-lg">
                <input
                  type="radio"
                  id="alipay"
                  name="paymentMethod"
                  value="alipay"
                  checked={paymentMethod.type === "alipay"}
                  onChange={(e) =>
                    setPaymentMethod({
                      type: e.target.value,
                      last4: paymentMethod.last4 || "",
                      brand: paymentMethod.brand || "",
                      expiry: paymentMethod.expiry || "",
                    })
                  }
                  className="w-3 h-3 text-blue-600"
                />
                <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-bold">
                  A
                </div>
                <label
                  htmlFor="alipay"
                  className="text-xs text-gray-900 dark:text-[#ececf1]"
                >
                  {isZh ? "支付宝" : "Alipay"}
                </label>
              </div>

              <div className="flex items-center space-x-2 p-2 border border-gray-200 dark:border-[#565869] rounded-lg">
                <input
                  type="radio"
                  id="stripe"
                  name="paymentMethod"
                  value="stripe"
                  checked={paymentMethod.type === "stripe"}
                  onChange={(e) =>
                    setPaymentMethod({
                      type: e.target.value,
                      last4: paymentMethod.last4 || "",
                      brand: paymentMethod.brand || "",
                      expiry: paymentMethod.expiry || "",
                    })
                  }
                  className="w-3 h-3 text-blue-600"
                />
                <div className="w-4 h-4 bg-purple-500 rounded flex items-center justify-center text-white text-xs font-bold">
                  S
                </div>
                <label
                  htmlFor="stripe"
                  className="text-xs text-gray-900 dark:text-[#ececf1]"
                >
                  {isZh ? "Stripe" : "Stripe"}
                </label>
              </div>

              <div className="flex items-center space-x-2 p-2 border border-gray-200 dark:border-[#565869] rounded-lg">
                <input
                  type="radio"
                  id="usdt"
                  name="paymentMethod"
                  value="usdt"
                  checked={paymentMethod.type === "usdt"}
                  onChange={(e) =>
                    setPaymentMethod({
                      ...paymentMethod,
                      type: e.target.value,
                    })
                  }
                  className="w-3 h-3 text-blue-600"
                />
                <div className="w-4 h-4 bg-orange-500 rounded flex items-center justify-center text-white text-xs font-bold">
                  ₿
                </div>
                <label
                  htmlFor="usdt"
                  className="text-xs text-gray-900 dark:text-[#ececf1]"
                >
                  USDT
                </label>
              </div>
            </div>

            {/* Card Details (if card is selected) */}
            {paymentMethod.type === "card" && (
              <div className="space-y-3">
                <div>
                  <Label
                    htmlFor="cardNumber"
                    className="text-gray-700 dark:text-gray-300"
                  >
                    {isZh ? "卡号" : "Card Number"}
                  </Label>
                  <Input
                    id="cardNumber"
                    placeholder="1234 5678 9012 3456"
                    className="bg-white dark:bg-[#40414f] border-gray-300 dark:border-[#565869]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                  <Label
                    htmlFor="expiry"
                    className="text-gray-700 dark:text-gray-300"
                  >
                    {isZh ? "到期日期" : "Expiry Date"}
                  </Label>
                    <Input
                      id="expiry"
                      placeholder="MM/YY"
                      className="bg-white dark:bg-[#40414f] border-gray-300 dark:border-[#565869]"
                    />
                  </div>
                  <div>
                  <Label
                    htmlFor="cvv"
                    className="text-gray-700 dark:text-gray-300"
                  >
                    CVV
                  </Label>
                    <Input
                      id="cvv"
                      placeholder="123"
                      className="bg-white dark:bg-[#40414f] border-gray-300 dark:border-[#565869]"
                    />
                  </div>
                </div>
                <div>
                  <Label
                    htmlFor="billingAddress"
                    className="text-gray-700 dark:text-gray-300"
                  >
                    {isZh ? "账单地址" : "Billing Address"}
                  </Label>
                  <Input
                    id="billingAddress"
                    placeholder="123 Main St, City, State 12345"
                    className="bg-white dark:bg-[#40414f] border-gray-300 dark:border-[#565869]"
                  />
                </div>
              </div>
            )}

            {/* PayPal/WeChat/Alipay specific fields */}
            {(paymentMethod.type === "paypal" ||
              paymentMethod.type === "wechat" ||
              paymentMethod.type === "alipay") && (
              <div>
                <Label
                  htmlFor="email"
                  className="text-gray-700 dark:text-gray-300"
                >
                  {paymentMethod.type === "paypal"
                    ? isZh ? "PayPal 邮箱" : "PayPal Email"
                    : paymentMethod.type === "wechat"
                    ? isZh ? "微信账号" : "WeChat Account"
                    : isZh ? "支付宝账号" : "Alipay Account"}
                </Label>
                <Input
                  id="email"
                  placeholder={
                    paymentMethod.type === "paypal"
                      ? isZh ? "你的邮箱" : "your@email.com"
                      : paymentMethod.type === "wechat"
                      ? isZh ? "微信号" : "WeChat ID"
                      : isZh ? "支付宝ID" : "Alipay ID"
                  }
                  className="bg-white dark:bg-[#40414f] border-gray-300 dark:border-[#565869]"
                />
              </div>
            )}

            {/* Stripe specific fields */}
            {paymentMethod.type === "stripe" && (
              <div className="space-y-3">
                <div>
                  <Label
                    htmlFor="stripeEmail"
                    className="text-gray-700 dark:text-gray-300"
                  >
                    {isZh ? "邮箱地址" : "Email Address"}
                  </Label>
                  <Input
                    id="stripeEmail"
                    placeholder="your@email.com"
                    className="bg-white dark:bg-[#40414f] border-gray-300 dark:border-[#565869]"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="stripeAccount"
                    className="text-gray-700 dark:text-gray-300"
                  >
                    {isZh ? "Stripe 账户 ID" : "Stripe Account ID"}
                  </Label>
                  <Input
                    id="stripeAccount"
                    placeholder="acct_1234567890"
                    className="bg-white dark:bg-[#40414f] border-gray-300 dark:border-[#565869]"
                  />
                </div>
              </div>
            )}

            {/* USDT specific fields */}
            {paymentMethod.type === "usdt" && (
              <div className="space-y-3">
                <div>
                  <Label
                    htmlFor="usdtAddress"
                    className="text-gray-700 dark:text-gray-300"
                  >
                    {isZh ? "USDT 钱包地址" : "USDT Wallet Address"}
                  </Label>
                  <Input
                    id="usdtAddress"
                    placeholder={isZh ? "TRC20 或 ERC20 地址" : "TRC20 or ERC20 address"}
                    className="bg-white dark:bg-[#40414f] border-gray-300 dark:border-[#565869]"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="usdtNetwork"
                    className="text-gray-700 dark:text-gray-300"
                  >
                    {isZh ? "网络" : "Network"}
                  </Label>
                  <Select defaultValue="trc20">
                    <SelectTrigger className="w-full bg-white dark:bg-[#40414f] border-gray-300 dark:border-[#565869]">
                      <span>TRC20</span>
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
                      <SelectItem
                        value="trc20"
                        className="text-gray-900 dark:text-[#ececf1]"
                      >
                        TRC20
                      </SelectItem>
                      <SelectItem
                        value="erc20"
                        className="text-gray-900 dark:text-[#ececf1]"
                      >
                        ERC20
                      </SelectItem>
                      <SelectItem
                        value="bep20"
                        className="text-gray-900 dark:text-[#ececf1]"
                      >
                        BEP20
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowPaymentEditDialog(false)}
              className="border-gray-300 dark:border-[#565869]"
            >
              {isZh ? "取消" : "Cancel"}
            </Button>
            <Button
              onClick={() => {
                // Here you would save the payment method
                console.log("Payment method updated:", paymentMethod);
                setShowPaymentEditDialog(false);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isZh ? "保存更改" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
