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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ID="online.knowmad.shaderwallpaper"
CONF="/etc/plasmalogin.conf"
USER_PKG="$HOME/.local/share/plasma/wallpapers/$PLUGIN_ID/contents/ui"
SYSTEM_PKG="/usr/share/plasma/wallpapers/$PLUGIN_ID/contents/ui"
REPO_URL="https://github.com/y4my4my4m/kde-shader-wallpaper.git"
CACHE_REPO="$HOME/.cache/shader-wallpaper-build/kde-shader-wallpaper"

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

resolve_repo_root() {
    local dev_root
    dev_root="$(cd "$SCRIPT_DIR/../../.." 2>/dev/null && pwd || true)"
    if [ -n "$dev_root" ] && [ -f "$dev_root/scripts/build.sh" ] && [ -d "$dev_root/.git" ]; then
        echo "$dev_root"; return
    fi
    if [ ! -d "$CACHE_REPO/.git" ]; then
        say "Downloading source (one-off, into $CACHE_REPO)…"
        mkdir -p "$(dirname "$CACHE_REPO")"
        git clone --depth 1 "$REPO_URL" "$CACHE_REPO"
    fi
    echo "$CACHE_REPO"
}

uninstall() {
    say "Removing PLM registration…"
    [ "$(id -u)" -eq 0 ] || exec sudo "$0" --uninstall
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

REPO_ROOT="$(resolve_repo_root)"
say "Building and installing system-wide (you'll be prompted for sudo)…"
"$REPO_ROOT/scripts/build.sh" system

sync_user_shaders

HELPER="/usr/libexec/shaderwallpaper/enable-plm-greeter"
[ -x "$HELPER" ] || HELPER="$REPO_ROOT/scripts/enable-plm-greeter.sh"

say "Registering plugin in /etc/plasmalogin.conf (sudo)…"
sudo "$HELPER"

echo ""
echo -e "${GREEN}✓ Done.${NC} Log out to see Shader Wallpaper on the sign-in screen."
echo "  Pick a shader: System Settings → Login Screen → ⋮ → Configure Appearance…"
if [ -d "$HOME/.local/share/plasma/wallpapers/$PLUGIN_ID" ]; then
    echo ""
    warn "Your ~/.local install still powers the desktop and lock screen (this is normal)."
    echo "  Imported a new shader and want it on the sign-in screen too?"
    echo "    bash $0 --sync"
fi
