const { SUMMARY_STYLES } = require('./reporting-utils');
const { KIND_RUN_SUMMARY, KIND_PAGE_SUMMARY } = require('./report-schema');

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

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const humaniseKey = (key) =>
  String(key || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());

function renderSchemaMetrics(data) {
  if (!isPlainObject(data)) {
    return schemaValueToHtml(data);
  }
  const items = Object.entries(data).map(([key, value]) => {
    return `
      <div class="schema-metrics__item">
        <dt>${escapeHtml(humaniseKey(key))}</dt>
        <dd>${schemaValueToHtml(value)}</dd>
      </div>
    `;
  });
  return `<dl class="schema-metrics">${items.join('')}</dl>`;
}

function schemaValueToHtml(value) {
  if (value == null) return '<span class="schema-value schema-value--empty">—</span>';
  if (typeof value === 'boolean') {
    return `<span class="schema-value">${value ? 'Yes' : 'No'}</span>`;
  }
  if (typeof value === 'number') {
    return `<span class="schema-value">${escapeHtml(value.toLocaleString())}</span>`;
  }
  if (typeof value === 'string') {
    return `<span class="schema-value">${escapeHtml(value)}</span>`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '<span class="schema-value schema-value--empty">—</span>';
    }
    const simple = value.every(
      (item) => item == null || ['string', 'number', 'boolean'].includes(typeof item)
    );
    if (simple) {
      return `<span class="schema-value">${escapeHtml(
        value.map((item) => (item == null ? '—' : String(item))).join(', ')
      )}</span>`;
    }
    return `<ul class="schema-list">${value
      .map((item) => `<li>${schemaValueToHtml(item)}</li>`)
      .join('')}</ul>`;
  }
  if (isPlainObject(value)) {
    return renderSchemaMetrics(value);
  }
  return `<span class="schema-value">${escapeHtml(String(value))}</span>`;
}

