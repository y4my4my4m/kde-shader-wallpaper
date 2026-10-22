#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>
#
# Dev-tree entry point. Builds from this checkout with the installer shipped in
# the wallpaper package (package/contents/scripts/build.sh), using build/ as the
# CMake build directory.
#
#   scripts/build.sh              build, then install to ~/.local
#   scripts/build.sh build        build only (module lands in package/contents/ui/shaderwallpaper)
#   scripts/build.sh system       build and install to /usr (sudo)
#   scripts/build.sh uninstall    remove the ~/.local install
#   scripts/build.sh deps         dependency install command for this distribution
#   scripts/build.sh help         all commands and options
#
# BUILD_TYPE, INSTALL_PREFIX and JOBS pass through.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

exec bash "$REPO/package/contents/scripts/build.sh" \
    --source "$REPO" --package "$REPO/package" --build-dir "${BUILD_DIR:-$REPO/build}" "$@"
