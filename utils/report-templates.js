const {
  SUMMARY_STYLES,
  renderPerPageAccordion,
  renderSummaryMetrics,
} = require('./reporting-utils');
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

const formatPageLabel = (page) => {
  if (!page || page === '/') return 'Homepage';
  return String(page);
};

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

const formatCount = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString();
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed.toLocaleString();
  return value;
};

const renderStatusSummaryList = (items, { className = 'status-summary' } = {}) => {
  if (!Array.isArray(items) || items.length === 0) return '';
  const entries = items
    .filter((item) => item && Number(item.count) > 0)
    .map(
      (item) => `
        <li>
          <span class="status-pill ${escapeHtml(item.tone || 'status-info')}">${escapeHtml(item.label)}</span>
          <span>${escapeHtml(formatCount(item.count))}${item.suffix ? ` ${escapeHtml(item.suffix)}` : ''}</span>
        </li>
      `
    )
    .join('');
  if (!entries) return '';
  return `<ul class="${escapeHtml(className)}">${entries}</ul>`;
};

const formatWcagTagLabel = (tag) => {
  if (!tag) return null;
  const lower = String(tag).toLowerCase();
  if (!lower.includes('wcag')) return null;
  if (tag.toUpperCase().includes('WCAG') && tag.includes(' ')) return tag.toUpperCase();
  const levelMatch = lower.match(/^wcag(\d+)(a{1,3})$/);
  if (levelMatch) {
    const versionDigits = levelMatch[1];
    const grade = levelMatch[2].toUpperCase();
    let version = versionDigits;
    if (versionDigits.length === 2) {
      version = `${versionDigits[0]}.${versionDigits[1]}`;
    }
    return `WCAG ${version} ${grade}`;
  }
  const guidelineMatch = lower.match(/^wcag(\d)(\d)(\d)$/);
  if (guidelineMatch) {
    return `WCAG ${guidelineMatch[1]}.${guidelineMatch[2]}.${guidelineMatch[3]}`;
  }
  if (lower.startsWith('wcag')) {
    return lower.replace('wcag', 'WCAG ').toUpperCase();
  }
  return String(tag);
};

const renderWcagTagBadges = (tags) => {
  if (!Array.isArray(tags) || tags.length === 0) {
    return '<span class="badge badge-neutral">No WCAG tag</span>';
  }
  const labels = Array.from(
    new Set(
      tags
        .map((tag) => formatWcagTagLabel(tag))
        .filter(Boolean)
    )
  );
  if (labels.length === 0) {
    return '<span class="badge badge-neutral">No WCAG tag</span>';
  }
  return labels
    .map((label) => {
      const isNeutral = /^no wcag/i.test(label);
      const badgeClass = isNeutral ? 'badge badge-neutral' : 'badge badge-wcag';
      return `<span class="${badgeClass}">${escapeHtml(label)}</span>`;
    })
    .join('');
};

const extractNodeTargets = (nodes, limit = 3) => {
  if (!Array.isArray(nodes) || nodes.length === 0) return null;
  const targets = [];
  nodes.forEach((node) => {
    if (Array.isArray(node.target) && node.target.length > 0) {
      node.target.forEach((selector) => {
        if (selector) targets.push(String(selector));
      });
    } else if (typeof node.html === 'string' && node.html.trim()) {
      targets.push(node.html.trim());
    }
  });
  if (!targets.length) return null;
  const unique = Array.from(new Set(targets)).slice(0, limit);
  return unique
    .map((target) => `<code>${escapeHtml(target)}</code>`)
    .join('<br />');
};

const formatMilliseconds = (value) => {
  if (!Number.isFinite(value)) return null;
  if (value >= 1000) {
    const seconds = value / 1000;
    return seconds % 1 === 0 ? `${seconds.toFixed(0)}s` : `${seconds.toFixed(1)}s`;
  }
  return `${Math.round(value)}ms`;
};

const formatWcagStability = (stability) => {
  if (!stability || typeof stability !== 'object') return null;
  const strategy = stability.successfulStrategy || stability.strategy || stability.strategyUsed;
  const elapsed =
    Number.isFinite(stability.totalElapsed) && stability.totalElapsed >= 0
      ? stability.totalElapsed
      : Number.isFinite(stability.duration) && stability.duration >= 0
        ? stability.duration
        : null;
  if (!strategy && elapsed == null) {
    return stability.ok === false ? 'Encountered stability issues.' : null;
  }
  const pieces = [];
  if (strategy) {
    pieces.push(`Reached <code>${escapeHtml(strategy)}</code>`);
  }
  if (elapsed != null) {
    pieces.push(`in ${formatMilliseconds(elapsed)}`);
  }
  return `${pieces.join(' ')}.`;
};

const deriveWcagPageStatus = (summary) => {
  const status = summary?.status;
  if (status === 'scan-error' || status === 'http-error' || status === 'stability-timeout') {
    return {
      pillClass: 'status-warning',
      pillLabel: 'Scan issue',
      pageClass: 'summary-page--warn',
    };
  }
  if ((summary?.gatingViolations || 0) > 0) {
    return {
      pillClass: 'status-error',
      pillLabel: 'Accessibility violations',
      pageClass: 'summary-page--fail',
    };
  }
  return {
    pillClass: 'status-success',
    pillLabel: 'Pass',
    pageClass: 'summary-page--pass',
  };
};

const WCAG_PER_PAGE_TOGGLE_SCRIPT = `
(function () {
  const scriptEl = document.currentScript;
  if (!scriptEl) return;
  const container = scriptEl.previousElementSibling;
  if (!container) return;
  const accordions = Array.from(container.querySelectorAll('details.summary-page'));
  if (accordions.length === 0) return;
  const toggles = container.querySelectorAll('[data-toggle]');
  toggles.forEach((button) => {
    button.addEventListener('click', () => {
      const open = button.dataset.toggle === 'expand';
      accordions.forEach((accordion) => {
        accordion.open = open;
      });
    });
  });
})();
`;

const formatRuleHeading = (label, count) =>
  count ? `${label} (${formatCount(count)} unique rules)` : label;

