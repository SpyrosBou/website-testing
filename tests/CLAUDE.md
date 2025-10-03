# Tests Directory Guidance

This directory houses the canonical Playwright specs executed by `run-tests.js`. Tests assume `SITE_NAME` is set (the runner does this automatically) and rely on helpers from `utils/` for navigation safety, retries, report attachments, and WordPress-specific selectors. Summaries emitted here drive the new report layout: run headline cards, per-browser/viewport aggregation, and the per-page accordions surfaced above the "Debug testing" deck.

## Suite Overview

**Visual Tests**:
- `visual.visualregression.spec.js` — Screenshot comparison with masked dynamic content, per-viewport baselines. Triggered by `--visual` flag.

**Responsive Tests**:
- `responsive.structure.spec.js` — Critical element visibility across mobile/tablet/desktop viewports. Triggered by `--responsive` flag.
- `responsive.a11y.spec.js` — Axe-core scans across responsive viewports (covers every configured page by default). Triggered by `--accessibility` flag (NOT `--responsive`).

**Functionality Tests**:
- `functionality.infrastructure.spec.js` — HTTP status, content-type, structural elements, performance metrics.
- `functionality.links.spec.js` — Internal link sampling with per-site limits, HTTP validation, coverage reporting.
- `functionality.interactive.spec.js` — Lightweight hover/focus audit across every `testPages` entry while capturing console noise and failed network requests.
- `functionality.wordpress.spec.js` — Plugin/theme detection plus WordPress-specific sanity checks.
- `functionality.accessibility.spec.js` — Axe-core scans aggregated per site with configurable fail/ignore lists. Triggered by BOTH `--functionality` and `--accessibility` flags.

**Accessibility Deep-Dive Tests** (all triggered by `--accessibility` flag):
- `a11y.forms.spec.js` — Form accessibility validation for configured forms (labels, validation feedback, error messaging).
- `a11y.keyboard.spec.js` — TAB navigation, focus indicators, skip links.
- `a11y.resilience.spec.js` — Reduced-motion support, mobile zoom/reflow, iframe accessibility.
- `a11y.structure.spec.js` — H1 presence, landmark elements, heading hierarchy.

## Test Filtering Logic

The runner categorizes specs based on filename patterns:
- `--visual` → Files starting with `visual.` (1 file)
- `--responsive` → Files starting with `responsive.` EXCEPT those matching `/a11y/i` (1 file: responsive.structure.spec.js)
- `--functionality` → Files starting with `functionality.` (5 files including functionality.accessibility.spec.js)
- `--accessibility` → Files matching `/accessibility|a11y/i` (7 files: responsive.a11y + functionality.accessibility + all 4 a11y.* specs)
- `--full` or no flags → All test specs (12 files total)

## Shared Test Patterns
- Always call `setupTestPage`/`teardownTestPage` (from `utils/test-helpers.js`) inside `beforeEach`/`afterEach` to register console/resource listeners and guarantee cleanup.
- Use `safeNavigate(page, url)` instead of `page.goto` so tests can distinguish between expected 404s and real navigation failures; pass `{ allow404: true }` only when you plan to handle the response manually.
- Respect `process.env.SMOKE`. Responsive specs sample a single URL when it equals `'1'` (set by the smoke profile). Functionality suites traverse the full `testPages` list regardless of profile.
- Store logs/results with the helpers in `utils/reporting-utils.js`. Infrastructure, links, interactive, WordPress, and responsive (structure/visual) specs already attach HTML + Markdown tables—extend those helpers rather than inventing new formats.

## Spec Notes

### Visual: Visual Regression
- Takes screenshots at configured viewports (default: desktop only).
- Compares against baselines in `tests/baseline-snapshots/`.
- Honors `visualThresholds`, `visualOverrides`, and `dynamicMasks` from site config.
- Controlled by `VISUAL_VIEWPORTS` env var (comma-separated: `desktop`, `mobile,tablet,desktop`, or `all`).

### Responsive: Structure
- Verifies critical elements (header/nav/footer) are visible across mobile/tablet/desktop viewports.
- Controlled by `RESPONSIVE_VIEWPORTS` env var (comma-separated: `desktop`, `mobile,tablet,desktop`, or `all`).
- In smoke mode (`SMOKE=1`), samples only the first `testPages` entry per viewport.

### Responsive: Accessibility
- Runs axe-core scans across responsive viewports (defaults to desktop).
- Scans the full `testPages` list by default; limit coverage explicitly via `A11Y_SAMPLE` or site config `a11yResponsiveSampleSize` (the test logs whenever sampling is truncated).
- Respects `a11yFailOn`, `a11yIgnoreRules`, and `a11yMode` from site config.
- **Important**: Triggered by `--accessibility` flag, NOT `--responsive`.

