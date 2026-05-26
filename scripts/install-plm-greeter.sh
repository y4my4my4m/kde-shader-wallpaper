#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Dev-tree entry point — delegates to the script shipped inside the wallpaper package.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_SCRIPT="${SCRIPT_DIR}/../package/contents/scripts/install-plm-greeter.sh"

if [ ! -f "$PKG_SCRIPT" ]; then
    echo "Missing ${PKG_SCRIPT}" >&2
    exit 1
fi

exec bash "$PKG_SCRIPT" "$@"
