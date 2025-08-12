/**
 * Chat Model
 * Database operations for chat sessions
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

// Database connection
const dbPath = path.join(__dirname, '../../data/morngpt.db');
const db = new sqlite3.Database(dbPath);

// Initialize chat sessions table
const initChatTable = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        title TEXT NOT NULL,
        model TEXT NOT NULL,
        modelId TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        messageCount INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
      )
    `;

    db.run(sql, (err) => {
      if (err) {
        logger.error('Error creating chat_sessions table:', err);
        reject(err);
      } else {
        logger.info('Chat sessions table initialized');
        resolve();
      }
    });
  });
};

// Create chat session
const createChatSession = (chatSession) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO chat_sessions (id, userId, title, model, modelId, category, messageCount)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      chatSession.id,
      chatSession.userId,
      chatSession.title,
      chatSession.model,
      chatSession.modelId,
      chatSession.category,
      chatSession.messageCount || 0
    ];

    db.run(sql, params, function(err) {
      if (err) {
        logger.error('Error creating chat session:', err);
        reject(err);
      } else {
        resolve(chatSession);
      }
    });
  });
};

// Get chat sessions for user
const getChatSessions = (userId, chatId = null, limit = 50, offset = 0) => {
  return new Promise((resolve, reject) => {
    let sql, params;

    if (chatId) {
      // Get specific chat session
      sql = 'SELECT * FROM chat_sessions WHERE userId = ? AND id = ?';
      params = [userId, chatId];
    } else {
      // Get all chat sessions for user
      sql = 'SELECT * FROM chat_sessions WHERE userId = ? ORDER BY lastUpdated DESC LIMIT ? OFFSET ?';
      params = [userId, limit, offset];
    }

    if (chatId) {
      db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('Error getting chat session:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    } else {
      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Error getting chat sessions:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    }
  });
};

// Update chat session
const updateChatSession = (chatId, updateData) => {
  return new Promise((resolve, reject) => {
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    
    // Always update lastUpdated
    if (!fields.includes('lastUpdated')) {
      fields.push('lastUpdated');
      values.push(new Date().toISOString());
    }

    const sql = `UPDATE chat_sessions SET ${fields.map(field => `${field} = ?`).join(', ')} WHERE id = ?`;
    const params = [...values, chatId];

    db.run(sql, params, function(err) {
      if (err) {
        logger.error('Error updating chat session:', err);
        reject(err);
      } else {
        if (this.changes > 0) {
          // Return updated chat session
          getChatSessions(null, chatId).then(resolve).catch(reject);
        } else {
          resolve(null);
        }
      }
    });
  });
};

// Delete chat session
const deleteChatSession = (chatId) => {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM chat_sessions WHERE id = ?';

    db.run(sql, [chatId], function(err) {
      if (err) {
        logger.error('Error deleting chat session:', err);
        reject(err);
      } else {
        resolve(this.changes > 0);
      }
    });
  });
};

// Get chat session by ID (for any user - used by admin)
const getChatSessionById = (chatId) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM chat_sessions WHERE id = ?';

    db.get(sql, [chatId], (err, row) => {
      if (err) {
        logger.error('Error getting chat session by ID:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Get chat statistics for user
const getChatStats = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        COUNT(*) as totalChats,
        SUM(messageCount) as totalMessages,
        MAX(lastUpdated) as lastActivity
      FROM chat_sessions 
      WHERE userId = ?
    `;

    db.get(sql, [userId], (err, row) => {
      if (err) {
        logger.error('Error getting chat stats:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Initialize table on module load
initChatTable().catch(err => {
  logger.error('Failed to initialize chat_sessions table:', err);
});

module.exports = {
  createChatSession,
  getChatSessions,
  updateChatSession,
  deleteChatSession,
  getChatSessionById,
  getChatStats,
  initChatTable
}; 