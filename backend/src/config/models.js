/**
 * Model Configuration for MornGPT Platform
 * Optimized for China users with fastest available models
 */

const FREE_MODELS = {
  // Groq Models (Fastest - 100 requests/minute) - PRIMARY for China
  groq: {
    name: 'Groq Models',
    type: 'api',
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresAuth: true,
    freeTier: {
      requestsPerMinute: 100,
      rateLimit: '100 requests/minute'
    },
    priority: 1, // Highest priority for speed
    region: 'global',
    latency: 'ultra-fast',
    models: {
      'llama3-8b-8192': {
        id: 'llama3-8b-8192',
        name: 'Llama 3 8B',
        description: 'Ultra-fast Llama 3 model - 最快响应',
        category: 'chat',
        size: '8B',
        free: true,
        maxTokens: 8192,
        temperature: 0.7,
        priority: 1,
        contextWindow: 8192,
        speed: 'ultra-fast'
      },
      'llama3-70b-8192': {
        id: 'llama3-70b-8192',
        name: 'Llama 3 70B',
        description: 'High-performance Llama 3 model - 高质量回答',
        category: 'chat',
        size: '70B',
        free: true,
        maxTokens: 8192,
        temperature: 0.7,
        priority: 2,
        contextWindow: 8192,
        speed: 'fast'
      },
      'mixtral-8x7b-32768': {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        description: 'Powerful mixture of experts model - 专家级回答',
        category: 'chat',
        size: '8x7B',
        free: true,
        maxTokens: 32768,
        temperature: 0.7,
        priority: 3,
        contextWindow: 32768,
        speed: 'fast'
      }
    }
  },

  // Google AI Models (Fast - 15 requests/minute) - SECONDARY
  googleai: {
    name: 'Google AI Models',
    type: 'api',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    requiresAuth: true,
    freeTier: {
      requestsPerMinute: 15,
      rateLimit: '15 requests/minute'
    },
    priority: 2,
    region: 'global',
    latency: 'fast',
    models: {
      'gemini-1.5-flash': {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: 'Fast multimodal processing - 快速多模态',
        category: 'multimodal',
        size: '1.5B',
        free: true,
        maxTokens: 8192,
        temperature: 0.7,
        priority: 1,
        contextWindow: 8192,
        speed: 'fast'
      },
      'gemini-1.5-flash-exp': {
        id: 'gemini-1.5-flash-exp',
        name: 'Gemini 1.5 Flash Experimental',
        description: 'Experimental fast multimodal model - 实验性快速模型',
        category: 'multimodal',
        size: '1.5B',
        free: true,
        maxTokens: 8192,
        temperature: 0.7,
        priority: 2,
        contextWindow: 8192,
        speed: 'fast'
      }
    }
  },

  // Cohere Models (Fast - 1,000 requests/month) - TERTIARY
  cohere: {
    name: 'Cohere Models',
    type: 'api',
    baseUrl: 'https://api.cohere.ai/v1',
    requiresAuth: true,
    freeTier: {
      requestsPerMonth: 1000,
      rateLimit: '5 requests/minute'
    },
    priority: 3,
    region: 'global',
    latency: 'medium',
    models: {
      'command': {
        id: 'command',
        name: 'Cohere Command',
        description: 'Text generation and conversation - 文本生成对话',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 2048,
        temperature: 0.7,
        priority: 1,
        contextWindow: 2048,
        speed: 'medium'
      },
      'command-r': {
        id: 'command-r',
        name: 'Cohere Command-R',
        description: 'Enhanced text generation model - 增强文本生成',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 2048,
        temperature: 0.7,
        priority: 2,
        contextWindow: 2048,
        speed: 'medium'
      },
      'command-light': {
        id: 'command-light',
        name: 'Cohere Command Light',
        description: 'Fast and efficient text generation - 快速高效文本生成',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 1024,
        temperature: 0.7,
        priority: 3,
        contextWindow: 1024,
        speed: 'fast'
      }
    }
  },

  // Hugging Face Models (Free Tier - 30,000 requests/month) - FALLBACK
  huggingface: {
    name: 'Hugging Face Models',
    type: 'api',
    baseUrl: 'https://api-inference.huggingface.co',
    requiresAuth: true,
    freeTier: {
      requestsPerMonth: 30000,
      rateLimit: '5 requests/minute'
    },
    priority: 4, // Lower priority due to slower speed
    region: 'global',
    latency: 'slow',
    models: {
      'microsoft/DialoGPT-large': {
        id: 'microsoft/DialoGPT-large',
        name: 'DialoGPT Large',
        description: 'Advanced conversational AI model - 高级对话AI',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 1024,
        temperature: 0.7,
        priority: 1,
        contextWindow: 1024,
        speed: 'slow'
      },
      'microsoft/DialoGPT-medium': {
        id: 'microsoft/DialoGPT-medium',
        name: 'DialoGPT Medium',
        description: 'Conversational AI model for chat - 对话AI模型',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 1024,
        temperature: 0.7,
        priority: 2,
        contextWindow: 1024,
        speed: 'slow'
      },
      'microsoft/DialoGPT-small': {
        id: 'microsoft/DialoGPT-small',
        name: 'DialoGPT Small',
        description: 'Fast conversational model - 快速对话模型',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 512,
        temperature: 0.7,
        priority: 3,
        contextWindow: 512,
        speed: 'medium'
      }
    }
  }
};

