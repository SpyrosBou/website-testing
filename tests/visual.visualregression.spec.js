const { test, expect } = require('@playwright/test');
const fs = require('fs');
const SiteLoader = require('../utils/site-loader');
const {
  setupTestPage,
  teardownTestPage,
  safeNavigate,
  waitForPageStability,
  ErrorContext,
} = require('../utils/test-helpers');
const { attachSummary, escapeHtml } = require('../utils/allure-utils');

const VIEWPORTS = {
  mobile: { width: 375, height: 667, name: 'mobile' },
  tablet: { width: 768, height: 1024, name: 'tablet' },
  desktop: { width: 1920, height: 1080, name: 'desktop' },
};

const resolveViewports = () => {
  const raw = (process.env.VISUAL_VIEWPORTS || 'desktop').trim();
  if (!raw) return ['desktop'];
  if (raw.toLowerCase() === 'all') return Object.keys(VIEWPORTS);
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => Boolean(VIEWPORTS[entry]));
};

const DEFAULT_VISUAL_THRESHOLDS = {
  ui_elements: 0.05,
  content: 0.05,
  dynamic: 0.05,
};

const parseDiffMetrics = (message) => {
  if (typeof message !== 'string' || message.length === 0) return null;

  const pixelsRegex = /([\d,]+)\s+pixels\s+\(ratio\s+([\d.]+)\s+of all image pixels\) are different/gi;
  let pixelsMatch;
  let lastPixelsMatch = null;
  while ((pixelsMatch = pixelsRegex.exec(message))) {
    lastPixelsMatch = pixelsMatch;
  }

  const dimensionsRegex = /Expected an image\s+(\d+)px by (\d+)px,\s+received\s+(\d+)px by (\d+)px/gi;
  let dimMatch;
  let lastDimensionsMatch = null;
  while ((dimMatch = dimensionsRegex.exec(message))) {
    lastDimensionsMatch = dimMatch;
  }

  if (!lastPixelsMatch && !lastDimensionsMatch) return null;

  const metrics = {};
  if (lastPixelsMatch) {
    metrics.pixelDiff = Number(lastPixelsMatch[1].replace(/,/g, ''));
    metrics.pixelRatio = Number(lastPixelsMatch[2]);
  }
  if (lastDimensionsMatch) {
    metrics.expectedSize = {
      width: Number(lastDimensionsMatch[1]),
      height: Number(lastDimensionsMatch[2]),
    };
    metrics.actualSize = {
      width: Number(lastDimensionsMatch[3]),
      height: Number(lastDimensionsMatch[4]),
    };
  }

  return metrics;
};

