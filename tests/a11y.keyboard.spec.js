const { test, expect } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');
const {
  setupTestPage,
  teardownTestPage,
  safeNavigate,
  waitForPageStability,
} = require('../utils/test-helpers');
const { attachSummary, escapeHtml } = require('../utils/allure-utils');
const {
  DEFAULT_ACCESSIBILITY_SAMPLE,
  selectAccessibilityTestPages,
} = require('../utils/a11y-shared');

const MAX_TAB_ITERATIONS = 10;

const focusableElementScript = () => {
  const candidates = Array.from(
    document.querySelectorAll(
      [
        'a[href]',
        'button',
        'input',
        'select',
        'textarea',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]',
        '[role="button"]',
        '[role="link"]',
        '[role="menuitem"]',
      ].join(', ')
    )
  );

  const focusable = candidates.filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  return focusable.slice(0, 25).map((el) => {
    const label =
      (el.innerText || el.textContent || '').trim() ||
      (el.getAttribute('aria-label') || '').trim() ||
      (el.getAttribute('title') || '').trim() ||
      (el.value || '').trim();

    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      role: el.getAttribute('role') || null,
      className: el.className || null,
      label: label.slice(0, 80),
      href: el.getAttribute('href') || null,
      tabIndex: el.tabIndex,
    };
  });
};

const activeElementSnapshotScript = () => {
  const el = document.activeElement;
  if (!el) {
    return { type: 'none' };
  }

  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const label =
    (el.innerText || el.textContent || '').trim() ||
    (el.getAttribute('aria-label') || '').trim() ||
    (el.getAttribute('title') || '').trim() ||
    (el.value || '').trim();

  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    role: el.getAttribute('role') || null,
    className: el.className || null,
    label: label.slice(0, 80),
    isBody: el === document.body,
    tabIndex: el.tabIndex,
    isVisible:
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      rect.width > 0 &&
      rect.height > 0,
    outlineStyle: style.outlineStyle,
    outlineWidth: style.outlineWidth,
    boxShadow: style.boxShadow,
    matchesFocusVisible: typeof el.matches === 'function' ? el.matches(':focus-visible') : false,
  };
};

const skipLinkMetadataScript = () => {
  const interactive = Array.from(
    document.querySelectorAll('a[href^="#"], button[href^="#"], a[href*="skip" i]')
  );

  const candidate = interactive.find((el) => {
    const text = (el.innerText || el.textContent || '').trim();
    const label = (el.getAttribute('aria-label') || '').trim();
    return /skip/i.test(text || label);
  });

  if (!candidate) return null;

  return {
    text: ((candidate.innerText || candidate.textContent || '').trim() || null)?.slice(0, 80) || null,
    href: candidate.getAttribute('href') || null,
    id: candidate.id || null,
    tag: candidate.tagName.toLowerCase(),
  };
};

