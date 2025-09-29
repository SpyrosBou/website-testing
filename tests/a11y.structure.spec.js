const { test, expect } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');
const {
  setupTestPage,
  teardownTestPage,
  safeNavigate,
  waitForPageStability,
} = require('../utils/test-helpers');
const { attachSummary, escapeHtml } = require('../utils/reporting-utils');
const {
  selectAccessibilityTestPages,
  DEFAULT_ACCESSIBILITY_SAMPLE,
} = require('../utils/a11y-shared');

const STRUCTURE_WCAG_REFERENCES = [
  { id: '1.3.1', name: 'Info and Relationships' },
  { id: '2.4.1', name: 'Bypass Blocks' },
  { id: '2.4.6', name: 'Headings and Labels' },
  { id: '2.4.10', name: 'Section Headings' },
];

const renderWcagBadgesHtml = (references) =>
  references
    .map((ref) => `<span class="badge badge-wcag">${escapeHtml(`${ref.id} ${ref.name}`)}</span>`)
    .join(' ');

const renderWcagListMarkdown = (references) =>
  references.map((ref) => `- ${ref.id} ${ref.name}`);

const analyseStructureHtml = (reports) => {
  if (!reports.length) return '';

  const rows = reports
    .map(
      (report) => `
        <tr class="${report.gating.length ? 'impact-critical' : ''}">
          <td><code>${escapeHtml(report.page)}</code></td>
          <td>${report.h1Count}</td>
          <td>${report.hasMain ? 'Yes' : 'No'}</td>
          <td>${report.headingSkips.length}</td>
          <td>${report.gating.length}</td>
          <td>${report.advisories.length}</td>
        </tr>
      `
    )
    .join('');

  const cards = reports
    .map((report) => {
      const gatingList = report.gating
        .map((item) => `<li class="check-fail">${escapeHtml(item)}</li>`)
        .join('');
      const advisoryList = report.advisories.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
      const headingSummary = report.headingLevels
        .map((entry) => `<li><code>${escapeHtml(entry.text)}</code> (H${entry.level})</li>`)
        .join('');

      const landmarks = `
        <ul class="details">
          <li>Main landmark: ${report.hasMain ? 'present' : 'missing'}</li>
          <li>Navigation landmarks: ${report.navigationCount}</li>
          <li>Header landmarks: ${report.headerCount}</li>
          <li>Footer landmarks: ${report.footerCount}</li>
        </ul>
      `;

      const headingSkips = report.headingSkips.length
        ? `<details><summary>Heading level skips</summary><ul class="details">${report.headingSkips
            .map((skip) => `<li>${escapeHtml(skip)}</li>`)
            .join('')}</ul></details>`
        : '';

      return `
        <section class="summary-report summary-a11y page-card">
          <div class="page-card__header">
            <h3>${escapeHtml(report.page)}</h3>
            <span class="status-pill ${report.gating.length ? 'error' : 'success'}">
              ${report.gating.length ? `${report.gating.length} gating issue(s)` : 'Pass'}
            </span>
          </div>
          <p class="details">H1 count: ${report.h1Count}</p>
          ${landmarks}
          ${report.gating.length ? `<ul class="details">${gatingList}</ul>` : ''}
          ${report.advisories.length ? `<details><summary>Advisories (${report.advisories.length})</summary><ul class="details">${advisoryList}</ul></details>` : ''}
          ${headingSkips}
          <details><summary>Heading outline (${report.headingLevels.length} headings)</summary><ul class="details">${headingSummary}</ul></details>
        </section>
      `;
    })
    .join('');

  return `
    <section class="summary-report summary-a11y">
      <h2>Accessibility structure audit summary</h2>
      <p class="details">Validated landmarks and heading structure across ${reports.length} page(s).</p>
      <p class="details"><strong>WCAG coverage:</strong> ${renderWcagBadgesHtml(STRUCTURE_WCAG_REFERENCES)}</p>
      <table>
        <thead>
          <tr><th>Page</th><th>H1 count</th><th>Main landmark</th><th>Heading skips</th><th>Gating issues</th><th>Advisories</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${cards}
    </section>
  `;
};

