#!/usr/bin/env node

const { spawn } = require('child_process');
const minimist = require('minimist');
const SiteLoader = require('./utils/site-loader');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const argv = minimist(process.argv.slice(2));

function showUsage() {
  console.log(`
WordPress Testing Suite Usage:

  npm test                          # Run tests for example-site
  npm run test:site example-site    # Test specific site
  node run-tests.js --site=my-site  # Alternative syntax
  node run-tests.js --list          # List available sites
  node run-tests.js --help          # Show this help

Available options:
  --site=SITE_NAME    Test specific site configuration
  --responsive        Run only responsive tests
  --functionality     Run only functionality tests  
  --list              List all available site configurations
  --help              Show this help message

Examples:
  node run-tests.js --site=daygroup-local        # Test local development site
  node run-tests.js --site=daygroup-live         # Test live production site
  node run-tests.js --site=nfsmediation-local --responsive
  node run-tests.js --site=daygroup-live --functionality
`);
}

function listSites() {
  const sites = SiteLoader.listAvailableSites();
  
  if (sites.length === 0) {
    console.log('No site configurations found in ./sites/ directory');
    console.log('Create a .json file in ./sites/ directory with your site configuration');
    return;
  }
  
  console.log('Available site configurations:');
  
  // Group by site type (local vs live)
  const localSites = [];
  const liveSites = [];
  const otherSites = [];
  
  sites.forEach(site => {
    try {
      const config = SiteLoader.loadSite(site);
      if (site.includes('-local')) {
        localSites.push({ name: site, config });
      } else if (site.includes('-live')) {
        liveSites.push({ name: site, config });
      } else {
        otherSites.push({ name: site, config });
      }
    } catch (error) {
      otherSites.push({ name: site, config: null });
    }
  });
  
  if (localSites.length > 0) {
    console.log('\n  🏠 Local Development Sites:');
    localSites.forEach(site => {
      console.log(`    ${site.name}: ${site.config.name} (${site.config.baseUrl})`);
    });
  }
  
  if (liveSites.length > 0) {
    console.log('\n  🌐 Live Production Sites:');
    liveSites.forEach(site => {
      console.log(`    ${site.name}: ${site.config.name} (${site.config.baseUrl})`);
    });
  }
  
  if (otherSites.length > 0) {
    console.log('\n  📝 Other Sites:');
    otherSites.forEach(site => {
      if (site.config) {
        console.log(`    ${site.name}: ${site.config.name} (${site.config.baseUrl})`);
      } else {
        console.log(`    ${site.name}: [Error loading config]`);
      }
    });
  }
  
  console.log('\nTesting examples:');
  console.log('  node run-tests.js --site=daygroup-local      # Test local development');
  console.log('  node run-tests.js --site=daygroup-live       # Test live production');
}

async function runTests() {
  // Handle help and list commands
  if (argv.help || argv.h) {
    showUsage();
    return;
  }
  
  if (argv.list || argv.l) {
    listSites();
    return;
  }
  
  // Determine site to test
  const siteName = argv.site || argv.s || 'example-site';
  
  // Validate site exists
  try {
    const siteConfig = SiteLoader.loadSite(siteName);
    SiteLoader.validateSiteConfig(siteConfig);
    console.log(`Running tests for: ${siteConfig.name}`);
    console.log(`Base URL: ${siteConfig.baseUrl}`);
    console.log(`Pages to test: ${siteConfig.testPages.join(', ')}`);
    console.log('');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.log('');
    listSites();
    process.exit(1);
  }
  
  // Create test-results directory
  const resultsDir = path.join(__dirname, 'test-results', 'screenshots');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  // Determine which tests to run
  let testPattern = './tests/*.spec.js';
  if (argv.responsive) {
    testPattern = './tests/responsive.spec.js';
  } else if (argv.functionality) {
    testPattern = './tests/functionality.spec.js';
  }
  
  // Set environment variable for site name
  process.env.SITE_NAME = siteName;
  
  // Run Playwright tests
  const playwrightArgs = [
    'test',
    testPattern,
    '--reporter=html',
    '--reporter=line'
  ];
  
  // Add any additional playwright args
  if (argv.headed) playwrightArgs.push('--headed');
  if (argv.debug) playwrightArgs.push('--debug');
  if (argv.project) playwrightArgs.push(`--project=${argv.project}`);
  
  console.log(`Starting tests...`);
  console.log(`Command: npx playwright ${playwrightArgs.join(' ')}`);
  console.log('');
  
  const playwright = spawn('npx', ['playwright', ...playwrightArgs], {
    stdio: 'inherit',
    env: { ...process.env, SITE_NAME: siteName }
  });
  
  playwright.on('close', (code) => {
    console.log('');
    if (code === 0) {
      console.log('✅ Tests completed successfully!');
      console.log('📊 View detailed report: npx playwright show-report');
      console.log(`📸 Screenshots saved in: ./test-results/screenshots/`);
    } else {
      console.log('❌ Some tests failed.');
      console.log('📊 View detailed report: npx playwright show-report');
    }
    process.exit(code);
  });
  
  playwright.on('error', (error) => {
    console.error('Error running tests:', error.message);
    process.exit(1);
  });
}

runTests();