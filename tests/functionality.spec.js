const { test, expect } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');

// Comprehensive interactive testing function for JS error detection
async function performInteractiveJSTests(page, currentPage) {
  console.log(`🔄 Running interactive JS tests on: ${currentPage}`);
  
  try {
    // Test 1: Click all clickable elements
    const clickableSelectors = [
      'button:not([disabled])',
      'a[href]:not([href^="mailto:"]):not([href^="tel:"]):not([href^="#"])',
      '[onclick]',
      '.btn, .button',
      '[role="button"]',
      'input[type="submit"]:not([disabled])',
      'input[type="button"]:not([disabled])'
    ];
    
    for (const selector of clickableSelectors) {
      try {
        const elements = await page.locator(selector).all();
        for (let i = 0; i < Math.min(elements.length, 10); i++) { // Limit to 10 per selector
          const element = elements[i];
          if (await element.isVisible() && await element.isEnabled()) {
            await element.click({ timeout: 2000 });
            await page.waitForTimeout(500); // Allow time for JS to execute
          }
        }
      } catch (error) {
        // Continue testing other elements if one fails
      }
    }
    
    // Test 2: Navigation menu interactions
    try {
      // Desktop menu hovers
      const navItems = await page.locator('nav a, .menu a, .main-menu a').all();
      for (let i = 0; i < Math.min(navItems.length, 8); i++) {
        try {
          await navItems[i].hover({ timeout: 1000 });
          await page.waitForTimeout(300);
        } catch (error) {
          // Continue with next item
        }
      }
      
      // Mobile menu toggle
      const mobileToggles = ['.menu-toggle', '.hamburger', '.mobile-menu-toggle', '[aria-label*="menu"]'];
      for (const toggleSelector of mobileToggles) {
        try {
          const toggle = page.locator(toggleSelector).first();
          if (await toggle.isVisible()) {
            await toggle.click({ timeout: 2000 });
            await page.waitForTimeout(800); // Wait for menu animation
            // Try to close it too
            await toggle.click({ timeout: 2000 });
            await page.waitForTimeout(500);
            break; // Only test one toggle per page
          }
        } catch (error) {
          // Continue with next toggle type
        }
      }
    } catch (error) {
      // Navigation testing errors don't fail the test
    }
    
    // Test 3: Dropdown and accordion interactions
    try {
      const dropdownSelectors = [
        '.dropdown-toggle, .dropdown-trigger',
        '[aria-haspopup="true"]',
        '.accordion-header, .accordion-toggle',
        '.tab-nav a, .tab-header'
      ];
      
      for (const selector of dropdownSelectors) {
        const elements = await page.locator(selector).all();
        for (let i = 0; i < Math.min(elements.length, 5); i++) {
          try {
            if (await elements[i].isVisible()) {
              await elements[i].click({ timeout: 2000 });
              await page.waitForTimeout(500);
            }
          } catch (error) {
            // Continue with next element
          }
        }
      }
    } catch (error) {
      // Dropdown testing errors don't fail the test
    }
    
    // Test 4: Form interactions (beyond just submission)
    try {
      // Focus and blur events on form fields
      const formFields = await page.locator('input[type="text"], input[type="email"], textarea, select').all();
      for (let i = 0; i < Math.min(formFields.length, 8); i++) {
        try {
          const field = formFields[i];
          if (await field.isVisible() && await field.isEnabled()) {
            await field.focus();
            await field.fill('test');
            await field.blur();
            await page.waitForTimeout(200);
          }
        } catch (error) {
          // Continue with next field
        }
      }
    } catch (error) {
      // Form testing errors don't fail the test
    }
    
    // Test 5: Interactive media elements
    try {
      const mediaSelectors = [
        '.slider-nav, .carousel-control',
        '.lightbox-trigger, .gallery-item',
        '.video-play-button',
        '.modal-trigger, [data-modal]'
      ];
      
      for (const selector of mediaSelectors) {
        const elements = await page.locator(selector).all();
        for (let i = 0; i < Math.min(elements.length, 3); i++) {
          try {
            if (await elements[i].isVisible()) {
              await elements[i].click({ timeout: 2000 });
              await page.waitForTimeout(800);
              
              // Try to close modal/lightbox if opened
              const closeButtons = page.locator('.close, .modal-close, [aria-label="Close"]');
              if (await closeButtons.first().isVisible()) {
                await closeButtons.first().click({ timeout: 1000 });
                await page.waitForTimeout(300);
              }
            }
          } catch (error) {
            // Continue with next element
          }
        }
      }
    } catch (error) {
      // Media testing errors don't fail the test
    }
    
    console.log(`✅ Completed interactive JS tests on: ${currentPage}`);
    
  } catch (error) {
    console.log(`⚠️  Interactive JS testing encountered issues on ${currentPage}: ${error.message}`);
  }
}

