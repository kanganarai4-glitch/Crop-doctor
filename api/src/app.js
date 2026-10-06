/**
 * api/src/app.js
 * ──────────────
 * Express application factory.
 * Middleware order: security → cors → logging → body parsing → rate limit → routes → errors.
 */
'use strict';

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const swaggerUi  = require('swagger-ui-express');
const path       = require('path');
const YAML       = require('yamljs');

const authRoutes    = require('./routes/auth');
const scanRoutes    = require('./routes/scans');
const diseaseRoutes = require('./routes/diseases');
const syncRoutes    = require('./routes/sync');
const feedbackRoutes= require('./routes/feedback');
const modelRoutes   = require('./routes/model');
const statsRoutes   = require('./routes/stats');
const errorHandler  = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/auth');

const app = express();

// ── CORS & Security headers ──────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(helmet({ crossOriginResourcePolicy: false }));

// ── Request logging ───────────────────────────────────────────────
app.use(morgan('combined'));

// ── Body parsing ──────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Global rate limit ─────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 min
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// ── Health ────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'cropdoctor-api' }));

// ── Swagger docs ──────────────────────────────────────────────────
try {
  const swaggerDoc = YAML.load(path.join(__dirname, 'openapi.yaml'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
} catch {
  // openapi.yaml written in Phase 3
}

// ── Public routes (no auth) ───────────────────────────────────────
app.use('/api/auth', authRoutes);

// ── Protected routes ──────────────────────────────────────────────
app.use('/api/scans',    authenticate, scanRoutes);
app.use('/api/sync',     authenticate, syncRoutes);
app.use('/api/disease',  diseaseRoutes);    // public — farmers can read without login
app.use('/api/feedback', authenticate, feedbackRoutes);
app.use('/api/model',    modelRoutes);      // public — model version check
app.use('/api/stats',    authenticate, statsRoutes);

// ── Centralised error handler ─────────────────────────────────────
app.use(errorHandler);

module.exports = app;
