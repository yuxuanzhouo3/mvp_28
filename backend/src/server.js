/**
 * Copyright © 2024 Yuxuan Zhou. All rights reserved.
 * 
 * MornGPT Backend Server
 * Main server file for the AI Model Selection Platform
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Debug: Check if environment variables are loaded
console.log('Environment variables loaded:');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');
console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'SET' : 'NOT SET');
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET');
console.log('COHERE_API_KEY:', process.env.COHERE_API_KEY ? 'SET' : 'NOT SET');

// Import routes
const authRoutes = require('./routes/auth');
const modelRoutes = require('./routes/models');
const chatRoutes = require('./routes/chat');
const fileRoutes = require('./routes/files');
const userRoutes = require('./routes/users');
const downloadRoutes = require('./routes/downloads');

// Import middleware
const { authMiddleware } = require('./middleware/auth');
const logger = require('./utils/logger');

// Import database initialization
const { initializeDatabase } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const allowedOriginsEnv = process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004,http://localhost:3005,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002,http://127.0.0.1:3003,http://127.0.0.1:3004,http://127.0.0.1:3005,https://mornhub.net,https://www.mornhub.net';
const allowedOrigins = allowedOriginsEnv
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (no origin) and allow all origins in non-production for easy local/LAN testing
    if (!origin || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // Allow both www and non-www versions of the domain
    const allowedDomains = [
      'https://mornhub.net',
      'https://www.mornhub.net',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:3005',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3002',
      'http://127.0.0.1:3003',
      'http://127.0.0.1:3004',
      'http://127.0.0.1:3005'
    ];
    
    const isAllowed = allowedDomains.some(domain => origin.startsWith(domain));
    if (isAllowed) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/models', modelRoutes);

// Chat routes - allow guest access for local testing
app.use('/api/chat', (req, res, next) => {
  // For local development, allow unauthenticated access to send endpoint
  if (req.path === '/send' && process.env.NODE_ENV === 'development') {
    req.user = { userId: 'guest', email: 'guest@local.dev', tier: 'free' };
  }
  next();
}, chatRoutes);

app.use('/api/files', authMiddleware, fileRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/downloads', authMiddleware, downloadRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'MornGPT Backend API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      models: '/api/models',
      chat: '/api/chat',
      files: '/api/files',
      users: '/api/users',
      downloads: '/api/downloads'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    logger.info('Database initialized successfully');
    
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 MornGPT Backend Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app; 