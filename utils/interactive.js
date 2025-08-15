const readline = require('readline');
const TestRunner = require('./test-runner');
const { spawn } = require('child_process');

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

  async start() {
    console.clear();
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

    const choice = await this.getUserChoice(`\nEnter your choice (1-${optionNumber}): `);
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
    console.clear();
    console.log(`🎯 Testing Options for: ${siteConfig.name}`);
    console.log(`🔗 URL: ${siteConfig.baseUrl}`);
    console.log(`📄 Pages: ${siteConfig.testPages.join(', ')}\n`);

    console.log('Test Options:');
    console.log('  1. Run full test suite (all tests)');
    console.log('  2. Run responsive tests only (visual regression)'); 
    console.log('  3. Run functionality tests only (links, JS, performance)');
    console.log('  4. Update visual baselines for this site');
    console.log('  5. Back to main menu');

    const choice = await this.getUserChoice('\nEnter your choice (1-5): ');

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
    console.clear();
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
    console.clear();
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
    console.clear();
    console.log('🧹 Cleanup Options:\n');
    
    console.log('  1. Clean old HTML reports (older than 7 days)');
    console.log('  2. Clean old test artifacts (older than 15 days)');
    console.log('  3. Clean ALL HTML reports');
    console.log('  4. Clean ALL test artifacts');
    console.log('  5. Back to main menu');

    const choice = await this.getUserChoice('\nEnter your choice (1-5): ');

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
    console.clear();
    console.log('📊 Recent Test Reports:\n');
    
    await this.runCommand('find . -name "playwright-report-*" -type d | head -10 | sort -r');
    
    console.log('\nTo open a report, use: open [report-folder]/index.html');
    
    await this.waitForEnter();
    return this.showMainMenu();
  }

  async showHelp() {
    console.clear();
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
      const [cmd, ...args] = command.split(' ');
      const process = spawn(cmd, args, { stdio: 'inherit', shell: true });
      
      process.on('close', (code) => {
        resolve(code);
      });
    });
  }

  async getUserChoice(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        const num = parseInt(answer.trim());
        if (!isNaN(num)) {
          resolve(num);
        } else {
          resolve(answer.trim());
        }
      });
    });
  }

  async waitForEnter() {
    return new Promise((resolve) => {
      this.rl.question('\nPress Enter to continue...', () => {
        resolve();
      });
    });
  }

  close() {
    this.rl.close();
  }
}

module.exports = InteractiveMode;