#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('close', (code) => resolve(code === 0));
    p.on('error', () => resolve(false));
  });
}

async function hasJava() {
  return await run('java', ['-version']);
}

async function main() {
  const mode = process.argv[2] || 'report'; // 'report' (generate+open) or 'serve'

  const allureResultsExists = fs.existsSync('allure-results');
  if (!allureResultsExists) {
    console.log('No allure-results found. Run tests first to produce Allure results.');
  }

  const javaOk = await hasJava();
  if (!javaOk) {
    console.error('\nERROR: Java runtime not found. Allure CLI requires Java.');
    console.error('Install a JRE (e.g. apt-get install default-jre, brew install openjdk)');
    console.error('Fallback: open Playwright HTML report instead:');
    console.error('  - Generate by running tests, then open: playwright-report/index.html');
    console.error('  - Or use: npx playwright show-report');
    process.exit(1);
  }

  if (mode === 'serve') {
    // Live server (auto-generates and serves). Requires Java.
    const ok = await run('npx', ['allure', 'serve', 'allure-results']);
    process.exit(ok ? 0 : 1);
  }

  // Default: generate static report then open it
  const generated = await run('npx', [
    'allure',
    'generate',
    'allure-results',
    '-o',
    'allure-report',
    '--clean',
  ]);
  if (!generated) {
    console.error('Failed to generate Allure report.');
    process.exit(1);
  }
  const opened = await run('npx', ['allure', 'open', 'allure-report']);
  process.exit(opened ? 0 : 1);
}

main();
