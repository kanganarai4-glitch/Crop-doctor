/**
 * web/src/pages/DiagnosisScreen.jsx
 * ──────────────────────────────────
 * Detailed diagnosis view displaying prediction scores, Grad-CAM toggle,
 * Web Speech voice playback, and treatment remedies.
 */
import React, { useState, useEffect } from 'react';
import TreatmentTabs from '../components/TreatmentTabs';
import VoicePlayer from '../components/VoicePlayer';
import { useLanguage } from '../context/LanguageContext';
import { fetchDiseaseDetail } from '../api/client';

function DiagnosisScreen({ scanResult, onBack }) {
  const { currentLanguage } = useLanguage();
  const [showGradCam, setShowGradCam] = useState(false);
  const [diseaseDetail, setDiseaseDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const diseaseKey = scanResult?.diseaseKey || 'tomato_early_blight';
  const confidencePct = Math.round((scanResult?.confidence || 0.85) * 100);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchDiseaseDetail(diseaseKey, currentLanguage)
      .then(data => {
        if (isMounted) {
          setDiseaseDetail(data);
          setLoading(false);
        }
      })
      .catch(err => {
        console.warn('Failed to load disease details:', err);
        if (isMounted) {
          // Fallback mock detail for offline/demo
          setDiseaseDetail({
            key: diseaseKey,
            crop: diseaseKey.split('_')[0].toUpperCase(),
            name: diseaseKey.split('_').slice(1).join(' ').toUpperCase(),
            symptoms: 'Dark brown spots with concentric target-board rings on leaves.',
            organic: ['Remove infected leaves.', 'Apply neem oil (3 mL/L).', 'Mulch soil to prevent rain splash.'],
            chemical: ['Spray Mancozeb 75% WP @ 2.5 g/L.', 'Copper oxychloride 50% WP @ 3 g/L.'],
            dosage: '2.5 g per litre of water. Spray every 7-10 days.',
            precautions: 'Wear mask and gloves during spraying.',
            prevention: 'Maintain crop sanitation and proper plant spacing.',
            disclaimer: '⚠️ DISCLAIMER: Follow label instructions. Consult local agriculture officer.'
          });
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [diseaseKey, currentLanguage]);

  const cropName = diseaseDetail?.crop || diseaseKey.split('_')[0];
  const diseaseName = diseaseDetail?.name || diseaseKey.split('_').slice(1).join(' ');

  const speechText = diseaseDetail
    ? `Diagnosis for ${cropName}: ${diseaseName}. Confidence ${confidencePct} percent. Organic remedy: ${diseaseDetail.organic?.[0] || 'Remove infected leaves.'}. Chemical treatment: ${diseaseDetail.chemical?.[0] || 'Spray copper fungicide.'}`
    : `Diagnosis: ${diseaseName}. Confidence ${confidencePct} percent.`;

  return (
    <div className="page-container diagnosis-page">
      <div className="diagnosis-header-bar">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="source-badge">
          {scanResult?.source || 'On-Device AI'}
        </span>
      </div>

      <div className="diagnosis-card">
        <div className="image-wrapper">
          <img
            src={showGradCam && scanResult?.heatmapImage ? scanResult.heatmapImage : (scanResult?.imageBlobUrl || 'https://via.placeholder.com/400x300?text=Leaf+Image')}
            alt="Diagnosis view"
            className="diagnosis-image"
          />
          {scanResult?.heatmapImage && (
            <div className="gradcam-controls">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showGradCam}
                  onChange={(e) => setShowGradCam(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
              <span className="toggle-label">
                {showGradCam ? '🔥 Grad-CAM Heatmap' : '📷 Original Leaf'}
              </span>
            </div>
          )}
        </div>

        <div className="diagnosis-summary">
          <div className="headline-row">
            <div>
              <span className="crop-tag">{cropName}</span>
              <h2 className="disease-title">{diseaseName}</h2>
            </div>
            <div className={`confidence-pill ${confidencePct > 70 ? 'high' : 'medium'}`}>
              {confidencePct}% Match
            </div>
          </div>

          <div className="voice-bar">
            <VoicePlayer textToSpeak={speechText} label="Listen to Diagnosis in Local Language" />
          </div>

          {diseaseDetail?.symptoms && (
            <div className="symptoms-box">
              <h4>🔍 Identified Symptoms</h4>
              <p>{diseaseDetail.symptoms}</p>
            </div>
          )}
        </div>

        {loading ? (
          <div className="loading-card">Loading treatment advice...</div>
        ) : (
          <TreatmentTabs diseaseContent={diseaseDetail} />
        )}
      </div>
    </div>
  );
}

export default DiagnosisScreen;
