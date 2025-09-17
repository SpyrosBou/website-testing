const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const { allure } = require('allure-playwright');
const SiteLoader = require('../utils/site-loader');
const {
  setupTestPage,
  teardownTestPage,
  safeNavigate,
  waitForPageStability,
} = require('../utils/test-helpers');

async function attachAllureText(name, content, type = 'text/plain') {
  if (allure && typeof allure.attachment === 'function') {
    await allure.attachment(name, content, type);
  }
}

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatRuleSummary = (violations) => {
  const aggregate = new Map();
  for (const { page, entries } of violations) {
    for (const violation of entries) {
      const key = violation.id;
      if (!aggregate.has(key)) {
        aggregate.set(key, {
          id: violation.id,
          impact: violation.impact,
          helpUrl: violation.helpUrl,
          pages: new Set(),
          totalNodes: 0,
        });
      }
      const entry = aggregate.get(key);
      entry.pages.add(page);
      entry.totalNodes += violation.nodes?.length || 0;
    }
  }

  if (aggregate.size === 0) return null;

  const rows = Array.from(aggregate.values()).map(
    (item) =>
      `| ${item.impact || 'unknown'} | ${item.id} | ${item.pages.size} | ${item.totalNodes} | [link](${item.helpUrl}) |`
  );

  return (
    '### Violation roll-up by rule\n\n' +
    '| Impact | Rule | Pages | Nodes | Help |\n| --- | --- | --- | --- | --- |\n' +
    rows.join('\n') +
    '\n'
  );
};

const formatPageMarkdown = (page, violations) => {
  if (!violations.length) return '';
  const rows = violations.map((violation) => {
    const nodes = (violation.nodes || [])
      .slice(0, 5)
      .map((node) => (node.target && node.target[0]) || node.html || 'node')
      .map((target) => `\`${target}\``)
      .join('<br />');
    return `| ${violation.impact || 'unknown'} | ${violation.id} | ${violation.nodes?.length || 0} | [link](${violation.helpUrl}) | ${nodes || 'n/a'} |`;
  });

  return (
    `### ${page} (${violations.length} issues)\n\n` +
    '| Impact | Rule | Nodes | Help | Sample targets |\n| --- | --- | --- | --- | --- |\n' +
    rows.join('\n') +
    '\n'
  );
};

const formatRuleSummaryHtml = (violations) => {
  const aggregate = new Map();
  for (const { page, entries } of violations) {
    for (const violation of entries) {
      const key = violation.id;
      if (!aggregate.has(key)) {
        aggregate.set(key, {
          id: violation.id,
          impact: violation.impact,
          helpUrl: violation.helpUrl,
          pages: new Set(),
          totalNodes: 0,
        });
      }
      const entry = aggregate.get(key);
      entry.pages.add(page);
      entry.totalNodes += violation.nodes?.length || 0;
    }
  }

  if (aggregate.size === 0) return '';

  const rows = Array.from(aggregate.values())
    .map((item) => {
      const impact = item.impact || 'unknown';
      const className = impactClassName(impact);
      return `<tr class="${className}"><td>${escapeHtml(impact)}</td><td>${escapeHtml(item.id)}</td><td>${item.pages.size}</td><td>${item.totalNodes}</td><td><a href="${escapeHtml(
        item.helpUrl || '#'
      )}" target="_blank" rel="noopener noreferrer">rule docs</a></td></tr>`;
    })
    .join('');

  return `
    <section>
      <h3>Rule summary (${aggregate.size} unique rules)</h3>
      <table class="a11y-summary">
        <thead>
          <tr><th>Impact</th><th>Rule</th><th>Pages</th><th>Nodes</th><th>Help</th></tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </section>
  `;
};

