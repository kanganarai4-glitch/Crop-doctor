/**
 * api/src/utils/logger.js
 * ────────────────────────
 * Minimal structured logger wrapping console with timestamps.
 * Replace with Winston/Pino in production if needed.
 */
'use strict';

const levels = ['error', 'warn', 'info', 'debug'];

function log(level, msg, ...args) {
  const ts = new Date().toISOString();
  const formatted = args.length
    ? msg.replace(/%s/g, () => String(args.shift()))
    : msg;
  const line = `${ts} [${level.toUpperCase().padEnd(5)}] ${formatted}`;
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

const logger = {};
levels.forEach((l) => { logger[l] = (msg, ...args) => log(l, msg, ...args); });

module.exports = logger;
