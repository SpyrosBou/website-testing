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
  1. **Infrastructure** (`tests/functionality.infrastructure.spec.js`)
  2. **Links**
  3. **Interactive**
  4. **Visual regression** (needs image handling override)
  5. **Accessibility** (final migration after others proved out)
- For each spec:
  - Emit `run-summary` & `page-summary` schema payloads.
  - Stop emitting bespoke HTML/Markdown blocks once schema path is validated.
  - Ensure tests still attach raw proof (screenshots, traces) as needed.
  - Validate payloads against the shared JSON Schema helper before attaching so the reporter can trust structure.

### Phase 3 – Reporter rendering

- Teach `renderReportHtml` to prioritise schema payloads:
  - Aggregate run summaries with viewport-aware tables.
  - Render per-page accordions based on schema data (align with existing a11y layout).
  - Normalise duplicate per-viewport payloads so Chrome desktop vs. Chrome desktop large contribute a single aggregated row.
  - Fallback to legacy attachments until all specs migrate.
- Ensure Markdown export mirror matches HTML sections.
- Promote schema summaries to the headline once emitted; otherwise keep visible via fallback cards.

### Phase 4 – Cleanup & enforcement

- Remove legacy summary builders once every spec uses the schema.
- Add validation/CI check to confirm schema payload present for core specs.
- Document schema in repo (`docs/report-schema.md`) with sample payloads and provide fixture JSON for test suites.

## Outstanding Work (as of 2025-10-03)

- HTML reporter still rendering legacy accessibility attachments; needs schema rendering once data available.
- Non-accessibility specs untouched; still output bespoke attachments.
- Schema validation tooling (lint/test job plus sample payloads) must land before first non-a11y migration.
- Accessibility summary still duplicated per viewport (Chrome/Chrome Desktop); aggregation logic to be implemented during schema rendering.

## Next Steps

1. Produce JSON Schema (or zod/io-ts equivalent) plus fixtures and add a validation step to the reporter unit tests/build scripts.
2. Implement schema emission in `tests/functionality.infrastructure.spec.js` and gate it behind validation.
3. Update reporter to render schema payload when present (while maintaining legacy fallback) and collapse duplicate viewport rows.
4. Migrate remaining suites; verify reports after each migration.
5. Final pass: migrate accessibility spec, remove legacy paths, update documentation with schema reference examples.