const formatKeyboardSummaryHtml = (reports) => {
  if (!reports.length) return '';

  const headerTable = `
    <table>
      <thead>
        <tr>
          <th>Page</th>
          <th>Focusable elements sampled</th>
          <th>Unique focus stops</th>
          <th>Skip link</th>
          <th>Gating issues</th>
          <th>Advisories</th>
        </tr>
      </thead>
      <tbody>
        ${reports
          .map((report) => {
            const skipLinkStatus = report.skipLink
              ? `Present (${escapeHtml(report.skipLink.text || report.skipLink.href || '')})`
              : 'Missing';
            return `
              <tr class="${report.gating.length ? 'impact-critical' : ''}">
                <td><code>${escapeHtml(report.page)}</code></td>
                <td>${report.focusableCount}</td>
                <td>${report.visitedCount}</td>
                <td>${skipLinkStatus}</td>
                <td>${report.gating.length}</td>
                <td>${report.advisories.length}</td>
              </tr>
            `;
          })
          .join('')}
      </tbody>
    </table>
  `;

  const cards = reports
    .map((report) => {
      const focusList = report.sequence
        .map((entry, index) => {
          const indicator = entry.hasIndicator ? 'Focus indicator detected' : 'No focus indicator found';
          return `
            <li>
              <strong>Step ${index + 1}</strong>: ${escapeHtml(entry.summary)} — ${indicator}
            </li>
          `;
        })
        .join('');

      const gatingList = report.gating
        .map((issue) => `<li class="check-fail">${escapeHtml(issue)}</li>`)
        .join('');
      const advisoryList = report.advisories
        .map((issue) => `<li>${escapeHtml(issue)}</li>`)
        .join('');

      return `
        <section class="summary-report summary-a11y page-card">
          <div class="page-card__header">
            <h3>${escapeHtml(report.page)}</h3>
            <span class="status-pill ${report.gating.length ? 'error' : 'success'}">
              ${report.gating.length ? `${report.gating.length} gating issue(s)` : 'Pass'}
            </span>
          </div>
          <p class="details">Focusable elements sampled: ${report.focusableCount}; unique focus stops: ${report.visitedCount}</p>
          <p class="details">Skip link: ${report.skipLink ? 'present' : 'not detected'}</p>
          ${report.gating.length ? `<ul class="details">${gatingList}</ul>` : ''}
          ${report.advisories.length ? `<details><summary>Advisories (${report.advisories.length})</summary><ul class="details">${advisoryList}</ul></details>` : ''}
          ${report.sequence.length ? `<details><summary>Focus sequence (${report.sequence.length} stops)</summary><ul class="details">${focusList}</ul></details>` : ''}
        </section>
      `;
    })
    .join('');

  return `
    <section class="summary-report summary-a11y">
      <h2>Keyboard-only navigation summary</h2>
      <p class="details">Assessed ${reports.length} page(s) for focus traversal, skip navigation, and visible focus indicators.</p>
      ${headerTable}
      ${cards}
    </section>
  `;
};

const formatKeyboardSummaryMarkdown = (reports) => {
  if (!reports.length) return '';

  const lines = [
    '# Keyboard-only navigation summary',
    '',
    '| Page | Focusable sampled | Unique focus stops | Skip link | Gating issues | Advisories |',
    '| --- | --- | --- | --- | --- | --- |',
    ...reports.map((report) => {
      const skipLinkStatus = report.skipLink
        ? `present (${report.skipLink.text || report.skipLink.href || ''})`
        : 'missing';
      return `| \`${report.page}\` | ${report.focusableCount} | ${report.visitedCount} | ${skipLinkStatus} | ${report.gating.length} | ${report.advisories.length} |`;
    }),
  ];

  reports.forEach((report) => {
    if (!report.gating.length && !report.advisories.length) return;
    lines.push('', `## ${report.page}`);
    if (report.gating.length) {
      lines.push('', '### Gating issues');
      report.gating.forEach((issue) => lines.push(`- ❗ ${issue}`));
    }
    if (report.advisories.length) {
      lines.push('', '### Advisories');
      report.advisories.forEach((issue) => lines.push(`- ℹ️ ${issue}`));
    }
  });

  return lines.join('\n');
};

