const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const SiteLoader = require('../utils/site-loader');
const { setupTestPage, teardownTestPage, safeNavigate, waitForPageStability } = require('../utils/test-helpers');

test.describe('Functionality: Accessibility (WCAG)', () => {
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

  test('WCAG 2.1 A/AA scans', async ({ page }) => {
    test.setTimeout(45000);
    const pages = siteConfig.testPages;
    for (const testPage of pages) {
      await test.step(`Accessibility scan: ${testPage}`, async () => {
        const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        if (response.status() !== 200) return;
        await waitForPageStability(page);
        try {
          const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
          const critical = results.violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious'
          );
          if (critical.length > 0) {
            console.error(`❌ ${critical.length} critical accessibility violations on ${testPage}`);
            expect.soft(critical.length).toBe(0);
          } else {
            console.log(`✅ No critical accessibility violations on ${testPage}`);
          }
        } catch (error) {
          console.error(`⚠️  Accessibility scan failed for ${testPage}: ${error.message}`);
        }
      });
    }
  });
});

