// Offscreen document for running BERT model locally
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

function sendProgress(stage, percent) {
  chrome.runtime.sendMessage({ 
    type: 'MODEL_PROGRESS', 
    stage, 
    percent 
  }).catch(() => {});
}

async function initModel() {
  // If already loading or loaded, don't start again
  if (classifier || isLoading) return;
  
  isLoading = true;
  sendProgress('Starting AI Engine...', 10);

  try {
    // FORCE WASM: Your PC's integrated graphics won't handle WebGPU well
    classifier = await pipeline('text-classification', 'Xenova/toxic-bert', {
      device: 'wasm', 
      dtype: 'q8', // <--- IMPORTANT: This uses a "Quantized" (compressed) model
                   // It uses 4x less RAM than the standard version!
      progress_callback: (p) => {
        if (p.status === 'ready') sendProgress('Ready', 100);
      }
    });
  } catch (e) {
    console.error(e);
    sendProgress('Memory Error - Restarting...', 0);
  } finally {
    isLoading = false;
  }
}
    

// Keep your existing analyzeTexts function and message listener below
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

initModel();