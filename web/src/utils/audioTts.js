/**
 * web/src/utils/audioTts.js
 * ──────────────────────────
 * Text-to-Speech (TTS) helper using Web Speech API (window.speechSynthesis).
 * Offline voice support for Indian languages (Hindi, Marathi, Tamil, Telugu, Bengali, Kannada, English).
 */

const LANG_BCP47_MAP = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  bn: 'bn-IN',
  kn: 'kn-IN',
};

let currentUtterance = null;

export function speakText(text, lang = 'en', onEndCallback = null) {
  if (!('speechSynthesis' in window)) {
    console.warn('Web Speech API is not supported in this browser.');
    if (onEndCallback) onEndCallback();
    return false;
  }

  // Cancel any ongoing speech
  stopSpeech();

  if (!text || text.trim() === '') {
    if (onEndCallback) onEndCallback();
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const targetLang = LANG_BCP47_MAP[lang] || 'en-IN';
  utterance.lang = targetLang;
  utterance.rate = 0.9; // slightly slower for clarity for farmers

  // Try to find matching voice
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith(targetLang.toLowerCase()));
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  if (onEndCallback) {
    utterance.onend = () => {
      currentUtterance = null;
      onEndCallback();
    };
    utterance.onerror = (e) => {
      console.error('TTS utterance error:', e);
      currentUtterance = null;
      onEndCallback();
    };
  }

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}

export function isSpeaking() {
  return Boolean(currentUtterance) || ('speechSynthesis' in window && window.speechSynthesis.speaking);
}
