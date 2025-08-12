/**
 * Message Model
 * Database operations for chat messages
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

// Database connection
const dbPath = path.join(__dirname, '../../data/morngpt.db');
const db = new sqlite3.Database(dbPath);

// Initialize messages table
const initMessageTable = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chatId TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        model TEXT,
        responseTime INTEGER,
        tokens INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chatId) REFERENCES chat_sessions (id) ON DELETE CASCADE
      )
    `;

    db.run(sql, (err) => {
      if (err) {
        logger.error('Error creating messages table:', err);
        reject(err);
      } else {
        logger.info('Messages table initialized');
        resolve();
      }
    });
  });
};

// Create message
const createMessage = (message) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO messages (id, chatId, role, content, model, responseTime, tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      message.id,
      message.chatId,
      message.role,
      message.content,
      message.model || null,
      message.responseTime || null,
      message.tokens || null
    ];

    db.run(sql, params, function(err) {
      if (err) {
        logger.error('Error creating message:', err);
        reject(err);
      } else {
        resolve(message);
      }
    });
  });
};

// Get messages by chat ID
const getMessagesByChatId = (chatId, limit = 100, offset = 0) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT * FROM messages 
      WHERE chatId = ? 
      ORDER BY timestamp ASC 
      LIMIT ? OFFSET ?
    `;

    db.all(sql, [chatId, limit, offset], (err, rows) => {
      if (err) {
        logger.error('Error getting messages by chat ID:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Get message by ID
const getMessageById = (messageId) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM messages WHERE id = ?';

    db.get(sql, [messageId], (err, row) => {
      if (err) {
        logger.error('Error getting message by ID:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Update message
const updateMessage = (messageId, updateData) => {
  return new Promise((resolve, reject) => {
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);

    const sql = `UPDATE messages SET ${fields.map(field => `${field} = ?`).join(', ')} WHERE id = ?`;
    const params = [...values, messageId];

    db.run(sql, params, function(err) {
      if (err) {
        logger.error('Error updating message:', err);
        reject(err);
      } else {
        if (this.changes > 0) {
          // Return updated message
          getMessageById(messageId).then(resolve).catch(reject);
        } else {
          resolve(null);
        }
      }
    });
  });
};

// Delete message
const deleteMessage = (messageId) => {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM messages WHERE id = ?';

    db.run(sql, [messageId], function(err) {
      if (err) {
        logger.error('Error deleting message:', err);
        reject(err);
      } else {
        resolve(this.changes > 0);
      }
    });
  });
};

// Get message statistics for chat
const getMessageStats = (chatId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        COUNT(*) as totalMessages,
        COUNT(CASE WHEN role = 'user' THEN 1 END) as userMessages,
        COUNT(CASE WHEN role = 'assistant' THEN 1 END) as assistantMessages,
        SUM(tokens) as totalTokens,
        AVG(responseTime) as avgResponseTime,
        MAX(timestamp) as lastMessage
      FROM messages 
      WHERE chatId = ?
    `;

    db.get(sql, [chatId], (err, row) => {
      if (err) {
        logger.error('Error getting message stats:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Search messages
const searchMessages = (userId, query, limit = 50, offset = 0) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT m.*, cs.title as chatTitle 
      FROM messages m
      JOIN chat_sessions cs ON m.chatId = cs.id
      WHERE cs.userId = ? AND m.content LIKE ?
      ORDER BY m.timestamp DESC
      LIMIT ? OFFSET ?
    `;

    const searchQuery = `%${query}%`;

    db.all(sql, [userId, searchQuery, limit, offset], (err, rows) => {
      if (err) {
        logger.error('Error searching messages:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Get recent messages for user
const getRecentMessages = (userId, limit = 20) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT m.*, cs.title as chatTitle 
      FROM messages m
      JOIN chat_sessions cs ON m.chatId = cs.id
      WHERE cs.userId = ?
      ORDER BY m.timestamp DESC
      LIMIT ?
    `;

    db.all(sql, [userId, limit], (err, rows) => {
      if (err) {
        logger.error('Error getting recent messages:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Initialize table on module load
initMessageTable().catch(err => {
  logger.error('Failed to initialize messages table:', err);
});

module.exports = {
  createMessage,
  getMessagesByChatId,
  getMessageById,
  updateMessage,
  deleteMessage,
  getMessageStats,
  searchMessages,
  getRecentMessages,
  initMessageTable
}; 