#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod engine;
#[cfg(target_os = "windows")]
mod win_input;
#[cfg(target_os = "linux")]
mod linux_input;
mod input;
mod selection;

use engine::KeyFlipEngine;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
#[cfg(target_os = "windows")]
use std::sync::OnceLock;
use std::thread;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};

#[cfg(not(target_os = "windows"))]
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, ERROR_ALREADY_EXISTS, HANDLE};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, VK_CONTROL, VK_MENU, VK_SHIFT,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, FindWindowW, GetMessageW, SetForegroundWindow,
    SetWindowsHookExW, ShowWindow, TranslateMessage, UnhookWindowsHookEx, KBDLLHOOKSTRUCT, MSG,
    SW_RESTORE, WH_KEYBOARD_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
};

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
extern "system" {
    fn GetModuleHandleW(lpModuleName: *const u16) -> *mut std::ffi::c_void;
    fn CreateMutexW(
        lpMutexAttributes: *const std::ffi::c_void,
        bInitialOwner: i32,
        lpName: *const u16,
    ) -> HANDLE;
}

// Cross-platform key modifier masks
pub const MOD_ALT: u32 = 0x0001;
pub const MOD_CONTROL: u32 = 0x0002;
pub const MOD_SHIFT: u32 = 0x0004;
pub const MOD_WIN: u32 = 0x0008;

#[cfg(target_os = "windows")]
static GLOBAL_APP_STATE: OnceLock<Arc<AppState>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(rename = "primaryLayout")]
    pub primary_layout: String,
    #[serde(rename = "secondaryLayout")]
    pub secondary_layout: String,
    pub enabled: bool,
    pub theme: String,
    #[serde(rename = "uiLang")]
    pub ui_lang: String,
    pub shortcut: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            primary_layout: "en_us".to_string(),
            secondary_layout: "ar_101".to_string(),
            enabled: true,
            theme: "dark".to_string(),
            ui_lang: "en".to_string(),
            shortcut: "Ctrl+Space".to_string(),
        }
    }
}

pub struct AppState {
    pub settings: Mutex<AppSettings>,
    pub config_path: PathBuf,
}

#[allow(dead_code)]
fn parse_shortcut(s: &str) -> (u32, u32) {
    let parts: Vec<&str> = s.split('+').map(|p| p.trim()).collect();
    let mut modifiers = 0u32;
    let mut vk = 0x58u32; // Default 'X'

    for part in parts {
        match part.to_lowercase().as_str() {
            "ctrl" | "control" => modifiers |= MOD_CONTROL,
            "alt" => modifiers |= MOD_ALT,
            "shift" => modifiers |= MOD_SHIFT,
            "win" | "meta" | "super" => modifiers |= 0x0008,
            "space" => vk = 0x20,
            "tab" => vk = 0x09,
            "f1" => vk = 0x70,
            "f2" => vk = 0x71,
            "f3" => vk = 0x72,
            "f4" => vk = 0x73,
            "f5" => vk = 0x74,
            "f6" => vk = 0x75,
            "f7" => vk = 0x76,
            "f8" => vk = 0x77,
            "f9" => vk = 0x78,
            "f10" => vk = 0x79,
            "f11" => vk = 0x7A,
            "f12" => vk = 0x7B,
            "`" | "~" | "backquote" => vk = 0xC0,
            other => {
                if let Some(c) = other.chars().next() {
                    if c.is_ascii_alphanumeric() {
                        vk = c.to_ascii_uppercase() as u32;
                    }
                }
            }
        }
    }

    if modifiers == 0 {
        modifiers = MOD_ALT;
    }

    (modifiers, vk)
}

#[tauri::command]
fn get_settings(state: tauri::State<Arc<AppState>>) -> AppSettings {
    let settings = state.settings.lock().unwrap();
    settings.clone()
}