test.describe('Accessibility: Keyboard navigation', () => {
  let siteConfig;
  let errorContext;

  test.beforeEach(async ({ page, context }) => {
    const siteName = process.env.SITE_NAME;
    if (!siteName) throw new Error('SITE_NAME environment variable is required');

    siteConfig = SiteLoader.loadSite(siteName);
    SiteLoader.validateSiteConfig(siteConfig);
    errorContext = await setupTestPage(page, context);
  });

  test.afterEach(async ({ page, context }) => {
    await teardownTestPage(page, context, errorContext);
  });

  test('Keyboard focus flows are accessible', async ({ page }) => {
    test.setTimeout(7200000);

    const pages = selectAccessibilityTestPages(siteConfig, {
      defaultSize: DEFAULT_ACCESSIBILITY_SAMPLE,
      configKeys: ['a11yKeyboardSampleSize', 'a11yResponsiveSampleSize'],
    });

    const reports = [];

    for (const testPage of pages) {
      await test.step(`Keyboard audit: ${testPage}`, async () => {
        const report = {
          page: testPage,
          focusableCount: 0,
          visitedCount: 0,
          skipLink: null,
          gating: [],
          advisories: [],
          sequence: [],
        };
        reports.push(report);

        let response;
        try {
          response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        } catch (error) {
          report.gating.push(`Navigation failed: ${error.message}`);
          return;
        }

        if (!response || response.status() >= 400) {
          report.gating.push(
            `Received HTTP status ${response ? response.status() : 'unknown'} when loading page.`
          );
          return;
        }

        const stability = await waitForPageStability(page);
        if (!stability.ok) {
          report.gating.push(`Page did not reach a stable state: ${stability.message}`);
          return;
        }

        const focusable = await page.evaluate(focusableElementScript);
        report.focusableCount = focusable.length;
        if (focusable.length === 0) {
          report.gating.push('No focusable elements detected on page.');
          return;
        }

        report.skipLink = await page.evaluate(skipLinkMetadataScript);
        if (!report.skipLink) {
          report.advisories.push('Skip navigation link not detected near top of document.');
        }

        await page.evaluate(() => {
          if (document.body) document.body.focus({ preventScroll: true });
        });

        const visited = new Set();

        for (let step = 0; step < Math.min(MAX_TAB_ITERATIONS, focusable.length); step += 1) {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(75);

          const snapshot = await page.evaluate(activeElementSnapshotScript);
          if (!snapshot || snapshot.type === 'none') {
            report.gating.push('No active element after tabbing — possible focus trap.');
            break;
          }

          if (snapshot.isBody) {
            report.gating.push('Tab order returned focus to <body>, indicating a keyboard trap.');
            break;
          }

          const identity = `${snapshot.tag}|${snapshot.id || ''}|${snapshot.role || ''}|${snapshot.label || ''}`;
          visited.add(identity);

          const hasIndicator =
            (snapshot.outlineStyle && snapshot.outlineStyle !== 'none' && snapshot.outlineWidth !== '0px') ||
            (snapshot.boxShadow && snapshot.boxShadow !== 'none') ||
            snapshot.matchesFocusVisible;

          if (!snapshot.isVisible) {
            report.gating.push(
              `Keyboard focus moved to an element that is visually hidden (${snapshot.tag} ${snapshot.id ? `#${snapshot.id}` : ''}).`
            );
          }

          if (!hasIndicator) {
            report.advisories.push(
              `No visible focus indicator detected for ${snapshot.tag} ${snapshot.id ? `#${snapshot.id}` : ''} (${snapshot.label || 'unnamed element'}).`
            );
          }

          report.sequence.push({
            index: step + 1,
            hasIndicator,
            summary: `${snapshot.tag}${snapshot.id ? `#${snapshot.id}` : ''}${
              snapshot.role ? ` [role=${snapshot.role}]` : ''
            } — ${snapshot.label || 'no accessible label'}`,
          });
        }

        report.visitedCount = visited.size;

        if (visited.size <= 1 && focusable.length > 1) {
          report.gating.push('Tab order did not progress beyond the first interactive element.');
        }
      });
    }

    const gatingTotal = reports.reduce((total, report) => total + report.gating.length, 0);

    const summaryHtml = formatKeyboardSummaryHtml(reports);
    const summaryMarkdown = formatKeyboardSummaryMarkdown(reports);

    await attachSummary({
      baseName: 'a11y-keyboard-summary',
      htmlBody: summaryHtml,
      markdown: summaryMarkdown,
      setDescription: true,
    });

    expect(gatingTotal, 'Keyboard navigation gating issues detected').toBe(0);
  });
});
