/**
 * Database Configuration
 * SQLite database setup and initialization
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Database path
const dbPath = path.join(dataDir, 'morngpt.db');

// Initialize database
const initializeDatabase = async () => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error('Error opening database:', err);
        reject(err);
        return;
      }

      logger.info('Database connected successfully');
      
      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          logger.error('Error enabling foreign keys:', err);
        }
      });

      // Initialize tables
      Promise.all([
        require('../models/userModel').initUserTable(),
        require('../models/chatModel').initChatTable(),
        require('../models/messageModel').initMessageTable(),
        require('../services/rateLimitService').initRateLimitTable(),
        require('../models/usageModel').initUsageTable()
      ]).then(() => {
        logger.info('All database tables initialized');
        resolve();
      }).catch((error) => {
        logger.error('Error initializing database tables:', error);
        reject(error);
      });
    });
  });
};

// Get database connection
const getDatabase = () => {
  return new sqlite3.Database(dbPath);
};

// Close database connection
const closeDatabase = () => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.close((err) => {
      if (err) {
        logger.error('Error closing database:', err);
        reject(err);
      } else {
        logger.info('Database connection closed');
        resolve();
      }
    });
  });
};

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  dbPath
}; 