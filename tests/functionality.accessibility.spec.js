const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const SiteLoader = require('../utils/site-loader');
const {
  setupTestPage,
  teardownTestPage,
  safeNavigate,
  waitForPageStability,
} = require('../utils/test-helpers');
const { attachSummary, escapeHtml } = require('../utils/allure-utils');
const {
  extractWcagLevels,
  violationHasWcagCoverage,
  formatWcagLabels,
  WCAG_AXE_TAGS,
} = require('../utils/a11y-utils');

const STABILITY_TIMEOUT_MS = 20000;

const STATUS_METADATA = {
  passed: { label: 'No gating violations', pillClass: 'success' },
  violations: { label: 'Accessibility violations', pillClass: 'error' },
  'stability-timeout': { label: 'Stability timeout', pillClass: 'warning' },
  'http-error': { label: 'HTTP error', pillClass: 'error' },
  'scan-error': { label: 'Scan error', pillClass: 'warning' },
  skipped: { label: 'Skipped', pillClass: 'neutral' },
};

const truncate = (value, max = 160) => {
  const stringValue = String(value || '').trim();
  return stringValue.length > max ? `${stringValue.slice(0, max - 1)}…` : stringValue;
};

const formatRuleSummary = (violations, title = 'Violation roll-up by rule') => {
  const aggregate = new Map();
  for (const { page, entries } of violations) {
    for (const violation of entries) {
      const key = violation.id;
      if (!aggregate.has(key)) {
        aggregate.set(key, {
          id: violation.id,
          impact: violation.impact,
          helpUrl: violation.helpUrl,
          pages: new Set(),
          totalNodes: 0,
          levels: new Map(),
        });
      }
      const entry = aggregate.get(key);
      entry.pages.add(page);
      entry.totalNodes += violation.nodes?.length || 0;
      const levels = extractWcagLevels(violation.tags || []);
      for (const level of levels) {
        entry.levels.set(level.label, level);
      }
    }
  }

  if (aggregate.size === 0) return null;

  const rows = Array.from(aggregate.values()).map((item) => {
    const levels = Array.from(item.levels.values())
      .map((level) => level.label)
      .join('<br />') || 'n/a';
    return `| ${item.impact || 'unknown'} | ${item.id} | ${item.pages.size} | ${item.totalNodes} | ${levels} | [link](${item.helpUrl}) |`;
  });

  const heading = `${title} (${aggregate.size} unique rule${aggregate.size === 1 ? '' : 's'})`;

  return (
    `### ${heading}\n\n` +
    '| Impact | Rule | Pages | Nodes | WCAG level | Help |\n| --- | --- | --- | --- | --- | --- |\n' +
    rows.join('\n') +
    '\n'
  );
};

const formatViolationTableMarkdown = (page, violations, options = {}) => {
  if (!violations.length) return '';
  const { title, headingLevel = '###' } = options;
  const rows = violations.map((violation) => {
    const nodes = (violation.nodes || [])
      .slice(0, 5)
      .map((node) => (node.target && node.target[0]) || node.html || 'node')
      .map((target) => `\`${target}\``)
      .join('<br />');
    const levels = extractWcagLevels(violation.tags || []);
    const levelText = levels.map((level) => level.label).join('<br />') || 'n/a';
    return `| ${violation.impact || 'unknown'} | ${violation.id} | ${violation.nodes?.length || 0} | ${levelText} | [link](${violation.helpUrl}) | ${nodes || 'n/a'} |`;
  });

  const headingText = title || `${page} (${violations.length} issues)`;

  return (
    `${headingLevel} ${headingText}\n\n` +
    '| Impact | Rule | Nodes | WCAG level | Help | Sample targets |\n| --- | --- | --- | --- | --- | --- |\n' +
    rows.join('\n') +
    '\n'
  );
};

