/**
 * Load Balancer Service
 * Manages model providers and distributes requests
 */

const logger = require('../utils/logger');
const FreeModelProvider = require('./providers/freeModelProvider');
const RealModelProvider = require('./providers/realModelProvider');

class LoadBalancer {
  constructor() {
    this.providers = new Map();
    this.healthStatus = new Map();
    this.requestCounts = new Map();
    this.failureCounts = new Map();
    
    // Initialize with free model provider
    this.initializeProviders();
  }

  // Initialize providers
  initializeProviders() {
    try {
      // Add real model provider first (for actual AI models)
      const realProvider = new RealModelProvider();
      this.registerProvider('real-provider', realProvider);
      
      // Add free model provider as fallback
      const freeProvider = new FreeModelProvider();
      this.registerProvider('free-provider', freeProvider);
      
      logger.info('Load balancer initialized with real and free model providers');
    } catch (error) {
      logger.error('Error initializing load balancer providers:', error);
    }
  }

  // Register a provider
  registerProvider(providerId, provider) {
    this.providers.set(providerId, provider);
    this.healthStatus.set(providerId, true);
    this.requestCounts.set(providerId, 0);
    this.failureCounts.set(providerId, 0);
    
    logger.info(`Provider registered: ${providerId}`);
  }

  // Get next available provider
  async getNextProvider(modelId, userTier = 'free') {
    try {
      // Try real provider first
      const realProvider = this.providers.get('real-provider');
      if (realProvider && this.healthStatus.get('real-provider')) {
        const supportsModel = await realProvider.supportsModel(modelId);
        if (supportsModel) {
          const currentCount = this.requestCounts.get('real-provider') || 0;
          this.requestCounts.set('real-provider', currentCount + 1);
          return realProvider;
        }
      }

      // Fallback to free provider
      const freeProvider = this.providers.get('free-provider');
      
      if (!freeProvider) {
        throw new Error('No available providers');
      }

      // Check if provider supports the model
      const supportsModel = await freeProvider.supportsModel(modelId);
      if (!supportsModel) {
        throw new Error(`Model ${modelId} not supported by any provider`);
      }

      // Check health status
      if (!this.healthStatus.get('free-provider')) {
        throw new Error('Provider is unhealthy');
      }

      // Increment request count
      const currentCount = this.requestCounts.get('free-provider') || 0;
      this.requestCounts.set('free-provider', currentCount + 1);

      return freeProvider;

    } catch (error) {
      logger.error('Error getting next provider:', error);
      throw error;
    }
  }

  // Get healthy providers for a model
  async getHealthyProviders(modelId) {
    const healthyProviders = [];

    for (const [providerId, provider] of this.providers) {
      if (this.healthStatus.get(providerId)) {
        const supportsModel = await provider.supportsModel(modelId);
        if (supportsModel) {
          healthyProviders.push(provider);
        }
      }
    }

    return healthyProviders;
  }

  // Record request success/failure
  recordRequest(providerId, success = true) {
    if (success) {
      // Reset failure count on success
      this.failureCounts.set(providerId, 0);
    } else {
      // Increment failure count
      const currentFailures = this.failureCounts.get(providerId) || 0;
      this.failureCounts.set(providerId, currentFailures + 1);

      // Mark as unhealthy if too many failures
      if (currentFailures >= 3) {
        this.markProviderUnhealthy(providerId);
      }
    }
  }

  // Mark provider as unhealthy
  markProviderUnhealthy(providerId) {
    this.healthStatus.set(providerId, false);
    logger.warn(`Provider marked as unhealthy: ${providerId}`);
  }

  // Mark provider as healthy
  markProviderHealthy(providerId) {
    this.healthStatus.set(providerId, true);
    this.failureCounts.set(providerId, 0);
    logger.info(`Provider marked as healthy: ${providerId}`);
  }

  // Perform health checks
  async performHealthChecks() {
    for (const [providerId, provider] of this.providers) {
      try {
        const health = await provider.healthCheck();
        if (health.healthy) {
          this.markProviderHealthy(providerId);
        } else {
          this.markProviderUnhealthy(providerId);
        }
      } catch (error) {
        logger.error(`Health check failed for provider ${providerId}:`, error);
        this.markProviderUnhealthy(providerId);
      }
    }
  }

  // Get load balancer statistics
  getStats() {
    const stats = {
      totalProviders: this.providers.size,
      healthyProviders: 0,
      unhealthyProviders: 0,
      totalRequests: 0,
      providers: []
    };

    for (const [providerId, provider] of this.providers) {
      const isHealthy = this.healthStatus.get(providerId);
      const requestCount = this.requestCounts.get(providerId) || 0;
      const failureCount = this.failureCounts.get(providerId) || 0;

      if (isHealthy) {
        stats.healthyProviders++;
      } else {
        stats.unhealthyProviders++;
      }

      stats.totalRequests += requestCount;

      stats.providers.push({
        id: providerId,
        name: provider.name,
        type: provider.type,
        healthy: isHealthy,
        requestCount,
        failureCount
      });
    }

    return stats;
  }

  // Get available models across all providers
  async getAvailableModels() {
    const allModels = [];

    for (const [providerId, provider] of this.providers) {
      if (this.healthStatus.get(providerId)) {
        try {
          const models = await provider.getAvailableModels();
          allModels.push(...models.map(model => ({
            ...model,
            provider: provider.name,
            providerId
          })));
        } catch (error) {
          logger.error(`Error getting models from provider ${providerId}:`, error);
        }
      }
    }

    return allModels;
  }
}

// Create singleton instance
const loadBalancer = new LoadBalancer();

// Start periodic health checks
setInterval(() => {
  loadBalancer.performHealthChecks();
}, 30000); // Check every 30 seconds

module.exports = loadBalancer; 