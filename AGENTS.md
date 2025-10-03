# Repository Guidelines

## Project Structure & Module Organization
- `tests/` Playwright specs: responsive (`responsive.*.spec.js`), functionality (`functionality.*.spec.js`), and `baseline-snapshots/` for visual baselines.
- `sites/` JSON site configs (e.g., `example-site.json`, `*-local.json`, `*-live.json`).
- `utils/` helpers (`test-helpers.js`, `test-runner.js`, `wordpress-page-objects.js`, `test-data-factory.js`, `reporting-utils.js`, `report-schema.js`).
- `specs/` experimental YAML definitions + generator (not wired into the runner).
- Reports/artifacts: `reports/` (timestamped folders with `report.html` + `data/run.json`), `playwright-report/`, `test-results/` (git-ignored).

## Build, Test, and Development Commands
- `npm run setup` — install deps and download Playwright browsers into `.pw-browsers/`.
- `npm test` or `node run-tests.js` — run suite for `example-site` (CLI only; no interactive mode).
- `node run-tests.js --site=<name>` — run against a specific config.
- `--responsive` / `--functionality` — filter suites (example: `node run-tests.js --site=daygroup-local --responsive`).
- `--profile=smoke|full|nightly` — presets for common runs (smoke = responsive + Chrome + first page only).
- `npm run viewreport` — open the latest HTML report generated under `reports/` (pass `--list` or `--file=<run>` for history).
- Notes: reports live in `reports/run-*/report.html`; use `npm run clean-reports` to prune history, and `npm run clean-all-results` to clear Playwright artifacts.
- Cleanup: `npm run clean-reports`, `npm run clean-old-results`, `npm run clean-all-results`, `npm run clean-backup-html`.
- `npm run test:site -- --site=<name>` — npm-script wrapper that forwards `--site`.
- For CI smoke runs, consider `sites/nfsmediation-smoke.json` (homepage only) or use `nfsmediation-live`.
 - Deterministic CI option: set `SMOKE_SITE=static-smoke` to use the built-in static server (`scripts/static-server.js`) and `sites/static-smoke.json`.
 - Lint/format: `npm run lint`, `npm run lint:fix`, `npm run format`.

## Coding Style & Naming Conventions
- Language: Node.js (CommonJS). Use 2-space indentation, semicolons, single quotes.
- Tests live in `tests/` and end with `*.spec.js` using `test.describe` / `test`.
- Site configs: one file per site in `sites/`; prefer `my-site-local.json` and `my-site-live.json` naming.
- Keep helpers cohesive in `utils/`; avoid ad-hoc scripts elsewhere.
- Optional discovery: when `discover.strategy` is `sitemap`, run `npm run discover_pages -- --site=<name>` to fetch the sitemap, merge up to `maxPages` paths, and apply optional `include`/`exclude` filters without executing tests. Always keep `testPages` aligned with critical routes even when discovery is enabled.

## Testing Guidelines
- Frameworks: `@playwright/test` + `@axe-core/playwright`; reporting via the custom HTML reporter in `utils/custom-html-reporter.js` with the new layout (headline cards → metadata → promoted summaries → collapsible "Debug testing" deck).
- Default runs execute only the Chrome desktop Playwright project; pass `--project=all` or comma-separated names to broaden browser coverage.
- Required env: set `SITE_NAME` implicitly via runner (`--site=<name>`). Running Playwright directly: `SITE_NAME=my-site npx playwright test`.
- Add new tests under `tests/`.
- Responsive specs are split into:
  - `responsive.layout.structure.spec.js` (layout/critical elements, cross-viewport consistency, WP features)
- `visual.regression.snapshots.spec.js` (visual regression with masks/thresholds; defaults to desktop unless expanded via `--viewport`/`VISUAL_VIEWPORTS`)
  - `a11y.responsive.audit.spec.js` (axe-core scans)
- Functionality specs are split into:
  - `functionality.infrastructure.health.spec.js` (availability, responses, performance)
  - `functionality.links.internal.spec.js` (internal links)
  - `functionality.interactive.smoke.spec.js` (touches every `testPages` URL with lightweight focus/hover taps while capturing console/resource failures; add client-specific specs when you need real user journeys)
  - `a11y.audit.wcag.spec.js` (WCAG scans)
