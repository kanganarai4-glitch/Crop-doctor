/**
 * web/src/pages/HomeScreen.jsx
 * ─────────────────────────────
 * Main dashboard / welcome screen for farmers.
 */
import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';

function HomeScreen({ onNavigate }) {
  const { t } = useLanguage();
  const { isOnline, modelStatus } = useApp();

  return (
    <div className="page-container home-page">
      <div className="hero-card">
        <div className="hero-badge">
          {modelStatus.ready ? '⚡ On-Device AI Ready' : '⌛ Loading AI Engine...'}
        </div>
        <h2 className="hero-title">{t('tagline')}</h2>
        <p className="hero-subtitle">
          Instantly diagnose leaf diseases in seconds — works 100% offline without internet connection!
        </p>

        <div className="hero-actions">
          <button className="primary-btn scan-btn" onClick={() => onNavigate('scan')}>
            📷 {t('scanLeaf')}
          </button>
          <button className="secondary-btn catalog-btn" onClick={() => onNavigate('catalog')}>
            📖 Disease Catalog
          </button>
        </div>
      </div>

      <div className="features-grid">
        <div className="feature-card" onClick={() => onNavigate('scan')}>
          <div className="feature-icon">⚡</div>
          <h3>Offline Diagnosis</h3>
          <p>Instant MobileNet inference runs directly inside your phone's browser.</p>
        </div>

        <div className="feature-card" onClick={() => onNavigate('history')}>
          <div className="feature-icon">📜</div>
          <h3>Scan History</h3>
          <p>Access your past crop diagnoses anytime and auto-sync when online.</p>
        </div>

        <div className="feature-card" onClick={() => onNavigate('catalog')}>
          <div className="feature-icon">🌱</div>
          <h3>26 Disease Guides</h3>
          <p>Comprehensive remedies, chemical dosages, and precautions for 5 major crops.</p>
        </div>
      </div>

      {!isOnline && (
        <div className="offline-notice">
          <span className="notice-icon">📶</span>
          <span className="notice-text">
            You are currently offline. On-device scan works normally. Online Grad-CAM enhancement will resume once internet is restored.
          </span>
        </div>
      )}
    </div>
  );
}

export default HomeScreen;
