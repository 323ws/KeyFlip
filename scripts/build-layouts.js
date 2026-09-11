/**
 * Build & Generator System for KeyFlip Layouts.
 * Reads core/layouts/*.json (Single Source of Truth), validates them,
 * and compiles them into target bundles for:
 * 1. Chrome Extension (layouts.js)
 * 2. Firefox Extension (firefox/layouts.js)
 * 3. Desktop Tauri UI (desktop/ui/layouts.js)
 * 4. Desktop Tauri Rust Core (desktop/src-tauri/src/layouts.json)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { PHYSICAL_KEYS } = require('./physical-key-table');

const rootDir = path.join(__dirname, '..');
const layoutsDir = path.join(rootDir, 'core', 'layouts');

// Target destinations
const targets = {
  chromeExt: path.join(rootDir, 'extensions', 'chrome', 'layouts.js'),
  firefoxExt: path.join(rootDir, 'extensions', 'firefox', 'layouts.js'),
  desktopUi: path.join(rootDir, 'desktop', 'ui', 'layouts.js'),
  desktopRust: path.join(rootDir, 'desktop', 'src-tauri', 'src', 'layouts.json')
};

// 1. Read and sort all layout files in core/layouts/
const files = fs.readdirSync(layoutsDir)
  .filter(f => f.endsWith('.json') && f !== 'schema.json')
  .sort();

console.log(`Building bundles from ${files.length} layouts in core/layouts/...\n`);

const compiledLayoutsData = {};
const compiledRustData = {};

for (const file of files) {
  const filePath = path.join(layoutsDir, file);
  const layout = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const id = layout.id;
  const legacyMap = {};

  // Build legacy character map: US physical char -> Target char
  for (const [code, keyLayers] of Object.entries(layout.keys)) {
    const usKey = PHYSICAL_KEYS[code];
    if (!usKey) continue;

    if (usKey.default && keyLayers.default !== undefined) {
      legacyMap[usKey.default] = keyLayers.default;
    }
    if (usKey.shift && keyLayers.shift !== undefined) {
      legacyMap[usKey.shift] = keyLayers.shift;
    }
  }

  // Build AltGr character map: US physical char -> Target AltGr char
  const altGrMap = {};
  for (const [code, keyLayers] of Object.entries(layout.keys)) {
    const usKey = PHYSICAL_KEYS[code];
    if (!usKey) continue;

    if (usKey.default && keyLayers.altGr) {
      altGrMap[usKey.default] = keyLayers.altGr;
    }
    if (usKey.shift && keyLayers.shiftAltGr) {
      altGrMap[usKey.shift] = keyLayers.shiftAltGr;
    }
  }

  // Build ISO extra key map (e.g. IntlBackslash: <, >, \, |)
  const isoMap = {};
  if (layout.keys.IntlBackslash) {
    const ib = layout.keys.IntlBackslash;
    if (ib.default) {
      if (ib.default === '<') isoMap['<'] = '<';
      else if (ib.default === '\\') isoMap['\\'] = '\\';
      else isoMap[ib.default] = ib.default;
    }
    if (ib.shift) {
      if (ib.shift === '>') isoMap['>'] = '>';
      else if (ib.shift === '|') isoMap['|'] = '|';
      else isoMap[ib.shift] = ib.shift;
    }
  }

  // Convert compounds back to legacy format { 'لا': 'b', 'لآ': 'B', ... }
  const legacyCompounds = {};
  if (layout.compounds) {
    for (const [seq, ref] of Object.entries(layout.compounds)) {
      const usKey = PHYSICAL_KEYS[ref.key];
      if (usKey) {
        const legacyChar = ref.layer === 'shift' ? usKey.shift : usKey.default;
        if (legacyChar) {
          legacyCompounds[seq] = legacyChar;
        }
      }
    }
  }

  compiledLayoutsData[id] = {
    id: layout.id,
    name: layout.name,
    lang: layout.language,
    dir: layout.direction,
    hasCase: layout.hasCase,
    capsLockBehavior: layout.capsLockBehavior,
    composition: layout.composition,
    standard: layout.standard,
    compoundMap: legacyCompounds,
    altGrMap: Object.keys(altGrMap).length > 0 ? altGrMap : undefined,
    isoMap: Object.keys(isoMap).length > 0 ? isoMap : undefined,
    map: legacyMap
  };

  // Build compiled structure for Rust (physicalToChar, charToPhysical)
  const physicalToChar = { ...legacyMap };
  const charToPhysical = {};

  // 1. Primary default and shift mappings
  for (const [physKey, char] of Object.entries(legacyMap)) {
    if (char && !charToPhysical[char]) {
      charToPhysical[char] = physKey;
    }
  }

  // 1.5. ISO extra keys (IntlBackslash: <, >, \, |)
  for (const [physKey, char] of Object.entries(isoMap)) {
    if (char && !charToPhysical[char]) {
      charToPhysical[char] = physKey;
    }
  }

  // 2. AltGr and ShiftAltGr mappings (non-ASCII characters: national letters, diacritics, €, etc.)
  // Prevents accidental collisions with ASCII symbols (@, {, }, [, ], \\) which have standard physical fallbacks
  for (const [physKey, char] of Object.entries(altGrMap)) {
    if (char && !charToPhysical[char]) {
      if (char.charCodeAt(0) > 127) {
        charToPhysical[char] = physKey;
      }
    }
  }

  compiledRustData[id] = {
    id: layout.id,
    name: layout.name,
    lang: layout.language,
    dir: layout.direction,
    hasCase: layout.hasCase,
    capsLockBehavior: layout.capsLockBehavior,
    composition: layout.composition,
    standard: layout.standard,
    physicalToChar: physicalToChar,
    charToPhysical: charToPhysical,
    compoundMap: Object.keys(legacyCompounds).length > 0 ? legacyCompounds : undefined
  };
}

// 2. Load the Engine Runtime Code from generic template
const engineTemplatePath = path.join(__dirname, 'engine-runtime-template.js');
const engineCode = fs.readFileSync(engineTemplatePath, 'utf8');

// 3. Assemble the Browser JavaScript Bundle
const formattedJsLayouts = '{\n' + Object.entries(compiledLayoutsData).map(([id, layout]) => {
  return `    ${JSON.stringify(id)}: ${JSON.stringify(layout)}`;
}).join(',\n') + '\n  };';

const jsHeader = `/**
 * KeyFlip Universal Keyboard Layouts Bundle
 * AUTOMATICALLY GENERATED FROM core/layouts/*.json - DO NOT EDIT DIRECTLY!
 * Generated at: ${new Date().toISOString()}
 */
