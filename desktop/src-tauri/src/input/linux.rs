use std::fs::{File, OpenOptions};
use std::io::Write;
use std::os::unix::fs::OpenOptionsExt;
use std::os::unix::io::{AsRawFd, RawFd};
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Duration;

// Linux input event codes
pub const EV_SYN: u16 = 0x00;
pub const EV_KEY: u16 = 0x01;
pub const SYN_REPORT: u16 = 0;

pub const KEY_LEFTCTRL: u16 = 29;
pub const KEY_RIGHTCTRL: u16 = 97;
pub const KEY_LEFTSHIFT: u16 = 42;
pub const KEY_RIGHTSHIFT: u16 = 54;
pub const KEY_LEFTALT: u16 = 56;
pub const KEY_RIGHTALT: u16 = 100;
pub const KEY_C: u16 = 46;
pub const KEY_V: u16 = 47;
pub const KEY_LEFT: u16 = 105;
pub const KEY_RIGHT: u16 = 106;

// ioctl command numbers for uinput
// UI_SET_EVBIT = _IOW('U', 100, int) = 0x40045564
const UI_SET_EVBIT: libc::c_ulong = 0x40045564;
// UI_SET_KEYBIT = _IOW('U', 101, int) = 0x40045565
const UI_SET_KEYBIT: libc::c_ulong = 0x40045565;
// UI_DEV_CREATE = _IO('U', 1) = 0x5501
const UI_DEV_CREATE: libc::c_ulong = 0x5501;
// UI_DEV_DESTROY = _IO('U', 2) = 0x5502
const UI_DEV_DESTROY: libc::c_ulong = 0x5502;

const BUS_USB: u16 = 0x03;

#[repr(C)]
#[derive(Clone, Copy)]
struct InputId {
    bustype: u16,
    vendor: u16,
    product: u16,
    version: u16,
}

#[repr(C)]
struct UinputUserDev {
    name: [libc::c_char; 80],
    id: InputId,
    ff_effects_max: u32,
    absmax: [i32; 64],
    absmin: [i32; 64],
    absfuzz: [i32; 64],
    absflat: [i32; 64],
}

#[derive(Debug)]
pub enum LinuxInputError {
    UinputOpenFailed(String),
    UinputIoctlFailed(String),
    UinputWriteFailed(String),
    UinputNotAvailableWayland,
    XdotoolFailed(String),
    #[allow(dead_code)]
    UnsupportedEnvironment(String),
}

impl std::fmt::Display for LinuxInputError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UinputOpenFailed(e) => write!(f, "Failed to open /dev/uinput: {}", e),
            Self::UinputIoctlFailed(e) => write!(f, "ioctl on /dev/uinput failed: {}", e),
            Self::UinputWriteFailed(e) => write!(f, "write to /dev/uinput failed: {}", e),
            Self::UinputNotAvailableWayland => write!(
                f,
                "uinput is not accessible on Wayland (ensure user has read/write permission to /dev/uinput). Refusing xdotool fallback."
            ),
            Self::XdotoolFailed(e) => write!(f, "xdotool fallback failed on X11: {}", e),
            Self::UnsupportedEnvironment(e) => write!(f, "Unsupported Linux input environment: {}", e),
        }
    }
}

impl std::error::Error for LinuxInputError {}

pub fn is_wayland() -> bool {
    std::env::var("XDG_SESSION_TYPE")
        .map(|v| v.eq_ignore_ascii_case("wayland"))
        .unwrap_or(false)
        || std::env::var_os("WAYLAND_DISPLAY").is_some()
}

pub fn is_x11() -> bool {
    if is_wayland() {
        return false;
    }

    if let Ok(sess) = std::env::var("XDG_SESSION_TYPE") {
        if sess.eq_ignore_ascii_case("x11") {
            return true;
        }
    }

    std::env::var_os("DISPLAY").is_some()
}

pub struct UInputDevice {
    file: File,
}