const renderAccessibilityRuleTable = (title, rules, { headingClass } = {}) => {
  if (!Array.isArray(rules) || rules.length === 0) return '';
  const rows = rules
    .map((rule) => {
      const wcagTags =
        Array.isArray(rule.wcagTags) && rule.wcagTags.length > 0 ? rule.wcagTags : [];
      const viewportsRaw = rule.viewports || rule.viewportsTested || [];
      const viewportList = Array.isArray(viewportsRaw)
        ? viewportsRaw.filter(Boolean)
        : viewportsRaw
          ? [viewportsRaw]
          : [];
      const viewportCell = viewportList.length ? viewportList.join(', ') : '—';
      const helpLink = rule.helpUrl
        ? `<a href="${escapeHtml(rule.helpUrl)}" target="_blank" rel="noopener noreferrer">rule docs</a>`
        : '<span class="details">—</span>';
      const wcagHtml = wcagTags.length ? renderWcagTagBadges(wcagTags) : renderWcagTagBadges([]);
      return `
        <tr class="impact-${escapeHtml((rule.impact || rule.category || 'info').toLowerCase())}">
          <td>${escapeHtml(rule.impact || rule.category || 'info')}</td>
          <td>${escapeHtml(rule.rule || rule.id || 'Unnamed rule')}</td>
          <td>${escapeHtml(viewportCell)}</td>
          <td>${escapeHtml(formatCount(Array.isArray(rule.pages) ? rule.pages.length : rule.pages || 0))}</td>
          <td>${escapeHtml(formatCount(rule.nodes ?? 0))}</td>
          <td>${wcagHtml}</td>
          <td>${helpLink}</td>
        </tr>
      `;
    })
    .join('');
  const headingAttr = headingClass ? ` class="${headingClass}"` : '';
  return `
    <section class="summary-report summary-a11y">
      <h3${headingAttr}>${escapeHtml(title)}</h3>
      <table>
        <thead>
          <tr><th>Impact</th><th>Rule</th><th>Viewport(s)</th><th>Pages</th><th>Nodes</th><th>WCAG level</th><th>Help</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
};

const SUITE_GROUP_DEFINITIONS = [
  {
    id: 'accessibility',
    label: 'Accessibility',
    heading: 'WCAG & manual audits',
    summaryTypes: [
      'wcag',
      'forms',
      'keyboard',
      'reduced-motion',
      'reflow',
      'iframe-metadata',
      'structure',
    ],
  },
  {
    id: 'functionality',
    label: 'Functionality',
    heading: 'Console, links, and service health',
    summaryTypes: ['interactive', 'internal-links', 'availability', 'http', 'performance'],
  },
  {
    id: 'responsive',
    label: 'Responsive',
    heading: 'Breakpoint and WordPress coverage',
    summaryTypes: ['responsive-structure', 'wp-features'],
  },
  {
    id: 'visual',
    label: 'Visual',
    heading: 'Screenshot comparisons',
    summaryTypes: ['visual'],
  },
];

const SUITE_PANEL_DEFINITIONS = [
  {
    id: 'accessibility-wcag',
    summaryType: 'wcag',
    navGroup: 'Accessibility',
    navLabel: 'WCAG audit',
    specLabel: 'Accessibility',
    title: 'WCAG Findings',
    description:
      'Runs axe-core plus custom WCAG checks across the manifest to surface gating violations and advisory findings.',
  },
  {
    id: 'accessibility-forms',
    summaryType: 'forms',
    navGroup: 'Accessibility',
    navLabel: 'Forms validation',
    specLabel: 'Accessibility',
    title: 'Forms Validation Findings',
    description:
      'Evaluates configured forms for labelling, error messaging, and accessible validation responses.',
  },
  {
    id: 'accessibility-keyboard',
    summaryType: 'keyboard',
    navGroup: 'Accessibility',
    navLabel: 'Keyboard navigation',
    specLabel: 'Accessibility',
    title: 'Keyboard Navigation Findings',
    description:
      'Walks focus through key flows to confirm visible focus states, skip links, and navigable control ordering.',
  },
  {
    id: 'accessibility-structure',
    summaryType: 'structure',
    navGroup: 'Accessibility',
    navLabel: 'Structural semantics',
    specLabel: 'Accessibility',
    title: 'Structural Semantics Findings',
    description:
      'Audits headings and ARIA landmarks to ensure pages expose consistent document outlines and main regions.',
  },
  {
    id: 'functionality-links',
    summaryType: 'internal-links',
    navGroup: 'Functionality',
    navLabel: 'Internal link integrity',
    specLabel: 'Functionality',
    title: 'Internal Link Integrity',
    description:
      'Checks sampled internal links for HTTP errors or unexpected redirects so navigation remains intact.',
  },
  {
    id: 'functionality-interactive',
    summaryType: 'interactive',
    navGroup: 'Functionality',
    navLabel: 'Console & API stability',
    specLabel: 'Functionality',
    title: 'Console & API Stability',
    description:
      'Monitors console and network failures during lightweight interactions to catch regression crashes early.',
  },
  {
    id: 'functionality-availability',
    summaryType: 'availability',
    navGroup: 'Functionality',
    navLabel: 'Service endpoint health',
    specLabel: 'Functionality',
    title: 'Service Endpoint Health',
    description:
      'Verifies uptime checks, HTTP status expectations, and core service availability for the sampled pages.',
  },
  {
    id: 'responsive-layout',
    summaryType: 'responsive-structure',
    navGroup: 'Responsive',
    navLabel: 'Responsive breakpoint coverage',
    specLabel: 'Responsive',
    title: 'Responsive Breakpoint Coverage',
    description:
      'Captures layout structure across viewports, flagging missing navigation, headers, or content sections.',
  },
  {
    id: 'visual-regression',
    summaryType: 'visual',
    navGroup: 'Visual',
    navLabel: 'Visual regression',
    specLabel: 'Visual',
    title: 'Visual Regression Findings',
    description:
      'Highlights screenshot diffs, thresholds, and artifact previews for pages with detected pixel deltas.',
  },
];

const PANEL_STATUS_META = {
  fail: {
    label: 'Fail',
    specClass: 'spec-status--fail',
    navClass: 'status-fail',
  },
  warn: {
    label: 'Review',
    specClass: 'spec-status--warn',
    navClass: 'status-info',
  },
  pass: {
    label: 'Pass',
    specClass: 'spec-status--pass',
    navClass: 'status-pass',
  },
  info: {
    label: 'Overview',
    specClass: 'spec-status--info',
    navClass: 'status-info',
  },
};

const getNumericValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return 0;
};

const sumOverviewKeys = (entries, keys) =>
  entries.reduce((total, entry) => {
    if (!entry || typeof entry.overview !== 'object') return total;
    keys.forEach((key) => {
      if (key in entry.overview) {
        total += getNumericValue(entry.overview[key]);
      }
    });
    return total;
  }, 0);

const BLOCKING_PRIMARY_KEYS = [
  'totalGatingFindings',
  'totalConsoleErrors',
  'totalResourceErrors',
  'brokenLinksDetected',
  'diffs',
  'budgetBreaches',
  'budgetExceeded',
  'errors',
];

const BLOCKING_FALLBACK_KEYS = [
  'gatingPages',
  'pagesWithGatingIssues',
  'pagesWithErrors',
  'pagesWithFailedChecks',
  'pagesWithConsoleErrors',
  'pagesWithResourceErrors',
  'diffPages',
  'pagesWithDiffs',
];

const pickFirstAvailableKey = (source, keys) => {
  for (const key of keys) {
    if (source[key] != null) return key;
  }
  return null;
};

const deriveSuiteMetrics = (entries) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { blocking: 0, warnings: 0, advisories: 0, affectedPages: 0 };
  }

  let blocking = 0;
  let warnings = 0;
  let advisories = 0;
  let affectedPages = 0;

  entries.forEach((entry) => {
    const overview = entry?.overview || {};
    const hasPrimaryBlockingKey = BLOCKING_PRIMARY_KEYS.some((key) => overview[key] != null);
    if (hasPrimaryBlockingKey) {
      blocking += sumOverviewKeys([entry], BLOCKING_PRIMARY_KEYS);
    } else {
      const fallbackKey = pickFirstAvailableKey(overview, BLOCKING_FALLBACK_KEYS);
      if (fallbackKey) {
        blocking += getNumericValue(overview[fallbackKey]);
      }
    }

    warnings += sumOverviewKeys(
      [entry],
      ['pagesWithWarnings', 'advisoryPages', 'pagesWithAdvisories', 'warnings']
    );

    advisories += sumOverviewKeys(
      [entry],
      ['totalAdvisoryFindings', 'advisories', 'totalBestPracticeFindings']
    );

    affectedPages += sumOverviewKeys(
      [entry],
      ['gatingPages', 'pagesWithGatingIssues', 'pagesWithErrors', 'diffPages', 'pagesWithDiffs']
    );
  });

  return { blocking, warnings, advisories, affectedPages };
};

const collectRunSummariesByType = (records = []) => {
  const map = new Map();
  records.forEach((record) => {
    (record?.summaries || []).forEach((summary) => {
      if (!summary || summary.kind !== KIND_RUN_SUMMARY) return;
      const summaryType = summary.metadata?.summaryType;
      if (!summaryType) return;
      const scope = summary.metadata?.scope;
      const existing = map.get(summaryType);
      if (!existing) {
        map.set(summaryType, summary);
        return;
      }
      if (existing.metadata?.scope !== 'run' && scope === 'run') {
        map.set(summaryType, summary);
      }
    });
  });
  return map;
};

const formatNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString();
  return value;
};

const pluralise = (value, singular, plural) => {
  const count = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(count)) return singular;
  return count === 1 ? singular : plural;
};

const formatList = (values, emptyFallback = null) => {
  if (!Array.isArray(values) || values.length === 0) return emptyFallback;
  return values.join(', ');
};

const resolvePagesTested = (summaryMap) => {
  const preferredOrder = [
    { type: 'wcag', keys: ['totalPages', 'totalPagesAudited'] },
    { type: 'responsive-structure', keys: ['totalPages'] },
    { type: 'visual', keys: ['totalPages'] },
    { type: 'internal-links', keys: ['totalPages'] },
  ];

  for (const { type, keys } of preferredOrder) {
    const summary = summaryMap.get(type);
    if (!summary) continue;
    for (const key of keys) {
      const value = summary?.overview ? summary.overview[key] : null;
      const numeric = getNumericValue(value);
      if (numeric > 0) return numeric;
    }
  }

  let fallback = 0;
  summaryMap.forEach((summary) => {
    const overview = summary?.overview || {};
    ['totalPages', 'totalPagesAudited', 'pagesSampled'].forEach((key) => {
      const numeric = getNumericValue(overview[key]);
      if (numeric > fallback) fallback = numeric;
    });
  });

  return fallback || null;
};

const buildSuiteCards = (summaryMap) =>
  SUITE_GROUP_DEFINITIONS.map((group) => {
    const entries = group.summaryTypes
      .map((type) => summaryMap.get(type))
      .filter((entry) => Boolean(entry));

    if (entries.length === 0) return null;

    const metrics = deriveSuiteMetrics(entries);
    const specIds = new Set();
    entries.forEach((entry) => {
      const specId = entry.metadata?.spec;
      if (specId) {
        specIds.add(`${specId}.spec.js`);
      }
    });

    const specsText = specIds.size ? Array.from(specIds).join(', ') : 'Not captured';
    const hasBlocking = metrics.blocking > 0;
    const hasWarnings = metrics.warnings > 0 || metrics.advisories > 0;
    const statusClass = hasBlocking ? 'status-fail' : hasWarnings ? 'status-info' : 'status-pass';
    const blockingFindings = hasBlocking ? metrics.blocking : 0;
    const blockingPages = metrics.affectedPages || 0;
    const summaryText = hasBlocking
      ? 'Blocking issues detected. Open this suite tab for the affected pages and fixes.'
      : hasWarnings
        ? 'No blockers, but warnings were logged for follow-up.'
        : 'No blocking issues detected in this suite.';

    return {
      id: group.id,
      label: group.label,
      heading: group.heading,
      statusClass,
      specsText,
      blockingFindings,
      blockingPages,
      summaryText,
    };
  }).filter(Boolean);

const renderSuiteCardsSection = (suiteCards) => {
  if (!Array.isArray(suiteCards) || suiteCards.length === 0) return '';

  const cardsHtml = suiteCards
    .map(
      (card) => `
        <article class="suite-card ${escapeHtml(card.statusClass)}">
          <header>
            <p class="spec-label">${escapeHtml(card.label)}</p>
            <h4>${escapeHtml(card.heading)}</h4>
          </header>
          <ul class="suite-metrics suite-metrics--summary">
            <li><strong>Specs:</strong> ${escapeHtml(card.specsText)}</li>
            <li><strong>Blocking findings:</strong> ${
              card.blockingFindings
                ? `${escapeHtml(
                    formatNumber(card.blockingFindings)
                  )} ${escapeHtml(pluralise(card.blockingFindings, 'finding', 'findings'))}`
                : '0 findings'
            }</li>
            <li><strong>Blocking pages:</strong> ${
              card.blockingPages
                ? `${escapeHtml(
                    formatNumber(card.blockingPages)
                  )} ${escapeHtml(pluralise(card.blockingPages, 'page', 'pages'))}`
                : '0 pages'
            }</li>
          </ul>
          <p class="suite-status">${escapeHtml(card.summaryText)}</p>
        </article>
      `
    )
    .join('\n');

  return `
    <section class="suite-overview">
      <h3>Suites at a glance</h3>
      <div class="suite-grid">
        ${cardsHtml}
      </div>
    </section>
  `;
};

const resolveViewportsTested = (records = []) => {
  const viewports = new Set();
  records.forEach((record) => {
    (record?.summaries || []).forEach((summary) => {
      const meta = summary?.metadata || {};
      const metaViewports = Array.isArray(meta.viewports) ? meta.viewports : null;
      if (metaViewports && metaViewports.length > 0) {
        metaViewports.filter(Boolean).forEach((viewport) => viewports.add(String(viewport)));
      }
      if (meta.viewport) {
        viewports.add(String(meta.viewport));
      }
    });
  });
  return Array.from(viewports);
};

const renderSummaryStatCards = (run, summaryMap, suiteCards, schemaRecords) => {
  const pagesTested = resolvePagesTested(summaryMap);
  const projects = Array.isArray(run?.projects) ? run.projects.filter(Boolean) : [];
  const totalTests =
    typeof run?.totalTests === 'number' && Number.isFinite(run.totalTests)
      ? run.totalTests
      : typeof run?.totalTestsPlanned === 'number' && Number.isFinite(run.totalTestsPlanned)
        ? run.totalTestsPlanned
        : null;
  const viewportsTested = resolveViewportsTested(schemaRecords);
  const siteLabel = run?.site?.baseUrl || run?.site?.name || null;

  const stats = [
    {
      label: 'SITE TESTED',
      count: siteLabel ? '1' : '—',
      meta: siteLabel || 'Not captured',
    },
    {
      label: 'PAGES SCANNED',
      count: pagesTested != null ? formatNumber(pagesTested) : '—',
      meta: pagesTested != null ? 'per test' : 'Not captured',
    },
    {
      label: 'TESTS ON EACH PAGE',
      count: totalTests != null ? formatNumber(totalTests) : '—',
      meta: totalTests != null ? 'Listed in sidebar' : 'Not captured',
    },
    {
      label: 'BROWSERS INCLUDED',
      count: projects.length ? formatNumber(projects.length) : '—',
      meta: projects.length ? formatList(projects) : 'Not captured',
    },
    {
      label: 'LAYOUTS COVERED',
      count: viewportsTested.length ? formatNumber(viewportsTested.length) : '—',
      meta: viewportsTested.length ? formatList(viewportsTested) : 'Not captured',
    },
  ];

  const cardsHtml = stats
    .map(
      (stat) => `
        <article class="summary-card">
          <h2 class="summary-card__title"><span class="summary-card__count">${escapeHtml(
            String(stat.count)
          )}</span> ${escapeHtml(stat.label)}</h2>
          <div class="meta">${escapeHtml(stat.meta)}</div>
        </article>
      `
    )
    .join('\n');

  return cardsHtml
    ? `
    <section class="summary-grid summary-grid--stats">
      ${cardsHtml}
    </section>
  `
    : '';
};

const renderSummaryOverview = (run, schemaRecords) => {
  const summaryMap = collectRunSummariesByType(schemaRecords);
  if (summaryMap.size === 0 && !run) return '';

  const suiteCards = buildSuiteCards(summaryMap);
  const statCards = renderSummaryStatCards(run, summaryMap, suiteCards, schemaRecords);
  const suitesHtml = renderSuiteCardsSection(suiteCards);

  return [statCards, suitesHtml].filter(Boolean).join('\n');
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
        if (summary.metadata?.suppressPageEntries) {
          group.suppressPageEntries = true;
        }
      } else if (summary.kind === KIND_PAGE_SUMMARY) {
        if (summary.metadata?.suppressPageEntries) {
          group.suppressPageEntries = true;
        }
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
  const hasCustomHtml = Boolean(payload.htmlBody);
  const overviewHtml = hasCustomHtml
    ? payload.htmlBody
    : payload.overview
      ? renderSchemaMetrics(payload.overview)
      : '';
  const rulesHtml = hasCustomHtml ? '' : renderRuleSnapshotsTable(payload.ruleSnapshots);

  const body = [metaHtml, overviewHtml, rulesHtml].filter(Boolean).join('\n');
  if (!body) return '';

  return `
    <section class="schema-overview">
      ${body}
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
      const sortedEntries = pageEntries.sort((a, b) =>
        (a.payload.viewport || '').localeCompare(b.payload.viewport || '')
      );
      const hasCustomCards = sortedEntries.some((entry) =>
        Boolean(entry.payload?.summary?.cardHtml)
      );

      const content = hasCustomCards
        ? sortedEntries
            .map((entry) => {
              const payload = entry.payload || {};
              const summaryData = payload.summary || {};
              if (summaryData.cardHtml) return summaryData.cardHtml;
              const fallback = renderSchemaMetrics(summaryData);
              return `<div class="schema-metrics">${fallback}</div>`;
            })
            .join('\n')
        : (() => {
            const rows = sortedEntries
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
              <table class="schema-table">
                <thead><tr><th>Viewport</th><th>Summary</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            `;
          })();

      return `
        <details class="summary-page schema-page-accordion">
          <summary>${escapeHtml(page)}</summary>
          <div class="summary-page__body">
            ${content}
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
    const projectName =
      meta.projectName || entry.projectName || (meta.scope === 'run' ? 'run' : 'default');
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

const accessibilityStatusClass = (status) => {
  const map = {
    violations: 'status-error',
    'http-error': 'status-error',
    'scan-error': 'status-warning',
    'stability-timeout': 'status-warning',
    skipped: 'status-neutral',
    passed: 'status-ok',
  };
  return map[status] || 'status-ok';
};

const formatAccessibilityNotesHtml = (summary) => {
  const notes = Array.isArray(summary.notes) ? summary.notes.slice(0, 10) : [];
  const extra = [];
  if (summary.stability) {
    const stability = summary.stability || {};
    const label = stability.ok ? 'Stable' : 'Stability issue';
    const detail = stability.strategy ? `${label} (strategy: ${stability.strategy})` : label;
    extra.push(detail);
  }
  if (summary.httpStatus && summary.httpStatus !== 200) {
    extra.push(`HTTP ${summary.httpStatus}`);
  }
  const combined = [...notes, ...extra];
  if (combined.length === 0) {
    return '<span class="details">None</span>';
  }
  const items = combined
    .map((note) => `<li class="details">${escapeHtml(String(note))}</li>`)
    .join('');
  return `
        <ul class="checks">${items}</ul>
      `;
};

const renderAccessibilityGroupHtmlLegacy = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const multiProject = buckets.length > 1;

  const sections = buckets
    .map((bucket) => {
      const runPayload = firstRunPayload(bucket);
      const pages = bucket.pageEntries
        .map((entry) => entry.payload || {})
        .filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
      const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
      const suppressPageEntries = Boolean(
        runPayload?.metadata?.suppressPageEntries || group.suppressPageEntries
      );
      const hasCustomRunHtml = Boolean(runPayload?.htmlBody);
      const shouldRenderPageCards = !hasCustomRunHtml && !suppressPageEntries;
      const defaultOverviewHtml =
        !hasCustomRunHtml && runPayload?.overview ? renderSchemaMetrics(runPayload.overview) : '';

      const pageCards = pages
        .map((payload) => {
          const summary = payload.summary || {};
          if (summary.cardHtml) return summary.cardHtml;

          const status = summary.status || 'passed';
          const statusLabel = status.replace(/[-_/]+/g, ' ');
          const notesHtml = formatAccessibilityNotesHtml(summary);
          return `
      <section class="summary-report summary-a11y">
        <h3>${escapeHtml(payload.page || 'unknown')}</h3>
        <table>
          <thead><tr><th>Status</th><th>Gating</th><th>Advisory</th><th>Best practice</th><th>HTTP</th><th>Notes</th></tr></thead>
          <tbody>
            <tr class="${accessibilityStatusClass(status)}">
              <td>${escapeHtml(statusLabel)}</td>
              <td>${summary.gatingViolations ?? 0}</td>
              <td>${summary.advisoryFindings ?? 0}</td>
              <td>${summary.bestPracticeFindings ?? 0}</td>
              <td>${summary.httpStatus ?? '—'}</td>
              <td>${notesHtml}</td>
            </tr>
          </tbody>
        </table>
      </section>
    `;
        })
        .join('\n');

      if (hasCustomRunHtml) {
        const projectHeading = multiProject
          ? `<header class="schema-group__project"><h3>${escapeHtml(projectLabel)}</h3></header>`
          : '';
        return `
      <section class="schema-group__project-block">
        ${projectHeading}
        ${runPayload.htmlBody}
      </section>
    `;
      }

      const headingLabel = multiProject ? `${projectLabel} – WCAG findings` : 'WCAG findings';

      const pagesHtml = shouldRenderPageCards ? pageCards : '';

      return `
      <section class="schema-group__project-block">
        <section class="summary-report summary-a11y">
          <h3>${escapeHtml(headingLabel)}</h3>
          ${defaultOverviewHtml}
          ${pagesHtml}
        </section>
      </section>
    `;
    })
    .join('\n');

  const headline = escapeHtml(group.title || 'WCAG findings summary');
  return `
    <article class="schema-group">
      <header><h2>${headline}</h2></header>
      ${sections}
    </article>
  `;
};

const renderWcagPageIssueTable = (entries, heading) => {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const rows = entries
    .map((entry) => {
      const impact = entry.impact || entry.category || 'info';
      const nodesCount = Array.isArray(entry.nodes) ? entry.nodes.length : entry.nodesCount || 0;
      const helpUrl = entry.helpUrl || entry.help || null;
      const targetsHtml = extractNodeTargets(entry.nodes || []);
      const wcagHtml = renderWcagTagBadges(entry.tags || entry.wcagTags || []);
      return `
        <tr class="impact-${escapeHtml((impact || 'info').toLowerCase())}">
          <td>${escapeHtml(impact || 'info')}</td>
          <td>${escapeHtml(entry.id || entry.rule || 'Unnamed rule')}</td>
          <td>${escapeHtml(formatCount(nodesCount))}</td>
          <td>${helpUrl ? `<a href="${escapeHtml(helpUrl)}" target="_blank" rel="noopener noreferrer">rule docs</a>` : '<span class="details">—</span>'}</td>
          <td>${wcagHtml}</td>
          <td>${targetsHtml || '<span class="details">—</span>'}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <h4>${escapeHtml(heading)}</h4>
    <div class="page-card__table">
      <table>
        <thead><tr><th>Impact</th><th>Rule</th><th>Nodes</th><th>Help</th><th>WCAG level</th><th>Sample targets</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
};

const renderWcagRunSummary = (overview, details, { viewportLabel, viewportsCount }) => {
  const pages = Array.isArray(details?.pages) ? details.pages : [];
  const totalPages = overview?.totalPages ?? pages.length;
  const failThreshold = details?.failThreshold || overview?.failThreshold;
  const gatingPages =
    overview?.gatingPages ??
    pages.filter((page) => (page.gatingViolations || 0) > 0).length;
  const bestPracticePages =
    overview?.bestPracticePages ??
    pages.filter((page) => (page.bestPracticeFindings || 0) > 0).length;
  const advisoryPages =
    overview?.advisoryPages ??
    pages.filter((page) => (page.advisoryFindings || 0) > 0).length;
  const scanIssues = pages.filter((page) =>
    ['scan-error', 'http-error', 'stability-timeout'].includes(page.status)
  ).length;
  const totalAdvisories =
    overview?.totalAdvisoryFindings ??
    pages.reduce((sum, page) => sum + (page.advisoryFindings || 0), 0);
  const totalBestPractice =
    overview?.totalBestPracticeFindings ??
    pages.reduce((sum, page) => sum + (page.bestPracticeFindings || 0), 0);

  const statusSummary = renderStatusSummaryList(
    [
      {
        label: 'Accessibility violations',
        tone: 'status-error',
        count: gatingPages,
        suffix: 'page(s)',
      },
      {
        label: 'Scan issues',
        tone: 'status-warning',
        count: scanIssues,
        suffix: 'page(s)',
      },
      {
        label: 'Best-practice advisories',
        tone: 'status-info',
        count: bestPracticePages,
        suffix: 'page(s)',
      },
    ],
    { className: 'status-summary' }
  );

  const advisoryNote =
    totalAdvisories > 0
      ? `<p class="details">WCAG advisories raised on ${escapeHtml(
          formatCount(advisoryPages)
        )} page(s).</p>`
      : '';

  const bestPracticeNote =
    totalBestPractice > 0
      ? `<p class="details">Best-practice advisories surfaced on ${escapeHtml(
          formatCount(bestPracticePages)
        )} page(s).</p>`
      : '';

  return `
    <section class="summary-report summary-a11y">
      <h3>Accessibility run summary</h3>
      <p>Analyzed <strong>${escapeHtml(
        formatCount(totalPages)
      )}</strong> page(s) per browser across <strong>${escapeHtml(
        formatCount(viewportsCount || 1)
      )}</strong> viewport(s): ${escapeHtml(viewportLabel || 'Not recorded')}.</p>
      ${statusSummary}
      ${
        failThreshold
          ? `<p class="details">Gating threshold: ${escapeHtml(String(failThreshold))}</p>`
          : ''
      }
      ${advisoryNote}
      ${bestPracticeNote}
      <p class="legend">
        <span class="badge badge-critical">Critical</span>
        <span class="badge badge-serious">Serious</span>
        <span class="badge badge-wcag">WCAG A/AA/AAA</span>
      </p>
    </section>
  `;
};

const renderWcagPerPageSection = (pages, options = {}) => {
  const entries = Array.isArray(pages) ? pages : [];
  if (entries.length === 0) return '';

  const detailsHtml = entries
    .map((page) => {
      const summary = page.summary || page;
      const statusMeta = deriveWcagPageStatus(summary);
      const cardHtml = renderWcagPageCard(summary, options);
      if (!cardHtml) return '';
      const label = formatPageLabel(summary.page || page.page || 'Page');
      return `
        <details class="summary-page summary-page--wcag ${statusMeta.pageClass}">
          <summary>${escapeHtml(label)}</summary>
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
    <section class="summary-report summary-a11y" data-per-page="list">
      <div class="summary-per-page-header">
        <h3>Per-page findings</h3>
        <div class="summary-toggle-controls">
          <button type="button" class="summary-toggle-button" data-toggle="expand">Expand all</button>
          <button type="button" class="summary-toggle-button" data-toggle="collapse">Collapse all</button>
        </div>
      </div>
      ${detailsHtml}
    </section>
    <script>${WCAG_PER_PAGE_TOGGLE_SCRIPT}</script>
  `;
};

const renderAccessibilityGroupHtml = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const dataReady = buckets.every((bucket) => {
    const runPayload = firstRunPayload(bucket);
    return runPayload?.details && Array.isArray(runPayload.details.pages);
  });

  if (!dataReady) {
    return '';
  }
  const multiBucket = buckets.length > 1;

  const sections = buckets
    .map((bucket) => {
      const runPayload = firstRunPayload(bucket);
      if (!runPayload) return '';

      const details = runPayload.details || {};
      const overview = runPayload.overview || {};
      const metadata = runPayload.metadata || {};
      const projectLabel = metadata.projectName || bucket.projectName || 'Chrome';
      const viewportList =
        Array.isArray(details.viewports) && details.viewports.length
          ? details.viewports
          : Array.isArray(metadata.viewports) && metadata.viewports.length
            ? metadata.viewports
            : projectLabel
              ? [projectLabel]
              : [];
      const viewportLabel = viewportList.length ? viewportList.join(', ') : projectLabel;
      const viewportCount = viewportList.length || 1;

      const runSummaryHtml = renderWcagRunSummary(overview, details, {
        viewportLabel,
        viewportsCount: viewportCount,
      });

      const ruleSnapshots = Array.isArray(runPayload.ruleSnapshots) ? runPayload.ruleSnapshots : [];
      const gatingRules = ruleSnapshots.filter((snapshot) => (snapshot.category || '').toLowerCase() === 'gating');
      const advisoryRules = ruleSnapshots.filter((snapshot) => (snapshot.category || '').toLowerCase() === 'advisory');
      const bestPracticeRules = ruleSnapshots.filter((snapshot) => (snapshot.category || '').toLowerCase() === 'best-practice');

      const ruleSections = [
        renderAccessibilityRuleTable(
          formatRuleHeading('Gating WCAG violations', gatingRules.length),
          gatingRules
        ),
        renderAccessibilityRuleTable(
          formatRuleHeading('WCAG advisory findings', advisoryRules.length),
          advisoryRules
        ),
        renderAccessibilityRuleTable(
          formatRuleHeading('Best-practice advisories', bestPracticeRules.length),
          bestPracticeRules,
          { headingClass: 'summary-heading-best-practice' }
        ),
      ]
        .filter(Boolean)
        .join('\n');

      const perPageHtml = renderWcagPerPageSection(details.pages || [], {
        viewportLabel,
        failThreshold: details.failThreshold || overview.failThreshold || metadata.failOn,
      });

      const content = [runSummaryHtml, ruleSections, perPageHtml]
        .filter(Boolean)
        .join('\n');
      if (!content.trim()) return '';

      if (multiBucket) {
        return `
          <section class="schema-group__project-block">
            <header class="schema-group__project"><h3>${escapeHtml(projectLabel)}</h3></header>
            ${content}
          </section>
        `;
      }

      return content;
    })
    .filter(Boolean)
    .join('\n');

  if (!sections.trim()) return '';

  const headline =
    multiBucket && group.title ? `<header><h2>${escapeHtml(group.title)}</h2></header>` : '';
  return `
    <section class="schema-group">
      ${headline}
      ${sections}
    </section>
  `;
};

const firstRunPayload = (bucket) =>
  bucket.runEntries.find((entry) => Boolean(entry?.payload))?.payload || null;

const renderInternalLinksGroupHtml = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const detailPages = Array.isArray(runPayload?.details?.pages)
      ? runPayload.details.pages.map((page) => ({
          payload: {
            page: page.page,
            summary: page,
          },
        }))
      : null;
    const pages = (detailPages || bucket.pageEntries)
      .map((entry) => entry.payload || {})
      .filter((payload) => payload.kind === KIND_PAGE_SUMMARY || payload.summary);
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
    const pages = bucket.pageEntries
      .map((entry) => entry.payload || {})
      .filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
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
              .map(
                (item) => `<li class="check-fail">${escapeHtml(item.message || String(item))}</li>`
              )
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
                const label =
                  item.type === 'requestfailed'
                    ? `${item.type} – ${item.failure || 'unknown'}`
                    : `${item.type || 'resource'} ${item.status || ''} ${item.method || ''}`;
                return `<li class="check-fail">${escapeHtml(label.trim())} — <code>${escapeHtml(item.url || '')}</code></li>`;
              })
              .join('')
          : '<li class="check-pass">No failed requests</li>';
        const resourceList = `
          <ul class="checks">${resourceItems}</ul>
        `;

        const warningItems = (summary.warnings || []).map(
          (msg) => `<li class="check-fail">${escapeHtml(msg)}</li>`
        );
        const infoItems = (summary.info || []).map(
          (msg) => `<li class="check-pass">${escapeHtml(msg)}</li>`
        );
        const notesHtml =
          warningItems.length || infoItems.length
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

    const budgetNote =
      resourceBudget != null
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
    const detailPages = Array.isArray(runPayload?.details?.pages)
      ? runPayload.details.pages.map((page) => ({
          payload: {
            page: page.page,
            summary: page,
          },
        }))
      : null;
    const pages = (detailPages || bucket.pageEntries)
      .map((entry) => entry.payload || {})
      .filter((payload) => payload.kind === KIND_PAGE_SUMMARY || payload.summary);
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
                .map(
                  ([key, value]) =>
                    `<li class="${value ? 'check-pass' : 'check-fail'}">${escapeHtml(key)}: ${value ? 'present' : 'missing'}</li>`
                )
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

        const hasMissingStructure = Object.values(elements || {}).some((value) => value === false);
        const hasWarnings = warnings.length > 0;
        const rowClass =
          hasMissingStructure || hasWarnings ? 'status-error' : statusClassFromStatus(status);

        return `
          <tr class="${rowClass}">
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
    const detailPages = Array.isArray(runPayload?.details?.pages)
      ? runPayload.details.pages.map((page) => ({
          payload: {
            page: page.page,
            summary: page,
          },
        }))
      : null;
    const pages = (detailPages || bucket.pageEntries)
      .map((entry) => entry.payload || {})
      .filter((payload) => payload.kind === KIND_PAGE_SUMMARY || payload.summary);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const overviewHtml = runPayload?.overview ? renderSchemaMetrics(runPayload.overview) : '';

    const rows = pages
      .map((payload) => {
        const summary = payload.summary || {};
        const failedChecks = summary.failedChecks || [];
        const failedList = failedChecks.length
          ? `
              <ul class="checks">${failedChecks
                .map(
                  (check) =>
                    `<li class="check-fail">${escapeHtml(check.label || 'Check failed')}${check.details ? ` — ${escapeHtml(check.details)}` : ''}</li>`
                )
                .join('')}</ul>
            `
          : '<span class="details">All checks passed</span>';
        const rowClass =
          failedChecks.length > 0 ? 'status-error' : statusClassFromStatus(summary.status);
        return `
          <tr class="${rowClass}">
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
    const detailPages = Array.isArray(runPayload?.details?.pages)
      ? runPayload.details.pages.map((page) => ({
          payload: {
            page: page.page,
            summary: page,
          },
        }))
      : null;
    const pages = (detailPages || bucket.pageEntries)
      .map((entry) => entry.payload || {})
      .filter((payload) => payload.kind === KIND_PAGE_SUMMARY || payload.summary);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const overviewHtml = runPayload?.overview ? renderSchemaMetrics(runPayload.overview) : '';

    const rows = pages
      .map((payload) => {
        const summary = payload.summary || {};
        const breaches = (summary.budgetBreaches || []).map(
          (breach) =>
            `${breach.metric}: ${Math.round(breach.value)}ms (budget ${Math.round(breach.budget)}ms)`
        );
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
            <td>${summary.firstPaintMs != null ? Math.round(summary.firstPaintMs) : '—'}</td>
            <td>${breachList}</td>
          </tr>
        `;
      })
      .join('');

    const tableHtml = rows
      ? `
          <table>
            <thead><tr><th>Page</th><th>Load (ms)</th><th>DOM Loaded</th><th>Load complete</th><th>FCP</th><th>First paint</th><th>Budget breaches</th></tr></thead>
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
    const pages = bucket.pageEntries
      .map((entry) => entry.payload || {})
      .filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
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
                .map(
                  (line) =>
                    `<li class="${result === 'diff' ? 'check-fail' : 'details'}">${escapeHtml(line)}</li>`
                )
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
  const pageHtml = group.suppressPageEntries
    ? ''
    : renderSchemaPageEntries(group.pageEntries || []);
  const body = [runHtml, pageHtml].filter(Boolean).join('');
  if (!body) return '';
  return `
    <article class="schema-group">
      <header><h2>${escapeHtml(headline)}</h2></header>
      ${body}
    </article>
  `;
};

const formatSchemaValueMarkdown = (value) => {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    const simple = value.every(
      (item) => item == null || ['string', 'number', 'boolean'].includes(typeof item)
    );
    if (simple) {
      return value.map((item) => (item == null ? '—' : formatSchemaValueMarkdown(item))).join(', ');
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
    const pages =
      Array.isArray(snapshot.pages) && snapshot.pages.length > 0 ? snapshot.pages.join(', ') : '—';
    const nodes = snapshot.nodes != null ? String(snapshot.nodes) : '—';
    const viewports =
      Array.isArray(snapshot.viewports) && snapshot.viewports.length > 0
        ? snapshot.viewports.join(', ')
        : '—';
    const wcagTags =
      Array.isArray(snapshot.wcagTags) && snapshot.wcagTags.length > 0
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
    const pages = bucket.pageEntries
      .map((entry) => entry.payload || {})
      .filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
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
        brokenRows.push(
          `| \`${payload.page || 'unknown'}\` | ${issue.url || ''} | ${issue.status != null ? issue.status : issue.error || 'error'} | ${issue.methodTried || 'HEAD'} |`
        );
      });
    });

    const brokenSection = brokenRows.length
      ? [
          '## Broken links',
          '',
          '| Source page | URL | Status / Error | Method |',
          '| --- | --- | --- | --- |',
          ...brokenRows,
        ].join('\n')
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
    const pages = bucket.pageEntries
      .map((entry) => entry.payload || {})
      .filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const heading = `${group.title || 'Interactive smoke summary'} – ${projectLabel}`;
    const overview = runPayload?.overview ? renderSchemaMetricsMarkdown(runPayload.overview) : '';
    const budget = runPayload?.overview?.resourceErrorBudget;

    const header = '| Page | Status | Console | Resources | Notes |';
    const separator = '| --- | --- | --- | --- | --- |';
    const rows = pages.map((payload) => {
      const summary = payload.summary || {};
      const consoleOutput = (summary.consoleSample || [])
        .map((entry) => `⚠️ ${entry.message || entry}`)
        .join('<br />');
      const consoleCell = summary.consoleErrors
        ? consoleOutput || 'See captured sample'
        : '✅ None';
      const resourceOutput = (summary.resourceSample || [])
        .map((entry) => {
          const base =
            entry.type === 'requestfailed'
              ? `requestfailed ${entry.url} (${entry.failure || 'unknown'})`
              : `${entry.type} ${entry.status || ''} ${entry.method || ''} ${entry.url}`;
          return `⚠️ ${base.trim()}`;
        })
        .join('<br />');
      const resourceCell = summary.resourceErrors
        ? resourceOutput || 'See captured sample'
        : '✅ None';
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
    const detailPages = Array.isArray(runPayload?.details?.pages)
      ? runPayload.details.pages.map((page) => ({
          payload: {
            page: page.page,
            summary: page,
          },
        }))
      : null;
    const pages = (detailPages || bucket.pageEntries)
      .map((entry) => entry.payload || {})
      .filter((payload) => payload.kind === KIND_PAGE_SUMMARY || payload.summary);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const heading = `${group.title || 'Availability & uptime summary'} – ${projectLabel}`;
    const overview = runPayload?.overview ? renderSchemaMetricsMarkdown(runPayload.overview) : '';

    const header = '| Page | Status | Warnings | Info |';
    const separator = '| --- | --- | --- | --- |';
    const rows = pages.map((payload) => {
      const summary = payload.summary || {};
      const warnings =
        (summary.warnings || []).map((message) => `⚠️ ${message}`).join('<br />') || 'None';
      const info = (summary.info || []).map((message) => `ℹ️ ${message}`).join('<br />') || 'None';
      const statusLabel = summary.status == null ? 'n/a' : summary.status;
      const hasStructureGap = Object.values(summary.elements || {}).some(
        (value) => value === false
      );
      const severity = hasStructureGap || (summary.warnings || []).length ? '⚠️' : '✅';
      return `| \`${payload.page || 'unknown'}\` | ${severity} ${statusLabel} | ${warnings} | ${info} |`;
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
    const detailPages = Array.isArray(runPayload?.details?.pages)
      ? runPayload.details.pages.map((page) => ({
          payload: {
            page: page.page,
            summary: page,
          },
        }))
      : null;
    const pages = (detailPages || bucket.pageEntries)
      .map((entry) => entry.payload || {})
      .filter((payload) => payload.kind === KIND_PAGE_SUMMARY || payload.summary);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const heading = `${group.title || 'HTTP response validation summary'} – ${projectLabel}`;
    const overview = runPayload?.overview ? renderSchemaMetricsMarkdown(runPayload.overview) : '';

    const header = '| Page | Status | Redirect | Failed checks |';
    const separator = '| --- | --- | --- | --- |';
    const rows = pages.map((payload) => {
      const summary = payload.summary || {};
      const failedChecks =
        (summary.failedChecks || [])
          .map(
            (check) =>
              `⚠️ ${check.label || 'Check failed'}${check.details ? ` — ${check.details}` : ''}`
          )
          .join('<br />') || 'None';
      const statusLabel = summary.status == null ? 'n/a' : summary.status;
      const redirect = summary.redirectLocation || '—';
      const severity = (summary.failedChecks || []).length ? '⚠️' : '✅';
      return `| \`${payload.page || 'unknown'}\` | ${severity} ${statusLabel} | ${redirect} | ${failedChecks} |`;
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
    const pages = bucket.pageEntries
      .map((entry) => entry.payload || {})
      .filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const heading = `${group.title || 'Performance monitoring summary'} – ${projectLabel}`;
    const overview = runPayload?.overview ? renderSchemaMetricsMarkdown(runPayload.overview) : '';

    const header = '| Page | Load (ms) | DOM Loaded | Load complete | FCP | FP | Breaches |';
    const separator = '| --- | --- | --- | --- | --- | --- | --- |';
    const rows = pages.map((payload) => {
      const summary = payload.summary || {};
      const breaches =
        (summary.budgetBreaches || [])
          .map(
            (breach) =>
              `${breach.metric}: ${Math.round(breach.value)}ms (budget ${Math.round(breach.budget)}ms)`
          )
          .join('<br />') || 'None';
      return `| \`${payload.page || 'unknown'}\` | ${summary.loadTimeMs != null ? Math.round(summary.loadTimeMs) : '—'} | ${summary.domContentLoadedMs != null ? Math.round(summary.domContentLoadedMs) : '—'} | ${summary.loadCompleteMs != null ? Math.round(summary.loadCompleteMs) : '—'} | ${summary.firstContentfulPaintMs != null ? Math.round(summary.firstContentfulPaintMs) : '—'} | ${summary.firstPaintMs != null ? Math.round(summary.firstPaintMs) : '—'} | ${breaches} |`;
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
    const pages = bucket.pageEntries
      .map((entry) => entry.payload || {})
      .filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
    const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
    const heading = `${group.title || 'Visual regression summary'} – ${projectLabel}`;
    const overview = runPayload?.overview ? renderSchemaMetricsMarkdown(runPayload.overview) : '';

    const header = '| Page | Screenshot | Threshold | Result | Details |';
    const separator = '| --- | --- | --- | --- | --- |';
    const rows = pages.map((payload) => {
      const summary = payload.summary || {};
      const result = (summary.result || '').toLowerCase();
      const diffDetails = [];
      if (summary.pixelDiff != null)
        diffDetails.push(`Pixel diff: ${summary.pixelDiff.toLocaleString()}`);
      if (summary.pixelRatio != null)
        diffDetails.push(`Diff ratio: ${(summary.pixelRatio * 100).toFixed(2)}%`);
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

const renderResponsiveStructureGroupMarkdown = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pages = Array.isArray(runPayload?.details?.pages) ? runPayload.details.pages : [];

    const heading = [
      group.title || 'Responsive structure summary',
      bucket.projectName || runPayload?.metadata?.projectName || 'default',
    ].join(' – ');

    const overview = runPayload?.overview ? renderSchemaMetricsMarkdown(runPayload.overview) : '';

    const header =
      '| Page | Load (ms) | Threshold | Header | Navigation | Content | Footer | Issues |';
    const separator = '| --- | --- | --- | --- | --- | --- | --- | --- |';
    const rows = pages.map((page) => {
      const issues = [...(page.gatingIssues || []), ...(page.warnings || [])];
      const issuesCell = issues.length ? issues.map((i) => `⚠️ ${i}`).join('<br />') : 'None';
      return `| \`${page.page || 'unknown'}\` | ${page.loadTimeMs != null ? Math.round(page.loadTimeMs) : '—'} | ${page.thresholdMs != null ? Math.round(page.thresholdMs) : '—'} | ${page.headerPresent ? '✅' : '⚠️'} | ${page.navigationPresent ? '✅' : '⚠️'} | ${page.contentPresent ? '✅' : '⚠️'} | ${page.footerPresent ? '✅' : '⚠️'} | ${issuesCell} |`;
    });

    const parts = [`## ${heading}`];
    if (overview) parts.push(overview);
    if (rows.length > 0) {
      parts.push('', header, separator, ...rows);
    } else {
      parts.push('', '_No responsive structure data captured._');
    }
    return parts.join('\n');
  });

  return sections.join('\n\n');
};

const renderResponsiveWpGroupMarkdown = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pages = Array.isArray(runPayload?.details?.pages) ? runPayload.details.pages : [];
    const heading = `${group.title || 'WordPress responsive features summary'} – ${bucket.projectName || runPayload?.metadata?.projectName || 'default'}`;
    const overview = runPayload?.overview ? renderSchemaMetricsMarkdown(runPayload.overview) : '';

    const header = '| Viewport | Responsive | Block elements | Widgets | Warnings | Info |';
    const separator = '| --- | --- | --- | --- | --- | --- |';
    const rows = pages.map((page) => {
      const warnings = (page.warnings || []).length
        ? page.warnings.map((item) => `⚠️ ${item}`).join('<br />')
        : 'None';
      const info = (page.info || []).length
        ? page.info.map((item) => `ℹ️ ${item}`).join('<br />')
        : 'None';
      return `| ${page.viewport || 'viewport'} | ${page.responsiveDetected ? '✅' : '⚠️'} | ${page.blockElements ?? 0} | ${page.widgets ?? 0} | ${warnings} | ${info} |`;
    });

    const parts = [`## ${heading}`];
    if (overview) parts.push(overview);
    if (rows.length > 0) {
      parts.push('', header, separator, ...rows);
    } else {
      parts.push('', '_No WordPress responsive data captured._');
    }
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
    const summary =
      payload.summary && Object.keys(payload.summary).length > 0
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

const formatAccessibilityNotesMarkdown = (summary) => {
  const notes = Array.isArray(summary.notes) ? summary.notes.slice(0, 10) : [];
  const extra = [];
  if (summary.stability) {
    const stability = summary.stability || {};
    const label = stability.ok ? 'Stable' : 'Stability issue';
    const detail = stability.strategy ? `${label} (strategy: ${stability.strategy})` : label;
    extra.push(detail);
  }
  if (summary.httpStatus && summary.httpStatus !== 200) {
    extra.push(`HTTP ${summary.httpStatus}`);
  }
  const combined = [...notes, ...extra];
  if (combined.length === 0) return 'None';
  return combined.map((note) => String(note)).join('<br />');
};

const renderAccessibilityGroupMarkdown = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets
    .map((bucket) => {
      const runPayload = firstRunPayload(bucket);
      const pages = bucket.pageEntries
        .map((entry) => entry.payload || {})
        .filter((payload) => payload.kind === KIND_PAGE_SUMMARY);
      const projectLabel = runPayload?.metadata?.projectName || bucket.projectName || 'default';
      const heading = `${group.title || 'WCAG findings summary'} – ${projectLabel}`;
      const overview =
        runPayload?.markdownBody ||
        (runPayload?.overview ? renderSchemaMetricsMarkdown(runPayload.overview) : '');

      const pageSections = pages.map((payload) => {
        const summary = payload.summary || {};
        if (summary.cardMarkdown) return summary.cardMarkdown;

        const status = summary.status || 'passed';
        const statusLabel = status.replace(/[-_/]+/g, ' ');
        const notes = formatAccessibilityNotesMarkdown(summary);
        return `### ${payload.page || 'unknown'}\n\n- Status: ${statusLabel}\n- Gating: ${summary.gatingViolations ?? 0}\n- Advisory: ${summary.advisoryFindings ?? 0}\n- Best practice: ${summary.bestPracticeFindings ?? 0}\n- HTTP: ${summary.httpStatus ?? '—'}\n- Notes: ${notes}`;
      });

      const parts = [`## ${heading}`];
      if (overview) parts.push(overview);
      parts.push(...pageSections);
      return parts.join('\n\n');
    })
    .filter(Boolean);

  return sections.join('\n\n');
};

const SCHEMA_MARKDOWN_RENDERERS = {
  'internal-links': renderInternalLinksGroupMarkdown,
  interactive: renderInteractiveGroupMarkdown,
  availability: renderAvailabilityGroupMarkdown,
  http: renderHttpGroupMarkdown,
  performance: renderPerformanceGroupMarkdown,
  visual: renderVisualGroupMarkdown,
  wcag: renderAccessibilityGroupMarkdown,
  'responsive-structure': renderResponsiveStructureGroupMarkdown,
  'wp-features': renderResponsiveWpGroupMarkdown,
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

const buildSuitePanels = (schemaGroups, summaryMap) => {
  const groupsByType = new Map();
  schemaGroups.forEach((group) => {
    const type = summaryTypeFromGroup(group);
    if (!type) return;
    if (!groupsByType.has(type)) groupsByType.set(type, []);
    groupsByType.get(type).push(group);
  });

  const baseNamesUsed = new Set();
  const panels = [];

  for (const definition of SUITE_PANEL_DEFINITIONS) {
    const groups = groupsByType.get(definition.summaryType);
    if (!groups || groups.length === 0) continue;

    const specNames = new Set();
    const filteredGroups = definition.summaryType === 'wcag'
      ? groups.filter((group) => {
          const runEntries = group.runEntries || [];
          if (runEntries.length === 0) return false;
          return runEntries.some((entry) => (entry.payload?.metadata?.scope || '') !== 'run');
        })
      : groups;

    if (filteredGroups.length === 0) continue;

    const groupHtml = filteredGroups
      .map((group) => {
        if (group?.baseName) baseNamesUsed.add(group.baseName);
        (group.runEntries || []).forEach((entry) => {
          const specId = entry.payload?.metadata?.spec;
          if (specId) {
            specNames.add(`${specId}.spec.js`);
          }
        });
        return renderSchemaGroup(group);
      })
      .join('\n');

    if (!groupHtml.trim()) continue;

    const summaryPayload = summaryMap.get(definition.summaryType);
    if (summaryPayload?.metadata?.spec) {
      specNames.add(`${summaryPayload.metadata.spec}.spec.js`);
    }
    const metrics = summaryPayload ? deriveSuiteMetrics([summaryPayload]) : null;
    const status = panelStatusFromMetrics(metrics);
    const statusMeta = PANEL_STATUS_META[status] || PANEL_STATUS_META.info;
    const specList = Array.from(specNames).sort();
    const specLabelSuffix = specList.length ? ` - ${specList.join(', ')}` : '';
    const specLabel = `${definition.specLabel}${specLabelSuffix}`;

    panels.push({
      id: definition.id,
      navGroup: definition.navGroup,
      label: definition.navLabel,
      specLabel,
      title: definition.title,
      description: definition.description,
      status,
      statusMeta,
      content: `
        <header class="panel-header">
          <div class="panel-info">
            <span class="spec-label">${escapeHtml(specLabel)}</span>
            <h2>${escapeHtml(definition.title)}</h2>
            ${
              definition.description
                ? `<p class="panel-description">${escapeHtml(definition.description)}</p>`
                : ''
            }
          </div>
          <span class="spec-status ${statusMeta.specClass}">${escapeHtml(statusMeta.label)}</span>
        </header>
        <div class="panel-body">
          ${groupHtml}
        </div>
      `,
    });
  }

  return { panels, baseNamesUsed };
};

const buildPanelToggleStyles = (panels) =>
  panels
    .map((panel) => {
      const highlight = (() => {
        switch (panel.status) {
          case 'fail':
            return `  background: rgba(220, 38, 38, 0.28);\n  color: #101828;`;
          case 'pass':
            return `  background: rgba(16, 185, 129, 0.24);\n  color: #101828;`;
          case 'warn':
            return `  background: rgba(234, 179, 8, 0.24);\n  color: #101828;`;
          case 'info':
          default:
            return '';
        }
      })();

      const highlightBlock = highlight ? `${highlight}\n` : '';

      return `
#view-${panel.id}:checked ~ .report-shell .report-content [data-view="view-${panel.id}"] {
  display: grid;
}
#view-${panel.id}:checked ~ .report-shell .sidebar label[for="view-${panel.id}"] {
  box-shadow:
    0 0 0 2px rgba(37, 99, 235, 0.18),
    0 12px 28px rgba(30, 64, 175, 0.18);
  outline: 1px solid rgba(37, 99, 235, 0.25);
  outline-offset: -1px;
  transform: none;
${highlightBlock}}
`;
    })
    .join('\n');

const renderSidebar = (panels, run, summaryMap) => {
  const siteName = (() => {
    if (run?.site?.name) return run.site.name;
    if (run?.site?.baseUrl) return run.site.baseUrl;
    if (run?.title) return run.title;
    return 'Playwright Test Run';
  })();

  const pagesTested = resolvePagesTested(summaryMap);

  const metadataItems = [
    run?.runId ? { label: 'Run ID', value: run.runId } : null,
    run?.durationFriendly ? { label: 'Duration', value: run.durationFriendly } : null,
    pagesTested != null ? { label: 'Pages tested', value: formatCount(pagesTested) } : null,
  ].filter(Boolean);

  const metadataHtml = metadataItems
    .map(
      (item) => `
        <div>
          <dt>${escapeHtml(item.label)}</dt>
          <dd>${escapeHtml(item.value)}</dd>
        </div>
      `
    )
    .join('\n');

  const groups = new Map();
  const order = [];
  panels.forEach((panel) => {
    const key = panel.navGroup || '__summary__';
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key).push(panel);
  });

  const navSections = order
    .map((key) => {
      const entries = groups.get(key);
      const heading = key === '__summary__' ? '' : `<p class="group-title">${escapeHtml(key)}</p>`;
      const items = entries
        .map((panel) => {
          const statusMeta =
            panel.statusMeta || PANEL_STATUS_META[panel.status] || PANEL_STATUS_META.info;
          return `
            <label class="nav-item ${escapeHtml(statusMeta.navClass || '')}" for="view-${panel.id}">
              <span class="nav-item__header">
                <span class="nav-name">${escapeHtml(panel.label)}</span>
                <span class="nav-status${statusMeta.navClass ? ` ${escapeHtml(statusMeta.navClass)}` : ''}">${escapeHtml(statusMeta.label)}</span>
              </span>
            </label>
          `;
        })
        .join('\n');
      return `<div class="sidebar-group">${heading}${items}</div>`;
    })
    .join('\n');

  return `
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>${escapeHtml(siteName)}</h1>
        ${metadataHtml ? `<dl class="metadata">${metadataHtml}</dl>` : ''}
      </div>
      <nav class="sidebar-nav">
        ${navSections}
      </nav>
    </aside>
  `;
};

const renderFormsPageCard = (summary) => {
  if (!summary) return '';
  const gating = summary.gatingIssues || [];
  const advisories = summary.advisories || [];
  const fields = summary.fields || [];
  const selector = summary.selectorUsed || summary.selector || 'n/a';
  const formName = summary.formName || 'Form';
  const gatingList = gating
    .map((item) => `<li class="check-fail">${escapeHtml(String(item))}</li>`)
    .join('');
  const advisoryList = advisories.map((item) => `<li>${escapeHtml(String(item))}</li>`).join('');
  const fieldRows = fields
    .map((field) => {
      const name = field.name || 'Field';
      const accessible = field.accessibleName || 'no accessible name';
      const required = field.required ? 'Yes' : 'No';
      const issues =
        Array.isArray(field.issues) && field.issues.length
          ? `<ul class="details">${field.issues.map((issue) => `<li>${escapeHtml(String(issue))}</li>`).join('')}</ul>`
          : '<p class="details">No issues detected.</p>';
      return `
        <details>
          <summary><code>${escapeHtml(name)}</code> — ${escapeHtml(accessible)}</summary>
          <p class="details">Required: ${required}</p>
          ${issues}
        </details>
      `;
    })
    .join('');

  const statusClass = gating.length ? 'error' : 'success';

  return `
    <section class="summary-report summary-a11y page-card">
      <div class="page-card__header">
        <h3>${escapeHtml(formName)} — ${escapeHtml(summary.page || 'n/a')}</h3>
        <span class="status-pill ${statusClass}">
          ${gating.length ? `${gating.length} gating issue(s)` : 'Pass'}
        </span>
      </div>
      <p class="details">Form selector: <code>${escapeHtml(selector)}</code></p>
      ${gating.length ? `<ul class="details">${gatingList}</ul>` : ''}
      ${advisories.length ? `<details><summary>Advisories (${advisories.length})</summary><ul class="details">${advisoryList}</ul></details>` : ''}
      ${fieldRows}
    </section>
  `;
};

const renderKeyboardPageCard = (summary) => {
  if (!summary) return '';
  const gating = summary.gatingIssues || [];
  const advisories = summary.advisories || [];
  const focusSequence = summary.focusSequence || [];
  const statusClass = gating.length ? 'error' : 'success';
  const gatingList = gating
    .map((item) => `<li class="check-fail">${escapeHtml(String(item))}</li>`)
    .join('');
  const advisoryList = advisories.map((item) => `<li>${escapeHtml(String(item))}</li>`).join('');
  const sequenceItems = focusSequence
    .map((entry, index) => {
      const summaryText = entry.summary || `Stop ${index + 1}`;
      const indicatorLabel = entry.hasIndicator
        ? 'Focus indicator detected'
        : 'No focus indicator found';
      return `
        <li>
          <strong>Step ${index + 1}</strong>: ${escapeHtml(summaryText)} — ${indicatorLabel}
        </li>
      `;
    })
    .join('');

  const skipLink = summary.skipLink;
  const skipStatus = skipLink
    ? `present (${escapeHtml(skipLink.text || skipLink.href || 'skip link')})`
    : 'not detected';

  return `
    <section class="summary-report summary-a11y page-card">
      <div class="page-card__header">
        <h3>${escapeHtml(summary.page || 'unknown')}</h3>
        <span class="status-pill ${statusClass}">
          ${gating.length ? `${gating.length} gating issue(s)` : 'Pass'}
        </span>
      </div>
      <p class="details">Focusable elements detected: ${summary.focusableCount ?? 'n/a'}</p>
      <p class="details">Visited via keyboard: ${summary.visitedCount ?? 'n/a'}</p>
      <p class="details">Skip link ${skipStatus}.</p>
      ${gating.length ? `<ul class="details">${gatingList}</ul>` : ''}
      ${advisories.length ? `<details><summary>Advisories (${advisories.length})</summary><ul class="details">${advisoryList}</ul></details>` : ''}
      ${
        sequenceItems
          ? `<details><summary>Focus sequence (${focusSequence.length} stops)</summary><ul class="details">${sequenceItems}</ul></details>`
          : ''
      }
    </section>
  `;
};

const renderKeyboardGroupHtml = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pagesData = runPayload?.details?.pages || [];
    const overview = runPayload?.overview || {};
    const metrics = [
      { label: 'Pages audited', value: overview.totalPagesAudited ?? pagesData.length },
      {
        label: 'Pages with gating issues',
        value:
          overview.pagesWithGatingIssues ??
          pagesData.filter((page) => (page.gating || []).length > 0).length,
      },
      {
        label: 'Pages with advisories',
        value:
          overview.pagesWithAdvisories ??
          pagesData.filter((page) => (page.advisories || []).length > 0).length,
      },
      {
        label: 'Skip links detected',
        value:
          overview.skipLinksDetected ?? pagesData.filter((page) => Boolean(page.skipLink)).length,
      },
      {
        label: 'Total focus stops sampled',
        value: pagesData.reduce((sum, page) => sum + (page.visitedCount || 0), 0),
      },
    ];
    const overviewHtml = renderSummaryMetrics(metrics);
    const wcagRefs = runPayload?.details?.wcagReferences || [];
    const wcagBadges = wcagRefs
      .map((ref) => `<span class="badge badge-wcag">${escapeHtml(`${ref.id} ${ref.name}`)}</span>`)
      .join(' ');

    const tableRows = pagesData
      .map((page) => {
        const skipStatus = page.skipLink
          ? `Present (${escapeHtml(page.skipLink.text || page.skipLink.href || 'skip link')})`
          : 'Missing';
        return `
          <tr class="${(page.gating || []).length ? 'impact-critical' : ''}">
            <td><code>${escapeHtml(page.page || 'unknown')}</code></td>
            <td>${page.focusableCount ?? 'n/a'}</td>
            <td>${page.visitedCount ?? 'n/a'}</td>
            <td>${skipStatus}</td>
            <td>${(page.gating || []).length}</td>
            <td>${(page.advisories || []).length}</td>
          </tr>
        `;
      })
      .join('');

    const perPageEntries = (bucket.pageEntries || []).map((entry) => {
      const payload = entry.payload || {};
      const summary = payload.summary || {};
      return {
        ...summary,
        page: payload.page || summary.page,
      };
    });

    const accordionHtml = renderPerPageAccordion(perPageEntries, {
      heading: 'Per-page breakdown',
      summaryClass: 'summary-page--keyboard',
      renderCard: (entrySummary) => renderKeyboardPageCard(entrySummary),
      formatSummaryLabel: (entrySummary) => entrySummary?.page || 'Unknown page',
    });

    return `
      <section class="summary-report summary-a11y">
        <h2>Keyboard-only navigation summary</h2>
        <p class="details"><strong>WCAG coverage:</strong> ${wcagBadges || '—'}</p>
        ${overviewHtml}
        <table>
          <thead>
            <tr><th>Page</th><th>Focusable elements sampled</th><th>Unique focus stops</th><th>Skip link</th><th>Gating issues</th><th>Advisories</th></tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </section>
      ${accordionHtml}
    `;
  });

  const headline = escapeHtml(group.title || 'Keyboard navigation summary');
  return `
    <article class="schema-group">
      <header><h2>${headline}</h2></header>
      ${sections.join('\n')}
    </article>
  `;
};

const renderReducedMotionPageCard = (summary) => {
  if (!summary) return '';
  const gating = summary.gatingIssues || [];
  const advisories = summary.advisories || [];
  const significant = summary.significantAnimations || [];
  const statusClass = gating.length ? 'error' : 'success';
  const gatingList = gating
    .map((item) => `<li class="check-fail">${escapeHtml(String(item))}</li>`)
    .join('');
  const advisoryList = advisories.map((item) => `<li>${escapeHtml(String(item))}</li>`).join('');
  const significantList = significant
    .map((anim) => {
      const label = `${anim.name || anim.type || 'animation'} on ${anim.selector || 'element'}`;
      const duration = anim.duration != null ? `${anim.duration}ms` : 'unknown duration';
      const iterations = anim.iterations != null ? anim.iterations : 'unknown iterations';
      return `<li>${escapeHtml(label)} (${duration}, ${iterations})</li>`;
    })
    .join('');

  const respectsPreference = summary.matchesPreference ? 'Respected' : 'Violated';

  return `
    <section class="summary-report summary-a11y page-card">
      <div class="page-card__header">
        <h3>${escapeHtml(summary.page || 'unknown')}</h3>
        <span class="status-pill ${statusClass}">
          ${gating.length ? `${gating.length} gating issue(s)` : 'Pass'}
        </span>
      </div>
      <p class="details">Prefers-reduced-motion: ${respectsPreference}</p>
      <p class="details">Animations observed: ${summary.animations ? summary.animations.length : 0}; significant animations: ${significant.length}</p>
      ${gating.length ? `<ul class="details">${gatingList}</ul>` : ''}
      ${advisories.length ? `<details><summary>Advisories (${advisories.length})</summary><ul class="details">${advisoryList}</ul></details>` : ''}
      ${significant.length ? `<details><summary>Significant animations</summary><ul class="details">${significantList}</ul></details>` : ''}
    </section>
  `;
};

const renderReducedMotionGroupHtml = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pagesData = runPayload?.details?.pages || [];
    const overview = runPayload?.overview || {};
    const metrics = [
      { label: 'Pages audited', value: overview.totalPagesAudited ?? pagesData.length },
      {
        label: 'Pages respecting preference',
        value:
          overview.pagesRespectingPreference ??
          pagesData.filter((page) => page.matchesPreference).length,
      },
      {
        label: 'Pages with gating issues',
        value:
          overview.pagesWithGatingIssues ??
          pagesData.filter((page) => (page.gating || []).length > 0).length,
      },
      {
        label: 'Pages with advisories',
        value:
          overview.pagesWithAdvisories ??
          pagesData.filter((page) => (page.advisories || []).length > 0).length,
      },
      {
        label: 'Significant animations',
        value:
          overview.totalSignificantAnimations ??
          pagesData.reduce((sum, page) => sum + (page.significantAnimations || []).length, 0),
      },
    ];
    const overviewHtml = renderSummaryMetrics(metrics);
    const wcagRefs = runPayload?.details?.wcagReferences || [];
    const wcagBadges = wcagRefs
      .map((ref) => `<span class="badge badge-wcag">${escapeHtml(`${ref.id} ${ref.name}`)}</span>`)
      .join(' ');

    const tableRows = pagesData
      .map(
        (page) => `
          <tr class="${(page.gating || []).length ? 'impact-critical' : ''}">
            <td><code>${escapeHtml(page.page || 'unknown')}</code></td>
            <td>${page.animations ? page.animations.length : 0}</td>
            <td>${page.significantAnimations ? page.significantAnimations.length : 0}</td>
            <td>${page.matchesPreference ? 'Yes' : 'No'}</td>
            <td>${(page.gating || []).length}</td>
            <td>${(page.advisories || []).length}</td>
          </tr>
        `
      )
      .join('');

    const perPageEntries = (bucket.pageEntries || []).map((entry) => {
      const payload = entry.payload || {};
      const summary = payload.summary || {};
      return {
        ...summary,
        page: payload.page || summary.page,
      };
    });

    const accordionHtml = renderPerPageAccordion(perPageEntries, {
      heading: 'Per-page reduced-motion findings',
      summaryClass: 'summary-page--reduced-motion',
      renderCard: (entrySummary) => renderReducedMotionPageCard(entrySummary),
      formatSummaryLabel: (entrySummary) => entrySummary?.page || 'Unknown page',
    });

    return `
      <section class="summary-report summary-a11y">
        <h2>Reduced motion preference summary</h2>
        <p class="details"><strong>WCAG coverage:</strong> ${wcagBadges || '—'}</p>
        ${overviewHtml}
        <table>
          <thead>
            <tr><th>Page</th><th>Running animations</th><th>Significant animations</th><th>Prefers-reduced respected</th><th>Gating issues</th><th>Advisories</th></tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </section>
      ${accordionHtml}
    `;
  });

  const headline = escapeHtml(group.title || 'Reduced motion preference summary');
  return `
    <article class="schema-group">
      <header><h2>${headline}</h2></header>
      ${sections.join('\n')}
    </article>
  `;
};

