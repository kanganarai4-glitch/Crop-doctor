/**
 * api/src/routes/model.js — GET /api/model/latest
 */
'use strict';
const express = require('express');
const router  = express.Router();

router.get('/latest', (req, res) => {
  res.json({
    version: '0.0.1-dummy',
    modelUrl: '/models/mobilenet_dummy.tflite',
    quantizedUrl: '/models/mobilenet_dummy_int8.tflite',
    numClasses: 26,
    inputShape: [224, 224, 3],
    pixelRange: '0-255',
    checksum: 'a1b2c3d4e5f6',
    releasedAt: new Date().toISOString()
  });
});

module.exports = router;
