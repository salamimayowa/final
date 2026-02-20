/*
  content.js - Content script for the Toxic Comment Filter browser extension

  Responsibilities:
  - Scan the current page for user-generated text (comments, posts, tweets, etc.)
  - Batch candidate text snippets and request toxicity analysis from the
    background/offscreen ML pipeline
  - Apply visual protections (global overlay or per-item blur) when toxic
    content is detected
  - Maintain lightweight local state such as counts, history, and a small
    conversation context to improve short-term contextual analysis

  Notes about design decisions:
  - Uses a WeakSet (`processedElements`) to avoid memory leaks when tracking DOM nodes
  - Respects a `safe mode` which prevents revealing blurred content without a popup password
  - Keeps operations lightweight: skip scanning when document is hidden and batch requests
*/

// Whether the extension's filtering behavior is currently active for this tab
let isEnabled = true;

// Sensitivity threshold in [0..1] used to decide if an AI score indicates toxicity
// A lower value -> more aggressive filtering; default 0.5 is a balanced starting point
let sensitivity = 0.5;

// WeakSet of DOM nodes we've already examined/modified so we don't duplicate work
let processedElements = new WeakSet();

// Global overlay state: true when the page-wide safety warning is visible
let isPageBlurred = false;

// User-provided blacklist keywords (site-specific or global)
let blacklist = [];

// When true, interactive 'reveal' buttons are suppressed to enforce strict mode
let isSafeMode = false;

// Short contextual memory: small FIFO of recent non-toxic comments to help context-aware checks
let conversationContext = [];

// Basic runtime stats and a local history of filtered items for export
let scannedCount = 0;
let filteredCount = 0;
let filteredHistory = [];

const COMMENT_SELECTORS = [
  '#content-text', 'yt-formatted-string#content-text',
  '[data-testid="tweetText"]', '.tweet-text',
  '.Comment', '.comment-body', '.comment-text', 'p', 'li'
];

const MIN_TEXT_LENGTH = 15;
const BATCH_SIZE = 5;

async function initialize() {
  const settings = await chrome.storage.local.get(['enabled', 'sensitivity', 'blacklist', 'safeMode']);
  isEnabled = settings.enabled !== false;
  sensitivity = settings.sensitivity || 0.5;
  blacklist = settings.blacklist || [];
  isSafeMode = !!settings.safeMode;

  // Load site-specific settings if present
  try {
    const hostname = window.location.hostname;
    const siteKey = `siteSettings:${hostname}`;
    const siteSettings = await chrome.storage.local.get([siteKey]);
    if (siteSettings && siteSettings[siteKey]) {
      const s = siteSettings[siteKey];
      sensitivity = s.sensitivity ?? sensitivity;
      if (Array.isArray(s.blacklist)) blacklist = Array.from(new Set([...blacklist, ...s.blacklist]));
    }
  } catch (e) {}

  if (isEnabled) {
    setTimeout(() => scanPage(), 1500);
    observeDOM();
  }
}

