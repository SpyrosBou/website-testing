# WordPress Testing Suite

Automated testing suite for WordPress websites with responsive design, functionality testing, and visual regression detection.

## What This Project Does (Beginner Friendly)

Think of this suite as an automated QA teammate for WordPress sites. You give it a small JSON config in `sites/` that lists the URLs you care about, and it drives real browsers (via Playwright) to make sure those pages still look and behave correctly.

On every run (`node run-tests.js --site=your-site`):

- The suite loads the config, opens each page, and checks the layout on mobile, tablet, and desktop sizes.
- It makes sure critical pieces like headers, menus, and footers are visible, and it compares screenshots to catch visual regressions.
- It looks for broken links, slow or failing responses, JavaScript errors, and accessibility issues using axe-core plus targeted keyboard/resilience/form/structure audits that call out the relevant WCAG success criteria.
- It saves an Allure report under `allure-report/` (Java required) which is the primary way to review structured, readable results. A lightweight Playwright HTML report is also written to `playwright-report/` as a backup.

To try it locally: run `npm run setup`, copy `sites/example-site.json` to your own file, update the URLs, then execute `node run-tests.js --site=<your-site>`. The HTML report will show you exactly what passed and what needs attention before users notice.

## Quick Start

0. **Prereqs (Allure required)**
   - Node.js 18+ and npm
   - Java Runtime (required for Allure):
     - macOS: `brew install openjdk`
       - If needed, add Java to PATH (Apple Silicon): `export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"`
       - If needed, add Java to PATH (Intel): `export PATH="/usr/local/opt/openjdk/bin:$PATH"`
     - Linux (Debian/Ubuntu): `sudo apt-get update && sudo apt-get install -y default-jre`

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

4. **Run smoke test (functionality only, Chrome, homepage)**

   ```bash
   # Built-in smoke profile samples the first test page per responsive spec
   node run-tests.js --site=nfsmediation-local --profile=smoke

   # Convenience script for ddev setups (responsive across all pages)
   npm run smoke:nfs -- --site=nfsmediation-local
   # Or directly
   node run-tests.js --site=nfsmediation-local --profile=smoke
   ```

5. **Generate Allure report (required)**
   ```bash
   npm run allure-report
   ```
   This generates `allure-report/` and opens it. If the command errors with a Java message, ensure Java is installed and available on your PATH (see step 0).

## Quick Setup (macOS)

Use this streamlined flow on a Mac to verify everything works end-to-end:

```bash
# 1) Install Java for Allure (required)
brew install openjdk

# If your shell can’t find `java`, add it to PATH for this session:
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"  # Apple Silicon
# or
export PATH="/usr/local/opt/openjdk/bin:$PATH"     # Intel

# 2) Install deps and Playwright browsers
npm run setup

# 3) Run a quick smoke (functionality only, Chrome, homepage)
node run-tests.js --site=nfsmediation-live --profile=smoke

# 4) Generate and open the Allure report (primary report)
npm run allure-report
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
    { "name": "Navigation", "selector": ".main-navigation" },
    { "name": "Header", "selector": "header" },
    { "name": "Footer", "selector": "footer" }
  ],
  "linkCheck": {
    "maxPerPage": 20,
    "timeoutMs": 5000,
    "followRedirects": true,
    "methodFallback": true
  },
  "a11yFailOn": ["critical", "serious"],
  "a11yIgnoreRules": ["color-contrast"],
  "a11yMode": "gate",
  "ignoreConsoleErrors": ["vendor-script", "MarketingPixel"],
  "resourceErrorBudget": 0,
  "performanceBudgets": {
    "domContentLoaded": 2500,
    "loadComplete": 4000,
    "firstContentfulPaint": 2000
  }
}
```

`linkCheck` lets you tune how aggressively the internal link audit runs. Defaults are `maxPerPage: 20`, `timeoutMs: 5000`, `followRedirects: true`, and `methodFallback: true` (retry with GET when servers reject HEAD). `performanceBudgets` soft-fail the run when `domContentLoaded`, `loadComplete`, or `firstContentfulPaint` timings exceed the provided millisecond thresholds. If omitted, the suite uses the conservative defaults baked into the specs (`linkCheck`) and skips the performance gating entirely.

