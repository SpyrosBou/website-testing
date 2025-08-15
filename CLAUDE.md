# WordPress Testing Suite - CLAUDE.md

This file provides guidance to Claude Code when working with this automated WordPress testing project.

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
- **@axe-core/playwright**: Industry-standard accessibility testing (WCAG compliance)
- **playwright-testing-library**: Semantic element queries following Testing Library patterns
- **@testing-library/dom**: DOM testing utilities for better element interaction
- **allure-playwright**: Industry-standard test reporting with visual charts and historical tracking
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
├── utils/                   # Core utilities
│   ├── site-loader.js       # Site configuration loading
│   └── test-runner.js       # Test execution orchestration
├── interactive-mode/        # Interactive command-line interface
│   ├── README.md           # Interactive mode documentation
│   ├── interactive.js      # Main interactive interface
│   └── core/               # Interactive mode core functionality
│       └── sitemap-parser.js # Automatic page discovery from sitemaps
├── test-results/            # Site-specific test artifacts (organized by site)
│   ├── [site-name]/         # Per-site test execution artifacts
│   │   ├── *.png           # Failure screenshots
│   │   ├── *.webm          # Test videos (on failure)
│   │   └── *.zip           # Debug traces (on failure)
├── tests/baseline-snapshots/ # Visual regression baselines (version controlled)
│   ├── [site-name]/         # Per-site baseline screenshots
│   │   ├── home-desktop-chromium.png
│   │   ├── home-tablet-chromium.png
│   │   └── home-mobile-chromium.png
└── playwright-report-[site-name]/ # Site-specific HTML reports (overwritten per run)
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
node run-tests.js --site=SITENAME --project="Chrome"    # Single browser (Chrome)
node run-tests.js --site=SITENAME --project="Firefox"   # Single browser (Firefox)
node run-tests.js --site=SITENAME --project="Safari"    # Single browser (Safari - macOS only)
node run-tests.js --interactive                 # Start interactive mode (menu-driven interface)
```

### Configuration Commands
```bash
node run-tests.js --interactive                 # Use interactive mode for all site configuration
# Select "Edit site configuration" → "Pages to test" → "Auto-discover pages from sitemap"
```

### Visual Regression Commands
```bash
npx playwright test --update-snapshots          # Update ALL visual baselines (after intentional changes)
npx playwright test --update-snapshots tests/responsive.spec.js  # Update only responsive baselines
node run-tests.js --site=SITENAME --responsive  # Run with visual regression comparison
```

### Report Viewing

#### Allure Reports (Industry Standard)
```bash
npm run allure-serve                    # Generate and serve Allure report (auto-opens browser)
npm run allure-report                   # Generate Allure report and open in browser
npm run clean-allure                    # Clean up Allure files
```

**Allure Features:**
- **Visual charts and trends** - See test pass/fail rates over time
- **Step-by-step execution** - Detailed test flow with screenshots/videos
- **Interactive filtering** - Search and filter by status, duration, tags
- **Historical tracking** - Compare test runs and track improvements
- **Professional presentation** - Industry-standard format used by major companies
- **Clear error context** - No more confusing stack traces

### Cleanup Commands
```bash
# Allure Reports
npm run clean-allure            # Delete Allure results and reports

# Test Artifacts (site-specific, overwritten per run)
npm run clean-old-results       # Delete test results older than 15 days
npm run clean-videos            # Delete all video files
npm run clean-traces            # Delete all trace files
npm run clean-all-results       # Delete ALL test results
npm run clean-site-results      # Delete results for specific site: SITE=sitename npm run clean-site-results

# Visual Baselines (version controlled, update intentionally)
npx playwright test --update-snapshots  # Update ALL visual baselines after layout changes
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
- **Site-Specific Organization**: Screenshots organized by site name for better management
- **Diff Reports**: HTML reports show exactly what changed visually

**Typical runtime**: 6-10 minutes per site (slightly longer due to visual comparison)

## Browser Strategy and Architecture

### Industry-Standard Responsive Testing Approach
This testing suite follows **industry best practices** for responsive web testing:

**✅ Desktop Browsers Only**: 
- All testing runs in desktop browsers (Chrome, Firefox, Safari)
- Different viewport sizes are simulated within these browsers
- This is the standard approach used by most professional teams

**✅ Multi-Viewport Testing**:
- Each desktop browser tests all viewport sizes (mobile, tablet, desktop)
- `Chrome` tests: 375x667 (mobile), 768x1024 (tablet), 1920x1080 (desktop) 
- `Firefox` tests: Same viewports for cross-browser compatibility
- `Safari` tests: Same viewports for WebKit engine coverage (macOS only)

