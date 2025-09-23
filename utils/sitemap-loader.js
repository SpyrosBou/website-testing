const fetchFn = globalThis.fetch
  ? (...args) => globalThis.fetch(...args)
  : async (...args) => {
      const { default: fetch } = await import('node-fetch');
      return fetch(...args);
    };

const DEFAULT_MAX_PAGES = 20;
const DEFAULT_MAX_DEPTH = 2;

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

async function fetchXml(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_error) {
    // Fallback to direct fetch if URL parsing fails for some reason
    parsed = null;
  }

  const allowInsecure =
    parsed &&
    parsed.protocol === 'https:' &&
    (/\.ddev\.site$/i.test(parsed.hostname) ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1');

  if (allowInsecure) {
    const hadOverride = Object.prototype.hasOwnProperty.call(
      process.env,
      'NODE_TLS_REJECT_UNAUTHORIZED'
    );
    const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    try {
      const response = await fetchFn(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch sitemap: ${url} (status ${response.status})`);
      }
      return await response.text();
    } finally {
      if (hadOverride) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
    }
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
    return locs.slice(0, options.maxPages);
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
  const options = {
    maxPages: discoverConfig.maxPages || DEFAULT_MAX_PAGES,
    maxDepth: discoverConfig.maxDepth || DEFAULT_MAX_DEPTH,
  };
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

  return Array.from(new Set(normalized));
}

module.exports = {
  discoverFromSitemap,
};
