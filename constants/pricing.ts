export interface PricingPlan {
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

/**
 * 说明：
 * - 文案保持英文为默认，国内版（zh）在组件中按当前语言切换。
 * - 这里预置中英文双语，便于前端直接选择。
 */
export const pricingPlans: PricingPlan[] = [
  {
    name: "Basic",
    nameZh: "基础版",
    price: "$9.98",
    priceZh: "￥29.90",
    annualPrice: "$6.99", // billed annually, ~30% off
    annualPriceZh: "￥20.90",
    period: "month",
    features: [
      "50 external text chats per day|外部模型文本对话每天50次",
      "Multimodal: 100 images + 20 video/audio per month|多模态模型对话（每月100张图，20个视频/音频）",
      "Chat history|历史聊天记录",
      "Remove ads|移除广告",
      "50-message context window|50条上下文支持",
    ],
  },
  {
    name: "Pro",
    nameZh: "专业版",
    price: "$39.98",
    priceZh: "￥99.90",
    annualPrice: "$27.99",
    annualPriceZh: "￥69.90",
    period: "month",
    features: [
      "Everything in Basic|包含基础版的所有内容",
      "200 external text chats per day|外部模型文本对话每天200次",
      "Multimodal: 500 images + 100 video/audio per month|多模态模型对话（每月500张图，100个视频/音频）",
      "One-click chat export|一键导出对话",
      "100-message context window|100条上下文支持",
    ],
    popular: true,
  },
  {
    name: "Enterprise",
    nameZh: "企业版",
    price: "$99.98",
    priceZh: "￥199.90",
    annualPrice: "$69.99",
    annualPriceZh: "￥139.90",
    period: "month",
    features: [
      "Everything in Pro|包含专业版的所有内容",
      "2000 external text chats per day|外部模型文本对话每天2000次",
      "Multimodal: 1500 images + 200 video/audio per month|多模态模型对话（每月1500张图，200个视频/音频）",
      "Unlimited add-ons of previous packages|可无限加购/续费之前的任意套餐",
      "300-message context window|300条上下文支持",
    ],
  },
];
