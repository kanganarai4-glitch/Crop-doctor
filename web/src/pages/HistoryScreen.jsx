/**
 * web/src/pages/HistoryScreen.jsx
 * ────────────────────────────────
 * Displays past diagnosis scans stored in IndexedDB.
 */
import React, { useState, useEffect } from 'react';
import { getAllScans } from '../offline/db';

function HistoryScreen({ onSelectScan, onBack }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getAllScans()
      .then(items => {
        if (isMounted) {
          setScans(items.reverse());
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Failed loading scan history:', err);
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="page-container history-page">
      <div className="history-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h3>📜 Diagnosis History</h3>
      </div>

      {loading ? (
        <div className="loading-card">Loading history...</div>
      ) : scans.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🍃</span>
          <p>No previous scans found.</p>
          <p className="empty-sub">Scanned leaves will be stored locally in IndexedDB.</p>
        </div>
      ) : (
        <div className="history-list">
          {scans.map((scan, idx) => {
            const diseaseKey = scan.diseaseKey || 'unknown';
            const cropName = diseaseKey.split('_')[0].toUpperCase();
            const diseaseName = diseaseKey.split('_').slice(1).join(' ').toUpperCase();
            const confidencePct = Math.round((scan.confidence || 0.8) * 100);

            return (
              <div
                key={scan.clientId || scan.id || idx}
                className="history-item"
                onClick={() => onSelectScan(scan)}
              >
                <div className="history-thumbnail">
                  {scan.imageBlobUrl ? (
                    <img src={scan.imageBlobUrl} alt="Thumbnail" />
                  ) : (
                    <span className="thumb-placeholder">🌿</span>
                  )}
                </div>

                <div className="history-info">
                  <div className="history-row">
                    <span className="crop-tag small">{cropName}</span>
                    <span className={`sync-pill ${scan.synced ? 'synced' : 'pending'}`}>
                      {scan.synced ? '✓ Synced' : '⏳ Unsynced'}
                    </span>
                  </div>
                  <h4 className="history-title">{diseaseName}</h4>
                  <p className="history-date">
                    {scan.timestamp ? new Date(scan.timestamp).toLocaleString() : 'Recent'}
                  </p>
                </div>

                <div className="history-confidence">
                  {confidencePct}%
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default HistoryScreen;
