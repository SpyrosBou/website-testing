#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const openBrowser = require('open');

const args = minimist(process.argv.slice(2));
const reportsDir = path.join(process.cwd(), 'reports');
const REPORT_FILE_NAME = 'report.html';

function loadRunEntries() {
  if (!fs.existsSync(reportsDir)) return [];
  return fs
    .readdirSync(reportsDir)
    .map((name) => {
      const dir = path.join(reportsDir, name);
      try {
        const stats = fs.statSync(dir);
        if (!stats.isDirectory()) return null;
        const runJsonPath = path.join(dir, 'data', 'run.json');
        let meta = null;
        if (fs.existsSync(runJsonPath)) {
          try {
            meta = JSON.parse(fs.readFileSync(runJsonPath, 'utf8'));
          } catch (_error) {
            meta = null;
          }
        }
        return {
          name,
          dir,
          meta,
          mtime: stats.mtimeMs,
        };
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);
}

function formatCount(meta, key) {
  const value = meta?.statusCounts?.[key] ?? 0;
  return String(value).padStart(3, ' ');
}

async function openReport(target) {
  const runEntries = loadRunEntries();
  if (runEntries.length === 0) {
    console.log('No reports found. Run the test suite to generate one.');
    process.exit(1);
  }

  if (!target) {
    const latest = runEntries[0];
    const filePath = path.join(latest.dir, REPORT_FILE_NAME);
    if (!fs.existsSync(filePath)) {
      console.log(`Latest report folder (${latest.name}) does not contain ${REPORT_FILE_NAME}.`);
      process.exit(1);
    }
    console.log(`Opening latest report: ${latest.name}`);
    await openBrowser(filePath, { wait: false });
    return;
  }

  const candidateFile = path.join(reportsDir, target);
  if (fs.existsSync(candidateFile) && candidateFile.endsWith('.html')) {
    await openBrowser(candidateFile, { wait: false });
    return;
  }

  const runFolder = path.join(reportsDir, target);
  const reportPath = path.join(runFolder, REPORT_FILE_NAME);
  if (fs.existsSync(reportPath)) {
    console.log(`Opening report: ${target}`);
    await openBrowser(reportPath, { wait: false });
    return;
  }

  if (fs.existsSync(candidateFile) && fs.statSync(candidateFile).isFile()) {
    console.log(`Opening file: ${candidateFile}`);
    await openBrowser(candidateFile, { wait: false });
    return;
  }

  console.error(`Report not found for target: ${target}`);
  console.error('Use `npm run viewreport -- --list` to see available runs.');
  process.exit(1);
}

function listReports() {
  const runEntries = loadRunEntries();
  if (runEntries.length === 0) {
    console.log('No reports found. Run the test suite to generate one.');
    return;
  }

  console.log('Available reports (newest first):');
  for (const entry of runEntries) {
    const meta = entry.meta;
    const started = meta?.startedAtFriendly || meta?.startedAt || 'unknown start';
    const duration =
      meta?.durationFriendly || (meta?.durationMs ? `${Math.round(meta.durationMs / 1000)}s` : '');
    const summary = meta
      ? `total ${meta.totalTests || 0} | pass ${formatCount(meta, 'passed')} | fail ${formatCount(meta, 'failed')} | skip ${formatCount(meta, 'skipped')}`
      : 'metadata unavailable';
    console.log(`- ${entry.name} :: ${started}${duration ? ` (${duration})` : ''} :: ${summary}`);
  }
}

(async () => {
  if (args.list) {
    listReports();
    return;
  }

  const target = args.file || args.f || args._[0];
  await openReport(target);
})();
