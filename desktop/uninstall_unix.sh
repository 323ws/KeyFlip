#!/usr/bin/env bash
set -e

# ==============================================================================
# KeyFlip Desktop - Complete Uninstaller & Permission Cleaner (Linux)
# ==============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}    KeyFlip Complete Uninstaller & Reset Tool       ${NC}"
echo -e "${BLUE}====================================================${NC}"

# 1. Kill any running KeyFlip processes
echo -e "\n${YELLOW}[1/5] Terminating running KeyFlip processes...${NC}"
pkill -f keyflip 2>/dev/null || true
echo -e "${GREEN}[OK] No KeyFlip process is currently running.${NC}"

# 2. Remove user-level binary, desktop entries, configs, and temporary sockets
echo -e "\n${YELLOW}[2/5] Removing user files & configurations...${NC}"
rm -f "$HOME/.local/bin/keyflip" || true
rm -f "$HOME/.local/share/applications/keyflip.desktop" || true
rm -f "$HOME/.config/autostart/keyflip.desktop" || true
rm -rf "$HOME/.config/keyflip" 2>/dev/null || true
rm -f /tmp/*keyflip* /tmp/*KeyFlip* 2>/dev/null || true

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi
echo -e "${GREEN}[OK] Removed ~/.local/bin/keyflip, desktop entries, and ~/.config/keyflip${NC}"

# 3. Reset GNOME system shortcuts
echo -e "\n${YELLOW}[3/5] Cleaning up GNOME global shortcuts...${NC}"
if command -v gsettings >/dev/null 2>&1; then
    BINDING_PATH="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/keyflip/"
    BINDING_AR_PATH="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/keyflip-ar/"
    BINDING_CUSTOM_PATH="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom-keyflip/"
    SCHEMA="org.gnome.settings-daemon.plugins.media-keys"

    CURRENT_LIST=$(gsettings get $SCHEMA custom-keybindings 2>/dev/null || echo "@as []")
    NEW_LIST=$(echo "$CURRENT_LIST" | sed "s|'$BINDING_PATH', ||g; s|, '$BINDING_PATH'||g; s|'$BINDING_PATH'||g; s|'$BINDING_AR_PATH', ||g; s|, '$BINDING_AR_PATH'||g; s|'$BINDING_AR_PATH'||g; s|'$BINDING_CUSTOM_PATH', ||g; s|, '$BINDING_CUSTOM_PATH'||g; s|'$BINDING_CUSTOM_PATH'||g" || echo "@as []")
    
    if [ "$NEW_LIST" = "[]" ] || [ -z "$NEW_LIST" ]; then
        NEW_LIST="@as []"
    fi
    gsettings set $SCHEMA custom-keybindings "$NEW_LIST" 2>/dev/null || true

    gsettings reset-recursively "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$BINDING_PATH" 2>/dev/null || true
    gsettings reset-recursively "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$BINDING_AR_PATH" 2>/dev/null || true
    gsettings reset-recursively "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$BINDING_CUSTOM_PATH" 2>/dev/null || true
    echo -e "${GREEN}[OK] Reset GNOME media-keys shortcuts.${NC}"
fi

# 4. Remove system .deb package if installed
echo -e "\n${YELLOW}[4/5] Checking and purging system package (deb)...${NC}"
if dpkg -l keyflip 2>/dev/null | grep -q "^ii"; then
    echo -e "${BLUE}[INFO] Purging keyflip deb package via sudo...${NC}"
    sudo dpkg -P keyflip || sudo apt purge -y keyflip
    echo -e "${GREEN}[OK] Purged keyflip system package.${NC}"
else
    echo -e "${GREEN}[OK] keyflip system package was not installed.${NC}"
fi

# 5. Remove udev permissions rules and reload
echo -e "\n${YELLOW}[5/5] Revoking /dev/uinput permissions & removing udev rules...${NC}"
NEED_UDEV_RELOAD=false
if [ -f "/etc/udev/rules.d/99-keyflip-uinput.rules" ]; then
    sudo rm -f "/etc/udev/rules.d/99-keyflip-uinput.rules"
    NEED_UDEV_RELOAD=true
fi
if [ -f "/lib/udev/rules.d/99-keyflip-uinput.rules" ]; then
    sudo rm -f "/lib/udev/rules.d/99-keyflip-uinput.rules"
    NEED_UDEV_RELOAD=true
fi

if [ "$NEED_UDEV_RELOAD" = true ] || command -v udevadm >/dev/null 2>&1; then
    sudo udevadm control --reload-rules 2>/dev/null || true
    sudo udevadm trigger --subsystem-match=misc 2>/dev/null || true
    echo -e "${GREEN}[OK] Reloaded udev rules.${NC}"
fi

echo -e "\n${BLUE}====================================================${NC}"
echo -e "${GREEN}  ✨ KeyFlip has been COMPLETELY UNINSTALLED!        ${NC}"
echo -e "${GREEN}  All permissions, udev rules, shortcuts, and files ${NC}"
echo -e "${GREEN}  have been wiped. Your system is 100% clean.       ${NC}"
echo -e "${BLUE}====================================================${NC}\n"

# Verify current /dev/uinput permissions
if [ -e "/dev/uinput" ]; then
    echo -e "Current /dev/uinput status:"
    ls -l /dev/uinput
fi
