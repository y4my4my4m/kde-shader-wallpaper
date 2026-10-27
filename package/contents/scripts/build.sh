#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>
#
# Shader Wallpaper engine installer.
#
# The wallpaper renders through a native QML module (contents/ui/shaderwallpaper/
# inside the wallpaper package). The KDE Store ships only the package, so the
# module is compiled here, on the user's machine, into the package that Plasma
# loads.
#
# Source tree, first match:
#   --source DIR
#   <package>/contents/source     bundled by scripts/package-kde-store.sh
#   <package>/..                  git checkout (package/ inside the repository)
#   GitHub tag v<Version>         downloaded after confirmation
#
# Run `build.sh help` for commands and options.

set -uo pipefail

PLUGIN_ID="online.knowmad.shaderwallpaper"
REPO_URL="https://github.com/y4my4my4m/kde-shader-wallpaper"
MODULE_SO="libshaderwallpaperplugin.so"

SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"

DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
STATE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/shaderwallpaper/engine"
USER_PKG="$DATA_HOME/plasma/wallpapers/$PLUGIN_ID"
LOG="$STATE_DIR/build.log"

BUILD_TYPE="${BUILD_TYPE:-Release}"
INSTALL_PREFIX="${INSTALL_PREFIX:-$HOME/.local}"
JOBS="${JOBS:-$(nproc 2>/dev/null || echo 2)}"

COMMAND=""
PKG_DIR=""
SRC_DIR=""
SRC_KIND="none"
BUILD_DIR="${BUILD_DIR:-}"
ASSUME_YES=0
BUILD_STARTED=0
PORCELAIN=0
TERMINAL=0
PAUSE=0
REMOVE_PACKAGE=1

if [ -t 1 ]; then
    C_RED=$'\033[0;31m'; C_GREEN=$'\033[0;32m'; C_YELLOW=$'\033[1;33m'
    C_BLUE=$'\033[0;34m'; C_BOLD=$'\033[1m'; C_OFF=$'\033[0m'
else
    C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_BOLD=""; C_OFF=""
fi

say()  { printf '%s➤%s %s\n' "$C_GREEN" "$C_OFF" "$*"; }
ok()   { printf '%s✓%s %s\n' "$C_GREEN" "$C_OFF" "$*"; }
warn() { printf '%s⚠%s %s\n' "$C_YELLOW" "$C_OFF" "$*" >&2; }
err()  { printf '%s✗%s %s\n' "$C_RED" "$C_OFF" "$*" >&2; }

usage() {
    cat <<EOF
Usage: build.sh [command] [options]

Commands:
  install          Build the engine and install it for this user (default)
  build            Build the engine into the package without installing
  system           Build and install system-wide to /usr (sudo); needed for
                   the Plasma Login Manager sign-in screen
  uninstall        Remove the wallpaper and its engine for this user
  clean            Remove the build directory
  status           Show whether the engine is installed
  deps             Show the build dependencies for this distribution
  restart-plasma   Restart the Plasma desktop shell
  help             Show this help

Options:
  --package DIR    Wallpaper package root (default: the package holding this script)
  --source DIR     Source tree (default: bundled, git checkout, or GitHub tag)
  --build-dir DIR  CMake build directory (default: $STATE_DIR/build)
  --keep-package   uninstall: keep the wallpaper package, remove only the engine
  --yes            Answer yes to every question
  --porcelain      status, deps: machine-readable key=value output
  --terminal       Run in a new terminal window

Environment:
  BUILD_TYPE (Release), INSTALL_PREFIX (~/.local), JOBS (nproc)
EOF
}

parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --package)      PKG_DIR="${2:?--package needs a directory}"; shift ;;
            --package=*)    PKG_DIR="${1#*=}" ;;
            --source)       SRC_DIR="${2:?--source needs a directory}"; shift ;;
            --source=*)     SRC_DIR="${1#*=}" ;;
            --build-dir)    BUILD_DIR="${2:?--build-dir needs a directory}"; shift ;;
            --build-dir=*)  BUILD_DIR="${1#*=}" ;;
            --keep-package) REMOVE_PACKAGE=0 ;;
            -y|--yes)       ASSUME_YES=1 ;;
            --porcelain)    PORCELAIN=1 ;;
            --terminal)     TERMINAL=1 ;;
            --pause)        PAUSE=1 ;;
            -h|--help)      COMMAND="help" ;;
            -*)             err "Unknown option: $1"; usage >&2; exit 2 ;;
            *)
                if [ -z "$COMMAND" ]; then COMMAND="$1"
                else err "Unexpected argument: $1"; exit 2; fi ;;
        esac
        shift
    done
    COMMAND="${COMMAND:-install}"
    [ -n "$PKG_DIR" ] || PKG_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
    PKG_DIR="$(readlink -f "$PKG_DIR")"
    BUILD_DIR="${BUILD_DIR:-$STATE_DIR/build}"
}