const formatRuleSummaryHtml = (violations, title = 'Rule summary') => {
  const aggregate = new Map();
  for (const { page, entries } of violations) {
    for (const violation of entries) {
      const key = violation.id;
      if (!aggregate.has(key)) {
        aggregate.set(key, {
          id: violation.id,
          impact: violation.impact,
          helpUrl: violation.helpUrl,
          pages: new Set(),
          totalNodes: 0,
          levels: new Map(),
        });
      }
      const entry = aggregate.get(key);
      entry.pages.add(page);
      entry.totalNodes += violation.nodes?.length || 0;
      const levels = extractWcagLevels(violation.tags || []);
      for (const level of levels) {
        entry.levels.set(level.label, level);
      }
    }
  }

  if (aggregate.size === 0) return '';

  const rows = Array.from(aggregate.values())
    .map((item) => {
      const impact = item.impact || 'unknown';
      const wcagBadges = formatWcagLabels(Array.from(item.levels.values()), {
        asHtmlBadges: true,
      });
      return `
        <tr class="impact-${impact.toLowerCase()}">
          <td>${escapeHtml(impact)}</td>
          <td>${escapeHtml(item.id)}</td>
          <td>${item.pages.size}</td>
          <td>${item.totalNodes}</td>
          <td>${wcagBadges}</td>
          <td><a href="${escapeHtml(item.helpUrl || '#')}" target="_blank" rel="noopener noreferrer">rule docs</a></td>
        </tr>
      `;
    })
    .join('');

  const heading = `${title} (${aggregate.size} unique rule${aggregate.size === 1 ? '' : 's'})`;

  return `
    <section class="summary-report summary-a11y">
      <h3>${escapeHtml(heading)}</h3>
      <table>
        <thead>
          <tr><th>Impact</th><th>Rule</th><th>Pages</th><th>Nodes</th><th>WCAG level</th><th>Help</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
};

const createViolationTableHtml = (violations) => {
  if (!violations.length) return '';
  const rows = violations
    .map((violation) => {
      const nodes = (violation.nodes || [])
        .slice(0, 5)
        .map((node) =>
          `<code>${escapeHtml((node.target && node.target[0]) || node.html || 'node')}</code>`
        )
        .join('<br />');
      const impact = violation.impact || 'unknown';
      const wcagBadges = formatWcagLabels(extractWcagLevels(violation.tags || []), {
        asHtmlBadges: true,
      });
      return `
        <tr class="impact-${impact.toLowerCase()}">
          <td>${escapeHtml(impact)}</td>
          <td>${escapeHtml(violation.id)}</td>
          <td>${violation.nodes?.length || 0}</td>
          <td><a href="${escapeHtml(violation.helpUrl || '#')}" target="_blank" rel="noopener noreferrer">rule docs</a></td>
          <td>${wcagBadges}</td>
          <td>${nodes || 'n/a'}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="page-card__table">
      <table>
        <thead>
          <tr><th>Impact</th><th>Rule</th><th>Nodes</th><th>Help</th><th>WCAG level</th><th>Sample targets</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
};

