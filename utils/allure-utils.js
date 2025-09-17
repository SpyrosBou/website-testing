const { allure } = require('allure-playwright');

const SUMMARY_STYLES = `
<style>
  .summary-report { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .summary-report h2 { margin-bottom: 0.25rem; }
  .summary-report h3 { margin: 0.75rem 0 0.35rem; }
  .summary-report section { margin: 0.75rem 0; }
  .summary-report table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; }
  .summary-report th,
  .summary-report td { border: 1px solid #d0d7de; padding: 6px 8px; text-align: left; vertical-align: top; }
  .summary-report th { background: #f6f8fa; }
  .summary-report details { margin: 0.5rem 0; }
  .summary-report details > summary { cursor: pointer; }
  .summary-report tr.status-ok td { background: #edf7ed; }
  .summary-report tr.status-redirect td { background: #fff4ce; }
  .summary-report tr.status-error td { background: #ffe5e5; }
  .summary-report tr.impact-critical td { background: #ffe5e5; }
  .summary-report tr.impact-serious td { background: #fff4ce; }
  .summary-report ul { margin: 0.25rem 0; padding-left: 1.2rem; }
  .summary-report li { margin: 0.15rem 0; }
  .summary-report li.check-pass::marker { color: #137333; }
  .summary-report li.check-fail::marker { color: #d93025; }
  .summary-report .details { color: #4e5969; }
  .summary-report .note { margin-top: 0.25rem; font-size: 0.85rem; color: #344054; }
  .summary-report code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; }
  .summary-report .legend { margin: 0.5rem 0; }
  .summary-report .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; margin-right: 0.4rem; border: 1px solid #d0d7de; }
  .summary-report .badge.ok { background: #edf7ed; }
  .summary-report .badge.redirect { background: #fff4ce; }
  .summary-report .badge.error { background: #ffe5e5; }
  .summary-report .badge-critical { background: #ffe5e5; }
  .summary-report .badge-serious { background: #fff4ce; }
</style>
`;

const wrapHtml = (content) => `${SUMMARY_STYLES}${content}`;

const attachAllureText = async (name, content, type = 'text/plain') => {
  if (allure && typeof allure.attachment === 'function') {
    await allure.attachment(name, content, type);
  }
};

const attachSummary = async ({ baseName, htmlBody, markdown, setDescription = false }) => {
  if (htmlBody) {
    const wrappedHtml = wrapHtml(htmlBody);
    await attachAllureText(`${baseName}.html`, wrappedHtml, 'text/html');
    if (setDescription && typeof allure?.descriptionHtml === 'function') {
      allure.descriptionHtml(wrappedHtml);
    }
  }
  if (markdown) {
    await attachAllureText(`${baseName}.md`, markdown, 'text/markdown');
  }
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

module.exports = {
  attachAllureText,
  attachSummary,
  escapeHtml,
};
