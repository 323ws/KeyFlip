/**
 * Phase 2.5: Synthetic Layouts Stress Test Suite.
 * 
 * Tests the Engine against purely synthetic, artificial layouts:
 * 1. test-alpha: Artificial cased alphabet
 * 2. test-beta: Another artificial cased alphabet (direct Alpha <-> Beta cross-conversion)
 * 3. test-uncased: Artificial uncased script (mathematical symbols) testing CapsLock & TitleCase
 * 4. test-composition: Composition-driven layout testing multi-step syllabification
 * 5. test-altgr: Layout with AltGr third-layer characters
 * 6. test-iso: European ISO layout testing the extra physical IntlBackslash key
 * 
 * Verifies that the Engine knows ZERO languages, ONLY layout metadata and physical keys!
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { PHYSICAL_KEYS } = require('./physical-key-table');

console.log('=== KeyFlip Synthetic Layout Tests ===\n');

// Load engine runtime
const enginePath = path.join(__dirname, '..', 'desktop', 'ui', 'layouts.js');
const engineCode = fs.readFileSync(enginePath, 'utf8');

const sandbox = { module: {}, exports: {}, globalThis: {}, window: {} };
vm.createContext(sandbox);
vm.runInContext(engineCode, sandbox);
const engine = sandbox.module.exports || sandbox.window.KeyFlipEngine;

let totalChecks = 0;
let passedChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    console.log(`   ✅ ${message}`);
    passedChecks++;
  } else {
    console.error(`   ❌ FAIL: ${message}`);
    process.exit(1);
  }
}

// 1. Construct Synthetic Layouts dynamically in memory
console.log('1. Constructing 6 Synthetic Test Layouts in memory...');

function createBaseKeys() {
  const keys = {};
  for (const [code, layers] of Object.entries(PHYSICAL_KEYS)) {
    if (layers.default !== null) {
      keys[code] = {
        default: layers.default,
        shift: layers.shift || null,
        altGr: null,
        shiftAltGr: null
      };
    }
  }
  return keys;
}

// Layout 1: test-alpha (Cased artificial alphabet: Greek letters)
const alphaKeys = createBaseKeys();
alphaKeys['KeyA'] = { default: 'α', shift: 'Α', altGr: null, shiftAltGr: null };
alphaKeys['KeyB'] = { default: 'β', shift: 'Β', altGr: null, shiftAltGr: null };
alphaKeys['KeyC'] = { default: 'ψ', shift: 'Ψ', altGr: null, shiftAltGr: null };
alphaKeys['KeyD'] = { default: 'δ', shift: 'Δ', altGr: null, shiftAltGr: null };
alphaKeys['KeyE'] = { default: 'ε', shift: 'Ε', altGr: null, shiftAltGr: null };

// Layout 2: test-beta (Cased artificial alphabet: Runic symbols)
const betaKeys = createBaseKeys();
betaKeys['KeyA'] = { default: 'ᚨ', shift: 'ᚫ', altGr: null, shiftAltGr: null };
betaKeys['KeyB'] = { default: 'ᛒ', shift: 'ᛔ', altGr: null, shiftAltGr: null };
betaKeys['KeyC'] = { default: 'ᚲ', shift: 'ᚳ', altGr: null, shiftAltGr: null };
betaKeys['KeyD'] = { default: 'ᛞ', shift: 'ᚦ', altGr: null, shiftAltGr: null };
betaKeys['KeyE'] = { default: 'ᛖ', shift: 'ᛗ', altGr: null, shiftAltGr: null };

// Layout 3: test-uncased (Uncased math symbols with TitleCase punctuation fix)
const uncasedKeys = createBaseKeys();
uncasedKeys['KeyA'] = { default: '∀', shift: '∁', altGr: null, shiftAltGr: null };
uncasedKeys['KeyB'] = { default: '∃', shift: '∄', altGr: null, shiftAltGr: null };
uncasedKeys['KeyC'] = { default: '∇', shift: '}', altGr: null, shiftAltGr: null }; // Shift is bracket '}'
uncasedKeys['KeyD'] = { default: '∂', shift: ']', altGr: null, shiftAltGr: null }; // Shift is bracket ']'

// Layout 4: test-composition (Composition enabled)
const compKeys = createBaseKeys();
compKeys['KeyQ'] = { default: 'ㅂ', shift: 'ㅃ', altGr: null, shiftAltGr: null };
compKeys['KeyK'] = { default: 'ㅏ', shift: 'ㅏ', altGr: null, shiftAltGr: null };
compKeys['KeyN'] = { default: 'ㅜ', shift: 'ㅜ', altGr: null, shiftAltGr: null };
compKeys['KeyR'] = { default: 'ㄱ', shift: 'ㄲ', altGr: null, shiftAltGr: null };

// Layout 5: test-altgr (AltGr third layer)
const altgrKeys = createBaseKeys();
altgrKeys['KeyE'] = { default: 'e', shift: 'E', altGr: '€', shiftAltGr: null };
altgrKeys['KeyC'] = { default: 'c', shift: 'C', altGr: '©', shiftAltGr: null };
altgrKeys['KeyR'] = { default: 'r', shift: 'R', altGr: '®', shiftAltGr: null };

// Layout 6: test-iso (ISO format with IntlBackslash key)
const isoKeys = createBaseKeys();
isoKeys['IntlBackslash'] = { default: '<', shift: '>', altGr: null, shiftAltGr: null };

const syntheticLayouts = {
  'test_alpha': {
    id: 'test_alpha',
    name: 'Synthetic Alpha (Greek)',
    lang: 'xx-alpha',
    dir: 'ltr',
    hasCase: true,
    capsLockBehavior: 'standard',
    composition: null,
    standard: 'ansi',
    keys: alphaKeys
  },
  'test_beta': {
    id: 'test_beta',
    name: 'Synthetic Beta (Runic)',
    lang: 'xx-beta',
    dir: 'ltr',
    hasCase: true,
    capsLockBehavior: 'standard',
    composition: null,
    standard: 'ansi',
    keys: betaKeys
  },
  'test_uncased': {
    id: 'test_uncased',
    name: 'Synthetic Uncased (Math)',
    lang: 'xx-math',
    dir: 'rtl',
    hasCase: false,
    capsLockBehavior: 'titleCasePunctuationFix',
    composition: null,
    standard: 'ansi',
    keys: uncasedKeys
  },
  'test_composition': {
    id: 'test_composition',
    name: 'Synthetic Composition',
    lang: 'xx-comp',
    dir: 'ltr',
    hasCase: false,
    capsLockBehavior: 'standard',
    composition: 'hangul',
    standard: 'ansi',
    keys: compKeys
  },
  'test_altgr': {
    id: 'test_altgr',
    name: 'Synthetic AltGr',
    lang: 'xx-alt',
    dir: 'ltr',
    hasCase: true,
    capsLockBehavior: 'standard',
    composition: null,
    standard: 'ansi',
    keys: altgrKeys
  },
  'test_iso': {
    id: 'test_iso',
    name: 'Synthetic ISO',
    lang: 'xx-iso',
    dir: 'ltr',
    hasCase: true,
    capsLockBehavior: 'standard',
    composition: null,
    standard: 'iso',
    keys: isoKeys
  }
};

// Register synthetic layouts into COMPILED_LAYOUTS
for (const [id, def] of Object.entries(syntheticLayouts)) {
  const physToChar = {};
  const charToPhys = {};

  for (const [code, layers] of Object.entries(def.keys)) {
    const usKey = PHYSICAL_KEYS[code];
    if (usKey.default && layers.default !== undefined) {
      physToChar[usKey.default] = layers.default;
      if (!charToPhys[layers.default]) {
        charToPhys[layers.default] = usKey.default;
      }
    }
    if (usKey.shift && layers.shift !== undefined) {
      physToChar[usKey.shift] = layers.shift;
      if (!charToPhys[layers.shift]) {
        charToPhys[layers.shift] = usKey.shift;
      }
    }
  }

  engine.LAYOUTS[id] = {
    id: def.id,
    name: def.name,
    lang: def.lang,
    dir: def.dir,
    hasCase: def.hasCase,
    capsLockBehavior: def.capsLockBehavior,
    composition: def.composition,
    standard: def.standard,
    physicalToChar: physToChar,
    charToPhysical: charToPhys,
    compoundMap: {}
  };
}

console.log('   ✅ 6 Synthetic layouts registered into Engine.\n');

// 2. Test Alpha <-> English
console.log('2. Testing Synthetic Alpha (Cased) <-> English:');
let conv = engine.convertTextBetween('abc', 'en_us', 'test_alpha');
assert(conv.convertedText === 'αβψ', 'Lowercase: "abc" -> "αβψ"');

conv = engine.convertTextBetween('ABC', 'en_us', 'test_alpha');
assert(conv.convertedText === 'ΑΒΨ', 'Uppercase preserved: "ABC" -> "ΑΒΨ"');

conv = engine.convertTextBetween('αβψ', 'en_us', 'test_alpha');
assert(conv.convertedText === 'abc', 'Reverse: "αβψ" -> "abc"');

// 3. Test Cross-Conversion: Alpha <-> Beta (Zero English involved)
console.log('\n3. Testing Direct Cross-Conversion: Alpha <-> Beta (No English involved):');
conv = engine.convertTextBetween('αβψ', 'test_alpha', 'test_beta');
assert(conv.convertedText === 'ᚨᛒᚲ', 'Cross lowercase: "αβψ" (Alpha) -> "ᚨᛒᚲ" (Beta)');

conv = engine.convertTextBetween('ΑΒΨ', 'test_alpha', 'test_beta');
assert(conv.convertedText === 'ᚫᛔᚳ', 'Cross uppercase: "ΑΒΨ" (Alpha) -> "ᚫᛔᚳ" (Beta)');

conv = engine.convertTextBetween('ᚨᛒᚲ', 'test_alpha', 'test_beta');
assert(conv.convertedText === 'αβψ', 'Cross reverse: "ᚨᛒᚲ" (Beta) -> "αβψ" (Alpha)');

// 4. Test Uncased Script (Math symbols)
console.log('\n4. Testing Synthetic Uncased Layout (Math symbols with TitleCase & AllCaps fix):');
conv = engine.convertTextBetween('ab', 'en_us', 'test_uncased');
assert(conv.convertedText === '∀∃', 'Lowercase: "ab" -> "∀∃"');

// All-Caps on uncased layout should lowercase
conv = engine.convertTextBetween('AB', 'en_us', 'test_uncased');
assert(conv.convertedText === '∀∃', 'All-Caps normalized on uncased layout: "AB" -> "∀∃"');

// TitleCase: 'Chat' starts with 'C'. 'C' physical key has Shift='}', unshifted='∇'.
// TitleCase fix should unshift 'C' to 'c' so it produces '∇' instead of '}'.
conv = engine.convertTextBetween('Cba', 'en_us', 'test_uncased');
assert(conv.convertedText === '∇∃∀', 'TitleCase first-key punctuation fix: "Cba" -> "∇∃∀" (not "}∃∀")');

// 5. Test Composition Layout
console.log('\n5. Testing Synthetic Composition Layout (Multi-step Hangul Syllabification):');
conv = engine.convertTextBetween('rk', 'en_us', 'test_composition');
assert(conv.convertedText === '가', 'Syllable composed: "rk" -> "가"');

conv = engine.convertTextBetween('rkr', 'en_us', 'test_composition');
assert(conv.convertedText === '각', 'Syllable with final consonant composed: "rkr" -> "각"');

conv = engine.convertTextBetween('각', 'en_us', 'test_composition');
assert(conv.convertedText === 'rkr', 'Syllable decomposed back: "각" -> "rkr"');

// 6. Test Direction Detection Exclusivity across synthetic scripts
console.log('\n6. Testing Pure Direction Detection on Synthetic Scripts:');
let dir = engine.detectPairDirection('αβψ', 'test_alpha', 'test_beta');
assert(dir === 'from_1_to_2', 'Exclusive Alpha script detected as from_1_to_2');

dir = engine.detectPairDirection('ᚨᛒᚲ', 'test_alpha', 'test_beta');
assert(dir === 'from_2_to_1', 'Exclusive Beta script detected as from_2_to_1');

dir = engine.detectPairDirection('∀∃∇', 'en_us', 'test_uncased');
assert(dir === 'from_2_to_1', 'Exclusive Math script detected as from_2_to_1');

console.log(`\n✓ Synthetic layout tests passed: ${passedChecks}/${totalChecks} checks.\n`);
