/**
 * web/src/components/TreatmentTabs.jsx
 * ──────────────────────────────────────
 * Tabbed interface displaying organic remedies, chemical treatments,
 * dosage, safety precautions, and long-term prevention rules.
 */
import React, { useState } from 'react';

function TreatmentTabs({ diseaseContent }) {
  const [activeTab, setActiveTab] = useState('organic');

  if (!diseaseContent) {
    return <div className="loading-card">Loading treatment advice...</div>;
  }

  const { organic = [], chemical = [], dosage, precautions, prevention, disclaimer } = diseaseContent;

  return (
    <div className="treatment-card">
      <div className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'organic' ? 'active' : ''}`}
          onClick={() => setActiveTab('organic')}
        >
          🌿 Organic
        </button>
        <button
          className={`tab-btn ${activeTab === 'chemical' ? 'active' : ''}`}
          onClick={() => setActiveTab('chemical')}
        >
          🧪 Chemical
        </button>
        <button
          className={`tab-btn ${activeTab === 'dosage' ? 'active' : ''}`}
          onClick={() => setActiveTab('dosage')}
        >
          ⚖️ Dosage & Safety
        </button>
        <button
          className={`tab-btn ${activeTab === 'prevention' ? 'active' : ''}`}
          onClick={() => setActiveTab('prevention')}
        >
          🛡️ Prevention
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'organic' && (
          <div className="advice-section">
            <h4>🌿 Organic & Biological Remedies</h4>
            <ul>
              {organic.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'chemical' && (
          <div className="advice-section">
            <h4>🧪 Recommended Fungicides / Chemicals</h4>
            <ul>
              {chemical.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'dosage' && (
          <div className="advice-section">
            <h4>⚖️ Recommended Dosage</h4>
            <p className="advice-text">{dosage || 'Follow label instructions.'}</p>
            <h4>⚠️ Safety Precautions</h4>
            <p className="advice-text">{precautions || 'Wear protective gear when spraying.'}</p>
          </div>
        )}

        {activeTab === 'prevention' && (
          <div className="advice-section">
            <h4>🛡️ Long-term Crop Prevention</h4>
            <p className="advice-text">{prevention || 'Maintain crop sanitation and rotation.'}</p>
          </div>
        )}
      </div>

      {disclaimer && (
        <div className="disclaimer-banner">
          <span className="warning-icon">⚠️</span>
          <span className="disclaimer-text">{disclaimer}</span>
        </div>
      )}
    </div>
  );
}

export default TreatmentTabs;
