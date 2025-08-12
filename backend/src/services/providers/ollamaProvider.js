/**
 * Ollama Provider Service
 * Handles communication with Ollama for local model inference
 * Primary provider for enterprise deployment
 */

const axios = require('axios');
const logger = require('../../utils/logger');
const { ENTERPRISE_MODELS } = require('../../config/enterpriseModels');

class OllamaProvider {
  constructor() {
    this.config = ENTERPRISE_MODELS.ollama;
    this.baseUrl = this.config.baseUrl;
    this.clusterNodes = this.config.clusterNodes;
    this.currentNodeIndex = 0;
    this.availableModels = new Set();
    this.modelStatus = new Map();
    
    this.initializeProvider();
  }

  // Initialize the provider
  async initializeProvider() {
    try {
      await this.updateAvailableModels();
      logger.info('Ollama provider initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Ollama provider:', error);
    }
  }

  // Get next available node (simple round-robin)
  getNextNode() {
    const node = this.clusterNodes[this.currentNodeIndex % this.clusterNodes.length];
    this.currentNodeIndex = (this.currentNodeIndex + 1) % this.clusterNodes.length;
    return node;
  }

  // Check if model is supported
  async supportsModel(modelId) {
    return this.availableModels.has(modelId) || 
           Object.keys(this.config.models).includes(modelId);
  }

  // Get model information
  getModelInfo(modelId) {
    return this.config.models[modelId] || null;
  }

  // Update available models from Ollama
  async updateAvailableModels() {
    try {
      const response = await axios.get(`${this.getNextNode()}/api/tags`, {
        timeout: 5000
      });

      if (response.data && response.data.models) {
        this.availableModels.clear();
        response.data.models.forEach(model => {
          this.availableModels.add(model.name);
          this.modelStatus.set(model.name, {
            size: model.size,
            modified_at: model.modified_at,
            available: true
          });
        });
      }
    } catch (error) {
      logger.error('Failed to update available models:', error);
    }
  }

  // Health check for load balancer
  async healthCheck() {
    try {
      const response = await axios.get(`${this.getNextNode()}/api/tags`, {
        timeout: 3000
      });
      return response.status === 200;
    } catch (error) {
      logger.error('Ollama health check failed:', error);
      return false;
    }
  }

  // Generate text using Ollama
  async generateText(modelId, prompt, options = {}) {
    const startTime = Date.now();
    
    try {
      // Validate model
      if (!await this.supportsModel(modelId)) {
        throw new Error(`Model ${modelId} is not available`);
      }

      // Prepare request payload
      const payload = {
        model: modelId,
        prompt: prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          top_p: options.top_p || 0.9,
          top_k: options.top_k || 40,
          repeat_penalty: options.repeat_penalty || 1.1,
          num_predict: options.maxTokens || 2048
        }
      };

      // Make request to Ollama
      const response = await axios.post(
        `${this.getNextNode()}/api/generate`,
        payload,
        {
          timeout: 60000, // 60 seconds timeout
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Log successful request
      logger.info(`Ollama request successful: ${modelId} (${responseTime}ms)`);

      return {
        success: true,
        text: response.data.response,
        model: modelId,
        responseTime,
        tokens: response.data.eval_count || 0,
        done: response.data.done || true
      };

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.error(`Ollama request failed: ${modelId} (${responseTime}ms)`, error);

      return {
        success: false,
        error: error.message,
        model: modelId,
        responseTime
      };
    }
  }

  // Stream text generation
  async generateTextStream(modelId, prompt, options = {}) {
    try {
      if (!await this.supportsModel(modelId)) {
        throw new Error(`Model ${modelId} is not available`);
      }

      const payload = {
        model: modelId,
        prompt: prompt,
        stream: true,
        options: {
          temperature: options.temperature || 0.7,
          top_p: options.top_p || 0.9,
          top_k: options.top_k || 40,
          repeat_penalty: options.repeat_penalty || 1.1,
          num_predict: options.maxTokens || 2048
        }
      };

      const response = await axios.post(
        `${this.getNextNode()}/api/generate`,
        payload,
        {
          timeout: 120000, // 2 minutes for streaming
          headers: {
            'Content-Type': 'application/json'
          },
          responseType: 'stream'
        }
      );

      return response.data;
    } catch (error) {
      logger.error(`Ollama stream request failed: ${modelId}`, error);
      throw error;
    }
  }

  // Download model
  async downloadModel(modelId) {
    try {
      logger.info(`Starting download for model: ${modelId}`);

      const response = await axios.post(
        `${this.getNextNode()}/api/pull`,
        { name: modelId },
        {
          timeout: 0, // No timeout for downloads
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Download completed for model: ${modelId}`);
      await this.updateAvailableModels();

      return {
        success: true,
        model: modelId,
        message: 'Model downloaded successfully'
      };

    } catch (error) {
      logger.error(`Failed to download model: ${modelId}`, error);
      return {
        success: false,
        model: modelId,
        error: error.message
      };
    }
  }

  // Get model status
  async getModelStatus(modelId) {
    const status = this.modelStatus.get(modelId);
    
    if (status) {
      return {
        available: status.available,
        size: status.size,
        modified_at: status.modified_at,
        model: modelId
      };
    }

    return {
      available: false,
      model: modelId
    };
  }

  // Get provider statistics
  getStats() {
    return {
      provider: 'ollama',
      availableModels: Array.from(this.availableModels),
      totalModels: this.availableModels.size,
      clusterNodes: this.clusterNodes.length,
      currentNode: this.currentNodeIndex
    };
  }

  // Get all available models
  async getAvailableModels() {
    await this.updateAvailableModels();
    return Array.from(this.availableModels);
  }

  // Check if provider is ready
  async isReady() {
    try {
      await this.healthCheck();
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = OllamaProvider; 