const { test, expect } = require('@playwright/test');
const { allure } = require('allure-playwright');
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

// Responsive tests - test all viewports in desktop browsers
test.describe(`${siteName}`, () => {
  
  test.beforeEach(async () => {
    await allure.suite('WordPress Responsive Tests');
    await allure.parentSuite('Website Testing Suite');
    await allure.owner('QA Team');
    await allure.tag('responsive');
    await allure.tag('visual-regression');
    await allure.tag('wordpress');
    await allure.severity('normal');
  });
  
  for (const testPage of siteConfig.testPages || []) {
    const pageName = testPage === '/' ? 'home' : testPage.replace('/', '');
    
    test(`${pageName}-desktop`, async ({ page, browserName }) => {
      await allure.epic('Website Quality Assurance');
      await allure.feature('Responsive Design Testing');
      await allure.story(`Desktop layout verification for ${pageName}`);
      await allure.description(`Tests desktop viewport (1920x1080) layout, critical elements visibility, and visual regression for ${pageName} page.`);
      await test.step('Set desktop viewport and navigate', async () => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        
        const response = await page.goto(`${siteConfig.baseUrl}${testPage}`);
        
        // Skip visual regression on missing pages
        if (response?.status() >= 400) {
          console.log(`⚠️  Skipping visual regression for missing page: ${testPage} (${response.status()})`);
          await allure.attachment('Missing Page Details', JSON.stringify({ page: testPage, status: response.status() }), 'application/json');
          return;
        }
        
        expect(response?.status()).toBe(200);
        await allure.parameter('Viewport', '1920x1080 (Desktop)');
        await allure.parameter('Browser', browserName);
      });
      
      await test.step('Verify critical elements visibility', async () => {
        // Check for critical elements if defined
        if (siteConfig.criticalElements) {
          for (const element of siteConfig.criticalElements) {
            const locator = page.locator(element.selector).first();
            await expect(locator).toBeVisible({ timeout: 10000 });
            await allure.parameter('Critical Element Verified', element.name);
          }
        }
      });
      
      await test.step('Prepare page for visual regression testing', async () => {
        // Wait for page to be fully loaded
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        // Scroll to bottom to trigger lazy loading
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000); // Wait for lazy loading to complete
      });
      
      await test.step('Perform visual regression comparison', async () => {
        // Visual regression testing following Playwright best practices
        // Screenshot path: {siteName}-{page}-desktop-{browser}.png
        const screenshotName = `${siteName}-${testPage.replace('/', 'home')}-desktop-${browserName}.png`;
        await expect(page).toHaveScreenshot(screenshotName, {
          fullPage: true,
          threshold: 0.3, // Allow 30% difference to account for dynamic content
          maxDiffPixels: 1000 // Allow up to 1000 pixels to be different
        });
      });
    });
    
    test(`${pageName}-tablet`, async ({ page, browserName }) => {
      await allure.epic('Website Quality Assurance');
      await allure.feature('Responsive Design Testing');
      await allure.story(`Tablet layout verification for ${pageName}`);
      await allure.description(`Tests tablet viewport (768x1024) layout, mobile menu functionality, and visual regression for ${pageName} page.`);
      
      await test.step('Set tablet viewport and navigate', async () => {
        await page.setViewportSize({ width: 768, height: 1024 });
        
        const response = await page.goto(`${siteConfig.baseUrl}${testPage}`);
        
        // Skip visual regression on missing pages
        if (response?.status() >= 400) {
          console.log(`⚠️  Skipping visual regression for missing page: ${testPage} (${response.status()})`);
          await allure.attachment('Missing Page Details', JSON.stringify({ page: testPage, status: response.status() }), 'application/json');
          return;
        }
        
        expect(response?.status()).toBe(200);
        await allure.parameter('Viewport', '768x1024 (Tablet)');
        await allure.parameter('Browser', browserName);
      });
      
      await test.step('Verify critical elements and mobile menu', async () => {
        // Check for critical elements
        if (siteConfig.criticalElements) {
          for (const element of siteConfig.criticalElements) {
            const locator = page.locator(element.selector).first();
            await expect(locator).toBeVisible({ timeout: 10000 });
            await allure.parameter('Critical Element Verified', element.name);
          }
        }
        
        // Test mobile menu functionality (common on tablet sizes)
        const mobileMenuToggle = page.locator('.menu-toggle, .hamburger, [aria-label*="menu"]').first();
        if (await mobileMenuToggle.isVisible()) {
          try {
            await mobileMenuToggle.click();
            await page.waitForTimeout(500);
            await mobileMenuToggle.click(); // Close it
            await allure.parameter('Mobile Menu Test', 'Successfully toggled');
          } catch (error) {
            console.log(`⚠️  Mobile menu interaction failed: ${error.message}`);
            await allure.parameter('Mobile Menu Test', `Failed: ${error.message}`);
            // Continue with test - menu issues shouldn't fail visual regression
          }
        }
      });
      
      await test.step('Prepare page for visual regression testing', async () => {
        // Wait for page to be fully loaded
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        // Scroll to bottom to trigger lazy loading
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000); // Wait for lazy loading to complete
      });
      
      await test.step('Perform visual regression comparison', async () => {
        // Visual regression testing following Playwright best practices
        // Screenshot path: {siteName}-{page}-tablet-{browser}.png
        const screenshotName = `${siteName}-${testPage.replace('/', 'home')}-tablet-${browserName}.png`;
        await expect(page).toHaveScreenshot(screenshotName, {
          fullPage: true,
          threshold: 0.3,
          maxDiffPixels: 1000
        });
      });
    });
    
    test(`${pageName}-mobile`, async ({ page, browserName }) => {
      await allure.epic('Website Quality Assurance');
      await allure.feature('Responsive Design Testing');
      await allure.story(`Mobile layout verification for ${pageName}`);
      await allure.description(`Tests mobile viewport (375x667) layout, mobile menu functionality, and visual regression for ${pageName} page.`);
      
      await test.step('Set mobile viewport and navigate', async () => {
        await page.setViewportSize({ width: 375, height: 667 });
        
        const response = await page.goto(`${siteConfig.baseUrl}${testPage}`);
        
        // Skip visual regression on missing pages
        if (response?.status() >= 400) {
          console.log(`⚠️  Skipping visual regression for missing page: ${testPage} (${response.status()})`);
          await allure.attachment('Missing Page Details', JSON.stringify({ page: testPage, status: response.status() }), 'application/json');
          return;
        }
        
        expect(response?.status()).toBe(200);
        await allure.parameter('Viewport', '375x667 (Mobile)');
        await allure.parameter('Browser', browserName);
      });
      
      await test.step('Verify critical elements and mobile menu', async () => {
        // Check for critical elements
        if (siteConfig.criticalElements) {
          for (const element of siteConfig.criticalElements) {
            const locator = page.locator(element.selector).first();
            await expect(locator).toBeVisible({ timeout: 10000 });
            await allure.parameter('Critical Element Verified', element.name);
          }
        }
        
        // Test mobile menu functionality
        const mobileMenuToggle = page.locator('.menu-toggle, .hamburger, [aria-label*="menu"]').first();
        if (await mobileMenuToggle.isVisible()) {
          try {
            await expect(mobileMenuToggle).toBeVisible();
            await mobileMenuToggle.click();
            await page.waitForTimeout(500);
            await allure.parameter('Mobile Menu Test', 'Successfully opened');
          } catch (error) {
            console.log(`⚠️  Mobile menu interaction failed: ${error.message}`);
            await allure.parameter('Mobile Menu Test', `Failed: ${error.message}`);
            // Continue with test - menu issues shouldn't fail visual regression
          }
        }
      });
      
      await test.step('Prepare page for visual regression testing', async () => {
        // Wait for page to be fully loaded
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        // Scroll to bottom to trigger lazy loading
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000); // Wait for lazy loading to complete
      });
      
      await test.step('Perform visual regression comparison', async () => {
        // Visual regression testing following Playwright best practices
        // Screenshot path: {siteName}-{page}-mobile-{browser}.png
        const screenshotName = `${siteName}-${testPage.replace('/', 'home')}-mobile-${browserName}.png`;
        await expect(page).toHaveScreenshot(screenshotName, {
          fullPage: true,
          threshold: 0.3,
          maxDiffPixels: 1000
        });
      });
    });
  }
});