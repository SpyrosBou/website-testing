#!/usr/bin/env node

const minimist = require('minimist');
const TestRunner = require('./utils/test-runner');

// Parse command line arguments
const argv = minimist(process.argv.slice(2));

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
  --profile=smoke|full|nightly  Preset options (smoke = responsive+Chrome)
  --responsive        Run only responsive tests
  --functionality     Run only functionality tests  
  --accessibility     Run only accessibility-focused tests
  --update-baselines  Update visual baselines for responsive visual tests
  --discover          Refresh the site's testPages from its sitemap before running
  --a11y-tags=all|wcag  Toggle axe rule scoping (default: all)
  --a11y-sample=N|all  Override responsive a11y sample size (default: 3 pages)
  --local             Enable DDEV preflight for local sites (sets ENABLE_DDEV=true and attempts to infer DDEV_PROJECT_PATH)
  --list              List all available site configurations
  --help              Show this help message

Examples:
  npm test                                       # Default run for example-site
  node run-tests.js --site=daygroup-local        # Test local development site
  node run-tests.js --site=daygroup-live         # Test live production site
  node run-tests.js --site=nfsmediation-local --responsive
  node run-tests.js --site=daygroup-live --functionality
  node run-tests.js --site=daygroup-live --accessibility
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
    responsive: argv.responsive,
    functionality: argv.functionality,
    accessibility: argv.accessibility,
    headed: argv.headed,
    debug: argv.debug,
    project: argv.project,
    profile,
    discover: Boolean(argv.discover),
    local: Boolean(argv.local),
    a11yTags: argv['a11y-tags'] || argv.a11yTags,
    a11ySample: argv['a11y-sample'] || argv.a11ySample,
  };

  if (profile === 'smoke') {
    // Smoke = functionality-only, single browser, homepage only
    options.responsive = false;
    options.functionality = true;
    options.project = options.project || 'Chrome';
    process.env.SMOKE = '1';
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
