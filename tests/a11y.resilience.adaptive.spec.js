const { test, expect } = require('../utils/test-fixtures');
const SiteLoader = require('../utils/site-loader');

test.use({ trace: 'off', video: 'off' });
const {
  safeNavigate,
  waitForPageStability,
} = require('../utils/test-helpers');
const { attachSchemaSummary, escapeHtml } = require('../utils/reporting-utils');
const { createRunSummaryPayload, createPageSummaryPayload } = require('../utils/report-schema');
const {
  DEFAULT_ACCESSIBILITY_SAMPLE,
  selectAccessibilityTestPages,
} = require('../utils/a11y-shared');

const renderWcagBadgesHtml = (references) =>
  references
    .map((ref) => `<span class="badge badge-wcag">${escapeHtml(`${ref.id} ${ref.name}`)}</span>`)
    .join(' ');

const renderWcagListMarkdown = (references) =>
  references.map((ref) => `- ${ref.id} ${ref.name}`);

const REDUCED_MOTION_WCAG_REFERENCES = [
  { id: '2.2.2', name: 'Pause, Stop, Hide' },
  { id: '2.3.3', name: 'Animation from Interactions' },
];

const REFLOW_WCAG_REFERENCES = [
  { id: '1.4.4', name: 'Resize Text' },
  { id: '1.4.10', name: 'Reflow' },
];

const IFRAME_WCAG_REFERENCES = [
  { id: '1.3.1', name: 'Info and Relationships' },
  { id: '4.1.2', name: 'Name, Role, Value' },
];

const REDUCED_MOTION_THRESHOLD_MS = 150;
const MAX_OVERFLOW_TOLERANCE_PX = 16;
const RELOW_VIEWPORT = { width: 320, height: 900 };

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'entry';

const reducedMotionEvaluationScript = () => {
  const matchesReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const animations = document
    .getAnimations()
    .filter((animation) => animation.playState === 'running')
    .map((animation) => {
      const effect = animation.effect;
      const target = effect && 'target' in effect ? effect.target : null;
      const timing = effect && typeof effect.getComputedTiming === 'function' ? effect.getComputedTiming() : {};

      let selector = null;
      if (target) {
        const parts = [];
        if (target.id) {
          parts.push(`#${target.id}`);
        }
        const classList = Array.from(target.classList || []).slice(0, 3);
        if (!parts.length && classList.length) {
          parts.push(`.${classList.join('.')}`);
        }
        if (!parts.length) {
          parts.push(target.tagName ? target.tagName.toLowerCase() : 'element');
        }
        selector = parts.join('');
      }

      const duration = Number.isFinite(timing.duration) ? Math.round(timing.duration) : null;
      const delay = Number.isFinite(timing.delay) ? Math.round(timing.delay) : null;
      const iterations = Number.isFinite(timing.iterations) ? timing.iterations : 'infinite';

      return {
        type: animation.constructor?.name || 'Animation',
        name: animation.animationName || animation.id || null,
        selector,
        duration,
        delay,
        iterations,
        endTime: Number.isFinite(timing.endTime) ? Math.round(timing.endTime) : null,
        direction: timing.direction || 'normal',
        fill: timing.fill || 'none',
      };
    });

  const significantAnimations = animations.filter((animation) => {
    const duration = animation.duration || 0;
    const iterations = animation.iterations === 'infinite' ? Infinity : animation.iterations || 1;
    const totalDuration = duration * iterations;
    const isInfinite = iterations === Infinity || !Number.isFinite(totalDuration);
    const isLong = duration >= REDUCED_MOTION_THRESHOLD_MS;
    return isInfinite || isLong;
  });

  return {
    matchesReduce,
    animations,
    significantAnimations,
  };
};

