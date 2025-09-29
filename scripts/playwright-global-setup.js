const fs = require('fs');
const path = require('path');

module.exports = async () => {
  if (String(process.env.PW_SKIP_RESULT_CLEAN || '').toLowerCase() === 'true') {
    console.log('⚠️  Skipping automatic result cleanup (PW_SKIP_RESULT_CLEAN=true).');
    return;
  }

  const cwd = process.cwd();
  const targets = ['playwright-report', 'test-results'];

  for (const target of targets) {
    const targetPath = path.join(cwd, target);
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`⚠️  Failed to remove ${target}: ${error.message}`);
      }
    }
  }

  console.log('🧹 Cleared previous test artifacts');
};
