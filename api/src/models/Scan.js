'use strict';
const mongoose = require('mongoose');

const scanSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  diseaseKey: { type: String, required: true },
  confidence: { type: Number, required: true },
  top3: [
    {
      label: String,
      confidence: Number
    }
  ],
  status: { type: String, default: 'ok' },
  severity: { type: Number, default: null },
  severityLabel: { type: String, default: null },
  heatmapImage: { type: String, default: null },
  offlineTimestamp: { type: Date, default: null },
  synced: { type: Boolean, default: true },
  syncedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Scan || mongoose.model('Scan', scanSchema);
