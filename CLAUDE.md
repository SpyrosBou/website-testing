# WordPress Testing Suite - CLAUDE.md

This file provides guidance to Claude Code when working with this automated WordPress testing project.

## Quick Navigation
- [Setup & Getting Started](#quick-start) - Installation and first test run
- [Common Commands](#common-commands) - Essential testing commands with examples
- [YAML Specification System](#yaml-specification-system) - **NEW**: Specification-driven testing architecture
- [WordPress Page Objects](#wordpress-page-objects) - **NEW**: Industry-standard page object pattern
- [Site Configuration](#site-configuration) - How to add and configure new sites
- [Test Types](#test-types) - Functionality vs Responsive testing details
- [Interactive Mode](#interactive-mode) - Menu-driven interface for easier management
- [File Management](#file-management--architecture) - Understanding directory structure
- [Troubleshooting](#troubleshooting) - Solutions for common issues (enhanced)
- [Performance Expectations](#performance-expectations) - Realistic timing benchmarks (updated)
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
This is a **professional-grade automated website testing suite** specifically designed for WordPress sites. It follows industry standards and best practices to provide comprehensive testing across different devices and browsers, with a focus on functionality, accessibility, and responsive design.

### Key Capabilities
- **Specification-Driven Testing**: YAML-based test specifications for maintainable, scalable testing
- **WordPress Page Objects**: Industry-standard page object pattern with semantic testing
- **Comprehensive Accessibility**: WCAG 2.1 AA compliance testing using @axe-core/playwright
- **Semantic Element Detection**: Uses `getByRole()`, `getByLabel()` following Testing Library patterns
- **Advanced Visual Regression**: Multi-viewport testing with intelligent thresholds
- **Cross-Device Testing**: Mobile (375x667), Tablet (768x1024), Desktop (1920x1080) viewports
- **WordPress-Optimized**: Specialized testing for WordPress themes, plugins, and patterns
- **Professional Reporting**: Allure integration with detailed analysis and debugging information
- **Fast Feedback**: Complete test suites run in 10-14 minutes with actionable results

### Tech Stack
- **Node.js + Playwright**: Browser automation (Chrome, Firefox, Safari)
- **@axe-core/playwright**: Industry-standard accessibility testing with WCAG 2.1 AA compliance
- **@testing-library/dom**: DOM testing utilities for semantic queries
- **playwright-testing-library**: Semantic element queries following Testing Library patterns
- **allure-playwright**: Professional test reporting with charts, trends, and step-by-step execution
- **js-yaml**: YAML specification system for test-driven development
- **WordPress Page Objects**: Industry-standard page object pattern implementation

## Quick Start

### Setup (One-time) - Enhanced Dependencies
```bash
npm run setup                    # Install dependencies and browsers
# Installs: @axe-core/playwright, @testing-library/dom, playwright-testing-library, js-yaml
# Sets up: YAML specification system, WordPress page objects, enhanced utilities
```

**New Dependencies Installed:**
- **@axe-core/playwright**: Industry-standard accessibility testing (WCAG 2.1 AA)
- **@testing-library/dom**: DOM testing utilities for semantic queries
- **playwright-testing-library**: Semantic element queries following Testing Library patterns
- **js-yaml**: YAML specification loading for test-driven development
- **Enhanced WordPress utilities**: Page objects, form detection, error handling

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

# Viewport-specific testing (responsive tests)
node run-tests.js --site=SITENAME --project="Chrome Mobile"    # Mobile viewport only
node run-tests.js --site=SITENAME --project="Chrome Tablet"    # Tablet viewport only
node run-tests.js --site=SITENAME --project="Chrome Desktop Large"  # Large desktop viewport

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

## YAML Specification System

### Overview
**NEW ARCHITECTURE**: Tests are now generated from YAML specifications, providing maintainable, scalable testing that follows industry standards. This specification-driven approach separates test logic from implementation details.

### Specification Categories (10 Total)
1. **Core Infrastructure** (3 specs)
   - `page-availability.yml` - Page availability and 404 handling with semantic detection
   - `response-validation.yml` - HTTP response validation and security headers
   - `performance-monitoring.yml` - Performance metrics with viewport-specific thresholds

2. **Navigation & UX** (2 specs)
   - `internal-links.yml` - Link validation with rate limiting and soft assertions
   - `critical-elements.yml` - WordPress page structure verification using page objects

3. **Interactive Elements** (2 specs)
   - `javascript-error-detection.yml` - JS error detection with semantic testing
   - `form-testing.yml` - Form validation with Contact Form 7/Gravity Forms support

4. **Accessibility** (1 spec)
   - `wcag-compliance.yml` - WCAG 2.1 AA compliance using @axe-core/playwright

5. **WordPress-Specific** (2 specs)
   - `plugin-compatibility.yml` - Plugin functionality and accessibility testing
   - `theme-elements.yml` - Theme responsiveness and component validation

### Specification Structure
```yaml
metadata:
  category: "core-infrastructure"
  description: "Page availability testing with WordPress-specific error handling"
  dependencies: ["wordpress-page-objects", "@axe-core/playwright"]

configuration:
  timeout: 30000
  retries: 1
  parallel: true

test_cases:
  - name: "page_availability_check"
    description: "Verify pages load or handle errors gracefully"
    execution:
      for_each_page: "{{siteConfig.testPages}}"
      steps:
        - action: "navigate_safely"
          target: "{{baseUrl}}{{currentPage}}"
        - action: "semantic_404_detection"
          using: "wordpress-page-objects"
```

### Working with Specifications
```bash
# View all specifications
ls specs/*/

# Understanding specification structure
cat specs/core-infrastructure/page-availability.yml

# Specifications are version-controlled and modify test behavior
# Tests are automatically generated from these specifications
```

## WordPress Page Objects

### Overview
**NEW ARCHITECTURE**: Industry-standard page object pattern implementation with semantic testing. Provides reusable, maintainable components for WordPress-specific testing following Testing Library principles.

### Page Object Components
- **WordPressPage**: Complete page object with all components
- **WordPressNavigation**: Navigation menus, mobile menus, accessibility
- **WordPressForm**: Contact Form 7, Gravity Forms, semantic field detection  
- **WordPressHeader**: Site header, logo, search functionality
- **WordPressFooter**: Footer links, copyright, widget areas
- **WordPressContent**: Main content, posts, pages, sidebar detection

### Semantic Testing Patterns
```javascript
// WordPress Page Objects use semantic queries (Testing Library pattern)
const wpPageObjects = new WordPressPageObjects(page, siteConfig);

// Navigation with semantic element detection
await wpPageObjects.navigate('https://site.com/page');
const is404 = await wpPageObjects.is404Page(); // Semantic 404 detection

// Form testing with automatic fallbacks
const form = wpPageObjects.createForm(siteConfig.forms[0]);
await form.fillForm({ name: 'Test User', email: 'test@example.com' });

// Critical element verification
const elements = await wpPageObjects.verifyCriticalElements();
// Returns: { header: true, navigation: true, content: true, footer: true }
```

### WordPress-Specific Features
- **Contact Form 7 Support**: Automatic detection and testing
- **Gravity Forms Support**: Semantic field detection with fallbacks
- **Mobile Menu Testing**: Touch interactions and hamburger menu functionality
- **Theme Compatibility**: Supports block themes and classic themes
- **Plugin Detection**: WordPress plugin functionality verification
- **Accessibility Integration**: Built-in WCAG 2.1 AA checking methods

### Usage in Tests
All tests now use WordPress page objects for enhanced reliability:
```javascript
// Enhanced error handling with WordPress-specific detection
const response = await wpPageObjects.navigate(`${siteConfig.baseUrl}${testPage}`);
const is404 = await wpPageObjects.is404Page(); // Semantic detection vs CSS

// Form testing with semantic queries
const form = wpPageObjects.createForm(formConfig);
const field = form.getField('email'); // Uses getByRole('textbox', { name: /email/i })
```

## Site Configuration
> **Quick Start**: See [Common Commands](#common-commands) for immediate testing commands  
> **Advanced**: See [Interactive Mode](#interactive-mode) for guided configuration management
> **NEW**: WordPress Page Objects simplify configuration - semantic testing handles theme variations automatically

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
    {"name": "Main Navigation", "selector": ".main-navigation, #main-menu, nav"},
    {"name": "Header", "selector": "header, .site-header"},
    {"name": "Footer", "selector": "footer, .site-footer"}
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
**Runtime: 4-6 minutes** (increased due to comprehensive accessibility scanning)
**Generated from YAML specifications** - 10 comprehensive test cases

Tests include:
- ✅ **Page Availability**: WordPress-aware 404 detection using semantic checking
- ✅ **HTTP Response Validation**: Content integrity and security header validation
- ✅ **Performance Monitoring**: Page load metrics with viewport-specific thresholds
- ✅ **Internal Links**: Industry-standard link validation with rate limiting (500ms delays)
- ✅ **Critical Elements**: WordPress page structure verification using page objects
- ✅ **JavaScript Error Detection**: Enhanced interactive testing with semantic queries
- ✅ **Form Testing**: Semantic field detection with Contact Form 7/Gravity Forms support
- ✅ **WCAG 2.1 AA Compliance**: Comprehensive accessibility testing using @axe-core/playwright
- ✅ **WordPress Plugin Testing**: Plugin compatibility and functionality verification
- ✅ **WordPress Theme Analysis**: Theme responsiveness and element validation

**Enhanced Features:**
- **YAML Specification-Driven**: Tests generated from maintainable YAML specifications
- **WordPress Page Objects**: Industry-standard page object pattern with semantic testing
- **Semantic Element Detection**: Uses `getByRole()`, `getByLabel()` following Testing Library patterns
- **ARIA-Compliant Testing**: Matches screen reader interaction patterns
- **Interactive JS Testing**: User interaction simulation (navigation, forms, modals, tabs)
- **Comprehensive Error Context**: Enhanced error tracking and debugging information
- **Accessibility Reporting**: Detailed WCAG violations with remediation guidance and help URLs
- **Soft Assertions**: Collects ALL issues before failing for complete analysis
- **WordPress-Specific Optimizations**: Enhanced form detection, theme compatibility, plugin testing

### Responsive Tests (`responsive.spec.js`)
**Runtime: 6-8 minutes** 
**66 Test Cases** across multiple viewports and browser configurations

Tests include:
- **Multi-Viewport Testing**: Mobile (375x667), Tablet (768x1024), Desktop (1920x1080)
- **Cross-Browser Responsive**: Chrome (all viewports), Firefox/Safari (desktop optimization)
- **Critical Elements**: WordPress page structure verification per viewport using page objects
- **Mobile Menu Testing**: Touch interaction and hamburger menu functionality
- **Form Responsiveness**: Touch interaction and accessibility across viewports
- **WordPress Responsive Patterns**: Gutenberg blocks, widgets, theme-specific behavior
- **Professional Visual Regression**: Component-level screenshot comparison with intelligent thresholds
- **Cross-Viewport Accessibility**: WCAG 2.1 AA compliance testing on mobile, tablet, desktop
- **Performance Testing**: Viewport-specific performance thresholds and optimization detection
- **WordPress Theme Compatibility**: Block themes vs classic themes responsive validation

**Enhanced Features:**
- **WordPress Page Objects Integration**: Semantic testing across all viewport sizes
- **Viewport-Specific Interactions**: Mobile (touch), Tablet (hybrid), Desktop (mouse/keyboard)
- **WordPress-Optimized Detection**: Multiple theme patterns, mobile menu selectors, plugin compatibility
- **Component-Level Screenshots**: Header, navigation, footer tested separately for granular regression detection
- **Intelligent Visual Thresholds**: 10% for UI elements, 30% for content, 50% for dynamic content
- **Cross-Browser Optimization Strategy**: Chrome tests all viewports, Firefox/Safari desktop only for performance
- **Mobile-First Progressive Enhancement**: Validation from mobile to desktop following responsive best practices
- **WordPress Security Testing**: Debug information exposure detection across viewports

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

**Advanced Features:**
- **Site Configuration Management**: Create and edit site configurations interactively
- **Sitemap Auto-Discovery**: Automatically find pages from XML sitemaps (up to 30 pages)
- **Visual Baseline Updates**: Update screenshot baselines for specific sites
- **Cleanup Utilities**: Manage old reports and test artifacts
- **Error Recovery**: Graceful handling with fallback to main menu

**Implementation Best Practices:**
- **Progress Feedback**: Shows what's happening during long operations
- **Clear Error Messages**: Explains what went wrong AND what to do next
- **Intuitive Navigation**: Consistent menu numbering with 'b' for back, 'q' for quit
- **State Persistence**: Auto-saves configuration changes immediately
- **Input Validation**: Handles edge cases and invalid input gracefully

## File Management & Architecture

### Directory Structure
```
website-testing/
├── package.json, playwright.config.js    # Configuration
├── run-tests.js                          # Main test runner
├── sites/*.json                          # Site configurations
├── specs/                                # YAML Test Specifications (NEW)
│   ├── templates/                        # Specification templates
│   ├── core-infrastructure/              # Page availability, response validation, performance
│   ├── navigation-ux/                    # Internal links, critical elements
│   ├── interactive-elements/             # JavaScript errors, form testing
│   ├── accessibility/                    # WCAG 2.1 AA compliance
│   ├── wordpress-specific/               # Plugin compatibility, theme elements
│   └── utils/                           # Specification utilities
│       ├── spec-loader.js               # YAML specification loader
│       └── spec-to-test-generator.js    # Test code generator
├── tests/                                # Playwright Test Implementations
│   ├── functionality.spec.js            # Generated from YAML specifications
│   └── responsive.spec.js               # Multi-viewport & visual regression
├── utils/                                # Enhanced Utilities
│   ├── test-helpers.js                  # Error handling, retry mechanisms
│   ├── site-loader.js                   # Site configuration loading
│   ├── test-data-factory.js             # Test data generation
│   ├── responsive-helpers.js            # Viewport and responsive utilities
│   ├── test-runner.js                   # Enhanced test execution
│   └── wordpress-page-objects.js        # WordPress-specific page objects (NEW)
├── interactive-mode/                     # CLI interface
├── test-results/[site-name]/            # Test artifacts (per-site)
├── tests/baseline-snapshots/[site-name]/ # Visual baselines (version controlled)
└── allure-report/                        # Unified Allure HTML report
```

### File Organization
- **YAML Specifications**: `specs/` - Test specifications organized by category (version controlled)
- **Test Artifacts**: `test-results/[site-name]/` - Latest run only, organized by site
- **Visual Baselines**: `tests/baseline-snapshots/[site-name]/` - Version controlled
- **Allure Data**: `allure-results/` - Raw test data from all sites (overwritten)
- **Allure Report**: `allure-report/` - Unified professional report (generated)
- **WordPress Page Objects**: `utils/wordpress-page-objects.js` - Reusable page components
- **Enhanced Utilities**: `utils/` - Test helpers with enhanced error handling and WordPress optimizations
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

### Common Issues & Solutions (Updated for Enhanced Architecture)

**Tests Timing Out:**
- WordPress page objects provide enhanced error handling and semantic 404 detection
- YAML specifications include timeout configurations per test type
- Check site accessibility: `curl -I [url]`
- Temporarily test single page: set `testPages: ["/"]`
- Check console output for WordPress-specific loading indicators

**High Failure Rate:**
1. Verify site is accessible manually
2. Check if pages in `testPages` actually exist (semantic 404 detection improved)
3. WordPress page objects handle theme variations automatically
4. Confirm testing correct environment (local vs live)
5. Review YAML specification configuration for timeout/retry settings

**Form Tests Failing:**
- **NEW**: WordPress page objects use semantic queries (getByRole, getByLabel) with automatic fallbacks
- Supports Contact Form 7, Gravity Forms, WPForms out of the box
- Enhanced form detection tries multiple WordPress form patterns
- JavaScript loading handled by WordPress page objects
- Check console output for specific form detection issues

**Accessibility Tests Failing:**
- **ENHANCED**: @axe-core/playwright provides comprehensive WCAG 2.1 AA testing
- Only critical/serious violations fail the test (moderate/minor logged as warnings)
- Review detailed console output with remediation guidance and help URLs
- False positives are very rare with axe-core industry-standard rules
- WordPress page objects include built-in accessibility checking methods

**WordPress Page Objects Issues:**
- **NEW**: If semantic queries fail, check theme compatibility
- WordPress page objects provide automatic fallbacks to CSS selectors
- Enhanced error context shows which detection method was used
- Check console output for specific page object component failures

**YAML Specification Issues:**
- **NEW**: Tests are generated from specifications in `specs/` directory
- If test behavior seems incorrect, check corresponding YAML specification
- Specification syntax errors will show during test generation
- Use `node run-tests.js --interactive` for guided specification management

**Visual Regression Failures:**
- WordPress page objects provide component-level screenshot testing
- Check if site layout actually changed (granular component detection)
- Update baselines after intentional changes: `npx playwright test --update-snapshots`
- Review diff reports to see exactly what changed (header, nav, footer, content separately)
- Intelligent thresholds account for dynamic WordPress content

**Common Error Messages (Enhanced):**
- `Error: locator.click: Target closed` → Usually indicates 404 or redirect issue (semantic detection improved)
- `expect.toHaveScreenshot: Screenshot comparison failed` → Visual regression detected (component-level details available)
- `TimeoutError: page.goto: Timeout 30000ms exceeded` → Site not accessible or very slow (WordPress loading indicators checked)
- `Error: Accessibility violations found` → WCAG compliance issues detected (detailed remediation guidance included)
- `WordPress page object not found` → Theme compatibility issue (fallback selectors available)
- `YAML specification error` → Specification syntax issue (check specs/ directory files)
- `Semantic query failed` → Element detection issue (automatic fallback to CSS selectors)

### WordPress-Specific Notes (Enhanced)
- **Contact Forms**: WordPress page objects auto-detect Contact Form 7, Gravity Forms, WPForms using semantic queries
- **Navigation**: Page objects handle theme variations automatically with multiple fallback selectors
- **Mobile Menus**: Enhanced detection for `.menu-toggle`, `.hamburger`, and touch interaction testing
- **Local Development**: WordPress page objects handle Local by Flywheel redirects and certificate issues
- **SSL Certificates**: Local by Flywheel uses self-signed certificates (`ignoreHTTPSErrors: true` configured)
- **WordPress Loading**: Page objects wait for jQuery, loading indicators, and WordPress-specific ready states
- **Plugin Compatibility**: YAML specifications include plugin-specific testing patterns
- **Theme Compatibility**: Page objects support both block themes and classic themes automatically
- **WordPress Security**: Enhanced detection for debug information exposure and security headers

## Performance Expectations

### Test Duration (Updated for Enhanced Testing)
- **Functionality only**: 4-6 minutes (includes comprehensive accessibility scanning with @axe-core)
- **Responsive only**: 6-8 minutes (includes 66 test cases across multiple viewports)
- **Full test suite**: 10-14 minutes (includes all 10 YAML specification-driven tests)
- **Single browser**: 25-40% faster (Chrome-only testing)
- **YAML Specification system**: Adds minimal overhead, improves maintainability

### Performance Benchmarks by Site Size
**Expected Results with Enhanced Testing:**
- **Small sites (1-5 pages)**: 4-6 minutes functionality, 6-8 minutes responsive, 10-14 minutes full suite
- **Medium sites (6-15 pages)**: 8-12 minutes functionality, 10-14 minutes responsive, 18-26 minutes full suite  
- **Large sites (16+ pages)**: 15+ minutes functionality, 18+ minutes responsive, 33+ minutes full suite

**Performance Factors:**
- **Accessibility scanning**: Adds 1-2 minutes per test run (comprehensive WCAG 2.1 AA)
- **WordPress Page Objects**: Minimal overhead, improves reliability
- **Semantic testing**: Slightly slower than CSS selectors, much more reliable
- **YAML specifications**: No runtime impact, improved maintainability
- **Enhanced error handling**: Better retry mechanisms may extend runtime for problematic sites

**Signs of Healthy Tests (Updated):**
- ✅ All pages load under viewport-specific thresholds (mobile: 3s, tablet: 2.5s, desktop: 2s)
- ✅ 0 critical/serious accessibility violations across all viewports (axe-core)
- ✅ All internal links return 200 status with rate-limited checking
- ✅ Forms submit without JavaScript errors using semantic field detection
- ✅ Mobile menu functional using WordPress page objects
- ✅ All critical WordPress page elements visible across viewports
- ✅ Visual regression differences under intelligent thresholds (10%-50% based on content type)
- ✅ WordPress plugins function correctly without accessibility violations
- ✅ WordPress themes responsive behavior validated across all viewports
- ✅ No WordPress debug information exposed in production

### Browser Strategy (Industry Standard - Enhanced)
**✅ Optimized Cross-Browser Testing**: Chrome tests all viewports (mobile, tablet, desktop), Firefox/Safari test desktop only for performance
**✅ Multi-Viewport Coverage**: Mobile (375x667), Tablet (768x1024), Desktop (1920x1080) with WordPress-optimized testing
**✅ Real Engine Coverage**: Tests actual browser rendering differences using WordPress page objects
**✅ Performance Optimized**: Reduced redundancy while maintaining comprehensive coverage
**✅ WordPress-Specific Optimization**: Theme and plugin compatibility testing across browsers
**✅ Accessibility Cross-Browser**: WCAG 2.1 AA compliance validated across all browser engines

**Enhanced Strategy Benefits:**
- Matches real-world developer workflow with WordPress-specific optimizations
- Faster than device farm testing while providing comprehensive WordPress validation
- WordPress page objects ensure consistent testing across all browser engines
- Semantic testing provides better cross-browser compatibility detection
- Accessibility testing validates screen reader compatibility across browsers

## Best Practices for New Sites

### Configuration Tips (Updated for Enhanced Architecture)
1. **Create both configs**: `sitename-local.json` and `sitename-live.json`
2. **Start minimal**: Only test pages you KNOW exist (`/` is always safe)
3. **Use interactive mode**: Auto-discover pages from sitemaps with WordPress-specific exclusions
4. **Leverage WordPress Page Objects**: Configuration simplified due to semantic testing
5. **Test incrementally**: Add pages gradually, WordPress page objects handle theme variations automatically
6. **Accessibility-First**: New sites benefit from built-in WCAG 2.1 AA testing
7. **YAML Specifications**: Understand that tests are generated from specifications for easier maintenance

### Sitemap Discovery
- **Multi-Format Support**: Handles sitemap.xml, sitemap_index.xml, wp-sitemap.xml
- **Auto-discovery**: Finds up to 30 pages with intelligent exclusions
- **WordPress-Specific Exclusions**: `/wp-admin`, `/wp-login`, `/wp-json`, demo content (`/hello-world/`, `/sample-page/`)
- **Content Filtering**: Excludes files (.pdf, .jpg), query parameters, system pages
- **Local Development**: SSL certificate bypass for .local domains
- **Fallback Strategy**: Multiple sitemap URL attempts with graceful degradation
- **Custom exclusions**: Use flags like `--exclude-testimonials` for sites with many auto-generated pages

## Claude-Specific Guidance

### When Users Ask About...
- **"Why is it slow?"** → Accessibility testing adds 1-2 minutes; YAML specifications add comprehensive coverage; check page count and browser selection
- **"Tests are failing"** → Check 404s first (semantic detection), then accessibility violations (axe-core), then JavaScript errors (page objects), then visual changes
- **"How to add a new site?"** → Use interactive mode: `node run-tests.js --interactive` (supports WordPress page object auto-detection)
- **"Forms not working?"** → WordPress page objects use semantic testing with Contact Form 7/Gravity Forms support and automatic fallbacks
- **"Visual tests failing?"** → Check if layout actually changed, page objects provide granular component testing, update baselines if intentional
- **"Where's my report?"** → Run `npm run allure-serve` for professional analysis with step-by-step execution details
- **"How do I modify tests?"** → Tests are generated from YAML specifications in `specs/` directory for easier maintenance
- **"Page objects not working?"** → WordPress page objects use semantic queries; check theme compatibility and CSS selector fallbacks
- **"Accessibility violations?"** → @axe-core provides detailed remediation guidance; only critical/serious violations fail tests

### Command Guidelines
Always provide both custom and standard Playwright commands, emphasizing YAML specification system:

```bash
# Our system (preferred - uses YAML specifications and WordPress page objects):
node run-tests.js --site=SITENAME --functionality
# Standard Playwright equivalent (bypasses YAML specifications):
SITE_NAME=SITENAME npx playwright test tests/functionality.spec.js

# For test maintenance (important for YAML specification system):
node run-tests.js --interactive  # Guided management of specifications and configurations
```

### Expected User Misconceptions (Updated)
- **"Tests should pass everything"** → Tests SHOULD find issues; YAML specifications designed to find real problems
- **"404 errors are bad"** → Semantic 404 detection is GOOD; prevents worse problems and provides better context
- **"Local tests should match live"** → Local/live differences are normal; WordPress page objects handle environment variations
- **"WordPress page objects are complex"** → Page objects simplify testing; semantic queries are more reliable than CSS selectors
- **"YAML specifications are overhead"** → Specifications improve maintainability and test reliability with minimal runtime impact
- **"Accessibility testing slows things down"** → WCAG 2.1 AA compliance is essential; 1-2 minute overhead prevents legal issues
- **"Semantic testing is slower"** → Slightly slower than CSS selectors, but much more reliable and maintainable

### Troubleshooting Workflow (Enhanced)
1. **Start simple**: `--functionality` flag first (uses YAML specifications and page objects)
2. **Check one page**: temporarily set `testPages: ["/"]` (semantic detection improved)
3. **Verify manually**: browse site in regular browser (compare with page object detection)
4. **Read error messages**: enhanced WordPress-specific error context and semantic detection feedback
5. **Check YAML specifications**: Review relevant specification files in `specs/` directory
6. **WordPress page object debugging**: Console output shows which detection methods succeeded/failed
7. **Interactive mode**: Use `node run-tests.js --interactive` for guided troubleshooting
8. **Always use test runner**: `node run-tests.js --site=SITENAME` for proper YAML specification and page object integration

## Security Notes
- **No sensitive data**: Test configurations should not contain passwords/API keys
- **Form testing**: Uses dummy data only ("test@example.com", "Test User")
- **Read-only operations**: Tests do not modify site content or database
- **Local certificates**: Self-signed certificates expected and handled

---

**Remember**: This testing suite is designed to FIND problems, not hide them. Test failures usually indicate real issues that need attention.