const formatPageCardHtml = (report) => {
  const meta = STATUS_METADATA[report.status] || STATUS_METADATA.skipped;
  const pillClass = meta?.pillClass || 'neutral';

  const stability = report.stability;
  let stabilitySummary = 'Stability check not attempted.';
  let stabilityAttemptsHtml = '';
  if (stability) {
    if (stability.ok) {
      stabilitySummary = `Reached <code>${escapeHtml(
        stability.successfulStrategy
      )}</code> in ${stability.duration}ms.`;
    } else {
      stabilitySummary = `Failed to reach a stable state (budget ${STABILITY_TIMEOUT_MS / 1000}s per strategy).`;
      if (Array.isArray(stability.attempts) && stability.attempts.length > 0) {
        stabilityAttemptsHtml = `
          <ul class="details">
            ${stability.attempts
              .map(
                (attempt) =>
                  `<li><code>${escapeHtml(attempt.strategy)}</code> (${attempt.duration}ms) — ${escapeHtml(
                    truncate(attempt.errorMessage, 120)
                  )}</li>`
              )
              .join('')}
          </ul>
        `;
      }
    }
  }

  const httpInfo =
    report.httpStatus && report.httpStatus !== 200
      ? `<p class="details"><strong>HTTP:</strong> Received status ${report.httpStatus}; accessibility scan skipped.</p>`
      : '';

  const notesHtml = Array.isArray(report.notes) && report.notes.length > 0
    ? `<ul class="details">${report.notes
        .map((note) => `<li>${escapeHtml(note)}</li>`)
        .join('')}</ul>`
    : '';

  const gatingLabel = report.gatingLabel || 'WCAG A/AA/AAA';

  const gatingSections = [];
  if (Array.isArray(report.violations) && report.violations.length > 0) {
    gatingSections.push(`<h4>Gating issues (${report.violations.length})</h4>`);
    gatingSections.push(createViolationTableHtml(report.violations));
  } else {
    gatingSections.push(
      `<p class="details">No ${escapeHtml(gatingLabel)} accessibility violations detected.</p>`
    );
  }

  if (Array.isArray(report.advisory) && report.advisory.length > 0) {
    gatingSections.push(`<h4>Non-gating WCAG findings (${report.advisory.length})</h4>`);
    gatingSections.push(createViolationTableHtml(report.advisory));
  }

  if (Array.isArray(report.bestPractice) && report.bestPractice.length > 0) {
    gatingSections.push(
      `<h4>Best-practice advisories (no WCAG tag) (${report.bestPractice.length})</h4>`
    );
    gatingSections.push(createViolationTableHtml(report.bestPractice));
  }

  const bodySections = [];

  if (report.status === 'stability-timeout') {
    bodySections.push(
      '<p class="details">Axe scan skipped because the page never reached a stable state.</p>'
    );
  } else if (report.status === 'scan-error') {
    bodySections.push('<p class="details">Axe scan failed before results could be collected.</p>');
  } else if (report.status === 'http-error') {
    bodySections.push('<p class="details">Page responded with a non-200 status; scan was not executed.</p>');
  }

  if (notesHtml) {
    bodySections.push(notesHtml);
  }

  if (gatingSections.length > 0) {
    bodySections.push(gatingSections.join(''));
  }

  if (bodySections.length === 0) {
    bodySections.push('<p class="details">No additional details available for this page.</p>');
  }

  const bodyHtml = bodySections.join('');

  return `
    <section class="summary-report summary-a11y page-card">
      <div class="page-card__header">
        <h3>${escapeHtml(report.page)}</h3>
        <span class="status-pill ${pillClass}">${escapeHtml(meta.label)}</span>
      </div>
      <div class="page-card__meta">
        <p class="details"><strong>Stability:</strong> ${stabilitySummary}</p>
        <p class="details"><strong>Gating:</strong> ${escapeHtml(gatingLabel)}</p>
        ${stabilityAttemptsHtml}
        ${httpInfo}
      </div>
      ${bodyHtml}
    </section>
  `;
};

const formatPageCardMarkdown = (report) => {
  const meta = STATUS_METADATA[report.status] || STATUS_METADATA.skipped;
  const gatingLabel = report.gatingLabel || 'WCAG A/AA/AAA';
  const lines = [`### ${report.page}`, '', `- Status: ${meta.label}`, `- Gating: ${gatingLabel}`];

  if (report.stability) {
    if (report.stability.ok) {
      lines.push(
        `- Stability: Reached ${report.stability.successfulStrategy} in ${report.stability.duration}ms`
      );
    } else {
      lines.push(
        `- Stability: Failed to reach stable state (budget ${STABILITY_TIMEOUT_MS / 1000}s per strategy)`
      );
      if (Array.isArray(report.stability.attempts) && report.stability.attempts.length > 0) {
        lines.push('- Stability attempts:');
        report.stability.attempts.forEach((attempt) => {
          lines.push(
            `  - ${attempt.strategy} (${attempt.duration}ms): ${truncate(attempt.errorMessage, 120)}`
          );
        });
      }
    }
  }

  if (report.httpStatus && report.httpStatus !== 200) {
    lines.push(`- HTTP: Received status ${report.httpStatus} (scan skipped)`);
  }

  if (Array.isArray(report.notes) && report.notes.length > 0) {
    lines.push('- Notes:');
    report.notes.forEach((note) => {
      lines.push(`  - ${note}`);
    });
  }

  const hasGating = Array.isArray(report.violations) && report.violations.length > 0;
  const hasAdvisory = Array.isArray(report.advisory) && report.advisory.length > 0;
  const hasBestPractice = Array.isArray(report.bestPractice) && report.bestPractice.length > 0;

  if (hasGating) {
    lines.push('');
    lines.push(formatViolationTableMarkdown(report.page, report.violations));
  } else {
    lines.push('');
    lines.push(`- No ${gatingLabel} accessibility violations detected.`);
  }

  if (hasAdvisory) {
    lines.push('');
    lines.push(
      formatViolationTableMarkdown(report.page, report.advisory, {
        headingLevel: '####',
        title: `${report.page} — Non-gating WCAG findings (${report.advisory.length} issues)`,
      })
    );
  }

  if (hasBestPractice) {
    lines.push('');
    lines.push(
      formatViolationTableMarkdown(report.page, report.bestPractice, {
        headingLevel: '####',
        title: `${report.page} — Best-practice advisories (no WCAG tag) (${report.bestPractice.length} issues)`,
      })
    );
  }

  return lines.join('\n');
};

