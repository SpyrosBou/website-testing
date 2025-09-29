# Accessibility Testing Review and Action Plan

This report consolidates findings from a review of the current accessibility testing approach and the `sites/agilitas-live.json` configuration, with a concrete, prioritized plan to improve coverage and align behavior with intended goals.

## Executive Summary

- Your a11y foundation is solid: axe-core integration, impact-based gating (critical/serious), multi-viewport execution, and rich report summaries are all in place and well-implemented.
- Two immediate corrections:
  - Remove unintended restriction to WCAG-tagged rules. Today both a11y specs call `withTags(WCAG_AXE_TAGS)`, limiting checks to WCAG-tagged rules. You intended to run the full ruleset and only annotate WCAG tags when present.
  - Ensure the homepage (`/`) is always included in `testPages` (and discovery output). The homepage is critical for catching global UI patterns.
- To reach “industry standard” automated a11y coverage, add focused, low-flake checks for keyboard-only navigation, reduced-motion support, reflow/zoom, dynamic UI patterns, and iframe inventory, while keeping axe as the primary engine.

## Corrections & Clarifications

### 1) WCAG Tag Scoping (Run Full Rules; Annotate WCAG When Present)

- Current behavior (unintended): both specs restrict scans to WCAG-tagged rules via `withTags(WCAG_AXE_TAGS)`:
  - `tests/functionality.accessibility.spec.js:~600`
  - `tests/responsive.a11y.spec.js:~220`
- Desired behavior: run the full axe ruleset (no `.withTags(...)`), gate failures by impact (`a11yFailOn`, default critical/serious), and display WCAG labels where available.

Actions:
- Remove `.withTags(WCAG_AXE_TAGS)` from both specs so `.analyze()` runs the full ruleset.
- Keep severity gating logic unchanged. Continue to compute a “gating” bucket (impact ∈ `a11yFailOn`) and split out non-gating advisory results.
- Reporting enhancement: add a third bucket for “Best-practice advisories (no WCAG tag)” to ensure non-WCAG rules surface clearly without conflating them with WCAG-mapped items.
- Optional: introduce a runner flag or site config switch for compliance-only runs (e.g., `a11yTagsMode: 'all' | 'wcagOnly'`) to support audits where teams want WCAG-only views without altering gating defaults.

Success Criteria:
- Full-rule scans produce equal or more total findings; gating counts stay focused on impact.
- Report a11y cards show three buckets: Gating, WCAG advisories, Best-practice advisories.

### 2) Homepage Coverage (Mandatory `/'`)

- Observation: `sites/agilitas-live.json` omits `'/'` from `testPages`.
- Why it happens: WordPress sitemaps often exclude the root path; curated lists sometimes focus on posts/pages. This is an easy oversight.

Actions:
- Add `'/'` to `testPages` in all site configs.
- Add a runner safeguard that, if `testPages` does not include `'/'`, logs a warning and (optionally) injects `'/'` for the current run.
- In sitemap discovery, post-process the merged list to ensure `'/'` is present before persisting.

Success Criteria:
- All specs always include the homepage; discovery runs never drop it.

## Coverage Improvements (High-Value Additions)

These augment axe-based checks with targeted, deterministic validations commonly expected in mature suites.

### A. Keyboard-Only Navigation

Goals:
- Verify visible focus indicator on interactive elements.
- Detect keyboard traps and ensure skip link appears/works.
- Ensure focus moves into, and is contained within, off-canvas menus/modals; returns correctly when dismissed.

Implementation (new spec: `tests/a11y.keyboard.spec.js`):
- Programmatically TAB through a limited set of focusables; assert focus visibility and page responsiveness.
- Trigger common components (menu, modal, accordion, tabs) via keyboard (Enter/Space/Arrows) and validate ARIA state changes.
- Surface WCAG 2.1.1, 2.1.2, 2.4.1, 2.4.3, 2.4.7 references alongside the report summary so stakeholders know which criteria were exercised.

### B. Reflow and Zoom

Goals:
- At ~320 CSS px (or equivalent), no horizontal scrolling for primary content areas; content remains readable and functional (WCAG 1.4.10, 1.4.4).

Implementation (extend responsive structure spec or new `tests/a11y.reflow.spec.js`):
- Set viewport width to ≈320px; check `document.scrollingElement.scrollWidth <= viewportWidth + tolerance` and verify main content landmarks are accessible.
- Report WCAG 1.4.4 / 1.4.10 coverage directly in the custom summary.

### C. Reduced Motion Support

Goals:
- Respect `prefers-reduced-motion: reduce`; animations should be suppressed without breaking flow (WCAG 2.3.3).

Implementation (new spec or an a11y pass toggle):
- `page.emulateMedia({ reducedMotion: 'reduce' })` then validate key interactions (menus, accordions) function without animated dependencies.
- Highlight relevance to WCAG 2.2.2 and 2.3.3 in the attached summary.

### D. Dynamic UI Patterns

Goals:
- Verify ARIA states/roles and keyboard support for menus, accordions, tabs, modals.

Implementation (extend keyboard spec):
- For each pattern found, assert correct roles (`menu`, `tablist`, `dialog`), focus transitions, and aria-expanded/selected updates.

### E. Forms Deep Checks

