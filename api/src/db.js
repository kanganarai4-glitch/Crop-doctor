'use strict';

const mongoose = require('mongoose');
const logger   = require('./utils/logger');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cropdoctor';

const inMemoryStore = {
  scans: [],
  feedback: [],
  users: []
};

let isFallbackMode = process.env.NODE_ENV === 'test' && !process.env.TEST_MONGO;

async function connect() {
  if (isFallbackMode) {
    logger.info('Using in-memory DB fallback for test environment');
    return;
  }
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 1000,
    });
    logger.info('Connected to MongoDB at %s', MONGO_URI);
  } catch (err) {
    logger.warn('MongoDB connection failed (%s). Switching to in-memory DB fallback.', err.message);
    isFallbackMode = true;
  }
}

function getStore() {
  return inMemoryStore;
}

function isFallback() {
  return isFallbackMode;
}

module.exports = { connect, getStore, isFallback };