`testPages` should list the exact paths you expect to remain available. Always include `'/'` so the homepage is scanned—the runner will warn and inject it if omitted, but keeping it explicit avoids churn in repo diffs. The functionality and accessibility suites will fail as soon as they encounter a 4xx/5xx response, so keep this array in sync with the live site (or enable sitemap discovery as described below).

## Optional Page Discovery

Add a `discover` block to your site config and run with `--discover` when you want to refresh `testPages` from a sitemap. Without the flag the runner keeps your existing list (and prints a reminder), so discovery is always an explicit action.

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

Run discovery like this:

```bash
node run-tests.js --site=my-site --discover
```

When `strategy` is `sitemap`, the runner fetches the sitemap (default `baseUrl/sitemap.xml`), walks child sitemaps up to two levels, normalises URLs to paths, filters them with the optional `include`/`exclude` patterns, and writes the merged list back to your site JSON (sorted, unique) so subsequent runs stay in sync.

## Experimental YAML Specs

An experimental generator lives under `specs/`. These YAML definitions map to the same functionality/responsive categories and can be converted into `.spec.js` files with the scripts in `specs/utils/`, but they are not wired into `run-tests.js`. Treat them as prototypes—hand-authored Playwright specs in `tests/` remain canonical.

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

# Refresh sitemap-backed page list before running tests
node run-tests.js --site=my-site --discover

# Run accessibility scans with WCAG-only tagging (impact gate unchanged)
node run-tests.js --site=my-site --accessibility --a11y-tags=wcag

# Expand accessibility sampling to all configured pages (affects responsive + new resilience specs)
node run-tests.js --site=my-site --accessibility --a11y-sample=all

# Increase keyboard traversal depth for the TAB walkthrough (default 20 steps)
A11Y_KEYBOARD_STEPS=40 node run-tests.js --site=my-site --accessibility

# Update visual baselines for a site (visual regression only)
npm run update-baselines -- --site=my-site

# Refresh test pages from sitemap (no tests run)
npm run discover_pages -- --site=my-site

### Profiles
- `--profile=smoke` → functionality-only, Chrome-only, homepage only (fast).
- `--profile=full` → default behavior (same as `--full`, all spec groups, all configured projects).
- `--profile=nightly` → runs visual + responsive + functionality + accessibility suites, forces `--a11y-sample=all`, and bumps the keyboard audit depth (`A11Y_KEYBOARD_STEPS=40`). Override those env vars if you need a different breadth for a given run.

## Smoke Site Config
- A minimal CI-friendly config is provided at `sites/nfsmediation-smoke.json` (points to `https://nfs.atelierdev.uk`, homepage only).
- For CI, set the repository Actions variable `SMOKE_SITE=nfsmediation-live` or `nfsmediation-smoke`.

# Run only visual regression tests (defaults to Chrome desktop)
node run-tests.js --site=my-site --visual

# Expand coverage (examples)
node run-tests.js --site=my-site --visual --project=all --viewport=all
node run-tests.js --site=my-site --visual --project=Chrome,Firefox --viewport=desktop,tablet

# Run only responsive structure tests
node run-tests.js --site=my-site --responsive

# Run only functionality tests
node run-tests.js --site=my-site --functionality

# Run full suite explicitly
node run-tests.js --site=my-site --full

# Run with browser visible (debugging)
node run-tests.js --site=my-site --headed

# Test specific browser (defaults to Chrome when omitted)
node run-tests.js --site=my-site --project="Chrome"
node run-tests.js --site=my-site --project="Firefox"
node run-tests.js --site=my-site --project="Safari"  # WebKit engine
node run-tests.js --site=my-site --project=all         # Run every configured Playwright project

