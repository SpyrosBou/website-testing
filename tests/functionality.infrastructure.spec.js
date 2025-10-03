const { test, expect } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');
const {
  setupTestPage,
  teardownTestPage,
  safeNavigate,
  waitForPageStability,
} = require('../utils/test-helpers');
const { WordPressPageObjects } = require('../utils/wordpress-page-objects');
const { attachSummary, escapeHtml } = require('../utils/reporting-utils');

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
    <section class="summary-report summary-http">
      <h3>HTTP response &amp; content integrity</h3>
      <p class="legend">
        <span class="badge ok">200 OK</span>
        <span class="badge redirect">3xx redirect</span>
        <span class="badge error">4xx/5xx</span>
      </p>
      <table>
        <thead>
          <tr><th>Path</th><th>Status</th><th>Checks</th></tr>
        </thead>
        <tbody>${rows}</tbody>
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

const renderElementCheck = (value) => (value ? '✅' : '⚠️');

const formatAvailabilitySummaryHtml = (results) => {
  const rows = results
    .map((entry) => {
      const className = statusClassName(entry.status ?? 0);
      const headerCell = entry.elements ? renderElementCheck(entry.elements.header) : '—';
      const navCell = entry.elements ? renderElementCheck(entry.elements.navigation) : '—';
      const contentCell = entry.elements ? renderElementCheck(entry.elements.content) : '—';
      const footerCell = entry.elements ? renderElementCheck(entry.elements.footer) : '—';
      const notesHtml = entry.notes.length
        ? `<ul class="checks">${entry.notes
            .map((note) => `<li class="${note.type === 'info' ? 'check-pass' : 'check-fail'}">${escapeHtml(note.message)}</li>`)
            .join('')}</ul>`
        : '<ul class="checks"><li class="check-pass">OK</li></ul>';
      const statusLabel = entry.status === null ? 'n/a' : entry.status;
      return `
        <tr class="${className}">
          <td><code>${escapeHtml(entry.page)}</code></td>
          <td>${statusLabel}</td>
          <td>${headerCell}</td>
          <td>${navCell}</td>
          <td>${contentCell}</td>
          <td>${footerCell}</td>
          <td>${notesHtml}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <section class="summary-report summary-availability">
      <h3>Page availability &amp; structure</h3>
      <table>
        <thead><tr><th>Page</th><th>Status</th><th>Header</th><th>Navigation</th><th>Content</th><th>Footer</th><th>Notes</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
};

const formatAvailabilitySummaryMarkdown = (results) => {
  const header = ['# Page availability summary', '', '| Page | Status | Header | Navigation | Content | Footer | Notes |', '| --- | --- | --- | --- | --- | --- | --- |'];
  const rows = results.map((entry) => {
    const statusLabel = entry.status === null ? 'n/a' : entry.status;
    const notes = entry.notes.map((note) => `${note.type === 'info' ? 'ℹ️' : '⚠️'} ${note.message}`).join('<br />') || 'OK';
    const headerCell = entry.elements ? renderElementCheck(entry.elements.header) : '—';
    const navCell = entry.elements ? renderElementCheck(entry.elements.navigation) : '—';
    const contentCell = entry.elements ? renderElementCheck(entry.elements.content) : '—';
    const footerCell = entry.elements ? renderElementCheck(entry.elements.footer) : '—';
    return `| \`${entry.page}\` | ${statusLabel} | ${headerCell} | ${navCell} | ${contentCell} | ${footerCell} | ${notes} |`;
  });
  return header.concat(rows).join('\n');
};