const renderReflowPageCard = (summary) => {
  if (!summary) return '';
  const gating = summary.gatingIssues || [];
  const advisories = summary.advisories || [];
  const overflowSources = summary.overflowSources || [];
  const statusClass = gating.length ? 'error' : 'success';
  const gatingList = gating
    .map((item) => `<li class="check-fail">${escapeHtml(String(item))}</li>`)
    .join('');
  const advisoryList = advisories.map((item) => `<li>${escapeHtml(String(item))}</li>`).join('');
  const offenderList = overflowSources
    .map((offender) => {
      const label = `${offender.tag || 'element'}${offender.id ? `#${offender.id}` : ''}${
        offender.className ? `.${offender.className}` : ''
      }`;
      const text = offender.text ? ` — ${offender.text}` : '';
      return `<li>${escapeHtml(`${label} extends viewport (L ${offender.rectLeft}px / R ${offender.rectRight}px)${text}`)}</li>`;
    })
    .join('');

  return `
    <section class="summary-report summary-a11y page-card">
      <div class="page-card__header">
        <h3>${escapeHtml(summary.page || 'unknown')}</h3>
        <span class="status-pill ${statusClass}">
          ${gating.length ? `${gating.length} gating issue(s)` : 'Pass'}
        </span>
      </div>
      <p class="details">Viewport width: ${summary.viewportWidth ?? 'n/a'}px; document width: ${summary.documentWidth ?? 'n/a'}px</p>
      <p class="details">Horizontal overflow: ${summary.horizontalOverflowPx ?? 0}px</p>
      ${gating.length ? `<ul class="details">${gatingList}</ul>` : ''}
      ${advisories.length ? `<details><summary>Advisories (${advisories.length})</summary><ul class="details">${advisoryList}</ul></details>` : ''}
      ${overflowSources.length ? `<details><summary>Potential overflow sources</summary><ul class="details">${offenderList}</ul></details>` : ''}
    </section>
  `;
};

const renderReflowGroupHtml = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pagesData = runPayload?.details?.pages || [];
    const overview = runPayload?.overview || {};
    const metrics = [
      { label: 'Pages audited', value: overview.totalPagesAudited ?? pagesData.length },
      {
        label: 'Pages with overflow',
        value:
          overview.pagesWithOverflow ??
          pagesData.filter((page) => (page.gating || []).length > 0).length,
      },
      {
        label: 'Pages with advisories',
        value:
          overview.pagesWithAdvisories ??
          pagesData.filter((page) => (page.advisories || []).length > 0).length,
      },
      {
        label: 'Maximum overflow (px)',
        value:
          overview.maxOverflowPx ??
          pagesData.reduce((max, page) => Math.max(max, page.horizontalOverflowPx || 0), 0),
      },
    ];
    const overviewHtml = renderSummaryMetrics(metrics);
    const wcagRefs = runPayload?.details?.wcagReferences || [];
    const wcagBadges = wcagRefs
      .map((ref) => `<span class="badge badge-wcag">${escapeHtml(`${ref.id} ${ref.name}`)}</span>`)
      .join(' ');

    const tableRows = pagesData
      .map(
        (page) => `
          <tr class="${(page.gating || []).length ? 'impact-critical' : ''}">
            <td><code>${escapeHtml(page.page || 'unknown')}</code></td>
            <td>${page.viewportWidth ?? 'n/a'}px</td>
            <td>${page.documentWidth ?? 'n/a'}px</td>
            <td>${page.horizontalOverflowPx ?? 0}px</td>
            <td>${(page.gating || []).length}</td>
            <td>${(page.advisories || []).length}</td>
          </tr>
        `
      )
      .join('');

    const perPageEntries = (bucket.pageEntries || []).map((entry) => {
      const payload = entry.payload || {};
      const summary = payload.summary || {};
      return {
        ...summary,
        page: payload.page || summary.page,
      };
    });

    const accordionHtml = renderPerPageAccordion(perPageEntries, {
      heading: 'Per-page reflow findings',
      summaryClass: 'summary-page--reflow',
      renderCard: (entrySummary) => renderReflowPageCard(entrySummary),
      formatSummaryLabel: (entrySummary) => entrySummary?.page || 'Unknown page',
    });

    return `
      <section class="summary-report summary-a11y">
        <h2>320px reflow summary</h2>
        <p class="details"><strong>WCAG coverage:</strong> ${wcagBadges || '—'}</p>
        ${overviewHtml}
        <table>
          <thead>
            <tr><th>Page</th><th>Viewport width</th><th>Document width</th><th>Horizontal overflow</th><th>Gating issues</th><th>Advisories</th></tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </section>
      ${accordionHtml}
    `;
  });

  const headline = escapeHtml(group.title || '320px reflow summary');
  return `
    <article class="schema-group">
      <header><h2>${headline}</h2></header>
      ${sections.join('\n')}
    </article>
  `;
};

const renderIframePageCard = (summary) => {
  if (!summary) return '';
  const gating = summary.gatingIssues || [];
  const advisories = summary.advisories || [];
  const frames = summary.frames || [];
  const statusClass = gating.length ? 'error' : 'success';
  const gatingList = gating
    .map((item) => `<li class="check-fail">${escapeHtml(String(item))}</li>`)
    .join('');
  const advisoryList = advisories.map((item) => `<li>${escapeHtml(String(item))}</li>`).join('');
  const frameList = frames
    .map((frame) => {
      const label = frame.title || frame.ariaLabel || frame.name || 'no accessible label';
      const originLabel = frame.crossOrigin ? 'cross-origin' : 'same-origin';
      const location = frame.resolvedUrl || frame.src || `#${frame.index}`;
      return `<li>${escapeHtml(`${originLabel} iframe → ${location} (Accessible label: ${label})`)}</li>`;
    })
    .join('');

  return `
    <section class="summary-report summary-a11y page-card">
      <div class="page-card__header">
        <h3>${escapeHtml(summary.page || 'unknown')}</h3>
        <span class="status-pill ${statusClass}">
          ${gating.length ? `${gating.length} gating issue(s)` : 'Pass'}
        </span>
      </div>
      <p class="details">Iframe count: ${summary.iframeCount ?? frames.length}</p>
      ${gating.length ? `<ul class="details">${gatingList}</ul>` : ''}
      ${advisories.length ? `<details><summary>Advisories (${advisories.length})</summary><ul class="details">${advisoryList}</ul></details>` : ''}
      ${frames.length ? `<details><summary>Iframe inventory</summary><ul class="details">${frameList}</ul></details>` : ''}
    </section>
  `;
};

