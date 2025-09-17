# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Build and Test Commands
```bash
# Initial setup (install dependencies and Playwright browsers)
npm run setup

# Run tests for specific site
node run-tests.js --site=SITENAME              # All tests
node run-tests.js --site=SITENAME --functionality   # Functionality tests only  
node run-tests.js --site=SITENAME --responsive     # Responsive tests only

# List available sites
node run-tests.js --list

# Run single test file directly with Playwright
SITE_NAME=SITENAME npx playwright test tests/functionality.infrastructure.spec.js

# Smoke test profile (fast, Chrome-only, responsive tests)
node run-tests.js --site=SITENAME --profile=smoke

# Update visual regression baselines after intentional changes
npx playwright test tests/responsive.visual.spec.js --update-snapshots
```

### Reporting Commands
```bash
# Generate and open Allure report (primary reporting)
npm run allure-serve

# Clean Allure results before fresh test run
npm run clean-allure

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

**Responsive Tests** (Multi-viewport testing):
- `responsive.structure.spec.js` - Layout and critical elements across viewports
- `responsive.visual.spec.js` - Visual regression with masked dynamic content
- `responsive.a11y.spec.js` - WCAG 2.1 AA accessibility compliance

**Functionality Tests** (Core behavior):
- `functionality.infrastructure.spec.js` - Page availability, HTTP responses, performance
- `functionality.links.spec.js` - Internal link validation
- `functionality.interactive.spec.js` - Lightweight focus/hover audit across every `testPages` URL that logs console and network issues; add site-specific specs for real user journeys or form workflows
- `functionality.wordpress.spec.js` - WordPress-specific plugin and theme testing
- `functionality.accessibility.spec.js` - Comprehensive WCAG scanning

Shared suites (infrastructure, links, accessibility, responsive) assert against every `testPages` entry. Only the interactive audit stays intentionally light-touch so it remains stable across clients; reach for site-specific interactive specs when you need deep user journeys or authenticated flows.

### Site Configuration System
Each WordPress site requires a JSON configuration in `sites/` directory:
- Naming convention: `sitename-local.json` (local dev) and `sitename-live.json` (production)
- Configuration drives all test behavior and site-specific selectors
- The `SITE_NAME` environment variable is set automatically by the test runner
- Optional knobs: `linkCheck` (per-page link sampling controls), `ignoreConsoleErrors`/`resourceErrorBudget` (interactive audit filters), and `performanceBudgets` (soft gates for DOM timings)
- Functionality specs read these settings and surface structured summaries in Allure via helpers in `utils/allure-utils.js` (HTTP response tables, link coverage, interactive console/resource breakdowns, etc.).

### Test Runner Architecture
The `run-tests.js` orchestrates test execution:
1. Loads site configuration from `sites/` directory
2. Sets environment variables (`SITE_NAME`, `SITE_OUTPUT_DIR`, `PLAYWRIGHT_REPORT_FOLDER`)
3. Spawns Playwright process with appropriate test filters
4. Organizes reports by site name to prevent conflicts

### Key Utilities
- `utils/test-runner.js` - Main test orchestration and site management
- `utils/site-loader.js` - Configuration loading and validation
- `utils/test-helpers.js` - Advanced error handling, retry mechanisms, browser lifecycle
- `utils/wordpress-page-objects.js` - WordPress-specific page object patterns
- `utils/test-data-factory.js` - Test data generation for forms

### Report Organization
- `allure-results/` - Raw test data (overwritten each run)
- `allure-report/` - Generated HTML report with charts and trends
- `test-results/[site-name]/` - Screenshots, videos, traces per site
- `tests/baseline-snapshots/` - Visual regression baselines (version controlled)
- `playwright-report-[site-name]/` - Backup HTML report per site

## WordPress-Specific Considerations

### Local Development Testing
- Local by Flywheel sites use self-signed certificates (`ignoreHTTPSErrors: true`)
- URLs typically end with `.local` domain
- May require longer timeouts due to local environment performance

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
- `--profile=smoke` - Fast feedback: responsive tests, Chrome only, single page
- `--profile=full` - Comprehensive: all tests, all browsers (default)
- `--profile=nightly` - Extended testing for scheduled runs

## Critical Implementation Details

### Environment Variables
The test runner automatically sets:
- `SITE_NAME` - Required by all test files to load configuration
- `SITE_OUTPUT_DIR` - Organizes test artifacts by site
- `PLAYWRIGHT_REPORT_FOLDER` - Site-specific HTML report location

### Visual Regression Thresholds
Sites can customize thresholds in configuration:
```json
"visualThresholds": {
  "ui_elements": 0.1,    // 10% for UI components
  "content": 0.25,        // 25% for text content
  "dynamic": 0.5          // 50% for dynamic areas
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
