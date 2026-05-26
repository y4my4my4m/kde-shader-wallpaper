// SPDX-License-Identifier: GPL-3.0-or-later
// Real plugin status - C++ plugin is installed

import QtQuick

QtObject {
    // C++ plugin is installed and available
    readonly property bool installed: true
    readonly property string message: "C++ plugin installed and ready."
}

