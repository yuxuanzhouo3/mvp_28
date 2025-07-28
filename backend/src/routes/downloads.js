/**
 * Copyright © 2024 Yuxuan Zhou. All rights reserved.
 * 
 * Downloads Routes
 * API endpoints for download management
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/downloads - Get user's downloads
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.userId;
  const db = getDatabase();

  const downloads = await new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM model_downloads WHERE user_id = ? ORDER BY started_at DESC',
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
    data: downloads,
    count: downloads.length
  });
}));

// GET /api/downloads/:id - Get specific download
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  const db = getDatabase();

  const download = await new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM model_downloads WHERE id = ? AND user_id = ?',
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

  if (!download) {
    return res.status(404).json({
      success: false,
      error: 'Download not found',
      message: 'Download not found or not owned by user'
    });
  }

  res.json({
    success: true,
    data: download
  });
}));

// DELETE /api/downloads/:id - Cancel download
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  const db = getDatabase();

  const result = await new Promise((resolve, reject) => {
    db.run(
      'UPDATE model_downloads SET status = ? WHERE id = ? AND user_id = ?',
      ['cancelled', id, userId],
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
      error: 'Download not found',
      message: 'Download not found or not owned by user'
    });
  }

  logger.info(`Download cancelled: ${id} for user ${userId}`);

  res.json({
    success: true,
    message: 'Download cancelled successfully'
  });
}));

module.exports = router; 