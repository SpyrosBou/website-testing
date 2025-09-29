# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Build and Test Commands
```bash
# Initial setup (install dependencies and Playwright browsers)
npm run setup

# Run tests for specific site
node run-tests.js --site=SITENAME              # All tests (same as --full)
node run-tests.js --site=SITENAME --full            # Explicit full suite run
node run-tests.js --site=SITENAME --visual           # Visual regression only (Chrome desktop by default)
node run-tests.js --site=SITENAME --visual --project=all --viewport=all    # Expand browsers/viewports
node run-tests.js --site=SITENAME --responsive       # Responsive structure tests only
node run-tests.js --site=SITENAME --functionality    # Functionality tests only (includes functionality.accessibility.spec.js)
node run-tests.js --site=SITENAME --accessibility    # All accessibility tests (responsive.a11y + functionality.accessibility + a11y.*)

# List available sites
node run-tests.js --list

# Refresh sitemap-backed testPages and persist the result (no tests executed)
npm run discover_pages -- --site=SITENAME

# Run single test file directly with Playwright
SITE_NAME=SITENAME npx playwright test tests/functionality.infrastructure.spec.js

# Smoke test profile (fast, Chrome-only, functionality-only, homepage-only)
node run-tests.js --site=SITENAME --profile=smoke

# Update visual regression baselines after intentional changes
npx playwright test tests/visual.visualregression.spec.js --update-snapshots
```

### Reporting Commands
```bash
# Open the latest HTML report
npm run viewreport

# List available report runs
npm run viewreport -- --list

# Open specific report run
npm run viewreport -- --file=run-YYYYMMDD-HHMMSS

# Prune report history (keeps 10 most recent)
npm run clean-reports

# Clean old test artifacts (>15 days)
npm run clean-old-results
```

### Linting and Formatting
```bash
npm run lint        # Check code style
npm run lint:fix    # Auto-fix lint issues
npm run format      # Format code with Prettier
```

## Architecture Overview

### Test Organization Strategy
The test suite is split into modular spec files for better maintainability and parallel execution:

**Visual Tests**:
- `visual.visualregression.spec.js` - Visual regression with masked dynamic content (defaults to desktop; extend via `--viewport` or `VISUAL_VIEWPORTS`)

**Responsive Tests**:
- `responsive.structure.spec.js` - Layout and critical elements across viewports (mobile/tablet/desktop)
- `responsive.a11y.spec.js` - WCAG 2.1 AA accessibility compliance across viewports (triggered by `--accessibility` flag, NOT `--responsive`)

**Functionality Tests** (Core behavior):
- `functionality.infrastructure.spec.js` - Page availability, HTTP responses, performance budgets
- `functionality.links.spec.js` - Internal link validation with sampling
- `functionality.interactive.spec.js` - Lightweight focus/hover audit that logs console and network issues
- `functionality.wordpress.spec.js` - WordPress-specific plugin and theme detection
- `functionality.accessibility.spec.js` - Comprehensive axe-core WCAG scanning (triggered by BOTH `--functionality` and `--accessibility` flags)

**Accessibility Deep-Dive Tests** (all triggered by `--accessibility` flag):
- `a11y.forms.spec.js` - Form accessibility validation for configured forms
- `a11y.keyboard.spec.js` - Keyboard navigation audit with focus indicator detection
- `a11y.resilience.spec.js` - Reduced-motion, reflow/zoom, and iframe accessibility checks
- `a11y.structure.spec.js` - Structural landmark validation (H1, main, heading outline)

**How Test Filtering Works:**
- `--visual` → Runs ONLY `visual.visualregression.spec.js`
- `--responsive` → Runs ONLY `responsive.structure.spec.js` (NOT responsive.a11y.spec.js)
- `--functionality` → Runs ALL `functionality.*.spec.js` files (5 files including functionality.accessibility.spec.js)
- `--accessibility` → Runs ALL files matching pattern `/accessibility|a11y/i` (7 files: responsive.a11y + functionality.accessibility + all 4 a11y.* specs)
- `--full` or no flags → Runs ALL test specs (12 files total)

Shared suites (infrastructure, links, functionality.accessibility, responsive.structure, visual) assert against every `testPages` entry. The interactive audit stays intentionally lightweight so it remains stable across clients; create site-specific specs when you need deep user journeys or authenticated flows.

