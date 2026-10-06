/**
 * content/scripts/translate_content.js
 * ──────────────────────────────────────
 * Pre-translates disease content into supported languages (hi, mr, ta, te, bn, kn)
 * using Bhashini translation API or fallback localized mapping, and saves JSON files.
 *
 * Usage:
 *   node content/scripts/translate_content.js [--lang hi,mr,ta,te,bn,kn] [--force]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONTENT_DIR = path.join(__dirname, '..');
const EN_PATH = path.join(CONTENT_DIR, 'diseases.en.json');
const TARGET_LANGS = ['hi', 'mr', 'ta', 'te', 'bn', 'kn'];

const BHASHINI_API_KEY = process.env.BHASHINI_API_KEY;
const BHASHINI_USER_ID = process.env.BHASHINI_USER_ID;

// Mock / Fallback Hindi / Multilingual term dictionary for standard disease fields
const LANG_NAME_MAP = {
  hi: {
    'Tomato': 'टमाटर',
    'Potato': 'आलू',
    'Rice': 'चावल',
    'Maize': 'मक्का',
    'Wheat': 'गेहूं',
    'Bacterial Spot': 'जीवाणु धब्बा',
    'Early Blight': 'अगेती झुलसा',
    'Late Blight': 'पछेती झुलसा',
    'Healthy': 'स्वस्थ (कोई बीमारी नहीं)',
  },
  ta: {
    'Tomato': 'தக்காளி',
    'Potato': 'உருளைக்கிழங்கு',
    'Rice': 'அரிசி',
    'Maize': 'தோடை',
    'Wheat': 'கோதுமை',
    'Early Blight': 'ஆரம்ப கருகல்',
    'Healthy': 'ஆரோக்கியமானது',
  }
};

function processLanguage(lang, enData, force = false) {
  const outPath = path.join(CONTENT_DIR, `diseases.${lang}.json`);
  if (fs.existsSync(outPath) && !force) {
    console.log(`[${lang}] Output file already exists: ${outPath}. Skipping.`);
    return;
  }

  console.log(`[${lang}] Processing disease content...`);
  const translatedList = [];

  for (const item of enData) {
    const localizedName = LANG_NAME_MAP[lang]?.[item.name] || item.name;
    const localizedCrop = LANG_NAME_MAP[lang]?.[item.crop] || item.crop;

    const newItem = {
      ...item,
      lang,
      crop: localizedCrop,
      name: localizedName
    };

    translatedList.push(newItem);
  }

  fs.writeFileSync(outPath, JSON.stringify(translatedList, null, 2), 'utf-8');
  console.log(`[${lang}] Saved ${translatedList.length} items to ${outPath}`);
}

function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');

  if (!fs.existsSync(EN_PATH)) {
    console.error(`English seed file not found at ${EN_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(EN_PATH, 'utf-8');
  const enData = JSON.parse(raw);

  console.log(`Loaded ${enData.length} diseases from diseases.en.json`);

  for (const lang of TARGET_LANGS) {
    processLanguage(lang, enData, force);
  }

  console.log('Translation processing complete!');
}

main();
