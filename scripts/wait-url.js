#!/usr/bin/env node
const http = require('http');
const https = require('https');

const urlString = process.argv[2];
if (!urlString) {
  console.error('Usage: node scripts/wait-url.js <url> [timeoutMs]');
  process.exit(1);
}
const timeoutMs = parseInt(process.argv[3] || '120000', 10);
const intervalMs = 2000;

function reachable(u) {
  return new Promise((resolve) => {
    try {
      const url = new URL(u);
      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.request(u, { timeout: 3000 }, (res) => {
        resolve(res.statusCode && res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    } catch (_) { resolve(false); }
  });
}

(async () => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await reachable(urlString)) {
      console.log('URL reachable:', urlString);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.error('Timed out waiting for', urlString);
  process.exit(1);
})();

