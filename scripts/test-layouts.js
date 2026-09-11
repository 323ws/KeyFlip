/**
 * Test Suite for KeyFlip Engine (Universal Multi-Language & Caps Lock Verification)
 */

const KeyFlip = require('../desktop/ui/layouts.js');

let totalTests = 0;
let passedTests = 0;

function assertEqual(actual, expected, testName) {
  totalTests++;
  if (actual === expected) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    console.error(`   Expected: "${expected}"`);
    console.error(`   Actual:   "${actual}"`);
  }
}

console.log('=== Starting KeyFlip Universal Multi-Language Tests ===\n');

// 1. English <-> Arabic 101 (Lowercase, Caps Lock, Title Case)
console.log('--- Testing English <-> Arabic 101 ---');
let res = KeyFlip.convertTextBetween('chat', 'en_us', 'ar_101');
assertEqual(res.convertedText, 'ؤاشف', 'chat -> ؤاشف');

res = KeyFlip.convertTextBetween('ؤاشف', 'en_us', 'ar_101');
assertEqual(res.convertedText, 'chat', 'ؤاشف -> chat');

res = KeyFlip.convertTextBetween('hgsghl HGSGHL', 'en_us', 'ar_101');
assertEqual(res.convertedText, 'السلام السلام', 'hgsghl HGSGHL -> السلام السلام');

res = KeyFlip.convertTextBetween('CHAT', 'en_us', 'ar_101');
assertEqual(res.convertedText, 'ؤاشف', 'CHAT (All Caps) -> ؤاشف');

res = KeyFlip.convertTextBetween('Chat', 'en_us', 'ar_101');
assertEqual(res.convertedText, 'ؤاشف', 'Chat (Title Case) -> ؤاشف');

res = KeyFlip.convertTextBetween('LOGIN', 'en_us', 'ar_101');
assertEqual(res.convertedText, 'مخلهى', 'LOGIN -> مخلهى');

res = KeyFlip.convertTextBetween('Google', 'en_us', 'ar_101');
assertEqual(res.convertedText, 'لخخلمث', 'Google -> لخخلمث');

// 2. Persian (Farsi)
console.log('\n--- Testing English <-> Persian (Farsi) ---');
res = KeyFlip.convertTextBetween('sghl', 'en_us', 'fa');
assertEqual(res.convertedText, 'سلام', 'sghl -> سلام');

res = KeyFlip.convertTextBetween('SGHL', 'en_us', 'fa');
assertEqual(res.convertedText, 'سلام', 'SGHL (Caps Lock) -> سلام (Persian)');

// 3. Hebrew
console.log('\n--- Testing English <-> Hebrew ---');
res = KeyFlip.convertTextBetween('akuo', 'en_us', 'he');
assertEqual(res.convertedText, 'שלום', 'akuo -> שלום');

res = KeyFlip.convertTextBetween('AKUO', 'en_us', 'he');
assertEqual(res.convertedText, 'שלום', 'AKUO (Caps Lock) -> שלום (Hebrew)');

// 4. Urdu
console.log('\n--- Testing English <-> Urdu ---');
res = KeyFlip.convertTextBetween('aslam', 'en_us', 'ur');
assertEqual(res.convertedText, 'اسلام', 'aslam -> اسلام');

res = KeyFlip.convertTextBetween('ASLAM', 'en_us', 'ur');
assertEqual(res.convertedText, 'اسلام', 'ASLAM (Caps Lock) -> اسلام (Urdu)');

// 5. Korean (Hangul)
console.log('\n--- Testing English <-> Korean ---');
res = KeyFlip.convertTextBetween('gksrnr', 'en_us', 'ko');
assertEqual(res.convertedText, '한국', 'gksrnr -> 한국');

res = KeyFlip.convertTextBetween('GKSRNR', 'en_us', 'ko');
assertEqual(res.convertedText, '한국', 'GKSRNR (Caps Lock) -> 한국');

// 6. Russian (ЙЦУКЕН) - Case preservation
console.log('\n--- Testing English <-> Russian ---');
res = KeyFlip.convertTextBetween('ghbdtn', 'en_us', 'ru');
assertEqual(res.convertedText, 'привет', 'ghbdtn -> привет (Russian lowercase)');

res = KeyFlip.convertTextBetween('GHBDTN', 'en_us', 'ru');
assertEqual(res.convertedText, 'ПРИВЕТ', 'GHBDTN -> ПРИВЕТ (Russian uppercase preserved)');

res = KeyFlip.convertTextBetween('ПРИВЕТ', 'en_us', 'ru');
assertEqual(res.convertedText, 'GHBDTN', 'ПРИВЕТ -> GHBDTN (English uppercase preserved)');

// 7. Greek - Case preservation
console.log('\n--- Testing English <-> Greek ---');
res = KeyFlip.convertTextBetween('geia', 'en_us', 'el');
assertEqual(res.convertedText, 'γεια', 'geia -> γεια (Greek lowercase)');

res = KeyFlip.convertTextBetween('GEIA', 'en_us', 'el');
assertEqual(res.convertedText, 'ΓΕΙΑ', 'GEIA -> ΓΕΙΑ (Greek uppercase preserved)');

// 8. French AZERTY
console.log('\n--- Testing English <-> French AZERTY ---');
res = KeyFlip.convertTextBetween('wasd', 'en_us', 'fr_azerty');
assertEqual(res.convertedText, 'zqsd', 'wasd -> zqsd (AZERTY)');

