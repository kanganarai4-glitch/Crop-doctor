/**
 * web/src/components/Header.jsx
 * ──────────────────────────────
 * App top header with logo, language selector, and online/offline status pill.
 */
import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';

function Header({ onOpenLangModal }) {
  const { t, currentLanguage } = useLanguage();
  const { isOnline, setActiveTab } = useApp();

  const langNames = {
    en: 'English',
    hi: 'हिंदी',
    mr: 'मराठी',
    ta: 'தமிழ்',
    te: 'తెలుగు',
    bn: 'বাংলা',
    kn: 'ಕನ್ನಡ'
  };

  return (
    <header className="app-header">
      <div className="header-brand" onClick={() => setActiveTab('home')}>
        <span className="brand-logo">🌿</span>
        <div className="brand-titles">
          <span className="brand-name">{t('appName')}</span>
          <span className="brand-tagline">{t('tagline')}</span>
        </div>
      </div>

      <div className="header-actions">
        <div className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
          <span className="status-dot"></span>
          <span className="status-text">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        <button className="lang-btn" onClick={onOpenLangModal} aria-label="Select Language">
          🌐 <span className="lang-label">{langNames[currentLanguage] || 'Lang'}</span>
        </button>
      </div>
    </header>
  );
}

export default Header;