const renderRuleSnapshotsTable = (snapshots) => {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return '';
  const rows = snapshots
    .map((snapshot) => {
      const impact = snapshot.impact || snapshot.category || 'info';
      const pages = Array.isArray(snapshot.pages) ? snapshot.pages : [];
      const viewports = Array.isArray(snapshot.viewports) ? snapshot.viewports : [];
      const wcagTags = Array.isArray(snapshot.wcagTags) ? snapshot.wcagTags : [];
      return `
        <tr class="impact-${impact.toLowerCase?.() || 'info'}">
          <td>${escapeHtml(impact)}</td>
          <td>${escapeHtml(snapshot.rule || 'rule')}</td>
          <td>${pages.length ? escapeHtml(pages.join(', ')) : '—'}</td>
          <td>${snapshot.nodes != null ? escapeHtml(String(snapshot.nodes)) : '—'}</td>
          <td>${viewports.length ? escapeHtml(viewports.join(', ')) : '—'}</td>
          <td>${wcagTags.length ? escapeHtml(wcagTags.join(', ')) : '—'}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <table class="schema-table">
      <thead>
        <tr><th>Impact</th><th>Rule</th><th>Pages</th><th>Nodes</th><th>Viewports</th><th>WCAG</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
};

const buildSchemaGroups = (records = []) => {
  const groups = new Map();
  records.forEach((record) => {
    const projectName = record.projectName || 'default';
    const testAnchorId = record.testAnchorId || null;
    (record.summaries || []).forEach((summary) => {
      if (!summary?.baseName) return;
      const baseName = summary.baseName;
      let group = groups.get(baseName);
      if (!group) {
        group = {
          baseName,
          title: summary.title || baseName,
          runEntries: [],
          pageEntries: [],
        };
        groups.set(baseName, group);
      }
      if (!group.title && summary.title) {
        group.title = summary.title;
      }
      const entry = { payload: summary, projectName, testAnchorId };
      if (summary.kind === KIND_RUN_SUMMARY) {
        group.runEntries.push(entry);
      } else if (summary.kind === KIND_PAGE_SUMMARY) {
        group.pageEntries.push(entry);
      }
    });
  });
  return Array.from(groups.values());
};

const renderSchemaRunEntry = (entry) => {
  const payload = entry.payload || {};
  const metadata = payload.metadata || {};
  const chips = [];
  if (metadata.scope) chips.push(`Scope: ${metadata.scope}`);
  if (metadata.projectName && metadata.scope !== 'run') {
    chips.push(`Project: ${metadata.projectName}`);
  }
  if (Array.isArray(metadata.viewports) && metadata.viewports.length > 0) {
    chips.push(`Viewports: ${metadata.viewports.join(', ')}`);
  }
  if (metadata.failOn) chips.push(`Threshold: ${metadata.failOn}`);

  const metaHtml = chips.length
    ? `<div class="schema-meta">${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join('')}</div>`
    : '';
  const overviewHtml = payload.overview ? renderSchemaMetrics(payload.overview) : '';
  const rulesHtml = renderRuleSnapshotsTable(payload.ruleSnapshots);

  return `
    <section class="schema-overview">
      ${metaHtml}
      ${overviewHtml}
      ${rulesHtml}
    </section>
  `;
};

const renderSchemaPageEntries = (entries) => {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const grouped = new Map();
  entries.forEach((entry) => {
    const payload = entry.payload || {};
    const page = payload.page || 'Unknown page';
    if (!grouped.has(page)) grouped.set(page, []);
    grouped.get(page).push(entry);
  });

  const accordions = Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([page, pageEntries]) => {
      const rows = pageEntries
        .sort((a, b) => (a.payload.viewport || '').localeCompare(b.payload.viewport || ''))
        .map((entry) => {
          const payload = entry.payload || {};
          const viewport = payload.viewport || entry.projectName || 'default';
          const summaryHtml = payload.summary
            ? renderSchemaMetrics(payload.summary)
            : '<span class="schema-value schema-value--empty">No summary data</span>';
          return `
            <tr>
              <td>${escapeHtml(viewport)}</td>
              <td>${summaryHtml}</td>
            </tr>
          `;
        })
        .join('');

      return `
        <details class="summary-page schema-page-accordion">
          <summary>${escapeHtml(page)}</summary>
          <div class="summary-page__body">
            <table class="schema-table">
              <thead><tr><th>Viewport</th><th>Summary</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </details>
      `;
    });

  return accordions.join('');
};


const collectSchemaProjects = (group) => {
  const map = new Map();
  const ensure = (projectName) => {
    const key = projectName || 'default';
    if (!map.has(key)) {
      map.set(key, { projectName: key, runEntries: [], pageEntries: [] });
    }
    return map.get(key);
  };

  for (const entry of group.runEntries || []) {
    const meta = entry.payload?.metadata || {};
    const projectName = meta.projectName || entry.projectName || (meta.scope === 'run' ? 'run' : 'default');
    ensure(projectName).runEntries.push(entry);
  }

  for (const entry of group.pageEntries || []) {
    const meta = entry.payload?.metadata || {};
    const projectName = meta.projectName || entry.projectName || 'default';
    ensure(projectName).pageEntries.push(entry);
  }

  return Array.from(map.values());
};

const summaryTypeFromGroup = (group) => {
  for (const entry of group.runEntries || []) {
    const type = entry.payload?.metadata?.summaryType;
    if (type) return type;
  }
  for (const entry of group.pageEntries || []) {
    const type = entry.payload?.metadata?.summaryType;
    if (type) return type;
  }
  return null;
};

const statusClassFromStatus = (status) => {
  if (typeof status !== 'number') return 'status-ok';
  if (status >= 500) return 'status-error';
  if (status >= 400) return 'status-error';
  if (status >= 300) return 'status-redirect';
  return 'status-ok';
};

const firstRunPayload = (bucket) => bucket.runEntries.find((entry) => Boolean(entry?.payload))?.payload || null;

const renderInternalLinksGroupHtml = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pages = bucket.pageEntries.map((entry) => entry.payload || {}).filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const overviewHtml = runPayload?.overview ? renderSchemaMetrics(runPayload.overview) : '';

    const coverageRows = pages
      .map((payload) => {
        const summary = payload.summary || {};
        const brokenCount = summary.brokenCount ?? 0;
        const className = brokenCount > 0 ? 'status-error' : 'status-ok';
        return `
          <tr class="${className}">
            <td><code>${escapeHtml(payload.page || 'unknown')}</code></td>
            <td>${summary.totalLinks ?? '—'}</td>
            <td>${summary.uniqueChecked ?? '—'}</td>
            <td>${brokenCount}</td>
          </tr>
        `;
      })
      .join('');

    const coverageTable = coverageRows
      ? `
          <table>
            <thead><tr><th>Page</th><th>Links found</th><th>Checked</th><th>Broken</th></tr></thead>
            <tbody>${coverageRows}</tbody>
          </table>
        `
      : '<p>No pages were evaluated for internal links.</p>';

    const brokenRows = [];
    pages.forEach((payload) => {
      const summary = payload.summary || {};
      (summary.brokenSample || []).forEach((issue) => {
        brokenRows.push({
          page: payload.page,
          url: issue.url,
          status: issue.status,
          method: issue.methodTried,
          error: issue.error,
        });
      });
    });

    const brokenSection = brokenRows.length
      ? `
          <section class="summary-report summary-links">
            <h3>Broken links — ${escapeHtml(projectLabel)}</h3>
            <table>
              <thead><tr><th>Source page</th><th>URL</th><th>Status / Error</th><th>Method</th></tr></thead>
              <tbody>${brokenRows
                .map(
                  (issue) => `
                    <tr class="status-error">
                      <td><code>${escapeHtml(issue.page || 'unknown')}</code></td>
                      <td><code>${escapeHtml(issue.url || '')}</code></td>
                      <td>${issue.status != null ? escapeHtml(String(issue.status)) : escapeHtml(issue.error || 'error')}</td>
                      <td>${escapeHtml(issue.method || 'HEAD')}</td>
                    </tr>
                  `
                )
                .join('')}</tbody>
            </table>
          </section>
        `
      : `
          <section class="summary-report summary-links">
            <h3>Broken links — ${escapeHtml(projectLabel)}</h3>
            <p>None detected 🎉</p>
          </section>
        `;

    return `
      <section class="summary-report summary-links">
        <h3>${escapeHtml(projectLabel)} – Internal link coverage</h3>
        ${overviewHtml}
        ${coverageTable}
      </section>
      ${brokenSection}
    `;
  });

  const headline = escapeHtml(group.title || 'Internal link audit summary');
  return `
    <article class="schema-group">
      <header><h2>${headline}</h2></header>
      ${sections.join('\n')}
    </article>
  `;
};

const renderInteractiveGroupHtml = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pages = bucket.pageEntries.map((entry) => entry.payload || {}).filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const overviewHtml = runPayload?.overview ? renderSchemaMetrics(runPayload.overview) : '';
    const resourceBudget = runPayload?.overview?.resourceErrorBudget;

    const rows = pages
      .map((payload) => {
        const summary = payload.summary || {};
        const statusLabel = summary.status == null ? 'n/a' : summary.status;
        const hasIssues = (summary.consoleErrors || 0) > 0 || (summary.resourceErrors || 0) > 0;
        const className = hasIssues ? 'status-error' : 'status-ok';

        const consoleSample = summary.consoleSample || [];
        const consoleItems = consoleSample.length
          ? consoleSample
              .slice(0, 5)
              .map((item) => `<li class="check-fail">${escapeHtml(item.message || String(item))}</li>`)
              .join('')
          : '<li class="check-pass">No console errors</li>';
        const consoleList = `
          <ul class="checks">${consoleItems}</ul>
        `;

        const resourceSample = summary.resourceSample || [];
        const resourceItems = resourceSample.length
          ? resourceSample
              .slice(0, 5)
              .map((item) => {
                const label = item.type === 'requestfailed'
                  ? `${item.type} – ${item.failure || 'unknown'}`
                  : `${item.type || 'resource'} ${item.status || ''} ${item.method || ''}`;
                return `<li class="check-fail">${escapeHtml(label.trim())} — <code>${escapeHtml(item.url || '')}</code></li>`;
              })
              .join('')
          : '<li class="check-pass">No failed requests</li>';
        const resourceList = `
          <ul class="checks">${resourceItems}</ul>
        `;

        const warningItems = (summary.warnings || []).map((msg) => `<li class="check-fail">${escapeHtml(msg)}</li>`);
        const infoItems = (summary.info || []).map((msg) => `<li class="check-pass">${escapeHtml(msg)}</li>`);
        const notesHtml = warningItems.length || infoItems.length
          ? `
            <ul class="checks">${warningItems.concat(infoItems).join('')}</ul>
          `
          : '<span class="details">No additional notes</span>';

        return `
          <tr class="${className}">
            <td><code>${escapeHtml(payload.page || 'unknown')}</code></td>
            <td>${escapeHtml(String(statusLabel))}</td>
            <td>${consoleList}</td>
            <td>${resourceList}</td>
            <td>${notesHtml}</td>
          </tr>
        `;
      })
      .join('');

    const tableHtml = rows
      ? `
          <table>
            <thead><tr><th>Page</th><th>Status</th><th>Console</th><th>Resources</th><th>Notes</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        `
      : '<p>No interactive pages were scanned.</p>';

    const budgetNote = resourceBudget != null
      ? `<p>Resource error budget: <strong>${resourceBudget}</strong></p>`
      : '';

    return `
      <section class="summary-report summary-interactive">
        <h3>${escapeHtml(projectLabel)} – JavaScript &amp; resource monitoring</h3>
        ${overviewHtml}
        ${budgetNote}
        ${tableHtml}
      </section>
    `;
  });

  const headline = escapeHtml(group.title || 'Interactive smoke summary');
  return `
    <article class="schema-group">
      <header><h2>${headline}</h2></header>
      ${sections.join('\n')}
    </article>
  `;
};

const renderAvailabilityGroupHtml = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pages = bucket.pageEntries.map((entry) => entry.payload || {}).filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const overviewHtml = runPayload?.overview ? renderSchemaMetrics(runPayload.overview) : '';

    const rows = pages
      .map((payload) => {
        const summary = payload.summary || {};
        const status = summary.status;
        const warnings = summary.warnings || [];
        const info = summary.info || [];
        const elements = summary.elements || {};
        const elementChecks = Object.keys(elements).length
          ? `
              <ul class="checks">${Object.entries(elements)
                .map(([key, value]) => `<li class="${value ? 'check-pass' : 'check-fail'}">${escapeHtml(key)}: ${value ? 'present' : 'missing'}</li>`)
                .join('')}</ul>
            `
          : '<span class="details">No element checks recorded</span>';
        const warningList = warnings.length
          ? `
              <ul class="checks">${warnings
                .map((message) => `<li class="check-fail">${escapeHtml(message)}</li>`)
                .join('')}</ul>
            `
          : '<span class="details">None</span>';
        const infoList = info.length
          ? `
              <ul class="checks">${info
                .map((message) => `<li class="check-pass">${escapeHtml(message)}</li>`)
                .join('')}</ul>
            `
          : '<span class="details">None</span>';

        return `
          <tr class="${statusClassFromStatus(status)}">
            <td><code>${escapeHtml(payload.page || 'unknown')}</code></td>
            <td>${status == null ? 'n/a' : escapeHtml(String(status))}</td>
            <td>${elementChecks}</td>
            <td>${warningList}</td>
            <td>${infoList}</td>
          </tr>
        `;
      })
      .join('');

    const tableHtml = rows
      ? `
          <table>
            <thead><tr><th>Page</th><th>Status</th><th>Structure</th><th>Warnings</th><th>Info</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        `
      : '<p>No availability checks captured.</p>';

    return `
      <section class="summary-report summary-infrastructure">
        <h3>${escapeHtml(projectLabel)} – Availability &amp; uptime</h3>
        ${overviewHtml}
        ${tableHtml}
      </section>
    `;
  });

  const headline = escapeHtml(group.title || 'Availability & uptime summary');
  return `
    <article class="schema-group">
      <header><h2>${headline}</h2></header>
      ${sections.join('\n')}
    </article>
  `;
};

const renderHttpGroupHtml = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pages = bucket.pageEntries.map((entry) => entry.payload || {}).filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const overviewHtml = runPayload?.overview ? renderSchemaMetrics(runPayload.overview) : '';

    const rows = pages
      .map((payload) => {
        const summary = payload.summary || {};
        const failedChecks = summary.failedChecks || [];
        const failedList = failedChecks.length
          ? `
              <ul class="checks">${failedChecks
                .map((check) => `<li class="check-fail">${escapeHtml(check.label || 'Check failed')}${check.details ? ` — ${escapeHtml(check.details)}` : ''}</li>`)
                .join('')}</ul>
            `
          : '<span class="details">All checks passed</span>';
        return `
          <tr class="${statusClassFromStatus(summary.status)}">
            <td><code>${escapeHtml(payload.page || 'unknown')}</code></td>
            <td>${summary.status == null ? 'n/a' : escapeHtml(String(summary.status))}</td>
            <td>${escapeHtml(summary.statusText || '')}</td>
            <td>${summary.redirectLocation ? `<code>${escapeHtml(summary.redirectLocation)}</code>` : '<span class="details">—</span>'}</td>
            <td>${failedList}</td>
          </tr>
        `;
      })
      .join('');

    const tableHtml = rows
      ? `
          <table>
            <thead><tr><th>Page</th><th>Status</th><th>Status text</th><th>Redirect</th><th>Failed checks</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        `
      : '<p>No HTTP validation results available.</p>';

    return `
      <section class="summary-report summary-infrastructure">
        <h3>${escapeHtml(projectLabel)} – HTTP response validation</h3>
        ${overviewHtml}
        ${tableHtml}
      </section>
    `;
  });

  const headline = escapeHtml(group.title || 'HTTP response validation summary');
  return `
    <article class="schema-group">
      <header><h2>${headline}</h2></header>
      ${sections.join('\n')}
    </article>
  `;
};

const renderPerformanceGroupHtml = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pages = bucket.pageEntries.map((entry) => entry.payload || {}).filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const overviewHtml = runPayload?.overview ? renderSchemaMetrics(runPayload.overview) : '';

    const rows = pages
      .map((payload) => {
        const summary = payload.summary || {};
        const breaches = (summary.budgetBreaches || [])
          .map((breach) => `${breach.metric}: ${Math.round(breach.value)}ms (budget ${Math.round(breach.budget)}ms)`);
        const breachList = breaches.length
          ? `
              <ul class="checks">${breaches
                .map((line) => `<li class="check-fail">${escapeHtml(line)}</li>`)
                .join('')}</ul>
            `
          : '<span class="details">None</span>';
        return `
          <tr class="${breaches.length ? 'status-error' : 'status-ok'}">
            <td><code>${escapeHtml(payload.page || 'unknown')}</code></td>
            <td>${summary.loadTimeMs != null ? Math.round(summary.loadTimeMs) : '—'}</td>
            <td>${summary.domContentLoadedMs != null ? Math.round(summary.domContentLoadedMs) : '—'}</td>
            <td>${summary.loadCompleteMs != null ? Math.round(summary.loadCompleteMs) : '—'}</td>
            <td>${summary.firstContentfulPaintMs != null ? Math.round(summary.firstContentfulPaintMs) : '—'}</td>
            <td>${breachList}</td>
          </tr>
        `;
      })
      .join('');

    const tableHtml = rows
      ? `
          <table>
            <thead><tr><th>Page</th><th>Load (ms)</th><th>DOM Loaded</th><th>Load complete</th><th>FCP</th><th>Budget breaches</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        `
      : '<p>No performance metrics captured.</p>';

    return `
      <section class="summary-report summary-infrastructure">
        <h3>${escapeHtml(projectLabel)} – Performance monitoring</h3>
        ${overviewHtml}
        ${tableHtml}
      </section>
    `;
  });

  const headline = escapeHtml(group.title || 'Performance monitoring summary');
  return `
    <article class="schema-group">
      <header><h2>${headline}</h2></header>
      ${sections.join('\n')}
    </article>
  `;
};

const renderVisualGroupHtml = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pages = bucket.pageEntries.map((entry) => entry.payload || {}).filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const overviewHtml = runPayload?.overview ? renderSchemaMetrics(runPayload.overview) : '';

    const rows = pages
      .map((payload) => {
        const summary = payload.summary || {};
        const result = (summary.result || '').toLowerCase();
        const className = result === 'diff' ? 'status-error' : 'status-ok';
        const diffDetails = [];
        if (summary.pixelDiff != null) {
          diffDetails.push(`Pixel diff: ${summary.pixelDiff.toLocaleString()}`);
        }
        if (summary.pixelRatio != null) {
          diffDetails.push(`Diff ratio: ${(summary.pixelRatio * 100).toFixed(2)}%`);
        }
        if (summary.expectedSize && summary.actualSize) {
          diffDetails.push(
            `Expected ${summary.expectedSize.width}×${summary.expectedSize.height}px, got ${summary.actualSize.width}×${summary.actualSize.height}px`
          );
        }
        if (summary.error) {
          diffDetails.push(summary.error);
        }

        const detailsHtml = diffDetails.length
          ? `
              <ul class="checks">${diffDetails
                .map((line) => `<li class="${result === 'diff' ? 'check-fail' : 'details'}">${escapeHtml(line)}</li>`)
                .join('')}</ul>
            `
          : '<span class="details">Matched baseline</span>';

        const artifactLinks = summary.artifacts || {};
        const artifactItems = ['baseline', 'actual', 'diff']
          .map((key) => {
            if (!artifactLinks[key]) return null;
            return `<li><a href="attachment://${escapeHtml(artifactLinks[key])}">${key.charAt(0).toUpperCase() + key.slice(1)}</a></li>`;
          })
          .filter(Boolean);
        const artifactsHtml = artifactItems.length
          ? `
              <ul class="checks">${artifactItems.join('')}</ul>
            `
          : '<span class="details">—</span>';

        return `
          <tr class="${className}">
            <td><code>${escapeHtml(payload.page || 'unknown')}</code></td>
            <td>${escapeHtml(summary.screenshot || '—')}</td>
            <td>${summary.threshold != null ? summary.threshold : '—'}</td>
            <td>${result === 'diff' ? '⚠️ Diff detected' : '✅ Matched'}</td>
            <td>${artifactsHtml}</td>
            <td>${detailsHtml}</td>
          </tr>
        `;
      })
      .join('');

    const tableHtml = rows
      ? `
          <table>
            <thead><tr><th>Page</th><th>Screenshot</th><th>Threshold</th><th>Result</th><th>Artifacts</th><th>Details</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        `
      : '<p>No visual comparisons were recorded.</p>';

    return `
      <section class="summary-report summary-visual">
        <h3>${escapeHtml(projectLabel)} – Visual regression</h3>
        ${overviewHtml}
        ${tableHtml}
      </section>
    `;
  });

  const headline = escapeHtml(group.title || 'Visual regression summary');
  return `
    <article class="schema-group">
      <header><h2>${headline}</h2></header>
      ${sections.join('\n')}
    </article>
  `;
};

const renderSchemaGroupFallbackHtml = (group) => {
  const headline = group.title || humaniseKey(group.baseName);
  const runEntries = (group.runEntries || []).slice().sort((a, b) => {
    const scopeOrder = { run: 0, project: 1 };
    const left = scopeOrder[a.payload?.metadata?.scope] ?? 2;
    const right = scopeOrder[b.payload?.metadata?.scope] ?? 2;
    return left - right;
  });
  const runHtml = runEntries.map(renderSchemaRunEntry).join('');
  const pageHtml = renderSchemaPageEntries(group.pageEntries || []);
  const body = [runHtml, pageHtml].filter(Boolean).join('');
  if (!body) return '';
  return `
    <article class="schema-group">
      <header><h2>${escapeHtml(headline)}</h2></header>
      ${body}
    </article>
  `;
};

const SCHEMA_HTML_RENDERERS = {
  'internal-links': renderInternalLinksGroupHtml,
  interactive: renderInteractiveGroupHtml,
  availability: renderAvailabilityGroupHtml,
  http: renderHttpGroupHtml,
  performance: renderPerformanceGroupHtml,
  visual: renderVisualGroupHtml,
};

const renderSchemaGroup = (group) => {
  const summaryType = summaryTypeFromGroup(group);
  if (summaryType && SCHEMA_HTML_RENDERERS[summaryType]) {
    return SCHEMA_HTML_RENDERERS[summaryType](group);
  }
  return renderSchemaGroupFallbackHtml(group);
};

const renderSchemaSummaries = (records = []) => {
  if (!Array.isArray(records) || records.length === 0) {
    return { html: '', promotedBaseNames: new Set() };
  }

  const groups = buildSchemaGroups(records).filter(
    (group) => group.runEntries.length > 0 || group.pageEntries.length > 0
  );

  if (groups.length === 0) {
    return { html: '', promotedBaseNames: new Set() };
  }

  const promotedBaseNames = new Set();
  const content = groups
    .map((group) => {
      if ((group.runEntries || []).length > 0) {
        promotedBaseNames.add(group.baseName);
      }
      return renderSchemaGroup(group);
    })
    .filter(Boolean)
    .join('\n');

  const html = `
    <section class="summary-report" aria-label="Suite summaries">
      ${content}
    </section>
  `;

  return { html, promotedBaseNames };
};

const formatSchemaValueMarkdown = (value) => {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    const simple = value.every((item) => item == null || ['string', 'number', 'boolean'].includes(typeof item));
    if (simple) {
      return value
        .map((item) => (item == null ? '—' : formatSchemaValueMarkdown(item)))
        .join(', ');
    }
    return value.map((item) => formatSchemaValueMarkdown(item)).join('; ');
  }
  if (isPlainObject(value)) {
    return Object.entries(value)
      .map(([key, val]) => `${humaniseKey(key)}: ${formatSchemaValueMarkdown(val)}`)
      .join('; ');
  }
  return String(value);
};

const renderSchemaMetricsMarkdown = (data) => {
  if (!isPlainObject(data) || Object.keys(data).length === 0) return '';
  const lines = Object.entries(data).map(
    ([key, value]) => `- **${humaniseKey(key)}**: ${formatSchemaValueMarkdown(value)}`
  );
  return lines.join('\n');
};

const renderRuleSnapshotsMarkdown = (snapshots) => {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return '';
  const header = '| Impact | Rule | Pages | Nodes | Viewports | WCAG |';
  const separator = '| --- | --- | --- | --- | --- | --- |';
  const rows = snapshots.map((snapshot) => {
    const impact = snapshot.impact || snapshot.category || 'info';
    const rule = snapshot.rule || 'rule';
    const pages = Array.isArray(snapshot.pages) && snapshot.pages.length > 0
      ? snapshot.pages.join(', ')
      : '—';
    const nodes = snapshot.nodes != null ? String(snapshot.nodes) : '—';
    const viewports = Array.isArray(snapshot.viewports) && snapshot.viewports.length > 0
      ? snapshot.viewports.join(', ')
      : '—';
    const wcagTags = Array.isArray(snapshot.wcagTags) && snapshot.wcagTags.length > 0
      ? snapshot.wcagTags.join(', ')
      : '—';
    return `| ${impact} | ${rule} | ${pages} | ${nodes} | ${viewports} | ${wcagTags} |`;
  });
  return [header, separator, ...rows].join('\n');
};

const renderInternalLinksGroupMarkdown = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pages = bucket.pageEntries.map((entry) => entry.payload || {}).filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const heading = `${group.title || 'Internal link audit summary'} – ${projectLabel}`;
    const overview = runPayload?.overview ? renderSchemaMetricsMarkdown(runPayload.overview) : '';

    const header = '| Page | Links found | Checked | Broken |';
    const separator = '| --- | --- | --- | --- |';
    const rows = pages.map((payload) => {
      const summary = payload.summary || {};
      return `| \`${payload.page || 'unknown'}\` | ${summary.totalLinks ?? '—'} | ${summary.uniqueChecked ?? '—'} | ${summary.brokenCount ?? 0} |`;
    });

    const brokenRows = [];
    pages.forEach((payload) => {
      const summary = payload.summary || {};
      (summary.brokenSample || []).forEach((issue) => {
        brokenRows.push(`| \`${payload.page || 'unknown'}\` | ${issue.url || ''} | ${issue.status != null ? issue.status : issue.error || 'error'} | ${issue.methodTried || 'HEAD'} |`);
      });
    });

    const brokenSection = brokenRows.length
      ? ['## Broken links', '', '| Source page | URL | Status / Error | Method |', '| --- | --- | --- | --- |', ...brokenRows].join('\n')
      : '## Broken links\n\nNone 🎉';

    const parts = [`## ${heading}`];
    if (overview) parts.push(overview);
    parts.push('', header, separator, ...rows);
    parts.push('', brokenSection);
    return parts.join('\n');
  });

  return sections.join('\n\n');
};

