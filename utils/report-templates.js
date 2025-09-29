const { SUMMARY_STYLES } = require('./reporting-utils');

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return '0 B';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
};

const STATUS_LABELS = {
  passed: 'Passed',
  failed: 'Failed',
  skipped: 'Skipped',
  timedOut: 'Timed Out',
  interrupted: 'Interrupted',
  flaky: 'Flaky',
  unknown: 'Unknown',
};

const STATUS_ORDER = ['failed', 'timedOut', 'interrupted', 'passed', 'flaky', 'skipped', 'unknown'];

const renderStatusFilters = (statusCounts) => {
  const buttons = STATUS_ORDER.filter((status) => statusCounts[status] > 0).map((status) => {
    const label = STATUS_LABELS[status] || status;
    const count = statusCounts[status] ?? 0;
    return `
      <label class="filter-chip status-${status}">
        <input type="checkbox" name="status" value="${status}" checked />
        <span>${escapeHtml(label)} <span class="filter-count">${count}</span></span>
      </label>
    `;
  });

  return `
    <div class="filters">
      <div class="status-filters" role="group" aria-label="Filter by status">
        ${buttons.join('\n')}
      </div>
      <div class="search-filter">
        <label for="report-search" class="visually-hidden">Filter tests</label>
        <input id="report-search" type="search" placeholder="Filter by test name, project, tags, or text" />
      </div>
    </div>
  `;
};

const renderSummaryCards = (run) => {
  const cards = [
    {
      label: 'Total Tests',
      value: run.totalTests,
      tone: 'total',
    },
    {
      label: 'Passed',
      value: run.statusCounts.passed || 0,
      tone: 'passed',
    },
    {
      label: 'Failed',
      value: run.statusCounts.failed || 0,
      tone: run.statusCounts.failed > 0 ? 'failed' : 'muted',
    },
    {
      label: 'Skipped',
      value: run.statusCounts.skipped || 0,
      tone: 'skipped',
    },
    {
      label: 'Flaky',
      value: run.statusCounts.flaky || 0,
      tone: run.statusCounts.flaky > 0 ? 'flaky' : 'muted',
    },
  ];

  return `
    <section class="summary-cards" aria-label="Run summary">
      ${cards
        .map(
          (card) => `
            <article class="summary-card tone-${card.tone}">
              <div class="summary-card__label">${escapeHtml(card.label)}</div>
              <div class="summary-card__value">${escapeHtml(card.value)}</div>
            </article>
          `
        )
        .join('\n')}
    </section>
  `;
};

const renderMetadata = (run) => {
  const rows = [];
  if (run.site?.name || run.site?.baseUrl) {
    rows.push({
      label: 'Site',
      value: [run.site?.name, run.site?.baseUrl].filter(Boolean).join(' • '),
    });
  }
  if (run.profile) {
    rows.push({ label: 'Profile', value: run.profile });
  }
  if (Array.isArray(run.projects) && run.projects.length > 0) {
    rows.push({ label: 'Projects', value: run.projects.join(', ') });
  }
  if (run.startedAt) {
    rows.push({ label: 'Started', value: run.startedAtFriendly || run.startedAt });
  }
  if (run.completedAt) {
    rows.push({ label: 'Completed', value: run.completedAtFriendly || run.completedAt });
  }
  if (run.durationFriendly) {
    rows.push({ label: 'Duration', value: run.durationFriendly });
  }
  if (run.environment) {
    const envParts = [];
    if (run.environment.platform)
      envParts.push(`${run.environment.platform} ${run.environment.release || ''}`.trim());
    if (run.environment.arch) envParts.push(run.environment.arch);
    if (run.environment.node) envParts.push(`Node ${run.environment.node}`);
    rows.push({ label: 'Environment', value: envParts.join(' • ') });
  }

  if (rows.length === 0) return '';

  return `
    <section class="run-metadata" aria-label="Run metadata">
      <dl>
        ${rows
          .map(
            (row) => `
              <div class="metadata-row">
                <dt>${escapeHtml(row.label)}</dt>
                <dd>${escapeHtml(row.value)}</dd>
              </div>
            `
          )
          .join('\n')}
      </dl>
    </section>
  `;
};

const renderErrorBlock = (errors) => {
  if (!errors || errors.length === 0) return '';
  return `
    <section class="test-errors" aria-label="Errors">
      ${errors
        .map(
          (error, idx) => `
          <article class="error-entry">
            <header>Error ${idx + 1}</header>
            ${error.message ? `<pre class="error-message">${escapeHtml(error.message)}</pre>` : ''}
            ${error.stack ? `<pre class="error-stack">${escapeHtml(error.stack)}</pre>` : ''}
          </article>
        `
        )
        .join('\n')}
    </section>
  `;
};

