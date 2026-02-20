# Tests and How to Run

This folder contains a tiny test for CSV sanitization used by the popup export.

Run in Node (quick):

```bash
node browser-extension/tests/sanitize.test.js
```

In a browser, the popup export behavior can be validated by loading the extension
in developer mode and using the export buttons on pages with sample filtered data.
