#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-or-later
#
# Register Shader Wallpaper with the Plasma Login Manager greeter.
# Writes [Greeter] WallpaperPluginId to /etc/plasmalogin.conf.
# Per ArchWiki: https://wiki.archlinux.org/title/Plasma_Login_Manager#Custom_wallpaper_plugins
#
# Run as root (pkexec or sudo). Invoked by the wallpaper settings UI.

set -euo pipefail

PLUGIN_ID="online.knowmad.shaderwallpaper"
CONF="/etc/plasmalogin.conf"

if [ "$(id -u)" -ne 0 ]; then
    echo "This helper must run as root (use pkexec or sudo)." >&2
    exit 1
fi

mkdir -p "$(dirname "$CONF")"
touch "$CONF"
chmod 0644 "$CONF"

if grep -q '^\[Greeter\]' "$CONF"; then
    if grep -q '^WallpaperPluginId=' "$CONF"; then
        sed -i "s|^WallpaperPluginId=.*|WallpaperPluginId=${PLUGIN_ID}|" "$CONF"
    else
        sed -i "/^\[Greeter\]/a WallpaperPluginId=${PLUGIN_ID}" "$CONF"
    fi
else
    {
        [ -s "$CONF" ] && echo ""
        echo "[Greeter]"
        echo "WallpaperPluginId=${PLUGIN_ID}"
    } >> "$CONF"
fi

if ! grep -qF "WallpaperPluginId=${PLUGIN_ID}" "$CONF"; then
    echo "Failed to write WallpaperPluginId to ${CONF}" >&2
    exit 1
fi

echo "Wrote WallpaperPluginId=${PLUGIN_ID} to ${CONF}."
