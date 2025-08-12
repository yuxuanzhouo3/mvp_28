/**
 * Token Limits Configuration
 */

const tokenLimits = {
  free: {
    perModel: {
      'gpt-3.5-turbo': 1000,
      'gpt-4o-mini': 500,
      'gpt-4o': 300,
      'claude-3-haiku': 1000,
      'claude-3-5-sonnet': 500,
      'claude-3-opus': 300,
      'gemini-1.5-flash': 800,
      'gemini-1.5-pro': 400,
      'groq-llama3-8b': 1200,
      'groq-mixtral-8x7b': 800,
      'mistral-small': 1000,
      'mistral-7b': 800,
      'together-llama3-8b': 1200,
      'together-mixtral-8x7b': 800,
      'ai21-j2-mid': 800,
      'ai21-j2-ultra': 400,
      'openrouter-auto': 600,
      'openrouter-gpt4': 300,
      'deepinfra-phi3': 1000,
      'deepinfra-llama3': 800,
      'fireworks-llama-8b': 1200,
      'fireworks-mixtral': 800,
      'replicate-llama': 800,
      'replicate-mixtral': 600,
      'cohere-command': 1000,
      'cohere-command-r': 600,
      'huggingface-whisper': 2000,
      'huggingface-diffusion': 1000,
      'stability-sdxl': 500,
      'stability-sdxl-turbo': 300,
      'assemblyai-transcribe': 2000,
      'assemblyai-sentiment': 1500,
      'gladia-speech': 2000,
      'gladia-audio': 1500,
      'playht-tts': 1000,
      'playht-voice': 500,
      'elevenlabs-tts': 1000,
      'elevenlabs-voice': 500
    },
    dailyTotal: 10000,
    monthlyTotal: 50000
  },
  
  pro: {
    perModel: {
      'gpt-3.5-turbo': 10000,
      'gpt-4o-mini': 5000,
      'gpt-4o': 3000,
      'claude-3-haiku': 10000,
      'claude-3-5-sonnet': 5000,
      'claude-3-opus': 3000,
      'gemini-1.5-flash': 8000,
      'gemini-1.5-pro': 4000,
      'groq-llama3-8b': 12000,
      'groq-mixtral-8x7b': 8000,
      'mistral-small': 10000,
      'mistral-7b': 8000,
      'together-llama3-8b': 12000,
      'together-mixtral-8x7b': 8000,
      'ai21-j2-mid': 8000,
      'ai21-j2-ultra': 4000,
      'openrouter-auto': 6000,
      'openrouter-gpt4': 3000,
      'deepinfra-phi3': 10000,
      'deepinfra-llama3': 8000,
      'fireworks-llama-8b': 12000,
      'fireworks-mixtral': 8000,
      'replicate-llama': 8000,
      'replicate-mixtral': 6000,
      'cohere-command': 10000,
      'cohere-command-r': 6000,
      'huggingface-whisper': 20000,
      'huggingface-diffusion': 10000,
      'stability-sdxl': 5000,
      'stability-sdxl-turbo': 3000,
      'assemblyai-transcribe': 20000,
      'assemblyai-sentiment': 15000,
      'gladia-speech': 20000,
      'gladia-audio': 15000,
      'playht-tts': 10000,
      'playht-voice': 5000,
      'elevenlabs-tts': 10000,
      'elevenlabs-voice': 5000
    },
    dailyTotal: 100000,
    monthlyTotal: 1000000
  },
  
  enterprise: {
    perModel: {},
    dailyTotal: -1,
    monthlyTotal: -1
  }
};

const getTokenLimit = (userTier, modelId) => {
  const tierConfig = tokenLimits[userTier] || tokenLimits.free;
  return tierConfig.perModel[modelId] || 1000;
};

const getDailyLimit = (userTier) => {
  const tierConfig = tokenLimits[userTier] || tokenLimits.free;
  return tierConfig.dailyTotal;
};

const getMonthlyLimit = (userTier) => {
  const tierConfig = tokenLimits[userTier] || tokenLimits.free;
  return tierConfig.monthlyTotal;
};

const checkTokenLimits = (userTier, modelId, currentUsage, additionalTokens = 0) => {
  const modelLimit = getTokenLimit(userTier, modelId);
  const dailyLimit = getDailyLimit(userTier);
  const monthlyLimit = getMonthlyLimit(userTier);
  
  const modelUsage = currentUsage.modelUsage || 0;
  if (modelLimit !== -1 && (modelUsage + additionalTokens) > modelLimit) {
    return {
      exceeded: true,
      type: 'model',
      current: modelUsage,
      limit: modelLimit,
      remaining: Math.max(0, modelLimit - modelUsage),
      message: `Model limit exceeded. You've used ${modelUsage}/${modelLimit} tokens for this model.`
    };
  }
  
  const dailyUsage = currentUsage.dailyUsage || 0;
  if (dailyLimit !== -1 && (dailyUsage + additionalTokens) > dailyLimit) {
    return {
      exceeded: true,
      type: 'daily',
      current: dailyUsage,
      limit: dailyLimit,
      remaining: Math.max(0, dailyLimit - dailyUsage),
      message: `Daily limit exceeded. You've used ${dailyUsage}/${dailyLimit} tokens today.`
    };
  }
  
  const monthlyUsage = currentUsage.monthlyUsage || 0;
  if (monthlyLimit !== -1 && (monthlyUsage + additionalTokens) > monthlyLimit) {
    return {
      exceeded: true,
      type: 'monthly',
      current: monthlyUsage,
      limit: monthlyLimit,
      remaining: Math.max(0, monthlyLimit - monthlyUsage),
      message: `Monthly limit exceeded. You've used ${monthlyUsage}/${monthlyLimit} tokens this month.`
    };
  }
  
  return {
    exceeded: false,
    remaining: {
      model: modelLimit === -1 ? -1 : Math.max(0, modelLimit - modelUsage),
      daily: dailyLimit === -1 ? -1 : Math.max(0, dailyLimit - dailyUsage),
      monthly: monthlyLimit === -1 ? -1 : Math.max(0, monthlyLimit - monthlyUsage)
    }
  };
};

const getUpgradeMessage = (limitType, current, limit) => {
  const messages = {
    model: `You've reached the free limit for this model (${current}/${limit} tokens). Upgrade to Pro for higher limits!`,
    daily: `You've reached your daily free limit (${current}/${limit} tokens). Upgrade to Pro for higher daily limits!`,
    monthly: `You've reached your monthly free limit (${current}/${limit} tokens). Upgrade to Pro for higher monthly limits!`
  };
  
  return messages[limitType] || 'Upgrade to Pro for higher usage limits!';
};

module.exports = {
  tokenLimits,
  getTokenLimit,
  getDailyLimit,
  getMonthlyLimit,
  checkTokenLimits,
  getUpgradeMessage
};