confirm() {
    local reply
    [ "$ASSUME_YES" -eq 1 ] && return 0
    [ -t 0 ] || return 1
    read -r -p "$1 [Y/n] " reply || return 1
    case "$reply" in ""|[Yy]*) return 0 ;; *) return 1 ;; esac
}

confirm_no() {
    local reply
    [ "$ASSUME_YES" -eq 1 ] && return 0
    [ -t 0 ] || return 1
    read -r -p "$1 [y/N] " reply || return 1
    case "$reply" in [Yy]*) return 0 ;; *) return 1 ;; esac
}

as_root() {
    if [ "$(id -u)" -eq 0 ]; then "$@"
    elif command -v sudo >/dev/null 2>&1; then sudo "$@"
    else err "sudo is not installed; run as root: $*"; return 1
    fi
}

same_path() {
    [ -e "$1" ] && [ -e "$2" ] && [ "$(readlink -f "$1")" = "$(readlink -f "$2")" ]
}

package_version() {
    sed -n 's/.*"Version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$PKG_DIR/metadata.json" 2>/dev/null | head -n1
}

module_dir() { printf '%s/contents/ui/shaderwallpaper' "$PKG_DIR"; }

module_complete() {
    [ -f "$(module_dir)/qmldir" ] && [ -f "$(module_dir)/$MODULE_SO" ]
}

run_logged() {
    "$@" 2>&1 | tee -a "$LOG"
    return "${PIPESTATUS[0]}"
}

# ─── distribution and dependencies ──────────────────────────────────────────

os_release_value() {
    local f
    for f in /etc/os-release /usr/lib/os-release; do
        if [ -r "$f" ]; then
            sed -n "s/^$1=//p" "$f" | head -n1 | tr -d '"'"'"
            return
        fi
    done
}

detect_family() {
    local word
    for word in $(os_release_value ID) $(os_release_value ID_LIKE); do
        case "$word" in
            arch|archarm|manjaro*|endeavouros|cachyos|garuda|artix) echo arch; return ;;
            fedora|nobara|ultramarine|rhel|centos|rocky|almalinux) echo fedora; return ;;
            opensuse*|suse|sles|sled) echo opensuse; return ;;
            debian|ubuntu|neon|kubuntu|linuxmint|pop|elementary|zorin|tuxedo) echo debian; return ;;
        esac
    done
    echo unknown
}

# Package lists. RPM distributions resolve CMake and pkg-config names, which
# match the find_package()/pkg_check_modules() calls in CMakeLists.txt exactly.
# KF6CoreAddons is a find_dependency of KF6Package that Fedora's
# kf6-kpackage-devel does not require.
# Debian entries list alternatives (a|b); the first one apt knows is used.
PKGS_ARCH=(base-devel cmake extra-cmake-modules qt6-base qt6-declarative kconfig ki18n
           kpackage libplasma libpipewire libxcb plasma-workspace)
PKGS_RPM_LIBS=('cmake(Qt6Quick)' 'cmake(Qt6OpenGL)' 'cmake(KF6Config)' 'cmake(KF6I18n)'
               'cmake(KF6Package)' 'cmake(KF6CoreAddons)' 'cmake(Plasma)' 'cmake(PlasmaQuick)'
               'pkgconfig(libpipewire-0.3)' 'pkgconfig(xcb)' 'cmake(LibTaskManager)')
PKGS_FEDORA=(gcc-c++ make cmake extra-cmake-modules "${PKGS_RPM_LIBS[@]}")
PKGS_OPENSUSE=(gcc-c++ make cmake kf6-extra-cmake-modules "${PKGS_RPM_LIBS[@]}")
PKGS_DEBIAN=(build-essential cmake "extra-cmake-modules|kf6-extra-cmake-modules" "pkg-config|pkgconf"
             qt6-base-dev qt6-declarative-dev
             "libkf6config-dev|kf6-kconfig-dev" "libkf6i18n-dev|kf6-ki18n-dev"
             "libkf6package-dev|kf6-kpackage-dev" "libkf6coreaddons-dev|kf6-kcoreaddons-dev"
             "libkf6windowsystem-dev|kf6-kwindowsystem-dev"
             "libkirigami-dev|kf6-kirigami-dev" libplasma-dev
             libpipewire-0.3-dev libxcb1-dev plasma-workspace-dev)