fn persist_settings(settings: &AppSettings, path: &PathBuf) -> Result<(), String> {
    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {e}"))?;
    fs::write(path, json)
        .map_err(|e| format!("Failed to write settings file {}: {e}", path.display()))
}

#[tauri::command]
fn save_settings(settings: AppSettings, state: tauri::State<Arc<AppState>>) -> Result<(), String> {
    persist_settings(&settings, &state.config_path)?;
    {
        let mut s = state.settings.lock().unwrap();
        *s = settings;
    }
    Ok(())
}

#[tauri::command]
fn toggle_enabled(enabled: bool, state: tauri::State<Arc<AppState>>) -> Result<(), String> {
    let updated = {
        let s = state.settings.lock().unwrap();
        let mut cloned = s.clone();
        cloned.enabled = enabled;
        cloned
    };
    persist_settings(&updated, &state.config_path)?;
    {
        let mut s = state.settings.lock().unwrap();
        s.enabled = enabled;
    }
    Ok(())
}

#[tauri::command]
fn update_shortcut(
    shortcut: String,
    #[allow(unused_variables)] app: tauri::AppHandle,
    state: tauri::State<Arc<AppState>>,
) -> Result<(), String> {
    let updated = {
        let s = state.settings.lock().unwrap();
        let mut cloned = s.clone();
        cloned.shortcut = shortcut.clone();
        cloned
    };
    persist_settings(&updated, &state.config_path)?;
    {
        let mut s = state.settings.lock().unwrap();
        s.shortcut = shortcut.clone();
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app.global_shortcut().unregister_all();
        if let Ok(sc) = shortcut.parse::<Shortcut>() {
            let _ = app.global_shortcut().register(sc);
        }
        #[cfg(target_os = "linux")]
        {
            update_gnome_shortcut(&shortcut);
        }
    }

    Ok(())
}

#[tauri::command]
fn hide_window(window: tauri::Window) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    open::that(url).map_err(|e| e.to_string())
}

fn load_settings(path: &PathBuf) -> AppSettings {
    if path.exists() {
        if let Ok(data) = fs::read_to_string(path) {
            if let Ok(s) = serde_json::from_str(&data) {
                return s;
            }
        }
    }
    AppSettings::default()
}

