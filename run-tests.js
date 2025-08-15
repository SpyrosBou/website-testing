#!/usr/bin/env node

const minimist = require('minimist');
const TestRunner = require('./utils/test-runner');
const InteractiveMode = require('./utils/interactive');

// Parse command line arguments
const argv = minimist(process.argv.slice(2));

function showUsage() {
  console.log(`
WordPress Testing Suite Usage:

  node run-tests.js                 # Interactive mode (recommended)
  npm test                          # Run tests for example-site
  npm run test:site example-site    # Test specific site
  node run-tests.js --site=my-site  # Alternative syntax
  node run-tests.js --list          # List available sites
  node run-tests.js --help          # Show this help

Available options:
  --interactive       Start interactive mode
  --site=SITE_NAME    Test specific site configuration
  --responsive        Run only responsive tests
  --functionality     Run only functionality tests  
  --list              List all available site configurations
  --help              Show this help message

Examples:
  node run-tests.js                              # Interactive mode
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
  
  // Build options from CLI arguments
  const options = {
    responsive: argv.responsive,
    functionality: argv.functionality,
    headed: argv.headed,
    debug: argv.debug,
    project: argv.project
  };
  
  try {
    const result = await TestRunner.runTestsForSite(siteName, options);
    process.exit(result.code);
  } catch (error) {
    process.exit(1);
  }
}

async function main() {
  // Check if no arguments provided or interactive flag
  const hasArguments = Object.keys(argv).length > 1 || (Object.keys(argv).length === 1 && argv._?.length > 0);
  
  if (!hasArguments || argv.interactive) {
    // Start interactive mode
    const interactive = new InteractiveMode();
    await interactive.start();
  } else {
    // Run CLI mode
    await runTests();
  }
}

main().catch(console.error);