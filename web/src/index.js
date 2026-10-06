/**
 * web/src/index.js
 * ─────────────────
 * React PWA entry point.
 * Wraps App with LanguageProvider and AppProvider, registers Service Worker.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { LanguageProvider } from './context/LanguageContext';
import { AppProvider } from './context/AppContext';

// Service Worker registration
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered:', reg.scope);
      })
      .catch((err) => console.error('[PWA] SW registration failed:', err));
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <LanguageProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </LanguageProvider>
  </React.StrictMode>
);
