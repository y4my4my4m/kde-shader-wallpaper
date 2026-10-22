#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-or-later
#
# Set up Shader Wallpaper on the Plasma Login Manager sign-in screen.
#
# Plasma Login Manager runs before any user logs in, so the wallpaper plugin
# must be installed system-wide (/usr) and registered in /etc/plasmalogin.conf.
# Your existing ~/.local install continues to power the desktop and lock screen.
#
# Usage:
#   bash install-plm-greeter.sh              # build, install to /usr, register
#   bash install-plm-greeter.sh --sync       # copy any new ~/.local imports
#                                            # (Shaders/Imported, Shaders/Packages)
#                                            # to /usr without rebuilding
#   bash install-plm-greeter.sh --uninstall  # remove only the PLM registration

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
PKG_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
PLUGIN_ID="online.knowmad.shaderwallpaper"
CONF="/etc/plasmalogin.conf"
USER_PKG="${XDG_DATA_HOME:-$HOME/.local/share}/plasma/wallpapers/$PLUGIN_ID/contents/ui"
SYSTEM_PKG="/usr/share/plasma/wallpapers/$PLUGIN_ID/contents/ui"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
say()  { echo -e "${GREEN}➤${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*" >&2; }

check_plm() {
    command -v plasmalogin >/dev/null 2>&1 && return 0
    systemctl list-unit-files plasmalogin.service 2>/dev/null | grep -q plasmalogin.service && return 0
    err "Plasma Login Manager (plasma-login-manager) is not installed."
    echo   "  Arch/Manjaro: sudo pacman -S plasma-login-manager"
    exit 1
}

# Installed helper first; the bundled or checkout copy otherwise.
find_helper() {
    local h
    for h in /usr/lib/libexec/shaderwallpaper/enable-plm-greeter \
             /usr/lib64/libexec/shaderwallpaper/enable-plm-greeter \
             /usr/libexec/shaderwallpaper/enable-plm-greeter \
             "$PKG_DIR/contents/source/scripts/enable-plm-greeter.sh" \
             "$(dirname "$PKG_DIR")/scripts/enable-plm-greeter.sh"; do
        if [ -f "$h" ]; then echo "$h"; return 0; fi
    done
    return 1
}

uninstall() {
    say "Removing PLM registration…"
    [ "$(id -u)" -eq 0 ] || exec sudo bash "$0" --uninstall
    if [ -f "$CONF" ] && grep -q '^WallpaperPluginId=' "$CONF"; then
        sed -i '/^WallpaperPluginId=/d' "$CONF"
        echo "Removed WallpaperPluginId from $CONF."
    else
        echo "No registration found in $CONF."
    fi
    exit 0
}

# Copy any user-only shader subdirs (Imported/, Packages/) from ~/.local
# into /usr so the PLM greeter can see them too. Stock shaders are
# already there from `build.sh system` and untouched. Idempotent.
sync_user_shaders() {
    if [ ! -d "$USER_PKG/Shaders" ]; then
        return 0
    fi
    if [ ! -d "$SYSTEM_PKG/Shaders" ]; then
        warn "No system install at $SYSTEM_PKG — run without --sync first."
        exit 1
    fi
    local copied=0
    for sub in Imported Packages; do
        local src="$USER_PKG/Shaders/$sub"
        if [ -d "$src" ] && [ -n "$(ls -A "$src" 2>/dev/null)" ]; then
            say "Copying $sub shaders to /usr (sudo)…"
            sudo mkdir -p "$SYSTEM_PKG/Shaders/$sub"
            sudo cp -r --update "$src/." "$SYSTEM_PKG/Shaders/$sub/"
            copied=$((copied + 1))
        fi
    done
    if [ "$copied" -eq 0 ]; then
        echo "  No user imports to copy."
    fi
}

if [ "${1:-}" = "--uninstall" ] || [ "${1:-}" = "-u" ]; then
    uninstall
fi

if [ "${1:-}" = "--sync" ] || [ "${1:-}" = "-s" ]; then
    sync_user_shaders
    echo ""
    echo -e "${GREEN}✓ Done.${NC} Reopen wallpaper settings to refresh the badges."
    exit 0
fi

check_plm

say "Building and installing system-wide (you'll be prompted for sudo)…"
bash "$SCRIPT_DIR/build.sh" system --package "$PKG_DIR"

sync_user_shaders

HELPER="$(find_helper)" || { err "enable-plm-greeter helper not found."; exit 1; }

say "Registering plugin in /etc/plasmalogin.conf (sudo)…"
sudo bash "$HELPER"

echo ""
echo -e "${GREEN}✓ Done.${NC} Log out to see Shader Wallpaper on the sign-in screen."
echo "  Pick a shader: System Settings → Login Screen → ⋮ → Configure Appearance…"
if [ -d "$HOME/.local/share/plasma/wallpapers/$PLUGIN_ID" ]; then
    echo ""
    warn "Your ~/.local install still powers the desktop and lock screen (this is normal)."
    echo "  Imported a new shader and want it on the sign-in screen too?"
    echo "    bash $0 --sync"
fi