const analyseStructureMarkdown = (reports) => {
  if (!reports.length) return '';

  const lines = [
    '# Accessibility structure audit summary',
    '',
    '| Page | H1 count | Main landmark | Heading skips | Gating issues | Advisories |',
    '| --- | --- | --- | --- | --- | --- |',
    ...reports.map((report) =>
      `| \`${report.page}\` | ${report.h1Count} | ${report.hasMain ? 'Yes' : 'No'} | ${report.headingSkips.length} | ${
        report.gating.length
      } | ${report.advisories.length} |`
    ),
  ];

  lines.push('', '### WCAG coverage');
  lines.push(...renderWcagListMarkdown(STRUCTURE_WCAG_REFERENCES));
  lines.push('');

  reports.forEach((report) => {
    if (!report.gating.length && !report.advisories.length) return;
    lines.push('', `## \`${report.page}\``);
    if (report.gating.length) {
      lines.push('', '### Gating issues');
      report.gating.forEach((item) => lines.push(`- ❗ ${item}`));
    }
    if (report.advisories.length) {
      lines.push('', '### Advisories');
      report.advisories.forEach((item) => lines.push(`- ℹ️ ${item}`));
    }
  });

  return lines.join('\n');
};

const evaluateStructure = async (page) => {
  return page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((heading) => ({
      level: Number(heading.tagName.substring(1)),
      text: (heading.textContent || '').trim(),
    }));

    const h1Count = headings.filter((heading) => heading.level === 1).length;
    const hasMain = Boolean(document.querySelector('main,[role="main"]'));
    const navigationCount = document.querySelectorAll('nav,[role="navigation"]').length;
    const headerCount = document.querySelectorAll('header,[role="banner"]').length;
    const footerCount = document.querySelectorAll('footer,[role="contentinfo"]').length;

    const headingSkips = [];
    let previousLevel = null;
    headings.forEach((heading) => {
      if (previousLevel !== null) {
        const delta = heading.level - previousLevel;
        if (delta > 1) {
          headingSkips.push(
            `Level jumps from H${previousLevel} to H${heading.level} — "${heading.text || 'Untitled heading'}"`
          );
        }
      }
      previousLevel = heading.level;
    });

    return {
      headings,
      h1Count,
      hasMain,
      navigationCount,
      headerCount,
      footerCount,
      headingSkips,
    };
  });
};

test.describe('Accessibility: Structural landmarks', () => {
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

  test('Landmarks and headings meet baseline accessibility expectations', async ({ page }) => {
    test.setTimeout(7200000);

    const pages = selectAccessibilityTestPages(siteConfig, {
      defaultSize: DEFAULT_ACCESSIBILITY_SAMPLE,
      configKeys: ['a11yStructureSampleSize', 'a11yResponsiveSampleSize'],
    });

    const reports = [];

    for (const pagePath of pages) {
      const report = {
        page: pagePath,
        gating: [],
        advisories: [],
        headingLevels: [],
        headingSkips: [],
        h1Count: 0,
        hasMain: false,
        navigationCount: 0,
        headerCount: 0,
        footerCount: 0,
      };
      reports.push(report);

      await test.step(`Structure audit: ${pagePath}`, async () => {
        const response = await safeNavigate(page, `${siteConfig.baseUrl}${pagePath}`);
        if (!response || response.status() >= 400) {
          report.gating.push(
            `Failed to load page (status ${response ? response.status() : 'unknown'})`
          );
          return;
        }

        const stability = await waitForPageStability(page);
        if (!stability.ok) {
          report.gating.push(`Page did not reach a stable state: ${stability.message}`);
          return;
        }

        const structure = await evaluateStructure(page);
        report.headingLevels = structure.headings;
        report.headingSkips = structure.headingSkips;
        report.h1Count = structure.h1Count;
        report.hasMain = structure.hasMain;
        report.navigationCount = structure.navigationCount;
        report.headerCount = structure.headerCount;
        report.footerCount = structure.footerCount;

        if (structure.h1Count === 0) {
          report.gating.push('No H1 heading found on the page.');
        } else if (structure.h1Count > 1) {
          report.gating.push(`Expected a single H1 heading; found ${structure.h1Count}.`);
        }

        if (!structure.hasMain) {
          report.gating.push('Missing <main> landmark (or equivalent role="main").');
        }

        if (!structure.navigationCount) {
          report.advisories.push('No navigation landmark detected. Ensure primary navigation is wrapped in <nav>.');
        }

        if (!structure.headerCount) {
          report.advisories.push('No header/banner landmark detected.');
        }

        if (!structure.footerCount) {
          report.advisories.push('No footer/contentinfo landmark detected.');
        }

        if (structure.headingSkips.length) {
          report.advisories.push(
            `Heading levels skip levels on this page (${structure.headingSkips.length} occurrence(s)).`
          );
        }
      });
    }

    const gatingTotal = reports.reduce((sum, report) => sum + report.gating.length, 0);

    await attachSummary({
      baseName: 'a11y-structure-summary',
      htmlBody: analyseStructureHtml(reports),
      markdown: analyseStructureMarkdown(reports),
      setDescription: true,
    });

    expect(gatingTotal, 'Structural accessibility gating issues detected').toBe(0);
  });
});
