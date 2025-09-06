# Review of Today’s Commits

Scope: Reviewed all commits since midnight, cross-checked against codex-plan.md goals, ran lint for style issues, and assessed DRY and separation of concerns across runner, tests, and CI.

Commits covered (newest → oldest):
- 8d546a2 test: split functionality suite; runner globs; docs
- 90a4727 test: split responsive suite; add profiles; smoke limiting
- 1c48089 test: visual thresholds + masks; per-site overrides
- de40728 docs: lint/format commands in AGENTS.md
- 388619e chore: ESLint flat config; fix minor lint; adjust utils
- aa1ac89 chore: cross-platform cleanup; simplify example-site
- 51234f9 build: add ESLint/Prettier + CI lint; add smoke site config
- 8af9963 feat: optional ddev preflight; CI triggers; docs
- cb08b79 ci: add PR smoke workflow; arg forwarding; allure dep
- 75d84d3 chore: remove interactive mode; cleanup docs; add codex-plan

Overall assessment
- Direction: Strong, cohesive progress toward goals in codex-plan.md (split suites, smoke profile, stability, CI and lint). Splitting monolithic specs into focused files improves maintainability and SoC.
- Quality: Code is functional, but formatting and small inconsistencies remain. Lint reports many Prettier warnings. A few structural/documentation drifts exist after splitting specs.
- CI: Workflow currently has a YAML structural error that will break execution. Needs a fix.

Key findings and recommended fixes

1) CI workflow YAML is invalid (must fix)
- Problem: In `.github/workflows/tests.yml`, `concurrency` is declared between steps, and two steps (`Upload Playwright HTML report`, `Lint`) appear at the job level instead of inside `steps`. This will not parse in GitHub Actions.
- Fix: Move `concurrency` to the job level (sibling to `runs-on`, `strategy`, `env`, `steps`), and keep all step entries under `steps`. Also ensure lint runs before tests if that’s the intended gate.
- Suggested structure (excerpt):
  jobs:
    smoke:
      runs-on: ubuntu-latest
      concurrency:
        group: smoke-${{ github.ref }}
        cancel-in-progress: true
      strategy: { matrix: { node-version: [18.x, 20.x] } }
      env:
        SITE: ${{ github.event.inputs.site || vars.SMOKE_SITE }}
      steps:
        - name: Checkout
          uses: actions/checkout@v4
        - name: Setup Node.js ${{ matrix.node-version }}
          uses: actions/setup-node@v4
          with: { node-version: ${{ matrix.node-version }}, cache: npm }
        - name: Install dependencies
          run: npm ci
        - name: Lint
          run: npm run lint
        - name: Install Playwright browsers
          run: npx playwright install --with-deps
        - name: Run smoke tests (skips if SITE not set)
          if: env.SITE != ''
          run: node run-tests.js --site=${{ env.SITE }} --profile=smoke
        - name: Skip notice (SITE not set)
          if: env.SITE == ''
          run: echo "Skipping smoke tests. Set SMOKE_SITE or pass 'site' input."
        - name: Upload Playwright HTML report
          if: always()
          uses: actions/upload-artifact@v4
          with: { name: playwright-report-${{ matrix.node-version }}, path: playwright-report, if-no-files-found: ignore }

2) Lint and formatting
- Ran: `npm run lint` → 478 warnings (no errors). Most are Prettier formatting issues (e.g., `playwright.config.js`) and several `no-unused-vars` on catch bindings named `_`.
- Fixes:
  - Run `npm run format` and then `npm run lint:fix` to resolve most warnings.
  - Consider adjusting ESLint rule to suppress unused catch params named `_`:
    - Update `eslint.config.js` rule: `['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }]` for `no-unused-vars`.
  - Keep lint scope limited to core JS as you’ve set, or introduce a separate eslint config override for tests if you want to gradually enforce style there (optionally with `eslint-plugin-playwright`).

3) Test runner cleanup and cross-platform consistency
- Problem: `utils/test-runner.js` uses `execSync('rm -rf ...')` in `cleanAllureResults`, which is not cross-platform.
- Fix: Reuse the new cross-platform `scripts/cleanup.js` or replace with Node APIs (`fs.rmSync(path, { recursive: true, force: true })`). This aligns with aa1ac89.

4) Baseline update command drift after responsive split
- Problem:
  - `TestRunner.updateBaselines` still references `tests/responsive.spec.js` (removed by 90a4727).
  - `codex-plan.md` still references monolithic specs in the Architecture Snapshot and the old snapshot update command.
