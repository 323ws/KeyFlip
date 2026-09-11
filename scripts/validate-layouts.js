/**
 * Semantic Layout Validator for KeyFlip.
 * Performs deep structural and semantic integrity checks on all layouts in core/layouts/:
 * - Schema validation
 * - W3C Key Code validity
 * - Compound key reference resolution
 * - Duplicate & collision analysis
 * - Case sensitivity & CapsLock behavior consistency
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { PHYSICAL_KEYS } = require('./physical-key-table');

const layoutsDir = path.join(__dirname, '..', 'core', 'layouts');
const schemaPath = path.join(layoutsDir, 'schema.json');

if (!fs.existsSync(schemaPath)) {
  console.error('Error: schema.json not found!');
  process.exit(1);
}

const REQUIRED_FIELDS = [
  'id', 'name', 'language', 'direction', 'standard',
  'hasCase', 'capsLockBehavior', 'keys'
];

const VALID_STANDARDS = ['ansi', 'iso', 'jis', 'abnt2'];
const VALID_DIRECTIONS = ['ltr', 'rtl'];
const VALID_CAPS_BEHAVIORS = ['standard', 'titleCasePunctuationFix', 'none'];
const VALID_LAYERS = ['default', 'shift', 'altGr', 'shiftAltGr'];

const files = fs.readdirSync(layoutsDir).filter(f => f.endsWith('.json') && f !== 'schema.json');

let totalErrors = 0;
let totalWarnings = 0;
let validatedCount = 0;

console.log(`Validating ${files.length} layout files...\n`);

for (const file of files) {
  const filePath = path.join(layoutsDir, file);
  let layout;

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    layout = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ [${file}] Failed to parse JSON: ${err.message}`);
    totalErrors++;
    continue;
  }

  const errors = [];
  const warnings = [];

  // 1. Required fields
  for (const field of REQUIRED_FIELDS) {
    if (layout[field] === undefined || layout[field] === null) {
      errors.push(`Missing required field: '${field}'`);
    }
  }

  // 2. Metadata validations
  if (layout.standard && !VALID_STANDARDS.includes(layout.standard)) {
    errors.push(`Invalid standard '${layout.standard}'. Expected: ${VALID_STANDARDS.join(', ')}`);
  }

  if (layout.direction && !VALID_DIRECTIONS.includes(layout.direction)) {
    errors.push(`Invalid direction '${layout.direction}'. Expected: ${VALID_DIRECTIONS.join(', ')}`);
  }

  if (layout.capsLockBehavior && !VALID_CAPS_BEHAVIORS.includes(layout.capsLockBehavior)) {
    errors.push(`Invalid capsLockBehavior '${layout.capsLockBehavior}'. Expected: ${VALID_CAPS_BEHAVIORS.join(', ')}`);
  }

  if (typeof layout.hasCase !== 'boolean') {
    errors.push(`'hasCase' must be a boolean`);
  }

  // 3. Keys validation
  if (layout.keys && typeof layout.keys === 'object') {
    const keyCodes = Object.keys(layout.keys);

    if (keyCodes.length < 40) {
      warnings.push(`Low key count: only ${keyCodes.length} keys defined.`);
    }

    const charToKeys = new Map();

    for (const [code, layerMap] of Object.entries(layout.keys)) {
      // W3C key validity
      if (!PHYSICAL_KEYS[code]) {
        errors.push(`Unknown or invalid W3C KeyboardEvent code: '${code}'`);
      }

      if (!layerMap || typeof layerMap !== 'object') {
        errors.push(`Key '${code}' must be an object with layers`);
        continue;
      }

      if (layerMap.default === undefined || layerMap.default === null) {
        errors.push(`Key '${code}' missing required 'default' layer output`);
      }

      // Track duplicate character mappings across keys in default layer
      for (const layer of VALID_LAYERS) {
        const ch = layerMap[layer];
        if (ch) {
          if (!charToKeys.has(ch)) {
            charToKeys.set(ch, []);
          }
          charToKeys.get(ch).push({ code, layer });
        }
      }
    }

    // Check for duplicate character collisions
    for (const [ch, mappings] of charToKeys.entries()) {
      if (mappings.length > 1) {
        // Multi-mapping is allowed (e.g. digits on numpad or duplicate accents), but warn for alphabetic characters
        const isAlpha = /^\p{L}$/u.test(ch);
        if (isAlpha) {
          warnings.push(`Character '${ch}' mapped to multiple keys: ${mappings.map(m => `${m.code}:${m.layer}`).join(', ')}`);
        }
      }
    }
  } else {
    errors.push(`'keys' must be an object`);
  }

  // 4. Compound references semantic validation
  if (layout.compounds && typeof layout.compounds === 'object') {
    for (const [seq, ref] of Object.entries(layout.compounds)) {
      if (!ref || typeof ref !== 'object') {
        errors.push(`Compound '${seq}' target must be an object { key, layer }`);
        continue;
      }

      if (!ref.key || !ref.layer) {
        errors.push(`Compound '${seq}' target missing 'key' or 'layer'`);
        continue;
      }

      // Check that the referenced key exists in layout.keys
      if (!layout.keys || !layout.keys[ref.key]) {
        errors.push(`Compound '${seq}' references non-existent physical key: '${ref.key}'`);
      } else {
        const keyDef = layout.keys[ref.key];
        if (!keyDef[ref.layer]) {
          errors.push(`Compound '${seq}' references layer '${ref.layer}' on '${ref.key}', but that layer has no char defined`);
        }
      }
    }
  }

  // 5. Case consistency check
  if (layout.hasCase === true && layout.capsLockBehavior === 'titleCasePunctuationFix') {
    warnings.push(`'hasCase' is true but 'capsLockBehavior' is 'titleCasePunctuationFix'. Cased scripts should use 'standard'.`);
  }

  // Output results for this layout
  if (errors.length > 0) {
    console.error(`❌ [${layout.id || file}] ${errors.length} error(s):`);
    for (const err of errors) {
      console.error(`   - ${err}`);
    }
    totalErrors += errors.length;
  } else if (warnings.length > 0) {
    console.warn(`⚠️  [${layout.id || file}] PASSED with ${warnings.length} warning(s):`);
    for (const warn of warnings) {
      console.warn(`   - ${warn}`);
    }
    totalWarnings += warnings.length;
    validatedCount++;
  } else {
    console.log(`✅ [${layout.id || file}] PASSED (valid & complete)`);
    validatedCount++;
  }
}

console.log('\n================================');
console.log(`Summary: ${validatedCount}/${files.length} layouts valid.`);
console.log(`Total Errors: ${totalErrors}, Warnings: ${totalWarnings}`);
console.log('================================');

if (totalErrors > 0) {
  process.exit(1);
}
