use serde::Deserialize;
use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct LayoutData {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub lang: String,
    #[serde(default)]
    pub dir: String,
    #[serde(rename = "hasCase", default = "default_true")]
    pub has_case: bool,
    #[serde(rename = "capsLockBehavior", default)]
    pub caps_lock_behavior: Option<String>,
    #[serde(default)]
    pub composition: Option<String>,
    #[serde(default)]
    pub standard: Option<String>,
    #[serde(rename = "charToPhysical")]
    pub char_to_physical: HashMap<String, String>,
    #[serde(rename = "physicalToChar")]
    pub physical_to_char: HashMap<String, String>,
    #[serde(rename = "compoundMap")]
    pub compound_map: Option<HashMap<String, String>>,
}

fn default_true() -> bool {
    true
}

pub struct KeyFlipEngine {
    pub layouts: HashMap<String, LayoutData>,
}

static INSTANCE: OnceLock<KeyFlipEngine> = OnceLock::new();

const HANGUL_CHOSUNG: &[char] = &[
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];
const HANGUL_JUNGSUNG: &[char] = &[
    'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];
const HANGUL_JONGSUNG: &[&str] = &[
    "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

fn get_complex_vowel(first: char, second: char) -> Option<char> {
    match (first, second) {
        ('ㅗ', 'ㅏ') => Some('ㅘ'),
        ('ㅗ', 'ㅐ') => Some('ㅙ'),
        ('ㅗ', 'ㅣ') => Some('ㅚ'),
        ('ㅜ', 'ㅓ') => Some('ㅝ'),
        ('ㅜ', 'ㅔ') => Some('ㅞ'),
        ('ㅜ', 'ㅣ') => Some('ㅟ'),
        ('ㅡ', 'ㅣ') => Some('ㅢ'),
        _ => None,
    }
}

fn get_complex_jong(first: char, second: char) -> Option<&'static str> {
    match (first, second) {
        ('ㄱ', 'ㅅ') => Some("ㄳ"),
        ('ㄴ', 'ㅈ') => Some("ㄵ"),
        ('ㄴ', 'ㅎ') => Some("ㄶ"),
        ('ㄹ', 'ㄱ') => Some("ㄺ"),
        ('ㄹ', 'ㅁ') => Some("ㄻ"),
        ('ㄹ', 'ㅂ') => Some("ㄼ"),
        ('ㄹ', 'ㅅ') => Some("ㄽ"),
        ('ㄹ', 'ㅌ') => Some("ㄾ"),
        ('ㄹ', 'ㅍ') => Some("ㄿ"),
        ('ㄹ', 'ㅎ') => Some("ㅀ"),
        ('ㅂ', 'ㅅ') => Some("ㅄ"),
        _ => None,
    }
}

pub fn decompose_hangul(text: &str) -> String {
    let mut result = String::new();
    for ch in text.chars() {
        let code = ch as u32;
        if (0xAC00..=0xD7A3).contains(&code) {
            let syl_index = code - 0xAC00;
            let cho = (syl_index / 588) as usize;
            let jung = ((syl_index % 588) / 28) as usize;
            let jong = (syl_index % 28) as usize;

            result.push(HANGUL_CHOSUNG[cho]);
            result.push(HANGUL_JUNGSUNG[jung]);
            if jong > 0 {
                result.push_str(HANGUL_JONGSUNG[jong]);
            }
        } else {
            result.push(ch);
        }
    }
    result
}

pub fn compose_hangul(jamo_str: &str) -> String {
    let chars: Vec<char> = jamo_str.chars().collect();
    let mut result = String::new();
    let mut i = 0;

    while i < chars.len() {
        let cho_idx = HANGUL_CHOSUNG.iter().position(|&c| c == chars[i]);
        if let Some(cho) = cho_idx {
            if i + 1 < chars.len() {
                let jung_idx = HANGUL_JUNGSUNG.iter().position(|&c| c == chars[i + 1]);
                let mut next_idx = i + 2;

                if let Some(mut jung) = jung_idx {
                    if next_idx < chars.len() {
                        if let Some(comp_vowel) = get_complex_vowel(chars[i + 1], chars[next_idx]) {
                            if let Some(cj_idx) = HANGUL_JUNGSUNG.iter().position(|&c| c == comp_vowel) {
                                jung = cj_idx;
                                next_idx += 1;
                            }
                        }
                    }

                    let mut jong = 0usize;
                    if next_idx < chars.len() {
                        let potential_jong = chars[next_idx];
                        let potential_next_vowel = if next_idx + 1 < chars.len() {
                            HANGUL_JUNGSUNG.iter().position(|&c| c == chars[next_idx + 1])
                        } else {
                            None
                        };

                        if potential_next_vowel.is_none() {
                            if next_idx + 1 < chars.len() {
                                if let Some(two_jong) = get_complex_jong(potential_jong, chars[next_idx + 1]) {
                                    let next_next_vowel = if next_idx + 2 < chars.len() {
                                        HANGUL_JUNGSUNG.iter().position(|&c| c == chars[next_idx + 2])
                                    } else {
                                        None
                                    };
                                    if next_next_vowel.is_none() {
                                        if let Some(tj_idx) = HANGUL_JONGSUNG.iter().position(|&s| s == two_jong) {
                                            jong = tj_idx;
                                            next_idx += 2;
                                        }
                                    } else if let Some(pj_idx) = HANGUL_JONGSUNG.iter().position(|&s| s == potential_jong.to_string()) {
                                        jong = pj_idx;
                                        next_idx += 1;
                                    }
                                } else if let Some(pj_idx) = HANGUL_JONGSUNG.iter().position(|&s| s == potential_jong.to_string()) {
                                    jong = pj_idx;
                                    next_idx += 1;
                                }
                            } else if let Some(pj_idx) = HANGUL_JONGSUNG.iter().position(|&s| s == potential_jong.to_string()) {
                                jong = pj_idx;
                                next_idx += 1;
                            }
                        }
                    }

                    let char_code = 0xAC00 + (cho as u32 * 588) + (jung as u32 * 28) + jong as u32;
                    if let Some(c) = char::from_u32(char_code) {
                        result.push(c);
                        i = next_idx;
                        continue;
                    }
                }
            }
        }

        result.push(chars[i]);
        i += 1;
    }

    result
}

fn normalize_universal_caps_lock(text: &str, source: &LayoutData, target: &LayoutData) -> String {
    // Pure data-driven: only normalize casing if target layout has no uppercase/lowercase distinction
    if target.has_case || target.caps_lock_behavior.as_deref() == Some("none") {
        return text.to_string();
    }

    let mut result = String::new();
    let mut current_word = String::new();

    for ch in text.chars() {
        if ch.is_alphabetic() {
            current_word.push(ch);
        } else {
            if !current_word.is_empty() {
                result.push_str(&process_word(&current_word, source, target));
                current_word.clear();
            }
            result.push(ch);
        }
    }
    if !current_word.is_empty() {
        result.push_str(&process_word(&current_word, source, target));
    }

    result
}

fn process_word(word: &str, source: &LayoutData, target: &LayoutData) -> String {
    let is_all_upper = word.chars().count() >= 2 && word.chars().all(|c| c.is_uppercase());
    if is_all_upper {
        return word.to_lowercase();
    }

    // TitleCase check on physical key level (e.g. Chat -> chat, Google -> google)
    let chars: Vec<char> = word.chars().collect();
    if chars.len() >= 2 && chars[0].is_uppercase() && chars[1..].iter().all(|c| c.is_lowercase()) {
        if target.caps_lock_behavior.as_deref() == Some("titleCasePunctuationFix") {
            let first_str = chars[0].to_string();
            if let Some(pk) = source.char_to_physical.get(&first_str) {
                let lower_pk = pk.to_lowercase();
                if lower_pk != *pk && target.physical_to_char.contains_key(&lower_pk) {
                    let mut new_w = lower_pk;
                    new_w.push_str(&word[chars[0].len_utf8()..]);
                    return new_w;
                }
            }
        }
    }

    word.to_string()
}

impl KeyFlipEngine {
    pub fn global() -> &'static KeyFlipEngine {
        INSTANCE.get_or_init(|| {
            let json_str = include_str!("layouts.json");
            let layouts: HashMap<String, LayoutData> = serde_json::from_str(json_str)
                .expect("Failed to parse layouts.json");
            KeyFlipEngine { layouts }
        })
    }

    pub fn detect_pair_direction(&self, text: &str, l1_id: &str, l2_id: &str) -> String {
        let l1 = match self.layouts.get(l1_id) {
            Some(l) => l,
            None => return "from_1_to_2".to_string(),
        };
        let l2 = match self.layouts.get(l2_id) {
            Some(l) => l,
            None => return "from_1_to_2".to_string(),
        };

        let (mut score1, mut score2) = (0usize, 0usize);

        for ch in text.chars() {
            let code = ch as u32;
            if (0xAC00..=0xD7A3).contains(&code) {
                if l1.composition.as_deref() == Some("hangul") {
                    score1 += 3;
                }
                if l2.composition.as_deref() == Some("hangul") {
                    score2 += 3;
                }
                continue;
            }

            let s = ch.to_string();
            let in_1 = l1.char_to_physical.contains_key(&s);
            let in_2 = l2.char_to_physical.contains_key(&s);

            if in_1 && !in_2 {
                score1 += if ch.is_alphabetic() { 3 } else { 1 };
            } else if in_2 && !in_1 {
                score2 += if ch.is_alphabetic() { 3 } else { 1 };
            }
        }

        if score2 > score1 {
            "from_2_to_1".to_string()
        } else {
            "from_1_to_2".to_string()
        }
    }

    pub fn convert_text_between(&self, text: &str, l1_id: &str, l2_id: &str) -> (String, bool) {
        if text.is_empty() {
            return (String::new(), false);
        }

        let l1 = match self.layouts.get(l1_id) {
            Some(l) => l,
            None => return (text.to_string(), false),
        };
        let l2 = match self.layouts.get(l2_id) {
            Some(l) => l,
            None => return (text.to_string(), false),
        };

        let dir = self.detect_pair_direction(text, l1_id, l2_id);
        let (source, target) = if dir == "from_1_to_2" { (l1, l2) } else { (l2, l1) };

        // Handle Hangul decomposition if source has composition="hangul"
        let src_text = if source.composition.as_deref() == Some("hangul") {
            decompose_hangul(text)
        } else {
            normalize_universal_caps_lock(text, source, target)
        };

        let is_target_unicased = !target.has_case;

        let mut result = String::new();
        let chars: Vec<char> = src_text.chars().collect();
        let mut i = 0;

        while i < chars.len() {
            let mut physical_key: Option<String> = None;

            // 1. Check compound mappings (2-char sequences like Arabic ligatures)
            if i + 1 < chars.len() {
                if let Some(comp) = &source.compound_map {
                    let pair: String = chars[i..i+2].iter().collect();
                    if let Some(pk) = comp.get(&pair) {
                        physical_key = Some(pk.clone());
                        i += 2;
                    }
                }
            }

            // 2. Single char mapping
            if physical_key.is_none() {
                let s = chars[i].to_string();
                if let Some(pk) = source.char_to_physical.get(&s) {
                    physical_key = Some(pk.clone());
                }
                i += 1;
            }

            if let Some(pk) = physical_key {
                if let Some(target_char) = target.physical_to_char(&pk) {
                    result.push_str(&target_char);
                } else if is_target_unicased {
                    let lower_pk = pk.to_lowercase();
                    if let Some(fallback_char) = target.physical_to_char(&lower_pk) {
                        result.push_str(&fallback_char);
                    } else {
                        result.push_str(&pk);
                    }
                } else {
                    result.push_str(&pk);
                }
            } else {
                result.push(chars[i - 1]);
            }
        }

        // Handle Hangul composition if target has composition="hangul"
        if target.composition.as_deref() == Some("hangul") {
            result = compose_hangul(&result);
        }

        let changed = result != text;
        (result, changed)
    }
}

