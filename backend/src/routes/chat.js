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
    const { modelId, message } = req.body;
    
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
    const response = await provider.generateText(modelId, message, {}, 'guest', 'free');
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

module.exports = router; 