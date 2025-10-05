const { test, expect } = require('../utils/test-fixtures');
const SiteLoader = require('../utils/site-loader');

test.use({ trace: 'off', video: 'off' });
const {
  safeNavigate,
  waitForPageStability,
} = require('../utils/test-helpers');
const { attachSchemaSummary } = require('../utils/reporting-utils');
const { createRunSummaryPayload, createPageSummaryPayload } = require('../utils/report-schema');
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

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';

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

  test.beforeEach(async ({ page, context, errorContext: sharedErrorContext }, testInfo) => {
    const siteName = process.env.SITE_NAME;
    if (!siteName) throw new Error('SITE_NAME environment variable is required');

    siteConfig = SiteLoader.loadSite(siteName);
    SiteLoader.validateSiteConfig(siteConfig);
    errorContext = sharedErrorContext;
  });

  test('Landmarks and headings meet baseline accessibility expectations', async ({ page }, testInfo) => {
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

    const projectName = siteConfig.name || process.env.SITE_NAME || 'default';

    const runPayload = createRunSummaryPayload({
      baseName: `a11y-structure-summary-${slugify(projectName)}`,
      title: 'Landmark & heading structure summary',
      overview: {
        totalPagesAudited: reports.length,
        pagesMissingMain: reports.filter((report) => !report.hasMain).length,
        pagesWithHeadingSkips: reports.filter((report) => report.headingSkips.length > 0).length,
        pagesWithGatingIssues: reports.filter((report) => report.gating.length > 0).length,
        pagesWithAdvisories: reports.filter((report) => report.advisories.length > 0).length,
      },
      metadata: {
        spec: 'a11y.structure.landmarks',
        summaryType: 'structure',
        projectName,
        suppressPageEntries: true,
        scope: 'project',
      },
    });
    runPayload.details = {
      pages: reports.map((report) => ({
        page: report.page,
        h1Count: report.h1Count,
        hasMainLandmark: report.hasMain,
        navigationLandmarks: report.navigationCount,
        headerLandmarks: report.headerCount,
        footerLandmarks: report.footerCount,
        headingSkips: report.headingSkips,
        gating: report.gating,
        advisories: report.advisories,
        headingOutline: report.headingLevels,
      })),
      wcagReferences: STRUCTURE_WCAG_REFERENCES,
    };
    await attachSchemaSummary(testInfo, runPayload);

    for (const report of reports) {
      const pagePayload = createPageSummaryPayload({
        baseName: `a11y-structure-${slugify(projectName)}-${slugify(report.page)}`,
        title: `Structure audit — ${report.page}`,
        page: report.page,
        viewport: 'structure',
        summary: {
          h1Count: report.h1Count,
          hasMainLandmark: report.hasMain,
          navigationLandmarks: report.navigationCount,
          headerLandmarks: report.headerCount,
          footerLandmarks: report.footerCount,
          headingSkips: report.headingSkips,
          gatingIssues: report.gating,
          advisories: report.advisories,
          headingOutline: report.headingLevels,
        },
        metadata: {
          spec: 'a11y.structure.landmarks',
          summaryType: 'structure',
          projectName,
        },
      });
      await attachSchemaSummary(testInfo, pagePayload);
    }

    expect(gatingTotal, 'Structural accessibility gating issues detected').toBe(0);
  });
});
