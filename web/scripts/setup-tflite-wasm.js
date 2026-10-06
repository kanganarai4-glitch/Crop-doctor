/**
 * web/scripts/setup-tflite-wasm.js
 * Copies @tensorflow/tfjs-tflite WASM files to public/tflite/
 * so they can be served as static assets.
 * Run automatically via "postinstall" in package.json.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const src  = path.join(__dirname, '..', 'node_modules', '@tensorflow', 'tfjs-tflite', 'dist');
const dest = path.join(__dirname, '..', 'public', 'tflite');

if (!fs.existsSync(src)) {
  console.warn('[setup-tflite-wasm] @tensorflow/tfjs-tflite not found in node_modules — skipping WASM copy.');
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });

const copied = [];
for (const file of fs.readdirSync(src)) {
  if (file.endsWith('.wasm') || file.endsWith('.js')) {
    fs.copyFileSync(path.join(src, file), path.join(dest, file));
    copied.push(file);
  }
}
console.log(`[setup-tflite-wasm] Copied ${copied.length} file(s) to public/tflite/`);
