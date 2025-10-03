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
  - JSON schema scaffolded but not yet adopted by other specs; a11y still uses legacy attachment format.
- Other specs (links, infrastructure, visual, etc.) continue to emit bespoke attachments and renderings.
- HTML reporter is schema-aware but currently only sees the legacy attachments from non-a11y specs.

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
  5. **Accessibility** (final migration after others proved out)
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
- Ensure Markdown export mirror matches HTML sections (pending once schema fully replaces HTML summaries).
- ✅ Promote schema summaries to the headline once emitted; otherwise keep visible via fallback cards.

### Phase 4 – Cleanup & enforcement

- Remove legacy summary builders once every spec uses the schema.
- Add validation/CI check to confirm schema payload present for core specs.
- Document schema in repo (`docs/report-schema.md`) with sample payloads and provide fixture JSON for test suites.

## Outstanding Work (as of 2025-10-03)

- Links/interactive/visual specs still emit only legacy attachments — migrate them to the schema helpers.
- Markdown export still relies on legacy HTML summaries; mirror the schema sections when the markdown pipeline is updated.
- Accessibility spec still emits legacy HTML alongside schema payloads; remove HTML once all downstream consumers confirm the schema layout.

## Next Steps

1. Migrate `tests/functionality.links.spec.js` to emit schema payloads (run + per-page) using the validator helper.
2. Repeat for interactive and visual specs, including image/diff metadata in the schema once visual migration begins.
3. Update the markdown export path to consume schema payloads so CLI/CI summaries match the HTML layout.
4. Retire legacy HTML/Markdown attachments after all core suites use the schema and downstream consumers approve the new layout.