Goals:
- Semantic label association, required semantics, inline error announcement (ARIA live), error summary links back to fields.

Implementation (new spec: `tests/a11y.forms.spec.js`):
- Validates accessible names for configured form fields, then submits the form blank to confirm aria-invalid, inline error copy, and global alerts surface appropriately.
- Annotate report output with WCAG 1.3.1, 3.3.1–3.3.3, and 4.1.2 references.

### F. Accessibility Tree & Structure

Goals:
- Validate basic structure: one `h1`, landmark presence, reasonable heading progression.

Implementation (new spec: `tests/a11y.structure.spec.js`):
- Inspects landmarks + heading outline per page, gating on missing `main`/H1 and flagging heading-level skips as advisories.
- Add WCAG 1.3.1, 2.4.1, 2.4.6, 2.4.10 references to the summary for quick traceability.

### G. Iframes & Embeds

Goals:
- Enumerate iframes; run axe in same-origin frames; annotate cross-origin frames and validate accessible alternatives (titles/labels).

Implementation:
- Collect iframes; attempt frame.content(); when cross-origin, record a manual-check item in the report with the frame URL and context.
- Surface WCAG 1.3.1 and 4.1.2 coverage badges in the summary so reviewers understand the compliance linkage.

## Execution Profiles & Scaling

- Daytime/CI default:
  - Gating: `critical/serious` only.
  - `tests/responsive.a11y.spec.js` samples the first three pages per viewport by default (override via config/env when needed).
- Nightly:
  - Full rule scans across all pages for responsive a11y (or rotate through pages), all browsers if desired.

Actions:
- [x] Add config key `a11yResponsiveSampleSize` (number or `'all'`) to control responsive a11y sampling.
- [x] Add runner CLI flags/env overrides (`--a11y-tags`, `--a11y-sample`, `A11Y_KEYBOARD_STEPS`) so teams can tune coverage without code changes.

## Reporting Enhancements

- Report summaries:
  - [x] Add “Best-practice advisories (no WCAG tag)” section under a11y cards.
  - [x] Include an iframe inventory table per page with scan coverage notes (same-origin vs cross-origin).
  - [x] Add badges/notes for keyboard, reduced motion, and reflow checks per page/viewport.

## Risks & Mitigations

- Expect more advisory findings after removing tag filtering; gating should remain stable because it is severity-based.
- To manage noise, keep using `a11yIgnoreRules` in site configs and refine per-site as needed.
- Recent follow-ups completed:
  - Reduced-motion gate now downgrades plain `matchMedia` mismatches to advisories and only fails on infinite or ≥5 s motion that persists under `prefers-reduced-motion`.
  - Focus-indicator checks use before/after screenshots (pixel diff) instead of CSS heuristics, dramatically reducing false positives.
  - Skip-link detection now insists on landmark targets and verifies the link presents when focused.
  - Keyboard traversal depth is configurable (`A11Y_KEYBOARD_STEPS`), and the audit includes a reverse `Shift+Tab` sanity check.
- WCAG-level findings (contrast, critical keyboard traps, etc.) are never candidates for whitelisting. Every gating failure should be triaged as an accessibility defect and resolved in the product code or content before the run is considered green.

### Outstanding risks

- Live site currently fails serious `color-contrast` checks (homepage and `/working-with-us/`). These blocks need design fixes before the suite will pass again.
- Keyboard suite reports missing visible focus on several footer/contact elements—verify on the site and adjust styles as needed.

## Milestones & Ownership

Phase 1 (1–2 days)
- [x] Remove `.withTags(...)` from both a11y specs; add “best-practice advisory” bucket.
- [x] Enforce homepage coverage: add `'/'` to all site configs; add runner safeguard and discovery post-processing.
- [x] Make responsive a11y sample size configurable.
- [x] Update documentation to clarify intent and profiles.

Phase 2 (3–5 days)
- [x] Add keyboard-only spec with common component coverage and focus assertions.
- [x] Add reduced-motion checks and reflow checks.
- [x] Add iframe inventory and same-origin frame scanning.

Phase 3 (as needed)
- Deepen form validation checks and a11y-tree assertions.
- Add nightly profile toggles and reporting badges for new checks.

## Success Criteria

- Reports show three a11y buckets with counts; homepage is tested in all suites.
- Keyboard, reduced-motion, and reflow checks present per page with clear pass/fail signals.
- Nightly runs demonstrate broader coverage without flake spikes; daytime runs stay fast and reliable.

## Validation Plan

- Run `node run-tests.js --site=agilitas-live` (daytime profile). Confirm:
  - Homepage tested; a11y summaries include gating + advisory buckets; no `.withTags` restriction.
- Run a nightly job with full responsive a11y coverage and `--a11y-tags=all`. Compare counts vs WCAG-only for insight.
- Review iframe inventory notes and manually verify cross-origin embeds as needed.

## Notes Specific to Agilitas

- Add `'/'` to `sites/agilitas-live.json:testPages` and consider adding any pages where global components (banners, cookie notices, modals) consistently appear.
- If the live site uses third-party embeds (e.g., video, social), prioritize the iframe inventory addition to capture coverage gaps in the report for manual follow-up.

---

Prepared to start with Phase 1 unless you prefer a different ordering. The changes are backward-compatible and keep the gating contract intact while surfacing a broader set of actionable advisories.
