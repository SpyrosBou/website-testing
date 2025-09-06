# Utils - CLAUDE.md

This file provides Claude Code guidance for working within the **utils/** directory, which contains the core business logic and infrastructure utilities that power the WordPress Testing Suite.

## Directory Purpose

The utils directory houses the foundational components that handle site configuration management, test execution orchestration, and advanced error handling. These utilities are designed to be reusable, reliable, and maintainable across the entire testing suite.

## Core Components

### site-loader.js - Configuration Management Engine
**Primary Responsibilities:**
- **Site Configuration Loading**: Secure JSON parsing with comprehensive error handling
- **Validation Framework**: Ensures required fields are present and valid
- **Site Discovery**: Scans sites/ directory for available configurations
- **Error Standardization**: Consistent error messages across the application

**Key Implementation Patterns:**
```javascript
// Always validate before use
try {
  const config = SiteLoader.loadSite(siteName);
  SiteLoader.validateSiteConfig(config);
  // Safe to use config
} catch (error) {
  // Handle missing or invalid config
}
```

### test-runner.js - Test Execution Orchestrator
**Primary Responsibilities:**
- **Site Categorization**: Groups sites by environment (local/live/other)
- **Test Process Management**: Spawns Playwright processes with proper environment variables
- **Report Organization**: Creates site-specific report directories
- **Process Cleanup**: Manages orphaned processes and resource cleanup

**WordPress-Specific Features:**
- **Environment Detection**: Automatically detects Local by Flywheel vs production sites
- **Site Grouping**: Organizes sites by naming convention (`-local`, `-live`)
- **Report Segregation**: Prevents report conflicts between different sites

### test-helpers.js - Advanced Error Handling & Browser Management
**Primary Responsibilities:**
- **Browser Lifecycle Management**: Comprehensive browser state monitoring and debugging
- **Retry Mechanisms**: Exponential backoff for flaky operations
- **Error Context Tracking**: Detailed error reporting with execution context
- **Safe Navigation**: Robust page navigation with multiple fallback strategies

**Industry-Standard Patterns:**
- **Exponential Backoff**: Implements proper retry timing to avoid overwhelming servers
- **Circuit Breaker Logic**: Fails fast after repeated failures
- **Context Preservation**: Maintains test state across failures for debugging
- **Resource Cleanup**: Prevents memory leaks and orphaned processes

## Utility Function Best Practices

### Site Configuration Management

**Required Configuration Fields:**
```javascript
// Always validate these mandatory fields
const requiredFields = ['name', 'baseUrl', 'testPages'];

// Recommended additional fields for robust testing
const recommendedFields = ['criticalElements', 'forms', 'excludePatterns'];
```

**WordPress-Specific Validation:**
- **URL Format**: Ensure baseUrl includes protocol (http/https)
- **Path Validation**: testPages should start with `/` or be relative
- **Critical Elements**: Include navigation, header, footer selectors
- **Security**: Never store credentials or sensitive data in configurations

### Test Execution Patterns

**Environment Variable Management:**
```javascript
// Always set these environment variables for Playwright tests
process.env.SITE_NAME = siteName;
process.env.SITE_OUTPUT_DIR = `test-results/${siteName}`;
process.env.PLAYWRIGHT_REPORT_FOLDER = `playwright-report-${siteName}`;
```

**Process Spawning Best Practices:**
- **Inherit stdio**: Use `stdio: 'inherit'` for real-time test output
- **Environment Isolation**: Pass environment variables explicitly
- **Error Handling**: Always handle both 'close' and 'error' events
- **Resource Cleanup**: Kill orphaned processes after completion

### Error Handling Architecture

**Error Context Tracking:**
```javascript
const errorContext = new ErrorContext();
errorContext.setTest('Navigation Test');
errorContext.setPage('/contact');
errorContext.setAction('clicking submit button');

// Later, when error occurs:
errorContext.logError(error, { 
  additionalInfo: 'form validation failed',
  userAction: 'form submission'
});
```

**Retry Operation Patterns:**
```javascript
// Use exponential backoff for flaky operations
const result = await retryOperation(
  async () => await page.goto(url),
  'Navigate to page',
  3,      // max retries
  1000    // base delay in ms
);
```

## Advanced Error Recovery Strategies

### Browser State Management

**Pre-Operation Checks:**
```javascript
// Always verify page state before operations
if (page.isClosed()) {
  throw new Error('Cannot perform operation: page is closed');
}

// Check for browser disconnection
if (context && context.browser() && !context.browser().isConnected()) {
  throw new Error('Browser disconnected during operation');
}
```

**Comprehensive Debugging:**
- **Memory Usage Tracking**: Monitor Node.js memory usage for leak detection
- **Browser Version Logging**: Record browser versions for debugging compatibility issues
- **Network State Monitoring**: Track network conditions affecting test stability
- **User Agent Logging**: Record user agent for browser-specific issue diagnosis

### WordPress-Specific Error Patterns

**Common WordPress Issues:**
- **SSL Certificate Problems**: Local development often uses self-signed certificates
- **Plugin Conflicts**: JavaScript errors from plugin interactions
- **Theme Variations**: CSS selectors vary significantly between themes
- **Caching Issues**: CDN and caching can cause stale content during testing

**Recovery Strategies:**
```javascript
// Handle WordPress-specific navigation issues
async function wordPressNavigate(page, url) {
  try {
    return await safeNavigate(page, url, { 
      waitUntil: 'domcontentloaded',  // WordPress can be slow to fully load
      timeout: 30000                   // Generous timeout for WordPress
    });
  } catch (error) {
    if (error.message.includes('net::ERR_CERT_AUTHORITY_INVALID')) {
      // Retry with SSL bypass for local development
      return await safeNavigate(page, url, { ignoreHTTPSErrors: true });
    }
    throw error;
  }
}
```

## Performance Optimization Guidelines

### Memory Management
**Resource Cleanup Patterns:**
```javascript
// Always clean up page resources
await cleanupPage(page);  // Stops timers, cancels requests

// Monitor memory usage
const memUsage = process.memoryUsage();
if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB threshold
  console.warn('High memory usage detected');
}
```

**Process Management:**
- **Kill Orphaned Processes**: Use `killOrphanedReportServers()` after test completion
- **Limit Concurrent Operations**: Don't spawn too many Playwright processes simultaneously
- **Monitor Resource Usage**: Track CPU and memory usage during test execution

### Test Execution Optimization

**Site Categorization Benefits:**
- **Parallel Execution**: Run local and live site tests in parallel when possible
- **Resource Allocation**: Allocate more resources to production site testing
- **Reporting Separation**: Prevents confusion between environments

**Intelligent Test Selection:**
```javascript
// Optimize test selection based on site type
if (siteName.includes('-local')) {
  // Local development: focus on functionality
  options.responsive = false;
  options.functionality = true;
} else if (siteName.includes('-live')) {
  // Production: comprehensive testing
  options.responsive = true;
  options.functionality = true;
}
```

## Integration Patterns

### Cross-Component Communication

**SiteLoader ↔ TestRunner Integration:**
```javascript
// TestRunner should always use SiteLoader for configuration access
const siteConfig = SiteLoader.loadSite(siteName);
SiteLoader.validateSiteConfig(siteConfig);

// Pass validated config to TestRunner methods
TestRunner.runTestsForSite(siteName, options);
```

**TestHelpers ↔ Test Files Integration:**
```javascript
// Always use setupTestPage/teardownTestPage in test files
const errorContext = await setupTestPage(page, context);
try {
  // Test operations
} finally {
  await teardownTestPage(page, context, errorContext);
}
```

### Error Propagation Strategy

**Consistent Error Handling Across Utils:**
- **Standardized Error Messages**: Use consistent format across all utils
- **Error Classification**: Categorize errors (configuration, network, browser, application)
- **Recovery Suggestions**: Include actionable advice in error messages
- **Context Preservation**: Maintain error context through the call stack

## WordPress Testing Considerations

### Theme Compatibility
**Selector Strategy:**
```javascript
// Use multiple selector strategies for theme compatibility
const navigationSelectors = [
  '.main-navigation',    // Genesis framework
  '#main-menu',         // Twenty Twenty
  'nav.navbar',         // Bootstrap themes
  '.primary-menu'       // Custom themes
];
```

**Dynamic Content Handling:**
- **Loading States**: Wait for WordPress content to load completely
- **AJAX Requests**: Handle dynamic content loading via AJAX
- **Lazy Loading**: Account for image and content lazy loading
- **Plugin Interactions**: Handle JavaScript from various WordPress plugins

### Security and Performance
**Safe Operations:**
- **Input Sanitization**: Validate all user inputs before processing
- **Resource Limits**: Set reasonable timeouts and retry limits
- **Error Exposure**: Don't expose sensitive information in error messages
- **Process Isolation**: Ensure test processes don't interfere with each other

---

**Remember**: The utils directory contains the foundation of the testing suite. All code here should be robust, well-tested, and designed for reuse across multiple components. Prioritize reliability over performance, and always include comprehensive error handling.