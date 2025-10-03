# Report Standardisation Plan

## Goals

- Deliver a consistent HTML report layout across all Playwright specs.
- Surface cross-browser (viewport) distinctions in a single summary.
- Keep developer diagnostics accessible but out of the main narrative.
- Minimise duplication of spec-specific rendering logic.

## Current State

- Accessibility suite now produces:
  - Shared summary layout (main summary → per-page accordion → debug deck).
  - Viewport-aware rule tables.
  - Emits schema payloads alongside the legacy attachments (HTML removal still pending).
- Infrastructure, links, interactive, and visual suites emit schema-formatted run/page payloads and no longer attach bespoke HTML/Markdown summaries.
- Remaining legacy attachments live only in the accessibility suite while we validate downstream consumption.
- HTML reporter ingests schema payloads from all core functionality suites; fallback attachments now cover only specs pending migration.

## Proposed schema

- `utils/report-schema.js` defines `codex.report.summary` (`run-summary`, `page-summary`, versioned).
- Fields:
  - `overview`: counts, gating threshold, extra metadata.
  - `ruleSnapshots`: array with `ruleId`, `impact`, `viewports`, `pages`, `nodes`, `wcagTags`, etc.
  - `perPage`: page URL, viewport, status, key metrics, notes.
- Expandable for visual data (`screenshots`, diff info) when visual regression migrates.

## Migration Plan

### Phase 1 – Extend HTML reporter (complete)

- [x] Collect schema-formatted summaries alongside legacy attachments.
- [x] Ship the shared run layout (headline cards → metadata → promoted summaries → debug deck accordion).

### Phase 2 – Spec adoption (in progress)

- Targets (rough order):
  1. **Infrastructure** (`tests/functionality.infrastructure.spec.js`) ✅ emits run/page schema payloads alongside legacy HTML.
  2. **Links**
  3. **Interactive**
  4. **Visual regression** (needs image handling override)
  5. **Accessibility** (schema payloads shipped; retire legacy attachments once other suites migrate)
- For each spec:
  - Emit `run-summary` & `page-summary` schema payloads.
  - Stop emitting bespoke HTML/Markdown blocks once schema path is validated.
  - Ensure tests still attach raw proof (screenshots, traces) as needed.
  - ✅ Validate payloads against the shared schema helper (`attachSchemaSummary` + validator) before attaching so the reporter can trust structure.

### Phase 3 – Reporter rendering (in progress)

- ✅ Teach `renderReportHtml` to prioritise schema payloads:
  - ✅ Aggregate run summaries with viewport-aware tables.
  - ✅ Render per-page accordions based on schema data (align with existing a11y layout).
  - ✅ Normalise duplicate per-viewport payloads so Chrome desktop vs. Chrome desktop large contribute a single aggregated row.
  - ✅ Fallback to legacy attachments until all specs migrate.
- ✅ Markdown export now reuses schema payloads to mirror the HTML sections.
- ✅ Promote schema summaries to the headline once emitted; otherwise keep visible via fallback cards.

### Phase 4 – Cleanup & enforcement

- Remove legacy summary builders once every spec uses the schema.
- Add validation/CI check to confirm schema payload present for core specs.
- Document schema in repo (`docs/report-schema.md`) with sample payloads and provide fixture JSON for test suites.

## Outstanding Work (as of 2025-10-03)

- Accessibility suite still emits legacy HTML alongside schema payloads; retire the HTML once downstream consumers confirm the new layout.
- Validate downstream tooling against the schema-driven Markdown report before deleting any remaining legacy attachments.

## Next Steps

1. Finalise the accessibility suite migration by removing its legacy HTML once the schema layout is signed off.
2. Exercise the new Markdown report within CLI/CI flows and capture any tooling updates that depend on the schema structure.
3. Refresh developer documentation to highlight the schema-driven summaries and the new Markdown artefact pipeline.
