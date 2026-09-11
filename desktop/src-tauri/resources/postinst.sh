#!/bin/sh
set -e

# Reload udev rules when KeyFlip deb package is installed/upgraded
if [ "$1" = "configure" ]; then
    if command -v udevadm >/dev/null 2>&1; then
        udevadm control --reload-rules || true
        udevadm trigger --subsystem-match=misc || true
    fi
fi
