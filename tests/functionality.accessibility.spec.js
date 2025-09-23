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

const formatRuleSummary = (violations) => {
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
        });
      }
      const entry = aggregate.get(key);
      entry.pages.add(page);
      entry.totalNodes += violation.nodes?.length || 0;
    }
  }

  if (aggregate.size === 0) return null;

  const rows = Array.from(aggregate.values()).map(
    (item) =>
      `| ${item.impact || 'unknown'} | ${item.id} | ${item.pages.size} | ${item.totalNodes} | [link](${item.helpUrl}) |`
  );

  return (
    '### Violation roll-up by rule\n\n' +
    '| Impact | Rule | Pages | Nodes | Help |\n| --- | --- | --- | --- | --- |\n' +
    rows.join('\n') +
    '\n'
  );
};

const formatViolationTableMarkdown = (page, violations) => {
  if (!violations.length) return '';
  const rows = violations.map((violation) => {
    const nodes = (violation.nodes || [])
      .slice(0, 5)
      .map((node) => (node.target && node.target[0]) || node.html || 'node')
      .map((target) => `\`${target}\``)
      .join('<br />');
    return `| ${violation.impact || 'unknown'} | ${violation.id} | ${violation.nodes?.length || 0} | [link](${violation.helpUrl}) | ${nodes || 'n/a'} |`;
  });

  return (
    `### ${page} (${violations.length} issues)\n\n` +
    '| Impact | Rule | Nodes | Help | Sample targets |\n| --- | --- | --- | --- | --- |\n' +
    rows.join('\n') +
    '\n'
  );
};

const formatRuleSummaryHtml = (violations) => {
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
        });
      }
      const entry = aggregate.get(key);
      entry.pages.add(page);
      entry.totalNodes += violation.nodes?.length || 0;
    }
  }

  if (aggregate.size === 0) return '';

  const rows = Array.from(aggregate.values())
    .map((item) => {
      const impact = item.impact || 'unknown';
      return `
        <tr class="impact-${impact.toLowerCase()}">
          <td>${escapeHtml(impact)}</td>
          <td>${escapeHtml(item.id)}</td>
          <td>${item.pages.size}</td>
          <td>${item.totalNodes}</td>
          <td><a href="${escapeHtml(item.helpUrl || '#')}" target="_blank" rel="noopener noreferrer">rule docs</a></td>
        </tr>
      `;
    })
    .join('');

  return `
    <section class="summary-report summary-a11y">
      <h3>Rule summary (${aggregate.size} unique rules)</h3>
      <table>
        <thead>
          <tr><th>Impact</th><th>Rule</th><th>Pages</th><th>Nodes</th><th>Help</th></tr>
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
      return `
        <tr class="impact-${impact.toLowerCase()}">
          <td>${escapeHtml(impact)}</td>
          <td>${escapeHtml(violation.id)}</td>
          <td>${violation.nodes?.length || 0}</td>
          <td><a href="${escapeHtml(violation.helpUrl || '#')}" target="_blank" rel="noopener noreferrer">rule docs</a></td>
          <td>${nodes || 'n/a'}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="page-card__table">
      <table>
        <thead>
          <tr><th>Impact</th><th>Rule</th><th>Nodes</th><th>Help</th><th>Sample targets</th></tr>
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

  let bodyHtml = '';
  if (report.status === 'violations' && report.violations?.length) {
    bodyHtml = createViolationTableHtml(report.violations);
  } else if (report.status === 'passed') {
    const gating = Array.isArray(report.failOn) && report.failOn.length > 0
      ? report.failOn.join('/').toUpperCase()
      : 'configured';
    bodyHtml = `<p class="details">No ${escapeHtml(gating)} accessibility violations detected.</p>`;
  } else if (report.status === 'stability-timeout') {
    bodyHtml = '<p class="details">Axe scan skipped because the page never reached a stable state.</p>';
  } else if (report.status === 'scan-error') {
    bodyHtml = '<p class="details">Axe scan failed before results could be collected.</p>';
  } else if (report.status === 'http-error') {
    bodyHtml = '<p class="details">Page responded with a non-200 status; scan was not executed.</p>';
  } else {
    bodyHtml = '<p class="details">No additional details available for this page.</p>';
  }

  return `
    <section class="summary-report summary-a11y page-card">
      <div class="page-card__header">
        <h3>${escapeHtml(report.page)}</h3>
        <span class="status-pill ${pillClass}">${escapeHtml(meta.label)}</span>
      </div>
      <div class="page-card__meta">
        <p class="details"><strong>Stability:</strong> ${stabilitySummary}</p>
        ${stabilityAttemptsHtml}
        ${httpInfo}
      </div>
      ${notesHtml}
      ${bodyHtml}
    </section>
  `;
};

