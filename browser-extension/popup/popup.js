/*
  popup.js - Controls the extension popup UI

  Responsibilities:
  - Display live statistics about scanned/filtered comments
  - Allow the user to trigger scans, reveal/blur content, export reports
  - Manage safe/strict mode including password and recovery flow
  - Provide site-specific configuration (blacklist, sensitivity)
*/

// DOM handles for live stats and control buttons in the popup
const scannedCountLabel = document.getElementById('scannedCount');
const filteredCountLabel = document.getElementById('filteredCount');
const scanBtn = document.getElementById('scanBtn');
const revealBtn = document.getElementById('revealBtn');
const blurAllBtn = document.getElementById('blurAllBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');

// New Elements
const blacklistInput = document.getElementById('blacklistInput');
const saveKeywordsBtn = document.getElementById('saveKeywords');
const enableSafeModeBtn = document.getElementById('enableSafeModeBtn');
const disableSafeModeBtn = document.getElementById('disableSafeModeBtn');
const safeModePass = document.getElementById('safeModePass');
const safeModeControls = document.getElementById('safeModeControls');
const safeModeActive = document.getElementById('safeModeActive');
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
const standardActions = document.getElementById('standardActions');

// Helper: generate a random recovery code
function generateRecoveryCode(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const values = crypto.getRandomValues(new Uint32Array(len));
  for (let i = 0; i < len; i++) out += chars[values[i] % chars.length];
  return out;
}

/**
 * hashStringHex - compute a SHA-256 hash of the given string and return
 * the lowercase hex representation. Used to store a recovery code hash
 * instead of storing the raw code in extension storage.
 */
async function hashStringHex(s) {
  const enc = new TextEncoder();
  const data = enc.encode(s);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * initialize - populate popup controls from chrome.storage and any
 * site-specific settings. Also requests current runtime stats and shows
 * any cached model progress or ready state so the user sees immediate feedback.
 */
async function initialize() {
  const settings = await chrome.storage.local.get(['enabled', 'sensitivity', 'blacklist', 'safeMode', 'password']);
    
  // Load site-specific settings if present
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let hostname = null;
  if (tab?.url) {
    try { hostname = new URL(tab.url).hostname; } catch(e) { hostname = null; }
  }

  let siteSettings = {};
  if (hostname) {
    const siteKey = `siteSettings:${hostname}`;
    const s = await chrome.storage.local.get([siteKey]);
    siteSettings = s[siteKey] || {};
  }

  document.getElementById('enableToggle').checked = settings.enabled !== false;
  document.getElementById('sensitivity').value = siteSettings.sensitivity ?? settings.sensitivity ?? 0.5;
  blacklistInput.value = (siteSettings.blacklist || settings.blacklist || []).join(', ');

  if (settings.safeMode) showSafeModeUI(true); else showSafeModeUI(false);

  requestStats();
  // Show any cached model progress or ready state
  const modelState = await chrome.storage.local.get(['modelProgress', 'modelReady']);
  if (modelState.modelProgress) {
    const p = modelState.modelProgress;
    const container = document.getElementById('progressContainer');
    const fill = document.getElementById('progressFill');
    const stage = document.getElementById('progressStage');
    const percent = document.getElementById('progressPercent');
    if (container && fill && stage && percent) {
      container.classList.remove('hidden');
      fill.style.width = (p.percent ?? 0) + '%';
      stage.textContent = p.stage || 'Initializing...';
      percent.textContent = Math.round((p.percent ?? 0)) + '%';
    }
  }
  if (modelState.modelReady) {
    const statusText = document.getElementById('statusText');
    const statusIndicator = document.querySelector('.status-indicator');
    if (statusText) statusText.textContent = 'Model ready';
    if (statusIndicator) statusIndicator.classList.add('ready');
    const container = document.getElementById('progressContainer');
    if (container) container.classList.add('hidden');
  }
}

// Toggle enable/disable and lazily initialize model when enabling
// When the user enables the extension from the popup, we trigger a lazy
// model initialization so the model can be ready before scanning.
document.getElementById('enableToggle').addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  await chrome.storage.local.set({ enabled });
  if (enabled) {
    // initialize model lazily
    try { chrome.runtime.sendMessage({ type: 'INIT_MODEL' }); } catch(e) {}
  }
});

function showSafeModeUI(isActive) {
    if (isActive) {
        safeModeControls.style.display = 'none';
        safeModeActive.style.display = 'block';
        revealBtn.style.display = 'none'; // Hide reveal in safe mode
    } else {
        safeModeControls.style.display = 'block';
        safeModeActive.style.display = 'none';
        revealBtn.style.display = 'inline-block';
    }
}

// SAFE MODE LOGIC
enableSafeModeBtn.addEventListener('click', () => {
  (async () => {
    const pass = prompt("Set a Parental Control Password:");
    if (!pass) return;
    // generate a recovery code and store only its hash
    const recoveryCode = generateRecoveryCode(12);
    const recoveryHash = await hashStringHex(recoveryCode);
    chrome.storage.local.set({ safeMode: true, password: pass, recoveryHash }, () => {
      showSafeModeUI(true);
      // Show recovery code once and instruct user to store it safely
      alert('Strict Mode enabled. Save this recovery code offline and keep it safe:\n\n' + recoveryCode);
      // Inform content script to hide existing reveal buttons
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {type: 'STRICT_MODE_ON'});
      });
    });
  })();
});

