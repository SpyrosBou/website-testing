#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const openModule = require('open');
const openBrowser = openModule.default || openModule;

const args = minimist(process.argv.slice(2));
const defaultBrowser = args.browser || args.b || process.env.REPORT_BROWSER || 'google-chrome';
const order = (args.order || args.o || 'newest').toLowerCase();
const browserArgRaw = args['browser-arg'] || args['browserArgs'] || args['browser-args'];
const explicitBrowserArgs = Array.isArray(browserArgRaw)
  ? browserArgRaw.map(String)
  : browserArgRaw != null
    ? [String(browserArgRaw)]
    : [];
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
        return {
          name,
          dir,
          mtime: stats.mtimeMs,
        };
      } catch (_error) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);
}

async function main() {
  const runEntries = loadRunEntries();
  if (runEntries.length === 0) {
    console.log('No reports found. Run the test suite to generate one.');
    process.exit(1);
  }

  const rawCount = args._[0] ?? args.count ?? args.c ?? 1;
  const count = Math.max(1, Number.parseInt(rawCount, 10) || 1);

  let toOpen = runEntries.slice(0, count);
  if (order === 'oldest') {
    toOpen = toOpen.slice().reverse();
  }
  if (toOpen.length === 0) {
    console.log('No reports available to open.');
    return;
  }

  console.log(`Opening ${toOpen.length} report(s):`);
  const browserName = defaultBrowser;
  let browserArgs = explicitBrowserArgs.slice();
  if (browserArgs.length === 0 && browserName.toLowerCase().includes('chrome')) {
    browserArgs = ['--new-window'];
  }
  for (const entry of toOpen) {
    const reportPath = path.join(entry.dir, REPORT_FILE_NAME);
    if (!fs.existsSync(reportPath)) {
      console.warn(`- ${entry.name}: skipped (missing ${REPORT_FILE_NAME})`);
      continue;
    }
    console.log(`- ${entry.name}`);
    try {
      const appOptions = browserArgs.length > 0 ? { name: browserName, arguments: browserArgs } : { name: browserName };
      await openBrowser(reportPath, { wait: false, app: appOptions });
      if (browserArgs.length > 0 || browserName.toLowerCase().includes('firefox')) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    } catch (error) {
      console.error(`  Failed to open with ${browserName}: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error('Failed to open reports:', error.message);
  process.exit(1);
});
