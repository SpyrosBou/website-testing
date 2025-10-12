# Reporting Redesign Roadmap

The mock HTML report is now approved and locked. All future work happens on the feature branch that carries the production reporter changes; keep this document updated alongside that branch.

## Phase 0 · Prep
- Take a fresh copy of `docs/mocks/full-run-report.html` and `docs/mocks/mock-styling.css` into the branch for quick comparison.
- Snapshot the current reporter output (`reports/run-*/report.html`) so we can diff structure and CSS after each phase.
- File tracking tickets for every spec panel so QA can sign off individually once they match the mock.

## Phase 1 · Schema + Data Audit
- Inventory every spec payload produced by the test runner (accessibility/a11y, responsive, functionality variants, visual).
- Ensure each payload exposes `gating`, `warnings`, `advisories`, `notes`, and artifact metadata (baseline/current/diff for visual).
- Document any gaps in `utils/test-helpers.js` or spec fixtures and patch them before template work starts.
- Add backstop unit coverage around `attachSchemaSummary` (and related helpers) for required fields and naming.
- Keep `docs/report-schema-inventory.md` current so engineering/QA can cross-check payload expectations while migrating the reporter.

## Phase 2 · Template Migration
- Rebuild the summary tab in `utils/report-templates.js` so suite cards render vertically with the new copy, gating totals, and delta text.
- Port individual spec panels to the schema-driven structure shown in the mock, including consistent wording for “Gating WCAG violations”.
- Surface visual regression deltas, previews, and notes exactly where the mock displays them (including `font-weight: 600` for inline deltas).
- Confirm the radio navigation + panel switching behaviour still works once templates are swapped.

## Phase 3 · Styling Integration
- Move CSS from `docs/mocks/mock-styling.css` into the production stylesheet under `report/assets` (or equivalent bundler entry).
- Remove any older palettes (dark blues, warn backgrounds) so fail/pass/neutral hues match the mock across suites.
- Verify typography updates: Inter as the base font, headings and titles limited to `font-weight: 500`.
- Reduce padding/radius for spec containers as shown in the mock and ensure summary-page backgrounds change with pass/fail state.

## Phase 4 · Interaction & Accessibility Pass
- Re-check keyboard focus, tab order, and ARIA labelling for the new stacked layout and accordions.
- Ensure visual diff previews are accessible (alt text, focusable controls for toggling/magnifying).
- Confirm that “notes” cells read clearly with example production content, not placeholder authoring copy.

## Phase 5 · QA & Verification
- Run `node run-tests.js --site=<example>` for representative sites; capture `reports/run-*/data/run.json` for payload verification.
- Compare generated HTML against the mock using diff tooling and spot-check responsive breakpoints.
- Take full-page screenshots of each suite tab (desktop + mobile widths) and attach them to the implementation PR.
- Log any discrepancies in the tracking board; do not merge until the live report visually matches the mock.

Track progress in the reporting board and close this roadmap when production reports render identically to `docs/mocks/full-run-report.html`.
