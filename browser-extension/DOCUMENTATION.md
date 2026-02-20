# Toxic Comment Filter — Documentation

This document describes how the browser extension works, its architecture, message flows, storage keys, run instructions, tests, and troubleshooting notes.

## Overview

The extension scans pages for comment-like text, runs a local BERT-based toxicity model in an offscreen document (Manifest V3), and blurs or flags toxic content. All model execution happens locally; remote fetching is disabled by default.

## Quick Start

- Load the extension in Chrome/Edge: `chrome://extensions` → Developer mode → Load unpacked → select the `browser-extension` folder.
- Open the popup and enable filtering. The popup will lazily initialize the model (saves memory until needed).
- Click `Scan Page Now` to run a manual scan.

Files of interest:

- `background/background.js` — service worker, creates offscreen document and routes messages.
- `offscreen/offscreen.js` — runs the ML pipeline (lazy load), responds to `OFFSCREEN_ANALYZE` and `INIT_MODEL`.
- `content/content.js` — scans DOM, applies blurs/reveals, shows overlay/dialogs.
- `popup/popup.js` — UI for toggles, sensitivity, blacklist, exports, and site-specific settings.
- `models/Xenova/toxic-bert/` — local model artifacts used by `offscreen`.

## Architecture & Message Flows

1. Content script scans page, batches candidate texts, and sends a message to the background:
   - `ANALYZE_TEXT` — content → background; payload: `{ texts: string[], sensitivity: number }`.

2. Background forwards analysis to the offscreen document:
   - Background sends `OFFSCREEN_ANALYZE` to the offscreen script and waits for results.

3. Offscreen (model runner) messages:
   - Listens for `OFFSCREEN_ANALYZE` — runs `analyzeTexts()` and returns `{ results }`.
   - Listens for `INIT_MODEL` — triggers lazy model initialization.
   - Sends progress updates to runtime: `MODEL_PROGRESS` (stage, percent) and `MODEL_READY` when done.

4. Popup interactions:
   - Popup sends `INIT_MODEL` when user enables filtering or triggers a scan.
   - Popup sends tab messages to content scripts: `SCAN_PAGE`, `REVEAL_ALL`, `BLUR_ALL`, `EXPORT_DATA`.
   - Popup receives `STATS_UPDATE` messages from content scripts to show scanned/filtered counts.

5. Content script actions on analysis results:
   - Applies per-element blurs and a focused overlay dialog for page-wide warnings.
   - Sends `STATS_UPDATE` messages back to the popup.

## Storage Keys (in `chrome.storage.local`)

- `enabled` — filtering enabled (boolean).
- `sensitivity` — global threshold (number).
- `blacklist` — array of words (global blacklist).
- `safeMode` — strict-mode enabled (parental controls).
- `password` — safe-mode unlock password (stored locally).
- `modelReady` — model ready flag (set by offscreen when loaded).
- `modelProgress` — object with `{ stage, percent }` published during load.
- `siteSettings:<hostname>` — per-site settings object, e.g. `{ sensitivity, blacklist }`.

## Design Decisions & Security

- Host permissions were reduced from `<all_urls>` to common social sites to minimize attack surface; edit `manifest.json` to expand.
- `content_security_policy` for extension pages was hardened: `object-src 'none'`.
- `offscreen/offscreen.js` sets `env.allowRemoteModels = false` and `env.allowLocalModels = true` to prevent remote model fetching.
- Model loading is lazy to reduce memory usage on startup.

## Testing

Unit test included:

- `browser-extension/tests/sanitize.test.js` — simple Node script validating CSV field escaping used by popup export.

Run the test locally with Node:

```bash
node browser-extension/tests/sanitize.test.js
```

Manual runtime checks:

1. Load the extension unpacked.
2. Open the popup — check model progress messages and that toggling `Enable Filtering` triggers `INIT_MODEL`.
3. Click `Scan Page Now` on a page with comments — open DevTools Console in the tab to observe messages and any errors.
4. Use `Export` buttons to test CSV/JSON generation.

## Troubleshooting

- If the offscreen document fails to create, the background worker retries with exponential backoff (3 attempts). Check the service worker console for warnings.
- If the model fails due to memory, consider using a machine with more RAM or switching to a smaller quantized model variant. The code uses dtype `q8` to save memory.
- If exports contain malformed CSV, ensure the popup's `sanitizeCsvField` is applied (it is by default in current code).

### Strict Mode recovery

- When enabling Strict Mode the popup generates a one-time recovery code and shows it to the parent. The extension stores only a SHA-256 hash of that recovery code (`recoveryHash`) in `chrome.storage.local` — the plaintext code is not stored.
- To recover (if the parent forgets the password) the parent must use the `Forgot Password / Reset` button and enter the recovery code. The popup will hash the entered code and compare it to the stored hash; if it matches, `safeMode`, `password`, and `recoveryHash` are cleared and the active tab is notified to lift strict-mode restrictions.

Recommendations:
- Store the recovery code offline (written down in a safe place). If the recovery code is lost, the only guaranteed recovery is to remove and reinstall the extension (which clears extension-local storage).


## Change Log (recent edits)

- Reduced `host_permissions` and tightened CSP.
- Implemented offscreen creation retries (`background/background.js`).
- Made model lazy-load and added `INIT_MODEL` path (`offscreen/offscreen.js`, `popup/popup.js`).
- Replaced blocking page blur with focused overlay to avoid locking browser UI (`content/content.js`).
- Added per-site settings storage and UI handling in the popup.
- Added CSV sanitization and a test for it.

## Next Steps

- Add automated E2E tests for message flows (background ↔ offscreen ↔ content ↔ popup).
- Add a smaller fallback model binary and a model-selection UI for low-memory devices.
- Integrate more selectors for specific websites and improve detection heuristics.

---
