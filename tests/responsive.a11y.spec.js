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

const formatResponsiveA11ySummaryHtml = (entries, viewportName) => {
  if (!entries.length) return '';

  const sections = entries
    .map((entry) => {
      const rows = (entry.filtered || [])
        .slice(0, 12)
        .map((v) => {
          const nodes = (v.nodes || [])
            .slice(0, 5)
            .map((n) => (n.target && n.target[0]) || n.html || 'node')
            .map((t) => `<code>${escapeHtml(String(t))}</code>`)
            .join('<br />');
          return `
            <tr class="impact-${escapeHtml((v.impact || 'unknown').toLowerCase())}">
              <td>${escapeHtml(v.impact || 'unknown')}</td>
              <td>${escapeHtml(v.id)}</td>
              <td>${v.nodes?.length || 0}</td>
              <td><a href="${escapeHtml(v.helpUrl || '#')}" target="_blank" rel="noopener noreferrer">rule docs</a></td>
              <td>${nodes || 'n/a'}</td>
            </tr>
          `;
        })
        .join('');

      return `
        <section class="summary-report summary-a11y page-card">
          <div class="page-card__header">
            <h3>${escapeHtml(entry.page)} (${escapeHtml(viewportName)})</h3>
            <span class="status-pill error">${entry.filtered.length} issue(s)</span>
          </div>
          <div class="page-card__table">
            <table>
              <thead><tr><th>Impact</th><th>Rule</th><th>Nodes</th><th>Help</th><th>Sample targets</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </section>
      `;
    })
    .join('\n');

  return `
    <section class="summary-report summary-a11y">
      <h2>Responsive accessibility summary — ${escapeHtml(viewportName)}</h2>
      <p>Detected on <strong>${entries.length}</strong> page(s) for this viewport.</p>
      <p class="legend"><span class="badge badge-critical">Critical</span><span class="badge badge-serious">Serious</span></p>
    </section>
    ${sections}
  `;
};

const formatResponsiveA11ySummaryMarkdown = (entries, viewportName) => {
  if (!entries.length) return '';
  const header = [
    `# Responsive accessibility summary — ${viewportName}`,
    '',
    '| Page | Violations |',
    '| --- | --- |',
  ];
  const rows = entries.map((e) => `| \`${e.page}\` | ${e.filtered.length} |`);
  return header.concat(rows).join('\n');
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
      test.setTimeout(300000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

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
            const results = await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
              .analyze();

            const failOn = Array.isArray(siteConfig.a11yFailOn)
              ? siteConfig.a11yFailOn
              : ['critical', 'serious'];
            const ignoreRules = Array.isArray(siteConfig.a11yIgnoreRules)
              ? siteConfig.a11yIgnoreRules
              : [];

            const filtered = (results.violations || [])
              .filter((v) => failOn.includes(v.impact))
              .filter((v) => !ignoreRules.includes(v.id));

            if (filtered.length > 0) {
              perViewportEntries.push({ page: testPage, filtered });
              aggregatedViolations.push({
                page: testPage,
                viewport: viewportName,
                count: filtered.length,
                failOn,
                entries: filtered,
              });
              const message = `❌ ${filtered.length} accessibility violations (fail-on: ${failOn.join(
                ', '
              )}) on ${testPage} (${viewportName})`;
              if (a11yMode === 'audit') {
                console.warn(message);
              } else {
                console.error(message);
              }
            } else {
              console.log(
                `✅ No ${failOn.join('/')} accessibility violations on ${testPage} (${viewportName})`
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
        const html = formatResponsiveA11ySummaryHtml(perViewportEntries, viewportName);
        const md = formatResponsiveA11ySummaryMarkdown(perViewportEntries, viewportName);
        await attachSummary({
          baseName: `responsive-a11y-${viewportName}-summary`,
          htmlBody: html,
          markdown: md,
          setDescription: false,
        });
      }

      if (aggregatedViolations.length > 0) {
        const count = aggregatedViolations.reduce((s, e) => s + e.count, 0);
        if (a11yMode === 'audit') {
          console.warn(`ℹ️ Accessibility audit summary (no failure): ${count} issues across ${aggregatedViolations.length} page(s) for ${viewportName}.`);
        } else {
          expect(count, `Accessibility violations detected for ${viewportName}. See Allure attachment 'responsive-a11y-${viewportName}-summary'`).toBe(0);
        }
      }
    });
  });
});
