#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Install Shader Wallpaper for the Plasma Login Manager (PLM) greeter.
#
# PLM runs as the system "plasmalogin" user before anyone logs in, so the
# plugin must be installed under /usr — a ~/.local install is invisible to
# the login screen. PLM's System Settings module omits third-party plugins
# from its wallpaper-type dropdown; register the plugin with a minimal
# conf.d drop-in (ArchWiki), then configure shaders in System Settings.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ID="online.knowmad.shaderwallpaper"
CONF_DIR="/etc/plasmalogin.conf.d"
CONF_FILE="${CONF_DIR}/${PLUGIN_ID}.conf"
MAIN_CONF="/etc/plasmalogin.conf"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() { echo -e "${GREEN}➤${NC} $1"; }
print_err()  { echo -e "${RED}✗${NC} $1"; }

usage() {
    cat <<EOF
Usage: $(basename "$0") [options]

Install Shader Wallpaper for the Plasma Login Manager (PLM) greeter.

PLM requires a system-wide plugin install (/usr). A normal ~/.local install
works for desktop and lock screen, but not for the pre-login greeter.

Options:
  --config-only   Only write ${CONF_FILE} (skip build/install)
  --no-config     System-install the plugin but do not write PLM config
  --uninstall     Remove the PLM drop-in config (does not uninstall /usr plugin)
  -h, --help      Show this help

Examples:
  $(basename "$0")                  # build, sudo install to /usr, register plugin
  $(basename "$0") --config-only    # register after: ./scripts/build.sh system
  sudo $(basename "$0") --uninstall # remove greeter registration only
EOF
}

check_plm() {
    if command -v plasmalogin >/dev/null 2>&1; then
        return 0
    fi
    if systemctl list-unit-files plasmalogin.service &>/dev/null \
        && systemctl list-unit-files plasmalogin.service | grep -q plasmalogin.service; then
        return 0
    fi
    print_err "Plasma Login Manager does not appear to be installed."
    echo ""
    echo "  Arch/Manjaro:  sudo pacman -S plasma-login-manager"
    echo "  Then enable:   sudo systemctl enable --now plasmalogin"
    echo "                 sudo systemctl disable sddm   # if migrating from SDDM"
    exit 1
}

system_install_plugin() {
    print_step "Building and installing plugin to /usr (requires sudo)..."
    "${SCRIPT_DIR}/build.sh" system
}

# System Settings Apply can create /etc/plasmalogin.conf mode 0600; the greeter
# user cannot read that and falls back to org.kde.image.
ensure_main_conf_readable() {
    if [ ! -f "$MAIN_CONF" ]; then
        return 0
    fi
    local perms
    perms=$(stat -c '%a' "$MAIN_CONF")
    if [ "$perms" = "644" ] || [ "$perms" = "664" ]; then
        return 0
    fi
    print_step "Fixing ${MAIN_CONF} permissions (${perms} → 0644)…"
    cp -a "$MAIN_CONF" "${MAIN_CONF}.bak.$(date +%Y%m%d%H%M%S)"
    chmod 0644 "$MAIN_CONF"
}

# System Settings → Configure Appearance writes plugin options under nested
# [Greeter][Wallpaper][…][General] in the main file. Registration belongs in
# conf.d only; strip those blocks so the main file stays minimal.
trim_main_conf_wallpaper_blocks() {
    if [ ! -f "$MAIN_CONF" ]; then
        return 0
    fi
    if ! grep -q '^\[Greeter\]\[Wallpaper\]' "$MAIN_CONF"; then
        return 0
    fi
    print_step "Trimming nested wallpaper blocks from ${MAIN_CONF}…"
    cp -a "$MAIN_CONF" "${MAIN_CONF}.bak.$(date +%Y%m%d%H%M%S)"
    awk '
        /^\[Greeter\]\[Wallpaper\]/ { skip = 1; next }
        /^\[/ { skip = 0 }
        !skip { print }
    ' "$MAIN_CONF" > "${MAIN_CONF}.tmp"
    mv "${MAIN_CONF}.tmp" "$MAIN_CONF"
    chmod 0644 "$MAIN_CONF"
}

write_plm_config() {
    if [ "$(id -u)" -ne 0 ]; then
        exec sudo "$0" --config-only
    fi

    print_step "Writing PLM drop-in (${CONF_FILE})…"
    ensure_main_conf_readable
    trim_main_conf_wallpaper_blocks

    mkdir -p "$CONF_DIR"
    tee "$CONF_FILE" >/dev/null <<EOF
# Shader Wallpaper — PLM greeter plugin registration.
# Managed by scripts/install-plm-greeter.sh (safe to delete to revert).
# Configure shaders via System Settings → Login Screen → Configure Appearance…
[Greeter]
WallpaperPluginId=${PLUGIN_ID}
EOF
    chmod 0644 "$CONF_FILE"
}

remove_plm_config() {
    if [ -f "$CONF_FILE" ]; then
        print_step "Removing ${CONF_FILE}…"
        sudo rm -f "$CONF_FILE"
        echo -e "${GREEN}✓${NC} PLM greeter config removed."
    else
        print_step "No drop-in at ${CONF_FILE} — nothing to remove."
    fi
}

print_next_steps() {
    echo ""
    echo -e "${GREEN}✓${NC} PLM greeter setup complete."
    echo ""
    echo "Registered plugin in:"
    echo "  ${CONF_FILE}"
    echo ""
    echo "Next steps:"
    echo "  1. Log out — you should see Shader Wallpaper (plugin defaults)."
    echo "  2. System Settings → Login Screen → ⋮ → Configure Appearance…"
    echo "     Pick a shader, ← Back, Apply (admin password), log out again."
    echo ""
    echo "Notes:"
    echo "  • Do not change “Wallpaper type” on the main Login Screen page — that"
    echo "    dropdown only lists built-in KDE plugins."
    echo "  • Greeter mode disables mouse/audio/window features (FPS follows your setting)."
    echo "  • If greeter still shows a static image: sudo chmod 0644 /etc/plasmalogin.conf"
    echo ""
    echo "Troubleshooting:"
    echo "  cat ${CONF_FILE}"
    echo "  journalctl _UID=\$(id -u plasmalogin 2>/dev/null || echo 945) -b | rg -i 'shader|wallpaper|${PLUGIN_ID}'"
}

# ── main ────────────────────────────────────────────────────────────────────

DO_INSTALL=true
DO_CONFIG=true
DO_UNINSTALL=false

while [ $# -gt 0 ]; do
    case "$1" in
        --config-only) DO_INSTALL=false ;;
        --no-config)   DO_CONFIG=false ;;
        --uninstall)   DO_UNINSTALL=true; DO_INSTALL=false; DO_CONFIG=false ;;
        -h|--help)     usage; exit 0 ;;
        *)             print_err "Unknown option: $1"; usage; exit 1 ;;
    esac
    shift
done

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     Shader Wallpaper — PLM Login Screen Setup             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

if $DO_UNINSTALL; then
    remove_plm_config
    exit 0
fi

check_plm

if $DO_INSTALL; then
    system_install_plugin
fi

if $DO_CONFIG; then
    write_plm_config
fi

print_next_steps