const formatPageCardMarkdown = (report) => {
  const meta = STATUS_METADATA[report.status] || STATUS_METADATA.skipped;
  const lines = [`### ${report.page}`, '', `- Status: ${meta.label}`];

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

  if (report.status === 'violations' && report.violations?.length) {
    lines.push('');
    lines.push(formatViolationTableMarkdown(report.page, report.violations));
  }

  return lines.join('\n');
};

const buildSuiteSummaryHtml = (pageReports, aggregatedViolations) => {
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

  const ruleSummaryHtml = formatRuleSummaryHtml(aggregatedViolations);
  const pageCardsHtml = pageReports.map((report) => formatPageCardHtml(report)).join('\n');

  return `
    <section class="summary-report summary-a11y">
      <h2>Accessibility run summary</h2>
      <p>Analyzed <strong>${pageReports.length}</strong> page(s) with a ${STABILITY_TIMEOUT_MS / 1000}s stability budget per strategy.</p>
      ${summaryItems ? `<ul class="status-summary">${summaryItems}</ul>` : ''}
      <p class="legend"><span class="badge badge-critical">Critical</span><span class="badge badge-serious">Serious</span></p>
    </section>
    ${ruleSummaryHtml}
    <section class="summary-report summary-a11y">
      <h3>Per-page breakdown</h3>
    </section>
    ${pageCardsHtml}
  `;
};

const buildSuiteSummaryMarkdown = (pageReports, aggregatedViolations) => {
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
    lines.push(`| \`${report.page}\` | ${meta.label} | ${notes.join('; ') || '—'} |`);
  });

  if (aggregatedViolations.length > 0) {
    const ruleSummary = formatRuleSummary(aggregatedViolations);
    if (ruleSummary) {
      lines.push('', ruleSummary);
    }
    aggregatedViolations.forEach((entry) => {
      lines.push('', formatViolationTableMarkdown(entry.page, entry.entries));
    });
  }

  return lines.join('\n');
};

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'root';

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
    test.setTimeout(300000);
    const pages = process.env.SMOKE
      ? (Array.isArray(siteConfig.testPages) && siteConfig.testPages.includes('/'))
        ? ['/']
        : [siteConfig.testPages[0]]
      : siteConfig.testPages;

    const aggregatedViolations = [];
    const pageReports = [];

    for (const testPage of pages) {
      await test.step(`Accessibility scan: ${testPage}`, async () => {
        const failOn = Array.isArray(siteConfig.a11yFailOn)
          ? siteConfig.a11yFailOn
          : ['critical', 'serious'];
        const pageReport = {
          page: testPage,
          status: 'skipped',
          httpStatus: null,
          stability: null,
          notes: [],
          violations: [],
          failOn,
        };
        pageReports.push(pageReport);

        let response;
        try {
          response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        } catch (error) {
          pageReport.status = 'scan-error';
          pageReport.notes.push(`Navigation failed: ${error.message}`);
          console.error(`⚠️  Navigation failed for ${testPage}: ${error.message}`);
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
          const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();

          const ignoreRules = Array.isArray(siteConfig.a11yIgnoreRules)
            ? siteConfig.a11yIgnoreRules
            : [];

          const filtered = (results.violations || [])
            .filter((v) => failOn.includes(v.impact))
            .filter((v) => !ignoreRules.includes(v.id));

          if (filtered.length > 0) {
            pageReport.status = 'violations';
            pageReport.violations = filtered;
            aggregatedViolations.push({
              page: testPage,
              entries: filtered,
            });
            const pageSlug = slugify(testPage);
            await attachSummary({
              baseName: `a11y-${pageSlug}`,
              htmlBody: formatPageCardHtml(pageReport),
              markdown: formatPageCardMarkdown(pageReport),
            });
            const message = `❌ ${filtered.length} accessibility violations (fail-on: ${failOn.join(
              ', '
            )}) on ${testPage}`;
            if (a11yMode === 'audit') {
              console.warn(message);
            } else {
              console.error(message);
            }
          } else {
            pageReport.status = 'passed';
            console.log(`✅ No ${failOn.join('/')} accessibility violations on ${testPage}`);
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

    const summaryHtml = buildSuiteSummaryHtml(pageReports, aggregatedViolations);
    const summaryMarkdown = buildSuiteSummaryMarkdown(pageReports, aggregatedViolations);

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

    if (totalViolations > 0) {
      if (a11yMode === 'audit') {
        console.warn(
          'ℹ️ Accessibility audit summary available in Allure report (description pane).'
        );
      } else {
        expect(
          totalViolations,
          'Accessibility violations detected. See the Allure description for a structured breakdown.'
        ).toBe(0);
      }
    }
  });
});