impl UInputDevice {
    pub fn create() -> Result<Self, LinuxInputError> {
        let paths = ["/dev/uinput", "/dev/input/uinput"];
        let mut last_err = String::from("No uinput device path found");

        let mut file_opt = None;
        for path in &paths {
            match OpenOptions::new()
                .write(true)
                .custom_flags(libc::O_NONBLOCK)
                .open(path)
            {
                Ok(f) => {
                    file_opt = Some(f);
                    break;
                }
                Err(e) => {
                    last_err = format!("{}: {}", path, e);
                }
            }
        }

        let file = match file_opt {
            Some(f) => f,
            None => return Err(LinuxInputError::UinputOpenFailed(last_err)),
        };

        let fd: RawFd = file.as_raw_fd();

        unsafe {
            // 1. Enable EV_KEY and EV_SYN
            if libc::ioctl(fd, UI_SET_EVBIT, EV_KEY as libc::c_int) < 0 {
                return Err(LinuxInputError::UinputIoctlFailed(
                    "UI_SET_EVBIT EV_KEY failed".to_string(),
                ));
            }
            if libc::ioctl(fd, UI_SET_EVBIT, EV_SYN as libc::c_int) < 0 {
                return Err(LinuxInputError::UinputIoctlFailed(
                    "UI_SET_EVBIT EV_SYN failed".to_string(),
                ));
            }

            // 2. Register required keys
            let keys_to_register = [
                KEY_LEFTCTRL,
                KEY_RIGHTCTRL,
                KEY_LEFTSHIFT,
                KEY_RIGHTSHIFT,
                KEY_LEFTALT,
                KEY_RIGHTALT,
                KEY_C,
                KEY_V,
                KEY_LEFT,
                KEY_RIGHT,
            ];

            for &key in &keys_to_register {
                if libc::ioctl(fd, UI_SET_KEYBIT, key as libc::c_int) < 0 {
                    return Err(LinuxInputError::UinputIoctlFailed(format!(
                        "UI_SET_KEYBIT {} failed",
                        key
                    )));
                }
            }

            // 3. Configure user device info
            let mut uidev: UinputUserDev = std::mem::zeroed();
            let name_bytes = b"KeyFlip Virtual Keyboard\0";
            for (i, &b) in name_bytes.iter().enumerate() {
                if i < uidev.name.len() {
                    uidev.name[i] = b as libc::c_char;
                }
            }
            uidev.id = InputId {
                bustype: BUS_USB,
                vendor: 0x1234,
                product: 0x5678,
                version: 1,
            };

            let uidev_slice = std::slice::from_raw_parts(
                &uidev as *const _ as *const u8,
                std::mem::size_of::<UinputUserDev>(),
            );

            let mut f_ref = &file;
            if let Err(e) = f_ref.write_all(uidev_slice) {
                return Err(LinuxInputError::UinputWriteFailed(e.to_string()));
            }

            // 4. Create device
            if libc::ioctl(fd, UI_DEV_CREATE) < 0 {
                return Err(LinuxInputError::UinputIoctlFailed(
                    "UI_DEV_CREATE failed".to_string(),
                ));
            }
        }

        // Give the kernel / display server a brief moment to enumerate the new device
        thread::sleep(Duration::from_millis(50));

        Ok(Self { file })
    }

    pub fn emit(&mut self, type_: u16, code: u16, value: i32) -> Result<(), LinuxInputError> {
        let mut ev: libc::input_event = unsafe { std::mem::zeroed() };
        ev.type_ = type_;
        ev.code = code;
        ev.value = value;

        let ev_slice = unsafe {
            std::slice::from_raw_parts(
                &ev as *const _ as *const u8,
                std::mem::size_of::<libc::input_event>(),
            )
        };

        self.file
            .write_all(ev_slice)
            .map_err(|e| LinuxInputError::UinputWriteFailed(e.to_string()))
    }

