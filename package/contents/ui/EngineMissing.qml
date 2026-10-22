// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import org.kde.kirigami as Kirigami

// Wallpaper shown while the native engine is not installed. Follows the
// colour scheme; static.
Rectangle {
    id: root

    // Lock and sign-in screens get the plain background only.
    property bool showMessage: true

    Kirigami.Theme.colorSet: Kirigami.Theme.View
    Kirigami.Theme.inherit: false
    color: Kirigami.Theme.backgroundColor

    Kirigami.PlaceholderMessage {
        anchors.centerIn: parent
        width: Math.min(parent.width - Kirigami.Units.gridUnit * 4, Kirigami.Units.gridUnit * 28)
        visible: root.showMessage
        icon.name: "preferences-desktop-wallpaper"
        text: i18n("Shader Wallpaper needs one more step")
        explanation: i18n("Its engine is compiled on this computer. Right-click the desktop, choose “Desktop and Wallpaper”, and follow the steps there.")
    }
}
