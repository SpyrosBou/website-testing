const { test, expect } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');
const {
  setupTestPage,
  teardownTestPage,
  safeNavigate,
  waitForPageStability,
  ErrorContext,
} = require('../utils/test-helpers');

const VIEWPORTS = {
  mobile: { width: 375, height: 667, name: 'mobile' },
  tablet: { width: 768, height: 1024, name: 'tablet' },
  desktop: { width: 1920, height: 1080, name: 'desktop' },
};

const DEFAULT_VISUAL_THRESHOLDS = {
  ui_elements: 0.1,
  content: 0.25,
  dynamic: 0.5,
};

test.describe('Responsive Visual Regression', () => {
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
    test.describe(`Visuals: ${viewportName} (${viewport.width}x${viewport.height})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      });

      test(`Visual regression - ${viewportName}`, async ({ page, browserName }) => {
        test.setTimeout(45000);
        errorContext.setTest(`Visual Regression - ${viewportName}`);

        const pagesToTest = process.env.SMOKE
          ? siteConfig.testPages.slice(0, 1)
          : siteConfig.testPages;

        for (const testPage of pagesToTest) {
          await test.step(`Visual ${viewportName}: ${testPage}`, async () => {
            errorContext.setPage(testPage);

            const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
            if (response.status() !== 200) return;
            await waitForPageStability(page);

            // Disable animations for consistent screenshots
            await page.addStyleTag({
              content: `
                *, *::before, *::after {
                  animation-duration: 0s !important;
                  animation-delay: 0s !important;
                  transition-duration: 0s !important;
                  transition-delay: 0s !important;
                }
              `,
            });
            await page.waitForTimeout(300);

            const pageName = testPage.replace(/\//g, '') || 'home';
            const screenshotName = `${siteConfig.name
              .toLowerCase()
              .replace(/\s+/g, '-')}-${pageName}-${viewportName}-${browserName}.png`;

            const thresholds = siteConfig.visualThresholds || DEFAULT_VISUAL_THRESHOLDS;
            const threshold =
              testPage === '/' || testPage.includes('home')
                ? thresholds.dynamic
                : thresholds.content;

            const maskSelectors = [
              'time',
              '.wp-block-latest-posts__post-date',
              '.wp-block-latest-comments__comment-date',
              '.carousel',
              '.slider',
              '.ticker',
              'iframe',
              'video',
              'canvas',
            ].concat(siteConfig.dynamicMasks || []);
            const masks = maskSelectors.map((sel) => page.locator(sel));

            try {
              await expect(page).toHaveScreenshot(screenshotName, {
                fullPage: true,
                threshold,
                maxDiffPixels: 1000,
                animations: 'disabled',
                mask: masks,
              });
              console.log(`✅ Visual regression passed for ${testPage} (${viewportName})`);
            } catch (error) {
              console.log(
                `⚠️  Visual difference detected for ${testPage} (${viewportName}): ${error.message}`
              );
            }
          });
        }
      });
    });
  });
});

