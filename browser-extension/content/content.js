// Content script for Toxic Comment Filter
// Scans page content and applies blur to toxic comments

let isEnabled = true;
let sensitivity = 0.5;
let scannedCount = 0;
let filteredCount = 0;
let processedElements = new WeakSet();
let filteredHistory = []; // Store filtered comment history

// Text selectors commonly used for comments across websites
const COMMENT_SELECTORS = [
  // YouTube
  '#content-text',
  'yt-formatted-string#content-text',
  // Twitter/X
  '[data-testid="tweetText"]',
  '.tweet-text',
  // Reddit
  '.Comment',
  '.md',
  '[data-testid="comment"]',
  '.RichTextJSON-root',
  // Facebook
  '[data-ad-preview="message"]',
  '.userContent',
  // Generic comment patterns
  '.comment-content',
  '.comment-body',
  '.comment-text',
  '.post-content',
  '.message-content',
  '.reply-content',
  // Forum patterns
  '.post-body',
  '.message-body',
  '.forum-post',
  // Generic text containers (less specific)
  'p',
  'span',
  'div'
];

// Minimum text length to analyze
const MIN_TEXT_LENGTH = 10;
const MAX_TEXT_LENGTH = 500;
const BATCH_SIZE = 10;

async function initialize() {
  const settings = await chrome.storage.local.get(['enabled', 'sensitivity']);
  isEnabled = settings.enabled !== false;
  sensitivity = settings.sensitivity || 0.5;
  
  if (isEnabled) {
    // Wait a bit for dynamic content to load
    setTimeout(() => scanPage(), 1500);
    
    // Set up mutation observer for dynamically loaded content
    observeDOM();
  }
}

function observeDOM() {
  const observer = new MutationObserver((mutations) => {
    if (!isEnabled) return;
    
    let hasNewContent = false;
    
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        hasNewContent = true;
        break;
      }
    }
    
    if (hasNewContent) {
      // Debounce scanning
      clearTimeout(window.scanTimeout);
      window.scanTimeout = setTimeout(() => scanPage(), 500);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function getTextElements() {
  const elements = [];
  const seen = new Set();
  
  for (const selector of COMMENT_SELECTORS) {
    try {
      const found = document.querySelectorAll(selector);
      for (const el of found) {
        // Skip if already processed or seen
        if (processedElements.has(el) || seen.has(el)) continue;
        
        // Skip hidden elements
        if (el.offsetParent === null) continue;
        
        // Get text content
        const text = el.textContent?.trim();
        if (!text || text.length < MIN_TEXT_LENGTH) continue;
        
        // Skip elements that are mostly links or buttons
        const links = el.querySelectorAll('a, button');
        if (links.length > 3) continue;
        
        seen.add(el);
        elements.push({
          element: el,
          text: text.substring(0, MAX_TEXT_LENGTH)
        });
      }
    } catch (e) {
      // Ignore invalid selectors
    }
  }
  
  return elements;
}

async function scanPage() {
  if (!isEnabled) return;
  
  const textElements = getTextElements();
  
  if (textElements.length === 0) {
    sendStats();
    return;
  }
  
  // Process in batches
  for (let i = 0; i < textElements.length; i += BATCH_SIZE) {
    const batch = textElements.slice(i, i + BATCH_SIZE);
    const texts = batch.map(item => item.text);
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_TEXT',
        texts,
        sensitivity
      });
      
      if (response?.results) {
        response.results.forEach((result, index) => {
          const item = batch[index];
          processedElements.add(item.element);
          scannedCount++;
          
          if (result.isToxic) {
            applyBlur(item.element, result);
            filteredCount++;
            
            // Add to history
            filteredHistory.push({
              timestamp: new Date().toISOString(),
              url: window.location.href,
              text: item.text,
              score: result.score,
              categories: result.categories
            });
          }
        });
      }
    } catch (error) {
      console.error('Error analyzing batch:', error);
    }
  }
  
  sendStats();
}

function applyBlur(element, result) {
  // Don't re-blur
  if (element.classList.contains('toxic-filter-blurred')) return;
  
  element.classList.add('toxic-filter-blurred');
  element.dataset.toxicScore = result.score;
  element.dataset.toxicCategories = result.categories.join(', ');
  
  // Create reveal button
  const revealBtn = document.createElement('button');
  revealBtn.className = 'toxic-filter-reveal-btn';
  revealBtn.textContent = '👁 Click to reveal';
  revealBtn.title = `Filtered: ${result.categories.join(', ')} (${Math.round(result.score * 100)}% confidence)`;
  
  revealBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    element.classList.remove('toxic-filter-blurred');
    element.classList.add('toxic-filter-revealed');
    revealBtn.remove();
  });
  
  // Insert button before the element
  element.parentNode?.insertBefore(revealBtn, element);
}

function revealAll() {
  document.querySelectorAll('.toxic-filter-blurred').forEach(el => {
    el.classList.remove('toxic-filter-blurred');
    el.classList.add('toxic-filter-revealed');
  });
  
  document.querySelectorAll('.toxic-filter-reveal-btn').forEach(btn => btn.remove());
}

function sendStats() {
  chrome.runtime.sendMessage({
    type: 'STATS_UPDATE',
    scanned: scannedCount,
    filtered: filteredCount,
    historyCount: filteredHistory.length
  }).catch(() => {});
}

function exportData(format) {
  const exportData = {
    exportDate: new Date().toISOString(),
    pageUrl: window.location.href,
    pageTitle: document.title,
    statistics: {
      totalScanned: scannedCount,
      totalFiltered: filteredCount,
      filterRate: scannedCount > 0 ? ((filteredCount / scannedCount) * 100).toFixed(2) + '%' : '0%'
    },
    filteredComments: filteredHistory
  };

  let content, filename, mimeType;

  if (format === 'json') {
    content = JSON.stringify(exportData, null, 2);
    filename = `toxic-filter-export-${Date.now()}.json`;
    mimeType = 'application/json';
  } else {
    // CSV format
    const headers = ['Timestamp', 'URL', 'Text', 'Toxicity Score', 'Categories'];
    const rows = filteredHistory.map(item => [
      item.timestamp,
      item.url,
      `"${item.text.replace(/"/g, '""')}"`,
      (item.score * 100).toFixed(2) + '%',
      item.categories.join('; ')
    ]);
    
    content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    filename = `toxic-filter-export-${Date.now()}.csv`;
    mimeType = 'text/csv';
  }

  // Create and trigger download
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'TOGGLE_FILTER':
      isEnabled = message.enabled;
      if (isEnabled) {
        scanPage();
      } else {
        revealAll();
      }
      break;
      
    case 'UPDATE_SENSITIVITY':
      sensitivity = message.sensitivity;
      // Reset and re-scan
      processedElements = new WeakSet();
      scannedCount = 0;
      filteredCount = 0;
      revealAll();
      scanPage();
      break;
      
    case 'SCAN_PAGE':
      processedElements = new WeakSet();
      scannedCount = 0;
      filteredCount = 0;
      scanPage();
      break;
      
    case 'REVEAL_ALL':
      revealAll();
      break;
      
    case 'GET_STATS':
      sendStats();
      break;
      
    case 'EXPORT_DATA':
      exportData(message.format);
      break;
      
    case 'MODEL_STATUS':
      // Model status update from background
      break;
  }
  
  return true;
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