const formatPerformanceSummaryHtml = (data, breaches) => {
  const breachMap = new Map();
  breaches.forEach((entry) => {
    if (!breachMap.has(entry.page)) breachMap.set(entry.page, []);
    breachMap.get(entry.page).push(entry);
  });

  const rows = data
    .map((entry) => {
      const pageBreaches = breachMap.get(entry.page) || [];
      const className = pageBreaches.length > 0 ? 'status-error' : 'status-ok';
      const breachNotes = pageBreaches
        .map(
          (breach) =>
            `<li class="check-fail">${escapeHtml(breach.metric)} ${Math.round(breach.value)}ms (budget ${breach.budget}ms)</li>`
        )
        .join('');
      const notesHtml = pageBreaches.length
        ? `<ul class="checks">${breachNotes}</ul>`
        : '<ul class="checks"><li class="check-pass">Within budgets</li></ul>';
      return `
        <tr class="${className}">
          <td><code>${escapeHtml(entry.page)}</code></td>
          <td>${Math.round(entry.loadTime)}ms</td>
          <td>${Math.round(entry.domContentLoaded)}ms</td>
          <td>${Math.round(entry.loadComplete)}ms</td>
          <td>${Math.round(entry.firstContentfulPaint)}ms</td>
          <td>${notesHtml}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <section class="summary-report summary-performance">
      <h3>Performance metrics (sample pages)</h3>
      <table>
        <thead><tr><th>Page</th><th>Load time</th><th>DOM content loaded</th><th>Load complete</th><th>FCP</th><th>Budget notes</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
};

const formatPerformanceSummaryMarkdown = (data, breaches) => {
  const breachMap = new Map();
  breaches.forEach((entry) => {
    if (!breachMap.has(entry.page)) breachMap.set(entry.page, []);
    breachMap.get(entry.page).push(entry);
  });
  const header = ['# Performance metrics summary', '', '| Page | Load time | DOMContentLoaded | Load complete | FCP | Notes |', '| --- | --- | --- | --- | --- | --- |'];
  const rows = data.map((entry) => {
    const pageBreaches = breachMap.get(entry.page) || [];
    const notes =
      pageBreaches.length === 0
        ? 'Within budgets'
        : pageBreaches
            .map(
              (breach) => `${breach.metric}: ${Math.round(breach.value)}ms (budget ${breach.budget}ms)`
            )
            .join('<br />');
    return `| \`${entry.page}\` | ${Math.round(entry.loadTime)}ms | ${Math.round(entry.domContentLoaded)}ms | ${Math.round(entry.loadComplete)}ms | ${Math.round(entry.firstContentfulPaint)}ms | ${notes} |`;
  });
  return header.concat(rows).join('\n');
};

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
    test.setTimeout(7200000);
    errorContext.setTest('Page Availability Check');
    const availabilityResults = [];

    const pagesToTest = process.env.SMOKE
      ? (Array.isArray(siteConfig.testPages) && siteConfig.testPages.includes('/'))
        ? ['/']
        : [siteConfig.testPages[0]]
      : siteConfig.testPages;

    for (const testPage of pagesToTest) {
      await test.step(`Checking page availability: ${testPage}`, async () => {
        errorContext.setPage(testPage);
        errorContext.setAction('navigating to page');

        const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        const entry = {
          page: testPage,
          status: response ? response.status() : null,
          elements: null,
          notes: [],
        };
        await wpPageObjects.basePage.waitForWordPressReady();
        const is404 = await wpPageObjects.is404Page();
        if (is404) {
          entry.notes.push({ type: 'warning', message: '404 page detected' });
          console.log(`⚠️  Page not found: ${testPage}`);
          await page.screenshot({ path: `test-results/404-${testPage.replace(/\//g, '-')}.png` });
          availabilityResults.push(entry);
          return;
        }
        if (entry.status >= 500)
          throw new Error(`Server error on ${testPage}: ${entry.status}`);
        if (entry.status >= 400) {
          console.log(`⚠️  Client error on ${testPage}: ${entry.status}`);
          entry.notes.push({ type: 'warning', message: `Client error ${entry.status}` });
        }

        if (entry.status >= 200 && entry.status < 300) {
          const elements = await wpPageObjects.verifyCriticalElements();
          console.log(`✅ Page structure check for ${testPage}:`, elements);
          const title = await wpPageObjects.getTitle();
          expect(title).toBeTruthy();
          entry.elements = elements;
          entry.notes.push({ type: 'info', message: `Title present: ${Boolean(title)}` });
          Object.entries(elements).forEach(([key, value]) => {
            if (!value) entry.notes.push({ type: 'warning', message: `${key} missing` });
          });
        }
        availabilityResults.push(entry);
      });
    }

    if (availabilityResults.length > 0) {
      const summaryHtml = formatAvailabilitySummaryHtml(availabilityResults);
      const summaryMarkdown = formatAvailabilitySummaryMarkdown(availabilityResults);
      await attachSummary({
        baseName: 'availability-summary',
        htmlBody: summaryHtml,
        markdown: summaryMarkdown,
        setDescription: true,
        title: 'Availability & uptime summary',
      });
    }
  });

  test('HTTP response and content integrity', async ({ page }) => {
    test.setTimeout(7200000);
    errorContext.setTest('HTTP Response Validation');
    const responseResults = [];
    const pagesToTest = process.env.SMOKE
      ? (Array.isArray(siteConfig.testPages) && siteConfig.testPages.includes('/'))
        ? ['/']
        : [siteConfig.testPages[0]]
      : siteConfig.testPages;

    for (const testPage of pagesToTest) {
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
      await attachSummary({
        baseName: 'http-response-summary',
        htmlBody: summaryHtml,
        markdown: summaryMarkdown,
        setDescription: true,
        title: 'HTTP response validation summary',
      });
    }
  });

  test('Performance monitoring (sample up to 5 pages)', async ({ page }) => {
    test.setTimeout(7200000);
    errorContext.setTest('Performance Monitoring');
    const performanceData = [];
    const perfBudgets =
      typeof siteConfig.performanceBudgets === 'object' &&
      siteConfig.performanceBudgets !== null
        ? siteConfig.performanceBudgets
        : null;
    const performanceBreaches = [];
    const perfPages = process.env.SMOKE
      ? (Array.isArray(siteConfig.testPages) && siteConfig.testPages.includes('/'))
        ? ['/']
        : [siteConfig.testPages[0]]
      : siteConfig.testPages.slice(0, 5);

    for (const testPage of perfPages) {
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
      const summaryHtml = formatPerformanceSummaryHtml(performanceData, performanceBreaches);
      const summaryMarkdown = formatPerformanceSummaryMarkdown(performanceData, performanceBreaches);
      await attachSummary({
        baseName: 'performance-summary',
        htmlBody: summaryHtml,
        markdown: summaryMarkdown,
        setDescription: true,
        title: 'Performance monitoring summary',
      });
    }
  });
});
