/**
 * api/src/routes/sync.js
 * ───────────────────────
 * Offline scan sync endpoint. Accepts bulk offline scans from PWA's IndexedDB.
 */
'use strict';
const express  = require('express');
const { getStore, isFallback } = require('../db');
const Scan     = require('../models/Scan');
const router   = express.Router();

// POST /api/sync
router.post('/', async (req, res, next) => {
  try {
    const { scans } = req.body;
    if (!Array.isArray(scans)) {
      return res.status(400).json({ error: 'Payload must include `scans` array.' });
    }

    const userId = req.user ? (req.user.userId || req.user.sub) : 'guest';
    const synced = [];

    for (const scan of scans) {
      const scanRecord = {
        id: scan.clientId || ('scan_sync_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
        userId,
        diseaseKey: scan.diseaseKey || scan.topPrediction?.label || 'unknown',
        confidence: scan.confidence || scan.topPrediction?.confidence || 0,
        top3: scan.top3 || (scan.topPrediction ? [scan.topPrediction] : []),
        offlineTimestamp: scan.timestamp ? new Date(scan.timestamp) : new Date(),
        syncedAt: new Date(),
        synced: true
      };

      if (isFallback()) {
        getStore().scans.push(scanRecord);
      } else {
        await Scan.findOneAndUpdate({ id: scanRecord.id }, scanRecord, { upsert: true, new: true });
      }
      synced.push({ clientId: scan.clientId, serverId: scanRecord.id, status: 'synced' });
    }

    res.json({
      success: true,
      syncedCount: synced.length,
      synced
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
