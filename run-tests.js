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
  node run-tests.js --help          # Show this help

Available options:
  --site=SITE_NAME    Test specific site configuration
  --profile=smoke|full|nightly  Preset options (smoke = responsive+Chrome)
  --responsive        Run only responsive tests
  --functionality     Run only functionality tests  
  --list              List all available site configurations
  --help              Show this help message

Examples:
  npm test                                       # Default run for example-site
  node run-tests.js --site=daygroup-local        # Test local development site
  node run-tests.js --site=daygroup-live         # Test live production site
  node run-tests.js --site=nfsmediation-local --responsive
  node run-tests.js --site=daygroup-live --functionality
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
  
  // Determine site to test
  const siteName = argv.site || argv.s || 'example-site';
  
  // Build options from CLI arguments and profile
  const profile = argv.profile;
  const options = {
    responsive: argv.responsive,
    functionality: argv.functionality,
    headed: argv.headed,
    debug: argv.debug,
    project: argv.project,
    profile
  };

  if (profile === 'smoke') {
    options.responsive = true;
    options.functionality = false;
    options.project = options.project || 'Chrome';
  }
  
  try {
    const result = await TestRunner.runTestsForSite(siteName, options);
    process.exit(result.code);
  } catch (error) {
    process.exit(1);
  }
}

async function main() {
  await runTests();
}

main().catch(console.error);