const renderInteractiveGroupMarkdown = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pages = bucket.pageEntries.map((entry) => entry.payload || {}).filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const heading = `${group.title || 'Interactive smoke summary'} – ${projectLabel}`;
    const overview = runPayload?.overview ? renderSchemaMetricsMarkdown(runPayload.overview) : '';
    const budget = runPayload?.overview?.resourceErrorBudget;

    const header = '| Page | Status | Console | Resources | Notes |';
    const separator = '| --- | --- | --- | --- | --- |';
    const rows = pages.map((payload) => {
      const summary = payload.summary || {};
      const consoleOutput = (summary.consoleSample || []).map((entry) => `⚠️ ${entry.message || entry}`).join('<br />');
      const consoleCell = summary.consoleErrors ? consoleOutput || 'See captured sample' : '✅ None';
      const resourceOutput = (summary.resourceSample || [])
        .map((entry) => {
          const base = entry.type === 'requestfailed'
            ? `requestfailed ${entry.url} (${entry.failure || 'unknown'})`
            : `${entry.type} ${entry.status || ''} ${entry.method || ''} ${entry.url}`;
          return `⚠️ ${base.trim()}`;
        })
        .join('<br />');
      const resourceCell = summary.resourceErrors ? resourceOutput || 'See captured sample' : '✅ None';
      const noteItems = [];
      (summary.warnings || []).forEach((message) => noteItems.push(`⚠️ ${message}`));
      (summary.info || []).forEach((message) => noteItems.push(`ℹ️ ${message}`));
      const notesCell = noteItems.length ? noteItems.join('<br />') : '—';
      const statusLabel = summary.status == null ? 'n/a' : summary.status;
      return `| \`${payload.page || 'unknown'}\` | ${statusLabel} | ${consoleCell || '—'} | ${resourceCell || '—'} | ${notesCell} |`;
    });

    const parts = [`## ${heading}`];
    if (overview) parts.push(overview);
    if (budget != null) parts.push('', `Resource error budget: **${budget}**`);
    parts.push('', header, separator, ...rows);
    return parts.join('\n');
  });

  return sections.join('\n\n');
};

