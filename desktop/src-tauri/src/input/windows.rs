use std::thread;
use std::time::Duration;

#[link(name = "user32")]
extern "system" {
    fn keybd_event(bVk: u8, bScan: u8, dwFlags: u32, dwExtraInfo: usize);
    fn MessageBeep(uType: u32) -> i32;
}

pub const VK_MENU: u8 = 0x12;
pub const VK_CONTROL: u8 = 0x11;
pub const VK_SHIFT: u8 = 0x10;
pub const VK_LEFT: u8 = 0x25;
pub const VK_RIGHT: u8 = 0x27;
pub const VK_C: u8 = 0x43;
pub const VK_V: u8 = 0x56;

pub const SCAN_CTRL: u8 = 0x1D;
pub const SCAN_SHIFT: u8 = 0x2A;
pub const SCAN_ALT: u8 = 0x38;
pub const SCAN_C: u8 = 0x2E;
pub const SCAN_V: u8 = 0x2F;
pub const SCAN_LEFT: u8 = 0x4B;
pub const SCAN_RIGHT: u8 = 0x4D;

pub const KEYEVENTF_EXTENDEDKEY: u32 = 0x0001;
pub const KEYEVENTF_KEYUP: u32 = 0x0002;

/// Unique marker used in dwExtraInfo to prevent the low-level keyboard hook
/// from ever intercepting our own synthetically generated keystrokes.
pub const KEYFLIP_MAGIC: usize = 0x4B455946; // "KEYF"

pub fn release_alt() {
    unsafe {
        keybd_event(VK_MENU, SCAN_ALT, KEYEVENTF_KEYUP, KEYFLIP_MAGIC);
    }
}

pub fn send_copy_keys() {
    unsafe {
        keybd_event(VK_CONTROL, SCAN_CTRL, 0, KEYFLIP_MAGIC);
        thread::sleep(Duration::from_millis(8));
        keybd_event(VK_C, SCAN_C, 0, KEYFLIP_MAGIC);
        thread::sleep(Duration::from_millis(15));
        keybd_event(VK_C, SCAN_C, KEYEVENTF_KEYUP, KEYFLIP_MAGIC);
        thread::sleep(Duration::from_millis(8));
        keybd_event(VK_CONTROL, SCAN_CTRL, KEYEVENTF_KEYUP, KEYFLIP_MAGIC);
    }
}

pub fn send_paste_keys() {
    unsafe {
        keybd_event(VK_CONTROL, SCAN_CTRL, 0, KEYFLIP_MAGIC);
        thread::sleep(Duration::from_millis(8));
        keybd_event(VK_V, SCAN_V, 0, KEYFLIP_MAGIC);
        thread::sleep(Duration::from_millis(15));
        keybd_event(VK_V, SCAN_V, KEYEVENTF_KEYUP, KEYFLIP_MAGIC);
        thread::sleep(Duration::from_millis(8));
        keybd_event(VK_CONTROL, SCAN_CTRL, KEYEVENTF_KEYUP, KEYFLIP_MAGIC);
    }
}

// Select previous word (Ctrl + Shift + Left)
pub fn select_previous_word() {
    unsafe {
        keybd_event(VK_CONTROL, SCAN_CTRL, 0, KEYFLIP_MAGIC);
        keybd_event(VK_SHIFT, SCAN_SHIFT, 0, KEYFLIP_MAGIC);
        thread::sleep(Duration::from_millis(10));
        keybd_event(VK_LEFT, SCAN_LEFT, KEYEVENTF_EXTENDEDKEY, KEYFLIP_MAGIC);
        thread::sleep(Duration::from_millis(15));
        keybd_event(VK_LEFT, SCAN_LEFT, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, KEYFLIP_MAGIC);
        thread::sleep(Duration::from_millis(10));
        keybd_event(VK_SHIFT, SCAN_SHIFT, KEYEVENTF_KEYUP, KEYFLIP_MAGIC);
        keybd_event(VK_CONTROL, SCAN_CTRL, KEYEVENTF_KEYUP, KEYFLIP_MAGIC);
    }
}

pub fn send_right_arrow() {
    unsafe {
        keybd_event(VK_RIGHT, SCAN_RIGHT, KEYEVENTF_EXTENDEDKEY, KEYFLIP_MAGIC);
        thread::sleep(Duration::from_millis(8));
        keybd_event(VK_RIGHT, SCAN_RIGHT, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, KEYFLIP_MAGIC);
    }
}

pub fn play_beep() {
    unsafe {
        MessageBeep(0);
    }
}
