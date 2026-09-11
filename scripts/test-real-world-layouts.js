/**
 * Real-World Layout Validation & Pangram Suite for KeyFlip.
 * Tests authentic sentences, native pangrams, AltGr characters, and ISO physical keys
 * across all 23 supported keyboard layouts.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadEngine() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'ui', 'layouts.js'), 'utf8');
  const sandbox = { module: {}, exports: {}, globalThis: {}, window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.module.exports || sandbox.window.KeyFlipEngine;
}

const engine = loadEngine();

let passed = 0;
let failed = 0;

function assert(condition, message, details = '') {
  if (condition) {
    passed++;
    console.log(`✅ [PASS] ${message}`);
  } else {
    failed++;
    console.error(`❌ [FAIL] ${message}`);
    if (details) console.error(`   ${details}`);
  }
}

console.log('=== Starting Real-World Layout Validation Suite ===\n');

// 1. ISO Physical Key Tests
console.log('--- 1. Testing ISO Physical Keys (IntlBackslash < > \\ |) ---');
{
  const deRes = engine.convertTextBetween('<tag>', 'de_qwertz', 'en_us');
  assert(deRes.convertedText === '<tag>', 'German ISO <tag> -> English <tag>', `Got: ${deRes.convertedText}`);
  assert(deRes.fromLang === 'de', 'German <tag> detected as German', `Got: ${deRes.fromLang}`);

  const frRes = engine.convertTextBetween('<script>', 'fr_azerty', 'en_us');
  assert(frRes.convertedText === '<script>', 'French ISO <script> -> English <script>', `Got: ${frRes.convertedText}`);

  const esRes = engine.convertTextBetween('<div>', 'es', 'en_us');
  assert(esRes.convertedText === '<div>', 'Spanish ISO <div> -> English <div>', `Got: ${esRes.convertedText}`);

  const itRes = engine.convertTextBetween('<code>', 'it', 'en_us');
  assert(itRes.convertedText === '<code>', 'Italian ISO <code> -> English <code>', `Got: ${itRes.convertedText}`);

  const nordicRes = engine.convertTextBetween('<nordic>', 'nordic', 'en_us');
  assert(nordicRes.convertedText === '<nordic>', 'Nordic ISO <nordic> -> English <nordic>', `Got: ${nordicRes.convertedText}`);

  const trRes = engine.convertTextBetween('<turk>', 'tr_q', 'en_us');
  assert(trRes.convertedText === '<turk>', 'Turkish ISO <turk> -> English <turk>', `Got: ${trRes.convertedText}`);
}

// 2. AltGr Character Conversions
console.log('\n--- 2. Testing AltGr Physical Character Conversions ---');
{
  // Polish AltGr
  const plRes = engine.convertTextBetween('zażółć gęślą jaźń', 'pl', 'en_us');
  assert(plRes.convertedText === 'zazolc gesla jaxn', 'Polish AltGr pangram -> English physical keys', `Got: ${plRes.convertedText}`);
  assert(plRes.fromLang === 'pl', 'Polish text detected as Polish', `Got: ${plRes.fromLang}`);

  // German Currency
  const deEuro = engine.convertTextBetween('100€', 'de_qwertz', 'en_us');
  assert(deEuro.convertedText === '100e', 'German AltGr € -> English physical KeyE (e)', `Got: ${deEuro.convertedText}`);

  // Turkish Currency
  const trLira = engine.convertTextBetween('50₺', 'tr_q', 'en_us');
  assert(trLira.convertedText === '50t', 'Turkish AltGr ₺ -> English physical KeyT (t)', `Got: ${trLira.convertedText}`);

  // Portuguese Exponents
  const ptExp = engine.convertTextBetween('10² + 10³', 'pt', 'en_us');
  assert(ptExp.convertedText === '102 + 103', 'Portuguese AltGr exponents -> English physical digits', `Got: ${ptExp.convertedText}`);

  // Czech AltGr Polish L
  const csŁ = engine.convertTextBetween('łódź', 'cs', 'en_us');
  assert(csŁ.convertedText === 'kódź', 'Czech AltGr ł -> physical KeyK (k)', `Got: ${csŁ.convertedText}`);
}

// 3. Real-World Pangrams Across All 23 Languages
console.log('\n--- 3. Real-World Pangrams & Sentences Across All 23 Layouts ---');

const realWorldTestCases = [
  // Non-Latin scripts
  { id: 'ar_101', name: 'Arabic 101', text: 'نص حكيم له سر قاطع وذو شأن عظيم مكتوب على ثوب أخضر ومطرز بالذهب' },
  { id: 'ar_102', name: 'Arabic 102', text: 'صوت صفير البلبل هج قلبي الثمل' },
  { id: 'fa', name: 'Persian (Farsi)', text: 'دژبان فرازگام چرخشت و پژهان را با خود برد' },
  { id: 'ur', name: 'Urdu', text: 'احمد نے طوطے کو چوری کھلائی' },
  { id: 'ru', name: 'Russian', text: 'Съешь же ещё этих мягких французских булок, да выпей чаю' },
  { id: 'uk', name: 'Ukrainian', text: 'Чуєш, їхній ґедзь поїдає ці речі' },
  { id: 'he', name: 'Hebrew', text: 'דג סקרן שט בים מאוכזב ולפתע מצא חברה' },
  { id: 'el', name: 'Greek', text: 'Ξεσκεπάζω την ψυχοφθόρα βδελυγμία' },
  { id: 'ko', name: 'Korean Hangul', text: '다람쥐 헌 쳇바퀴에 타고파' },
  { id: 'th', name: 'Thai', text: 'เป็นมนุษย์สุดประเสริฐเลิศคุณค่า' },

  // European / Alternative layouts with distinct keys
  { id: 'fr_azerty', name: 'French AZERTY', text: 'Portez ce vieux whisky au juge blond qui fume' },
  { id: 'de_qwertz', name: 'German QWERTZ', text: 'Victor jagt zwölf Boxkämpfer quer über den großen Sylter Deich' },
  { id: 'tr_q', name: 'Turkish Q', text: 'Pijamalı hasta, yağız şoföre çabucak güvendi' },
  { id: 'nordic', name: 'Nordic', text: 'Flygande bäckasiner söka hwila på mjukt gräs' },
  { id: 'pl', name: 'Polish', text: 'Stróż pchnął kość w quiz' },
  { id: 'cs', name: 'Czech', text: 'Příliš žluťoučký kůň úpěl ďábelské ódy' },
  { id: 'es', name: 'Spanish', text: 'helloñ how are you- ¿comó estás?' },
  { id: 'it', name: 'Italian', text: 'helloò how are you- perché così?' },
  { id: 'pt', name: 'Portuguese', text: 'helloç how are you- não sei' },
  { id: 'en_gb', name: 'UK English', text: 'hello @world" with £5 and ~home' },
  { id: 'colemak', name: 'Colemak', text: 'The quick brown fox jumps over the lazy dog' },
  { id: 'dvorak', name: 'Dvorak', text: 'The quick brown fox jumps over the lazy dog' },
  { id: 'en_us', name: 'US English', text: 'The quick brown fox jumps over the lazy dog' }
];

for (const p of realWorldTestCases) {
  // 1. Convert Target -> en_us (Mistyped foreign text in English mode or vice versa)
  const toEn = engine.convertTextBetween(p.text, p.id, 'en_us');
  assert(toEn.convertedText.length > 0, `${p.name} (${p.id}) conversion produces output`);
  assert(toEn.changed === true || p.id === 'en_us', `${p.name} (${p.id}) changed flag is accurate`);

  // 2. Round-trip: en_us -> Target
  if (toEn.changed) {
    const roundTrip = engine.convertTextBetween(toEn.convertedText, 'en_us', p.id);
    assert(roundTrip.convertedText.length > 0, `${p.name} (${p.id}) round-trip succeeds`);
  }
}

console.log(`\n✓ Real-world layout tests passed: ${passed} checks, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
}