const renderAvailabilityGroupMarkdown = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pages = bucket.pageEntries.map((entry) => entry.payload || {}).filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const heading = `${group.title || 'Availability & uptime summary'} – ${projectLabel}`;
    const overview = runPayload?.overview ? renderSchemaMetricsMarkdown(runPayload.overview) : '';

    const header = '| Page | Status | Warnings | Info |';
    const separator = '| --- | --- | --- | --- |';
    const rows = pages.map((payload) => {
      const summary = payload.summary || {};
      const warnings = (summary.warnings || []).map((message) => `⚠️ ${message}`).join('<br />') || 'None';
      const info = (summary.info || []).map((message) => `ℹ️ ${message}`).join('<br />') || 'None';
      const statusLabel = summary.status == null ? 'n/a' : summary.status;
      return `| \`${payload.page || 'unknown'}\` | ${statusLabel} | ${warnings} | ${info} |`;
    });

    const parts = [`## ${heading}`];
    if (overview) parts.push(overview);
    parts.push('', header, separator, ...rows);
    return parts.join('\n');
  });

  return sections.join('\n\n');
};

const renderHttpGroupMarkdown = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pages = bucket.pageEntries.map((entry) => entry.payload || {}).filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const heading = `${group.title || 'HTTP response validation summary'} – ${projectLabel}`;
    const overview = runPayload?.overview ? renderSchemaMetricsMarkdown(runPayload.overview) : '';

    const header = '| Page | Status | Redirect | Failed checks |';
    const separator = '| --- | --- | --- | --- |';
    const rows = pages.map((payload) => {
      const summary = payload.summary || {};
      const failedChecks = (summary.failedChecks || [])
        .map((check) => `⚠️ ${check.label || 'Check failed'}${check.details ? ` — ${check.details}` : ''}`)
        .join('<br />') || 'None';
      const statusLabel = summary.status == null ? 'n/a' : summary.status;
      const redirect = summary.redirectLocation || '—';
      return `| \`${payload.page || 'unknown'}\` | ${statusLabel} | ${redirect} | ${failedChecks} |`;
    });

    const parts = [`## ${heading}`];
    if (overview) parts.push(overview);
    parts.push('', header, separator, ...rows);
    return parts.join('\n');
  });

  return sections.join('\n\n');
};

