#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const openModule = require('open');
const openBrowser = openModule.default || openModule;

const args = minimist(process.argv.slice(2));
const envBrowser = process.env.REPORT_BROWSER && String(process.env.REPORT_BROWSER).trim();
const envBrowserArgs = process.env.REPORT_BROWSER_ARGS
  ? String(process.env.REPORT_BROWSER_ARGS).split(/\s+/).filter(Boolean)
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

function resolveCount() {
  const positional = args._.map(String).filter(Boolean);
  const numericArg = positional.find((value) => /^\d+$/.test(value));
  const count = Math.max(1, Number.parseInt(numericArg, 10) || 1);
  return count;
}

function resolveBrowserConfig() {
  if (envBrowser) {
    return { name: envBrowser, args: envBrowserArgs };
  }

  if (process.platform === 'linux') {
    return { name: 'google-chrome', args: ['--new-window'] };
  }

  return { name: null, args: [] };
}

async function openEntries(entries) {
  if (entries.length === 0) {
    console.log('No reports available to open.');
    return;
  }

  console.log(`Opening ${entries.length} report(s):`);
  const { name: browserName, args: initialArgs } = resolveBrowserConfig();
  const browserArgs = initialArgs.slice();
  if (browserName && browserArgs.length === 0 && browserName.toLowerCase().includes('chrome')) {
    browserArgs.push('--new-window');
  }

  for (const entry of entries) {
    const reportPath = path.join(entry.dir, REPORT_FILE_NAME);
    if (!fs.existsSync(reportPath)) {
      console.warn(`- ${entry.name}: skipped (missing ${REPORT_FILE_NAME})`);
      continue;
    }
    console.log(`- ${entry.name}`);
    try {
      if (browserName) {
        const appOptions =
          browserArgs.length > 0
            ? { name: browserName, arguments: browserArgs }
            : { name: browserName };
        await openBrowser(reportPath, { wait: false, app: appOptions });
      } else {
        await openBrowser(reportPath, { wait: false });
      }
      if (
        browserArgs.length > 0 ||
        (browserName && browserName.toLowerCase().includes('firefox'))
      ) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    } catch (error) {
      if (browserName) {
        console.error(`  Failed to open with ${browserName}: ${error.message}`);
      } else {
        console.error(`  Failed to open report: ${error.message}`);
      }
    }
  }
}

async function main() {
  const runEntries = loadRunEntries();
  if (runEntries.length === 0) {
    console.log('No reports found. Run the test suite to generate one.');
    process.exit(1);
  }

  const count = resolveCount();
  const toOpen = runEntries.slice(0, count);

  await openEntries(toOpen);
}

main().catch((error) => {
  console.error('Failed to open reports:', error.message);
  process.exit(1);
});
