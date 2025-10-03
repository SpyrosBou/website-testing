const { test, expect } = require('@playwright/test');
const SiteLoader = require('../utils/site-loader');

test.use({ trace: 'off', video: 'off' });
const {
  setupTestPage,
  teardownTestPage,
  safeNavigate,
  waitForPageStability,
} = require('../utils/test-helpers');
const { attachSummary, escapeHtml } = require('../utils/reporting-utils');

const ERROR_SELECTORS = [
  '[role="alert"]',
  '[aria-live]:not([aria-live="off"])',
  '.error',
  '.errors',
  '.form-error',
  '.field-error',
  '.validation-error',
  '.wpcf7-not-valid-tip',
  '.nf-error',
  '.gfield_validation_message',
  '.notice-error',
];

const parseSelectorList = (selectorString = '') =>
  String(selectorString)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

const FORMS_WCAG_REFERENCES = [
  { id: '1.3.1', name: 'Info and Relationships' },
  { id: '3.3.1', name: 'Error Identification' },
  { id: '3.3.2', name: 'Labels or Instructions' },
  { id: '3.3.3', name: 'Error Suggestion' },
  { id: '4.1.2', name: 'Name, Role, Value' },
];

const renderWcagBadgesHtml = (references) =>
  references
    .map((ref) => `<span class="badge badge-wcag">${escapeHtml(`${ref.id} ${ref.name}`)}</span>`)
    .join(' ');

const renderWcagListMarkdown = (references) =>
  references.map((ref) => `- ${ref.id} ${ref.name}`);

const summariseFormsMarkdown = (reports) => {
  if (!reports.length) return '';

  const lines = [
    '# Accessibility forms audit summary',
    '',
    '| Form | Page | Gating issues | Advisories |',
    '| --- | --- | --- | --- |',
    ...reports.map((report) =>
      `| ${report.formName} | \`${report.page}\` | ${report.gating.length} | ${report.advisories.length} |`
    ),
  ];

  lines.push('', '### WCAG coverage');
  lines.push(...renderWcagListMarkdown(FORMS_WCAG_REFERENCES));
  lines.push('');

  reports.forEach((report) => {
    if (!report.gating.length && !report.advisories.length) return;
    lines.push('', `## ${report.formName} — \`${report.page}\``);
    if (report.gating.length) {
      lines.push('', '### Gating issues');
      report.gating.forEach((issue) => lines.push(`- ❗ ${issue}`));
    }
    if (report.advisories.length) {
      lines.push('', '### Advisories');
      report.advisories.forEach((issue) => lines.push(`- ℹ️ ${issue}`));
    }
  });

  return lines.join('\n');
};

const summariseFormsHtml = (reports) => {
  if (!reports.length) return '';

  const tableRows = reports
    .map(
      (report) => `
        <tr class="${report.gating.length ? 'impact-critical' : ''}">
          <td>${escapeHtml(report.formName)}</td>
          <td><code>${escapeHtml(report.page)}</code></td>
          <td>${report.gating.length}</td>
          <td>${report.advisories.length}</td>
        </tr>
      `
    )
    .join('');

  const cards = reports
    .map((report) => {
      const gatingList = report.gating
        .map((item) => `<li class="check-fail">${escapeHtml(item)}</li>`)
        .join('');
      const advisoryList = report.advisories.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
      const fieldRows = report.fields
        .map((field) => {
          const status = field.issues.length
            ? `<ul class="details">${field.issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join('')}</ul>`
            : '<p class="details">No issues detected.</p>';
          return `
            <details>
              <summary><code>${escapeHtml(field.name)}</code> — ${escapeHtml(field.accessibleName || 'no accessible name')}</summary>
              <p class="details">Required: ${field.required ? 'Yes' : 'No'} | Accessible name present: ${
                field.accessibleName ? 'Yes' : 'No'
              }</p>
              ${status}
            </details>
          `;
        })
        .join('');

      return `
        <section class="summary-report summary-a11y page-card">
          <div class="page-card__header">
            <h3>${escapeHtml(report.formName)} — ${escapeHtml(report.page)}</h3>
            <span class="status-pill ${report.gating.length ? 'error' : 'success'}">
              ${report.gating.length ? `${report.gating.length} gating issue(s)` : 'Pass'}
            </span>
          </div>
          <p class="details">Form selector: <code>${escapeHtml(report.selectorUsed || 'n/a')}</code></p>
          ${report.gating.length ? `<ul class="details">${gatingList}</ul>` : ''}
          ${report.advisories.length ? `<details><summary>Advisories (${report.advisories.length})</summary><ul class="details">${advisoryList}</ul></details>` : ''}
          ${fieldRows}
        </section>
      `;
    })
    .join('');

  return `
    <section class="summary-report summary-a11y">
      <h2>Accessibility forms audit summary</h2>
      <p class="details">Checked ${reports.length} form(s) for accessible labelling and validation feedback.</p>
      <p class="details"><strong>WCAG coverage:</strong> ${renderWcagBadgesHtml(FORMS_WCAG_REFERENCES)}</p>
      <table>
        <thead>
          <tr><th>Form</th><th>Page</th><th>Gating issues</th><th>Advisories</th></tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
      ${cards}
    </section>
  `;
};

