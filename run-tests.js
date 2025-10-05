#!/usr/bin/env node

const minimist = require('minimist');
const fs = require('fs');
const path = require('path');
const TestRunner = require('./utils/test-runner');

const argv = minimist(process.argv.slice(2), {
  string: ['site', 'sites', 'project', 'browser', 'browsers', 'workers', 'spec', 'pages', 'output'],
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
    p: 'pages',
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
    'Core selections:',
    '  Step 1 – Site(s):        --site <name> (repeat or comma-separate)',
    '  Step 2 – Specs (optional): --spec <pattern> (repeat as needed)',
    '  Step 3 – Page scope:     --pages <n> (caps pages across all suites)',
    '  Step 4 – Projects:       --project=<list> (default Chrome, use "all" for every project)',
    '',
    'Advanced options:',
    '  --visual, -v             Run only visual regression specs',
    '  --responsive, -r         Run only responsive structure specs',
    '  --functionality, -F      Run only functionality specs',
    '  --accessibility, -g      Run only accessibility specs',
    '  --workers, -w            Worker count (number or "auto", default auto)',
    '  --discover, -d           Refresh sitemap-backed pages before running',
    '  --local, -c              Attempt DDEV preflight for local ".ddev.site" hosts',
    '  --output <path>         Persist manifest + run summary JSON to disk',
    '  --list-sites, -L         Print site configs for reference',
    '  --update-baselines, -B  Update visual baselines for the chosen site(s)',
    '  --debug, -D              Enable Playwright debug mode',
    '  --help, -h               Show this help message',
    '',
    'Tips:',
    '  - Append spec globs after the options (e.g. "node run-tests.js --site foo tests/*.spec.js").',
    '  - Combine page cap and project selection to mirror the GUI flow you plan to build.',
    '  - Use env vars like REPORT_BROWSER to override the default browser opener when viewing reports.',
    '',
  ];
  console.log(lines.join('\n'));
}

function parseSites() {
  const explicitSites = [...toStringArray(argv.site), ...toStringArray(argv.sites)];
  const positional = argv._.map((item) => String(item).trim()).filter(Boolean);
  const inferredSites = positional.filter(
    (value) => !/\.(spec\.[jt]s|[jt]s)$/i.test(value) && !value.includes('/')
  );

  const sites = [...explicitSites, ...inferredSites].filter(Boolean);
  if (sites.length === 0) return ['example-site'];
  return Array.from(new Set(sites));
}

function parseSpecs() {
  const positional = argv._.map((item) => String(item).trim()).filter(Boolean);
  const positionalSpecs = positional.filter(
    (value) => /\.(spec\.[jt]s|[jt]s)$/i.test(value) || value.includes('/') || value.includes('*')
  );
  const specOptions = toStringArray(argv.spec);
  const inputs = [...specOptions, ...positionalSpecs];
  return Array.from(new Set(inputs));
}

async function handleListSites() {
  TestRunner.displaySites();
}

const MANIFEST_PREVIEW_LIMIT = 5;

const renderManifestPreview = (manifest, manifestPath) => {
  const pages = Array.isArray(manifest.pages) ? manifest.pages : [];
  const specs = Array.isArray(manifest.specs) ? manifest.specs : [];
  const projects = Array.isArray(manifest.projects) ? manifest.projects : [];

  console.log('Run manifest preview:');
  console.log(`  Site:        ${manifest.site?.title || manifest.site?.name}`);
  console.log(`  Base URL:    ${manifest.site?.baseUrl || 'n/a'}`);
  console.log(`  Pages:       ${pages.length}`);
  if (pages.length > 0) {
    const previewPages = pages.slice(0, MANIFEST_PREVIEW_LIMIT);
    const remaining = pages.length - previewPages.length;
    let pageLine = `    • ${previewPages.join(', ')}`;
    if (remaining > 0) {
      pageLine += `, ... (+${remaining} more)`;
    }
    console.log(pageLine);
  }
  console.log(`  Specs:       ${specs.length}`);
  if (specs.length > 0) {
    console.log(`    • ${specs.join(', ')}`);
  }
  console.log(`  Projects:    ${projects.length > 0 ? projects.join(', ') : 'n/a'}`);
  if (manifest.limits?.pageLimit != null) {
    console.log(`  Page cap:    ${manifest.limits.pageLimit}`);
  }
  if (
    manifest.limits?.accessibilitySample !== null &&
    manifest.limits?.accessibilitySample !== undefined
  ) {
    console.log(`  A11y sample: ${manifest.limits.accessibilitySample}`);
  }
  if (manifest.profile) {
    console.log(`  Profile:     ${manifest.profile}`);
  }
  if (manifestPath) {
    const relativePath = path.relative(process.cwd(), manifestPath);
    console.log(`  Manifest:    ${relativePath}`);
  }
  console.log('');
};

