#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "linux")]
pub mod linux;

#[allow(unused_imports)]
#[cfg(target_os = "windows")]
pub use windows as win_input;

#[allow(unused_imports)]
#[cfg(target_os = "linux")]
pub use linux as linux_input;

#[cfg(target_os = "macos")]
use std::process::Command;

/// Briefly releases modifiers so modifier keys don't interfere with copy/selection.
pub fn release_modifiers() {
    #[cfg(target_os = "windows")]
    {
        windows::release_alt();
    }
    #[cfg(target_os = "linux")]
    {
        if let Err(e) = linux::release_modifiers() {
            eprintln!("[KeyFlip] release_modifiers failed: {}", e);
        }
    }
    #[cfg(target_os = "macos")]
    {
        std::thread::sleep(std::time::Duration::from_millis(15));
    }
}

/// Sends Copy keystroke: Ctrl+C on Windows & Linux, Cmd+C on macOS.
pub fn send_copy_keys() {
    #[cfg(target_os = "windows")]
    {
        windows::send_copy_keys();
    }
    #[cfg(target_os = "macos")]
    {
        // On macOS: Command + C
        let _ = Command::new("osascript")
            .arg("-e")
            .arg("tell application \"System Events\" to keystroke \"c\" using command down")
            .output();
    }
    #[cfg(target_os = "linux")]
    {
        if let Err(e) = linux::send_copy_keys() {
            eprintln!("[KeyFlip] send_copy_keys failed: {}", e);
        }
    }
}

/// Sends Paste keystroke: Ctrl+V on Windows & Linux, Cmd+V on macOS.
pub fn send_paste_keys() {
    #[cfg(target_os = "windows")]
    {
        windows::send_paste_keys();
    }
    #[cfg(target_os = "macos")]
    {
        // On macOS: Command + V
        let _ = Command::new("osascript")
            .arg("-e")
            .arg("tell application \"System Events\" to keystroke \"v\" using command down")
            .output();
    }
    #[cfg(target_os = "linux")]
    {
        if let Err(e) = linux::send_paste_keys() {
            eprintln!("[KeyFlip] send_paste_keys failed: {}", e);
        }
    }
}

/// Selects previous word: Ctrl+Shift+Left on Windows/Linux, Option+Shift+Left on macOS.
pub fn select_previous_word() {
    #[cfg(target_os = "windows")]
    {
        windows::select_previous_word();
    }
    #[cfg(target_os = "macos")]
    {
        // Key code 123 = Left Arrow on macOS
        let _ = Command::new("osascript")
            .arg("-e")
            .arg("tell application \"System Events\" to key code 123 using {option down, shift down}")
            .output();
    }
    #[cfg(target_os = "linux")]
    {
        if let Err(e) = linux::select_previous_word() {
            eprintln!("[KeyFlip] select_previous_word failed: {}", e);
        }
    }
}

/// Sends Right Arrow key to deselect / collapse caret.
pub fn send_right_arrow() {
    #[cfg(target_os = "windows")]
    {
        windows::send_right_arrow();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("osascript")
            .arg("-e")
            .arg("tell application \"System Events\" to key code 124")
            .output();
    }
    #[cfg(target_os = "linux")]
    {
        if let Err(e) = linux::send_right_arrow() {
            eprintln!("[KeyFlip] send_right_arrow failed: {}", e);
        }
    }
}

/// Plays audio confirmation feedback beep.
pub fn play_beep() {
    #[cfg(target_os = "windows")]
    {
        windows::play_beep();
    }
    #[cfg(target_os = "linux")]
    {
        linux::play_beep();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("osascript")
            .arg("-e")
            .arg("beep 1")
            .output();
    }
}
