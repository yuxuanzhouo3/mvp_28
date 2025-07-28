/**
 * Copyright © 2024 Yuxuan Zhou. All rights reserved.
 * 
 * Models Routes
 * API endpoints for AI model management and downloads
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');
const { downloadModel, getModelStatus } = require('../controllers/modelController');

const router = express.Router();

// Available external models configuration
const externalModels = [
  { 
    name: "GPT-3.5 Turbo", 
    provider: "OpenAI", 
    description: "Fast and efficient for most tasks", 
    type: "free",
    apiKey: "OPENAI_API_KEY"
  },
  { 
    name: "Claude 3 Haiku", 
    provider: "Anthropic", 
    description: "Quick responses with good reasoning", 
    type: "free",
    apiKey: "ANTHROPIC_API_KEY"
  },
  { 
    name: "Gemini Flash", 
    provider: "Google", 
    description: "Multimodal capabilities", 
    type: "free",
    apiKey: "GOOGLE_API_KEY"
  },
  { 
    name: "Llama 3.1 8B", 
    provider: "Meta", 
    description: "Open source and customizable", 
    type: "free",
    apiKey: "META_API_KEY"
  },
  { 
    name: "Mistral 7B", 
    provider: "Mistral AI", 
    description: "Efficient European model", 
    type: "free",
    apiKey: "MISTRAL_API_KEY"
  },
  { 
    name: "Phi-3 Mini", 
    provider: "Microsoft", 
    description: "Compact but powerful", 
    type: "free",
    apiKey: "MICROSOFT_API_KEY"
  },
  { 
    name: "CodeLlama", 
    provider: "Meta", 
    description: "Specialized for coding tasks", 
    type: "free",
    apiKey: "META_API_KEY"
  },
  { 
    name: "Llama 3.1 70B", 
    provider: "Meta", 
    description: "High-performance open source model", 
    type: "free",
    apiKey: "META_API_KEY"
  },
  { 
    name: "Gemini 1.5 Flash", 
    provider: "Google", 
    description: "Fast multimodal processing", 
    type: "free",
    apiKey: "GOOGLE_API_KEY"
  },
  {
    name: "GPT-4o Mini",
    provider: "OpenAI",
    price: "$0.15/1M tokens",
    description: "Affordable GPT-4 level performance",
    type: "popular",
    apiKey: "OPENAI_API_KEY"
  },
  {
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    price: "$3/1M tokens",
    description: "Best reasoning and analysis",
    type: "popular",
    apiKey: "ANTHROPIC_API_KEY"
  },
  {
    name: "Gemini 1.5 Pro",
    provider: "Google",
    price: "$1.25/1M tokens",
    description: "Large context window",
    type: "popular",
    apiKey: "GOOGLE_API_KEY"
  },
  {
    name: "GPT-4 Turbo",
    provider: "OpenAI",
    price: "$10/1M tokens",
    description: "Most capable OpenAI model",
    type: "popular",
    apiKey: "OPENAI_API_KEY"
  },
  {
    name: "Claude 3 Opus",
    provider: "Anthropic",
    price: "$15/1M tokens",
    description: "Highest quality responses",
    type: "popular",
    apiKey: "ANTHROPIC_API_KEY"
  },
  {
    name: "GPT-4o",
    provider: "OpenAI",
    price: "$5/1M tokens",
    description: "Latest multimodal model",
    type: "premium",
    apiKey: "OPENAI_API_KEY"
  },
  {
    name: "Claude 3.5 Haiku",
    provider: "Anthropic",
    price: "$0.25/1M tokens",
    description: "Fast and cost-effective",
    type: "premium",
    apiKey: "ANTHROPIC_API_KEY"
  },
  {
    name: "Gemini 1.5 Flash",
    provider: "Google",
    price: "$0.75/1M tokens",
    description: "Fast multimodal processing",
    type: "premium",
    apiKey: "GOOGLE_API_KEY"
  },
  {
    name: "GPT-4 Turbo 128K",
    provider: "OpenAI",
    price: "$12/1M tokens",
    description: "Extended context window",
    type: "premium",
    apiKey: "OPENAI_API_KEY"
  }
];

// MornGPT specialized models
const mornGPTModels = [
  {
    id: "a1",
    name: "Growth Advisory",
    icon: "📈",
    description: "Business development and market analysis",
    model: "Claude 3.5 Sonnet",
    category: "business",
    url: "https://mornhub.net"
  },
  {
    id: "b1",
    name: "Interview/Job",
    icon: "💼",
    description: "Career development and interview prep",
    model: "GPT-4o Mini",
    category: "career",
    url: "https://mornhub.pics/interview"
  },
  {
    id: "c1",
    name: "AI Coder",
    icon: "💻",
    description: "Advanced coding assistant",
    model: "CodeLlama",
    category: "development",
    url: "https://mornhub.pics/coder"
  },
  {
    id: "h1",
    name: "Multi-GPT",
    icon: "🤖",
    description: "Orchestrates multiple AI models to solve complex tasks",
    model: "GPT-4o Mini",
    category: "productivity",
    url: "https://mornhub.pics/multigpt"
  },
  {
    id: "w1",
    name: "Content Generation",
    icon: "🧠",
    description: "Creative content creation",
    model: "GPT-4o Mini",
    category: "creative",
    url: "https://mornhub.pics"
  },
  {
    id: "e1",
    name: "Medical Advice",
    icon: "❤️",
    description: "Health consultation AI",
    model: "Claude 3.5 Sonnet",
    category: "health",
    url: "https://mornhub.pics/medical"
  },
  {
    id: "d1",
    name: "Content Detection",
    icon: "🛡️",
    description: "Fake content verification",
    model: "Claude 3.5 Sonnet",
    category: "security",
    url: "https://mornhub.pics/detect"
  },
  {
    id: "z1",
    name: "AI Protection",
    icon: "🔒",
    description: "AI safety and security",
    model: "Claude 3.5 Sonnet",
    category: "security",
    url: "https://mornhub.pics/protection"
  },
  {
    id: "q1",
    name: "AI Teacher",
    icon: "🎓",
    description: "Personalized learning system",
    model: "Claude 3.5 Sonnet",
    category: "education",
    url: "https://mornhub.pics/teacher"
  },
  {
    id: "n1",
    name: "AI Entertainment Advisor",
    icon: "🎬",
    description: "Movie, music, and entertainment recommendations",
    model: "GPT-4o Mini",
    category: "entertainment",
    url: "https://mornhub.pics/entertainment"
  },
  {
    id: "o1",
    name: "Housing",
    icon: "🏠",
    description: "Real estate and accommodation",
    model: "Claude 3.5 Sonnet",
    category: "lifestyle",
    url: "https://mornhub.homes"
  },
  {
    id: "t1",
    name: "Fashion",
    icon: "👕",
    description: "Personalized styling advice",
    model: "GPT-4o Mini",
    category: "lifestyle",
    url: "https://mornhub.pics/fashion"
  },
  {
    id: "u1",
    name: "Food & Dining",
    icon: "🍽️",
    description: "Restaurant and food discovery",
    model: "Claude 3.5 Sonnet",
    category: "food",
    url: "https://mornhub.pics/food"
  },
  {
    id: "r1",
    name: "Travel Planning",
    icon: "✈️",
    description: "Intelligent travel assistance",
    model: "GPT-4o Mini",
    category: "travel",
    url: "https://mornhub.pics/travel"
  },
  {
    id: "s1",
    name: "Product Search",
    icon: "🔍",
    description: "Smart product recommendations",
    model: "Claude 3.5 Sonnet",
    category: "shopping",
    url: "https://mornhub.pics/search"
  },
  {
    id: "p1",
    name: "Person Matching",
    icon: "👥",
    description: "Professional and personal matching",
    model: "GPT-4o Mini",
    category: "social",
    url: "https://mornhub.lat"
  }
];

// GET /api/models - Get all available models
router.get('/', asyncHandler(async (req, res) => {
  const { type, category, provider } = req.query;
  
  let filteredModels = [...externalModels];
  
  // Filter by type
  if (type) {
    filteredModels = filteredModels.filter(model => model.type === type);
  }
  
  // Filter by category
  if (category) {
    filteredModels = filteredModels.filter(model => model.category === category);
  }
  
  // Filter by provider
  if (provider) {
    filteredModels = filteredModels.filter(model => model.provider === provider);
  }
  
  res.json({
    success: true,
    data: {
      external: filteredModels,
      morngpt: mornGPTModels,
      total: filteredModels.length + mornGPTModels.length
    }
  });
}));

// GET /api/models/external - Get external models only
router.get('/external', asyncHandler(async (req, res) => {
  const { type, provider } = req.query;
  
  let filteredModels = [...externalModels];
  
  if (type) {
    filteredModels = filteredModels.filter(model => model.type === type);
  }
  
  if (provider) {
    filteredModels = filteredModels.filter(model => model.provider === provider);
  }
  
  res.json({
    success: true,
    data: filteredModels,
    count: filteredModels.length
  });
}));

// GET /api/models/morngpt - Get MornGPT models only
router.get('/morngpt', asyncHandler(async (req, res) => {
  const { category } = req.query;
  
  let filteredModels = [...mornGPTModels];
  
  if (category) {
    filteredModels = filteredModels.filter(model => model.category === category);
  }
  
  res.json({
    success: true,
    data: filteredModels,
    count: filteredModels.length
  });
}));

// GET /api/models/:id - Get specific model details
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Check external models first
  const externalModel = externalModels.find(model => model.name === id);
  if (externalModel) {
    return res.json({
      success: true,
      data: externalModel
    });
  }
  
  // Check MornGPT models
  const morngptModel = mornGPTModels.find(model => model.id === id);
  if (morngptModel) {
    return res.json({
      success: true,
      data: morngptModel
    });
  }
  
  res.status(404).json({
    success: false,
    error: 'Model not found',
    message: `Model with ID '${id}' not found`
  });
}));

// POST /api/models/download - Start model download
router.post('/download', [
  body('modelName').notEmpty().withMessage('Model name is required'),
  body('modelProvider').notEmpty().withMessage('Model provider is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: errors.array()
    });
  }
  
  const { modelName, modelProvider } = req.body;
  const userId = req.userId;
  
  try {
    const downloadId = await downloadModel(userId, modelName, modelProvider);
    
    res.json({
      success: true,
      data: {
        downloadId,
        message: `Download started for ${modelName}`
      }
    });
  } catch (error) {
    logger.error('Model download error:', error);
    res.status(500).json({
      success: false,
      error: 'Download failed',
      message: error.message
    });
  }
}));

// GET /api/models/download/:id/status - Get download status
router.get('/download/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  
  try {
    const status = await getModelStatus(id, userId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Get download status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get download status',
      message: error.message
    });
  }
}));

// GET /api/models/downloads - Get user's downloads
router.get('/downloads', asyncHandler(async (req, res) => {
  const userId = req.userId;
  const db = getDatabase();
  
  const downloads = await new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM model_downloads WHERE user_id = ? ORDER BY started_at DESC',
      [userId],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
  
  res.json({
    success: true,
    data: downloads,
    count: downloads.length
  });
}));

// DELETE /api/models/download/:id - Cancel download
router.delete('/download/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  const db = getDatabase();
  
  const result = await new Promise((resolve, reject) => {
    db.run(
      'UPDATE model_downloads SET status = ? WHERE id = ? AND user_id = ?',
      ['cancelled', id, userId],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      }
    );
  });
  
  if (result.changes === 0) {
    return res.status(404).json({
      success: false,
      error: 'Download not found',
      message: 'Download not found or not owned by user'
    });
  }
  
  res.json({
    success: true,
    message: 'Download cancelled successfully'
  });
}));

module.exports = router; 