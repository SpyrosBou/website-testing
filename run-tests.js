#!/usr/bin/env node

const minimist = require('minimist');
const TestRunner = require('./utils/test-runner');

const argv = minimist(process.argv.slice(2), {
  string: [
    'site',
    'sites',
    'project',
    'browser',
    'browsers',
    'workers',
    'profile',
    'spec',
    'limit',
    'a11y-tags',
    'a11y-sample',
  ],
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
    'debug',
    'update-baselines',
  ],
  alias: {
    h: 'help',
    l: 'list',
    s: 'site',
    S: 'sites',
    p: 'profile',
    w: 'workers',
    b: 'browsers',
    t: 'spec',
    d: 'discover',
    c: 'local',
    v: 'visual',
    r: 'responsive',
    F: 'functionality',
    g: 'accessibility',
    D: 'debug',
    B: 'update-baselines',
    L: 'list-sites',
    n: 'limit',
    A: 'a11y-tags',
    Y: 'a11y-sample',
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
    '  --spec, -t            Specific spec file(s) or glob(s) to run (repeat or pass multiple)',
    '  --profile, -p         smoke | full | nightly presets (mirrors previous behaviour)',
    '  --visual, -v          Run only visual regression specs',
    '  --responsive, -r      Run only responsive structure specs',
    '  --functionality, -F   Run only functionality specs',
    '  --accessibility, -g   Run only accessibility specs',
    '  --limit, -n           Limit number of pages under test (applies before grouping)',
    '  --browsers, --project, -b  Comma-separated Playwright projects (default Chrome)',
    "  --workers, -w         Worker count (number or 'auto', default auto)",
    "  --discover, -d        Refresh sitemap-backed pages before running",
    "  --local, -c           Attempt DDEV preflight for local '.ddev.site' hosts",
    '  --list-sites, -L      Print site configs (also used for shell completion helpers)',
    '  --update-baselines, -B Update visual baselines for the chosen site(s)',
    '  --debug, -D           Enable Playwright debug mode',
    '  --a11y-tags, -A       Override WCAG tagging scope (e.g. wcag)',
    '  --a11y-sample, -Y     Limit responsive accessibility sample size',
    '  --help, -h            Show this help message',
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
    allGroups: false,
    debug: coerceBoolean(argv.debug),
    discover: coerceBoolean(argv.discover),
    local: coerceBoolean(argv.local),
    profile,
    project: argv.browsers || argv.browser || argv.project,
    limit: argv.limit,
    a11yTags: argv['a11y-tags'] || argv.a11yTags,
    a11ySample: argv['a11y-sample'] || argv.a11ySample,
    specs,
    workers: argv.workers,
  };

  if (profile === 'smoke') {
    options.visual = false;
    options.responsive = false;
    options.functionality = true;
    options.accessibility = false;
    options.allGroups = false;
    options.project = options.project || 'Chrome';
    process.env.SMOKE = '1';
  }

  if (profile === 'nightly') {
    options.visual = true;
    options.responsive = true;
    options.functionality = true;
    options.accessibility = true;
    options.allGroups = true;
    options.project = options.project || 'Chrome';
    options.a11ySample = options.a11ySample || 'all';
    if (!process.env.A11Y_KEYBOARD_STEPS) {
      process.env.A11Y_KEYBOARD_STEPS = '40';
    }
    process.env.NIGHTLY = '1';
  }

  if (profile === 'full') {
    options.allGroups = true;
  }

  const exitCode = await runForSites(sites, options);
  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
