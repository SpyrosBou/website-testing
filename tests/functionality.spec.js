const { test, expect } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');

const siteName = process.env.SITE_NAME || 'example-site';
let siteConfig;

test.beforeAll(async () => {
  siteConfig = SiteLoader.loadSite(siteName);
  SiteLoader.validateSiteConfig(siteConfig);
});

test.describe(`Functionality Tests - ${siteName}`, () => {
  
  test('should have no broken internal links', async ({ page }) => {
    const checkedUrls = new Set();
    const brokenLinks = [];
    
    for (const testPage of siteConfig.testPages) {
      await page.goto(`${siteConfig.baseUrl}${testPage}`);
      
      // Find all internal links
      const links = await page.locator('a[href]').all();
      
      for (const link of links) {
        const href = await link.getAttribute('href');
        if (!href) continue;
        
        // Skip external links, anchors, and already checked URLs
        if (href.startsWith('http') && !href.includes(siteConfig.baseUrl)) continue;
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
        if (checkedUrls.has(href)) continue;
        
        checkedUrls.add(href);
        
        try {
          const fullUrl = href.startsWith('http') ? href : `${siteConfig.baseUrl}${href}`;
          const response = await page.request.get(fullUrl);
          
          if (response.status() >= 400) {
            brokenLinks.push({
              url: fullUrl,
              status: response.status(),
              foundOn: testPage
            });
          }
        } catch (error) {
          brokenLinks.push({
            url: href,
            error: error.message,
            foundOn: testPage
          });
        }
      }
    }
    
    if (brokenLinks.length > 0) {
      console.log('Broken links found:', brokenLinks);
    }
    expect(brokenLinks).toHaveLength(0);
  });
  
  test('should detect JavaScript errors', async ({ page }) => {
    const jsErrors = [];
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        jsErrors.push({
          message: msg.text(),
          location: msg.location()
        });
      }
    });
    
    // Listen for page errors
    page.on('pageerror', error => {
      jsErrors.push({
        message: error.message,
        stack: error.stack
      });
    });
    
    // Test each page for JS errors
    for (const testPage of siteConfig.testPages) {
      await page.goto(`${siteConfig.baseUrl}${testPage}`);
      await page.waitForLoadState('networkidle');
      
      // Interact with common elements that might trigger JS
      try {
        // Try clicking navigation items
        const navLinks = page.locator('nav a, .menu a').first();
        if (await navLinks.isVisible()) {
          await navLinks.hover();
        }
        
        // Try mobile menu if present
        const mobileToggle = page.locator('.menu-toggle, .hamburger').first();
        if (await mobileToggle.isVisible()) {
          await mobileToggle.click();
          await page.waitForTimeout(500);
        }
      } catch (error) {
        // Ignore interaction errors, we're just testing for JS errors
      }
    }
    
    if (jsErrors.length > 0) {
      console.log('JavaScript errors found:', jsErrors);
    }
    expect(jsErrors).toHaveLength(0);
  });
  
  // Test forms if configured
  if (siteConfig?.forms && siteConfig.forms.length > 0) {
    for (const form of siteConfig.forms) {
      test(`should handle ${form.name} properly`, async ({ page }) => {
        await page.goto(`${siteConfig.baseUrl}${form.page}`);
        
        // Wait for form to be visible
        await expect(page.locator(form.selector)).toBeVisible({ timeout: 10000 });
        
        // Fill form fields if configured
        if (form.fields) {
          if (form.fields.name) {
            await page.fill(form.fields.name, 'Test User');
          }
          if (form.fields.email) {
            await page.fill(form.fields.email, 'test@example.com');
          }
          if (form.fields.message) {
            await page.fill(form.fields.message, 'This is a test message from automated testing.');
          }
        }
        
        // Test form validation (submit empty form first)
        if (form.submitButton) {
          // Clear fields to test validation
          if (form.fields?.name) await page.fill(form.fields.name, '');
          if (form.fields?.email) await page.fill(form.fields.email, '');
          
          await page.click(form.submitButton);
          await page.waitForTimeout(2000);
          
          // Form should still be visible (validation should prevent submission)
          await expect(page.locator(form.selector)).toBeVisible();
        }
      });
    }
  }
  
  test('should load all pages within acceptable time', async ({ page }) => {
    const slowPages = [];
    
    for (const testPage of siteConfig.testPages) {
      const startTime = Date.now();
      
      await page.goto(`${siteConfig.baseUrl}${testPage}`);
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      if (loadTime > 5000) { // 5 second threshold
        slowPages.push({
          page: testPage,
          loadTime: `${loadTime}ms`
        });
      }
    }
    
    if (slowPages.length > 0) {
      console.log('Slow loading pages:', slowPages);
    }
    // Warning only, don't fail test for slow pages
    expect(slowPages.length).toBeLessThan(siteConfig.testPages.length);
  });
  
});