# Prints one package name per line.
family_packages() {
    local entry alt resolve=0
    local -a alts=()
    case "$1" in
        arch)     printf '%s\n' "${PKGS_ARCH[@]}" ;;
        fedora)   printf '%s\n' "${PKGS_FEDORA[@]}" ;;
        opensuse) printf '%s\n' "${PKGS_OPENSUSE[@]}" ;;
        debian)
            [ "$(detect_family)" = debian ] && command -v apt-cache >/dev/null 2>&1 && resolve=1
            for entry in "${PKGS_DEBIAN[@]}"; do
                if [ "$resolve" -eq 0 ]; then
                    echo "${entry%%|*}"
                    continue
                fi
                IFS='|' read -r -a alts <<<"$entry"
                for alt in "${alts[@]}"; do
                    if apt-cache show "$alt" >/dev/null 2>&1; then echo "$alt"; break; fi
                done
            done ;;
    esac
}

family_installer() {
    case "$1" in
        arch)     echo "pacman -S --needed" ;;
        fedora)   echo "dnf install" ;;
        opensuse) echo "zypper install" ;;
        debian)   echo "apt install" ;;
    esac
}

# One-line shell command; names with parentheses are single-quoted.
family_command() {
    local line pkg
    line="sudo $(family_installer "$1")"
    while IFS= read -r pkg; do
        case "$pkg" in *[\(\)]*) line+=" '$pkg'" ;; *) line+=" $pkg" ;; esac
    done < <(family_packages "$1")
    echo "$line"
}

cmake_search_dirs() {
    local prefix
    local -a prefixes=()
    IFS=':' read -r -a prefixes <<<"${CMAKE_PREFIX_PATH:-}"
    for prefix in "${prefixes[@]}" /usr/local /usr; do
        [ -n "$prefix" ] || continue
        printf '%s\n' "$prefix"/lib/cmake "$prefix"/lib64/cmake "$prefix"/lib/*-linux-gnu*/cmake \
                      "$prefix"/share/cmake "$prefix"/share/ECM/cmake
    done
}

have_cmake_package() {
    local name="$1" lower dir
    lower="$(tr '[:upper:]' '[:lower:]' <<<"$name")"
    while IFS= read -r dir; do
        if [ -f "$dir/$name/${name}Config.cmake" ] || [ -f "$dir/$name/$lower-config.cmake" ] \
           || [ -f "$dir/${name}Config.cmake" ]; then
            return 0
        fi
    done < <(cmake_search_dirs)
    return 1
}

have_command() {
    local c
    for c in "$@"; do command -v "$c" >/dev/null 2>&1 && return 0; done
    return 1
}

have_pkgconfig() {
    have_command pkg-config && pkg-config --exists "$1" 2>/dev/null
}

# id|label|kind|names. Kind cmd: any name; cmake and pc: every name.
REQUIRED_DEPS=(
    "cmake|CMake|cmd|cmake"
    "compiler|C++ compiler|cmd|c++ g++ clang++"
    "make|make or Ninja|cmd|make ninja"
    "pkgconfig|pkg-config|cmd|pkg-config pkgconf"
    "ecm|Extra CMake Modules|cmake|ECM"
    "qt|Qt 6 development files|cmake|Qt6Quick Qt6OpenGL"
    "kf6|KDE Frameworks 6 development files|cmake|KF6Config KF6I18n KF6Package KF6CoreAddons"
    "plasma|Plasma 6 development files|cmake|Plasma PlasmaQuick"
)
OPTIONAL_DEPS=(
    "pipewire|PipeWire (sound-reactive shaders)|pc|libpipewire-0.3"
    "xcb|XCB (mouse and windows on X11)|pc|xcb"
    "taskmanager|Plasma task manager library (windows on Wayland)|cmake|LibTaskManager"
)

