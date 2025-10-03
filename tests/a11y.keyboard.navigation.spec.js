const { test, expect } = require('../utils/test-fixtures');
const pixelmatch = require('pixelmatch');

test.use({ trace: 'off', video: 'off' });

const { PNG } = require('pngjs');
const SiteLoader = require('../utils/site-loader');
const {
  safeNavigate,
  waitForPageStability,
} = require('../utils/test-helpers');
const { attachSummary, escapeHtml } = require('../utils/reporting-utils');
const {
  DEFAULT_ACCESSIBILITY_SAMPLE,
  selectAccessibilityTestPages,
} = require('../utils/a11y-shared');

const KEYBOARD_WCAG_REFERENCES = [
  { id: '2.1.1', name: 'Keyboard' },
  { id: '2.1.2', name: 'No Keyboard Trap' },
  { id: '2.4.1', name: 'Bypass Blocks' },
  { id: '2.4.3', name: 'Focus Order' },
  { id: '2.4.7', name: 'Focus Visible' },
];

const renderWcagBadgesHtml = (references) =>
  references
    .map((ref) => `<span class="badge badge-wcag">${escapeHtml(`${ref.id} ${ref.name}`)}</span>`)
    .join(' ');

const renderWcagListMarkdown = (references) =>
  references.map((ref) => `- ${ref.id} ${ref.name}`);

const DEFAULT_MAX_TAB_ITERATIONS = 20;
const FOCUS_DIFF_THRESHOLD = 0.02;

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
  const focusable = Array.from(
    document.querySelectorAll('a[href^="#"], button[href^="#"], [role="link"][href^="#"]')
  );

  const isLikelySkipLink = (el) => {
    const text = (el.innerText || el.textContent || '').trim();
    const label = (el.getAttribute('aria-label') || '').trim();
    if (!/skip/i.test(`${text} ${label}`)) return false;

    const href = el.getAttribute('href') || '';
    const targetSelector = href.startsWith('#') ? href : null;
    if (!targetSelector || targetSelector === '#') return false;

    const target = document.querySelector(targetSelector);
    if (!target) return false;

    const acceptableRoles = ['main', 'banner', 'contentinfo'];
    const role = target.getAttribute('role') || '';
    const idMatch = /^(main|content|primary|page)/i.test(target.id || '');
    const isLandmark = target.tagName.toLowerCase() === 'main' || acceptableRoles.includes(role.toLowerCase()) || idMatch;
    if (!isLandmark) return false;

    const rect = el.getBoundingClientRect();
    if (rect.top > 400) return false;

    const previouslyFocused = document.activeElement;
    el.focus({ preventScroll: true });
    const focusedStyles = window.getComputedStyle(el);
    const visibleOnFocus =
      focusedStyles.visibility !== 'hidden' &&
      focusedStyles.display !== 'none' &&
      !(focusedStyles.clipPath && focusedStyles.clipPath !== 'none') &&
      !(focusedStyles.clip && focusedStyles.clip !== 'auto');
    if (previouslyFocused && previouslyFocused !== el && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus({ preventScroll: true });
    } else if (previouslyFocused && typeof previouslyFocused.blur === 'function') {
      previouslyFocused.blur();
    }
    return visibleOnFocus;
  };

  const candidate = focusable.find(isLikelySkipLink);
  if (!candidate) return null;

  return {
    text: ((candidate.innerText || candidate.textContent || '').trim() || null)?.slice(0, 80) || null,
    href: candidate.getAttribute('href') || null,
    id: candidate.id || null,
    tag: candidate.tagName.toLowerCase(),
  };
};

const computeElementClip = (boundingBox, viewport) => {
  if (!boundingBox || !viewport) return null;
  const padding = 6;
  const x = Math.max(boundingBox.x - padding, 0);
  const y = Math.max(boundingBox.y - padding, 0);
  const maxWidth = Math.max(Math.min(boundingBox.width + padding * 2, viewport.width - x), 1);
  const maxHeight = Math.max(Math.min(boundingBox.height + padding * 2, viewport.height - y), 1);
  return {
    x,
    y,
    width: maxWidth,
    height: maxHeight,
  };
};

