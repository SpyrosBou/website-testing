# Codex Plan

This document is the living plan for the WordPress Testing Suite. It captures goals, current state, risks, and a phased roadmap with acceptance criteria so future contributors/agents can act confidently. Keep it updated when scripts, flows, or architecture change.

## 1) Purpose and Goals
- Automate end-to-end QA for WordPress sites: responsive layout, functionality, and accessibility.
- Provide actionable reports (Allure + Playwright HTML), screenshots, videos, and traces.
- Support multiple sites via JSON configs with safe read-only defaults for live targets.

Non-goals: destructive authoring flows, plugin unit tests, and large-scale load/security testing.

## 2) Architecture Snapshot (Current)
- Stack: Node.js (CommonJS), Playwright, axe-core, Allure (allure-playwright plugin).
- Key directories:
  - `tests/` specs: `responsive.spec.js`, `functionality.spec.js`, `baseline-snapshots/`.
  - `utils/` helpers: `test-helpers.js`, `test-runner.js`, `wordpress-page-objects.js`, `test-data-factory.js`.
  - `sites/` JSON configs per site (`*-local.json`, `*-live.json`).
  - Reports/artifacts: `playwright-report/`, `test-results/`, `allure-results/`, `allure-report/`.
- Entrypoints: `run-tests.js` (CLI); `playwright.config.js` (projects/reporters).

## 3) Risks and Issues (Priority)
1. Non-TTY runs default to interactive UI → CI hangs or exits without running tests.
2. Script/behavior mismatches: interactive CLI references missing scripts and runner fields.
3. Reporting/doc drift: printed paths don’t match actual output; lack of timestamped HTML reports.
4. Fragile process management: `pkill` usage may kill unrelated processes and is non-portable.
5. Allure CLI not guaranteed: `npx allure` requires global tool; not a devDependency.
6. Default example site is a placeholder → out-of-the-box tests fail.
7. No CI test gate; no lint/format enforcement.

## 4) Roadmap (Phased)

Phase 0 — Stabilize (1–2 days)
- Remove interactive mode; CLI only with flags. Default behavior runs tests for `example-site` when no `--site` provided.
- Runner output: return and print actual report/artifact paths; remove dead fields.
- Interactive menu: align to existing scripts or add missing ones; avoid dead links.
- Process mgmt: remove/guard `pkill` (no-op on unsupported OS, scope to session/PID).
- Allure: add `allure-commandline` devDependency; ensure `npm run allure-report` uses it.

Acceptance: `npm test` and `node run-tests.js --site=<valid-site>` succeed locally and in a headless CI shell; Allure report generation works without global installs.

Phase 1 — CI + Defaults (2–3 days)
- CI: add GitHub Actions (Node 18/20) with steps: `npm ci`, `npm run setup`, smoke run (`--responsive`, `--project=Chrome`). Upload `playwright-report`.
- Defaults: point `sites/example-site.json` to a stable public demo or provide a tiny mock/static server for CI; ensure non-destructive flows.
- Cross-platform: replace `rm -rf`/`find` with Node APIs or `rimraf` in scripts.

Acceptance: PRs run smoke tests in CI and produce an artifact. Repo is runnable with zero external prerequisites beyond Node + browsers.

Phase 2 — Maintainability (1–2 weeks)
- Lint/format: add ESLint + Prettier, scripts (`lint`, `lint:fix`, `format`), wire into CI. [DONE]
- Test stability: mask common dynamic elements, allow per-site `visualThresholds`, and `dynamicMasks`. [DONE]
- Profiles: add `--profile=smoke|full|nightly` and make smoke limit to first page and Chrome. [DONE]
- Test hygiene: consider splitting monolithic specs into focused files and extract shared assertions. [NEXT]
- Docs sync: reconcile README/AGENTS with new profiles and masking guidance. [DONE]

Acceptance: CI enforces linting; repeated runs are stable on the demo site; README matches actual outputs and commands.

Phase 3 — Extensibility (Optional)
- TypeScript for `utils/` and configuration types (gradual).
- Add smoke/full/nightly profiles to CLI flags.
- Optional containerized local WP for deeper plugin/theme checks in isolation.

Acceptance: type-safe helpers; clearer layering; optional advanced profiles.

## 5) CI/CD Plan (Sketch)
- Triggers: PRs and `main` pushes; nightly (02:00 UTC) schedule; manual dispatch with site input.
- Jobs: Node 18/20 matrix; install, setup browsers, run smoke tests (`--responsive --project=Chrome`), upload HTML report and traces.
- Cache: npm cache and Playwright browsers where feasible.

## 6) Test Strategy
- Smoke: responsive subset on homepage + 1–2 pages, single browser.
- Full: responsive + functionality suites across configured pages and multiple projects.
- Baselines: store under `tests/baseline-snapshots/`; update intentionally via `--update-snapshots` and review diffs.
- Accessibility: axe-core scans limited to sample pages per run for speed; escalate serious/critical only.

## 7) Operating Norms
- Style: CommonJS, 2-space indent, semicolons, single quotes.
- Naming: test files `*.spec.js`, site configs `*-local.json` / `*-live.json`.
- Secrets: do not commit `.env`; live sites are read-only; avoid destructive paths.
- Local preflight: for `.ddev.site` bases, optional `ENABLE_DDEV=true` with `DDEV_PROJECT_PATH` to auto-start and wait for the local site.

## 8) Deliverables & Acceptance Criteria (Summary)
- P0: Non-interactive reliability + Allure works locally and in CI.
- P1: CI pipeline green on PRs using a runnable default site.
- P2: Lint/format in CI; stable snapshots; documentation accurate.
- P3: Optional type safety and API layering.

## 9) Maintenance
- Keep this file updated when changing scripts, CLI flags, report locations, CI, or directory structure. Reference it in PR templates and AGENTS.md.

## 10) Command Cheat Sheet
- Setup: `npm run setup`
- Full run: `node run-tests.js --site=<name>`
- Responsive only: `node run-tests.js --site=<name> --responsive`
- Functionality only: `node run-tests.js --site=<name> --functionality`
- Allure report: `npm run allure-report`
- Update snapshots: `npx playwright test tests/responsive.spec.js --update-snapshots`
