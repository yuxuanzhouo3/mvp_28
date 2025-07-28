/**
 * Copyright © 2024 Yuxuan Zhou. All rights reserved.
 * 
 * Chat Routes
 * API endpoints for chat sessions and messages
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/chat/sessions - Get user's chat sessions
router.get('/sessions', asyncHandler(async (req, res) => {
  const userId = req.userId;
  const db = getDatabase();

  const sessions = await new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC',
      [userId],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });

  res.json({
    success: true,
    data: sessions,
    count: sessions.length
  });
}));

// POST /api/chat/sessions - Create new chat session
router.post('/sessions', [
  body('title').notEmpty().withMessage('Title is required'),
  body('model').notEmpty().withMessage('Model is required'),
  body('modelType').notEmpty().withMessage('Model type is required'),
  body('category').notEmpty().withMessage('Category is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: errors.array()
    });
  }

  const { title, model, modelType, category } = req.body;
  const userId = req.userId;
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const db = getDatabase();

  await new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO chat_sessions (id, user_id, title, model, model_type, category) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, userId, title, model, modelType, category],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      }
    );
  });

  const newSession = await new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM chat_sessions WHERE id = ?',
      [sessionId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });

  res.status(201).json({
    success: true,
    data: newSession,
    message: 'Chat session created successfully'
  });
}));

// GET /api/chat/sessions/:id/messages - Get messages for a session
router.get('/sessions/:id/messages', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  const db = getDatabase();

  // Verify session belongs to user
  const session = await new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?',
      [id, userId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found',
      message: 'Chat session not found or not owned by user'
    });
  }

  const messages = await new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC',
      [id],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });

  res.json({
    success: true,
    data: {
      session,
      messages
    }
  });
}));

// POST /api/chat/sessions/:id/messages - Send message
router.post('/sessions/:id/messages', [
  body('content').notEmpty().withMessage('Message content is required'),
  body('role').isIn(['user', 'assistant', 'system']).withMessage('Invalid role')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const { content, role, model, isMultiGPT, subTasks } = req.body;
  const userId = req.userId;
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const db = getDatabase();

  // Verify session belongs to user
  const session = await new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?',
      [id, userId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found',
      message: 'Chat session not found or not owned by user'
    });
  }

  // Insert message
  await new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO messages (id, session_id, role, content, model, is_multi_gpt, sub_tasks) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [messageId, id, role, content, model, isMultiGPT || false, subTasks ? JSON.stringify(subTasks) : null],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      }
    );
  });

  // Update session timestamp
  await new Promise((resolve, reject) => {
    db.run(
      'UPDATE chat_sessions SET updated_at = ? WHERE id = ?',
      [new Date().toISOString(), id],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      }
    );
  });

  const newMessage = await new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM messages WHERE id = ?',
      [messageId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });

  res.status(201).json({
    success: true,
    data: newMessage,
    message: 'Message sent successfully'
  });
}));

// DELETE /api/chat/sessions/:id - Delete chat session
router.delete('/sessions/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  const db = getDatabase();

  const result = await new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM chat_sessions WHERE id = ? AND user_id = ?',
      [id, userId],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      }
    );
  });

  if (result.changes === 0) {
    return res.status(404).json({
      success: false,
      error: 'Session not found',
      message: 'Chat session not found or not owned by user'
    });
  }

  res.json({
    success: true,
    message: 'Chat session deleted successfully'
  });
}));

// PUT /api/chat/sessions/:id - Update chat session
router.put('/sessions/:id', [
  body('title').optional().notEmpty().withMessage('Title cannot be empty')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const { title } = req.body;
  const userId = req.userId;
  const db = getDatabase();

  const updateFields = [];
  const updateValues = [];

  if (title) {
    updateFields.push('title = ?');
    updateValues.push(title);
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
  updateValues.push(id, userId);

  const result = await new Promise((resolve, reject) => {
    db.run(
      `UPDATE chat_sessions SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`,
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

  if (result.changes === 0) {
    return res.status(404).json({
      success: false,
      error: 'Session not found',
      message: 'Chat session not found or not owned by user'
    });
  }

  const updatedSession = await new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM chat_sessions WHERE id = ?',
      [id],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });

  res.json({
    success: true,
    data: updatedSession,
    message: 'Chat session updated successfully'
  });
}));

module.exports = router; 