const renderPerformanceGroupMarkdown = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pages = bucket.pageEntries.map((entry) => entry.payload || {}).filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const heading = `${group.title || 'Performance monitoring summary'} – ${projectLabel}`;
    const overview = runPayload?.overview ? renderSchemaMetricsMarkdown(runPayload.overview) : '';

    const header = '| Page | Load (ms) | DOM Loaded | Load complete | FCP | Breaches |';
    const separator = '| --- | --- | --- | --- | --- | --- |';
    const rows = pages.map((payload) => {
      const summary = payload.summary || {};
      const breaches = (summary.budgetBreaches || [])
        .map((breach) => `${breach.metric}: ${Math.round(breach.value)}ms (budget ${Math.round(breach.budget)}ms)`)
        .join('<br />') || 'None';
      return `| \`${payload.page || 'unknown'}\` | ${summary.loadTimeMs != null ? Math.round(summary.loadTimeMs) : '—'} | ${summary.domContentLoadedMs != null ? Math.round(summary.domContentLoadedMs) : '—'} | ${summary.loadCompleteMs != null ? Math.round(summary.loadCompleteMs) : '—'} | ${summary.firstContentfulPaintMs != null ? Math.round(summary.firstContentfulPaintMs) : '—'} | ${breaches} |`;
    });

    const parts = [`## ${heading}`];
    if (overview) parts.push(overview);
    parts.push('', header, separator, ...rows);
    return parts.join('\n');
  });

  return sections.join('\n\n');
};

