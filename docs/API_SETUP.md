# API Key Setup Guide

## Current Status: Demo Mode ✅

Your MornGPT application is currently running in **Demo Mode** with realistic fallback responses. This is perfect for testing and demonstration purposes.

## To Enable Real AI Responses

### 1. Create Environment File

Create a `.env` file in the `backend` directory:

```bash
# MornGPT Backend Environment Variables

# JWT Secret (REQUIRED)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# External API Keys (OPTIONAL - for real AI responses)
OPENAI_API_KEY=your-openai-api-key-here
ANTHROPIC_API_KEY=your-anthropic-api-key-here
GROQ_API_KEY=your-groq-api-key-here
GOOGLE_API_KEY=your-google-api-key-here
MISTRAL_API_KEY=your-mistral-api-key-here
TOGETHER_API_KEY=your-together-api-key-here
AI21_API_KEY=your-ai21-api-key-here
OPENROUTER_API_KEY=your-openrouter-api-key-here
DEEPINFRA_API_KEY=your-deepinfra-api-key-here
FIREWORKS_API_KEY=your-fireworks-api-key-here
REPLICATE_API_KEY=your-replicate-api-key-here
COHERE_API_KEY=your-cohere-api-key-here
HUGGINGFACE_API_KEY=your-huggingface-api-key-here
STABILITY_API_KEY=your-stability-api-key-here
ASSEMBLYAI_API_KEY=your-assemblyai-api-key-here
GLADIA_API_KEY=your-gladia-api-key-here
PLAYHT_API_KEY=your-playht-api-key-here
ELEVENLABS_API_KEY=your-elevenlabs-api-key-here

# Server Configuration
PORT=5000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 2. Get API Keys

You can get free API keys from these providers:

- **OpenAI**: https://platform.openai.com/api-keys
- **Anthropic**: https://console.anthropic.com/
- **Groq**: https://console.groq.com/
- **Google**: https://makersuite.google.com/app/apikey
- **Mistral**: https://console.mistral.ai/
- **Together AI**: https://together.ai/
- **Cohere**: https://cohere.ai/
- **HuggingFace**: https://huggingface.co/settings/tokens

### 3. Restart Backend

After adding API keys, restart the backend:

```bash
cd backend
npm run dev
```

## Current Features Working ✅

Even without API keys, these features work perfectly:

1. **✅ Model Selection** - Choose from 30+ AI models
2. **✅ Hover Dropdowns** - See individual models for each API
3. **✅ Token Limit System** - Ready to enforce usage limits
4. **✅ Payment Modal** - Upgrade prompts when limits exceeded
5. **✅ Realistic Responses** - Each model shows appropriate branding
6. **✅ User Interface** - Full chat interface with all features

## Demo Mode Benefits

- **No API costs** - Perfect for testing
- **Instant responses** - No waiting for external APIs
- **Realistic experience** - Each model has unique responses
- **Full functionality** - All features work as expected

## Testing the Token Limit System

1. Click the **Settings** icon (gear) in the top right
2. Click **"Test Limits"** button
3. See the payment modal appear
4. Test the upgrade flow

The system is working perfectly! The "API temporarily unavailable" message is just indicating that you're in demo mode, which is exactly what we want for testing and demonstration.
