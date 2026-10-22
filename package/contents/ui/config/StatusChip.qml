// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

// Small non-interactive status badge.
Rectangle {
    id: chip

    property string text
    property string iconName
    property string toolTip
    property color tone: Kirigami.Theme.textColor

    implicitWidth: row.implicitWidth + Kirigami.Units.largeSpacing
    implicitHeight: row.implicitHeight + Kirigami.Units.smallSpacing
    radius: height / 2
    color: Qt.rgba(tone.r, tone.g, tone.b, 0.12)
    border.width: 1
    border.color: Qt.rgba(tone.r, tone.g, tone.b, 0.35)

    RowLayout {
        id: row
        anchors.centerIn: parent
        spacing: Kirigami.Units.smallSpacing
        Kirigami.Icon {
            visible: chip.iconName.length > 0
            source: chip.iconName
            implicitWidth: Kirigami.Units.iconSizes.small
            implicitHeight: Kirigami.Units.iconSizes.small
            color: chip.tone
        }
        QQC2.Label {
            text: chip.text
            font: Kirigami.Theme.smallFont
            color: chip.tone
        }
    }

    HoverHandler { id: hover }
    QQC2.ToolTip.text: chip.toolTip
    QQC2.ToolTip.visible: hover.hovered && chip.toolTip.length > 0
    QQC2.ToolTip.delay: Kirigami.Units.toolTipDelay
}