const renderIframeGroupHtml = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pagesData = runPayload?.details?.pages || [];
    const overview = runPayload?.overview || {};
    const metrics = [
      { label: 'Pages audited', value: overview.totalPagesAudited ?? pagesData.length },
      {
        label: 'Total iframes detected',
        value:
          overview.totalIframesDetected ??
          pagesData.reduce((sum, page) => sum + (page.frames || []).length, 0),
      },
      {
        label: 'Pages with gating issues',
        value:
          overview.pagesWithMissingLabels ??
          pagesData.filter((page) => (page.gating || []).length > 0).length,
      },
      {
        label: 'Pages with advisories',
        value:
          overview.pagesWithAdvisories ??
          pagesData.filter((page) => (page.advisories || []).length > 0).length,
      },
    ];
    const overviewHtml = renderSummaryMetrics(metrics);
    const wcagRefs = runPayload?.details?.wcagReferences || [];
    const wcagBadges = wcagRefs
      .map((ref) => `<span class="badge badge-wcag">${escapeHtml(`${ref.id} ${ref.name}`)}</span>`)
      .join(' ');

    const tableRows = pagesData
      .map(
        (page) => `
          <tr class="${(page.gating || []).length ? 'impact-critical' : ''}">
            <td><code>${escapeHtml(page.page || 'unknown')}</code></td>
            <td>${page.iframeCount ?? (page.frames || []).length}</td>
            <td>${(page.gating || []).length}</td>
            <td>${(page.advisories || []).length}</td>
          </tr>
        `
      )
      .join('');

    const perPageEntries = (bucket.pageEntries || []).map((entry) => {
      const payload = entry.payload || {};
      const summary = payload.summary || {};
      return {
        ...summary,
        page: payload.page || summary.page,
      };
    });

    const accordionHtml = renderPerPageAccordion(perPageEntries, {
      heading: 'Per-page iframe findings',
      summaryClass: 'summary-page--iframe',
      renderCard: (entrySummary) => renderIframePageCard(entrySummary),
      formatSummaryLabel: (entrySummary) => entrySummary?.page || 'Unknown page',
    });

    return `
      <section class="summary-report summary-a11y">
        <h2>Iframe accessibility summary</h2>
        <p class="details"><strong>WCAG coverage:</strong> ${wcagBadges || '—'}</p>
        ${overviewHtml}
        <table>
          <thead>
            <tr><th>Page</th><th>Iframe count</th><th>Gating issues</th><th>Advisories</th></tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </section>
      ${accordionHtml}
    `;
  });

  const headline = escapeHtml(group.title || 'Iframe accessibility summary');
  return `
    <article class="schema-group">
      <header><h2>${headline}</h2></header>
      ${sections.join('\n')}
    </article>
  `;
};

