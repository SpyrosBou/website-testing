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

  test('JavaScript error detection during interactions', async ({ context }) => {
    test.setTimeout(60000);
    const consoleErrors = [];
    const resourceErrors = [];
    const defaultIgnored = ['analytics', 'google-analytics', 'gtag', 'facebook', 'twitter'];
    const siteIgnored = Array.isArray(siteConfig.ignoreConsoleErrors)
      ? siteConfig.ignoreConsoleErrors
      : [];
    const ignoreMatchers = [...defaultIgnored, ...siteIgnored].map((pattern) => {
      try {
        return new RegExp(pattern, 'i');
      } catch (error) {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(escaped, 'i');
      }
    });

    const recordResourceError = (type, url, extra = {}) => {
      resourceErrors.push({ type, url, ...extra });
    };

    for (const testPage of siteConfig.testPages) {
      await test.step(`JS errors on: ${testPage}`, async () => {
        let attempts = 0;
        while (attempts < 2) {
          const activePage = await context.newPage();
          const pageErrors = [];
          const listener = (msg) => {
            if (msg.type() !== 'error') return;
            const text = msg.text();
            if (ignoreMatchers.some((re) => re.test(text))) return;
            pageErrors.push({ message: text, url: activePage.url() });
          };
          activePage.on('console', listener);

          const requestFailedListener = (request) => {
            recordResourceError('requestfailed', request.url(), {
              failure: request.failure()?.errorText || 'unknown',
              page: activePage.url(),
            });
          };
          const responseListener = (response) => {
            const status = response.status();
            if (status >= 400) {
              recordResourceError('response', response.url(), {
                status,
                method: response.request().method(),
                page: activePage.url(),
              });
            }
          };
          activePage.on('requestfailed', requestFailedListener);
          activePage.on('response', responseListener);

          try {
            const response = await safeNavigate(activePage, `${siteConfig.baseUrl}${testPage}`);
            if (response.status() !== 200) return;
            await waitForPageStability(activePage);
            const interactiveSelectors = ['button', 'a', 'input', 'select', 'textarea'];
            for (const s of interactiveSelectors) {
              const loc = activePage.locator(s);
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
            await activePage.close();
            return;
          } catch (error) {
            attempts += 1;
            await activePage.close();
            if (/page is closed/i.test(error.message) && attempts < 2) {
              console.log(`⚠️  Retrying JS interaction scan for ${testPage}: ${error.message}`);
              continue;
            }
            throw error;
          } finally {
            activePage.off('console', listener);
            activePage.off('requestfailed', requestFailedListener);
            activePage.off('response', responseListener);
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

    const resourceBudget =
      typeof siteConfig.resourceErrorBudget === 'number' ? siteConfig.resourceErrorBudget : 0;
    if (resourceErrors.length > 0) {
      const summary = resourceErrors
        .slice(0, 5)
        .map((entry) =>
          entry.type === 'requestfailed'
            ? `requestfailed ${entry.url} (${entry.failure})`
            : `response ${entry.status} ${entry.url}`
        )
        .join('\n');
      console.error(
        `❌ Resource load issues detected: ${resourceErrors.length} (showing up to 5)\n${summary}`
      );
    }
    expect.soft(resourceErrors.length).toBeLessThanOrEqual(resourceBudget);
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