(function (global) {
  'use strict';

  const LAYOUTS_DATA = ${formattedJsLayouts}

  `;

const fullJsBundle = jsHeader + engineCode;

// 4. Assemble the Rust JSON Bundle
const fullRustBundle = '{\n' + Object.entries(compiledRustData).map(([id, layout]) => {
  return `  ${JSON.stringify(id)}: ${JSON.stringify(layout)}`;
}).join(',\n') + '\n}\n';

// Write to target bundles
if (fs.existsSync(path.dirname(targets.chromeExt))) {
  fs.writeFileSync(targets.chromeExt, fullJsBundle, 'utf8');
  console.log(`✓ Chrome Extension: ${targets.chromeExt} (${(fullJsBundle.length / 1024).toFixed(1)} KB)`);
}

if (fs.existsSync(path.dirname(targets.firefoxExt))) {
  fs.writeFileSync(targets.firefoxExt, fullJsBundle, 'utf8');
  console.log(`✓ Firefox Extension: ${targets.firefoxExt} (${(fullJsBundle.length / 1024).toFixed(1)} KB)`);
}

if (fs.existsSync(path.dirname(targets.desktopUi))) {
  fs.writeFileSync(targets.desktopUi, fullJsBundle, 'utf8');
  console.log(`✓ Desktop UI: ${targets.desktopUi} (${(fullJsBundle.length / 1024).toFixed(1)} KB)`);
}

if (fs.existsSync(path.dirname(targets.desktopRust))) {
  fs.writeFileSync(targets.desktopRust, fullRustBundle, 'utf8');
  console.log(`✓ Desktop Rust: ${targets.desktopRust} (${(fullRustBundle.length / 1024).toFixed(1)} KB)`);
}

console.log(`\nBuild complete: compiled ${files.length} layouts into target bundles.`);
