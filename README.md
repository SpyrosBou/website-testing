# WordPress Testing Suite

Automated testing suite for WordPress websites with responsive design, functionality testing, and visual regression detection.

## Quick Start

1. **Setup**
   ```bash
   cd website-testing
   npm run setup
   ```

2. **Configure your site**
   - Copy `sites/example-site.json` to `sites/your-site-name.json`
   - Update the configuration with your WordPress site details

3. **Run tests**
   ```bash
   npm run test:site your-site-name
   ```

## Site Configuration

Create a JSON file in the `sites/` directory for each WordPress site you want to test:

```json
{
  "name": "My WordPress Site",
  "baseUrl": "https://mywordpresssite.com",
  "testPages": ["/", "/about", "/contact"],
  "forms": [
    {
      "name": "Contact Form",
      "page": "/contact",
      "selector": "#contact-form",
      "fields": {
        "name": "input[name='your-name']",
        "email": "input[name='your-email']",
        "message": "textarea[name='your-message']"
      },
      "submitButton": "input[type='submit']"
    }
  ],
  "criticalElements": [
    {"name": "Navigation", "selector": ".main-navigation"},
    {"name": "Header", "selector": "header"},
    {"name": "Footer", "selector": "footer"}
  ]
}
```

## Commands

```bash
# List available sites
node run-tests.js --list

# Test specific site
node run-tests.js --site=my-site

# Run only responsive tests
node run-tests.js --site=my-site --responsive

# Run only functionality tests  
node run-tests.js --site=my-site --functionality

# Run with browser visible (debugging)
node run-tests.js --site=my-site --headed

# Test specific browser
node run-tests.js --site=my-site --project="Mobile Chrome"
```

## What Gets Tested

### Responsive Testing
- ✅ Pages load correctly on desktop, tablet, mobile
- ✅ Critical elements are visible across devices
- ✅ Mobile menu functionality
- ✅ **Visual Regression Detection** - Automatic screenshot comparison
- ✅ **Layout Change Alerts** - Pixel-level difference detection

### Functionality Testing
- ✅ No broken internal links
- ✅ JavaScript errors detection
- ✅ Form validation and submission
- ✅ Page load times
- ✅ HTTP status codes

## Test Results

- **HTML Report**: Each test run creates a timestamped report (e.g., `playwright-report-2025-01-14T10-30-15/index.html`)
- **Visual Diff Reports**: Side-by-side comparison of layout changes with pixel-level detection
- **Test Artifacts**: Screenshots, videos, and traces stored in `test-results/[site-name]/`
- **Console Output**: Shows exact report path to open after each run

### Viewing Reports
After tests complete, the console will show exactly which report to open:
```bash
📊 View detailed report: open playwright-report-2025-01-14T10-30-15/index.html
📸 Screenshots and videos: ./test-results/nfsmediation-local/
```

### Managing Reports
```bash
# Clean old HTML reports (older than 7 days)
npm run clean-old-reports

# Clean all HTML reports
npm run clean-all-reports

# Clean old test artifacts (older than 15 days) 
npm run clean-old-results

# Clean all test artifacts
npm run clean-all-results
```

**Note**: HTML reports are timestamped and preserved permanently, while test artifacts (videos/screenshots) are overwritten each run per site.

## Browser Coverage

Tests run on:
- Desktop Chrome & Firefox
- **Desktop Safari** (macOS only - uses real Safari browser)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12) 
- Tablet (iPad Pro)

## Troubleshooting

**"Site configuration not found"**: Ensure your `.json` file exists in `sites/` directory

**Tests hang**: Check your WordPress site is accessible and URLs are correct

**Form tests fail**: Update form selectors in your site configuration to match your WordPress theme

**JavaScript errors**: Review console output for specific error details

**Visual regression failures**: Run `npx playwright test --update-snapshots` to update baselines after intentional design changes