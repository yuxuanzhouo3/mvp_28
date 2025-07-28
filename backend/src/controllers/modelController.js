/**
 * Copyright © 2024 Yuxuan Zhou. All rights reserved.
 * 
 * Model Controller
 * Handles AI model operations and downloads
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

// Model download configurations
const modelConfigs = {
  'GPT-3.5 Turbo': {
    provider: 'OpenAI',
    downloadUrl: 'https://huggingface.co/TheBloke/gpt-3.5-turbo-gguf/resolve/main/gpt-3.5-turbo.Q4_K_M.gguf',
    fileName: 'gpt-3.5-turbo.Q4_K_M.gguf',
    estimatedSize: 1024 * 1024 * 1024 * 2.5, // ~2.5GB
    format: 'gguf'
  },
  'Claude 3 Haiku': {
    provider: 'Anthropic',
    downloadUrl: 'https://huggingface.co/TheBloke/claude-3-haiku-gguf/resolve/main/claude-3-haiku.Q4_K_M.gguf',
    fileName: 'claude-3-haiku.Q4_K_M.gguf',
    estimatedSize: 1024 * 1024 * 1024 * 1.8, // ~1.8GB
    format: 'gguf'
  },
  'Gemini Flash': {
    provider: 'Google',
    downloadUrl: 'https://huggingface.co/TheBloke/gemini-flash-gguf/resolve/main/gemini-flash.Q4_K_M.gguf',
    fileName: 'gemini-flash.Q4_K_M.gguf',
    estimatedSize: 1024 * 1024 * 1024 * 2.0, // ~2.0GB
    format: 'gguf'
  },
  'Llama 3.1 8B': {
    provider: 'Meta',
    downloadUrl: 'https://huggingface.co/TheBloke/Llama-3.1-8B-gguf/resolve/main/llama-3.1-8b.Q4_K_M.gguf',
    fileName: 'llama-3.1-8b.Q4_K_M.gguf',
    estimatedSize: 1024 * 1024 * 1024 * 4.5, // ~4.5GB
    format: 'gguf'
  },
  'Mistral 7B': {
    provider: 'Mistral AI',
    downloadUrl: 'https://huggingface.co/TheBloke/Mistral-7B-v0.1-gguf/resolve/main/mistral-7b-v0.1.Q4_K_M.gguf',
    fileName: 'mistral-7b-v0.1.Q4_K_M.gguf',
    estimatedSize: 1024 * 1024 * 1024 * 4.0, // ~4.0GB
    format: 'gguf'
  },
  'CodeLlama': {
    provider: 'Meta',
    downloadUrl: 'https://huggingface.co/TheBloke/CodeLlama-7B-gguf/resolve/main/codellama-7b.Q4_K_M.gguf',
    fileName: 'codellama-7b.Q4_K_M.gguf',
    estimatedSize: 1024 * 1024 * 1024 * 4.2, // ~4.2GB
    format: 'gguf'
  }
};

// Start model download
async function downloadModel(userId, modelName, modelProvider) {
  const db = getDatabase();
  const downloadId = uuidv4();
  
  // Check if model is supported
  const modelConfig = modelConfigs[modelName];
  if (!modelConfig) {
    throw new Error(`Model '${modelName}' is not available for download`);
  }
  
  // Check if user already has this model
  const existingDownload = await new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM model_downloads WHERE user_id = ? AND model_name = ? AND status = ?',
      [userId, modelName, 'completed'],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });
  
  if (existingDownload) {
    throw new Error(`Model '${modelName}' is already downloaded`);
  }
  
  // Create download record
  await new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO model_downloads (id, user_id, model_name, model_provider, status, progress, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [downloadId, userId, modelName, modelProvider, 'pending', 0, modelConfig.estimatedSize],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      }
    );
  });
  
  // Start download in background
  startDownloadProcess(downloadId, userId, modelName, modelConfig);
  
  logger.info(`Model download started: ${modelName} for user ${userId}`);
  return downloadId;
}

// Start download process
async function startDownloadProcess(downloadId, userId, modelName, modelConfig) {
  const db = getDatabase();
  const modelsDir = path.join(__dirname, '../../models', userId);
  const filePath = path.join(modelsDir, modelConfig.fileName);
  
  try {
    // Ensure models directory exists
    await fs.ensureDir(modelsDir);
    
    // Update status to downloading
    await updateDownloadStatus(downloadId, 'downloading', 0);
    
    // Start download
    const response = await axios({
      method: 'GET',
      url: modelConfig.downloadUrl,
      responseType: 'stream',
      timeout: 300000, // 5 minutes timeout
      headers: {
        'User-Agent': 'MornGPT-Model-Downloader/1.0'
      }
    });
    
    const totalSize = parseInt(response.headers['content-length'], 10);
    let downloadedSize = 0;
    
    // Create write stream
    const writer = fs.createWriteStream(filePath);
    
    // Track download progress
    response.data.on('data', (chunk) => {
      downloadedSize += chunk.length;
      const progress = Math.round((downloadedSize / totalSize) * 100);
      
      // Update progress every 5%
      if (progress % 5 === 0) {
        updateDownloadStatus(downloadId, 'downloading', progress);
      }
    });
    
    // Handle download completion
    response.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // Verify file size
    const stats = await fs.stat(filePath);
    if (stats.size !== totalSize) {
      throw new Error('Downloaded file size does not match expected size');
    }
    
    // Update status to completed
    await updateDownloadStatus(downloadId, 'completed', 100, filePath, totalSize);
    
    logger.info(`Model download completed: ${modelName} for user ${userId}`);
    
  } catch (error) {
    logger.error(`Model download failed: ${modelName} for user ${userId}`, error);
    
    // Clean up partial download
    try {
      await fs.remove(filePath);
    } catch (cleanupError) {
      logger.warn('Failed to clean up partial download:', cleanupError);
    }
    
    // Update status to failed
    await updateDownloadStatus(downloadId, 'failed', 0);
    
    throw error;
  }
}

// Update download status
async function updateDownloadStatus(downloadId, status, progress, filePath = null, fileSize = null) {
  const db = getDatabase();
  
  const updateFields = ['status = ?', 'progress = ?'];
  const updateValues = [status, progress];
  
  if (filePath) {
    updateFields.push('file_path = ?');
    updateValues.push(filePath);
  }
  
  if (fileSize) {
    updateFields.push('file_size = ?');
    updateValues.push(fileSize);
  }
  
  if (status === 'completed' || status === 'failed') {
    updateFields.push('completed_at = ?');
    updateValues.push(new Date().toISOString());
  }
  
  updateValues.push(downloadId);
  
  await new Promise((resolve, reject) => {
    db.run(
      `UPDATE model_downloads SET ${updateFields.join(', ')} WHERE id = ?`,
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
}

// Get model download status
async function getModelStatus(downloadId, userId) {
  const db = getDatabase();
  
  const download = await new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM model_downloads WHERE id = ? AND user_id = ?',
      [downloadId, userId],
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
    throw new Error('Download not found');
  }
  
  return download;
}

// Get user's downloaded models
async function getUserModels(userId) {
  const db = getDatabase();
  
  const models = await new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM model_downloads WHERE user_id = ? AND status = ? ORDER BY completed_at DESC',
      [userId, 'completed'],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
  
  return models;
}

// Delete downloaded model
async function deleteModel(userId, modelName) {
  const db = getDatabase();
  
  // Get model info
  const model = await new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM model_downloads WHERE user_id = ? AND model_name = ? AND status = ?',
      [userId, modelName, 'completed'],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });
  
  if (!model) {
    throw new Error('Model not found or not downloaded');
  }
  
  // Delete file
  if (model.file_path && await fs.pathExists(model.file_path)) {
    await fs.remove(model.file_path);
  }
  
  // Delete database record
  await new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM model_downloads WHERE id = ?',
      [model.id],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      }
    );
  });
  
  logger.info(`Model deleted: ${modelName} for user ${userId}`);
}

// Get model statistics
async function getModelStats() {
  const db = getDatabase();
  
  const stats = await new Promise((resolve, reject) => {
    db.get(
      `SELECT 
        COUNT(*) as total_downloads,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_downloads,
        COUNT(CASE WHEN status = 'downloading' THEN 1 END) as active_downloads,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_downloads,
        SUM(CASE WHEN status = 'completed' THEN file_size ELSE 0 END) as total_size
      FROM model_downloads`,
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });
  
  return stats;
}

module.exports = {
  downloadModel,
  getModelStatus,
  getUserModels,
  deleteModel,
  getModelStats
}; 