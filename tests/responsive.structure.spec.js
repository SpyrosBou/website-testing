const { test, expect } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');
const {
  setupTestPage,
  teardownTestPage,
  safeNavigate,
  waitForPageStability,
  safeElementInteraction,
} = require('../utils/test-helpers');
const { WordPressPageObjects } = require('../utils/wordpress-page-objects');

const VIEWPORTS = {
  mobile: { width: 375, height: 667, name: 'mobile' },
  tablet: { width: 768, height: 1024, name: 'tablet' },
  desktop: { width: 1920, height: 1080, name: 'desktop' },
};

const PERFORMANCE_THRESHOLDS = { mobile: 3000, tablet: 2500, desktop: 2000 };

test.describe('Responsive Structure & UX', () => {
  let siteConfig;
  let errorContext;
  let wp;

  test.beforeEach(async ({ page, context }) => {
    const siteName = process.env.SITE_NAME;
    if (!siteName) throw new Error('SITE_NAME environment variable is required');
    siteConfig = SiteLoader.loadSite(siteName);
    SiteLoader.validateSiteConfig(siteConfig);
    errorContext = await setupTestPage(page, context);
    wp = new WordPressPageObjects(page, siteConfig);
  });

  test.afterEach(async ({ page, context }) => {
    await teardownTestPage(page, context, errorContext);
  });

  Object.entries(VIEWPORTS).forEach(([viewportName, viewport]) => {
    test.describe(`Layout & critical elements - ${viewportName}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      });

      test(`Layout and critical elements - ${viewportName}`, async ({ page }) => {
        test.setTimeout(45000);
        const pagesToTest = process.env.SMOKE
          ? siteConfig.testPages.slice(0, 1)
          : siteConfig.testPages;

        for (const testPage of pagesToTest) {
          await test.step(`Structure ${viewportName}: ${testPage}`, async () => {
            const startTime = Date.now();
            const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
            if (response.status() !== 200) return;
            await waitForPageStability(page, { timeout: 15000 });

            const loadTime = Date.now() - startTime;
            const threshold = PERFORMANCE_THRESHOLDS[viewportName];
            if (loadTime > threshold) {
              console.log(
                `⚠️  ${viewportName} load time ${loadTime}ms exceeds threshold ${threshold}ms for ${testPage}`
              );
            } else {
              console.log(`✅ ${viewportName} load time ${loadTime}ms within threshold for ${testPage}`);
            }

            // Critical elements via page objects
            const critical = await wp.verifyCriticalElements();
            expect.soft(critical.header).toBe(true);

            if (viewportName === 'mobile') {
              const mobileNavSelectors = [
                '.mobile-menu',
                '.hamburger',
                '.menu-toggle',
                '.navbar-toggler',
                '.menu-button',
                '[aria-label*="menu"]',
              ];
              let mobileNavFound = false;
              for (const s of mobileNavSelectors) {
                if (await page.locator(s).isVisible()) {
                  mobileNavFound = true;
                  try {
                    await safeElementInteraction(page.locator(s).first(), 'click', { timeout: 3000 });
                    await page.waitForTimeout(400);
                  } catch (_) {}
                  break;
                }
              }
              if (!mobileNavFound) {
                const nav = await wp.verifyCriticalElements();
                expect.soft(nav.navigation).toBe(true);
              }
            } else {
              const nav = await wp.verifyCriticalElements();
              expect.soft(nav.navigation).toBe(true);
            }
            const again = await wp.verifyCriticalElements();
            expect.soft(again.content).toBe(true);
            expect.soft(again.footer).toBe(true);

            // Optional basic form visibility/touch checks on mobile
            if (viewportName === 'mobile' && siteConfig.forms && siteConfig.forms.length > 0) {
              const formPage = siteConfig.forms[0].page || testPage;
              if (testPage === formPage) {
                const formSelector = siteConfig.forms[0].selector || '.wpcf7-form, .contact-form, form';
                if (await page.locator(formSelector).isVisible()) {
                  const fields = await page.locator(`${formSelector} input, ${formSelector} textarea`).all();
                  for (let i = 0; i < Math.min(fields.length, 3); i++) {
                    try {
                      await fields[i].tap({ timeout: 1500 });
                    } catch (_) {}
                  }
                }
              }
            }
          });
        }
      });
    });
  });

  test.describe('Cross-Viewport Consistency', () => {
    test('Content hierarchy consistency across viewports', async ({ page }) => {
      test.setTimeout(30000);

      const testPage = siteConfig.testPages[0];
      const contentStructure = {};
      for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
        await test.step(`Analyzing ${viewportName}`, async () => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
          if (response.status() !== 200) return;
          await waitForPageStability(page);

          const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
          contentStructure[viewportName] = {
            headingCount: headings.length,
            headings: headings.slice(0, 5),
            hasNav: await page.locator('nav').isVisible(),
            hasMain: await page.locator('main').isVisible(),
            hasFooter: await page.locator('footer').isVisible(),
          };
        });
      }

      const names = Object.keys(contentStructure);
      if (names.length > 1) {
        const base = contentStructure[names[0]];
        for (let i = 1; i < names.length; i++) {
          const cmp = contentStructure[names[i]];
          const diff = Math.abs(base.headingCount - cmp.headingCount);
          if (diff > 2) console.log(`⚠️  Significant heading count difference between ${names[0]} and ${names[i]}`);
          expect.soft(cmp.hasNav).toBe(base.hasNav);
          expect.soft(cmp.hasMain).toBe(base.hasMain);
          expect.soft(cmp.hasFooter).toBe(base.hasFooter);
        }
      }
    });
  });

  test.describe('WordPress-Specific Responsive Features', () => {
    test('WordPress theme responsive patterns', async ({ page }) => {
      test.setTimeout(30000);
      for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
        await test.step(`WP features: ${viewportName}`, async () => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          const response = await safeNavigate(page, siteConfig.baseUrl);
          if (response.status() !== 200) return;
          await waitForPageStability(page);

          const hasWpResponsive = await page
            .locator('[class*="wp-block"], [class*="responsive"]')
            .isVisible();
          if (hasWpResponsive) console.log(`✅ WordPress responsive elements detected on ${viewportName}`);

          const blockElements = await page.locator('[class*="wp-block-"]').count();
          if (blockElements > 0) console.log(`📊 ${blockElements} Gutenberg blocks found on ${viewportName}`);

          const widgets = await page.locator('.widget').count();
          if (widgets > 0) console.log(`📊 ${widgets} widgets found on ${viewportName}`);
        });
      }
    });
  });
});
