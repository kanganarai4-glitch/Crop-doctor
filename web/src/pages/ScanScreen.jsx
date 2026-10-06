/**
 * web/src/pages/ScanScreen.jsx
 * ─────────────────────────────
 * Camera capture & image upload screen with on-device TFLite inference dispatcher.
 */
import React, { useState, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import { analyzeScan } from '../api/client';
import { saveScan } from '../offline/db';

function ScanScreen({ onDiagnosisComplete }) {
  const { t, currentLanguage } = useLanguage();
  const { isOnline, runOnDeviceInference } = useApp();

  const [selectedImage, setSelectedImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stepMessage, setStepMessage] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setSelectedImage(url);
    }
  };

  const handleStartScan = async () => {
    if (!selectedImage || !imageFile) return;

    setIsAnalyzing(true);
    setStepMessage('⚡ Running on-device TFLite model...');

    try {
      // 1. Run local on-device inference via Web Worker
      const imgElement = new Image();
      imgElement.src = selectedImage;
      await new Promise(r => imgElement.onload = r);

      const localResult = await runOnDeviceInference(imgElement);
      console.log('Local TFLite Result:', localResult);

      let finalResult = {
        diseaseKey: localResult.top1.label,
        confidence: localResult.top1.confidence,
        top3: localResult.top3,
        source: 'on-device (MobileNetV3)',
        heatmapImage: null,
        severity: null,
        severityLabel: null,
        imageBlobUrl: selectedImage,
        timestamp: new Date().toISOString()
      };

      // 2. If online, optionally fetch server EfficientNet + Grad-CAM enhancement
      if (isOnline) {
        setStepMessage('☁️ Fetching server EfficientNet & Grad-CAM heatmap...');
        try {
          const apiRes = await analyzeScan(imageFile, currentLanguage, localResult.top1.label, localResult.top1.confidence);
          if (apiRes && apiRes.prediction) {
            finalResult = {
              ...finalResult,
              diseaseKey: apiRes.diseaseKey || apiRes.prediction.top3[0].label,
              confidence: apiRes.prediction.top3[0].confidence,
              top3: apiRes.prediction.top3,
              source: 'server (EfficientNetB0)',
              heatmapImage: apiRes.gradcam ? apiRes.gradcam.heatmapImage : null,
              severity: apiRes.gradcam ? apiRes.gradcam.severity : null,
              severityLabel: apiRes.gradcam ? apiRes.gradcam.severityLabel : null,
              scanId: apiRes.scanId
            };
          }
        } catch (serverErr) {
          console.warn('Server enhancement failed, using local result:', serverErr.message);
        }
      }

      // 3. Save to IndexedDB
      const clientId = 'offline_scan_' + Date.now();
      await saveScan({
        clientId,
        ...finalResult,
        imageBlob: imageFile,
        synced: isOnline
      });

      setIsAnalyzing(false);
      onDiagnosisComplete(finalResult);

    } catch (err) {
      console.error('Scan analysis error:', err);
      setStepMessage(`Error: ${err.message || 'Analysis failed'}`);
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="page-container scan-page">
      <div className="scan-card">
        <h3>📷 {t('scanLeaf')}</h3>
        <p className="scan-subtitle">
          Take a clear photo of the diseased crop leaf in bright light.
        </p>

        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <div className="preview-container">
          {selectedImage ? (
            <img src={selectedImage} alt="Selected leaf" className="leaf-preview" />
          ) : (
            <div className="placeholder-box" onClick={() => fileInputRef.current?.click()}>
              <span className="placeholder-icon">🍃</span>
              <span>Tap to Capture or Upload Leaf Image</span>
            </div>
          )}
        </div>

        <div className="button-group">
          <button
            className="secondary-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            {selectedImage ? '🔄 Choose Another' : '📁 Choose Image'}
          </button>

          {selectedImage && !isAnalyzing && (
            <button className="primary-btn pulse" onClick={handleStartScan}>
              ⚡ Analyze Leaf
            </button>
          )}
        </div>

        {isAnalyzing && (
          <div className="analysis-progress">
            <div className="spinner"></div>
            <p className="progress-text">{stepMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScanScreen;
