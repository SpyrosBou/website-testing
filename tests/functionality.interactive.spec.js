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
const { attachSummary, escapeHtml } = require('../utils/allure-utils');

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'root';

const formatInteractiveSummaryHtml = (summaries, resourceBudget) => {
  const rows = summaries
    .map((entry) => {
      const hasErrors = entry.consoleErrors.length > 0 || entry.resourceErrors.length > 0;
      const statusClass = hasErrors || (entry.status && entry.status !== 200) ? 'status-error' : 'status-ok';
      const statusLabel = entry.status === null ? 'n/a' : entry.status;

      const consoleList =
        entry.consoleErrors.length === 0
          ? '<li class="check-pass">No console errors</li>'
          : entry.consoleErrors
              .slice(0, 3)
              .map((err) => `<li class="check-fail">${escapeHtml(err.message)}</li>`)
              .join('');

      const resourceList =
        entry.resourceErrors.length === 0
          ? '<li class="check-pass">No failed requests</li>'
          : entry.resourceErrors
              .slice(0, 3)
              .map((err) => {
                if (err.type === 'requestfailed') {
                  return `<li class="check-fail">${escapeHtml(err.type)} &mdash; <code>${escapeHtml(err.url)}</code> (${escapeHtml(err.failure || 'unknown')})</li>`;
                }
                return `<li class="check-fail">${escapeHtml(err.type)} ${err.status} ${escapeHtml(err.method || '')} &mdash; <code>${escapeHtml(err.url)}</code></li>`;
              })
              .join('');

      const notesHtml = entry.notes.length
        ? `<ul class="checks">${entry.notes
            .map((note) => `<li class="${note.type === 'info' ? 'check-pass' : 'check-fail'}">${escapeHtml(note.message)}</li>`)
            .join('')}</ul>`
        : '';

      return `
        <tr class="${statusClass}">
          <td><code>${escapeHtml(entry.page)}</code></td>
          <td>${statusLabel}</td>
          <td><ul class="checks">${consoleList}</ul></td>
          <td><ul class="checks">${resourceList}</ul></td>
          <td>${notesHtml}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <section class="summary-report summary-interactive">
      <h3>JavaScript &amp; resource monitoring</h3>
      <p>Resource error budget: <strong>${resourceBudget}</strong></p>
      <table>
        <thead>
          <tr><th>Page</th><th>Status</th><th>Console</th><th>Resources</th><th>Notes</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
};

const formatInteractiveSummaryMarkdown = (summaries, resourceBudget) => {
  const header = ['# JavaScript & resource monitoring summary', '', `Resource error budget: **${resourceBudget}**`, '', '| Page | Status | Console | Resources | Notes |', '| --- | --- | --- | --- | --- |'];
  const rows = summaries.map((entry) => {
    const statusLabel = entry.status === null ? 'n/a' : entry.status;
    const consoleText =
      entry.consoleErrors.length === 0
        ? '✅ None'
        : entry.consoleErrors
            .slice(0, 3)
            .map((err) => `⚠️ ${err.message}`)
            .join('<br />');
    const resourceText =
      entry.resourceErrors.length === 0
        ? '✅ None'
        : entry.resourceErrors
            .slice(0, 3)
            .map((err) =>
              err.type === 'requestfailed'
                ? `⚠️ requestfailed ${err.url} (${err.failure || 'unknown'})`
                : `⚠️ ${err.type} ${err.status} ${err.method || ''} ${err.url}`
            )
            .join('<br />');
    const notesText = entry.notes.map((note) => `${note.type === 'info' ? 'ℹ️' : '⚠️'} ${note.message}`).join('<br />');
    return `| \`${entry.page}\` | ${statusLabel} | ${consoleText || '—'} | ${resourceText || '—'} | ${notesText || '—'} |`;
  });
  return header.concat(rows).join('\n');
};

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
    test.setTimeout(7200000);
    const consoleErrors = [];
    const resourceErrors = [];
    const pageSummaries = [];
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

    const pagesToTest = process.env.SMOKE
      ? (Array.isArray(siteConfig.testPages) && siteConfig.testPages.includes('/'))
        ? ['/']
        : [siteConfig.testPages[0]]
      : siteConfig.testPages;

    for (const testPage of pagesToTest) {
      await test.step(`JS errors on: ${testPage}`, async () => {
        const perPage = {
          page: testPage,
          status: null,
          consoleErrors: [],
          resourceErrors: [],
          notes: [],
        };
        let attempts = 0;
        while (attempts < 2) {
          const activePage = await context.newPage();
          const listener = (msg) => {
            if (msg.type() !== 'error') return;
            const text = msg.text();
            if (ignoreMatchers.some((re) => re.test(text))) return;
            const entry = { message: text, url: activePage.url() };
            perPage.consoleErrors.push(entry);
            consoleErrors.push(entry);
          };
          activePage.on('console', listener);

          const recordResourceError = (type, url, extra = {}) => {
            const entry = { type, url, ...extra };
            perPage.resourceErrors.push(entry);
            resourceErrors.push(entry);
          };

          const requestFailedListener = (request) => {
            recordResourceError('requestfailed', request.url(), {
              failure: request.failure()?.errorText || 'unknown',
            });
          };
          const responseListener = (response) => {
            const status = response.status();
            if (status >= 400) {
              recordResourceError('response', response.url(), {
                status,
                method: response.request().method(),
              });
            }
          };
          activePage.on('requestfailed', requestFailedListener);
          activePage.on('response', responseListener);

          try {
            const response = await safeNavigate(activePage, `${siteConfig.baseUrl}${testPage}`);
            perPage.status = response.status();
            if (perPage.status !== 200) {
              perPage.notes.push({ type: 'warning', message: `Navigation returned ${perPage.status}` });
              await activePage.close();
              break;
            }
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
                  const message = `Interaction skipped for ${s} #${i}: ${error.message}`;
                  console.log(`⚠️  ${message}`);
                  perPage.notes.push({ type: 'warning', message });
                }
              }
            }
            perPage.notes.push({ type: 'info', message: 'Interaction cycle executed' });
            await activePage.close();
            break;
          } catch (error) {
            attempts += 1;
            await activePage.close();
            if (/page is closed/i.test(error.message) && attempts < 2) {
              const note = `Retry due to closed page (${error.message})`;
              console.log(`⚠️  ${note}`);
              perPage.notes.push({ type: 'warning', message: note });
              continue;
            }
            throw error;
          } finally {
            activePage.off('console', listener);
            activePage.off('requestfailed', requestFailedListener);
            activePage.off('response', responseListener);
          }
        }
        if (perPage.status === null) {
          perPage.notes.push({ type: 'warning', message: 'Navigation did not complete' });
        } else if (perPage.status === 200 && perPage.consoleErrors.length === 0) {
          perPage.notes.push({ type: 'info', message: 'No console errors detected' });
        }
        pageSummaries.push(perPage);
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

    const summaryHtml = formatInteractiveSummaryHtml(pageSummaries, resourceBudget);
    const summaryMarkdown = formatInteractiveSummaryMarkdown(pageSummaries, resourceBudget);
    await attachSummary({
      baseName: 'interactive-summary',
      htmlBody: summaryHtml,
      markdown: summaryMarkdown,
      setDescription: true,
    });
  });

  test('Form interactions and validation (if configured)', async ({ page }) => {
    test.setTimeout(7200000);
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