### Site Configuration System
Each WordPress site requires a JSON configuration in `sites/` directory:
- Naming convention: `sitename-local.json` (local dev) and `sitename-live.json` (production)
- Configuration drives all test behavior and site-specific selectors
- The `SITE_NAME` environment variable is set automatically by the test runner
- Optional knobs: `linkCheck` (per-page link sampling controls), `ignoreConsoleErrors`/`resourceErrorBudget` (interactive audit filters), and `performanceBudgets` (soft gates for DOM timings)
- Functionality specs read these settings and surface structured summaries via `utils/reporting-utils.js` (HTTP response tables, link coverage, interactive console/resource breakdowns, etc.) in the custom HTML report.

### Test Runner Architecture
The `run-tests.js` script orchestrates test execution:
1. Loads and validates the requested site configuration from `sites/`.
2. When `--discover` is supplied and the config uses `discover.strategy: "sitemap"`, fetches the sitemap, merges paths, and writes the updated `testPages` back to the JSON file.
3. Categorizes test files based on filename patterns and selected flags (`--visual`, `--responsive`, `--functionality`, `--accessibility`).
4. Sets `SITE_NAME` (and `SMOKE=1` for the smoke profile) before spawning Playwright with the requested spec filters/projects.
5. Relies on `scripts/playwright-global-setup.js` to clear `playwright-report/` and `test-results/` unless `PW_SKIP_RESULT_CLEAN=true`.

### Key Utilities
- `utils/test-runner.js` - Main test orchestration and site management
- `utils/site-loader.js` - Configuration loading and validation
- `utils/sitemap-loader.js` - Sitemap discovery helper for `--discover`
- `utils/test-helpers.js` - Advanced error handling, retry mechanisms, browser lifecycle
- `utils/wordpress-page-objects.js` - WordPress-specific page object patterns
- `utils/test-data-factory.js` - Test data generation for forms
- `utils/custom-html-reporter.js` - Custom HTML report generator with inline screenshots and structured summaries
- `utils/reporting-utils.js` - Report attachment helpers for consistent HTML/Markdown output
- `utils/report-templates.js` - HTML templates for the custom report
- `utils/responsive-helpers.js` - Viewport definitions and WordPress selector patterns
- `utils/a11y-runner.js`, `utils/a11y-shared.js`, `utils/a11y-utils.js` - Accessibility testing utilities

### Report Organization
- `reports/` - Custom HTML report history (each run gets `run-<timestamp>/report.html` plus `data/` JSON).
- `playwright-report/` - Playwright's fallback HTML report for the latest run (cleared by global setup).
- `test-results/` - Screenshots, videos, traces scoped by test + project (cleared unless `PW_SKIP_RESULT_CLEAN=true`).
- `tests/baseline-snapshots/` - Version-controlled visual baselines.

## WordPress-Specific Considerations

### Local Development Testing
- Local by Flywheel sites use self-signed certificates (`ignoreHTTPSErrors: true`)
- URLs typically end with `.local` domain
- May require longer timeouts due to local environment performance

### DDEV Integration
- The runner can auto-start DDEV projects when sites use `.ddev.site` domains
- Use `--local` flag to enable DDEV preflight (sets `ENABLE_DDEV=true` and infers `DDEV_PROJECT_PATH` from `/home/warui/sites/<project>`)
- Or manually set `ENABLE_DDEV=true` and `DDEV_PROJECT_PATH=/path/to/your/wp/project`
- Runner attempts `ddev start` and waits up to 2 minutes for site response

### Theme and Plugin Compatibility
- Test selectors should account for theme variations
- Use multiple fallback selectors for critical elements
- WordPress plugins may inject JavaScript that affects testing
- Contact Form 7, Gravity Forms need specific selector patterns

### Dynamic Content Handling
- Visual regression tests mask dynamic elements (timestamps, carousels)
- WordPress lazy loading affects image and content visibility
- AJAX-loaded content requires appropriate wait strategies
- Admin bar and logged-in states should be avoided in tests

