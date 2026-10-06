/**
 * api/src/middleware/errorHandler.js
 * ────────────────────────────────────
 * Centralised Express error handler.
 * Must be the LAST middleware registered in app.js.
 */
'use strict';

const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: Object.values(err.errors).map((e) => e.message),
    });
  }

  // Mongoose duplicate key (e.g. clientId collision)
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate entry', keyValue: err.keyValue });
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Uploaded file is too large' });
  }

  // JWT errors surfaced by other code paths
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Operational errors with a status code
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  // Unknown / programmer errors — don't leak details
  logger.error('Unhandled error: %s\n%s', err.message, err.stack);
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;
