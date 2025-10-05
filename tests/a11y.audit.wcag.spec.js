const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { test, expect } = require('../utils/test-fixtures');
const SiteLoader = require('../utils/site-loader');
const {
  safeNavigate,
  waitForPageStability,
} = require('../utils/test-helpers');
const { attachSchemaSummary, escapeHtml } = require('../utils/reporting-utils');
const {
  extractWcagLevels,
  violationHasWcagCoverage,
  formatWcagLabels,
} = require('../utils/a11y-utils');
const { createAxeBuilder } = require('../utils/a11y-runner');
const { selectAccessibilityTestPages, resolveSampleSetting } = require('../utils/a11y-shared');
const { createRunSummaryPayload, createPageSummaryPayload } = require('../utils/report-schema');

test.use({ trace: 'off', video: 'off' });

const STABILITY_TIMEOUT_MS = 20000;

const formatPageLabel = (page) => (page === '/' ? 'Homepage' : page);
const pageSummaryTitle = (page, suffix) => `${formatPageLabel(page)} — ${suffix}`;

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

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'root';

const formatRuleSummary = (violations, title = 'Violation roll-up by rule') => {
  const aggregate = new Map();
  for (const { page, project, entries } of violations) {
    const viewport = project || 'default';
    for (const violation of entries) {
      const key = violation.id;
      if (!aggregate.has(key)) {
        aggregate.set(key, {
          id: violation.id,
          impact: violation.impact,
          helpUrl: violation.helpUrl,
          pages: new Set(),
          viewports: new Set(),
          occurrences: new Set(),
          totalNodes: 0,
          levels: new Map(),
        });
      }
      const entry = aggregate.get(key);
      entry.pages.add(page);
      entry.viewports.add(viewport);
      entry.occurrences.add(`${viewport}::${page}`);
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
    const viewportText = Array.from(item.viewports).sort().join(', ') || 'n/a';
    return `| ${item.impact || 'unknown'} | ${item.id} | ${viewportText} | ${item.pages.size} | ${item.totalNodes} | ${levels} | [link](${item.helpUrl}) |`;
  });

  const heading = `${title} (${aggregate.size} unique rule${aggregate.size === 1 ? '' : 's'})`;

  return (
    `### ${heading}\n\n` +
    '| Impact | Rule | Viewport(s) | Pages | Nodes | WCAG level | Help |\n| --- | --- | --- | --- | --- | --- | --- |\n' +
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
  for (const { page, project, entries } of violations) {
    const viewport = project || 'default';
    for (const violation of entries) {
      const key = violation.id;
      if (!aggregate.has(key)) {
        aggregate.set(key, {
          id: violation.id,
          impact: violation.impact,
          helpUrl: violation.helpUrl,
          pages: new Set(),
          viewports: new Set(),
          occurrences: new Set(),
          totalNodes: 0,
          levels: new Map(),
        });
      }
      const entry = aggregate.get(key);
      entry.pages.add(page);
      entry.viewports.add(viewport);
      entry.occurrences.add(`${viewport}::${page}`);
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
      const viewportText = escapeHtml(Array.from(item.viewports).sort().join(', ') || 'n/a');
      return `
        <tr class="impact-${impact.toLowerCase()}">
          <td>${escapeHtml(impact)}</td>
          <td>${escapeHtml(item.id)}</td>
          <td>${viewportText}</td>
          <td>${item.pages.size}</td>
          <td>${item.totalNodes}</td>
          <td>${wcagBadges}</td>
          <td><a href="${escapeHtml(item.helpUrl || '#')}" target="_blank" rel="noopener noreferrer">rule docs</a></td>
        </tr>
      `;
    })
    .join('');

  const heading = `${title} (${aggregate.size} unique rule${aggregate.size === 1 ? '' : 's'})`;
  const isBestPractice = /best-practice/i.test(title || '');
  const headingClass = isBestPractice ? 'summary-heading-best-practice' : '';

  return `
    <section class="summary-report summary-a11y">
      <h3${headingClass ? ` class="${headingClass}"` : ''}>${escapeHtml(heading)}</h3>
      <table>
        <thead>
          <tr><th>Impact</th><th>Rule</th><th>Viewport(s)</th><th>Pages</th><th>Nodes</th><th>WCAG level</th><th>Help</th></tr>
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
  const viewportLabel = report.projectName || 'default';

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
        <p class="details"><strong>Viewport:</strong> ${escapeHtml(viewportLabel)}</p>
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
  const lines = [
    `### ${report.page}`,
    '',
    `- Status: ${meta.label}`,
    `- Gating: ${gatingLabel}`,
    `- Viewport: ${report.projectName || 'default'}`,
  ];

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

  const ruleSummaryHtml = formatRuleSummaryHtml(aggregatedViolations, 'Blocking WCAG violations');
  const advisoryRuleSummaryHtml =
    aggregatedAdvisories && aggregatedAdvisories.length > 0
      ? formatRuleSummaryHtml(aggregatedAdvisories, 'WCAG advisory findings')
      : '';
  const bestPracticeRuleSummaryHtml =
    aggregatedBestPractices && aggregatedBestPractices.length > 0
      ? formatRuleSummaryHtml(aggregatedBestPractices, 'Best-practice advisories')
      : '';
  const uniqueViewports = Array.from(
    new Set(pageReports.map((report) => report.projectName || 'default'))
  );
  const viewportLabel = uniqueViewports.join(', ');

  return `
    <section class="summary-report summary-a11y">
      <h2>Accessibility run summary</h2>
      <p>Analyzed <strong>${pageReports.length}</strong> page(s) per browser across ${uniqueViewports.length} viewport(s): ${escapeHtml(viewportLabel)}.</p>
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
      <p class="legend"><span class="badge badge-critical">Critical</span><span class="badge badge-serious">Serious</span><span class="badge badge-wcag">WCAG A/AA/AAA</span></p>
    </section>
    ${ruleSummaryHtml}
    ${advisoryRuleSummaryHtml}
    ${bestPracticeRuleSummaryHtml}
    <section class="summary-report summary-a11y" data-per-page="controls">
      <h3>Per-page breakdown</h3>
      <div class="summary-toggle-controls">
        <button type="button" class="summary-toggle-button" data-toggle="expand">Show all</button>
        <button type="button" class="summary-toggle-button" data-toggle="collapse">Hide all</button>
      </div>
    </section>
    <section class="summary-report summary-a11y" data-per-page="list">
      ${pageReports
        .map((report) => {
          const cardHtml = formatPageCardHtml(report);
          return `
        <details class="summary-page summary-page--wcag">
          <summary>${escapeHtml(formatPageLabel(report.page))}</summary>
          <div class="summary-page__body">${cardHtml}</div>
        </details>
      `;
        })
        .join('\n')}
    </section>
    <script>
      (function () {
        const scriptEl = document.currentScript;
        if (!scriptEl) return;
        const listSection = scriptEl.previousElementSibling;
        const controlsSection = listSection && listSection.previousElementSibling;
        if (!listSection || !controlsSection) return;
        const accordions = Array.from(listSection.querySelectorAll('details'));
        if (accordions.length === 0) return;
        const setOpenState = (open) => {
          accordions.forEach((accordion) => {
            accordion.open = open;
          });
        };
        controlsSection.querySelectorAll('[data-toggle]').forEach((button) => {
          button.addEventListener('click', () => {
            setOpenState(button.dataset.toggle === 'expand');
          });
        });
      })();
    </script>
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
  ];

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

const collectRuleSnapshots = (entries, category) => {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const aggregate = new Map();

  entries.forEach(({ page, project, entries: violations }) => {
    const viewport = project || 'default';
    const pageKey = `${viewport}::${page}`;
    violations.forEach((violation) => {
      const ruleId = violation.id || 'unknown-rule';
      const key = `${category || 'rule'}::${ruleId}`;
      if (!aggregate.has(key)) {
        aggregate.set(key, {
          rule: ruleId,
          impact: violation.impact || category || 'info',
          helpUrl: violation.helpUrl || null,
          category,
          pages: new Set(),
          viewports: new Set(),
          nodes: 0,
          wcagTags: new Set(),
        });
      }
      const record = aggregate.get(key);
      record.pages.add(pageKey);
      record.viewports.add(viewport);
      record.nodes += violation.nodes?.length || 0;
      extractWcagLevels(violation.tags || []).forEach((level) => {
        if (level?.label) record.wcagTags.add(level.label);
      });
    });
  });

  return Array.from(aggregate.values()).map((record) => ({
    rule: record.rule,
    impact: record.impact,
    helpUrl: record.helpUrl,
    category: record.category,
    pages: Array.from(record.pages),
    viewports: Array.from(record.viewports),
    nodes: record.nodes,
    wcagTags: Array.from(record.wcagTags),
  }));
};

const buildAccessibilityRunSchemaPayload = ({
  reports,
  aggregatedViolations,
  aggregatedAdvisories,
  aggregatedBestPractices,
  failOnLabel,
  baseName,
  title,
  metadata,
  htmlBody,
  markdownBody,
}) => {
  if (!Array.isArray(reports) || reports.length === 0) return null;

  const viewportSet = new Set(reports.map((report) => report.projectName || 'default'));
  const toUniqueKey = (entry) => `${entry.project || 'default'}::${entry.page}`;
  const gatingPages = new Set(aggregatedViolations.map(toUniqueKey));
  const advisoryPages = new Set(aggregatedAdvisories.map(toUniqueKey));
  const bestPracticePages = new Set(aggregatedBestPractices.map(toUniqueKey));

  const ruleSnapshots = [
    ...collectRuleSnapshots(aggregatedViolations, 'gating'),
    ...collectRuleSnapshots(aggregatedAdvisories, 'advisory'),
    ...collectRuleSnapshots(aggregatedBestPractices, 'best-practice'),
  ];

  const totalViolations = aggregatedViolations.reduce(
    (acc, entry) => acc + (Array.isArray(entry.entries) ? entry.entries.length : 0),
    0
  );
  const totalAdvisories = aggregatedAdvisories.reduce(
    (acc, entry) => acc + (Array.isArray(entry.entries) ? entry.entries.length : 0),
    0
  );
  const totalBestPractices = aggregatedBestPractices.reduce(
    (acc, entry) => acc + (Array.isArray(entry.entries) ? entry.entries.length : 0),
    0
  );

  const payload = createRunSummaryPayload({
    baseName,
    title,
    overview: {
      totalPages: reports.length,
      gatingPages: gatingPages.size,
      advisoryPages: advisoryPages.size,
      bestPracticePages: bestPracticePages.size,
      totalGatingFindings: totalViolations,
      totalAdvisoryFindings: totalAdvisories,
      totalBestPracticeFindings: totalBestPractices,
      viewportsTested: viewportSet.size,
      failThreshold: failOnLabel,
    },
    ruleSnapshots,
    metadata: {
      spec: 'a11y.audit.wcag',
      ...metadata,
      viewports: Array.from(viewportSet),
      failOn: failOnLabel,
    },
  });

  if (htmlBody) payload.htmlBody = htmlBody;
  if (markdownBody) payload.markdownBody = markdownBody;
  return payload;
};

const buildAccessibilityPageSchemaPayloads = (reports, metadataExtras = {}) =>
  Array.isArray(reports)
    ? reports.map((report) => {
        const summary = {
          status: report.status,
          gatingViolations: (report.violations || []).length,
          advisoryFindings: (report.advisory || []).length,
          bestPracticeFindings: (report.bestPractice || []).length,
          stability: report.stability
            ? {
                ok: Boolean(report.stability.ok),
                strategy: report.stability.successfulStrategy || null,
                durationMs: report.stability.duration ?? null,
              }
            : null,
          httpStatus: report.httpStatus ?? 200,
          notes: Array.isArray(report.notes) ? report.notes : [],
          gatingLabel: report.gatingLabel || metadataExtras.gatingLabel || 'WCAG A/AA/AAA',
          cardHtml: formatPageCardHtml(report),
          cardMarkdown: formatPageCardMarkdown(report),
        };

        return createPageSummaryPayload({
          baseName: `a11y-page-${slugify(report.projectName || 'default')}-${slugify(report.page)}`,
          title: pageSummaryTitle(report.page, 'WCAG issues overview'),
          page: report.page,
          viewport: report.projectName || 'default',
          summary,
          metadata: {
            spec: 'a11y.audit.wcag',
            projectName: report.projectName || 'default',
            scope: 'project',
            ...metadataExtras,
          },
        });
      })
    : [];

const siteName = process.env.SITE_NAME;
if (!siteName) throw new Error('SITE_NAME environment variable is required');
const siteConfig = SiteLoader.loadSite(siteName);
SiteLoader.validateSiteConfig(siteConfig);

const accessibilitySampleSetting = resolveSampleSetting(siteConfig, {
  envKey: 'A11Y_SAMPLE',
  configKeys: ['a11yResponsiveSampleSize'],
  defaultSize: 'all',
  smokeSize: 1,
});

const accessibilityPages = selectAccessibilityTestPages(siteConfig, {
  envKey: 'A11Y_SAMPLE',
  configKeys: ['a11yResponsiveSampleSize'],
  defaultSize: 'all',
  smokeSize: 1,
});
const totalPages = accessibilityPages.length;
const RUN_TOKEN = process.env.A11Y_RUN_TOKEN || `${Date.now()}`;
if (!process.env.A11Y_RUN_TOKEN) {
  process.env.A11Y_RUN_TOKEN = RUN_TOKEN;
}

if (accessibilitySampleSetting !== 'all') {
  const sampleSource = process.env.A11Y_SAMPLE
    ? ` (A11Y_SAMPLE=${process.env.A11Y_SAMPLE})`
    : '';
  console.log(
    `ℹ️  Accessibility sampling limited to ${accessibilitySampleSetting} page(s)${sampleSource}.`
  );
}

const failOn = Array.isArray(siteConfig.a11yFailOn)
  ? siteConfig.a11yFailOn
  : ['critical', 'serious'];
const failOnSet = new Set(failOn.map((impact) => String(impact).toLowerCase()));
const failOnLabel = failOn.map((impact) => String(impact).toUpperCase()).join('/');
const A11Y_MODE = siteConfig.a11yMode === 'audit' ? 'audit' : 'gate';

const a11yResultsBaseDir = path.join(
  process.cwd(),
  'test-results',
  '__a11y',
  slugify(siteConfig.name || siteName)
);
const globalSummaryDir = path.join(a11yResultsBaseDir, '__global');
const resolveGlobalSummaryFlagPath = () =>
  path.join(globalSummaryDir, `${RUN_TOKEN}-summary.json`);

const resolveProjectResultsDir = (projectName) =>
  path.join(a11yResultsBaseDir, slugify(projectName || 'default'));

const resolvePageReportPath = (projectName, index, testPage) => {
  const projectDir = resolveProjectResultsDir(projectName);
  const fileName = `${String(index + 1).padStart(4, '0')}-${slugify(testPage)}.json`;
  return { projectDir, filePath: path.join(projectDir, fileName) };
};

const persistPageReport = async (projectName, index, report) => {
  const { projectDir, filePath } = resolvePageReportPath(projectName, index, report.page);
  await fsp.mkdir(projectDir, { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(report, null, 2), 'utf8');
  return filePath;
};

const readAllPageReports = async (projectName) => {
  const projectDir = resolveProjectResultsDir(projectName);
  try {
    const entries = await fsp.readdir(projectDir);
    const files = entries.filter((entry) => entry.endsWith('.json')).sort();
    const reports = [];
    for (const file of files) {
      const content = await fsp.readFile(path.join(projectDir, file), 'utf8');
      reports.push(JSON.parse(content));
    }
    return reports;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
};

const resolveAvailableProjectNames = async () => {
  try {
    const entries = await fsp.readdir(a11yResultsBaseDir, { withFileTypes: true });
    const candidates = entries
      .filter((entry) => entry.isDirectory() && entry.name !== '__global')
      .map((entry) => entry.name);

    const projects = [];
    for (const name of candidates) {
      const reports = await readAllPageReports(name);
      if (reports.some((report) => report.runToken === RUN_TOKEN)) {
        projects.push(name);
      }
    }
    return projects.length > 0 ? projects : candidates;
  } catch (_error) {
    return [];
  }
};

const deriveAggregatedFindings = (reports) => {
  const aggregatedViolations = [];
  const aggregatedAdvisories = [];
  const aggregatedBestPractices = [];

  for (const report of reports) {
    if (Array.isArray(report.violations) && report.violations.length > 0) {
      aggregatedViolations.push({
        page: report.page,
        project: report.projectName || 'default',
        entries: report.violations,
      });
    }
    if (Array.isArray(report.advisory) && report.advisory.length > 0) {
      aggregatedAdvisories.push({
        page: report.page,
        project: report.projectName || 'default',
        entries: report.advisory,
      });
    }
    if (Array.isArray(report.bestPractice) && report.bestPractice.length > 0) {
      aggregatedBestPractices.push({
        page: report.page,
        project: report.projectName || 'default',
        entries: report.bestPractice,
      });
    }
  }

  return { aggregatedViolations, aggregatedAdvisories, aggregatedBestPractices };
};

const maybeAttachGlobalSummary = async ({
  testInfo,
  totalPagesExpected,
  failOnLabel,
}) => {
  const flagPath = resolveGlobalSummaryFlagPath();
  try {
    await fsp.access(flagPath);
    return false;
  } catch (_error) {
    // flag not set; continue
  }

  const projectNames = await resolveAvailableProjectNames();
  if (projectNames.length === 0) {
    return false;
  }
  const combinedReports = [];

  for (const projectName of projectNames) {
    const reports = (await readAllPageReports(projectName))
      .filter((report) => report.runToken === RUN_TOKEN && typeof report.index === 'number')
      .sort((a, b) => (a.index || 0) - (b.index || 0));

    if (reports.length < totalPagesExpected) {
      return false; // other projects still processing; try later
    }

    combinedReports.push(...reports.slice(0, totalPagesExpected));
  }

  if (combinedReports.length === 0) return false;

  const { aggregatedViolations, aggregatedAdvisories, aggregatedBestPractices } =
    deriveAggregatedFindings(combinedReports);

  const summaryHtml = buildSuiteSummaryHtml(
    combinedReports,
    aggregatedViolations,
    aggregatedAdvisories,
    aggregatedBestPractices,
    failOnLabel
  );
  const summaryMarkdown = buildSuiteSummaryMarkdown(
    combinedReports,
    aggregatedViolations,
    aggregatedAdvisories,
    aggregatedBestPractices,
    failOnLabel
  );

  
  const schemaRunPayload = buildAccessibilityRunSchemaPayload({
    reports: combinedReports,
    aggregatedViolations,
    aggregatedAdvisories,
    aggregatedBestPractices,
    failOnLabel,
    baseName: 'a11y-summary',
    title: 'Sitewide WCAG findings',
    htmlBody: summaryHtml,
    markdownBody: summaryMarkdown,
    metadata: {
      scope: 'run',
      projectName: 'aggregate',
      summaryType: 'wcag',
      suppressPageEntries: true,
    },
  });
  if (schemaRunPayload) {
    await attachSchemaSummary(testInfo, schemaRunPayload);
  }

  await fsp.mkdir(globalSummaryDir, { recursive: true });
  await fsp.writeFile(
    flagPath,
    JSON.stringify({ attachedAt: new Date().toISOString(), project: testInfo.project.name }, null, 2),
    'utf8'
  );

  return true;
};

const waitForPageReports = async (projectName, expectedCount, timeoutMs = 300000, pollMs = 1000) => {
  if (expectedCount === 0) return [];
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const reports = (await readAllPageReports(projectName))
      .filter((report) => report.runToken === RUN_TOKEN && typeof report.index === 'number')
      .sort((a, b) => (a.index || 0) - (b.index || 0));
    if (reports.length >= expectedCount) {
      return reports.slice(0, expectedCount);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error(`Timed out waiting for ${expectedCount} accessibility page report(s).`);
};

test.describe('Functionality: Accessibility (WCAG)', () => {
  test.describe.parallel('Page scans', () => {
    let errorContext;

    test.beforeEach(async ({ errorContext: sharedErrorContext }) => {
      errorContext = sharedErrorContext;
    });

    accessibilityPages.forEach((testPage, index) => {
      test(`WCAG 2.1 A/AA scan ${index + 1}/${totalPages}: ${testPage}`, async ({ page }, testInfo) => {
        test.setTimeout(7200000);

        console.log(`➡️  [${index + 1}/${totalPages}] Accessibility scan for ${testPage}`);

      const pageReport = {
        page: testPage,
        index: index + 1,
        runToken: RUN_TOKEN,
        status: 'skipped',
        httpStatus: null,
        stability: null,
        notes: [],
        violations: [],
        advisory: [],
        bestPractice: [],
        gatingLabel: failOnLabel,
        projectName: testInfo.project?.name || 'default',
      };

        let response;
        try {
          response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        } catch (error) {
          pageReport.status = 'scan-error';
          pageReport.notes.push(`Navigation failed: ${error.message}`);
          console.error(`⚠️  Navigation failed for ${testPage}: ${error.message}`);

          const navigationSlug = `${slugify(testPage)}-navigation-error`;
          
          await persistPageReport(testInfo.project.name, index, pageReport);
          if (A11Y_MODE !== 'audit') {
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
          
          await persistPageReport(testInfo.project.name, index, pageReport);
          if (A11Y_MODE !== 'audit') {
            throw new Error(`HTTP ${response.status()} received for ${testPage}`);
          }
          return;
        }

        const stability = await waitForPageStability(page, {
          timeout: STABILITY_TIMEOUT_MS,
          strategies: Array.isArray(siteConfig.a11yStabilityStrategies)
            ? siteConfig.a11yStabilityStrategies
            : ['domcontentloaded', 'load', 'networkidle'],
        });
        pageReport.stability = stability;
        if (!stability.ok) {
          pageReport.status = 'stability-timeout';
          pageReport.notes.push(stability.message);
          console.warn(`⚠️  ${stability.message} for ${testPage}`);

          const stabilitySlug = `${slugify(testPage)}-stability`;
          
          await persistPageReport(testInfo.project.name, index, pageReport);
          return;
        }

        try {
          const results = await createAxeBuilder(page).analyze();

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
            const pageSlug = slugify(testPage);
                        const message = `❌ ${gatingViolations.length} accessibility violations (gating: ${failOnLabel}) on ${testPage}`;
            if (A11Y_MODE === 'audit') {
              console.warn(message);
            } else {
              console.error(message);
            }
          } else {
            pageReport.status = 'passed';
            console.log(`✅ No ${failOnLabel} accessibility violations on ${testPage}`);
          }

          if (advisoryViolations.length > 0) {
            console.warn(`ℹ️  ${advisoryViolations.length} non-gating WCAG finding(s) on ${testPage}`);
          }

          if (bestPracticeViolations.length > 0) {
            console.warn(
              `ℹ️  ${bestPracticeViolations.length} best-practice advisory finding(s) (no WCAG tag) on ${testPage}`
            );
          }

          if (
            pageReport.status === 'passed' &&
            (advisoryViolations.length > 0 || bestPracticeViolations.length > 0)
          ) {
            const pageSlug = slugify(testPage);
                      }
        } catch (error) {
          pageReport.status = 'scan-error';
          pageReport.notes.push(`Axe scan failed: ${error.message}`);
          console.error(`⚠️  Accessibility scan failed for ${testPage}: ${error.message}`);

          const errorSlug = `${slugify(testPage)}-scan-error`;
                  } finally {
          if (pageReport.status === 'skipped') {
            pageReport.status = 'passed';
          }
        }

        await persistPageReport(testInfo.project.name, index, pageReport);
      });
    });
  });

  test.describe.serial('Accessibility summary', () => {
    test('Aggregate results', async ({}, testInfo) => {
      test.setTimeout(300000);

      const reports = await waitForPageReports(testInfo.project.name, totalPages);
      if (reports.length === 0) {
        console.warn('ℹ️  Accessibility suite executed with no configured pages.');
        return;
      }

      const { aggregatedViolations, aggregatedAdvisories, aggregatedBestPractices } =
        deriveAggregatedFindings(reports);

      const summaryHtml = buildSuiteSummaryHtml(
        reports,
        aggregatedViolations,
        aggregatedAdvisories,
        aggregatedBestPractices,
        failOnLabel
      );
      const summaryMarkdown = buildSuiteSummaryMarkdown(
        reports,
        aggregatedViolations,
        aggregatedAdvisories,
        aggregatedBestPractices,
        failOnLabel
      );

      
      const schemaRunPayload = buildAccessibilityRunSchemaPayload({
        reports,
        aggregatedViolations,
        aggregatedAdvisories,
        aggregatedBestPractices,
        failOnLabel,
        baseName: `a11y-summary-${slugify(testInfo.project.name)}`,
        title: `WCAG findings – ${testInfo.project.name}`,
        // Avoid embedding the full HTML in per-project summaries to prevent
        // duplicate sections (the aggregate summary renders the rich cards).
      metadata: {
        scope: 'project',
        projectName: testInfo.project.name,
        summaryType: 'wcag',
        suppressPageEntries: true,
      },
    });
      if (schemaRunPayload) {
        await attachSchemaSummary(testInfo, schemaRunPayload);
      }

      const schemaPagePayloads = buildAccessibilityPageSchemaPayloads(reports, {
        summaryType: 'wcag',
        gatingLabel: failOnLabel,
      });
      for (const payload of schemaPagePayloads) {
        await attachSchemaSummary(testInfo, payload);
      }

      await maybeAttachGlobalSummary({
        testInfo,
        totalPagesExpected: totalPages,
        failOnLabel,
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
          `ℹ️ Non-gating WCAG findings detected (${totalAdvisory} item(s)); review the report summary for details.`
        );
      }

      if (totalBestPractice > 0) {
        console.warn(
          `ℹ️ Best-practice advisory findings (no WCAG tag) detected (${totalBestPractice} item(s)); review the report summary for details.`
        );
      }

      if (totalViolations > 0) {
        if (A11Y_MODE === 'audit') {
          console.warn('ℹ️ Accessibility audit summary available in the run report (summary section).');
        } else {
          expect(
            totalViolations,
            `Accessibility violations detected (gating: ${failOnLabel}). See the report summary for a structured breakdown.`
          ).toBe(0);
        }
      }
    });
  });
});