const renderLogBlock = (label, entries, cssClass) => {
  if (!entries || entries.length === 0) return '';
  return `
    <section class="test-logs ${cssClass}" aria-label="${escapeHtml(label)}">
      <header>${escapeHtml(label)}</header>
      <pre>${escapeHtml(entries.join('\n'))}</pre>
    </section>
  `;
};

const renderAttachment = (attachment) => {
  if (attachment.omitted) {
    return `
      <div class="attachment omitted">
        <div class="attachment__meta">
          <span class="attachment__name">${escapeHtml(attachment.name || 'Attachment')}</span>
          <span class="attachment__meta-details">${escapeHtml(attachment.contentType || 'unknown')} • ${escapeHtml(formatBytes(attachment.size || 0))}</span>
        </div>
        <div class="attachment__body">${escapeHtml(attachment.reason || 'Attachment omitted')}</div>
      </div>
    `;
  }

  let bodyHtml = '';
  if (attachment.dataUri && attachment.contentType?.startsWith('image/')) {
    bodyHtml = `<figure><img src="${attachment.dataUri}" alt="${escapeHtml(attachment.name || 'Attachment image')}" /><figcaption>${escapeHtml(attachment.name || attachment.contentType || 'Image')}</figcaption></figure>`;
  } else if (attachment.html) {
    bodyHtml = `<div class="attachment-html">${attachment.html}</div>`;
  } else if (attachment.text) {
    bodyHtml = `<pre>${escapeHtml(attachment.text)}</pre>`;
  } else if (attachment.dataUri) {
    bodyHtml = `<a class="attachment-download" href="${attachment.dataUri}" download="${escapeHtml(attachment.name || 'attachment')}" rel="noopener">Download ${escapeHtml(attachment.name || attachment.contentType || 'attachment')}</a>`;
  } else if (attachment.base64) {
    bodyHtml = `<code class="attachment-base64">${attachment.base64}</code>`;
  } else if (attachment.error) {
    bodyHtml = `<div class="attachment-error">${escapeHtml(attachment.error)}</div>`;
  } else {
    bodyHtml = '<p>No attachment data available.</p>';
  }

  return `
    <div class="attachment">
      <div class="attachment__meta">
        <span class="attachment__name">${escapeHtml(attachment.name || 'Attachment')}</span>
        <span class="attachment__meta-details">${escapeHtml(attachment.contentType || 'unknown')} • ${escapeHtml(formatBytes(attachment.size || 0))}</span>
      </div>
      <div class="attachment__body">${bodyHtml}</div>
    </div>
  `;
};

const renderSummaries = (summaries) => {
  if (!summaries || summaries.length === 0) return '';
  return `
    <section class="test-summaries" aria-label="Summary attachments">
      ${summaries
        .map((summary) => {
          const sections = [];
          if (summary.html) {
            sections.push(`
              <article class="summary-block">
                <header>${escapeHtml(summary.title || summary.baseName || 'Summary')}</header>
                <div class="summary-block__body">${summary.html}</div>
              </article>
            `);
          }
          if (summary.markdown) {
            sections.push(`
              <article class="summary-block markdown">
                <header>${escapeHtml((summary.title || summary.baseName || 'Summary') + ' (Markdown)')}</header>
                <pre>${escapeHtml(summary.markdown)}</pre>
              </article>
            `);
          }
          return sections.join('\n');
        })
        .join('\n')}
    </section>
  `;
};

const renderAttempts = (attempts) => {
  if (!attempts || attempts.length === 0) return '';
  return `
    <section class="test-attempts" aria-label="Attempts">
      ${attempts
        .map((attempt, index) => {
          const attachmentHtml = attempt.attachments?.length
            ? `<div class="attempt-attachments">${attempt.attachments.map(renderAttachment).join('\n')}</div>`
            : '';
          const summariesHtml = renderSummaries(attempt.summaries);
          const errorsHtml = renderErrorBlock(attempt.errors);
          const stdoutHtml = renderLogBlock('Stdout', attempt.stdout, 'stdout');
          const stderrHtml = renderLogBlock('Stderr', attempt.stderr, 'stderr');
          return `
            <article class="attempt-card status-${attempt.status}">
              <header>
                <div class="attempt-title">Attempt ${index + 1}</div>
                <div class="attempt-meta">
                  <span>${escapeHtml(STATUS_LABELS[attempt.status] || attempt.status)}</span>
                  ${attempt.durationFriendly ? `<span>${escapeHtml(attempt.durationFriendly)}</span>` : ''}
                  ${attempt.startTimeFriendly ? `<span>${escapeHtml(attempt.startTimeFriendly)}</span>` : ''}
                </div>
              </header>
              ${summariesHtml}
              ${attachmentHtml}
              ${errorsHtml}
              ${stdoutHtml}
              ${stderrHtml}
            </article>
          `;
        })
        .join('\n')}
    </section>
  `;
};

