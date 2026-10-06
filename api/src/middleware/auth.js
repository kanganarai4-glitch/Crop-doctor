/**
 * api/src/middleware/auth.js
 * ──────────────────────────
 * JWT authentication middleware with guest fallback.
 * Verifies Bearer token, attaches decoded payload to req.user.
 */
'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'cropdoctor-secret-key-change-in-prod';

/**
 * authenticate — Express middleware.
 * Verifies Bearer JWT, or assigns default guest user if token is missing/expired.
 */
function authenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer ')) {
    req.user = { userId: 'guest', role: 'guest' };
    return next();
  }

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    // Fallback to guest user on expired/invalid token for farmer access
    req.user = { userId: 'guest', role: 'guest' };
    next();
  }
}

/**
 * issueToken — helper used by auth routes.
 */
function issueToken(payload, expiresIn = '30d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

module.exports = { authenticate, issueToken };
