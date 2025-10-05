# Browser Teardown Alignment Plan

## Objective
- Rely on Playwright’s native fixture lifecycle to own browser/context/page disposal.
- Remove noisy "Browser disconnected unexpectedly" logs that originate from expected shutdowns.
- Keep rich diagnostics for true crashes so reporters and CI can still triage flake root causes.

## Current Findings
- `setupTestPage` registers a fresh `browser.on('disconnected')` listener for every test, so normal worker shutdowns spam the console.
- `setupTestPage` / `teardownTestPage` already avoid manual `page.close()` calls, but there is no guardrail preventing future reintroductions.
- The helpers and shared fixtures do not maintain active-test bookkeeping, so we cannot distinguish expected disconnects from real crashes.
- Crash diagnostics (`debugBrowserState`, `ErrorContext`) are available yet tied to the noisy listener, making signal-to-noise poor for CI triage.

## Guiding Principles
- **Single owner:** Playwright should own lifecycle teardown; helpers stick to in-page cleanup and logging.
- **Minimal listeners:** Attach at most one disconnect listener per browser instance; reuse it across tests through a lightweight registry.
- **Actionable logging:** Emit crash output only when a test is still running; offer opt-in debug traces for expected shutdowns.
- **Observable but quiet:** Preserve hooks (`debugBrowserState`, error context) without reintroducing console noise.

## Workstreams & Milestones

### 1. Baseline Audit (Day 0–1)
- Inventory manual lifecycle calls via `rg "page.close"` / `rg "context.close"`; current sweep returns 0 matches (keep the check documented for regression monitoring).
- Confirm every spec wraps helpers in `beforeEach` / `afterEach` to avoid orphaned pages.
- Capture current console output from a smoke run (`node run-tests.js --site=<site> --functionality --pages=1 --project=Chrome`) to quantify noise.
- Deliverable: shared checklist mapping suites → required cleanup changes.

### 2. Helper Refactor (Day 2–3)
- Update `teardownTestPage` to focus on DOM cleanup and error-context logging; keep disposal in Playwright control.
- Add `createBrowserDisconnectMonitor` (likely in `utils/test-helpers.js` or a sibling util) that:
  - Tracks active test counts per `browser` via `WeakMap`.
  - Exposes `registerTestStart` / `registerTestEnd` helpers.
  - Installs a single `browser.on('disconnected')` handler the first time a browser is seen.
- Update `setupTestPage` (and fallback hooks) to call the monitor helpers rather than attaching ad-hoc listeners.
- Introduce a lint or unit safety net that fails CI if direct `page.close()` / `context.close()` calls reappear.

### 3. Runner Integration (Day 3)
- Wire the new monitor into shared fixtures (e.g., Playwright `test.beforeEach`/`test.afterEach` wrappers) so counts decrement even if `setupTestPage` throws.
- Add an opt-in debug flag (`process.env.DEBUG_BROWSER_TEARDOWN`) that logs when the active-test count hits zero.
- Ensure multi-project runs share the monitor without double-registering listeners.

### 4. Verification & Hardening (Day 4)
- Run `npx playwright test tests/a11y.audit.wcag.spec.js` and `tests/responsive.layout.structure.spec.js` locally; confirm logs are clean.
- Force a crash (e.g., `page._delegate._session._connection.dispose()` inside a guarded test) to confirm the warning still appears.
- Validate Playwright artifacts/reports still include crash diagnostics.
- Document before/after console transcripts to confirm success criteria.

### 5. Documentation & Rollout (Day 5)
- Update `tests/CLAUDE.md`, `utils/CLAUDE.md`, and onboarding notes to describe the new lifecycle expectations.
- Note the new debug flag in `README.md` or `report.md` troubleshooting sections.
- Socialize the migration checklist with the broader team; gather feedback after the first CI run post-change.

## Implementation Blueprint

### A. Browser Disconnect Monitor Helper
- Create `utils/browser-disconnect-monitor.js` exporting a factory:
  - `createBrowserDisconnectMonitor({ debugFlagEnv = 'DEBUG_BROWSER_TEARDOWN' })`.
  - Internals: `const browserState = new WeakMap();` where each entry stores `{ activeTests: 0, listenerAttached: false }`.
  - `registerTestStart(browser, testInfo)` increments `activeTests` and lazily attaches `browser.on('disconnected', handler)`.
  - `registerTestEnd(browser, testInfo)` decrements the counter (no-op when the browser already died); when counter hits `0`, emit debug output if the env flag is truthy.
  - Disconnect handler: when triggered and `activeTests > 0`, log the failure (`console.error('💥 Browser disconnected unexpectedly', {...})`), and optionally include last known test ids via a rolling buffer.
  - Export `getActiveCount(browser)` for assertions in unit tests or debugging utilities.

