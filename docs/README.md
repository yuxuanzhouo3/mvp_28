# Model Selection Platform

**Copyright © 2024 Yuxuan Zhou. All rights reserved.**

A fullstack application for model selection and download functionality. This MVP focuses on making one model work first and then expanding to support multiple models in future versions.

## Project Overview

### MVP_28 - External Model Integration Platform
This project implements a platform that integrates external AI models (OpenAI, Anthropic, Google, etc.) to provide users with access to various AI services. The focus is on:

- **External Model Integration**: Connect to third-party AI models (GPT-4, Claude, Gemini, etc.)
- **Download Client**: Implement a download system for AI models, starting with one model and expanding to others
- **Model Selection Interface**: Beautiful UI for users to choose and interact with different AI models
- **Unified Platform**: Single interface to access multiple external AI services

### MVP_29 - MornGPT Self-Models (Future)
The next iteration will implement and try to optimize it to be more fast and later implement MornGPT's own AI models from A-Z, providing:
- **Custom AI Models**: MornGPT's proprietary AI models
- **Specialized Domains**: Models for specific use cases (Growth Advisory, AI Coder, Medical Advice, etc.)
- **Complete Control**: Full ownership and control over the AI models

## Features

- **Model Selection**: Choose from available AI models (external models in MVP_28)
- **External Model Downloads**: Download models for local use
- **Modern UI**: Beautiful and intuitive user interface
- **Fullstack Architecture**: Frontend and backend integration
- **Real-time Chat**: Interactive chat interface with AI models
- **File Upload Support**: Upload documents and images for AI analysis
- **Voice & Video Input**: Pro features for voice and video interactions
- **Multi-Model Orchestration**: Coordinate multiple AI models for complex tasks

## Tech Stack

- **Frontend**: React with TypeScript, Tailwind CSS, Next.js
- **Backend**: Node.js with Express
- **Database**: SQLite (for MVP)
- **Model Management**: Local file system storage
- **AI Integration**: OpenAI, Anthropic, Google AI APIs

## Getting Started

1. Install dependencies:
   ```bash
   # Install frontend dependencies
   cd frontend
   npm install
   
   # Install backend dependencies
   cd ../backend
   npm install
   ```

2. Set up environment variables:
   ```bash
   # Backend .env
   cp backend/.env.example backend/.env
   # Add your API keys for external models
   ```

3. Start the development servers:
   ```bash
   # Start backend (from backend directory)
   npm run dev
   
   # Start frontend (from frontend directory)
   npm run dev
   ```

4. Open http://localhost:3000 in your browser

## Project Structure

```
├── frontend/          # React frontend application
│   ├── app/          # Next.js app directory
│   ├── components/   # UI components
│   └── public/       # Static assets
├── backend/           # Node.js backend API
│   ├── src/
│   │   ├── config/   # Configuration files
│   │   ├── controllers/ # Request handlers
│   │   ├── middleware/  # Express middleware
│   │   ├── models/      # Data models
│   │   ├── routes/      # API routes
│   │   └── utils/       # Utility functions
│   ├── uploads/      # File upload directory
│   └── docs/         # Backend documentation
├── models/            # Model storage directory
├── docs/              # Documentation
└── scripts/           # Utility scripts
```

## Development Roadmap

### MVP_28 (Current) - External Model Platform
- ✅ Frontend UI with model selection
- ✅ Chat interface with external models
- 🔄 Backend API for model integration
- 🔄 Download client for AI models
- 🔄 File upload and processing
- 🔄 Voice and video input support
- 🔄 Multi-model orchestration

### MVP_29 (Future) - MornGPT Self-Models
- 🔄 Custom AI model development
- 🔄 Specialized domain models (A-Z)
- 🔄 Model training and fine-tuning
- 🔄 Advanced model management
- 🔄 Performance optimization
- 🔄 Enterprise features

## API Endpoints

### Model Management
- `GET /api/models` - Get available models
- `POST /api/models/download` - Download a model
- `GET /api/models/:id/status` - Check download status

### Chat & Conversations
- `POST /api/chat` - Send message to AI model
- `GET /api/chat/sessions` - Get chat sessions
- `DELETE /api/chat/sessions/:id` - Delete chat session

### File Management
- `POST /api/upload` - Upload files
- `GET /api/files` - Get uploaded files
- `DELETE /api/files/:id` - Delete file

### User Management
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/user/profile` - Get user profile

## License

Copyright © 2024 Yuxuan Zhou. All rights reserved. 