# Toxic Comment Filter - Browser Extension

An AI-powered browser extension that automatically detects and blurs toxic comments on any webpage using BERT machine learning model.

## Features

- 🤖 **AI-Powered Detection**: Uses BERT model (Xenova/toxic-bert) for accurate toxicity detection
- 🌐 **Universal Support**: Works on YouTube, Twitter/X, Reddit, Facebook, and most websites
- 🔒 **Privacy First**: All processing happens locally in your browser
- ⚡ **WebGPU Accelerated**: Uses GPU when available for faster processing
- 🎚️ **Adjustable Sensitivity**: Control how strict the filtering should be
- 👁️ **Click to Reveal**: Easily reveal individual filtered comments

## Installation

### Chrome / Edge / Brave

1. Download or clone this extension folder
2. Open `chrome://extensions/` in your browser
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `browser-extension` folder

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.json` from the extension folder

> Note: For Firefox, you may need to modify `manifest.json` for Manifest V2 compatibility

## Usage

1. **Click the extension icon** in your browser toolbar to open the popup
2. Wait for the model to load (first time takes ~30 seconds to download ~50MB)
3. **Enable/Disable** filtering using the toggle
4. Adjust **Sensitivity** to control how strict the filter should be
5. Click **Scan Page Now** to manually trigger a scan
6. Click **Reveal All** to show all filtered content

## How It Works

1. **Content Script** scans the page for text elements (comments, posts, etc.)
2. **Offscreen Document** runs the BERT model for toxicity classification
3. Toxic content is **blurred** with a reveal button
4. Stats are shown in the popup

## Technical Details

- **Model**: Xenova/toxic-bert (ONNX format for browser)
- **Runtime**: Uses WebGPU when available, falls back to WASM
- **Architecture**: Manifest V3 with offscreen document for model execution

## File Structure

```
browser-extension/
├── manifest.json          # Extension manifest
├── background/
│   └── background.js      # Service worker
├── content/
│   ├── content.js         # Page content scanner
│   └── content.css        # Blur styles
├── offscreen/
│   ├── offscreen.html     # Offscreen document
│   └── offscreen.js       # Model execution
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Creating Icons

You need to create extension icons. You can:
1. Use an online icon generator
2. Create PNG files at 16x16, 48x48, and 128x128 pixels
3. Place them in the `icons/` folder

## Customization

### Supported Websites

Edit `COMMENT_SELECTORS` in `content/content.js` to add selectors for specific websites.

### Sensitivity

The default sensitivity is 0.5 (50%). Lower values = more filtering, higher values = less filtering.

## Troubleshooting

### Model not loading
- Ensure you have a stable internet connection (first load)
- Check browser console for errors
- Try refreshing the page

### Extension not working on a site
- Some sites block content scripts (like browser extension pages)
- The site might use uncommon HTML selectors

### High memory usage
- The BERT model requires ~200MB RAM
- Close the extension popup when not in use

## License

MIT License - Feel free to modify and distribute.
