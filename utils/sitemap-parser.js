const https = require('https');
const http = require('http');

class SitemapParser {
  
  static async discoverPages(baseUrl, options = {}) {
    const maxPages = options.maxPages || 50;
    const excludePatterns = options.excludePatterns || [
      '/wp-admin', '/wp-login', '/feed', '?', '#', '.xml', '.pdf', '.jpg', '.png', '.gif'
    ];
    
    console.log(`🔍 Discovering pages from sitemap: ${baseUrl}`);
    
    try {
      // Try multiple sitemap locations
      const sitemapUrls = [
        `${baseUrl}/sitemap.xml`,
        `${baseUrl}/sitemap_index.xml`,
        `${baseUrl}/wp-sitemap.xml`,
        `${baseUrl}/sitemap-index.xml`
      ];
      
      let allPages = [];
      
      for (const sitemapUrl of sitemapUrls) {
        try {
          console.log(`   Trying: ${sitemapUrl}`);
          const pages = await this.parseSitemap(sitemapUrl, baseUrl, excludePatterns);
          if (pages.length > 0) {
            allPages = pages;
            console.log(`✅ Found sitemap with ${pages.length} pages`);
            break;
          }
        } catch (error) {
          console.log(`   ❌ ${sitemapUrl} - ${error.message}`);
        }
      }
      
      if (allPages.length === 0) {
        console.log('⚠️  No sitemap found, using default pages');
        return ['/'];
      }
      
      // Limit results and ensure homepage is first
      let finalPages = allPages.slice(0, maxPages);
      if (!finalPages.includes('/')) {
        finalPages.unshift('/');
      }
      
      // Remove duplicates and sort
      finalPages = [...new Set(finalPages)].sort((a, b) => {
        if (a === '/') return -1;
        if (b === '/') return 1;
        return a.localeCompare(b);
      });
      
      console.log(`📄 Selected ${finalPages.length} pages for testing`);
      return finalPages;
      
    } catch (error) {
      console.log(`❌ Sitemap discovery failed: ${error.message}`);
      return ['/'];
    }
  }
  
  static async parseSitemap(sitemapUrl, baseUrl, excludePatterns) {
    const xml = await this.fetchUrl(sitemapUrl);
    const pages = [];
    
    // Check if this is a sitemap index (contains other sitemaps)
    if (xml.includes('<sitemapindex') || xml.includes('<sitemap>')) {
      console.log('   📑 Found sitemap index, parsing sub-sitemaps...');
      const subSitemaps = this.extractSubSitemaps(xml);
      
      for (const subSitemapUrl of subSitemaps.slice(0, 3)) { // Limit to 3 sub-sitemaps
        try {
          const subPages = await this.parseSitemap(subSitemapUrl, baseUrl, excludePatterns);
          pages.push(...subPages);
        } catch (error) {
          console.log(`   ⚠️  Failed to parse sub-sitemap: ${subSitemapUrl}`);
        }
      }
    } else {
      // Parse regular sitemap with URLs
      const urls = this.extractUrls(xml, baseUrl, excludePatterns);
      pages.push(...urls);
    }
    
    return pages;
  }
  
  static extractSubSitemaps(xml) {
    const sitemaps = [];
    const regex = /<loc>(.*?)<\/loc>/g;
    let match;
    
    while ((match = regex.exec(xml)) !== null) {
      const url = match[1].trim();
      if (url.includes('.xml')) {
        sitemaps.push(url);
      }
    }
    
    return sitemaps;
  }
  
  static extractUrls(xml, baseUrl, excludePatterns) {
    const pages = [];
    const regex = /<loc>(.*?)<\/loc>/g;
    let match;
    
    while ((match = regex.exec(xml)) !== null) {
      let url = match[1].trim();
      
      // Convert full URL to path
      if (url.startsWith(baseUrl)) {
        url = url.replace(baseUrl, '') || '/';
      } else if (url.startsWith('http')) {
        continue; // Skip external URLs
      }
      
      // Ensure path starts with /
      if (!url.startsWith('/')) {
        url = '/' + url;
      }
      
      // Apply exclusion filters
      const shouldExclude = excludePatterns.some(pattern => 
        url.includes(pattern) || url.toLowerCase().includes(pattern.toLowerCase())
      );
      
      if (!shouldExclude && url.length > 0) {
        pages.push(url);
      }
    }
    
    return pages;
  }
  
  static fetchUrl(url, maxRedirects = 3) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      
      // For local development sites, ignore SSL certificate errors
      const isLocalSite = url.includes('.local') || url.includes('localhost') || url.includes('127.0.0.1');
      
      const options = {
        timeout: 10000,
        headers: {
          'User-Agent': 'WordPress Testing Suite/1.0'
        }
      };
      
      // Ignore self-signed certificates for local development
      if (isLocalSite && client === https) {
        options.rejectUnauthorized = false;
      }
      
      const request = client.get(url, options, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          if (maxRedirects > 0) {
            const redirectUrl = response.headers.location.startsWith('http') 
              ? response.headers.location 
              : new URL(response.headers.location, url).href;
            this.fetchUrl(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
            return;
          } else {
            reject(new Error('Too many redirects'));
            return;
          }
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          resolve(data);
        });
      });
      
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
      
      request.on('error', (error) => {
        reject(error);
      });
    });
  }
  
  static validatePages(pages, baseUrl) {
    // Quick validation that pages look reasonable
    const validPages = pages.filter(page => {
      return page.startsWith('/') && 
             page.length > 0 && 
             page.length < 200 && // Reasonable path length
             !page.includes('..') && // No directory traversal
             !page.includes('//'); // No double slashes
    });
    
    return validPages;
  }
}

module.exports = SitemapParser;