const reflowEvaluationScript = () => {
  const viewportWidth = Math.round(window.innerWidth);
  const scrollWidth = Math.round(document.documentElement.scrollWidth);
  const horizontalOverflow = Math.max(0, scrollWidth - viewportWidth);

  const offenders = [];
  const elements = Array.from(document.querySelectorAll('body *')).slice(0, 400);
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) continue;
    if (rect.right > viewportWidth + 1 || rect.left < -1) {
      const text = (el.innerText || el.textContent || '').trim().slice(0, 80);
      const classList = Array.from(el.classList || []).slice(0, 3).join('.');
      offenders.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        className: classList || null,
        text,
        rectRight: Math.round(rect.right),
        rectLeft: Math.round(rect.left),
      });
      if (offenders.length >= 8) break;
    }
  }

  return {
    viewportWidth,
    scrollWidth,
    horizontalOverflow,
    offenders,
  };
};

const renderReducedMotionCardHtml = (report) => {
  const significantList = report.significant
    .map((anim) =>
      `<li>${escapeHtml(
        `${anim.name || anim.type || 'animation'} on ${anim.selector || 'element'} (duration ${
          anim.duration ?? 'unknown'
        }ms, iterations ${anim.iterations})`
      )}</li>`
    )
    .join('');
  const advisoryList = report.advisories.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const gatingList = report.gating.map((item) => `<li class="check-fail">${escapeHtml(item)}</li>`).join('');

  return `
    <section class="summary-report summary-a11y page-card">
      <div class="page-card__header">
        <h3>${escapeHtml(report.page)}</h3>
        <span class="status-pill ${report.gating.length ? 'error' : 'success'}">
          ${report.gating.length ? `${report.gating.length} gating issue(s)` : 'Pass'}
        </span>
      </div>
      <p class="details">Animations observed: ${report.animations.length}; significant animations: ${report.significant.length}</p>
      ${report.gating.length ? `<ul class="details">${gatingList}</ul>` : ''}
      ${report.advisories.length ? `<details><summary>Advisories (${report.advisories.length})</summary><ul class="details">${advisoryList}</ul></details>` : ''}
      ${report.significant.length ? `<details><summary>Significant animations</summary><ul class="details">${significantList}</ul></details>` : ''}
    </section>
  `;
};

const formatReducedMotionSummaryHtml = (reports) => {
  if (!reports.length) return '';

  const tableRows = reports
    .map((report) => {
      return `
        <tr class="${report.gating.length ? 'impact-critical' : ''}">
          <td><code>${escapeHtml(report.page)}</code></td>
          <td>${report.animations.length}</td>
          <td>${report.significant.length}</td>
          <td>${report.matchesReduce ? 'Yes' : 'No'}</td>
          <td>${report.gating.length}</td>
          <td>${report.advisories.length}</td>
        </tr>
      `;
    })
    .join('');

  const table = `
    <table>
      <thead>
        <tr>
          <th>Page</th>
          <th>Running animations</th>
          <th>Significant animations</th>
          <th>Prefers-reduced-motion respected</th>
          <th>Gating issues</th>
          <th>Advisories</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;

  const cards = reports.map(renderReducedMotionCardHtml).join('');

  return `
    <section class="summary-report summary-a11y">
      <h2>Reduced motion preference summary</h2>
      <p class="details">Audited ${reports.length} page(s) with prefers-reduced-motion set to "reduce".</p>
      <p class="details"><strong>WCAG coverage:</strong> ${renderWcagBadgesHtml(REDUCED_MOTION_WCAG_REFERENCES)}</p>
      ${table}
      ${cards}
    </section>
  `;
};

const renderReducedMotionCardMarkdown = (report) => {
  const lines = [`## ${report.page}`];
  if (report.gating.length) {
    lines.push('', '### Gating issues', ...report.gating.map((issue) => `- ❗ ${issue}`));
  }
  if (report.significant.length) {
    lines.push('', '### Significant animations');
    report.significant.forEach((anim) =>
      lines.push(
        `- ${anim.name || anim.type || 'animation'} on ${anim.selector || 'element'} (${anim.duration ?? 'unknown'}ms, iterations ${anim.iterations})`
      )
    );
  }
  if (report.advisories.length) {
    lines.push('', '### Advisories', ...report.advisories.map((issue) => `- ℹ️ ${issue}`));
  }
  return lines.join('\n');
};

