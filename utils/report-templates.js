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

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';

const buildDisplayTitle = (titlePath, fallback) => {
  if (Array.isArray(titlePath) && titlePath.length > 0) {
    const segments = titlePath.slice(3).filter(Boolean);
    if (segments.length > 0) return segments.join(' › ');
  }
  return fallback || '';
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

const renderRunSummaries = (summaries) => {
  if (!Array.isArray(summaries) || summaries.length === 0) return '';

  const items = summaries.map((summary) => {
    const hasHtml = Boolean(summary.html);
    const body = hasHtml
      ? summary.html
      : summary.markdown
        ? `<pre class="run-summary__markdown">${escapeHtml(summary.markdown)}</pre>`
        : '<p>No summary data available.</p>';

    const friendlyTitle = escapeHtml(summary.title || summary.baseName || 'Summary');
    let meta = '';
    if (summary.source?.testTitle) {
      const anchorId = summary.source.anchorId ? `#${escapeHtml(summary.source.anchorId)}` : null;
      const label = escapeHtml(summary.source.testTitle);
      meta = anchorId
        ? `<div class="run-summary-card__meta">Source: <a href="${anchorId}">${label}</a></div>`
        : `<div class="run-summary-card__meta">Source: ${label}</div>`;
    }

    const heading = hasHtml
      ? `<div class="run-summary-card__title">${friendlyTitle}</div>`
      : `<header><h2>${friendlyTitle}</h2></header>`;

    return `
      <article class="run-summary-card">
        ${heading}
        ${meta}
        <div class="run-summary-card__body">${body}</div>
      </article>
    `;
  });

  return `
    <section class="run-summaries" aria-label="Run-level summaries">
      ${items.join('\n')}
    </section>
  `;
};

const summariseStatuses = (tests) =>
  tests.reduce((acc, test) => {
    const status = test.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

const renderStatusPills = (counts, options = {}) => {
  const showCount = options.showCount !== false;
  return STATUS_ORDER.filter((status) => counts[status])
    .map((status) => {
      const label = STATUS_LABELS[status] || status;
      const count = counts[status];
      const countHtml = showCount ? `<span class="status-count">${escapeHtml(String(count))}</span>` : '';
      return `<span class="status-pill status-${status}">${escapeHtml(label)}${countHtml}</span>`;
    })
    .join('');
};

const groupTests = (tests) => {
  const groups = [];
  const map = new Map();
  const usedIds = new Set();

  const ensureUniqueId = (base) => {
    let candidate = base || 'group';
    let counter = 1;
    while (usedIds.has(candidate)) {
      counter += 1;
      candidate = `${base}-${counter}`;
    }
    usedIds.add(candidate);
    return candidate;
  };

  tests.forEach((test) => {
    const filePath = test.location?.file || 'Unknown file';
    const fileName = filePath.split(/[/\\]/).pop();
    const project = test.projectName || 'Default project';
    const key = `${project}::${filePath}`;
    if (!map.has(key)) {
      const idBase = slugify(`${project}-${fileName}`);
      const group = {
        id: ensureUniqueId(idBase),
        title: `${project} › ${fileName}`,
        project,
        file: filePath,
        tests: [],
      };
      map.set(key, group);
      groups.push(group);
    }
    map.get(key).tests.push(test);
  });

  return groups;
};

const renderTestNavigation = (groups) => {
  if (!Array.isArray(groups) || groups.length === 0) return '';

  const items = groups
    .map((group) => {
      const groupCounts = summariseStatuses(group.tests);
      const groupStats = renderStatusPills(groupCounts);
      const testsList = group.tests
        .map((test) => {
          const statusLabel = STATUS_LABELS[test.status] || test.status;
          return `
            <li data-test-anchor="${escapeHtml(test.anchorId)}">
              <a href="#${escapeHtml(test.anchorId)}">${escapeHtml(test.displayTitle || test.title)}</a>
              <span class="status-pill status-${test.status}">${escapeHtml(statusLabel)}</span>
            </li>
          `;
        })
        .join('');

      const statsHtml = groupStats ? `<div class="test-navigation__group-stats">${groupStats}</div>` : '';

      return `
        <li data-group-anchor="${escapeHtml(group.id)}">
          <div class="test-navigation__group-header">
            <a href="#${escapeHtml(group.id)}">${escapeHtml(group.title)}</a>
            ${statsHtml}
          </div>
          <ul class="test-navigation__group-tests">
            ${testsList}
          </ul>
        </li>
      `;
    })
    .join('');

  return `
    <nav class="test-navigation" aria-label="Test navigation">
      <h2>Test navigation</h2>
      <ul>
        ${items}
      </ul>
    </nav>
  `;
};

const renderTestGroup = (group) => {
  const counts = summariseStatuses(group.tests);
  const stats = renderStatusPills(counts);
  const statsHtml = stats ? `<div class="test-group__stats">${stats}</div>` : '';
  return `
    <section class="test-group" id="${escapeHtml(group.id)}">
      <header class="test-group__header">
        <div class="test-group__title">
          <h2>${escapeHtml(group.title)}</h2>
          <div class="test-group__meta">${group.file ? `<code>${escapeHtml(group.file)}</code>` : ''}</div>
        </div>
        ${statsHtml}
      </header>
      <div class="test-group__body">
        ${group.tests.map(renderTestCard).join('\n')}
      </div>
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

const renderErrorBlock = () => '';

const renderLogBlock = () => '';

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

const stripSummaryStyles = (html) => {
  if (!html) return '';
  return html.replace(SUMMARY_STYLES, '').trimStart();
};

const renderSummaries = (summaries) => {
  if (!summaries || summaries.length === 0) return '';

  const htmlSummaries = summaries.filter((summary) => summary.html);
  if (htmlSummaries.length === 0) return '';

  return `
    <section class="test-summaries" aria-label="Summary attachments">
      ${htmlSummaries
        .map((summary) => {
          const label = summary.title || summary.baseName || 'Summary';
          const sanitizedHtml = stripSummaryStyles(summary.html);
          return `
            <details class="summary-block" data-summary-type="html">
              <summary>${escapeHtml(label)}</summary>
              <div class="summary-block__body">${sanitizedHtml}</div>
            </details>
          `;
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
          const stdoutHtml = renderLogBlock();
          const stderrHtml = renderLogBlock();
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
  const stdoutHtml = '';
  const stderrHtml = '';
  const primaryError = Array.isArray(test.errors)
    ? test.errors.find((error) => error?.message)
    : null;
  let statusNote = '';
  if (primaryError?.message) {
    const headline = primaryError.message
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    if (headline) {
      statusNote = `<div class="test-card__note status-error">${escapeHtml(headline)}</div>`;
    }
  }

  const annotations = (test.annotations || [])
    .map((ann) => ann?.type || ann?.title)
    .filter(Boolean);
  const tags = Array.isArray(test.tags) ? test.tags : [];
  const statusLabel = STATUS_LABELS[test.status] || test.status;
  const displayTitle = test.displayTitle || test.title;

  return `
    <article class="test-card status-${test.status} ${test.flaky ? 'is-flaky' : ''}" id="${escapeHtml(test.anchorId)}">
      <header class="test-card__header">
        <div>
          <h3>${escapeHtml(displayTitle)}</h3>
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

      ${statusNote}
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

[data-hidden="true"] {
  display: none !important;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 999px;
  padding: 0.25rem 0.55rem;
  border: 1px solid var(--border-color);
  background: #f8fafc;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.status-pill .status-count {
  font-weight: 700;
}

.status-pill.status-failed {
  background: #fee2e2;
  border-color: #fecaca;
  color: #b42318;
}

.status-pill.status-passed {
  background: #dcfce7;
  border-color: #bbf7d0;
  color: #166534;
}

.status-pill.status-skipped {
  background: #e2e8f0;
  border-color: #cbd5f5;
  color: #475467;
}

.status-pill.status-timedOut,
.status-pill.status-interrupted,
.status-pill.status-unknown,
.status-pill.status-flaky {
  background: #fef3c7;
  border-color: #fde68a;
  color: #92400e;
}

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

.run-summaries {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.run-summary-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
}

.run-summary-card > header h2,
.run-summary-card__title {
  margin: 0 0 0.75rem 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.run-summary-card__meta {
  margin: -0.5rem 0 0.75rem 0;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.run-summary-card__body {
  display: block;
}

.run-summary__markdown {
  margin: 0;
  padding: 1rem;
  border-radius: 8px;
  background: #0f172a;
  color: #e2e8f0;
  overflow-x: auto;
}

.test-navigation {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow-sm);
}

.test-navigation h2 {
  margin: 0 0 0.75rem 0;
  font-size: 1.25rem;
}

.test-navigation ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.test-navigation > ul > li {
  margin-bottom: 0.85rem;
}

.test-navigation > ul > li:last-child {
  margin-bottom: 0;
}

.test-navigation__group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.test-navigation__group-header a {
  font-weight: 600;
  text-decoration: none;
}

.test-navigation__group-tests {
  margin: 0.5rem 0 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.test-navigation__group-tests a {
  text-decoration: none;
}

.test-navigation__group-tests li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.test-navigation__group-tests li .status-pill {
  margin-left: auto;
}

.test-navigation__group-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.test-navigation .status-pill {
  font-size: 0.7rem;
  padding: 0.2rem 0.45rem;
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

.test-group {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
}

.test-group__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}

.test-group__title h2 {
  margin: 0 0 0.35rem 0;
  font-size: 1.35rem;
}

.test-group__meta {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.test-group__meta code {
  background: #0f172a;
  color: #e2e8f0;
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
}

.test-group__stats {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.test-group__body {
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

.test-card__note {
  margin: 0.85rem 0;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
}

.test-card__note.status-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b42318;
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
  box-shadow: var(--shadow-sm);
}

.summary-block > summary {
  list-style: none;
  padding: 0.75rem 1rem;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.summary-block > summary::-webkit-details-marker {
  display: none;
}

.summary-block[open] > summary {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.summary-block__body {
  padding: 1rem;
  background: #fff;
}

.summary-block__markdown {
  margin: 0;
  padding: 1rem;
  border-radius: 0 0 8px 8px;
  background: #0f172a;
  color: #e2e8f0;
  overflow-x: auto;
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

.test-logs {
  margin: 0.75rem 0;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: #f8fafc;
  box-shadow: inset 0 1px 0 rgba(15, 23, 42, 0.03);
}

.test-logs > summary {
  list-style: none;
  padding: 0.6rem 0.9rem;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.test-logs > summary::-webkit-details-marker {
  display: none;
}

.test-logs pre {
  margin: 0;
  max-height: 320px;
  overflow: auto;
  background: #111827;
  color: #f8fafc;
  padding: 0.75rem;
  border-radius: 0 0 8px 8px;
  white-space: pre-wrap;
}

.test-errors header {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.test-errors pre {
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
  const testCards = Array.from(document.querySelectorAll('.test-card'));
  const testGroups = Array.from(document.querySelectorAll('.test-group'));
  const navTestItems = Array.from(document.querySelectorAll('.test-navigation [data-test-anchor]'));
  const navGroupItems = Array.from(document.querySelectorAll('.test-navigation [data-group-anchor]'));
  const collapsibleSections = Array.from(document.querySelectorAll('.test-logs, .summary-block'));

  // Guarantee all accordions start collapsed, even if the browser restores prior state.
  collapsibleSections.forEach((section) => {
    if (typeof section.open === 'boolean') {
      section.open = false;
    } else {
      section.removeAttribute('open');
    }
  });

  function applyFilters() {
    const activeStatuses = statusInputs.filter((input) => input.checked).map((input) => input.value);
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    testCards.forEach((card) => {
      const status = Array.from(card.classList).find((cls) => cls.startsWith('status-'))?.replace('status-', '');
      const matchesStatus = activeStatuses.length === 0 || activeStatuses.includes(status);
      const content = (card.textContent || '').toLowerCase();
      const matchesSearch = !searchTerm || content.includes(searchTerm);
      card.setAttribute('data-hidden', matchesStatus && matchesSearch ? 'false' : 'true');
    });

    testGroups.forEach((group) => {
      const visible = Array.from(group.querySelectorAll('.test-card')).some((card) => card.getAttribute('data-hidden') !== 'true');
      group.setAttribute('data-hidden', visible ? 'false' : 'true');
    });

    navTestItems.forEach((item) => {
      const anchor = item.getAttribute('data-test-anchor');
      const card = anchor ? document.getElementById(anchor) : null;
      const hidden = !card || card.getAttribute('data-hidden') === 'true';
      item.setAttribute('data-hidden', hidden ? 'true' : 'false');
    });

    navGroupItems.forEach((item) => {
      const anchor = item.getAttribute('data-group-anchor');
      const group = anchor ? document.getElementById(anchor) : null;
      const hidden = !group || group.getAttribute('data-hidden') === 'true';
      item.setAttribute('data-hidden', hidden ? 'true' : 'false');
    });
  }

  statusInputs.forEach((input) => input.addEventListener('change', applyFilters));
  searchInput?.addEventListener('input', applyFilters);
  applyFilters();
})();
`;

function renderReportHtml(run) {
  const groupedTests = groupTests(run.tests);
  const navigationHtml = renderTestNavigation(groupedTests);
  const testsHtml = groupedTests.map(renderTestGroup).join('\n');
  const metadataHtml = renderMetadata(run);
  const summaryCards = renderSummaryCards(run);
  const runSummariesHtml = renderRunSummaries(run.runSummaries);
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
    ${runSummariesHtml}
    ${navigationHtml}
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
