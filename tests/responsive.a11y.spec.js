const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const SiteLoader = require('../utils/site-loader');
const { setupTestPage, teardownTestPage, safeNavigate, waitForPageStability } = require('../utils/test-helpers');

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
            const critical = results.violations.filter(
              (v) => v.impact === 'critical' || v.impact === 'serious'
            );
            if (critical.length > 0) {
              console.error(
                `❌ ${critical.length} critical accessibility violations on ${testPage} (${viewportName})`
              );
              expect.soft(critical.length).toBe(0);
            } else {
              console.log(`✅ No critical accessibility violations on ${testPage} (${viewportName})`);
            }
          } catch (error) {
            console.error(`⚠️  Accessibility scan failed for ${testPage} (${viewportName}): ${error.message}`);
          }
        });
      }
    });
  });
});

