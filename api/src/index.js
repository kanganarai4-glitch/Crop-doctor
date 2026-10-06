/**
 * api/src/index.js
 * ─────────────────
 * Entry point for the CropDoctor Node/Express API.
 * Loads env → connects DB → mounts middleware → starts server.
 */
'use strict';

const path = require('path');
// Try api/.env first, then fall back to project root .env
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const app    = require('./app');
const db     = require('./db');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await db.connect();
    logger.info('MongoDB connected');

    app.listen(PORT, () => {
      logger.info(`CropDoctor API listening on port ${PORT}`);
      logger.info(`Swagger docs: http://localhost:${PORT}/docs`);
    });
  } catch (err) {
    logger.error('Fatal startup error: %s', err.message);
    process.exit(1);
  }
}

start();
