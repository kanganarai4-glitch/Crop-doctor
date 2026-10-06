/**
 * web/src/offline/syncManager.js
 * ───────────────────────────────
 * Background sync manager for offline scans stored in IndexedDB.
 * Syncs scans to Express API when online connectivity returns.
 */

import { getUnsyncedScans, markScanSynced } from './db';
import { syncOfflineScans } from '../api/client';

export async function triggerSync() {
  if (!navigator.onLine) {
    return { success: false, reason: 'offline' };
  }

  try {
    const unsynced = await getUnsyncedScans();
    if (!unsynced || unsynced.length === 0) {
      return { success: true, count: 0 };
    }

    console.log(`[SyncManager] Found ${unsynced.length} unsynced offline scans. Syncing...`);
    const result = await syncOfflineScans(unsynced);

    if (result && result.synced) {
      for (const item of result.synced) {
        if (item.clientId) {
          await markScanSynced(item.clientId, item.serverId);
        }
      }
    }

    console.log(`[SyncManager] Successfully synced ${unsynced.length} scans.`);
    return { success: true, count: unsynced.length };
  } catch (err) {
    console.error('[SyncManager] Offline sync failed:', err.message);
    return { success: false, error: err.message };
  }
}

export function initAutoSync() {
  window.addEventListener('online', () => {
    console.log('[SyncManager] Device came online. Triggering sync...');
    triggerSync();
  });
}
