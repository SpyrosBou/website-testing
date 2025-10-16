const { test } = require('@playwright/test');
const { assertReportSummaryPayload } = require('./report-schema-validator');

const SUMMARY_STYLES = `
<style>
  .schema-group { display: grid; gap: 1rem; }
  .schema-group__project-block { display: grid; gap: 1rem; }
  .schema-group__project { margin: 0; }
  .schema-group__project h3 { margin: 0; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(15, 23, 42, 0.6); }
  .summary-report { background: var(--bg-card, #ffffff); border: 1px solid rgba(15, 23, 42, 0.08); border-radius: var(--radius-lg, 16px); padding: 1.35rem 1.5rem; box-shadow: 0 18px 30px rgba(15, 23, 42, 0.12); display: grid; gap: 0.9rem; }
  .summary-report h2,
  .summary-report h3 { margin: 0 0 0.75rem; font-size: 1.25rem; color: #0f172a; }
  .summary-report .summary-heading-best-practice { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.55rem; border-radius: 8px; background: rgba(14, 165, 233, 0.16); color: #0b7285; }
  .summary-report p { margin: 0; color: var(--text-muted, #475467); font-size: 0.95rem; }
  .summary-report p strong { color: #0f172a; }
  .summary-report .details { margin: 0.4rem 0 0; color: var(--text-muted, #475467); font-size: 0.95rem; }
  .summary-report .legend { margin: 0.75rem 0 0; display: flex; flex-wrap: wrap; gap: 0.5rem; font-size: 0.85rem; color: var(--text-muted, #475467); }
  .summary-report table { width: 100%; border-collapse: collapse; border-radius: var(--radius-md, 10px); overflow: hidden; background: #ffffff; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08); margin-top: 0.85rem; }
  .summary-report th,
  .summary-report td { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(15, 23, 42, 0.08); text-align: left; vertical-align: top; font-size: 0.95rem; }
  .summary-report tbody tr:last-child td { border-bottom: none; }
  .summary-report tr.impact-critical td { background: rgba(220, 38, 38, 0.12); }
  .summary-report tr.impact-serious td { background: rgba(220, 38, 38, 0.08); }
  .summary-report tr.impact-moderate td { background: rgba(217, 119, 6, 0.1); }
  .summary-report tr.impact-minor td { background: rgba(14, 165, 233, 0.1); }
  .summary-report code { background: #f1f5f9; padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.85rem; color: #0f172a; }
  .summary-report .status-summary { list-style: none; padding: 0; margin: 0.75rem 0 0; display: flex; flex-wrap: wrap; gap: 0.6rem 1rem; }
  .summary-report .status-summary li { display: inline-flex; align-items: center; gap: 0.55rem; font-size: 0.9rem; color: var(--text-muted, #475467); }
  .summary-report .badge { display: inline-flex; align-items: center; padding: 0.2rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; border: 1px solid rgba(15, 23, 42, 0.12); }
  .summary-report .badge-critical { background: rgba(220, 38, 38, 0.14); color: #b42318; }
  .summary-report .badge-serious { background: rgba(217, 119, 6, 0.16); color: #92400e; }
  .summary-report .badge-wcag { background: rgba(59, 130, 246, 0.18); color: #3b82f6; }
  .summary-report .badge-neutral { background: rgba(148, 163, 184, 0.16); color: #475467; }
  .summary-report .schema-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin: 0; }
  .summary-report .schema-metrics__item { background: rgba(29, 78, 216, 0.05); border-radius: var(--radius-md, 10px); padding: 0.85rem 1rem; display: grid; gap: 0.35rem; }
  .summary-report .schema-metrics__item dt { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(15, 23, 42, 0.6); }
  .summary-report .schema-metrics__item dd { margin: 0; }
  .summary-report .schema-value { font-weight: 500; font-size: 1.35rem; color: #0f172a; }
  .summary-report .schema-value--empty { color: #98a2b3; font-style: italic; }
  .summary-report .schema-list { margin: 0.25rem 0 0.25rem 1.1rem; padding-left: 1.1rem; }
  .summary-report .schema-list li { margin: 0.15rem 0; }
  .summary-per-page-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  .summary-toggle-controls { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 0.75rem; }
  .summary-toggle-button { border: 1px solid rgba(37, 99, 235, 0.25); background: rgba(29, 78, 216, 0.1); color: #3b82f6; border-radius: 999px; padding: 0.45rem 0.9rem; font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease; }
  .summary-toggle-button:hover { background: rgba(29, 78, 216, 0.16); box-shadow: 0 12px 22px rgba(30, 64, 175, 0.15); }
  .summary-toggle-button:focus-visible { outline: 2px solid rgba(29, 78, 216, 0.4); outline-offset: 2px; }
  .summary-page { border: 1px solid rgba(15, 23, 42, 0.08); border-radius: 0; background: #ffffff; box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.04); }
  .summary-page > summary { padding: 0.5rem; font-weight: 400; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; color: #0f172a; }
  .summary-page > summary::-webkit-details-marker { display: none; }
  .summary-page[open] > summary { border-bottom: 1px solid rgba(15, 23, 42, 0.08); }
  .summary-page__body { padding: 1rem 1.25rem 1.35rem; background: #f8fafc; }
  .page-card { border: none; padding: 0; box-shadow: none; background: transparent; }
  .page-card__header { display: flex; align-items: center; justify-content: space-between; gap: 0.85rem; margin-bottom: 0.75rem; }
  .page-card__meta { display: grid; gap: 0.35rem; margin-bottom: 0.85rem; }
  .page-card__table { margin: 0.85rem 0; }
  .page-card__table table { width: 100%; border-collapse: collapse; background: #ffffff; border-radius: var(--radius-md, 10px); overflow: hidden; box-shadow: 0 12px 22px rgba(15, 23, 42, 0.1); }
  .page-card__table th,
  .page-card__table td { padding: 0.65rem 0.85rem; border-bottom: 1px solid rgba(15, 23, 42, 0.08); font-size: 0.9rem; vertical-align: top; }
  .page-card__table tbody tr:last-child td { border-bottom: none; }
  .summary-report .visual-previews { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
  .summary-report .visual-previews figure { margin: 0; border: 1px solid rgba(15, 23, 42, 0.08); border-radius: 12px; padding: 0.75rem; background: #ffffff; display: grid; gap: 0.5rem; box-shadow: 0 8px 16px rgba(15, 23, 42, 0.08); }
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
