const { spawn } = require('child_process');
const SiteLoader = require('./site-loader');
const path = require('path');
const fs = require('fs');

class TestRunner {
  
  static listSites() {
    const sites = SiteLoader.listAvailableSites();
    
    if (sites.length === 0) {
      console.log('No site configurations found in ./sites/ directory');
      console.log('Create a .json file in ./sites/ directory with your site configuration');
      return { localSites: [], liveSites: [], otherSites: [] };
    }
    
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
    
    return { localSites, liveSites, otherSites };
  }

  static displaySites() {
    const { localSites, liveSites, otherSites } = this.listSites();
    
    console.log('Available site configurations:');
    
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

  static async runTestsForSite(siteName, options = {}) {
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
      this.displaySites();
      throw error;
    }
    
    // Create test-results directory
    const resultsDir = path.join(process.cwd(), 'test-results', 'screenshots');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Determine which tests to run
    let testPattern = './tests/*.spec.js';
    if (options.responsive) {
      testPattern = './tests/responsive.spec.js';
    } else if (options.functionality) {
      testPattern = './tests/functionality.spec.js';
    }
    
    // Generate timestamp for this test run
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const reportFolder = `playwright-report-${timestamp}`;
    
    // Set environment variables
    process.env.SITE_NAME = siteName;
    process.env.SITE_OUTPUT_DIR = `test-results/${siteName}`;
    process.env.PLAYWRIGHT_REPORT_FOLDER = reportFolder;
    
    // Run Playwright tests
    const playwrightArgs = ['test', testPattern];
    
    // Add additional args
    if (options.headed) playwrightArgs.push('--headed');
    if (options.debug) playwrightArgs.push('--debug');
    if (options.project) playwrightArgs.push(`--project=${options.project}`);
    
    console.log(`Starting tests...`);
    console.log(`Command: npx playwright ${playwrightArgs.join(' ')}`);
    console.log('');
    
    return new Promise((resolve, reject) => {
      const playwright = spawn('npx', ['playwright', ...playwrightArgs], {
        stdio: 'inherit',
        env: { ...process.env, SITE_NAME: siteName }
      });
      
      playwright.on('close', (code) => {
        console.log('');
        if (code === 0) {
          console.log('✅ Tests completed successfully!');
        } else {
          console.log('❌ Some tests failed.');
        }
        console.log(`📊 View detailed report: open ${reportFolder}/index.html`);
        console.log(`📸 Screenshots and videos: ./test-results/${siteName}/`);
        resolve({ code, reportFolder, siteName });
      });
      
      playwright.on('error', (error) => {
        console.error('Error running tests:', error.message);
        reject(error);
      });
    });
  }

  static async updateBaselines(siteName) {
    console.log(`Updating visual baselines for: ${siteName}`);
    
    return new Promise((resolve, reject) => {
      const playwright = spawn('npx', ['playwright', 'test', '--update-snapshots', 'tests/responsive.spec.js'], {
        stdio: 'inherit',
        env: { ...process.env, SITE_NAME: siteName }
      });
      
      playwright.on('close', (code) => {
        console.log('');
        if (code === 0) {
          console.log('✅ Baselines updated successfully!');
        } else {
          console.log('❌ Baseline update failed.');
        }
        resolve(code);
      });
      
      playwright.on('error', (error) => {
        console.error('Error updating baselines:', error.message);
        reject(error);
      });
    });
  }
}

module.exports = TestRunner;