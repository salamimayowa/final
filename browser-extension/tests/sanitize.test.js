// Simple tests for export sanitization and CSV escaping
function escapeCsvField(s) {
  if (s == null) return '""';
  return '"' + String(s).replace(/"/g, '""') + '"';
}

// Basic assertions
function assertEqual(a,b, msg) {
  if (a !== b) throw new Error(msg || `Assertion failed: ${a} !== ${b}`);
}

// Run tests
function run() {
  assertEqual(escapeCsvField('abc'), '"abc"');
  assertEqual(escapeCsvField('a"b"c'), '"a""b""c"');
  assertEqual(escapeCsvField(null), '""');
  console.log('sanitize.test.js passed');
}

run();
