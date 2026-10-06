'use strict';
const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  scanId: { type: String, required: true },
  userId: { type: String, default: 'guest' },
  diseaseKey: { type: String, required: true },
  userCorrection: { type: String, default: null },
  helpful: { type: Boolean, default: true },
  notes: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