disableSafeModeBtn.addEventListener('click', async () => {
    const settings = await chrome.storage.local.get(['password']);
    if (safeModePass.value === settings.password) {
        chrome.storage.local.set({ safeMode: false }, () => {
            showSafeModeUI(false);
            alert("Safe Mode Disabled");
        });
    } else {
        alert("Incorrect Password");
    }
});

// Forgot password / recovery-code reset flow — requires the recovery code shown when enabling.
forgotPasswordBtn?.addEventListener('click', async () => {
  const code = prompt('Enter your recovery code to reset Strict Mode:');
  if (!code) return;
  const settings = await chrome.storage.local.get(['recoveryHash']);
  const storedHash = settings.recoveryHash || '';
  const enteredHash = await hashStringHex(code);
  if (enteredHash === storedHash && storedHash !== '') {
    chrome.storage.local.set({ safeMode: false, password: '', recoveryHash: '' }, () => {
      showSafeModeUI(false);
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) chrome.tabs.sendMessage(tabs[0].id, { type: 'STRICT_MODE_OFF' });
      });
      alert('Strict Mode has been reset using the recovery code.');
    });
  } else {
    alert('Invalid recovery code. If you do not have the recovery code, contact the device owner.');
  }
});

// KEYWORD LOGIC
saveKeywordsBtn.addEventListener('click', () => {
  const list = blacklistInput.value.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
  // Save site-specific if possible
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    let hostname = null;
    try { hostname = new URL(tab.url).hostname; } catch(e) { hostname = null; }
    if (hostname) {
      const siteKey = `siteSettings:${hostname}`;
      chrome.storage.local.get([siteKey], (res) => {
        const v = res[siteKey] || {};
        v.blacklist = list;
        chrome.storage.local.set({ [siteKey]: v }, () => alert('Blacklist Saved for this site!'));
      });
    } else {
      chrome.storage.local.set({ blacklist: list }, () => { alert('Global blacklist saved!'); });
    }
  });
});

// Existing functionality
function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// sanitizeCsvRow: escapes CSV fields safely before export
function sanitizeCsvField(s) {
  if (s == null) return '""';
  return '"' + String(s).replace(/"/g, '""') + '"';
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STATS_UPDATE') {
    scannedCountLabel.textContent = message.scanned || 0;
    filteredCountLabel.textContent = message.filtered || 0;
  }
  // Receive model load progress updates from background/offscreen
  if (message.type === 'MODEL_PROGRESS') {
    const container = document.getElementById('progressContainer');
    const fill = document.getElementById('progressFill');
    const stage = document.getElementById('progressStage');
    const percent = document.getElementById('progressPercent');
    if (container && fill && stage && percent) {
      container.classList.remove('hidden');
      fill.style.width = (message.percent ?? 0) + '%';
      stage.textContent = message.stage || 'Initializing...';
      percent.textContent = Math.round((message.percent ?? 0)) + '%';
    }
    const statusText = document.getElementById('statusText');
    const statusIndicator = document.querySelector('.status-indicator');
    if (statusText) statusText.textContent = message.stage || 'Loading model...';
    if (statusIndicator) statusIndicator.classList.remove('error');
  }

  // Model ready notification
  if (message.type === 'MODEL_STATUS' && message.ready) {
    const statusText = document.getElementById('statusText');
    const statusIndicator = document.querySelector('.status-indicator');
    const container = document.getElementById('progressContainer');
    const fill = document.getElementById('progressFill');
    const percent = document.getElementById('progressPercent');
    if (statusText) statusText.textContent = 'Model ready';
    if (statusIndicator) statusIndicator.classList.add('ready');
    if (container) container.classList.add('hidden');
    if (fill) fill.style.width = '100%';
    if (percent) percent.textContent = '100%';
  }
});

exportJsonBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'EXPORT_DATA' }, (response) => {
      if (response && response.data.length > 0) {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        downloadFile(blob, 'toxic_report.json');
      } else { alert("No data to export!"); }
    });
  }
});

exportCsvBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'EXPORT_DATA' }, (response) => {
      if (response && response.data.length > 0) {
        const header = ['Timestamp','Category','Comment Text'].map(sanitizeCsvField).join(',');
        const csvRows = response.data.map(item => [sanitizeCsvField(item.timestamp), sanitizeCsvField(item.category), sanitizeCsvField(item.text)].join(','));
        const csvContent = [header, ...csvRows].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv' });
        downloadFile(blob, 'toxic_report.csv');
      } else { alert("No data to export!"); }
    });
  }
});

scanBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // Ensure model is initialized (lazy load) before scanning
  try { await chrome.runtime.sendMessage({ type: 'INIT_MODEL' }); } catch(e) {}
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PAGE' });
});

revealBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { type: 'REVEAL_ALL' });
});

blurAllBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { type: 'BLUR_ALL' });
});

async function requestStats() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'GET_STATS' }).catch(() => {});
}

initialize();