fn trigger_conversion(settings_arc: &Arc<AppState>) {
    let (enabled, l1, l2) = {
        let s = settings_arc.settings.lock().unwrap();
        (s.enabled, s.primary_layout.clone(), s.secondary_layout.clone())
    };

    if !enabled {
        return;
    }

    // 1. Capture text (existing selection, or auto-selected word LTR/RTL)
    let captured = match selection::capture_text() {
        Some(s) => s,
        None => return,
    };

    // 2. Convert text using generic KeyFlip Layout Engine
    let engine = KeyFlipEngine::global();
    let (converted, changed) = engine.convert_text_between(&captured.text, &l1, &l2);

    if !changed || converted.is_empty() {
        captured.cancel();
        return;
    }

    // 3. Paste converted text and immediately restore original clipboard
    captured.replace_and_restore(&converted);
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn ll_keyboard_proc(n_code: i32, w_param: usize, l_param: isize) -> isize {
    if n_code >= 0 && (w_param == WM_KEYDOWN as usize || w_param == WM_SYSKEYDOWN as usize) {
        let kb = *(l_param as *const KBDLLHOOKSTRUCT);

        // Ignore injected events generated by our own keybd_event (dwExtraInfo or LLKHF_INJECTED)
        if kb.dwExtraInfo == win_input::KEYFLIP_MAGIC || (kb.flags & 0x10) != 0 {
            return CallNextHookEx(std::ptr::null_mut(), n_code, w_param, l_param);
        }

        // Never consume modifier keys themselves
        if kb.vkCode == 0xA5 || kb.vkCode == 0xA4 || kb.vkCode == 0xA2 || kb.vkCode == 0xA3 
            || kb.vkCode == VK_MENU as u32 || kb.vkCode == VK_CONTROL as u32 || kb.vkCode == VK_SHIFT as u32 {
            return CallNextHookEx(std::ptr::null_mut(), n_code, w_param, l_param);
        }

        if let Some(state) = GLOBAL_APP_STATE.get() {
            let (enabled, sc_str) = {
                let s = state.settings.lock().unwrap();
                (s.enabled, s.shortcut.clone())
            };

            if enabled {
                let (target_mods, target_vk) = parse_shortcut(&sc_str);

                if kb.vkCode == target_vk {
                    let right_alt = (GetAsyncKeyState(0xA5) as u16 & 0x8000) != 0; // VK_RMENU
                    let left_alt = (GetAsyncKeyState(0xA4) as u16 & 0x8000) != 0;  // VK_LMENU
                    let any_alt = (GetAsyncKeyState(VK_MENU as i32) as u16 & 0x8000) != 0;
                    let ctrl_pressed = (GetAsyncKeyState(VK_CONTROL as i32) as u16 & 0x8000) != 0;
                    let shift_pressed = (GetAsyncKeyState(VK_SHIFT as i32) as u16 & 0x8000) != 0;

                    let want_alt = (target_mods & MOD_ALT) != 0;
                    let want_ctrl = (target_mods & MOD_CONTROL) != 0;
                    let want_shift = (target_mods & MOD_SHIFT) != 0;

                    // AltGr protection: if Right Alt is pressed or (Ctrl + Alt are both pressed when we did not ask for Ctrl)
                    let is_altgr = is_altgr_event(right_alt, ctrl_pressed, any_alt, want_ctrl);
                    if is_altgr {
                        return CallNextHookEx(std::ptr::null_mut(), n_code, w_param, l_param);
                    }

                    let alt_matched = if want_alt { left_alt || (any_alt && !right_alt) } else { !any_alt };
                    let ctrl_matched = ctrl_pressed == want_ctrl;
                    let shift_matched = shift_pressed == want_shift;

                    if alt_matched && ctrl_matched && shift_matched {
                        let state_clone = Arc::clone(state);
                        thread::spawn(move || {
                            trigger_conversion(&state_clone);
                        });

                        // Consume key event to prevent it from reaching the active window
                        return 1;
                    }
                }
            }
        }
    }

    CallNextHookEx(std::ptr::null_mut(), n_code, w_param, l_param)
}

#[cfg(target_os = "windows")]
fn start_global_hotkeys(state: Arc<AppState>) {
    GLOBAL_APP_STATE.set(Arc::clone(&state)).ok();

    thread::spawn(move || unsafe {
        let h_instance = GetModuleHandleW(std::ptr::null());
        let hook = SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(ll_keyboard_proc),
            h_instance,
            0,
        );

        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }

        if !hook.is_null() {
            UnhookWindowsHookEx(hook);
        }
    });
}

#[cfg(target_os = "windows")]
pub struct SingleInstanceGuard {
    handle: HANDLE,
}

#[cfg(target_os = "windows")]
impl SingleInstanceGuard {
    pub fn acquire(name: &str) -> Option<Self> {
        let mut wide_name: Vec<u16> = name.encode_utf16().collect();
        wide_name.push(0);

        unsafe {
            let handle = CreateMutexW(std::ptr::null(), 1, wide_name.as_ptr());
            if handle.is_null() || GetLastError() == ERROR_ALREADY_EXISTS {
                if !handle.is_null() {
                    CloseHandle(handle);
                }
                None
            } else {
                Some(Self { handle })
            }
        }
    }
}

