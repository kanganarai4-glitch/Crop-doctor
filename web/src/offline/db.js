/**
 * web/src/offline/db.js
 * ──────────────────────
 * Hand-written IndexedDB helper with zero external dependencies & JSDOM fallback.
 */

const DB_NAME    = 'cropdoctor';
const DB_VERSION = 1;

let _db = null;
const memoryDb = {
  scans: [],
  advice: [],
  settings: [],
  syncQueue: []
};

function openDB() {
  if (_db) return Promise.resolve(_db);
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('scans')) {
          const s = db.createObjectStore('scans', { keyPath: 'clientId' });
          s.createIndex('userId',    'userId',    { unique: false });
          s.createIndex('createdAt', 'createdAt', { unique: false });
          s.createIndex('synced',    'synced',    { unique: false });
        }

        if (!db.objectStoreNames.contains('advice')) {
          db.createObjectStore('advice', { keyPath: 'cacheKey' });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'clientId' });
        }
      };

      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror   = (e) => reject(e.target.error);
    } catch {
      resolve(null);
    }
  });
}

function tx(storeName, mode = 'readonly') {
  return openDB().then(db => {
    if (!db) return null;
    return db.transaction(storeName, mode).objectStore(storeName);
  });
}

function put(storeName, value) {
  return tx(storeName, 'readwrite').then(s => {
    if (!s) {
      const key = value.clientId || value.cacheKey || value.key;
      const idx = memoryDb[storeName].findIndex(x => (x.clientId || x.cacheKey || x.key) === key);
      if (idx >= 0) memoryDb[storeName][idx] = value;
      else memoryDb[storeName].push(value);
      return value;
    }
    return idbReq(s.put(value));
  });
}

function get(storeName, key) {
  return tx(storeName).then(s => {
    if (!s) {
      return memoryDb[storeName].find(x => (x.clientId || x.cacheKey || x.key) === key) || null;
    }
    return idbReq(s.get(key));
  });
}

function getAll(storeName) {
  return tx(storeName).then(s => {
    if (!s) {
      return [...memoryDb[storeName]];
    }
    return idbReq(s.getAll());
  });
}

function del(storeName, key) {
  return tx(storeName, 'readwrite').then(s => {
    if (!s) {
      memoryDb[storeName] = memoryDb[storeName].filter(x => (x.clientId || x.cacheKey || x.key) !== key);
      return true;
    }
    return idbReq(s.delete(key));
  });
}

function idbReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

// Scans
export async function saveScan(scan) {
  return put('scans', { ...scan, updatedAt: Date.now() });
}

export async function getScan(clientId) {
  return get('scans', clientId);
}

export async function getAllScans() {
  const all = await getAll('scans');
  return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getUnsyncedScans() {
  const all = await getAll('scans');
  return all.filter(s => !s.synced);
}

export async function deleteScan(clientId) {
  return del('scans', clientId);
}

export async function markSynced(clientId, serverData) {
  const scan = await getScan(clientId);
  if (!scan) return;
  return saveScan({ ...scan, ...serverData, synced: true, syncedAt: Date.now() });
}

export async function markScanSynced(clientId, serverId) {
  return markSynced(clientId, { serverId });
}

// Sync Queue
export async function addToSyncQueue(clientId) {
  return put('syncQueue', { clientId, addedAt: Date.now() });
}

export async function getSyncQueue() {
  return getAll('syncQueue');
}

export async function removeFromSyncQueue(clientId) {
  return del('syncQueue', clientId);
}

// Advice Cache
export async function cacheAdvice(diseaseKey, lang, data) {
  return put('advice', { cacheKey: `${diseaseKey}_${lang}`, diseaseKey, lang, data, cachedAt: Date.now() });
}

export async function getCachedAdvice(diseaseKey, lang) {
  const entry = await get('advice', `${diseaseKey}_${lang}`);
  return entry ? entry.data : null;
}

// Settings
export async function setSetting(key, value) {
  return put('settings', { key, value });
}

export async function getSetting(key) {
  const entry = await get('settings', key);
  return entry ? entry.value : null;
}
