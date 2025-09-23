const { test, expect } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');
const {
  setupTestPage,
  teardownTestPage,
  safeNavigate,
  waitForPageStability,
} = require('../utils/test-helpers');
const { attachSummary, escapeHtml } = require('../utils/allure-utils');

const LINK_CHECK_DEFAULTS = {
  maxPerPage: 20,
  timeoutMs: 5000,
  followRedirects: true,
  methodFallback: true,
};

const normalizeInternalUrl = (url, baseUrl) => {
  try {
    const parsed = new URL(url, baseUrl);
    parsed.hash = '';
    parsed.search = '';
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    }
    return `${parsed.origin}${parsed.pathname}`;
  } catch (error) {
    console.log(`⚠️  Could not normalize URL ${url}: ${error.message}`);
    return url;
  }
};

const checkLink = async (page, url, config) => {
  const buildFetchOptions = (method) => {
    const options = {
      method,
      timeout: config.timeoutMs,
    };
    if (!config.followRedirects) options.maxRedirects = 0;
    return options;
  };

  const methods = config.methodFallback ? ['HEAD', 'GET'] : ['HEAD'];
  let lastFailure = { status: undefined, method: 'HEAD', error: undefined };

  for (const method of methods) {
    try {
      const response = await page.request.fetch(url, buildFetchOptions(method));
      const status = response.status();
      await response.dispose();

      if (status < 400) {
        return { ok: true, status, method };
      }

      lastFailure = { status, method };
      if (method === 'HEAD' && config.methodFallback) continue;
      return { ok: false, status, method };
    } catch (error) {
      lastFailure = { error: error.message, method };
      if (method === 'HEAD' && config.methodFallback) continue;
      return { ok: false, error: error.message, method };
    }
  }

  return { ok: false, ...lastFailure };
};

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'root';

const statusClassName = (status) => {
  if (status >= 400) return 'status-error';
  if (status >= 300) return 'status-redirect';
  return 'status-ok';
};

const formatLinksSummaryHtml = (pages, brokenLinks) => {
  const pageRows = pages
    .map((entry) => {
      const className = entry.broken.length > 0 ? 'status-error' : 'status-ok';
      return `
        <tr class="${className}">
          <td><code>${escapeHtml(entry.page)}</code></td>
          <td>${entry.totalLinks}</td>
          <td>${entry.uniqueChecked}</td>
          <td>${entry.broken.length}</td>
        </tr>
      `;
    })
    .join('');

  const brokenRows = brokenLinks
    .map((link) => `
      <tr class="status-error">
        <td><code>${escapeHtml(link.page)}</code></td>
        <td><code>${escapeHtml(link.url)}</code></td>
        <td>${link.status ? escapeHtml(String(link.status)) : escapeHtml(link.error || 'error')}</td>
        <td>${escapeHtml(link.method || 'HEAD')}</td>
      </tr>
    `)
    .join('');

  const brokenSection = brokenLinks.length
    ? `
        <section class="summary-report summary-links">
          <h3>Broken links (${brokenLinks.length})</h3>
          <table>
            <thead><tr><th>Source page</th><th>URL</th><th>Status / Error</th><th>Method</th></tr></thead>
            <tbody>${brokenRows}</tbody>
          </table>
        </section>
      `
    : `
        <section class="summary-report summary-links">
          <h3>Broken links</h3>
          <p>None detected 🎉</p>
        </section>
      `;

  return `
    <section class="summary-report summary-links">
      <h3>Internal link coverage</h3>
      <table>
        <thead><tr><th>Page</th><th>Links found</th><th>Checked</th><th>Broken</th></tr></thead>
        <tbody>${pageRows}</tbody>
      </table>
    </section>
    ${brokenSection}
  `;
};

const formatLinksSummaryMarkdown = (pages, brokenLinks) => {
  const header = [
    '# Internal link coverage summary',
    '',
    '| Page | Links found | Checked | Broken |',
    '| --- | --- | --- | --- |',
  ];
  const pageRows = pages.map(
    (entry) => `| \`${entry.page}\` | ${entry.totalLinks} | ${entry.uniqueChecked} | ${entry.broken.length} |`
  );
  const brokenSection =
    brokenLinks.length === 0
      ? ['', '## Broken links', '', 'None 🎉']
      : ['', '## Broken links', '', '| Page | URL | Status | Method |', '| --- | --- | --- | --- |'].concat(
          brokenLinks.map((link) =>
            `| \`${link.page}\` | ${link.url} | ${link.status ? link.status : link.error || 'error'} | ${link.method || 'HEAD'} |`
          )
        );
  return header.concat(pageRows).concat(brokenSection).join('\n');
};

