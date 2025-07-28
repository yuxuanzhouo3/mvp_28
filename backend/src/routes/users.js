/**
 * Copyright © 2024 Yuxuan Zhou. All rights reserved.
 * 
 * Users Routes
 * API endpoints for user profile management
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/users/profile - Get user profile
router.get('/profile', asyncHandler(async (req, res) => {
  const userId = req.userId;
  const db = getDatabase();

  const user = await new Promise((resolve, reject) => {
    db.get(
      'SELECT id, email, name, is_pro, is_paid, avatar, settings, created_at, updated_at FROM users WHERE id = ?',
      [userId],
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
    return res.status(404).json({
      success: false,
      error: 'User not found',
      message: 'User not found'
    });
  }

  // Parse settings
  if (user.settings) {
    try {
      user.settings = JSON.parse(user.settings);
    } catch (error) {
      logger.warn('Failed to parse user settings:', error);
      user.settings = {};
    }
  }

  res.json({
    success: true,
    data: user
  });
}));

// PUT /api/users/profile - Update user profile
router.put('/profile', [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('avatar').optional().isURL().withMessage('Avatar must be a valid URL')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: errors.array()
    });
  }

  const { name, avatar } = req.body;
  const userId = req.userId;
  const db = getDatabase();

  const updateFields = [];
  const updateValues = [];

  if (name) {
    updateFields.push('name = ?');
    updateValues.push(name);
  }

  if (avatar) {
    updateFields.push('avatar = ?');
    updateValues.push(avatar);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No fields to update',
      message: 'Please provide at least one field to update'
    });
  }

  updateFields.push('updated_at = ?');
  updateValues.push(new Date().toISOString());
  updateValues.push(userId);

  await new Promise((resolve, reject) => {
    db.run(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues,
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      }
    );
  });

  const updatedUser = await new Promise((resolve, reject) => {
    db.get(
      'SELECT id, email, name, is_pro, is_paid, avatar, settings, created_at, updated_at FROM users WHERE id = ?',
      [userId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });

  // Parse settings
  if (updatedUser.settings) {
    try {
      updatedUser.settings = JSON.parse(updatedUser.settings);
    } catch (error) {
      logger.warn('Failed to parse user settings:', error);
      updatedUser.settings = {};
    }
  }

  logger.info(`User profile updated: ${userId}`);

  res.json({
    success: true,
    data: updatedUser,
    message: 'Profile updated successfully'
  });
}));

// PUT /api/users/settings - Update user settings
router.put('/settings', [
  body('settings').isObject().withMessage('Settings must be an object')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: errors.array()
    });
  }

  const { settings } = req.body;
  const userId = req.userId;
  const db = getDatabase();

  // Get current settings
  const currentUser = await new Promise((resolve, reject) => {
    db.get(
      'SELECT settings FROM users WHERE id = ?',
      [userId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });

  if (!currentUser) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
      message: 'User not found'
    });
  }

  // Merge with existing settings
  let currentSettings = {};
  if (currentUser.settings) {
    try {
      currentSettings = JSON.parse(currentUser.settings);
    } catch (error) {
      logger.warn('Failed to parse current user settings:', error);
    }
  }

  const mergedSettings = { ...currentSettings, ...settings };

  await new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET settings = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(mergedSettings), new Date().toISOString(), userId],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      }
    );
  });

  logger.info(`User settings updated: ${userId}`);

  res.json({
    success: true,
    data: mergedSettings,
    message: 'Settings updated successfully'
  });
}));

// DELETE /api/users/account - Delete user account
router.delete('/account', asyncHandler(async (req, res) => {
  const userId = req.userId;
  const db = getDatabase();

  // Delete user's files, chats, and other data will be handled by foreign key constraints
  await new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM users WHERE id = ?',
      [userId],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      }
    );
  });

  logger.info(`User account deleted: ${userId}`);

  res.json({
    success: true,
    message: 'Account deleted successfully'
  });
}));

module.exports = router; 