const renderStructurePageCard = (summary) => {
  if (!summary) return '';
  const gating = summary.gatingIssues || [];
  const advisories = summary.advisories || [];
  const headingSkips = summary.headingSkips || [];
  const headingOutline = summary.headingOutline || [];
  const statusClass = gating.length ? 'error' : 'success';
  const gatingList = gating
    .map((item) => `<li class="check-fail">${escapeHtml(String(item))}</li>`)
    .join('');
  const advisoryList = advisories.map((item) => `<li>${escapeHtml(String(item))}</li>`).join('');
  const headingSkipList = headingSkips
    .map((item) => `<li>${escapeHtml(String(item))}</li>`)
    .join('');
  const headingOutlineList = headingOutline
    .map(
      (entry) =>
        `<li><code>${escapeHtml(entry.text || 'Untitled heading')}</code> (H${entry.level ?? '?'})</li>`
    )
    .join('');

  return `
    <section class="summary-report summary-a11y page-card">
      <div class="page-card__header">
        <h3>${escapeHtml(summary.page || 'unknown')}</h3>
        <span class="status-pill ${statusClass}">
          ${gating.length ? `${gating.length} gating issue(s)` : 'Pass'}
        </span>
      </div>
      <p class="details">H1 count: ${summary.h1Count ?? 'n/a'}</p>
      <ul class="details">
        <li>Main landmark: ${summary.hasMainLandmark ? 'present' : 'missing'}</li>
        <li>Navigation landmarks: ${summary.navigationLandmarks ?? 0}</li>
        <li>Header landmarks: ${summary.headerLandmarks ?? 0}</li>
        <li>Footer landmarks: ${summary.footerLandmarks ?? 0}</li>
      </ul>
      ${gating.length ? `<ul class="details">${gatingList}</ul>` : ''}
      ${advisories.length ? `<details><summary>Advisories (${advisories.length})</summary><ul class="details">${advisoryList}</ul></details>` : ''}
      ${headingSkips.length ? `<details><summary>Heading level skips</summary><ul class="details">${headingSkipList}</ul></details>` : ''}
      ${headingOutline.length ? `<details><summary>Heading outline (${headingOutline.length} headings)</summary><ul class="details">${headingOutlineList}</ul></details>` : ''}
    </section>
  `;
};

