/**
 * Authentication Controller
 * Handles user registration, login, and authentication for remote users
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { getUserByEmail, createUser, updateUser, deleteUser } = require('../models/userModel');

class AuthController {
  // Register new user
  async register(req, res) {
    try {
      const { email, password, name } = req.body;

      // Validation
      if (!email || !password || !name) {
        return res.status(400).json({
          success: false,
          message: 'Email, password, and name are required'
        });
      }

      // Check if user already exists
      const existingUser = await getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = {
        id: uuidv4(),
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        isPro: false,
        isPaid: false,
        tier: 'free',
        createdAt: new Date(),
        lastLogin: new Date(),
        settings: {
          theme: 'light',
          language: 'en',
          notifications: true,
          soundEnabled: true,
          autoSave: true,
          sendHotkey: 'enter',
          shortcutsEnabled: true,
          adsEnabled: true
        }
      };

      const createdUser = await createUser(user);

      // Generate JWT token
      const token = jwt.sign(
        { userId: createdUser.id, email: createdUser.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Remove password from response
      const { password: _, ...userResponse } = createdUser;

      logger.info(`New user registered: ${email}`);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: userResponse,
        token
      });

    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during registration'
      });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Find user
      const user = await getUserByEmail(email.toLowerCase());
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Update last login
      await updateUser(user.id, { lastLogin: new Date() });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Remove password from response
      const { password: _, ...userResponse } = user;

      logger.info(`User logged in: ${email}`);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        user: userResponse,
        token
      });

    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during login'
      });
    }
  }

  // Google OAuth login (simulated)
  async googleLogin(req, res) {
    try {
      const { email, name, googleId, avatar } = req.body;

      // Find or create user
      let user = await getUserByEmail(email);

      if (!user) {
        // Create new user from Google
        const newUser = {
          id: uuidv4(),
          email: email.toLowerCase(),
          name,
          googleId,
          avatar,
          isPro: false,
          isPaid: false,
          tier: 'free',
          createdAt: new Date(),
          lastLogin: new Date(),
          settings: {
            theme: 'light',
            language: 'en',
            notifications: true,
            soundEnabled: true,
            autoSave: true,
            sendHotkey: 'enter',
            shortcutsEnabled: true,
            adsEnabled: true
          }
        };

        user = await createUser(newUser);
        logger.info(`New Google user created: ${email}`);
      } else {
        // Update existing user's Google info
        await updateUser(user.id, {
          googleId,
          avatar,
          lastLogin: new Date()
        });
        logger.info(`Google user logged in: ${email}`);
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Remove password from response
      const { password: _, ...userResponse } = user;

      res.status(200).json({
        success: true,
        message: 'Google login successful',
        user: userResponse,
        token
      });

    } catch (error) {
      logger.error('Google login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during Google login'
      });
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      const userId = req.user.userId;
      const user = await getUserByEmail(req.user.email);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Remove password from response
      const { password: _, ...userResponse } = user;

      res.status(200).json({
        success: true,
        user: userResponse
      });

    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error getting profile'
      });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const userId = req.user.userId;
      const { name, settings } = req.body;

      const updateData = {};
      if (name) updateData.name = name;
      if (settings) updateData.settings = settings;

      const updatedUser = await updateUser(userId, updateData);

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Remove password from response
      const { password: _, ...userResponse } = updatedUser;

      logger.info(`User profile updated: ${req.user.email}`);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user: userResponse
      });

    } catch (error) {
      logger.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error updating profile'
      });
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const userId = req.user.userId;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      // Get user with password
      const user = await getUserByEmail(req.user.email);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await updateUser(userId, { password: hashedNewPassword });

      logger.info(`Password changed for user: ${req.user.email}`);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error changing password'
      });
    }
  }

  // Request password reset
  async requestPasswordReset(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const user = await getUserByEmail(email.toLowerCase());
      if (!user) {
        // Don't reveal if user exists or not
        return res.status(200).json({
          success: true,
          message: 'If an account with this email exists, a password reset link has been sent'
        });
      }

      // Generate reset token
      const resetToken = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // In a real app, send email with reset link
      // For now, just log it
      logger.info(`Password reset requested for: ${email}, token: ${resetToken}`);

      res.status(200).json({
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent'
      });

    } catch (error) {
      logger.error('Request password reset error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error requesting password reset'
      });
    }
  }

  // Reset password with token
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Token and new password are required'
        });
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await getUserByEmail(decoded.email);

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await updateUser(user.id, { password: hashedPassword });

      logger.info(`Password reset for user: ${user.email}`);

      res.status(200).json({
        success: true,
        message: 'Password reset successfully'
      });

    } catch (error) {
      logger.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }
  }

  // Delete user account
  async deleteAccount(req, res) {
    try {
      const userId = req.user.userId;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required to delete account'
        });
      }

      // Get user with password
      const user = await getUserByEmail(req.user.email);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Password is incorrect'
        });
      }

      // Delete user
      await deleteUser(userId);

      logger.info(`Account deleted for user: ${req.user.email}`);

      res.status(200).json({
        success: true,
        message: 'Account deleted successfully'
      });

    } catch (error) {
      logger.error('Delete account error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error deleting account'
      });
    }
  }

  // Logout (client-side token removal)
  async logout(req, res) {
    try {
      // In a real app, you might want to blacklist the token
      // For now, just return success
      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during logout'
      });
    }
  }

  // Verify token
  async verifyToken(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'No token provided'
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await getUserByEmail(decoded.email);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

      // Remove password from response
      const { password: _, ...userResponse } = user;

      res.status(200).json({
        success: true,
        user: userResponse
      });

    } catch (error) {
      logger.error('Token verification error:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  }
}

module.exports = new AuthController(); 