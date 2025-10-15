const { test } = require('@playwright/test');
const { assertReportSummaryPayload } = require('./report-schema-validator');

const SUMMARY_STYLES = `
<style>
  .schema-group { display: grid; gap: 1.6rem; }
  .schema-group__project-block { display: grid; gap: 1.6rem; }
  .schema-group__project { margin: 0; }
  .schema-group__project h3 { margin: 0; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(15, 23, 42, 0.6); }
  .summary-report { background: var(--bg-card, #ffffff); border: 1px solid var(--border-color, rgba(148, 163, 184, 0.18)); border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow-sm, 0 6px 18px rgba(15, 23, 42, 0.08)); display: grid; gap: 0.9rem; }
  .summary-report h2,
  .summary-report h3 { margin: 0; font-size: 1.25rem; color: var(--text-strong, #1f2933); }
  .summary-report .summary-heading-best-practice { color: var(--text-strong, #1f2933); border-bottom: 1px solid rgba(59, 130, 246, 0.18); padding-bottom: 0.25rem; }
  .summary-report p { margin: 0; color: var(--text-muted, #475467); font-size: 0.95rem; }
  .summary-report p strong { color: var(--text-strong, #1f2933); }
  .summary-report .legend { display: flex; flex-wrap: wrap; gap: 0.5rem; font-size: 0.85rem; color: var(--text-muted, #475467); }
  .summary-report table { width: 100%; border-collapse: collapse; border-radius: 14px; overflow: hidden; box-shadow: var(--shadow-sm, 0 6px 18px rgba(15, 23, 42, 0.08)); }
  .summary-report thead { background: var(--accent, #3b82f6); color: #fff; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.08em; }
  .summary-report th,
  .summary-report td { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(15, 23, 42, 0.08); font-size: 0.95rem; vertical-align: top; }
  .summary-report tbody tr:last-child td { border-bottom: none; }
  .summary-report code { font-family: 'JetBrains Mono', 'Fira Code', 'SFMono-Regular', monospace; font-size: 0.85rem; background: #f1f5f9; border-radius: 4px; padding: 0.15rem 0.3rem; }
  .summary-report .status-summary { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.6rem 1.25rem; }
  .summary-report .status-summary li { display: inline-flex; gap: 0.5rem; align-items: center; font-size: 0.95rem; color: var(--text-strong, #1f2933); }
  .summary-report .status-pill { display: inline-flex; align-items: center; gap: 0.35rem; border-radius: 999px; padding: 0.25rem 0.75rem; border: 1px solid rgba(148, 163, 184, 0.35); font-size: 0.85rem; font-weight: 600; background: rgba(15, 23, 42, 0.05); color: var(--text-strong, #1f2933); }
  .summary-report .status-pill.status-error { background: rgba(220, 38, 38, 0.15); border-color: rgba(220, 38, 38, 0.35); color: #b42318; }
  .summary-report .status-pill.status-warning { background: rgba(234, 179, 8, 0.18); border-color: rgba(234, 179, 8, 0.32); color: #92400e; }
  .summary-report .status-pill.status-info { background: rgba(59, 130, 246, 0.15); border-color: rgba(59, 130, 246, 0.3); color: #1d4ed8; }
  .summary-report .status-pill.status-success { background: rgba(16, 185, 129, 0.16); border-color: rgba(16, 185, 129, 0.28); color: #047857; }
  .summary-report .status-pill.status-neutral { background: rgba(148, 163, 184, 0.18); border-color: rgba(148, 163, 184, 0.35); color: #475467; }
  .summary-report .badge { display: inline-flex; align-items: center; padding: 0.25rem 0.55rem; border-radius: 999px; font-size: 0.8rem; border: 1px solid rgba(148, 163, 184, 0.35); background: rgba(148, 163, 184, 0.15); color: #475467; margin: 0 0.35rem 0.35rem 0; }
  .summary-report .badge-critical { background: rgba(220, 38, 38, 0.15); border-color: rgba(220, 38, 38, 0.32); color: #b42318; }
  .summary-report .badge-serious { background: rgba(234, 179, 8, 0.18); border-color: rgba(234, 179, 8, 0.32); color: #92400e; }
  .summary-report .badge-wcag { background: rgba(99, 102, 241, 0.15); border-color: rgba(99, 102, 241, 0.32); color: #3730a3; }
  .summary-report .badge-neutral { background: rgba(148, 163, 184, 0.18); border-color: rgba(148, 163, 184, 0.35); color: #475467; }
  .summary-report .details { color: var(--text-muted, #475467); font-size: 0.95rem; margin: 0; }
  .summary-note { margin: 0.5rem 0; }
  .summary-note > summary { cursor: pointer; font-weight: 600; color: var(--text-muted, #475467); }
  .summary-report ul.checks { margin: 0.35rem 0 0.35rem 1.1rem; padding-left: 1.1rem; color: var(--text-muted, #475467); font-size: 0.9rem; }
  .summary-report ul.checks li { margin: 0.15rem 0; }
  .summary-report .note { margin-top: 0.25rem; font-size: 0.85rem; color: var(--text-muted, #475467); }
  .summary-report .schema-metrics { display: grid; gap: 0.75rem; margin: 0; }
  .summary-report .schema-metrics__item { display: grid; gap: 0.25rem; }
  .summary-report .schema-value { color: var(--text-strong, #1f2933); }
  .summary-report .schema-value--empty { color: #98a2b3; font-style: italic; }
  .summary-report .schema-list { margin: 0.25rem 0 0.25rem 1.1rem; padding-left: 1.1rem; }
  .summary-report .schema-list li { margin: 0.15rem 0; }
  .summary-per-page-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; }
  .summary-toggle-controls { display: inline-flex; gap: 0.5rem; }
  .summary-toggle-button { border: 1px solid var(--border-color, rgba(148, 163, 184, 0.18)); background: var(--bg-card, #ffffff); color: var(--text-strong, #1f2933); border-radius: 999px; padding: 0.4rem 0.95rem; font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: all 0.2s ease; }
  .summary-toggle-button:hover { border-color: rgba(59, 130, 246, 0.35); box-shadow: 0 8px 18px rgba(59, 130, 246, 0.15); }
  .summary-page { border: 1px solid var(--border-color, rgba(148, 163, 184, 0.18)); border-radius: 16px; background: var(--bg-card, #ffffff); box-shadow: var(--shadow-sm, 0 6px 18px rgba(15, 23, 42, 0.08)); margin: 0.75rem 0; overflow: hidden; }
  .summary-page > summary { padding: 1rem 1.25rem; list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 1rem; font-weight: 600; color: var(--text-strong, #1f2933); }
  .summary-page > summary::-webkit-details-marker { display: none; }
  .summary-page__body { padding: 1.25rem 1.25rem 1.4rem; border-top: 1px solid rgba(15, 23, 42, 0.08); display: grid; gap: 1.25rem; }
  .summary-page--wcag.summary-page--fail > summary { background: rgba(220, 38, 38, 0.08); }
  .summary-page--wcag.summary-page--warn > summary { background: rgba(234, 179, 8, 0.15); }
  .summary-page--wcag.summary-page--pass > summary { background: rgba(16, 185, 129, 0.1); }
  .page-card { border: none; padding: 0; box-shadow: none; background: transparent; }
  .page-card__header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
  .page-card__meta { display: grid; gap: 0.35rem; margin: 0.75rem 0 0.25rem; }
  .page-card__table table { margin-top: 0.75rem; box-shadow: none; border: 1px solid rgba(15, 23, 42, 0.08); border-radius: 12px; overflow: hidden; }
  .page-card__table th { background: rgba(59, 130, 246, 0.18); color: #0f172a; font-size: 0.75rem; letter-spacing: 0.05em; text-transform: uppercase; }
  .page-card__table td { font-size: 0.9rem; }
  .summary-report .visual-previews { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
  .summary-report .visual-previews figure { margin: 0; border: 1px solid var(--border-color, rgba(148, 163, 184, 0.18)); border-radius: 12px; padding: 0.75rem; background: var(--bg-card, #ffffff); display: grid; gap: 0.5rem; }
  .summary-report .visual-previews img { width: 100%; height: auto; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.2); }
  .summary-report .visual-previews figcaption { font-size: 0.85rem; color: var(--text-muted, #475467); }
  .summary-report .summary-toggle-controls button { font-family: inherit; }
  .summary-report .summary-table { margin-top: 0.75rem; }
  .summary-report .summary-table table { margin-top: 0; }
  .summary-report .checks { list-style: disc; }
  .summary-report .checks li.check-pass::marker { color: #16a34a; }
  .summary-report .checks li.check-fail::marker { color: #dc2626; }
</style>
`;

