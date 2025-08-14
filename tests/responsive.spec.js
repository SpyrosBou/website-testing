const { test, expect } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');

const siteName = process.env.SITE_NAME || 'example-site';
let siteConfig;

test.beforeAll(async () => {
  siteConfig = SiteLoader.loadSite(siteName);
  SiteLoader.validateSiteConfig(siteConfig);
});

test.describe(`Responsive Layout Tests - ${siteName}`, () => {
  
  // Test each page across different devices
  for (const testPage of siteConfig?.testPages || []) {
    test.describe(`Page: ${testPage}`, () => {
      
      test(`should load properly on desktop`, async ({ page, browserName }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        
        const response = await page.goto(`${siteConfig.baseUrl}${testPage}`);
        expect(response?.status()).toBe(200);
        
        // Check for critical elements if defined
        if (siteConfig.criticalElements) {
          for (const element of siteConfig.criticalElements) {
            const locator = page.locator(element.selector).first();
            await expect(locator).toBeVisible({ timeout: 10000 });
          }
        }
        
        // Take screenshot for visual comparison
        await page.screenshot({ 
          path: `test-results/screenshots/${siteName}-${testPage.replace('/', 'home')}-desktop-${browserName}.png`,
          fullPage: true 
        });
      });
      
      test(`should load properly on tablet`, async ({ page, browserName }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        
        const response = await page.goto(`${siteConfig.baseUrl}${testPage}`);
        expect(response?.status()).toBe(200);
        
        // Check mobile menu functionality if present
        const mobileMenuToggle = page.locator('.menu-toggle, .hamburger, [aria-label*="menu"]').first();
        if (await mobileMenuToggle.isVisible()) {
          await mobileMenuToggle.click();
          await page.waitForTimeout(500);
          await mobileMenuToggle.click(); // Close it
        }
        
        await page.screenshot({ 
          path: `test-results/screenshots/${siteName}-${testPage.replace('/', 'home')}-tablet-${browserName}.png`,
          fullPage: true 
        });
      });
      
      test(`should load properly on mobile`, async ({ page, browserName }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        
        const response = await page.goto(`${siteConfig.baseUrl}${testPage}`);
        expect(response?.status()).toBe(200);
        
        // Test mobile-specific interactions
        const mobileMenuToggle = page.locator('.menu-toggle, .hamburger, [aria-label*="menu"]').first();
        if (await mobileMenuToggle.isVisible()) {
          await expect(mobileMenuToggle).toBeVisible();
          await mobileMenuToggle.click();
          await page.waitForTimeout(500);
        }
        
        await page.screenshot({ 
          path: `test-results/screenshots/${siteName}-${testPage.replace('/', 'home')}-mobile-${browserName}.png`,
          fullPage: true 
        });
      });
      
    });
  }
  
});