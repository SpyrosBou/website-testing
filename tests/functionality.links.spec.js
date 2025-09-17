const { test, expect } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');
const {
  setupTestPage,
  teardownTestPage,
  safeNavigate,
  waitForPageStability,
} = require('../utils/test-helpers');

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
    test.setTimeout(90000);
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
        const pageLinks = [];
        for (const link of links) {
          try {
            const href = await link.getAttribute('href');
            if (!href) continue;
            const fullUrl = href.startsWith('/') ? `${siteConfig.baseUrl}${href}` : href;
            if (!fullUrl.startsWith(siteConfig.baseUrl)) continue;
            if (checkedLinks.has(fullUrl)) continue;
            checkedLinks.add(fullUrl);
            pageLinks.push(fullUrl);
            if (pageLinks.length >= 20) break;
          } catch (error) {
            console.log(`⚠️  Could not read link attribute: ${error.message}`);
          }
        }

        const concurrency = Math.min(5, pageLinks.length);
        let index = 0;
        const processNext = async () => {
          while (index < pageLinks.length) {
            const currentIndex = index++;
            const url = pageLinks[currentIndex];
            try {
              const headResp = await page.request.head(url);
              if (headResp.status() >= 400) {
                brokenLinks.push({ url, status: headResp.status(), page: testPage });
              }
            } catch (error) {
              console.log(`⚠️  HEAD request failed for ${url}: ${error.message}`);
            }
            await page.waitForTimeout(100);
          }
        };

        await Promise.all(Array.from({ length: concurrency || 1 }, processNext));
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
