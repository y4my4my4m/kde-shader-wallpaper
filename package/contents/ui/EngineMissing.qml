// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

// Wallpaper shown while the native engine is not installed. Fixed dark
// palette, independent of the colour scheme. Static after a one-shot fade:
// a running animation would render the desktop every frame.
Rectangle {
    id: root

    // Lock and sign-in screens get the backdrop only.
    property bool showMessage: true

    color: "#0b0d1d"

    // Painted once at a quarter of the output size; bilinear upscaling keeps
    // the radial falloff smooth.
    Canvas {
        id: backdrop
        readonly property int factor: 4
        width: Math.max(1, Math.ceil(root.width / factor))
        height: Math.max(1, Math.ceil(root.height / factor))
        transformOrigin: Item.TopLeft
        scale: factor
        smooth: true
        onWidthChanged: requestPaint()
        onHeightChanged: requestPaint()

        onPaint: {
            const ctx = getContext("2d")
            const w = width, h = height, s = Math.max(w, h)
            ctx.reset()
            const base = ctx.createLinearGradient(0, 0, w, h)
            base.addColorStop(0.0, "#17123a")
            base.addColorStop(0.55, "#0c0f25")
            base.addColorStop(1.0, "#06141b")
            ctx.fillStyle = base
            ctx.fillRect(0, 0, w, h)
            function glow(x, y, r, rgb, a) {
                const g = ctx.createRadialGradient(x, y, 0, x, y, r)
                g.addColorStop(0.0, "rgba(" + rgb + "," + a + ")")
                g.addColorStop(0.45, "rgba(" + rgb + "," + (a * 0.45) + ")")
                g.addColorStop(1.0, "rgba(" + rgb + ",0)")
                ctx.fillStyle = g
                ctx.fillRect(0, 0, w, h)
            }
            glow(w * 0.14, h * 0.18, s * 0.55, "124,92,255", 0.42)
            glow(w * 0.90, h * 0.88, s * 0.50, "0,194,199", 0.30)
            glow(w * 0.72, h * 0.06, s * 0.30, "255,92,138", 0.20)
        }
    }

    Rectangle {
        id: card
        visible: root.showMessage
        anchors.centerIn: parent
        width: Math.min(root.width - Kirigami.Units.gridUnit * 4,
                        Kirigami.Units.gridUnit * 34)
        height: content.implicitHeight + padding * 2
        readonly property real padding: Kirigami.Units.gridUnit * 2
        radius: Kirigami.Units.gridUnit
        color: Qt.rgba(1, 1, 1, 0.055)
        border.color: Qt.rgba(1, 1, 1, 0.12)
        border.width: 1
        opacity: 0

        NumberAnimation on opacity {
            running: card.visible
            to: 1
            duration: Kirigami.Units.veryLongDuration * 2
            easing.type: Easing.OutCubic
        }

        ColumnLayout {
            id: content
            anchors.fill: parent
            anchors.margins: card.padding
            spacing: Kirigami.Units.largeSpacing

            EngineLogo {
                Layout.alignment: Qt.AlignHCenter
                Layout.bottomMargin: Kirigami.Units.smallSpacing
            }

            QQC2.Label {
                Layout.fillWidth: true
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.Wrap
                text: i18n("Finish installing Shader Wallpaper")
                color: "#f4f2ff"
                font.pointSize: Kirigami.Theme.defaultFont.pointSize * 2
                font.weight: Font.DemiBold
            }

            QQC2.Label {
                Layout.fillWidth: true
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.Wrap
                text: i18n("Shader Wallpaper draws with a small engine that is compiled for your computer. Setting it up takes about a minute.")
                color: "#c6c3e4"
                font.pointSize: Kirigami.Theme.defaultFont.pointSize * 1.15
                lineHeight: 1.15
            }

            Rectangle {
                Layout.alignment: Qt.AlignHCenter
                Layout.topMargin: Kirigami.Units.largeSpacing
                Layout.maximumWidth: content.width
                implicitWidth: hint.implicitWidth + Kirigami.Units.gridUnit * 2
                implicitHeight: hint.implicitHeight + Kirigami.Units.largeSpacing * 2
                radius: height / 2
                color: Qt.rgba(1, 1, 1, 0.08)
                border.color: Qt.rgba(1, 1, 1, 0.10)
                border.width: 1

                RowLayout {
                    id: hint
                    anchors.centerIn: parent
                    width: Math.min(implicitWidth, parent.width - Kirigami.Units.gridUnit * 2)
                    spacing: Kirigami.Units.smallSpacing * 2
                    Kirigami.Icon {
                        implicitWidth: Kirigami.Units.iconSizes.smallMedium
                        implicitHeight: Kirigami.Units.iconSizes.smallMedium
                        source: "input-mouse-click-right-symbolic"
                        isMask: true
                        color: "#a99bff"
                    }
                    QQC2.Label {
                        Layout.fillWidth: true
                        wrapMode: Text.Wrap
                        textFormat: Text.StyledText
                        text: i18nc("%1 is the desktop context-menu entry",
                                    "Right-click the desktop and choose <b>%1</b>",
                                    i18nc("@action:inmenu Plasma desktop context menu entry", "Desktop and Wallpaper"))
                        color: "#e9e6ff"
                    }
                }
            }
        }
    }
}