- `a11y.forms.validation.spec.js` (form labelling + validation checks driven by `siteConfig.forms`; summaries highlight WCAG 1.3.1, 3.3.x, and 4.1.2 coverage).
- `a11y.keyboard.navigation.spec.js` (focus order, skip links, keyboard traps, focus visibility; summaries cite WCAG 2.1.1, 2.1.2, 2.4.1, 2.4.3, 2.4.7).
- `a11y.resilience.adaptive.spec.js` (reduced motion, 320px reflow, iframe metadata; summaries cite WCAG 2.2.2, 2.3.3, 1.4.4, 1.4.10, 4.1.2).
- `a11y.structure.landmarks.spec.js` (landmark + heading integrity; summaries cite WCAG 1.3.1, 2.4.1, 2.4.6, 2.4.10).
- Each functionality spec now emits schema payloads via `attachSchemaSummary`, and the reporter renders the same HTML/Markdown layouts inline (legacy suites still rely on `attachSummary` until migrated). Detailed tables remain available once you expand a page accordion or the debug deck.
  - The manual accessibility suites add a dedicated “WCAG coverage” banner to their summaries; mirror that pattern for any new audit so reviewers immediately know which success criteria were exercised.
  - When adding a new spec, emit schema payloads (`attachSchemaSummary`) so the reporter can promote them; use `attachSummary` only as a temporary fallback while migrating legacy code.
- WCAG-impact findings (e.g., contrast, keyboard traps) are never ignored in automated runs. If the suite flags one, treat it as a bug for the product/design team—do not whitelist it in configs just to satisfy CI.
- Keyboard audit depth can be tuned per run by exporting `A11Y_KEYBOARD_STEPS` (defaults to 20 forward tabs and one reverse tab sanity check).
- Structural sample size honours `a11yStructureSampleSize` (falls back to `a11yResponsiveSampleSize`).

All shared suites traverse the full `testPages` list. The interactive audit is intentionally light-touch—focus/hover taps plus console and network monitoring—so it remains stable across sites. Build site-specific interactive specs when you need deep journeys, logins, or bespoke flows.
- Snapshot baselines go in `tests/baseline-snapshots/`.
- Update visual baselines after intentional UI changes:
  - CLI: `npx playwright test tests/visual.regression.snapshots.spec.js --update-snapshots`
  - Runner helper: `node run-tests.js --update-baselines --site=<name>` or `npm run update-baselines -- --site=<name>`
- Visual regression defaults to desktop viewports; expand with `--viewport=all` (or `VISUAL_VIEWPORTS`) when you need mobile/tablet snapshots.
- Generate reports: the custom HTML reporter runs automatically; view them with `npm run viewreport`. Playwright artifacts for the latest run live in `test-results/` (cleared before each execution unless `PW_SKIP_RESULT_CLEAN=true`).

### Accessibility Configuration (Optional)
- Add to your site config to control gating and ignores:
  - `a11yFailOn`: array of impacts to fail on (default `['critical','serious']`).
  - `a11yIgnoreRules`: array of axe rule IDs to ignore (e.g., `"color-contrast"`).
- `a11yMode`: set to `"gate"` (default) to aggregate violations and fail after the full run, or `"audit"` to log summaries without failing. Suites run in the selected Playwright project (Chrome by default); omit `--project` to execute across all configured browsers/devices.
- When violations occur, the specs emit schema payloads per page/viewport so the reporter can surface the same HTML/Markdown cards summarizing rule IDs, help URLs, and node counts.
- `ignoreConsoleErrors`: substrings/regex patterns to filter known console noise during interactive scans.
- `resourceErrorBudget`: number of failed network requests tolerated before the interactive spec soft-fails (default 0).
- `testPages`: keep this array tightly aligned with the content that should stay live. Functionality/accessibility specs treat 4xx/5xx as failures, so update the JSON whenever URLs are removed or slugs change. Discovery is opt-in—configure `discover.strategy: "sitemap"` and run with `--discover` when you want to refresh paths.

### Link & Performance Configuration (Optional)
- `linkCheck`: `{ maxPerPage?: number, timeoutMs?: number, followRedirects?: boolean, methodFallback?: boolean }` tunes the internal link audit. Defaults are `20`, `5000`, `true`, `true`, respectively.
- `performanceBudgets`: `{ domContentLoaded?: number, loadComplete?: number, firstContentfulPaint?: number }` sets per-page (ms) soft gates surfaced by `functionality.infrastructure.health.spec.js`.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`) as seen in history.
- PRs should include: clear description, linked issue (if any), how to run/reproduce, and relevant report paths/screenshot diffs.
- Ensure local run passes for the targeted site; avoid committing artifacts (`.gitignore` enforced).

## Security & Configuration Tips
- Do not commit secrets or `.env` files; configs may point to production URLs—use `*-local.json` for local/dev.
- When testing live sites, avoid destructive flows; limit to read-only checks unless approved.

## Project Plan Maintenance
- Maintain `codex-plan.md` alongside project documentation. Update it whenever workflows, scripts, structure, CI, or testing behavior changes; treat it as the source of truth for project state and roadmap.
