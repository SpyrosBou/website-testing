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
  - `tests/` specs:
    - Responsive: `responsive.structure.spec.js`, `responsive.visual.spec.js`, `responsive.a11y.spec.js`
    - Functionality: `functionality.infrastructure.spec.js`, `functionality.links.spec.js`, `functionality.interactive.spec.js`, `functionality.accessibility.spec.js`, `functionality.wordpress.spec.js`
    - `baseline-snapshots/` for visual baselines
  - `utils/`: `test-helpers.js`, `test-runner.js`, `wordpress-page-objects.js`, `test-data-factory.js`, `site-loader.js`
  - `sites/`: JSON configs per site (`*-local.json`, `*-live.json`, `*-smoke.json`)
  - `scripts/`: `cleanup.js`, `allure.js`, `static-server.js`, `wait-url.js`
  - `fixtures/static-site/`: deterministic static pages for smoke
  - `specs/` (experimental): YAML specifications + generator/loader utilities; not wired into the runner yet
  - Reports/artifacts: `playwright-report/`, `test-results/`, `allure-results/`, `allure-report/`
- Entrypoints: `run-tests.js` (CLI profiles/flags); `playwright.config.js` (projects/reporters)

- ## 3) Risks and Issues (Priority)
- Addressed: interactive mode removed; runner outputs aligned; safer process mgmt; docs synced; lockfile/CI setup; cross‑platform cleanup; Allure cleanup now uses Node `fs.rmSync` (no shell `rm -rf`); ESLint ergonomics improved (`no-unused-vars.caughtErrorsIgnorePattern: '^_'`).
- Allure requires Java: surfaced with a wrapper (`scripts/allure.js`) and fallback to Playwright HTML report when Java is absent.
- Site-specific selectors and a11y: some themes may need selector tuning; WCAG tests may fail until violations are fixed.

## 4) Roadmap (Phased)

Phase 0 — Stabilize (1–2 days)
- Remove interactive mode; CLI only with flags. [DONE]
- Runner output aligned; dead fields removed. [DONE]
- Process management hardened; `pkill` removed. [DONE]
- Allure wrapper added with Java check and fallback. [DONE]

Acceptance: `npm test` and `node run-tests.js --site=<valid-site>` succeed locally and in a headless CI shell; Allure report generation works without global installs.

Phase 1 — CI + Defaults (2–3 days)
- CI (Node 18/20): `npm ci` → `npm run lint` → install browsers → optional static server → smoke run (`--profile=smoke`) → upload HTML report. [DONE]
- Defaults: `sites/example-site.json` → https://example.com; added `sites/static-smoke.json` and static server for deterministic smoke. [DONE]
- Cross‑platform cleanup via `scripts/cleanup.js`. [DONE]

Acceptance: Manual CI smoke workflow produces an artifact on demand. Repo is runnable with zero external prerequisites beyond Node + browsers.

Phase 2 — Maintainability (1–2 weeks)
- Lint/format: add ESLint + Prettier, scripts (`lint`, `lint:fix`, `format`), wire into CI. [DONE]
- Test stability: mask common dynamic elements, allow per-site `visualThresholds`, and `dynamicMasks`. [DONE]
- Profiles: add `--profile=smoke|full|nightly` and make smoke limit to first page and Chrome. [DONE]
- Test hygiene: split monolithic specs into focused files (responsive + functionality). [DONE]
- Shared assertions: use WordPress page objects for critical elements. [DONE]
- Docs sync: reconcile README/AGENTS with new profiles and masking guidance. [DONE]
- Per-page visuals: `visualOverrides` support (threshold/masks). [DONE]
- Baseline helper: `--update-baselines` for responsive visuals. [DONE]

Acceptance: CI enforces linting; repeated runs are stable on the demo site; README matches actual outputs and commands.

Phase 3 — Extensibility (Optional)
- TypeScript for `utils/` and configuration types (gradual).
- Integrate YAML spec generator (`specs/`) as opt-in pathway; keep hand-authored tests canonical.
- Optional containerized local WP for deeper plugin/theme checks in isolation.

Acceptance: type-safe helpers; clearer layering; optional spec-driven generation behind a flag.

## 5) CI/CD Plan (Sketch)
- Triggers: Manual dispatch only (no automatic PR/push/nightly triggers).
- Jobs: Node 18/20; `npm ci` → `npm run lint` → `npx playwright install --with-deps` → (if SITE=static-smoke start server) → `node run-tests.js --site=$SITE --profile=smoke` → upload HTML report.
- SITE source: manual input `site` or repo variable `SMOKE_SITE`.
- Deterministic smoke: workflow starts `scripts/static-server.js` and waits with `scripts/wait-url.js` when `SITE=static-smoke`.

## 6) Test Strategy
- Smoke: responsive subset (first page only), Chrome, via profile; deterministic option `static-smoke`.
- Full: responsive + functionality suites across configured pages and multiple projects.
- Visuals: per-site thresholds (`visualThresholds`), global+per-page masks (`dynamicMasks`, `visualOverrides`).
- Baselines: `tests/baseline-snapshots/`; update via runner (`--update-baselines`) or direct Playwright update.
- Accessibility: axe-core scans; critical/serious currently fail tests.

## 7) Operating Norms
- Style: CommonJS, 2-space indent, semicolons, single quotes.
- Naming: test files `*.spec.js`, site configs `*-local.json` / `*-live.json`.
- Secrets: do not commit `.env`; live sites are read-only; avoid destructive paths.
- Local preflight: for `.ddev.site` bases, optional `ENABLE_DDEV=true` with `DDEV_PROJECT_PATH` to auto-start and wait for the local site.
 - Cleanup consistency: prefer `scripts/cleanup.js` (cross‑platform) over shell `rm -rf` in any future utilities.

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
- Smoke profile: `node run-tests.js --site=<name> --profile=smoke`
- Deterministic smoke: set `SMOKE_SITE=static-smoke` in CI (auto-starts static server)
- Baselines: `npm run update-baselines -- --site=<name>` (responsive visuals)
- Allure report: `npm run allure-report` (requires Java; fallback is Playwright HTML report)
 - List sites: `node run-tests.js --list`
 - Lint/format: `npm run lint`, `npm run lint:fix`, `npm run format`
 - Cleanup: `npm run clean-allure`, `npm run clean-old-results`, `npm run clean-all-results`, `npm run clean-backup-html`

## 11) Open Items / Backlog
- Align report-cleanup docs/scripts: repository exposes `clean-backup-html` (for `playwright-report`) and result cleaners; avoid referencing non-existent `clean-old-reports`/`clean-all-reports` in future docs.
- Document experimental `specs/` directory and integrate the generator behind a flag if adopted; update runner/CI accordingly.
