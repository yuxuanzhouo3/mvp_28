/**
 * Enterprise Models Configuration
 * Defines available models and user tiers for the platform
 */

// Available models for different tiers
const ENTERPRISE_MODELS = {
  // Free tier models
  'llama3.1-8b': {
    id: 'llama3.1-8b',
    name: 'Llama 3.1 8B',
    provider: 'Meta',
    description: 'Open source and customizable',
    category: 'general',
    temperature: 0.7,
    maxTokens: 2048,
    concurrentLimit: 10,
    avgResponseTime: 1500,
    costPerRequest: 0,
    enterpriseFeatures: ['text-generation', 'conversation'],
    availableTiers: ['free', 'basic', 'premium', 'enterprise']
  },
  'mistral-7b': {
    id: 'mistral-7b',
    name: 'Mistral 7B',
    provider: 'Mistral AI',
    description: 'Efficient European model',
    category: 'general',
    temperature: 0.7,
    maxTokens: 2048,
    concurrentLimit: 10,
    avgResponseTime: 1200,
    costPerRequest: 0,
    enterpriseFeatures: ['text-generation', 'conversation'],
    availableTiers: ['free', 'basic', 'premium', 'enterprise']
  },
  'phi3-3.8b': {
    id: 'phi3-3.8b',
    name: 'Phi-3 Mini',
    provider: 'Microsoft',
    description: 'Compact but powerful',
    category: 'general',
    temperature: 0.7,
    maxTokens: 2048,
    concurrentLimit: 10,
    avgResponseTime: 1000,
    costPerRequest: 0,
    enterpriseFeatures: ['text-generation', 'conversation'],
    availableTiers: ['free', 'basic', 'premium', 'enterprise']
  },
  'codellama-7b': {
    id: 'codellama-7b',
    name: 'CodeLlama',
    provider: 'Meta',
    description: 'Specialized for coding tasks',
    category: 'coding',
    temperature: 0.7,
    maxTokens: 2048,
    concurrentLimit: 10,
    avgResponseTime: 1800,
    costPerRequest: 0,
    enterpriseFeatures: ['code-generation', 'code-analysis', 'debugging'],
    availableTiers: ['free', 'basic', 'premium', 'enterprise']
  },
  // New free API models
  'gpt4all-j': {
    id: 'gpt4all-j',
    name: 'GPT4All-J',
    provider: 'GPT4All',
    description: 'Free local AI model',
    category: 'general',
    temperature: 0.7,
    maxTokens: 2048,
    concurrentLimit: 10,
    avgResponseTime: 800,
    costPerRequest: 0,
    enterpriseFeatures: ['text-generation', 'local-processing'],
    availableTiers: ['free', 'basic', 'premium', 'enterprise']
  },
  'dialo-gpt': {
    id: 'dialo-gpt',
    name: 'DialoGPT',
    provider: 'HuggingFace',
    description: 'Conversational AI model',
    category: 'conversation',
    temperature: 0.7,
    maxTokens: 2048,
    concurrentLimit: 10,
    avgResponseTime: 1200,
    costPerRequest: 0,
    enterpriseFeatures: ['conversation', 'dialogue-generation'],
    availableTiers: ['free', 'basic', 'premium', 'enterprise']
  },
  'gpt2': {
    id: 'gpt2',
    name: 'GPT-2',
    provider: 'HuggingFace',
    description: 'Open source language model',
    category: 'general',
    temperature: 0.7,
    maxTokens: 2048,
    concurrentLimit: 10,
    avgResponseTime: 1000,
    costPerRequest: 0,
    enterpriseFeatures: ['text-generation', 'open-source'],
    availableTiers: ['free', 'basic', 'premium', 'enterprise']
  },
  'bart-cnn': {
    id: 'bart-cnn',
    name: 'BART CNN',
    provider: 'HuggingFace',
    description: 'Text summarization model',
    category: 'summarization',
    temperature: 0.7,
    maxTokens: 2048,
    concurrentLimit: 10,
    avgResponseTime: 1500,
    costPerRequest: 0,
    enterpriseFeatures: ['summarization', 'text-analysis'],
    availableTiers: ['free', 'basic', 'premium', 'enterprise']
  },
  'cohere-command': {
    id: 'cohere-command',
    name: 'Cohere Command',
    provider: 'Cohere',
    description: 'Free text generation model',
    category: 'general',
    temperature: 0.7,
    maxTokens: 2048,
    concurrentLimit: 10,
    avgResponseTime: 1100,
    costPerRequest: 0,
    enterpriseFeatures: ['text-generation', 'free-tier'],
    availableTiers: ['free', 'basic', 'premium', 'enterprise']
  },
  'replicate-llama': {
    id: 'replicate-llama',
    name: 'Replicate Llama',
    provider: 'Replicate',
    description: 'Cloud-hosted Llama model',
    category: 'general',
    temperature: 0.7,
    maxTokens: 2048,
    concurrentLimit: 10,
    avgResponseTime: 2000,
    costPerRequest: 0,
    enterpriseFeatures: ['text-generation', 'cloud-hosted'],
    availableTiers: ['free', 'basic', 'premium', 'enterprise']
  },
  'openai-gpt-5-free': {
    id: 'openai-gpt-5-free',
    name: 'OpenAI GPT-5 免费层',
    provider: 'OpenAI',
    description: 'OpenAI 付费模型（平台内“免费层”指受限访问；需要 OPENAI_API_KEY）',
    category: 'general',
    temperature: 0.7,
    maxTokens: 4096,
    concurrentLimit: 20,
    avgResponseTime: 800,
    costPerRequest: 0.002,
    enterpriseFeatures: ['text-generation', 'conversation', 'multimodal'],
    availableTiers: ['basic', 'premium', 'enterprise']
  },

  // OpenAI
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    description: 'Fast and efficient for most tasks',
    category: 'general',
    temperature: 0.7,
    maxTokens: 4096,
    concurrentLimit: 50,
    avgResponseTime: 600,
    costPerRequest: 0.001,
    enterpriseFeatures: ['text-generation', 'conversation'],
    availableTiers: ['basic', 'premium', 'enterprise']
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    description: 'Latest multimodal model',
    category: 'general',
    temperature: 0.7,
    maxTokens: 4096,
    concurrentLimit: 50,
    avgResponseTime: 700,
    costPerRequest: 0.005,
    enterpriseFeatures: ['text-generation', 'multimodal'],
    availableTiers: ['basic', 'premium', 'enterprise']
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    description: 'Affordable GPT-4 level performance',
    category: 'general',
    temperature: 0.7,
    maxTokens: 4096,
    concurrentLimit: 50,
    avgResponseTime: 650,
    costPerRequest: 0.001,
    enterpriseFeatures: ['text-generation', 'conversation'],
    availableTiers: ['basic', 'premium', 'enterprise']
  },
  'gpt-4-turbo-128k': {
    id: 'gpt-4-turbo-128k',
    name: 'GPT-4 Turbo 128K',
    provider: 'OpenAI',
    description: 'Extended context window',
    category: 'general',
    temperature: 0.7,
    maxTokens: 8192,
    concurrentLimit: 20,
    avgResponseTime: 800,
    costPerRequest: 0.01,
    enterpriseFeatures: ['text-generation', 'long-context'],
    availableTiers: ['premium', 'enterprise']
  },

  // Anthropic
  'claude-3-haiku': {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    description: 'Quick responses with good reasoning',
    category: 'general',
    temperature: 0.7,
    maxTokens: 4096,
    concurrentLimit: 50,
    avgResponseTime: 700,
    costPerRequest: 0.0015,
    enterpriseFeatures: ['text-generation', 'conversation'],
    availableTiers: ['basic', 'premium', 'enterprise']
  },
  'claude-3-5-sonnet': {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description: 'Best reasoning and analysis',
    category: 'general',
    temperature: 0.7,
    maxTokens: 4096,
    concurrentLimit: 30,
    avgResponseTime: 800,
    costPerRequest: 0.003,
    enterpriseFeatures: ['text-generation', 'reasoning'],
    availableTiers: ['premium', 'enterprise']
  },
  'claude-3-opus': {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    description: 'Highest quality responses',
    category: 'general',
    temperature: 0.7,
    maxTokens: 4096,
    concurrentLimit: 20,
    avgResponseTime: 900,
    costPerRequest: 0.01,
    enterpriseFeatures: ['text-generation', 'reasoning'],
    availableTiers: ['premium', 'enterprise']
  },

  // Google
  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'Google',
    description: 'Fast multimodal processing',
    category: 'multimodal',
    temperature: 0.7,
    maxTokens: 8192,
    concurrentLimit: 50,
    avgResponseTime: 600,
    costPerRequest: 0.001,
    enterpriseFeatures: ['multimodal'],
    availableTiers: ['basic', 'premium', 'enterprise']
  },
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    description: 'Large context window',
    category: 'multimodal',
    temperature: 0.7,
    maxTokens: 8192,
    concurrentLimit: 30,
    avgResponseTime: 700,
    costPerRequest: 0.003,
    enterpriseFeatures: ['multimodal', 'long-context'],
    availableTiers: ['premium', 'enterprise']
  },

  // Meta Llama 70B (external hosted)
  'llama3.1-70b': {
    id: 'llama3.1-70b',
    name: 'Llama 3.1 70B',
    provider: 'Meta',
    description: 'High-performance open source model',
    category: 'general',
    temperature: 0.7,
    maxTokens: 4096,
    concurrentLimit: 10,
    avgResponseTime: 1200,
    costPerRequest: 0,
    enterpriseFeatures: ['text-generation'],
    availableTiers: ['basic', 'premium', 'enterprise']
  },

  // Groq
  'groq-llama3-8b': {
    id: 'groq-llama3-8b',
    name: 'Groq Llama3 8B',
    provider: 'Groq',
    description: 'Ultra-low latency Llama3 8B',
    category: 'general',
    temperature: 0.7,
    maxTokens: 4096,
    concurrentLimit: 100,
    avgResponseTime: 200,
    costPerRequest: 0,
    enterpriseFeatures: ['text-generation'],
    availableTiers: ['basic', 'premium', 'enterprise']
  },
  'groq-mixtral-8x7b': {
    id: 'groq-mixtral-8x7b',
    name: 'Groq Mixtral 8x7B',
    provider: 'Groq',
    description: 'Fast Mixtral via Groq',
    category: 'general',
    temperature: 0.7,
    maxTokens: 32768,
    concurrentLimit: 100,
    avgResponseTime: 220,
    costPerRequest: 0,
    enterpriseFeatures: ['text-generation', 'long-context'],
    availableTiers: ['basic', 'premium', 'enterprise']
  },

  // Together
  'together-llama3-8b': {
    id: 'together-llama3-8b',
    name: 'Together Llama3 8B',
    provider: 'Together',
    description: 'Open-source Llama on Together',
    category: 'general',
    temperature: 0.7,
    maxTokens: 4096,
    concurrentLimit: 20,
    avgResponseTime: 900,
    costPerRequest: 0,
    enterpriseFeatures: ['text-generation'],
    availableTiers: ['basic', 'premium', 'enterprise']
  },

  // Mistral API
  'mistral-small': {
    id: 'mistral-small',
    name: 'Mistral Small',
    provider: 'Mistral',
    description: 'Mistral API small model',
    category: 'general',
    temperature: 0.7,
    maxTokens: 8192,
    concurrentLimit: 20,
    avgResponseTime: 800,
    costPerRequest: 0,
    enterpriseFeatures: ['text-generation'],
    availableTiers: ['basic', 'premium', 'enterprise']
  },

  // OpenRouter
  'openrouter-auto': {
    id: 'openrouter-auto',
    name: 'OpenRouter Auto',
    provider: 'OpenRouter',
    description: 'Smart router across many LLMs',
    category: 'general',
    temperature: 0.7,
    maxTokens: 4096,
    concurrentLimit: 50,
    avgResponseTime: 700,
    costPerRequest: 0,
    enterpriseFeatures: ['text-generation'],
    availableTiers: ['basic', 'premium', 'enterprise']
  },

  // Fireworks
  'fireworks-llama-8b': {
    id: 'fireworks-llama-8b',
    name: 'Fireworks Llama 3.1 8B',
    provider: 'Fireworks',
    description: 'Llama via Fireworks AI',
    category: 'general',
    temperature: 0.7,
    maxTokens: 4096,
    concurrentLimit: 20,
    avgResponseTime: 900,
    costPerRequest: 0,
    enterpriseFeatures: ['text-generation'],
    availableTiers: ['basic', 'premium', 'enterprise']
  },

  // DeepInfra
  'deepinfra-phi3': {
    id: 'deepinfra-phi3',
    name: 'DeepInfra Phi-3 Mini',
    provider: 'DeepInfra',
    description: 'Phi-3 via DeepInfra',
    category: 'general',
    temperature: 0.7,
    maxTokens: 4096,
    concurrentLimit: 20,
    avgResponseTime: 800,
    costPerRequest: 0,
    enterpriseFeatures: ['text-generation'],
    availableTiers: ['basic', 'premium', 'enterprise']
  },

  // AI21
  'ai21-j2-mid': {
    id: 'ai21-j2-mid',
    name: 'AI21 J2 Mid',
    provider: 'AI21',
    description: 'AI21 Jurassic-2 Mid',
    category: 'general',
    temperature: 0.7,
    maxTokens: 2048,
    concurrentLimit: 20,
    avgResponseTime: 900,
    costPerRequest: 0,
    enterpriseFeatures: ['text-generation'],
    availableTiers: ['basic', 'premium', 'enterprise']
  }
};