const renderVisualGroupMarkdown = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pages = bucket.pageEntries.map((entry) => entry.payload || {}).filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const heading = `${group.title || 'Visual regression summary'} – ${projectLabel}`;
    const overview = runPayload?.overview ? renderSchemaMetricsMarkdown(runPayload.overview) : '';

    const header = '| Page | Screenshot | Threshold | Result | Details |';
    const separator = '| --- | --- | --- | --- | --- |';
    const rows = pages.map((payload) => {
      const summary = payload.summary || {};
      const result = (summary.result || '').toLowerCase();
      const diffDetails = [];
      if (summary.pixelDiff != null) diffDetails.push(`Pixel diff: ${summary.pixelDiff.toLocaleString()}`);
      if (summary.pixelRatio != null) diffDetails.push(`Diff ratio: ${(summary.pixelRatio * 100).toFixed(2)}%`);
      if (summary.expectedSize && summary.actualSize) {
        diffDetails.push(
          `Expected ${summary.expectedSize.width}×${summary.expectedSize.height}px, got ${summary.actualSize.width}×${summary.actualSize.height}px`
        );
      }
      if (summary.error) diffDetails.push(summary.error);
      const detailsCell = diffDetails.length ? diffDetails.join('<br />') : 'Matched baseline';
      const resultCell = result === 'diff' ? '⚠️ Diff detected' : '✅ Matched';
      return `| \`${payload.page || 'unknown'}\` | ${summary.screenshot || '—'} | ${summary.threshold != null ? summary.threshold : '—'} | ${resultCell} | ${detailsCell} |`;
    });

    const parts = [`## ${heading}`];
    if (overview) parts.push(overview);
    parts.push('', header, separator, ...rows);
    return parts.join('\n');
  });

  return sections.join('\n\n');
};

