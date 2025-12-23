// Popup script for Toxic Comment Filter extension

const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const enableToggle = document.getElementById('enableToggle');
const sensitivitySlider = document.getElementById('sensitivity');
const scannedCount = document.getElementById('scannedCount');
const filteredCount = document.getElementById('filteredCount');
const scanBtn = document.getElementById('scanBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const revealBtn = document.getElementById('revealBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressStage = document.getElementById('progressStage');
const progressPercent = document.getElementById('progressPercent');

// Load saved settings
async function loadSettings() {
  const settings = await chrome.storage.local.get(['enabled', 'sensitivity', 'modelReady', 'modelProgress']);
  
  enableToggle.checked = settings.enabled !== false;
  sensitivitySlider.value = settings.sensitivity || 0.5;
  
  if (settings.modelReady) {
    setStatus('ready', 'Model ready');
    hideProgress();
    scanBtn.disabled = false;
  } else {
    setStatus('loading', 'Loading model...');
    showProgress(settings.modelProgress || { stage: 'Initializing...', percent: 0 });
    scanBtn.disabled = true;
  }
}

function setStatus(status, text) {
  statusIndicator.className = 'status-indicator ' + status;
  statusText.textContent = text;
}

function showProgress(progress) {
  progressContainer.classList.remove('hidden');
  if (progress.percent === -1) {
    progressFill.classList.add('indeterminate');
    progressFill.style.width = '30%';
  } else {
    progressFill.classList.remove('indeterminate');
    progressFill.style.width = progress.percent + '%';
  }
  progressStage.textContent = progress.stage || 'Loading...';
  progressPercent.textContent = progress.percent === -1 ? '' : progress.percent + '%';
}

function hideProgress() {
  progressContainer.classList.add('hidden');
}

// Save settings when changed
enableToggle.addEventListener('change', async () => {
  await chrome.storage.local.set({ enabled: enableToggle.checked });
  
  // Notify content script
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'TOGGLE_FILTER',
      enabled: enableToggle.checked
    }).catch(() => {});
  }
});

sensitivitySlider.addEventListener('change', async () => {
  await chrome.storage.local.set({ sensitivity: parseFloat(sensitivitySlider.value) });
  
  // Notify content script to re-scan with new sensitivity
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'UPDATE_SENSITIVITY',
      sensitivity: parseFloat(sensitivitySlider.value)
    }).catch(() => {});
  }
});

scanBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning...';
    
    chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PAGE' }).catch(() => {});
    
    setTimeout(() => {
      scanBtn.disabled = false;
      scanBtn.textContent = 'Scan Page Now';
    }, 2000);
  }
});

revealBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'REVEAL_ALL' }).catch(() => {});
  }
});

// Export functions
exportJsonBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'EXPORT_DATA', format: 'json' }).catch(() => {});
  }
});

exportCsvBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'EXPORT_DATA', format: 'csv' }).catch(() => {});
  }
});

// Listen for stats updates from content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STATS_UPDATE') {
    scannedCount.textContent = message.scanned || 0;
    filteredCount.textContent = message.filtered || 0;
  }
  
  if (message.type === 'MODEL_STATUS') {
    if (message.ready) {
      setStatus('ready', 'Model ready');
      hideProgress();
      scanBtn.disabled = false;
    } else if (message.error) {
      setStatus('error', 'Model error');
      hideProgress();
    } else {
      setStatus('loading', message.status || 'Loading...');
    }
  }
  
  if (message.type === 'MODEL_PROGRESS') {
    showProgress({
      stage: message.stage,
      percent: message.percent
    });
    setStatus('loading', message.stage);
  }
});

// Request current stats from content script
async function requestStats() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'GET_STATS' }).catch(() => {});
  }
}

// Initialize
loadSettings();
requestStats();

// Check model status from background
chrome.runtime.sendMessage({ type: 'GET_MODEL_STATUS' });
