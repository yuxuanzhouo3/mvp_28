# MornGPT Load Balancer Architecture Documentation

## Overview

The MornGPT backend uses a sophisticated load balancer system to manage multiple AI model providers, ensuring high availability, optimal performance, and intelligent fallback mechanisms.

## Architecture Components

### 1. Load Balancer (`backend/src/services/loadBalancer.js`)

The central orchestrator that manages provider selection, health monitoring, and request distribution.

#### Key Features:
- **Provider Registration**: Dynamically registers and manages multiple AI providers
- **Health Monitoring**: Continuous health checks for all providers
- **Intelligent Routing**: Selects the best available provider based on model support and health status
- **Request Distribution**: Balances load across healthy providers
- **Failure Handling**: Automatic fallback to alternative providers

#### Provider Priority Order:
1. **Real Provider** (External APIs) - Primary choice for production use
2. **Free Provider** (Local/Simulated) - Fallback for development and testing

### 2. Real Model Provider (`backend/src/services/providers/realModelProvider.js`)

Handles connections to actual external AI APIs with comprehensive fallback mechanisms.

#### Supported External APIs:
1. **OpenAI** - GPT-3.5, GPT-4, GPT-4o models
2. **Anthropic** - Claude 3 Haiku, Sonnet, Opus
3. **Google** - Gemini 1.5 Flash, Pro
4. **Cohere** - Command, Command-R models
5. **Groq** - Llama3, Mixtral models
6. **Mistral** - Mistral 7B, Small, Large
7. **Together AI** - Llama3, Mixtral models
8. **OpenRouter** - Auto-routing, GPT-4 models
9. **Fireworks** - Llama 8B, Mixtral models
10. **DeepInfra** - Phi3, Llama3 models
11. **AI21** - J2 Mid, Ultra models
12. **Replicate** - Llama, Mixtral models
13. **HuggingFace** - Various open-source models
14. **Ollama** - Local model hosting

#### Language Support:
- **Automatic Chinese Detection**: Detects Chinese characters in prompts
- **System Prompt Injection**: Adds language-specific instructions
- **Bilingual Responses**: Supports both English and Chinese outputs

### 3. Free Model Provider (`backend/src/services/providers/freeModelProvider.js`)

Local/simulated AI provider for development, testing, and fallback scenarios.

#### Supported Models:
- **llama3.1-8b** - Llama 3.1 8B model simulation
- **mistral-7b** - Mistral 7B model simulation
- **phi3-3.8b** - Phi-3 Mini model simulation
- **codellama-7b** - CodeLlama 7B model simulation

#### Features:
- **No External Dependencies**: Works without API keys
- **Fast Response Times**: Simulated responses for quick testing
- **Language Support**: Full Chinese and English support
- **Streaming Support**: Simulates real-time text generation

### 4. Ollama Provider (`backend/src/services/providers/ollamaProvider.js`)

Local model hosting provider using Ollama for running models locally.

#### Features:
- **Local Model Hosting**: Run models on your own hardware
- **No Internet Required**: Works completely offline
- **Model Download Management**: Automatic model downloading
- **Health Monitoring**: Continuous availability checking
- **Streaming Support**: Real-time text generation

## Request Flow

### 1. Request Initiation
```
User Request → Frontend → Backend Route → Load Balancer
```

### 2. Provider Selection
```
Load Balancer → Check Provider Health → Select Best Provider
```

### 3. Model Processing
```
Selected Provider → Model Validation → API Call → Response Generation
```

### 4. Response Delivery
```
Generated Response → Streaming/Chunking → Frontend Display
```

## Configuration

### Environment Variables
```bash
# Required for Real Provider
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GROQ_API_KEY=your_groq_key
COHERE_API_KEY=your_cohere_key

# Optional for Ollama
OLLAMA_BASE_URL=http://localhost:11434
```

## Error Handling

### Provider Failures
1. **API Rate Limits**: Automatic retry with exponential backoff
2. **Network Errors**: Immediate fallback to next provider
3. **Authentication Errors**: Skip provider and try alternatives
4. **Model Not Found**: Fallback to supported models

### Fallback Strategy
```javascript
// Cascading fallback system
for (const api of apis) {
  try {
    const result = await api.method.call(this, modelId, prompt, options);
    if (result && result.success) {
      return result;
    }
  } catch (error) {
    logger.error(`${api.name} API failed: ${error.message}`);
    continue; // Try next API
  }
}
// If all APIs fail, use FreeAPI fallback
return await this.generateWithFreeAPI(modelId, prompt, options);
```

## Performance Optimization

### Caching
- **Model Info Caching**: Cache model metadata to reduce API calls
- **Response Caching**: Cache common responses for faster delivery
- **Health Status Caching**: Cache provider health status

### Load Balancing
- **Round Robin**: Distribute requests across healthy providers
- **Weighted Selection**: Prefer faster/more reliable providers
- **Request Counting**: Track usage for load distribution

## Monitoring and Logging

### Health Metrics
- Provider availability status
- Response times per provider
- Error rates and types
- Model usage statistics

### Logging Levels
```javascript
// Info level for normal operations
logger.info(`Successfully generated with ${api.name} API`);

// Error level for failures
logger.error(`${api.name} API failed: ${error.message}`);

// Debug level for detailed troubleshooting
logger.debug(`Provider selection: ${selectedProvider.name}`);
```

## Security Considerations

### API Key Management
- Environment variable storage
- Secure transmission
- Key rotation support
- Access logging

### Rate Limiting
- Per-user rate limits
- Per-provider rate limits
- Burst protection
- Fair usage policies

## Troubleshooting

### Common Issues

1. **Provider Not Available**
   - Check provider health status
   - Verify API keys
   - Check network connectivity

2. **Model Not Supported**
   - Verify model ID
   - Check provider capabilities
   - Use fallback models

3. **Slow Response Times**
   - Monitor provider performance
   - Check network latency
   - Consider provider switching

### Debug Commands
```bash
# Check provider health
curl http://localhost:5000/health

# Test specific provider
curl -X POST http://localhost:5000/api/chat/stream-guest \
  -H "Content-Type: application/json" \
  -d '{"modelId":"llama3.1-8b","message":"test","language":"en"}'

# Check Ollama availability
curl http://localhost:11434/api/tags
```

This architecture ensures MornGPT provides reliable, fast, and scalable AI model access with comprehensive fallback mechanisms and excellent user experience.
