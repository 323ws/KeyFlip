#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="1.1.1"
PKG_DIR="$SCRIPT_DIR/keyflip_${VERSION}_amd64"

echo "[1/4] Ensuring release binary is compiled..."
if [ ! -f "$SCRIPT_DIR/src-tauri/target/release/keyflip" ]; then
    export PATH="$HOME/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin:$PATH"
    (cd "$SCRIPT_DIR/src-tauri" && cargo build --release --bin keyflip)
fi

echo "[2/4] Assembling Debian package structure..."
rm -rf "$PKG_DIR"
mkdir -p "$PKG_DIR/DEBIAN"
chmod 755 "$PKG_DIR/DEBIAN"
mkdir -p "$PKG_DIR/usr/bin"
mkdir -p "$PKG_DIR/usr/share/applications"
mkdir -p "$PKG_DIR/usr/share/icons/hicolor/128x128/apps"
mkdir -p "$PKG_DIR/lib/udev/rules.d"

# Copy binary
cp "$SCRIPT_DIR/src-tauri/target/release/keyflip" "$PKG_DIR/usr/bin/keyflip"
chmod 755 "$PKG_DIR/usr/bin/keyflip"

# Copy desktop file
cat << 'EOF2' > "$PKG_DIR/usr/share/applications/keyflip.desktop"
[Desktop Entry]
Name=KeyFlip
Comment=Instant Keyboard Layout Corrector
Exec=env WEBKIT_DISABLE_DMABUF_RENDERER=1 GDK_BACKEND=x11,wayland /usr/bin/keyflip
Icon=keyflip
Terminal=false
Type=Application
Categories=Utility;Accessibility;
StartupNotify=true
EOF2
chmod 644 "$PKG_DIR/usr/share/applications/keyflip.desktop"

# Copy icon
cp "$SCRIPT_DIR/src-tauri/icons/128x128.png" "$PKG_DIR/usr/share/icons/hicolor/128x128/apps/keyflip.png"
chmod 644 "$PKG_DIR/usr/share/icons/hicolor/128x128/apps/keyflip.png"

# Copy udev rule
cp "$SCRIPT_DIR/src-tauri/resources/99-keyflip-uinput.rules" "$PKG_DIR/lib/udev/rules.d/99-keyflip-uinput.rules"
chmod 644 "$PKG_DIR/lib/udev/rules.d/99-keyflip-uinput.rules"

# Control file
cat << EOF2 > "$PKG_DIR/DEBIAN/control"
Package: keyflip
Version: $VERSION
Section: utils
Priority: optional
Architecture: amd64
Maintainer: KeyFlip Contributors <info@keyflip.app>
Depends: libwebkit2gtk-4.1-0 | libwebkit2gtk-4.0-37, libayatana-appindicator3-1, wl-clipboard, xdotool, xclip
Description: KeyFlip - Instant Keyboard Layout Corrector
 Instantly flip text typed in the wrong keyboard language across 17+ global layouts.
 Automatically registers Alt+X global shortcut in GNOME.
EOF2

# Postinst script
cat << 'EOF2' > "$PKG_DIR/DEBIAN/postinst"
#!/bin/sh
set -e

if [ "$1" = "configure" ]; then
    # Reload udev rules to apply /dev/uinput permissions
    if command -v udevadm >/dev/null 2>&1; then
        udevadm control --reload-rules || true
        udevadm trigger --subsystem-match=misc || true
    fi

    # Update icon and desktop cache
    if command -v update-icon-caches >/dev/null 2>&1; then
        update-icon-caches /usr/share/icons/hicolor || true
    fi
    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database || true
    fi
fi
EOF2
chmod 755 "$PKG_DIR/DEBIAN/postinst"

# Postrm script
cat << 'EOF2' > "$PKG_DIR/DEBIAN/postrm"
#!/bin/sh
set -e

if [ "$1" = "remove" ] || [ "$1" = "purge" ]; then
    if command -v udevadm >/dev/null 2>&1; then
        udevadm control --reload-rules || true
        udevadm trigger --subsystem-match=misc || true
    fi
    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database || true
    fi
fi
EOF2
chmod 755 "$PKG_DIR/DEBIAN/postrm"

echo "[3/4] Building .deb package with dpkg-deb..."
dpkg-deb --build --root-owner-group "$PKG_DIR" "$SCRIPT_DIR/keyflip_${VERSION}_amd64.deb"
rm -rf "$PKG_DIR"

echo "[4/4] Package ready!"
echo "Generated: $SCRIPT_DIR/keyflip_${VERSION}_amd64.deb"
