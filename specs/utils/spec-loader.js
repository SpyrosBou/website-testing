/**
 * Specification Loader for WordPress Testing Suite
 * 
 * Loads and parses YAML test specifications, providing a unified interface
 * for accessing test requirements and configuration.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class SpecificationLoader {
  constructor() {
    this.specsDir = path.join(__dirname, '..');
    this.loadedSpecs = new Map();
    this.specCategories = [
      'core-infrastructure',
      'navigation-ux', 
      'interactive-elements',
      'accessibility',
      'wordpress-specific'
    ];
  }

  /**
   * Load all specifications from all categories
   * @returns {Object} Organized specifications by category
   */
  loadAllSpecifications() {
    const allSpecs = {};
    
    for (const category of this.specCategories) {
      try {
        allSpecs[category] = this.loadSpecificationCategory(category);
        console.log(`✅ Loaded ${Object.keys(allSpecs[category]).length} specifications from ${category}`);
      } catch (error) {
        console.error(`⚠️  Failed to load specifications from ${category}:`, error.message);
        allSpecs[category] = {};
      }
    }
    
    return allSpecs;
  }

  /**
   * Load all specifications from a specific category
   * @param {string} category - The specification category
   * @returns {Object} Specifications in the category
   */
  loadSpecificationCategory(category) {
    const categoryPath = path.join(this.specsDir, category);
    
    if (!fs.existsSync(categoryPath)) {
      throw new Error(`Specification category not found: ${category}`);
    }

    const specs = {};
    const files = fs.readdirSync(categoryPath)
      .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
      .filter(file => !file.startsWith('.')); // Ignore hidden files

    for (const file of files) {
      try {
        const specName = path.basename(file, path.extname(file));
        const filePath = path.join(categoryPath, file);
        specs[specName] = this.loadSpecificationFile(filePath);
        specs[specName]._metadata = {
          ...specs[specName]._metadata,
          category,
          filename: file,
          loadedAt: new Date().toISOString()
        };
      } catch (error) {
        console.error(`⚠️  Failed to load specification ${file}:`, error.message);
      }
    }

    return specs;
  }

  /**
   * Load a single specification file
   * @param {string} filePath - Path to the YAML specification file
   * @returns {Object} Parsed specification
   */
  loadSpecificationFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Specification file not found: ${filePath}`);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const spec = yaml.load(content);
      
      // Validate basic structure
      this.validateSpecification(spec, filePath);
      
      // Cache the loaded specification
      this.loadedSpecs.set(filePath, spec);
      
      return spec;
    } catch (error) {
      throw new Error(`Failed to parse YAML specification ${filePath}: ${error.message}`);
    }
  }

  /**
   * Get specifications by priority level
   * @param {string} priority - Priority level (critical, high, medium, low)
   * @returns {Array} Specifications matching the priority
   */
  getSpecificationsByPriority(priority) {
    const allSpecs = this.loadAllSpecifications();
    const matchingSpecs = [];

    for (const [category, specs] of Object.entries(allSpecs)) {
      for (const [name, spec] of Object.entries(specs)) {
        if (spec.metadata && spec.metadata.priority === priority) {
          matchingSpecs.push({
            category,
            name,
            ...spec
          });
        }
      }
    }

    return matchingSpecs;
  }

  /**
   * Get specifications by tag
   * @param {string} tag - Tag to filter by
   * @returns {Array} Specifications containing the tag
   */
  getSpecificationsByTag(tag) {
    const allSpecs = this.loadAllSpecifications();
    const matchingSpecs = [];

    for (const [category, specs] of Object.entries(allSpecs)) {
      for (const [name, spec] of Object.entries(specs)) {
        if (spec.metadata && spec.metadata.tags && spec.metadata.tags.includes(tag)) {
          matchingSpecs.push({
            category,
            name,
            ...spec
          });
        }
      }
    }

    return matchingSpecs;
  }

  /**
   * Get test cases from all specifications
   * @param {Object} options - Filtering options
   * @returns {Array} All test cases with metadata
   */
  getAllTestCases(options = {}) {
    const { category, priority, tags, browsers } = options;
    const allSpecs = this.loadAllSpecifications();
    const testCases = [];

    for (const [specCategory, specs] of Object.entries(allSpecs)) {
      if (category && specCategory !== category) continue;

      for (const [specName, spec] of Object.entries(specs)) {
        if (!spec.test_cases) continue;

        for (const testCase of spec.test_cases) {
          // Apply filters
          if (priority && testCase.priority !== priority) continue;
          if (tags && !tags.some(tag => spec.metadata.tags?.includes(tag))) continue;
          if (browsers && spec.configuration?.browsers && 
              !browsers.some(browser => spec.configuration.browsers.includes(browser))) continue;

          testCases.push({
            specCategory,
            specName,
            testCase: {
              ...testCase,
              _specMetadata: spec.metadata,
              _specConfiguration: spec.configuration
            }
          });
        }
      }
    }

    return testCases;
  }

  /**
   * Generate test execution plan
   * @param {Object} options - Execution options
   * @returns {Object} Organized test execution plan
   */
  generateExecutionPlan(options = {}) {
    const { priorities = ['critical', 'high', 'medium'], browsers = ['chrome'], includeCategories } = options;
    
    const plan = {
      metadata: {
        generatedAt: new Date().toISOString(),
        priorities,
        browsers,
        totalSpecs: 0,
        totalTestCases: 0
      },
      categories: {}
    };

    const allSpecs = this.loadAllSpecifications();

    for (const [category, specs] of Object.entries(allSpecs)) {
      if (includeCategories && !includeCategories.includes(category)) continue;

      plan.categories[category] = {
        specs: {},
        summary: {
          specCount: 0,
          testCaseCount: 0,
          estimatedDuration: 0
        }
      };

      for (const [specName, spec] of Object.entries(specs)) {
        if (!spec.test_cases) continue;

        // Filter test cases by priority
        const filteredTestCases = spec.test_cases.filter(testCase => 
          priorities.includes(testCase.priority)
        );

        if (filteredTestCases.length === 0) continue;

        plan.categories[category].specs[specName] = {
          metadata: spec.metadata,
          configuration: spec.configuration,
          testCases: filteredTestCases,
          estimatedDuration: this.estimateTestDuration(spec, filteredTestCases, browsers)
        };

        plan.categories[category].summary.specCount++;
        plan.categories[category].summary.testCaseCount += filteredTestCases.length;
        plan.categories[category].summary.estimatedDuration += plan.categories[category].specs[specName].estimatedDuration;
      }

      plan.metadata.totalSpecs += plan.categories[category].summary.specCount;
      plan.metadata.totalTestCases += plan.categories[category].summary.testCaseCount;
    }

    return plan;
  }

  /**
   * Estimate test execution duration
   * @param {Object} spec - Specification object
   * @param {Array} testCases - Test cases to execute
   * @param {Array} browsers - Browsers to test on
   * @returns {number} Estimated duration in milliseconds
   */
  estimateTestDuration(spec, testCases, browsers) {
    const baseTimeout = spec.configuration?.timeout || 30000;
    const retries = spec.configuration?.retries || 2;
    const parallel = spec.configuration?.parallel !== false;
    
    let duration = 0;
    
    for (const testCase of testCases) {
      const testTimeout = testCase.timeout || baseTimeout;
      const testDuration = testTimeout * (1 + retries * 0.5); // Factor in retries
      
      if (parallel) {
        duration = Math.max(duration, testDuration);
      } else {
        duration += testDuration;
      }
    }
    
    // Multiply by number of browsers if not parallel
    if (!parallel || browsers.length > 1) {
      duration *= browsers.length;
    }
    
    return duration;
  }

  /**
   * Validate specification structure
   * @param {Object} spec - Parsed specification
   * @param {string} filePath - File path for error reporting
   */
  validateSpecification(spec, filePath) {
    const required = ['metadata', 'configuration'];
    const missing = required.filter(field => !spec[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields in ${filePath}: ${missing.join(', ')}`);
    }

    if (!spec.metadata.category) {
      throw new Error(`Missing required metadata.category in ${filePath}`);
    }

    if (!spec.metadata.description) {
      throw new Error(`Missing required metadata.description in ${filePath}`);
    }

    if (!spec.test_cases || !Array.isArray(spec.test_cases)) {
      console.warn(`⚠️  No test_cases array found in ${filePath}`);
    }
  }

  /**
   * Get specification dependencies
   * @param {Object} spec - Specification object
   * @returns {Array} List of dependencies
   */
  getSpecificationDependencies(spec) {
    return spec.metadata?.dependencies || [];
  }

  /**
   * Check if all dependencies are available
   * @param {Array} dependencies - List of required dependencies
   * @returns {Object} Dependency check results
   */
  checkDependencies(dependencies) {
    const results = {
      satisfied: [],
      missing: [],
      allSatisfied: true
    };

    for (const dependency of dependencies) {
      try {
        // Check if dependency exists (simplified check)
        if (dependency.startsWith('test-helpers') || dependency.startsWith('site-loader') || 
            dependency.startsWith('wordpress-page-objects') || dependency.startsWith('@axe-core')) {
          results.satisfied.push(dependency);
        } else {
          results.missing.push(dependency);
          results.allSatisfied = false;
        }
      } catch (error) {
        results.missing.push(dependency);
        results.allSatisfied = false;
      }
    }

    return results;
  }
}

module.exports = SpecificationLoader;