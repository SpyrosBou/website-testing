const fs = require('fs');

function parseJsonIfPossible(raw, contextLabel) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`${contextLabel} parse error: ${error.message}`);
    return null;
  }
}

function loadManifest() {
  const inline = process.env.SITE_RUN_MANIFEST_INLINE;
  if (inline) {
    const parsed = parseJsonIfPossible(inline, 'SITE_RUN_MANIFEST_INLINE');
    if (parsed) return parsed;
  }

  const manifestPath = process.env.SITE_RUN_MANIFEST;
  if (manifestPath) {
    try {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      const parsed = parseJsonIfPossible(raw, 'SITE_RUN_MANIFEST');
      if (parsed) {
        parsed.__path = manifestPath;
      }
      return parsed;
    } catch (error) {
      console.warn(`SITE_RUN_MANIFEST read error: ${error.message}`);
    }
  }

  return null;
}

function getManifestSummary() {
  const manifest = loadManifest();
  if (!manifest) return null;

  const pageCount = Array.isArray(manifest.pages) ? manifest.pages.length : 0;
  const projectCount = Array.isArray(manifest.projects) ? manifest.projects.length : 0;
  const specCount = Array.isArray(manifest.specs) ? manifest.specs.length : 0;

  return {
    manifest,
    pageCount,
    projectCount,
    specCount,
  };
}

module.exports = {
  loadManifest,
  getManifestSummary,
};

