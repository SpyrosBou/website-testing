# Why We Gate On Impact (Not Just WCAG Level)

We often get asked why the accessibility suites fail builds based on axe impact (critical/serious by default) instead of every violation tagged to a WCAG level. Here’s the rationale we follow:

- **Impact reflects user harm.** Axe’s severity ratings are tuned from thousands of audits; `critical`/`serious` map to defects that block or significantly impair assistive-technology users. `moderate`/`minor` usually surface edge cases or optional guidance where the experience still works. CI gates stay actionable when they align with user harm.
- **WCAG tagging is coarse.** The same rule can satisfy WCAG 2.1 AA while still being a warning-level issue. For instance, a `color-contrast` failure is tagged AA but axe may mark it moderate if the contrast only dips in certain content states. Treating every tag equally causes noisy breakages that teams quickly ignore.
- **The configuration contract matters.** The runner already exposes `a11yFailOn` so teams can tighten or relax gates. Automatically switching to “all WCAG violations fail” breaks that contract and disrupts teams who intentionally downgraded noisy rules.
- **We still report WCAG context.** The updated reports now show WCAG A/AA/AAA badges beside each violation. Product managers and auditors can tie findings back to compliance requirements without conflating that with build gates.

**Recommended workflow:** gate builds on `critical`/`serious` by default (or whatever `a11yFailOn` specifies), inspect the report for remaining WCAG-tagged advisories, and raise follow-up tasks for moderate/minor issues that still require attention for full conformance.
