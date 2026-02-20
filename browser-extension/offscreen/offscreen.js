/*
  offscreen.js - Offscreen worker document

  Purpose:
  - Load and run the local ML model (BERT/text-classification) away from the
    service worker thread to avoid memory/time limits and to comply with
    Manifest V3 best practices.
  - Respond to analyze requests and report progress back to the background
    service worker so the popup can display a progress bar.

  Implementation notes:
  - Uses the local `transformers.js` pipeline wrapper to load a quantized
    model from the `models/` directory bundled in the extension.
  - Sends `MODEL_PROGRESS` and `MODEL_READY` messages back to the background
    script for UI updates.
*/
import { pipeline, env } from './transformers.js';

// --- LOCAL CONFIGURATION ---
// Disable remote fetching to prevent security blocks and ensure offline reliability
env.allowRemoteModels = false;
env.allowLocalModels = true;

// Point to the locations of your downloaded files
env.localModelPath = chrome.runtime.getURL('models/'); 
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('offscreen/');
// ---------------------------

let classifier = null;
let isLoading = false;

/**
 * sendProgress - helper to forward model-loading progress to the background script
 * so the popup can show live updates to the user.
 */
function sendProgress(stage, percent) {
  chrome.runtime.sendMessage({ 
    type: 'MODEL_PROGRESS', 
    stage, 
    percent 
  }).catch(() => {});
}

/**
 * initModel - lazily initialize the text-classification pipeline. Uses a
 * quantized WASM backend to reduce memory footprint on client machines.
 * Progress updates are forwarded to the background script.
 */
async function initModel() {
  if (classifier || isLoading) return; // Protect from concurrent inits
  isLoading = true;
  sendProgress('Starting AI Engine...', 10);

  try {
    // Prefer WASM backend with a quantized model to reduce memory use.
    classifier = await pipeline('text-classification', 'Xenova/toxic-bert', {
      device: 'wasm', 
      dtype: 'q8', // Quantized model: significantly smaller memory footprint
      progress_callback: (p) => {
        if (p.status === 'ready') sendProgress('Ready', 100);
      }
    });
    // Notify background/popup that model is available
    try { chrome.runtime.sendMessage({ type: 'MODEL_READY' }).catch(()=>{}); } catch(e){}
  } catch (e) {
    console.error(e);
    sendProgress('Memory Error - Restarting...', 0);
  } finally {
    isLoading = false;
  }
}


/**
 * analyzeTexts - run classification for an array of input strings.
 * Returns a compact summary for each input: whether it was considered
 * toxic, the maximum matching score, and the category labels.
 */
async function analyzeTexts(texts, sensitivity = 0.5) {
  if (!classifier) await initModel();
  const results = [];
  for (const text of texts) {
    try {
      const result = await classifier(text, { topk: null });
      let isToxic = false;
      let maxScore = 0;
      const categories = [];
      for (const item of result) {
        if (item.score > sensitivity) {
          isToxic = true;
          maxScore = Math.max(maxScore, item.score);
          categories.push(item.label);
        }
      }
      results.push({ text: text.substring(0, 50), isToxic, score: maxScore, categories });
    } catch (error) {
      results.push({ text: text.substring(0, 50), isToxic: false, score: 0, categories: [], error: true });
    }
  }
  return results;
}

// Listen for offscreen-specific RPC-style messages from background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OFFSCREEN_ANALYZE') {
    analyzeTexts(message.texts, message.sensitivity).then(results => sendResponse({ results }));
    return true; 
  }
  if (message.type === 'INIT_MODEL') {
    initModel().then(() => sendResponse({ success: true }));
    return true;
  }
});

// Note: model initialization is performed lazily on demand when receiving 'INIT_MODEL'