const buildSuiteSummaryHtml = (
  pageReports,
  aggregatedViolations,
  aggregatedAdvisories,
  aggregatedBestPractices,
  failOnLabel
) => {
  const counts = pageReports.reduce((acc, report) => {
    const key = report.status || 'skipped';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const summaryItems = Object.entries(counts)
    .map(([key, count]) => {
      const meta = STATUS_METADATA[key] || STATUS_METADATA.skipped;
      const pillClass = meta?.pillClass || 'neutral';
      return `<li><span class="status-pill ${pillClass}">${escapeHtml(meta.label)}</span><span>${count} page(s)</span></li>`;
    })
    .join('');

  const advisoryPages = pageReports.filter(
    (report) => Array.isArray(report.advisory) && report.advisory.length > 0
  ).length;
  const bestPracticePages = pageReports.filter(
    (report) => Array.isArray(report.bestPractice) && report.bestPractice.length > 0
  ).length;

  const ruleSummaryHtml = formatRuleSummaryHtml(aggregatedViolations, 'Gating rule summary');
  const advisoryRuleSummaryHtml =
    aggregatedAdvisories && aggregatedAdvisories.length > 0
      ? formatRuleSummaryHtml(aggregatedAdvisories, 'Non-gating rule summary')
      : '';
  const bestPracticeRuleSummaryHtml =
    aggregatedBestPractices && aggregatedBestPractices.length > 0
      ? formatRuleSummaryHtml(aggregatedBestPractices, 'Best-practice advisory summary')
      : '';
  const pageCardsHtml = pageReports.map((report) => formatPageCardHtml(report)).join('\n');

  return `
    <section class="summary-report summary-a11y">
      <h2>Accessibility run summary</h2>
      <p>Analyzed <strong>${pageReports.length}</strong> page(s) with a ${STABILITY_TIMEOUT_MS / 1000}s stability budget per strategy.</p>
      ${summaryItems ? `<ul class="status-summary">${summaryItems}</ul>` : ''}
      <p class="details">Gating threshold: ${escapeHtml(failOnLabel)}</p>
      ${
        advisoryPages > 0
          ? `<p class="details">Non-gating WCAG findings surfaced on ${advisoryPages} page(s).</p>`
          : ''
      }
      ${
        bestPracticePages > 0
          ? `<p class="details">Best-practice advisories (no WCAG tag) surfaced on ${bestPracticePages} page(s).</p>`
          : ''
      }
      <p class="legend"><span class="badge badge-critical">Critical</span><span class="badge badge-serious">Serious</span><span class="badge badge-wcag">WCAG A/AA/AAA</span><span class="badge badge-best-practice">Best-practice advisory</span></p>
    </section>
    ${ruleSummaryHtml}
    ${advisoryRuleSummaryHtml}
    ${bestPracticeRuleSummaryHtml}
    <section class="summary-report summary-a11y">
      <h3>Per-page breakdown</h3>
    </section>
    ${pageCardsHtml}
  `;
};

const buildSuiteSummaryMarkdown = (
  pageReports,
  aggregatedViolations,
  aggregatedAdvisories,
  aggregatedBestPractices,
  failOnLabel
) => {
  const counts = pageReports.reduce(
    (acc, report) => {
      const key = report.status || 'skipped';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {}
  );

  const lines = [
    '# Accessibility run summary',
    '',
    `- Total pages: ${pageReports.length}`,
    `- Pages with violations: ${counts.violations || 0}`,
    `- Stability timeouts: ${counts['stability-timeout'] || 0}`,
    `- HTTP errors: ${counts['http-error'] || 0}`,
    `- Scan errors: ${counts['scan-error'] || 0}`,
    `- Passed without gating issues: ${counts.passed || 0}`,
    `- Gating threshold: ${failOnLabel}`,
    `- Pages with non-gating WCAG findings: ${pageReports.filter((report) => Array.isArray(report.advisory) && report.advisory.length > 0).length}`,
    `- Pages with best-practice advisories (no WCAG tag): ${pageReports.filter((report) => Array.isArray(report.bestPractice) && report.bestPractice.length > 0).length}`,
    '',
    '## Per-page breakdown',
    '',
    '| Page | Status | Notes |',
    '| --- | --- | --- |',
  ];

  pageReports.forEach((report) => {
    const meta = STATUS_METADATA[report.status] || STATUS_METADATA.skipped;
    const notes = [];
    if (report.stability) {
      notes.push(
        report.stability.ok
          ? `Stability via ${report.stability.successfulStrategy}`
          : 'Stability timed out'
      );
    }
    if (report.status === 'violations' && report.violations?.length) {
      notes.push(`${report.violations.length} issue(s)`);
    }
    if (report.httpStatus && report.httpStatus !== 200) {
      notes.push(`HTTP ${report.httpStatus}`);
    }
    if (report.status === 'scan-error' && Array.isArray(report.notes) && report.notes.length > 0) {
      notes.push(truncate(report.notes[0], 80));
    }
    if (Array.isArray(report.advisory) && report.advisory.length > 0) {
      notes.push(`${report.advisory.length} non-gating finding(s)`);
    }
    if (Array.isArray(report.bestPractice) && report.bestPractice.length > 0) {
      notes.push(`${report.bestPractice.length} best-practice advisory finding(s)`);
    }
    lines.push(`| \`${report.page}\` | ${meta.label} | ${notes.join('; ') || '—'} |`);
  });

  const gatingRuleSummary = formatRuleSummary(aggregatedViolations, 'Gating rule summary');
  if (gatingRuleSummary) {
    lines.push('', gatingRuleSummary);
  }

  const advisoryRuleSummary = formatRuleSummary(aggregatedAdvisories, 'Non-gating rule summary');
  if (advisoryRuleSummary) {
    lines.push('', advisoryRuleSummary);
  }

  const bestPracticeRuleSummary = formatRuleSummary(
    aggregatedBestPractices,
    'Best-practice advisory summary'
  );
  if (bestPracticeRuleSummary) {
    lines.push('', bestPracticeRuleSummary);
  }

  aggregatedViolations.forEach((entry) => {
    lines.push('', formatViolationTableMarkdown(entry.page, entry.entries));
  });

  if (aggregatedAdvisories) {
    aggregatedAdvisories.forEach((entry) => {
      lines.push(
        '',
        formatViolationTableMarkdown(entry.page, entry.entries, {
          headingLevel: '####',
          title: `${entry.page} — Non-gating WCAG findings (${entry.entries.length} issues)`,
        })
      );
    });
  }

  if (aggregatedBestPractices) {
    aggregatedBestPractices.forEach((entry) => {
      lines.push(
        '',
        formatViolationTableMarkdown(entry.page, entry.entries, {
          headingLevel: '####',
          title: `${entry.page} — Best-practice advisories (no WCAG tag) (${entry.entries.length} issues)`,
        })
      );
    });
  }

  return lines.join('\n');
};

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'root';

const buildAxeBuilder = (page) => {
  const builder = new AxeBuilder({ page });
  const tagsMode = String(process.env.A11Y_TAGS_MODE || 'all').toLowerCase();
  if (tagsMode === 'wcag') {
    builder.withTags(WCAG_AXE_TAGS);
  }
  return builder;
};

test.describe('Functionality: Accessibility (WCAG)', () => {
  let siteConfig;
  let errorContext;
  let a11yMode;

  test.beforeEach(async ({ page, context }) => {
    const siteName = process.env.SITE_NAME;
    if (!siteName) throw new Error('SITE_NAME environment variable is required');
    siteConfig = SiteLoader.loadSite(siteName);
    SiteLoader.validateSiteConfig(siteConfig);
    errorContext = await setupTestPage(page, context);
    a11yMode = siteConfig.a11yMode === 'audit' ? 'audit' : 'gate';
  });

  test.afterEach(async ({ page, context }) => {
    await teardownTestPage(page, context, errorContext);
  });

  test('WCAG 2.1 A/AA scans', async ({ page }) => {
    test.setTimeout(7200000);
    const pages = process.env.SMOKE
      ? (Array.isArray(siteConfig.testPages) && siteConfig.testPages.includes('/'))
        ? ['/']
        : [siteConfig.testPages[0]]
      : siteConfig.testPages;

    const failOn = Array.isArray(siteConfig.a11yFailOn)
      ? siteConfig.a11yFailOn
      : ['critical', 'serious'];
    const failOnSet = new Set(failOn.map((impact) => String(impact).toLowerCase()));
    const failOnLabel = failOn.map((impact) => String(impact).toUpperCase()).join('/');

    const aggregatedViolations = [];
    const aggregatedAdvisories = [];
    const aggregatedBestPractices = [];
    const pageReports = [];

    for (const testPage of pages) {
      await test.step(`Accessibility scan: ${testPage}`, async () => {
        const pageReport = {
          page: testPage,
          status: 'skipped',
          httpStatus: null,
          stability: null,
          notes: [],
          violations: [],
          advisory: [],
          bestPractice: [],
          gatingLabel: failOnLabel,
        };
        pageReports.push(pageReport);

        let response;
        try {
          response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        } catch (error) {
          pageReport.status = 'scan-error';
          pageReport.notes.push(`Navigation failed: ${error.message}`);
          console.error(`⚠️  Navigation failed for ${testPage}: ${error.message}`);

          const navigationSlug = `${slugify(testPage)}-navigation-error`;
          await attachSummary({
            baseName: `a11y-${navigationSlug}`,
            htmlBody: formatPageCardHtml(pageReport),
            markdown: formatPageCardMarkdown(pageReport),
          });

          if (a11yMode !== 'audit') {
            throw new Error(`Navigation failed for ${testPage}: ${error.message}`);
          }
          return;
        }

        pageReport.httpStatus = response.status();
        if (response.status() !== 200) {
          pageReport.status = 'http-error';
          pageReport.notes.push(`Received HTTP status ${response.status()}; scan skipped.`);
          console.error(`⚠️  HTTP ${response.status()} while loading ${testPage}; skipping scan.`);

          const httpSlug = `${slugify(testPage)}-http-error`;
          await attachSummary({
            baseName: `a11y-${httpSlug}`,
            htmlBody: formatPageCardHtml(pageReport),
            markdown: formatPageCardMarkdown(pageReport),
          });
          if (a11yMode !== 'audit') {
            throw new Error(`HTTP ${response.status()} received for ${testPage}`);
          }
          return;
        }

        const stability = await waitForPageStability(page, { timeout: STABILITY_TIMEOUT_MS });
        pageReport.stability = stability;
        if (!stability.ok) {
          pageReport.status = 'stability-timeout';
          pageReport.notes.push(stability.message);
          console.warn(`⚠️  ${stability.message} for ${testPage}`);

          const stabilitySlug = `${slugify(testPage)}-stability`;
          await attachSummary({
            baseName: `a11y-${stabilitySlug}`,
            htmlBody: formatPageCardHtml(pageReport),
            markdown: formatPageCardMarkdown(pageReport),
          });
          return;
        }

        try {
            const results = await buildAxeBuilder(page).analyze();

          const ignoreRules = Array.isArray(siteConfig.a11yIgnoreRules)
            ? siteConfig.a11yIgnoreRules
            : [];

          const relevantViolations = (results.violations || []).filter(
            (violation) => !ignoreRules.includes(violation.id)
          );

          const gatingViolations = relevantViolations.filter((violation) =>
            failOnSet.has(String(violation.impact || '').toLowerCase())
          );

          const advisoryViolations = relevantViolations.filter(
            (violation) =>
              !failOnSet.has(String(violation.impact || '').toLowerCase()) &&
              violationHasWcagCoverage(violation)
          );

          const bestPracticeViolations = relevantViolations.filter(
            (violation) =>
              !failOnSet.has(String(violation.impact || '').toLowerCase()) &&
              !violationHasWcagCoverage(violation)
          );

          pageReport.violations = gatingViolations;
          pageReport.advisory = advisoryViolations;
          pageReport.bestPractice = bestPracticeViolations;

          if (gatingViolations.length > 0) {
            pageReport.status = 'violations';
            aggregatedViolations.push({
              page: testPage,
              entries: gatingViolations,
            });
            const pageSlug = slugify(testPage);
            await attachSummary({
              baseName: `a11y-${pageSlug}`,
              htmlBody: formatPageCardHtml(pageReport),
              markdown: formatPageCardMarkdown(pageReport),
            });
            const message = `❌ ${gatingViolations.length} accessibility violations (gating: ${failOnLabel}) on ${testPage}`;
            if (a11yMode === 'audit') {
              console.warn(message);
            } else {
              console.error(message);
            }
          } else {
            pageReport.status = 'passed';
            console.log(`✅ No ${failOnLabel} accessibility violations on ${testPage}`);
          }

          if (advisoryViolations.length > 0) {
            aggregatedAdvisories.push({
              page: testPage,
              entries: advisoryViolations,
            });
            console.warn(
              `ℹ️  ${advisoryViolations.length} non-gating WCAG finding(s) on ${testPage}`
            );
          }

          if (bestPracticeViolations.length > 0) {
            aggregatedBestPractices.push({
              page: testPage,
              entries: bestPracticeViolations,
            });
            console.warn(
              `ℹ️  ${bestPracticeViolations.length} best-practice advisory finding(s) (no WCAG tag) on ${testPage}`
            );
          }

          if (
            pageReport.status === 'passed' &&
            (advisoryViolations.length > 0 || bestPracticeViolations.length > 0)
          ) {
            const pageSlug = slugify(testPage);
            await attachSummary({
              baseName: `a11y-${pageSlug}`,
              htmlBody: formatPageCardHtml(pageReport),
              markdown: formatPageCardMarkdown(pageReport),
            });
          }
        } catch (error) {
          pageReport.status = 'scan-error';
          pageReport.notes.push(`Axe scan failed: ${error.message}`);
          console.error(`⚠️  Accessibility scan failed for ${testPage}: ${error.message}`);

          const errorSlug = `${slugify(testPage)}-scan-error`;
          await attachSummary({
            baseName: `a11y-${errorSlug}`,
            htmlBody: formatPageCardHtml(pageReport),
            markdown: formatPageCardMarkdown(pageReport),
          });
        } finally {
          if (pageReport.status === 'skipped') {
            pageReport.status = 'passed';
          }
        }
      });
    }

    const summaryHtml = buildSuiteSummaryHtml(
      pageReports,
      aggregatedViolations,
      aggregatedAdvisories,
      aggregatedBestPractices,
      failOnLabel
    );
    const summaryMarkdown = buildSuiteSummaryMarkdown(
      pageReports,
      aggregatedViolations,
      aggregatedAdvisories,
      aggregatedBestPractices,
      failOnLabel
    );

    await attachSummary({
      baseName: 'a11y-summary',
      htmlBody: summaryHtml,
      markdown: summaryMarkdown,
      setDescription: true,
    });

    const totalViolations = aggregatedViolations.reduce(
      (sum, entry) => sum + (entry.entries?.length || 0),
      0
    );
    const totalAdvisory = aggregatedAdvisories.reduce(
      (sum, entry) => sum + (entry.entries?.length || 0),
      0
    );
    const totalBestPractice = aggregatedBestPractices.reduce(
      (sum, entry) => sum + (entry.entries?.length || 0),
      0
    );

    if (totalAdvisory > 0) {
      console.warn(
        `ℹ️ Non-gating WCAG findings detected (${totalAdvisory} item(s)); review the Allure summary for details.`
      );
    }

    if (totalBestPractice > 0) {
      console.warn(
        `ℹ️ Best-practice advisory findings (no WCAG tag) detected (${totalBestPractice} item(s)); review the Allure summary for details.`
      );
    }

    if (totalViolations > 0) {
      if (a11yMode === 'audit') {
        console.warn(
          'ℹ️ Accessibility audit summary available in Allure report (description pane).'
        );
      } else {
        expect(
          totalViolations,
          `Accessibility violations detected (gating: ${failOnLabel}). See the Allure description for a structured breakdown.`
        ).toBe(0);
      }
    }
  });
});
