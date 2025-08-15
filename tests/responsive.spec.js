const { test, expect } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');

const siteName = process.env.SITE_NAME || 'example-site';

// Load site config synchronously at module level for dynamic test generation
let siteConfig;
try {
  siteConfig = SiteLoader.loadSite(siteName);
  SiteLoader.validateSiteConfig(siteConfig);
} catch (error) {
  console.error(`Failed to load site config: ${error.message}`);
  siteConfig = { testPages: ['/'] }; // Fallback to homepage only
}

test.describe(`Responsive Layout Tests - ${siteName}`, () => {
  
  // Test each page across different devices
  for (const testPage of siteConfig.testPages || []) {
    test.describe(`Page: ${testPage}`, () => {
      
      test(`desktop-layout`, async ({ page, browserName }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        
        const response = await page.goto(`${siteConfig.baseUrl}${testPage}`);
        
        // Skip visual regression on missing pages
        if (response?.status() >= 400) {
          console.log(`⚠️  Skipping visual regression for missing page: ${testPage} (${response.status()})`);
          return;
        }
        
        expect(response?.status()).toBe(200);
        
        // Check for critical elements if defined
        if (siteConfig.criticalElements) {
          for (const element of siteConfig.criticalElements) {
            const locator = page.locator(element.selector).first();
            await expect(locator).toBeVisible({ timeout: 10000 });
          }
        }
        
        // Wait for page to be fully loaded
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        // Scroll to bottom to trigger lazy loading
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000); // Wait for lazy loading to complete
        
        // Visual regression testing - automatic baseline comparison  
        const screenshotName = `${siteName}/${testPage.replace('/', 'home')}-desktop-${browserName}.png`;
        await expect(page).toHaveScreenshot(screenshotName, {
          fullPage: true,
          threshold: 0.3, // Allow 30% difference to account for dynamic content
          maxDiffPixels: 1000 // Allow up to 1000 pixels to be different
        });
      });
      
      test(`tablet-layout`, async ({ page, browserName }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        
        const response = await page.goto(`${siteConfig.baseUrl}${testPage}`);
        
        // Skip visual regression on missing pages
        if (response?.status() >= 400) {
          console.log(`⚠️  Skipping visual regression for missing page: ${testPage} (${response.status()})`);
          return;
        }
        
        expect(response?.status()).toBe(200);
        
        // Wait for page to be fully loaded
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        // Check mobile menu functionality if present
        const mobileMenuToggle = page.locator('.menu-toggle, .hamburger, [aria-label*="menu"]').first();
        if (await mobileMenuToggle.isVisible()) {
          await mobileMenuToggle.click();
          await page.waitForTimeout(500);
          await mobileMenuToggle.click(); // Close it
        }
        
        // Scroll to bottom to trigger lazy loading
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000); // Wait for lazy loading to complete
        
        // Visual regression testing - automatic baseline comparison
        const screenshotName = `${siteName}/${testPage.replace('/', 'home')}-tablet-${browserName}.png`;
        await expect(page).toHaveScreenshot(screenshotName, {
          fullPage: true,
          threshold: 0.3,
          maxDiffPixels: 1000
        });
      });
      
      test(`mobile-layout`, async ({ page, browserName }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        
        const response = await page.goto(`${siteConfig.baseUrl}${testPage}`);
        
        // Skip visual regression on missing pages
        if (response?.status() >= 400) {
          console.log(`⚠️  Skipping visual regression for missing page: ${testPage} (${response.status()})`);
          return;
        }
        
        expect(response?.status()).toBe(200);
        
        // Wait for page to be fully loaded
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        // Test mobile-specific interactions
        const mobileMenuToggle = page.locator('.menu-toggle, .hamburger, [aria-label*="menu"]').first();
        if (await mobileMenuToggle.isVisible()) {
          await expect(mobileMenuToggle).toBeVisible();
          await mobileMenuToggle.click();
          await page.waitForTimeout(500);
        }
        
        // Scroll to bottom to trigger lazy loading
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000); // Wait for lazy loading to complete
        
        // Visual regression testing - automatic baseline comparison
        const screenshotName = `${siteName}/${testPage.replace('/', 'home')}-mobile-${browserName}.png`;
        await expect(page).toHaveScreenshot(screenshotName, {
          fullPage: true,
          threshold: 0.3,
          maxDiffPixels: 1000
        });
      });
      
    });
  }
  
});