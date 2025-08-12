/**
 * Authentication Routes
 * Handles user authentication endpoints
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Register new user
router.post('/register', authController.register);

// Login user
router.post('/login', authController.login);

// Google OAuth login
router.post('/google', authController.googleLogin);

// Request password reset
router.post('/reset-password', authController.requestPasswordReset);

// Reset password with token
router.post('/reset-password/confirm', authController.resetPassword);

// Verify token
router.get('/verify', authController.verifyToken);

// Get current user profile (requires auth)
router.get('/profile', authController.getProfile);

// Update user profile (requires auth)
router.put('/profile', authController.updateProfile);

// Change password (requires auth)
router.put('/change-password', authController.changePassword);

// Delete account (requires auth)
router.delete('/account', authController.deleteAccount);

// Logout
router.post('/logout', authController.logout);

module.exports = router; 