# WordPress Testing Suite

Automated testing suite for WordPress websites with responsive design, functionality testing, and visual regression detection.

## Quick Start

1. **Setup**
   ```bash
   cd website-testing
   npm run setup
   ```

2. **Configure your site**
   - Copy `sites/example-site.json` to `sites/your-site-name.json`
   - Update the configuration with your WordPress site details

3. **Run tests**
   ```bash
   node run-tests.js --site=your-site-name
   ```

4. **Run smoke test (Chrome + responsive only)**
   ```bash
   # Against local ddev site (make sure ddev is running)
   npm run smoke:nfs -- --site=nfsmediation-local
   # Or directly
   node run-tests.js --site=nfsmediation-local --responsive --project=Chrome
   ```

## Site Configuration

Create a JSON file in the `sites/` directory for each WordPress site you want to test:

```json
{
  "name": "My WordPress Site",
  "baseUrl": "https://mywordpresssite.com",
  "testPages": ["/", "/about", "/contact"],
  "visualThresholds": { "ui_elements": 0.1, "content": 0.25, "dynamic": 0.5 },
  "dynamicMasks": [".breaking-news", ".ticker"],
  "visualOverrides": [
    { "match": "/", "threshold": 0.35, "masks": [".dynamic-widget"] },
    { "pattern": "^/blog", "threshold": 0.4 }
  ],
  "forms": [
    {
      "name": "Contact Form",
      "page": "/contact",
      "selector": "#contact-form",
      "fields": {
        "name": "input[name='your-name']",
        "email": "input[name='your-email']",
        "message": "textarea[name='your-message']"
      },
      "submitButton": "input[type='submit']"
    }
  ],
  "criticalElements": [
    {"name": "Navigation", "selector": ".main-navigation"},
    {"name": "Header", "selector": "header"},
    {"name": "Footer", "selector": "footer"}
  ],
  "a11yFailOn": ["critical", "serious"],
  "a11yIgnoreRules": ["color-contrast"],
  "a11yMode": "gate",
  "ignoreConsoleErrors": ["vendor-script", "MarketingPixel"],
  "resourceErrorBudget": 0
}
```

`testPages` should list the exact paths you expect to remain available. The functionality and accessibility suites will fail as soon as they encounter a 4xx/5xx response, so keep this array in sync with the live site (or enable sitemap discovery as described below).

## Optional Page Discovery

You can ask the runner to supplement `testPages` by parsing a sitemap:

```json
{
  "name": "My WordPress Site",
  "baseUrl": "https://mywordpresssite.com",
  "testPages": ["/", "/about", "/contact"],
  "discover": {
    "strategy": "sitemap",
    "sitemapUrl": "https://mywordpresssite.com/sitemap_index.xml",
    "maxPages": 25,
    "include": ["^/services"],
    "exclude": ["^/tag/"]
  }
}
```

When `strategy` is `sitemap`, the runner fetches the sitemap (default `baseUrl/sitemap.xml`), walks child sitemaps up to two levels, normalises URLs to paths, filters them with the optional `include`/`exclude` patterns, and merges up to `maxPages` new entries into `testPages` (without removing the curated list).

## Commands

```bash
# List available sites
node run-tests.js --list

# Test specific site
node run-tests.js --site=my-site

# Using npm script (pass args after --)
npm run test:site -- --site=my-site

# Smoke test helper (nfs ddev)
npm run smoke:nfs

# Update visual baselines for a site (responsive visuals only)
npm run update-baselines -- --site=my-site

### Profiles
- `--profile=smoke` → responsive-only, Chrome-only, single page (fast).
- `--profile=full` → default behavior (all enabled specs, all configured projects).
- `--profile=nightly` → same as full; reserve for longer, scheduled runs.

## Smoke Site Config
- A minimal CI-friendly config is provided at `sites/nfsmediation-smoke.json` (points to `https://nfs.atelierdev.uk`, homepage only).
- For CI, set the repository Actions variable `SMOKE_SITE=nfsmediation-live` or `nfsmediation-smoke`.

# Run only responsive tests (all responsive specs)
node run-tests.js --site=my-site --responsive

# Run only functionality tests (all functionality specs)
node run-tests.js --site=my-site --functionality

# Run with browser visible (debugging)
node run-tests.js --site=my-site --headed

