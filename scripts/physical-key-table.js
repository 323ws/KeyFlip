/**
 * Authoritative W3C KeyboardEvent codes and their default US ANSI mapping.
 * Used for deterministic migration and bidirectional translation between
 * physical keys and legacy character-based mappings.
 */
'use strict';

const PHYSICAL_KEYS = {
  // Row 1 (Number row)
  Backquote: { default: '`', shift: '~' },
  Digit1: { default: '1', shift: '!' },
  Digit2: { default: '2', shift: '@' },
  Digit3: { default: '3', shift: '#' },
  Digit4: { default: '4', shift: '$' },
  Digit5: { default: '5', shift: '%' },
  Digit6: { default: '6', shift: '^' },
  Digit7: { default: '7', shift: '&' },
  Digit8: { default: '8', shift: '*' },
  Digit9: { default: '9', shift: '(' },
  Digit0: { default: '0', shift: ')' },
  Minus: { default: '-', shift: '_' },
  Equal: { default: '=', shift: '+' },

  // Row 2 (Top letter row)
  KeyQ: { default: 'q', shift: 'Q' },
  KeyW: { default: 'w', shift: 'W' },
  KeyE: { default: 'e', shift: 'E' },
  KeyR: { default: 'r', shift: 'R' },
  KeyT: { default: 't', shift: 'T' },
  KeyY: { default: 'y', shift: 'Y' },
  KeyU: { default: 'u', shift: 'U' },
  KeyI: { default: 'i', shift: 'I' },
  KeyO: { default: 'o', shift: 'O' },
  KeyP: { default: 'p', shift: 'P' },
  BracketLeft: { default: '[', shift: '{' },
  BracketRight: { default: ']', shift: '}' },
  Backslash: { default: '\\', shift: '|' },

  // Row 3 (Home row)
  KeyA: { default: 'a', shift: 'A' },
  KeyS: { default: 's', shift: 'S' },
  KeyD: { default: 'd', shift: 'D' },
  KeyF: { default: 'f', shift: 'F' },
  KeyG: { default: 'g', shift: 'G' },
  KeyH: { default: 'h', shift: 'H' },
  KeyJ: { default: 'j', shift: 'J' },
  KeyK: { default: 'k', shift: 'K' },
  KeyL: { default: 'l', shift: 'L' },
  Semicolon: { default: ';', shift: ':' },
  Quote: { default: "'", shift: '"' },

  // Row 4 (Bottom letter row)
  KeyZ: { default: 'z', shift: 'Z' },
  KeyX: { default: 'x', shift: 'X' },
  KeyC: { default: 'c', shift: 'C' },
  KeyV: { default: 'v', shift: 'V' },
  KeyB: { default: 'b', shift: 'B' },
  KeyN: { default: 'n', shift: 'N' },
  KeyM: { default: 'm', shift: 'M' },
  Comma: { default: ',', shift: '<' },
  Period: { default: '.', shift: '>' },
  Slash: { default: '/', shift: '?' },

  // ISO & International Keys
  IntlBackslash: { default: null, shift: null },
  IntlRo: { default: null, shift: null },
  IntlYen: { default: null, shift: null }
};

// Quick lookup: legacy char -> { code, layer }
const CHAR_TO_PHYSICAL = {};
for (const [code, layers] of Object.entries(PHYSICAL_KEYS)) {
  if (layers.default !== null) {
    CHAR_TO_PHYSICAL[layers.default] = { code, layer: 'default' };
  }
  if (layers.shift !== null) {
    CHAR_TO_PHYSICAL[layers.shift] = { code, layer: 'shift' };
  }
}

module.exports = {
  PHYSICAL_KEYS,
  CHAR_TO_PHYSICAL
};
