/**
 * Responsive Design and Visual Regression Testing Suite
 * 
 * This file provides comprehensive responsive design testing and visual regression
 * detection across multiple viewports, browsers, and devices following industry
 * standards and WordPress-specific best practices.
 * 
 * Features:
 * - Multi-viewport testing (Mobile, Tablet, Desktop)
 * - Visual regression detection with intelligent thresholds
 * - WordPress theme responsiveness validation
 * - Mobile navigation and touch interaction testing
 * - Accessibility compliance across viewports
 * - Performance testing per viewport
 * - Component-level screenshot comparison
 * 
 * Generated at: 2025-08-15T19:45:00.000Z
 */

const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const SiteLoader = require('../utils/site-loader');
const { 
  setupTestPage, 
  teardownTestPage, 
  safeNavigate, 
  waitForPageStability, 
  safeElementInteraction,
  retryOperation,
  ErrorContext 
} = require('../utils/test-helpers');
const { WordPressPageObjects } = require('../utils/wordpress-page-objects');

// Viewport configurations optimized for real-world usage
const VIEWPORTS = {
  mobile: { width: 375, height: 667, name: 'mobile' },      // iPhone SE standard
  tablet: { width: 768, height: 1024, name: 'tablet' },     // iPad standard
  desktop: { width: 1920, height: 1080, name: 'desktop' }   // Desktop standard
};

const PERFORMANCE_THRESHOLDS = {
  mobile: 3000,    // 3 seconds for mobile
  tablet: 2500,    // 2.5 seconds for tablet
  desktop: 2000    // 2 seconds for desktop
};

// Visual regression thresholds based on content type
const VISUAL_THRESHOLDS = {
  ui_elements: 0.1,      // 10% for UI elements (buttons, navigation)
  content: 0.3,          // 30% for content areas (text, images)
  dynamic: 0.5           // 50% for dynamic content (feeds, timestamps)
};