const renderResponsiveStructureGroupHtml = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pages = Array.isArray(runPayload?.details?.pages) ? runPayload.details.pages : [];
    const overview = runPayload?.overview || {};
    const overviewMetrics = [
      { label: 'Pages audited', value: overview.totalPages ?? pages.length },
      { label: 'Load budget breaches', value: overview.loadBudgetBreaches ?? 0 },
      { label: 'Pages with errors', value: overview.pagesWithErrors ?? 0 },
      { label: 'Header missing', value: overview.headerMissing ?? 0 },
      { label: 'Navigation missing', value: overview.navigationMissing ?? 0 },
      { label: 'Content missing', value: overview.contentMissing ?? 0 },
      { label: 'Footer missing', value: overview.footerMissing ?? 0 },
    ];
    const overviewHtml = renderSummaryMetrics(overviewMetrics);

    const boolCell = (value) => (value ? '✅' : '⚠️');
    const listCell = (items = []) =>
      items.length
        ? `<ul class="checks">${items
            .map((item) => `<li class="check-fail">${escapeHtml(String(item))}</li>`)
            .join('')}</ul>`
        : '<span class="details">None</span>';
    const infoCell = (items = []) =>
      items.length
        ? `<ul class="checks">${items
            .map((item) => `<li class="check-pass">${escapeHtml(String(item))}</li>`)
            .join('')}</ul>`
        : '<span class="details">None</span>';

    const rows = pages
      .map((page) => {
        return `
          <tr class="${(page.gatingIssues || []).length ? 'status-error' : 'status-ok'}">
            <td><code>${escapeHtml(page.page || 'unknown')}</code></td>
            <td>${page.loadTimeMs != null ? Math.round(page.loadTimeMs) : '—'}</td>
            <td>${page.thresholdMs != null ? Math.round(page.thresholdMs) : '—'}</td>
            <td>${boolCell(page.headerPresent)}</td>
            <td>${boolCell(page.navigationPresent)}</td>
            <td>${boolCell(page.contentPresent)}</td>
            <td>${boolCell(page.footerPresent)}</td>
            <td>${listCell(page.gatingIssues)}</td>
            <td>${listCell(page.warnings)}</td>
            <td>${infoCell(page.info)}</td>
          </tr>
        `;
      })
      .join('');

    const tableHtml = rows
      ? `
          <table>
            <thead><tr><th>Page</th><th>Load (ms)</th><th>Threshold</th><th>Header</th><th>Navigation</th><th>Content</th><th>Footer</th><th>Gating issues</th><th>Warnings</th><th>Info</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        `
      : '<p>No responsive structure data recorded.</p>';

    return `
      <section class="summary-report summary-infrastructure">
        <h3>${escapeHtml(bucket.projectName || runPayload?.metadata?.projectName || 'Responsive structure')}</h3>
        ${overviewHtml}
        ${tableHtml}
      </section>
    `;
  });

  const headline = escapeHtml(group.title || 'Responsive structure summary');
  return `
    <article class="schema-group">
      <header><h2>${headline}</h2></header>
      ${sections.join('\n')}
    </article>
  `;
};

const renderResponsiveWpGroupHtml = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pages = Array.isArray(runPayload?.details?.pages) ? runPayload.details.pages : [];
    const overviewHtml = runPayload?.overview ? renderSummaryMetrics(runPayload.overview) : '';

    const rows = pages
      .map((page) => {
        const responsiveCell = page.responsiveDetected ? '✅' : '⚠️';
        const warningsCell = (page.warnings || []).length
          ? `<ul class="checks">${page.warnings
              .map((item) => `<li class="check-fail">${escapeHtml(String(item))}</li>`)
              .join('')}</ul>`
          : '<span class="details">None</span>';
        const infoCell = (page.info || []).length
          ? `<ul class="checks">${page.info
              .map((item) => `<li class="check-pass">${escapeHtml(String(item))}</li>`)
              .join('')}</ul>`
          : '<span class="details">None</span>';
        const errorsCell = (page.errors || []).length
          ? `<ul class="checks">${page.errors
              .map((item) => `<li class="check-fail">${escapeHtml(String(item))}</li>`)
              .join('')}</ul>`
          : '<span class="details">None</span>';
        return `
          <tr class="${responsiveCell === '✅' ? 'status-ok' : 'status-warning'}">
            <td>${escapeHtml(page.viewport || bucket.projectName || 'viewport')}</td>
            <td>${responsiveCell}</td>
            <td>${page.blockElements ?? 0}</td>
            <td>${page.widgets ?? 0}</td>
            <td>${warningsCell}</td>
            <td>${infoCell}</td>
            <td>${errorsCell}</td>
          </tr>
        `;
      })
      .join('');

    const tableHtml = rows
      ? `
          <table>
            <thead><tr><th>Viewport</th><th>Responsive elems</th><th>Block elements</th><th>Widgets</th><th>Warnings</th><th>Info</th><th>Errors</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        `
      : '<p>No WordPress responsive data captured.</p>';

    return `
      <section class="summary-report summary-infrastructure">
        <h3>${escapeHtml(runPayload?.metadata?.projectName || bucket.projectName || 'WordPress responsive features')}</h3>
        ${overviewHtml}
        ${tableHtml}
      </section>
    `;
  });

  const headline = escapeHtml(group.title || 'WordPress responsive features summary');
  return `
    <article class="schema-group">
      <header><h2>${headline}</h2></header>
      ${sections.join('\n')}
    </article>
  `;
};

const renderStructureGroupHtml = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const pagesData = runPayload?.details?.pages || [];
    const overview = runPayload?.overview || {};
    const metrics = [
      { label: 'Pages audited', value: overview.totalPagesAudited ?? pagesData.length },
      {
        label: 'Pages missing main landmark',
        value:
          overview.pagesMissingMain ?? pagesData.filter((page) => !page.hasMainLandmark).length,
      },
      {
        label: 'Pages with heading skips',
        value:
          overview.pagesWithHeadingSkips ??
          pagesData.filter((page) => (page.headingSkips || []).length > 0).length,
      },
      {
        label: 'Pages with gating issues',
        value:
          overview.pagesWithGatingIssues ??
          pagesData.filter((page) => (page.gating || []).length > 0).length,
      },
      {
        label: 'Pages with advisories',
        value:
          overview.pagesWithAdvisories ??
          pagesData.filter((page) => (page.advisories || []).length > 0).length,
      },
    ];
    const overviewHtml = renderSummaryMetrics(metrics);
    const wcagRefs = runPayload?.details?.wcagReferences || [];
    const wcagBadges = wcagRefs
      .map((ref) => `<span class="badge badge-wcag">${escapeHtml(`${ref.id} ${ref.name}`)}</span>`)
      .join(' ');

    const tableRows = pagesData
      .map(
        (page) => `
          <tr class="${(page.gating || []).length ? 'impact-critical' : ''}">
            <td><code>${escapeHtml(page.page || 'unknown')}</code></td>
            <td>${page.h1Count ?? 0}</td>
            <td>${page.hasMainLandmark ? 'Yes' : 'No'}</td>
            <td>${(page.headingSkips || []).length}</td>
            <td>${(page.gating || []).length}</td>
            <td>${(page.advisories || []).length}</td>
          </tr>
        `
      )
      .join('');

    const perPageEntries = (bucket.pageEntries || []).map((entry) => {
      const payload = entry.payload || {};
      const summary = payload.summary || {};
      return {
        ...summary,
        page: payload.page || summary.page,
      };
    });

    const accordionHtml = renderPerPageAccordion(perPageEntries, {
      heading: 'Per-page structure findings',
      summaryClass: 'summary-page--structure',
      renderCard: (entrySummary) => renderStructurePageCard(entrySummary),
      formatSummaryLabel: (entrySummary) => entrySummary?.page || 'Unknown page',
    });

    return `
      <section class="summary-report summary-a11y">
        <h2>Landmark & heading structure summary</h2>
        <p class="details"><strong>WCAG coverage:</strong> ${wcagBadges || '—'}</p>
        ${overviewHtml}
        <table>
          <thead>
            <tr><th>Page</th><th>H1 count</th><th>Main landmark</th><th>Heading skips</th><th>Gating issues</th><th>Advisories</th></tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </section>
      ${accordionHtml}
    `;
  });

  const headline = escapeHtml(group.title || 'Landmark & heading structure summary');
  return `
    <article class="schema-group">
      <header><h2>${headline}</h2></header>
      ${sections.join('\n')}
    </article>
  `;
};
const renderFormsGroupHtml = (group) => {
  const buckets = collectSchemaProjects(group);
  if (buckets.length === 0) return '';

  const sections = buckets.map((bucket) => {
    const runPayload = firstRunPayload(bucket);
    const formsData = (runPayload?.details?.forms || []).map((form) => ({
      formName: form.formName || 'Form',
      page: form.page || 'Unknown',
      selectorUsed: form.selectorUsed || 'n/a',
      gating: form.gating || [],
      advisories: form.advisories || [],
      fields: form.fields || [],
    }));
    const overviewMetrics = Array.isArray(formsData)
      ? [
          { label: 'Forms audited', value: formsData.length },
          {
            label: 'Forms with gating issues',
            value: formsData.filter((form) => form.gating.length > 0).length,
          },
          {
            label: 'Forms with advisories',
            value: formsData.filter((form) => form.advisories.length > 0).length,
          },
          {
            label: 'Fields reviewed',
            value: formsData.reduce((sum, form) => sum + form.fields.length, 0),
          },
          {
            label: 'Total gating findings',
            value: formsData.reduce((sum, form) => sum + form.gating.length, 0),
          },
          {
            label: 'Total advisory findings',
            value: formsData.reduce((sum, form) => sum + form.advisories.length, 0),
          },
        ]
      : [];

    const overviewHtml = renderSummaryMetrics(overviewMetrics);
    const wcagRefs = runPayload?.details?.wcagReferences || [];
    const wcagBadges = wcagRefs
      .map((ref) => `<span class="badge badge-wcag">${escapeHtml(`${ref.id} ${ref.name}`)}</span>`)
      .join(' ');

    const tableRows = formsData
      .map(
        (form) => `
          <tr class="${form.gating.length ? 'impact-critical' : ''}">
            <td>${escapeHtml(form.formName)}</td>
            <td><code>${escapeHtml(form.page)}</code></td>
            <td>${form.gating.length}</td>
            <td>${form.advisories.length}</td>
          </tr>
        `
      )
      .join('');

    const perPageEntries = (bucket.pageEntries || []).map((entry) => {
      const payload = entry.payload || {};
      const summary = payload.summary || {};
      return {
        ...summary,
        page: payload.page || summary.page,
      };
    });

    const accordionHtml = renderPerPageAccordion(perPageEntries, {
      heading: 'Per-form breakdown',
      summaryClass: 'summary-page--forms',
      renderCard: (entrySummary) => renderFormsPageCard(entrySummary),
      formatSummaryLabel: (entrySummary) => {
        const formName = entrySummary?.formName || 'Form';
        const page = entrySummary?.page || 'Unknown page';
        return `${formName} — ${page}`;
      },
    });

    return `
      <section class="summary-report summary-a11y">
        <h2>Forms accessibility summary</h2>
        <p class="details"><strong>WCAG coverage:</strong> ${wcagBadges || '—'}</p>
        ${overviewHtml}
        <table>
          <thead>
            <tr><th>Form</th><th>Page</th><th>Gating issues</th><th>Advisories</th></tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </section>
      ${accordionHtml}
    `;
  });

  const headline = escapeHtml(group.title || 'Forms accessibility summary');
  return `
    <article class="schema-group">
      <header><h2>${headline}</h2></header>
      ${sections.join('\n')}
    </article>
  `;
};

