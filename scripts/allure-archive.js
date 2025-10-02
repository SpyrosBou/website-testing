#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const archiver = require('archiver');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const error = new Error(`${cmd} ${args.join(' ')} exited with code ${code}`);
        error.code = code;
        reject(error);
      }
    });
  });
}

async function ensureReportGenerated({ resultsDir, reportDir, forceRegenerate }) {
  if (!fs.existsSync(resultsDir)) {
    throw new Error('No allure-results found. Run tests first to produce Allure results.');
  }

  if (!forceRegenerate && fs.existsSync(reportDir)) {
    return;
  }

  console.log('INFO: Generating Allure HTML report.');
  await run('npx', ['allure', 'generate', resultsDir, '-o', reportDir, '--clean']);
}

async function archiveReport({ reportDir, archivesDir, outputName }) {
  await fs.promises.mkdir(archivesDir, { recursive: true });
  const outPath = path.join(archivesDir, outputName);

  console.log(`INFO: Creating archive at ${outPath}`);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(reportDir, false);
    archive.finalize();
  });

  return outPath;
}

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

async function main() {
  const cwd = process.cwd();
  const resultsDir = path.join(cwd, 'allure-results');
  const reportDir = path.join(cwd, 'allure-report');
  const archivesDir = path.join(cwd, 'reports', 'archives');

  const args = process.argv.slice(2);
  const shouldRegenerate = args.includes('--regenerate') || args.includes('--rebuild');

  try {
    await ensureReportGenerated({
      resultsDir,
      reportDir,
      forceRegenerate: shouldRegenerate,
    });
  } catch (error) {
    console.error(`ERROR: Unable to generate Allure report: ${error.message}`);
    process.exit(1);
  }

  const timestamp = formatTimestamp();
  const outputName = `allure-report-${timestamp}.zip`;

  try {
    const archivePath = await archiveReport({
      reportDir,
      archivesDir,
      outputName,
    });
    console.log(`SUCCESS: Allure report archived to ${archivePath}`);
    console.log('\nShare this zip with stakeholders for an offline Allure report.');
  } catch (error) {
    console.error(`ERROR: Failed to create archive: ${error.message}`);
    process.exit(1);
  }
}

main();
