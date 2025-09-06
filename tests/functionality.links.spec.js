const { test, expect } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');
const { setupTestPage, teardownTestPage, safeNavigate, waitForPageStability } = require('../utils/test-helpers');

test.describe('Functionality: Internal Links', () => {
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

  test('Validate internal links across pages (rate-limited)', async ({ page }) => {
    test.setTimeout(30000);
    const brokenLinks = [];
    const checkedLinks = new Set();
    for (const testPage of siteConfig.testPages) {
      await test.step(`Checking internal links on: ${testPage}`, async () => {
        const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        if (response.status() !== 200) return;
        await waitForPageStability(page);

        const links = await page
          .locator('a[href^="/"], a[href^="' + siteConfig.baseUrl + '"]')
          .all();
        console.log(`Found ${links.length} internal links on ${testPage}`);
        let linkCount = 0;
        for (const link of links.slice(0, 20)) {
          linkCount++;
          if (linkCount > 1 && linkCount % 5 === 0) await page.waitForTimeout(500);
          try {
            const href = await link.getAttribute('href');
            if (!href || checkedLinks.has(href)) continue;
            checkedLinks.add(href);
            const fullUrl = href.startsWith('/') ? `${siteConfig.baseUrl}${href}` : href;
            const headResp = await page.request.head(fullUrl);
            if (headResp.status() >= 400) brokenLinks.push({ url: fullUrl, status: headResp.status(), page: testPage });
          } catch (error) {
            console.log(`⚠️  Could not check link: ${error.message}`);
          }
        }
      });
    }
    if (brokenLinks.length > 0) {
      const report = brokenLinks
        .map((link) => `${link.url} (Status: ${link.status}) on page ${link.page}`)
        .join('\n');
      console.error(`❌ Found ${brokenLinks.length} broken links:\n${report}`);
      expect.soft(brokenLinks.length).toBe(0);
    } else {
      console.log('✅ All internal links are functional');
    }
  });
});

