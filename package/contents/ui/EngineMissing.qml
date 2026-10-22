// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

// Wallpaper shown while the native engine is not installed. Follows the
// colour scheme; static. Kirigami.PlaceholderMessage fails to load in
// plasmashell's wallpaper engine (IconPropertiesGroup type mismatch), so
// the same layout is built from basic items.
Rectangle {
    id: root

    // Lock and sign-in screens get the plain background only.
    property bool showMessage: true

    Kirigami.Theme.colorSet: Kirigami.Theme.View
    Kirigami.Theme.inherit: false
    color: Kirigami.Theme.backgroundColor

    ColumnLayout {
        anchors.centerIn: parent
        width: Math.min(parent.width - Kirigami.Units.gridUnit * 4, Kirigami.Units.gridUnit * 28)
        visible: root.showMessage
        spacing: Kirigami.Units.largeSpacing

        Kirigami.Icon {
            Layout.alignment: Qt.AlignHCenter
            implicitWidth: Kirigami.Units.iconSizes.huge
            implicitHeight: Kirigami.Units.iconSizes.huge
            source: "preferences-desktop-wallpaper"
            opacity: 0.5
        }
        Kirigami.Heading {
            Layout.fillWidth: true
            level: 2
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.Wrap
            opacity: 0.65
            text: i18n("Shader Wallpaper needs one more step")
        }
        QQC2.Label {
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.Wrap
            opacity: 0.65
            text: i18n("Its engine is compiled on this computer. Right-click the desktop, choose “Desktop and Wallpaper”, and follow the steps there.")
        }
    }
}