#[cfg(target_os = "windows")]
impl Drop for SingleInstanceGuard {
    fn drop(&mut self) {
        unsafe {
            if !self.handle.is_null() {
                CloseHandle(self.handle);
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub struct SingleInstanceGuard {
    socket_path: PathBuf,
    listener: Option<std::os::unix::net::UnixListener>,
}

#[cfg(not(target_os = "windows"))]
impl SingleInstanceGuard {
    pub fn acquire(name: &str) -> Option<Self> {
        let safe_name = name.replace('\\', "_").replace('/', "_");
        let runtime_dir = std::env::temp_dir();
        let socket_path = runtime_dir.join(format!("{}.sock", safe_name));

        // 1. Try connecting to check if another instance is already running
        if let Ok(mut stream) = std::os::unix::net::UnixStream::connect(&socket_path) {
            use std::io::Write;
            let _ = stream.write_all(b"SHOW\n");
            return None;
        }

        // 2. Remove stale socket file if any
        let _ = fs::remove_file(&socket_path);

        // 3. Bind new UnixListener
        match std::os::unix::net::UnixListener::bind(&socket_path) {
            Ok(listener) => {
                let _ = listener.set_nonblocking(true);
                Some(Self {
                    socket_path,
                    listener: Some(listener),
                })
            }
            Err(_) => None,
        }
    }

    pub fn start_listener<F>(&mut self, mut on_show: F)
    where
        F: FnMut() + Send + 'static,
    {
        if let Some(listener) = self.listener.take() {
            let _ = listener.set_nonblocking(false);
            thread::spawn(move || {
                use std::io::Read;
                for stream in listener.incoming() {
                    if let Ok(mut s) = stream {
                        let mut buf = [0u8; 16];
                        if let Ok(n) = s.read(&mut buf) {
                            if n > 0 && &buf[..4] == b"SHOW" {
                                on_show();
                            }
                        }
                    }
                }
            });
        }
    }
}

#[cfg(not(target_os = "windows"))]
impl Drop for SingleInstanceGuard {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.socket_path);
    }
}

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Fix WebKit2GTK blank/black window on Linux (NVIDIA / hybrid GPU DMA-BUF bug)
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
        // Prefer X11 (XWayland) to avoid Wayland CSD titlebar freeze and decoration bugs
        if std::env::var("GDK_BACKEND").is_err() {
            std::env::set_var("GDK_BACKEND", "x11,wayland");
        }
    }

