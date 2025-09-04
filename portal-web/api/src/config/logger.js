// Temporarily disabled winston to avoid module resolution issues
// const winston = require('winston');
// const DailyRotateFile = require('winston-daily-rotate-file');
// const { join } = require('path');
// const { existsSync, mkdirSync } = require('fs');




// Temporarily simplified logger using console methods
// All winston configuration commented out to avoid module resolution issues

// Simplified logger using console methods
const logger = {
  error: (message, meta) => console.error(`[ERROR] ${message}`, meta || ''),
  warn: (message, meta) => console.warn(`[WARN] ${message}`, meta || ''),
  info: (message, meta) => console.log(`[INFO] ${message}`, meta || ''),
  debug: (message, meta) => console.log(`[DEBUG] ${message}`, meta || ''),
  child: (meta) => logger // Return same logger for child loggers
};

// Create specialized loggers for different contexts (simplified)
const authLogger = logger;
const dbLogger = logger;
const apiLogger = logger;
const uploadLogger = logger;
const syncLogger = logger;

// Helper functions for structured logging
const loggers = {
  // API request logging
  logRequest: (req, res, responseTime) => {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userId: req.user?.id,
      companyId: req.user?.company_id
    };

    if (res.statusCode >= 400) {
      apiLogger.warn('API Request Failed', logData);
    } else {
      apiLogger.info('API Request', logData);
    }
  },

  // Authentication logging
  logAuth: (action, userId, companyId, success, details = {}) => {
    const logData = {
      action,
      userId,
      companyId,
      success,
      timestamp: new Date().toISOString(),
      ...details
    };

    if (success) {
      authLogger.info(`Auth Success: ${action}`, logData);
    } else {
      authLogger.warn(`Auth Failed: ${action}`, logData);
    }
  },

  // Database operation logging
  logDb: (operation, table, success, details = {}) => {
    const logData = {
      operation,
      table,
      success,
      timestamp: new Date().toISOString(),
      ...details
    };

    if (success) {
      dbLogger.debug(`DB ${operation}: ${table}`, logData);
    } else {
      dbLogger.error(`DB ${operation} Failed: ${table}`, logData);
    }
  },

  // File upload logging
  logUpload: (filename, size, userId, companyId, success, details = {}) => {
    const logData = {
      filename,
      size,
      userId,
      companyId,
      success,
      timestamp: new Date().toISOString(),
      ...details
    };

    if (success) {
      uploadLogger.info('File Upload Success', logData);
    } else {
      uploadLogger.error('File Upload Failed', logData);
    }
  },

  // Sync operation logging
  logSync: (operation, userId, companyId, success, details = {}) => {
    const logData = {
      operation,
      userId,
      companyId,
      success,
      timestamp: new Date().toISOString(),
      ...details
    };

    if (success) {
      syncLogger.info(`Sync Success: ${operation}`, logData);
    } else {
      syncLogger.error(`Sync Failed: ${operation}`, logData);
    }
  },

  // Security event logging
  logSecurity: (event, severity, details = {}) => {
    const logData = {
      event,
      severity,
      timestamp: new Date().toISOString(),
      ...details
    };

    logger.warn(`Security Event: ${event}`, logData);
  },

  // Performance logging
  logPerformance: (operation, duration, details = {}) => {
    const logData = {
      operation,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...details
    };

    if (duration > 5000) {
      // Log slow operations (>5s)
      logger.warn(`Slow Operation: ${operation}`, logData);
    } else {
      logger.debug(`Performance: ${operation}`, logData);
    }
  }
};

// Error logging helper
const logError = (error, context = 'general', additionalData = {}) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    ...additionalData
  };

  logger.error('Application Error', errorData);
};

// Startup logging - temporarily disabled to avoid circular dependency
// logger.info('🚀 Logger initialized', {
//   level: logger.level,
//   environment: process.env.NODE_ENV || 'development'
// });
console.log('🚀 Logger initialized', {
  level: 'info',
  environment: process.env.NODE_ENV || 'development'
});

module.exports = {
  logger,
  authLogger,
  dbLogger,
  apiLogger,
  uploadLogger,
  syncLogger,
  loggers,
  logError
};
