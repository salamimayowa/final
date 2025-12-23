// Background service worker for Toxic Comment Filter
// Uses offscreen document for model loading (Manifest V3 requirement)

let offscreenReady = false;
let modelReady = false;

// Create offscreen document for model operations
async function setupOffscreen() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen/offscreen.html')]
  });

  if (existingContexts.length > 0) {
    offscreenReady = true;
    return;
  }

  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['WORKERS'],
      justification: 'Run BERT model for toxicity detection'
    });
    offscreenReady = true;
  } catch (error) {
    console.error('Failed to create offscreen document:', error);
  }
}

// Initialize on install or startup
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ enabled: true, sensitivity: 0.5 });
  await setupOffscreen();
});

chrome.runtime.onStartup.addListener(async () => {
  await setupOffscreen();
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_MODEL_STATUS') {
    sendResponse({ ready: modelReady });
    return true;
  }
  
  if (message.type === 'MODEL_READY') {
    modelReady = true;
    chrome.storage.local.set({ modelReady: true });
    // Broadcast to all tabs and popup
    chrome.runtime.sendMessage({ type: 'MODEL_STATUS', ready: true }).catch(() => {});
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: 'MODEL_STATUS', ready: true }).catch(() => {});
      });
    });
    return true;
  }
  
  if (message.type === 'MODEL_PROGRESS') {
    // Store progress and forward to popup
    chrome.storage.local.set({ modelProgress: { stage: message.stage, percent: message.percent } });
    // This will be received by popup if it's open
    return true;
  }
  
  if (message.type === 'ANALYZE_TEXT') {
    // Forward to offscreen document
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
