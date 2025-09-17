const { test, expect } = require('@playwright/test');
const { allure } = require('allure-playwright');
const SiteLoader = require('../utils/site-loader');
const {
  setupTestPage,
  teardownTestPage,
  safeNavigate,
  waitForPageStability,
} = require('../utils/test-helpers');
const { WordPressPageObjects } = require('../utils/wordpress-page-objects');

const attachAllureText = async (name, content, type = 'text/plain') => {
  if (allure && typeof allure.attachment === 'function') {
    await allure.attachment(name, content, type);
  }
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const statusClassName = (status) => {
  if (status >= 400) return 'status-error';
  if (status >= 300) return 'status-redirect';
  return 'status-ok';
};

const formatHttpSummaryHtml = (results) => {
  const rows = results
    .map((entry) => {
      const className = statusClassName(entry.status);
      const checksHtml = entry.checks
        .map(
          (check) =>
            `<li class="${check.passed ? 'check-pass' : 'check-fail'}">${escapeHtml(check.label)}${
              check.details ? ` <span class="details">(${escapeHtml(check.details)})</span>` : ''
            }</li>`
        )
        .join('');
      const redirectNote =
        entry.status >= 300 && entry.status < 400 && entry.location
          ? `<div class="note">Location: <code>${escapeHtml(entry.location)}</code></div>`
          : '';
      return `
        <tr class="${className}">
          <td><code>${escapeHtml(entry.page)}</code></td>
          <td>${entry.status}${entry.statusText ? ` ${escapeHtml(entry.statusText)}` : ''}</td>
          <td>
            <ul class="checks">${checksHtml || '<li>No 200 OK validation run</li>'}</ul>
            ${redirectNote}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <style>
      .http-report { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .http-report table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
      .http-report th, .http-report td { border: 1px solid #d0d7de; padding: 6px 8px; text-align: left; vertical-align: top; }
      .http-report th { background: #f6f8fa; }
      .http-report tr.status-ok td { background: #edf7ed; }
      .http-report tr.status-redirect td { background: #fff4ce; }
      .http-report tr.status-error td { background: #ffe5e5; }
      .http-report ul.checks { margin: 0; padding-left: 1.2rem; }
      .http-report ul.checks li { margin: 0.15rem 0; }
      .http-report li.check-pass::marker { color: #137333; }
      .http-report li.check-fail::marker { color: #d93025; }
      .http-report .details { color: #4e5969; }
      .http-report .legend { margin: 0.5rem 0; }
      .http-report .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; margin-right: 0.4rem; border: 1px solid #d0d7de; }
      .http-report .badge.ok { background: #edf7ed; }
      .http-report .badge.redirect { background: #fff4ce; }
      .http-report .badge.error { background: #ffe5e5; }
      .http-report .note { margin-top: 0.25rem; font-size: 0.85rem; color: #344054; }
      .http-report code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; }
    </style>
    <section class="http-report">
      <h2>HTTP response &amp; content integrity summary</h2>
      <p class="legend">
        <span class="badge ok">200 OK</span>
        <span class="badge redirect">3xx redirect</span>
        <span class="badge error">4xx/5xx</span>
      </p>
      <table>
        <thead>
          <tr><th>Path</th><th>Status</th><th>Checks</th></tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </section>
  `;
};

const formatHttpSummaryMarkdown = (results) =>
  ['# HTTP response & content integrity summary', '', '| Path | Status | Notes |', '| --- | --- | --- |']
    .concat(
      results.map((entry) => {
        const notes = entry.checks
          .map((check) => `${check.passed ? '✅' : '⚠️'} ${check.label}${check.details ? ` (${check.details})` : ''}`)
          .join('<br />');
        const statusLabel = entry.statusText ? `${entry.status} ${entry.statusText}` : `${entry.status}`;
        return `| \`${entry.page}\` | ${statusLabel} | ${notes || 'No 200 OK validation run'} |`;
      })
    )
    .join('\n');

test.describe('Functionality: Core Infrastructure', () => {
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

  test('Page availability across configured pages', async ({ page }) => {
    test.setTimeout(30000);
    errorContext.setTest('Page Availability Check');

    for (const testPage of siteConfig.testPages) {
      await test.step(`Checking page availability: ${testPage}`, async () => {
        errorContext.setPage(testPage);
        errorContext.setAction('navigating to page');

        const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        await wpPageObjects.basePage.waitForWordPressReady();
        const is404 = await wpPageObjects.is404Page();
        if (is404) {
          console.log(`⚠️  Page not found: ${testPage}`);
          await page.screenshot({ path: `test-results/404-${testPage.replace(/\//g, '-')}.png` });
          return;
        }
        if (response.status() >= 500)
          throw new Error(`Server error on ${testPage}: ${response.status()}`);
        if (response.status() >= 400)
          console.log(`⚠️  Client error on ${testPage}: ${response.status()}`);

        if (response.status() >= 200 && response.status() < 300) {
          const elements = await wpPageObjects.verifyCriticalElements();
          console.log(`✅ Page structure check for ${testPage}:`, elements);
          const title = await wpPageObjects.getTitle();
          expect(title).toBeTruthy();
        }
      });
    }
  });

  test('HTTP response and content integrity', async ({ page }) => {
    test.setTimeout(20000);
    errorContext.setTest('HTTP Response Validation');
    const responseResults = [];
    for (const testPage of siteConfig.testPages) {
      await test.step(`Validating response for: ${testPage}`, async () => {
        errorContext.setPage(testPage);
        const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        const status = response.status();
        const statusText = response.statusText ? response.statusText() : '';
        const checks = [];

        expect([200, 301, 302]).toContain(status);
        if (status === 200) {
          const contentType = response.headers()['content-type'] || '';
          const hasContentType = contentType.includes('text/html');
          checks.push({
            label: 'Content-Type includes text/html',
            passed: hasContentType,
            details: contentType || 'missing',
          });
          expect(contentType).toContain('text/html');

          await expect(page.locator('html[lang]')).toBeAttached();
          checks.push({ label: 'html[lang] attribute present', passed: true });

          await expect(page.locator('meta[charset], meta[http-equiv="Content-Type"]')).toBeAttached();
          checks.push({ label: 'charset meta tag present', passed: true });

          await expect(page.locator('meta[name="viewport"]')).toBeAttached();
          checks.push({ label: 'viewport meta tag present', passed: true });

          const bodyText = await page.locator('body').textContent();
          const fatalErrorPresent = /Fatal error/i.test(bodyText || '');
          const warningPresent = /Warning:/i.test(bodyText || '');
          const noticePresent = /Notice:/i.test(bodyText || '');
          expect(fatalErrorPresent).toBe(false);
          expect(warningPresent).toBe(false);
          expect(noticePresent).toBe(false);
          checks.push({ label: 'No PHP fatal/warning/notice text', passed: true });
          console.log(`✅ Response validation passed for ${testPage}`);
        }

        const entry = {
          page: testPage,
          status,
          statusText,
          checks,
        };
        if (status >= 300 && status < 400) {
          entry.location = response.headers()['location'] || '';
        }
        responseResults.push(entry);
      });
    }

    if (responseResults.length > 0) {
      const summaryHtml = formatHttpSummaryHtml(responseResults);
      const summaryMarkdown = formatHttpSummaryMarkdown(responseResults);
      await attachAllureText('http-response-summary.html', summaryHtml, 'text/html');
      await attachAllureText('http-response-summary.md', summaryMarkdown, 'text/markdown');
      if (typeof allure?.descriptionHtml === 'function') {
        allure.descriptionHtml(summaryHtml);
      }
    }
  });

  test('Performance monitoring (sample up to 5 pages)', async ({ page }) => {
    test.setTimeout(45000);
    errorContext.setTest('Performance Monitoring');
    const performanceData = [];
    const perfBudgets =
      typeof siteConfig.performanceBudgets === 'object' &&
      siteConfig.performanceBudgets !== null
        ? siteConfig.performanceBudgets
        : null;
    const performanceBreaches = [];
    for (const testPage of siteConfig.testPages.slice(0, 5)) {
      await test.step(`Measuring performance for: ${testPage}`, async () => {
        errorContext.setPage(testPage);
        const startTime = Date.now();
        const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        if (response.status() !== 200) return;
        await waitForPageStability(page, { timeout: 10000 });
        const loadTime = Date.now() - startTime;
        const metrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          const paints = performance.getEntriesByType('paint');
          return {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
            loadComplete: navigation.loadEventEnd - navigation.navigationStart,
            firstPaint: paints.find((p) => p.name === 'first-paint')?.startTime || 0,
            firstContentfulPaint:
              paints.find((p) => p.name === 'first-contentful-paint')?.startTime || 0,
          };
        });
        performanceData.push({ page: testPage, loadTime, ...metrics });
        if (loadTime > 3000) console.log(`⚠️  ${testPage} took ${loadTime}ms (>3s)`);
        else console.log(`✅ ${testPage} loaded in ${loadTime}ms`);

        if (perfBudgets) {
          const budgetChecks = {
            domContentLoaded: metrics.domContentLoaded,
            loadComplete: metrics.loadComplete,
            firstContentfulPaint: metrics.firstContentfulPaint,
          };

          for (const [budgetKey, value] of Object.entries(budgetChecks)) {
            if (!Object.prototype.hasOwnProperty.call(perfBudgets, budgetKey)) continue;
            const budget = Number(perfBudgets[budgetKey]);
            if (!Number.isFinite(budget) || budget <= 0) continue;
            if (!Number.isFinite(value) || value <= 0) {
              console.log(
                `ℹ️  ${budgetKey} metric unavailable on ${testPage}; skipping budget comparison`
              );
              continue;
            }
            if (value > budget) {
              console.log(
                `❌  ${budgetKey} for ${testPage} exceeded budget: ${Math.round(value)}ms > ${budget}ms`
              );
              performanceBreaches.push({ page: testPage, metric: budgetKey, value, budget });
              expect.soft(value).toBeLessThanOrEqual(budget);
            } else {
              console.log(
                `✅  ${budgetKey} for ${testPage} within budget (${Math.round(value)}ms <= ${budget}ms)`
              );
            }
          }
        }
      });
    }
    if (performanceData.length > 0) {
      const avg = performanceData.reduce((s, d) => s + d.loadTime, 0) / performanceData.length;
      console.log(`📊 Average load time: ${Math.round(avg)}ms`);
      if (performanceBreaches.length > 0) {
        const details = performanceBreaches
          .map(
            (entry) =>
              `${entry.metric} on ${entry.page}: ${Math.round(entry.value)}ms (budget ${entry.budget}ms)`
          )
          .join('\n');
        console.error(`⚠️  Performance budgets exceeded:\n${details}`);
      }
    }
  });
});
