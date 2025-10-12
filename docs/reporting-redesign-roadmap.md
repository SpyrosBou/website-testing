# Reporting Redesign Roadmap

The mock HTML report now reflects the target layout and copy we want to ship (single-column suite cards, schema-driven panels for every spec, and inline visual diff previews). To mirror this in the generated Playwright reports we need to land the following updates in the real reporter:

## Implementation Tasks

1. **Reporter templates**
   - Update `utils/report-templates.js` to consume the new schema payloads for forms, keyboard, landmarks, links, interactive smoke, infrastructure, responsive, and visual specs.
   - Ensure each template recognises `summary-page--fail|warn|ok` classes and renders the same HTML structure shown in `docs/mocks/full-run-report.html`.

2. **Shared styling**
   - Move the refined CSS from `docs/mocks/mock-styling.css` into the production stylesheet under `report/assets`.
   - Confirm that suite overview cards stack vertically and that visual diff previews use the `.visual-previews` grid.

3. **Schema payload consistency**
   - Verify every spec populates `gating`, `warnings`, `advisories`, `notes`, and artifact metadata exactly as the mock assumes.
   - Add unit tests around `attachSchemaSummary` helpers to catch missing fields (e.g., ensure visual artifacts include baseline/current/diff names).

4. **Summary tab wiring**
   - Update the summary card metrics and suite roll-ups to pull data from the new payloads (gating counts, advisories, total diffs).
   - Confirm the radio navigation + panel switching still works once the layout is swapped in.

5. **QA checklist**
   - Run `node run-tests.js --site=<example>` and compare `reports/run-*/report.html` with `docs/mocks/full-run-report.html`.
   - Test across desktop/mobile to ensure stacked suites and accordion controls behave correctly.
   - Capture before/after screenshots for all spec panels and attach to the PR.

Track progress in the main reporting board and close this roadmap once the live report matches the approved mock.
