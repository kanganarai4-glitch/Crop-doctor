/**
 * web/src/api/client.js
 * ─────────────────────
 * Fetch wrapper for CropDoctor API.
 * Reads token from localStorage. 8s timeout per spec requirement.
 */

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const TIMEOUT  = 8000;

function getToken() {
  return localStorage.getItem('cd_token');
}

async function request(method, path, { body, isFormData = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body && !isFormData) headers['Content-Type'] = 'application/json';

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw Object.assign(new Error(err.error || 'API error'), { status: res.status, data: err });
    }
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw Object.assign(new Error('Request timed out'), { status: 408 });
    throw err;
  }
}

export const api = {
  get: (path)           => request('GET', path),
  post: (path, body)    => request('POST', path, { body }),
  postForm: (path, fd)  => request('POST', path, { body: fd, isFormData: true }),
};

// Auth
export const guestLogin  = ()               => api.post('/auth/guest', {});
export const requestOtp  = (phone)          => api.post('/auth/otp', { phone });
export const verifyOtp   = (phone, otp)     => api.post('/auth/verify', { phone, otp });

// Scan
export const uploadScan = (formData) => api.postForm('/scans/analyze', formData);
export const analyzeScan = async (file, lang = 'en', onDeviceLabel = null, onDeviceConfidence = null) => {
  const fd = new FormData();
  fd.append('image', file);
  if (onDeviceLabel) fd.append('onDeviceLabel', onDeviceLabel);
  if (onDeviceConfidence) fd.append('onDeviceConfidence', onDeviceConfidence);
  return api.postForm(`/scans/analyze?lang=${lang}`, fd);
};
export const getScans   = (page = 1) => api.get(`/scans?page=${page}`);

// Disease
export const fetchDiseases = (lang = 'en') => api.get(`/disease?lang=${lang}`);
export const fetchDiseaseDetail = (key, lang = 'en') => api.get(`/disease/${key}?lang=${lang}`);
export const getDisease = (key, lang = 'en') => api.get(`/disease/${key}?lang=${lang}`);

// Sync
export const syncOfflineScans = (scans) => api.post('/sync', { scans });
export const syncScans = (scans) => api.post('/sync', { scans });

// Feedback
export const submitFeedback = (scanId, correct, correctedLabel) =>
  api.post('/feedback', { scanId, correct, correctedLabel });

// Model
export const getModelVersion = () => api.get('/model/latest');
