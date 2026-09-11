/**
 * KeyFlip E2E Node Runner
 * Executes core conversion matrices, text replacement simulations, and pass-through checks in native UTF-8.
 */

const engine = require('../desktop/ui/layouts.js');

function runAll() {
  const results = {
    matrix: testConversionMatrix(),
    passthrough: testPassThrough(),
    interoperability: testInteroperability()
  };

  console.log(JSON.stringify(results, null, 2));
}

function testConversionMatrix() {
  const phrases = [
    { text: 'chat gpt', expectedFwd: 'ؤاشف لحف' },
    { text: 'hello world', expectedFwd: 'اثممخ صخقمي' },
    { text: 'google chrome', expectedFwd: 'لخخلمث ؤاقخةث' },
    { text: 'github copilot', expectedFwd: 'لهفاعلا ؤخحهمخف' },
    { text: 'visual studio code', expectedFwd: 'رهسعشم سفعيهخ ؤخيث' },
    { text: 'السلام عليكم', expectedFwd: 'hgsbl ugd;l' },
    { text: 'test@example.com', expectedFwd: 'فثسف@ثءشةحمثزؤخة' },
    { text: 'https://github.com', expectedFwd: 'اففحس:ظظلهفاعلازؤخة' }
  ];

  let passed = 0;
  const details = [];

  for (const item of phrases) {
    const fwd = engine.convertTextBetween(item.text, 'en_us', 'ar_101');
    const rev = engine.convertTextBetween(fwd.convertedText, 'en_us', 'ar_101');
    const ok = (rev.convertedText === item.text);
    if (ok) passed++;

    details.push({
      input: item.text,
      converted: fwd.convertedText,
      roundtrip: rev.convertedText,
      direction: fwd.direction,
      success: ok
    });
  }

  return {
    total: phrases.length,
    passed,
    allPassed: (passed === phrases.length),
    details
  };
}

function testPassThrough() {
  const nonConvertible = '1234567890';
  const res = engine.convertTextBetween(nonConvertible, 'en_us', 'ar_101');
  const safe = (res.changed === false && res.convertedText === nonConvertible);
  return {
    input: nonConvertible,
    output: res.convertedText,
    changed: res.changed,
    safe
  };
}

function testInteroperability() {
  // 1. Single Word Replacement
  const single = engine.convertTextBetween('ؤاشف', 'en_us', 'ar_101');
  const singleOk = (single.convertedText === 'chat');

  // 2. Multiline paragraph preservation
  const paragraphBefore = 'Line 1: System started.\r\nLine 2: ؤاشف لحف\r\nLine 3: Operation completed.';
  const typo = 'ؤاشف لحف';
  const convertedTypo = engine.convertTextBetween(typo, 'en_us', 'ar_101').convertedText;
  const paragraphAfter = paragraphBefore.replace(typo, convertedTypo);
  const multilineOk = paragraphAfter.includes('Line 2: chat gpt') &&
                      paragraphAfter.includes('Line 1: System started.') &&
                      paragraphAfter.includes('Line 3: Operation completed.');

  // 3. Mid-sentence replacement
  const sentence = 'Please open ؤاشف لحف now.';
  const sentenceReplaced = sentence.replace(typo, convertedTypo);
  const sentenceOk = (sentenceReplaced === 'Please open chat gpt now.');

  return {
    singleOk,
    multilineOk,
    sentenceOk,
    allOk: (singleOk && multilineOk && sentenceOk)
  };
}

runAll();
