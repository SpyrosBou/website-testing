# WordPress Testing Suite - CLAUDE.md

This file provides guidance to Claude Code when working with this automated WordPress testing project.

## Project Purpose

This is an **automated website testing suite** specifically designed for WordPress sites. It performs comprehensive testing across different devices and browsers to verify functionality and responsive design.

## Key Concepts for Claude to Understand

### What This Testing Suite Does
- **Automated Quality Assurance**: Tests WordPress websites without human intervention
- **Cross-Device Testing**: Verifies sites work on desktop, tablet, and mobile
- **Functionality Verification**: Checks links, forms, JavaScript, and page loading
- **Visual Documentation**: Takes screenshots and videos of test runs
- **Fast Feedback**: Reports issues in minutes instead of hours of manual testing

### Technologies Used
- **Node.js**: JavaScript runtime for running the test automation
- **Playwright**: Browser automation tool that controls Chrome, Firefox, Safari
- **JSON Configurations**: Site-specific test instructions stored as files
- **Git**: Version control for the testing suite itself

## Architecture Overview

```
website-testing/
├── package.json              # Dependencies and scripts
├── playwright.config.js      # Browser and test configuration
├── run-tests.js             # Main test runner and CLI interface
├── sites/                   # Site-specific configurations
│   ├── *-local.json         # Local development site configs
│   ├── *-live.json          # Production site configs
│   └── example-site.json    # Template for new sites
├── tests/                   # Test implementation
│   ├── responsive.spec.js   # Layout and device testing
│   └── functionality.spec.js # Links, forms, JS errors, performance
├── utils/                   # Helper functions
│   └── site-loader.js       # Site configuration loading
└── test-results/            # Generated screenshots, videos, reports
```

## Common Commands and Usage

### Setup Commands
```bash
npm run setup                    # Install dependencies and browsers (run once)
```

### Testing Commands
```bash
node run-tests.js --list                        # Show all available sites
node run-tests.js --site=SITENAME               # Test specific site (all tests)
node run-tests.js --site=SITENAME --functionality   # Test only functionality
node run-tests.js --site=SITENAME --responsive      # Test only responsive + visual regression
node run-tests.js --site=SITENAME --project="Desktop Chrome"  # Single browser
node run-tests.js --site=SITENAME --project="Desktop Safari" # Real Safari (macOS only)
```

### Visual Regression Commands
```bash
npx playwright test --update-snapshots          # Update ALL visual baselines (after intentional changes)
npx playwright test --update-snapshots tests/responsive.spec.js  # Update only responsive baselines
node run-tests.js --site=SITENAME --responsive  # Run with visual regression comparison
```

### Report Viewing
```bash
# Each test run creates a timestamped HTML report - console output shows exact path
open playwright-report-2025-01-14T10-30-15/index.html  # Example timestamped report
```

### Cleanup Commands
```bash
# HTML Reports (timestamped, accumulate over time)
npm run clean-old-reports       # Delete HTML reports older than 7 days
npm run clean-all-reports       # Delete ALL HTML reports

# Test Artifacts (overwritten per site each run)
npm run clean-old-results       # Delete test results older than 15 days
npm run clean-videos            # Delete all video files
npm run clean-traces            # Delete all trace files
npm run clean-all-results       # Delete ALL test results
npm run clean-site-results      # Delete results for specific site: SITE=sitename npm run clean-site-results
```

## Site Configuration System

### Local vs Live Site Pattern
Each WordPress site should have TWO configurations:
- `sitename-local.json` - For Local by Flywheel development sites
- `sitename-live.json` - For production/staging sites

### Site Configuration Structure
```json
{
  "name": "Site Display Name",
  "baseUrl": "https://site-domain.com",
  "testPages": ["/", "/about", "/contact"],     // Pages to test
  "forms": [
    {
      "name": "Contact Form",
      "page": "/contact",                       // Page containing form
      "selector": ".wpcf7-form",                // CSS selector for form
      "fields": {                               // Form field selectors
        "name": "input[name*='name']",
        "email": "input[name*='email']",
        "message": "textarea[name*='message']"
      },
      "submitButton": "input[type='submit']"
    }
  ],
  "criticalElements": [                         // Must-have page elements
    {"name": "Navigation", "selector": ".main-navigation"},
    {"name": "Header", "selector": "header"},
    {"name": "Footer", "selector": "footer"}
  ]
}
```