// User tier configurations
const USER_TIERS = {
  free: {
    name: 'Free',
    maxRequestsPerDay: 100,
    maxRequestsPerHour: 10,
    maxConcurrentRequests: 1,
    features: [
      'Access to free models',
      'Basic chat functionality',
      '100 requests per day',
      'Community support'
    ],
    availableModels: ['llama3.1-8b', 'mistral-7b', 'phi3-3.8b', 'codellama-7b', 'gpt4all-j', 'dialo-gpt', 'gpt2', 'bart-cnn', 'cohere-command', 'replicate-llama']
  },
  basic: {
    name: 'Basic',
    maxRequestsPerDay: 1000,
    maxRequestsPerHour: 100,
    maxConcurrentRequests: 3,
    features: [
      'Everything in Free',
      '1000 requests per day',
      'Priority support',
      'Chat history',
      'Remove ads'
    ],
    availableModels: ['llama3.1-8b', 'mistral-7b', 'phi3-3.8b', 'codellama-7b', 'gpt4all-j', 'dialo-gpt', 'gpt2', 'bart-cnn', 'cohere-command', 'replicate-llama', 'openai-gpt-5-free', 'gpt-3.5-turbo', 'gpt-4o-mini', 'gpt-4o', 'gemini-1.5-flash', 'groq-llama3-8b', 'groq-mixtral-8x7b', 'together-llama3-8b', 'mistral-small', 'openrouter-auto', 'fireworks-llama-8b', 'deepinfra-phi3', 'ai21-j2-mid', 'claude-3-haiku']
  },
  premium: {
    name: 'Premium',
    maxRequestsPerDay: 10000,
    maxRequestsPerHour: 1000,
    maxConcurrentRequests: 10,
    features: [
      'Everything in Basic',
      'Unlimited requests',
      'Priority access to new models',
      'Advanced analytics',
      '24/7 priority support',
      'Export conversations'
    ],
    availableModels: ['llama3.1-8b', 'mistral-7b', 'phi3-3.8b', 'codellama-7b', 'gpt4all-j', 'dialo-gpt', 'gpt2', 'bart-cnn', 'cohere-command', 'replicate-llama', 'openai-gpt-5-free', 'gpt-3.5-turbo', 'gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo-128k', 'gemini-1.5-flash', 'gemini-1.5-pro', 'groq-llama3-8b', 'groq-mixtral-8x7b', 'together-llama3-8b', 'mistral-small', 'openrouter-auto', 'fireworks-llama-8b', 'deepinfra-phi3', 'ai21-j2-mid', 'claude-3-haiku', 'claude-3-5-sonnet']
  },
  enterprise: {
    name: 'Enterprise',
    maxRequestsPerDay: 100000,
    maxRequestsPerHour: 10000,
    maxConcurrentRequests: 50,
    features: [
      'Everything in Premium',
      'Custom model training',
      'API access',
      'Team collaboration',
      'Advanced security',
      'Dedicated support'
    ],
    availableModels: ['llama3.1-8b', 'mistral-7b', 'phi3-3.8b', 'codellama-7b', 'gpt4all-j', 'dialo-gpt', 'gpt2', 'bart-cnn', 'cohere-command', 'replicate-llama', 'openai-gpt-5-free', 'gpt-3.5-turbo', 'gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo-128k', 'gemini-1.5-flash', 'gemini-1.5-pro', 'groq-llama3-8b', 'groq-mixtral-8x7b', 'together-llama3-8b', 'mistral-small', 'openrouter-auto', 'fireworks-llama-8b', 'deepinfra-phi3', 'ai21-j2-mid', 'claude-3-haiku', 'claude-3-5-sonnet', 'claude-3-opus', 'llama3.1-70b']
  }
};

