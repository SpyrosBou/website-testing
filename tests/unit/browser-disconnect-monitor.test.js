'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { createBrowserDisconnectMonitor } = require('../../utils/browser-disconnect-monitor');

class MockBrowser extends EventEmitter {}

const defaultLogger = () => {
  const messages = {
    error: [],
    debug: [],
  };
  return {
    logger: {
      error: (message, payload) => {
        messages.error.push({ message, payload });
      },
      debug: (message, payload) => {
        messages.debug.push({ message, payload });
      },
    },
    messages,
  };
};

beforeEach(() => {
  delete process.env.DEBUG_BROWSER_TEARDOWN;
});

test('registerTestStart and registerTestEnd track active counts', () => {
  const { logger, messages } = defaultLogger();
  const monitor = createBrowserDisconnectMonitor({ logger });
  const browser = new MockBrowser();

  assert.strictEqual(monitor.getActiveCount(browser), 0);

  const registrationOne = monitor.registerTestStart(browser, { title: 'first' });
  const registrationTwo = monitor.registerTestStart(browser, { title: 'second' });

  assert.strictEqual(monitor.getActiveCount(browser), 2);

  assert.ok(monitor.registerTestEnd(registrationOne));
  assert.strictEqual(monitor.getActiveCount(browser), 1);

  assert.ok(monitor.registerTestEnd(registrationTwo));
  assert.strictEqual(monitor.getActiveCount(browser), 0);
  assert.deepStrictEqual(messages.error, []);
});

test('disconnected event emits unexpected crash log when tests are active', () => {
  const { logger, messages } = defaultLogger();
  const monitor = createBrowserDisconnectMonitor({ logger });
  const browser = new MockBrowser();

  monitor.registerTestStart(browser, { title: 'crashing test' });
  browser.emit('disconnected');

  assert.strictEqual(messages.error.length, 1);
  assert.match(messages.error[0].message, /Browser disconnected unexpectedly/);
  assert.strictEqual(messages.error[0].payload.activeTests, 1);
  assert.strictEqual(messages.debug.length, 0);
});

test('debug logging fires when active count reaches zero', () => {
  process.env.DEBUG_BROWSER_TEARDOWN = 'true';
  const { logger, messages } = defaultLogger();
  const monitor = createBrowserDisconnectMonitor({ logger });
  const browser = new MockBrowser();

  const registration = monitor.registerTestStart(browser, { title: 'finishes cleanly' });
  assert.ok(monitor.registerTestEnd(registration, { reason: 'test-complete' }));
  assert.strictEqual(messages.error.length, 0);
  assert.strictEqual(messages.debug.length, 1);
  assert.match(messages.debug[0].message, /Active test count reached zero/);
  assert.strictEqual(messages.debug[0].payload.reason, 'test-complete');
});
