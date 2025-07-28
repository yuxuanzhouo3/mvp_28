/**
 * Copyright © 2024 Yuxuan Zhou. All rights reserved.
 * 
 * Error Handler Middleware
 * Centralized error handling for MornGPT Backend
 */

const logger = require('../utils/logger');

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large';
    error = { message, statusCode: 400 };
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    const message = 'Too many files';
    error = { message, statusCode: 400 };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    error = { message, statusCode: 400 };
  }

  // Database errors
  if (err.code === 'SQLITE_CONSTRAINT') {
    const message = 'Database constraint violation';
    error = { message, statusCode: 400 };
  }

  if (err.code === 'SQLITE_BUSY') {
    const message = 'Database is busy, please try again';
    error = { message, statusCode: 503 };
  }

  // Network errors
  if (err.code === 'ENOTFOUND') {
    const message = 'External service not found';
    error = { message, statusCode: 503 };
  }

  if (err.code === 'ECONNREFUSED') {
    const message = 'External service connection refused';
    error = { message, statusCode: 503 };
  }

  if (err.code === 'ETIMEDOUT') {
    const message = 'External service request timeout';
    error = { message, statusCode: 504 };
  }

  // Rate limiting errors
  if (err.status === 429) {
    const message = 'Too many requests, please try again later';
    error = { message, statusCode: 429 };
  }

  // Default error
  const statusCode = error.statusCode || err.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Don't leak error details in production
  const response = {
    error: true,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.message
    })
  };

  res.status(statusCode).json(response);
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Not found handler
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Validation error handler
const validationError = (errors) => {
  const error = new Error('Validation Error');
  error.statusCode = 400;
  error.errors = errors;
  return error;
};

// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  notFound,
  validationError,
  AppError
}; 