- Fix:
  - Update `updateBaselines` to point to `tests/responsive.visual.spec.js` or a glob (e.g., `tests/responsive.visual.spec.js`).
  - Update `codex-plan.md` Architecture Snapshot to list the split files:
    - Responsive: `responsive.structure.spec.js`, `responsive.visual.spec.js`, `responsive.a11y.spec.js`
    - Functionality: `functionality.infrastructure.spec.js`, `functionality.links.spec.js`, `functionality.interactive.spec.js`, `functionality.wordpress.spec.js`, `functionality.accessibility.spec.js`
  - Update the snapshot update instruction in `codex-plan.md` to: `npx playwright test tests/responsive.visual.spec.js --update-snapshots` (AGENTS.md already has this).

5) DRY opportunities in tests
- Duplicated constants and setup across responsive specs:
  - `VIEWPORTS` is repeated across `responsive.structure.spec.js`, `responsive.visual.spec.js`, and `responsive.a11y.spec.js`.
  - Repeated `beforeEach` scaffolding for `siteConfig`/context setup.
- Recommended refactors (non-breaking):
  - Introduce `utils/test-constants.js` (e.g., `VIEWPORTS`, default thresholds, common selectors).
  - Add a tiny `utils/suite-setup.js` helper to standardize `beforeEach`/`afterEach` that returns `{ siteConfig, errorContext }` to reduce duplication.
  - Extract shared axe run into `utils/a11y.js` (e.g., `runAxeScan(page, tags=['wcag2a','wcag2aa','wcag21aa'])`).
- Benefit: Clearer separation, less repeated logic, easier global changes.

6) Separation of concerns and layering
- Preflight in runner:
  - The ddev preflight is useful but couples environment management with the test runner. Consider extracting to `utils/preflight.js` and calling it from the runner to isolate concerns and ease testing/mocking.
- Visual configuration:
  - You already support `siteConfig.visualThresholds` and `dynamicMasks`. Consider documenting `dynamicMasks` in README under Site Configuration to make usage discoverable.
- WordPress-specific checks:
  - `responsive.structure.spec.js` mixes raw selectors with page objects. Consider adding a few helpers to `wordpress-page-objects.js` (e.g., `hasHeader()`, `hasFooter()`, `hasNav()`), then use them across functionality and responsive structure tests. This will make “critical elements” verification consistent.

7) Visual test severity policy
- Current behavior: Visual diffs log a warning and continue. That’s appropriate for PR smoke runs.
- Suggestion: In a `nightly` profile, consider failing the test on visual diff (or raising severity) to surface regressions proactively. This can be toggled via an env var/profile flag inside the visual spec before/around the `toHaveScreenshot` call.

8) Documentation sync
- `codex-plan.md` needs a small refresh (Architecture Snapshot and snapshot command) to reflect the split specs.
- Optional: There are lingering references to monolithic `*.spec.js` in `CLAUDE.md` and `tests/CLAUDE.md`. Consider updating or annotating them as legacy to avoid confusion for new contributors.
- README mostly reflects the split already; ensure the “site-specific HTML report path” example matches actual behavior (Playwright HTML report is at `playwright-report/index.html`). The rest of the README already references the correct report path.

What’s working well
- Splitting responsive and functionality suites by concern significantly improves readability and maintenance.
- Smoke profile (`--profile=smoke`) is implemented cleanly via env `SMOKE` passthrough and page limiting in specs.
- Per-site visual thresholds and dynamic masks reduce false positives in visual diffs; good alignment to real-world needs.
- Cross-platform cleanup script is a solid improvement over shell commands.
- ESLint flat config and limiting lint scope to core runtime code is a pragmatic step that avoids noisy false positives in browser evaluation contexts.

Prioritized next steps
1. Fix `.github/workflows/tests.yml` structure (as above) so CI runs.
2. Run `npm run format` then `npm run lint:fix` (and add `caughtErrorsIgnorePattern: '^_'` to reduce catch-binding noise).
3. Make `cleanAllureResults` cross-platform (call `scripts/cleanup.js` or `fs.rmSync`).
4. Update `TestRunner.updateBaselines` and `codex-plan.md` to reflect split responsive specs.
5. Optional but valuable: factor shared test constants/setup and consider extracting runner preflight and visual/a11y helpers for DRY and SoC.

If you want, I can apply these changes in a follow-up pass and validate CI.

