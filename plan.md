# Custom HTML Reporting Migration Plan

## Goal Workflow
- Run `npm test`/`node run-tests.js`; Playwright executes suites and emits one new HTML report inside `reports/` without removing earlier runs.
- Each report file is self-contained (inline CSS/JS) with accessible summaries, per-test sections, and links to run artifacts stored alongside it.
- `npm run viewreport` opens the newest report in the default browser; `npm run viewreport -- --file=<name>` targets a specific file, and `--list` enumerates available reports.

## Guiding Principles
- Eliminate every Allure dependency, helper, artifact, and CI reference; no orphaned scripts or docs.
- Keep reporting simple, semantic, and readable offline—no build tooling, no external CDNs, no network calls.
- Preserve historical runs (timestamped filenames + run folders) while keeping output structured enough for automation.
- Maintain existing insight depth (tables, summaries, attachments) currently surfaced via `utils/reporting-utils.js` by migrating that logic into the new reporter pipeline.
- Ensure cross-platform support for the view command (Windows, macOS, Linux) and work within the repo’s Node dependency footprint.

## Workstreams & Key Tasks

### 1. Decommission Allure
- Remove `allure-playwright` and `allure-commandline` from `package.json`, lockfile, and uninstall locally.
- Delete Allure-specific scripts (`scripts/allure.js`), npm scripts (`allure-report`, `allure-serve`, `clean-allure`, `test:clean`, etc.), and cleanup routines in `scripts/cleanup.js`.
- Purge Allure references from `utils/test-runner.js`, spec files, documentation (`README.md`, `CLAUDE.md`, `AGENTS.md`, `regression_testing.md`, `report.md`, `specs/` docs), and repo metadata (`keywords`).
- Remove `allure-report/` and `allure-results/` handling from `.gitignore`, CI configs, and local helper messages.
- Replace or retire `utils/reporting-utils.js`; plan its successor API while keeping downstream tests working during the refactor.

### 2. Design the HTML Reporting Output
- Define filesystem layout: `reports/<run-id>/report.html` as the single run report plus a `data/` folder for JSON snapshots.
- Run report = the self-contained HTML entry point for that run; it includes metadata, full per-test breakdowns (pages covered, pass/fail, visual diffs, accessibility tables) and summary totals.
- Anchors = HTML `id` attributes on each test section so deep links like `report.html#project-test-id` jump directly to the detailed block for that test within the same document.
- Establish naming scheme (`run-YYYYMMDD-HHMMSS` or monotonic counter) to avoid collisions and support chronological sorting.
- Capture structured data per test (status, annotations, durations, retry info, summaries, attachments) in memory and persist per-run/per-test JSON alongside the HTML for downstream integrations.
- Create reusable HTML template utilities (e.g., `utils/report-templates.js`) that render the run summary and per-test detail pages with inline CSS + minimal vanilla JS for filtering/search.
- Embed critical metadata (site, profile, viewport, environment variables, start/end time) near the top of the report, and inline any media (screenshots/diff images, console excerpts) directly into the HTML so the file is self-contained.

### 3. Implement Playwright Reporter
- Author `utils/custom-html-reporter.js` exporting a Playwright reporter that hooks `onBegin`, `onTestBegin`, `onTestEnd`, `onEnd`.
- Aggregate test-level data (including current `attachSummary` content) so it can be injected into the HTML templates.
- Convert relevant Playwright attachments (screenshots, diffs, textual logs) into inline data URIs or embedded blocks so the HTML file remains hard-baked with no external dependencies.
- Handle parallel projects/workers: segregate data by project, display retries, flag flaky/failed tests, summarize stats at run-level.
- Provide configuration (via Playwright config reporter options) for output root, which attachment types to inline, JSON emission toggles, and verbosity levels.
- Update `playwright.config.js` to replace Allure reporters with the custom reporter (and keep Playwright’s native list/html reporters disabled unless intentionally retained for debugging).

### 4. Update Test Helpers & Specs
- Replace `utils/reporting-utils.js` with a reporter-friendly helper (e.g., `utils/reporting-utils.js`) that lets specs push HTML/Markdown snippets to the reporter instead of calling Allure APIs directly.
- Modify all specs that import `attachSummary`/`escapeHtml` so they register their summaries via the new helper API (likely writing to disk or emitting events the reporter consumes).
- Ensure the helper retains current styling/semantics (tables, badges) while decoupling from Allure’s byte limits and attachment mechanics.

### 5. Runner, CLI, & Tooling Integration
- Extend `run-tests.js` messaging to point developers to the new report location and CLI command.
- Add `npm run viewreport` script (Node helper under `scripts/view-report.js`) that:
  - Without args: opens the most recent `report.html` using a cross-platform `open` utility (`open` package or hand-rolled spawn logic).
  - `--file=<name>`: validates existence and opens that report.
  - `--list`: prints available runs sorted newest → oldest with metadata (timestamp, status counts if available).
- Provide a `cleanup` target to prune old reports (e.g., repurpose `clean-backup-html` or add a new `clean-reports` script that keeps the 10 most recent report folders and deletes older ones).

### 6. Documentation & Developer Experience
- Rewrite README + internal docs to describe the new workflow, prerequisites (Java no longer required), and how to consume reports.
- Update `codex-plan.md`, `AGENTS.md`, `CLAUDE.md`, `report.md`, and any onboarding docs with fresh screenshots/descriptions of the HTML report.
- Note migration steps for CI: archive `reports/` artifacts instead of Allure directories, adjust pipelines accordingly.
- Document the new JSON artifacts, anchor navigation, and clarify that the HTML is self-contained (no external assets required).

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

## Next Steps
1. Finalize the `clean-reports` implementation to keep the 10 most recent run folders.
2. Create a feature branch, remove Allure dependencies/scripts, and scaffold the reporter + templates.
3. Migrate spec helpers incrementally, validate output, and iterate on styling/accessibility of the new HTML report.
4. Update documentation, CLI scripts, and CI configs; finalize cleanup tooling and developer guidance.

## Target User Experience
- Start a run using existing commands (`npm test`, `node run-tests.js`, site/profile flags).
- Custom reporter captures metadata, artifacts, and JSON snapshots during execution.
- On completion it writes `reports/run-YYYYMMDD-HHMMSS/` containing:
  - `report.html`: self-contained run report with metadata, per-test narratives, embedded visuals/logs, anchored sections.
  - `data/`: machine-readable JSON mirrors for integrations.
- CLI prints the new report path and prompts to use `npm run viewreport`.
- `npm run viewreport` opens the latest report; `--file` targets a specific run; `--list` enumerates runs.
- `npm run clean-reports` trims history to the 10 most recent runs.
- CI archives the same run folders; teammates download a single HTML for offline review while JSON supports dashboards.
- Docs clarify report structure, navigation, and reporter options (attachment handling, verbosity).