## Current Known Sites

### Local Development Sites (Local by Flywheel)
- `nfsmediation-local` → https://nfsmediation.local
- `daygroup-local` → http://day.local  
- `ateliertheme-local` → http://ateliertheme.local
- `roladev-local` → http://roladev.atelierdev.local

### Live Production Sites
- `daygroup-live` → https://daygroup.co.uk
- `nfsmediation-live` → https://nfs.atelierdev.uk
- `roladev-live` → https://roladev.atelierdev.uk

## Test Types Explained

### Responsive Tests (`responsive.spec.js`)
**Purpose**: Verify website layouts work across different devices and detect visual regressions
**What it tests**:
- Page loading on desktop (1920x1080), tablet (768x1024), mobile (375x667)
- Critical elements visibility (navigation, header, footer)
- Mobile menu functionality
- **Visual Regression Testing**: Automatic screenshot comparison against baselines
- **Layout Change Detection**: Pixel-level comparison to catch visual breaking changes

**Visual Regression Features**:
- **Automatic Baseline Generation**: First run creates baseline screenshots
- **Pixel Difference Detection**: Highlights visual changes between test runs  
- **Threshold Tolerance**: Allows 30% difference for dynamic content
- **Cross-Browser Comparison**: Separate baselines for Chrome, Firefox, Safari
- **Diff Reports**: HTML reports show exactly what changed visually

**Typical runtime**: 6-10 minutes per site (slightly longer due to visual comparison)

### Functionality Tests (`functionality.spec.js`)  
**Purpose**: Verify website functionality works properly
**What it tests**:
- **Missing Pages**: Reports 404 errors clearly and skips further testing
- **Broken Links**: Finds internal links that lead to 404s
- **JavaScript Errors**: Detects console errors and page exceptions
- **Form Testing**: Validates contact forms work and have proper validation
- **Performance**: Measures page load times (5-second threshold)

**Typical runtime**: 2-4 minutes per site

## Common Issues and Solutions

### SSL Certificate Issues (Local Development)
**Problem**: Local by Flywheel uses self-signed SSL certificates
**Solution**: `ignoreHTTPSErrors: true` is configured in playwright.config.js
**Symptoms**: "SSL_ERROR_UNKNOWN" in Firefox, certificate errors

### Missing Pages (404 Handling)
**Problem**: Site configurations may list pages that don't exist
**Solution**: Tests now detect 404s immediately and skip further testing on those pages
**Good Behavior**: Reports missing pages clearly instead of timing out

### WordPress-Specific Considerations
- **Contact Forms**: Usually use Contact Form 7 (`.wpcf7-form` selectors)
- **Navigation**: WordPress themes vary widely in menu structure
- **Responsive**: Mobile menus often use `.menu-toggle` or `.hamburger` classes
- **Local Development**: Often redirects HTTP to HTTPS automatically

## Test Configuration Best Practices

### When Adding New Sites
1. **Create both configurations**: `sitename-local.json` and `sitename-live.json`
2. **Start with minimal pages**: Only test pages you KNOW exist (`/` is always safe)
3. **Use broad CSS selectors**: WordPress themes vary, so use multiple selector options
4. **Test incrementally**: Add pages gradually after confirming they exist

### Site Configuration Tips
- **testPages**: Start with `["/"]` and add pages after confirming they exist
- **forms**: Contact forms are usually on `/contact` or `/contact-us`
- **criticalElements**: Use multiple selector options: `".main-nav, #main-menu, nav"`
- **baseUrl**: Use HTTPS for local sites if they redirect, HTTP for older setups

## Troubleshooting Guide

### Tests Timing Out
**Before fix**: Usually meant pages didn't exist (404s) but test waited anyway
**After fix**: Should now report missing pages clearly and continue
**Still timing out?**: Check if site is actually accessible with `curl -I [url]`

### High Failure Rate
1. **Check site accessibility**: Can you browse the site manually?
2. **Verify page paths**: Do the pages in `testPages` actually exist?
3. **Check selectors**: Do the CSS selectors match the actual theme?
4. **Local vs Live**: Are you testing the right environment?

### Form Tests Failing
- **Check form selectors**: Inspect the actual form HTML
- **WordPress forms**: Contact Form 7, Gravity Forms, custom themes vary
- **JavaScript dependency**: Some forms need JS to load properly

