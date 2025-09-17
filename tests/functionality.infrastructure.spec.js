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
    const perfBudgets =
      typeof siteConfig.performanceBudgets === 'object' &&
      siteConfig.performanceBudgets !== null
        ? siteConfig.performanceBudgets
        : null;
    const performanceBreaches = [];
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
          const paints = performance.getEntriesByType('paint');
          return {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
            loadComplete: navigation.loadEventEnd - navigation.navigationStart,
            firstPaint: paints.find((p) => p.name === 'first-paint')?.startTime || 0,
            firstContentfulPaint:
              paints.find((p) => p.name === 'first-contentful-paint')?.startTime || 0,
          };
        });
        performanceData.push({ page: testPage, loadTime, ...metrics });
        if (loadTime > 3000) console.log(`⚠️  ${testPage} took ${loadTime}ms (>3s)`);
        else console.log(`✅ ${testPage} loaded in ${loadTime}ms`);

        if (perfBudgets) {
          const budgetChecks = {
            domContentLoaded: metrics.domContentLoaded,
            loadComplete: metrics.loadComplete,
            firstContentfulPaint: metrics.firstContentfulPaint,
          };

          for (const [budgetKey, value] of Object.entries(budgetChecks)) {
            if (!Object.prototype.hasOwnProperty.call(perfBudgets, budgetKey)) continue;
            const budget = Number(perfBudgets[budgetKey]);
            if (!Number.isFinite(budget) || budget <= 0) continue;
            if (!Number.isFinite(value) || value <= 0) {
              console.log(
                `ℹ️  ${budgetKey} metric unavailable on ${testPage}; skipping budget comparison`
              );
              continue;
            }
            if (value > budget) {
              console.log(
                `❌  ${budgetKey} for ${testPage} exceeded budget: ${Math.round(value)}ms > ${budget}ms`
              );
              performanceBreaches.push({ page: testPage, metric: budgetKey, value, budget });
              expect.soft(value).toBeLessThanOrEqual(budget);
            } else {
              console.log(
                `✅  ${budgetKey} for ${testPage} within budget (${Math.round(value)}ms <= ${budget}ms)`
              );
            }
          }
        }
      });
    }
    if (performanceData.length > 0) {
      const avg = performanceData.reduce((s, d) => s + d.loadTime, 0) / performanceData.length;
      console.log(`📊 Average load time: ${Math.round(avg)}ms`);
      if (performanceBreaches.length > 0) {
        const details = performanceBreaches
          .map(
            (entry) =>
              `${entry.metric} on ${entry.page}: ${Math.round(entry.value)}ms (budget ${entry.budget}ms)`
          )
          .join('\n');
        console.error(`⚠️  Performance budgets exceeded:\n${details}`);
      }
    }
  });
});
