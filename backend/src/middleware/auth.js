/**
 * Copyright © 2024 Yuxuan Zhou. All rights reserved.
 * 
 * Authentication Middleware
 * JWT token verification for MornGPT Backend
 */

const jwt = require('jsonwebtoken');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Verify JWT token middleware
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access token required',
        message: 'Please provide a valid Bearer token'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({
        error: 'Invalid token format',
        message: 'Token must be provided in Bearer format'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (!decoded.userId) {
      return res.status(401).json({
        error: 'Invalid token payload',
        message: 'Token does not contain valid user information'
      });
    }

    // Get database instance
    const db = getDatabase();
    
    // Verify user exists in database
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, email, name, is_pro, is_paid, avatar, settings FROM users WHERE id = ?',
        [decoded.userId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        message: 'User associated with this token no longer exists'
      });
    }

    // Parse settings if they exist
    if (user.settings) {
      try {
        user.settings = JSON.parse(user.settings);
      } catch (error) {
        logger.warn('Failed to parse user settings:', error);
        user.settings = {};
      }
    }

    // Attach user to request object
    req.user = user;
    req.userId = user.id;
    
    logger.info(`User authenticated: ${user.email} (${user.id})`);
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid or malformed'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'The provided token has expired. Please login again'
      });
    }
    
    logger.error('Authentication middleware error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication'
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next(); // Continue without authentication
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (!decoded.userId) {
      return next(); // Continue without authentication
    }

    // Get database instance
    const db = getDatabase();
    
    // Verify user exists in database
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, email, name, is_pro, is_paid, avatar, settings FROM users WHERE id = ?',
        [decoded.userId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });

    if (user) {
      // Parse settings if they exist
      if (user.settings) {
        try {
          user.settings = JSON.parse(user.settings);
        } catch (error) {
          logger.warn('Failed to parse user settings:', error);
          user.settings = {};
        }
      }

      // Attach user to request object
      req.user = user;
      req.userId = user.id;
      
      logger.info(`User authenticated (optional): ${user.email} (${user.id})`);
    }
    
    next();
    
  } catch (error) {
    // For optional auth, we just continue without authentication
    logger.warn('Optional authentication failed:', error.message);
    next();
  }
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: '7d' } // Token expires in 7 days
  );
};

// Verify user has Pro access
const requireProAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please login to access this feature'
    });
  }

  if (!req.user.is_pro) {
    return res.status(403).json({
      error: 'Pro access required',
      message: 'This feature requires a Pro subscription'
    });
  }

  next();
};

// Verify user has paid access
const requirePaidAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please login to access this feature'
    });
  }

  if (!req.user.is_paid) {
    return res.status(403).json({
      error: 'Paid access required',
      message: 'This feature requires a paid subscription'
    });
  }

  next();
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  generateToken,
  requireProAccess,
  requirePaidAccess
}; 