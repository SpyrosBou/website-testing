const DEFAULT_ACCESSIBILITY_SAMPLE = 'all';

const ensureHomepageFirst = (pages = []) => {
  const filtered = Array.isArray(pages) ? pages.filter((page) => typeof page === 'string') : [];
  const unique = Array.from(new Set(filtered));

  if (unique.includes('/')) {
    const idx = unique.indexOf('/');
    if (idx > 0) {
      unique.splice(idx, 1);
      unique.unshift('/');
    }
  } else {
    unique.unshift('/');
  }

  return unique;
};

const parseSampleSetting = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === 'all') return 'all';

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric);
  }

  return null;
};

const resolveSampleSetting = (
  siteConfig,
  {
    envKey = 'A11Y_SAMPLE',
    configKeys = ['a11yResponsiveSampleSize'],
    defaultSize = DEFAULT_ACCESSIBILITY_SAMPLE,
    smokeSize = 1,
  } = {}
) => {
  if (process.env.SMOKE) return smokeSize;

  const envSetting = parseSampleSetting(process.env[envKey]);
  if (envSetting !== null) return envSetting;

  for (const key of configKeys) {
    const configSetting = parseSampleSetting(siteConfig?.[key]);
    if (configSetting !== null) return configSetting;
  }

  return defaultSize;
};

const selectAccessibilityTestPages = (siteConfig, options = {}) => {
  const pages = ensureHomepageFirst(siteConfig?.testPages || []);
  const sampleSetting = resolveSampleSetting(siteConfig, options);

  if (sampleSetting === 'all') {
    return pages;
  }

  return pages.slice(0, sampleSetting);
};

module.exports = {
  DEFAULT_ACCESSIBILITY_SAMPLE,
  ensureHomepageFirst,
  parseSampleSetting,
  resolveSampleSetting,
  selectAccessibilityTestPages,
};