const PER_PAGE_TOGGLE_SCRIPT = `
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
`;

const DESCRIPTION_BYTE_LIMIT = 18_000_000;

const wrapHtml = (content) => `${SUMMARY_STYLES}${content}`;

const renderPerPageAccordion = (items, options = {}) => {
  const entries = Array.isArray(items) ? items.filter(Boolean) : [];
  if (entries.length === 0) return '';

  const {
    heading = 'Per-page breakdown',
    showLabel = 'Show all',
    hideLabel = 'Hide all',
    summaryClass = '',
    renderCard,
    formatSummaryLabel,
  } = options;

  if (typeof renderCard !== 'function') return '';

  const summaryClassName = ['summary-page', summaryClass].filter(Boolean).join(' ');
  const labelFormatter =
    typeof formatSummaryLabel === 'function'
      ? formatSummaryLabel
      : (entry) => entry?.page || 'Page';

  const detailsHtml = entries
    .map((entry) => {
      const cardHtml = renderCard(entry);
      if (!cardHtml) return '';
      const summaryLabel = escapeHtml(labelFormatter(entry));
      return `
        <details class="${summaryClassName}">
          <summary>${summaryLabel}</summary>
          <div class="summary-page__body">
            ${cardHtml}
          </div>
        </details>
      `;
    })
    .filter(Boolean)
    .join('\n');

  if (!detailsHtml.trim()) return '';

  return `
    <section class="summary-report summary-a11y" data-per-page="controls">
      <h3>${escapeHtml(heading)}</h3>
      <div class="summary-toggle-controls">
        <button type="button" class="summary-toggle-button" data-toggle="expand">${escapeHtml(showLabel)}</button>
        <button type="button" class="summary-toggle-button" data-toggle="collapse">${escapeHtml(hideLabel)}</button>
      </div>
    </section>
    <section class="summary-report summary-a11y" data-per-page="list">
      ${detailsHtml}
    </section>
    <script>${PER_PAGE_TOGGLE_SCRIPT}</script>
  `;
};

