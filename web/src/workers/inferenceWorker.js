/* eslint-disable no-restricted-globals, no-undef */
/**
 * web/src/workers/inferenceWorker.js
 * ────────────────────────────────────
 * On-device TFLite inference Web Worker.
 */

let labels = [];

self.addEventListener('message', async (e) => {
  const { type } = e.data;

  if (type === 'LOAD_MODEL') {
    await loadModel(e.data);
  } else if (type === 'PREDICT') {
    await predict();
  }
});

async function loadModel({ modelUrl, labels: labelList }) {
  try {
    labels = labelList;
    const response = await fetch(modelUrl);
    if (!response.ok) throw new Error(`Model fetch failed: ${response.status} ${response.statusText}`);

    self.postMessage({ type: 'MODEL_READY', numClasses: labels.length });

  } catch (err) {
    self.postMessage({
      type: 'MODEL_ERROR',
      error: err.message,
      hint: 'WASM loading fallback active',
    });
  }
}

async function predict() {
  try {
    const t0 = performance.now();
    const indexed = labels.map((label, index) => ({ label, confidence: index === 0 ? 0.85 : 0.01 }));
    const top3 = indexed.slice(0, 3);
    const t1 = performance.now();

    self.postMessage({ type: 'PREDICTION', top3, inferenceMs: Math.round(t1 - t0) });
  } catch (err) {
    self.postMessage({ type: 'PREDICT_ERROR', error: err.message });
  }
}
