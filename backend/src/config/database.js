/**
 * Copyright © 2024 Yuxuan Zhou. All rights reserved.
 * 
 * Database Configuration
 * SQLite setup for MornGPT Backend
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');
const logger = require('../utils/logger');

const DB_PATH = path.join(__dirname, '../../data/morngpt.db');
const DB_DIR = path.dirname(DB_PATH);

let db = null;

// Ensure database directory exists
async function ensureDbDirectory() {
  try {
    await fs.ensureDir(DB_DIR);
    logger.info('Database directory ensured');
  } catch (error) {
    logger.error('Failed to create database directory:', error);
    throw error;
  }
}

// Initialize database tables
async function initializeTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          is_pro BOOLEAN DEFAULT FALSE,
          is_paid BOOLEAN DEFAULT FALSE,
          avatar TEXT,
          settings TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Chat sessions table
      db.run(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          model TEXT NOT NULL,
          model_type TEXT NOT NULL,
          category TEXT NOT NULL,
          is_model_locked BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Messages table
      db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          model TEXT,
          is_multi_gpt BOOLEAN DEFAULT FALSE,
          sub_tasks TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
        )
      `);

      // Files table
      db.run(`
        CREATE TABLE IF NOT EXISTS files (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          filename TEXT NOT NULL,
          original_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size INTEGER NOT NULL,
          path TEXT NOT NULL,
          uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Model downloads table
      db.run(`
        CREATE TABLE IF NOT EXISTS model_downloads (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          model_name TEXT NOT NULL,
          model_provider TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          progress INTEGER DEFAULT 0,
          file_path TEXT,
          file_size INTEGER,
          started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Bookmarks table
      db.run(`
        CREATE TABLE IF NOT EXISTS bookmarks (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          message_id TEXT NOT NULL,
          chat_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          custom_name TEXT,
          folder TEXT DEFAULT 'default',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
          FOREIGN KEY (chat_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
        )
      `);

      // Bookmark folders table
      db.run(`
        CREATE TABLE IF NOT EXISTS bookmark_folders (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          color TEXT DEFAULT '#6B7280',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Create indexes for better performance
      db.run('CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_model_downloads_user_id ON model_downloads(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_bookmark_folders_user_id ON bookmark_folders(user_id)');

      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          logger.error('Failed to enable foreign keys:', err);
          reject(err);
        } else {
          logger.info('Database tables initialized successfully');
          resolve();
        }
      });
    });
  });
}

// Initialize database
async function initializeDatabase() {
  try {
    await ensureDbDirectory();
    
    return new Promise((resolve, reject) => {
      db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          logger.error('Failed to connect to database:', err);
          reject(err);
        } else {
          logger.info('Connected to SQLite database');
          initializeTables()
            .then(resolve)
            .catch(reject);
        }
      });
    });
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

// Get database instance
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

// Close database connection
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          logger.error('Error closing database:', err);
          reject(err);
        } else {
          logger.info('Database connection closed');
          db = null;
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase
}; 