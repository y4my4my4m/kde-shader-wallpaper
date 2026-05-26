#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
#
# Dev harness for kde-shader-wallpaper.
#
# Builds the C++ plugin, installs into a per-user sandbox prefix that is
# isolated from the real Plasma session, and runs scripts/dev/DevHarness.qml
# via Qt's `qml6` runtime. No plasmashell restart is needed.
#
# Usage:
#   scripts/dev.sh                Build (incremental) + install + launch
#   scripts/dev.sh --watch        Above, then rebuild & relaunch on src changes
#   scripts/dev.sh --no-build     Skip cmake/make, just relaunch
#   scripts/dev.sh --clean        Wipe build/ before building
#   scripts/dev.sh --reset        Wipe sandbox config (also runs build+launch)
#
# Sandbox layout:
#   $HOME/.cache/shaderwallpaper-dev/
#     prefix/  -> CMAKE_INSTALL_PREFIX (plugin + package live here)
#     config/  -> XDG_CONFIG_HOME (QSettings persistence for the harness)

set -euo pipefail

# ---- arg parsing ------------------------------------------------------------
DO_BUILD=1
DO_CLEAN=0
DO_WATCH=0
DO_RESET=0
for arg in "$@"; do
    case "$arg" in
        --no-build) DO_BUILD=0 ;;
        --clean)    DO_CLEAN=1 ;;
        --watch)    DO_WATCH=1 ;;
        --reset)    DO_RESET=1 ;;
        -h|--help)
            sed -n '3,18p' "$0"
            exit 0
            ;;
        *)
            echo "Unknown option: $arg" >&2
            exit 2
            ;;
    esac
done

# ---- paths ------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$REPO_ROOT/build-dev"
SANDBOX="$HOME/.cache/shaderwallpaper-dev"
SANDBOX_PREFIX="$SANDBOX/prefix"
SANDBOX_CONFIG="$SANDBOX/config"
HARNESS_QML="$SCRIPT_DIR/dev/DevHarness.qml"
PACKAGE_PATH="$SANDBOX_PREFIX/share/plasma/wallpapers/online.knowmad.shaderwallpaper"

# ---- helpers ----------------------------------------------------------------
say()   { printf '\033[36m[dev]\033[0m %s\n' "$*"; }
warn()  { printf '\033[33m[dev]\033[0m %s\n' "$*" >&2; }
fail()  { printf '\033[31m[dev]\033[0m %s\n' "$*" >&2; exit 1; }

# Pick QML runtime
QML_RUNTIME=""
for candidate in qml6 qml /usr/lib/qt6/bin/qml; do
    if command -v "$candidate" >/dev/null 2>&1; then
        QML_RUNTIME="$candidate"
        break
    fi
done
[ -n "$QML_RUNTIME" ] || fail "No Qt6 'qml' runtime found. Install qt6-declarative (Arch) / qt6-declarative-dev-tools (Debian)."

# Pick make
MAKE_BIN="${MAKE:-make}"
command -v "$MAKE_BIN" >/dev/null 2>&1 || MAKE_BIN="/usr/bin/make"
command -v "$MAKE_BIN" >/dev/null 2>&1 || fail "make not found"

# ---- reset config -----------------------------------------------------------
if [ "$DO_RESET" -eq 1 ]; then
    say "wiping sandbox config: $SANDBOX_CONFIG"
    rm -rf "$SANDBOX_CONFIG"
fi

# ---- clean ------------------------------------------------------------------
if [ "$DO_CLEAN" -eq 1 ]; then
    say "removing build dir: $BUILD_DIR"
    rm -rf "$BUILD_DIR"
    say "removing sandbox prefix: $SANDBOX_PREFIX"
    rm -rf "$SANDBOX_PREFIX"
fi

mkdir -p "$SANDBOX_PREFIX" "$SANDBOX_CONFIG"

