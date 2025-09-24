const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const SiteLoader = require('../utils/site-loader');
const {
  setupTestPage,
  teardownTestPage,
  safeNavigate,
  waitForPageStability,
} = require('../utils/test-helpers');
const { attachSummary, escapeHtml } = require('../utils/allure-utils');
const {
  extractWcagLevels,
  violationHasWcagCoverage,
  formatWcagLabels,
} = require('../utils/a11y-utils');

const renderResponsiveViolationTable = (violations = []) => {
  if (!Array.isArray(violations) || violations.length === 0) return '';

  const rows = violations
    .slice(0, 12)
    .map((violation) => {
      const nodes = (violation.nodes || [])
        .slice(0, 5)
        .map((node) => (node.target && node.target[0]) || node.html || 'node')
        .map((target) => `<code>${escapeHtml(String(target))}</code>`)
        .join('<br />');
      const impact = violation.impact || 'unknown';
      const wcagBadges = formatWcagLabels(extractWcagLevels(violation.tags || []), {
        asHtmlBadges: true,
      });
      return `
        <tr class="impact-${escapeHtml(impact.toLowerCase())}">
          <td>${escapeHtml(impact)}</td>
          <td>${escapeHtml(violation.id)}</td>
          <td>${violation.nodes?.length || 0}</td>
          <td><a href="${escapeHtml(violation.helpUrl || '#')}" target="_blank" rel="noopener noreferrer">rule docs</a></td>
          <td>${wcagBadges}</td>
          <td>${nodes || 'n/a'}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="page-card__table">
      <table>
        <thead><tr><th>Impact</th><th>Rule</th><th>Nodes</th><th>Help</th><th>WCAG level</th><th>Sample targets</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
};

const formatResponsiveA11ySummaryHtml = (entries, viewportName, failOnLabel) => {
  if (!entries.length) return '';

  const gatingPages = entries.filter((entry) => Array.isArray(entry.gating) && entry.gating.length > 0).length;
  const advisoryPages = entries.filter((entry) => Array.isArray(entry.advisory) && entry.advisory.length > 0).length;
  const bestPracticePages = entries.filter(
    (entry) => Array.isArray(entry.bestPractice) && entry.bestPractice.length > 0
  ).length;
  const gatingSummary =
    gatingPages > 0
      ? `Detected gating issues on <strong>${gatingPages}</strong> page(s) for this viewport.`
      : 'No gating issues detected for this viewport.';

  const sections = entries
    .map((entry) => {
      const gatingContent = entry.gating?.length
        ? `<h4>Gating issues (${entry.gating.length})</h4>${renderResponsiveViolationTable(entry.gating)}`
        : `<p class="details">No gating issues detected.</p>`;

      const advisoryContent = entry.advisory?.length
        ? `<h4>Non-gating WCAG findings (${entry.advisory.length})</h4>${renderResponsiveViolationTable(
            entry.advisory
          )}`
        : '';

      const bestPracticeContent = entry.bestPractice?.length
        ? `<h4>Best-practice advisories (no WCAG tag) (${entry.bestPractice.length})</h4>${renderResponsiveViolationTable(
            entry.bestPractice
          )}`
        : '';

      const pillClass = entry.gating?.length
        ? 'error'
        : entry.advisory?.length
          ? 'warning'
          : entry.bestPractice?.length
            ? 'info'
            : 'success';
      const pillText = entry.gating?.length
        ? `${entry.gating.length} gating issue(s)`
        : entry.advisory?.length
          ? 'WCAG advisories'
          : entry.bestPractice?.length
            ? 'Best-practice advisories'
            : 'Clear';

      return `
        <section class="summary-report summary-a11y page-card">
          <div class="page-card__header">
            <h3>${escapeHtml(entry.page)} (${escapeHtml(viewportName)})</h3>
            <span class="status-pill ${pillClass}">${pillText}</span>
          </div>
          ${gatingContent}
          ${advisoryContent}
          ${bestPracticeContent}
        </section>
      `;
    })
    .join('\n');

  return `
    <section class="summary-report summary-a11y">
      <h2>Responsive accessibility summary — ${escapeHtml(viewportName)}</h2>
      <p>${gatingSummary}</p>
      <p class="details">Gating threshold: ${escapeHtml(failOnLabel)}</p>
      ${
        advisoryPages > 0
          ? `<p class="details">Non-gating WCAG findings surfaced on ${advisoryPages} page(s).</p>`
          : ''
      }
      ${
        bestPracticePages > 0
          ? `<p class="details">Best-practice advisories (no WCAG tag) surfaced on ${bestPracticePages} page(s).</p>`
          : ''
      }
      <p class="legend"><span class="badge badge-critical">Critical</span><span class="badge badge-serious">Serious</span><span class="badge badge-wcag">WCAG A/AA/AAA</span></p>
    </section>
    ${sections}
  `;
};

const formatResponsiveA11ySummaryMarkdown = (entries, viewportName, failOnLabel) => {
  if (!entries.length) return '';

  const gatingPages = entries.filter((entry) => Array.isArray(entry.gating) && entry.gating.length > 0).length;
  const advisoryPages = entries.filter((entry) => Array.isArray(entry.advisory) && entry.advisory.length > 0).length;
  const bestPracticePages = entries.filter(
    (entry) => Array.isArray(entry.bestPractice) && entry.bestPractice.length > 0
  ).length;

  const lines = [
    `# Responsive accessibility summary — ${viewportName}`,
    '',
    `- Gating threshold: ${failOnLabel}`,
    `- Pages with gating issues: ${gatingPages}`,
    `- Pages with non-gating WCAG findings: ${advisoryPages}`,
    `- Pages with best-practice advisories (no WCAG tag): ${bestPracticePages}`,
    '',
    '| Page | Gating violations | Non-gating WCAG findings | Best-practice advisories |',
    '| --- | --- | --- | --- |',
    ...entries.map(
      (entry) =>
        `| \`${entry.page}\` | ${entry.gating?.length || 0} | ${entry.advisory?.length || 0} | ${entry.bestPractice?.length || 0} |`
    ),
  ];

  entries.forEach((entry) => {
    const gatingRules = Array.from(new Set((entry.gating || []).map((violation) => violation.id)));
    const advisoryRules = Array.from(new Set((entry.advisory || []).map((violation) => violation.id)));
    const bestPracticeRules = Array.from(
      new Set((entry.bestPractice || []).map((violation) => violation.id))
    );

    if (gatingRules.length || advisoryRules.length || bestPracticeRules.length) {
      lines.push('');
      lines.push(
        `- \`${entry.page}\`: gating=[${gatingRules.join(', ') || 'none'}], non-gating=[${
          advisoryRules.join(', ') || 'none'
        }], best-practice=[${bestPracticeRules.join(', ') || 'none'}]`
      );
    }
  });

  return lines.join('\n');
};

const VIEWPORTS = {
  mobile: { width: 375, height: 667, name: 'mobile' },
  tablet: { width: 768, height: 1024, name: 'tablet' },
  desktop: { width: 1920, height: 1080, name: 'desktop' },
};

test.describe('Responsive Accessibility', () => {
  let siteConfig;
  let errorContext;
  let a11yMode;

  test.beforeEach(async ({ page, context }) => {
    const siteName = process.env.SITE_NAME;
    if (!siteName) throw new Error('SITE_NAME environment variable is required');
    siteConfig = SiteLoader.loadSite(siteName);
    SiteLoader.validateSiteConfig(siteConfig);
    errorContext = await setupTestPage(page, context);
    a11yMode = siteConfig.a11yMode === 'audit' ? 'audit' : 'gate';
  });

  test.afterEach(async ({ page, context }) => {
    await teardownTestPage(page, context, errorContext);
  });

  Object.entries(VIEWPORTS).forEach(([viewportName, viewport]) => {
    test(`Accessibility across viewports - ${viewportName}`, async ({ page }) => {
      test.setTimeout(7200000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      const failOn = Array.isArray(siteConfig.a11yFailOn)
        ? siteConfig.a11yFailOn
        : ['critical', 'serious'];
      const failOnSet = new Set(failOn.map((impact) => String(impact).toLowerCase()));
      const failOnLabel = failOn.map((impact) => String(impact).toUpperCase()).join('/');

      const samplesToTest = process.env.SMOKE
        ? siteConfig.testPages.slice(0, 1)
        : siteConfig.testPages.slice(0, 3);

      const aggregatedViolations = [];
      const perViewportEntries = [];
      for (const testPage of samplesToTest) {
        await test.step(`Accessibility ${viewportName}: ${testPage}`, async () => {
          const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
          if (response.status() !== 200) return;
          await waitForPageStability(page);

          try {
            const results = await new AxeBuilder({ page }).analyze();
            const ignoreRules = Array.isArray(siteConfig.a11yIgnoreRules)
              ? siteConfig.a11yIgnoreRules
              : [];

            const relevantViolations = (results.violations || []).filter(
              (violation) => !ignoreRules.includes(violation.id)
            );

            const gatingViolations = relevantViolations.filter((violation) =>
              failOnSet.has(String(violation.impact || '').toLowerCase())
            );

            const advisoryViolations = relevantViolations.filter(
              (violation) =>
                !failOnSet.has(String(violation.impact || '').toLowerCase()) &&
                violationHasWcagCoverage(violation)
            );

            const bestPracticeViolations = relevantViolations.filter(
              (violation) =>
                !failOnSet.has(String(violation.impact || '').toLowerCase()) &&
                !violationHasWcagCoverage(violation)
            );

            if (
              gatingViolations.length > 0 ||
              advisoryViolations.length > 0 ||
              bestPracticeViolations.length > 0
            ) {
              perViewportEntries.push({
                page: testPage,
                gating: gatingViolations,
                advisory: advisoryViolations,
                bestPractice: bestPracticeViolations,
              });
            }

            if (gatingViolations.length > 0) {
              aggregatedViolations.push({
                page: testPage,
                viewport: viewportName,
                count: gatingViolations.length,
                entries: gatingViolations,
              });
              const message = `❌ ${gatingViolations.length} accessibility violations (gating: ${failOnLabel}) on ${testPage} (${viewportName})`;
              if (a11yMode === 'audit') {
                console.warn(message);
              } else {
                console.error(message);
              }
            } else {
              console.log(
                `✅ No ${failOnLabel} accessibility violations on ${testPage} (${viewportName})`
              );
            }

            if (advisoryViolations.length > 0) {
              console.warn(
                `ℹ️  ${advisoryViolations.length} non-gating WCAG finding(s) on ${testPage} (${viewportName})`
              );
            }

            if (bestPracticeViolations.length > 0) {
              console.warn(
                `ℹ️  ${bestPracticeViolations.length} best-practice advisory finding(s) (no WCAG tag) on ${testPage} (${viewportName})`
              );
            }
          } catch (error) {
            console.error(
              `⚠️  Accessibility scan failed for ${testPage} (${viewportName}): ${error.message}`
            );
          }
        });
      }

      if (perViewportEntries.length > 0) {
        const html = formatResponsiveA11ySummaryHtml(perViewportEntries, viewportName, failOnLabel);
        const md = formatResponsiveA11ySummaryMarkdown(perViewportEntries, viewportName, failOnLabel);
        await attachSummary({
          baseName: `responsive-a11y-${viewportName}-summary`,
          htmlBody: html,
          markdown: md,
          setDescription: true,
        });
      }

      if (aggregatedViolations.length > 0) {
        const count = aggregatedViolations.reduce((s, e) => s + e.count, 0);
        const summaryMessage = `Accessibility violations detected for ${viewportName}. See Allure attachment 'responsive-a11y-${viewportName}-summary' (gating: ${failOnLabel}).`;
        if (a11yMode === 'audit') {
          console.warn(`ℹ️ Accessibility audit summary (no failure): ${count} issue(s) across ${aggregatedViolations.length} page(s) for ${viewportName}.`);
        } else {
          expect(count, summaryMessage).toBe(0);
        }
      }
    });
  });
});
