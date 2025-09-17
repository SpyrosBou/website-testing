# Codex Worktrees Plan — Fundamental Testing Completion

This plan splits the remaining fundamentals into three isolated tracks to be executed by separate LLM instances, each in its own git worktree. It includes shared guardrails and per‑track scopes with acceptance criteria. Do not cross scopes unless explicitly approved.

## General Instructions (All Instances)
- Branch/worktree:
  - Base: `main`. Create a dedicated worktree and branch per track (see section numbers below).
  - Example: `git worktree add ../website-testing-track-1 -b feat/track-1-a11y-policy`
  - Keep commits small and use Conventional Commits.
- Environment:
  - Node 18/20. Run `npm run setup` initially.
  - Use `node run-tests.js --site=<name>` for runs; responsive/functionality filters available.
  - Allure needs Java; otherwise rely on Playwright HTML report.
- Non-destructive testing:
  - Never submit forms to live sites; keep interactions read‑only.
  - Respect site configs; add per‑site flags rather than hardcoding.
- Lint/format: `npm run lint` (fix with `npm run lint:fix`), `npm run format` if needed.
- Artifacts: Do not commit `playwright-report/`, `allure-results/`, `allure-report/`, `test-results/`.
- Docs: Update only the sections/files listed in your track. Do not rewrite unrelated docs.
- DDEV note: If a target site uses `.ddev.site`, follow README’s optional preflight. Use `ddev` only when explicitly required for that site; this repo’s scripts run locally.
- Site configs: keep `testPages` aligned with live content; functionality/accessibility suites treat 4xx/5xx as failures. A sitemap-driven helper will be introduced separately when we need broader discovery.

## Track 1 — Accessibility Policy, Fail Gates, Allure Artifacts
Status: Completed
Scope
- Implement configurable accessibility fail policy and ignore lists.
- Improve reporting fidelity (attach violation summaries to Allure and console).

Changes
- Site config (new optional fields):
  - `a11yFailOn`: array of impacts, default `['critical','serious']`.
  - `a11yIgnoreRules`: array of rule IDs to ignore.
  - `a11yMode`: `'gate'` (default) fails after full run; `'audit'` logs without failing.
- Tests:
  - `tests/functionality.accessibility.spec.js`
  - `tests/responsive.a11y.spec.js`
  - Apply `a11yFailOn` to determine when to hard‑fail vs soft‑fail.
  - Filter out `a11yIgnoreRules` from `results.violations` before gating.
  - Attach an Allure text attachment per page/viewport: rule id, help URL, node count.
- Utils (if needed):
  - Minimal helper in `utils/test-helpers.js` to format/attach a11y results; avoid broad refactors.
- Docs:
  - `README.md` and `AGENTS.md`: Add the two new site config fields with brief examples.

Acceptance Criteria
- With default config, tests hard‑fail on any critical/serious violations; console and Allure include clear summaries. [DONE]
- Adding `a11yIgnoreRules` locally suppresses known false positives without code changes. [DONE]
- No behavior change for sites that don’t add these fields (sensible defaults apply). [DONE]

Out of Scope
- No runner flag changes; no schema validations beyond tolerant reads in loaders/tests.

## Track 2 — Core Runner Consistency: 404 Handling + Smoke Sampling
Status: Completed
Scope
- Resolve mismatch in 404 handling and ensure smoke profile truly samples a single page for responsive a11y.

Changes
- Navigation behavior:
  - `utils/test-helpers.js::safeNavigate(url, { allow404?: boolean })`
    - When `allow404=true`, do not throw on 404; return the response so tests can branch.
    - Preserve current behavior (throw on ≥400) when `allow404` is not set.
- Tests that explicitly allow 404 checks:
  - `tests/functionality.infrastructure.spec.js`
    - Where 404 is considered acceptable, call navigation with `{ allow404: true }` or adjust logic to avoid relying on exceptions for control‑flow. [DONE: availability + HTTP/content tests]
- Smoke sampling env:
  - `run-tests.js`: When `--profile=smoke`, set `process.env.SMOKE='1'` before invoking Playwright so responsive a11y tests sample 1 page. [DONE]

Acceptance Criteria
- Infrastructure test can log/skip on 404 without throwing, while all other navigations still fail fast on unexpected 4xx/5xx. [DONE]
- Smoke profile runs one page in responsive a11y (confirm via logs) without changing non‑smoke behavior. [DONE]

Out of Scope
- No additional site config fields; no Allure work here.

## Track 3 — Functionality & Performance: Link Checker, Resource Errors, Budgets
Status: In progress — link coverage aligned with live site; resource error surfacing and perf budgets still outstanding.

Scope
- Improve internal-link reliability; track resource errors; add site‑level performance budgets with assertions and reporting.

Changes
- Site config (new optional fields):
  - `linkCheck`: `{ maxPerPage?: number, timeoutMs?: number, followRedirects?: boolean, methodFallback?: boolean }` (defaults: `maxPerPage: 20`, `timeoutMs: 5000`, `followRedirects: true`, `methodFallback: true`).
  - `ignoreConsoleErrors`: string[] of substrings/regex sources to suppress known vendor noise.
  - `performanceBudgets`: `{ loadComplete?: number, domContentLoaded?: number, firstContentfulPaint?: number }` with reasonable defaults (e.g., 4000/2500/2000 ms) applied only if provided.
- Internal links:
  - `tests/functionality.links.spec.js`: Normalize hrefs (strip hash/query for dedupe), honor `maxPerPage` and `timeoutMs`. (HEAD fallback still TODO once budgeted.)
- Resource errors:
  - In `tests/functionality.interactive.spec.js` or a small new spec, collect `page.on('requestfailed')` and 4xx/5xx `response` events; report count and soft‑fail unless it exceeds a threshold (e.g., >0 images/css/js failures → soft‑fail, configurable later).
  - Expand console error ignore list to use `siteConfig.ignoreConsoleErrors` in addition to built‑ins.
- Performance budgets:
  - `tests/functionality.infrastructure.spec.js`: After metrics collection, assert against any provided `performanceBudgets` (soft‑fail by default). Attach per‑page metrics to console; optional Allure text attachment is OK.

 Acceptance Criteria
- Link test produces fewer false positives (deduped, fallback applied) and remains bounded by `maxPerPage` with a clear report. _(Dedupe done; fallback still open.)_
- Resource failures are surfaced in logs and soft-gated; console errors honor per-site ignores. _(Open)_
- When budgets are present, any exceedance is reported clearly and soft-failed; absent budgets leave behavior unchanged. _(Open)_

Out of Scope
- Lighthouse or third‑party perf tooling; keep within Playwright APIs.

---

## Worktree/Branch Naming (Per Track)
- 1: `feat/track-1-a11y-policy`
- 2: `fix/track-2-navigation-404-smoke`
- 3: `feat/track-3-links-perf-budgets`

## Submission Checklist (Each Track)
- Run: `npm run lint` and a representative test command (e.g., smoke/full for a local site or `static-smoke`).
- Include a brief summary in the PR description: scope, how to run, expected behavior, and example logs/report paths.
- No changes outside your track’s files except minimal doc updates listed above.
