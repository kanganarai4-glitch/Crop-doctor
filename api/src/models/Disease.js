'use strict';
const mongoose = require('mongoose');

const diseaseSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  crop: { type: String, required: true },
  name: { type: String, required: true },
  symptoms: { type: String, required: true },
  treatments: {
    organic: [String],
    chemical: [String],
    precautions: [String],
    prevention: [String]
  },
  translations: {
    type: Map,
    of: {
      name: String,
      symptoms: String,
      organic: [String],
      chemical: [String],
      precautions: [String],
      prevention: [String],
      audioUrl: String
    }
  },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Disease || mongoose.model('Disease', diseaseSchema);