const getAccessibleNameDetails = async (fieldLocator) => {
  return fieldLocator.evaluate((el) => {
    const collectText = (nodes) =>
      Array.from(nodes || [])
        .map((node) => node.textContent || '')
        .map((value) => value.trim())
        .filter(Boolean)
        .join(' ')
        .trim();

    const labelText = collectText(el.labels || []);
    const ariaLabel = (el.getAttribute('aria-label') || '').trim();
    const labelledbyIds = (el.getAttribute('aria-labelledby') || '')
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const labelledbyText = labelledbyIds
      .map((id) => {
        const target = document.getElementById(id);
        return target ? target.textContent || '' : '';
      })
      .map((value) => value.trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    const title = (el.getAttribute('title') || '').trim();
    const placeholder = (el.getAttribute('placeholder') || '').trim();

    const controlType = el.tagName.toLowerCase();
    const inputType = (el.getAttribute('type') || '').toLowerCase();
    const valueText =
      controlType === 'button' || inputType === 'submit' || inputType === 'button'
        ? (el.value || '').trim()
        : '';

    const accessibleName = [labelText, ariaLabel, labelledbyText, title, valueText]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(' ')
      .trim();

    const describedByIds = (el.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const describedText = describedByIds
      .map((id) => {
        const target = document.getElementById(id);
        return target ? target.textContent || '' : '';
      })
      .map((value) => value.trim())
      .filter(Boolean);

    return {
      accessibleName,
      hasAccessibleName: accessibleName.length > 0,
      required: el.required || el.getAttribute('aria-required') === 'true',
      placeholder,
      describedText,
    };
  });
};

const evaluatePostSubmitState = async (formLocator, fieldSelectors) => {
  return formLocator.evaluate(
    (form, { fieldSelectors: selectorsMap, errorSelectors }) => {
      const visible = (el) => {
        if (!el) return false;
        const styles = window.getComputedStyle(el);
        if (styles.visibility === 'hidden' || styles.display === 'none') return false;
        return el.getClientRects().length > 0;
      };

      const aggregateErrors = Array.from(
        new Set(
          errorSelectors.flatMap((selector) =>
            Array.from(form.querySelectorAll(selector)).filter((node) => visible(node))
          )
        )
      )
        .filter((node) => node.textContent)
        .map((node) => node.textContent.trim())
        .filter(Boolean);

      const fieldResults = {};
      for (const [fieldName, selectorString] of Object.entries(selectorsMap)) {
        const selectors = String(selectorString)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
        let field = null;
        let selectorUsed = null;
        for (const selector of selectors) {
          const candidate = form.querySelector(selector);
          if (candidate) {
            field = candidate;
            selectorUsed = selector;
            break;
          }
        }
        if (!field) {
          fieldResults[fieldName] = null;
          continue;
        }

        const describedByIds = (field.getAttribute('aria-describedby') || '')
          .split(/\s+/)
          .map((value) => value.trim())
          .filter(Boolean);
        const describedText = describedByIds
          .map((id) => {
            const target = document.getElementById(id);
            return target ? target.textContent || '' : '';
          })
          .map((value) => value.trim())
          .filter(Boolean);

        const inlineErrors = Array.from(
          new Set(
            errorSelectors.flatMap((selector) => {
              const nodes = Array.from(
                field.closest('label, .form-field, .field, .gfield, .nf-field, .wpcf7-form-control-wrap')?.querySelectorAll(selector) || []
              );
              if (nodes.length) return nodes;
              return [];
            })
          )
        )
          .filter((node) => visible(node) && node !== field)
          .map((node) => node.textContent.trim())
          .filter(Boolean);

        fieldResults[fieldName] = {
          ariaInvalid: field.getAttribute('aria-invalid') === 'true',
          describedText,
          inlineErrors,
          selectorUsed,
          required: field.required || field.getAttribute('aria-required') === 'true',
        };
      }

      return {
        aggregateErrors,
        fields: fieldResults,
      };
    },
    { fieldSelectors, errorSelectors: ERROR_SELECTORS }
  );
};

test.describe('Accessibility: Forms', () => {
  let siteConfig;
  let errorContext;

  test.beforeEach(async ({ page, context }, testInfo) => {
    const siteName = process.env.SITE_NAME;
    if (!siteName) throw new Error('SITE_NAME environment variable is required');

    siteConfig = SiteLoader.loadSite(siteName);
    SiteLoader.validateSiteConfig(siteConfig);
    errorContext = await setupTestPage(page, context, testInfo);
  });

  test.afterEach(async ({ page, context }, testInfo) => {
    await teardownTestPage(page, context, errorContext, testInfo);
  });

  test('Forms provide accessible labelling and validation feedback', async ({ page }) => {
    test.setTimeout(7200000);

    const formConfigs = Array.isArray(siteConfig.forms) ? siteConfig.forms : [];
    if (formConfigs.length === 0) {
      test.skip('Site config defines no forms to audit.');
    }

    const reports = [];

    for (const formConfig of formConfigs) {
      const report = {
        formName: formConfig.name || 'Unnamed form',
        page: formConfig.page || '/',
        gating: [],
        advisories: [],
        fields: [],
        selectorUsed: null,
      };
      reports.push(report);

      await test.step(`Form audit: ${report.formName} (${report.page})`, async () => {
        const response = await safeNavigate(page, `${siteConfig.baseUrl}${report.page}`);
        if (!response || response.status() >= 400) {
          report.gating.push(
            `Failed to load page (status ${response ? response.status() : 'unknown'})`
          );
          return;
        }

        const stability = await waitForPageStability(page);
        if (!stability.ok) {
          report.gating.push(`Page did not reach a stable state: ${stability.message}`);
          return;
        }

        const formLocators = parseSelectorList(formConfig.selector || 'form');
        let formLocator = null;
        for (const selector of formLocators) {
          const locator = page.locator(selector).first();
          if (await locator.count()) {
            formLocator = locator;
            report.selectorUsed = selector;
            break;
          }
        }

        if (!formLocator) {
          report.gating.push('Unable to locate form using configured selector.');
          return;
        }

        const submitLocator = formLocator.locator(formConfig.submitButton || '[type="submit"]').first();
        if (!(await submitLocator.count())) {
          report.gating.push('Submit button not found inside the form.');
          return;
        }

        const fieldsConfig = formConfig.fields || {};
        const fieldDetails = {};

        for (const [fieldName, selectorString] of Object.entries(fieldsConfig)) {
          const selectors = parseSelectorList(selectorString);
          let fieldLocator = null;
          let selectorUsed = null;
          for (const selector of selectors) {
            const candidate = formLocator.locator(selector).first();
            if (await candidate.count()) {
              fieldLocator = candidate;
              selectorUsed = selector;
              break;
            }
          }

          const fieldReport = {
            name: fieldName,
            selectorUsed,
            accessibleName: null,
            required: false,
            issues: [],
          };
          report.fields.push(fieldReport);

          if (!fieldLocator) {
            report.gating.push(`Field "${fieldName}" not found using configured selector.`);
            fieldReport.issues.push('Field missing from DOM.');
            continue;
          }

          const accessibleInfo = await getAccessibleNameDetails(fieldLocator);
          fieldReport.accessibleName = accessibleInfo.accessibleName;
          fieldReport.required = accessibleInfo.required;

          if (!accessibleInfo.hasAccessibleName) {
            report.gating.push(`Field "${fieldName}" is missing an accessible name.`);
            fieldReport.issues.push('Accessible name not detected (no label/aria-label/aria-labelledby).');
          }

          if (accessibleInfo.placeholder && !accessibleInfo.hasAccessibleName) {
            report.advisories.push(
              `Field "${fieldName}" appears to rely on placeholder text for labelling. Add a visible label or aria-label.`
            );
          }

          fieldDetails[fieldName] = selectorString;
        }

        const submitInfo = await getAccessibleNameDetails(submitLocator);
        if (!submitInfo.hasAccessibleName) {
          report.gating.push('Submit button lacks an accessible name (text, aria-label, or labelled-by).');
        }

        await submitLocator.dispatchEvent('click');
        await page.waitForTimeout(1200);

        const postSubmitState = await evaluatePostSubmitState(formLocator, fieldDetails);

        if (!postSubmitState.aggregateErrors.length) {
          report.advisories.push('No global error messaging detected after blank submission.');
        }

        for (const fieldReport of report.fields) {
          const postField = postSubmitState.fields[fieldReport.name];
          if (!postField) continue;

          if (fieldReport.required && !postField.ariaInvalid && !postField.inlineErrors.length && !postField.describedText.length) {
            report.gating.push(
              `Field "${fieldReport.name}" did not expose aria-invalid or inline error messaging after submitting empty.`
            );
            fieldReport.issues.push('No aria-invalid or inline error detected after invalid submit.');
          }

          if (!postField.inlineErrors.length && postField.describedText.length) {
            fieldReport.issues.push('Validation message relies on aria-describedby only; ensure the referenced node stays visible.');
          }

          if (postField.inlineErrors.length) {
            fieldReport.issues.push(`Inline errors: ${postField.inlineErrors.join('; ')}`);
          }
        }
      });
    }

    const gatingTotal = reports.reduce((sum, report) => sum + report.gating.length, 0);

    await attachSummary({
      baseName: 'a11y-form-summary',
      htmlBody: summariseFormsHtml(reports),
      markdown: summariseFormsMarkdown(reports),
      setDescription: true,
      title: 'Forms accessibility summary',
    });

    expect(gatingTotal, 'Form accessibility gating issues detected').toBe(0);
  });
});
