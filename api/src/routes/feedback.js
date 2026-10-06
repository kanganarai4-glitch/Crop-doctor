/**
 * api/src/routes/feedback.js — POST /api/feedback
 */
'use strict';
const express  = require('express');
const { getStore, isFallback } = require('../db');
const Feedback = require('../models/Feedback');
const router   = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { scanId, diseaseKey, userCorrection, helpful, notes } = req.body;
    const userId = req.user ? (req.user.userId || req.user.sub) : 'guest';

    const feedbackRecord = {
      id: 'fb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      scanId: scanId || 'unknown',
      userId,
      diseaseKey: diseaseKey || 'unknown',
      userCorrection: userCorrection || null,
      helpful: helpful !== undefined ? Boolean(helpful) : true,
      notes: notes || null,
      createdAt: new Date().toISOString()
    };

    if (isFallback()) {
      getStore().feedback.push(feedbackRecord);
    } else {
      await Feedback.create(feedbackRecord);
    }

    res.json({ success: true, feedbackId: feedbackRecord.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
