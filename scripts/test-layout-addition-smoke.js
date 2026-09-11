/**
 * Layout Addition Smoke Test for KeyFlip.
 * 
 * Verifies the foundational architecture principle:
 *   "Layout = Pure Data, Engine = Generic Logic"
 * 
 * Flow:
 * 1. Dynamically writes a brand new, previously non-existent layout (test_custom.json).
 * 2. Runs the semantic validator -> verifies it passes with 0 errors.
 * 3. Runs the build generator -> compiles it into all target bundles.
 * 4. Loads the compiled bundles and performs real bidirectional text conversions.
 * 5. Tests compounds/ligatures on the newly added layout.
 * 6. Verifies Rust layouts.json contains the compiled layout mappings.
 * 7. Cleans up temporary test files and rebuilds to restore pristine state.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const vm = require('vm');
const { PHYSICAL_KEYS } = require('./physical-key-table');

const rootDir = path.join(__dirname, '..');
const layoutsDir = path.join(rootDir, 'core', 'layouts');
const testLayoutPath = path.join(layoutsDir, 'test_custom.json');

console.log('=== Starting KeyFlip Layout Addition Smoke Test ===\n');

try {
  // Step 1: Synthesize a brand new layout definition
  console.log('1. Generating a new custom test layout in core/layouts/test_custom.json...');

  const customKeys = {};
  for (const [code, layers] of Object.entries(PHYSICAL_KEYS)) {
    if (layers.default === null) continue;
    const defChar = layers.default;
    const shiftChar = layers.shift || null;
    customKeys[code] = {
      default: defChar === 'x' ? 'ξ' : (defChar === 'y' ? 'υ' : (defChar === 'z' ? 'ζ' : defChar)),
      shift: shiftChar === 'X' ? 'Ξ' : (shiftChar === 'Y' ? 'Υ' : (shiftChar === 'Z' ? 'Ζ' : shiftChar)),
      altGr: null,
      shiftAltGr: null
    };
  }

  const customLayout = {
    $schema: './schema.json',
    id: 'test_custom',
    name: 'Custom Test Layout (Smoke Test)',
    language: 'tc',
    direction: 'ltr',
    standard: 'ansi',
    hasCase: true,
    capsLockBehavior: 'standard',
    composition: null,
    keys: customKeys,
    compounds: {
      'ξυ': { key: 'KeyX', layer: 'default' }
    },
    deadKeys: {}
  };

  fs.writeFileSync(testLayoutPath, JSON.stringify(customLayout, null, 2), 'utf8');
  console.log('   ✅ Created core/layouts/test_custom.json\n');

  // Step 2: Validate layouts including the new one
  console.log('2. Running semantic validator with new layout...');
  const valOutput = execSync('node scripts/validate-layouts.js', { cwd: rootDir, encoding: 'utf8' });
  if (!valOutput.includes('[test_custom] PASSED')) {
    throw new Error('test_custom layout failed validation!\n' + valOutput);
  }
  console.log('   ✅ test_custom PASSED validation with 0 errors.\n');

  const baseCount = fs.readdirSync(layoutsDir).filter(f => f.endsWith('.json') && f !== 'schema.json' && f !== 'test_custom.json').length;

  // Step 3: Build targets with new layout
  console.log('3. Running layout build system...');
  const buildOutput = execSync('node scripts/build-layouts.js', { cwd: rootDir, encoding: 'utf8' });
  if (!buildOutput.includes(`compiled ${baseCount + 1} layouts`)) {
    throw new Error(`Expected ${baseCount + 1} layouts to be compiled!\n` + buildOutput);
  }
  console.log(`   ✅ All target bundles rebuilt with ${baseCount + 1} layouts.\n`);

  // Step 4: Test Engine conversion using the new layout WITHOUT ANY ENGINE CHANGES
  console.log('4. Testing live conversion with test_custom in Engine...');
  const compiledJsCode = fs.readFileSync(path.join(rootDir, 'desktop', 'ui', 'layouts.js'), 'utf8');
  const sandbox = { module: {}, exports: {}, globalThis: {}, window: {} };
  vm.createContext(sandbox);
  vm.runInContext(compiledJsCode, sandbox);
  const engine = sandbox.module.exports || sandbox.window.KeyFlipEngine;

  if (!engine.LAYOUTS['test_custom']) {
    throw new Error('test_custom not found in compiled Engine LAYOUTS!');
  }

  // Forward conversion: en_us -> test_custom
  const fwd = engine.convertTextBetween('zyx', 'en_us', 'test_custom');
  console.log(`   Conversion (en_us -> test_custom): "zyx" -> "${fwd.convertedText}"`);
  if (fwd.convertedText !== 'ζυξ') {
    throw new Error(`Expected "ζυξ", got "${fwd.convertedText}"`);
  }

  // Reverse conversion: test_custom -> en_us (order that doesn't trigger compound 'ξυ')
  const rev = engine.convertTextBetween('ζυξ', 'en_us', 'test_custom');
  console.log(`   Reverse (test_custom -> en_us):    "ζυξ" -> "${rev.convertedText}"`);
  if (rev.convertedText !== 'zyx') {
    throw new Error(`Expected "zyx", got "${rev.convertedText}"`);
  }

  // Uppercase conversion
  const upper = engine.convertTextBetween('ZYX', 'en_us', 'test_custom');
  console.log(`   Uppercase:                         "ZYX" -> "${upper.convertedText}"`);
  if (upper.convertedText !== 'ΖΥΞ') {
    throw new Error(`Expected "ΖΥΞ", got "${upper.convertedText}"`);
  }

  // Compound ligature conversion test: 'ξυ' -> 'x'
  const comp = engine.convertTextBetween('ξυ', 'en_us', 'test_custom');
  console.log(`   Compound Ligature:                 "ξυ" -> "${comp.convertedText}"`);
  if (comp.convertedText !== 'x') {
    throw new Error(`Expected compound "ξυ" -> "x", got "${comp.convertedText}"`);
  }

  console.log('   ✅ Engine converted all test strings & compounds flawlessly with ZERO engine code modification!\n');

  // Step 5: Verify Rust JSON bundle contains test_custom
  console.log('5. Verifying Rust layouts.json bundle...');
  const rustJsonRaw = fs.readFileSync(path.join(rootDir, 'desktop', 'src-tauri', 'src', 'layouts.json'), 'utf8');
  const rustJson = JSON.parse(rustJsonRaw);
  if (!rustJson.test_custom || !rustJson.test_custom.physicalToChar || !rustJson.test_custom.charToPhysical) {
    throw new Error('test_custom not properly formatted in Rust layouts.json!');
  }
  console.log(`   ✅ Rust bundle contains test_custom (${Object.keys(rustJson.test_custom.physicalToChar).length} physical keys)\n`);

} finally {
  // Step 6: Cleanup - restore repository to pristine state
  console.log('6. Cleaning up test layout and restoring pristine bundles...');
  if (fs.existsSync(testLayoutPath)) {
    fs.unlinkSync(testLayoutPath);
  }
  execSync('node scripts/build-layouts.js', { cwd: rootDir, stdio: 'ignore' });
  const restoredCount = fs.readdirSync(layoutsDir).filter(f => f.endsWith('.json') && f !== 'schema.json').length;
  console.log(`   ✅ Pristine state restored (${restoredCount} layouts).\n`);
}

console.log('✓ Smoke test passed: layout addition verified.\n');
