import ApiError from '../utils/ApiError.js';
import { sendError } from '../utils/ApiResponse.js';
import logger from '../config/logger.js';
import env from '../config/env.js';

/**
 * Normalizes known error types (Mongoose validation/cast/duplicate-key, JWT errors)
 * into ApiError, then formats a safe response. Never leaks stack traces in production.
 */
export function normalizeError(err) {
  if (err instanceof ApiError) return err;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => e.message);
    return ApiError.badRequest('Validation failed', 'VALIDATION_ERROR', details);
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    return ApiError.badRequest(`Invalid value for field "${err.path}"`, 'INVALID_ID');
  }

  // Mongo duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return ApiError.conflict(`${field} already exists`, 'DUPLICATE_KEY');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return ApiError.unauthorized('Invalid token', 'INVALID_TOKEN');
  }
  if (err.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Token expired', 'TOKEN_EXPIRED');
  }

  return ApiError.internal(env.NODE_ENV === 'production' ? 'Something went wrong' : err.message);
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const apiErr = normalizeError(err);

  const logPayload = {
    statusCode: apiErr.statusCode,
    code: apiErr.code,
    path: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
    organizationId: req.user?.organizationId,
  };

  if (apiErr.statusCode >= 500) {
    logger.error(err.message, { ...logPayload, stack: err.stack });
  } else {
    logger.warn(apiErr.message, logPayload);
  }

  return sendError(res, {
    statusCode: apiErr.statusCode,
    message: apiErr.message,
    code: apiErr.code,
    details: apiErr.details,
  });
}

export function notFoundHandler(req, res) {
  return sendError(res, {
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND',
  });
}
