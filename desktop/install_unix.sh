#!/usr/bin/env bash
set -e

# ===================================================
#      KeyFlip Linux Desktop Installer
#      Supports: Debian/Ubuntu, Fedora, Arch Linux
# ===================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
OS_TYPE="$(uname -s)"

echo "==================================================="
echo "       KeyFlip Desktop Installer (Linux)          "
echo "==================================================="
echo "Detected Platform: $OS_TYPE"
echo ""

# 1. Dependency Checks
command -v node >/dev/null 2>&1 || {
    echo "[ERROR] Node.js is required but not installed."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
}

command -v cargo >/dev/null 2>&1 || {
    echo "[ERROR] Rust / Cargo is required but not installed."
    echo "Please install Rust by running:"
    echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
}

if [ "$OS_TYPE" = "Linux" ]; then
    echo "[INFO] Configuring for Linux..."
    
    # Optional helper: check for common Linux webkit/gtk dev libraries
    if command -v apt-get >/dev/null 2>&1; then
        echo "[INFO] Debian/Ubuntu detected."
        echo "Required runtime & build packages:"
        echo "  sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev xdotool wl-clipboard xclip"
    elif command -v dnf >/dev/null 2>&1; then
        echo "[INFO] Fedora/RHEL detected."
        echo "Required runtime & build packages:"
        echo "  sudo dnf install -y webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel xdotool wl-clipboard xclip"
    elif command -v pacman >/dev/null 2>&1; then
        echo "[INFO] Arch Linux detected."
        echo "Required runtime & build packages:"
        echo "  sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget openssl libappindicator-gtk3 librsvg xdotool wl-clipboard xclip"
    fi

    # Ensure uinput accessibility for native Wayland & X11 input injection
    if [ -e /dev/uinput ] && [ ! -w /dev/uinput ]; then
        echo ""
        echo "[INFO] Configuring /dev/uinput permissions for non-root keyboard emulation..."
        if command -v sudo >/dev/null 2>&1; then
            echo 'KERNEL=="uinput", SUBSYSTEM=="misc", TAG+="uaccess"' | sudo tee /etc/udev/rules.d/99-keyflip-uinput.rules >/dev/null
            sudo udevadm control --reload-rules || true
            sudo udevadm trigger --subsystem-match=misc || true
            echo "[OK] uinput udev rule configured automatically."
        else
            echo "[WARN] sudo not found. Please ensure your user has write access to /dev/uinput."
        fi
        echo ""
    fi
else
    echo "[WARN] Unknown Unix OS: $OS_TYPE. Proceeding with standard build..."
fi

# 2. Build layouts and UI assets
echo ""
echo "[1/3] Building Layout tables and UI assets..."
cd "$ROOT_DIR"
node scripts/build-layouts.js

# 3. Build Rust Desktop Binary
echo ""
echo "[2/3] Compiling KeyFlip native desktop binary (Release mode)..."
cd "$SCRIPT_DIR/src-tauri"
cargo build --release

RELEASE_BIN="$SCRIPT_DIR/src-tauri/target/release/keyflip"

if [ ! -f "$RELEASE_BIN" ]; then
    echo "[ERROR] Compilation failed: binary not found at $RELEASE_BIN"
    exit 1
fi

# 4. Install Binary to User Path
echo ""
echo "[3/3] Installing KeyFlip..."

INSTALL_DIR="$HOME/.local/bin"
mkdir -p "$INSTALL_DIR"
cp -f "$RELEASE_BIN" "$INSTALL_DIR/keyflip"
chmod +x "$INSTALL_DIR/keyflip"

TEST_INPUT_BIN="$SCRIPT_DIR/src-tauri/target/release/test_linux_input"
if [ -f "$TEST_INPUT_BIN" ]; then
    cp -f "$TEST_INPUT_BIN" "$INSTALL_DIR/keyflip-test-input"
    chmod +x "$INSTALL_DIR/keyflip-test-input"
fi

# Ensure ~/.local/bin is in PATH hint
case ":$PATH:" in
    *":$INSTALL_DIR:"*) ;;
    *) echo "[NOTE] Add $INSTALL_DIR to your PATH in ~/.bashrc or ~/.zshrc if not already present:"
       echo "       export PATH=\"\$HOME/.local/bin:\$PATH\""
       ;;
