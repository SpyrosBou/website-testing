const fs = require('fs');
const path = require('path');

class SiteLoader {
  static loadSite(siteName) {
    const sitePath = path.join(__dirname, '..', 'sites', `${siteName}.json`);

    if (!fs.existsSync(sitePath)) {
      throw new Error(`Site configuration not found: ${siteName}.json`);
    }

    try {
      const siteData = fs.readFileSync(sitePath, 'utf8');
      return JSON.parse(siteData);
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
