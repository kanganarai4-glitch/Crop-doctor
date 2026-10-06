/**
 * web/src/components/VoicePlayer.jsx
 * ───────────────────────────────────
 * Voice playback button for farmers using Web Speech API TTS.
 * Speaks disease diagnosis and treatment in the farmer's selected language.
 */
import React, { useState, useEffect } from 'react';
import { speakText, stopSpeech } from '../utils/audioTts';
import { useLanguage } from '../context/LanguageContext';

function VoicePlayer({ textToSpeak, label = 'Listen' }) {
  const [playing, setPlaying] = useState(false);
  const { currentLanguage } = useLanguage();

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  const handleToggle = () => {
    if (playing) {
      stopSpeech();
      setPlaying(false);
    } else {
      const success = speakText(textToSpeak, currentLanguage, () => {
        setPlaying(false);
      });
      if (success) setPlaying(true);
    }
  };

  return (
    <button className={`voice-btn ${playing ? 'playing' : ''}`} onClick={handleToggle}>
      <span className="voice-icon">{playing ? '🔊' : '🔈'}</span>
      <span className="voice-label">{playing ? 'Stop Voice' : `🔊 ${label}`}</span>
    </button>
  );
}

export default VoicePlayer;
