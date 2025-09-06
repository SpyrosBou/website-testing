# Tests - CLAUDE.md

This file provides Claude Code guidance for working within the **tests/** directory, which contains the actual Playwright test implementations that execute comprehensive WordPress website testing.

## Directory Purpose

The tests directory houses the core testing logic that validates WordPress sites across functionality, accessibility, and visual regression. These tests follow industry-standard practices using Playwright with semantic queries, accessibility tools, and modern testing patterns.

## Core Components

### functionality.spec.js - Comprehensive Functionality Testing
**Testing Scope:**
- **404 Detection & Reporting**: Identifies missing pages before attempting further tests
- **Broken Link Validation**: Industry-standard link checking with rate limiting
- **Enhanced JavaScript Error Detection**: Interactive element testing using semantic queries
- **Form Testing**: Semantic field detection with ARIA-compliant validation patterns
- **Performance Monitoring**: Page load time validation (3-second threshold)
- **WCAG 2.1 AA Accessibility Compliance**: Using @axe-core/playwright for automated accessibility testing

**Industry-Standard Patterns:**
- **Semantic Queries**: Uses `getByRole()`, `getByLabel()` over CSS selectors when possible
- **ARIA-Compliant Testing**: Matches screen reader interaction patterns
- **Soft Assertions**: Collects ALL issues before failing to provide comprehensive reports
- **Interactive Testing**: User interaction simulation (navigation, forms, modals, tabs)

### responsive.spec.js - Multi-Viewport & Visual Regression Testing
**Testing Scope:**
- **Multi-Viewport Testing**: Desktop (1920x1080), Tablet (768x1024), Mobile (375x667)
- **Critical Element Validation**: Navigation, header, footer visibility across viewports
- **Mobile Menu Functionality**: Touch/click interaction testing
- **Visual Regression Detection**: Automatic screenshot comparison against baselines
- **Cross-Browser Consistency**: Separate baselines for Chrome, Firefox, Safari

**Visual Testing Features:**
- **Automatic Baseline Generation**: First run creates baseline screenshots
- **Pixel Difference Detection**: 30% threshold tolerance for dynamic content
- **Site-Specific Organization**: Screenshots organized by site name and viewport
- **Full-Page Capture**: Complete page screenshots including below-the-fold content

## Testing Architecture Best Practices

### Playwright Testing Standards

**Always Follow These Patterns:**
```javascript
// 1. Use semantic queries first
const button = page.getByRole('button', { name: 'Submit' });
// Fallback to CSS selectors only when semantic queries aren't possible
const fallback = page.locator('.submit-button');

// 2. Include proper wait strategies
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(2000); // Only when necessary for animations

// 3. Handle missing pages gracefully
if (response?.status() >= 400) {
  console.log(`⚠️  Skipping tests for missing page: ${testPage} (${response.status()})`);
  return; // Exit test gracefully, don't fail
}
```

### Accessibility Testing Integration

**WCAG 2.1 AA Compliance Testing:**
```javascript
// Run accessibility scan on every page
const accessibilityScanResults = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
  .analyze();

// Only fail on critical/serious violations
const criticalViolations = accessibilityScanResults.violations.filter(
  violation => violation.impact === 'critical' || violation.impact === 'serious'
);
```

**Accessibility Best Practices:**
- **Incremental Testing**: Test accessibility on every page in the test suite
- **Violation Reporting**: Provide detailed violation descriptions with help URLs
- **Impact-Based Filtering**: Focus on critical and serious violations first
- **Screen Reader Simulation**: Use semantic queries that match assistive technology patterns

### Interactive JavaScript Testing

**Semantic Element Discovery:**
```javascript
// Test interactive elements using ARIA roles
const interactiveRoles = ['button', 'link', 'tab', 'menuitem'];

for (const role of interactiveRoles) {
  const elements = await page.getByRole(role).all();
  console.log(`Found ${elements.length} ${role} elements, testing up to 8`);
  
  for (let i = 0; i < Math.min(elements.length, 8); i++) {
    // Safe interaction with error handling
    try {
      await elements[i].click({ timeout: 3000 });
      await page.waitForLoadState('domcontentloaded');
    } catch (error) {
      // Log and continue - don't fail entire test for one element
    }
  }
}
```

**WordPress-Specific Interactive Testing:**
- **Navigation Testing**: Handle various WordPress menu structures
- **Form Testing**: Support Contact Form 7, Gravity Forms, custom forms
- **Modal/Lightbox Testing**: Test common WordPress popup patterns
- **Plugin Interaction**: Handle JavaScript from popular WordPress plugins

## Visual Regression Testing Guidelines

### Screenshot Strategy

**File Organization:**
```
tests/baseline-snapshots/
├── sitename-local/
│   ├── home-desktop-chromium.png
│   ├── home-tablet-firefox.png
│   └── about-mobile-webkit.png
└── sitename-live/
    ├── home-desktop-chromium.png
    └── contact-desktop-firefox.png
```

**Screenshot Configuration:**
```javascript
await expect(page).toHaveScreenshot(screenshotPath, {
  fullPage: true,                    // Capture entire page
  threshold: 0.3,                    // 30% difference tolerance
  maxDiffPixels: 1000,              // Allow up to 1000 pixel differences
  animations: 'disabled'             // Disable animations for consistency
});
```

### Baseline Management

**When to Update Baselines:**
- **Intentional Design Changes**: Layout updates, color scheme changes
- **Theme Updates**: WordPress theme or plugin updates affecting appearance
- **Content Updates**: New content that affects page layout
- **Browser Updates**: Major browser version changes affecting rendering

**Baseline Update Commands:**
```bash
# Update specific site baselines
SITE_NAME=sitename npx playwright test --update-snapshots

# Update all baselines (use carefully)
npx playwright test --update-snapshots
```

## WordPress-Specific Testing Patterns

### Common WordPress Elements

**Navigation Patterns:**
```javascript
// WordPress sites use various navigation patterns
const navigationSelectors = [
  '.main-navigation',     // Genesis framework
  '#main-menu',          // Twenty Twenty theme family
  'nav.navbar',          // Bootstrap-based themes
  '.primary-menu',       // Custom themes
  '.site-header nav'     // Theme-agnostic
];
```

**Form Testing Patterns:**
```javascript
// WordPress form plugins have different structures
const formSelectors = {
  contactForm7: '.wpcf7-form',
  gravityForms: '.gform_wrapper form',
  customForms: 'form[id*="contact"]'
};

// Use semantic queries when possible
const nameField = page.getByLabel(/name/i);
const emailField = page.getByLabel(/email/i);
const messageField = page.getByLabel(/message/i);
```

### Local Development Considerations

**SSL Certificate Handling:**
```javascript
// Local by Flywheel uses self-signed certificates
const playwrightConfig = {
  use: {
    ignoreHTTPSErrors: true  // Required for .local domains
  }
};
```

**Performance Adjustments:**
```javascript
// Local development can be slower
const localTimeouts = {
  navigation: 30000,    // 30 seconds for slow local servers
  element: 10000,       // 10 seconds for element interactions
  accessibility: 15000   // 15 seconds for accessibility scans
};
```

## Error Handling & Debugging

### Test Stability Patterns

**Graceful Failure Handling:**
```javascript
// Always use soft assertions for non-critical issues
test('page functionality', async ({ page }) => {
  const errors = [];
  
  try {
    // Test operation
  } catch (error) {
    errors.push(`Navigation failed: ${error.message}`);
  }
  
  // Report all errors at end
  if (errors.length > 0) {
    console.log('⚠️  Non-critical issues found:', errors);
    // Continue test - don't fail for minor issues
  }
});
```

**Enhanced Error Context:**
```javascript
// Use test-helpers for comprehensive error tracking
const errorContext = await setupTestPage(page, context);
errorContext.setTest('Form Submission Test');
errorContext.setPage('/contact');

try {
  errorContext.setAction('filling form fields');
  // Test operations
} catch (error) {
  errorContext.logError(error, { formData: 'contact form' });
  throw error;
} finally {
  await teardownTestPage(page, context, errorContext);
}
```

### Debugging Visual Regression Failures

**Understanding Visual Differences:**
- **Dynamic Content**: Timestamps, visitor counters, recent posts can cause differences
- **Font Rendering**: Different systems may render fonts slightly differently
- **Image Loading**: Lazy loading or CDN issues can affect screenshots
- **Animations**: CSS animations not properly disabled can cause pixel differences

**Debugging Commands:**
```bash
# Generate visual diff reports
npx playwright test responsive.spec.js --reporter=html

# Update specific test baselines
npx playwright test responsive.spec.js -g "home-desktop" --update-snapshots
```

## Performance Optimization

### Test Execution Speed

**Parallel Execution Strategy:**
```javascript
// Run tests in parallel by viewport
test.describe.parallel('Responsive tests', () => {
  // All viewport tests run simultaneously
});

// Limit concurrency for resource-intensive operations
test.describe.configure({ mode: 'serial' }, () => {
  // Accessibility tests run one at a time
});
```

**Resource Management:**
```javascript
// Disable unnecessary features for faster execution
const page = await context.newPage();
await page.route('**/*.{png,jpg,jpeg,gif,svg}', route => route.abort());
await page.route('**/analytics.js', route => route.abort());
await page.route('**/gtag.js', route => route.abort());
```

### Memory Optimization

**Page Cleanup:**
```javascript
// Always clean up page resources after tests
test.afterEach(async ({ page }) => {
  await cleanupPage(page);  // From test-helpers
});
```

**Browser Pool Management:**
- **Context Isolation**: Use separate contexts for different test suites
- **Browser Reuse**: Share browser instances across similar tests
- **Memory Monitoring**: Track memory usage during long test runs

## Testing Strategy Recommendations

### Test Selection by Site Type

**Local Development Sites:**
- **Focus on Functionality**: Emphasize JavaScript and form testing
- **Reduced Visual Testing**: Less critical for local development
- **Comprehensive Accessibility**: Catch issues early in development

**Production Sites:**
- **Full Test Suite**: Both functionality and visual regression
- **Performance Monitoring**: Track load times and Core Web Vitals
- **Cross-Browser Testing**: Ensure consistent experience across browsers

### Maintenance Patterns

**Regular Maintenance Tasks:**
- **Baseline Review**: Quarterly review of visual baselines for relevance
- **Accessibility Updates**: Update axe-core and test rules regularly
- **Performance Benchmarks**: Adjust performance thresholds based on analytics
- **Browser Compatibility**: Test with latest browser versions

---

**Remember**: The tests directory contains the actual validation logic. All tests should be reliable, maintainable, and follow industry-standard practices. Prioritize comprehensive coverage while maintaining fast execution times and clear error reporting.