const renderTestCard = (test) => {
  const summariesHtml = renderSummaries(test.summaryBlocks);
  const attemptsHtml = renderAttempts(test.attempts);
  const errorHtml = !test.attempts?.length ? renderErrorBlock(test.errors) : '';
  const stdoutHtml = !test.attempts?.length ? renderLogBlock('Stdout', test.stdout, 'stdout') : '';
  const stderrHtml = !test.attempts?.length ? renderLogBlock('Stderr', test.stderr, 'stderr') : '';

  const annotations = (test.annotations || [])
    .map((ann) => ann?.type || ann?.title)
    .filter(Boolean);
  const tags = Array.isArray(test.tags) ? test.tags : [];
  const statusLabel = STATUS_LABELS[test.status] || test.status;

  return `
    <article class="test-card status-${test.status} ${test.flaky ? 'is-flaky' : ''}" id="${escapeHtml(test.anchorId)}">
      <header class="test-card__header">
        <div>
          <h3>${escapeHtml(test.title)}</h3>
          <div class="test-card__meta">
            <span class="meta-item">${escapeHtml(test.projectName || 'Unnamed project')}</span>
            <span class="meta-item">${escapeHtml(statusLabel)}</span>
            ${test.flaky ? '<span class="meta-item flaky">Flaky</span>' : ''}
            ${test.durationFriendly ? `<span class="meta-item">${escapeHtml(test.durationFriendly)}</span>` : ''}
          </div>
        </div>
        <div class="test-card__location">
          ${test.location?.file ? `<code>${escapeHtml(test.location.file)}:${escapeHtml(test.location.line ?? 1)}</code>` : ''}
        </div>
      </header>

      ${
        annotations.length || tags.length
          ? `<div class="test-card__badges">${[...annotations, ...tags].map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join('')}</div>`
          : ''
      }

      ${summariesHtml}
      ${attemptsHtml}
      ${errorHtml}
      ${stdoutHtml}
      ${stderrHtml}
    </article>
  `;
};

