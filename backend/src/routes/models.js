/**
 * Models Routes
 * Handles model-related endpoints
 */

const express = require('express');
const router = express.Router();
const loadBalancer = require('../services/loadBalancer');
const { getModelsByTier, getUserTierConfig } = require('../config/enterpriseModels');

// Get all available models
router.get('/', async (req, res) => {
  try {
    const models = await loadBalancer.getAvailableModels();
    
    res.status(200).json({
      success: true,
      models
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting available models'
    });
  }
});

// Get models for specific tier
router.get('/tier/:tier', async (req, res) => {
  try {
    const { tier } = req.params;
    const models = getModelsByTier(tier);
    const tierConfig = getUserTierConfig(tier);
    
    res.status(200).json({
      success: true,
      models,
      tier: tierConfig
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting models for tier'
    });
  }
});

// Get model details
router.get('/:modelId', async (req, res) => {
  try {
    const { modelId } = req.params;
    const models = await loadBalancer.getAvailableModels();
    const model = models.find(m => m.id === modelId);
    
    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'Model not found'
      });
    }
    
    res.status(200).json({
      success: true,
      model
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting model details'
    });
  }
});

// Get load balancer stats
router.get('/stats/loadbalancer', async (req, res) => {
  try {
    const stats = loadBalancer.getStats();
    
    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting load balancer stats'
    });
  }
});

module.exports = router; 