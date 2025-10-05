const fs = require('fs');
const path = require('path');
const { loadManifest } = require('./run-manifest');

class SiteLoader {
  static loadSite(siteName) {
    const sitePath = path.join(__dirname, '..', 'sites', `${siteName}.json`);

    if (!fs.existsSync(sitePath)) {
      throw new Error(`Site configuration not found: ${siteName}.json`);
    }

    try {
      const siteData = fs.readFileSync(sitePath, 'utf8');
      const parsedConfig = JSON.parse(siteData);

      const manifest = loadManifest();
      if (manifest && manifest.site && manifest.site.name === siteName) {
        if (Array.isArray(manifest.pages)) {
          parsedConfig.testPages = manifest.pages.filter((page) => typeof page === 'string');
        }
        if (manifest.site && manifest.site.baseUrl) {
          parsedConfig.baseUrl = manifest.site.baseUrl;
        }
        if (manifest.site && manifest.site.title) {
          parsedConfig.name = manifest.site.title;
        }
      } else {
        const overridePagesRaw = process.env.SITE_TEST_PAGES;
        if (overridePagesRaw) {
          try {
            const overridePages = JSON.parse(overridePagesRaw);
            if (Array.isArray(overridePages)) {
              parsedConfig.testPages = overridePages.filter((page) => typeof page === 'string');
            } else {
              console.warn('SITE_TEST_PAGES override ignored: value is not an array.');
            }
          } catch (overrideError) {
            console.warn(`SITE_TEST_PAGES override ignored: ${overrideError.message}`);
          }
        }
      }

      return parsedConfig;
    } catch (error) {
      throw new Error(`Error loading site configuration ${siteName}: ${error.message}`);
    }
  }

  static listAvailableSites() {
    const sitesDir = path.join(__dirname, '..', 'sites');
    if (!fs.existsSync(sitesDir)) {
      return [];
    }

    return fs
      .readdirSync(sitesDir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace('.json', ''));
  }

  static validateSiteConfig(config) {
    const required = ['name', 'baseUrl', 'testPages'];
    const missing = required.filter((field) => !config[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required fields in site config: ${missing.join(', ')}`);
    }

    return true;
  }
}

module.exports = SiteLoader;
