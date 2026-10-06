/**
 * web/src/App.jsx
 * ────────────────
 * Main PWA Root Component assembling Header, Navigation, and all Screen Views.
 */
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LanguageSelector from './components/LanguageSelector';
import HomeScreen from './pages/HomeScreen';
import ScanScreen from './pages/ScanScreen';
import DiagnosisScreen from './pages/DiagnosisScreen';
import HistoryScreen from './pages/HistoryScreen';
import CatalogScreen from './pages/CatalogScreen';
import { useApp } from './context/AppContext';
import { initAutoSync } from './offline/syncManager';

function App() {
  const { activeTab, setActiveTab } = useApp();
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);
  const [activeScanResult, setActiveScanResult] = useState(null);

  useEffect(() => {
    initAutoSync();
  }, []);

  const handleDiagnosisComplete = (result) => {
    setActiveScanResult(result);
    setActiveTab('diagnosis');
  };

  const handleSelectCatalogDisease = (key) => {
    setActiveScanResult({
      diseaseKey: key,
      confidence: 0.95,
      source: 'Disease Catalog',
      imageBlobUrl: null,
      heatmapImage: null
    });
    setActiveTab('diagnosis');
  };

  const handleSelectHistoryScan = (scan) => {
    setActiveScanResult(scan);
    setActiveTab('diagnosis');
  };

  return (
    <div className="app-shell">
      <Header onOpenLangModal={() => setIsLangModalOpen(true)} />

      <main className="app-main">
        {activeTab === 'home' && (
          <HomeScreen onNavigate={(tab) => setActiveTab(tab)} />
        )}

        {activeTab === 'scan' && (
          <ScanScreen onDiagnosisComplete={handleDiagnosisComplete} />
        )}

        {activeTab === 'diagnosis' && (
          <DiagnosisScreen
            scanResult={activeScanResult}
            onBack={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'history' && (
          <HistoryScreen
            onSelectScan={handleSelectHistoryScan}
            onBack={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'catalog' && (
          <CatalogScreen
            onSelectDisease={handleSelectCatalogDisease}
            onBack={() => setActiveTab('home')}
          />
        )}
      </main>

      <nav className="bottom-nav">
        <button
          className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Home</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'scan' ? 'active' : ''}`}
          onClick={() => setActiveTab('scan')}
        >
          <span className="nav-icon">📷</span>
          <span className="nav-label">Scan</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="nav-icon">📜</span>
          <span className="nav-label">History</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'catalog' ? 'active' : ''}`}
          onClick={() => setActiveTab('catalog')}
        >
          <span className="nav-icon">📖</span>
          <span className="nav-label">Catalog</span>
        </button>
      </nav>

      <LanguageSelector
        isOpen={isLangModalOpen}
        onClose={() => setIsLangModalOpen(false)}
      />
    </div>
  );
}

export default App;