# Test specific browser
node run-tests.js --site=my-site --project="Chrome"
node run-tests.js --site=my-site --project="Firefox"
node run-tests.js --site=my-site --project="Safari"  # WebKit engine
```

## What Gets Tested

### Responsive Testing (Industry-Standard Approach)
- ✅ **Multi-Viewport Testing**: Each desktop browser tests mobile (375x667), tablet (768x1024), and desktop (1920x1080) viewports
- ✅ **Cross-Browser Coverage**: Chrome, Firefox, and Safari (macOS) for comprehensive engine testing
- ✅ Critical elements are visible across devices
- ✅ Mobile menu functionality
- ✅ **Visual Regression Detection** - Automatic screenshot comparison
- ✅ **Layout Change Alerts** - Pixel-level difference detection

### Browser Strategy
- **Desktop Browsers Only**: Uses Chrome, Firefox, Safari to simulate all viewport sizes
- **Why This Works**: Matches real-world responsive development and testing workflows
- **Real Mobile Testing**: For actual device testing, use cloud services (not covered by this suite)

### Functionality Testing
- ✅ No broken internal links
- ✅ JavaScript errors detection
- ✅ Form validation and submission
- ✅ Page load times
- ✅ HTTP status codes

## Test Results

- **HTML Report**: Each test run creates a site-specific report (e.g., `playwright-report-nfsmediation-local/index.html`)
- **Visual Diff Reports**: Side-by-side comparison of layout changes with pixel-level detection
- **Test Artifacts**: Screenshots, videos, and traces stored in `test-results/[site-name]/`
- **Console Output**: Shows exact report path to open after each run

### Viewing Reports
After tests complete, open the Playwright HTML report:
```bash
open playwright-report/index.html
📸 Screenshots and videos: ./test-results/
```

Allure (optional)
- Allure requires a Java runtime. If Java is installed:
  - Generate and open: `npm run allure-report`
  - Live server: `npm run allure-serve`
- If Java is not installed, use Playwright HTML report (`playwright-report/index.html`) or `npx playwright show-report`.

## CI & Scheduling
- CI smoke tests no longer run automatically on PRs, pushes, or on a schedule.
- Trigger the workflow manually from GitHub Actions (Run workflow) and optionally set `site` input.
- You can also set repository Actions variable `SMOKE_SITE` (e.g., `nfsmediation-live`) to be used when running manually.
- You can also trigger manually via the "Run workflow" button and provide a site input.

### Deterministic Smoke (optional)
- A static fixture and local server exist for fully deterministic smoke runs:
  - Server: `node scripts/static-server.js` (serves `fixtures/static-site/` on `http://127.0.0.1:8080`).
  - Config: `sites/static-smoke.json`.
  - CI will auto-start this server when `SMOKE_SITE=static-smoke` or manual input `site=static-smoke`.

## Local ddev Preflight (Optional)
- If your site uses ddev and is unreachable, the runner can attempt to start it when:
  - `ENABLE_DDEV=true` and `DDEV_PROJECT_PATH=/path/to/your/wp/project` are set in the environment.
  - The site `baseUrl` contains `.ddev.site`.
- The runner will try `ddev start` and wait up to 2 minutes for the site to respond.

### Managing Reports
```bash
# Clean backup HTML report folder
npm run clean-backup-html

# Clean old test artifacts (older than 15 days) 
npm run clean-old-results

# Clean all test artifacts
npm run clean-all-results
```

**Note**: HTML report is located at `playwright-report/index.html`. Test artifacts (videos/screenshots) are stored in `test-results/`.

## Browser Coverage

Tests run on:
- Desktop Chrome & Firefox
- Safari (WebKit engine)
- Mobile and tablet viewports via device profiles

## Troubleshooting

**"Site configuration not found"**: Ensure your `.json` file exists in `sites/` directory

**Tests hang**: Check your WordPress site is accessible and URLs are correct

**Form tests fail**: Update form selectors in your site configuration to match your WordPress theme

**JavaScript errors**: Review console output for specific error details

**Visual regression failures**: Run `npx playwright test --update-snapshots` to update baselines after intentional design changes

## Accessibility Configuration

- `a11yFailOn`: array of axe impact levels to gate on. Default: `["critical","serious"]`.
- `a11yIgnoreRules`: array of axe rule IDs to ignore when evaluating failures (e.g., `"color-contrast"`).
- `a11yMode`: how accessibility specs behave. `"gate"` (default) aggregates violations across all pages/viewports and fails once at the end; `"audit"` logs the summary without failing so you can review issues without blocking the pipeline.
- `ignoreConsoleErrors`: array of substrings or regex patterns (string form) to suppress known console noise during interactive scans.
- `resourceErrorBudget`: maximum number of failed network requests (request failures or 4xx/5xx responses) tolerated before the interactive spec soft-fails. Default: `0`.

These fields are optional. When present, they control how the a11y tests in `tests/functionality.accessibility.spec.js` and `tests/responsive.a11y.spec.js` decide which violations trigger failures. The tests also attach a per-page summary as an Allure text attachment when violations are present. Functionality/accessibility suites default to the Playwright project you pass (we typically run Chrome). Omit `--project` if you want Playwright to execute the same checks across every configured browser/device profile.
