# Repository Guidelines

## Project Structure & Module Organization
- `tests/` Playwright specs: responsive (`responsive.*.spec.js`), functionality (`functionality.*.spec.js`), and `baseline-snapshots/` for visual baselines.
- `sites/` JSON site configs (e.g., `example-site.json`, `*-local.json`, `*-live.json`).
- `utils/` helpers (`test-helpers.js`, `test-runner.js`, `wordpress-page-objects.js`, `test-data-factory.js`).
- Reports/artifacts: `allure-results/`, `allure-report/`, `playwright-report/`, `test-results/` (git-ignored).

## Build, Test, and Development Commands
- `npm run setup` — install deps and Playwright browsers.
- `npm test` or `node run-tests.js` — run suite for `example-site` (CLI only; no interactive mode).
- `node run-tests.js --site=<name>` — run against a specific config.
- `--responsive` / `--functionality` — filter suites (example: `node run-tests.js --site=daygroup-local --responsive`).
- `--profile=smoke|full|nightly` — presets for common runs (smoke = responsive + Chrome + first page only).
- `npm run allure-report` — generate and open Allure report.
- Cleanup: `npm run clean-allure`, `npm run clean-old-results`, `npm run clean-all-results`.
- `npm run test:site -- --site=<name>` — npm-script wrapper that forwards `--site`.
- For CI smoke runs, consider `sites/nfsmediation-smoke.json` (homepage only) or use `nfsmediation-live`.
 - Deterministic CI option: set `SMOKE_SITE=static-smoke` to use the built-in static server (`scripts/static-server.js`) and `sites/static-smoke.json`.
 - Lint/format: `npm run lint`, `npm run lint:fix`, `npm run format`.

## Coding Style & Naming Conventions
- Language: Node.js (CommonJS). Use 2-space indentation, semicolons, single quotes.
- Tests live in `tests/` and end with `*.spec.js` using `test.describe` / `test`.
- Site configs: one file per site in `sites/`; prefer `my-site-local.json` and `my-site-live.json` naming.
- Keep helpers cohesive in `utils/`; avoid ad-hoc scripts elsewhere.

## Testing Guidelines
- Frameworks: `@playwright/test` + `@axe-core/playwright`; reporting via `allure-playwright`.
- Required env: set `SITE_NAME` implicitly via runner (`--site=<name>`). Running Playwright directly: `SITE_NAME=my-site npx playwright test`.
- Add new tests under `tests/`.
- Responsive specs are split into:
  - `responsive.structure.spec.js` (layout/critical elements, cross-viewport consistency, WP features)
  - `responsive.visual.spec.js` (visual regression with masks/thresholds)
  - `responsive.a11y.spec.js` (axe-core scans)
- Functionality specs are split into:
  - `functionality.infrastructure.spec.js` (availability, responses, performance)
  - `functionality.links.spec.js` (internal links)
  - `functionality.interactive.spec.js` (JS errors, forms)
  - `functionality.wordpress.spec.js` (plugins, theme)
  - `functionality.accessibility.spec.js` (WCAG scans)
- Snapshot baselines go in `tests/baseline-snapshots/`.
- Update visual baselines after intentional UI changes: `npx playwright test tests/responsive.visual.spec.js --update-snapshots`.
- Generate reports: `npm run allure-report`. Artifacts per site in `test-results/<site>/`.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`) as seen in history.
- PRs should include: clear description, linked issue (if any), how to run/reproduce, and relevant report paths/screenshot diffs.
- Ensure local run passes for the targeted site; avoid committing artifacts (`.gitignore` enforced).

## Security & Configuration Tips
- Do not commit secrets or `.env` files; configs may point to production URLs—use `*-local.json` for local/dev.
- When testing live sites, avoid destructive flows; limit to read-only checks unless approved.

## Project Plan Maintenance
- Maintain `codex-plan.md` alongside project documentation. Update it whenever workflows, scripts, structure, CI, or testing behavior changes; treat it as the source of truth for project state and roadmap.
