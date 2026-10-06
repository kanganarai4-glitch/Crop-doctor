/**
 * web/src/context/LanguageContext.jsx
 * ─────────────────────────────────────
 * Hand-written React context for UI language switching.
 * No i18n library used (per spec).
 *
 * Loads JSON dictionary from src/i18n/<lang>.json.
 * Persists selection to localStorage.
 */
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

// Eagerly import all language dictionaries
import en from '../i18n/en.json';
import hi from '../i18n/hi.json';
import mr from '../i18n/mr.json';
import ta from '../i18n/ta.json';
import te from '../i18n/te.json';
import bn from '../i18n/bn.json';
import kn from '../i18n/kn.json';

export const LANGUAGES = [
  { code: 'en', name: 'English',    native: 'English',     dict: en },
  { code: 'hi', name: 'Hindi',      native: 'हिन्दी',       dict: hi },
  { code: 'mr', name: 'Marathi',    native: 'मराठी',        dict: mr },
  { code: 'ta', name: 'Tamil',      native: 'தமிழ்',        dict: ta },
  { code: 'te', name: 'Telugu',     native: 'తెలుగు',       dict: te },
  { code: 'bn', name: 'Bengali',    native: 'বাংলা',        dict: bn },
  { code: 'kn', name: 'Kannada',    native: 'कन्नड',       dict: kn },
];

const DICT_MAP = Object.fromEntries(LANGUAGES.map(l => [l.code, l.dict]));

const LS_KEY = 'cd_language';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [langCode, setLangCode] = useState(() => {
    return localStorage.getItem(LS_KEY) || 'en';
  });

  const setLanguage = useCallback((code) => {
    localStorage.setItem(LS_KEY, code);
    setLangCode(code);
    document.documentElement.lang = code;
  }, []);

  const dict = useMemo(() => DICT_MAP[langCode] || en, [langCode]);

  /** t(key) — translate a UI string key */
  const t = useCallback((key) => dict[key] || en[key] || key, [dict]);

  const value = useMemo(() => ({
    langCode,
    currentLanguage: langCode,
    setLanguage,
    changeLanguage: setLanguage,
    t,
    dict,
    LANGUAGES
  }), [langCode, setLanguage, t, dict]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return ctx;
}