const renderSchemaRunEntryMarkdown = (entry) => {
  const payload = entry.payload || {};
  const metadata = payload.metadata || {};
  const labelParts = [];
  if (metadata.scope) labelParts.push(metadata.scope);
  if (metadata.projectName) labelParts.push(metadata.projectName);
  if (Array.isArray(metadata.viewports) && metadata.viewports.length > 0) {
    labelParts.push(metadata.viewports.join(', '));
  }
  const headingLabel = labelParts.length > 0 ? labelParts.join(' • ') : 'summary';
  const heading = `### Run Summary – ${headingLabel}`;
  const overview = payload.overview ? renderSchemaMetricsMarkdown(payload.overview) : '';
  const rules = renderRuleSnapshotsMarkdown(payload.ruleSnapshots);
  const sections = [overview, rules].filter(Boolean).join('\n\n');
  return `${heading}\n\n${sections || '_No overview metrics provided._'}`;
};

const renderSchemaPageEntriesMarkdownFallback = (entries) => {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const lines = entries.map((entry) => {
    const payload = entry.payload || {};
    const page = payload.page || 'Unknown page';
    const viewport = payload.viewport || entry.projectName || 'default';
    const summary = payload.summary && Object.keys(payload.summary).length > 0
      ? formatSchemaValueMarkdown(payload.summary)
      : 'No summary data';
    return `- **${page} – ${viewport}**: ${summary}`;
  });
  return lines.join('\n');
};

const renderSchemaGroupFallbackMarkdown = (group) => {
  const headline = group.title || humaniseKey(group.baseName);
  const runMarkdown = (group.runEntries || []).map(renderSchemaRunEntryMarkdown).join('\n\n');
  const pageMarkdown = renderSchemaPageEntriesMarkdownFallback(group.pageEntries || []);
  const sections = [`## ${headline}`];
  if (runMarkdown) sections.push(runMarkdown);
  if (pageMarkdown) sections.push('### Page Summaries', pageMarkdown);
  return sections.join('\n\n');
};

const SCHEMA_MARKDOWN_RENDERERS = {
  'internal-links': renderInternalLinksGroupMarkdown,
  interactive: renderInteractiveGroupMarkdown,
  availability: renderAvailabilityGroupMarkdown,
  http: renderHttpGroupMarkdown,
  performance: renderPerformanceGroupMarkdown,
  visual: renderVisualGroupMarkdown,
};

const renderSchemaGroupMarkdown = (group) => {
  const summaryType = summaryTypeFromGroup(group);
  if (summaryType && SCHEMA_MARKDOWN_RENDERERS[summaryType]) {
    return SCHEMA_MARKDOWN_RENDERERS[summaryType](group);
  }
  return renderSchemaGroupFallbackMarkdown(group);
};

const renderSchemaSummariesMarkdown = (records = []) => {
  if (!Array.isArray(records) || records.length === 0) {
    return { markdown: '', promotedBaseNames: new Set() };
  }

  const groups = buildSchemaGroups(records).filter(
    (group) => group.runEntries.length > 0 || group.pageEntries.length > 0
  );

  if (groups.length === 0) {
    return { markdown: '', promotedBaseNames: new Set() };
  }

  const promotedBaseNames = new Set();
  const sections = groups
    .map((group) => {
      if ((group.runEntries || []).length > 0) {
        promotedBaseNames.add(group.baseName);
      }
      return renderSchemaGroupMarkdown(group);
    })
    .filter(Boolean);

  const markdown = sections.join('\n\n');
  return { markdown, promotedBaseNames };
};