## Testing Profiles
- `--profile=smoke` - Fast feedback: functionality-only, Chrome only, homepage only (sets `SMOKE=1` which makes responsive specs sample 1 page)
- `--profile=full` - Comprehensive: all tests, all browsers (default behavior)
- `--profile=nightly` - Extended testing: runs visual + responsive + functionality + accessibility, forces `--a11y-sample=all`, bumps keyboard audit depth to 40 steps (sets `NIGHTLY=1`)

## Critical Implementation Details

### Environment Variables
The test runner automatically sets:
- `SITE_NAME` - Required by all test files to load configuration
- `SMOKE` - Set to `1` when `--profile=smoke` so responsive specs sample a single page instead of all testPages
- `NIGHTLY` - Set to `1` when `--profile=nightly`

Helpers also recognise:
- `PW_SKIP_RESULT_CLEAN` - Skip automatic artifact cleanup in global setup when `true`
- `ENABLE_DDEV` and `DDEV_PROJECT_PATH` - Allow `test-runner` to start a ddev project if a `.ddev.site` base URL is unreachable
- `RESPONSIVE_VIEWPORTS` - Override viewports for responsive.structure tests (e.g., `desktop`, `mobile,tablet,desktop`, or `all`)
- `VISUAL_VIEWPORTS` - Override viewports for visual regression (e.g., `desktop`, `mobile,tablet,desktop`, or `all`)
- `A11Y_TAGS_MODE` - Scope axe scans to `wcag` rules only or `all` rules (default: `all`)
- `A11Y_SAMPLE` - Override responsive a11y sample size (e.g., `3`, `10`, or `all`)
- `A11Y_KEYBOARD_STEPS` - Override keyboard audit TAB depth (default: 20)

### Visual Regression Thresholds
Sites can customize thresholds in configuration:
```json
"visualThresholds": {
  "ui_elements": 0.1,    // 10% for UI components
  "content": 0.25,        // 25% for text content
  "dynamic": 0.5          // 50% for dynamic areas
}
```

Default threshold is `0.05` (5%) when not configured. Use `visualOverrides` for per-page threshold adjustments.

### Accessibility Configuration
- `a11yFailOn` - Array of impact levels to gate on (default: `["critical","serious"]`)
- `a11yIgnoreRules` - Array of axe rule IDs to ignore (e.g., `"color-contrast"`)
- `a11yMode` - `"gate"` (default, fail on violations) or `"audit"` (log only, no failures)
- `a11yResponsiveSampleSize` - Pages per viewport for responsive a11y (default: 3, or use `--a11y-sample=N` or `--a11y-sample=all`)
- `a11yKeyboardSampleSize`, `a11yMotionSampleSize`, `a11yReflowSampleSize`, `a11yIframeSampleSize`, `a11yStructureSampleSize` - Optional overrides for specific audit types

Use `--a11y-tags=wcag` to scope axe scans to WCAG-tagged rules only.

### Link Checking Configuration
```json
"linkCheck": {
  "maxPerPage": 20,        // Max links to check per page
  "timeoutMs": 5000,       // Request timeout
  "followRedirects": true, // Follow redirect chains
  "methodFallback": true   // Retry with GET when HEAD fails
}
```

### Performance Budgets
Optional soft gates for DOM timing metrics:
```json
"performanceBudgets": {
  "domContentLoaded": 2500,     // ms
  "loadComplete": 4000,          // ms
  "firstContentfulPaint": 2000   // ms
}
```

### Performance Expectations
- Functionality tests: 4-6 minutes (includes accessibility scanning)
- Responsive tests: 6-8 minutes (multi-viewport visual regression)
- Full suite: 10-14 minutes
- Single browser reduces runtime by 25-40%

## Deterministic Testing Support
For CI reliability, a static test server is available:
- Server: `scripts/static-server.js` serves `fixtures/static-site/` on port 8080
- Config: `sites/static-smoke.json` for deterministic smoke tests
- CI auto-starts server when `SMOKE_SITE=static-smoke`

## Page Discovery
Add a `discover` block to site config for sitemap-based page discovery:
```json
"discover": {
  "strategy": "sitemap",
  "sitemapUrl": "https://example.com/sitemap_index.xml",
  "maxPages": 25,
  "include": ["^/services"],
  "exclude": ["^/tag/"]
}
```

Run with `--discover` to refresh `testPages` from sitemap before running tests.