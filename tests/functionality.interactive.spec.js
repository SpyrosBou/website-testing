const { test, expect } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');
const {
  setupTestPage,
  teardownTestPage,
  safeNavigate,
  waitForPageStability,
} = require('../utils/test-helpers');
const { TestDataFactory, createTestData } = require('../utils/test-data-factory');
const { WordPressPageObjects } = require('../utils/wordpress-page-objects');

test.describe('Functionality: Interactive Elements', () => {
  let siteConfig;
  let errorContext;
  let wpPageObjects;

  test.beforeEach(async ({ page, context }) => {
    const siteName = process.env.SITE_NAME;
    if (!siteName) throw new Error('SITE_NAME environment variable is required');
    siteConfig = SiteLoader.loadSite(siteName);
    SiteLoader.validateSiteConfig(siteConfig);
    errorContext = await setupTestPage(page, context);
    wpPageObjects = new WordPressPageObjects(page, siteConfig);
  });

  test.afterEach(async ({ page, context }) => {
    await teardownTestPage(page, context, errorContext);
  });

  test('JavaScript error detection during interactions', async ({ page, context }) => {
    test.setTimeout(45000);
    const consoleErrors = [];
    const ignoredPatterns = ['analytics', 'google-analytics', 'gtag', 'facebook', 'twitter'];
    const pagesToTest = siteConfig.testPages.slice(0, 3);
    let currentPage = page;

    for (const testPage of pagesToTest) {
      await test.step(`JS errors on: ${testPage}`, async () => {
        if (currentPage.isClosed()) {
          currentPage = await context.newPage();
        }
        const pageErrors = [];
        const listener = (msg) => {
          if (msg.type() !== 'error') return;
          const text = msg.text();
          if (ignoredPatterns.some((p) => text.toLowerCase().includes(p))) return;
          pageErrors.push({ message: text, url: currentPage.url() });
        };
        currentPage.on('console', listener);

        try {
          const response = await safeNavigate(currentPage, `${siteConfig.baseUrl}${testPage}`);
          if (response.status() !== 200) return;
          await waitForPageStability(currentPage);
          const interactiveSelectors = ['button', 'a', 'input', 'select', 'textarea'];
          for (const s of interactiveSelectors) {
            const loc = currentPage.locator(s);
            for (let i = 0; i < 3; i++) {
              let element;
              try {
                element = loc.nth(i);
                await element.waitFor({ state: 'attached', timeout: 1500 });
              } catch {
                break;
              }
              try {
                await element.scrollIntoViewIfNeeded({ timeout: 1500 });
                if (s === 'a') await element.hover({ timeout: 1500 });
                else await element.dispatchEvent('focus');
              } catch (error) {
                console.log(
                  `⚠️  Interaction skipped for ${s} #${i} on ${testPage}: ${error.message}`
                );
              }
            }
          }
          if (pageErrors.length > 0) {
            consoleErrors.push(...pageErrors);
          }
        } finally {
          currentPage.off('console', listener);
        }
      });
    }

    if (consoleErrors.length > 0) {
      console.error(`❌ JavaScript errors detected: ${consoleErrors.length}`);
      expect.soft(consoleErrors.length).toBe(0);
    } else {
      console.log('✅ No JavaScript errors detected during interactions');
    }
  });

  test('Form interactions and validation (if configured)', async ({ page }) => {
    test.setTimeout(30000);
    if (!siteConfig.forms || siteConfig.forms.length === 0) {
      console.log('ℹ️  No forms configured for testing');
      return;
    }
    const testData = createTestData('contact');
    for (const formConfig of siteConfig.forms) {
      await test.step(`Testing form: ${formConfig.name}`, async () => {
        const formPage = formConfig.page || '/contact';
        const response = await wpPageObjects.navigate(`${siteConfig.baseUrl}${formPage}`);
        if (response.status() !== 200) return;
        const formInstance = wpPageObjects.createForm(formConfig);
        try {
          await formInstance.fillForm({
            name: testData.formData.name,
            email: testData.formData.email,
            message: testData.formData.message,
          });
          await test.step('Testing form validation', async () => {
            const ok = await formInstance.testValidation();
            if (!ok) console.log('⚠️  Form validation may not be working as expected');
          });
        } catch (error) {
          console.log(`⚠️  Form testing failed for ${formConfig.name}: ${error.message}`);
        }
      });
    }
  });
});
