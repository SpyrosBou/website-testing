const { test, expect } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');
const {
  setupTestPage,
  teardownTestPage,
  safeNavigate,
  waitForPageStability,
} = require('../utils/test-helpers');
const { WordPressPageObjects } = require('../utils/wordpress-page-objects');

test.describe('Functionality: Core Infrastructure', () => {
  let siteConfig;
  let errorContext;
  let wpPageObjects;

  test.beforeEach(async ({ page, context }) => {
    const siteName = process.env.SITE_NAME;
    if (!siteName) throw new Error('SITE_NAME environment variable is required');

    siteConfig = SiteLoader.loadSite(siteName);
    SiteLoader.validateSiteConfig(siteConfig);

    errorContext = await setupTestPage(page, context);
    wpPageObjects = new WordPressPageObjects(page, siteConfig);
  });

  test.afterEach(async ({ page, context }) => {
    await teardownTestPage(page, context, errorContext);
  });

  test('Page availability across configured pages', async ({ page }) => {
    test.setTimeout(30000);
    errorContext.setTest('Page Availability Check');

    for (const testPage of siteConfig.testPages) {
      await test.step(`Checking page availability: ${testPage}`, async () => {
        errorContext.setPage(testPage);
        errorContext.setAction('navigating to page');

        const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        await wpPageObjects.basePage.waitForWordPressReady();
        const is404 = await wpPageObjects.is404Page();
        if (is404) {
          console.log(`⚠️  Page not found: ${testPage}`);
          await page.screenshot({ path: `test-results/404-${testPage.replace(/\//g, '-')}.png` });
          return;
        }
        if (response.status() >= 500)
          throw new Error(`Server error on ${testPage}: ${response.status()}`);
        if (response.status() >= 400)
          console.log(`⚠️  Client error on ${testPage}: ${response.status()}`);

        if (response.status() >= 200 && response.status() < 300) {
          const elements = await wpPageObjects.verifyCriticalElements();
          console.log(`✅ Page structure check for ${testPage}:`, elements);
          const title = await wpPageObjects.getTitle();
          expect(title).toBeTruthy();
        }
      });
    }
  });

  test('HTTP response and content integrity', async ({ page }) => {
    test.setTimeout(20000);
    errorContext.setTest('HTTP Response Validation');
    for (const testPage of siteConfig.testPages) {
      await test.step(`Validating response for: ${testPage}`, async () => {
        errorContext.setPage(testPage);
        const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        expect([200, 301, 302]).toContain(response.status());
        if (response.status() === 200) {
          const contentType = response.headers()['content-type'];
          expect(contentType).toContain('text/html');
          await expect(page.locator('html[lang]')).toBeAttached();
          await expect(
            page.locator('meta[charset], meta[http-equiv="Content-Type"]')
          ).toBeAttached();
          await expect(page.locator('meta[name="viewport"]')).toBeAttached();
          const bodyText = await page.locator('body').textContent();
          expect(bodyText).not.toContain('Fatal error');
          expect(bodyText).not.toContain('Warning:');
          expect(bodyText).not.toContain('Notice:');
          console.log(`✅ Response validation passed for ${testPage}`);
        }
      });
    }
  });

  test('Performance monitoring (sample up to 5 pages)', async ({ page }) => {
    test.setTimeout(45000);
    errorContext.setTest('Performance Monitoring');
    const performanceData = [];
    for (const testPage of siteConfig.testPages.slice(0, 5)) {
      await test.step(`Measuring performance for: ${testPage}`, async () => {
        errorContext.setPage(testPage);
        const startTime = Date.now();
        const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        if (response.status() !== 200) return;
        await waitForPageStability(page, { timeout: 10000 });
        const loadTime = Date.now() - startTime;
        const metrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          return {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
            loadComplete: navigation.loadEventEnd - navigation.navigationStart,
            firstPaint:
              performance.getEntriesByType('paint').find((p) => p.name === 'first-paint')
                ?.startTime || 0,
          };
        });
        performanceData.push({ page: testPage, loadTime, ...metrics });
        if (loadTime > 3000) console.log(`⚠️  ${testPage} took ${loadTime}ms (>3s)`);
        else console.log(`✅ ${testPage} loaded in ${loadTime}ms`);
      });
    }
    if (performanceData.length > 0) {
      const avg = performanceData.reduce((s, d) => s + d.loadTime, 0) / performanceData.length;
      console.log(`📊 Average load time: ${Math.round(avg)}ms`);
    }
  });
});