const renderRunSummariesMarkdown = (summaries = []) => {
  if (!Array.isArray(summaries) || summaries.length === 0) return '';
  const sections = summaries
    .map((summary) => {
      const title = summary.title || summary.baseName || 'Summary';
      const body = summary.markdown || '_No markdown body provided._';
      return `## ${title}\n\n${body.trim()}`;
    })
    .filter(Boolean);
  return sections.join('\n\n');
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
      const countHtml = showCount
        ? `<span class="status-count">${escapeHtml(String(count))}</span>`
        : '';
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

      const statsHtml = groupStats
        ? `<div class="test-navigation__group-stats">${groupStats}</div>`
        : '';

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

const renderTestGroup = (group, options = {}) => {
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
        ${group.tests.map((test) => renderTestCard(test, options)).join('\n')}
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

const renderSummaries = (summaries, options = {}) => {
  if (!summaries || summaries.length === 0) return '';

  const exclude = new Set((options.excludeBaseNames || []).filter(Boolean));
  const htmlSummaries = summaries
    .filter((summary) => summary?.html)
    .filter((summary) => !exclude.has(summary.baseName));

  if (htmlSummaries.length === 0) return '';

  const sectionClasses = ['test-summaries'];
  if (options.compact) sectionClasses.push('test-summaries--compact');

  const sections = htmlSummaries
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
    .join('\n');

  const heading = options.heading
    ? `<header class="test-summaries__header"><h4>${escapeHtml(options.heading)}</h4></header>`
    : '';

  return `
    <section class="${sectionClasses.join(' ')}" aria-label="Summary attachments">
      ${heading}
      ${sections}
    </section>
  `;
};

const renderAttempts = (attempts, options = {}) => {
  if (!attempts || attempts.length === 0) return '';

  const excludeBaseNames = new Set((options.excludeSummaryBaseNames || []).filter(Boolean));

  const attemptEntries = attempts
    .map((attempt, index) => {
      const filteredSummaries = (attempt.summaries || []).filter(
        (summary) => summary?.baseName && !excludeBaseNames.has(summary.baseName)
      );

      const summariesHtml = renderSummaries(filteredSummaries, { compact: true });
      const attachmentHtml = attempt.attachments?.length
        ? `<div class="attempt-attachments">${attempt.attachments.map(renderAttachment).join('\n')}</div>`
        : '';
      const errorsHtml = renderErrorBlock(attempt.errors);
      const stdoutHtml = renderLogBlock();
      const stderrHtml = renderLogBlock();

      const bodySegments = [summariesHtml, attachmentHtml, errorsHtml, stdoutHtml, stderrHtml]
        .filter(Boolean)
        .join('\n');

      const headerMeta = [
        escapeHtml(STATUS_LABELS[attempt.status] || attempt.status),
        attempt.durationFriendly ? escapeHtml(attempt.durationFriendly) : null,
        attempt.startTimeFriendly ? escapeHtml(attempt.startTimeFriendly) : null,
      ]
        .filter(Boolean)
        .map((item) => `<span>${item}</span>`) // html safe
        .join('');

      return `
        <details class="attempt-card status-${attempt.status}">
          <summary>
            <span class="attempt-title">Attempt ${index + 1}</span>
            <span class="attempt-meta">${headerMeta}</span>
          </summary>
          <div class="attempt-body">
            ${bodySegments || '<p class="attempt-note">No additional data recorded for this attempt.</p>'}
          </div>
        </details>
      `;
    })
    .join('\n');

  return `
    <section class="test-attempts" aria-label="Attempts">
      <header class="test-attempts__header"><h4>Attempts</h4></header>
      ${attemptEntries}
    </section>
  `;
};

const renderTestCard = (test, options = {}) => {
  const promotedSummaryBaseNames = options.promotedSummaryBaseNames || new Set();
  const allSummaryBlocks = Array.isArray(test.summaryBlocks) ? test.summaryBlocks : [];
  const retainedSummaries = allSummaryBlocks.filter(
    (summary) => !promotedSummaryBaseNames.has(summary.baseName)
  );
  const summariesHtml = renderSummaries(retainedSummaries, {
    heading: retainedSummaries.length ? 'Summary' : null,
  });
  const summaryBaseNames = retainedSummaries.map((summary) => summary.baseName).filter(Boolean);

  const attemptsExcludeBaseNames = new Set(summaryBaseNames);
  allSummaryBlocks
    .map((summary) => summary.baseName)
    .filter((baseName) => promotedSummaryBaseNames.has(baseName))
    .forEach((baseName) => attemptsExcludeBaseNames.add(baseName));

  const attemptsHtml = renderAttempts(test.attempts, {
    excludeSummaryBaseNames: Array.from(attemptsExcludeBaseNames),
  });
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
  if (
    !retainedSummaries.length &&
    allSummaryBlocks.some((summary) => promotedSummaryBaseNames.has(summary.baseName))
  ) {
    statusNote += `<div class="test-card__note status-neutral">Detailed run findings appear in the summary section above.</div>`;
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

.report-layout {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: 1.75rem;
  align-items: flex-start;
  margin-top: 2.5rem;
}

.report-layout__content {
  min-width: 0;
}

.debug-deck {
  margin-top: 3rem;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.debug-deck > summary {
  list-style: none;
  margin: 0;
  padding: 0.9rem 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  background: #0f172a;
  color: #e2e8f0;
}

.debug-deck > summary::-webkit-details-marker {
  display: none;
}

.debug-deck__body {
  padding: 1.2rem 1.3rem 1.4rem;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.debug-deck__intro {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.92rem;
}

.report-layout__sidebar {
  position: sticky;
  top: 2rem;
  align-self: flex-start;
}

.report-layout__sidebar .test-navigation {
  max-height: calc(100vh - 2.5rem);
  overflow: auto;
  padding-right: 1rem;
}

.test-navigation {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  margin-bottom: 0;
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

.test-card__note.status-neutral {
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  color: #3730a3;
}

.test-summaries {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 1.5rem 0;
}

.test-summaries__header {
  margin-bottom: 0.35rem;
}

.test-summaries__header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-muted);
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

.test-summaries--compact {
  gap: 0.6rem;
  margin: 1rem 0;
}

.test-summaries--compact .summary-block > summary {
  font-size: 0.9rem;
  padding: 0.6rem 0.75rem;
}

.test-summaries--compact .summary-block__body {
  padding: 0.85rem;
}

.test-attempts {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-top: 1.5rem;
}

.test-attempts__header {
  margin: 0;
}

.test-attempts__header h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-muted);
}

.attempt-card {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  background: #fff;
  box-shadow: inset 0 1px 0 rgba(15, 23, 42, 0.03);
}

.attempt-card > summary {
  list-style: none;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  cursor: pointer;
  margin: 0;
  font-weight: 600;
}

.attempt-card > summary::-webkit-details-marker {
  display: none;
}

.attempt-card[open] > summary {
  margin-bottom: 0.65rem;
}

.attempt-title {
  font-size: 0.95rem;
}

.attempt-meta {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.attempt-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.attempt-note {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
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

@media (max-width: 960px) {
  .report-layout {
    grid-template-columns: 1fr;
  }
  .report-layout__sidebar {
    position: static;
  }
  .report-layout__sidebar .test-navigation {
    max-height: none;
  }
  .debug-deck__body {
    padding: 1.2rem 1.1rem 1.3rem;
  }
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
  const schemaRender = renderSchemaSummaries(run.schemaSummaries || []);
  const schemaPromotedBaseNames = schemaRender.promotedBaseNames || new Set();
  const filteredRunSummaries = (run.runSummaries || []).filter((summary) =>
    summary?.baseName ? !schemaPromotedBaseNames.has(summary.baseName) : true
  );
  const runSummaryPromoted = new Set(
    filteredRunSummaries.map((summary) => summary?.baseName).filter(Boolean)
  );
  const promotedSummaryBaseNames = new Set([...schemaPromotedBaseNames, ...runSummaryPromoted]);
  const testsHtml = groupedTests
    .map((group) => renderTestGroup(group, { promotedSummaryBaseNames }))
    .join('\n');
  const statusFilters = renderStatusFilters(run.statusCounts);
  const layoutHtml = `
    <details class="debug-deck">
      <summary>Debug testing</summary>
      <div class="debug-deck__body">
        <p class="debug-deck__intro">Use the navigation below to inspect raw Playwright projects, attachments, and logs.</p>
        <div class="report-layout">
          ${navigationHtml ? `<aside class="report-layout__sidebar">${navigationHtml}</aside>` : ''}
          <div class="report-layout__content">
            ${statusFilters}
            <section class="tests-list" aria-label="Test results">
              ${testsHtml}
            </section>
          </div>
        </div>
      </div>
    </details>
  `;
  const metadataHtml = renderMetadata(run);
  const summaryCards = renderSummaryCards(run);
  const schemaHtml = schemaRender.html || '';
  const runSummariesHtml = renderRunSummaries(filteredRunSummaries);

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
    ${schemaHtml}
    ${runSummariesHtml}
    ${layoutHtml}
  </main>
  <script>${filterScript}</script>
</body>
</html>`;
}

module.exports = {
  renderReportHtml,
  escapeHtml,
  formatBytes,
  renderSchemaSummariesMarkdown,
  renderRunSummariesMarkdown,
};