    pub fn syn(&mut self) -> Result<(), LinuxInputError> {
        self.emit(EV_SYN, SYN_REPORT, 0)
    }

    pub fn key_down(&mut self, code: u16) -> Result<(), LinuxInputError> {
        self.emit(EV_KEY, code, 1)?;
        self.syn()
    }

    pub fn key_up(&mut self, code: u16) -> Result<(), LinuxInputError> {
        self.emit(EV_KEY, code, 0)?;
        self.syn()
    }

    pub fn key_click(&mut self, code: u16) -> Result<(), LinuxInputError> {
        self.key_down(code)?;
        thread::sleep(Duration::from_millis(5));
        self.key_up(code)
    }

    pub fn release_all_modifiers(&mut self) -> Result<(), LinuxInputError> {
        let modifiers = [
            KEY_LEFTCTRL,
            KEY_RIGHTCTRL,
            KEY_LEFTSHIFT,
            KEY_RIGHTSHIFT,
            KEY_LEFTALT,
            KEY_RIGHTALT,
        ];
        for &m in &modifiers {
            self.emit(EV_KEY, m, 0)?;
        }
        self.syn()?;
        thread::sleep(Duration::from_millis(5));
        Ok(())
    }
}

impl Drop for UInputDevice {
    fn drop(&mut self) {
        unsafe {
            let fd = self.file.as_raw_fd();
            libc::ioctl(fd, UI_DEV_DESTROY);
        }
    }
}

// Global lazy-initialized uinput singleton
static UINPUT_DEVICE: OnceLock<Result<Mutex<UInputDevice>, String>> = OnceLock::new();

fn get_uinput() -> Result<&'static Mutex<UInputDevice>, LinuxInputError> {
    let res = UINPUT_DEVICE.get_or_init(|| {
        UInputDevice::create()
            .map(Mutex::new)
            .map_err(|e| e.to_string())
    });

    match res {
        Ok(mutex) => Ok(mutex),
        Err(err_str) => Err(LinuxInputError::UinputOpenFailed(err_str.clone())),
    }
}

// ==========================================
// Public Linux Input APIs with Error Handling
// ==========================================

pub fn release_modifiers() -> Result<(), LinuxInputError> {
    match get_uinput() {
        Ok(dev_mutex) => {
            let mut dev = dev_mutex.lock().unwrap();
            dev.release_all_modifiers()
        }
        Err(uinput_err) => {
            if is_wayland() {
                Err(LinuxInputError::UinputNotAvailableWayland)
            } else if is_x11() {
                // X11 Fallback: explicitly release modifier keys via xdotool keyup
                let output = Command::new("xdotool")
                    .args([
                        "keyup",
                        "Control_L",
                        "Control_R",
                        "Alt_L",
                        "Alt_R",
                        "Shift_L",
                        "Shift_R",
                    ])
                    .output()
                    .map_err(|e| LinuxInputError::XdotoolFailed(e.to_string()))?;
                if !output.status.success() {
                    let err = String::from_utf8_lossy(&output.stderr).to_string();
                    return Err(LinuxInputError::XdotoolFailed(err));
                }
                Ok(())
            } else {
                Err(uinput_err)
            }
        }
    }
}

pub fn send_copy_keys() -> Result<(), LinuxInputError> {
    match get_uinput() {
        Ok(dev_mutex) => {
            let mut dev = dev_mutex.lock().unwrap();
            dev.key_down(KEY_LEFTCTRL)?;
            thread::sleep(Duration::from_millis(5));
            dev.key_down(KEY_C)?;
            thread::sleep(Duration::from_millis(10));
            dev.key_up(KEY_C)?;
            thread::sleep(Duration::from_millis(5));
            dev.key_up(KEY_LEFTCTRL)?;
            Ok(())
        }
        Err(uinput_err) => {
            if is_wayland() {
                Err(LinuxInputError::UinputNotAvailableWayland)
            } else if is_x11() {
                let output = Command::new("xdotool")
                    .args(["key", "--clearmodifiers", "ctrl+c"])
                    .output()
                    .map_err(|e| LinuxInputError::XdotoolFailed(e.to_string()))?;
                if !output.status.success() {
                    return Err(LinuxInputError::XdotoolFailed(
                        String::from_utf8_lossy(&output.stderr).to_string(),
                    ));
                }
                Ok(())
            } else {
                Err(uinput_err)
            }
        }
    }
}

