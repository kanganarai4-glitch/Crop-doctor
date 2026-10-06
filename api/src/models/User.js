'use strict';
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  phone: { type: String, default: null },
  role: { type: String, enum: ['guest', 'user', 'admin'], default: 'user' },
  preferredLang: { type: String, default: 'en' },
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
