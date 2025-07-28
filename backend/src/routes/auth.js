/**
 * Copyright © 2024 Yuxuan Zhou. All rights reserved.
 * 
 * Authentication Routes
 * User login, registration, and token management
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { generateToken } = require('../middleware/auth');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/auth/register - User registration
router.post('/register', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').notEmpty().withMessage('Name is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, password, name } = req.body;
  const db = getDatabase();

  // Check if user already exists
  const existingUser = await new Promise((resolve, reject) => {
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });

  if (existingUser) {
    return res.status(400).json({
      success: false,
      error: 'User already exists',
      message: 'A user with this email already exists'
    });
  }

  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const defaultSettings = JSON.stringify({
    theme: 'light',
    language: 'en',
    notifications: true,
    soundEnabled: true,
    autoSave: true,
    sendHotkey: 'enter',
    shortcutsEnabled: true,
    adsEnabled: true
  });

  await new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO users (id, email, name, password_hash, settings) VALUES (?, ?, ?, ?, ?)',
      [userId, email, name, passwordHash, defaultSettings],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      }
    );
  });

  // Generate token
  const token = generateToken(userId);

  logger.info(`User registered: ${email} (${userId})`);

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: userId,
        email,
        name,
        isPro: false,
        isPaid: false
      },
      token
    },
    message: 'User registered successfully'
  });
}));

// POST /api/auth/login - User login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, password } = req.body;
  const db = getDatabase();

  // Find user
  const user = await new Promise((resolve, reject) => {
    db.get(
      'SELECT id, email, name, password_hash, is_pro, is_paid, avatar, settings FROM users WHERE email = ?',
      [email],
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
      success: false,
      error: 'Invalid credentials',
      message: 'Email or password is incorrect'
    });
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
      message: 'Email or password is incorrect'
    });
  }

  // Parse settings
  let settings = {};
  if (user.settings) {
    try {
      settings = JSON.parse(user.settings);
    } catch (error) {
      logger.warn('Failed to parse user settings:', error);
    }
  }

  // Generate token
  const token = generateToken(user.id);

  logger.info(`User logged in: ${email} (${user.id})`);

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isPro: user.is_pro,
        isPaid: user.is_paid,
        avatar: user.avatar,
        settings
      },
      token
    },
    message: 'Login successful'
  });
}));

// POST /api/auth/refresh - Refresh token
router.post('/refresh', asyncHandler(async (req, res) => {
  // This would typically verify the refresh token
  // For now, we'll return a simple response
  res.json({
    success: true,
    message: 'Token refresh endpoint - implement as needed'
  });
}));

// POST /api/auth/logout - User logout
router.post('/logout', asyncHandler(async (req, res) => {
  // In a real implementation, you might blacklist the token
  // For now, we'll just return success
  res.json({
    success: true,
    message: 'Logout successful'
  });
}));

// GET /api/auth/me - Get current user
router.get('/me', asyncHandler(async (req, res) => {
  // This endpoint would be protected by auth middleware
  // For now, we'll return a placeholder
  res.json({
    success: true,
    message: 'Get current user endpoint - implement with auth middleware'
  });
}));

module.exports = router; 