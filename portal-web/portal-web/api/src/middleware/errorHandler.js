// const { logger, logError } = require('../config/logger.js'); // Temporarily disabled to avoid circular dependency
const { ZodError } = require('zod');

/**
 * Custom error classes
 */
class AppError extends Error {
  constructor(
    message,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    details = null
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

/**
 * Format Zod validation errors
 * @param {ZodError} error - Zod validation error
 * @returns {Object} Formatted error details
 */
function formatZodError(error) {
  const details = {};

  error.errors.forEach(err => {
    const path = err.path.join('.');
    details[path] = err.message;
  });

  return {
    message: 'Dados de entrada inválidos',
    details
  };
}

/**
 * Format Supabase errors
 * @param {Object} error - Supabase error
 * @returns {Object} Formatted error
 */
function formatSupabaseError(error) {
  const { code, message, details, hint } = error;

  // Common Supabase error codes
  const errorMap = {
    23505: {
      message: 'Recurso já existe',
      code: 'DUPLICATE_RESOURCE',
      statusCode: 409
    },
    23503: {
      message: 'Referência inválida',
      code: 'INVALID_REFERENCE',
      statusCode: 400
    },
    42501: {
      message: 'Permissão insuficiente',
      code: 'INSUFFICIENT_PERMISSION',
      statusCode: 403
    },
    PGRST116: {
      message: 'Recurso não encontrado',
      code: 'NOT_FOUND',
      statusCode: 404
    },
    '42P01': {
      message: 'Tabela não encontrada',
      code: 'TABLE_NOT_FOUND',
      statusCode: 500
    }
  };

  const mappedError = errorMap[code];

  if (mappedError) {
    return {
      message: mappedError.message,
      code: mappedError.code,
      statusCode: mappedError.statusCode,
      details: details || hint ? { details, hint } : null
    };
  }

  // Default Supabase error handling
  return {
    message: message || 'Erro de banco de dados',
    code: 'DATABASE_ERROR',
    statusCode: 500,
    details: { code, details, hint }
  };
}

/**
 * Format JWT errors
 * @param {Object} error - JWT error
 * @returns {Object} Formatted error
 */
function formatJWTError(error) {
  const { name } = error;

  const errorMap = {
    TokenExpiredError: {
      message: 'Token expirado',
      code: 'TOKEN_EXPIRED',
      statusCode: 401
    },
    JsonWebTokenError: {
      message: 'Token inválido',
      code: 'INVALID_TOKEN',
      statusCode: 401
    },
    NotBeforeError: {
      message: 'Token não ativo ainda',
      code: 'TOKEN_NOT_ACTIVE',
      statusCode: 401
    }
  };

  const mappedError = errorMap[name];

  if (mappedError) {
    return {
      message: mappedError.message,
      code: mappedError.code,
      statusCode: mappedError.statusCode
    };
  }

  return {
    message: 'Erro de autenticação',
    code: 'AUTH_ERROR',
    statusCode: 401
  };
}

/**
 * Main error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, _next) {
  let error = {
    message: err.message || 'Erro interno do servidor',
    code: err.code || 'INTERNAL_ERROR',
    statusCode: err.statusCode || 500,
    details: err.details || null
  };

  // Log error with request context
  const errorContext = {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    companyId: req.user?.company_id,
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    params: req.params
  };

  console.error('Error occurred', {
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    tenantId: req.tenant?.id
  });

  // Authentication errors - 401
  if (
    err instanceof AuthenticationError ||
    err.name === 'AuthenticationError'
  ) {
    return res.status(401).json({
      success: false,
      error: err.message || 'Não autenticado',
      code: 'AUTHENTICATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  // Authorization errors - 403
  if (err instanceof AuthorizationError || err.name === 'AuthorizationError') {
    return res.status(403).json({
      success: false,
      error: err.message || 'Acesso negado',
      code: 'AUTHORIZATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  // JWT errors - 401
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Token inválido',
      code: 'INVALID_TOKEN',
      timestamp: new Date().toISOString()
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expirado',
      code: 'EXPIRED_TOKEN',
      timestamp: new Date().toISOString()
    });
  }

  // Validation errors - 400
  if (err instanceof ValidationError || err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: err.message || 'Dados inválidos',
      code: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  // Not found errors - 404
  if (err instanceof NotFoundError || err.name === 'NotFoundError') {
    return res.status(404).json({
      success: false,
      error: err.message || 'Recurso não encontrado',
      code: 'NOT_FOUND',
      timestamp: new Date().toISOString()
    });
  }

  // Conflict errors - 409
  if (err instanceof ConflictError || err.name === 'ConflictError') {
    return res.status(409).json({
      success: false,
      error: err.message || 'Conflito de dados',
      code: 'CONFLICT_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  // Rate limit errors - 429
  if (err instanceof RateLimitError || err.name === 'RateLimitError') {
    return res.status(429).json({
      success: false,
      error: err.message || 'Muitas tentativas',
      code: 'RATE_LIMIT_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    return res.status(404).json({
      success: false,
      error: 'Recurso não encontrado',
      code: 'INVALID_ID',
      timestamp: new Date().toISOString()
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'Recurso duplicado',
      code: 'DUPLICATE_RESOURCE',
      timestamp: new Date().toISOString()
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      error: message.join(', '),
      code: 'MONGOOSE_VALIDATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  // Handle different error types
  if (err instanceof ZodError) {
    const zodError = formatZodError(err);
    error = {
      message: zodError.message,
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details: zodError.details
    };
  } else if (err.name && err.name.includes('JWT')) {
    error = formatJWTError(err);
  } else if (
    err.code &&
    (err.code.startsWith('PG') ||
      err.code.startsWith('23') ||
      err.code === 'PGRST116')
  ) {
    error = formatSupabaseError(err);
  } else if (err instanceof AppError) {
    // Custom application errors - use as is
    error = {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      details: err.details
    };
  } else if (err.name === 'MulterError') {
    // File upload errors
    const multerErrorMap = {
      LIMIT_FILE_SIZE: 'Arquivo muito grande',
      LIMIT_FILE_COUNT: 'Muitos arquivos',
      LIMIT_UNEXPECTED_FILE: 'Tipo de arquivo não permitido'
    };

    error = {
      message: multerErrorMap[err.code] || 'Erro no upload do arquivo',
      code: 'UPLOAD_ERROR',
      statusCode: 400,
      details: { originalError: err.code }
    };
  }

  // Don't log validation errors and 404s as errors (they're expected)
  if (error.statusCode >= 500) {
    console.error('Request handler error', { error: err.message, context: errorContext });
  } else if (error.statusCode >= 400) {
    console.log('Client error', {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      ...errorContext
    });
  }

  // Prepare response
  const response = {
    success: false,
    error: error.message,
    code: error.code,
    timestamp: new Date().toISOString()
  };

  // Add details in development or for validation errors
  if (
    process.env.NODE_ENV === 'development' ||
    error.code === 'VALIDATION_ERROR'
  ) {
    if (error.details) {
      response.details = error.details;
    }

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development' && err.stack) {
      response.stack = err.stack;
    }
  }

  // Add request ID if available
  if (req.id) {
    response.requestId = req.id;
  }

  // Send error response
  res.status(error.statusCode).json(response);
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler
 * Handles 404 errors for undefined routes
 */
function notFoundHandler(req, res) {
  const error = {
    success: false,
    error: 'Endpoint não encontrado',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  };

  console.log('404 - Route not found', {
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json(error);
}

/**
 * Validation error helper
 * Creates a validation error with details
 * @param {string} message - Error message
 * @param {Object} details - Validation details
 * @throws {ValidationError}
 */
function throwValidationError(message, details = null) {
  throw new ValidationError(message, details);
}

/**
 * Not found error helper
 * Creates a not found error
 * @param {string} resource - Resource name
 * @throws {NotFoundError}
 */
function throwNotFoundError(resource = 'Resource') {
  throw new NotFoundError(`${resource} não encontrado`);
}

/**
 * Authorization error helper
 * Creates an authorization error
 * @param {string} message - Error message
 * @throws {AuthorizationError}
 */
function throwAuthorizationError(message = 'Acesso negado') {
  throw new AuthorizationError(message);
}

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  throwValidationError,
  throwNotFoundError,
  throwAuthorizationError
};
