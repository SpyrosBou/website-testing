const readline = require('readline');
const TestRunner = require('../utils/test-runner');
const SitemapParser = require('./core/sitemap-parser');
const { spawn, exec } = require('child_process');

class InteractiveMode {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Handle Ctrl+C gracefully
    this.rl.on('SIGINT', () => {
      console.log('\n\nGoodbye! 👋');
      process.exit(0);
    });
  }

  clearScreen() {
    // Use ANSI escape codes for better cross-platform compatibility
    process.stdout.write('\x1b[2J\x1b[0f');
  }

  async start() {
    this.clearScreen();
    console.log('🎯 WordPress Testing Suite - Interactive Mode\n');
    
    await this.showMainMenu();
  }

  async showMainMenu() {
    const { localSites, liveSites, otherSites } = TestRunner.listSites();
    let optionNumber = 1;
    const options = [];

    console.log('Available Sites:');
    
    // Local sites
    if (localSites.length > 0) {
      console.log('\n🏠 Local Development:');
      localSites.forEach(site => {
        console.log(`  ${optionNumber}. ${site.name} (${site.config.name})`);
        options.push({ type: 'site', site: site.name, config: site.config });
        optionNumber++;
      });
    }

    // Live sites  
    if (liveSites.length > 0) {
      console.log('\n🌐 Live Production:');
      liveSites.forEach(site => {
        console.log(`  ${optionNumber}. ${site.name} (${site.config.name})`);
        options.push({ type: 'site', site: site.name, config: site.config });
        optionNumber++;
      });
    }

    // Other sites
    if (otherSites.length > 0) {
      console.log('\n📝 Other Sites:');
      otherSites.forEach(site => {
        const displayName = site.config ? `${site.name} (${site.config.name})` : `${site.name} [Config Error]`;
        console.log(`  ${optionNumber}. ${displayName}`);
        options.push({ type: 'site', site: site.name, config: site.config });
        optionNumber++;
      });
    }

    // Configuration options
    console.log('\nConfiguration:');
    console.log(`  ${optionNumber}. Edit site configuration`);
    options.push({ type: 'edit-config' });
    optionNumber++;

    console.log(`  ${optionNumber}. Create new site configuration`);
    options.push({ type: 'new-config' });
    optionNumber++;

    // Utility options
    console.log('\nUtilities:');
    console.log(`  ${optionNumber}. Clean old reports/artifacts`);
    options.push({ type: 'clean' });
    optionNumber++;

    console.log(`  ${optionNumber}. View available reports`);
    options.push({ type: 'reports' });
    optionNumber++;

    console.log(`  ${optionNumber}. Help & documentation`);
    options.push({ type: 'help' });
    optionNumber++;

    console.log(`  ${optionNumber}. Exit`);
    options.push({ type: 'exit' });

    const choice = await this.getUserChoice(`\nEnter your choice (1-${optionNumber}, 'b' for back, 'q' to quit): `);
    
    // Handle back navigation (shouldn't happen at main menu, but just in case)
    if (choice === 'back') {
      return this.showMainMenu();
    }
    
    const selectedOption = options[choice - 1];

    if (!selectedOption) {
      console.log('Invalid choice. Please try again.\n');
      return this.showMainMenu();
    }

    await this.handleMainMenuChoice(selectedOption);
  }

  async handleMainMenuChoice(option) {
    switch (option.type) {
      case 'site':
        if (!option.config) {
          console.log('\n❌ Error: Site configuration could not be loaded.');
          await this.waitForEnter();
          return this.showMainMenu();
        }
        await this.showSiteMenu(option.site, option.config);
        break;
      case 'edit-config':
        await this.showEditConfigMenu();
        break;
      case 'new-config':
        await this.showNewConfigMenu();
        break;
      case 'clean':
        await this.showCleanMenu();
        break;
      case 'reports':
        await this.showReports();
        break;
      case 'help':
        await this.showHelp();
        break;
      case 'exit':
        console.log('\nGoodbye! 👋');
        process.exit(0);
        break;
    }
  }

  async showSiteMenu(siteName, siteConfig) {
    this.clearScreen();
    console.log(`🎯 Testing Options for: ${siteConfig.name}`);
    console.log(`🔗 URL: ${siteConfig.baseUrl}`);
    console.log(`📄 Pages: ${siteConfig.testPages.join(', ')}\n`);

    console.log('Test Options:');
    console.log('  1. Run full test suite (all tests)');
    console.log('  2. Run responsive tests only (visual regression)'); 
    console.log('  3. Run functionality tests only (links, JS, performance)');
    console.log('  4. Update visual baselines for this site');
    console.log('  5. Back to main menu');

    const choice = await this.getUserChoice('\nEnter your choice (1-5, \'b\' for back, \'q\' to quit): ');

    if (choice === 'back') {
      return this.showMainMenu();
    }

    switch (choice) {
      case 1:
        await this.runTests(siteName, {});
        break;
      case 2:
        await this.runTests(siteName, { responsive: true });
        break;
      case 3:
        await this.runTests(siteName, { functionality: true });
        break;
      case 4:
        await this.updateBaselines(siteName);
        break;
      case 5:
        return this.showMainMenu();
      default:
        console.log('Invalid choice. Please try again.\n');
        return this.showSiteMenu(siteName, siteConfig);
    }
  }

  async runTests(siteName, options) {
    this.clearScreen();
    console.log(`🚀 Running tests for: ${siteName}\n`);
    
    try {
      const result = await TestRunner.runTestsForSite(siteName, options);
      console.log('\n' + '='.repeat(50));
      console.log('✨ Test execution completed!');
      console.log(`📊 Report: ${result.reportFolder}/index.html`);
      console.log('='.repeat(50));
    } catch (error) {
      console.log('\n❌ Test execution failed.');
    }
    
    await this.waitForEnter();
    return this.showMainMenu();
  }

  async updateBaselines(siteName) {
    this.clearScreen();
    console.log(`📸 Updating visual baselines for: ${siteName}\n`);
    console.log('⚠️  This will replace existing baseline screenshots.');
    
    const confirm = await this.getUserChoice('Continue? (y/N): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      await this.waitForEnter();
      return this.showMainMenu();
    }
    
    try {
      await TestRunner.updateBaselines(siteName);
    } catch (error) {
      console.log('\n❌ Baseline update failed.');
    }
    
    await this.waitForEnter();
    return this.showMainMenu();
  }

  async showCleanMenu() {
    this.clearScreen();
    console.log('🧹 Cleanup Options:\n');
    
    console.log('  1. Clean old HTML reports (older than 7 days)');
    console.log('  2. Clean old test artifacts (older than 15 days)');
    console.log('  3. Clean ALL HTML reports');
    console.log('  4. Clean ALL test artifacts');
    console.log('  5. Back to main menu');

    const choice = await this.getUserChoice('\nEnter your choice (1-5, \'b\' for back, \'q\' to quit): ');

    if (choice === 'back' || choice === 5) {
      return this.showMainMenu();
    }

    let command;
    switch (choice) {
      case 1:
        command = 'npm run clean-old-reports';
        break;
      case 2:
        command = 'npm run clean-old-results';
        break;
      case 3:
        console.log('\n⚠️  This will delete ALL HTML reports.');
        const confirm1 = await this.getUserChoice('Continue? (y/N): ');
        if (confirm1.toLowerCase() === 'y' || confirm1.toLowerCase() === 'yes') {
          command = 'npm run clean-all-reports';
        }
        break;
      case 4:
        console.log('\n⚠️  This will delete ALL test artifacts.');
        const confirm2 = await this.getUserChoice('Continue? (y/N): ');
        if (confirm2.toLowerCase() === 'y' || confirm2.toLowerCase() === 'yes') {
          command = 'npm run clean-all-results';
        }
        break;
      case 5:
        return this.showMainMenu();
      default:
        console.log('Invalid choice. Please try again.\n');
        return this.showCleanMenu();
    }

    if (command) {
      console.log(`\nRunning: ${command}\n`);
      await this.runCommand(command);
    }
    
    await this.waitForEnter();
    return this.showMainMenu();
  }

  async showReports() {
    this.clearScreen();
    console.log('📊 Recent Test Reports:\n');
    
    await this.runCommand('find . -name "playwright-report-*" -type d | head -10 | sort -r');
    
    console.log('\nTo open a report, use: open [report-folder]/index.html');
    
    await this.waitForEnter();
    return this.showMainMenu();
  }

  async showHelp() {
    this.clearScreen();
    console.log('📖 WordPress Testing Suite Help\n');
    
    console.log('This interactive tool helps you test WordPress sites with:');
    console.log('• Visual regression testing (screenshots comparison)');
    console.log('• Functionality testing (links, JavaScript, performance)');
    console.log('• Cross-browser testing (Chrome, Firefox, Safari)');
    console.log('• Responsive design testing (desktop, tablet, mobile)\n');
    
    console.log('Quick Tips:');
    console.log('• Run full tests monthly or after major changes');
    console.log('• Update baselines after intentional design changes');
    console.log('• Check HTML reports for detailed error information');
    console.log('• Clean old reports regularly to save disk space\n');
    
    console.log('CLI equivalent commands:');
    console.log('• node run-tests.js --site=sitename');
    console.log('• node run-tests.js --site=sitename --responsive'); 
    console.log('• node run-tests.js --site=sitename --functionality');
    console.log('• npx playwright test --update-snapshots');
    
    await this.waitForEnter();
    return this.showMainMenu();
  }

  async runCommand(command) {
    return new Promise((resolve) => {
      // Use exec for simple commands to avoid stdio conflicts
      exec(command, (error, stdout, stderr) => {
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        resolve(error ? error.code || 1 : 0);
      });
    });
  }

  async getUserChoice(prompt) {
    return new Promise((resolve) => {
      // Check if stdin is still open and is a TTY
      if (this.rl.closed || !process.stdin.isTTY) {
        console.log(prompt);
        resolve('q'); // Auto-exit when not interactive
        return;
      }
      
      this.rl.question(prompt, (answer) => {
        const input = answer.trim();
        
        // Handle special keys
        if (input === 'q' || input === 'Q') {
          console.log('\nExiting without saving...');
          process.exit(0);
        }
        
        if (input === 'b' || input === 'B' || input === 'back' || input === 'BACK') {
          this.clearScreen();
          resolve('back');
          return;
        }
        
        const num = parseInt(input);
        if (!isNaN(num)) {
          resolve(num);
        } else {
          resolve(input);
        }
      });
    });
  }

  async waitForEnter() {
    return new Promise((resolve) => {
      // Check if stdin is still open and is a TTY
      if (this.rl.closed || !process.stdin.isTTY) {
        console.log('\nPress Enter to continue...');
        resolve();
        return;
      }
      
      this.rl.question('\nPress Enter to continue...', () => {
        resolve();
      });
    });
  }

  async showEditConfigMenu() {
    this.clearScreen();
    console.log('📝 Edit Site Configuration\n');
    
    const { localSites, liveSites, otherSites } = TestRunner.listSites();
    const allSites = [...localSites, ...liveSites, ...otherSites];
    
    if (allSites.length === 0) {
      console.log('No site configurations found to edit.');
      await this.waitForEnter();
      return this.showMainMenu();
    }
    
    console.log('Select a site to edit:');
    allSites.forEach((site, index) => {
      const displayName = site.config ? `${site.name} (${site.config.name})` : `${site.name} [Config Error]`;
      console.log(`  ${index + 1}. ${displayName}`);
    });
    
    console.log(`  ${allSites.length + 1}. Back to main menu`);
    
    const choice = await this.getUserChoice(`\nEnter your choice (1-${allSites.length + 1}, 'b' for back, 'q' to quit): `);
    
    if (choice === 'back' || choice === allSites.length + 1) {
      return this.showMainMenu();
    }
    
    const selectedSite = allSites[choice - 1];
    if (!selectedSite || !selectedSite.config) {
      console.log('Invalid choice or site configuration error.');
      await this.waitForEnter();
      return this.showEditConfigMenu();
    }
    
    await this.editSiteConfig(selectedSite.name, selectedSite.config);
  }

  async editSiteConfig(siteName, config) {
    const fs = require('fs');
    const path = require('path');
    
    this.clearScreen();
    console.log(`✏️  Editing: ${config.name} (${siteName})\n`);
    
    console.log('What would you like to edit?');
    console.log('  1. Site name');
    console.log('  2. Base URL');
    console.log('  3. Pages to test');
    console.log('  4. View current configuration');
    console.log('  5. Save and back to menu');
    
    const choice = await this.getUserChoice('\nEnter your choice (1-5, \'b\' for back, \'q\' to quit): ');
    
    if (choice === 'back') {
      return this.showMainMenu();
    }
    
    switch (choice) {
      case 1:
        const newName = await this.getUserChoice(`Current name: "${config.name}"\nEnter new name: `);
        if (newName.trim()) {
          config.name = newName.trim();
          console.log('✅ Site name updated.');
        }
        break;
        
      case 2:
        const newUrl = await this.getUserChoice(`Current URL: "${config.baseUrl}"\nEnter new URL: `);
        if (newUrl.trim()) {
          config.baseUrl = newUrl.trim();
          console.log('✅ Base URL updated.');
        }
        break;
        
      case 3:
        await this.editTestPages(config);
        break;
        
      case 4:
        console.log('\nCurrent Configuration:');
        console.log(JSON.stringify(config, null, 2));
        await this.waitForEnter();
        break;
        
      case 5:
        // Save configuration
        try {
          const configPath = path.join(process.cwd(), 'sites', `${siteName}.json`);
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
          console.log('✅ Configuration saved successfully!');
          await this.waitForEnter();
          return this.showMainMenu();
        } catch (error) {
          console.log(`❌ Error saving configuration: ${error.message}`);
          await this.waitForEnter();
        }
        break;
        
      default:
        console.log('Invalid choice.');
        await this.waitForEnter();
    }
    
    return this.editSiteConfig(siteName, config);
  }

  async editTestPages(config) {
    this.clearScreen();
    console.log('📄 Edit Test Pages\n');
    
    console.log('Current pages to test:');
    config.testPages.forEach((page, index) => {
      console.log(`  ${index + 1}. ${page}`);
    });
    
    console.log('\nOptions:');
    console.log('  1. Add new page');
    console.log('  2. Remove page');
    console.log('  3. Auto-discover pages from sitemap');
    console.log('  4. Back to site config');
    
    const choice = await this.getUserChoice('\nEnter your choice (1-4, \'b\' for back, \'q\' to quit): ');
    
    if (choice === 'back') {
      return;
    }
    
    switch (choice) {
      case 1:
        const newPage = await this.getUserChoice('Enter new page path (e.g., /about-us): ');
        if (newPage.trim()) {
          const pagePath = newPage.trim().startsWith('/') ? newPage.trim() : `/${newPage.trim()}`;
          if (!config.testPages.includes(pagePath)) {
            config.testPages.push(pagePath);
            console.log(`✅ Added page: ${pagePath}`);
          } else {
            console.log('Page already exists in the list.');
          }
          await this.waitForEnter();
        }
        break;
        
      case 2:
        if (config.testPages.length === 0) {
          console.log('No pages to remove.');
          await this.waitForEnter();
          break;
        }
        
        console.log('\nSelect page to remove:');
        config.testPages.forEach((page, index) => {
          console.log(`  ${index + 1}. ${page}`);
        });
        
        const removeChoice = await this.getUserChoice(`\nEnter page number to remove (1-${config.testPages.length}): `);
        if (removeChoice >= 1 && removeChoice <= config.testPages.length) {
          const removedPage = config.testPages.splice(removeChoice - 1, 1)[0];
          console.log(`✅ Removed page: ${removedPage}`);
        } else {
          console.log('Invalid page number.');
        }
        await this.waitForEnter();
        break;
        
      case 3:
        await this.autoDiscoverPages(config);
        break;
        
      case 4:
        return;
        
      default:
        console.log('Invalid choice.');
        await this.waitForEnter();
    }
    
    return this.editTestPages(config);
  }

  async autoDiscoverPages(config) {
    console.log('\n🔍 Auto-discovering pages from sitemap...');
    console.log('This will replace your current test pages list.');
    
    const confirm = await this.getUserChoice('Continue? (y/N): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      await this.waitForEnter();
      return;
    }
    
    try {
      console.log('\n📡 Discovering pages from sitemap...');
      const discoveredPages = await SitemapParser.discoverPages(config.baseUrl, { 
        maxPages: 30,
        verbose: true
      });
      
      if (discoveredPages.length > 0) {
        const oldCount = config.testPages.length;
        config.testPages = discoveredPages;
        
        console.log(`\n✅ Auto-discovery complete!`);
        console.log(`   Old pages: ${oldCount}`);
        console.log(`   New pages: ${discoveredPages.length}`);
        console.log('\nDiscovered pages:');
        discoveredPages.forEach(page => console.log(`   ${page}`));
      } else {
        console.log('⚠️  No pages found, keeping existing configuration');
      }
    } catch (error) {
      console.log(`❌ Auto-discovery failed: ${error.message}`);
    }
    
    await this.waitForEnter();
  }

  async showNewConfigMenu() {
    this.clearScreen();
    console.log('🆕 Create New Site Configuration\n');
    
    const siteName = await this.getUserChoice('Enter site configuration name (e.g., mysite-local): ');
    if (!siteName.trim()) {
      console.log('Site name cannot be empty.');
      await this.waitForEnter();
      return this.showMainMenu();
    }
    
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(process.cwd(), 'sites', `${siteName.trim()}.json`);
    
    if (fs.existsSync(configPath)) {
      console.log('❌ A configuration with this name already exists.');
      await this.waitForEnter();
      return this.showNewConfigMenu();
    }
    
    const displayName = await this.getUserChoice('Enter site display name: ');
    const baseUrl = await this.getUserChoice('Enter base URL (e.g., https://mysite.com): ');
    
    // Ask about sitemap auto-discovery
    console.log('\n🔍 Would you like to automatically discover pages from the sitemap?');
    const discoverPages = await this.getUserChoice('Auto-discover pages? (y/N): ');
    
    let testPages = ['/'];
    
    if (discoverPages.toLowerCase() === 'y' || discoverPages.toLowerCase() === 'yes') {
      try {
        console.log('\n📡 Discovering pages from sitemap...');
        const discoveredPages = await SitemapParser.discoverPages(baseUrl.trim(), { 
          maxPages: 20,
          verbose: true
        });
        
        if (discoveredPages.length > 1) {
          testPages = discoveredPages;
          console.log(`✅ Auto-discovered ${discoveredPages.length} pages:`);
          discoveredPages.forEach(page => console.log(`   ${page}`));
        } else {
          console.log('⚠️  No additional pages found, using homepage only');
        }
      } catch (error) {
        console.log(`❌ Auto-discovery failed: ${error.message}`);
        console.log('Using default pages: ["/"]');
      }
      
      await this.waitForEnter();
    }
    
    const newConfig = {
      name: displayName.trim() || siteName.trim(),
      baseUrl: baseUrl.trim(),
      testPages: testPages,
      criticalElements: [
        {
          name: "Main Navigation",
          selector: ".main-navigation, #main-menu, nav"
        },
        {
          name: "Header",
          selector: "header, .site-header"
        },
        {
          name: "Footer", 
          selector: "footer, .site-footer"
        }
      ]
    };
    
    try {
      fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
      console.log(`✅ Created new site configuration: ${siteName.trim()}.json`);
      console.log('You can now edit this configuration to add more test pages.');
    } catch (error) {
      console.log(`❌ Error creating configuration: ${error.message}`);
    }
    
    await this.waitForEnter();
    return this.showMainMenu();
  }

  close() {
    this.rl.close();
  }
}

module.exports = InteractiveMode;