# Interactive Mode - CLAUDE.md

This file provides Claude Code guidance for working within the **interactive-mode/** directory, which houses the menu-driven CLI interface for the WordPress Testing Suite.

## Directory Purpose

The interactive-mode directory contains the user-friendly command-line interface that abstracts complex testing operations into an intuitive menu system. This enables non-technical users to execute comprehensive WordPress testing workflows without memorizing command syntax.

## Core Components

### interactive.js - Main CLI Controller
**Primary Functions:**
- **Menu Management**: Hierarchical navigation system with back/quit support
- **Site Testing Interface**: Guided test execution with real-time feedback
- **Configuration Management**: Interactive site config creation and editing
- **Report Access**: Easy viewing and management of test reports
- **Cleanup Utilities**: Automated artifact and report cleanup tools

**Key Implementation Patterns:**
- **Graceful Input Handling**: Readline with TTY checks and SIGINT handling
- **Clear Screen Management**: ANSI escape codes for cross-platform compatibility
- **Error Recovery**: Comprehensive try-catch with fallback to main menu
- **State Persistence**: Auto-saves configuration changes immediately

### core/sitemap-parser.js - Page Discovery Engine
**Primary Functions:**
- **Multi-Format Sitemap Support**: Handles sitemap.xml, sitemap_index.xml, wp-sitemap.xml
- **Intelligent Exclusions**: Security, system, and content-based filtering
- **Auto-Discovery Workflow**: Finds up to 30 pages with sensible defaults
- **Local Development Support**: SSL certificate bypass for .local domains

**WordPress-Specific Features:**
- **Exclusion Patterns**: Automatically excludes `/wp-admin`, `/wp-login`, demo content
- **Sitemap Index Parsing**: Recursively processes WordPress multi-sitemap structures
- **Content Type Filtering**: Excludes files (.pdf, .jpg) and query parameters
- **Fallback Strategy**: Multiple sitemap URL attempts with graceful degradation

## Interactive Mode Best Practices

### When Working on CLI Components

**Always Consider User Experience:**
- **Progress Feedback**: Show what's happening during long operations
- **Clear Error Messages**: Explain what went wrong AND what to do next
- **Intuitive Navigation**: Consistent menu numbering and back/quit options
- **Confirmation Prompts**: Require explicit confirmation for destructive operations

**Input Validation Patterns:**
```javascript
// Always check TTY state before interactive prompts
if (this.rl.closed || !process.stdin.isTTY) {
  resolve('q'); // Auto-exit when not interactive
  return;
}

// Handle special keys consistently
if (input === 'q' || input === 'Q') {
  console.log('\nExiting without saving...');
  process.exit(0);
}
```

### Site Configuration Management

**Configuration Structure Requirements:**
- **Required Fields**: `name`, `baseUrl`, `testPages` are mandatory
- **Default Elements**: Always include navigation, header, footer in `criticalElements`
- **Page Path Format**: Ensure paths start with `/`, handle homepage as `/`
- **URL Validation**: Verify baseUrl format and accessibility before saving

**Auto-Discovery Integration:**
- **Respect maxPages Limits**: Default to 20-30 pages to prevent excessive test times
- **Enable Verbose Mode**: Show discovery progress to users
- **Provide Fallbacks**: If discovery fails, default to homepage only
- **Security First**: Use built-in exclusion patterns for WordPress security

### Error Handling Patterns

**Graceful Degradation:**
```javascript
try {
  // Primary operation
  const result = await primaryFunction();
  return result;
} catch (error) {
  console.log(`❌ Primary operation failed: ${error.message}`);
  // Continue with fallback or return to menu
  await this.waitForEnter();
  return this.showMainMenu();
}
```

**User-Friendly Error Messages:**
- **Specific Actions**: Tell users exactly what to do ("Check if site exists", "Verify configuration")
- **Context Information**: Include the operation that failed and current state
- **Recovery Options**: Always provide a way back to a working state

## Architecture Integration

### TestRunner Integration
**Expected Interface:**
- `TestRunner.listSites()` - Returns categorized site collections
- `TestRunner.runTestsForSite(siteName, options)` - Executes tests with promise resolution
- `TestRunner.updateBaselines(siteName)` - Updates visual regression baselines

### SitemapParser Integration
**Configuration Options:**
```javascript
await SitemapParser.discoverPages(baseUrl, {
  maxPages: 30,           // Limit results
  verbose: true,          // Show progress
  excludeDemo: true,      // Exclude WordPress demo content
  excludeTestimonials: false,  // Include testimonials
  customExclusions: []    // Additional patterns
});
```

## Development Guidelines

### Adding New Interactive Features

**Menu Structure:**
1. **Add Menu Option**: Include in appropriate menu with sequential numbering
2. **Handle Choice**: Add case to switch statement with error handling
3. **Sub-Menu Support**: Create dedicated method for complex features
4. **Navigation Consistency**: Support 'b' for back, 'q' for quit in all menus

**Testing Interactive Features:**
- **Non-Interactive Mode**: Ensure features work in automated contexts
- **Input Validation**: Test edge cases (empty input, invalid numbers)
- **Error Recovery**: Verify graceful handling of unexpected errors
- **State Preservation**: Confirm changes are saved correctly

### Code Style for Interactive Components

**Console Output Standards:**
- **Use Emojis Consistently**: 🎯 for testing, 📝 for config, 🧹 for cleanup
- **Status Indicators**: ✅ success, ❌ error, ⚠️ warning, 📡 discovery
- **Clear Hierarchy**: Use consistent indentation and spacing
- **Progress Updates**: Show what's happening during long operations

**Async/Await Patterns:**
- **Always await interactive prompts**: Ensure proper sequencing
- **Handle promise rejections**: Every async operation needs error handling
- **Use proper timeouts**: Don't let operations hang indefinitely

## WordPress-Specific Considerations

### Site Configuration Patterns
**Local Development Sites:**
- **Naming Convention**: `sitename-local.json` for Local by Flywheel sites
- **SSL Handling**: Expect self-signed certificates, configure `ignoreHTTPSErrors`
- **Domain Patterns**: `.local` domains common (e.g., `site.local`)

**Production Sites:**
- **Naming Convention**: `sitename-live.json` for production/staging
- **Security Awareness**: Never store credentials in configurations
- **Performance Considerations**: Limit page counts for faster testing

### Common WordPress Patterns
**Critical Elements (Always Test):**
```javascript
{
  "criticalElements": [
    {"name": "Main Navigation", "selector": ".main-navigation, #main-menu, nav"},
    {"name": "Header", "selector": "header, .site-header"},
    {"name": "Footer", "selector": "footer, .site-footer"}
  ]
}
```

**Sitemap Discovery Exclusions:**
- **Security Pages**: `/wp-admin`, `/wp-login`, `/wp-json`
- **System Files**: `.xml`, `.pdf`, media files
- **Demo Content**: `/hello-world/`, `/sample-page/`
- **Dynamic URLs**: Query parameters, anchor links

## Performance Considerations

### Optimization Strategies
- **Limit Concurrent Operations**: Don't overwhelm servers during discovery
- **Cache Configuration**: Avoid re-reading configs unnecessarily  
- **Progress Indicators**: Keep users informed during long operations
- **Cleanup Automation**: Remove old artifacts to prevent disk bloat

### Memory Management
- **Close Resources**: Always close readline interfaces properly
- **Cleanup Processes**: Kill orphaned background processes
- **Limit Recursion**: Prevent infinite loops in sitemap parsing

---

**Remember**: The interactive mode is the primary interface for non-technical users. Every feature should be intuitive, well-documented, and fail gracefully with clear guidance for recovery.