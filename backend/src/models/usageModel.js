/**
 * Usage Model
 * Tracks token usage for users and models
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

// Database path
const dbPath = path.join(__dirname, '../../data/morngpt.db');

// Initialize usage table
const initUsageTable = () => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        tokens_used INTEGER DEFAULT 0,
        messages_sent INTEGER DEFAULT 0,
        last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `;

    db.run(createTableSQL, (err) => {
      if (err) {
        logger.error('Error creating usage table:', err);
        reject(err);
      } else {
        logger.info('Usage table initialized');
        resolve();
      }
      db.close();
    });
  });
};

// Get user usage for a specific model
const getUserModelUsage = (userId, modelId) => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    const sql = `
      SELECT * FROM usage 
      WHERE user_id = ? AND model_id = ?
    `;
    
    db.get(sql, [userId, modelId], (err, row) => {
      if (err) {
        logger.error('Error getting user model usage:', err);
        reject(err);
      } else {
        resolve(row || { tokens_used: 0, messages_sent: 0 });
      }
      db.close();
    });
  });
};

// Update user usage
const updateUserUsage = (userId, modelId, tokensUsed, messagesSent = 1) => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    // First try to update existing record
    const updateSQL = `
      UPDATE usage 
      SET tokens_used = tokens_used + ?, 
          messages_sent = messages_sent + ?,
          last_used = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND model_id = ?
    `;
    
    db.run(updateSQL, [tokensUsed, messagesSent, userId, modelId], function(err) {
      if (err) {
        logger.error('Error updating user usage:', err);
        reject(err);
        return;
      }
      
      // If no rows were updated, create new record
      if (this.changes === 0) {
        const insertSQL = `
          INSERT INTO usage (id, user_id, model_id, tokens_used, messages_sent)
          VALUES (?, ?, ?, ?, ?)
        `;
        
        const usageId = require('uuid').v4();
        db.run(insertSQL, [usageId, userId, modelId, tokensUsed, messagesSent], (err) => {
          if (err) {
            logger.error('Error creating user usage record:', err);
            reject(err);
          } else {
            resolve();
          }
          db.close();
        });
      } else {
        resolve();
        db.close();
      }
    });
  });
};

// Get all usage for a user
const getUserUsage = (userId) => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    const sql = `
      SELECT * FROM usage 
      WHERE user_id = ?
      ORDER BY last_used DESC
    `;
    
    db.all(sql, [userId], (err, rows) => {
      if (err) {
        logger.error('Error getting user usage:', err);
        reject(err);
      } else {
        resolve(rows || []);
      }
      db.close();
    });
  });
};

// Reset user usage (for testing or admin purposes)
const resetUserUsage = (userId, modelId = null) => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    let sql, params;
    if (modelId) {
      sql = `DELETE FROM usage WHERE user_id = ? AND model_id = ?`;
      params = [userId, modelId];
    } else {
      sql = `DELETE FROM usage WHERE user_id = ?`;
      params = [userId];
    }
    
    db.run(sql, params, (err) => {
      if (err) {
        logger.error('Error resetting user usage:', err);
        reject(err);
      } else {
        resolve();
      }
      db.close();
    });
  });
};

module.exports = {
  initUsageTable,
  getUserModelUsage,
  updateUserUsage,
  getUserUsage,
  resetUserUsage
};
