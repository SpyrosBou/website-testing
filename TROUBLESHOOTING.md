# Playwright Test Troubleshooting Guide

This guide helps diagnose and fix common Playwright test failures in the WordPress Testing Suite.

## Common Error Patterns and Solutions

### 1. "Test timeout of 30000ms exceeded"

**What it means:**
A test operation took longer than the configured timeout (now increased to 60s).

**Root causes:**
- Slow website loading
- Network connectivity issues  
- JavaScript-heavy pages with long initialization
- Resource exhaustion (memory/CPU)
- Browser instability

**Debugging steps:**
1. **Check site performance manually:** Visit the failing page in a browser
2. **Look for memory issues:** Check if your system is running low on RAM
3. **Test with single browser:** Use `--project="Chrome"` to test one browser only
4. **Reduce page count:** Temporarily test fewer pages in site configuration

**Solutions:**
- Timeouts have been increased to 60s globally
- Tests now use exponential backoff retries
- Enhanced error reporting shows exactly which operation timed out

### 2. "page.goto: Target page, context or browser has been closed"

**What it means:**
The browser or page was unexpectedly closed while trying to navigate.

**Root causes:**
- Previous test caused browser crash
- Memory exhaustion
- Page triggered browser security mechanisms  
- Site redirected to problematic URL
- Browser was killed by system/user

**Enhanced debugging:**
The test suite now provides detailed browser state information when this occurs:
```
💥 Browser/page lifecycle issue detected. This usually indicates:
   1. Previous test caused browser crash or instability
   2. Page navigation triggered unexpected browser behavior  
   3. Memory/resource exhaustion or timeout
   4. Network connectivity issues
```

**Solutions:**
- Tests now include page state validation before navigation
- Enhanced cleanup between tests prevents state pollution
- Retry mechanism with exponential backoff
- Comprehensive error context tracking

### 3. Browser Crashes and Instability

**Symptoms:**
- Tests fail randomly
- Browser closes unexpectedly
- "Page crashed" errors

**New debugging features:**
- **Browser state monitoring:** Tracks browser connection and version
- **Memory usage tracking:** Shows memory consumption when errors occur
- **Page lifecycle monitoring:** Detects when pages close unexpectedly

**Solutions:**
- **Reduced parallel execution:** Tests run more conservatively to prevent resource exhaustion
- **Enhanced cleanup:** Each test properly cleans up timers and animations
- **Process monitoring:** Automatic cleanup of orphaned browser processes

## Error Context Tracking

The test suite now provides comprehensive error context:

```json
{
  "timestamp": "2024-01-15T14:30:45.123Z",
  "testName": "javascript-errors",
  "currentPage": "/contact",
  "currentAction": "navigation",
  "totalDuration": 15420,
  "memoryUsage": {
    "heapUsed": 45123456,
    "heapTotal": 67891234
  },
  "environmentInfo": {
    "nodeVersion": "v18.17.0",
    "platform": "darwin",
    "arch": "x64"
  }
}
```

## Test-Specific Troubleshooting

### JavaScript Errors Test

**New features:**
- **Enhanced error tracking:** Captures exactly when and where JS errors occur
- **Page stability waiting:** Multiple strategies for ensuring page is ready
- **Interactive testing timeout:** 35-second timeout for complex page interactions
- **Graceful degradation:** Continues testing other pages if one fails

**Common issues:**
- **WordPress admin bar JS errors:** Normal for logged-in users
- **Theme/plugin conflicts:** Modern themes may have JS errors in development
- **Third-party integrations:** Google Analytics, social media widgets

### Form Tests

**Improvements:**
- **Semantic element detection:** Uses ARIA roles instead of just CSS selectors
- **Validation testing:** Tests form validation by submitting empty forms
- **Error recovery:** Falls back to selector-based approach if semantic queries fail

### Performance Tests  

**Enhanced reporting:**
- **Load time breakdown:** Shows exactly how long each page took
- **Network vs processing time:** Distinguishes between network and rendering delays
- **Progressive thresholds:** Won't fail if only some pages are slow

## Browser-Specific Issues

### Safari (macOS only)
- **Automatic detection:** Only runs Safari tests on macOS systems
- **Real browser testing:** Uses actual Safari application, not simulation
- **WebKit differences:** May show different behaviors than Chrome/Firefox

### Firefox
- **SSL certificate handling:** Different behavior with self-signed certificates
- **Memory management:** May be more susceptible to memory leaks
- **Extension interactions:** Developer tools may interfere with tests

## Configuration Optimizations

### Timeout Configuration
```javascript
// Global test timeout (increased)
timeout: 60000

// Individual operation timeouts  
page.setDefaultNavigationTimeout(25000);
page.setDefaultTimeout(20000);
```

### Site Configuration Best Practices
```json
{
  "testPages": [
    "/",                    // Always start with homepage
    "/about",              // Static pages are most reliable  
    "/contact"             // Test forms on dedicated pages
  ],
  "criticalElements": [
    {
      "name": "Navigation",
      "selector": ".main-nav, #main-menu, nav, header nav"  // Multiple selector options
    }
  ]
}
```

## Performance Monitoring

The test suite now tracks:
- **Memory usage** during test execution
- **Page load times** with millisecond precision  
- **Interactive element counts** per page
- **Error recovery attempts** and success rates

## When to Contact Support

Contact the development team if you see:
- **Consistent failures across all browsers** (likely site issue)
- **Memory usage over 200MB** during test execution
- **Browser version errors** (browser installation issue)
- **Network timeout errors** (connectivity issue)

## Quick Fixes

### Immediate actions for test failures:
1. **Run a single test:** `node run-tests.js --site=SITENAME --functionality`
2. **Test one browser:** `node run-tests.js --site=SITENAME --project="Chrome"`  
3. **Check site manually:** Visit the failing pages in your browser
4. **Clear browser data:** Close all browser windows before running tests
5. **Restart browser:** System restart if tests consistently fail

### Emergency bypass:
If tests are completely broken, temporarily reduce the test scope by editing the site configuration to only test the homepage:
```json
{
  "testPages": ["/"]
}
```

## Log Analysis

Look for these patterns in test output:

**Good patterns:**
```
🚀 Test setup completed
🧭 Navigating to: /about  
✅ Page stability achieved using networkidle
🧹 Cleaning up page: https://site.com/about
🏁 Test teardown completed
```

**Problem patterns:**
```
💥 Page crashed - this indicates a serious browser issue
⚠️  Network idle timeout for /contact after 10s  
❌ Failed to test /about: Target page, context or browser has been closed
💥 Browser disconnected unexpectedly
```

The enhanced error reporting will guide you to the specific issue and provide actionable solutions.