# ---- build & install --------------------------------------------------------
build_and_install() {
    mkdir -p "$BUILD_DIR"
    if [ ! -f "$BUILD_DIR/CMakeCache.txt" ] \
        || ! grep -q "CMAKE_INSTALL_PREFIX:PATH=$SANDBOX_PREFIX" "$BUILD_DIR/CMakeCache.txt"; then
        say "configuring (prefix=$SANDBOX_PREFIX)"
        ( cd "$BUILD_DIR" && cmake -DCMAKE_BUILD_TYPE=Debug \
            -DCMAKE_INSTALL_PREFIX="$SANDBOX_PREFIX" \
            "$REPO_ROOT" )
    fi
    say "building"
    ( cd "$BUILD_DIR" && MAKE="$MAKE_BIN" "$MAKE_BIN" -j"$(nproc)" )
    say "installing to sandbox"
    ( cd "$BUILD_DIR" && MAKE="$MAKE_BIN" "$MAKE_BIN" install >/dev/null )
}

if [ "$DO_BUILD" -eq 1 ]; then
    build_and_install
fi

# Verify install — qmldir location depends on KDE_INSTALL_QMLDIR convention.
# Look in the common candidate paths.
QML_MODULE_DIR=""
for candidate in \
    "$SANDBOX_PREFIX/lib/qt6/qml" \
    "$SANDBOX_PREFIX/lib64/qt6/qml" \
    "$SANDBOX_PREFIX/lib/qml" \
    "$SANDBOX_PREFIX/lib64/qml"; do
    if [ -f "$candidate/online/knowmad/shaderwallpaper/qmldir" ]; then
        QML_MODULE_DIR="$candidate"
        break
    fi
done
if [ -z "$QML_MODULE_DIR" ]; then
    fail "QML module not found under $SANDBOX_PREFIX. Did install succeed?"
fi
[ -d "$PACKAGE_PATH/contents/ui/Shaders" ] || warn "bundled shaders not found at $PACKAGE_PATH/contents/ui/Shaders"

# ---- launch helper ----------------------------------------------------------
launch_harness() {
    export QML_IMPORT_PATH="$QML_MODULE_DIR${QML_IMPORT_PATH:+:$QML_IMPORT_PATH}"
    export QML2_IMPORT_PATH="$QML_IMPORT_PATH"
    export XDG_CONFIG_HOME="$SANDBOX_CONFIG"
    say "launching $QML_RUNTIME $(basename "$HARNESS_QML")"
    "$QML_RUNTIME" -I "$QML_MODULE_DIR" "$HARNESS_QML" -- "$PACKAGE_PATH"
}

# ---- watch loop -------------------------------------------------------------
if [ "$DO_WATCH" -eq 1 ]; then
    command -v inotifywait >/dev/null 2>&1 || fail "inotifywait not found. Install inotify-tools."

    cleanup() { [ -n "${HARNESS_PID:-}" ] && kill "$HARNESS_PID" 2>/dev/null || true; }
    trap cleanup EXIT

    while true; do
        launch_harness &
        HARNESS_PID=$!
        say "watching src/ and package/ for changes (PID $HARNESS_PID)"
        inotifywait -qq -r -e modify,create,delete,move \
            "$REPO_ROOT/src" "$REPO_ROOT/package" "$REPO_ROOT/scripts/dev" \
            --exclude '\.(o|d|cmake|gen|swp|tmp|cache)$|/__pycache__/' \
            2>/dev/null || true
        say "change detected, rebuilding…"
        kill "$HARNESS_PID" 2>/dev/null || true
        wait "$HARNESS_PID" 2>/dev/null || true
        if ! build_and_install; then
            warn "build failed; waiting for next change before retrying"
            inotifywait -qq -r -e modify,create,delete,move \
                "$REPO_ROOT/src" "$REPO_ROOT/package" 2>/dev/null || true
        fi
    done
else
    launch_harness
fi
