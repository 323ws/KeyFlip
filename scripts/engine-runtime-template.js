  const COMPILED_LAYOUTS = {};

  for (const [id, layout] of Object.entries(LAYOUTS_DATA)) {
    const physicalToChar = { ...layout.map };
    const charToPhysical = {};

    for (const [physKey, char] of Object.entries(layout.map)) {
      if (char && !charToPhysical[char]) {
        charToPhysical[char] = physKey;
      }
    }

    if (layout.isoMap) {
      for (const [physKey, char] of Object.entries(layout.isoMap)) {
        if (char && !charToPhysical[char]) {
          charToPhysical[char] = physKey;
        }
      }
    }

    if (layout.altGrMap) {
      for (const [physKey, char] of Object.entries(layout.altGrMap)) {
        if (char && !charToPhysical[char]) {
          if (char.charCodeAt(0) > 127) {
            charToPhysical[char] = physKey;
          }
        }
      }
    }

    COMPILED_LAYOUTS[id] = {
      id: layout.id,
      name: layout.name,
      lang: layout.lang,
      dir: layout.dir,
      hasCase: layout.hasCase,
      capsLockBehavior: layout.capsLockBehavior,
      composition: layout.composition,
      standard: layout.standard,
      physicalToChar: physicalToChar,
      charToPhysical: charToPhysical,
      compoundMap: layout.compoundMap || {}
    };
  }

  /**
   * Generic, data-driven direction detection.
   * Calculates character exclusivity between layout1 and layout2 with zero hardcoded regexes.
   */
  function detectPairDirection(text, layout1Id, layout2Id) {
    const l1 = COMPILED_LAYOUTS[layout1Id];
    const l2 = COMPILED_LAYOUTS[layout2Id];
    if (!l1 || !l2) return 'from_1_to_2';

    let score1 = 0;
    let score2 = 0;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const code = ch.charCodeAt(0);

      // Hangul syllables check (0xAC00..=0xD7A3)
      if (code >= 0xAC00 && code <= 0xD7A3) {
        if (l1.composition === 'hangul') score1 += 3;
        if (l2.composition === 'hangul') score2 += 3;
        continue;
      }

      const in1 = l1.charToPhysical[ch] !== undefined;
      const in2 = l2.charToPhysical[ch] !== undefined;

      if (in1 && !in2) {
        score1 += /\p{L}/u.test(ch) ? 3 : 1;
      } else if (in2 && !in1) {
        score2 += /\p{L}/u.test(ch) ? 3 : 1;
      }
    }

    if (score2 > score1) {
      return 'from_2_to_1';
    }
    return 'from_1_to_2';
  }

  const HANGUL_CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const HANGUL_JUNGSUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
  const HANGUL_JONGSUNG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

  const HANGUL_COMPLEX_VOWEL = {
    'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ',
    'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ',
    'ㅡㅣ': 'ㅢ'
  };

  const HANGUL_COMPLEX_JONG = {
    'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ',
    'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ',
    'ㅂㅅ': 'ㅄ'
  };

  function composeHangul(jamoStr) {
    let result = '';
    let i = 0;

    while (i < jamoStr.length) {
      const cho = HANGUL_CHOSUNG.indexOf(jamoStr[i]);
      if (cho !== -1 && i + 1 < jamoStr.length) {
        let jung = HANGUL_JUNGSUNG.indexOf(jamoStr[i + 1]);
        let nextIdx = i + 2;

        if (jung !== -1) {
          if (nextIdx < jamoStr.length) {
            const twoVowel = jamoStr[i + 1] + jamoStr[nextIdx];
            if (HANGUL_COMPLEX_VOWEL[twoVowel]) {
              jung = HANGUL_JUNGSUNG.indexOf(HANGUL_COMPLEX_VOWEL[twoVowel]);
              nextIdx++;
            }
          }

          let jong = 0;
          if (nextIdx < jamoStr.length) {
            const potentialJong = jamoStr[nextIdx];
            const potentialNextVowel = (nextIdx + 1 < jamoStr.length) ? HANGUL_JUNGSUNG.indexOf(jamoStr[nextIdx + 1]) : -1;

            if (potentialNextVowel === -1) {
              if (nextIdx + 1 < jamoStr.length) {
                const twoJong = potentialJong + jamoStr[nextIdx + 1];
                const nextNextVowel = (nextIdx + 2 < jamoStr.length) ? HANGUL_JUNGSUNG.indexOf(jamoStr[nextIdx + 2]) : -1;
                if (HANGUL_COMPLEX_JONG[twoJong] && nextNextVowel === -1) {
                  jong = HANGUL_JONGSUNG.indexOf(HANGUL_COMPLEX_JONG[twoJong]);
                  nextIdx += 2;
                } else if (HANGUL_JONGSUNG.indexOf(potentialJong) !== -1) {
                  jong = HANGUL_JONGSUNG.indexOf(potentialJong);
                  nextIdx++;
                }
              } else if (HANGUL_JONGSUNG.indexOf(potentialJong) !== -1) {
                jong = HANGUL_JONGSUNG.indexOf(potentialJong);
                nextIdx++;
              }
            }
          }

          if (jong === -1) jong = 0;
          const charCode = 0xAC00 + (cho * 588) + (jung * 28) + jong;
          result += String.fromCharCode(charCode);
          i = nextIdx;
          continue;
        }
      }

      result += jamoStr[i];
      i++;
    }

    return result;
  }

  function decomposeHangul(str) {
    let result = '';
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code >= 0xAC00 && code <= 0xD7A3) {
        const sylIndex = code - 0xAC00;
        const cho = Math.floor(sylIndex / 588);
        const jung = Math.floor((sylIndex % 588) / 28);
        const jong = sylIndex % 28;

        result += HANGUL_CHOSUNG[cho];
        result += HANGUL_JUNGSUNG[jung];
        if (jong > 0) {
          result += HANGUL_JONGSUNG[jong];
        }
      } else {
        result += str[i];
      }
    }
    return result;
  }

  /**
   * Generic Caps Lock & TitleCase normalizer.
   * Relies purely on hasCase and capsLockBehavior metadata.
   */
  function normalizeUniversalCapsLock(text, sourceLayout, targetLayout) {
    if (targetLayout.hasCase || targetLayout.capsLockBehavior === 'none') {
      return text;
    }

    return text.replace(/\p{L}+/gu, (word) => {
      if (word.length >= 2 && word === word.toUpperCase() && word !== word.toLowerCase()) {
        return word.toLowerCase();
      }

      if (word.length >= 2 && word[0] === word[0].toUpperCase() && word.slice(1) === word.slice(1).toLowerCase()) {
        if (targetLayout.capsLockBehavior === 'titleCasePunctuationFix') {
          const firstChar = word[0];
          const physicalKey = sourceLayout.charToPhysical[firstChar];
          if (physicalKey) {
            const lowerPhysicalKey = physicalKey.toLowerCase();
            if (lowerPhysicalKey !== physicalKey && targetLayout.physicalToChar[lowerPhysicalKey] !== undefined) {
              return lowerPhysicalKey + word.slice(1);
            }
          }
        }
      }

      return word;
    });
  }

  function convertTextBetween(text, layout1Id, layout2Id, forcedDirection = 'auto') {
    if (!text || typeof text !== 'string') {
      return { convertedText: '', direction: '', changed: false };
    }

    const l1 = COMPILED_LAYOUTS[layout1Id];
    const l2 = COMPILED_LAYOUTS[layout2Id];
    if (!l1 || !l2) {
      return { convertedText: text, direction: '', changed: false };
    }

    const direction = forcedDirection === 'auto' ? detectPairDirection(text, layout1Id, layout2Id) : forcedDirection;
    const sourceLayout = direction === 'from_1_to_2' ? l1 : l2;
    const targetLayout = direction === 'from_1_to_2' ? l2 : l1;

    let srcText = text;
    if (sourceLayout.composition === 'hangul') {
      srcText = decomposeHangul(text);
    } else {
      srcText = normalizeUniversalCapsLock(srcText, sourceLayout, targetLayout);
    }

    let result = '';
    let i = 0;

    while (i < srcText.length) {
      let physicalKey = null;

      if (i + 1 < srcText.length && sourceLayout.compoundMap) {
        const twoChar = srcText.substring(i, i + 2);
        if (sourceLayout.compoundMap[twoChar] !== undefined) {
          physicalKey = sourceLayout.compoundMap[twoChar];
          i += 2;
        }
      }

      if (physicalKey === null && sourceLayout.compoundMap) {
        const oneChar = srcText[i];
        if (sourceLayout.compoundMap[oneChar] !== undefined) {
          physicalKey = sourceLayout.compoundMap[oneChar];
          i += 1;
        }
      }

      if (physicalKey === null) {
        const ch = srcText[i];
        if (sourceLayout.charToPhysical[ch] !== undefined) {
          physicalKey = sourceLayout.charToPhysical[ch];
        } else {
          physicalKey = ch;
        }
        i += 1;
      }

      if (targetLayout.physicalToChar[physicalKey] !== undefined) {
        result += targetLayout.physicalToChar[physicalKey];
      } else if (physicalKey && typeof physicalKey === 'string' && physicalKey.toLowerCase && targetLayout.physicalToChar[physicalKey.toLowerCase()] !== undefined) {
        result += targetLayout.physicalToChar[physicalKey.toLowerCase()];
      } else {
        result += physicalKey;
      }
    }

    if (targetLayout.composition === 'hangul') {
      result = composeHangul(result);
    }

    const dirLabel = `${sourceLayout.lang.toUpperCase()} ➔ ${targetLayout.lang.toUpperCase()}`;

    return {
      convertedText: result,
      direction: dirLabel,
      fromLang: sourceLayout.lang,
      toLang: targetLayout.lang,
      changed: result !== text
    };
  }

  function convertText(text, secondaryLayoutId = 'ar_101', forcedDirection = 'auto') {
    return convertTextBetween(text, 'en_us', secondaryLayoutId, forcedDirection);
  }

  const KeyFlipEngine = {
    LAYOUTS: COMPILED_LAYOUTS,
    detectPairDirection: detectPairDirection,
    convertTextBetween: convertTextBetween,
    convertText: convertText
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KeyFlipEngine;
  }
  if (typeof window !== 'undefined') {
    window.KeyFlipEngine = KeyFlipEngine;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.KeyFlipEngine = KeyFlipEngine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
