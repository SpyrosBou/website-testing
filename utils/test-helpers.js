/**
 * Enhanced Test Helpers for Playwright WordPress Testing Suite
 * 
 * This module provides comprehensive utilities for better error reporting,
 * debugging, and browser lifecycle management across all test files.
 */

// Enhanced debugging utility for browser/page lifecycle issues
async function debugBrowserState(page, context, testName) {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    testName,
    pageState: {
      isClosed: page.isClosed(),
      url: 'unknown',
      title: 'unknown'
    },
    browserState: {
      isConnected: false,
      version: 'unknown'
    },
    memoryUsage: process.memoryUsage(),
    environmentInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      userAgent: context ? await context.newPage().then(p => p.evaluate(() => navigator.userAgent)).catch(() => 'unknown') : 'unknown'
    }
  };
  
  try {
    if (!page.isClosed()) {
      debugInfo.pageState.url = page.url();
      debugInfo.pageState.title = await page.title();
    }
  } catch (error) {
    debugInfo.pageState.error = error.message;
  }
  
  try {
    if (context) {
      const browser = context.browser();
      if (browser) {
        debugInfo.browserState.isConnected = browser.isConnected();
        debugInfo.browserState.version = browser.version();
      }
    }
  } catch (error) {
    debugInfo.browserState.error = error.message;
  }
  
  console.log('🔍 Browser State Debug Info:', JSON.stringify(debugInfo, null, 2));
  return debugInfo;
}

// Retry mechanism for flaky operations with exponential backoff
async function retryOperation(operation, operationName, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      if (attempt > 1) {
        console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === maxRetries;
      const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
      
      console.log(`⚠️  ${operationName} attempt ${attempt}/${maxRetries} failed: ${error.message.substring(0, 100)}...`);
      
      if (isLastAttempt) {
        console.error(`💥 ${operationName} failed after ${maxRetries} attempts`);
        console.error(`Final error: ${error.message}`);
        break;
      }
      
      console.log(`   Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Enhanced navigation with comprehensive error handling
async function safeNavigate(page, url, options = {}) {
  const defaultOptions = {
    timeout: 20000,
    waitUntil: 'domcontentloaded',
    ...options
  };
  
  if (page.isClosed()) {
    throw new Error(`Cannot navigate to ${url}: page is closed`);
  }
  
  return await retryOperation(
    async () => {
      console.log(`🧭 Navigating to: ${url}`);
      const response = await page.goto(url, defaultOptions);
      
      if (!response) {
        throw new Error(`Navigation to ${url} returned null response`);
      }
      
      return response;
    },
    `Navigate to ${url}`,
    2, // 2 retries for navigation
    2000 // 2 second delay
  );
}

// Wait for page stability with multiple strategies
async function waitForPageStability(page, options = {}) {
  const {
    timeout = 10000,
    strategies = ['networkidle', 'domcontentloaded', 'load']
  } = options;
  
  if (page.isClosed()) {
    throw new Error('Cannot wait for page stability: page is closed');
  }
  
  const errors = [];
  
  for (const strategy of strategies) {
    try {
      await page.waitForLoadState(strategy, { timeout });
      console.log(`✅ Page stability achieved using ${strategy}`);
      return true;
    } catch (error) {
      errors.push(`${strategy}: ${error.message}`);
      console.log(`⚠️  ${strategy} strategy failed: ${error.message.substring(0, 50)}...`);
    }
  }
  
  console.log(`⚠️  All stability strategies failed: ${errors.join('; ')}`);
  return false; // Don't throw, let tests continue
}

// Enhanced element interaction with safety checks
async function safeElementInteraction(element, action, options = {}) {
  const defaultOptions = {
    timeout: 5000,
    ...options
  };
  
  try {
    // Pre-interaction checks
    if (!(await element.isAttached())) {
      throw new Error('Element is not attached to DOM');
    }
    
    if (!(await element.isVisible())) {
      throw new Error('Element is not visible');
    }
    
    // Perform the action
    switch (action) {
      case 'click':
        await element.click(defaultOptions);
        break;
      case 'fill':
        if (!options.text) throw new Error('Text is required for fill action');
        await element.fill(options.text, defaultOptions);
        break;
      case 'hover':
        await element.hover(defaultOptions);
        break;
      default:
        throw new Error(`Unsupported action: ${action}`);
    }
    
    return true;
  } catch (error) {
    console.log(`⚠️  Element ${action} failed: ${error.message}`);
    return false;
  }
}

// Page cleanup utility
async function cleanupPage(page) {
  if (page.isClosed()) {
    return;
  }
  
  try {
    await page.evaluate(() => {
      // Stop any running timers or animations
      if (typeof window !== 'undefined') {
        // Clear all intervals and timeouts
        const highestId = setTimeout(() => {}, 0);
        for (let i = 0; i < highestId; i++) {
          clearTimeout(i);
          clearInterval(i);
        }
        
        // Cancel any ongoing network requests if possible
        if (window.stop) {
          window.stop();
        }
      }
    });
  } catch (error) {
    console.log(`⚠️  Page cleanup warning: ${error.message}`);
  }
}

// Error context tracking
class ErrorContext {
  constructor() {
    this.context = {
      currentTest: null,
      currentPage: null,
      currentAction: 'initialization',
      startTime: Date.now(),
      actions: []
    };
  }
  
  setTest(testName) {
    this.context.currentTest = testName;
    this.context.startTime = Date.now();
  }
  
  setPage(pageName) {
    this.context.currentPage = pageName;
  }
  
  setAction(actionName) {
    this.context.currentAction = actionName;
    this.context.actions.push({
      action: actionName,
      timestamp: Date.now(),
      duration: Date.now() - this.context.startTime
    });
  }
  
  getContextInfo() {
    return {
      ...this.context,
      totalDuration: Date.now() - this.context.startTime
    };
  }
  
  logError(error, additionalInfo = {}) {
    console.error('❌ Test Error Context:', {
      error: error.message,
      stack: error.stack?.substring(0, 300),
      context: this.getContextInfo(),
      additional: additionalInfo,
      timestamp: new Date().toISOString()
    });
  }
}

// Test setup and teardown helpers
async function setupTestPage(page, context) {
  // Set up comprehensive error tracking
  page.on('crash', async () => {
    console.error('💥 Page crashed - this indicates a serious browser issue');
    await debugBrowserState(page, context, 'page-crash');
  });
  
  page.on('close', () => {
    console.log('📝 Page closed event triggered');
  });
  
  // Monitor browser disconnection
  if (context.browser()) {
    context.browser().on('disconnected', () => {
      console.error('💥 Browser disconnected unexpectedly');
    });
  }
  
  // Set generous timeouts for stability
  page.setDefaultNavigationTimeout(30000);
  page.setDefaultTimeout(20000);
  
  return new ErrorContext();
}

async function teardownTestPage(page, context, errorContext) {
  try {
    if (!page.isClosed()) {
      const currentUrl = await page.url();
      console.log(`🧹 Cleaning up page: ${currentUrl}`);
      await cleanupPage(page);
    }
  } catch (error) {
    console.log(`⚠️  Teardown warning: ${error.message}`);
    if (errorContext) {
      errorContext.logError(error, { phase: 'teardown' });
    }
    await debugBrowserState(page, context, 'teardown-error');
  }
}

module.exports = {
  debugBrowserState,
  retryOperation,
  safeNavigate,
  waitForPageStability,
  safeElementInteraction,
  cleanupPage,
  ErrorContext,
  setupTestPage,
  teardownTestPage
};