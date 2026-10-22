#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>
#
# Builds the KDE Store archive: the Plasma wallpaper package plus the engine
# sources in contents/source/, which package/contents/scripts/build.sh
# compiles on the user's machine.
#
# Archive layout (KPackage takes a single top-level directory as the root):
#   online.knowmad.shaderwallpaper/
#     metadata.json
#     contents/{config,scripts,ui}/        package/ minus build output
#     contents/source/                      CMakeLists.txt, src/, LICENSE,
#                                           scripts/enable-plm-greeter.sh
#
# Files come from the working tree, limited to what git tracks or does not
# ignore, so the compiled module (contents/ui/shaderwallpaper/) never ships.
#
# Usage: scripts/package-kde-store.sh [--output DIR] [--tracked-only] [--verify]
#   --output DIR     destination directory (default: build/dist)
#   --tracked-only   leave out files git does not track yet
#   --verify         install the archive with kpackagetool6 into a temporary
#                    root and check the result

set -euo pipefail

PLUGIN_ID="online.knowmad.shaderwallpaper"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$REPO/build/dist"
TRACKED_ONLY=0
VERIFY=0

while [ $# -gt 0 ]; do
    case "$1" in
        --output)       OUT_DIR="${2:?--output needs a directory}"; shift ;;
        --output=*)     OUT_DIR="${1#*=}" ;;
        --tracked-only) TRACKED_ONLY=1 ;;
        --verify)       VERIFY=1 ;;
        -h|--help)      sed -n '5,23p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *)              echo "Unknown option: $1" >&2; exit 2 ;;
    esac
    shift
done

die() { echo "✗ $*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || die "git is required."
git -C "$REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "$REPO is not a git checkout."

VERSION="$(sed -n 's/.*"Version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$REPO/package/metadata.json" | head -n1)"
CMAKE_VERSION="$(sed -n 's/^project([^)]*VERSION[[:space:]]\{1,\}\([0-9.]*\).*/\1/p' "$REPO/CMakeLists.txt" | head -n1)"
[ -n "$VERSION" ] || die "No Version in package/metadata.json."
[ "$VERSION" = "$CMAKE_VERSION" ] || \
    die "Version mismatch: package/metadata.json has $VERSION, CMakeLists.txt has $CMAKE_VERSION."

# NUL-separated paths relative to the repository, existing files only.
list_files() {
    local -a modes=(--cached)
    [ "$TRACKED_ONLY" -eq 1 ] || modes+=(--others --exclude-standard)
    git -C "$REPO" ls-files -z "${modes[@]}" -- "$@" |
        while IFS= read -r -d '' f; do
            if [ -f "$REPO/$f" ]; then printf '%s\0' "$f"; fi
        done | sort -zu
}

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
ROOT="$STAGE/$PLUGIN_ID"
mkdir -p "$ROOT/contents/source"

copy_list() {   # $1 = strip prefix, $2 = destination; NUL list on stdin
    local strip="$1" dest="$2" f rel
    while IFS= read -r -d '' f; do
        rel="${f#"$strip"}"
        case "$rel" in contents/ui/shaderwallpaper/*) continue ;; esac
        mkdir -p "$dest/$(dirname "$rel")"
        cp -p "$REPO/$f" "$dest/$rel"
    done
}

list_files package | copy_list "package/" "$ROOT"
list_files CMakeLists.txt LICENSE src scripts/enable-plm-greeter.sh | copy_list "" "$ROOT/contents/source"

if [ "$TRACKED_ONLY" -eq 0 ]; then
    untracked="$(git -C "$REPO" ls-files --others --exclude-standard -- package src CMakeLists.txt)"
    if [ -n "$untracked" ]; then
        echo "⚠ Including files git does not track yet (--tracked-only leaves them out):"
        sed 's/^/    /' <<<"$untracked"
    fi
fi

# The engine-missing path: without it a store install shows nothing.
for required in metadata.json contents/ui/main.qml contents/ui/config.qml contents/config/main.xml \
                contents/ui/EngineStatus.qml contents/ui/EngineProbe.qml contents/ui/EngineMissing.qml \
                contents/ui/EngineLogo.qml contents/ui/SetupWizard.qml \
                contents/scripts/build.sh contents/source/CMakeLists.txt \
                contents/source/src/CMakeLists.txt contents/source/scripts/enable-plm-greeter.sh; do
    [ -f "$ROOT/$required" ] || die "Staged package lacks $required."
done
[ ! -e "$ROOT/contents/ui/shaderwallpaper" ] || die "Build output leaked into the archive."

mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
ARCHIVE="$OUT_DIR/shader-wallpaper-$VERSION.tar.gz"
EPOCH="$(git -C "$REPO" log -1 --format=%ct 2>/dev/null || date +%s)"

# Fixed order, owner and mtime: identical trees give identical archives.
tar --sort=name --owner=0 --group=0 --numeric-owner --mtime="@$EPOCH" --mode='u+rwX,go+rX,go-w' \
    -C "$STAGE" -cf - "$PLUGIN_ID" | gzip -n -9 >"$ARCHIVE"

FILES="$(tar -tzf "$ARCHIVE" | grep -vc '/$')"
SIZE_BYTES="$(stat -c %s "$ARCHIVE")"
SIZE_HUMAN="$(numfmt --to=iec --suffix=B "$SIZE_BYTES" 2>/dev/null || echo "$SIZE_BYTES bytes")"
SOURCE_BYTES="$(du -sb "$ROOT/contents/source" | cut -f1)"

if [ "$VERIFY" -eq 1 ]; then
    command -v kpackagetool6 >/dev/null 2>&1 || die "--verify needs kpackagetool6."
    VROOT="$STAGE/verify"
    mkdir -p "$VROOT/wallpapers"
    XDG_DATA_HOME="$VROOT/data" XDG_CONFIG_HOME="$VROOT/config" XDG_CACHE_HOME="$VROOT/cache" \
        kpackagetool6 --type Plasma/Wallpaper --packageroot "$VROOT/wallpapers" --install "$ARCHIVE" >/dev/null ||
        die "kpackagetool6 rejected the archive."
    INSTALLED="$VROOT/wallpapers/$PLUGIN_ID"
    [ -f "$INSTALLED/metadata.json" ] && [ -f "$INSTALLED/contents/source/CMakeLists.txt" ] ||
        die "kpackagetool6 installed an unexpected layout."
    echo "✓ kpackagetool6 installs it as $PLUGIN_ID"
fi

echo "✓ $ARCHIVE"
echo "  version $VERSION, $FILES files, $SIZE_HUMAN ($SIZE_BYTES bytes); sources $(numfmt --to=iec "$SOURCE_BYTES" 2>/dev/null || echo "$SOURCE_BYTES")"
echo "  sha256 $(sha256sum "$ARCHIVE" | cut -d' ' -f1)"
