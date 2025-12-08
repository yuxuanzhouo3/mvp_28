export interface PricingPlan {
  name: string;
  nameZh?: string;
  price: string;
  annualPrice: string;
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
    annualPrice: "$6.99",
    period: "month",
    features: [
      "Access to all MornGPT models|访问所有 MornGPT 模型",
      "100 Multi-GPT queries/month|每月 100 次 GPT 交互请求",
      "Basic support|基础支持",
      "Chat history|聊天历史记录",
      "Remove Ads|移除广告",
    ],
  },
  {
    name: "Pro",
    nameZh: "专业版",
    price: "$39.98",
    annualPrice: "$27.99",
    period: "month",
    features: [
      "Everything in Basic|包含基础版的所有内容",
      "Unlimited Multi-GPT usage|无限制多 GPT 使用权限",
      "Priority access to new models|新模型优先访问权",
      "Advanced analytics|高级分析",
      "24/7 priority support|7x24 优先支持",
      "Export conversations|导出对话",
    ],
    popular: true,
  },
  {
    name: "Enterprise",
    nameZh: "企业版",
    price: "$99.98",
    annualPrice: "$69.99",
    period: "month",
    features: [
      "Everything in Pro|包含专业版的所有内容",
      "Custom model training|自定义模型训练",
      "API access|API 访问权限",
      "Team collaboration|团队协作",
      "Advanced security|高级安全",
      "Dedicated support|专属支持",
    ],
  },
];