esac

# Linux Desktop Shortcut (.desktop entry)
if [ "$OS_TYPE" = "Linux" ]; then
    DESKTOP_ENTRY_DIR="$HOME/.local/share/applications"
    mkdir -p "$DESKTOP_ENTRY_DIR"
    cat <<EOF > "$DESKTOP_ENTRY_DIR/keyflip.desktop"
[Desktop Entry]
Name=KeyFlip
Comment=Instant Keyboard Layout Corrector
Exec=env WEBKIT_DISABLE_DMABUF_RENDERER=1 GDK_BACKEND=x11,wayland $INSTALL_DIR/keyflip
Icon=$SCRIPT_DIR/src-tauri/icons/128x128.png
Terminal=false
Type=Application
Categories=Utility;Accessibility;
StartupNotify=true
EOF
    chmod +x "$DESKTOP_ENTRY_DIR/keyflip.desktop"
    echo "[OK] Registered Linux Desktop entry: $DESKTOP_ENTRY_DIR/keyflip.desktop"

    # GNOME Global Shortcut Registration (Wayland & X11 compatibility)
    if command -v gsettings >/dev/null 2>&1; then
        echo "[INFO] Registering GNOME system shortcuts for KeyFlip..."
        BINDING_PATH="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/keyflip/"
        BINDING_AR_PATH="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/keyflip-ar/"
        SCHEMA="org.gnome.settings-daemon.plugins.media-keys"
        CUSTOM_SCHEMA="org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$BINDING_PATH"
        CUSTOM_AR_SCHEMA="org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$BINDING_AR_PATH"

        CURRENT_LIST=$(gsettings get $SCHEMA custom-keybindings 2>/dev/null || echo "@as []")
        NEW_LIST="$CURRENT_LIST"
        if [ "$NEW_LIST" = "@as []" ] || [ -z "$NEW_LIST" ]; then
            NEW_LIST="['$BINDING_PATH', '$BINDING_AR_PATH']"
        else
            if ! echo "$NEW_LIST" | grep -q "$BINDING_PATH"; then
                NEW_LIST=$(echo "$NEW_LIST" | sed "s|]$|, '$BINDING_PATH']|")
            fi
            if ! echo "$NEW_LIST" | grep -q "$BINDING_AR_PATH"; then
                NEW_LIST=$(echo "$NEW_LIST" | sed "s|]$|, '$BINDING_AR_PATH']|")
            fi
        fi
        gsettings set $SCHEMA custom-keybindings "$NEW_LIST" 2>/dev/null || true

        # 1. English shortcut (Alt+X)
        gsettings set $CUSTOM_SCHEMA name 'KeyFlip Convert (EN)' 2>/dev/null || true
        gsettings set $CUSTOM_SCHEMA command "$INSTALL_DIR/keyflip --convert" 2>/dev/null || true
        gsettings set $CUSTOM_SCHEMA binding '<Alt>x' 2>/dev/null || true

        # 2. Arabic shortcut (Alt+ء)
        gsettings set $CUSTOM_AR_SCHEMA name 'KeyFlip Convert (AR)' 2>/dev/null || true
        gsettings set $CUSTOM_AR_SCHEMA command "$INSTALL_DIR/keyflip --convert" 2>/dev/null || true
        gsettings set $CUSTOM_AR_SCHEMA binding '<Alt>Arabic_hamza' 2>/dev/null || true

        echo "[OK] Registered GNOME Global Shortcuts:"
        echo "     English: Alt+X -> $INSTALL_DIR/keyflip --convert"
        echo "     Arabic:  Alt+ء -> $INSTALL_DIR/keyflip --convert"
    fi
fi

echo ""
echo "==================================================="
echo "  🎉 KeyFlip Desktop successfully installed!"
echo "  Executable: $INSTALL_DIR/keyflip"
echo "  CLI Converter: $INSTALL_DIR/keyflip --convert"
echo "  Shortcut: Alt+X"
echo "==================================================="
echo ""
echo "Run 'keyflip' or '$INSTALL_DIR/keyflip' to launch."

