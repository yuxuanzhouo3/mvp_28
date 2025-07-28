/**
 * Copyright © 2024 Yuxuan Zhou. All rights reserved.
 * 
 * Files Routes
 * API endpoints for file upload and management
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { asyncHandler } = require('../middleware/errorHandler');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const userId = req.userId;
    const uploadDir = path.join(__dirname, '../../uploads', userId);
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 20 // Max 20 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/plain',
      'text/csv',
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json',
      'application/xml',
      'text/markdown',
      'text/html'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// POST /api/files/upload - Upload files
router.post('/upload', upload.array('files', 20), asyncHandler(async (req, res) => {
  const userId = req.userId;
  const db = getDatabase();
  const uploadedFiles = [];

  for (const file of req.files) {
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO files (id, user_id, filename, original_name, mime_type, size, path) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [fileId, userId, file.filename, file.originalname, file.mimetype, file.size, file.path],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this);
          }
        }
      );
    });

    uploadedFiles.push({
      id: fileId,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: file.path
    });
  }

  logger.info(`Files uploaded: ${uploadedFiles.length} files for user ${userId}`);

  res.status(201).json({
    success: true,
    data: uploadedFiles,
    message: `${uploadedFiles.length} file(s) uploaded successfully`
  });
}));

// GET /api/files - Get user's files
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.userId;
  const db = getDatabase();

  const files = await new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM files WHERE user_id = ? ORDER BY uploaded_at DESC',
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
    data: files,
    count: files.length
  });
}));

// GET /api/files/:id - Get specific file
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  const db = getDatabase();

  const file = await new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
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

  if (!file) {
    return res.status(404).json({
      success: false,
      error: 'File not found',
      message: 'File not found or not owned by user'
    });
  }

  res.json({
    success: true,
    data: file
  });
}));

// DELETE /api/files/:id - Delete file
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  const db = getDatabase();

  // Get file info first
  const file = await new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
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

  if (!file) {
    return res.status(404).json({
      success: false,
      error: 'File not found',
      message: 'File not found or not owned by user'
    });
  }

  // Delete file from filesystem
  try {
    await fs.remove(file.path);
  } catch (error) {
    logger.warn('Failed to delete file from filesystem:', error);
  }

  // Delete from database
  await new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM files WHERE id = ?',
      [id],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      }
    );
  });

  logger.info(`File deleted: ${file.original_name} for user ${userId}`);

  res.json({
    success: true,
    message: 'File deleted successfully'
  });
}));

module.exports = router; 