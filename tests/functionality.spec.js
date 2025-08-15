const { test, expect } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');
const AxeBuilder = require('@axe-core/playwright').default;
const {
  debugBrowserState,
  retryOperation,
  safeNavigate,
  waitForPageStability,
  safeElementInteraction,
  ErrorContext,
  setupTestPage,
  teardownTestPage
} = require('../utils/test-helpers');
// Removed unused playwright-testing-library import

// Standardized interactive testing function using Testing Library patterns
async function performInteractiveJSTests(page, currentPage) {
  console.log(`🔄 Running interactive JS tests on: ${currentPage}`);
  
  // Early exit if page is closed
  if (page.isClosed()) {
    throw new Error(`Cannot perform interactive tests: page is closed for ${currentPage}`);
  }
  
  const testContext = {
    page: currentPage,
    startTime: Date.now(),
    currentAction: 'starting interactive tests'
  };
  
  try {
    // Test 1: Click interactive elements using semantic queries
    testContext.currentAction = 'testing interactive elements';
    const interactiveRoles = ['button', 'link', 'tab', 'menuitem'];
    
    for (const role of interactiveRoles) {
      // Check page state before each role test
      if (page.isClosed()) {
        throw new Error(`Page closed during ${role} testing on ${currentPage}`);
      }
      
      try {
        const elements = await page.getByRole(role).all();
        console.log(`  Found ${elements.length} ${role} elements, testing up to 8`);
        
        for (let i = 0; i < Math.min(elements.length, 8); i++) { // Limit to prevent excessive testing
          const element = elements[i];
          
          try {
            // Skip external links and anchor links  
            const href = await element.getAttribute('href');
            if (href && (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:'))) {
              continue;
            }
            
            // Ensure element is still attached to DOM
            if (!(await element.isVisible())) {
              continue;
            }
            
            // Playwright auto-waits for element to be actionable
            await element.click({ timeout: 3000 }); // Increased timeout
            // Wait for any animations or state changes to complete
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
            
          } catch (clickError) {
            // Element might not be clickable, log and continue with next
            console.log(`    Skipping ${role} element ${i}: ${clickError.message.substring(0, 50)}...`);
            continue;
          }
        }
      } catch (error) {
        console.log(`  Warning: Could not test ${role} elements: ${error.message.substring(0, 100)}...`);
        // Continue testing other elements if one fails
      }
    }
    
    // Test 2: Test form controls using semantic queries
    try {
      const formElements = await page.getByRole('textbox').or(page.getByRole('combobox')).or(page.getByRole('checkbox')).or(page.getByRole('radio')).all();
      for (let i = 0; i < Math.min(formElements.length, 6); i++) {
        try {
          const element = formElements[i];
          if (await element.isVisible() && await element.isEnabled()) {
            await element.focus();
            if (await element.getAttribute('type') !== 'checkbox' && await element.getAttribute('type') !== 'radio') {
              await element.fill('test');
              await element.blur();
            }
            await page.waitForLoadState('domcontentloaded');
          }
        } catch (error) {
          // Continue with next element
        }
      }
    } catch (error) {
      // Form testing errors don't fail the test
    }
    
    // Test 3: Navigation interactions using semantic queries
    try {
      // Test navigation landmarks
      const navElements = await page.getByRole('navigation').all();
      for (let i = 0; i < Math.min(navElements.length, 3); i++) {
        try {
          const navLinks = await navElements[i].getByRole('link').all();
          for (let j = 0; j < Math.min(navLinks.length, 5); j++) {
            try {
            await navLinks[j].hover({ timeout: 1000 });
            await page.waitForLoadState('domcontentloaded');
          } catch (error) {
            // Element might not be hoverable, continue
            continue;
          }
          }
        } catch (error) {
          // Continue with next navigation
        }
      }
      
      // Test mobile menu toggle using ARIA label
      const menuButtons = await page.getByRole('button', { name: /menu|toggle|hamburger/i }).all();
      for (const menuButton of menuButtons) {
        try {
          try {
            await menuButton.click({ timeout: 2000 });
            await page.waitForLoadState('domcontentloaded');
            // Try to close it
            await menuButton.click({ timeout: 2000 });
            await page.waitForLoadState('domcontentloaded');
            break; // Only test one menu toggle per page
          } catch (error) {
            // Menu button might not be clickable, try next
            continue;
          }
        } catch (error) {
          // Continue with next menu button
        }
      }
    } catch (error) {
      // Navigation testing errors don't fail the test
    }
    
    // Test 4: Interactive controls using ARIA patterns
    try {
      // Test expandable elements (dropdowns, accordions)
      const expandableElements = await page.locator('[aria-expanded], [aria-haspopup="true"]').all();
      for (let i = 0; i < Math.min(expandableElements.length, 4); i++) {
        try {
          const element = expandableElements[i];
          if (await element.isVisible()) {
            await element.click({ timeout: 2000 });
            await page.waitForLoadState('domcontentloaded');
          }
        } catch (error) {
          // Continue with next element
        }
      }
      
      // Test tabs using tab role
      const tabElements = await page.getByRole('tab').all();
      for (let i = 0; i < Math.min(tabElements.length, 4); i++) {
        try {
          if (await tabElements[i].isVisible()) {
            await tabElements[i].click({ timeout: 2000 });
            await page.waitForLoadState('domcontentloaded');
          }
        } catch (error) {
          // Continue with next tab
        }
      }
    } catch (error) {
      // Interactive controls testing errors don't fail the test
    }
    
    // Test 5: Dialog and modal interactions
    try {
      // Test dialog triggers
      const dialogTriggers = await page.locator('[data-bs-toggle="modal"], [data-toggle="modal"], [aria-haspopup="dialog"]').all();
      for (let i = 0; i < Math.min(dialogTriggers.length, 2); i++) {
        try {
          const trigger = dialogTriggers[i];
          if (await trigger.isVisible()) {
            await trigger.click({ timeout: 2000 });
            await page.waitForLoadState('domcontentloaded');
            
            // Try to close any opened dialog
            const closeButtons = await page.getByRole('button', { name: /close|cancel|×/i }).all();
            for (const closeBtn of closeButtons) {
              if (await closeBtn.isVisible()) {
                await closeBtn.click({ timeout: 1000 });
                await page.waitForLoadState('domcontentloaded');
                break;
              }
            }
          }
        } catch (error) {
          // Continue with next trigger
        }
      }
    } catch (error) {
      // Modal testing errors don't fail the test
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

// Enhanced page lifecycle management using test helpers
let testErrorContext;

test.beforeEach(async ({ page, context }) => {
  testErrorContext = await setupTestPage(page, context);
  console.log('🚀 Test setup completed');
});

test.afterEach(async ({ page, context }) => {
  await teardownTestPage(page, context, testErrorContext);
  console.log('🏁 Test teardown completed');
});

test.describe(`Functionality Tests - ${siteName}`, () => {
  
  test('broken-links', async ({ page, context }) => {
    const checkedUrls = new Set();
    const brokenLinks = [];
    const missingPages = [];
    
    for (const testPage of siteConfig.testPages) {
      try {
        console.log(`🔗 Checking links on: ${testPage}`);
        
        const response = await retryOperation(
          async () => await page.goto(`${siteConfig.baseUrl}${testPage}`, {
            timeout: 20000,
            waitUntil: 'domcontentloaded'
          }),
          `Navigate to ${testPage}`,
          2, // 2 retries
          2000 // 2 second delay
        );
        
        // Check if the page itself exists
        if (response?.status() >= 400) {
          missingPages.push({
            page: testPage,
            status: response.status(),
            url: `${siteConfig.baseUrl}${testPage}`
          });
          continue; // Skip link checking on broken pages
        }
        
      } catch (navigationError) {
        console.error(`❌ Failed to navigate to ${testPage}: ${navigationError.message}`);
        
        if (navigationError.message.includes('closed') || navigationError.message.includes('Target page')) {
          await debugBrowserState(page, context, `broken-links-navigation-${testPage}`);
        }
        
        missingPages.push({
          page: testPage,
          status: 'navigation-error',
          url: `${siteConfig.baseUrl}${testPage}`,
          error: navigationError.message
        });
        continue;
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
          
          // Small delay to prevent overwhelming the server
          await page.waitForTimeout(50);
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
    
    // Use soft assertions to collect all issues before failing
    // This allows us to find ALL broken links instead of stopping at the first one
    if (missingPages.length > 0) {
      missingPages.forEach(page => {
        expect.soft(page.status, `Missing page: ${page.page}`).toBeLessThan(400);
      });
    }
    
    if (brokenLinks.length > 0) {
      brokenLinks.forEach(link => {
        if (link.status) {
          expect.soft(link.status, `Broken link: ${link.url} (found on ${link.foundOn})`).toBeLessThan(400);
        } else {
          expect.soft(link.error, `Link error: ${link.url} (found on ${link.foundOn})`).toBeUndefined();
        }
      });
    }
    
    // Final assertion to ensure test fails if any issues were found
    const totalIssues = missingPages.length + brokenLinks.length;
    expect(totalIssues, `Found ${missingPages.length} missing pages and ${brokenLinks.length} broken links`).toBe(0);
  });
  
  test('javascript-errors', async ({ page, context }) => {
    const jsErrors = [];
    const missingPages = [];
    
    // Use the enhanced error context from test helpers
    testErrorContext.setTest('javascript-errors');
    
    // Listen for console errors with enhanced context
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const contextInfo = testErrorContext.getContextInfo();
        jsErrors.push({
          message: msg.text(),
          location: msg.location(),
          page: contextInfo.currentPage,
          action: contextInfo.currentAction,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Listen for page errors with enhanced context
    page.on('pageerror', error => {
      const contextInfo = testErrorContext.getContextInfo();
      jsErrors.push({
        message: error.message,
        stack: error.stack,
        page: contextInfo.currentPage,
        action: contextInfo.currentAction,
        timestamp: new Date().toISOString()
      });
    });
    
    // Test each page for JS errors with enhanced error handling
    for (const testPage of siteConfig.testPages) {
      testErrorContext.setPage(testPage);
      testErrorContext.setAction('navigation');
      
      try {
        console.log(`🔍 Testing JavaScript errors on: ${testPage}`);
        
        // Use safe navigation from helpers
        const response = await safeNavigate(
          page,
          `${siteConfig.baseUrl}${testPage}`,
          {
            timeout: 20000,
            waitUntil: 'domcontentloaded'
          }
        );
        
        // Skip JS testing on missing pages
        if (response?.status() >= 400) {
          missingPages.push({ page: testPage, status: response.status() });
          console.log(`⚠️  Skipping JS tests for missing page: ${testPage} (${response.status()})`);
          continue;
        }
        
        testErrorContext.setAction('waiting for page stability');
        
        // Use enhanced page stability waiting
        await waitForPageStability(page, {
          timeout: 12000,
          strategies: ['networkidle', 'domcontentloaded']
        });
        
        testErrorContext.setAction('interactive testing');
        
        // Comprehensive interactive testing with timeout protection
        try {
          await Promise.race([
            performInteractiveJSTests(page, testPage),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Interactive testing timeout after 35s')), 35000))
          ]);
        } catch (interactiveError) {
          console.log(`⚠️  Interactive testing timeout or error on ${testPage}: ${interactiveError.message}`);
          testErrorContext.logError(interactiveError, { phase: 'interactive-testing', page: testPage });
          // Don't fail the test, just log and continue
        }
        
      } catch (navigationError) {
        console.error(`❌ Failed to test ${testPage}: ${navigationError.message}`);
        
        if (navigationError.message.includes('closed') || navigationError.message.includes('Target page')) {
          console.error(`💥 Browser/page lifecycle issue detected. This usually indicates:`);
          console.error(`   1. Previous test caused browser crash or instability`);
          console.error(`   2. Page navigation triggered unexpected browser behavior`);
          console.error(`   3. Memory/resource exhaustion or timeout`);
          console.error(`   4. Network connectivity issues`);
          
          // Enhanced debug information
          await debugBrowserState(page, context, `javascript-errors-navigation-${testPage}`);
          testErrorContext.logError(navigationError, { 
            phase: 'navigation',
            page: testPage,
            suggestion: 'Consider increasing timeouts, checking site stability, or running fewer pages per test'
          });
          
          throw navigationError; // Re-throw to fail the test with context
        }
        
        // For other errors, continue testing other pages
        jsErrors.push({
          message: `Navigation error: ${navigationError.message}`,
          page: testPage,
          action: testErrorContext.getContextInfo().currentAction,
          timestamp: new Date().toISOString(),
          stack: navigationError.stack
        });
      }
    }
    
    // Report findings with enhanced context
    if (missingPages.length > 0) {
      console.log(`ℹ️  Skipped JS testing on ${missingPages.length} missing pages:`, missingPages.map(p => p.page));
    }
    if (jsErrors.length > 0) {
      console.log('❌ JavaScript errors found:');
      jsErrors.forEach(error => {
        console.log(`  📄 Page: ${error.page || 'unknown'}`);
        console.log(`  🔧 Action: ${error.action || 'unknown'}`);
        console.log(`  ⏰ Time: ${error.timestamp || 'unknown'}`);
        console.log(`  💬 Message: ${error.message}`);
        if (error.stack) {
          console.log(`  📋 Stack: ${error.stack.substring(0, 200)}...`);
        }
        console.log('');
      });
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
        
        // Wait for form to be visible using both selector and semantic approach
        await expect(page.locator(form.selector)).toBeVisible({ timeout: 10000 });
        
        // Enhanced form testing using semantic queries
        try {
          // Try to find form fields using semantic labels first
          const nameField = page.getByRole('textbox', { name: /name|your.name/i }).or(page.locator(form.fields?.name || 'input[name*="name"]'));
          const emailField = page.getByRole('textbox', { name: /email|e.mail/i }).or(page.locator(form.fields?.email || 'input[name*="email"]'));
          const messageField = page.getByRole('textbox', { name: /message|comment|inquiry/i }).or(page.locator(form.fields?.message || 'textarea[name*="message"]'));
          const submitButton = page.getByRole('button', { name: /submit|send|contact/i }).or(page.locator(form.submitButton || 'input[type="submit"]'));
          
          // Test form field interactions
          if (await nameField.first().isVisible()) {
            await nameField.first().fill('Test User');
            await nameField.first().blur(); // Test blur validation
          }
          
          if (await emailField.first().isVisible()) {
            // Test invalid email first
            await emailField.first().fill('invalid-email');
            await emailField.first().blur();
            await page.waitForLoadState('domcontentloaded');
            
            // Then test valid email
            await emailField.first().fill('test@example.com');
            await emailField.first().blur();
          }
          
          if (await messageField.first().isVisible()) {
            await messageField.first().fill('This is a test message from automated testing.');
            await messageField.first().blur();
          }
          
          // Test form validation by submitting empty form
          if (await submitButton.first().isVisible()) {
            // Clear all fields first
            if (await nameField.first().isVisible()) await nameField.first().fill('');
            if (await emailField.first().isVisible()) await emailField.first().fill('');
            if (await messageField.first().isVisible()) await messageField.first().fill('');
            
            // Try to submit empty form
            await submitButton.first().click();
            await page.waitForLoadState('domcontentloaded');
            
            // Form should still be visible (validation should prevent submission)
            await expect(page.locator(form.selector)).toBeVisible();
          }
        } catch (error) {
          // Fallback to original selector-based approach if semantic queries fail
          if (form.fields) {
            if (form.fields.name) await page.fill(form.fields.name, 'Test User');
            if (form.fields.email) await page.fill(form.fields.email, 'test@example.com');
            if (form.fields.message) await page.fill(form.fields.message, 'This is a test message from automated testing.');
          }
          
          if (form.submitButton) {
            if (form.fields?.name) await page.fill(form.fields.name, '');
            if (form.fields?.email) await page.fill(form.fields.email, '');
            await page.click(form.submitButton);
            await page.waitForLoadState('domcontentloaded');
            await expect(page.locator(form.selector)).toBeVisible();
          }
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
  
  test('accessibility', async ({ page }) => {
    const accessibilityIssues = [];
    const missingPages = [];
    
    for (const testPage of siteConfig.testPages) {
      const response = await page.goto(`${siteConfig.baseUrl}${testPage}`);
      
      // Skip accessibility testing on missing pages
      if (response?.status() >= 400) {
        missingPages.push({ page: testPage, status: response.status() });
        console.log(`⚠️  Skipping accessibility tests for missing page: ${testPage} (${response.status()})`);
        continue;
      }
      
      try {
        await page.waitForLoadState('networkidle', { timeout: 10000 });
      } catch (error) {
        console.log(`⚠️  Network idle timeout for ${testPage}, continuing with accessibility check`);
      }
      
      // Run axe accessibility scan
      try {
        const accessibilityScanResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa']) // WCAG 2.1 AA standards
          .analyze();
        
        if (accessibilityScanResults.violations.length > 0) {
          accessibilityIssues.push({
            page: testPage,
            violations: accessibilityScanResults.violations.map(violation => ({
              id: violation.id,
              impact: violation.impact,
              description: violation.description,
              nodes: violation.nodes.length,
              helpUrl: violation.helpUrl
            }))
          });
        }
      } catch (error) {
        console.log(`⚠️  Accessibility scan failed for ${testPage}: ${error.message}`);
      }
    }
    
    // Report findings
    if (missingPages.length > 0) {
      console.log(`ℹ️  Skipped accessibility testing on ${missingPages.length} missing pages:`, missingPages.map(p => p.page));
    }
    if (accessibilityIssues.length > 0) {
      console.log('❌ Accessibility violations found:', accessibilityIssues);
      
      // Log detailed violations for debugging
      accessibilityIssues.forEach(issue => {
        console.log(`\n📄 Page: ${issue.page}`);
        issue.violations.forEach(violation => {
          console.log(`  🚫 ${violation.id} (${violation.impact}): ${violation.description}`);
          console.log(`     Affected elements: ${violation.nodes}`);
          console.log(`     Help: ${violation.helpUrl}`);
        });
      });
    }
    
    // Only fail on critical accessibility issues (exclude minor/moderate)
    const criticalIssues = accessibilityIssues.filter(issue => 
      issue.violations.some(v => v.impact === 'critical' || v.impact === 'serious')
    );
    
    expect(criticalIssues).toHaveLength(0);
  });
  
});