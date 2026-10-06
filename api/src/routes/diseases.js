/**
 * api/src/routes/diseases.js  — GET /api/disease/:key
 * Disease content repository with multilingual support & fallback.
 */
'use strict';
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();

const CONTENT_DIR = path.join(__dirname, '..', '..', '..', 'content');

// Cache loaded content files in memory
const contentCache = {};

function loadContent(lang = 'en') {
  if (contentCache[lang]) return contentCache[lang];

  let filePath = path.join(CONTENT_DIR, `diseases.${lang}.json`);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(CONTENT_DIR, 'diseases.en.json');
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const map = {};
    parsed.forEach(item => {
      map[item.key] = item;
    });
    contentCache[lang] = map;
    return map;
  } catch (err) {
    console.error(`Failed loading disease content for lang ${lang}:`, err.message);
    return {};
  }
}

// GET /api/disease
router.get('/', (req, res) => {
  const lang = req.query.lang || 'en';
  const content = loadContent(lang);
  const list = Object.values(content).map(item => ({
    key: item.key,
    crop: item.crop,
    name: item.name,
    symptoms: item.symptoms ? item.symptoms.substring(0, 100) + '...' : ''
  }));
  res.json({ lang, count: list.length, diseases: list });
});

// GET /api/disease/:key
router.get('/:key', (req, res) => {
  const { key } = req.params;
  const lang = req.query.lang || 'en';
  
  let content = loadContent(lang);
  let disease = content[key];

  if (!disease && lang !== 'en') {
    // Fallback to English if translation is missing for this key
    const enContent = loadContent('en');
    disease = enContent[key];
  }

  if (!disease) {
    return res.status(404).json({
      error: 'Disease key not found',
      key,
      supportedCrops: ['Tomato', 'Potato', 'Rice', 'Maize', 'Wheat']
    });
  }

  res.json({ lang, ...disease });
});

module.exports = router;