res = KeyFlip.convertTextBetween('WASD', 'en_us', 'fr_azerty');
assertEqual(res.convertedText, 'ZQSD', 'WASD -> ZQSD (AZERTY uppercase)');

// 9. German QWERTZ
console.log('\n--- Testing English <-> German QWERTZ ---');
res = KeyFlip.convertTextBetween('test', 'en_us', 'de_qwertz');
assertEqual(res.convertedText, 'test', 'test -> test (German)');

// 10. Korean Hangul Comprehensive Tests (Parity with Rust)
console.log('\n--- Testing Korean Hangul Comprehensive Tests ---');
res = KeyFlip.convertTextBetween('sk', 'en_us', 'ko');
assertEqual(res.convertedText, '나', 'sk -> 나 (syllable without jongseong)');

res = KeyFlip.convertTextBetween('나', 'en_us', 'ko');
assertEqual(res.convertedText, 'sk', '나 -> sk (round-trip)');

res = KeyFlip.convertTextBetween('dkssud', 'en_us', 'ko');
assertEqual(res.convertedText, '안녕', 'dkssud -> 안녕 (2 syllables without jongseong)');

res = KeyFlip.convertTextBetween('dhk', 'en_us', 'ko');
assertEqual(res.convertedText, '와', 'dhk -> 와 (complex vowel)');

res = KeyFlip.convertTextBetween('dml', 'en_us', 'ko');
assertEqual(res.convertedText, '의', 'dml -> 의 (complex vowel)');

res = KeyFlip.convertTextBetween('gksrnrskfk', 'en_us', 'ko');
assertEqual(res.convertedText, '한국나라', 'gksrnrskfk -> 한국나라 (multi-syllable phrase)');

res = KeyFlip.convertTextBetween('한국나라', 'en_us', 'ko');
assertEqual(res.convertedText, 'gksrnrskfk', '한국나라 -> gksrnrskfk (multi-syllable round-trip)');

// 11. Generic Direction Detection & Ambiguity Tests
console.log('\n--- Testing Generic Direction Detection & Ambiguity ---');
let dir = KeyFlip.detectPairDirection('hello world', 'en_us', 'ar_101');
assertEqual(dir, 'from_1_to_2', 'Strongly English text -> from_1_to_2');

dir = KeyFlip.detectPairDirection('مرحبا بالعالم', 'en_us', 'ar_101');
assertEqual(dir, 'from_2_to_1', 'Strongly Arabic text -> from_2_to_1');

dir = KeyFlip.detectPairDirection('добрый день', 'en_us', 'ru');
assertEqual(dir, 'from_2_to_1', 'Strongly Russian text -> from_2_to_1');

dir = KeyFlip.detectPairDirection('καλημέρα', 'en_us', 'el');
assertEqual(dir, 'from_2_to_1', 'Strongly Greek text -> from_2_to_1');

dir = KeyFlip.detectPairDirection('שלום עולם', 'en_us', 'he');
assertEqual(dir, 'from_2_to_1', 'Strongly Hebrew text -> from_2_to_1');

dir = KeyFlip.detectPairDirection('한국', 'en_us', 'ko');
assertEqual(dir, 'from_2_to_1', 'Composed Hangul text -> from_2_to_1');

dir = KeyFlip.detectPairDirection('12345', 'en_us', 'ar_101');
assertEqual(dir, 'from_1_to_2', 'Ambiguous shared digits (12345) -> fallback from_1_to_2');

dir = KeyFlip.detectPairDirection('!@#$', 'en_us', 'ar_101');
assertEqual(dir, 'from_1_to_2', 'Ambiguous shared symbols (!@#$) -> fallback from_1_to_2');

dir = KeyFlip.detectPairDirection('   ', 'en_us', 'ar_101');
assertEqual(dir, 'from_1_to_2', 'Ambiguous whitespace -> fallback from_1_to_2');

// 12. Phase 3 Layouts: UK, Colemak, Dvorak, Polish, Czech, Thai
console.log('\n--- Testing Phase 3 New Layouts ---');
// UK QWERTY
res = KeyFlip.convertTextBetween('hello @world', 'en_gb', 'en_us');
assertEqual(res.convertedText, 'hello "world', 'UK Shift+Quote (@) -> US Shift+Quote (")');

res = KeyFlip.convertTextBetween('hello "world', 'en_gb', 'en_us');
assertEqual(res.convertedText, 'hello @world', 'UK Shift+2 (") -> US Shift+2 (@)');

// Colemak <-> Dvorak
res = KeyFlip.convertTextBetween('wfpg', 'colemak', 'en_us');
assertEqual(res.convertedText, 'wert', 'Colemak top letters -> en_us');

// Polish Programmers
res = KeyFlip.convertTextBetween('hello', 'en_us', 'pl');
assertEqual(res.convertedText, 'hello', 'en_us -> PL standard QWERTY preserved');

// Czech QWERTZ
res = KeyFlip.convertTextBetween('qwertz', 'cs', 'en_us');
assertEqual(res.convertedText, 'qwerty', 'Czech QWERTZ -> en_us QWERTY');

// Thai Kedmanee
res = KeyFlip.convertTextBetween('g]vf', 'en_us', 'th');
assertEqual(res.convertedText, 'เลอด', 'en_us -> Thai conversion');

console.log(`\n================================`);
console.log(`Tests Results: ${passedTests}/${totalTests} Passed`);
console.log(`================================`);

if (passedTests !== totalTests) {
  process.exit(1);
}
