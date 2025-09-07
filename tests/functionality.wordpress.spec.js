const { test } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');
const { setupTestPage, teardownTestPage, safeNavigate, waitForPageStability } = require('../utils/test-helpers');

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
    test.setTimeout(30000);
    const detected = [];
    for (const testPage of siteConfig.testPages.slice(0, 3)) {
      await test.step(`Detecting plugins on: ${testPage}`, async () => {
        const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        if (response.status() !== 200) return;
        await waitForPageStability(page);
        if ((await page.locator('.wpcf7-form, .wpcf7').count()) > 0) detected.push('Contact Form 7');
        if ((await page.locator('.gform_wrapper').count()) > 0) detected.push('Gravity Forms');
        if ((await page.locator('.wpforms-form').count()) > 0) detected.push('WPForms');
        const yoastMeta = await page.locator('meta[name="generator"][content*="Yoast"]').count();
        if (yoastMeta > 0) detected.push('Yoast SEO');
      });
    }
    if (detected.length > 0) console.log(`📊 Detected plugins: ${detected.join(', ')}`);
    else console.log('ℹ️  No common plugins detected');
  });

  test('Theme elements and type detection', async ({ page }) => {
    test.setTimeout(25000);
    await test.step('Analyzing theme structure', async () => {
      const response = await safeNavigate(page, siteConfig.baseUrl);
      if (response.status() !== 200) return;
      await waitForPageStability(page);
      const isBlockTheme = await page.locator('.wp-site-blocks, .is-layout-').isVisible();
      const hasClassic = await page.locator('.widget, .sidebar').isVisible();
      if (isBlockTheme) {
        const blocks = await page.locator('[class*="wp-block-"]').count();
        console.log(`✅ Block theme detected; ${blocks} block elements`);
      } else if (hasClassic) {
        const widgets = await page.locator('.widget').count();
        console.log(`✅ Classic theme detected; ${widgets} widgets`);
      } else {
        console.log('ℹ️  Theme type could not be determined');
      }
      const mobileMenuExists = await page.locator('.mobile-menu, .hamburger, .menu-toggle').isVisible();
      if (mobileMenuExists) console.log('✅ Mobile navigation detected');
      console.log('✅ Theme analysis completed');
    });
  });
});
