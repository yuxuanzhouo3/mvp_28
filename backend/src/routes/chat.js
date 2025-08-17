/**
 * Chat Routes
 * Handles AI model chat endpoints
 */

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Guest-friendly send message endpoint for local testing
router.post('/send-guest', async (req, res) => {
  try {
    console.log('Guest endpoint received request body:', req.body);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Raw request body:', JSON.stringify(req.body));
    console.log('Request headers:', req.headers);
    const { modelId, message, language } = req.body;
    
    console.log('Extracted modelId:', modelId);
    console.log('Extracted message:', message);
    
    if (!message || !modelId) {
      console.log('Validation failed - missing message or modelId');
      return res.status(400).json({
        success: false,
        message: 'Message and model ID are required'
      });
    }

    // Get available models
    const { getAllModels } = require('../config/enterpriseModels');
    const availableModels = getAllModels();
    const selectedModel = availableModels.find(m => m.id === modelId);

    if (!selectedModel) {
      return res.status(400).json({
        success: false,
        message: 'Model not available'
      });
    }

    // Get AI response using load balancer
    const loadBalancer = require('../services/loadBalancer');
    console.log('Getting provider for modelId:', modelId);
    const provider = await loadBalancer.getNextProvider(modelId, 'free');
    
    console.log('Provider type:', provider.constructor.name);
    
    if (!provider) {
      return res.status(500).json({
        success: false,
        message: 'No available AI providers'
      });
    }

    console.log('Generating text with provider...');
    const options = language === 'zh' ? { language: 'zh-CN' } : {};
    const response = await provider.generateText(modelId, message, options, 'guest', 'free');
    console.log('Response received:', response);
    
    res.json({
      success: true,
      data: {
        response: response.text,
        chatId: 'guest-' + Date.now()
      }
    });

  } catch (error) {
    console.error('Guest chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing message',
      error: error.message
    });
  }
});

// Send message to AI model
router.post('/send', chatController.sendMessage);

// Stream chat response
router.post('/stream', chatController.streamChat);

// Guest-friendly streaming endpoint for local testing
router.post('/stream-guest', async (req, res) => {
  try {
    console.log('Guest streaming endpoint received request body:', req.body);
    const { modelId, message, language } = req.body;
    
    if (!message || !modelId) {
      return res.status(400).json({
        success: false,
        message: 'Message and model ID are required'
      });
    }

    // Get available models
    const { getAllModels } = require('../config/enterpriseModels');
    const availableModels = getAllModels();
    const selectedModel = availableModels.find(m => m.id === modelId);

    if (!selectedModel) {
      return res.status(400).json({
        success: false,
        message: 'Model not available'
      });
    }

    // Get AI response using load balancer
    const loadBalancer = require('../services/loadBalancer');
    const provider = await loadBalancer.getNextProvider(modelId, 'free');
    
    if (!provider) {
      return res.status(500).json({
        success: false,
        message: 'No available AI providers'
      });
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Auto-detect language if not provided or enhance language detection
    let detectedLanguage = language;
    if (!detectedLanguage || detectedLanguage === 'auto') {
      // Simple Chinese character detection
      const containsChinese = /[\u4e00-\u9fff]/.test(message);
      detectedLanguage = containsChinese ? 'zh' : 'en';
    }
    
    const options = detectedLanguage === 'zh' ? { 
      language: 'zh-CN',
      systemPrompt: 'You are a helpful AI assistant. Please respond in Chinese (中文) when the user writes in Chinese. Be natural and conversational in your Chinese responses.'
    } : {};
    
    // Check if provider supports streaming
    if (provider.generateTextStream) {
      console.log('Using streaming provider');
      const stream = await provider.generateTextStream(modelId, message, options, 'guest', 'free');
      
      stream.on('data', (chunk) => {
        res.write(`data: ${JSON.stringify({ chunk: chunk.text || chunk })}\n\n`);
      });
      
      stream.on('end', () => {
        res.write('data: [DONE]\n\n');
        res.end();
      });
      
      stream.on('error', (error) => {
        console.error('Streaming error:', error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      });
    } else {
      console.log('Provider does not support streaming, using regular response');
      const response = await provider.generateText(modelId, message, options, 'guest', 'free');
      
      if (response.success) {
                 // Simulate streaming by sending the response in chunks
         const text = response.text;
         const chunkSize = 3; // Smaller chunks for more realistic streaming
         let index = 0;
         
                   // Add initial delay to simulate thinking time (max 1 second)
          const initialDelay = Math.min(1000, Math.random() * 500 + 200); // 200-700ms, max 1s
         
         setTimeout(() => {
           const sendChunk = () => {
             if (index < text.length) {
               const chunk = text.slice(index, index + chunkSize);
               res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
               index += chunkSize;
               // Faster streaming with variable delays
               const delay = Math.random() * 20 + 10; // 10-30ms between chunks for faster output
               setTimeout(sendChunk, delay);
             } else {
               res.write('data: [DONE]\n\n');
               res.end();
             }
           };
           
                     sendChunk();
        }, initialDelay);
      } else {
        res.write(`data: ${JSON.stringify({ error: response.error || 'Failed to generate response' })}\n\n`);
        res.end();
      }
    }

  } catch (error) {
    console.error('Guest streaming error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// Get chat sessions for user
router.get('/sessions', chatController.getChatSessions);

// Get messages for a specific chat
router.get('/sessions/:chatId/messages', chatController.getChatMessages);

// Create new chat session
router.post('/sessions', chatController.createChat);

// Update chat session
router.put('/sessions/:chatId', chatController.updateChat);

// Delete chat session
router.delete('/sessions/:chatId', chatController.deleteChat);

// Get available models for user
router.get('/models', chatController.getAvailableModels);

// Get usage statistics
router.get('/usage', chatController.getUsageStats);

// Simple health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router; 