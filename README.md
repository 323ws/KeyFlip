# KeyFlip

> An instant, offline physical keyboard layout converter for Windows, Linux, and modern web browsers.

<a href="https://launchaf.com/" target="_blank" rel="noopener" data-launchaf-badge="true"><img src="https://launchaf.com/api/badge/light?v=launchaf-blue-2026-2" alt="Featured on LaunchAF" width="200" height="56" /></a>

[![Support on Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20me-%23047857?style=flat&logo=kofi&logoColor=white)](https://ko-fi.com/N4N21X8U7I)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-blue)](desktop/)
[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-emerald)](extensions/chrome/)
[![Firefox Add-on](https://img.shields.io/badge/Firefox%20Add--on-WebExtensions-orange)](extensions/firefox/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<p align="center">
  <img src="KeyFlip.gif" alt="KeyFlip Demo" width="100%">
</p>

---

## Overview

If you type in more than one language, you have almost certainly encountered this situation: you type a sentence without looking at the screen, only to realize that your operating system input language was never switched. The result is completely unreadable text:

| Intended Input | Result on Screen | Language Pair |
| :--- | :--- | :--- |
| **`chat`** | `ؤاشف` | Arabic ↔ English |
| **`hello world`** | `اثممو صخقمی` | Arabic ↔ English |
| **`login`** | `مخلهى` | Arabic ↔ English |
| **`سلام`** (Salam) | `sghl` | Persian ↔ English |
| **`привет`** (Privet) | `ghbdtn` | Russian ↔ English |
| **`programming`** | `ghjuhfvvbhjdfybt` | Russian ↔ English |
| **`שלום`** (Shalom) | `akuo` | Hebrew ↔ English |
| **`wasd`** (Movement) | `zqsd` | French AZERTY ↔ QWERTY |
| **`한국`** (Hangul) | `gksrnr` | Korean ↔ English |

KeyFlip solves this without requiring you to backspace and retype. Simply select the text and press **`Ctrl + Space`** (or your configured hotkey). KeyFlip determines the physical key coordinates on your keyboard hardware and replaces the string with the correct characters in the target layout.

---

## Key Characteristics

- **Hardware-Level Key Mapping:** KeyFlip is not a dictionary-based spell checker. It maps physical hardware scan codes (ANSI and ISO) directly between layouts, preserving digits, punctuation, and symbols.
- **Caps Lock and Case Correction:** Handles accidental Caps Lock states (e.g. `HGSGHL` becomes `السلام`) and capitalized proper nouns (`Chat` becomes `ؤاشف`) without producing stray diacritics or bracket artifacts.
- **Complex Script Support:** Native handling for multi-keystroke Arabic ligatures (`لا`, `لأ`, `لإ`, `لآ`) and Korean 2-Set Hangul syllable composition and decomposition (`ㅎ + ㅏ + ㄴ` ➔ `한`).
- **Bidirectional Detection:** Select your primary and secondary layout pair (e.g. English and Arabic). KeyFlip detects which script was entered and flips the text in the appropriate direction automatically.
- **Local and Private:** Zero telemetry, no external network requests, and zero keylogging. All translation logic runs entirely in memory on your machine.
- **Dual Interface:** Includes a dark theme by default, optional light theme, and an immediate toggle between English and Arabic UI text.

---

## Installation and Setup

### 1. Web Browser Extensions (Chrome, Edge, Brave, Firefox)
Works within web inputs, textareas, rich-text editors (Google Docs, Notion, Slack, Gmail), and general page selections.

#### Chromium Browsers (Google Chrome, Microsoft Edge, Brave, Opera)
1. Navigate to `chrome://extensions/` in your browser.
2. Enable **Developer mode** using the toggle in the upper-right corner.
3. Click **Load unpacked** and select the [`extensions/chrome`](extensions/chrome/) directory.
4. Pin KeyFlip to your browser toolbar for easy access to settings.

#### Mozilla Firefox
1. Navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select the `manifest.json` file inside the [`extensions/firefox`](extensions/firefox/) directory.

*Omnibox Tip:* Type `kf <text>` into your browser address bar and press `Enter` to convert text directly into a web search query.

---

### 2. Windows Desktop Application
Works system-wide across all native Windows applications (Office, Notepad, VS Code, Discord, Telegram, Terminal, and games).

- **Portable Binary:** Run `dist/KeyFlip-Portable.exe`. Runs quietly in the system tray and requires no administrative privileges or UAC elevation.
- **Setup Installer:** Run `dist/KeyFlip-Setup.exe` for a standard per-user installation with an optional startup task.

---

### 3. Linux Desktop Application
Native support for Linux desktops across both **X11** and **Wayland** display servers.

#### Installation Script
```bash
cd desktop
chmod +x install_unix.sh
./install_unix.sh
```
This script compiles the release binary, creates the desktop menu entry, and registers global shortcuts under GNOME.

#### Debian / Ubuntu Package (.deb)
```bash
cd desktop
chmod +x package_deb.sh
./package_deb.sh
sudo dpkg -i keyflip_1.1.1_amd64.deb
```

*Build Dependencies:* `libwebkit2gtk-4.1-dev`, `build-essential`, `wl-clipboard` (Wayland), `xclip` / `xdotool` (X11).

---

## Default Shortcut

| Action | Default Binding | Scope |
| :--- | :--- | :--- |
| **Convert Selection / Current Word** | **`Ctrl + Space`** | Global / Browser / Desktop |

- In active input fields or text editors, pressing `Ctrl + Space` converts the highlighted text or the active word at the cursor.
- Outside editable inputs, selecting text and pressing `Ctrl + Space` copies, converts, and replaces the string via the system clipboard.
- The key binding can be customized at any time through the extension popup or the desktop application preferences.

---

## Supported Layouts

KeyFlip includes 23 layout specifications compiled from canonical JSON definitions in `core/layouts/`:

| Region / Language Family | Included Layouts |
| :--- | :--- |
| **Arabic** | Standard Windows 101 (`ar_101`), Standard 102 (`ar_102`) |
| **English** | US QWERTY (`en_us`), UK English (`en_gb`), Colemak (`colemak`), Dvorak (`dvorak`) |
| **Middle Eastern** | Persian / Farsi (`fa`), Urdu (`ur`), Hebrew SI-1452 (`he`), Turkish Q (`tr_q`) |
| **Western European** | French AZERTY (`fr_azerty`), Spanish (`es`), German QWERTZ (`de_qwertz`), Italian (`it`), Portuguese ABNT2 (`pt`) |
| **Central & Northern European** | Czech (`cs`), Polish Programmers (`pl`), Greek (`el`), Nordic (`nordic` - Swedish/Norwegian/Danish/Finnish) |
| **Eastern European & Asian** | Russian ЙЦУКЕН (`ru`), Ukrainian (`uk`), Korean 2-Set Hangul (`ko`), Thai Kedmanee (`th`) |

---

## Building from Source

### Prerequisites
- Node.js 18 or newer
- Rust and Cargo (for compiling desktop binaries)

### Available Commands
```bash
# Validate layout definitions against core/layouts/schema.json
npm run validate:layouts

# Compile core/layouts/*.json into JavaScript and Rust bundles
npm run build:layouts

# Assemble unpacked browser extension trees in dist/
npm run build:extensions

# Execute full automated test suite (8 test suites + Windows E2E gates)
npm test

# Package distribution files (Portable EXE, Setup Installer, Extension ZIPs)
npm run package
```

---

## Support

If KeyFlip saves you time and repetitive typing, you can support continuing open-source development:

[![Support on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/N4N21X8U7I)

---

## License

KeyFlip is licensed under the [MIT License](LICENSE).
