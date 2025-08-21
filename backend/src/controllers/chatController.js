/**
 * Chat Controller
 * Handles AI model conversations for remote users with rate limiting and tier management
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { getUserByEmail } = require('../models/userModel');
const { createChatSession, getChatSessions, updateChatSession, deleteChatSession } = require('../models/chatModel');
const { createMessage, getMessagesByChatId } = require('../models/messageModel');
const { checkRateLimit, incrementUsage } = require('../services/rateLimitService');
const { getModelsByTier, getUserTierConfig } = require('../config/enterpriseModels');
const loadBalancer = require('../services/loadBalancer');
const { getUserModelUsage, updateUserUsage } = require('../models/usageModel');

class ChatController {
  // Send message to AI model
  async sendMessage(req, res) {
    try {
      const userId = req.user.userId;
      const { chatId, message, modelId, options = {} } = req.body;

      // Validation
      if (!message || !modelId) {
        return res.status(400).json({
          success: false,
          message: 'Message and model ID are required'
        });
      }

      // Get user and check tier
      let user;
      if (req.user.userId === 'guest') {
        // Guest user - create temporary user object
        user = {
          id: 'guest',
          email: 'guest@local.dev',
          tier: 'free',
          name: 'Guest User'
        };
      } else {
        user = await getUserByEmail(req.user.email);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'User not found'
          });
        }
      }

      // Check rate limits based on user tier
      const tierConfig = getUserTierConfig(user.tier);
      const rateLimitCheck = await checkRateLimit(userId, user.tier);
      
      if (!rateLimitCheck.allowed) {
        return res.status(429).json({
          success: false,
          message: `Rate limit exceeded. ${rateLimitCheck.message}`,
          retryAfter: rateLimitCheck.retryAfter
        });
      }

      // Check token limits for free tier users
      if (user.tier === 'free') {
        const userUsage = await getUserModelUsage(userId, modelId);
        const estimatedTokens = Math.ceil(message.length / 4) + 100; // Rough estimate
        
        // Simple token limit check for free tier
        const freeTierLimits = {
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
        };
        
        const modelLimit = freeTierLimits[modelId] || 1000;
        const currentUsage = userUsage.tokens_used || 0;
        
        if ((currentUsage + estimatedTokens) > modelLimit) {
          return res.status(402).json({
            success: false,
            message: `Token limit exceeded for ${modelId}. You've used ${currentUsage}/${modelLimit} tokens. Upgrade to Pro for higher limits!`,
            error: 'PAYMENT_REQUIRED',
            currentUsage,
            limit: modelLimit,
            remaining: Math.max(0, modelLimit - currentUsage)
          });
        }
      }

      // Get available models for user tier
      const availableModels = getModelsByTier(user.tier);
      const selectedModel = availableModels.find(m => m.id === modelId);

      if (!selectedModel) {
        return res.status(403).json({
          success: false,
          message: 'Model not available for your tier'
        });
      }

      // Create or get chat session
      let chatSession;
      if (req.user.userId === 'guest') {
        // For guest users, create a simple session object without database storage
        chatSession = {
          id: chatId || uuidv4(),
          userId: 'guest',
          title: message.slice(0, 50) + '...',
          model: selectedModel.name,
          modelId: selectedModel.id,
          category: selectedModel.category,
          createdAt: new Date(),
          lastUpdated: new Date()
        };
      } else {
        if (chatId) {
          chatSession = await getChatSessions(userId, chatId);
          if (!chatSession) {
            return res.status(404).json({
              success: false,
              message: 'Chat session not found'
            });
          }
        } else {
          // Create new chat session
          chatSession = {
            id: uuidv4(),
            userId,
            title: message.slice(0, 50) + '...',
            model: selectedModel.name,
            modelId: selectedModel.id,
            category: selectedModel.category,
            createdAt: new Date(),
            lastUpdated: new Date()
          };
          await createChatSession(chatSession);
        }
      }

      // Create user message
      const userMessage = {
        id: uuidv4(),
        chatId: chatSession.id,
        role: 'user',
        content: message,
        timestamp: new Date(),
        model: selectedModel.name
      };
      
      if (req.user.userId !== 'guest') {
        await createMessage(userMessage);
      }

      // Get AI response using load balancer
      const aiResponse = await this.getAIResponse(selectedModel, message, options, user);

      // Create AI message
      const aiMessage = {
        id: uuidv4(),
        chatId: chatSession.id,
        role: 'assistant',
        content: aiResponse.text,
        timestamp: new Date(),
        model: selectedModel.name,
        responseTime: aiResponse.responseTime,
        tokens: aiResponse.tokens
      };
      await createMessage(aiMessage);

      // Update chat session
      await updateChatSession(chatSession.id, {
        lastUpdated: new Date(),
        messageCount: (chatSession.messageCount || 0) + 2
      });

      // Increment usage
      await incrementUsage(userId, user.tier, selectedModel.id);

      // Track token usage for non-guest users
      if (req.user.userId !== 'guest') {
        const totalTokens = (aiResponse.tokens || 0) + Math.ceil(message.length / 4);
        await updateUserUsage(userId, modelId, totalTokens, 1);
      }

      logger.info(`Chat message processed for user ${userId}, model: ${selectedModel.name}`);

      res.status(200).json({
        success: true,
        chatId: chatSession.id,
        userMessage,
        aiMessage,
        usage: {
          remainingRequests: rateLimitCheck.remaining,
          tier: user.tier,
          tokensUsed: aiResponse.tokens || 0,
          totalTokens: (aiResponse.tokens || 0) + Math.ceil(message.length / 4)
        }
      });

    } catch (error) {
      logger.error('Send message error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error processing message'
      });
    }
  }

  // Get AI response from model providers
  async getAIResponse(model, message, options, user) {
    try {
      // Get provider through load balancer
      const provider = await loadBalancer.getNextProvider(model.id, user.tier);
      
      if (!provider) {
        throw new Error('No available providers for this model');
      }

      // Generate response based on provider type
      let response;
      
      if (provider.type === 'local-cluster' || provider.type === 'distributed-local') {
        // Local models (Ollama, LocalAI)
        response = await provider.generateText(model.id, message, {
          temperature: options.temperature || model.temperature,
          maxTokens: options.maxTokens || model.maxTokens,
          topP: options.topP || 0.9,
          topK: options.topK || 40
        }, user.id, user.tier);
      } else if (provider.type === 'api-enterprise') {
        // API models (Hugging Face, Replicate, Cohere)
        response = await provider.generateText(model.id, message, {
          temperature: options.temperature || model.temperature,
          maxTokens: options.maxTokens || model.maxTokens
        }, user.id, user.tier);
      } else {
        throw new Error('Unsupported provider type');
      }

      // Record request in load balancer
      loadBalancer.recordRequest(provider.id, response.success);

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate response');
      }

      return {
        text: response.text,
        responseTime: response.responseTime,
        tokens: response.tokens || 0,
        model: model.name,
        provider: provider.name
      };

    } catch (error) {
      logger.error('AI response error:', error);
      
      // Fallback response
      return {
        text: `I apologize, but I'm experiencing technical difficulties right now. Please try again in a moment. (Error: ${error.message})`,
        responseTime: 0,
        tokens: 0,
        model: model.name,
        provider: 'fallback'
      };
    }
  }

  // Get chat sessions for user
  async getChatSessions(req, res) {
    try {
      const userId = req.user.userId;
      const { limit = 50, offset = 0 } = req.query;

      const sessions = await getChatSessions(userId, null, parseInt(limit), parseInt(offset));

      res.status(200).json({
        success: true,
        sessions,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: sessions.length
        }
      });

    } catch (error) {
      logger.error('Get chat sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error getting chat sessions'
      });
    }
  }

  // Get messages for a specific chat
  async getChatMessages(req, res) {
    try {
      const userId = req.user.userId;
      const { chatId } = req.params;
      const { limit = 100, offset = 0 } = req.query;

      // Verify chat belongs to user
      const chatSession = await getChatSessions(userId, chatId);
      if (!chatSession) {
        return res.status(404).json({
          success: false,
          message: 'Chat session not found'
        });
      }

      const messages = await getMessagesByChatId(chatId, parseInt(limit), parseInt(offset));

      res.status(200).json({
        success: true,
        chat: chatSession,
        messages,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: messages.length
        }
      });

    } catch (error) {
      logger.error('Get chat messages error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error getting chat messages'
      });
    }
  }

  // Create new chat session
  async createChat(req, res) {
    try {
      const userId = req.user.userId;
      const { title, modelId, category } = req.body;

      // Get user and available models
      const user = await getUserByEmail(req.user.email);
      const availableModels = getModelsByTier(user.tier);
      const selectedModel = availableModels.find(m => m.id === modelId);

      if (!selectedModel) {
        return res.status(403).json({
          success: false,
          message: 'Model not available for your tier'
        });
      }

      const chatSession = {
        id: uuidv4(),
        userId,
        title: title || `New ${selectedModel.name} Chat`,
        model: selectedModel.name,
        modelId: selectedModel.id,
        category: category || selectedModel.category,
        createdAt: new Date(),
        lastUpdated: new Date(),
        messageCount: 0
      };

      await createChatSession(chatSession);

      res.status(201).json({
        success: true,
        chat: chatSession
      });

    } catch (error) {
      logger.error('Create chat error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error creating chat'
      });
    }
  }

  // Update chat session
  async updateChat(req, res) {
    try {
      const userId = req.user.userId;
      const { chatId } = req.params;
      const { title } = req.body;

      // Verify chat belongs to user
      const chatSession = await getChatSessions(userId, chatId);
      if (!chatSession) {
        return res.status(404).json({
          success: false,
          message: 'Chat session not found'
        });
      }

      const updatedChat = await updateChatSession(chatId, { title });

      res.status(200).json({
        success: true,
        chat: updatedChat
      });

    } catch (error) {
      logger.error('Update chat error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error updating chat'
      });
    }
  }

  // Delete chat session
  async deleteChat(req, res) {
    try {
      const userId = req.user.userId;
      const { chatId } = req.params;

      // Verify chat belongs to user
      const chatSession = await getChatSessions(userId, chatId);
      if (!chatSession) {
        return res.status(404).json({
          success: false,
          message: 'Chat session not found'
        });
      }

      await deleteChatSession(chatId);

      res.status(200).json({
        success: true,
        message: 'Chat session deleted successfully'
      });

    } catch (error) {
      logger.error('Delete chat error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error deleting chat'
      });
    }
  }

  // Get available models for user
  async getAvailableModels(req, res) {
    try {
      const user = await getUserByEmail(req.user.email);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const availableModels = getModelsByTier(user.tier);
      const tierConfig = getUserTierConfig(user.tier);

      res.status(200).json({
        success: true,
        models: availableModels,
        tier: {
          name: tierConfig.name,
          maxRequestsPerDay: tierConfig.maxRequestsPerDay,
          maxConcurrentRequests: tierConfig.maxConcurrentRequests,
          features: tierConfig.features
        }
      });

    } catch (error) {
      logger.error('Get available models error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error getting available models'
      });
    }
  }

  // Stream chat response (for real-time streaming)
  async streamChat(req, res) {
    try {
      const userId = req.user.userId;
      const { chatId, message, modelId, options = {} } = req.body;

      // Set headers for streaming
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Get user and check rate limits
      const user = await getUserByEmail(req.user.email);
      const rateLimitCheck = await checkRateLimit(userId, user.tier);
      
      if (!rateLimitCheck.allowed) {
        res.write(`data: ${JSON.stringify({
          error: `Rate limit exceeded. ${rateLimitCheck.message}`,
          retryAfter: rateLimitCheck.retryAfter
        })}\n\n`);
        res.end();
        return;
      }

      // Get model and provider
      const availableModels = getModelsByTier(user.tier);
      const selectedModel = availableModels.find(m => m.id === modelId);
      
      if (!selectedModel) {
        res.write(`data: ${JSON.stringify({
          error: 'Model not available for your tier'
        })}\n\n`);
        res.end();
        return;
      }

      const provider = await loadBalancer.getNextProvider(modelId, user.tier);
      
      if (!provider) {
        res.write(`data: ${JSON.stringify({
          error: 'No available providers for this model'
        })}\n\n`);
        res.end();
        return;
      }

      // Stream response
      try {
        const stream = await provider.generateTextStream(modelId, message, {
          temperature: options.temperature || selectedModel.temperature,
          maxTokens: options.maxTokens || selectedModel.maxTokens
        }, user.id, user.tier);

        stream.on('data', (chunk) => {
          const data = chunk.toString();
          res.write(`data: ${JSON.stringify({ content: data })}\n\n`);
        });

        stream.on('end', () => {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
          
          // Increment usage
          incrementUsage(userId, user.tier, modelId);
        });

        stream.on('error', (error) => {
          logger.error('Stream error:', error);
          res.write(`data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`);
          res.end();
        });

      } catch (error) {
        logger.error('Stream setup error:', error);
        res.write(`data: ${JSON.stringify({ error: 'Failed to start stream' })}\n\n`);
        res.end();
      }

    } catch (error) {
      logger.error('Stream chat error:', error);
      res.write(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`);
      res.end();
    }
  }

  // Get usage statistics for user
  async getUsageStats(req, res) {
    try {
      const userId = req.user.userId;
      
      if (userId === 'guest') {
        return res.status(200).json({
          success: true,
          usage: {
            tier: 'free',
            tierName: 'Free Tier',
            maxRequestsPerDay: 10,
            usedToday: 0,
            remainingToday: 10,
            maxConcurrentRequests: 1,
            features: ['Basic models', 'Limited requests'],
            modelUsage: []
          }
        });
      }

      const user = await getUserByEmail(req.user.email);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const tierConfig = getUserTierConfig(user.tier);
      const currentUsage = await checkRateLimit(userId, user.tier);
      const tokenUsage = await getUserUsage(userId);

      // Get token limits for the user's tier
      const freeTierLimits = {
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
      };

      // Add token limits to usage data
      const usageWithLimits = tokenUsage.map(item => ({
        ...item,
        limit: user.tier === 'free' ? freeTierLimits[item.model_id] || 1000 : -1,
        remaining: user.tier === 'free' ? Math.max(0, (freeTierLimits[item.model_id] || 1000) - item.tokens_used) : -1
      }));

      res.status(200).json({
        success: true,
        usage: {
          tier: user.tier,
          tierName: tierConfig.name,
          maxRequestsPerDay: tierConfig.maxRequestsPerDay,
          usedToday: tierConfig.maxRequestsPerDay - currentUsage.remaining,
          remainingToday: currentUsage.remaining,
          maxConcurrentRequests: tierConfig.maxConcurrentRequests,
          features: tierConfig.features,
          modelUsage: usageWithLimits
        }
      });

    } catch (error) {
      logger.error('Get usage stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error getting usage statistics'
      });
    }
  }
}

module.exports = new ChatController(); 