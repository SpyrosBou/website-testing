# Custom HTML Reporting Migration Plan

## Goal Workflow
- Run `npm test`/`node run-tests.js`; Playwright executes suites and emits one new HTML report inside `reports/` without removing earlier runs.
- Each report file is self-contained (inline CSS/JS) with accessible summaries, per-test sections, and links to run artifacts stored alongside it.
- `npm run viewreport` opens the newest report in the default browser; `npm run viewreport -- --file=<name>` targets a specific file, and `--list` enumerates available reports.

## Guiding Principles
- Eliminate every Allure dependency, helper, artifact, and CI reference; no orphaned scripts or docs.
- Keep reporting simple, semantic, and readable offline—no build tooling, no external CDNs, no network calls.
- Preserve historical runs (timestamped filenames + run folders) while keeping output structured enough for automation.
- Maintain existing insight depth (tables, summaries, attachments) currently surfaced via `utils/allure-utils.js` by migrating that logic into the new reporter pipeline.
- Ensure cross-platform support for the view command (Windows, macOS, Linux) and work within the repo’s Node dependency footprint.

## Workstreams & Key Tasks

### 1. Decommission Allure
- Remove `allure-playwright` and `allure-commandline` from `package.json`, lockfile, and uninstall locally.
- Delete Allure-specific scripts (`scripts/allure.js`), npm scripts (`allure-report`, `allure-serve`, `clean-allure`, `test:clean`, etc.), and cleanup routines in `scripts/cleanup.js`.
- Purge Allure references from `utils/test-runner.js`, spec files, documentation (`README.md`, `CLAUDE.md`, `AGENTS.md`, `regression_testing.md`, `report.md`, `specs/` docs), and repo metadata (`keywords`).
- Remove `allure-report/` and `allure-results/` handling from `.gitignore`, CI configs, and local helper messages.
- Replace or retire `utils/allure-utils.js`; plan its successor API while keeping downstream tests working during the refactor.

### 2. Design the HTML Reporting Output
- Define filesystem layout: `reports/<run-id>/index.html` (run summary), optional per-test HTML (`reports/<run-id>/tests/<test-id>.html`), plus `assets/` for copies of screenshots, traces, console logs.
- Establish naming scheme (`run-YYYYMMDD-HHMMSS` or monotonic counter) to avoid collisions and support chronological sorting.
- Capture structured data per test (status, annotations, durations, retry info, summaries, attachments) in memory, optionally mirrored to JSON for tooling/debugging.
- Create reusable HTML template utilities (e.g., `utils/report-templates.js`) that render the run summary and per-test detail pages with inline CSS + minimal vanilla JS for filtering/search.
- Ensure attachment links are relative, and embed critical metadata (site, profile, viewport, environment variables, start/end time) near the top of the report.

### 3. Implement Playwright Reporter
- Author `utils/custom-html-reporter.js` exporting a Playwright reporter that hooks `onBegin`, `onTestBegin`, `onTestEnd`, `onEnd`.
- Aggregate test-level data (including current `attachSummary` content) so it can be injected into the HTML templates.
- Copy Playwright attachments into the run’s `assets/` directory and reference them from HTML (images, JSON, traces, logs).
- Handle parallel projects/workers: segregate data by project, display retries, flag flaky/failed tests, summarize stats at run-level.
- Provide configuration (via Playwright config reporter options) for output root, whether to emit per-test HTML, verbosity toggles, etc.
- Update `playwright.config.js` to replace Allure reporters with the custom reporter (and keep Playwright’s native list/html reporters disabled unless intentionally retained for debugging).

### 4. Update Test Helpers & Specs
- Replace `utils/allure-utils.js` with a reporter-friendly helper (e.g., `utils/reporting-utils.js`) that lets specs push HTML/Markdown snippets to the reporter instead of calling Allure APIs directly.
- Modify all specs that import `attachSummary`/`escapeHtml` so they register their summaries via the new helper API (likely writing to disk or emitting events the reporter consumes).
- Ensure the helper retains current styling/semantics (tables, badges) while decoupling from Allure’s byte limits and attachment mechanics.

### 5. Runner, CLI, & Tooling Integration
- Extend `run-tests.js` messaging to point developers to the new report location and CLI command.
- Add `npm run viewreport` script (Node helper under `scripts/view-report.js`) that:
  - Without args: opens the most recent `index.html` using a cross-platform `open` utility (`open` package or hand-rolled spawn logic).
  - `--file=<name>`: validates existence and opens that report.
  - `--list`: prints available runs sorted newest → oldest with metadata (timestamp, status counts if available).
- Provide a `cleanup` target to prune old reports (e.g., repurpose `clean-backup-html` or add `clean-reports`).

### 6. Documentation & Developer Experience
- Rewrite README + internal docs to describe the new workflow, prerequisites (Java no longer required), and how to consume reports.
- Update `codex-plan.md`, `AGENTS.md`, `CLAUDE.md`, `report.md`, and any onboarding docs with fresh screenshots/descriptions of the HTML report.
- Note migration steps for CI: archive `reports/` artifacts instead of Allure directories, adjust pipelines accordingly.
- Communicate open decisions (e.g., per-test HTML optionality, JSON export format) in docs for contributors.

### 7. Validation & Quality Gates
- Run Playwright locally to confirm reporter emits expected HTML/asset structure; spot-check failure and success cases.
- Add unit tests (Jest or Node asserts) for template rendering helpers using captured sample data to prevent regressions.
- Lint/update ESLint configs if new files require adjustments; ensure `npm run lint` and the suite pass without Allure packages.
- Verify `npm run viewreport` works across macOS/Linux (use `xdg-open`/`start` fallbacks) and handle missing report scenarios gracefully.

## Risks & Mitigations
- **Spec helper migration churn**: introduce transitional helper that mimics Allure API shape to minimize simultaneous edits; refactor tests iteratively.
- **Attachment size growth**: enforce optional compression/limit policies in the reporter (skip copying massive videos unless requested) to keep reports light.
- **Cross-platform shell differences**: encapsulate open/list logic in Node instead of shell scripts to stay portable.
- **CI artifact size**: document retention policy and consider zipping run folders before upload.

## Open Questions
- Do we still need per-test standalone HTML files alongside the run summary, or is a single run-level file sufficient once it exposes anchors? (Default plan: generate run summary plus optional per-test pages.)
- Should we persist machine-readable JSON for integration with dashboards, or keep HTML-only until a need arises?
- How many historical reports should `clean-reports` retain by default (all, N most recent, age-based)?

## Next Steps
1. Confirm answers to open questions (especially per-test file expectations and JSON exports).
2. Create a feature branch, remove Allure dependencies/scripts, and scaffold the reporter + templates.
3. Migrate spec helpers incrementally, validate output, and iterate on styling/accessibility of the new HTML report.
4. Update documentation, CLI scripts, and CI configs; finalize cleanup tooling and developer guidance.
