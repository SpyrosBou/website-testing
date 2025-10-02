const { defineConfig, devices } = require('@playwright/test');
const os = require('os');

// Detect if Safari is available (macOS only)
const isMacOS = os.platform() === 'darwin';

module.exports = defineConfig({
  globalSetup: require.resolve('./scripts/playwright-global-setup'),
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    [
      'allure-playwright',
      {
        resultsDir: 'allure-results',
        suiteTitle: 'WordPress Testing Suite',
        detail: true,
        outputFolder: 'allure-report',
        environmentInfo: {
          framework: 'playwright',
          language: 'javascript',
          project_type: 'wordpress_testing',
        },
      },
    ],
    ['html', { open: 'never' }], // Lightweight backup HTML report
    ['list'], // Console output
  ],
  // Allow long-running accessibility sweeps without per-test limits
  timeout: 0,
  expect: {
    timeout: 15000,
  },

  // Industry-standard snapshot organization following Playwright best practices
  // Organize by test file, then test name, with browser-specific suffixes
  snapshotPathTemplate: '{testDir}/baseline-snapshots/{testFileDir}/{testFileName}/{arg}{ext}',
  use: {
    trace: 'retain-on-failure', // Changed: Create traces for failed tests (better debugging)
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },

  // Organize test artifacts by site/device/browser
  outputDir: 'test-results',

  projects: [
    // Desktop browsers (existing)
    {
      name: 'Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    // Add Safari project only on macOS
    ...(isMacOS
      ? [
          {
            name: 'Safari',
            use: {
              ...devices['Desktop Safari'],
              // Ensure we use the real Safari browser
              browserName: 'webkit',
              channel: undefined, // Use system Safari, not Playwright's bundled webkit
            },
          },
        ]
      : []),

    // Mobile viewport testing (Chrome only for performance)
    {
      name: 'Chrome Mobile',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 375, height: 667 }, // Standard mobile viewport
      },
    },

    // Tablet viewport testing (Chrome only for performance)
    {
      name: 'Chrome Tablet',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 768, height: 1024 }, // Standard tablet viewport
      },
    },

    // Large desktop testing (Chrome only)
    {
      name: 'Chrome Desktop Large',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }, // Large desktop viewport
      },
    },
  ],
});
