export interface PricingPlan {
  name: string;
  price: string;
  annualPrice: string;
  period: string;
  features: string[];
  popular?: boolean;
}

export const pricingPlans: PricingPlan[] = [
  {
    name: "Basic",
    price: "$9.98",
    annualPrice: "$6.99",
    period: "month",
    features: [
      "Access to all MornGPT models",
      "100 Multi-GPT queries/month",
      "Basic support",
      "Chat history",
      "Remove Ads",
    ],
  },
  {
    name: "Pro",
    price: "$39.98",
    annualPrice: "$27.99",
    period: "month",
    features: [
      "Everything in Basic",
      "Unlimited Multi-GPT usage",
      "Priority access to new models",
      "Advanced analytics",
      "24/7 priority support",
      "Export conversations",
    ],
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$99.98",
    annualPrice: "$69.99",
    period: "month",
    features: [
      "Everything in Pro",
      "Custom model training",
      "API access",
      "Team collaboration",
      "Advanced security",
      "Dedicated support",
    ],
  },
];
