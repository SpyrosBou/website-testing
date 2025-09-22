const { test, expect } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');
const {
  setupTestPage,
  teardownTestPage,
  safeNavigate,
  waitForPageStability,
  safeElementInteraction,
} = require('../utils/test-helpers');
const { WordPressPageObjects } = require('../utils/wordpress-page-objects');
const { attachSummary, escapeHtml } = require('../utils/allure-utils');

const VIEWPORTS = {
  mobile: { width: 375, height: 667, name: 'mobile' },
  tablet: { width: 768, height: 1024, name: 'tablet' },
  desktop: { width: 1920, height: 1080, name: 'desktop' },
};

const PERFORMANCE_THRESHOLDS = { mobile: 3000, tablet: 2500, desktop: 2000 };

test.describe('Responsive Structure & UX', () => {
  let siteConfig;
  let errorContext;
  let wp;

  test.beforeEach(async ({ page, context }) => {
    const siteName = process.env.SITE_NAME;
    if (!siteName) throw new Error('SITE_NAME environment variable is required');
    siteConfig = SiteLoader.loadSite(siteName);
    SiteLoader.validateSiteConfig(siteConfig);
    errorContext = await setupTestPage(page, context);
    wp = new WordPressPageObjects(page, siteConfig);
  });

  test.afterEach(async ({ page, context }) => {
    await teardownTestPage(page, context, errorContext);
  });

  Object.entries(VIEWPORTS).forEach(([viewportName, viewport]) => {
    test.describe(`Layout & critical elements - ${viewportName}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      });

      test(`Layout and critical elements - ${viewportName}`, async ({ page }) => {
        test.setTimeout(45000);
        const pagesToTest = process.env.SMOKE
          ? siteConfig.testPages.slice(0, 1)
          : siteConfig.testPages;
        const pageSummaries = [];

        for (const testPage of pagesToTest) {
          await test.step(`Structure ${viewportName}: ${testPage}`, async () => {
            const startTime = Date.now();
            const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
            if (response.status() !== 200) return;
            await waitForPageStability(page, { timeout: 15000 });

            const loadTime = Date.now() - startTime;
            const threshold = PERFORMANCE_THRESHOLDS[viewportName];
            if (loadTime > threshold) {
              console.log(
                `⚠️  ${viewportName} load time ${loadTime}ms exceeds threshold ${threshold}ms for ${testPage}`
              );
            } else {
              console.log(
                `✅ ${viewportName} load time ${loadTime}ms within threshold for ${testPage}`
              );
            }

            // Critical elements via page objects
            const critical = await wp.verifyCriticalElements();
            expect.soft(critical.header).toBe(true);

            if (viewportName === 'mobile') {
              const mobileNavSelectors = [
                '#mobile-burger',
                '.menu-toggle',
                '[aria-controls]',
                '.hamburger',
                '.navbar-toggler',
                '.menu-button',
                '[aria-label*="menu"]',
              ];
              let mobileNavFound = false;
              for (const s of mobileNavSelectors) {
                if (await page.locator(s).isVisible()) {
                  mobileNavFound = true;
                  try {
                    await safeElementInteraction(page.locator(s).first(), 'click', {
                      timeout: 3000,
                    });
                    await page.waitForTimeout(400);
                  } catch (_) {}
                  break;
                }
              }
              if (!mobileNavFound) {
                const nav = await wp.verifyCriticalElements();
                expect.soft(nav.navigation).toBe(true);
              }
            } else {
              const nav = await wp.verifyCriticalElements();
              expect.soft(nav.navigation).toBe(true);
            }
            const again = await wp.verifyCriticalElements();
            expect.soft(again.content).toBe(true);
            expect.soft(again.footer).toBe(true);

            // Optional basic form visibility/touch checks on mobile
            if (viewportName === 'mobile' && siteConfig.forms && siteConfig.forms.length > 0) {
              const formPage = siteConfig.forms[0].page || testPage;
              if (testPage === formPage) {
                const formSelector =
                  siteConfig.forms[0].selector || '.wpcf7-form, .contact-form, form';
                if (await page.locator(formSelector).isVisible()) {
                  const fields = await page
                    .locator(`${formSelector} input, ${formSelector} textarea`)
                    .all();
                  for (let i = 0; i < Math.min(fields.length, 3); i++) {
                    try {
                      await fields[i].tap({ timeout: 1500 });
                    } catch (_) {}
                  }
                }
              }
            }

            // Collect per-page summary for Allure attachment
            pageSummaries.push({
              page: testPage,
              loadTime,
              threshold,
              elements: {
                header: Boolean(again.header),
                navigation: Boolean(again.navigation),
                content: Boolean(again.content),
                footer: Boolean(again.footer),
              },
            });
          });
        }

        // Attach styled Allure summary for this viewport
        const rowsHtml = pageSummaries
          .map((e) => {
            const className = e.loadTime > e.threshold ? 'status-error' : 'status-ok';
            const boolCell = (v) => (v ? '✅' : '⚠️');
            return `
              <tr class="${className}">
                <td><code>${escapeHtml(e.page)}</code></td>
                <td>${Math.round(e.loadTime)}ms</td>
                <td>${e.threshold}ms</td>
                <td>${boolCell(e.elements.header)}</td>
                <td>${boolCell(e.elements.navigation)}</td>
                <td>${boolCell(e.elements.content)}</td>
                <td>${boolCell(e.elements.footer)}</td>
              </tr>
            `;
          })
          .join('');

        const htmlBody = `
          <section class="summary-report summary-responsive-structure">
            <h3>Responsive structure — ${escapeHtml(viewportName)}</h3>
            <table>
              <thead><tr><th>Page</th><th>Load</th><th>Threshold</th><th>Header</th><th>Nav</th><th>Content</th><th>Footer</th></tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </section>
        `;

        const mdRows = pageSummaries.map(
          (e) =>
            `| \`${e.page}\` | ${Math.round(e.loadTime)}ms | ${e.threshold}ms | ${e.elements.header ? '✅' : '⚠️'} | ${e.elements.navigation ? '✅' : '⚠️'} | ${e.elements.content ? '✅' : '⚠️'} | ${e.elements.footer ? '✅' : '⚠️'} |`
        );
        const markdown = [
          `# Responsive structure — ${viewportName}`,
          '',
          '| Page | Load | Threshold | Header | Nav | Content | Footer |',
          '| --- | --- | --- | --- | --- | --- | --- |',
          ...mdRows,
        ].join('\n');

        await attachSummary({
          baseName: `responsive-structure-${viewportName}-summary`,
          htmlBody,
          markdown,
          setDescription: false,
        });
      });
    });
  });

  test.describe('Cross-Viewport Consistency', () => {
    test('Content hierarchy consistency across viewports', async ({ page }) => {
      test.setTimeout(30000);

      const testPage = siteConfig.testPages[0];
      const contentStructure = {};
      for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
        await test.step(`Analyzing ${viewportName}`, async () => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
          if (response.status() !== 200) return;
          await waitForPageStability(page);

          const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
          contentStructure[viewportName] = {
            headingCount: headings.length,
            headings: headings.slice(0, 5),
            hasNav: await page.locator('nav').isVisible(),
            hasMain: await page.locator('main').isVisible(),
            hasFooter: await page.locator('footer').isVisible(),
          };
        });
      }

      const names = Object.keys(contentStructure);
      if (names.length > 1) {
        const base = contentStructure[names[0]];
        for (let i = 1; i < names.length; i++) {
          const cmp = contentStructure[names[i]];
          const diff = Math.abs(base.headingCount - cmp.headingCount);
          if (diff > 2)
            console.log(
              `⚠️  Significant heading count difference between ${names[0]} and ${names[i]}`
            );
          expect.soft(cmp.hasNav).toBe(base.hasNav);
          expect.soft(cmp.hasMain).toBe(base.hasMain);
          expect.soft(cmp.hasFooter).toBe(base.hasFooter);
        }
      }

      // Attach Allure summary for cross-viewport consistency
      const rowsHtml = names
        .map((vp) => {
          const d = contentStructure[vp] || {};
          const b = (v) => (v ? '✅' : '⚠️');
          const headings = (d.headings || []).map((h) => `<code>${escapeHtml(String(h))}</code>`).join('<br />');
          return `
            <tr>
              <td>${escapeHtml(vp)}</td>
              <td>${d.headingCount ?? 0}</td>
              <td>${b(Boolean(d.hasNav))}</td>
              <td>${b(Boolean(d.hasMain))}</td>
              <td>${b(Boolean(d.hasFooter))}</td>
              <td>${headings || '—'}</td>
            </tr>
          `;
        })
        .join('');
      const htmlBody = `
        <section class="summary-report summary-responsive-consistency">
          <h3>Cross-viewport content consistency</h3>
          <p>Page: <code>${escapeHtml(testPage)}</code></p>
          <table>
            <thead><tr><th>Viewport</th><th>Heading count</th><th>Nav</th><th>Main</th><th>Footer</th><th>Sample headings</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </section>
      `;
      const mdRows = names.map((vp) => {
        const d = contentStructure[vp] || {};
        return `| ${vp} | ${d.headingCount ?? 0} | ${d.hasNav ? '✅' : '⚠️'} | ${d.hasMain ? '✅' : '⚠️'} | ${d.hasFooter ? '✅' : '⚠️'} | ${(d.headings || []).slice(0, 3).join(' / ') || '—'} |`;
      });
      const markdown = [
        `# Cross-viewport content consistency`,
        '',
        `Page: \`${testPage}\``,
        '',
        '| Viewport | Headings | Nav | Main | Footer | Sample headings |',
        '| --- | --- | --- | --- | --- | --- |',
        ...mdRows,
      ].join('\n');
      await attachSummary({
        baseName: 'responsive-consistency-summary',
        htmlBody,
        markdown,
        setDescription: false,
      });
    });
  });

  test.describe('WordPress-Specific Responsive Features', () => {
    test('WordPress theme responsive patterns', async ({ page }) => {
      test.setTimeout(30000);
      const features = [];
      for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
        await test.step(`WP features: ${viewportName}`, async () => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          const response = await safeNavigate(page, siteConfig.baseUrl);
          if (response.status() !== 200) return;
          await waitForPageStability(page);

          const hasWpResponsive = await page
            .locator('[class*="wp-block"], [class*="responsive"]')
            .isVisible();
          if (hasWpResponsive)
            console.log(`✅ WordPress responsive elements detected on ${viewportName}`);

          const blockElements = await page.locator('[class*="wp-block-"]').count();
          if (blockElements > 0)
            console.log(`📊 ${blockElements} Gutenberg blocks found on ${viewportName}`);

          const widgets = await page.locator('.widget').count();
          if (widgets > 0) console.log(`📊 ${widgets} widgets found on ${viewportName}`);

          features.push({
            viewport: viewportName,
            hasWpResponsive,
            blockElements,
            widgets,
          });
        });
      }

      // Attach Allure summary for WP-specific responsive features
      const rowsHtml = features
        .map((f) => {
          const b = (v) => (v ? '✅' : '⚠️');
          return `
            <tr>
              <td>${escapeHtml(f.viewport)}</td>
              <td>${b(Boolean(f.hasWpResponsive))}</td>
              <td>${f.blockElements}</td>
              <td>${f.widgets}</td>
            </tr>
          `;
        })
        .join('');
      const htmlBody = `
        <section class="summary-report summary-wp-responsive">
          <h3>WordPress responsive features</h3>
          <table>
            <thead><tr><th>Viewport</th><th>Responsive elems</th><th>Block elements</th><th>Widgets</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </section>
      `;
      const mdRows = features.map(
        (f) => `| ${f.viewport} | ${f.hasWpResponsive ? '✅' : '⚠️'} | ${f.blockElements} | ${f.widgets} |`
      );
      const markdown = [
        '# WordPress responsive features',
        '',
        '| Viewport | Responsive | Block elements | Widgets |',
        '| --- | --- | --- | --- |',
        ...mdRows,
      ].join('\n');
      await attachSummary({
        baseName: 'responsive-wp-features-summary',
        htmlBody,
        markdown,
        setDescription: false,
      });
    });
  });
});