pub fn send_paste_keys() -> Result<(), LinuxInputError> {
    match get_uinput() {
        Ok(dev_mutex) => {
            let mut dev = dev_mutex.lock().unwrap();
            dev.key_down(KEY_LEFTCTRL)?;
            thread::sleep(Duration::from_millis(5));
            dev.key_down(KEY_V)?;
            thread::sleep(Duration::from_millis(10));
            dev.key_up(KEY_V)?;
            thread::sleep(Duration::from_millis(5));
            dev.key_up(KEY_LEFTCTRL)?;
            Ok(())
        }
        Err(uinput_err) => {
            if is_wayland() {
                Err(LinuxInputError::UinputNotAvailableWayland)
            } else if is_x11() {
                let output = Command::new("xdotool")
                    .args(["key", "--clearmodifiers", "ctrl+v"])
                    .output()
                    .map_err(|e| LinuxInputError::XdotoolFailed(e.to_string()))?;
                if !output.status.success() {
                    return Err(LinuxInputError::XdotoolFailed(
                        String::from_utf8_lossy(&output.stderr).to_string(),
                    ));
                }
                Ok(())
            } else {
                Err(uinput_err)
            }
        }
    }
}

pub fn select_previous_word() -> Result<(), LinuxInputError> {
    match get_uinput() {
        Ok(dev_mutex) => {
            let mut dev = dev_mutex.lock().unwrap();
            dev.key_down(KEY_LEFTCTRL)?;
            dev.key_down(KEY_LEFTSHIFT)?;
            thread::sleep(Duration::from_millis(5));
            dev.key_click(KEY_LEFT)?;
            thread::sleep(Duration::from_millis(5));
            dev.key_up(KEY_LEFTSHIFT)?;
            dev.key_up(KEY_LEFTCTRL)?;
            Ok(())
        }
        Err(uinput_err) => {
            if is_wayland() {
                Err(LinuxInputError::UinputNotAvailableWayland)
            } else if is_x11() {
                let output = Command::new("xdotool")
                    .args(["key", "--clearmodifiers", "ctrl+shift+Left"])
                    .output()
                    .map_err(|e| LinuxInputError::XdotoolFailed(e.to_string()))?;
                if !output.status.success() {
                    return Err(LinuxInputError::XdotoolFailed(
                        String::from_utf8_lossy(&output.stderr).to_string(),
                    ));
                }
                Ok(())
            } else {
                Err(uinput_err)
            }
        }
    }
}

pub fn send_right_arrow() -> Result<(), LinuxInputError> {
    match get_uinput() {
        Ok(dev_mutex) => {
            let mut dev = dev_mutex.lock().unwrap();
            dev.key_click(KEY_RIGHT)
        }
        Err(uinput_err) => {
            if is_wayland() {
                Err(LinuxInputError::UinputNotAvailableWayland)
            } else if is_x11() {
                let output = Command::new("xdotool")
                    .args(["key", "--clearmodifiers", "Right"])
                    .output()
                    .map_err(|e| LinuxInputError::XdotoolFailed(e.to_string()))?;
                if !output.status.success() {
                    return Err(LinuxInputError::XdotoolFailed(
                        String::from_utf8_lossy(&output.stderr).to_string(),
                    ));
                }
                Ok(())
            } else {
                Err(uinput_err)
            }
        }
    }
}

/// Plays audio confirmation feedback beep on Linux (standard ASCII bell).
#[allow(dead_code)]
pub fn play_beep() {
    print!("\x07");
}
