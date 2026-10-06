/**
 * api/src/routes/stats.js — GET /api/stats
 */
'use strict';
const express = require('express');
const { getStore } = require('../db');
const router  = express.Router();

router.get('/', (req, res) => {
  const store = getStore();
  const scansCount = store.scans.length;
  const feedbackCount = store.feedback.length;

  res.json({
    totalScans: scansCount,
    totalFeedback: feedbackCount,
    activeModelVersion: '0.0.1-dummy',
    uptimeSeconds: process.uptime()
  });
});

module.exports = router;