async function runForSites(sites, baseOptions) {
  let exitCode = 0;
  const optionsWithEvents = {
    ...baseOptions,
    onEvent: (event) => {
      if (baseOptions.outputWriter) {
        baseOptions.outputWriter.capture(event);
      }
      if (typeof baseOptions.onEvent === 'function') {
        baseOptions.onEvent(event);
      }
      switch (event.type) {
        case 'manifest:ready':
          if (event.manifest) {
            console.log('');
            renderManifestPreview(event.manifest, event.manifestPath || null);
          }
          break;
        default:
          break;
      }
    },
  };
  for (const siteName of sites) {
    console.log(`\n==============================`);
    console.log(`Running Playwright suite for site: ${siteName}`);
    console.log('==============================\n');

    try {
      const result = await TestRunner.runTestsForSite(siteName, optionsWithEvents);
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
      await TestRunner.updateBaselines(site);
    }
    return;
  }

  const options = {
    visual: coerceBoolean(argv.visual),
    responsive: coerceBoolean(argv.responsive),
    functionality: coerceBoolean(argv.functionality),
    accessibility: coerceBoolean(argv.accessibility),
    allGroups: false,
    debug: coerceBoolean(argv.debug),
    discover: coerceBoolean(argv.discover),
    local: coerceBoolean(argv.local),
    project: argv.browsers || argv.browser || argv.project,
    limit: argv.pages,
    a11yKeyboardSteps: undefined,
    specs,
    workers: argv.workers,
    envOverrides: {},
    outputWriter: null,
  };

  if (argv.output) {
    const resolvedOutput = path.resolve(process.cwd(), String(argv.output));
    options.outputWriter = {
      path: resolvedOutput,
      runs: [],
      capture(event) {
        if (!event || !event.siteName) return;
        const ensureEntry = () => {
          let entry = this.runs.find((item) => item.siteName === event.siteName);
          if (!entry) {
            entry = { siteName: event.siteName, manifest: null, manifestPath: null, summary: null };
            this.runs.push(entry);
          }
          return entry;
        };
        const entry = ensureEntry();
        switch (event.type) {
          case 'manifest:ready':
            entry.manifest = event.manifest || null;
            entry.manifestPath = event.manifestPath || null;
            break;
          case 'manifest:persisted':
            entry.manifestPath = event.manifestPath || null;
            break;
          case 'run:complete':
            entry.summary = {
              exitCode: event.code,
              reportSummary: event.summary || null,
              completedAt: new Date().toISOString(),
            };
            break;
          default:
            break;
        }
      },
      write() {
        const payload = {
          generatedAt: new Date().toISOString(),
          runs: this.runs.map((run) => ({
            siteName: run.siteName,
            manifest: run.manifest || null,
            manifestPath: run.manifestPath ? path.relative(process.cwd(), run.manifestPath) : null,
            summary: run.summary || null,
          })),
        };
        fs.mkdirSync(path.dirname(this.path), { recursive: true });
        fs.writeFileSync(this.path, `${JSON.stringify(payload, null, 2)}\n`);
        console.log(`📝 Written run output to ${path.relative(process.cwd(), this.path)}`);
      },
    };
  }

  const exitCode = await runForSites(sites, options);
  if (options.outputWriter) {
    try {
      options.outputWriter.write();
    } catch (error) {
      console.error(`⚠️  Failed to write run output: ${error.message}`);
    }
  }
  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
