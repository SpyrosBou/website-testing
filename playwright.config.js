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
  reporter: 'html',
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  use: {
    trace: 'retain-on-failure', // Changed: Create traces for failed tests (better debugging)
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },

  // Organize output by site/device/browser
  outputDir: process.env.SITE_OUTPUT_DIR || 'test-results',

  projects: [
    {
      name: 'Desktop Chrome',
      outputDir: 'desktop/chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Desktop Firefox',
      outputDir: 'desktop/firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    // Add Safari project only on macOS
    ...(isMacOS ? [{
      name: 'Desktop Safari',
      outputDir: 'desktop/safari',
      use: { 
        ...devices['Desktop Safari'],
        // Ensure we use the real Safari browser
        browserName: 'webkit',
        channel: undefined // Use system Safari, not Playwright's bundled webkit
      },
    }] : []),
    {
      name: 'Mobile Chrome',
      outputDir: 'mobile/chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      outputDir: 'mobile/safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'Tablet',
      outputDir: 'tablet/ipad',
      use: { ...devices['iPad Pro'] },
    }
  ],
});