const formatReducedMotionSummaryMarkdown = (reports) => {
  if (!reports.length) return '';

  const lines = [
    '# Reduced motion preference summary',
    '',
    '| Page | Animations running | Significant animations | Prefers-reduced respected | Gating issues | Advisories |',
    '| --- | --- | --- | --- | --- | --- |',
    ...reports.map((report) =>
      `| \`${report.page}\` | ${report.animations.length} | ${report.significant.length} | ${
        report.matchesReduce ? 'yes' : 'no'
      } | ${report.gating.length} | ${report.advisories.length} |`
    ),
  ];

  lines.push('', '### WCAG coverage');
  lines.push(...renderWcagListMarkdown(REDUCED_MOTION_WCAG_REFERENCES));
  lines.push('');

  reports.forEach((report) => {
    if (!report.gating.length && !report.advisories.length && !report.significant.length) return;
    lines.push('', renderReducedMotionCardMarkdown(report));
  });

  return lines.join('\n');
};

const renderReflowCardHtml = (report) => {
  const offenders = report.offenders
    .map((offender) =>
      `<li>${escapeHtml(
        `${offender.tag}${offender.id ? `#${offender.id}` : ''}${
          offender.className ? `.${offender.className}` : ''
        } extends viewport (L ${offender.rectLeft}px / R ${offender.rectRight}px) — ${offender.text || 'no inline text'}`
      )}</li>`
    )
    .join('');

  const gatingList = report.gating.map((issue) => `<li class="check-fail">${escapeHtml(issue)}</li>`).join('');
  const advisoryList = report.advisories.map((issue) => `<li>${escapeHtml(issue)}</li>`).join('');

  return `
    <section class="summary-report summary-a11y page-card">
      <div class="page-card__header">
        <h3>${escapeHtml(report.page)}</h3>
        <span class="status-pill ${report.gating.length ? 'error' : 'success'}">
          ${report.gating.length ? `${report.gating.length} gating issue(s)` : 'Pass'}
        </span>
      </div>
      <p class="details">Horizontal overflow: ${report.horizontalOverflow}px (viewport ${report.viewportWidth}px)</p>
      ${report.gating.length ? `<ul class="details">${gatingList}</ul>` : ''}
      ${report.advisories.length ? `<details><summary>Advisories (${report.advisories.length})</summary><ul class="details">${advisoryList}</ul></details>` : ''}
      ${report.offenders.length ? `<details><summary>Potential overflow sources</summary><ul class="details">${offenders}</ul></details>` : ''}
    </section>
  `;
};

const formatReflowSummaryHtml = (reports) => {
  if (!reports.length) return '';

  const rows = reports
    .map((report) => `
      <tr class="${report.gating.length ? 'impact-critical' : ''}">
        <td><code>${escapeHtml(report.page)}</code></td>
        <td>${report.viewportWidth}px</td>
        <td>${report.scrollWidth}px</td>
        <td>${report.horizontalOverflow}px</td>
        <td>${report.gating.length}</td>
        <td>${report.advisories.length}</td>
      </tr>
    `)
    .join('');

  const table = `
    <table>
      <thead>
        <tr>
          <th>Page</th>
          <th>Viewport width</th>
          <th>Document width</th>
          <th>Horizontal overflow</th>
          <th>Gating issues</th>
          <th>Advisories</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const cards = reports.map(renderReflowCardHtml).join('');

  return `
    <section class="summary-report summary-a11y">
      <h2>Reflow/320px layout summary</h2>
      <p class="details">Viewport set to 320px width. Highlighting pages with horizontal overflow greater than ${MAX_OVERFLOW_TOLERANCE_PX}px.</p>
      <p class="details"><strong>WCAG coverage:</strong> ${renderWcagBadgesHtml(REFLOW_WCAG_REFERENCES)}</p>
      ${table}
      ${cards}
    </section>
  `;
};

const renderReflowCardMarkdown = (report) => {
  const lines = [`## ${report.page}`];
  if (report.gating.length) {
    lines.push('', '### Gating issues', ...report.gating.map((issue) => `- ❗ ${issue}`));
  }
  if (report.offenders.length) {
    lines.push('', '### Potential overflow sources');
    report.offenders.forEach((offender) =>
      lines.push(
        `- ${offender.tag}${offender.id ? `#${offender.id}` : ''}${
          offender.className ? `.${offender.className}` : ''
        } extends viewport (L ${offender.rectLeft}px / R ${offender.rectRight}px)`
      )
    );
  }
  if (report.advisories.length) {
    lines.push('', '### Advisories', ...report.advisories.map((issue) => `- ℹ️ ${issue}`));
  }
  return lines.join('\n');
};

const formatReflowSummaryMarkdown = (reports) => {
  if (!reports.length) return '';

  const lines = [
    '# Reflow/320px layout summary',
    '',
    '| Page | Document width | Overflow | Gating issues | Advisories |',
    '| --- | --- | --- | --- | --- |',
    ...reports.map((report) =>
      `| \`${report.page}\` | ${report.scrollWidth}px | ${report.horizontalOverflow}px | ${report.gating.length} | ${report.advisories.length} |`
    ),
  ];

  lines.push('', '### WCAG coverage');
  lines.push(...renderWcagListMarkdown(REFLOW_WCAG_REFERENCES));
  lines.push('');

  reports.forEach((report) => {
    if (!report.gating.length && !report.advisories.length && !report.offenders.length) return;
    lines.push('', renderReflowCardMarkdown(report));
  });

  return lines.join('\n');
};