**✅ Why This Approach Works**:
- **Real-world usage**: Users resize desktop browsers to test responsiveness
- **Developer workflow**: Matches how developers test responsive design
- **Comprehensive coverage**: Tests layout AND browser engine differences
- **Performance**: Faster than real device testing for layout validation

**❌ Why We Don't Use "Mobile Browsers"**:
- Playwright's "mobile browsers" are desktop browsers with mobile user agents
- They don't provide meaningful additional coverage over viewport simulation
- Real mobile testing requires actual devices or cloud device farms
- Adds complexity without corresponding value

### Available Browser Projects
- **Chrome**: Chromium-based testing (most common browser engine)
- **Firefox**: Gecko engine testing (different rendering approach)  
- **Safari**: WebKit engine testing (macOS/iOS engine, macOS only)

### Functionality Tests (`functionality.spec.js`)  
**Purpose**: Verify website functionality works properly using industry-standard testing libraries
**What it tests**:
- **Missing Pages**: Reports 404 errors clearly and skips further testing
- **Broken Links**: Industry-standard link validation with soft assertions and rate limiting
- **JavaScript Errors**: Enhanced interactive testing using semantic queries to detect JS issues during user interactions
- **Form Testing**: Semantic form field detection with enhanced validation testing (invalid → valid email patterns)
- **Performance**: Measures page load times (3-second threshold)
- **Accessibility**: WCAG 2.1 AA compliance testing using @axe-core/playwright (NEW)

**Enhanced Features**:
- **Semantic Element Detection**: Uses `getByRole()`, `getByLabel()` instead of CSS selectors
- **ARIA-Compliant Testing**: Tests accessibility patterns matching screen readers
- **Interactive JS Testing**: Comprehensive user interaction simulation (navigation, forms, modals, tabs)
- **Standards-Based Validation**: Email validation patterns, form blur events, empty form submission testing
- **Accessibility Reporting**: Detailed WCAG violation reports with help URLs and impact levels
- **Soft Assertions**: Collects ALL broken links before failing (industry standard)

**Typical runtime**: 4-6 minutes per site (increased due to accessibility scanning and enhanced interactions)

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
5. **Auto-discover pages**: Use interactive mode to automatically find pages from sitemaps

### Site Configuration Tips
- **testPages**: Use interactive mode auto-discovery to find pages from sitemap
- **forms**: Contact forms are usually on `/contact` or `/contact-us`
- **criticalElements**: Use multiple selector options: `".main-nav, #main-menu, nav"`
- **baseUrl**: Use HTTPS for local sites if they redirect, HTTP for older setups

### Sitemap Discovery Best Practices
- **Default behavior**: Excludes WordPress demo content (`/hello-world/`, `/sample-page/`) but includes dev pages
- **Development pages**: Pages like `/block-playground/`, `/flexi-page/` are included by default (useful for testing)
- **Security exclusions**: System pages (`/wp-admin`, `/wp-login`) and file types are always excluded
- **Custom exclusions**: Use `--exclude-testimonials` or `--exclude-archives` for sites with many auto-generated pages
- **Minimal mode**: Use `--minimal` to only exclude security/system pages and include everything else

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
- **Semantic queries not working**: Form may lack proper labels - falls back to CSS selectors automatically
- **WordPress forms**: Contact Form 7, Gravity Forms, custom themes vary
- **JavaScript dependency**: Some forms need JS to load properly

### Accessibility Tests Failing
- **Critical/Serious violations**: Only these fail the test - review detailed console output
- **WCAG compliance**: Check violation help URLs for specific remediation steps
- **Common issues**: Missing alt text, insufficient color contrast, missing form labels
- **False positives**: Very rare with axe-core, usually indicates real accessibility problems

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
- `test-results/` - Site-specific test artifacts (overwritten per site each run)
- `playwright-report-*/` - Site-specific HTML reports (overwritten per site each run)
- `node_modules/` - Dependencies

### File Organization
- **HTML Reports**: `playwright-report-[site-name]/` - Each site gets its own report, overwritten per run
- **Test Artifacts**: `test-results/[site-name]/` - Latest run only, organized by site
- **Visual Baselines**: `tests/baseline-snapshots/[site-name]/` - Version controlled screenshot baselines
- **Screenshots**: Used for visual regression baselines and failure debugging
- **Videos**: Recorded only on test failures for debugging
- **Traces**: Compressed debugging data for failed tests

### Version Controlled Files
- All configuration files (`sites/*.json`)
- Test implementations (`tests/*.spec.js`)
- **Visual baselines** (`tests/baseline-snapshots/*/` - essential for visual regression testing)
- Project configuration (`package.json`, `playwright.config.js`)
- Documentation (`README.md`, `CLAUDE.md`)

## Performance and Timing Expectations