# Start local ddev automatically (if applicable)
# Use --local to enable ddev preflight and infer DDEV_PROJECT_PATH under /home/warui/sites
node run-tests.js --site=my-site-local --visual --local
```

## What Gets Tested

### Responsive Testing (Industry-Standard Approach)

- 🔧 **Default footprint**: Chrome desktop only for fast feedback
- 🔁 **Opt-in breadth**: Use `--project=all` or comma-separated lists, and `--viewport=all` to add browsers/devices
- ✅ **Multi-Viewport Testing** (when enabled): mobile (375×667), tablet (768×1024), and desktop (1920×1080)
- ✅ **Cross-Browser Coverage** (when enabled): Chrome, Firefox, and Safari/WebKit
- ✅ Critical elements are visible across devices
- ✅ Mobile menu functionality
- ✅ **Visual Regression Detection** - Automatic screenshot comparison
- ✅ **Layout Change Alerts** - Pixel-level difference detection

### Browser Strategy

- **Desktop Browsers Only**: Uses Chrome, Firefox, Safari to simulate all viewport sizes
- **Why This Works**: Matches real-world responsive development and testing workflows
- **Real Mobile Testing**: For actual device testing, use cloud services (not covered by this suite)

### Functionality Testing

- ✅ No broken internal links (per-page sampling honours `linkCheck` config, retries with GET when HEAD is unsupported, and publishes an Allure table of checked/broken URLs)
- ✅ JavaScript & resource error smoke: light focus/hover on buttons/links/inputs with console logging, failed-request tracking, per-site ignore/budget controls, and an Allure summary per page
- ✅ Form validation and submission (for forms listed in site config)
- ✅ Page load times (per-page DOM timing with optional `performanceBudgets` soft gates; Allure tables highlight any budget breaches)
- ✅ HTTP status codes & content-type assertions

The interactive audit still walks every entry in `testPages`, but it only performs lightweight focus/hover taps while watching for console errors and failed network requests. That keeps the shared harness stable across very different client sites. When you need multi-step user journeys, flows behind logins, or bespoke form handling, layer client-specific Playwright specs on top of the shared suite.

All other shared suites (infrastructure, links, accessibility, responsive structure/visual) execute their full assertions across every `testPages` URL without these limitations. Each spec drops an HTML + Markdown attachment into Allure via helpers in `utils/allure-utils.js`, so passing tests now explain exactly what was validated instead of surfacing a bare green tick.

### Accessibility Deep-Dive

- ✅ **Responsive Axe scans** honour impact-based gating and now surface three buckets: gating, WCAG advisories, and best-practice advisories.
- ✅ **Keyboard-only navigation audit** exercises the first ten focus stops per page, verifies focus never lands on hidden elements, and records skip-link coverage (mapped to WCAG 2.1.1, 2.1.2, 2.4.1, 2.4.3, 2.4.7).
- ✅ **Reduced-motion coverage** forces `prefers-reduced-motion: reduce` and flags long-running or infinite animations that remain active (WCAG 2.2.2, 2.3.3).
- ✅ **Reflow/zoom resilience** renders pages at a 320 px viewport and reports horizontal overflow sources that break responsive layouts (WCAG 1.4.4, 1.4.10).
- ✅ **Iframe inventory** captures accessible metadata for embeddings, flagging unlabeled or cross-origin frames that require manual follow-up (WCAG 1.3.1, 4.1.2).
- Focus-indicator detection now compares before/after screenshots (via `pixelmatch`) so the suite only warns when the visual state truly fails to change.
- ✅ **Forms accessibility audit** validates configured forms for accessible labels and meaningful validation feedback on error (WCAG 1.3.1, 3.3.1, 3.3.2, 3.3.3, 4.1.2).
- ✅ **Structural landmark checks** confirm each page exposes a single H1, a `main` landmark, and a sensible heading outline (WCAG 1.3.1, 2.4.1, 2.4.6, 2.4.10).

Each Allure summary now includes a “WCAG coverage” banner for these manual audits so reviewers can see at a glance which success criteria the findings relate to.

## Test Results

- **HTML Report**: Each run refreshes `playwright-report/index.html` (single folder, cleared by global setup)
- **Visual Diff Reports**: Side-by-side comparison of layout changes with pixel-level detection
- **Test Artifacts**: Screenshots, videos, and traces stored in `test-results/` (cleared by global setup unless `PW_SKIP_RESULT_CLEAN=true`)
- **Console Output**: Shows exact report path to open after each run

### Viewing Reports

Allure (required)

- This project is designed around Allure for readable, structured results. Install Java and use:
  - Generate and open: `npm run allure-report`
  - Live server: `npm run allure-serve`
- Specs attach structured HTML + Markdown summaries so the Allure Overview spells out which checks passed, which pages were scanned, and any warnings logged.
- Manual audits (keyboard, reduced motion, reflow, forms, structure) annotate those summaries with WCAG badges so you know exactly which success criteria were examined.
- When you add a new suite, build its run-level summary with `attachSummary({ ..., setDescription: true })` so the styled HTML card appears directly in the Allure Overview. Keeping that pattern consistent makes triage faster and avoids unstyled blobs in the report body.
- Treat WCAG findings surfaced by the suites as defects to address. We do **not** suppress or whitelist contrast (or any other WCAG-level) violations in the harness; our automated results must stay faithful to a real audit even when product/design decides to accept the risk.

Playwright HTML report (backup)

- A backup HTML report is saved to `playwright-report/index.html`. It’s useful for quick inspection, but lacks the structured summaries provided by Allure.

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
  - Use `--local` to automatically set `ENABLE_DDEV=true` and infer `DDEV_PROJECT_PATH` from `/home/warui/sites/<project>` when possible.
  - Or set `ENABLE_DDEV=true` and `DDEV_PROJECT_PATH=/path/to/your/wp/project` in the environment manually.
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

- `a11yFailOn`: array of axe impact levels to gate on. Default: `["critical","serious"]`. Only violations at these severities fail the build; everything else is treated as a non-gating advisory.
- `a11yIgnoreRules`: array of axe rule IDs to ignore when evaluating failures (e.g., `"color-contrast"`).
- `a11yMode`: how accessibility specs behave. `"gate"` (default) aggregates violations across all pages/viewports and fails once at the end; `"audit"` logs the summary without failing so you can review issues without blocking the pipeline.
- `a11yResponsiveSampleSize`: number of pages (per viewport) for the responsive a11y sweep. Accepts a positive integer or `'all'`. Default: `3`. Override on the CLI with `--a11y-sample=<n|all>` when you need temporary breadth without editing configs.
- `a11yKeyboardSampleSize` / `a11yMotionSampleSize` / `a11yReflowSampleSize` / `a11yIframeSampleSize`: optional overrides for the new keyboard, reduced-motion, reflow, and iframe audits. Each falls back to `a11yResponsiveSampleSize` (or the CLI `--a11y-sample` override) when omitted.
- `a11yStructureSampleSize`: optional override for the structural landmark audit (defaults to `a11yResponsiveSampleSize`).
- `A11Y_KEYBOARD_STEPS` (env): override the maximum number of forward TAB steps the keyboard audit performs (default: `20`). The spec always performs a reverse TAB sanity check after the forward traversal.
- `ignoreConsoleErrors`: array of substrings or regex patterns (string form) to suppress known console noise during interactive scans.
- `resourceErrorBudget`: maximum number of failed network requests (request failures or 4xx/5xx responses) tolerated before the interactive spec soft-fails. Default: `0`.

These fields are optional. When present, they control how the a11y tests in `tests/functionality.accessibility.spec.js` and `tests/responsive.a11y.spec.js` decide which violations trigger failures. Both suites now generate structured Allure summaries that:

- Inline the HTML report into the test description (no download required).
- Split the findings into **gating** (impact ∈ `a11yFailOn`), **non-gating WCAG advisories**, and **best-practice advisories** (rules without WCAG tags) so you can see the full axe signal without conflating compliance with severity.
- Display WCAG version/level badges alongside the traditional axe impact, so project managers can answer “which WCAG criteria failed?” while engineering stays focused on user-harm severity.

Non-gating findings still appear in the report even though they do not fail CI. If you need stricter gating (e.g., include `moderate`), just extend `a11yFailOn` in your site config. Functionality/accessibility suites default to the Playwright project you pass (we typically run Chrome). Omit `--project` if you want Playwright to execute the same checks across every configured browser/device profile.

Need a compliance-only view? Run with `--a11y-tags=wcag` to scope the axe pass to WCAG-tagged rules (gating still follows `a11yFailOn`).

For additional context on why we continue to gate on severity instead of raw WCAG tags, see [`why_not_wcag_gating.md`](./why_not_wcag_gating.md).