// Model Categories
const MODEL_CATEGORIES = {
  chat: {
    name: 'Chat & Conversation',
    description: 'Models for interactive conversations',
    icon: '💬'
  },
  coding: {
    name: 'Code Generation',
    description: 'Models specialized for programming',
    icon: '💻'
  },
  'text-generation': {
    name: 'Text Generation',
    description: 'Models for creative writing and text generation',
    icon: '✍️'
  },
  summarization: {
    name: 'Summarization',
    description: 'Models for text summarization',
    icon: '📝'
  },
  'image-generation': {
    name: 'Image Generation',
    description: 'Models for creating images from text',
    icon: '🎨'
  },
  multimodal: {
    name: 'Multimodal',
    description: 'Models that can handle text, images, and more',
    icon: '🖼️'
  }
};

// Get all available models
const getAllModels = () => {
  const allModels = [];
  
  Object.values(FREE_MODELS).forEach(provider => {
    Object.values(provider.models).forEach(model => {
      allModels.push({
        ...model,
        provider: provider.name,
        providerType: provider.type,
        baseUrl: provider.baseUrl,
        requiresAuth: provider.requiresAuth || false,
        freeTier: provider.freeTier || null,
        region: provider.region || 'global',
        latency: provider.latency || 'medium'
      });
    });
  });
  
  return allModels;
};

// Get models by category
const getModelsByCategory = (category) => {
  return getAllModels().filter(model => model.category === category);
};

// Get free models only
const getFreeModels = () => {
  return getAllModels().filter(model => model.free === true);
};

// Get fastest models (for China users)
const getFastestModels = () => {
  return getAllModels()
    .filter(model => model.free === true)
    .sort((a, b) => {
      const speedOrder = { 'ultra-fast': 1, 'fast': 2, 'medium': 3, 'slow': 4 };
      return speedOrder[a.speed] - speedOrder[b.speed];
    });
};

// Get models optimized for China
const getChinaOptimizedModels = () => {
  return getAllModels()
    .filter(model => model.free === true)
    .sort((a, b) => {
      // Priority: Groq > Google > Cohere > HuggingFace
      const providerPriority = {
        'Groq Models': 1,
        'Google AI Models': 2,
        'Cohere Models': 3,
        'Hugging Face Models': 4
      };
      return providerPriority[a.provider] - providerPriority[b.provider];
    });
};

// Get API models
const getApiModels = () => {
  const apiModels = [];
  
  Object.values(FREE_MODELS).forEach(provider => {
    if (provider.type === 'api') {
      Object.values(provider.models).forEach(model => {
        apiModels.push({
          ...model,
          provider: provider.name,
          baseUrl: provider.baseUrl,
          requiresAuth: provider.requiresAuth || false,
          freeTier: provider.freeTier || null,
          region: provider.region || 'global',
          latency: provider.latency || 'medium'
        });
      });
    }
  });
  
  return apiModels;
};

module.exports = {
  FREE_MODELS,
  MODEL_CATEGORIES,
  getAllModels,
  getModelsByCategory,
  getFreeModels,
  getFastestModels,
  getChinaOptimizedModels,
  getApiModels
}; 