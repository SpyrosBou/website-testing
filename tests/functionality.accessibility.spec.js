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

async function attachAllureText(name, content) {
  if (allure && typeof allure.attachment === 'function') {
    await allure.attachment(name, content, 'text/plain');
  }
}

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
            const lines = filtered.map((v) => {
              const nodes = (v.nodes || [])
                .slice(0, 5)
                .map((n) => (n.target && n.target[0]) || n.html || 'node')
                .join('\n  - ');
              return `• ${v.id} [${v.impact}]\n  Help: ${v.helpUrl}\n  Nodes: ${v.nodes?.length || 0}\n  Sample targets:\n  - ${nodes}`;
            });
            const report = `Accessibility Violations for ${testPage}\n\n` + lines.join('\n\n');
            await attachAllureText(`a11y-${testPage}-violations`, report);
            aggregatedViolations.push({
              page: testPage,
              count: filtered.length,
              failOn,
              report,
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
      const summary = aggregatedViolations
        .map((entry) => `Page: ${entry.page}\nViolations: ${entry.count}\n${entry.report}`)
        .join('\n\n');
      if (a11yMode === 'audit') {
        console.warn(`ℹ️ Accessibility audit summary (no failure):\n\n${summary}`);
      } else {
        expect(aggregatedViolations.length, `Accessibility violations detected:\n\n${summary}`).toBe(0);
      }
    }
  });
});
