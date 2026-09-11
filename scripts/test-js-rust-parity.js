/**
 * Exhaustive JS ↔ Rust Parity & Cross-Layout Verification Suite.
 * 
 * Verifies that the JavaScript engine (layouts.js) and Rust engine (engine.rs via parity_runner)
 * produce 100% identical outputs across:
 * 1. en_us <-> all 23 layouts
 * 2. Colemak <-> Dvorak
 * 3. UK QWERTY (en_gb) <-> Polish (pl)
 * 4. Czech (cs) <-> Polish (pl)
 * 5. Thai (th) <-> English (en_us)
 * 6. Edge cases: AltGr, ISO IntlBackslash, Hangul composition, Uncased TitleCase/AllCaps.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

console.log('=== KeyFlip JS / Rust Parity Tests ===\n');

// 1. Load JS Engine
const enginePath = path.join(__dirname, '..', 'desktop', 'ui', 'layouts.js');
const engineCode = fs.readFileSync(enginePath, 'utf8');
const sandbox = { module: {}, exports: {}, globalThis: {}, window: {} };
vm.createContext(sandbox);
vm.runInContext(engineCode, sandbox);
const jsEngine = sandbox.module.exports || sandbox.window.KeyFlipEngine;

const layoutIds = Object.keys(jsEngine.LAYOUTS).sort();
console.log(`Loaded JS Engine with ${layoutIds.length} layouts.`);

// 2. Locate Rust parity_runner binary
const rustBinPath = path.join(__dirname, '..', 'desktop', 'src-tauri', 'target', 'debug', 'parity_runner.exe');
if (!fs.existsSync(rustBinPath)) {
  console.log('Compiling parity_runner.exe in Rust...');
  const buildRes = spawnSync('cargo', ['build', '--bin', 'parity_runner'], {
    cwd: path.join(__dirname, '..', 'desktop', 'src-tauri'),
    encoding: 'utf8'
  });
  if (buildRes.status !== 0) {
    console.error('Failed to compile Rust parity_runner:\n', buildRes.stderr);
    process.exit(1);
  }
}
console.log('Rust parity_runner is ready.\n');

// 3. Assemble test cases
const testCases = [];

function addTest(l1, l2, text, description) {
  testCases.push({ l1, l2, text, description: `[${l1} <-> ${l2}] ${description}` });
}

// Test A: en_us <-> All 23 Layouts
const standardPhrases = [
  'hello world',
  'HELLO WORLD',
  'Hello World',
  'Quick Brown Fox 123 !@#',
  'login',
  'LOGIN',
  'Chat',
  'chat'
];

for (const id of layoutIds) {
  if (id === 'en_us') continue;
  for (const phrase of standardPhrases) {
    addTest('en_us', id, phrase, `phrase "${phrase}"`);
  }
}

// Test B: Specific Cross-Layout Pairs
// 1. Colemak <-> Dvorak
addTest('colemak', 'dvorak', 'wfpgjlu', 'Colemak top row -> Dvorak');
addTest('colemak', 'dvorak', 'arstneio', 'Colemak home row -> Dvorak');
addTest('dvorak', 'colemak', 'aoeuhtns', 'Dvorak home row -> Colemak');

// 2. UK QWERTY (en_gb) <-> Polish (pl)
addTest('en_gb', 'pl', 'hello "world" £50 @user #hashtag', 'UK quotes & currency -> PL');
addTest('pl', 'en_gb', 'hello "world" @user #hashtag', 'PL quotes -> UK');

// 3. Czech (cs) <-> Polish (pl)
addTest('cs', 'pl', 'ěščřžýáíé', 'Czech accented row -> PL');
addTest('cs', 'pl', 'qwertz text', 'Czech QWERTZ -> PL');
addTest('pl', 'cs', 'qwerty text', 'PL QWERTY -> Czech');

// 4. Thai (th) <-> English (en_us)
addTest('en_us', 'th', 'hello', 'en_us -> Thai');
addTest('en_us', 'th', 'HELLO', 'en_us Caps -> Thai uncased');
addTest('en_us', 'th', 'Chat', 'en_us TitleCase -> Thai');
addTest('th', 'en_us', 'สวัสดี', 'Thai -> en_us');
addTest('th', 'en_us', 'ภาษาไทย', 'Thai -> en_us');

// 5. Korean Hangul Multi-syllable & Roundtrips
addTest('en_us', 'ko', 'gksrnr', 'en_us -> Korean Hangul (한국)');
addTest('ko', 'en_us', '한국', 'Korean Hangul (한국) -> en_us');
addTest('en_us', 'ko', 'dkssudgktpdy', 'en_us -> 안녕하세요');
addTest('ko', 'en_us', '안녕하세요', '안녕하세요 -> en_us');

// 6. Arabic / Persian / Hebrew / Russian
addTest('en_us', 'ar_101', 'chat', 'chat -> Arabic 101');
addTest('ar_101', 'en_us', 'ؤاشف', 'Arabic 101 -> chat');
addTest('en_us', 'ar_101', 'Chat', 'Chat -> Arabic TitleCase fix');
addTest('en_us', 'ar_101', 'CHAT', 'CHAT -> Arabic AllCaps');
addTest('en_us', 'fa', 'sghl', 'sghl -> Persian سلام');
addTest('en_us', 'he', 'akuo', 'akuo -> Hebrew שלום');
addTest('en_us', 'ru', 'ghbdtn', 'ghbdtn -> Russian привет');
addTest('en_us', 'ru', 'GHBDTN', 'GHBDTN -> Russian uppercase ПРИВЕТ');

// 7. ISO Physical Keys & AltGr Characters
addTest('de_qwertz', 'en_us', '<tag>', 'German ISO <tag>');
addTest('fr_azerty', 'en_us', '<script>', 'French ISO <script>');
addTest('es', 'en_us', '<div>', 'Spanish ISO <div>');
addTest('it', 'en_us', '<code>', 'Italian ISO <code>');
addTest('nordic', 'en_us', '<nordic>', 'Nordic ISO <nordic>');
addTest('tr_q', 'en_us', '<turk>', 'Turkish ISO <turk>');

addTest('pl', 'en_us', 'zażółć gęślą jaźń', 'Polish AltGr pangram');
addTest('de_qwertz', 'en_us', '100€', 'German AltGr €');
addTest('tr_q', 'en_us', '50₺', 'Turkish AltGr ₺');
addTest('pt', 'en_us', '10² + 10³', 'Portuguese AltGr exponents');
addTest('cs', 'en_us', 'łódź', 'Czech AltGr Polish ł');

// 8. Authentic Pangrams & Sentences Across All 23 Layouts
addTest('ar_101', 'en_us', 'نص حكيم له سر قاطع وذو شأن عظيم مكتوب على ثوب أخضر ومطرز بالذهب', 'Arabic 101 pangram');
addTest('ar_102', 'en_us', 'صوت صفير البلبل هج قلبي الثمل', 'Arabic 102 sentence');
addTest('fa', 'en_us', 'دژبان فرازگام چرخشت و پژهان را با خود برد', 'Persian pangram');
addTest('ur', 'en_us', 'احمد نے طوطے کو چوری کھلائی', 'Urdu sentence');
addTest('ru', 'en_us', 'Съешь же ещё этих мягких французских булок, да выпей чаю', 'Russian pangram');
addTest('uk', 'en_us', 'Чуєш, їхній ґедзь поїдає ці речі', 'Ukrainian pangram');
addTest('he', 'en_us', 'דג סקרן שט בים מאוכזב ولפתע מצא חברה', 'Hebrew pangram');
addTest('el', 'en_us', 'Ξεσκεπάζω την ψυχοφθόρα βδελυγμία', 'Greek pangram');
addTest('ko', 'en_us', '다람쥐 헌 쳇바퀴에 타고파', 'Korean pangram');
addTest('th', 'en_us', 'เป็นมนุษย์สุดประเสริฐเลิศคุณค่า', 'Thai sentence');
addTest('fr_azerty', 'en_us', 'Portez ce vieux whisky au juge blond qui fume', 'French AZERTY pangram');
addTest('de_qwertz', 'en_us', 'Victor jagt zwölf Boxkämpfer quer über den großen Sylter Deich', 'German QWERTZ pangram');
addTest('tr_q', 'en_us', 'Pijamalı hasta, yağız şoföre çabucak güvendi', 'Turkish Q pangram');
addTest('nordic', 'en_us', 'Flygande bäckasiner söka hwila på mjukt gräs', 'Nordic pangram');
addTest('pl', 'en_us', 'Stróż pchnął kość w quiz', 'Polish pangram');
addTest('cs', 'en_us', 'Příliš žluťoučký kůň úpěl ďábelské ódy', 'Czech pangram');
addTest('es', 'en_us', 'helloñ how are you- ¿comó estás?', 'Spanish sentence with ñ and punctuation');
addTest('it', 'en_us', 'helloò how are you- perché così?', 'Italian sentence with ò and accents');
addTest('pt', 'en_us', 'helloç how are you- não sei', 'Portuguese sentence with ç');
addTest('en_gb', 'en_us', 'hello @world" with £5 and ~home', 'UK English quotes and currency');

console.log(`Generated ${testCases.length} test cases across layouts.`);

// 4. Run JS Engine on all cases
console.log('Executing test cases in JavaScript Engine...');
const jsResults = testCases.map(tc => {
  const res = jsEngine.convertTextBetween(tc.text, tc.l1, tc.l2);
  const dirBool = res.fromLang === jsEngine.LAYOUTS[tc.l1].lang;
  return {
    converted: res.convertedText,
    from_1_to_2: dirBool
  };
});

// 5. Run Rust Engine on all cases via parity_runner
console.log('Executing test cases in Rust Engine (parity_runner.exe)...');
const rustInput = JSON.stringify(testCases.map(tc => ({
  text: tc.text,
  l1: tc.l1,
  l2: tc.l2
})));

const runner = spawnSync(rustBinPath, [], {
  input: rustInput,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024
});

if (runner.status !== 0) {
  console.error('Rust parity_runner failed:\n', runner.stderr);
  process.exit(1);
}

let rustResults;
try {
  rustResults = JSON.parse(runner.stdout);
} catch (e) {
  console.error('Failed to parse Rust parity_runner output:', runner.stdout);
  process.exit(1);
}

if (rustResults.length !== jsResults.length) {
  console.error(`Mismatch in result counts: JS=${jsResults.length}, Rust=${rustResults.length}`);
  process.exit(1);
}

// 6. Compare JS results vs Rust results byte-for-byte
console.log('\n--- Comparing JS Output vs Rust Output Byte-for-Byte ---');
let totalParityChecks = 0;
let passedParityChecks = 0;
let failedParityChecks = 0;

for (let i = 0; i < testCases.length; i++) {
  const tc = testCases[i];
  const js = jsResults[i];
  const rust = rustResults[i];

  totalParityChecks++;

  let match = true;
  if (js.converted !== rust.converted) {
    match = false;
  }

  if (match) {
    passedParityChecks++;
  } else {
    failedParityChecks++;
    console.error(`❌ [MISMATCH] ${tc.description}:`);
    console.error(`   Input Text:  ${JSON.stringify(tc.text)}`);
    console.error(`   JS Engine:   ${JSON.stringify(js.converted)}`);
    console.error(`   Rust Engine: ${JSON.stringify(rust.converted)}`);
  }
}

if (failedParityChecks === 0) {
  console.log(`\n✓ Parity verified: ${passedParityChecks}/${totalParityChecks} tests match between JS and Rust engines.\n`);
} else {
  console.error(`\n✗ Parity failure: ${failedParityChecks} mismatches out of ${totalParityChecks}.\n`);
  process.exit(1);
}