dep_present() {
    local kind="$1" names="$2" name
    case "$kind" in
        cmd)   have_command $names ;;
        cmake) for name in $names; do have_cmake_package "$name" || return 1; done ;;
        pc)    for name in $names; do have_pkgconfig "$name" || return 1; done ;;
    esac
}

MISSING_IDS=(); MISSING_LABELS=(); OPTIONAL_IDS=(); OPTIONAL_LABELS=()
check_deps() {
    local entry id label kind names
    MISSING_IDS=(); MISSING_LABELS=(); OPTIONAL_IDS=(); OPTIONAL_LABELS=()
    for entry in "${REQUIRED_DEPS[@]}"; do
        IFS='|' read -r id label kind names <<<"$entry"
        dep_present "$kind" "$names" || { MISSING_IDS+=("$id"); MISSING_LABELS+=("$label"); }
    done
    for entry in "${OPTIONAL_DEPS[@]}"; do
        IFS='|' read -r id label kind names <<<"$entry"
        dep_present "$kind" "$names" || { OPTIONAL_IDS+=("$id"); OPTIONAL_LABELS+=("$label"); }
    done
}

join_by() { local IFS="$1"; shift; echo "$*"; }

cmd_deps() {
    local family f
    family="$(detect_family)"
    check_deps
    if [ "$PORCELAIN" -eq 1 ]; then
        echo "detected=$family"
        echo "os=$(os_release_value PRETTY_NAME)"
        echo "missing=$(join_by , "${MISSING_IDS[@]}")"
        echo "optional_missing=$(join_by , "${OPTIONAL_IDS[@]}")"
        for f in arch fedora opensuse debian; do echo "cmd.$f=$(family_command "$f")"; done
        return 0
    fi
    echo "${C_BOLD}Distribution:${C_OFF} $(os_release_value PRETTY_NAME) ($family)"
    if [ ${#MISSING_IDS[@]} -eq 0 ]; then
        ok "Everything needed to build the engine is installed."
    else
        err "Missing: $(join_by , "${MISSING_LABELS[@]}" | sed 's/,/, /g')"
    fi
    [ ${#OPTIONAL_IDS[@]} -eq 0 ] || warn "Optional, not found: $(join_by , "${OPTIONAL_LABELS[@]}" | sed 's/,/, /g')"
    echo ""
    if [ "$family" = unknown ]; then
        echo "Install the equivalent of one of these:"
        for f in arch fedora opensuse debian; do echo "  $f: $(family_command "$f")"; done
    else
        echo "Install command:"
        echo "  $(family_command "$family")"
    fi
}

install_packages() {
    local family="$1"
    local -a pkgs=() cmd=()
    mapfile -t pkgs < <(family_packages "$family")
    read -r -a cmd <<<"$(family_installer "$family")"
    if [ "$ASSUME_YES" -eq 1 ]; then
        case "$family" in
            arch)     cmd+=(--noconfirm) ;;
            fedora)   cmd+=(-y) ;;
            opensuse) cmd=(zypper --non-interactive install) ;;
            debian)   cmd+=(-y) ;;
        esac
    fi
    as_root "${cmd[@]}" "${pkgs[@]}"
}

