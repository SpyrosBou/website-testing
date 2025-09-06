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
   node run-tests.js --site=your-site-name
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
node run-tests.js --site=my-site --project="Chrome"
node run-tests.js --site=my-site --project="Firefox"
node run-tests.js --site=my-site --project="Safari"  # WebKit engine
```

## What Gets Tested

### Responsive Testing (Industry-Standard Approach)
- ✅ **Multi-Viewport Testing**: Each desktop browser tests mobile (375x667), tablet (768x1024), and desktop (1920x1080) viewports
- ✅ **Cross-Browser Coverage**: Chrome, Firefox, and Safari (macOS) for comprehensive engine testing
- ✅ Critical elements are visible across devices
- ✅ Mobile menu functionality
- ✅ **Visual Regression Detection** - Automatic screenshot comparison
- ✅ **Layout Change Alerts** - Pixel-level difference detection

### Browser Strategy
- **Desktop Browsers Only**: Uses Chrome, Firefox, Safari to simulate all viewport sizes
- **Why This Works**: Matches real-world responsive development and testing workflows
- **Real Mobile Testing**: For actual device testing, use cloud services (not covered by this suite)

### Functionality Testing
- ✅ No broken internal links
- ✅ JavaScript errors detection
- ✅ Form validation and submission
- ✅ Page load times
- ✅ HTTP status codes

## Test Results

- **HTML Report**: Each test run creates a site-specific report (e.g., `playwright-report-nfsmediation-local/index.html`)
- **Visual Diff Reports**: Side-by-side comparison of layout changes with pixel-level detection
- **Test Artifacts**: Screenshots, videos, and traces stored in `test-results/[site-name]/`
- **Console Output**: Shows exact report path to open after each run

### Viewing Reports
After tests complete, open the Playwright HTML report:
```bash
open playwright-report/index.html
📸 Screenshots and videos: ./test-results/
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

**Note**: HTML report is located at `playwright-report/index.html`. Test artifacts (videos/screenshots) are stored in `test-results/`.

## Browser Coverage

Tests run on:
- Desktop Chrome & Firefox
- Safari (WebKit engine)
- Mobile and tablet viewports via device profiles

## Troubleshooting

**"Site configuration not found"**: Ensure your `.json` file exists in `sites/` directory

**Tests hang**: Check your WordPress site is accessible and URLs are correct

**Form tests fail**: Update form selectors in your site configuration to match your WordPress theme

**JavaScript errors**: Review console output for specific error details

**Visual regression failures**: Run `npx playwright test --update-snapshots` to update baselines after intentional design changes