const renderSummaryMetrics = (entries) => {
  const items = Array.isArray(entries)
    ? entries
        .map((entry) => {
          if (!entry || typeof entry.label !== 'string') return '';
          const label = entry.label.trim();
          if (!label) return '';
          const rawValue = entry.value;
          let displayValue;
          if (rawValue === null || rawValue === undefined) {
            displayValue = '—';
          } else if (typeof rawValue === 'number') {
            displayValue = rawValue.toLocaleString();
          } else {
            displayValue = String(rawValue);
          }
          return `
      <div class="schema-metrics__item">
        <dt>${escapeHtml(label)}</dt>
        <dd><span class="schema-value">${escapeHtml(displayValue)}</span></dd>
      </div>
    `;
        })
        .filter(Boolean)
        .join('\n')
    : '';

  if (!items) return '';

  return `<dl class="schema-metrics">${items}</dl>`;
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const resolveTestInfo = (maybeTestInfo) => {
  if (maybeTestInfo) return maybeTestInfo;
  try {
    return test.info();
  } catch (_error) {
    throw new Error(
      'attachSummary must be called within a Playwright test or provided an explicit testInfo instance.'
    );
  }
};

async function attachSummary(testInfoOrOptions, maybeOptions) {
  const hasExplicitTestInfo = Boolean(maybeOptions);
  const testInfo = resolveTestInfo(hasExplicitTestInfo ? testInfoOrOptions : undefined);
  const options = hasExplicitTestInfo ? maybeOptions : testInfoOrOptions;

  if (!options || typeof options !== 'object') {
    throw new Error('attachSummary requires an options object.');
  }

  const { baseName, htmlBody, markdown, setDescription = false, title = null } = options;
  if (!baseName) {
    throw new Error('attachSummary requires a baseName value.');
  }

  const payload = {
    type: 'custom-report-summary',
    baseName,
    title: title ? String(title) : null,
    setDescription: Boolean(setDescription),
    htmlBody: htmlBody ? wrapHtml(htmlBody) : null,
    markdown: markdown || null,
    createdAt: new Date().toISOString(),
  };

  await testInfo.attach(`${baseName}.summary.json`, {
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
  });

  if (payload.htmlBody) {
    const byteLength = Buffer.byteLength(payload.htmlBody, 'utf8');
    if (byteLength <= DESCRIPTION_BYTE_LIMIT) {
      await testInfo.attach(`${baseName}.summary.html`, {
        contentType: 'text/html',
        body: Buffer.from(payload.htmlBody, 'utf8'),
      });
    } else {
      await testInfo.attach(`${baseName}.summary-truncated.txt`, {
        contentType: 'text/plain',
        body: Buffer.from(
          `Summary HTML (${byteLength.toLocaleString()} bytes) exceeds inline byte limit (${DESCRIPTION_BYTE_LIMIT.toLocaleString()} bytes).`,
          'utf8'
        ),
      });
    }
  }

  if (payload.markdown) {
    await testInfo.attach(`${baseName}.summary.md`, {
      contentType: 'text/markdown',
      body: Buffer.from(payload.markdown, 'utf8'),
    });
  }
}

async function attachSchemaSummary(testInfoOrPayload, maybePayload) {
  const hasExplicitTestInfo = Boolean(maybePayload);
  const testInfo = resolveTestInfo(hasExplicitTestInfo ? testInfoOrPayload : undefined);
  const payload = hasExplicitTestInfo ? maybePayload : testInfoOrPayload;

  if (!payload || typeof payload !== 'object') {
    throw new Error('attachSchemaSummary requires a payload object.');
  }

  assertReportSummaryPayload(payload);

  const baseName = payload.baseName || payload.kind || 'summary';
  await testInfo.attach(`${baseName}.summary.schema.json`, {
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
  });
}

module.exports = {
  attachSummary,
  attachSchemaSummary,
  escapeHtml,
  SUMMARY_STYLES,
  PER_PAGE_TOGGLE_SCRIPT,
  renderPerPageAccordion,
  renderSummaryMetrics,
  wrapHtml,
};
