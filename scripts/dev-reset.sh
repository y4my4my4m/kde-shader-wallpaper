#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
#
# Wipe the dev-harness sandbox so the next `scripts/dev.sh` launch starts
# with default configuration (useful for verifying cold-boot behavior).
#
# Use `--all` to also remove the build dir and sandbox install prefix.

set -euo pipefail

SANDBOX="$HOME/.cache/shaderwallpaper-dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$REPO_ROOT/build-dev"

if [ "${1:-}" = "--all" ]; then
    echo "Removing $SANDBOX"
    rm -rf "$SANDBOX"
    echo "Removing $BUILD_DIR"
    rm -rf "$BUILD_DIR"
else
    if [ -d "$SANDBOX/config" ]; then
        echo "Removing $SANDBOX/config"
        rm -rf "$SANDBOX/config"
    else
        echo "Nothing to remove at $SANDBOX/config"
    fi
    echo "(Pass --all to also wipe the sandbox prefix and build dir.)"
fi