const renderWcagIssueTable = (entries, heading) => {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const rows = entries
    .map((entry) => {
      const impact = entry.impact || entry.category || 'info';
      const ruleId = entry.id || entry.rule || 'rule';
      const wcagTags = Array.isArray(entry.tags)
        ? entry.tags.filter((tag) => /^wcag/i.test(tag)).join(', ')
        : Array.isArray(entry.wcagTags)
          ? entry.wcagTags.join(', ')
          : '—';
      const nodes = Array.isArray(entry.nodes)
        ? entry.nodes
            .map((node) => {
              if (Array.isArray(node.target) && node.target.length > 0) {
                return `<code>${escapeHtml(String(node.target[0]))}</code>`;
              }
              return node.html ? `<code>${escapeHtml(node.html)}</code>` : null;
            })
            .filter(Boolean)
            .slice(0, 5)
            .join('<br />')
        : '—';
      const helpUrl = entry.helpUrl || entry.help || null;
      return `
        <tr class="impact-${impact.toLowerCase?.() || 'info'}">
          <td>${escapeHtml(String(impact))}</td>
          <td>${escapeHtml(String(ruleId))}</td>
          <td>${wcagTags ? escapeHtml(wcagTags) : '—'}</td>
          <td>${nodes || '—'}</td>
          <td>${helpUrl ? `<a href="${escapeHtml(helpUrl)}" target="_blank" rel="noopener noreferrer">rule docs</a>` : '—'}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <section class="summary-report summary-a11y">
      <h3>${escapeHtml(heading)}</h3>
      <table>
        <thead><tr><th>Impact</th><th>Rule</th><th>WCAG tags</th><th>Sample targets</th><th>Help</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
};

const renderWcagPageCard = (summary, { viewportLabel, failThreshold } = {}) => {
  if (!summary) return '';
  if (summary.cardHtml) return summary.cardHtml;

  const statusMeta = deriveWcagPageStatus(summary);
  const violations = Array.isArray(summary.violations) ? summary.violations : [];
  const advisories =
    Array.isArray(summary.advisoriesList) && summary.advisoriesList.length
      ? summary.advisoriesList
      : Array.isArray(summary.advisories)
        ? summary.advisories
        : [];
  const bestPractices =
    Array.isArray(summary.bestPracticesList) && summary.bestPracticesList.length
      ? summary.bestPracticesList
      : Array.isArray(summary.bestPractices)
        ? summary.bestPractices
        : [];
  const stabilityHtml = formatWcagStability(summary.stability);
  const advisoryCount = summary.advisoryFindings ?? advisories.length;
  const bestPracticeCount = summary.bestPracticeFindings ?? bestPractices.length;

  const metaLines = [
    `<p class="details"><strong>Viewport:</strong> ${escapeHtml(
      summary.projectName || viewportLabel || 'Not recorded'
    )}</p>`,
    stabilityHtml ? `<p class="details"><strong>Stability:</strong> ${stabilityHtml}</p>` : '',
    `<p class="details"><strong>Gating:</strong> ${escapeHtml(
      summary.gatingLabel || failThreshold || 'Not recorded'
    )}</p>`,
  ]
    .filter(Boolean)
    .join('\n');

  const notes = Array.isArray(summary.notes) ? summary.notes.filter(Boolean) : [];
  const notesHtml = notes.length
    ? `<details class="summary-note"><summary>Notes (${notes.length})</summary><ul class="details">${notes
        .map((note) => `<li>${escapeHtml(String(note))}</li>`)
        .join('')}</ul></details>`
    : '';

  const gatingSection = violations.length
    ? renderWcagPageIssueTable(
        violations,
        `Gating WCAG violations (${formatCount(violations.length)})`
      )
    : '<p class="details">No gating violations detected.</p>';

  const advisorySection = advisories.length
    ? renderWcagPageIssueTable(
        advisories,
        `WCAG advisory findings (${formatCount(advisories.length)})`
      )
    : '';

  const bestPracticeSection = bestPractices.length
    ? renderWcagPageIssueTable(
        bestPractices,
        `Best-practice advisories (${formatCount(bestPractices.length)})`
      )
    : '';

  return `
    <section class="summary-report summary-a11y page-card">
      <div class="page-card__header">
        <h3>${escapeHtml(summary.page || 'Unknown page')}</h3>
        <span class="status-pill ${statusMeta.pillClass}">${escapeHtml(statusMeta.pillLabel)}</span>
      </div>
      <div class="page-card__meta">
        ${metaLines}
      </div>
      ${notesHtml}
      ${gatingSection}
      ${advisorySection}
      ${bestPracticeSection}
    </section>
  `;
};

const SCHEMA_HTML_RENDERERS = {
  forms: renderFormsGroupHtml,
  keyboard: renderKeyboardGroupHtml,
  'reduced-motion': renderReducedMotionGroupHtml,
  reflow: renderReflowGroupHtml,
  'iframe-metadata': renderIframeGroupHtml,
  structure: renderStructureGroupHtml,
  'responsive-structure': renderResponsiveStructureGroupHtml,
  'internal-links': renderInternalLinksGroupHtml,
  interactive: renderInteractiveGroupHtml,
  availability: renderAvailabilityGroupHtml,
  http: renderHttpGroupHtml,
  performance: renderPerformanceGroupHtml,
  visual: renderVisualGroupHtml,
  wcag: renderAccessibilityGroupHtml,
  'wp-features': renderResponsiveWpGroupHtml,
};

const renderSchemaGroup = (group) => {
  const summaryType = summaryTypeFromGroup(group);
  if (summaryType && SCHEMA_HTML_RENDERERS[summaryType]) {
    return SCHEMA_HTML_RENDERERS[summaryType](group);
  }
  return renderSchemaGroupFallbackHtml(group);
};

const panelStatusFromMetrics = (metrics) => {
  if (!metrics) return 'info';
  if ((metrics.blocking || 0) > 0) return 'fail';
  if ((metrics.warnings || 0) + (metrics.advisories || 0) > 0) return 'warn';
  return 'pass';
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
  --bg-primary: #f4f6fb;
  --font-body: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-heading: "Work Sans", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --bg-card: #ffffff;
  --border: #d9e2ec;
  --text-strong: #1f2933;
  --text-muted: #475467;
  --accent: #3b82f6;
  --accent-soft: rgba(29, 78, 216, 0.12);
  --pill-shadow: 0 14px 32px rgba(15, 23, 42, 0.12);
  --radius-lg: 16px;
  --radius-md: 10px;
  --grid-gap: 1.5rem;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font-body);
  color: var(--text-strong);
}

h1,
h2,
h3,
h4,
.summary-card__title,
.group-title,
.panel-info h2,
.summary-report h3,
.summary-per-page-header h3,
.page-card__header h3,
.test-group__title h2,
.test-card__header h3,
.sidebar-header h1 {
  font-family: var(--font-heading);
}

.report-app {
  min-height: 100vh;
  background: linear-gradient(180deg, #eef2ff 0%, #f9fafb 100%);
  padding: 3rem clamp(1rem, 4vw, 3rem);
}

input[name="report-view"] {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.report-shell {
  display: grid;
  grid-template-columns: 280px 1fr;
  align-items: start;
  gap: clamp(1.5rem, 3vw, 3rem);
  margin: 0 auto 0 0;
}

.sidebar {
  background: rgba(255, 255, 255, 0.78);
  border-radius: var(--radius-lg);
  box-shadow: 0 24px 40px rgba(15, 23, 42, 0.12);
  padding: 1.75rem 1.5rem 2rem;
  backdrop-filter: blur(12px);
  position: sticky;
  top: 2rem;
}

.sidebar-header h1 {
  margin: 0 0 0.75rem;
  font-size: 1.8rem;
  color: var(--accent);
}

.sidebar .metadata {
  margin: 0;
  display: grid;
  gap: 0.9rem;
  padding: 0;
}

.sidebar .metadata div {
  display: grid;
  gap: 0.25rem;
}

.sidebar .metadata dt {
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(15, 23, 42, 0.5);
  font-weight: 500;
}

.sidebar .metadata dd {
  margin: 0;
  font-size: 0.95rem;
  color: var(--text-strong);
  line-height: 1.4;
}

.sidebar-nav {
  margin-top: 2.5rem;
  display: grid;
  gap: 1.5rem;
}

.sidebar-group {
  display: grid;
}

.group-title {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(15, 23, 42, 0.58);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 0.65rem 0.85rem;
  border-radius: 0;
  font-size: 0.95rem;
  color: var(--text-strong);
  background: rgba(255, 255, 255, 0.45);
  border: 1px solid rgba(29, 78, 216, 0.08);
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
  gap: 0.55rem;
  width: 100%;
}

.nav-item:hover {
  transform: translateX(2px);
  border-color: rgba(37, 99, 235, 0.25);
  box-shadow: 0 12px 22px rgba(15, 23, 42, 0.12);
}

.nav-name {
  flex: 1 1 auto;
  font-weight: 500;
}

.nav-status {
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border-radius: 999px;
  padding: 0.15rem 0.65rem;
  font-weight: 500;
  white-space: nowrap;
}

.nav-status.status-pass {
  background: rgba(16, 185, 129, 0.18);
  color: #047857;
}

.nav-status.status-fail {
  background: rgba(220, 38, 38, 0.18);
  color: #b91c1c;
}

.nav-status.status-info {
  background: rgba(14, 165, 233, 0.18);
  color: #0369a1;
}

.nav-item.status-pass {
  background: rgba(16, 185, 129, 0.08);
  border-left: 4px solid rgba(16, 185, 129, 0.35);
}

.nav-item.status-pass:hover {
  background: rgba(16, 185, 129, 0.12);
}

.nav-item.status-fail {
  background: rgba(220, 38, 38, 0.08);
  border-left: 4px solid rgba(220, 38, 38, 0.35);
}

.nav-item.status-fail:hover {
  background: rgba(220, 38, 38, 0.12);
}

.nav-item__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
}

.report-content {
  display: grid;
}

.panel {
  display: none;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--pill-shadow);
  padding: 2.4rem clamp(1.5rem, 3vw, 2.6rem);
  animation: fadeIn 0.25s ease;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid rgba(29, 78, 216, 0.08);
  padding-bottom: 1.75rem;
}

.panel-info h2 {
  margin: 0.35rem 0 0.65rem;
  font-size: clamp(1.45rem, 2vw, 1.85rem);
}

.panel-info .spec-label {
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(15, 23, 42, 0.58);
  font-weight: 500;
}

.panel-description {
  margin: 0;
  color: var(--text-muted);
  max-width: 60ch;
  font-size: 0.95rem;
}

.spec-status {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 1rem;
  border-radius: 999px;
  font-size: 0.9rem;
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.05em;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
}

.spec-status--fail {
  background: rgba(220, 38, 38, 0.18);
  color: #b91c1c;
}

.spec-status--pass {
  background: rgba(16, 185, 129, 0.2);
  color: #047857;
}

.panel-body {
  display: grid;
  gap: 1rem;
}

.panel-section {
  display: grid;
  gap: 1.2rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--grid-gap);
}

.summary-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 1.5rem 1.7rem;
  box-shadow: var(--pill-shadow);
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.05);
}

.summary-card::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(29, 78, 216, 0.08), transparent 55%);
  pointer-events: none;
}

.summary-card__title {
  width: max-content;
  display: inline-flex;
  align-items: baseline;
  gap: 0.45rem;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #0f172a;
  margin: 0 0 0.4rem;
  white-space: nowrap;
}

.summary-card__count {
  font-size: 2.6rem;
  font-weight: 500;
  color: #0f172a;
  line-height: 1;
}

.summary-card .meta {
  margin-top: 0.35rem;
  font-size: 0.9rem;
  color: #475467;
}

.suite-overview {
  display: grid;
  gap: 1.1rem;
}

.suite-overview h3 {
  margin: 0;
  font-size: 1.1rem;
}

.suite-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

.suite-card {
  border-radius: var(--radius-lg);
  padding: 1.35rem 1.45rem;
  background: #f8fafc;
  border: 1px solid rgba(15, 23, 42, 0.05);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
  display: grid;
  gap: 0.85rem;
}

.suite-card.status-pass {
  border-left: 6px solid rgba(16, 185, 129, 0.75);
}

.suite-card.status-fail {
  border-left: 6px solid rgba(220, 38, 38, 0.75);
}

.suite-card header {
  display: grid;
  gap: 0.4rem;
}

.suite-card h4 {
  margin: 0;
  font-size: 1.05rem;
}

.suite-metrics {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.35rem;
  font-size: 0.9rem;
  color: #485260;
}

.suite-metrics li {
  display: flex;
  gap: 0.35rem;
}

.suite-status {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.summary-table {
  width: 100%;
  border-collapse: collapse;
  background: #ffffff;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
}

.summary-table thead {
  background: var(--accent);
  color: white;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}

.summary-table th,
.summary-table td {
  padding: 0.9rem 1.2rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  vertical-align: top;
  font-size: 0.95rem;
}

.summary-table tbody tr:last-child td {
  border-bottom: none;
}

.schema-group {
  display: grid;
  gap: 1rem;
}

.schema-group > header h3 {
  margin: 0;
  font-size: 1.35rem;
  color: #0f172a;
}

.summary-report {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(15, 23, 42, 0.08);
  padding: 1.35rem 1.5rem;
  box-shadow: 0 18px 30px rgba(15, 23, 42, 0.12);
}

.summary-report h3 {
  margin: 0 0 0.75rem;
  font-size: 1.25rem;
  color: #0f172a;
}

.summary-report .details {
  margin: 0.4rem 0 0;
  color: var(--text-muted);
  font-size: 0.95rem;
}

.summary-report .legend {
  margin: 0.75rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.summary-report table {
  width: 100%;
  border-collapse: collapse;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  margin-top: 0.85rem;
}

.summary-report th,
.summary-report td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  text-align: left;
  vertical-align: top;
  font-size: 0.95rem;
}

.summary-report tbody tr:last-child td {
  border-bottom: none;
}

.summary-report tr.impact-critical td {
  background: rgba(220, 38, 38, 0.12);
}

.summary-report tr.impact-serious td {
  background: rgba(220, 38, 38, 0.08);
}

.summary-report tr.impact-moderate td {
  background: rgba(217, 119, 6, 0.1);
}

.summary-report tr.impact-minor td {
  background: rgba(14, 165, 233, 0.1);
}

.summary-report code {
  background: #f1f5f9;
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #0f172a;
}

.schema-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
  margin: 0;
}

.schema-metrics__item {
  background: rgba(29, 78, 216, 0.05);
  border-radius: var(--radius-md);
  padding: 0.85rem 1rem;
  display: grid;
  gap: 0.35rem;
}

.schema-metrics__item dt {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(15, 23, 42, 0.6);
}

.schema-metrics__item dd {
  margin: 0;
}

.schema-value {
  font-weight: 500;
  font-size: 1.35rem;
  color: #0f172a;
}

.status-summary {
  list-style: none;
  padding: 0;
  margin: 0.75rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1rem;
}

.status-summary li {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border: 1px solid rgba(15, 23, 42, 0.12);
}

.badge-critical {
  background: rgba(220, 38, 38, 0.14);
  color: #b42318;
}

.badge-serious {
  background: rgba(217, 119, 6, 0.16);
  color: #92400e;
}

.badge-wcag {
  background: rgba(59, 130, 246, 0.18);
  color: #3b82f6;
}

.badge-neutral {
  background: rgba(148, 163, 184, 0.16);
  color: #475467;
}

.summary-heading-best-practice {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.55rem;
  border-radius: 8px;
  background: rgba(14, 165, 233, 0.16);
  color: #0b7285;
}

.summary-toggle-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.75rem;
}

.summary-per-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.summary-per-page-header h3 {
  margin: 0;
}

.summary-toggle-button {
  border: 1px solid rgba(37, 99, 235, 0.25);
  background: rgba(29, 78, 216, 0.1);
  color: #3b82f6;
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.summary-toggle-button:hover {
  background: rgba(29, 78, 216, 0.16);
  box-shadow: 0 12px 22px rgba(30, 64, 175, 0.15);
}

.summary-toggle-button:focus-visible {
  outline: 2px solid rgba(29, 78, 216, 0.4);
  outline-offset: 2px;
}

.summary-page {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 0;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.04);
}

.summary-page > summary {
  padding: 0.5rem;
  font-weight: 400;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  color: #0f172a;
}

.summary-page > summary::-webkit-details-marker {
  display: none;
}

.summary-page[open] > summary {
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.summary-page__body {
  padding: 1rem 1.25rem 1.35rem;
  background: #f8fafc;
}

.summary-page--ok {
  border: 1px solid rgba(16, 185, 129, 0.22);
  background: rgba(16, 185, 129, 0.12);
  box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.18);
}

.summary-page--ok > summary {
  color: #065f46;
}

.summary-page--ok[open] > summary {
  border-bottom: 1px solid rgba(16, 185, 129, 0.25);
}

.summary-page--ok .summary-page__body {
  background: rgba(240, 253, 244, 0.92);
}

.summary-page--fail {
  border: 1px solid rgba(220, 38, 38, 0.22);
  background: rgba(220, 38, 38, 0.12);
  box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.18);
}

.summary-page--fail > summary {
  color: #7f1d1d;
}

.summary-page--fail[open] > summary {
  border-bottom: 1px solid rgba(220, 38, 38, 0.25);
}

.summary-page--fail .summary-page__body {
  background: rgba(254, 242, 242, 0.92);
}

.summary-page--warn {
  border: 1px solid rgba(217, 119, 6, 0.22);
  background: rgba(217, 119, 6, 0.12);
  box-shadow: inset 0 0 0 1px rgba(217, 119, 6, 0.18);
}

.summary-page--warn > summary {
  color: #78350f;
}

.summary-page--warn[open] > summary {
  border-bottom: 1px solid rgba(217, 119, 6, 0.25);
}

.summary-page--warn .summary-page__body {
  background: rgba(255, 247, 237, 0.92);
}

.page-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  margin-bottom: 0.75rem;
}

.page-card__header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.page-card__meta {
  display: grid;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
}

.page-card__meta .details {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.page-card__table {
  margin: 0.85rem 0;
}

.page-card__table table {
  width: 100%;
  border-collapse: collapse;
  background: #ffffff;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: 0 12px 22px rgba(15, 23, 42, 0.1);
}

.page-card__table th,
.page-card__table td {
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  font-size: 0.9rem;
  vertical-align: top;
}

.page-card__table tbody tr:last-child td {
  border-bottom: none;
}

.delta-threshold {
  font-weight: 500;
}

.summary-report.summary-visual .visual-previews,
.summary-report.summary-responsive .visual-previews {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-top: 0.85rem;
}

.visual-previews figure {
  margin: 0;
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  padding: 0.75rem;
  display: grid;
  gap: 0.5rem;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.08);
}

.visual-previews img {
  width: 100%;
  height: auto;
  border-radius: 6px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #f8fafc;
}

.visual-previews figcaption {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.severity-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.severity-gating {
  background: rgba(220, 38, 38, 0.12);
  color: #b91c1c;
}

.severity-fail {
  background: rgba(220, 38, 38, 0.14);
  color: #b91c1c;
}

.severity-info {
  background: rgba(14, 165, 233, 0.14);
  color: #0369a1;
}

.wcag-tag {
  display: inline-flex;
  align-items: center;
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  color: #f8fafc;
  font-weight: 500;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.25);
  letter-spacing: 0.03em;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.browser-tag {
  display: inline-flex;
  align-items: center;
  margin: 0.15rem 0.3rem 0.15rem 0;
  padding: 0.2rem 0.6rem;
  background: rgba(14, 165, 233, 0.15);
  border-radius: 999px;
  color: #0369a1;
  font-size: 0.8rem;
  font-weight: 500;
}

details.summary-accordion {
  background: #f8fafc;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
}

details.summary-accordion + details.summary-accordion {
  margin-top: 1rem;
}

details.summary-accordion summary {
  padding: 1rem 1.25rem;
  font-weight: 500;
  color: #0b7285;
  cursor: pointer;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(255, 255, 255, 0));
  outline: none;
}

details.summary-accordion[open] summary {
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.accordion-body {
  padding: 1.25rem;
  display: grid;
  gap: 1.2rem;
  background: #ffffff;
}

.page-card {
  background: #f8fafc;
  border-radius: var(--radius-md);
  padding: 1.1rem 1.3rem;
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.18);
}

.page-card header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.65rem;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.status-error {
  background: rgba(220, 38, 38, 0.14);
  color: #b91c1c;
}

.status-warning {
  background: rgba(217, 119, 6, 0.2);
  color: #92400e;
}

.status-ok {
  background: rgba(16, 185, 129, 0.16);
  color: #047857;
}

.checks {
  list-style: none;
  padding: 0;
  margin: 0;
}

.checks li {
  padding: 0.4rem 0;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  font-size: 0.95rem;
}

.checks li:last-child {
  border-bottom: none;
}

.checks li::before {
  content: "\\2716";
  color: #dc2626;
  margin-right: 0.5rem;
}

.checks.empty {
  color: var(--text-muted);
  font-style: italic;
}

.checks.empty::before {
  content: none;
}

.descr {
  color: var(--text-muted);
  margin: 0.4rem 0 0;
  font-size: 0.95rem;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

#view-summary:checked ~ .report-shell .panel[data-view="view-summary"],
#view-accessibility-wcag:checked ~ .report-shell .panel[data-view="view-accessibility-wcag"],
#view-accessibility-forms:checked ~ .report-shell .panel[data-view="view-accessibility-forms"],
#view-accessibility-keyboard:checked ~ .report-shell .panel[data-view="view-accessibility-keyboard"],
#view-accessibility-landmarks:checked ~ .report-shell .panel[data-view="view-accessibility-landmarks"],
#view-functionality-links:checked ~ .report-shell .panel[data-view="view-functionality-links"],
#view-functionality-interactive:checked ~ .report-shell .panel[data-view="view-functionality-interactive"],
#view-functionality-infrastructure:checked ~ .report-shell .panel[data-view="view-functionality-infrastructure"],
#view-responsive-layout:checked ~ .report-shell .panel[data-view="view-responsive-layout"],
#view-visual-regression:checked ~ .report-shell .panel[data-view="view-visual-regression"] {
  display: grid;
}

#view-summary:checked ~ .report-shell .sidebar label[for="view-summary"],
#view-accessibility-wcag:checked ~ .report-shell .sidebar label[for="view-accessibility-wcag"],
#view-accessibility-forms:checked ~ .report-shell .sidebar label[for="view-accessibility-forms"],
#view-accessibility-keyboard:checked ~ .report-shell .sidebar label[for="view-accessibility-keyboard"],
#view-accessibility-landmarks:checked ~ .report-shell .sidebar label[for="view-accessibility-landmarks"],
#view-functionality-links:checked ~ .report-shell .sidebar label[for="view-functionality-links"],
#view-functionality-interactive:checked ~ .report-shell .sidebar label[for="view-functionality-interactive"],
#view-functionality-infrastructure:checked ~ .report-shell .sidebar label[for="view-functionality-infrastructure"],
#view-responsive-layout:checked ~ .report-shell .sidebar label[for="view-responsive-layout"],
#view-visual-regression:checked ~ .report-shell .sidebar label[for="view-visual-regression"] {
  box-shadow:
    0 0 0 2px rgba(37, 99, 235, 0.18),
    0 12px 28px rgba(30, 64, 175, 0.18);
  outline: 1px solid rgba(37, 99, 235, 0.25);
  outline-offset: -1px;
  transform: none;
}

#view-accessibility-wcag:checked ~ .report-shell .sidebar label[for="view-accessibility-wcag"],
#view-accessibility-forms:checked ~ .report-shell .sidebar label[for="view-accessibility-forms"],
#view-accessibility-keyboard:checked ~ .report-shell .sidebar label[for="view-accessibility-keyboard"],
#view-functionality-interactive:checked ~ .report-shell .sidebar label[for="view-functionality-interactive"],
#view-functionality-infrastructure:checked ~ .report-shell .sidebar label[for="view-functionality-infrastructure"],
#view-visual-regression:checked ~ .report-shell .sidebar label[for="view-visual-regression"] {
  background: rgba(220, 38, 38, 0.28);
  color: #101828;
}

#view-accessibility-landmarks:checked ~ .report-shell .sidebar label[for="view-accessibility-landmarks"],
#view-functionality-links:checked ~ .report-shell .sidebar label[for="view-functionality-links"],
#view-responsive-layout:checked ~ .report-shell .sidebar label[for="view-responsive-layout"] {
  background: rgba(16, 185, 129, 0.24);
  color: #101828;
}

@media (max-width: 1080px) {
  .report-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
  }

  .report-content {
    order: 2;
  }
}

@media (max-width: 720px) {
  .report-app {
    padding: 2rem 1rem 3rem;
  }

  .panel {
    padding: 1.8rem 1.25rem;
  }

  .panel-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .summary-grid {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }

  .suite-grid {
    grid-template-columns: 1fr;
  }
}

.tests-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.debug-deck {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
  margin: 1rem 0 0;
}

.debug-deck__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.2rem 1.5rem;
  cursor: pointer;
  list-style: none;
  background: rgba(15, 23, 42, 0.03);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}

.debug-deck__summary::-webkit-details-marker {
  display: none;
}

.debug-deck__summary::after {
  content: '▸';
  font-size: 1rem;
  color: var(--text-muted);
  transition: transform 0.2s ease;
}

.debug-deck[open] > .debug-deck__summary {
  border-bottom: 1px solid rgba(29, 78, 216, 0.08);
}

.debug-deck[open] > .debug-deck__summary::after {
  transform: rotate(90deg);
}

.debug-deck__lede {
  display: grid;
  gap: 0.35rem;
}

.debug-deck__lede h2 {
  margin: 0;
  font-size: 1.35rem;
  color: var(--text-strong);
}

.debug-deck__lede p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.95rem;
}

.debug-deck__panel {
  padding: 0 1.5rem 1.5rem;
  border-top: 1px solid rgba(29, 78, 216, 0.08);
}

.debug-deck__layout {
  display: grid;
  gap: 1.5rem;
}

@media (min-width: 960px) {
  .debug-deck__layout {
    grid-template-columns: minmax(220px, 280px) 1fr;
  }
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
  .report-shell {
    grid-template-columns: 1fr;
  }
  .sidebar {
    position: static;
  }
}

@media (max-width: 720px) {
  .report-app {
    padding: 1.75rem clamp(1rem, 5vw, 2rem);
  }
  .test-card__header {
    flex-direction: column;
    align-items: flex-start;
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
  const collapsibleSections = Array.from(
    document.querySelectorAll('.test-logs, .summary-block, .debug-deck')
  );

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
  const summaryMap = collectRunSummariesByType(run.schemaSummaries || []);
  const schemaGroups = buildSchemaGroups(run.schemaSummaries || []);
  const { panels: suitePanels, baseNamesUsed } = buildSuitePanels(schemaGroups, summaryMap);
  const filteredRunSummaries = (run.runSummaries || []).filter((summary) =>
    summary?.baseName ? !baseNamesUsed.has(summary.baseName) : true
  );

  const summaryOverviewHtml = renderSummaryOverview(run, run.schemaSummaries || []);
  const runSummariesHtml = renderRunSummaries(filteredRunSummaries);

  const testsHtml = groupedTests
    .map((group) => renderTestGroup(group, { promotedSummaryBaseNames: baseNamesUsed }))
    .join('\n');
  const statusFilters = renderStatusFilters(run.statusCounts);

  const debugHtml = `
    <details class="debug-deck">
      <summary class="debug-deck__summary">
        <div class="debug-deck__lede">
          <h2>Debug testing</h2>
          <p>Use the navigation below to inspect raw Playwright projects, attachments, and logs.</p>
        </div>
      </summary>
      <div class="debug-deck__panel">
        <div class="debug-deck__layout">
          ${navigationHtml ? `<aside class="debug-deck__sidebar">${navigationHtml}</aside>` : ''}
          <div class="debug-deck__content">
            ${statusFilters}
            <section class="tests-list" aria-label="Test results">
              ${testsHtml}
            </section>
          </div>
        </div>
      </div>
    </details>
  `;

  const summarySections = [summaryOverviewHtml, runSummariesHtml, debugHtml].filter((section) => Boolean(section && section.trim()))
    .join('\n');

  const summaryPanel = {
    id: 'summary',
    navGroup: null,
    label: 'Summary',
    specLabel: 'Summary',
    title: 'Test run overview',
    description:
      'Pulls together pass/fail counts, timing, and standout issues from every suite. Start here to understand overall health before diving into individual checks.',
    status: 'info',
    statusMeta: PANEL_STATUS_META.info,
    content: `
      <header class="panel-header">
        <div class="panel-info">
          <span class="spec-label">Summary</span>
          <h2>Test run overview</h2>
          <p class="panel-description">Pulls together pass/fail counts, timing, and standout issues from every suite. Start here to understand overall health before diving into individual checks.</p>
        </div>
      </header>
      <div class="panel-body">
        ${summarySections}
      </div>
    `,
  };

  const panels = [summaryPanel, ...suitePanels];
  const toggleStyles = buildPanelToggleStyles(panels);
  const radioInputs = panels
    .map(
      (panel, index) =>
        `<input type="radio" name="report-view" id="view-${panel.id}" ${index === 0 ? 'checked' : ''} />`
    )
    .join('\n');
  const sidebarHtml = renderSidebar(panels, run, summaryMap);
  const panelsHtml = panels
    .map(
      (panel) => `
        <section class="panel" data-view="view-${panel.id}">
          ${panel.content}
        </section>
      `
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(run.runId)} – Playwright Test Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Work+Sans:wght@400;500&display=swap" rel="stylesheet" />
  <style>
${baseStyles}
${toggleStyles}
  </style>
  ${SUMMARY_STYLES}
</head>
<body class="report-app">
  ${radioInputs}
  <div class="report-shell">
    ${sidebarHtml}
    <main class="report-content">
      ${panelsHtml}
    </main>
  </div>
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