const baseStyles = `
:root {
  color-scheme: light;
  --bg-body: #f5f7fb;
  --bg-card: #ffffff;
  --border-color: #d0d7de;
  --text-primary: #1d2939;
  --text-muted: #475467;
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.08);
  --radius-md: 12px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: var(--text-primary);
  background: var(--bg-body);
}

a { color: inherit; }

header.report-header {
  background: #0f172a;
  color: #e2e8f0;
  padding: 2.5rem 2rem;
}

header.report-header h1 {
  margin: 0;
  font-size: 2rem;
}

header.report-header p {
  margin: 0.35rem 0 0;
  color: #cbd5f5;
}

main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.summary-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1rem;
  box-shadow: var(--shadow-sm);
}

.summary-card__label {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.summary-card__value {
  font-size: 1.8rem;
  font-weight: 700;
  margin-top: 0.35rem;
}

.summary-card.tone-passed { border-color: #86efac; }
.summary-card.tone-failed { border-color: #fca5a5; }
.summary-card.tone-flaky { border-color: #fde68a; }

.run-metadata {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow-sm);
}

.run-metadata dl {
  display: grid;
  grid-template-columns: minmax(120px, 180px) 1fr;
  gap: 0.65rem 1.25rem;
  margin: 0;
}

.metadata-row {
  display: contents;
}

.run-metadata dt {
  font-weight: 600;
  color: var(--text-muted);
}

.run-metadata dd {
  margin: 0;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1.5rem;
}

.status-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: #fff;
  cursor: pointer;
  font-size: 0.9rem;
  box-shadow: var(--shadow-sm);
}

.filter-chip input {
  accent-color: #2563eb;
}

.filter-chip .filter-count {
  font-weight: 600;
}

.search-filter input {
  padding: 0.6rem 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  min-width: 260px;
  font-size: 0.95rem;
  box-shadow: var(--shadow-sm);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.tests-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.test-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
}

.test-card.status-failed { border-color: #f87171; }
.test-card.status-timedOut { border-color: #fbbf24; }
.test-card.status-passed { border-color: #4ade80; }
.test-card.status-skipped { border-color: #a8a29e; }
.test-card.is-flaky { border-style: dashed; }

.test-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.test-card__header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.test-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-top: 0.3rem;
}

.test-card__location code {
  background: #0f172a;
  color: #e2e8f0;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.85rem;
}

.test-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 1rem 0;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  background: #f1f5f9;
  font-size: 0.8rem;
  border: 1px solid #cbd5f5;
}

.test-summaries {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 1.5rem 0;
}

.summary-block {
  background: #f8fafc;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.summary-block header {
  padding: 0.75rem 1rem;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 0.95rem;
  font-weight: 600;
}

.summary-block__body {
  padding: 1rem;
  background: #fff;
}

.test-attempts {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-top: 1.5rem;
}

.attempt-card {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 1rem;
  background: #fff;
  box-shadow: inset 0 1px 0 rgba(15, 23, 42, 0.03);
}

.attempt-card header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.attempt-meta {
  display: flex;
  gap: 0.75rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.attachment {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 1rem;
  overflow: hidden;
}

.attachment__meta {
  background: #f1f5f9;
  padding: 0.6rem 0.9rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.attachment__body {
  padding: 0.9rem;
}

.attachment figure {
  margin: 0;
}

.attachment img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  border: 1px solid #cbd5f5;
}

.attachment pre {
  margin: 0;
  max-height: 320px;
  overflow: auto;
  background: #0f172a;
  color: #e2e8f0;
  padding: 0.75rem;
  border-radius: 6px;
}

.attachment-download {
  display: inline-block;
  padding: 0.6rem 0.9rem;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 6px;
}

.attachment.omitted .attachment__body {
  color: #b91c1c;
}

.test-errors header,
.test-logs header {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.test-errors pre,
.test-logs pre {
  margin: 0;
  background: #111827;
  color: #f8fafc;
  padding: 0.75rem;
  border-radius: 6px;
  white-space: pre-wrap;
}

@media (max-width: 720px) {
  main {
    padding: 1.5rem;
  }
  .test-card__header {
    flex-direction: column;
    align-items: flex-start;
  }
  .run-metadata dl {
    grid-template-columns: 1fr;
  }
}
`;

const filterScript = `
(function () {
  const statusInputs = Array.from(document.querySelectorAll('.status-filters input[type="checkbox"]'));
  const searchInput = document.getElementById('report-search');
  const tests = Array.from(document.querySelectorAll('.test-card'));

  function applyFilters() {
    const activeStatuses = statusInputs.filter((input) => input.checked).map((input) => input.value);
    const searchTerm = searchInput.value.trim().toLowerCase();

    tests.forEach((card) => {
      const status = Array.from(card.classList).find((cls) => cls.startsWith('status-'))?.replace('status-', '');
      const matchesStatus = activeStatuses.length === 0 || activeStatuses.includes(status);
      const content = card.innerText.toLowerCase();
      const matchesSearch = !searchTerm || content.includes(searchTerm);
      card.setAttribute('data-hidden', !(matchesStatus && matchesSearch));
    });
  }

  statusInputs.forEach((input) => input.addEventListener('change', applyFilters));
  searchInput.addEventListener('input', applyFilters);
  applyFilters();
})();
`;

function renderReportHtml(run) {
  const testsHtml = run.tests.map(renderTestCard).join('\n');
  const metadataHtml = renderMetadata(run);
  const summaryCards = renderSummaryCards(run);
  const statusFilters = renderStatusFilters(run.statusCounts);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(run.runId)} – Playwright Test Report</title>
  <style>${baseStyles}</style>
  ${SUMMARY_STYLES}
</head>
<body>
  <header class="report-header">
    <h1>${escapeHtml(run.title || 'Playwright Test Report')}</h1>
    <p>${escapeHtml(run.runId)} • ${escapeHtml(run.durationFriendly || '')}</p>
  </header>
  <main>
    ${summaryCards}
    ${metadataHtml}
    ${statusFilters}
    <section class="tests-list" aria-label="Test results">
      ${testsHtml}
    </section>
  </main>
  <script>${filterScript}</script>
</body>
</html>`;
}

module.exports = {
  renderReportHtml,
  escapeHtml,
  formatBytes,
};
