const http = require('http');
const https = require('https');

const fetchFn = globalThis.fetch
  ? (...args) => globalThis.fetch(...args)
  : async (...args) => {
      const { default: fetch } = await import('node-fetch');
      return fetch(...args);
    };

const DEFAULT_MAX_PAGES = Number.POSITIVE_INFINITY;
const DEFAULT_MAX_DEPTH = Number.POSITIVE_INFINITY;

const parseLimit = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || trimmed === 'all' || trimmed === 'infinite' || trimmed === 'infinity') {
      return Number.POSITIVE_INFINITY;
    }
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric <= 0) return Number.POSITIVE_INFINITY;

  return Math.floor(numeric);
};

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function compilePatterns(patterns) {
  return ensureArray(patterns)
    .filter(Boolean)
    .map((pattern) => {
      if (pattern instanceof RegExp) return pattern;
      try {
        return new RegExp(pattern, 'i');
      } catch (_error) {
        const escaped = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(escaped, 'i');
      }
    });
}

function decodeXmlEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractLocs(xml) {
  const regex = /<loc>([^<]+)<\/loc>/gi;
  const locs = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    locs.push(decodeXmlEntities(match[1].trim()));
  }
  return locs;
}

function isSitemapIndex(xml) {
  return /<sitemapindex[\s>]/i.test(xml);
}

function normalizeToPath(urlString, baseUrl) {
  try {
    const url = new URL(urlString);
    const base = new URL(baseUrl);
    if (url.origin !== base.origin) {
      return null;
    }
    return url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`.replace(/\/+$/, '/');
  } catch (_error) {
    return null;
  }
}

async function fetchXml(url, redirectCount = 0) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_error) {
    parsed = null;
  }

  const allowInsecure =
    parsed &&
    parsed.protocol === 'https:' &&
    (/\.ddev\.site$/i.test(parsed.hostname) ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1');

  if (allowInsecure && parsed) {
    return await new Promise((resolve, reject) => {
      const lib = parsed.protocol === 'https:' ? https : http;
      const requestOptions = {
        method: 'GET',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}` || '/',
        headers: { 'User-Agent': 'wp-test-suite/1.0' },
      };
      if (parsed.protocol === 'https:') {
        requestOptions.rejectUnauthorized = false;
      }

      const req = lib.request(requestOptions, (res) => {
        const { statusCode = 0, headers } = res;
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          res.resume();
          if (redirectCount >= 5) {
            reject(new Error(`Too many redirects while fetching sitemap: ${url}`));
            return;
          }
          const nextUrl = new URL(headers.location, url).href;
          fetchXml(nextUrl, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (statusCode >= 400) {
          res.resume();
          reject(new Error(`Failed to fetch sitemap: ${url} (status ${statusCode})`));
          return;
        }

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf8'));
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${url} (status ${response.status})`);
  }
  return await response.text();
}

async function collectUrls(url, options, visited, depth) {
  if (depth > options.maxDepth || visited.has(url)) {
    return [];
  }
  visited.add(url);

  try {
    const xml = await fetchXml(url);
    const locs = extractLocs(xml);
    if (isSitemapIndex(xml)) {
      const results = [];
      for (const loc of locs) {
        if (results.length >= options.maxPages) break;
        const child = await collectUrls(loc, options, visited, depth + 1);
        results.push(...child);
        if (results.length >= options.maxPages) break;
      }
      return results;
    }
    return options.maxPages === Number.POSITIVE_INFINITY ? locs : locs.slice(0, options.maxPages);
  } catch (_error) {
    console.error(`⚠️  Unable to parse sitemap at ${url}: ${_error.message}`);
    return [];
  }
}

function filterAndNormalize(urls, baseUrl, includePatterns, excludePatterns, maxPages) {
  const normalized = [];
  for (const url of urls) {
    const path = normalizeToPath(url, baseUrl);
    if (!path) continue;
    if (excludePatterns.some((pattern) => pattern.test(path))) continue;
    if (includePatterns.length > 0 && !includePatterns.some((pattern) => pattern.test(path))) {
      continue;
    }
    normalized.push(path);
    if (normalized.length >= maxPages) break;
  }
  return normalized;
}

async function discoverFromSitemap(siteConfig, discoverConfig = {}) {
  const baseUrl = siteConfig.baseUrl;
  if (!baseUrl) {
    console.warn('⚠️  Cannot perform sitemap discovery without baseUrl');
    return [];
  }

  const sitemapUrl = discoverConfig.sitemapUrl || `${baseUrl.replace(/\/$/, '')}/sitemap.xml`;
  const resolvedMaxPages = parseLimit(discoverConfig.maxPages);
  const resolvedMaxDepth = parseLimit(discoverConfig.maxDepth);
  const options = {
    maxPages: resolvedMaxPages ?? DEFAULT_MAX_PAGES,
    maxDepth: resolvedMaxDepth ?? DEFAULT_MAX_DEPTH,
  };
  if (Number.isFinite(options.maxPages)) {
    console.log(
      `ℹ️  --discover: Limiting sitemap ingestion to ${options.maxPages} page(s) (discover.maxPages).`
    );
  }
  if (Number.isFinite(options.maxDepth)) {
    console.log(
      `ℹ️  --discover: Limiting sitemap traversal depth to ${options.maxDepth} level(s) (discover.maxDepth).`
    );
  }
  const includePatterns = compilePatterns(discoverConfig.include);
  const excludePatterns = compilePatterns(discoverConfig.exclude);

  const visited = new Set();
  const collected = await collectUrls(sitemapUrl, options, visited, 0);
  if (collected.length === 0) return [];

  const normalized = filterAndNormalize(
    collected,
    baseUrl,
    includePatterns,
    excludePatterns,
    options.maxPages
  );

  const unique = Array.from(new Set(normalized));

  if (unique.includes('/')) {
    const index = unique.indexOf('/');
    if (index > 0) {
      unique.splice(index, 1);
      unique.unshift('/');
    }
  } else {
    unique.unshift('/');
  }

  return unique;
}

module.exports = {
  discoverFromSitemap,
};
