// Configuration based on environment variables

// Normalize and clamp default language to 'zh' or 'en'
const envDefaultLang = (process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE || "zh").toLowerCase();
export const DEFAULT_LANGUAGE: string = envDefaultLang === "en" ? "en" : "zh";

// Deployment edition is decided by env, not by user toggle
export const IS_DOMESTIC_VERSION = DEFAULT_LANGUAGE === "zh";

// Model configurations for different versions
export const MODEL_CONFIG = {
  // Domestic version models (Chinese)
  domestic: {
    defaultModel: 'qwen3-omni-flash', // 优先多模态，保证图片/视频可用
    availableModels: [
      'qwen3-omni-flash',
      'qwen3-max',
      'qwen-plus',
      'qwen-turbo',
      'qwen-flash',
      'qwen3-coder-plus',
      'qwen3-coder-flash',
      'deepseek-r1',
      'deepseek-v3',
      'deepseek-v3.1',
      'deepseek-v3.2-exp',
      'Moonshot-Kimi-K2-Instruct',
      'glm-4.6',
    ],
    apiBaseUrl: process.env.DOMESTIC_API_BASE_URL || '/api/domestic',
  },
  // International version models (English)
  international: {
    defaultModel: 'codestral-latest',
    availableModels: [
      'codestral-latest',
      'codestral-2412',
      'mistral-small-latest',
      'mistral-medium-latest',
    ],
    apiBaseUrl: process.env.INTERNATIONAL_API_BASE_URL || '/api/international',
  },
};

// Get current model configuration based on version
export const getCurrentModelConfig = () => {
  return IS_DOMESTIC_VERSION ? MODEL_CONFIG.domestic : MODEL_CONFIG.international;
};

// Get localized text based on current language
export const getLocalizedText = (key: string, lang?: string) => {
  const currentLang = lang || DEFAULT_LANGUAGE;
  
  // Simple localization mapping (expand as needed)
  const translations: Record<string, Record<string, string>> = {
    'app.title': {
      zh: 'MornGPT - 智能AI助手',
      en: 'MornGPT - Intelligent AI Assistant',
    },
    'app.description': {
      zh: '一站式AI解决方案，为您提供智能对话、内容生成和专业咨询服务。',
      en: 'One-stop AI solution providing intelligent conversation, content generation, and professional consulting services.',
    },
    'nav.home': {
      zh: '首页',
      en: 'Home',
    },
    'nav.models': {
      zh: '模型',
      en: 'Models',
    },
    'nav.pricing': {
      zh: '定价',
      en: 'Pricing',
    },
    'nav.contact': {
      zh: '联系我们',
      en: 'Contact',
    },
  };
  
  return translations[key]?.[currentLang] || key;
};
