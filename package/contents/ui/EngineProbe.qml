// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

// Compiles only when the native module in shaderwallpaper/ loads: the import
// resolves the qmldir and loads the plugin library at compile time.
import QtQuick
import "shaderwallpaper"

QtObject {}