    // CLI conversion mode for system shortcuts (e.g. GNOME Alt+X)
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--convert" || a == "-c") {
        let config_dir = dirs_or_fallback();
        let config_path = config_dir.join("config.json");
        let initial_settings = load_settings(&config_path);
        let app_state = Arc::new(AppState {
            settings: Mutex::new(initial_settings),
            config_path,
        });
        trigger_conversion(&app_state);
        return;
    }

    // 0. Single Instance Guard: Prevent multiple background/tray instances
    #[allow(unused_variables)]
    let instance_guard = match SingleInstanceGuard::acquire("Local\\KeyFlip.SingleInstance.Mutex") {
        Some(guard) => guard,
        None => {
            // Another instance is already running!
            // Focus the existing window if visible, then exit immediately.
            #[cfg(target_os = "windows")]
            unsafe {
                let mut wide_title: Vec<u16> = "KeyFlip".encode_utf16().collect();
                wide_title.push(0);
                let hwnd = FindWindowW(std::ptr::null(), wide_title.as_ptr());
                if !hwnd.is_null() {
                    ShowWindow(hwnd, SW_RESTORE);
                    SetForegroundWindow(hwnd);
                }
            }
            // Exit immediately: 0 hooks installed, 0 tray icons created, 0 clipboard manipulation
            std::process::exit(0);
        }
    };

    let config_dir = dirs_or_fallback();
    let _ = fs::create_dir_all(&config_dir);
    let config_path = config_dir.join("config.json");

    let initial_settings = load_settings(&config_path);
    let app_state = Arc::new(AppState {
        settings: Mutex::new(initial_settings),
        config_path,
    });

    #[cfg(target_os = "windows")]
    start_global_hotkeys(Arc::clone(&app_state));

    let state_for_tauri = Arc::clone(&app_state);

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init());

    #[cfg(not(target_os = "windows"))]
    {
        let state_clone = Arc::clone(&app_state);
        let global_shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |_app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    let state_clone = Arc::clone(&state_clone);
                    thread::spawn(move || {
                        trigger_conversion(&state_clone);
                    });
                }
            })
            .build();
        builder = builder.plugin(global_shortcut_plugin);
    }

    #[allow(unused_variables)]
    let app_state_for_setup = Arc::clone(&app_state);

    builder
        .manage(state_for_tauri)
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            toggle_enabled,
            update_shortcut,
            hide_window,
            open_url
        ])
        .setup(move |app| {
            #[cfg(not(target_os = "windows"))]
            {
                let app_handle_for_guard = app.handle().clone();
                let mut guard = instance_guard;
                guard.start_listener(move || {
                    if let Some(w) = app_handle_for_guard.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.unminimize();
                        let _ = w.set_focus();
                    }
                });
                app.manage(guard);
            }

            #[cfg(not(target_os = "windows"))]
            {
                let sc_str = {
                    let s = app_state_for_setup.settings.lock().unwrap();
                    s.shortcut.clone()
                };
                if let Ok(sc) = sc_str.parse::<Shortcut>() {
                    let _ = app.global_shortcut().register(sc);
                }
                #[cfg(target_os = "linux")]
                {
                    update_gnome_shortcut(&sc_str);
                }
            }
            let args: Vec<String> = std::env::args().collect();
            let start_hidden = args.iter().any(|arg| {
                let a = arg.to_lowercase();
                a == "--minimized"
                    || a == "-m"
                    || a == "--hidden"
                    || a == "--autostart"
                    || a == "/minimized"
                    || a == "/hidden"
            });

            if let Some(w) = app.get_webview_window("main") {
                if start_hidden {
                    let _ = w.hide();
                } else {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }

            let tray_open = MenuItem::with_id(app, "open", "Open KeyFlip", true, None::<&str>)?;
            let tray_toggle = MenuItem::with_id(app, "toggle", "Toggle (On/Off)", true, None::<&str>)?;
            let tray_exit = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;

            let tray_menu = Menu::with_items(app, &[&tray_open, &tray_toggle, &tray_exit])?;

            let app_handle = app.handle().clone();
            let tray_icon = match app.default_window_icon() {
                Some(icon) => icon.clone(),
                None => tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))
                    .expect("embedded 32x32 icon is valid"),
            };
            let _tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .tooltip("KeyFlip - Keyboard Layout Corrector")
                .menu(&tray_menu)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "toggle" => {
                        let state = app.state::<Arc<AppState>>();
                        let mut s = state.settings.lock().unwrap();
                        s.enabled = !s.enabled;
                        let _ = app.emit("settings-changed", ());
                    }
                    "exit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(move |_tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(w) = app_handle.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                 let _ = w.hide();
                            } else {
                                 let _ = w.show();
                                 let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running KeyFlip application");
}

fn dirs_or_fallback() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            PathBuf::from(local).join("KeyFlip")
        } else {
            PathBuf::from(".").join("config")
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
            PathBuf::from(xdg).join("keyflip")
        } else if let Ok(home) = std::env::var("HOME") {
            PathBuf::from(home).join(".config").join("keyflip")
        } else {
            PathBuf::from(".").join("config")
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        PathBuf::from(".").join("config")
    }
}

pub fn to_gnome_binding(s: &str) -> String {
    let parts: Vec<&str> = s.split('+').map(|p| p.trim()).collect();
    let mut mods = String::new();
    let mut key = String::new();

    for part in parts {
        match part.to_lowercase().as_str() {
            "ctrl" | "control" => mods.push_str("<Primary>"),
            "alt" => mods.push_str("<Alt>"),
            "shift" => mods.push_str("<Shift>"),
            "super" | "win" | "meta" => mods.push_str("<Super>"),
            other => key = other.to_lowercase(),
        }
    }
    format!("{}{}", mods, key)
}