const formatPageHtml = (page, violations) => {
  if (!violations.length) return '';
  const rows = violations
    .map((violation) => {
      const nodes = (violation.nodes || [])
        .slice(0, 5)
        .map((node) =>
          `<code>${escapeHtml((node.target && node.target[0]) || node.html || 'node')}</code>`
        )
        .join('<br />');
      const impact = violation.impact || 'unknown';
      const className = impactClassName(impact);
      return `
        <tr class="${className}">
          <td>${escapeHtml(impact)}</td>
          <td>${escapeHtml(violation.id)}</td>
          <td>${violation.nodes?.length || 0}</td>
          <td><a href="${escapeHtml(violation.helpUrl || '#')}" target="_blank" rel="noopener noreferrer">rule docs</a></td>
          <td>${nodes || 'n/a'}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <style>
      table.a11y-summary { border-collapse: collapse; width: 100%; margin: 0.5rem 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      table.a11y-summary th, table.a11y-summary td { border: 1px solid #d0d7de; padding: 6px 8px; text-align: left; }
      table.a11y-summary th { background: #f6f8fa; }
      tr.impact-critical td { background: #ffe5e5; }
      tr.impact-serious td { background: #fff4ce; }
    </style>
    <details open>
      <summary><strong>${escapeHtml(page)}</strong> &mdash; ${violations.length} issue(s)</summary>
      <table class="a11y-summary">
        <thead>
          <tr><th>Impact</th><th>Rule</th><th>Nodes</th><th>Help</th><th>Sample targets</th></tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </details>
  `;
};

const impactClassName = (impact) => {
  if (!impact) return 'impact-unknown';
  return `impact-${impact.toLowerCase()}`;
};

test.describe('Functionality: Accessibility (WCAG)', () => {
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

  test('WCAG 2.1 A/AA scans', async ({ page }) => {
    test.setTimeout(45000);
    const pages = siteConfig.testPages;
    const aggregatedViolations = [];
    for (const testPage of pages) {
      await test.step(`Accessibility scan: ${testPage}`, async () => {
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
            const htmlReport = formatPageHtml(testPage, filtered);
            await attachAllureText(`a11y-${testPage}-violations`, htmlReport, 'text/html');
            aggregatedViolations.push({
              page: testPage,
              count: filtered.length,
              failOn,
              entries: filtered,
              html: htmlReport,
            });
            const message = `❌ ${filtered.length} accessibility violations (fail-on: ${failOn.join(
              ', '
            )}) on ${testPage}`;
            if (a11yMode === 'audit') {
              console.warn(message);
            } else {
              console.error(message);
            }
          } else {
            console.log(`✅ No ${failOn.join('/')} accessibility violations on ${testPage}`);
          }
        } catch (error) {
          console.error(`⚠️  Accessibility scan failed for ${testPage}: ${error.message}`);
        }
      });
    }

    if (aggregatedViolations.length > 0) {
      const rollupMarkdown = formatRuleSummary(aggregatedViolations) || '';
      const summaryMarkdown =
        '# Accessibility violations summary\n\n' +
        rollupMarkdown +
        aggregatedViolations
          .map((entry) => formatPageMarkdown(entry.page, entry.entries))
          .join('\n');

      const ruleSummaryHtml = formatRuleSummaryHtml(aggregatedViolations);
      const pagesHtml = aggregatedViolations.map((entry) => entry.html).join('\n');
      const summaryHtml = `
        <style>
          .a11y-report { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
          .a11y-report h2 { margin-bottom: 0.25rem; }
          .a11y-report section { margin: 0.75rem 0; }
          table.a11y-summary { border-collapse: collapse; width: 100%; margin: 0.5rem 0; }
          table.a11y-summary th, table.a11y-summary td { border: 1px solid #d0d7de; padding: 6px 8px; text-align: left; }
          table.a11y-summary th { background: #f6f8fa; }
          tr.impact-critical td { background: #ffe5e5; }
          tr.impact-serious td { background: #fff4ce; }
          details { margin: 0.5rem 0; }
          details > summary { cursor: pointer; }
          .legend { margin: 0.5rem 0; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; margin-right: 0.4rem; border: 1px solid #d0d7de; }
          .badge-critical { background: #ffe5e5; }
          .badge-serious { background: #fff4ce; }
        </style>
        <section class="a11y-report">
          <h2>Accessibility violations summary</h2>
          <p>Detected across <strong>${aggregatedViolations.length}</strong> page(s). Review the tables below for the impacted rules and sample targets.</p>
          <p class="legend"><span class="badge badge-critical">Critical</span><span class="badge badge-serious">Serious</span></p>
          ${ruleSummaryHtml}
          <section>
            <h3>Per-page breakdown</h3>
            ${pagesHtml}
          </section>
        </section>
      `;

      await attachAllureText('a11y-summary.html', summaryHtml, 'text/html');
      await attachAllureText('a11y-summary.md', summaryMarkdown, 'text/markdown');

      if (typeof allure?.descriptionHtml === 'function') {
        allure.descriptionHtml(summaryHtml);
      }

      if (a11yMode === 'audit') {
        console.warn('ℹ️ Accessibility audit summary available in Allure report (description pane).');
      } else {
        expect(
          aggregatedViolations.length,
          'Accessibility violations detected. See the Allure description for a structured breakdown.'
        ).toBe(0);
      }
    }
  });
});
