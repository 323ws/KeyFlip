#[cfg(target_os = "linux")]
#[path = "../input/linux.rs"]
mod linux_input;

fn main() {
    #[cfg(not(target_os = "linux"))]
    {
        println!("test_linux_input is designed to run on Linux.");
    }

    #[cfg(target_os = "linux")]
    {
        use std::io::{self, Write};
        use std::thread;
        use std::time::Duration;

        println!("=====================================================");
        println!("          KeyFlip Linux Input Backend Diagnostic     ");
        println!("=====================================================");

        // 1. Session Information
        let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_else(|_| "unknown".to_string());
        let wayland_display = std::env::var("WAYLAND_DISPLAY").unwrap_or_else(|_| "not set".to_string());
        let x11_display = std::env::var("DISPLAY").unwrap_or_else(|_| "not set".to_string());

        println!("[INFO] Session Type:      {}", session_type);
        println!("[INFO] WAYLAND_DISPLAY:   {}", wayland_display);
        println!("[INFO] DISPLAY (X11):     {}", x11_display);
        println!("[INFO] is_wayland():      {}", linux_input::is_wayland());
        println!("[INFO] is_x11():          {}", linux_input::is_x11());
        println!("-----------------------------------------------------");

        // 2. /dev/uinput Device Check
        let uinput_paths = ["/dev/uinput", "/dev/input/uinput"];
        let mut uinput_found = false;
        for path in &uinput_paths {
            let p = std::path::Path::new(path);
            if p.exists() {
                uinput_found = true;
                println!("[CHECK] Found device node: {}", path);
                match std::fs::OpenOptions::new().write(true).open(path) {
                    Ok(_) => println!("        -> Permissions: Read/Write OK! (Can create virtual keyboard)"),
                    Err(e) => println!("        -> Permissions: FAILED ({}). Need udev rule or user in input group!", e),
                }
            }
        }
        if !uinput_found {
            println!("[WARN] Neither /dev/uinput nor /dev/input/uinput was found!");
        }
        println!("-----------------------------------------------------");

        // 3. Fallback Tool Check
        let xdotool_installed = std::process::Command::new("which")
            .arg("xdotool")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        println!("[CHECK] xdotool available: {}", if xdotool_installed { "YES" } else { "NO" });
        println!("-----------------------------------------------------");

        // 4. Test Release Modifiers
        println!("[TEST 1/4] Testing release_modifiers()...");
        match linux_input::release_modifiers() {
            Ok(_) => println!("        -> Result: SUCCESS"),
            Err(e) => println!("        -> Result: FAILED ({})", e),
        }

        // 5. Interactive Input Injection Test
        println!("\n[TEST 2/4] Keystroke Injection Test in 3 seconds...");
        println!("Please click into a text editor or browser search bar NOW to test Ctrl+C / Ctrl+V / Arrows...");
        for i in (1..=3).rev() {
            print!("  Starting in {}... \r", i);
            io::stdout().flush().unwrap();
            thread::sleep(Duration::from_secs(1));
        }
        println!("\n  Injecting test keystrokes now!");

        // Test send_copy_keys
        print!("  -> Sending Ctrl+C: ");
        match linux_input::send_copy_keys() {
            Ok(_) => println!("OK"),
            Err(e) => println!("FAILED ({})", e),
        }
        thread::sleep(Duration::from_millis(300));

        // Test select_previous_word
        print!("  -> Sending Ctrl+Shift+Left: ");
        match linux_input::select_previous_word() {
            Ok(_) => println!("OK"),
            Err(e) => println!("FAILED ({})", e),
        }
        thread::sleep(Duration::from_millis(300));

        // Test send_right_arrow
        print!("  -> Sending Right Arrow: ");
        match linux_input::send_right_arrow() {
            Ok(_) => println!("OK"),
            Err(e) => println!("FAILED ({})", e),
        }
        thread::sleep(Duration::from_millis(300));

        // Test send_paste_keys
        print!("  -> Sending Ctrl+V: ");
        match linux_input::send_paste_keys() {
            Ok(_) => println!("OK"),
            Err(e) => println!("FAILED ({})", e),
        }

        println!("\n=====================================================");
        println!("                 Test Complete!                      ");
        println!("=====================================================");
    }
}
