/**
 * web/public/sw.js
 * ─────────────────
 * CropDoctor Service Worker — Phase 0 skeleton.
 * Full precaching, offline inference, and sync queue implemented in Phase 6.
 *
 * Strategy overview (implemented in Phase 6):
 *   - App shell + static assets : Cache-first (precached on install)
 *   - .tflite model             : Precached; updated on app open via /api/model/latest
 *   - TFLite WASM files         : Precached
 *   - Advice JSON               : Precached
 *   - GET /api/*                : Network-first with cache fallback
 *   - POST /api/scan            : Network-only; on failure → queue in IndexedDB
 *
 * Phase 0: install + activate stubs only.
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE  = `cropdoctor-static-${CACHE_VERSION}`;
const MODEL_CACHE   = `cropdoctor-models-${CACHE_VERSION}`;
const API_CACHE     = `cropdoctor-api-${CACHE_VERSION}`;

// App shell files to precache at install time
// Full list populated in Phase 6
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/models/mobilenet_dummy.tflite',
];

// ── Install ───────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing …');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Attempt to precache; failures are non-fatal in Phase 0
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache partial failure (expected in dev):', err.message);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating …');
  event.waitUntil(
    caches.keys().then((keys) => {
      const validCaches = [STATIC_CACHE, MODEL_CACHE, API_CACHE];
      return Promise.all(
        keys
          .filter((k) => !validCaches.includes(k))
          .map((k) => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      );
    })
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────
// Phase 0: pass-through. Full strategy in Phase 6.
self.addEventListener('fetch', (_event) => {
  // No-op in Phase 0
});

// ── Message handler ───────────────────────────────────────────────
// Used by the app to trigger sync and model update checks (Phase 6)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
