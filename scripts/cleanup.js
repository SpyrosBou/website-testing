#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function rmrf(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  const stats = fs.lstatSync(targetPath);
  if (stats.isDirectory() && !stats.isSymbolicLink()) {
    for (const entry of fs.readdirSync(targetPath)) {
      rmrf(path.join(targetPath, entry));
    }
    try { fs.rmdirSync(targetPath); } catch (_) {}
  } else {
    try { fs.unlinkSync(targetPath); } catch (_) {}
  }
}

function deleteOlderThan(dir, days) {
  if (!fs.existsSync(dir)) return;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const walk = (p) => {
    if (!fs.existsSync(p)) return;
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const e of fs.readdirSync(p)) walk(path.join(p, e));
      if (fs.readdirSync(p).length === 0) {
        try { fs.rmdirSync(p); } catch (_) {}
      }
    } else if (st.mtimeMs < cutoff) {
      try { fs.unlinkSync(p); } catch (_) {}
    }
  };
  walk(dir);
}

function deleteByGlob(dir, patterns) {
  if (!fs.existsSync(dir)) return;
  const match = (name) => patterns.some((p) => new RegExp(p.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$').test(name));
  const walk = (p) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const e of fs.readdirSync(p)) walk(path.join(p, e));
    } else if (match(p)) {
      try { fs.unlinkSync(p); } catch (_) {}
    }
  };
  walk(dir);
}

const cmd = process.argv[2];

switch (cmd) {
  case 'clean-old-results':
    deleteOlderThan(path.join(process.cwd(), 'test-results'), 15);
    console.log('Cleaned test results older than 15 days (and empty folders).');
    break;
  case 'clean-videos':
    deleteByGlob(path.join(process.cwd(), 'test-results'), ['*.webm']);
    console.log('Cleaned all test videos');
    break;
  case 'clean-traces':
    deleteByGlob(path.join(process.cwd(), 'test-results'), ['*.zip']);
    console.log('Cleaned all trace files');
    break;
  case 'clean-all-results':
    rmrf(path.join(process.cwd(), 'test-results'));
    fs.mkdirSync(path.join(process.cwd(), 'test-results'), { recursive: true });
    console.log('Cleaned all test results');
    break;
  case 'clean-site-results':
    {
      const site = process.env.SITE;
      if (!site) {
        console.log('Usage: SITE=sitename npm run clean-site-results');
        process.exit(0);
      }
      rmrf(path.join(process.cwd(), 'test-results', site));
      console.log(`Cleaned results for site ${site}`);
    }
    break;
  case 'clean-allure':
    rmrf(path.join(process.cwd(), 'allure-results'));
    rmrf(path.join(process.cwd(), 'allure-report'));
    console.log('Cleaned Allure results and reports');
    break;
  case 'clean-backup-html':
    rmrf(path.join(process.cwd(), 'playwright-report'));
    console.log('Cleaned backup HTML report');
    break;
  default:
    console.log('Unknown command');
    process.exit(1);
}