const renderIframeCardHtml = (report) => {
  const frameList = report.frames
    .map((frame) => {
      const label = frame.title || frame.ariaLabel || frame.name;
      const status = frame.accessible
        ? `Accessible label: ${escapeHtml(label || 'missing')}`
        : 'No accessible label';
      const origin = frame.crossOrigin ? 'cross-origin' : 'same-origin';
      const location = frame.resolvedUrl || frame.src || `#${frame.index}`;
      return `<li>${escapeHtml(`${origin} iframe → ${location} (${status})`)}</li>`;
    })
    .join('');

  const gatingList = report.gating.map((issue) => `<li class="check-fail">${escapeHtml(issue)}</li>`).join('');
  const advisoryList = report.advisories.map((issue) => `<li>${escapeHtml(issue)}</li>`).join('');

  return `
    <section class="summary-report summary-a11y page-card">
      <div class="page-card__header">
        <h3>${escapeHtml(report.page)}</h3>
        <span class="status-pill ${report.gating.length ? 'error' : 'success'}">
          ${report.gating.length ? `${report.gating.length} gating issue(s)` : 'Pass'}
        </span>
      </div>
      <p class="details">Detected ${report.frames.length} iframe(s).</p>
      ${report.gating.length ? `<ul class="details">${gatingList}</ul>` : ''}
      ${report.advisories.length ? `<details><summary>Advisories (${report.advisories.length})</summary><ul class="details">${advisoryList}</ul></details>` : ''}
      ${report.frames.length ? `<details><summary>Iframe inventory</summary><ul class="details">${frameList}</ul></details>` : ''}
    </section>
  `;
};

const formatIframeSummaryHtml = (reports) => {
  if (!reports.length) return '';

  const rows = reports
    .map((report) => `
      <tr class="${report.gating.length ? 'impact-critical' : ''}">
        <td><code>${escapeHtml(report.page)}</code></td>
        <td>${report.frames.length}</td>
        <td>${report.gating.length}</td>
        <td>${report.advisories.length}</td>
      </tr>
    `)
    .join('');

  const table = `
    <table>
      <thead>
        <tr>
          <th>Page</th>
          <th>Iframe count</th>
          <th>Gating issues</th>
          <th>Advisories</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const cards = reports.map(renderIframeCardHtml).join('');

  return `
    <section class="summary-report summary-a11y">
      <h2>Iframe accessibility summary</h2>
      <p class="details">Evaluated accessible metadata for embedded frames.</p>
      <p class="details"><strong>WCAG coverage:</strong> ${renderWcagBadgesHtml(IFRAME_WCAG_REFERENCES)}</p>
      ${table}
      ${cards}
    </section>
  `;
};

const renderIframeCardMarkdown = (report) => {
  const lines = [`## ${report.page}`, `- Iframes detected: ${report.frames.length}`];
  if (report.gating.length) {
    lines.push('', '### Gating issues', ...report.gating.map((issue) => `- ❗ ${issue}`));
  }
  if (report.frames.length) {
    lines.push('', '### Iframe inventory');
    report.frames.forEach((frame) => {
      const label = frame.title || frame.ariaLabel || frame.name || 'no accessible label';
      const location = frame.resolvedUrl || frame.src || `#${frame.index}`;
      lines.push(`- ${frame.crossOrigin ? 'Cross' : 'Same'} origin → ${location} (${label})`);
    });
  }
  if (report.advisories.length) {
    lines.push('', '### Advisories', ...report.advisories.map((issue) => `- ℹ️ ${issue}`));
  }
  return lines.join('\n');
};

