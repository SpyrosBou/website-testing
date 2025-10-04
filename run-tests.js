#!/usr/bin/env node

const minimist = require('minimist');
const TestRunner = require('./utils/test-runner');

const argv = minimist(process.argv.slice(2), {
  string: ['site', 'sites', 'project', 'browser', 'browsers', 'workers', 'profile', 'viewport', 'spec'],
  boolean: [
    'help',
    'list',
    'list-sites',
    'discover',
    'local',
    'visual',
    'responsive',
    'functionality',
    'accessibility',
    'full',
    'headed',
    'debug',
    'update-baselines',
    'complete-sites',
  ],
  alias: {
    h: 'help',
    l: 'list',
    s: 'site',
    p: 'profile',
    w: 'workers',
    b: 'browsers',
    'list-sites': ['ls'],
  },
});

const coerceBoolean = (value) => {
  if (value === undefined) return false;
  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase();
    if (['false', '0', 'no', 'off'].includes(normalised)) {
      return false;
    }
    if (['true', '1', 'yes', 'on', ''].includes(normalised)) {
      return true;
    }
  }
  return Boolean(value);
};

const toStringArray = (input) => {
  if (input === undefined || input === null) return [];
  if (Array.isArray(input)) {
    return input
      .flatMap((item) =>
        typeof item === 'string' ? item.split(',') : Array.isArray(item) ? item : [item]
      )
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [String(input)].filter(Boolean);
};

function showUsage() {
  const lines = [
    '',
    'Smart Playwright runner',
    '',
    'Usage:',
    '  node run-tests.js [options] --site <site> [extra sites...] [spec patterns...]',
    '',
    'Common examples:',
    '  node run-tests.js --site example-site',
    '  node run-tests.js --site daygroup-local tests/a11y.audit.wcag.spec.js',
    '  node run-tests.js --site daygroup-local --site daygroup-live --spec responsive.layout.structure.spec.js',
    '  node run-tests.js --site agilitas-live --profile smoke',
    '  node run-tests.js --site daygroup-live --workers 4 --browsers Chrome,Firefox',
    '',
    'Key options:',
    '  --site, -s            One or more site config names (comma-separated or repeated)',
    '  --spec                Specific spec file(s) or glob(s) to run (repeat or pass multiple)',
    '  --profile             smoke | full | nightly presets (mirrors previous behaviour)',
    '  --visual              Run only visual regression specs',
    '  --responsive          Run only responsive structure specs',
    '  --functionality       Run only functionality specs',
    '  --accessibility       Run only accessibility specs',
    '  --full                Shortcut for running all groups',
    '  --browsers, --project Comma-separated Playwright projects (default Chrome)',
    "  --workers, -w         Worker count (number or 'auto', default auto)",
    "  --discover            Refresh sitemap-backed pages before running",
    "  --local               Attempt DDEV preflight for local '.ddev.site' hosts",
    '  --list-sites          Print site configs (also used for shell completion helpers)',
    '  --update-baselines    Update visual baselines for the chosen site(s)',
    '  --help                Show this help message',
    '',
    'Tips:',
    '  - Site arguments accept wildcards when using shell completion. Run "node run-tests.js --list-sites" to see available configs.',
    '  - Append additional spec globs after the options (e.g. "node run-tests.js --site foo tests/*.spec.js").',
    '  - Use environment variables like REPORT_BROWSER to override the default browser launcher when opening reports.',
    '',
  ];
  console.log(lines.join('\n'));
}

function collectSiteNames() {
  const { localSites, liveSites, otherSites } = TestRunner.listSites();
  return [...localSites, ...liveSites, ...otherSites].map((entry) => entry.name);
}

function parseSites() {
  const explicitSites = [...toStringArray(argv.site), ...toStringArray(argv.sites)];
  const positional = argv._.map((item) => String(item).trim()).filter(Boolean);
  const inferredSites = positional.filter((value) => !/\.(spec\.[jt]s|[jt]s)$/i.test(value) && !value.includes('/'));

  const sites = [...explicitSites, ...inferredSites].filter(Boolean);
  if (sites.length === 0) return ['example-site'];
  return Array.from(new Set(sites));
}

function parseSpecs() {
  const positional = argv._.map((item) => String(item).trim()).filter(Boolean);
  const positionalSpecs = positional.filter((value) =>
    /\.(spec\.[jt]s|[jt]s)$/i.test(value) || value.includes('/') || value.includes('*')
  );
  const specOptions = toStringArray(argv.spec);
  const inputs = [...specOptions, ...positionalSpecs];
  return Array.from(new Set(inputs));
}

async function handleListSites() {
  TestRunner.displaySites();
}

function printSitesForCompletion() {
  collectSiteNames().forEach((name) => console.log(name));
}

async function runForSites(sites, baseOptions) {
  let exitCode = 0;
  for (const siteName of sites) {
    console.log(`\n==============================`);
    console.log(`Running Playwright suite for site: ${siteName}`);
    console.log('==============================\n');

    try {
      const result = await TestRunner.runTestsForSite(siteName, baseOptions);
      exitCode = result.code !== 0 ? result.code : exitCode;
    } catch (error) {
      console.error(`❌ Run failed for ${siteName}:`, error.message || error);
      exitCode = 1;
    }
  }
  return exitCode;
}

async function main() {
  if (argv.help) {
    showUsage();
    return;
  }

  if (argv['list-sites'] || argv.list) {
    await handleListSites();
    return;
  }

  if (argv['complete-sites']) {
    printSitesForCompletion();
    return;
  }

  const sites = parseSites();
  const specs = parseSpecs();

  if (argv['update-baselines']) {
    for (const site of sites) {
      // eslint-disable-next-line no-await-in-loop
      await TestRunner.updateBaselines(site);
    }
    return;
  }

  const profile = argv.profile;
  const options = {
    visual: coerceBoolean(argv.visual),
    responsive: coerceBoolean(argv.responsive),
    functionality: coerceBoolean(argv.functionality),
    accessibility: coerceBoolean(argv.accessibility),
    full: coerceBoolean(argv.full),
    headed: coerceBoolean(argv.headed),
    debug: coerceBoolean(argv.debug),
    discover: coerceBoolean(argv.discover),
    local: coerceBoolean(argv.local),
    profile,
    project: argv.browsers || argv.browser || argv.project,
    viewport: argv.viewport,
    a11yTags: argv['a11y-tags'] || argv.a11yTags,
    a11ySample: argv['a11y-sample'] || argv.a11ySample,
    a11yKeyboardSteps: argv['a11y-keyboard-steps'] || argv.a11yKeyboardSteps,
    specs,
    workers: argv.workers,
  };

  if (profile === 'smoke') {
    options.visual = false;
    options.responsive = false;
    options.functionality = true;
    options.accessibility = false;
    options.full = false;
    options.project = options.project || 'Chrome';
    process.env.SMOKE = '1';
  }

  if (profile === 'nightly') {
    options.visual = true;
    options.responsive = true;
    options.functionality = true;
    options.accessibility = true;
    options.full = false;
    options.project = options.project || 'Chrome';
    options.a11ySample = options.a11ySample || 'all';
    options.a11yKeyboardSteps = options.a11yKeyboardSteps || '40';
    process.env.NIGHTLY = '1';
  }

  if (profile === 'full') {
    options.full = true;
  }

  const exitCode = await runForSites(sites, options);
  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
