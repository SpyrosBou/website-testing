'use strict';

function normaliseEnvBoolean(value) {
  if (value === undefined || value === null) {
    return false;
  }
  const normalised = String(value).trim().toLowerCase();
  if (!normalised) {
    return false;
  }
  return ['1', 'true', 'yes', 'on'].includes(normalised);
}

function summariseTestInfo(testInfo) {
  if (!testInfo) {
    return null;
  }

  const titlePath = Array.isArray(testInfo.titlePath) ? testInfo.titlePath : [];
  const title = titlePath.length > 0 ? titlePath.join(' › ') : testInfo.title || 'unknown';

  return {
    title,
    project: testInfo.project?.name || 'unknown',
    workerIndex: typeof testInfo.workerIndex === 'number' ? testInfo.workerIndex : undefined,
  };
}

function createBrowserDisconnectMonitor(options = {}) {
  const {
    debugFlagEnv = 'DEBUG_BROWSER_TEARDOWN',
    logger = console,
  } = options;

  const browserState = new WeakMap();
  const debugEnabled = normaliseEnvBoolean(process.env[debugFlagEnv]);

  function ensureState(browser) {
    if (!browser) {
      return null;
    }

    let state = browserState.get(browser);
    if (state) {
      return state;
    }

    state = {
      activeTests: 0,
      listenerAttached: false,
      entries: new Map(),
    };

    browserState.set(browser, state);
    return state;
  }

  function attachListener(browser, state) {
    if (!browser || !state || state.listenerAttached) {
      return;
    }

    const disconnectHandler = () => {
      const snapshot = {
        timestamp: new Date().toISOString(),
        activeTests: state.activeTests,
        activeEntries: Array.from(state.entries.values()).filter(Boolean),
      };

      if (state.activeTests > 0) {
        logger.error('💥 Browser disconnected unexpectedly', snapshot);
      } else if (debugEnabled) {
        logger.debug('[teardown] Browser disconnected after all tests completed', snapshot);
      }

      state.activeTests = 0;
      state.entries.clear();
      browserState.delete(browser);
    };

    browser.on('disconnected', disconnectHandler);
    state.listenerAttached = true;
  }

  function registerTestStart(browser, testInfo) {
    if (!browser) {
      return null;
    }

    const state = ensureState(browser);
    attachListener(browser, state);

    const token = Symbol('browser-test');
    state.activeTests += 1;
    state.entries.set(token, summariseTestInfo(testInfo));

    return { browser, token };
  }

  function registerTestEnd(registration, metadata = {}) {
    if (!registration || !registration.browser || !registration.token) {
      return false;
    }

    const state = browserState.get(registration.browser);
    if (!state) {
      return false;
    }

    if (!state.entries.has(registration.token)) {
      return false;
    }

    state.entries.delete(registration.token);
    state.activeTests = Math.max(0, state.activeTests - 1);

    if (debugEnabled && state.activeTests === 0) {
      const payload = {
        timestamp: new Date().toISOString(),
        reason: metadata.reason || 'test-complete',
      };
      if (metadata.testInfo) {
        payload.test = summariseTestInfo(metadata.testInfo);
      }
      logger.debug('[teardown] Active test count reached zero', payload);
    }

    return true;
  }

  function getActiveCount(browser) {
    const state = browserState.get(browser);
    return state ? state.activeTests : 0;
  }

  return {
    registerTestStart,
    registerTestEnd,
    getActiveCount,
  };
}

module.exports = {
  createBrowserDisconnectMonitor,
};