const formatIframeSummaryMarkdown = (reports) => {
  if (!reports.length) return '';

  const lines = [
    '# Iframe accessibility summary',
    '',
    '| Page | Iframes | Gating issues | Advisories |',
    '| --- | --- | --- | --- |',
    ...reports.map((report) => `| \`${report.page}\` | ${report.frames.length} | ${report.gating.length} | ${report.advisories.length} |`),
  ];

  lines.push('', '### WCAG coverage');
  lines.push(...renderWcagListMarkdown(IFRAME_WCAG_REFERENCES));
  lines.push('');

  reports.forEach((report) => {
    if (!report.gating.length && !report.advisories.length && !report.frames.length) return;
    lines.push('', renderIframeCardMarkdown(report));
  });

  return lines.join('\n');
};

const isSameOrigin = (frameUrl, baseUrl) => {
  try {
    if (!frameUrl || frameUrl === 'about:blank') return true;
    const frameOrigin = new URL(frameUrl).origin;
    const baseOrigin = new URL(baseUrl).origin;
    return frameOrigin === baseOrigin;
  } catch (_) {
    return false;
  }
};

test.describe('Accessibility: Resilience checks', () => {
  let siteConfig;
  let errorContext;

  test.beforeEach(async ({ page, context, errorContext: sharedErrorContext }, testInfo) => {
    const siteName = process.env.SITE_NAME;
    if (!siteName) throw new Error('SITE_NAME environment variable is required');

    siteConfig = SiteLoader.loadSite(siteName);
    SiteLoader.validateSiteConfig(siteConfig);
    errorContext = sharedErrorContext;
  });

  test('Respects prefers-reduced-motion', async ({ page }) => {
    test.setTimeout(7200000);

    const pages = selectAccessibilityTestPages(siteConfig, {
      defaultSize: DEFAULT_ACCESSIBILITY_SAMPLE,
      configKeys: ['a11yMotionSampleSize', 'a11yResponsiveSampleSize'],
    });

    const reports = [];

    for (const testPage of pages) {
      await test.step(`Reduced motion audit: ${testPage}`, async () => {
        const report = {
          page: testPage,
          matchesReduce: true,
          animations: [],
          significant: [],
          gating: [],
          advisories: [],
        };
        reports.push(report);

        try {
          await page.emulateMedia({ reducedMotion: 'reduce' });
        } catch (_) {
          // emulateMedia may not be supported in some environments; continue regardless
        }

        let response;
        try {
          response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        } catch (error) {
          report.gating.push(`Navigation failed: ${error.message}`);
          return;
        }

        if (!response || response.status() >= 400) {
          report.gating.push(
            `Received HTTP status ${response ? response.status() : 'unknown'} when loading page.`
          );
          return;
        }

        const stability = await waitForPageStability(page);
        if (!stability.ok) {
          report.gating.push(`Page did not reach a stable state: ${stability.message}`);
          return;
        }

        const motionData = await page.evaluate(reducedMotionEvaluationScript);
        report.matchesReduce = motionData.matchesReduce;
        report.animations = motionData.animations;
        report.significant = motionData.significantAnimations;

        if (!motionData.matchesReduce) {
          report.advisories.push('prefers-reduced-motion media query did not match; site may lack reduced motion styles.');
        }

        motionData.significantAnimations.forEach((animation) => {
          const label = animation.name || animation.type || 'animation';
          const iterations = animation.iterations === 'infinite' ? Infinity : animation.iterations || 1;
          const duration = animation.duration || 0;
          const totalDuration = iterations === Infinity ? Infinity : duration * iterations;
          const isBlocking = iterations === Infinity || totalDuration >= 5000;
          const message = `${label} on ${animation.selector || 'element'} runs ${
            iterations === Infinity ? 'indefinitely' : `${totalDuration}ms`
          } despite reduced motion preference.`;
          if (isBlocking) {
            report.gating.push(message);
          } else {
            report.advisories.push(message);
          }
        });

        if (!motionData.animations.length) {
          report.advisories.push('No running animations detected; ensure interactive components still function as expected.');
        }
      });
    }

    await page.emulateMedia(null).catch(() => {});

    const gatingTotal = reports.reduce((total, report) => total + report.gating.length, 0);

    const summaryHtml = formatReducedMotionSummaryHtml(reports);
    const summaryMarkdown = formatReducedMotionSummaryMarkdown(reports);
    const projectName = siteConfig.name || process.env.SITE_NAME || 'default';

    const runPayload = createRunSummaryPayload({
      baseName: `a11y-reduced-motion-summary-${slugify(projectName)}`,
      title: 'Reduced motion support summary',
      overview: {
        totalPagesAudited: reports.length,
        pagesRespectingPreference: reports.filter((report) => report.matchesReduce).length,
        pagesWithGatingIssues: reports.filter((report) => report.gating.length > 0).length,
        pagesWithAdvisories: reports.filter((report) => report.advisories.length > 0).length,
        totalSignificantAnimations: reports.reduce((sum, report) => sum + report.significant.length, 0),
      },
      metadata: {
        spec: 'a11y.resilience.adaptive',
        summaryType: 'reduced-motion',
        projectName,
        scope: 'project',
      },
    });
    if (summaryHtml) runPayload.htmlBody = summaryHtml;
    if (summaryMarkdown) runPayload.markdownBody = summaryMarkdown;
    await attachSchemaSummary(testInfo, runPayload);

    for (const report of reports) {
      const pagePayload = createPageSummaryPayload({
        baseName: `a11y-reduced-motion-${slugify(projectName)}-${slugify(report.page)}`,
        title: `Reduced motion audit — ${report.page}`,
        page: report.page,
        viewport: 'reduced-motion',
        summary: {
          matchesPreference: report.matchesReduce,
          animations: report.animations,
          significantAnimations: report.significant,
          gatingIssues: report.gating,
          advisories: report.advisories,
          cardHtml: renderReducedMotionCardHtml(report),
          cardMarkdown: renderReducedMotionCardMarkdown(report),
        },
        metadata: {
          spec: 'a11y.resilience.adaptive',
          summaryType: 'reduced-motion',
          projectName,
        },
      });
      await attachSchemaSummary(testInfo, pagePayload);
    }

    expect(gatingTotal, 'Reduced motion gating issues detected').toBe(0);
  });

  test('Maintains layout under 320px reflow', async ({ page }) => {
    test.setTimeout(7200000);

    const originalViewport = page.viewportSize() || { width: 1280, height: 720 };
    const pages = selectAccessibilityTestPages(siteConfig, {
      defaultSize: DEFAULT_ACCESSIBILITY_SAMPLE,
      configKeys: ['a11yReflowSampleSize', 'a11yResponsiveSampleSize'],
    });

    const reports = [];

    for (const testPage of pages) {
      await test.step(`Reflow audit: ${testPage}`, async () => {
        const report = {
          page: testPage,
          viewportWidth: RELOW_VIEWPORT.width,
          scrollWidth: RELOW_VIEWPORT.width,
          horizontalOverflow: 0,
          offenders: [],
          gating: [],
          advisories: [],
        };
        reports.push(report);

        try {
          await page.setViewportSize(RELOW_VIEWPORT);
        } catch (error) {
          report.gating.push(`Unable to set mobile viewport: ${error.message}`);
          return;
        }

        let response;
        try {
          response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        } catch (error) {
          report.gating.push(`Navigation failed: ${error.message}`);
          return;
        }

        if (!response || response.status() >= 400) {
          report.gating.push(
            `Received HTTP status ${response ? response.status() : 'unknown'} when loading page.`
          );
          return;
        }

        const stability = await waitForPageStability(page);
        if (!stability.ok) {
          report.gating.push(`Page did not reach a stable state: ${stability.message}`);
          return;
        }

        const reflowData = await page.evaluate(reflowEvaluationScript);
        report.viewportWidth = reflowData.viewportWidth;
        report.scrollWidth = reflowData.scrollWidth;
        report.horizontalOverflow = reflowData.horizontalOverflow;
        report.offenders = reflowData.offenders;

        if (reflowData.horizontalOverflow > MAX_OVERFLOW_TOLERANCE_PX) {
          report.gating.push(
            `Horizontal overflow of ${reflowData.horizontalOverflow}px detected at 320px viewport.`
          );
        } else if (reflowData.horizontalOverflow > 0) {
          report.advisories.push(
            `Horizontal overflow of ${reflowData.horizontalOverflow}px detected at 320px viewport (within tolerance).`
          );
        }

        if (!reflowData.offenders.length && reflowData.horizontalOverflow > 0) {
          report.advisories.push('Unable to identify specific overflow sources; investigate layout containers.');
        }
      });

      await page.setViewportSize(originalViewport).catch(() => {});
    }

    const gatingTotal = reports.reduce((total, report) => total + report.gating.length, 0);

    const reflowSummaryHtml = formatReflowSummaryHtml(reports);
    const reflowSummaryMarkdown = formatReflowSummaryMarkdown(reports);
    const projectName = siteConfig.name || process.env.SITE_NAME || 'default';

    const reflowRunPayload = createRunSummaryPayload({
      baseName: `a11y-reflow-summary-${slugify(projectName)}`,
      title: '320px reflow summary',
      overview: {
        totalPagesAudited: reports.length,
        pagesWithOverflow: reports.filter((report) => report.gating.length > 0).length,
        pagesWithAdvisories: reports.filter((report) => report.advisories.length > 0).length,
        maxOverflowPx: reports.reduce((max, report) => Math.max(max, report.horizontalOverflow || 0), 0),
      },
      metadata: {
        spec: 'a11y.resilience.adaptive',
        summaryType: 'reflow',
        projectName,
        scope: 'project',
      },
    });
    if (reflowSummaryHtml) reflowRunPayload.htmlBody = reflowSummaryHtml;
    if (reflowSummaryMarkdown) reflowRunPayload.markdownBody = reflowSummaryMarkdown;
    await attachSchemaSummary(testInfo, reflowRunPayload);

    for (const report of reports) {
      const reflowPagePayload = createPageSummaryPayload({
        baseName: `a11y-reflow-${slugify(projectName)}-${slugify(report.page)}`,
        title: `320px reflow — ${report.page}`,
        page: report.page,
        viewport: '320px',
        summary: {
          viewportWidth: report.viewportWidth,
          documentWidth: report.scrollWidth,
          horizontalOverflowPx: report.horizontalOverflow,
          gatingIssues: report.gating,
          advisories: report.advisories,
          overflowSources: report.offenders,
          cardHtml: renderReflowCardHtml(report),
          cardMarkdown: renderReflowCardMarkdown(report),
        },
        metadata: {
          spec: 'a11y.resilience.adaptive',
          summaryType: 'reflow',
          projectName,
        },
      });
      await attachSchemaSummary(testInfo, reflowPagePayload);
    }

    expect(gatingTotal, 'Reflow gating issues detected').toBe(0);
  });

  test('Iframes expose accessible metadata', async ({ page }) => {
    test.setTimeout(7200000);

    const pages = selectAccessibilityTestPages(siteConfig, {
      defaultSize: DEFAULT_ACCESSIBILITY_SAMPLE,
      configKeys: ['a11yIframeSampleSize', 'a11yResponsiveSampleSize'],
    });

    const reports = [];

    for (const testPage of pages) {
      await test.step(`Iframe audit: ${testPage}`, async () => {
        const report = {
          page: testPage,
          frames: [],
          gating: [],
          advisories: [],
        };
        reports.push(report);

        let response;
        try {
          response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        } catch (error) {
          report.gating.push(`Navigation failed: ${error.message}`);
          return;
        }

        if (!response || response.status() >= 400) {
          report.gating.push(
            `Received HTTP status ${response ? response.status() : 'unknown'} when loading page.`
          );
          return;
        }

        const stability = await waitForPageStability(page);
        if (!stability.ok) {
          report.gating.push(`Page did not reach a stable state: ${stability.message}`);
          return;
        }

        const frameHandles = page.frames().filter((frame) => frame.parentFrame());

        if (!frameHandles.length) {
          report.advisories.push('No iframe elements detected on this page.');
          return;
        }

        for (const [index, frame] of frameHandles.entries()) {
          const frameElement = await frame.frameElement();
          const meta = await frameElement.evaluate((el) => ({
            title: el.getAttribute('title') || null,
            ariaLabel: el.getAttribute('aria-label') || null,
            name: el.getAttribute('name') || null,
            role: el.getAttribute('role') || null,
            src: el.getAttribute('src') || null,
            allow: el.getAttribute('allow') || null,
          }));
          await frameElement.dispose();

          const frameUrl = frame.url();
          const crossOrigin = !isSameOrigin(frameUrl, siteConfig.baseUrl);
          const accessibleLabel = meta.title || meta.ariaLabel || meta.name;

          report.frames.push({
            index,
            ...meta,
            resolvedUrl: frameUrl,
            crossOrigin,
            accessible: Boolean(accessibleLabel),
          });

          if (!accessibleLabel) {
            report.gating.push(
              `Iframe ${meta.src || frameUrl || `#${index}`} is missing accessible label (title/aria-label/name)${
                crossOrigin ? ' — cross-origin content cannot inherit context' : ''
              }.`
            );
          } else if (crossOrigin) {
            report.advisories.push(
              `Cross-origin iframe ${meta.src || frameUrl || `#${index}`} relies on accessible metadata; manual verification recommended.`
            );
          }

          if (!crossOrigin) {
            report.advisories.push(
              `Same-origin iframe ${meta.src || frameUrl || `#${index}`} detected; include it in deeper interactive audits if it contains key journeys.`
            );
          }
        }
      });
    }

    const gatingTotal = reports.reduce((total, report) => total + report.gating.length, 0);

    const iframeSummaryHtml = formatIframeSummaryHtml(reports);
    const iframeSummaryMarkdown = formatIframeSummaryMarkdown(reports);
    const projectName = siteConfig.name || process.env.SITE_NAME || 'default';

    const iframeRunPayload = createRunSummaryPayload({
      baseName: `a11y-iframe-summary-${slugify(projectName)}`,
      title: 'Iframe accessibility summary',
      overview: {
        totalPagesAudited: reports.length,
        totalIframesDetected: reports.reduce((sum, report) => sum + report.frames.length, 0),
        pagesWithMissingLabels: reports.filter((report) => report.gating.length > 0).length,
        pagesWithAdvisories: reports.filter((report) => report.advisories.length > 0).length,
      },
      metadata: {
        spec: 'a11y.resilience.adaptive',
        summaryType: 'iframe-metadata',
        projectName,
        scope: 'project',
      },
    });
    if (iframeSummaryHtml) iframeRunPayload.htmlBody = iframeSummaryHtml;
    if (iframeSummaryMarkdown) iframeRunPayload.markdownBody = iframeSummaryMarkdown;
    await attachSchemaSummary(testInfo, iframeRunPayload);

    for (const report of reports) {
      const iframePagePayload = createPageSummaryPayload({
        baseName: `a11y-iframe-${slugify(projectName)}-${slugify(report.page)}`,
        title: `Iframe metadata — ${report.page}`,
        page: report.page,
        viewport: 'iframe-audit',
        summary: {
          frameCount: report.frames.length,
          gatingIssues: report.gating,
          advisories: report.advisories,
          frames: report.frames,
          cardHtml: renderIframeCardHtml(report),
          cardMarkdown: renderIframeCardMarkdown(report),
        },
        metadata: {
          spec: 'a11y.resilience.adaptive',
          summaryType: 'iframe-metadata',
          projectName,
        },
      });
      await attachSchemaSummary(testInfo, iframePagePayload);
    }

    expect(gatingTotal, 'Iframe accessibility gating issues detected').toBe(0);
  });
});