test.describe('Visual Regression', () => {
  let siteConfig;
  let errorContext;

  test.beforeEach(async ({ page, context }) => {
    const siteName = process.env.SITE_NAME;
    if (!siteName) throw new Error('SITE_NAME environment variable is required');
    siteConfig = SiteLoader.loadSite(siteName);
    SiteLoader.validateSiteConfig(siteConfig);
    errorContext = await setupTestPage(page, context);
  });

  test.afterEach(async ({ page, context }) => {
    await teardownTestPage(page, context, errorContext);
  });

  const enabledViewportKeys = resolveViewports();

  if (enabledViewportKeys.length === 0) {
    throw new Error('No valid viewports selected for visual regression');
  }

  enabledViewportKeys.forEach((viewportKey) => {
    const viewport = VIEWPORTS[viewportKey];
    const viewportName = viewport.name;
    test.describe(`Visuals: ${viewportName} (${viewport.width}x${viewport.height})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      });

      test(`Visual regression - ${viewportName}`, async ({ page, browserName }, testInfo) => {
        test.setTimeout(7200000);
        errorContext.setTest(`Visual Regression - ${viewportName}`);

        const pagesToTest = process.env.SMOKE
          ? siteConfig.testPages.slice(0, 1)
          : siteConfig.testPages;
        const visualSummaries = [];

        for (const testPage of pagesToTest) {
          await test.step(`Visual ${viewportName}: ${testPage}`, async () => {
            errorContext.setPage(testPage);

            const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
            if (response.status() !== 200) return;
            await waitForPageStability(page);

            // Disable animations for consistent screenshots
            await page.addStyleTag({
              content: `
                *, *::before, *::after {
                  animation-duration: 0s !important;
                  animation-delay: 0s !important;
                  transition-duration: 0s !important;
                  transition-delay: 0s !important;
                }
              `,
            });
            await page.waitForTimeout(300);

            const pageName = testPage.replace(/\//g, '') || 'home';
            const screenshotName = `${siteConfig.name
              .toLowerCase()
              .replace(/\s+/g, '-')}-${pageName}-${viewportName}-${browserName}.png`;

            const thresholds = siteConfig.visualThresholds || DEFAULT_VISUAL_THRESHOLDS;
            let threshold = testPage === '/' || testPage.includes('home')
              ? thresholds.dynamic
              : thresholds.content;

            // Per-page visual overrides
            const overrides = Array.isArray(siteConfig.visualOverrides) ? siteConfig.visualOverrides : [];
            const matchOverride = overrides.find((ovr) => {
              if (ovr && typeof ovr.match === 'string' && ovr.match === testPage) return true;
              if (ovr && typeof ovr.page === 'string' && ovr.page === testPage) return true;
              if (ovr && typeof ovr.pattern === 'string') {
                try { return new RegExp(ovr.pattern).test(testPage); } catch (_) { return false; }
              }
              return false;
            });

            const maskSelectors = [
              'time',
              '.wp-block-latest-posts__post-date',
              '.wp-block-latest-comments__comment-date',
              '.carousel',
              '.slider',
              '.ticker',
              'iframe',
              'video',
              'canvas',
            ].concat(siteConfig.dynamicMasks || [])
             .concat(matchOverride?.masks || matchOverride?.maskSelectors || []);
            if (typeof matchOverride?.threshold === 'number') {
              threshold = matchOverride.threshold;
            }
            const masks = maskSelectors.map((sel) => page.locator(sel));

            const artifactsLabel = `${screenshotName.replace(/\.png$/i, '')}`;

            const toDataUri = (filePath) => {
              try {
                const content = fs.readFileSync(filePath);
                return `data:image/png;base64,${content.toString('base64')}`;
              } catch (_error) {
                return null;
              }
            };

            const collectVisualArtifacts = async (includeDiffArtifacts = false) => {
              const artifactInfo = { baseline: null, actual: null, diff: null };
              const attachImage = async (label, filePath, inlinePreview = false) => {
                if (!filePath || !fs.existsSync(filePath)) return null;
                const attachmentName = `${artifactsLabel}-${label}.png`;
                const preview = inlinePreview ? toDataUri(filePath) : null;
                try {
                  await testInfo.attach(attachmentName, {
                    path: filePath,
                    contentType: 'image/png',
                  });
                } catch (_error) {
                  // Ignore attachment failures; preview still useful.
                }
                return { name: attachmentName, preview };
              };

              if (includeDiffArtifacts) {
                const baselinePath = testInfo.snapshotPath(screenshotName);
                artifactInfo.baseline = await attachImage('baseline', baselinePath, true);

                const baseName = artifactsLabel;
                const actualCandidates = [
                  testInfo.outputPath(`${baseName}-actual.png`),
                  testInfo.outputPath(`${screenshotName}-actual.png`),
                ];
                const diffCandidates = [
                  testInfo.outputPath(`${baseName}-diff.png`),
                  testInfo.outputPath(`${screenshotName}-diff.png`),
                ];

                const findExisting = (candidates) =>
                  candidates.find((candidate) => candidate && fs.existsSync(candidate));

                const actualPath = findExisting(actualCandidates);
                const diffPath = findExisting(diffCandidates);

                artifactInfo.actual = await attachImage('actual', actualPath, true);
                artifactInfo.diff = await attachImage('diff', diffPath, true);
              }

              return artifactInfo;
            };

            try {
              await expect(page).toHaveScreenshot(screenshotName, {
                fullPage: true,
                threshold,
                maxDiffPixels: 1000,
                animations: 'disabled',
                mask: masks,
              });
              console.log(`✅ Visual regression passed for ${testPage} (${viewportName})`);
              visualSummaries.push({
                page: testPage,
                result: 'pass',
                threshold,
                screenshot: screenshotName,
                artifacts: null,
              });
            } catch (error) {
              console.log(
                `⚠️  Visual difference detected for ${testPage} (${viewportName}): ${error.message}`
              );
              const artifacts = await collectVisualArtifacts(true);
              const diffMetrics = parseDiffMetrics(String(error.message || ''));
              visualSummaries.push({
                page: testPage,
                result: 'diff',
                threshold,
                screenshot: screenshotName,
                error: String(error.message || '').slice(0, 200),
                diffMetrics,
                artifacts,
              });
            }
          });
        }

        // Attach Allure summary for this viewport
        const rowsHtml = visualSummaries
          .map((e) => {
            const className = e.result === 'pass' ? 'status-ok' : 'status-error';
            const noteItems = [];
            if (e.result === 'pass') {
              noteItems.push('<li class="check-pass">Matched baseline</li>');
            } else {
              noteItems.push('<li class="check-fail">Diff detected</li>');
              if (e.diffMetrics?.pixelDiff) {
                const percent = e.diffMetrics.pixelRatio
                  ? `${(Number(e.diffMetrics.pixelRatio) * 100).toFixed(2)}%`
                  : null;
                noteItems.push(
                  `<li class="details">Pixel delta: ${e.diffMetrics.pixelDiff.toLocaleString()}${percent ? ` (${percent})` : ''}</li>`
                );
              }
              if (e.diffMetrics?.expectedSize && e.diffMetrics?.actualSize) {
                const { expectedSize, actualSize } = e.diffMetrics;
                const heightDelta = actualSize.height - expectedSize.height;
                const widthDelta = actualSize.width - expectedSize.width;
                noteItems.push(
                  `<li class="details">Expected ${expectedSize.width}×${expectedSize.height}px, got ${actualSize.width}×${actualSize.height}px${
                    heightDelta || widthDelta
                      ? ` (${widthDelta ? `ΔW ${widthDelta}` : ''}${heightDelta ? `${widthDelta ? ', ' : ''}ΔH ${heightDelta}` : ''})`
                      : ''
                  }</li>`
                );
              }
              if (e.error) {
                noteItems.push(`<li class="details">${escapeHtml(e.error)}</li>`);
              }
            }
            const notes = `<ul class="checks">${noteItems.join('')}</ul>`;
            const hasArtifacts = Boolean(e.artifacts?.baseline || e.artifacts?.actual || e.artifacts?.diff);
            const artifactsCell = hasArtifacts
              ? `
                <div class="visual-previews">
                  ${e.artifacts?.baseline?.preview
                    ? `<figure class="visual-previews__item visual-previews__item--baseline"><img src="${e.artifacts.baseline.preview}" alt="Baseline screenshot"><figcaption>Baseline</figcaption></figure>`
                    : ''}
                  ${e.artifacts?.actual?.preview
                    ? `<figure class="visual-previews__item visual-previews__item--actual"><img src="${e.artifacts.actual.preview}" alt="Actual screenshot"><figcaption>Local Build</figcaption></figure>`
                    : ''}
                  ${e.artifacts?.diff?.preview
                    ? `<figure class="visual-previews__item visual-previews__item--diff"><img src="${e.artifacts.diff.preview}" alt="Diff screenshot"><figcaption>Diff Overlay</figcaption></figure>`
                    : ''}
                </div>
              `
              : '<span class="details">—</span>';
            return `
              <tr class="${className}">
                <td><code>${escapeHtml(e.page)}</code></td>
                <td>${escapeHtml(String(e.screenshot))}</td>
                <td>${e.threshold}</td>
                <td>${notes}</td>
                <td>${artifactsCell}</td>
              </tr>
            `;
          })
          .join('');

        const htmlBody = `
          <section class="summary-report summary-visual">
            <h3>Visual regression summary — ${escapeHtml(viewportName)}</h3>
            <table>
              <thead><tr><th>Page</th><th>Screenshot</th><th>Threshold</th><th>Notes</th><th>Artifacts</th></tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </section>
        `;

        const mdRows = visualSummaries.map((e) => {
          const artifacts = [];
          if (e.artifacts?.baseline) artifacts.push('Baseline');
          if (e.artifacts?.actual) artifacts.push('Actual');
          if (e.artifacts?.diff) artifacts.push('Diff');
          const artifactText = artifacts.length > 0 ? artifacts.join(', ') : '—';
          const diffDetailsMd = e.diffMetrics?.pixelDiff
            ? `${e.diffMetrics.pixelDiff.toLocaleString()} px${
                e.diffMetrics.pixelRatio ? ` (${(e.diffMetrics.pixelRatio * 100).toFixed(2)}%)` : ''
              }`
            : e.result === 'pass'
              ? '—'
              : 'diff detected';
          return `| \`${e.page}\` | ${e.screenshot} | ${e.threshold} | ${e.result === 'pass' ? '✅ matched' : `⚠️ ${diffDetailsMd}`} | ${artifactText} |`;
        });
        const markdown = [
          `# Visual regression summary — ${viewportName}`,
          '',
          '| Page | Screenshot | Threshold | Result | Artifacts |',
          '| --- | --- | --- | --- | --- |',
          ...mdRows,
        ].join('\n');

        await attachSummary({
          baseName: `visual-regression-${viewportName}-summary`,
          htmlBody,
          markdown,
        });
      });
    });
  });
});