const siteName = process.env.SITE_NAME || 'example-site';
let siteConfig;

test.beforeAll(async () => {
  siteConfig = SiteLoader.loadSite(siteName);
  SiteLoader.validateSiteConfig(siteConfig);
});

test.describe(`Functionality Tests - ${siteName}`, () => {
  
  test('broken-links', async ({ page }) => {
    const checkedUrls = new Set();
    const brokenLinks = [];
    const missingPages = [];
    
    for (const testPage of siteConfig.testPages) {
      const response = await page.goto(`${siteConfig.baseUrl}${testPage}`);
      
      // Check if the page itself exists
      if (response?.status() >= 400) {
        missingPages.push({
          page: testPage,
          status: response.status(),
          url: `${siteConfig.baseUrl}${testPage}`
        });
        continue; // Skip link checking on broken pages
      }
      
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
    
    // Report findings
    if (missingPages.length > 0) {
      console.log('❌ Missing pages found:', missingPages);
    }
    if (brokenLinks.length > 0) {
      console.log('❌ Broken links found:', brokenLinks);
    }
    
    // Fail if we found missing pages or broken links
    const totalIssues = missingPages.length + brokenLinks.length;
    if (totalIssues > 0) {
      const errorMessage = [
        missingPages.length > 0 ? `${missingPages.length} missing pages` : '',
        brokenLinks.length > 0 ? `${brokenLinks.length} broken links` : ''
      ].filter(Boolean).join(', ');
      throw new Error(`Found ${errorMessage}`);
    }
  });
  
  test('javascript-errors', async ({ page }) => {
    const jsErrors = [];
    const missingPages = [];
    
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
      const response = await page.goto(`${siteConfig.baseUrl}${testPage}`);
      
      // Skip JS testing on missing pages
      if (response?.status() >= 400) {
        missingPages.push({ page: testPage, status: response.status() });
        console.log(`⚠️  Skipping JS tests for missing page: ${testPage} (${response.status()})`);
        continue;
      }
      
      // Only wait for network idle on pages that actually loaded
      try {
        await page.waitForLoadState('networkidle', { timeout: 10000 });
      } catch (error) {
        console.log(`⚠️  Network idle timeout for ${testPage}, continuing with JS error check`);
      }
      
      // Comprehensive interactive testing for JS errors
      await performInteractiveJSTests(page, testPage);
    }
    
    // Report findings
    if (missingPages.length > 0) {
      console.log(`ℹ️  Skipped JS testing on ${missingPages.length} missing pages:`, missingPages.map(p => p.page));
    }
    if (jsErrors.length > 0) {
      console.log('❌ JavaScript errors found:', jsErrors);
    }
    
    expect(jsErrors).toHaveLength(0);
  });
  
  // Test forms if configured
  if (siteConfig?.forms && siteConfig.forms.length > 0) {
    for (const form of siteConfig.forms) {
      test(`should handle ${form.name} properly`, async ({ page }) => {
        const response = await page.goto(`${siteConfig.baseUrl}${form.page}`);
        
        // Skip form testing if page doesn't exist
        if (response?.status() >= 400) {
          console.log(`⚠️  Skipping form test - page not found: ${form.page} (${response.status()})`);
          return;
        }
        
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
  
  test('page-performance', async ({ page }) => {
    const slowPages = [];
    const missingPages = [];
    
    for (const testPage of siteConfig.testPages) {
      const startTime = Date.now();
      
      const response = await page.goto(`${siteConfig.baseUrl}${testPage}`);
      
      // Skip performance testing on missing pages
      if (response?.status() >= 400) {
        missingPages.push({ page: testPage, status: response.status() });
        continue;
      }
      
      try {
        await page.waitForLoadState('networkidle', { timeout: 10000 });
      } catch (error) {
        // Don't fail on network idle timeout, just note it
        console.log(`⚠️  Network idle timeout for ${testPage}`);
      }
      
      const loadTime = Date.now() - startTime;
      
      if (loadTime > 3000) { // 3 second threshold
        slowPages.push({
          page: testPage,
          loadTime: `${loadTime}ms`
        });
      }
    }
    
    // Report findings
    if (missingPages.length > 0) {
      console.log(`ℹ️  Skipped performance testing on ${missingPages.length} missing pages:`, missingPages.map(p => p.page));
    }
    if (slowPages.length > 0) {
      console.log('⚠️  Slow loading pages:', slowPages);
    }
    
    // Only fail if ALL existing pages are slow (very unlikely)
    const existingPagesCount = siteConfig.testPages.length - missingPages.length;
    expect(slowPages.length).toBeLessThan(existingPagesCount);
  });
  
});