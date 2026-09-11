use std::thread;
use std::time::{Duration, Instant};
use arboard::Clipboard;
use crate::input;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SelectionStrategy {
    ExistingSelection,
    AutoWordLtr,
}

pub struct CapturedSelection {
    pub text: String,
    pub strategy: SelectionStrategy,
    pub orig_clipboard: Option<String>,
}

fn with_clipboard_retry<F, R>(mut f: F) -> Option<R>
where
    F: FnMut(&mut Clipboard) -> Result<R, arboard::Error>,
{
    for attempt in 0..4 {
        if let Ok(mut cb) = Clipboard::new() {
            if let Ok(val) = f(&mut cb) {
                return Some(val);
            }
        }
        if attempt < 3 {
            thread::sleep(Duration::from_millis(10));
        }
    }
    None
}

fn wait_for_clipboard_text(timeout_ms: u64) -> String {
    let start = Instant::now();
    let timeout = Duration::from_millis(timeout_ms);
    while start.elapsed() < timeout {
        if let Some(text) = with_clipboard_retry(|cb| cb.get_text()) {
            if !text.is_empty() {
                return text;
            }
        }
        thread::sleep(Duration::from_millis(10));
    }
    String::new()
}

pub fn restore_clipboard(orig: Option<String>) {
    let _ = with_clipboard_retry(|cb| {
        if let Some(text) = &orig {
            if !text.is_empty() {
                cb.set_text(text)
            } else {
                cb.clear()
            }
        } else {
            cb.clear()
        }
    });
}

impl CapturedSelection {
    /// Deselects if an auto-selected word and restores user's original clipboard.
    /// For ExistingSelection, leaves the selection untouched (0 keystrokes).
    pub fn cancel(self) {
        match self.strategy {
            SelectionStrategy::AutoWordLtr => {
                input::send_right_arrow();
            }
            SelectionStrategy::ExistingSelection => {
                // Zero keystrokes! User's explicit selection remains untouched.
            }
        }
        restore_clipboard(self.orig_clipboard);
    }

    /// Pastes the replacement text and restores user's original clipboard immediately.
    pub fn replace_and_restore(self, replacement: &str) {
        let written = with_clipboard_retry(|cb| cb.set_text(replacement)).is_some();

        #[cfg(target_os = "linux")]
        {
            use arboard::{LinuxClipboardKind, SetExtLinux};
            let _ = with_clipboard_retry(|cb| {
                cb.set().clipboard(LinuxClipboardKind::Primary).text(replacement)
            });
        }

        // If clipboard write failed (e.g. clipboard locked by another process),
        // abort immediately: do NOT send paste keystroke, do NOT play beep, and restore original clipboard.
        if !written {
            restore_clipboard(self.orig_clipboard);
            return;
        }

        thread::sleep(Duration::from_millis(20));

        input::send_paste_keys();
        input::play_beep();

        thread::sleep(Duration::from_millis(60));
        restore_clipboard(self.orig_clipboard);
    }
}

/// Captures currently selected text, or falls back to smart previous word selection.
pub fn capture_text() -> Option<CapturedSelection> {
    // 1. Save original clipboard content (Clipboard preservation)
    let orig_clipboard = with_clipboard_retry(|cb| cb.get_text());

    // 2. Clear clipboard temporarily to detect fresh copied text
    let _ = with_clipboard_retry(|cb| cb.clear());

    // 3. Briefly release Alt so modifier keys don't interfere with copy/selection
    input::release_modifiers();
    thread::sleep(Duration::from_millis(15));

    // 4. Attempt to copy already-selected text
    input::send_copy_keys();
    let mut target_text = wait_for_clipboard_text(60);

    if !target_text.is_empty() {
        return Some(CapturedSelection {
            text: target_text,
            strategy: SelectionStrategy::ExistingSelection,
            orig_clipboard,
        });
    }

    // 5. Smart Word Detection: select previous word (Ctrl + Shift + Left)
    input::select_previous_word();
    thread::sleep(Duration::from_millis(15));
    input::send_copy_keys();
    target_text = wait_for_clipboard_text(75);

    if is_valid_single_word(&target_text) {
        return Some(CapturedSelection {
            text: target_text,
            strategy: SelectionStrategy::AutoWordLtr,
            orig_clipboard,
        });
    }

    // If word is empty or invalid, collapse selection back to cursor (1 Right Arrow) and restore clipboard
    if !target_text.is_empty() {
        input::send_right_arrow();
    }
    restore_clipboard(orig_clipboard);
    None
}

fn is_valid_single_word(text: &str) -> bool {
    !text.is_empty()
        && !text.contains('\n')
        && !text.contains('\r')
        && text.chars().count() <= 80
        && !text.trim().is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_single_word() {
        assert!(is_valid_single_word("hello"));
        assert!(is_valid_single_word("مرحبا"));
        assert!(is_valid_single_word("KeyFlip"));
        assert!(is_valid_single_word("word123"));
        assert!(is_valid_single_word("café"));
    }

    #[test]
    fn test_invalid_single_word_empty_or_whitespace() {
        assert!(!is_valid_single_word(""));
        assert!(!is_valid_single_word("   "));
        assert!(!is_valid_single_word("\t"));
    }

    #[test]
    fn test_invalid_single_word_multiline_protection() {
        // Must reject any text containing newlines to protect paragraph formatting
        assert!(!is_valid_single_word("hello\nworld"));
        assert!(!is_valid_single_word("hello\r\nworld"));
        assert!(!is_valid_single_word("line1\rline2"));
    }

    #[test]
    fn test_invalid_single_word_too_long() {
        let long_str: String = "a".repeat(81);
        assert!(!is_valid_single_word(&long_str));

        let ok_str: String = "a".repeat(80);
        assert!(is_valid_single_word(&ok_str));
    }

    #[test]
    fn test_clipboard_preservation_cycle() {
        let test_token = format!("KEYFLIP_PRESERVE_TEST_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        
        // 1. Pre-fill clipboard with token
        let _ = with_clipboard_retry(|cb| cb.set_text(&test_token));
        
        // 2. Read back to confirm
        let initial = with_clipboard_retry(|cb| cb.get_text());
        assert_eq!(initial, Some(test_token.clone()));

        // 3. Simulate capture preserving orig_clipboard
        let captured = CapturedSelection {
            text: "test_text".to_string(),
            strategy: SelectionStrategy::ExistingSelection,
            orig_clipboard: Some(test_token.clone()),
        };

        // 4. Cancel (e.g. non-convertible text) -> must restore clipboard
        captured.cancel();

        // 5. Verify pre-existing token is 100% preserved
        let restored = with_clipboard_retry(|cb| cb.get_text());
        assert_eq!(restored, Some(test_token));
    }
}

