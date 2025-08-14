# WordPress Testing Suite

Automated testing suite for WordPress websites focusing on responsive design and functionality testing.

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
- ✅ Screenshots for visual comparison

### Functionality Testing
- ✅ No broken internal links
- ✅ JavaScript errors detection
- ✅ Form validation and submission
- ✅ Page load times
- ✅ HTTP status codes

## Test Results

- **HTML Report**: Run `npx playwright show-report` after tests
- **Screenshots**: Saved in `test-results/screenshots/`
- **Console Output**: Real-time test progress

## Browser Coverage

Tests run on:
- Desktop Chrome & Firefox
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12) 
- Tablet (iPad Pro)

## Troubleshooting

**"Site configuration not found"**: Ensure your `.json` file exists in `sites/` directory

**Tests hang**: Check your WordPress site is accessible and URLs are correct

**Form tests fail**: Update form selectors in your site configuration to match your WordPress theme

**JavaScript errors**: Review console output for specific error details