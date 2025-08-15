# WordPress Testing Suite - CLAUDE.md

This file provides guidance to Claude Code when working with this automated WordPress testing project.

## Quick Navigation
- [Setup & Getting Started](#quick-start) - Installation and first test run
- [Common Commands](#common-commands) - Essential testing commands with examples
- [Site Configuration](#site-configuration) - How to add and configure new sites
- [Test Types](#test-types) - Functionality vs Responsive testing details
- [Interactive Mode](#interactive-mode) - Menu-driven interface for easier management
- [File Management](#file-management--architecture) - Understanding directory structure
- [Troubleshooting](#troubleshooting) - Solutions for common issues
- [Performance Expectations](#performance-expectations) - Realistic timing benchmarks
- [Best Practices](#best-practices-for-new-sites) - Configuration and workflow tips
- [Claude Guidance](#claude-specific-guidance) - AI assistant specific instructions

## ⚠️ IMPORTANT: Testing Development Guidelines

**ALWAYS consider standard industry practices for Playwright testing before implementing custom solutions:**

1. **Use Existing Libraries First**: Check for established npm packages (@axe-core/playwright, playwright-testing-library, @testing-library/dom) before writing custom test code
2. **Follow Semantic Testing**: Use `getByRole()`, `getByLabel()`, and other semantic queries instead of CSS selectors when possible  
3. **ARIA Compliance**: Test using accessibility patterns that match how users and screen readers interact with sites
4. **Industry Standards**: Reference Playwright documentation and Testing Library patterns for common functionality
5. **Don't Reinvent**: If testing functionality exists in the ecosystem, integrate it rather than building from scratch
6. **Follow Official Best Practices**: Always reference https://playwright.dev/docs/best-practices for current recommendations

**Agent Behavior Requirements:**
- **All subagents must be verbose and transparent** - Show analysis process, explain decision-making, narrate what you're examining and why
- **Think out loud** - Explain your thought process step-by-step rather than just providing conclusions
- **Show your work** - Detail what files you're reading, what patterns you're looking for, what you discover

**The goal is maintainable, standards-compliant testing that follows established patterns used across the industry.**

## Project Overview

### Purpose
This is an **automated website testing suite** specifically designed for WordPress sites. It performs comprehensive testing across different devices and browsers to verify functionality and responsive design.

### Key Capabilities
- **Automated Quality Assurance**: Tests WordPress websites without human intervention
- **Cross-Device Testing**: Verifies sites work on desktop, tablet, and mobile
- **Functionality Verification**: Checks links, forms, JavaScript, and page loading
- **Visual Regression Testing**: Screenshot comparison to detect layout changes
- **Accessibility Testing**: WCAG 2.1 AA compliance using @axe-core/playwright
- **Fast Feedback**: Reports issues in minutes instead of hours of manual testing

### Tech Stack
- **Node.js + Playwright**: Browser automation (Chrome, Firefox, Safari)
- **@axe-core/playwright**: Industry-standard accessibility testing
- **playwright-testing-library**: Semantic element queries
- **@testing-library/dom**: DOM testing utilities
- **allure-playwright**: Professional test reporting with charts and trends

## Quick Start

### Setup (One-time)
```bash
npm run setup                    # Install dependencies and browsers
```

### Common Commands
```bash
# Site testing
node run-tests.js --list                        # Show all available sites
# ✅ Expected: Lists all .json files in sites/ directory

node run-tests.js --site=SITENAME               # Test specific site (all tests)
# ✅ Expected: 10-14 minutes runtime, HTML report at playwright-report-SITENAME/

node run-tests.js --site=SITENAME --functionality   # Test only functionality
# ✅ Expected: 4-6 minutes runtime, tests broken links, JS errors, accessibility

node run-tests.js --site=SITENAME --responsive      # Test only responsive + visual regression
# ✅ Expected: 6-8 minutes runtime, generates/compares visual baselines

node run-tests.js --interactive                 # Interactive mode (menu-driven)
# ✅ Expected: Menu appears with numbered options for testing and configuration

# Browser-specific testing
node run-tests.js --site=SITENAME --project="Chrome"    # Single browser
# ✅ Expected: 25-40% faster than multi-browser, Chrome-only results

node run-tests.js --site=SITENAME --project="Firefox"   # Firefox only
node run-tests.js --site=SITENAME --project="Safari"    # Safari (macOS only)

# Visual regression
npx playwright test --update-snapshots          # Update ALL visual baselines
# ⚠️  Use after intentional layout changes only - overwrites version-controlled baselines
```

### Reports
```bash
# Allure reports (primary reporting system)
npm run allure-serve                    # Generate and serve report (auto-opens browser)
# ✅ Expected: Opens browser with professional charts, trends, step-by-step execution

npm run allure-report                   # Generate report only
# ✅ Expected: Generates allure-report/ directory, open manually with browser

# Backup HTML report (lightweight fallback)
open playwright-report/index.html       # Single unified HTML report
# ✅ Expected: Basic HTML report for quick debugging (when needed)
```

## Site Configuration
> **Quick Start**: See [Common Commands](#common-commands) for immediate testing commands  
> **Advanced**: See [Interactive Mode](#interactive-mode) for guided configuration management

### Configuration Files
Each WordPress site needs TWO configurations:
- `sitename-local.json` - Local by Flywheel development sites
- `sitename-live.json` - Production/staging sites

### Configuration Structure
```json
{
  "name": "Site Display Name",
  "baseUrl": "https://site-domain.com",
  "testPages": ["/", "/about", "/contact"],
  "forms": [
    {
      "name": "Contact Form",
      "page": "/contact",
      "selector": ".wpcf7-form",
      "fields": {
        "name": "input[name*='name']",
        "email": "input[name*='email']",
        "message": "textarea[name*='message']"
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

### Current Sites
**Local Development (Local by Flywheel):**
- `nfsmediation-local` → https://nfsmediation.local
- `daygroup-local` → http://day.local  
- `ateliertheme-local` → http://ateliertheme.local
- `roladev-local` → http://roladev.atelierdev.local

**Live Production:**
- `daygroup-live` → https://daygroup.co.uk
- `nfsmediation-live` → https://nfs.atelierdev.uk
- `roladev-live` → https://roladev.atelierdev.uk

## Test Types

### Functionality Tests (`functionality.spec.js`)
**Runtime: 4-6 minutes** (increased due to accessibility scanning)

Tests include:
- ✅ **Missing Pages**: Reports 404 errors and skips further testing
- ✅ **Broken Links**: Industry-standard link validation with rate limiting
- ✅ **JavaScript Errors**: Enhanced interactive testing using semantic queries
- ✅ **Form Testing**: Semantic field detection with validation patterns
- ✅ **Performance**: Page load times (3-second threshold)
- 🆕 **Accessibility**: WCAG 2.1 AA compliance using @axe-core/playwright

**Enhanced Features:**
- **Semantic Element Detection**: Uses `getByRole()`, `getByLabel()` over CSS selectors
- **ARIA-Compliant Testing**: Matches screen reader interaction patterns
- **Interactive JS Testing**: User interaction simulation (navigation, forms, modals, tabs)
- **Accessibility Reporting**: Detailed WCAG violations with help URLs
- **Soft Assertions**: Collects ALL broken links before failing

### Responsive Tests (`responsive.spec.js`)
**Runtime: 6-8 minutes** 

Tests include:
- **Multi-Viewport Testing**: Desktop (1920x1080), Tablet (768x1024), Mobile (375x667)
- **Critical Elements**: Navigation, header, footer visibility
- **Mobile Menu**: Functionality verification
- **Visual Regression**: Automatic screenshot comparison against baselines
- **Cross-Browser**: Separate baselines for Chrome, Firefox, Safari

**Visual Regression Features:**
- **Automatic Baseline Generation**: First run creates baseline screenshots
- **Pixel Difference Detection**: Highlights visual changes between runs
- **Threshold Tolerance**: 30% difference allowed for dynamic content
- **Site-Specific Organization**: Screenshots organized by site name
- **Diff Reports**: HTML reports show exactly what changed visually

## Interactive Mode

Access via: `node run-tests.js --interactive`

**Features:**
- **Site Testing**: Guided test execution with auto-cleanup
- **Configuration Management**: Create/edit site configurations
- **Auto-Discovery**: Find pages from sitemaps (up to 30 pages)
- **Cleanup Tools**: Manage old reports and artifacts
- **Visual Baseline Updates**: Site-specific baseline management

**Navigation:**
- Number keys for menu choices
- 'b' or 'back' to return to previous menu
- 'q' to quit
- Changes saved automatically

**Quick Workflow Example:**
1. `node run-tests.js --interactive`
2. Select "1" (Site Testing)  
3. Choose site from list
4. Select test type (functionality/responsive/both)
5. View results in generated report

## File Management & Architecture

### Directory Structure
```
website-testing/
├── package.json, playwright.config.js    # Configuration
├── run-tests.js                          # Main test runner
├── sites/*.json                          # Site configurations
├── tests/                                # Test implementations
│   ├── functionality.spec.js
│   └── responsive.spec.js
├── utils/                                # Core utilities
├── interactive-mode/                     # CLI interface
├── test-results/[site-name]/            # Test artifacts (per-site)
├── tests/baseline-snapshots/[site-name]/ # Visual baselines (version controlled)
└── allure-report/                        # Unified Allure HTML report
```

### File Organization
- **Test Artifacts**: `test-results/[site-name]/` - Latest run only, organized by site
- **Visual Baselines**: `tests/baseline-snapshots/[site-name]/` - Version controlled
- **Allure Data**: `allure-results/` - Raw test data from all sites (overwritten)
- **Allure Report**: `allure-report/` - Unified professional report (generated)
- **Backup HTML**: `playwright-report/` - Simple fallback report (when needed)

### Cleanup Commands
```bash
# Test artifacts
npm run clean-old-results       # Delete results older than 15 days
npm run clean-all-results       # Delete ALL test results
SITE=sitename npm run clean-site-results  # Delete specific site results

# Reports
npm run clean-allure           # Clean Allure results and reports
rm -rf playwright-report       # Clean backup HTML report (rarely needed)

# Visual baselines (careful - version controlled)
npx playwright test --update-snapshots  # Update ALL baselines after layout changes
```

## Troubleshooting

### Common Issues & Solutions

**Tests Timing Out:**
- Should now report missing pages clearly (404 detection improved)
- Check site accessibility: `curl -I [url]`
- Temporarily test single page: set `testPages: ["/"]`

**High Failure Rate:**
1. Verify site is accessible manually
2. Check if pages in `testPages` actually exist
3. Verify CSS selectors match the theme
4. Confirm testing correct environment (local vs live)

**Form Tests Failing:**
- Semantic queries tried first, falls back to CSS selectors automatically
- WordPress forms vary (Contact Form 7, Gravity Forms, custom themes)
- Some forms require JavaScript to load properly

**Accessibility Tests Failing:**
- Only critical/serious violations fail the test
- Review detailed console output for specific issues
- Check violation help URLs for remediation steps
- False positives are very rare with axe-core

**Visual Regression Failures:**
- Check if site layout actually changed
- Update baselines after intentional changes: `npx playwright test --update-snapshots`
- Review diff reports to see exactly what changed

**Common Error Messages:**
- `Error: locator.click: Target closed` → Usually indicates 404 or redirect issue
- `expect.toHaveScreenshot: Screenshot comparison failed` → Visual regression detected
- `TimeoutError: page.goto: Timeout 30000ms exceeded` → Site not accessible or very slow
- `Error: Accessibility violations found` → WCAG compliance issues detected

### WordPress-Specific Notes
- **Contact Forms**: Usually Contact Form 7 (`.wpcf7-form` selectors)
- **Navigation**: Themes vary widely in menu structure
- **Mobile Menus**: Often use `.menu-toggle` or `.hamburger` classes
- **Local Development**: Often redirects HTTP to HTTPS automatically
- **SSL Certificates**: Local by Flywheel uses self-signed certificates (`ignoreHTTPSErrors: true` configured)

## Performance Expectations

### Test Duration
- **Functionality only**: 4-6 minutes (increased due to accessibility scanning)
- **Responsive only**: 6-8 minutes
- **Full test suite**: 10-14 minutes
- **Single browser**: 25-40% faster

### Performance Benchmarks
**Expected Results by Site Size:**
- **Small sites (1-5 pages)**: 3-5 minutes functionality, 5-7 minutes full suite
- **Medium sites (6-15 pages)**: 6-10 minutes functionality, 10-15 minutes full suite  
- **Large sites (16+ pages)**: 12+ minutes functionality, 20+ minutes full suite

**Signs of Healthy Tests:**
- ✅ All pages load under 3 seconds
- ✅ 0 critical accessibility violations
- ✅ All internal links return 200 status
- ✅ Forms submit without JavaScript errors
- ✅ Visual regression differences under 30% threshold

### Browser Strategy (Industry Standard)
**✅ Desktop Browsers Only**: Chrome, Firefox, Safari test all viewport sizes
**✅ Multi-Viewport Testing**: Each browser tests mobile, tablet, desktop viewports
**✅ Real Engine Coverage**: Tests actual browser rendering differences

**Why This Works:**
- Matches real-world developer workflow
- Faster than device farm testing for layout validation
- Comprehensive coverage of browser engine differences

## Best Practices for New Sites

### Configuration Tips
1. **Create both configs**: `sitename-local.json` and `sitename-live.json`
2. **Start minimal**: Only test pages you KNOW exist (`/` is always safe)
3. **Use interactive mode**: Auto-discover pages from sitemaps
4. **Broad selectors**: Use multiple options for WordPress theme variations
5. **Test incrementally**: Add pages gradually after confirming they exist

### Sitemap Discovery
- **Auto-discovery**: Excludes WordPress demo content but includes dev pages
- **Security exclusions**: System pages (`/wp-admin`, `/wp-login`) always excluded
- **Custom exclusions**: Use flags like `--exclude-testimonials` for sites with many auto-generated pages
- **Page limits**: Configurable to prevent excessive test times

## Claude-Specific Guidance

### When Users Ask About...
- **"Why is it slow?"** → Accessibility testing adds 1-2 minutes; check page count and browser selection
- **"Tests are failing"** → Check 404s first, then accessibility violations, then SSL issues, then visual changes
- **"How to add a new site?"** → Use interactive mode: `node run-tests.js --interactive`
- **"Forms not working?"** → Enhanced semantic testing tries labels first, falls back automatically
- **"Visual tests failing?"** → Check if layout actually changed, update baselines if intentional
- **"Where's my report?"** → Run `npm run allure-report` for professional analysis

### Command Guidelines
Always provide both custom and standard Playwright commands:

```bash
# Our system (preferred):
node run-tests.js --site=SITENAME --functionality
# Standard Playwright equivalent:
SITE_NAME=SITENAME npx playwright test tests/functionality.spec.js
```

### Expected User Misconceptions
- **"Tests should pass everything"** → Tests SHOULD find issues; failures are valuable
- **"404 errors are bad"** → 404 detection is GOOD; prevents worse problems  
- **"Local tests should match live"** → Local/live differences are normal

### Troubleshooting Workflow
1. Start simple: `--functionality` flag first
2. Check one page: temporarily set `testPages: ["/"]`
3. Verify manually: browse site in regular browser
4. Read error messages: improved 404 handling gives clear feedback
5. Always use test runner: `node run-tests.js --site=SITENAME` for proper organization

## Security Notes
- **No sensitive data**: Test configurations should not contain passwords/API keys
- **Form testing**: Uses dummy data only ("test@example.com", "Test User")
- **Read-only operations**: Tests do not modify site content or database
- **Local certificates**: Self-signed certificates expected and handled

---

**Remember**: This testing suite is designed to FIND problems, not hide them. Test failures usually indicate real issues that need attention.