function observeDOM() {
  const observer = new MutationObserver(() => {
    if (!isEnabled) return;
    clearTimeout(window.scanTimeout);
    window.scanTimeout = setTimeout(() => scanPage(), 1000);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// STAGE 1: GLOBAL POPUP
// applyGlobalBlur: show a focused overlay to warn the user about toxic content.
// This function creates a dialog that does not disable browser chrome or
// global pointer events to avoid locking the user out of the page.
function applyGlobalBlur() {
  if (isPageBlurred || isSafeMode) return; // Don't show bypass if in safe mode
  isPageBlurred = true;

  // Create a focused overlay rather than disabling all pointer events on the page
  const overlay = document.createElement('div');
  overlay.id = 'toxic-global-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.innerHTML = `
    <div style="background: white; padding: 28px; border-radius: 12px; text-align: center; pointer-events: auto; font-family: sans-serif; border: 4px solid #ff4757; box-shadow: 0 12px 30px rgba(0,0,0,0.4); max-width: 640px;">
      <h1 style="color: #ff4757; margin-bottom: 8px;">⚠️ Safety Alert</h1>
      <p style="font-size: 16px; color: #2f3542; margin-bottom: 10px;">Toxic content detected on this page.</p>
      <button id="unlock-page-btn" style="background: #ff4757; color: white; border: none; padding: 10px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 8px;">
        ENTER COMMUNITY ANYWAY
      </button>
    </div>`;
  Object.assign(overlay.style, {
    position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: '2147483647', background: 'rgba(0,0,0,0.55)', pointerEvents: 'auto'
  });
  document.documentElement.appendChild(overlay);
  document.getElementById('unlock-page-btn').addEventListener('click', () => {
    isPageBlurred = false;
    const ov = document.getElementById('toxic-global-overlay');
    if (ov) ov.remove();
  });
}

// STAGE 2: SCANNING & DATA COLLECTION
async function scanPage() {
  // scanPage: find candidate text elements, deduplicate, batch, and send
  // them to the background/offscreen pipeline for analysis.
  if (!isEnabled) return;
  // Skip scanning when the document is hidden to save CPU and battery.
  if (document.hidden) return;
  const elements = [];
  const seen = new Set();
  
  for (const selector of COMMENT_SELECTORS) {
    document.querySelectorAll(selector).forEach(el => {
      const isAlreadyBlurred = el.closest('.toxic-filter-blurred');
      const hasBtn = el.querySelector('.toxic-filter-reveal-btn') || el.parentElement.querySelector('.toxic-filter-reveal-btn');
      
      if (!processedElements.has(el) && !isAlreadyBlurred && !hasBtn && !seen.has(el)) {
        const text = el.textContent?.trim();
        if (text && text.length >= MIN_TEXT_LENGTH) {
          seen.add(el);
          elements.push({ element: el, text: text.substring(0, 500) });
        }
      }
    });
  }

  if (elements.length === 0) return;

  elements.forEach(item => {
    processedElements.add(item.element);
    scannedCount++;
  });
  sendStatsToPopup();

  for (let i = 0; i < elements.length; i += BATCH_SIZE) {
    const batch = elements.slice(i, i + BATCH_SIZE);
    
    // FEATURE: Blacklist Pre-check
    const blacklistedBatch = batch.map(item => {
        return blacklist.some(word => item.text.toLowerCase().includes(word));
    });

    // FEATURE: Contextual Analysis - prepend previous comments to current batch
    const contextString = conversationContext.join(" | ");
    const textsToAnalyze = batch.map(item => `${contextString} [CURRENT]: ${item.text}`);

    const response = await chrome.runtime.sendMessage({
      type: 'ANALYZE_TEXT',
      texts: textsToAnalyze,
      sensitivity
    });

    if (response?.results) {
      response.results.forEach((result, index) => {
        const isBlacklisted = blacklistedBatch[index];
        
        if (result.isToxic || isBlacklisted) {
          filteredCount++;
          filteredHistory.push({
            timestamp: new Date().toLocaleString(),
            category: isBlacklisted ? 'Blacklisted Word' : (result.categories[0] || 'Toxic'),
            text: batch[index].text
          });
          
          applyGlobalBlur();
          // Pass the AI score to the blur function for the tooltip
          const displayScore = isBlacklisted ? 100 : Math.round(result.score * 100);
          applyIndividualBlur(batch[index].element, displayScore);
        } else {
            // Update context with non-toxic text to help understand the conversation flow
            conversationContext.push(batch[index].text);
            if(conversationContext.length > 3) conversationContext.shift();
        }
      });
      sendStatsToPopup();
    }
  }
}

// STAGE 3: INDIVIDUAL BLUR
function applyIndividualBlur(element, score) {
  element.classList.add('toxic-filter-blurred');
  
  // Tooltip/Badge Container
  const wrapper = document.createElement('div');
  wrapper.className = 'toxic-filter-wrapper';
  wrapper.style.position = 'relative';

  // FEATURE: Real-time Toxicity Badge
  const badge = document.createElement('div');
  badge.className = 'toxic-score-badge';
  badge.innerHTML = `${score}% Match`;
  Object.assign(badge.style, {
    position: 'absolute', top: '-10px', left: '10px', background: '#ff4757',
    color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '10px',
    zIndex: '10001', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
  });

  if (!isSafeMode) {
      const revealBtn = document.createElement('button');
      revealBtn.className = 'toxic-filter-reveal-btn';
      revealBtn.innerHTML = `Show Toxic Content`;
      Object.assign(revealBtn.style, {
        display: 'block', margin: '10px 0', padding: '8px 16px', background: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
      });
      revealBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        element.classList.remove('toxic-filter-blurred');
        element.classList.add('toxic-filter-revealed');
        revealBtn.remove();
        badge.remove();
      });
      element.parentNode?.insertBefore(revealBtn, element);
  }
  
  element.parentNode?.insertBefore(badge, element);
}

function sendStatsToPopup() {
  chrome.runtime.sendMessage({
    type: 'STATS_UPDATE',
    scanned: scannedCount,
    filtered: filteredCount
  }).catch(() => {});
}

function revealAll() {
  if (isSafeMode) return; // Prevent reveal in safe mode
  const overlay = document.getElementById('toxic-global-overlay');
  if (overlay) overlay.remove();
  document.querySelectorAll('.toxic-filter-blurred').forEach(el => {
    el.classList.remove('toxic-filter-blurred');
    el.classList.add('toxic-filter-revealed');
  });
  document.querySelectorAll('.toxic-filter-reveal-btn').forEach(btn => btn.remove());
  document.querySelectorAll('.toxic-score-badge').forEach(b => b.remove());
}

function blurAll() {
  if (isPageBlurred && !document.getElementById('toxic-global-overlay')) {
    isPageBlurred = false;
    applyGlobalBlur();
  }
  document.querySelectorAll('.toxic-filter-revealed').forEach(el => {
    el.classList.add('toxic-filter-blurred');
    el.classList.remove('toxic-filter-revealed');
    if (!el.parentNode.querySelector('.toxic-filter-reveal-btn')) applyIndividualBlur(el, "AI");
  });
}

// CONSOLIDATED MESSAGE LISTENER
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REVEAL_ALL') revealAll();
  if (message.type === 'BLUR_ALL') blurAll();
  if (message.type === 'GET_STATS') sendStatsToPopup();
  if (message.type === 'EXPORT_DATA') sendResponse({ data: filteredHistory });
  if (message.type === 'STRICT_MODE_ON') {
      isSafeMode = true;
      document.querySelectorAll('.toxic-filter-reveal-btn').forEach(b => b.remove());
  }
  if (message.type === 'STRICT_MODE_OFF') {
      isSafeMode = false;
      // Note: we don't re-create reveal buttons here; future blurs will add them as needed.
  }
  if (message.type === 'SCAN_PAGE') {
    processedElements = new WeakSet();
    scannedCount = 0;
    filteredCount = 0;
    scanPage();
  }
  return true;
});

initialize();