impl LayoutData {
    pub fn physical_to_char(&self, pk: &str) -> Option<String> {
        self.physical_to_char.get(pk).cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_arabic_conversion() {
        let engine = KeyFlipEngine::global();
        let (res1, _) = engine.convert_text_between("chat", "en_us", "ar_101");
        assert_eq!(res1, "ؤاشف");

        let (res2, _) = engine.convert_text_between("ؤاشف", "en_us", "ar_101");
        assert_eq!(res2, "chat");

        let (res3, _) = engine.convert_text_between("hgsghl HGSGHL", "en_us", "ar_101");
        assert_eq!(res3, "السلام السلام");

        let (res4, _) = engine.convert_text_between("CHAT", "en_us", "ar_101");
        assert_eq!(res4, "ؤاشف");

        let (res5, _) = engine.convert_text_between("Chat", "en_us", "ar_101");
        assert_eq!(res5, "ؤاشف");

        let (res6, _) = engine.convert_text_between("LOGIN", "en_us", "ar_101");
        assert_eq!(res6, "مخلهى");

        let (res7, _) = engine.convert_text_between("Google", "en_us", "ar_101");
        assert_eq!(res7, "لخخلمث");
    }

    #[test]
    fn test_hangul_composition_and_decomposition() {
        let engine = KeyFlipEngine::global();

        // 1. Syllable with jongseong
        let (ko1, _) = engine.convert_text_between("gksrnr", "en_us", "ko");
        assert_eq!(ko1, "한국");

        let (rev1, _) = engine.convert_text_between("한국", "en_us", "ko");
        assert_eq!(rev1, "gksrnr");

        // 2. Syllable without jongseong (e.g. sk -> 나, dkssud -> 안녕)
        let (ko2, _) = engine.convert_text_between("sk", "en_us", "ko");
        assert_eq!(ko2, "나");

        let (rev2, _) = engine.convert_text_between("나", "en_us", "ko");
        assert_eq!(rev2, "sk");

        let (ko3, _) = engine.convert_text_between("dkssud", "en_us", "ko");
        assert_eq!(ko3, "안녕");

        let (rev3, _) = engine.convert_text_between("안녕", "en_us", "ko");
        assert_eq!(rev3, "dkssud");

        // 3. Complex vowels (dhk -> 와, dml -> 의)
        let (ko4, _) = engine.convert_text_between("dhk", "en_us", "ko");
        assert_eq!(ko4, "와");

        let (ko5, _) = engine.convert_text_between("dml", "en_us", "ko");
        assert_eq!(ko5, "의");

        // 4. Multi-syllable phrase
        let (ko6, _) = engine.convert_text_between("gksrnrskfk", "en_us", "ko");
        assert_eq!(ko6, "한국나라");

        let (rev6, _) = engine.convert_text_between("한국나라", "en_us", "ko");
        assert_eq!(rev6, "gksrnrskfk");
    }

    #[test]
    fn test_other_languages() {
        let engine = KeyFlipEngine::global();
        let (fa, _) = engine.convert_text_between("sghl", "en_us", "fa");
        assert_eq!(fa, "سلام");

        let (fa_caps, _) = engine.convert_text_between("SGHL", "en_us", "fa");
        assert_eq!(fa_caps, "سلام");

        let (he, _) = engine.convert_text_between("akuo", "en_us", "he");
        assert_eq!(he, "שלום");

        let (he_caps, _) = engine.convert_text_between("AKUO", "en_us", "he");
        assert_eq!(he_caps, "שלום");

        let (ru, _) = engine.convert_text_between("ghbdtn", "en_us", "ru");
        assert_eq!(ru, "привет");

        let (ru_caps, _) = engine.convert_text_between("GHBDTN", "en_us", "ru");
        assert_eq!(ru_caps, "ПРИВЕТ");

        let (fr, _) = engine.convert_text_between("wasd", "en_us", "fr_azerty");
        assert_eq!(fr, "zqsd");
    }

    #[test]
    fn test_phase3_new_layouts_and_cross_conversion() {
        let engine = KeyFlipEngine::global();

        // 1. UK QWERTY ISO (@ vs " swap)
        let (uk1, _) = engine.convert_text_between("hello @world", "en_gb", "en_us");
        assert_eq!(uk1, "hello \"world");

        let (uk2, _) = engine.convert_text_between("hello \"world", "en_gb", "en_us");
        assert_eq!(uk2, "hello @world");

        // 2. Colemak <-> Dvorak (Direct cross conversion)
        let (cd, _) = engine.convert_text_between("wfpgjlu", "colemak", "dvorak");
        let (dc, _) = engine.convert_text_between(&cd, "dvorak", "colemak");
        assert_eq!(dc, "wfpgjlu");

        // 3. Czech QWERTZ
        let (cs, _) = engine.convert_text_between("qwertz", "cs", "en_us");
        assert_eq!(cs, "qwerty");

        // 4. Polish Programmers
        let (pl, _) = engine.convert_text_between("hello", "en_us", "pl");
        assert_eq!(pl, "hello");

        // 5. Thai Kedmanee
        let (th, _) = engine.convert_text_between("g]vf", "en_us", "th");
        assert_eq!(th, "เลอด");
    }
}
