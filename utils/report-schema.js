const SCHEMA_ID = 'codex.report.summary';
const SCHEMA_VERSION = 1;

const KIND_RUN_SUMMARY = 'run-summary';
const KIND_PAGE_SUMMARY = 'page-summary';

const createRunSummaryPayload = ({
  baseName = 'report-summary',
  title = 'Test run summary',
  overview = {},
  ruleSnapshots = [],
  metadata = {},
} = {}) => ({
  schema: SCHEMA_ID,
  version: SCHEMA_VERSION,
  kind: KIND_RUN_SUMMARY,
  baseName,
  title,
  overview,
  ruleSnapshots,
  metadata,
});

const createPageSummaryPayload = ({
  baseName,
  title,
  page,
  viewport,
  summary = {},
  metadata = {},
} = {}) => ({
  schema: SCHEMA_ID,
  version: SCHEMA_VERSION,
  kind: KIND_PAGE_SUMMARY,
  baseName,
  title,
  page,
  viewport,
  summary,
  metadata,
});

module.exports = {
  SCHEMA_ID,
  SCHEMA_VERSION,
  KIND_RUN_SUMMARY,
  KIND_PAGE_SUMMARY,
  createRunSummaryPayload,
  createPageSummaryPayload,
};
