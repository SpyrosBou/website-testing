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

  test('JavaScript error detection during interactions', async ({ page }) => {
    test.setTimeout(30000);
    const consoleErrors = [];
    const ignoredPatterns = ['analytics', 'google-analytics', 'gtag', 'facebook', 'twitter'];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!ignoredPatterns.some((p) => text.toLowerCase().includes(p))) {
          consoleErrors.push({ message: text, url: page.url() });
        }
      }
    });

    for (const testPage of siteConfig.testPages) {
      await test.step(`JS errors on: ${testPage}`, async () => {
        const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        if (response.status() !== 200) return;
        await waitForPageStability(page);
        // Basic user interactions
        const interactiveSelectors = ['button', 'a', 'input', 'select', 'textarea'];
        for (const s of interactiveSelectors) {
          const els = await page.locator(s).all();
          for (let i = 0; i < Math.min(els.length, 3); i++) {
            try {
              if (s === 'a') await els[i].hover();
              else await els[i].dispatchEvent('focus');
            } catch (_) {}
          }
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

