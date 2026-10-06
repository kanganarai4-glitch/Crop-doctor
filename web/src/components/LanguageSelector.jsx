/**
 * web/src/components/LanguageSelector.jsx
 * ─────────────────────────────────────────
 * Modal for selecting local Indian languages (7 languages).
 */
import React from 'react';
import { useLanguage } from '../context/LanguageContext';

const LANGUAGES = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'hi', native: 'हिंदी', english: 'Hindi' },
  { code: 'mr', native: 'मराठी', english: 'Marathi' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali' },
  { code: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada' },
];

function LanguageSelector({ isOpen, onClose }) {
  const { currentLanguage, changeLanguage, t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content lang-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🌐 {t('selectLanguage')}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="lang-grid">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              className={`lang-card ${currentLanguage === lang.code ? 'selected' : ''}`}
              onClick={() => {
                changeLanguage(lang.code);
                onClose();
              }}
            >
              <span className="lang-native">{lang.native}</span>
              <span className="lang-english">{lang.english}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LanguageSelector;
