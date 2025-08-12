/**
 * User Model
 * Database operations for user management
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

// Database connection
const dbPath = path.join(__dirname, '../../data/morngpt.db');
const db = new sqlite3.Database(dbPath);

// Initialize user table
const initUserTable = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT,
        name TEXT NOT NULL,
        isPro BOOLEAN DEFAULT FALSE,
        isPaid BOOLEAN DEFAULT FALSE,
        tier TEXT DEFAULT 'free',
        currentPlan TEXT,
        googleId TEXT,
        avatar TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastLogin DATETIME DEFAULT CURRENT_TIMESTAMP,
        settings TEXT DEFAULT '{}'
      )
    `;

    db.run(sql, (err) => {
      if (err) {
        logger.error('Error creating users table:', err);
        reject(err);
      } else {
        logger.info('Users table initialized');
        resolve();
      }
    });
  });
};

// Create user
const createUser = (user) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO users (id, email, password, name, isPro, isPaid, tier, googleId, avatar, settings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      user.id,
      user.email,
      user.password,
      user.name,
      user.isPro,
      user.isPaid,
      user.tier,
      user.googleId || null,
      user.avatar || null,
      JSON.stringify(user.settings)
    ];

    db.run(sql, params, function(err) {
      if (err) {
        logger.error('Error creating user:', err);
        reject(err);
      } else {
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        resolve(userWithoutPassword);
      }
    });
  });
};

// Get user by email
const getUserByEmail = (email) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM users WHERE email = ?';

    db.get(sql, [email], (err, row) => {
      if (err) {
        logger.error('Error getting user by email:', err);
        reject(err);
      } else {
        if (row) {
          // Parse settings JSON
          row.settings = JSON.parse(row.settings || '{}');
        }
        resolve(row);
      }
    });
  });
};

// Get user by ID
const getUserById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM users WHERE id = ?';

    db.get(sql, [id], (err, row) => {
      if (err) {
        logger.error('Error getting user by ID:', err);
        reject(err);
      } else {
        if (row) {
          // Parse settings JSON
          row.settings = JSON.parse(row.settings || '{}');
        }
        resolve(row);
      }
    });
  });
};

// Update user
const updateUser = (userId, updateData) => {
  return new Promise((resolve, reject) => {
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    
    // Handle settings object
    const settingsIndex = fields.indexOf('settings');
    if (settingsIndex !== -1) {
      values[settingsIndex] = JSON.stringify(values[settingsIndex]);
    }

    const sql = `UPDATE users SET ${fields.map(field => `${field} = ?`).join(', ')} WHERE id = ?`;
    const params = [...values, userId];

    db.run(sql, params, function(err) {
      if (err) {
        logger.error('Error updating user:', err);
        reject(err);
      } else {
        if (this.changes > 0) {
          // Return updated user
          getUserById(userId).then(resolve).catch(reject);
        } else {
          resolve(null);
        }
      }
    });
  });
};

// Delete user
const deleteUser = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM users WHERE id = ?';

    db.run(sql, [userId], function(err) {
      if (err) {
        logger.error('Error deleting user:', err);
        reject(err);
      } else {
        resolve(this.changes > 0);
      }
    });
  });
};

// Get all users (for admin)
const getAllUsers = (limit = 100, offset = 0) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT id, email, name, isPro, isPaid, tier, createdAt, lastLogin FROM users LIMIT ? OFFSET ?';

    db.all(sql, [limit, offset], (err, rows) => {
      if (err) {
        logger.error('Error getting all users:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Initialize table on module load
initUserTable().catch(err => {
  logger.error('Failed to initialize users table:', err);
});

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  updateUser,
  deleteUser,
  getAllUsers,
  initUserTable
}; 