test.describe('Functionality: Internal Links', () => {
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

  test('Validate internal links across pages (rate-limited)', async ({ page }) => {
    test.setTimeout(300000);
    const brokenLinks = [];
    const checkedLinks = new Set();
    const pageSummaries = [];
    const linkCheckConfig = {
      ...LINK_CHECK_DEFAULTS,
      ...(typeof siteConfig.linkCheck === 'object' && siteConfig.linkCheck !== null
        ? siteConfig.linkCheck
        : {}),
    };
    const timeoutMsValue = Number(linkCheckConfig.timeoutMs);
    linkCheckConfig.timeoutMs = Number.isFinite(timeoutMsValue) && timeoutMsValue > 0
      ? timeoutMsValue
      : LINK_CHECK_DEFAULTS.timeoutMs;

    const maxPerPageValue = Number(linkCheckConfig.maxPerPage);
    const maxPerPage = Number.isFinite(maxPerPageValue) && maxPerPageValue > 0
      ? Math.floor(maxPerPageValue)
      : LINK_CHECK_DEFAULTS.maxPerPage;

    linkCheckConfig.followRedirects = linkCheckConfig.followRedirects !== false;
    linkCheckConfig.methodFallback = linkCheckConfig.methodFallback !== false;
    const pagesToTest = process.env.SMOKE
      ? (Array.isArray(siteConfig.testPages) && siteConfig.testPages.includes('/'))
        ? ['/']
        : [siteConfig.testPages[0]]
      : siteConfig.testPages;

    for (const testPage of pagesToTest) {
      await test.step(`Checking internal links on: ${testPage}`, async () => {
        const response = await safeNavigate(page, `${siteConfig.baseUrl}${testPage}`);
        if (response.status() !== 200) return;
        await waitForPageStability(page);

        const links = await page
          .locator('a[href]:visible')
          .all();
        console.log(`Found ${links.length} internal links on ${testPage}`);
        const perPage = {
          page: testPage,
          totalLinks: links.length,
          uniqueChecked: 0,
          broken: [],
        };
        const pageLinks = [];
        for (const link of links) {
          try {
            const href = await link.getAttribute('href');
            if (!href || href.startsWith('#')) continue;
            let fullUrl;
            try {
              const resolved = new URL(href, `${siteConfig.baseUrl}${testPage}`);
              fullUrl = resolved.href;
            } catch (error) {
              console.log(`⚠️  Skipping invalid href ${href}: ${error.message}`);
              continue;
            }
            if (!fullUrl.startsWith(siteConfig.baseUrl)) continue;
            const normalized = normalizeInternalUrl(fullUrl, siteConfig.baseUrl);
            if (checkedLinks.has(normalized)) continue;
            checkedLinks.add(normalized);
            pageLinks.push(fullUrl);
            if (pageLinks.length >= maxPerPage) break;
          } catch (error) {
            console.log(`⚠️  Could not read link attribute: ${error.message}`);
          }
        }

        const concurrency = Math.min(5, pageLinks.length);
        let index = 0;
        const processNext = async () => {
          while (index < pageLinks.length) {
            const currentIndex = index++;
            const url = pageLinks[currentIndex];
            try {
              const result = await checkLink(page, url, linkCheckConfig);
              if (!result.ok) {
                const brokenEntry = {
                  url,
                  status: result.status,
                  page: testPage,
                  method: result.method,
                  error: result.error,
                };
                brokenLinks.push(brokenEntry);
                perPage.broken.push(brokenEntry);
              }
            } catch (error) {
              console.log(`⚠️  Link probe failed for ${url}: ${error.message}`);
            }
            await page.waitForTimeout(100);
          }
        };

        await Promise.all(Array.from({ length: concurrency || 1 }, processNext));
        perPage.uniqueChecked = pageLinks.length;
        pageSummaries.push(perPage);
      });
    }
    if (brokenLinks.length > 0) {
      const report = brokenLinks
        .map((link) => {
          const statusText = link.status ? `Status: ${link.status}` : link.error;
          return `${link.url} (${statusText} via ${link.method || 'HEAD'}) on page ${link.page}`;
        })
        .join('\n');
      console.error(`❌ Found ${brokenLinks.length} broken links:\n${report}`);
      expect.soft(brokenLinks.length).toBe(0);
    } else {
      console.log('✅ All internal links are functional');
    }

    const summaryHtml = formatLinksSummaryHtml(pageSummaries, brokenLinks);
    const summaryMarkdown = formatLinksSummaryMarkdown(pageSummaries, brokenLinks);
    await attachSummary({
      baseName: 'internal-links-summary',
      htmlBody: summaryHtml,
      markdown: summaryMarkdown,
      setDescription: true,
    });
  });
});