```js
// Sketch only; final implementation should add TypeScript-style JSDoc
function createBrowserDisconnectMonitor({ debugFlagEnv = 'DEBUG_BROWSER_TEARDOWN' } = {}) {
  const browserState = new WeakMap();
  const debugEnabled = normaliseEnvBoolean(process.env[debugFlagEnv]);

  function ensureState(browser) {
    if (!browserState.has(browser)) {
      browserState.set(browser, { activeTests: 0 });
      browser.on('disconnected', () => {
        const state = browserState.get(browser);
        if (state?.activeTests > 0) {
          console.error('💥 Browser disconnected unexpectedly', {
            activeTests: state.activeTests,
            timestamp: new Date().toISOString(),
          });
        } else if (debugEnabled) {
          console.debug('[teardown] Browser disconnected after all tests completed');
        }
      });
    }
    return browserState.get(browser);
  }

  return {
    registerTestStart(browser) {
      if (!browser) return;
      ensureState(browser).activeTests += 1;
    },
    registerTestEnd(browser) {
      if (!browser) return;
      const state = ensureState(browser);
      state.activeTests = Math.max(0, state.activeTests - 1);
      if (debugEnabled && state.activeTests === 0) {
        console.debug('[teardown] Active test count reached zero');
      }
    },
    getActiveCount(browser) {
      return browserState.get(browser)?.activeTests ?? 0;
    },
  };
}
```

### B. Hooking Helpers Into Playwright Lifecycle
- Extend `utils/test-helpers.js` to instantiate a singleton monitor (e.g., `const browserMonitor = createBrowserDisconnectMonitor();`).
- Update `setupTestPage(page, context, testInfo)` to call `browserMonitor.registerTestStart(context.browser(), testInfo)` before registering crash handlers.
- Update `teardownTestPage(page, context, errorContext, testInfo)` (or a sibling `finalizeTest` helper) to call `browserMonitor.registerTestEnd` in a `finally` block to guarantee decrementing even when cleanup fails.
- Add defensive checks for scenarios where `context.browser()` may throw (e.g., already disconnected) and ensure the monitor handles undefined gracefully.
- Remove the current per-test `browser.on('disconnected')` listener; rely solely on the monitor for logging.

### C. Playwright Test Fixture Integration
- In `tests/` shared fixtures (where `test.describe.configure` or `test.beforeEach` already wrap `setupTestPage` / `teardownTestPage`), ensure the new start/end hooks are invoked even if `setupTestPage` fails early:
  - Wrap `setupTestPage` invocation in `try/catch`; in the `catch`, immediately call `registerTestEnd` before rethrowing.
  - For specs that bypass helpers (none today, but guard for future), document the requirement to call `registerTestStart/End` manually or create a higher-level fixture in `utils/test-fixtures.js`.

### D. Lint/Verification Guardrails
- Add a lightweight Node-based lint script (`npm run lint:teardown`) that fails when `page.close(` or `context.close(` appears outside helper definitions.
- Optionally introduce unit coverage under `fixtures/` using Jest or Node’s test runner to validate monitor behaviour (increment/decrement, debug flag).
- Extend CI smoke suite to include the new lint target so regressions surface immediately.

## Success Criteria & Exit Checklist
- No `Browser disconnected unexpectedly` log appears during standard smoke or responsive runs.
- Genuine crashes still emit a single warning plus `debugBrowserState` artifacts.
- Specs no longer call `page.close()` / `context.close()` manually (guardrails prevent regressions).
- `setupTestPage` / `teardownTestPage` remain the only per-test helpers touching lifecycle logic.
- Documentation reflects the new teardown flow and debug tooling.

## Risks & Mitigations
- **Missed manual closes:** Enforce the new lint script in CI until the monitor is fully rolled out.
- **Refactor regressions:** Introduce targeted unit tests for the monitor helper and add Playwright e2e smoke to CI.
- **Multi-worker edge cases:** Validate with `--project=all` runs; ensure the monitor uses `WeakMap` to avoid memory leaks.

## Open Questions / Follow-ups
- Should we expose a reporter hook to surface "browser crashed during test X" in HTML reports?
- Do we need to scrub existing recorded videos when crashes happen to avoid stale artifacts?
- Would centralizing lifecycle logic in a Playwright test fixture file reduce helper complexity further?

## Status Tracking
- Owner: QA Automation Guild
- Current stage: Workstream 1 in progress
- Next checkpoint: Share audit results and proposed refactor diff for review by end of Day 1.