pub fn latin_to_arabic_keysym(c: char) -> Option<&'static str> {
    match c.to_ascii_lowercase() {
        'q' => Some("Arabic_dad"),
        'w' => Some("Arabic_sad"),
        'e' => Some("Arabic_theh"),
        'r' => Some("Arabic_qaf"),
        't' => Some("Arabic_feh"),
        'y' => Some("Arabic_ghain"),
        'u' => Some("Arabic_ain"),
        'i' => Some("Arabic_ha"),
        'o' => Some("Arabic_khah"),
        'p' => Some("Arabic_hah"),
        'a' => Some("Arabic_sheen"),
        's' => Some("Arabic_seen"),
        'd' => Some("Arabic_yeh"),
        'f' => Some("Arabic_beh"),
        'g' => Some("Arabic_lam"),
        'h' => Some("Arabic_alef"),
        'j' => Some("Arabic_teh"),
        'k' => Some("Arabic_noon"),
        'l' => Some("Arabic_meem"),
        'z' => Some("Arabic_zah"),
        'x' => Some("Arabic_hamza"),
        'c' => Some("Arabic_waw_hamza"),
        'v' => Some("Arabic_ra"),
        'b' => Some("Arabic_alef_hamza_below"),
        'n' => Some("Arabic_teh_marbuta"),
        'm' => Some("Arabic_waw"),
        _ => None,
    }
}

pub fn to_gnome_arabic_binding(s: &str) -> Option<String> {
    let parts: Vec<&str> = s.split('+').map(|p| p.trim()).collect();
    let mut mods = String::new();
    let mut ar_key = None;

    for part in parts {
        match part.to_lowercase().as_str() {
            "ctrl" | "control" => mods.push_str("<Primary>"),
            "alt" => mods.push_str("<Alt>"),
            "shift" => mods.push_str("<Shift>"),
            "super" | "win" | "meta" => mods.push_str("<Super>"),
            other => {
                if other.len() == 1 {
                    if let Some(ch) = other.chars().next() {
                        if let Some(sym) = latin_to_arabic_keysym(ch) {
                            ar_key = Some(sym);
                        }
                    }
                }
            }
        }
    }

    ar_key.map(|k| format!("{}{}", mods, k))
}

#[cfg(target_os = "linux")]
fn update_gnome_shortcut(shortcut_str: &str) {
    let exe_path = std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "keyflip".to_string());
    let cmd = format!("{} --convert", exe_path);

    let en_binding = to_gnome_binding(shortcut_str);
    let ar_binding_opt = to_gnome_arabic_binding(shortcut_str);

    let schema = "org.gnome.settings-daemon.plugins.media-keys";
    let en_path = "/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/keyflip/";
    let ar_path = "/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/keyflip-ar/";

    // 1. Configure English shortcut
    let en_schema = format!("org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:{}", en_path);
    let _ = std::process::Command::new("gsettings")
        .args(&["set", &en_schema, "name", "KeyFlip Convert (EN)"])
        .output();
    let _ = std::process::Command::new("gsettings")
        .args(&["set", &en_schema, "command", &cmd])
        .output();
    let _ = std::process::Command::new("gsettings")
        .args(&["set", &en_schema, "binding", &en_binding])
        .output();

    // 2. Configure Arabic shortcut if applicable
    let mut custom_list = format!("['{}']", en_path);
    if let Some(ar_binding) = ar_binding_opt {
        let ar_schema = format!("org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:{}", ar_path);
        let _ = std::process::Command::new("gsettings")
            .args(&["set", &ar_schema, "name", "KeyFlip Convert (AR)"])
            .output();
        let _ = std::process::Command::new("gsettings")
            .args(&["set", &ar_schema, "command", &cmd])
            .output();
        let _ = std::process::Command::new("gsettings")
            .args(&["set", &ar_schema, "binding", &ar_binding])
            .output();
        custom_list = format!("['{}', '{}']", en_path, ar_path);
    }

    // 3. Register custom bindings in GNOME media-keys list
    let _ = std::process::Command::new("gsettings")
        .args(&["set", schema, "custom-keybindings", &custom_list])
        .output();
}

