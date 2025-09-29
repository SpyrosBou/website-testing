#!/usr/bin/env node
/* eslint-disable no-empty */
const fs = require('fs');
const path = require('path');

function rmrf(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  const stats = fs.lstatSync(targetPath);
  if (stats.isDirectory() && !stats.isSymbolicLink()) {
    for (const entry of fs.readdirSync(targetPath)) {
      rmrf(path.join(targetPath, entry));
    }
    try {
      fs.rmdirSync(targetPath);
    } catch (_) {}
  } else {
    try {
      fs.unlinkSync(targetPath);
    } catch (_) {}
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
        try {
          fs.rmdirSync(p);
        } catch (_) {}
      }
    } else if (st.mtimeMs < cutoff) {
      try {
        fs.unlinkSync(p);
      } catch (_) {}
    }
  };
  walk(dir);
}

function deleteByGlob(dir, patterns) {
  if (!fs.existsSync(dir)) return;
  const match = (name) =>
    patterns.some((p) => new RegExp(p.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$').test(name));
  const walk = (p) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const e of fs.readdirSync(p)) walk(path.join(p, e));
    } else if (match(p)) {
      try {
        fs.unlinkSync(p);
      } catch (_) {}
    }
  };
  walk(dir);
}

function pruneOldReports(dir, keepCount = 10) {
  if (!fs.existsSync(dir)) return { removed: [], kept: [] };
  const entries = fs
    .readdirSync(dir)
    .map((name) => {
      const fullPath = path.join(dir, name);
      try {
        const st = fs.statSync(fullPath);
        if (st.isDirectory()) {
          return { name, path: fullPath, mtime: st.mtimeMs };
        }
      } catch (_) {}
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);

  const toDelete = entries.slice(keepCount);
  for (const entry of toDelete) {
    rmrf(entry.path);
  }

  return {
    removed: toDelete.map((entry) => entry.name),
    kept: entries.slice(0, keepCount).map((entry) => entry.name),
  };
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
  case 'clean-backup-html':
    rmrf(path.join(process.cwd(), 'playwright-report'));
    console.log('Cleaned backup HTML report');
    break;
  case 'clean-reports':
    {
      const reportsDir = path.join(process.cwd(), 'reports');
      if (!fs.existsSync(reportsDir)) {
        console.log('No reports directory found.');
        break;
      }
      const { removed, kept } = pruneOldReports(reportsDir, 10);
      if (removed.length === 0) {
        console.log('No reports removed (10 most recent preserved).');
      } else {
        console.log(`Removed ${removed.length} report folder(s): ${removed.join(', ')}`);
      }
      if (kept.length > 0) {
        console.log(`Current reports retained: ${kept.join(', ')}`);
      }
    }
    break;
  default:
    console.log('Unknown command');
    process.exit(1);
}
