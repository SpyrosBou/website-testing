# Interactive Mode

This directory contains the interactive command-line interface for the WordPress Testing Suite.

## Structure

```
interactive-mode/
├── README.md              # This file
├── interactive.js         # Main interactive interface class
└── core/                  # Core functionality
    └── sitemap-parser.js   # Sitemap parsing and page discovery logic
```

## Components

### `interactive.js`
- Main menu system and navigation
- Site configuration management
- Test execution interface
- Auto-discovery workflows

### `core/sitemap-parser.js`
- WordPress sitemap parsing
- Page discovery with configurable exclusions
- XML sitemap processing
- URL filtering and validation

## Usage

The interactive mode is launched via:
```bash
node run-tests.js --interactive
```

## Features

- **Site Management**: Create, edit, and configure test sites
- **Auto-Discovery**: Automatically find pages from WordPress sitemaps
- **Test Execution**: Run tests with guided options
- **Configuration**: JSON-based site configuration management
- **Cleanup**: Manage test artifacts and reports