ensure_deps() {
    local family
    say "Checking build dependencies…"
    check_deps
    family="$(detect_family)"
    if [ ${#MISSING_IDS[@]} -eq 0 ]; then
        ok "Build dependencies found."
        if [ ${#OPTIONAL_IDS[@]} -gt 0 ]; then
            warn "Optional features unavailable: $(join_by , "${OPTIONAL_LABELS[@]}" | sed 's/,/, /g')"
            if [ "$family" != unknown ]; then
                echo "  Enable them with: $(family_command "$family")"
                if confirm_no "Install them now?"; then
                    install_packages "$family" || warn "Package installation failed; building without them."
                fi
            fi
        fi
        return 0
    fi

    err "Missing: $(join_by , "${MISSING_LABELS[@]}" | sed 's/,/, /g')"
    if [ "$family" = unknown ]; then
        echo ""
        echo "This distribution is not recognised. Install the equivalent of:"
        local f
        for f in arch fedora opensuse debian; do echo "  $f: $(family_command "$f")"; done
        return 1
    fi
    echo ""
    echo "Install them with:"
    echo "  ${C_BOLD}$(family_command "$family")${C_OFF}"
    echo ""
    confirm "Run this command now?" || return 1
    install_packages "$family" || { err "Package installation failed."; return 1; }
    check_deps
    if [ ${#MISSING_IDS[@]} -gt 0 ]; then
        err "Still missing after installation: $(join_by , "${MISSING_LABELS[@]}" | sed 's/,/, /g')"
        return 1
    fi
    ok "Build dependencies installed."
}

# ─── source tree ────────────────────────────────────────────────────────────

is_source_tree() {
    [ -f "$1/CMakeLists.txt" ] && [ -f "$1/src/CMakeLists.txt" ]
}

download_source() {
    local version="$1" dest tmp url
    dest="$STATE_DIR/source-$version"
    if is_source_tree "$dest"; then SRC_DIR="$dest"; return 0; fi
    url="$REPO_URL/archive/refs/tags/v$version.tar.gz"
    warn "This package does not include the engine sources."
    confirm "Download Shader Wallpaper $version sources from $url?" || return 1
    tmp="$(mktemp -d)" || return 1
    if have_command curl; then
        curl -fL --retry 2 -o "$tmp/source.tar.gz" "$url" || { rm -rf "$tmp"; return 1; }
    elif have_command wget; then
        wget -O "$tmp/source.tar.gz" "$url" || { rm -rf "$tmp"; return 1; }
    else
        err "Neither curl nor wget is installed."; rm -rf "$tmp"; return 1
    fi
    tar -xzf "$tmp/source.tar.gz" -C "$tmp" || { rm -rf "$tmp"; return 1; }
    if ! is_source_tree "$tmp/kde-shader-wallpaper-$version"; then
        err "The downloaded archive has no CMake project."; rm -rf "$tmp"; return 1
    fi
    mkdir -p "$STATE_DIR"
    rm -rf "$dest"
    mv "$tmp/kde-shader-wallpaper-$version" "$dest"
    rm -rf "$tmp"
    SRC_DIR="$dest"
}

# Sets SRC_DIR and SRC_KIND without side effects.
locate_source() {
    if [ -n "$SRC_DIR" ]; then
        SRC_DIR="$(readlink -f "$SRC_DIR")"; SRC_KIND="given"
    elif is_source_tree "$PKG_DIR/contents/source"; then
        SRC_DIR="$PKG_DIR/contents/source"; SRC_KIND="bundled"
    elif is_source_tree "$(dirname "$PKG_DIR")" && [ -f "$(dirname "$PKG_DIR")/package/metadata.json" ]; then
        SRC_DIR="$(dirname "$PKG_DIR")"; SRC_KIND="checkout"
    else
        SRC_DIR=""; SRC_KIND="none"
    fi
}

resolve_source() {
    locate_source
    if [ "$SRC_KIND" = none ]; then
        local version
        version="$(package_version)"
        [ -n "$version" ] || { err "No Version in $PKG_DIR/metadata.json."; return 1; }
        download_source "$version" || { err "No source tree available."; return 1; }
        SRC_DIR="$(readlink -f "$SRC_DIR")"
        SRC_KIND="download"
    fi
    is_source_tree "$SRC_DIR" || { err "$SRC_DIR is not a Shader Wallpaper source tree."; return 1; }
}

# ─── build ──────────────────────────────────────────────────────────────────

check_package() {
    if [ ! -f "$PKG_DIR/metadata.json" ] || [ ! -d "$PKG_DIR/contents/ui" ]; then
        err "$PKG_DIR is not a Shader Wallpaper package."
        return 1
    fi
}

cache_value() {
    sed -n "s/^$1:[A-Z]*=//p" "$BUILD_DIR/CMakeCache.txt" 2>/dev/null | head -n1
}

# A cache from another prefix, source tree or package cannot be reused: ECM
# bakes Qt's install paths into cmake_install.cmake on first configure.
reset_stale_cache() {
    local prefix="$1" value
    [ -f "$BUILD_DIR/CMakeCache.txt" ] || return 0
    local stale=0
    [ "$(cache_value CMAKE_INSTALL_PREFIX)" = "$prefix" ] || stale=1
    [ "$(readlink -f "$(cache_value CMAKE_HOME_DIRECTORY)")" = "$SRC_DIR" ] || stale=1
    value="$(cache_value SHADERWALLPAPER_PACKAGE_DIR)"
    [ -z "$value" ] || [ "$(readlink -f "$value")" = "$PKG_DIR" ] || stale=1
    if [ "$stale" -eq 1 ]; then
        warn "Build directory was configured for another prefix, source tree or package; reconfiguring."
        rm -rf "$BUILD_DIR/CMakeCache.txt" "$BUILD_DIR/CMakeFiles"
    fi
}

configure_and_build() {
    local prefix="$1"
    mkdir -p "$BUILD_DIR"
    reset_stale_cache "$prefix"
    say "Configuring (source: $SRC_DIR)…"
    if ! run_logged cmake -S "$SRC_DIR" -B "$BUILD_DIR" \
            -DCMAKE_BUILD_TYPE="$BUILD_TYPE" \
            -DCMAKE_INSTALL_PREFIX="$prefix" \
            -DSHADERWALLPAPER_PACKAGE_DIR="$PKG_DIR"; then
        err "CMake configuration failed."
        local missing
        missing="$(grep -o 'provided by "[^"]*"' "$LOG" 2>/dev/null | sed 's/provided by //' | sort -u | tr '\n' ' ')"
        [ -z "$missing" ] || echo "  Not found: $missing"
        local family
        family="$(detect_family)"
        [ "$family" = unknown ] || echo "  Dependencies: $(family_command "$family")"
        return 1
    fi
    say "Compiling with $JOBS jobs…"
    if ! run_logged cmake --build "$BUILD_DIR" --parallel "$JOBS"; then
        err "Compilation failed. Full log: $LOG"
        return 1
    fi
    if ! module_complete; then
        err "The build finished but $(module_dir)/$MODULE_SO is missing."
        return 1
    fi
    ok "Engine built: $(module_dir)"
}

check_root_owned() {
    local found
    found="$(find "$INSTALL_PREFIX/lib" "$INSTALL_PREFIX/lib64" "$INSTALL_PREFIX/share/plasma" \
             -user root 2>/dev/null | head -n 20)"
    [ -z "$found" ] && return 0
    warn "Root-owned files in $INSTALL_PREFIX block a user install (left by an earlier sudo install):"
    sed 's/^/    /' <<<"$found" >&2
    echo "  Reclaim them with: sudo chown -R $(id -un): $INSTALL_PREFIX/lib $INSTALL_PREFIX/share/plasma" >&2
    return 1
}

# Lock, pid and result files let the settings page follow a build that runs
# in a terminal window.
begin_build() {
    mkdir -p "$STATE_DIR"
    if have_command flock; then
        exec 9>"$STATE_DIR/lock"
        if ! flock -w 3 9; then
            err "Another engine build is running (PID $(cat "$STATE_DIR/pid" 2>/dev/null))."
            return 1
        fi
    fi
    echo "$$" >"$STATE_DIR/pid"
    echo "running" >"$STATE_DIR/result"
    : >"$LOG"
    BUILD_STARTED=1
    trap 'record_result $?' EXIT
    # A closed terminal window sends SIGHUP; exiting through the EXIT trap
    # records the failure.
    trap 'exit 129' HUP
    trap 'exit 130' INT
    trap 'exit 143' TERM
}

# Runs before the closing pause, so the settings page sees the result while
# the terminal window is still open.
record_result() {
    [ "$BUILD_STARTED" -eq 1 ] || return 0
    if [ "$1" -eq 0 ]; then echo "success" >"$STATE_DIR/result"
    else echo "failed" >"$STATE_DIR/result"; fi
    rm -f "$STATE_DIR/pid"
    BUILD_STARTED=0
}

pause_if_requested() {
    [ "$PAUSE" -eq 1 ] && [ -t 0 ] || return 0
    echo ""
    read -r -p "Press Enter to close this window." _ || true
}

print_banner() {
    echo "${C_BLUE}${C_BOLD}Shader Wallpaper $(package_version) — engine installer${C_OFF}"
    echo "  Package: $PKG_DIR"
    echo ""
}

offer_restart() {
    echo ""
    echo "Plasma loads the engine at startup. Restart Plasma, or log out and back in."
    if confirm_no "Restart Plasma now?"; then
        cmd_restart_plasma
    else
        echo "  Later: bash $SCRIPT_PATH restart-plasma"
    fi
}

cmd_build() {
    print_banner
    check_package || return 1
    resolve_source || return 1
    begin_build || return 1
    ensure_deps || return 1
    configure_and_build "$INSTALL_PREFIX"
}

cmd_install() {
    print_banner
    check_package || return 1
    if [ ! -w "$PKG_DIR/contents/ui" ]; then
        err "$PKG_DIR is not writable."
        echo "  A system-wide copy comes from a distribution package, which includes the engine."
        echo "  Install the wallpaper for this user from the KDE Store, or run: bash $SCRIPT_PATH system"
        return 1
    fi
    resolve_source || return 1
    begin_build || return 1
    ensure_deps || return 1
    configure_and_build "$INSTALL_PREFIX" || return 1

    if same_path "$PKG_DIR" "$USER_PKG"; then
        ok "Installed for $(id -un): $USER_PKG"
    else
        # The package lives outside Plasma's search path (a git checkout):
        # install it and the engine into the user prefix.
        check_root_owned || return 1
        say "Installing to $INSTALL_PREFIX…"
        run_logged cmake --install "$BUILD_DIR" || { err "Installation failed."; return 1; }
        ok "Installed to $INSTALL_PREFIX"
    fi
    offer_restart
}

cmd_system() {
    print_banner
    check_package || return 1
    if [ ! -w "$PKG_DIR/contents/ui" ]; then
        err "$PKG_DIR is not writable; run this from a copy in your home folder or a git checkout."
        return 1
    fi
    resolve_source || return 1
    begin_build || return 1
    ensure_deps || return 1
    configure_and_build /usr || return 1
    say "Installing to /usr (sudo)…"
    as_root cmake --install "$BUILD_DIR" 2>&1 | tee -a "$LOG"
    [ "${PIPESTATUS[0]}" -eq 0 ] || { err "System installation failed."; return 1; }
    [ ! -f "$BUILD_DIR/install_manifest.txt" ] || \
        as_root chown "$(id -u):$(id -g)" "$BUILD_DIR/install_manifest.txt" 2>/dev/null || true
    ok "Installed to /usr"
    if [ -e "$USER_PKG" ]; then
        warn "A copy in $USER_PKG takes precedence over /usr for this user."
        echo "  Remove it to use the system copy: bash $SCRIPT_PATH uninstall"
    fi
}

cmd_uninstall() {
    local -a targets=() found=()
    local dir
    if [ "$REMOVE_PACKAGE" -eq 1 ]; then
        [ -e "$USER_PKG" ] || [ -L "$USER_PKG" ] && targets+=("$USER_PKG")
    elif [ -d "$(module_dir)" ] && [ -w "$PKG_DIR/contents/ui" ]; then
        targets+=("$(module_dir)")
    fi
    for dir in "$INSTALL_PREFIX"/lib*/qml/online/knowmad/shaderwallpaper \
               "$INSTALL_PREFIX"/lib*/qt6/qml/online/knowmad/shaderwallpaper \
               "$INSTALL_PREFIX"/lib*/libexec/shaderwallpaper; do
        [ -e "$dir" ] && found+=("$dir")
    done
    targets+=("${found[@]}")
    [ -d "$STATE_DIR" ] && targets+=("$STATE_DIR")
    if [ ${#targets[@]} -eq 0 ]; then
        ok "Nothing to remove."
        return 0
    fi
    echo "Removing:"
    printf '  %s\n' "${targets[@]}"
    confirm "Continue?" || { echo "Cancelled."; return 1; }
    for dir in "${targets[@]}"; do
        # A symlinked package (development setup) loses only the link.
        if [ -L "$dir" ]; then rm -f "$dir"; else rm -rf "$dir"; fi
    done
    rmdir "$(dirname "$STATE_DIR")" 2>/dev/null || true
    ok "Removed."
    echo "  Favourites, imported shaders and presets stay in $DATA_HOME/shaderwallpaper."
    if [ "$REMOVE_PACKAGE" -eq 1 ] && [ -f "$DATA_HOME/knewstuff3/wallpaperplugin.knsregistry" ] \
       && grep -q "$PLUGIN_ID" "$DATA_HOME/knewstuff3/wallpaperplugin.knsregistry" 2>/dev/null; then
        echo "  Installed from the KDE Store: also press Uninstall in Get New Wallpaper Plugins."
    fi
    echo "  Restart Plasma to unload the engine."
}

cmd_clean() {
    if [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR"
        ok "Removed $BUILD_DIR"
    else
        ok "Nothing to clean."
    fi
}

# A live pid alone can be a recycled one; the build holds the lock.
build_running() {
    local pid
    pid="$(cat "$STATE_DIR/pid" 2>/dev/null)"
    [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null || return 1
    if have_command flock && [ -e "$STATE_DIR/lock" ]; then
        ! flock -n "$STATE_DIR/lock" true 2>/dev/null
    fi
}

engine_state() {
    local result
    if build_running; then echo building; return; fi
    if module_complete; then echo installed; return; fi
    result="$(cat "$STATE_DIR/result" 2>/dev/null)"
    case "$result" in
        failed|running) echo failed ;;
        *) echo missing ;;
    esac
}

find_terminal() {
    local t
    for t in konsole xdg-terminal-exec x-terminal-emulator gnome-terminal kgx alacritty \
             kitty foot wezterm xfce4-terminal xterm; do
        if command -v "$t" >/dev/null 2>&1; then echo "$t"; return 0; fi
    done
    return 1
}

cmd_status() {
    local state
    state="$(engine_state)"
    locate_source
    if [ "$PORCELAIN" -eq 1 ]; then
        echo "state=$state"
        echo "version=$(package_version)"
        echo "package=$PKG_DIR"
        echo "source=$SRC_KIND"
        echo "log=$LOG"
        echo "terminal=$(find_terminal || echo none)"
        return 0
    fi
    case "$state" in
        installed) ok "Engine installed in $(module_dir)" ;;
        building)  say "Engine build in progress (log: $LOG)" ;;
        failed)    err "The last engine build failed (log: $LOG)" ;;
        missing)   warn "Engine not installed. Run: bash $SCRIPT_PATH install" ;;
    esac
}

cmd_restart_plasma() {
    # Under systemd, plasmashell runs in plasma-plasmashell.service: a
    # replacement started from inside the unit's cgroup dies with the old
    # process, so the unit is restarted instead.
    if have_command systemctl && systemctl --user --quiet is-active plasma-plasmashell.service 2>/dev/null; then
        say "Restarting plasma-plasmashell.service…"
        systemctl --user --no-block restart plasma-plasmashell.service
    elif have_command plasmashell; then
        say "Replacing the running plasmashell…"
        setsid plasmashell --replace >/dev/null 2>&1 </dev/null &
        disown 2>/dev/null || true
    else
        err "plasmashell not found."
        return 1
    fi
}

relaunch_in_terminal() {
    local t
    local -a inner=(bash "$SCRIPT_PATH" "$COMMAND" --package "$PKG_DIR" --pause)
    [ -z "$SRC_DIR" ] || inner+=(--source "$SRC_DIR")
    [ "$BUILD_DIR" = "$STATE_DIR/build" ] || inner+=(--build-dir "$BUILD_DIR")
    [ "$ASSUME_YES" -eq 0 ] || inner+=(--yes)
    [ "$REMOVE_PACKAGE" -eq 1 ] || inner+=(--keep-package)
    t="$(find_terminal)" || { err "No terminal emulator found."; return 3; }
    local -a launch
    case "$t" in
        konsole)        launch=(konsole --hide-menubar -e "${inner[@]}") ;;
        xdg-terminal-exec) launch=(xdg-terminal-exec "${inner[@]}") ;;
        gnome-terminal|kgx) launch=("$t" -- "${inner[@]}") ;;
        kitty|foot)     launch=("$t" "${inner[@]}") ;;
        wezterm)        launch=(wezterm start -- "${inner[@]}") ;;
        xfce4-terminal) launch=(xfce4-terminal -x "${inner[@]}") ;;
        *)              launch=("$t" -e "${inner[@]}") ;;
    esac
    setsid "${launch[@]}" >/dev/null 2>&1 </dev/null &
    disown 2>/dev/null || true
    echo "terminal=$t"
}

main() {
    parse_args "$@"
    if [ "$TERMINAL" -eq 1 ]; then
        relaunch_in_terminal
        exit $?
    fi
    local code=0
    case "$COMMAND" in
        install)        cmd_install; code=$? ;;
        build)          cmd_build; code=$? ;;
        system)         cmd_system; code=$? ;;
        uninstall)      cmd_uninstall; code=$? ;;
        clean)          cmd_clean; code=$? ;;
        status)         cmd_status; code=$? ;;
        deps)           cmd_deps; code=$? ;;
        restart-plasma) cmd_restart_plasma; code=$? ;;
        help)           usage ;;
        *)              err "Unknown command: $COMMAND"; usage >&2; code=2 ;;
    esac
    record_result "$code"
    pause_if_requested
    exit "$code"
}

main "$@"
