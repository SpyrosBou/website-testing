# Tests Directory Guidance

This directory houses the canonical Playwright specs executed by `run-tests.js`. Tests assume `SITE_NAME` is set (the runner does this automatically) and rely on helpers from `utils/` for navigation safety, retries, Allure attachments, and WordPress-specific selectors.

## Suite Overview
- `functionality.infrastructure.spec.js` — availability, HTTP/content checks, performance metrics, and structural sanity (header/nav/content/footer).
- `functionality.links.spec.js` — internal link sampling with per-site limits, HTTP validation, and Allure coverage reporting.
- `functionality.interactive.spec.js` — lightweight hover/focus audit across every `testPages` entry while capturing console noise and failed network requests.
- `functionality.wordpress.spec.js` — plugin/theme detection plus WordPress-specific sanity checks.
- `functionality.accessibility.spec.js` — axe-core scans aggregated per site with configurable fail/ignore lists.
- `responsive.structure.spec.js` — responsive layout smoke (mobile/tablet/desktop viewports) validating critical elements.
- `visual.visualregression.spec.js` — visual regression baselines per viewport/project with optional per-page thresholds and masks. Attaches a per-viewport Allure HTML + Markdown summary.
- `responsive.a11y.spec.js` — accessibility sampling across mobile/tablet/desktop, honouring `a11yFailOn`, `a11yIgnoreRules`, and `a11yMode`.

## Shared Test Patterns
- Always call `setupTestPage`/`teardownTestPage` (from `utils/test-helpers.js`) inside `beforeEach`/`afterEach` to register console/resource listeners and guarantee cleanup.
- Use `safeNavigate(page, url)` instead of `page.goto` so tests can distingish between expected 404s and real navigation failures; pass `{ allow404: true }` only when you plan to handle the response manually.
- Respect `process.env.SMOKE`. Responsive specs sample a single URL when it equals `'1'` (set by the smoke profile). Functionality suites traverse the full `testPages` list regardless of profile.
- Store logs/results in the Allure summary helpers from `utils/allure-utils.js`. Infrastructure, links, interactive, WordPress, and responsive (structure/visual) specs already attach HTML + Markdown tables—extend those helpers rather than inventing new formats.

## Spec Notes

### Functionality: Infrastructure
- Collects HTTP status, content-type, and structural element visibility per page.
- Records basic performance metrics (`loadTime`, `domContentLoaded`, `loadComplete`, `firstContentfulPaint`) and compares them to optional `performanceBudgets` from the site config. Breaches are soft failures reported in the Allure summary.
- Skips hard assertions when responses are non-200 but continues to log results so availability gaps are visible.

### Functionality: Links
- Samples up to `linkCheck.maxPerPage` unique internal links per page (default 20).
- Normalises URLs (strip hash/query) and retries requests with GET when servers reject HEAD.
- Publishes Allure HTML/Markdown coverage tables highlighting broken links or redirects.

### Functionality: Interactive
- Opens a fresh page for each path to avoid state bleed and captures both console errors and failed requests.
- Ignores known-noise patterns via `ignoreConsoleErrors` from the site config; everything else is reported.
- `resourceErrorBudget` (default `0`) controls whether the spec soft-fails when too many requests fail.
- Uses `WordPressPageObjects` and `TestDataFactory` helpers for lightweight form interactions when configured.

### Functionality: Accessibility
- Runs axe-core scans for every `testPages` entry in desktop Chrome by default (pass `--project` to broaden coverage).
- Respects `a11yFailOn` (default `['critical','serious']`), `a11yIgnoreRules`, and `a11yMode` (`gate` vs `audit`).
- Aggregates violations and fails at the end of the test unless `a11yMode === 'audit'`.
- Attaches per-page/viewport text reports outlining impacted rule IDs, node counts, and help URLs.

### Responsive Suites
- `responsive.structure` verifies header/navigation/footer visibility across the selected responsive viewports (defaults to desktop; supply `--viewport=mobile,tablet,desktop` to expand). In smoke mode it trims the `testPages` array to the first entry.
- `visual.visualregression` drives `expect(page).toHaveScreenshot` with per-site thresholds (`visualThresholds`, `visualOverrides`, `dynamicMasks`). Thresholds now default to `0.05`, and the suite honours `--viewport`/`VISUAL_VIEWPORTS` for additional device snapshots. Snapshots live under `tests/baseline-snapshots/<site>/<spec>/<name>.png`. Each run attaches a per-viewport visual summary to Allure.
- `responsive.a11y` repeats axe-core scans for the selected responsive viewports (defaults to desktop, optional mobile/tablet via `--viewport`). Samples up to three pages per viewport (one when `SMOKE=1`).

## Adding or Modifying Tests
- Always retrieve the site config via `SiteLoader.loadSite(process.env.SITE_NAME)` inside `beforeEach` to ensure environment parity with the runner.
- Prefer helper utilities (`safeNavigate`, `waitForPageStability`, `retryOperation`) over ad hoc sleeps or `page.goto` calls.
- Emit structured errors/logs; when logging console errors, include both message and URL for traceability.
- When adding Allure output, reuse `attachSummary` from `utils/allure-utils.js` so both HTML and Markdown attachments stay consistent.
- Keep form interactions idempotent—mock submissions where possible and avoid POSTing to production endpoints.

## Snapshot & Artifact Tips
- Update visual baselines with `node run-tests.js --site=<name> --update-baselines` (or `npm run update-baselines -- --site=<name>`). The helper delegates to Playwright's `--update-snapshots` for `visual.visualregression.spec.js` only.
- Global setup removes `test-results/`, `playwright-report/`, and Allure folders before each run unless `PW_SKIP_RESULT_CLEAN=true`. Set that flag if you need to inspect artifacts across multiple runs.

## Smoke Profile Behaviour
- Invoke `node run-tests.js --site=<name> --profile=smoke` to set `SMOKE=1`. Responsive specs then exercise only the first `testPages` entry per viewport while functionality specs still hit the entire list (they rely on the same data for infrastructure/link/accessibility coverage).
- You can simulate the same behaviour when running Playwright directly by exporting `SMOKE=1` alongside `SITE_NAME`.
