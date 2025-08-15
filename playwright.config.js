const { defineConfig, devices } = require('@playwright/test');
const os = require('os');

// Detect if Safari is available (macOS only)
const isMacOS = os.platform() === 'darwin';

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['allure-playwright', { 
      resultsDir: 'allure-results',
      suiteTitle: 'WordPress Testing Suite',
      detail: true,
      outputFolder: 'allure-report',
      environmentInfo: {
        framework: 'playwright',
        language: 'javascript',
        project_type: 'wordpress_testing'
      }
    }],
    ['html', { open: 'never' }],  // Lightweight backup HTML report
    ['list']  // Console output
  ],
  // Test timeout increased for better stability
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  
  // Custom snapshot directory and path template
  snapshotPathTemplate: '{testDir}/baseline-snapshots/{arg}{ext}',
  use: {
    trace: 'retain-on-failure', // Changed: Create traces for failed tests (better debugging)
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },

  // Organize test artifacts by site/device/browser
  outputDir: 'test-results',

  projects: [
    {
      name: 'Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    // Add Safari project only on macOS
    ...(isMacOS ? [{
      name: 'Safari',
      use: { 
        ...devices['Desktop Safari'],
        // Ensure we use the real Safari browser
        browserName: 'webkit',
        channel: undefined // Use system Safari, not Playwright's bundled webkit
      },
    }] : []),
  ],
});