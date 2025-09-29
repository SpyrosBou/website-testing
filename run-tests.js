#!/usr/bin/env node

const minimist = require('minimist');
const TestRunner = require('./utils/test-runner');

// Parse command line arguments
const argv = minimist(process.argv.slice(2));

const coerceFlag = (value) => {
  if (value === undefined) return false;
  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase();
    if (normalised === 'false' || normalised === '0') return false;
    if (normalised === 'true' || normalised === '1' || normalised.length === 0) return true;
  }
  return Boolean(value);
};

function showUsage() {
  console.log(`
WordPress Testing Suite Usage:

  npm test                          # Run tests for example-site
  node run-tests.js --site=my-site  # Run for specific site
  node run-tests.js --list          # List available sites
  node run-tests.js --discover      # Refresh sitemap-backed test pages then run
  node run-tests.js --help          # Show this help

Available options:
  --site=SITE_NAME    Test specific site configuration
  --profile=smoke|full|nightly  Preset options (smoke = functionality+Chrome)
  --visual            Run only visual regression tests
  --responsive        Run only responsive structure tests
  --functionality     Run only functionality tests
  --accessibility     Run only accessibility-focused tests
  --full              Run the entire suite (visual + responsive + functionality + accessibility)
  --project=NAME|all  Choose Playwright project(s); defaults to Chrome (desktop)
  --viewport=list|all Comma-separated responsive viewports (mobile,tablet,desktop); defaults to desktop
  --update-baselines  Update visual baselines for visual regression tests
  --discover          Refresh the site's testPages from its sitemap before running
  --a11y-tags=all|wcag  Toggle axe rule scoping (default: all)
  --a11y-sample=N|all  Override responsive a11y sample size (default: 3 pages)
  --a11y-keyboard-steps=N  Override keyboard audit TAB depth (default: 20)
  --local             Enable DDEV preflight for local sites (sets ENABLE_DDEV=true and attempts to infer DDEV_PROJECT_PATH)
  --list              List all available site configurations
  --help              Show this help message

Examples:
  npm test                                       # Default run for example-site
  node run-tests.js --site=daygroup-local        # Test local development site
  node run-tests.js --site=daygroup-live         # Test live production site
  node run-tests.js --site=nfsmediation-local --visual
  node run-tests.js --site=daygroup-live --functionality
  node run-tests.js --site=daygroup-live --accessibility
  node run-tests.js --site=daygroup-live --full
  node run-tests.js --site=daygroup-live --visual --project=all --viewport=all
`);
}

async function runTests() {
  // Handle help and list commands
  if (argv.help || argv.h) {
    showUsage();
    return;
  }

  if (argv.list || argv.l) {
    TestRunner.displaySites();
    return;
  }
  if (argv['update-baselines'] || argv.updateBaselines) {
    const siteName = argv.site || argv.s || 'example-site';
    await TestRunner.updateBaselines(siteName);
    return;
  }

  // Determine site to test
  const siteName = argv.site || argv.s || 'example-site';

  // Build options from CLI arguments and profile
  const profile = argv.profile;
  const options = {
    visual: coerceFlag(argv.visual),
    responsive: coerceFlag(argv.responsive),
    functionality: coerceFlag(argv.functionality),
    accessibility: coerceFlag(argv.accessibility),
    full: coerceFlag(argv.full),
    headed: argv.headed,
    debug: argv.debug,
    project: argv.project,
    viewport: argv.viewport || argv.viewports,
    profile,
    discover: Boolean(argv.discover),
    local: Boolean(argv.local),
    a11yTags: argv['a11y-tags'] || argv.a11yTags,
    a11ySample: argv['a11y-sample'] || argv.a11ySample,
    a11yKeyboardSteps: argv['a11y-keyboard-steps'] || argv.a11yKeyboardSteps,
  };

  if (profile === 'smoke') {
    // Smoke = functionality-only, single browser, homepage only
    options.visual = false;
    options.responsive = false;
    options.functionality = true;
    options.accessibility = false;
    options.full = false;
    options.project = options.project || 'Chrome';
    process.env.SMOKE = '1';
  }

  if (profile === 'nightly') {
    options.visual = true;
    options.responsive = true;
    options.functionality = true;
    options.accessibility = true;
    options.full = false;
    options.project = options.project || 'Chrome';
    options.a11ySample = options.a11ySample || 'all';
    options.a11yKeyboardSteps = options.a11yKeyboardSteps || '40';
    process.env.NIGHTLY = '1';
  }

  if (profile === 'full') {
    options.full = true;
  }

  try {
    const result = await TestRunner.runTestsForSite(siteName, options);
    process.exit(result.code);
  } catch (_error) {
    process.exit(1);
  }
}

async function main() {
  await runTests();
}

main().catch(console.error);
