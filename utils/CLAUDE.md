# Utils Directory Guidance

The utilities in this folder power site loading, sitemap discovery, Playwright orchestration, Allure attachments, and helper routines shared across the spec files. Treat these modules as low-level building blocks—tests in `tests/` should call into them rather than duplicating logic.

## Key Modules

### `site-loader.js`
- Reads `<repo>/sites/<name>.json`, throws descriptive errors when the file is missing or malformed, and validates required fields (`name`, `baseUrl`, `testPages`).
- Exposes `listAvailableSites()` for the CLI listing. Keep validation tolerant—site configs may include optional fields that future suites consume.

### `sitemap-loader.js`
- Implements `discoverFromSitemap(siteConfig, discoverConfig)` used by `run-tests.js --discover`.
- Fetches sitemap indices up to `maxDepth` (default 2), normalises URLs to paths on the same origin, filters by optional `include`/`exclude` regexes, and deduplicates results.
- Uses the global `fetch` if available or falls back to `node-fetch`; avoid bundling browser-only APIs here.

### `test-runner.js`
- CLI façade around Playwright:
  - Validates the site, prints helpful logging, and optionally performs sitemap discovery (persisting results back to `sites/<name>.json`).
  - Clears `allure-results/` and `allure-report/`, creates `test-results/` scaffolding, and spawns `npx playwright test` with the correct filters/projects.
  - Sets `SITE_NAME` (and `SMOKE` when `--profile=smoke`) before launching Playwright.
  - Provides helper entry points: `displaySites()`, `runTestsForSite()`, and `updateBaselines()`.
- Be mindful that `--discover` writes to disk; gate changes carefully and keep JSON formatting stable (`JSON.stringify(..., null, 2)` plus trailing newline).

### `test-helpers.js`
- Houses retry/backoff logic (`retryOperation`), safe navigation (`safeNavigate`), stability waits, console/resource listeners, and debugging utilities.
- `setupTestPage`/`teardownTestPage` register listeners for console errors/network failures and capture state for later logging.
- `safeNavigate` supports `{ allow404: true }` so specs can inspect expected 404 responses without throwing.
- Central place to enhance retry strategy—prefer tweaking helpers instead of reimplementing similar loops inside individual tests.

### `responsive-helpers.js`
- Provides canonical viewport definitions, visibility helpers, and menu toggling utilities for responsive specs.
- Includes a catalogue of common WordPress selectors (navigation/header/footer/menu toggles). Update this file when you need broader theme coverage.

### `wordpress-page-objects.js`
- Encapsulates navigation, media detection, and plugin/theme heuristics specific to WordPress installs.
- Used heavily by the functionality specs; extend here when adding new CMS-aware behaviours.

### `test-data-factory.js`
- Normalises sample data used during interactive form checks (names, emails, etc.).
- Exposes `createTestData` and `TestDataFactory` for site-specific overrides.

### `allure-utils.js`
- Wraps Allure attachment logic (`attachSummary`, `attachAllureText`) and consistent HTML styling for summary tables.
- Use this when emitting new structured attachments so reports stay visually consistent.

## Working With the Runner
- Prefer adding new CLI flags in `run-tests.js` and plumbing them through `TestRunner` rather than shelling out from elsewhere.
- `updateBaselines(site)` runs only `tests/visual.visualregression.spec.js` with `--update-snapshots`; keep that scoping tight so non-visual baselines remain untouched.
- If you introduce new artefact folders, mirror the cleanup in both `TestRunner.cleanAllureResults()` and `scripts/playwright-global-setup.js`.

## Error Handling & Logging
- Use `classifyError` and `isRetryableError` when you need custom retry policies; they already distinguish assertion vs. navigation vs. network issues.
- When extending `debugBrowserState`, avoid heavy synchronous operations—keep logging concise to prevent runaway console noise.
- Console logging follows emoji prefixes (`✅`, `⚠️`, `❌`, `ℹ️`) for quick scanning; stay consistent so operators can parse runs easily.

## Adding New Utilities
- Keep modules focused and single-purpose; if a helper only relates to responsive tests, prefer adding to `responsive-helpers.js` rather than `test-helpers.js`.
- All new helpers should be CommonJS exports (this repo targets Node 18+/CommonJS).
- Include minimal inline docs or comments when behaviour is non-obvious, but avoid duplicating the README in code comments.
- Update this guide plus the top-level `README.md` when you add new runner flags or helper modules so future agents stay in sync.