pub fn is_altgr_event(right_alt: bool, ctrl_pressed: bool, any_alt: bool, want_ctrl: bool) -> bool {
    right_alt || (ctrl_pressed && any_alt && !want_ctrl)
}

#[cfg(test)]
mod hotkey_tests {
    use super::*;

    #[test]
    fn test_altgr_isolation_physical_right_alt() {
        // Physical Right Alt pressed (VK_RMENU)
        assert!(is_altgr_event(true, false, true, false));
        assert!(is_altgr_event(true, true, true, false));
        assert!(is_altgr_event(true, false, false, false));
        assert!(is_altgr_event(true, true, true, true));
    }

    #[test]
    fn test_altgr_isolation_windows_ctrl_alt_emulation() {
        // Windows simulates AltGr via Ctrl + Alt when target shortcut does not want Ctrl
        assert!(is_altgr_event(false, true, true, false));
    }

    #[test]
    fn test_normal_left_alt_not_altgr() {
        // Normal Left Alt (VK_LMENU) without Ctrl -> NOT AltGr, must trigger Alt+X!
        assert!(!is_altgr_event(false, false, true, false));
    }

    #[test]
    fn test_ctrl_shift_shortcut_not_altgr() {
        // If the user's configured shortcut is Ctrl+Shift+X (want_ctrl = true)
        // Then pressing Ctrl does NOT make it AltGr!
        assert!(!is_altgr_event(false, true, false, true));
    }

    #[test]
    fn test_shortcut_parsing() {
        let (mods, vk) = parse_shortcut("Alt+X");
        assert_eq!(mods, MOD_ALT);
        assert_eq!(vk, 0x58);

        let (mods, vk) = parse_shortcut("Ctrl+Shift+X");
        assert_eq!(mods, MOD_CONTROL | MOD_SHIFT);
        assert_eq!(vk, 0x58);

        let (mods, vk) = parse_shortcut("Ctrl+Space");
        assert_eq!(mods, MOD_CONTROL);
        assert_eq!(vk, 0x20);
    }

    #[test]
    fn test_to_gnome_binding() {
        assert_eq!(to_gnome_binding("Alt+X"), "<Alt>x");
        assert_eq!(to_gnome_binding("Ctrl+Shift+X"), "<Primary><Shift>x");
        assert_eq!(to_gnome_binding("Ctrl+Alt+X"), "<Primary><Alt>x");
        assert_eq!(to_gnome_binding("F4"), "f4");
    }

    #[test]
    fn test_to_gnome_arabic_binding() {
        assert_eq!(to_gnome_arabic_binding("Alt+X"), Some("<Alt>Arabic_hamza".to_string()));
        assert_eq!(to_gnome_arabic_binding("Ctrl+Shift+X"), Some("<Primary><Shift>Arabic_hamza".to_string()));
        assert_eq!(to_gnome_arabic_binding("F4"), None);
    }

    #[test]
    fn test_single_instance_guard_lifecycle() {
        let mutex_name = format!("Local\\KeyFlip.TestMutex.{}", std::process::id());

        // 1. First instance acquires successfully
        let first_instance = SingleInstanceGuard::acquire(&mutex_name);
        assert!(first_instance.is_some(), "First instance must successfully acquire mutex");

        // 2. Second instance attempting to acquire the same mutex must FAIL
        let second_instance = SingleInstanceGuard::acquire(&mutex_name);
        assert!(second_instance.is_none(), "Second instance must fail to acquire while first is alive");

        // 3. Drop the first instance (simulating process termination)
        drop(first_instance);

        // 4. Third instance can now acquire cleanly
        let third_instance = SingleInstanceGuard::acquire(&mutex_name);
        assert!(third_instance.is_some(), "Third instance must acquire cleanly after first is dropped");
    }
}