const detectFocusIndicator = async (page, elementHandle) => {
  const viewport = page.viewportSize();
  const box = await elementHandle.boundingBox();
  const clip = computeElementClip(box, viewport || { width: 1280, height: 720 });
  if (!clip) return { hasIndicator: false, diffRatio: 0 };

  let focusedBuffer;
  try {
    focusedBuffer = await page.screenshot({ clip, type: 'png' });
  } catch (_) {
    return { hasIndicator: false, diffRatio: 0 };
  }

  await elementHandle.evaluate((el) => {
    if (typeof el.blur === 'function') el.blur();
  });
  await page.waitForTimeout(75);

  let unfocusedBuffer;
  try {
    unfocusedBuffer = await page.screenshot({ clip, type: 'png' });
  } catch (_) {
    await elementHandle.evaluate((el) => {
      if (typeof el.focus === 'function') el.focus();
    });
    await page.waitForTimeout(50);
    return { hasIndicator: false, diffRatio: 0 };
  }

  await elementHandle.evaluate((el) => {
    if (typeof el.focus === 'function') el.focus();
  });
  await page.waitForTimeout(50);

  try {
    const focusedPng = PNG.sync.read(focusedBuffer);
    const unfocusedPng = PNG.sync.read(unfocusedBuffer);

    if (
      focusedPng.width !== unfocusedPng.width ||
      focusedPng.height !== unfocusedPng.height
    ) {
      return { hasIndicator: false, diffRatio: 0 };
    }

    const diff = new PNG({ width: focusedPng.width, height: focusedPng.height });
    const pixelDiff = pixelmatch(
      focusedPng.data,
      unfocusedPng.data,
      diff.data,
      focusedPng.width,
      focusedPng.height,
      { threshold: 0.2 }
    );
    const diffRatio = pixelDiff / (focusedPng.width * focusedPng.height);
    return { hasIndicator: diffRatio >= FOCUS_DIFF_THRESHOLD, diffRatio };
  } catch (_) {
    return { hasIndicator: false, diffRatio: 0 };
  }
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
      <p class="details"><strong>WCAG coverage:</strong> ${renderWcagBadgesHtml(KEYBOARD_WCAG_REFERENCES)}</p>
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

  lines.push('', '### WCAG coverage');
  lines.push(...renderWcagListMarkdown(KEYBOARD_WCAG_REFERENCES));
  lines.push('');

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

  test.beforeEach(async ({ page, context, errorContext: sharedErrorContext }, testInfo) => {
    const siteName = process.env.SITE_NAME;
    if (!siteName) throw new Error('SITE_NAME environment variable is required');

    siteConfig = SiteLoader.loadSite(siteName);
    SiteLoader.validateSiteConfig(siteConfig);
    errorContext = sharedErrorContext;
  });

  test('Keyboard focus flows are accessible', async ({ page }) => {
    test.setTimeout(7200000);

    const pages = selectAccessibilityTestPages(siteConfig, {
      defaultSize: DEFAULT_ACCESSIBILITY_SAMPLE,
      configKeys: ['a11yKeyboardSampleSize', 'a11yResponsiveSampleSize'],
    });

    const reports = [];
    const maxTabIterations = Number(process.env.A11Y_KEYBOARD_STEPS || DEFAULT_MAX_TAB_ITERATIONS);

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

        const visited = [];

        for (let step = 0; step < Math.min(maxTabIterations, focusable.length); step += 1) {
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
          visited.push(identity);

          const activeElementHandle = await page.evaluateHandle(() => document.activeElement);
          let hasIndicator = false;
          if (activeElementHandle && activeElementHandle.asElement()) {
            const result = await detectFocusIndicator(page, activeElementHandle.asElement());
            hasIndicator = result.hasIndicator;
          }
          if (activeElementHandle) await activeElementHandle.dispose();

          if (!snapshot.isVisible) {
            report.gating.push(
              `Keyboard focus moved to an element that is visually hidden (${snapshot.tag} ${snapshot.id ? `#${snapshot.id}` : ''}).`
            );
          }
          if (!hasIndicator) {
            report.advisories.push(
              `Unable to detect focus indicator change for ${snapshot.tag} ${snapshot.id ? `#${snapshot.id}` : ''} (${snapshot.label || 'unnamed element'}).`
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

        report.visitedCount = visited.length;

        if (visited.length <= 1 && focusable.length > 1) {
          report.gating.push('Tab order did not progress beyond the first interactive element.');
        }

        if (visited.length > 1) {
          await page.keyboard.press('Shift+Tab');
          await page.waitForTimeout(75);
          const reverseSnapshot = await page.evaluate(activeElementSnapshotScript);
          if (!reverseSnapshot || reverseSnapshot.isBody) {
            report.gating.push('Reverse tabbing returned focus to <body>; keyboard users may get trapped.');
          }
          await page.keyboard.press('Tab');
          await page.waitForTimeout(50);
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
      title: 'Keyboard navigation summary',
    });

    expect(gatingTotal, 'Keyboard navigation gating issues detected').toBe(0);
  });
});
