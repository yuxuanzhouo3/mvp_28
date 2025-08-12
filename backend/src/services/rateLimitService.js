/**
 * Rate Limiting Service
 * Manages rate limits for different user tiers
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

// Database connection
const dbPath = path.join(__dirname, '../../data/morngpt.db');
const db = new sqlite3.Database(dbPath);

// Initialize rate limiting table
const initRateLimitTable = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS rate_limits (
        userId TEXT NOT NULL,
        tier TEXT NOT NULL,
        requestsToday INTEGER DEFAULT 0,
        lastResetDate DATE DEFAULT CURRENT_DATE,
        PRIMARY KEY (userId)
      )
    `;

    db.run(sql, (err) => {
      if (err) {
        logger.error('Error creating rate_limits table:', err);
        reject(err);
      } else {
        logger.info('Rate limits table initialized');
        resolve();
      }
    });
  });
};

// Get user tier limits
const getTierLimits = (tier) => {
  const limits = {
    free: {
      maxRequestsPerDay: 100,
      maxRequestsPerHour: 10,
      maxConcurrentRequests: 1
    },
    basic: {
      maxRequestsPerDay: 1000,
      maxRequestsPerHour: 100,
      maxConcurrentRequests: 3
    },
    premium: {
      maxRequestsPerDay: 10000,
      maxRequestsPerHour: 1000,
      maxConcurrentRequests: 10
    },
    enterprise: {
      maxRequestsPerDay: 100000,
      maxRequestsPerHour: 10000,
      maxConcurrentRequests: 50
    }
  };

  return limits[tier] || limits.free;
};

// Check rate limit for user
const checkRateLimit = (userId, tier) => {
  return new Promise((resolve, reject) => {
    const today = new Date().toISOString().split('T')[0];
    const limits = getTierLimits(tier);

    const sql = `
      SELECT requestsToday, lastResetDate 
      FROM rate_limits 
      WHERE userId = ?
    `;

    db.get(sql, [userId], (err, row) => {
      if (err) {
        logger.error('Error checking rate limit:', err);
        reject(err);
        return;
      }

      if (!row) {
        // First time user, create record
        const insertSql = `
          INSERT INTO rate_limits (userId, tier, requestsToday, lastResetDate)
          VALUES (?, ?, 0, ?)
        `;

        db.run(insertSql, [userId, tier, today], (insertErr) => {
          if (insertErr) {
            logger.error('Error creating rate limit record:', insertErr);
            reject(insertErr);
          } else {
            resolve({
              allowed: true,
              remaining: limits.maxRequestsPerDay,
              message: `You have ${limits.maxRequestsPerDay} requests remaining today`
            });
          }
        });
        return;
      }

      // Check if we need to reset daily count
      if (row.lastResetDate !== today) {
        // Reset daily count
        const resetSql = `
          UPDATE rate_limits 
          SET requestsToday = 0, lastResetDate = ? 
          WHERE userId = ?
        `;

        db.run(resetSql, [today, userId], (resetErr) => {
          if (resetErr) {
            logger.error('Error resetting rate limit:', resetErr);
            reject(resetErr);
          } else {
            resolve({
              allowed: true,
              remaining: limits.maxRequestsPerDay,
              message: `You have ${limits.maxRequestsPerDay} requests remaining today`
            });
          }
        });
        return;
      }

      // Check current usage
      const remaining = limits.maxRequestsPerDay - row.requestsToday;
      const allowed = remaining > 0;

      resolve({
        allowed,
        remaining: Math.max(0, remaining),
        message: allowed 
          ? `You have ${remaining} requests remaining today`
          : `Daily limit exceeded. You can make ${limits.maxRequestsPerDay} requests per day.`,
        retryAfter: allowed ? null : new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });
    });
  });
};

// Increment usage for user
const incrementUsage = (userId, tier, modelId = null) => {
  return new Promise((resolve, reject) => {
    const today = new Date().toISOString().split('T')[0];

    const sql = `
      UPDATE rate_limits 
      SET requestsToday = requestsToday + 1 
      WHERE userId = ? AND lastResetDate = ?
    `;

    db.run(sql, [userId, today], function(err) {
      if (err) {
        logger.error('Error incrementing usage:', err);
        reject(err);
      } else {
        // Log usage for analytics
        logger.info(`Usage incremented for user ${userId}, tier: ${tier}, model: ${modelId}`);
        resolve(this.changes > 0);
      }
    });
  });
};

// Get usage statistics for user
const getUserUsage = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT tier, requestsToday, lastResetDate 
      FROM rate_limits 
      WHERE userId = ?
    `;

    db.get(sql, [userId], (err, row) => {
      if (err) {
        logger.error('Error getting user usage:', err);
        reject(err);
      } else {
        if (!row) {
          resolve(null);
          return;
        }

        const limits = getTierLimits(row.tier);
        resolve({
          tier: row.tier,
          usedToday: row.requestsToday,
          remainingToday: Math.max(0, limits.maxRequestsPerDay - row.requestsToday),
          maxPerDay: limits.maxRequestsPerDay,
          maxPerHour: limits.maxRequestsPerHour,
          lastResetDate: row.lastResetDate
        });
      }
    });
  });
};

// Get all usage statistics (for admin)
const getAllUsageStats = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        tier,
        COUNT(*) as userCount,
        SUM(requestsToday) as totalRequests,
        AVG(requestsToday) as avgRequests
      FROM rate_limits 
      GROUP BY tier
    `;

    db.all(sql, [], (err, rows) => {
      if (err) {
        logger.error('Error getting all usage stats:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Reset user's rate limit (for admin)
const resetUserRateLimit = (userId) => {
  return new Promise((resolve, reject) => {
    const today = new Date().toISOString().split('T')[0];

    const sql = `
      UPDATE rate_limits 
      SET requestsToday = 0, lastResetDate = ? 
      WHERE userId = ?
    `;

    db.run(sql, [today, userId], function(err) {
      if (err) {
        logger.error('Error resetting user rate limit:', err);
        reject(err);
      } else {
        resolve(this.changes > 0);
      }
    });
  });
};

// Initialize table on module load
initRateLimitTable().catch(err => {
  logger.error('Failed to initialize rate_limits table:', err);
});

module.exports = {
  checkRateLimit,
  incrementUsage,
  getUserUsage,
  getAllUsageStats,
  resetUserRateLimit,
  getTierLimits,
  initRateLimitTable
}; 