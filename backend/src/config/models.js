/**
 * Model Configuration for MornGPT Platform
 * REMOTE FREE API MODELS ONLY - Cloud-based free models
 */

const FREE_MODELS = {
  // Hugging Face Models (Free Tier - 30,000 requests/month) - PRIMARY
  huggingface: {
    name: 'Hugging Face Models',
    type: 'api',
    baseUrl: 'https://api-inference.huggingface.co',
    requiresAuth: true,
    freeTier: {
      requestsPerMonth: 30000,
      rateLimit: '5 requests/minute'
    },
    priority: 1, // Highest priority
    models: {
      'microsoft/DialoGPT-large': {
        id: 'microsoft/DialoGPT-large',
        name: 'DialoGPT Large',
        description: 'Advanced conversational AI model',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 1024,
        temperature: 0.7,
        priority: 1
      },
      'microsoft/DialoGPT-medium': {
        id: 'microsoft/DialoGPT-medium',
        name: 'DialoGPT Medium',
        description: 'Conversational AI model for chat',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 1024,
        temperature: 0.7,
        priority: 2
      },
      'microsoft/DialoGPT-small': {
        id: 'microsoft/DialoGPT-small',
        name: 'DialoGPT Small',
        description: 'Fast conversational model',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 512,
        temperature: 0.7,
        priority: 3
      },
      'gpt2': {
        id: 'gpt2',
        name: 'GPT-2',
        description: 'Text generation model',
        category: 'text-generation',
        size: 'N/A',
        free: true,
        maxTokens: 1024,
        temperature: 0.8,
        priority: 4
      },
      'EleutherAI/gpt-neo-125M': {
        id: 'EleutherAI/gpt-neo-125M',
        name: 'GPT-Neo 125M',
        description: 'Lightweight text generation model',
        category: 'text-generation',
        size: 'N/A',
        free: true,
        maxTokens: 512,
        temperature: 0.8,
        priority: 5
      },
      'facebook/bart-large-cnn': {
        id: 'facebook/bart-large-cnn',
        name: 'BART CNN',
        description: 'Text summarization model',
        category: 'summarization',
        size: 'N/A',
        free: true,
        maxTokens: 512,
        temperature: 0.5,
        priority: 6
      }
    }
  },

  // Groq Models (Free Tier - 100 requests/minute) - SECONDARY
  groq: {
    name: 'Groq Models',
    type: 'api',
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresAuth: true,
    freeTier: {
      requestsPerMinute: 100,
      rateLimit: '100 requests/minute'
    },
    priority: 2,
    models: {
      'llama3-8b-8192': {
        id: 'llama3-8b-8192',
        name: 'Llama 3 8B',
        description: 'Ultra-fast Llama 3 model',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 8192,
        temperature: 0.7,
        priority: 1
      },
      'llama3-70b-8192': {
        id: 'llama3-70b-8192',
        name: 'Llama 3 70B',
        description: 'High-performance Llama 3 model',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 8192,
        temperature: 0.7,
        priority: 2
      },
      'mixtral-8x7b-32768': {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        description: 'Powerful mixture of experts model',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 32768,
        temperature: 0.7,
        priority: 3
      }
    }
  },

  // Google AI Models (Free Tier - 15 requests/minute) - TERTIARY
  googleai: {
    name: 'Google AI Models',
    type: 'api',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    requiresAuth: true,
    freeTier: {
      requestsPerMinute: 15,
      rateLimit: '15 requests/minute'
    },
    priority: 3,
    models: {
      'gemini-1.5-flash': {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: 'Fast multimodal processing',
        category: 'multimodal',
        size: 'N/A',
        free: true,
        maxTokens: 8192,
        temperature: 0.7,
        priority: 1
      },
      'gemini-1.5-flash-exp': {
        id: 'gemini-1.5-flash-exp',
        name: 'Gemini 1.5 Flash Experimental',
        description: 'Experimental fast multimodal model',
        category: 'multimodal',
        size: 'N/A',
        free: true,
        maxTokens: 8192,
        temperature: 0.7,
        priority: 2
      }
    }
  },

  // Cohere Models (Free Tier - 1,000 requests/month) - QUATERNARY
  cohere: {
    name: 'Cohere Models',
    type: 'api',
    baseUrl: 'https://api.cohere.ai/v1',
    requiresAuth: true,
    freeTier: {
      requestsPerMonth: 1000,
      rateLimit: '5 requests/minute'
    },
    priority: 4,
    models: {
      'command': {
        id: 'command',
        name: 'Cohere Command',
        description: 'Text generation and conversation',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 2048,
        temperature: 0.7,
        priority: 1
      },
      'command-r': {
        id: 'command-r',
        name: 'Cohere Command-R',
        description: 'Enhanced text generation model',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 2048,
        temperature: 0.7,
        priority: 2
      },
      'command-light': {
        id: 'command-light',
        name: 'Cohere Command Light',
        description: 'Fast and efficient text generation',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 1024,
        temperature: 0.7,
        priority: 3
      }
    }
  },

  // Replicate Models (Free Tier - 500 requests/month) - QUINARY
  replicate: {
    name: 'Replicate Models',
    type: 'api',
    baseUrl: 'https://api.replicate.com/v1',
    requiresAuth: true,
    freeTier: {
      requestsPerMonth: 500,
      rateLimit: '1 request/minute'
    },
    priority: 5,
    models: {
      'meta/llama-2-7b-chat': {
        id: 'meta/llama-2-7b-chat',
        name: 'Llama 2 Chat (7B)',
        description: 'Meta\'s Llama 2 for conversation',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 4096,
        temperature: 0.7,
        priority: 1
      },
      'meta/llama-2-13b-chat': {
        id: 'meta/llama-2-13b-chat',
        name: 'Llama 2 Chat (13B)',
        description: 'Larger Llama 2 model for better responses',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 4096,
        temperature: 0.7,
        priority: 2
      },
      'mistralai/mistral-7b-instruct': {
        id: 'mistralai/mistral-7b-instruct',
        name: 'Mistral 7B Instruct',
        description: 'Instruction-tuned Mistral model',
        category: 'chat',
        size: 'N/A',
        free: true,
        maxTokens: 4096,
        temperature: 0.7,
        priority: 3
      },
      'stability-ai/stable-diffusion': {
        id: 'stability-ai/stable-diffusion',
        name: 'Stable Diffusion',
        description: 'Text-to-image generation',
        category: 'image-generation',
        size: 'N/A',
        free: true,
        maxTokens: 77,
        temperature: 0.8,
        priority: 4
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
        freeTier: provider.freeTier || null
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

// Get local models (Ollama)
const getLocalModels = () => {
  return FREE_MODELS.ollama.models;
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
          freeTier: provider.freeTier || null
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
  getLocalModels,
  getApiModels
}; 