## Development Workflow

### For Testing New Features
1. **Local Development**: Test with `sitename-local` configuration
2. **Deploy to Production**: Test with `sitename-live` configuration  
3. **Compare Results**: Ensure functionality is consistent between environments

### For Site Maintenance
1. **Regular Testing**: Run full test suite monthly or after major changes
2. **Quick Checks**: Use `--functionality` flag for fast issue detection
3. **Visual Regression**: Review screenshots in `test-results/` for layout changes

## File Management

### Generated Files (Gitignored)
- `test-results/` - Screenshots, videos, traces (overwritten per site each run)
- `playwright-report-*/` - Timestamped HTML reports (accumulate permanently)
- `node_modules/` - Dependencies

### File Organization
- **HTML Reports**: `playwright-report-YYYY-MM-DDTHH-MM-SS/` - Each test run creates a new timestamped folder
- **Test Artifacts**: `test-results/[site-name]/` - Latest run only, organized by site
- **Screenshots**: Used for visual regression baselines and failure debugging
- **Videos**: Recorded only on test failures for debugging
- **Traces**: Compressed debugging data for failed tests

### Version Controlled Files
- All configuration files (`sites/*.json`)
- Test implementations (`tests/*.spec.js`)
- Project configuration (`package.json`, `playwright.config.js`)
- Documentation (`README.md`, `CLAUDE.md`)

## Performance and Timing Expectations

### Expected Test Duration
- **Functionality only**: 2-4 minutes
- **Responsive only**: 6-8 minutes  
- **Full test suite**: 8-12 minutes
- **Single browser**: 25-40% faster

### Factors Affecting Speed
- **Number of pages**: More pages = longer runtime
- **Site performance**: Slow sites increase test time
- **Missing pages**: Now fast-fail instead of timeout
- **Network conditions**: Local tests faster than remote

## Integration Notes

### With macOS Safari
- **Automatic Detection**: Safari project only appears on macOS systems
- **Real Browser**: Uses actual Safari application, not WebKit simulation
- **Same Engine**: Tests against the same WebKit engine that macOS Safari users see
- **Not iOS Safari**: This is desktop Safari - mobile Safari still has iOS-specific differences

### With Local by Flywheel
- Sites automatically use HTTPS (self-signed certificates)
- Common local domains: `*.local`, `*.atelierdev.local`
- Must have `ignoreHTTPSErrors: true` for local testing

### With Production Sites
- Usually have valid SSL certificates
- May have caching that affects test consistency
- Performance testing more meaningful on live sites

## Claude-Specific Guidance

### When the User Asks About...
- **"Why is it slow?"** → Check if testing too many pages or browsers
- **"Tests are failing"** → Check for 404s first, then SSL issues, then visual regression changes
- **"How to add a new site?"** → Copy example-site.json and modify
- **"What's wrong with my forms?"** → Inspect actual HTML for correct selectors
- **"Visual tests are failing"** → Check if site layout actually changed, update baselines if intentional
- **"Where's my report?"** → Each test run creates `playwright-report-YYYY-MM-DDTHH-MM-SS/index.html` - check console output for exact path
- **"Reports are accumulating"** → Use `npm run clean-old-reports` to remove reports older than 7 days

### Common User Misconceptions
- **"Tests should pass everything"** → Tests SHOULD find issues, failures are valuable
- **"404 errors are bad"** → 404 detection is GOOD, prevents worse problems
- **"Local tests should be identical to live"** → Local/live differences are normal

### When Troubleshooting
1. **Start simple**: Test with `--functionality` flag first
2. **Check one page**: Temporarily set `testPages: ["/"]` 
3. **Verify manually**: Can you browse the site in a regular browser?
4. **Read the error messages**: The improved 404 handling gives clear feedback
5. **Visual regression failures**: Use `npx playwright test --update-snapshots` to update baselines after intentional changes

## Security Considerations

- **No sensitive data**: Test configurations should not contain passwords/API keys
- **Local development**: Self-signed certificates are expected and handled
- **Form testing**: Uses dummy data only ("test@example.com", "Test User")
- **Read-only operations**: Tests do not modify site content or database

Remember: This testing suite is designed to FIND problems, not hide them. A test failure usually means the site has an issue that needs attention, which is exactly what we want to discover.