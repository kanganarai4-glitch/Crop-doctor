/**
 * web/src/pages/CatalogScreen.jsx
 * ────────────────────────────────
 * Comprehensive 26-disease catalog searchable by crop.
 */
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { fetchDiseases } from '../api/client';
import labelsData from '../labels.json';

const CROPS = ['All', 'Tomato', 'Potato', 'Rice', 'Maize', 'Wheat'];

function CatalogScreen({ onSelectDisease, onBack }) {
  const { currentLanguage } = useLanguage();
  const [selectedCrop, setSelectedCrop] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [diseases, setDiseases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchDiseases(currentLanguage)
      .then(res => {
        if (isMounted) {
          setDiseases(res.diseases || []);
          setLoading(false);
        }
      })
      .catch(err => {
        console.warn('API disease catalog fetch failed, loading local labels:', err.message);
        if (isMounted) {
          const fallbackList = labelsData.classes.map(key => {
            const parts = key.split('_');
            const crop = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
            const name = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
            return { key, crop, name, symptoms: 'Select to view organic and chemical treatment advice.' };
          });
          setDiseases(fallbackList);
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [currentLanguage]);

  const filtered = diseases.filter(item => {
    const matchesCrop = selectedCrop === 'All' || item.crop.toLowerCase() === selectedCrop.toLowerCase();
    const matchesQuery = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.key.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCrop && matchesQuery;
  });

  return (
    <div className="page-container catalog-page">
      <div className="catalog-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h3>📖 Disease Catalog (26 Diseases)</h3>
      </div>

      <div className="catalog-controls">
        <input
          type="text"
          placeholder="🔍 Search disease or crop..."
          className="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className="crop-pills">
          {CROPS.map(c => (
            <button
              key={c}
              className={`crop-pill ${selectedCrop === c ? 'active' : ''}`}
              onClick={() => setSelectedCrop(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-card">Loading catalog...</div>
      ) : (
        <div className="catalog-grid">
          {filtered.map(item => (
            <div
              key={item.key}
              className="catalog-card"
              onClick={() => onSelectDisease(item.key)}
            >
              <div className="catalog-row">
                <span className="crop-tag small">{item.crop}</span>
                <span className="arrow-icon">→</span>
              </div>
              <h4 className="catalog-title">{item.name}</h4>
              <p className="catalog-symptoms">{item.symptoms}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CatalogScreen;
