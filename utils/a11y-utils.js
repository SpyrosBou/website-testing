const WCAG_TAG_PATTERN = /^wcag(\d{1,3})(a{1,3})$/i;

const WCAG_AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag2aaa',
  'wcag21a',
  'wcag21aa',
  'wcag21aaa',
  'wcag22a',
  'wcag22aa',
  'wcag22aaa',
];

function formatWcagVersion(raw) {
  if (!raw) return '2.0';
  if (raw === '2' || raw === '20') return '2.0';
  if (raw === '21') return '2.1';
  if (raw === '22') return '2.2';
  if (raw === '23') return '2.3';
  if (raw.length === 1) return `${raw}.0`;
  if (raw.length === 2) return `${raw[0]}.${raw.slice(1)}`;
  return raw;
}

function extractWcagLevels(tags = []) {
  const levelsByKey = new Map();

  for (const tag of tags) {
    const match = WCAG_TAG_PATTERN.exec(String(tag).toLowerCase());
    if (!match) continue;

    const version = formatWcagVersion(match[1]);
    const level = match[2].toUpperCase();
    const key = level;
    const parsedVersion = parseFloat(version);
    const numericVersion = Number.isNaN(parsedVersion) ? null : parsedVersion;
    const existing = levelsByKey.get(key);
    const existingNumeric = existing?.numericVersion ?? null;
    const shouldReplace =
      !existing ||
      (numericVersion !== null && (existingNumeric === null || numericVersion < existingNumeric));

    if (shouldReplace) {
      levelsByKey.set(key, {
        version,
        level,
        numericVersion,
      });
    }
  }

  return Array.from(levelsByKey.values()).map((entry) => ({
    version: entry.version,
    level: entry.level,
    label: `WCAG ${entry.version} ${entry.level}`,
  }));
}

function violationHasWcagCoverage(violation) {
  if (!violation || !Array.isArray(violation.tags)) return false;
  return extractWcagLevels(violation.tags).length > 0;
}

function formatWcagLabels(levels, options = {}) {
  const { asHtmlBadges = false } = options;
  if (!Array.isArray(levels) || levels.length === 0) {
    return asHtmlBadges ? '<span class="badge badge-neutral">No WCAG tag</span>' : 'No WCAG tag';
  }
  if (asHtmlBadges) {
    const badges = levels.map((level) => `<span class="badge badge-wcag">${level.label}</span>`);
    return badges.join(' ');
  }
  return levels.map((level) => level.label).join(', ');
}

module.exports = {
  WCAG_AXE_TAGS,
  extractWcagLevels,
  violationHasWcagCoverage,
  formatWcagLabels,
};
