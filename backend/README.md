# MornGPT Backend API

**Copyright © 2024 Yuxuan Zhou. All rights reserved.**

Backend API server for the MornGPT Model Selection Platform. This server provides endpoints for user authentication, model management, chat functionality, file uploads, and AI model downloads.

## Features

- **User Authentication**: JWT-based authentication with registration and login
- **Model Management**: External AI model integration and local model downloads
- **Chat System**: Real-time chat sessions with AI models
- **File Management**: Secure file upload and storage
- **Download System**: AI model download management with progress tracking
- **Database**: SQLite database with proper indexing and relationships
- **Security**: Rate limiting, CORS, helmet security headers
- **Logging**: Comprehensive logging with Winston

## Tech Stack

- **Runtime**: Node.js with Express.js
- **Database**: SQLite3 with proper indexing
- **Authentication**: JWT tokens with bcrypt password hashing
- **File Upload**: Multer with validation and size limits
- **Logging**: Winston logger with file rotation
- **Security**: Helmet, CORS, rate limiting
- **AI Integration**: OpenAI, Anthropic, Google AI SDKs

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp env.example .env
   # Edit .env with your API keys and configuration
   ```

3. **Start the server**:
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

4. **Verify the server is running**:
   ```bash
   curl http://localhost:5000/health
   ```

## API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Models

- `GET /api/models` - Get all available models
- `GET /api/models/external` - Get external models only
- `GET /api/models/morngpt` - Get MornGPT models only
- `GET /api/models/:id` - Get specific model details
- `POST /api/models/download` - Start model download
- `GET /api/models/download/:id/status` - Get download status
- `GET /api/models/downloads` - Get user's downloads
- `DELETE /api/models/download/:id` - Cancel download

### Chat

- `GET /api/chat/sessions` - Get user's chat sessions
- `POST /api/chat/sessions` - Create new chat session
- `GET /api/chat/sessions/:id/messages` - Get messages for a session
- `POST /api/chat/sessions/:id/messages` - Send message
- `DELETE /api/chat/sessions/:id` - Delete chat session
- `PUT /api/chat/sessions/:id` - Update chat session

### Files

- `POST /api/files/upload` - Upload files
- `GET /api/files` - Get user's files
- `GET /api/files/:id` - Get specific file
- `DELETE /api/files/:id` - Delete file

### Users

- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `PUT /api/users/settings` - Update user settings
- `DELETE /api/users/account` - Delete user account

### Downloads

- `GET /api/downloads` - Get user's downloads
- `GET /api/downloads/:id` - Get specific download
- `DELETE /api/downloads/:id` - Cancel download

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_pro BOOLEAN DEFAULT FALSE,
  is_paid BOOLEAN DEFAULT FALSE,
  avatar TEXT,
  settings TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Chat Sessions Table
```sql
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  model TEXT NOT NULL,
  model_type TEXT NOT NULL,
  category TEXT NOT NULL,
  is_model_locked BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT,
  is_multi_gpt BOOLEAN DEFAULT FALSE,
  sub_tasks TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
);
```

### Files Table
```sql
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  path TEXT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

### Model Downloads Table
```sql
CREATE TABLE model_downloads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  file_path TEXT,
  file_size INTEGER,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `JWT_SECRET` | JWT signing secret | Required |
| `OPENAI_API_KEY` | OpenAI API key | Required for OpenAI models |
| `ANTHROPIC_API_KEY` | Anthropic API key | Required for Claude models |
| `GOOGLE_API_KEY` | Google AI API key | Required for Gemini models |

## Development

### Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # Database configuration
│   ├── controllers/
│   │   └── modelController.js   # Model operations
│   ├── middleware/
│   │   ├── auth.js              # Authentication middleware
│   │   └── errorHandler.js      # Error handling
│   ├── routes/
│   │   ├── auth.js              # Authentication routes
│   │   ├── chat.js              # Chat routes
│   │   ├── downloads.js         # Download routes
│   │   ├── files.js             # File routes
│   │   ├── models.js            # Model routes
│   │   └── users.js             # User routes
│   ├── utils/
│   │   └── logger.js            # Winston logger
│   └── server.js                # Main server file
├── uploads/                     # File upload directory
├── models/                      # Downloaded models
├── data/                        # SQLite database
├── logs/                        # Application logs
├── package.json
├── env.example
└── README.md
```

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Rate Limiting**: Request rate limiting per IP
- **CORS Protection**: Configurable CORS policies
- **Helmet Security**: Security headers
- **Input Validation**: Express-validator for request validation
- **File Upload Security**: File type and size validation
- **SQL Injection Protection**: Parameterized queries

## Logging

The application uses Winston for logging with the following features:

- **File Rotation**: Automatic log file rotation
- **Multiple Levels**: Error, warn, info, debug
- **Structured Logging**: JSON format for production
- **Console Output**: Colored output for development
- **Error Tracking**: Separate error log files

## Error Handling

- **Centralized Error Handler**: Global error handling middleware
- **Validation Errors**: Input validation error responses
- **Database Errors**: SQLite error handling
- **File System Errors**: File operation error handling
- **Network Errors**: External API error handling

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Deployment

### Production Setup

1. **Environment Variables**:
   ```bash
   NODE_ENV=production
   JWT_SECRET=your-production-secret
   # Add all required API keys
   ```

2. **Database**:
   - Ensure database directory exists
   - Set proper file permissions

3. **File Storage**:
   - Ensure uploads and models directories exist
   - Set proper file permissions

4. **Process Management**:
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start src/server.js --name morngpt-backend
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

## License

Copyright © 2024 Yuxuan Zhou. All rights reserved. 