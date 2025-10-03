'use strict';

const base = require('@playwright/test');
const { setupTestPage, teardownTestPage } = require('./test-helpers');

const test = base.test.extend({
  errorContext: async ({ page, context }, use, testInfo) => {
    const contextInstance = await setupTestPage(page, context, testInfo);
    try {
      await use(contextInstance);
    } finally {
      await teardownTestPage(page, context, contextInstance, testInfo);
    }
  },
});

module.exports = {
  test,
  expect: base.expect,
};
