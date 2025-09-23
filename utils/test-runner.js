const { spawn } = require('child_process');
const SiteLoader = require('./site-loader');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { discoverFromSitemap } = require('./sitemap-loader');

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

    sites.forEach((site) => {
      try {
        const config = SiteLoader.loadSite(site);
        if (site.includes('-local')) {
          localSites.push({ name: site, config });
        } else if (site.includes('-live')) {
          liveSites.push({ name: site, config });
        } else {
          otherSites.push({ name: site, config });
        }
      } catch (_error) {
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
      localSites.forEach((site) => {
        console.log(`    ${site.name}: ${site.config.name} (${site.config.baseUrl})`);
      });
    }

    if (liveSites.length > 0) {
      console.log('\n  🌐 Live Production Sites:');
      liveSites.forEach((site) => {
        console.log(`    ${site.name}: ${site.config.name} (${site.config.baseUrl})`);
      });
    }

    if (otherSites.length > 0) {
      console.log('\n  📝 Other Sites:');
      otherSites.forEach((site) => {
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

      // Handle convenience flag for local DDEV sites
      if (options.local) {
        // Always enable DDEV when --local is passed
        process.env.ENABLE_DDEV = 'true';
        // If a project path is not supplied, try to infer it from SITE_NAME or baseUrl
        if (!process.env.DDEV_PROJECT_PATH) {
          const inferred = this.inferDdevProjectPath(siteName, siteConfig.baseUrl);
          if (inferred) {
            process.env.DDEV_PROJECT_PATH = inferred;
            console.log(`🛠  --local: Using inferred DDEV project path: ${inferred}`);
          } else {
            console.log(
              'ℹ️  --local provided but unable to infer DDEV project path. You can set DDEV_PROJECT_PATH explicitly.'
            );
          }
        } else {
          console.log(
            `🛠  --local: Using DDEV project path from env: ${process.env.DDEV_PROJECT_PATH}`
          );
        }
      }

      let createdDefaultDiscover = false;
      let discoverySkipped = false;

      if (options.discover && (!siteConfig.discover || !siteConfig.discover.strategy)) {
        if (!siteConfig.baseUrl) {
          console.log(
            '⚠️  --discover requested but site config has no baseUrl; skipping sitemap discovery.'
          );
          discoverySkipped = true;
        } else {
          const defaultSitemapUrl = `${siteConfig.baseUrl.replace(/\/$/, '')}/sitemap.xml`;
          siteConfig.discover = {
            strategy: 'sitemap',
            sitemapUrl: defaultSitemapUrl,
          };
          createdDefaultDiscover = true;
          console.log(
            `ℹ️  --discover: Default sitemap discovery enabled using ${defaultSitemapUrl}`
          );
        }
      }

      if (options.discover && !discoverySkipped) {
        if (siteConfig.discover && siteConfig.discover.strategy === 'sitemap') {
          try {
            const discovered = await discoverFromSitemap(siteConfig, siteConfig.discover);
            if (discovered.length === 0) {
              console.log('ℹ️  Sitemap discovery returned no pages. Test list unchanged.');

              if (createdDefaultDiscover) {
                try {
                  const sitePath = path.join(process.cwd(), 'sites', `${siteName}.json`);
                  const raw = fs.readFileSync(sitePath, 'utf8');
                  const parsed = JSON.parse(raw);
                  if (!parsed.discover) {
                    parsed.discover = { ...siteConfig.discover };
                    fs.writeFileSync(sitePath, `${JSON.stringify(parsed, null, 2)}\n`);
                    console.log(
                      `📄 Added default sitemap discovery config to sites/${siteName}.json.`
                    );
                  }
                } catch (writeError) {
                  console.log(
                    `⚠️  Unable to persist default sitemap config: ${writeError.message}`
                  );
                }
              }
            } else {
              const previous = Array.isArray(siteConfig.testPages) ? [...siteConfig.testPages] : [];
              const discoveredSet = new Set(discovered);
              const updated = [...discoveredSet].sort((a, b) => a.localeCompare(b));

              const added = updated.filter((pathItem) => !previous.includes(pathItem));
              const removed = previous.filter((pathItem) => !discoveredSet.has(pathItem));

              siteConfig.testPages = updated;

              if (added.length === 0 && removed.length === 0) {
                console.log(`ℹ️  Sitemap discovery found ${updated.length} page(s); no changes.`);
              } else {
                const parts = [];
                if (added.length > 0) parts.push(`${added.length} added`);
                if (removed.length > 0) parts.push(`${removed.length} removed`);
                console.log(`🔍 Sitemap discovery updated test pages (${parts.join(', ')}).`);
              }

              try {
                const sitePath = path.join(process.cwd(), 'sites', `${siteName}.json`);
                const raw = fs.readFileSync(sitePath, 'utf8');
                const parsed = JSON.parse(raw);
                parsed.testPages = updated;
                if (siteConfig.discover) {
                  const mergedDiscover = {
                    ...(parsed.discover || {}),
                    ...siteConfig.discover,
                  };
                  parsed.discover = mergedDiscover;
                }
                fs.writeFileSync(sitePath, `${JSON.stringify(parsed, null, 2)}\n`);
                console.log(
                  `📄 Updated sites/${siteName}.json with ${updated.length} test page(s).`
                );
              } catch (writeError) {
                console.log(`⚠️  Unable to persist sitemap results: ${writeError.message}`);
              }
            }
          } catch (error) {
            console.log(`⚠️  Sitemap discovery skipped: ${error.message}`);
          }
        } else if (!siteConfig.discover) {
          console.log('ℹ️  --discover requested but sitemap discovery is disabled for this site.');
        } else {
          console.log('ℹ️  --discover requested but site config has no sitemap strategy.');
        }
      } else if (siteConfig.discover && siteConfig.discover.strategy === 'sitemap') {
        console.log('ℹ️  Sitemap discovery disabled (run with --discover to refresh testPages).');
      }

      if (options.profile === 'smoke') {
        console.log('🚬 SMOKE profile: functionality-only, Chrome, homepage only');
      }
      console.log(`Running tests for: ${siteConfig.name}`);
      console.log(`Base URL: ${siteConfig.baseUrl}`);
      console.log(`Pages to test: ${siteConfig.testPages.join(', ')}`);
      console.log('');

      // Optional local preflight for ddev-based sites
      await this.preflightLocalSite(siteConfig);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      console.log('');
      this.displaySites();
      throw error;
    }

    // Clean previous Allure results for fresh run
    this.cleanAllureResults();

    // Create test-results directory
    const resultsDir = path.join(process.cwd(), 'test-results', 'screenshots');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Determine which tests to run (avoid relying on shell glob expansion)
    const testsDir = path.join(process.cwd(), 'tests');
    const testEntries = fs
      .readdirSync(testsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.js'))
      .map((entry) => path.join('tests', entry.name));

    const selectedTests = new Set();
    if (options.responsive) {
      for (const file of testEntries) {
        if (path.basename(file).startsWith('responsive.')) {
          selectedTests.add(file);
        }
      }
    }
    if (options.functionality) {
      for (const file of testEntries) {
        if (path.basename(file).startsWith('functionality.')) {
          selectedTests.add(file);
        }
      }
    }
    if (options.accessibility) {
      for (const file of testEntries) {
        const baseName = path.basename(file);
        if (/accessibility|a11y/i.test(baseName)) {
          selectedTests.add(file);
        }
      }
    }

    const testTargets = selectedTests.size > 0 ? Array.from(selectedTests) : ['tests'];

    // Set environment variables for test execution
    process.env.SITE_NAME = siteName;

    // Run Playwright tests
    const playwrightArgs = ['test', ...testTargets];

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
        env: {
          ...process.env,
          SITE_NAME: siteName,
          SMOKE: options.profile === 'smoke' ? '1' : process.env.SMOKE || '',
        },
      });

      playwright.on('close', (code) => {
        console.log('');

        TestRunner.pruneEmptyAllureVideos();

        const summary = TestRunner.summarizeAllureResults();
        console.log('Quick Summary:');
        console.log(`Tests broken: ${summary.broken}`);
        console.log(`Tests failed: ${summary.failed}`);
        console.log(`Tests passed: ${summary.passed}`);

        console.log('');
        if (code === 0) {
          console.log('✅ Tests completed successfully!');
        } else {
          console.log('❌ Test run completed with issues.');
        }
        console.log('📊 Generate Allure report: npm run allure-report');
        console.log('🧭 HTML report: ./playwright-report/index.html');
        console.log('📸 Test artifacts: ./test-results/');

        resolve({ code, siteName });
      });

      playwright.on('error', (error) => {
        console.error('Error running tests:', error.message);
        reject(error);
      });
    });
  }

  static summarizeAllureResults() {
    const summary = {
      broken: 0,
      failed: 0,
      passed: 0,
      skipped: 0,
      unknown: 0,
    };

    try {
      const resultsDir = path.join(process.cwd(), 'allure-results');
      if (!fs.existsSync(resultsDir)) {
        return summary;
      }

      const resultFiles = fs
        .readdirSync(resultsDir)
        .filter((file) => file.endsWith('-result.json'));

      for (const file of resultFiles) {
        try {
          const content = fs.readFileSync(path.join(resultsDir, file), 'utf8');
          const data = JSON.parse(content);
          switch ((data.status || '').toLowerCase()) {
            case 'passed':
              summary.passed += 1;
              break;
            case 'failed':
              summary.failed += 1;
              break;
            case 'broken':
              summary.broken += 1;
              break;
            case 'skipped':
              summary.skipped += 1;
              break;
            default:
              summary.unknown += 1;
              break;
          }
        } catch (error) {
          summary.unknown += 1;
          console.warn(`⚠️  Unable to parse Allure result ${file}: ${error.message}`);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Unable to collect Allure summary: ${error.message}`);
    }

    return summary;
  }

  static inferDdevProjectPath(siteName, baseUrl) {
    try {
      const home = process.env.HOME || '/home/warui';
      const sitesRoot = path.join(home, 'sites');

      // Helper to validate a candidate path
      const isValidProject = (dir) => {
        try {
          const configPath = path.join(dir, '.ddev', 'config.yaml');
          return fs.existsSync(dir) && fs.existsSync(configPath);
        } catch (_) {
          return false;
        }
      };

      const candidates = new Set();

      // Candidate 1: siteName minus common suffixes
      const baseFromSite = siteName.replace(/-(local|live)$/i, '');
      if (baseFromSite) candidates.add(path.join(sitesRoot, baseFromSite));

      // Candidate 2: from baseUrl hostname first label(s)
      try {
        const url = new URL(baseUrl);
        const host = url.hostname || '';
        // e.g., day.local -> day, roladev.atelierdev.local -> roladev
        const parts = host.split('.');
        if (parts.length > 0) {
          candidates.add(path.join(sitesRoot, parts[0]));
        }
        // Also try host without common local TLDs
        const stripped = host.replace(/\.(local|ddev\.site)$/i, '');
        if (stripped && stripped !== parts[0]) {
          candidates.add(path.join(sitesRoot, stripped));
        }
      } catch (_) {
        // ignore URL parse errors
      }

      for (const dir of candidates) {
        if (isValidProject(dir)) {
          return dir;
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  static requestReachable(urlString, timeoutMs = 5000) {
    return new Promise((resolve) => {
      try {
        const url = new URL(urlString);
        const lib = url.protocol === 'https:' ? https : http;
        const allowInsecure =
          /\.ddev\.site$/.test(url.hostname) ||
          url.hostname === 'localhost' ||
          url.hostname === '127.0.0.1';
        const requestOptions = {
          method: 'GET',
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname || '/',
          timeout: timeoutMs,
        };
        if (url.protocol === 'https:' && allowInsecure) {
          requestOptions.agent = new https.Agent({ rejectUnauthorized: false });
        }
        const req = lib.request(requestOptions, (res) => {
          resolve(res.statusCode && res.statusCode < 500);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
        req.end();
      } catch (_error) {
        resolve(false);
      }
    });
  }

  static async waitUntilReachable(url, { timeoutMs = 120000, intervalMs = 3000 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const ok = await this.requestReachable(url, Math.min(intervalMs, 5000));
      if (ok) return true;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
  }

  static async preflightLocalSite(siteConfig) {
    const baseUrl = siteConfig.baseUrl;
    const isLocal = /\.ddev\.site|localhost|127\.0\.0\.1/.test(baseUrl);
    if (!isLocal) return;

    const reachable = await this.requestReachable(baseUrl, 3000);
    if (reachable) return;

    const enableDdev = String(process.env.ENABLE_DDEV || '').toLowerCase() === 'true';
    const ddevPath = process.env.DDEV_PROJECT_PATH;

    if (!enableDdev || !ddevPath) {
      console.log(
        'ℹ️ Local site appears unreachable. Set ENABLE_DDEV=true and DDEV_PROJECT_PATH to auto-start ddev.'
      );
      return;
    }

    console.log(`🔧 Attempting to start ddev in ${ddevPath} ...`);
    try {
      await new Promise((resolve, reject) => {
        const child = spawn('ddev', ['start'], { cwd: ddevPath, stdio: 'inherit' });
        child.on('close', (code) =>
          code === 0 ? resolve() : reject(new Error(`ddev start exited with ${code}`))
        );
        child.on('error', reject);
      });
    } catch (err) {
      console.log(`⚠️  ddev start failed: ${err.message}`);
      return;
    }

    console.log('⏳ Waiting for local site to become reachable...');
    const ok = await this.waitUntilReachable(baseUrl, { timeoutMs: 120000, intervalMs: 5000 });
    if (ok) {
      console.log('✅ Local site is reachable. Proceeding with tests.');
    } else {
      console.log('⚠️  Local site did not become reachable in time. Tests may fail.');
    }
  }

  static cleanAllureResults() {
    try {
      const cwd = process.cwd();
      const results = path.join(cwd, 'allure-results');
      const report = path.join(cwd, 'allure-report');
      fs.rmSync(results, { recursive: true, force: true });
      fs.rmSync(report, { recursive: true, force: true });
      console.log('🧹 Cleaned previous test results for fresh run');
    } catch (_) {
      // Ignore if directories don't exist
    }
  }

  static pruneEmptyAllureVideos() {
    const allureDir = path.join(process.cwd(), 'allure-results');
    if (!fs.existsSync(allureDir)) return;

    const entries = fs.readdirSync(allureDir);
    const smallVideos = new Set();
    const VIDEO_MIN_BYTES = 2048;

    for (const name of entries) {
      if (!name.endsWith('.webm')) continue;
      const fullPath = path.join(allureDir, name);
      let stats;
      try {
        stats = fs.statSync(fullPath);
      } catch (_) {
        continue;
      }
      if (stats.size > VIDEO_MIN_BYTES) continue;

      try {
        fs.rmSync(fullPath);
        smallVideos.add(name);
      } catch (_) {
        // best-effort cleanup
      }
    }

    if (smallVideos.size === 0) return;

    const pruneNode = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node.attachments)) {
        node.attachments = node.attachments.filter(
          (attachment) => !smallVideos.has(attachment.source)
        );
      }
      if (Array.isArray(node.steps)) node.steps.forEach(pruneNode);
      if (Array.isArray(node.befores)) node.befores.forEach(pruneNode);
      if (Array.isArray(node.afters)) node.afters.forEach(pruneNode);
    };

    const jsonFiles = entries.filter((name) => name.endsWith('.json'));
    for (const jsonFile of jsonFiles) {
      const fullPath = path.join(allureDir, jsonFile);
      let data;
      try {
        data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      } catch (_) {
        continue;
      }

      pruneNode(data);

      try {
        fs.writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`);
      } catch (_) {
        // ignore
      }
    }

    console.log(
      `🧹 Removed ${smallVideos.size} empty video attachment(s) from allure results`
    );
  }

  // Removed unsafe process cleanup; no-op retained for compatibility
  static killOrphanedReportServers() {
    /* no-op */
  }

  static async updateBaselines(siteName) {
    console.log(`Updating visual baselines for: ${siteName}`);

    return new Promise((resolve, reject) => {
      const playwright = spawn(
        'npx',
        ['playwright', 'test', 'tests/responsive.visual.spec.js', '--update-snapshots', 'all'],
        {
          stdio: 'inherit',
          env: { ...process.env, SITE_NAME: siteName },
        }
      );

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