// Load balancer configuration
const LOAD_BALANCER_CONFIG = {
  strategy: 'round-robin',
  healthCheck: {
    interval: 30000, // 30 seconds
    timeout: 5000,   // 5 seconds
    maxFailures: 3
  },
  failover: {
    enabled: true,
    maxFailures: 3,
    recoveryTime: 60000 // 1 minute
  },
  scaling: {
    autoScaling: false, // Disabled for local setup
    minInstances: 1,
    maxInstances: 5,
    scaleUpThreshold: 0.8,
    scaleDownThreshold: 0.3
  }
};

// Monitoring configuration
const MONITORING_CONFIG = {
  metrics: {
    responseTime: true,
    throughput: true,
    errorRate: true,
    resourceUsage: true,
    userActivity: true
  },
  alerts: {
    enabled: false, // Disabled for local setup
    responseTimeThreshold: 5000,
    errorRateThreshold: 0.05
  },
  logging: {
    level: 'info',
    retention: 30 // days
  }
};

// Get models available for a specific tier
const getModelsByTier = (tier) => {
  const tierConfig = USER_TIERS[tier];
  if (!tierConfig) {
    return [];
  }

  return tierConfig.availableModels.map(modelId => ENTERPRISE_MODELS[modelId]).filter(Boolean);
};

// Get user tier configuration
const getUserTierConfig = (tier) => {
  return USER_TIERS[tier] || USER_TIERS.free;
};

// Get load balancer configuration
const getLoadBalancerConfig = () => {
  return LOAD_BALANCER_CONFIG;
};

// Get monitoring configuration
const getMonitoringConfig = () => {
  return MONITORING_CONFIG;
};

// Get all available models
const getAllModels = () => {
  return Object.values(ENTERPRISE_MODELS);
};

// Get model by ID
const getModelById = (modelId) => {
  return ENTERPRISE_MODELS[modelId] || null;
};

// Check if model is available for tier
const isModelAvailableForTier = (modelId, tier) => {
  const model = ENTERPRISE_MODELS[modelId];
  if (!model) {
    return false;
  }
  return model.availableTiers.includes(tier);
};

module.exports = {
  ENTERPRISE_MODELS,
  USER_TIERS,
  LOAD_BALANCER_CONFIG,
  MONITORING_CONFIG,
  getModelsByTier,
  getUserTierConfig,
  getLoadBalancerConfig,
  getMonitoringConfig,
  getAllModels,
  getModelById,
  isModelAvailableForTier
}; 