/*
  background.js - Service worker for the extension

  Responsibilities:
  - Ensure an offscreen document is available to run large/long-running
    model initialization and inference (Manifest V3 offscreen requirement)
  - Relay messages between popup, content scripts, and the offscreen document
  - Track and broadcast model load progress and readiness

  Implementation notes:
  - Uses `chrome.offscreen.createDocument` to host model code in a hidden
    offscreen HTML page (offscreen/offscreen.html). This isolates heavy
    workload away from the service worker thread.
  - Uses simple flags `offscreenReady` and `modelReady` so callers can query state.
*/

let offscreenReady = false;
let modelReady = false;

/**
 * setupOffscreen - ensure an offscreen document exists for model operations.
 * Tries to create the offscreen document with a small exponential backoff
 * to tolerate transient failures (e.g., race conditions during startup).
 */
async function setupOffscreen() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen/offscreen.html')]
  });

  if (existingContexts.length > 0) {
    offscreenReady = true;
    return;
  }

  // Retry with exponential backoff to handle transient errors
  const maxAttempts = 3;
  let attempt = 0;
  while (attempt < maxAttempts && !offscreenReady) {
    try {
      attempt++;
      await chrome.offscreen.createDocument({
        url: 'offscreen/offscreen.html',
        reasons: ['WORKERS'],
        justification: 'Run BERT model for toxicity detection'
      });
      offscreenReady = true;
      break;
    } catch (error) {
      console.warn(`Offscreen creation attempt ${attempt} failed:`, error);
      if (attempt >= maxAttempts) {
        console.error('Failed to create offscreen document after retries:', error);
        break;
      }
      // exponential backoff
      const backoff = 500 * Math.pow(2, attempt - 1);
      await new Promise(res => setTimeout(res, backoff));
    }
  }
}

// Initialize on install or startup

// On installation/default startup, initialize default settings and ensure offscreen
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ enabled: true, sensitivity: 0.5 });
  await setupOffscreen();
});

chrome.runtime.onStartup.addListener(async () => {
  await setupOffscreen();
});

// Handle messages from popup and content scripts
/**
 * Central message router for messages from the popup and content scripts.
 * Supports: GET_MODEL_STATUS, MODEL_READY, MODEL_PROGRESS, ANALYZE_TEXT
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_MODEL_STATUS') {
    sendResponse({ ready: modelReady });
    return true;
  }

  if (message.type === 'MODEL_READY') {
    // Offscreen/transformer signals that the model finished loading
    modelReady = true;
    chrome.storage.local.set({ modelReady: true });
    // Broadcast to popup and all tabs so UI can update immediately
    chrome.runtime.sendMessage({ type: 'MODEL_STATUS', ready: true }).catch(() => {});
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: 'MODEL_STATUS', ready: true }).catch(() => {});
      });
    });
    return true;
  }

  if (message.type === 'MODEL_PROGRESS') {
    // Persist progress snapshot and forward to popup for live updates
    chrome.storage.local.set({ modelProgress: { stage: message.stage, percent: message.percent } });
    try {
      chrome.runtime.sendMessage({ type: 'MODEL_PROGRESS', stage: message.stage, percent: message.percent });
    } catch (e) {}
    return true;
  }

  if (message.type === 'ANALYZE_TEXT') {
    // Forward analysis requests to the offscreen document and return results
    handleAnalyzeRequest(message.texts, message.sensitivity)
      .then(results => sendResponse({ results }))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }

  return false;
});

async function handleAnalyzeRequest(texts, sensitivity) {
  if (!offscreenReady) {
    await setupOffscreen();
  }
  
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_ANALYZE',
      texts,
      sensitivity
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.error) {
        reject(new Error(response.error));
      } else {
        resolve(response?.results || []);
      }
    });
  });
}
