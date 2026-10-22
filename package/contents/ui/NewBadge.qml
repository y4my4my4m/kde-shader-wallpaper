// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import org.kde.kirigami as Kirigami

// "NEW" pill for shaders added in the installed release.
Rectangle {
    id: badge

    property alias text: label.text

    implicitWidth: label.implicitWidth + Kirigami.Units.smallSpacing * 2
    implicitHeight: label.implicitHeight + Kirigami.Units.smallSpacing / 2
    radius: height / 2
    color: Kirigami.Theme.highlightColor

    QQC2.Label {
        id: label
        anchors.centerIn: parent
        text: i18nc("@label badge on shaders added in this release", "NEW")
        color: Kirigami.Theme.highlightedTextColor
        font.pointSize: Kirigami.Theme.smallFont.pointSize
        font.bold: true
        font.letterSpacing: 0.5
    }

    Accessible.role: Accessible.StaticText
    Accessible.name: label.text
}