### Expected Test Duration (Updated for Standardized Testing)
- **Functionality only**: 4-6 minutes (increased due to accessibility scanning and enhanced interactions)
- **Responsive only**: 6-8 minutes (unchanged)  
- **Full test suite**: 10-14 minutes (increased due to new accessibility testing)
- **Single browser**: 25-40% faster

### New Test Results Structure
**Functionality Tests now include 4-5 test categories:**
- ✅ `broken-links` - Internal link validation
- ✅ `javascript-errors` - Enhanced interactive JS error detection  
- ✅ `page-performance` - Page load time validation
- 🆕 `accessibility` - WCAG 2.1 AA compliance testing
- ✅ `Contact Form` (or configured form name) - Enhanced semantic form testing

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

## Interactive Mode Features

### Menu-Driven Interface
The testing suite now includes an interactive command-line interface accessible via `node run-tests.js --interactive`:

**Main Features:**
- **Site Testing**: Choose from all available sites with guided options (auto-cleans orphaned processes)
- **Configuration Management**: Create and edit site configurations directly
- **Auto-Discovery**: Automatically find pages from sitemaps  
- **Cleanup Tools**: Manage old reports and test artifacts
- **Visual Baseline Updates**: Update screenshot baselines for specific sites

**Configuration Editing:**
- Edit existing site configurations through menu interface
- Add/remove test pages interactively
- Auto-discover pages from site sitemaps (up to 30 pages)
- Create new site configurations with guided prompts

**Page Auto-Discovery:**
- Automatically parse XML sitemaps (`/sitemap.xml`, `/sitemap_index.xml`)
- Filter out unwanted pages (admin, feeds, archives)
- Configurable page limits to prevent excessive test times
- Fallback to manual page entry if sitemap unavailable

### Navigation Tips
- Use number keys for menu choices
- Press 'b' or 'back' to return to previous menu
- Press 'q' to quit at any time
- All changes are saved automatically when exiting configuration editing

### Interactive Mode Process Management
- **Test Execution**: Interactive mode runs tests directly and automatically cleans up orphaned processes
- **Benefits**: Full automation with proper cleanup, no manual intervention needed
- **Process**: Select test → tests run → automatic cleanup → report ready

## Claude-Specific Guidance

### When the User Asks About...
- **"Why is it slow?"** → New accessibility testing adds 1-2 minutes, check if testing too many pages or browsers
- **"Tests are failing"** → Check for 404s first, then accessibility violations, then SSL issues, then visual regression changes
- **"How to add a new site?"** → Use interactive mode: `node run-tests.js --interactive` → "Create new site configuration"
- **"What's wrong with my forms?"** → Enhanced semantic testing tries labels first, falls back to selectors automatically
- **"Visual tests are failing"** → Check if site layout actually changed, update baselines if intentional
- **"Accessibility tests are failing"** → Review detailed violation reports, focus on critical/serious issues only
- **"Where's my report?"** → Each site creates `playwright-report-SITENAME/index.html` - one report per site, overwrites previous
- **"Reports are accumulating"** → Reports now overwrite per site - use `rm -rf playwright-report-*` to clean all if needed
- **"How to find pages automatically?"** → Use interactive mode auto-discovery feature

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
6. **Always use test runner**: Use `node run-tests.js --site=SITENAME` instead of direct `npx playwright test` for proper organization

## Command Reference for Claude

### Claude Command Guidelines
When providing commands to users, ALWAYS provide both:
1. **Our custom system command** (preferred)
2. **Default Playwright equivalent** (for understanding)

**Examples:**

Run responsive tests:
```bash
# Our system (preferred):
node run-tests.js --site=SITENAME --responsive
# Default Playwright equivalent:
SITE_NAME=SITENAME npx playwright test tests/responsive.spec.js
```

Update visual baselines:
```bash
# Our system (site-specific):
node run-tests.js --site=SITENAME --responsive  # First run to generate
# Default Playwright (all sites):
npx playwright test --update-snapshots
# Default Playwright (site-specific):
SITE_NAME=SITENAME npx playwright test tests/responsive.spec.js --update-snapshots
```

Test functionality only:
```bash
# Our system (preferred):
node run-tests.js --site=SITENAME --functionality
# Default Playwright equivalent:
SITE_NAME=SITENAME npx playwright test tests/functionality.spec.js
```

This helps users understand the relationship between our custom runner and standard Playwright commands.

## Security Considerations

- **No sensitive data**: Test configurations should not contain passwords/API keys
- **Local development**: Self-signed certificates are expected and handled
- **Form testing**: Uses dummy data only ("test@example.com", "Test User")
- **Read-only operations**: Tests do not modify site content or database

Remember: This testing suite is designed to FIND problems, not hide them. A test failure usually means the site has an issue that needs attention, which is exactly what we want to discover.