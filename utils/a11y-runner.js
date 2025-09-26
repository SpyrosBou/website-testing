const { AxeBuilder } = require('@axe-core/playwright');
const { WCAG_AXE_TAGS } = require('./a11y-utils');

const createAxeBuilder = (page) => {
  const builder = new AxeBuilder({ page });
  const tagsMode = String(process.env.A11Y_TAGS_MODE || 'all').toLowerCase();
  if (tagsMode === 'wcag') {
    builder.withTags(WCAG_AXE_TAGS);
  }
  return builder;
};

module.exports = {
  createAxeBuilder,
};