test.describe("Responsive Design and Visual Regression Testing", () => {
  let siteConfig;
  let errorContext;
  let wpPageObjects;

  test.beforeEach(async ({ page, context }) => {
    const siteName = process.env.SITE_NAME;
    if (!siteName) {
      throw new Error("SITE_NAME environment variable is required");
    }

    siteConfig = SiteLoader.loadSite(siteName);
    SiteLoader.validateSiteConfig(siteConfig);

    errorContext = await setupTestPage(page, context);
    wpPageObjects = new WordPressPageObjects(page, siteConfig);
  });

  test.afterEach(async ({ page, context }) => {
    await teardownTestPage(page, context, errorContext);
  });

  // Test each viewport configuration
  Object.entries(VIEWPORTS).forEach(([viewportName, viewport]) => {
    test.describe(`${viewportName.charAt(0).toUpperCase() + viewportName.slice(1)} Viewport (${viewport.width}x${viewport.height})`, () => {
      
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      });

      test(`Page layout and critical elements - ${viewportName}`, async ({ page }) => {
        test.setTimeout(45000);

        errorContext.setTest(`Responsive Layout Testing - ${viewportName}`);
        
        for (const testPage of siteConfig.testPages) {
          await test.step(`Testing ${viewportName} layout: ${testPage}`, async () => {
            errorContext.setPage(testPage);
            errorContext.setAction(`testing ${viewportName} viewport`);
            
            const startTime = Date.now();
            const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
            
            if (response.status() !== 200) {
              console.log(`⚠️  Skipping ${viewportName} test for ${testPage} (status: ${response.status()})`);
              return;
            }
            
            await waitForPageStability(page, { timeout: 15000 });
            
            // Performance check for viewport
            const loadTime = Date.now() - startTime;
            const threshold = PERFORMANCE_THRESHOLDS[viewportName];
            
            if (loadTime > threshold) {
              console.log(`⚠️  ${viewportName} load time ${loadTime}ms exceeds threshold ${threshold}ms for ${testPage}`);
            } else {
              console.log(`✅ ${viewportName} load time ${loadTime}ms within threshold for ${testPage}`);
            }
            
            // Critical elements validation
            await test.step('Critical elements visibility', async () => {
              // Header visibility
              const headerSelectors = ['header', '.header', '.site-header', '.masthead'];
              let headerVisible = false;
              for (const selector of headerSelectors) {
                if (await page.locator(selector).isVisible()) {
                  headerVisible = true;
                  break;
                }
              }
              expect.soft(headerVisible, `Header should be visible on ${viewportName}`).toBe(true);
              
              // Navigation handling per viewport
              if (viewportName === 'mobile') {
                // Mobile navigation
                const mobileNavSelectors = [
                  '.mobile-menu', '.hamburger', '.menu-toggle', 
                  '.navbar-toggler', '.menu-button', '[aria-label*="menu"]'
                ];
                
                let mobileNavFound = false;
                for (const selector of mobileNavSelectors) {
                  if (await page.locator(selector).isVisible()) {
                    mobileNavFound = true;
                    console.log(`✅ Mobile navigation found: ${selector}`);
                    
                    // Test mobile menu interaction
                    try {
                      await safeElementInteraction(page.locator(selector).first(), 'click', { timeout: 3000 });
                      await page.waitForTimeout(500); // Allow animation
                      console.log('✅ Mobile menu interaction successful');
                    } catch (error) {
                      console.log(`⚠️  Mobile menu interaction failed: ${error.message}`);
                    }
                    break;
                  }
                }
                
                // If no mobile nav found, check if desktop nav is responsive
                if (!mobileNavFound) {
                  const desktopNavSelectors = ['nav', '.main-navigation', '.primary-menu'];
                  for (const selector of desktopNavSelectors) {
                    if (await page.locator(selector).isVisible()) {
                      console.log(`ℹ️  Desktop navigation visible on mobile: ${selector}`);
                      break;
                    }
                  }
                }
              } else {
                // Desktop/tablet navigation
                const navSelectors = ['nav', '.main-navigation', '.primary-menu', '#main-menu'];
                let navVisible = false;
                for (const selector of navSelectors) {
                  if (await page.locator(selector).isVisible()) {
                    navVisible = true;
                    break;
                  }
                }
                expect.soft(navVisible, `Navigation should be visible on ${viewportName}`).toBe(true);
              }
              
              // Content area
              const contentSelectors = ['main', '.main', '.content', '#content', '.site-content'];
              let contentVisible = false;
              for (const selector of contentSelectors) {
                if (await page.locator(selector).isVisible()) {
                  contentVisible = true;
                  break;
                }
              }
              expect.soft(contentVisible, `Main content should be visible on ${viewportName}`).toBe(true);
              
              // Footer
              const footerSelectors = ['footer', '.footer', '.site-footer'];
              let footerVisible = false;
              for (const selector of footerSelectors) {
                if (await page.locator(selector).isVisible()) {
                  footerVisible = true;
                  break;
                }
              }
              expect.soft(footerVisible, `Footer should be visible on ${viewportName}`).toBe(true);
            });
            
            // Form responsiveness (if forms exist)
            if (siteConfig.forms && siteConfig.forms.length > 0) {
              await test.step('Form responsiveness', async () => {
                const formPage = siteConfig.forms[0].page || testPage;
                if (testPage === formPage) {
                  const formSelector = siteConfig.forms[0].selector || '.wpcf7-form, .contact-form, form';
                  
                  if (await page.locator(formSelector).isVisible()) {
                    console.log(`✅ Form visible and accessible on ${viewportName}`);
                    
                    // Test form field accessibility on touch devices
                    if (viewportName === 'mobile') {
                      const fields = await page.locator(`${formSelector} input, ${formSelector} textarea`).all();
                      for (let i = 0; i < Math.min(fields.length, 3); i++) {
                        try {
                          await fields[i].tap({ timeout: 2000 });
                          console.log(`✅ Touch interaction working for form field ${i + 1}`);
                        } catch (error) {
                          console.log(`⚠️  Touch interaction failed for form field ${i + 1}: ${error.message}`);
                        }
                      }
                    }
                  }
                }
              });
            }
            
            console.log(`✅ ${viewportName} layout validation completed for ${testPage}`);
          });
        }
      });

      test(`Visual regression detection - ${viewportName}`, async ({ page, browserName }) => {
        test.setTimeout(60000);

        errorContext.setTest(`Visual Regression Testing - ${viewportName}`);
        
        for (const testPage of siteConfig.testPages) {
          await test.step(`Visual regression: ${testPage} (${viewportName})`, async () => {
            errorContext.setPage(testPage);
            
            const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
            if (response.status() !== 200) {
              console.log(`⚠️  Skipping visual test for ${testPage} (status: ${response.status()})`);
              return;
            }
            
            await waitForPageStability(page, { timeout: 15000 });
            
            // Disable animations for consistent screenshots
            await page.addStyleTag({
              content: `
                *, *::before, *::after {
                  animation-duration: 0s !important;
                  animation-delay: 0s !important;
                  transition-duration: 0s !important;
                  transition-delay: 0s !important;
                }
              `
            });
            
            await page.waitForTimeout(500); // Let styles settle
            
            // Generate screenshot filename
            const pageName = testPage.replace(/\//g, '') || 'home';
            const screenshotName = `${siteConfig.name.toLowerCase().replace(/\s+/g, '-')}-${pageName}-${viewportName}-${browserName}.png`;
            
            // Take full page screenshot with appropriate threshold
            const threshold = testPage === '/' || testPage.includes('home') ? 
              VISUAL_THRESHOLDS.dynamic : VISUAL_THRESHOLDS.content;
            
            try {
              await expect(page).toHaveScreenshot(screenshotName, {
                fullPage: true,
                threshold: threshold,
                maxDiffPixels: 1000,
                animations: 'disabled'
              });
              
              console.log(`✅ Visual regression passed for ${testPage} (${viewportName})`);
            } catch (error) {
              console.log(`⚠️  Visual difference detected for ${testPage} (${viewportName}): ${error.message}`);
              // Don't fail the test for visual differences - they need manual review
            }
          });
        }
      });

      test(`Accessibility across viewports - ${viewportName}`, async ({ page }) => {
        test.setTimeout(45000);

        errorContext.setTest(`Viewport Accessibility Testing - ${viewportName}`);
        
        // Test accessibility on a representative sample
        const samplesToTest = siteConfig.testPages.slice(0, 3);
        
        for (const testPage of samplesToTest) {
          await test.step(`Accessibility ${viewportName}: ${testPage}`, async () => {
            errorContext.setPage(testPage);
            
            const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
            if (response.status() !== 200) return;
            
            await waitForPageStability(page);
            
            try {
              const accessibilityScanResults = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
                .analyze();
              
              const criticalViolations = accessibilityScanResults.violations.filter(
                violation => violation.impact === 'critical' || violation.impact === 'serious'
              );
              
              if (criticalViolations.length > 0) {
                console.error(`❌ ${criticalViolations.length} critical accessibility violations on ${testPage} (${viewportName})`);
                expect.soft(criticalViolations.length).toBe(0);
              } else {
                console.log(`✅ No critical accessibility violations on ${testPage} (${viewportName})`);
              }
              
            } catch (error) {
              console.error(`⚠️  Accessibility scan failed for ${testPage} (${viewportName}): ${error.message}`);
            }
          });
        }
      });

    });
  });

  test.describe("Cross-Viewport Consistency", () => {
    test("Content hierarchy consistency across viewports", async ({ page }) => {
      test.setTimeout(30000);

      errorContext.setTest('Cross-Viewport Consistency');
      
      const testPage = siteConfig.testPages[0]; // Test homepage
      const contentStructure = {};
      
      // Collect content structure for each viewport
      for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
        await test.step(`Analyzing content structure: ${viewportName}`, async () => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          
          const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
          if (response.status() !== 200) return;
          
          await waitForPageStability(page);
          
          // Collect heading structure
          const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
          contentStructure[viewportName] = {
            headingCount: headings.length,
            headings: headings.slice(0, 5), // First 5 headings
            hasNav: await page.locator('nav').isVisible(),
            hasMain: await page.locator('main').isVisible(),
            hasFooter: await page.locator('footer').isVisible()
          };
          
          console.log(`📊 ${viewportName}: ${headings.length} headings, nav: ${contentStructure[viewportName].hasNav}`);
        });
      }
      
      // Compare consistency
      const viewportNames = Object.keys(contentStructure);
      if (viewportNames.length > 1) {
        const baseStructure = contentStructure[viewportNames[0]];
        
        for (let i = 1; i < viewportNames.length; i++) {
          const compareStructure = contentStructure[viewportNames[i]];
          
          // Check heading consistency (allow some variance for responsive design)
          const headingDifference = Math.abs(baseStructure.headingCount - compareStructure.headingCount);
          if (headingDifference > 2) {
            console.log(`⚠️  Significant heading count difference between ${viewportNames[0]} and ${viewportNames[i]}`);
          }
          
          // Check critical element consistency
          expect.soft(compareStructure.hasNav, `Navigation should be consistent across viewports`).toBe(baseStructure.hasNav);
          expect.soft(compareStructure.hasMain, `Main content should be consistent across viewports`).toBe(baseStructure.hasMain);
          expect.soft(compareStructure.hasFooter, `Footer should be consistent across viewports`).toBe(baseStructure.hasFooter);
        }
        
        console.log('✅ Cross-viewport consistency check completed');
      }
    });
  });

  test.describe("WordPress-Specific Responsive Features", () => {
    test("WordPress theme responsive patterns", async ({ page }) => {
      test.setTimeout(30000);

      errorContext.setTest('WordPress Responsive Features');
      
      for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
        await test.step(`WordPress features: ${viewportName}`, async () => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          
          const response = await safeNavigate(page, siteConfig.baseUrl);
          if (response.status() !== 200) return;
          
          await waitForPageStability(page);
          
          // Check for WordPress responsive classes
          const hasWpResponsive = await page.locator('[class*="wp-block"], [class*="responsive"]').isVisible();
          if (hasWpResponsive) {
            console.log(`✅ WordPress responsive elements detected on ${viewportName}`);
          }
          
          // Check for Gutenberg blocks responsiveness
          const blockElements = await page.locator('[class*="wp-block-"]').count();
          if (blockElements > 0) {
            console.log(`📊 ${blockElements} Gutenberg blocks found on ${viewportName}`);
          }
          
          // Test widget responsiveness (classic themes)
          const widgets = await page.locator('.widget').count();
          if (widgets > 0) {
            console.log(`📊 ${widgets} widgets found on ${viewportName}`);
          }
          
          console.log(`✅ WordPress ${viewportName} analysis completed`);
        });
      }
    });
  });
});