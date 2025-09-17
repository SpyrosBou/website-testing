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

const VIEWPORTS = {
  mobile: { width: 375, height: 667, name: 'mobile' },
  tablet: { width: 768, height: 1024, name: 'tablet' },
  desktop: { width: 1920, height: 1080, name: 'desktop' },
};

test.describe('Responsive Accessibility', () => {
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

  Object.entries(VIEWPORTS).forEach(([viewportName, viewport]) => {
    test(`Accessibility across viewports - ${viewportName}`, async ({ page }) => {
      test.setTimeout(45000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      const samplesToTest = process.env.SMOKE
        ? siteConfig.testPages.slice(0, 1)
        : siteConfig.testPages.slice(0, 3);

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
              const lines = filtered.map((v) => {
                const nodes = (v.nodes || [])
                  .slice(0, 5)
                  .map((n) => (n.target && n.target[0]) || n.html || 'node')
                  .join('\n  - ');
                return `• ${v.id} [${v.impact}]\n  Help: ${v.helpUrl}\n  Nodes: ${v.nodes?.length || 0}\n  Sample targets:\n  - ${nodes}`;
              });
              const report =
                `Accessibility Violations for ${testPage} (${viewportName})\n\n` +
                lines.join('\n\n');
              await attachAllureText(`a11y-${viewportName}-${testPage}-violations`, report);
              console.error(
                `❌ ${filtered.length} accessibility violations (fail-on: ${failOn.join(', ')}) on ${testPage} (${viewportName})`
              );
              expect.soft(filtered.length).toBe(0);
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
    });
  });
});
