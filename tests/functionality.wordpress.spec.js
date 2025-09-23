const { test } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');
const {
  setupTestPage,
  teardownTestPage,
  safeNavigate,
  waitForPageStability,
} = require('../utils/test-helpers');
const { attachSummary, escapeHtml } = require('../utils/allure-utils');

const formatPluginSummaryHtml = (rows, detectedPlugins) => {
  const tableRows = rows
    .map(
      (entry) => `
        <tr class="${entry.plugins.length ? 'status-ok' : 'status-redirect'}">
          <td><code>${escapeHtml(entry.page)}</code></td>
          <td>${entry.plugins.length ? escapeHtml(entry.plugins.join(', ')) : '—'}</td>
        </tr>
      `
    )
    .join('');

  const detectedHtml = detectedPlugins.length
    ? `<p>Detected plugins: <strong>${escapeHtml(detectedPlugins.join(', '))}</strong></p>`
    : '<p>No common plugins detected.</p>';

  return `
    <section class="summary-report summary-wordpress">
      <h3>Plugin detection (sample pages)</h3>
      ${detectedHtml}
      <table>
        <thead><tr><th>Page</th><th>Plugins</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </section>
  `;
};

const formatPluginSummaryMarkdown = (rows, detectedPlugins) => {
  const header = ['# Plugin detection summary', '', detectedPlugins.length ? `Detected plugins: **${detectedPlugins.join(', ')}**` : 'No common plugins detected.', '', '| Page | Plugins |', '| --- | --- |'];
  const tableRows = rows.map((entry) => `| \`${entry.page}\` | ${entry.plugins.join(', ') || '—'} |`);
  return header.concat(tableRows).join('\n');
};

const formatThemeSummaryHtml = (summary) => {
  const rows = summary.details
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(entry.label)}</td>
          <td>${escapeHtml(entry.value)}</td>
        </tr>
      `
    )
    .join('');

  return `
    <section class="summary-report summary-wordpress">
      <h3>Theme analysis</h3>
      <table>
        <thead><tr><th>Check</th><th>Result</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
};

const formatThemeSummaryMarkdown = (summary) => {
  const header = ['# Theme analysis summary', '', '| Check | Result |', '| --- | --- |'];
  const rows = summary.details.map((entry) => `| ${entry.label} | ${entry.value} |`);
  return header.concat(rows).join('\n');
};

test.describe('Functionality: WordPress Specific', () => {
  let siteConfig;
  let errorContext;

  test.beforeEach(async ({ page, context }) => {
    const siteName = process.env.SITE_NAME;
    if (!siteName) throw new Error('SITE_NAME environment variable is required');
    siteConfig = SiteLoader.loadSite(siteName);
    SiteLoader.validateSiteConfig(siteConfig);
    errorContext = await setupTestPage(page, context);
  });

  test.afterEach(async ({ page, context }) => {
    await teardownTestPage(page, context, errorContext);
  });

  test('Plugin compatibility detection (sample pages)', async ({ page }) => {
    test.setTimeout(300000);
    const detectedSet = new Set();
    const pageSummaries = [];
    const pages = process.env.SMOKE
      ? (Array.isArray(siteConfig.testPages) && siteConfig.testPages.includes('/'))
        ? ['/']
        : [siteConfig.testPages[0]]
      : siteConfig.testPages.slice(0, 3);
    for (const testPage of pages) {
      await test.step(`Detecting plugins on: ${testPage}`, async () => {
        const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        if (response.status() !== 200) return;
        await waitForPageStability(page);
        const plugins = new Set();
        if ((await page.locator('.wpcf7-form, .wpcf7').count()) > 0) plugins.add('Contact Form 7');
        if ((await page.locator('.gform_wrapper').count()) > 0) plugins.add('Gravity Forms');
        if ((await page.locator('.wpforms-form').count()) > 0) plugins.add('WPForms');
        const yoastMeta = await page.locator('meta[name="generator"][content*="Yoast"]').count();
        if (yoastMeta > 0) plugins.add('Yoast SEO');
        plugins.forEach((plugin) => detectedSet.add(plugin));
        pageSummaries.push({ page: testPage, plugins: Array.from(plugins) });
      });
    }
    const detected = Array.from(detectedSet);
    if (detected.length > 0) console.log(`📊 Detected plugins: ${detected.join(', ')}`);
    else console.log('ℹ️  No common plugins detected');

    const summaryHtml = formatPluginSummaryHtml(pageSummaries, detected);
    const summaryMarkdown = formatPluginSummaryMarkdown(pageSummaries, detected);
    await attachSummary({
      baseName: 'wordpress-plugin-summary',
      htmlBody: summaryHtml,
      markdown: summaryMarkdown,
      setDescription: true,
    });
  });

  test('Theme elements and type detection', async ({ page }) => {
    test.setTimeout(300000);
    const summary = { details: [] };
    await test.step('Analyzing theme structure', async () => {
      const response = await safeNavigate(page, siteConfig.baseUrl);
      if (response.status() !== 200) {
        summary.details.push({ label: 'Response status', value: `${response.status()}` });
        return;
      }
      summary.details.push({ label: 'Response status', value: '200 OK' });
      await waitForPageStability(page);
      const isBlockTheme = await page.locator('.wp-site-blocks, .is-layout-').isVisible();
      const hasClassic = await page.locator('.widget, .sidebar').isVisible();
      if (isBlockTheme) {
        const blocks = await page.locator('[class*="wp-block-"]').count();
        console.log(`✅ Block theme detected; ${blocks} block elements`);
        summary.details.push({ label: 'Theme type', value: `Block theme (${blocks} block elements)` });
      } else if (hasClassic) {
        const widgets = await page.locator('.widget').count();
        console.log(`✅ Classic theme detected; ${widgets} widgets`);
        summary.details.push({ label: 'Theme type', value: `Classic theme (${widgets} widgets)` });
      } else {
        console.log('ℹ️  Theme type could not be determined');
        summary.details.push({ label: 'Theme type', value: 'Unknown' });
      }
      const mobileMenuExists = await page.locator('.mobile-menu, .hamburger, .menu-toggle').isVisible();
      summary.details.push({
        label: 'Mobile navigation',
        value: mobileMenuExists ? 'Detected' : 'Not detected',
      });
      console.log('✅ Theme analysis completed');
    });

    if (summary.details.length === 0) {
      summary.details.push({ label: 'Theme analysis', value: 'No data collected' });
    }
    const summaryHtml = formatThemeSummaryHtml(summary);
    const summaryMarkdown = formatThemeSummaryMarkdown(summary);
    await attachSummary({
      baseName: 'wordpress-theme-summary',
      htmlBody: summaryHtml,
      markdown: summaryMarkdown,
      setDescription: true,
    });
  });
});