### Functionality: Infrastructure
- Collects HTTP status, content-type, and structural element visibility per page.
- Records performance metrics (`loadTime`, `domContentLoaded`, `loadComplete`, `firstContentfulPaint`) and compares to optional `performanceBudgets` from site config. Breaches are soft failures reported in the run summary.
- Skips hard assertions when responses are non-200 but continues to log results so availability gaps are visible.

### Functionality: Links
- Samples up to `linkCheck.maxPerPage` unique internal links per page (default 20).
- Normalizes URLs (strip hash/query) and retries requests with GET when servers reject HEAD.
- Publishes HTML/Markdown coverage tables for the custom report highlighting broken links or redirects.

### Functionality: Interactive
- Opens a fresh page for each path to avoid state bleed and captures both console errors and failed requests.
- Ignores known-noise patterns via `ignoreConsoleErrors` from the site config; everything else is reported.
- `resourceErrorBudget` (default `0`) controls whether the spec soft-fails when too many requests fail.
- Uses `WordPressPageObjects` and `TestDataFactory` helpers for lightweight form interactions when configured.

### Functionality: WordPress
- Detects active plugins and themes from page source.
- Checks for WordPress-specific issues (lazy loading, AJAX patterns, etc.).
- Minimal assertions—primarily informational for the report.

### Functionality: Accessibility
- Runs axe-core scans for every `testPages` entry in desktop Chrome by default (pass `--project` to broaden coverage).
- Respects `a11yFailOn` (default `['critical','serious']`), `a11yIgnoreRules`, and `a11yMode` (`gate` vs `audit`).
- Aggregates violations and fails at the end of the test unless `a11yMode === 'audit'`.
- Attaches per-page/viewport text reports outlining impacted rule IDs, node counts, and help URLs.
- **Important**: Triggered by BOTH `--functionality` and `--accessibility` flags.

### Accessibility: Forms
- Validates configured forms for accessible labels and meaningful validation feedback.
- Requires `forms` array in site config.
- Samples controlled by `a11yResponsiveSampleSize` or `A11Y_SAMPLE` env var.

### Accessibility: Keyboard
- Performs TAB traversal (default 20 steps, controlled by `A11Y_KEYBOARD_STEPS` env var).
- Verifies focus indicators using pixelmatch screenshot comparison.
- Checks skip links and ensures focus never lands on hidden elements.
- Samples controlled by `a11yKeyboardSampleSize` or falls back to `a11yResponsiveSampleSize`.

### Accessibility: Resilience
- **Reduced-motion**: Forces `prefers-reduced-motion: reduce` and flags long-running/infinite animations.
- **Reflow/zoom**: Renders at 320px viewport and reports horizontal overflow.
- **Iframe inventory**: Captures accessible metadata for embeddings.
- Samples controlled by `a11yMotionSampleSize`, `a11yReflowSampleSize`, `a11yIframeSampleSize`.

### Accessibility: Structure
- Confirms single H1, `main` landmark, and sensible heading outline.
- Samples controlled by `a11yStructureSampleSize` or falls back to `a11yResponsiveSampleSize`.

## Adding or Modifying Tests
- Always retrieve the site config via `SiteLoader.loadSite(process.env.SITE_NAME)` inside `beforeEach` to ensure environment parity with the runner.
- Prefer helper utilities (`safeNavigate`, `waitForPageStability`, `retryOperation`) over ad hoc sleeps or `page.goto` calls.
- Emit structured errors/logs; when logging console errors, include both message and URL for traceability.
- When adding reporting output, reuse `attachSummary` from `utils/reporting-utils.js` so promoted summaries (run headline cards, per-page accordions) stay consistent and the debug deck inherits the same styling.
- Keep form interactions idempotent—mock submissions where possible and avoid POSTing to production endpoints.

## Snapshot & Artifact Tips
- Update visual baselines with `node run-tests.js --site=<name> --update-baselines` (or `npm run update-baselines -- --site=<name>`). The helper delegates to Playwright's `--update-snapshots` for `visual.visualregression.spec.js` only.
- Global setup removes `test-results/` and `playwright-report/` before each run unless `PW_SKIP_RESULT_CLEAN=true`. Set that flag if you need to inspect artifacts across multiple runs.

## Smoke Profile Behavior
- Invoke `node run-tests.js --site=<name> --profile=smoke` to set `SMOKE=1`. Responsive specs then exercise only the first `testPages` entry per viewport while functionality specs still hit the entire list (they rely on the same data for infrastructure/link/accessibility coverage).
- You can simulate the same behavior when running Playwright directly by exporting `SMOKE=1` alongside `SITE_NAME`.
