// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import "shaderwallpaper"

// Gallery card: 16:9 thumbnail, name, author, small status badges.
Item {
    id: card

    property string shaderId
    property string shaderName
    property string author
    property url thumbnailPath
    property bool isFavorite: false
    property bool isNew: false
    property bool hasBuffers: false
    property bool needsAudio: false
    property bool greeterAvailable: true
    // -1 unmeasured, 0 light .. 3 extreme
    property int performanceTier: -1
    property bool selected: false
    property bool keyboardCurrent: false
    property bool compact: false

    signal clicked()
    signal doubleClicked()
    signal favoriteToggled()
    signal contextMenuRequested(point position)

    readonly property bool hovered: hover.hovered
    readonly property color textColor: selected ? Kirigami.Theme.highlightedTextColor : Kirigami.Theme.textColor
    readonly property color mutedTextColor: selected
        ? Qt.rgba(Kirigami.Theme.highlightedTextColor.r, Kirigami.Theme.highlightedTextColor.g,
                  Kirigami.Theme.highlightedTextColor.b, 0.75)
        : Kirigami.Theme.disabledTextColor

    Accessible.role: Accessible.ListItem
    Accessible.name: shaderName
    Accessible.selected: selected

    Rectangle {
        id: background
        anchors.fill: parent
        radius: Kirigami.Units.cornerRadius
        color: card.selected ? Kirigami.Theme.highlightColor
             : card.hovered ? Qt.rgba(Kirigami.Theme.highlightColor.r, Kirigami.Theme.highlightColor.g,
                                      Kirigami.Theme.highlightColor.b, 0.12)
             : "transparent"
        border.width: card.keyboardCurrent || (card.hovered && !card.selected) ? 1 : 0
        border.color: Kirigami.Theme.highlightColor
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: Kirigami.Units.smallSpacing
        spacing: Kirigami.Units.smallSpacing

        Rectangle {
            id: frame
            Layout.fillWidth: true
            Layout.preferredHeight: Math.round(width * 9 / 16)
            radius: Kirigami.Units.cornerRadius
            color: Kirigami.Theme.alternateBackgroundColor
            clip: true

            Image {
                id: thumbnail
                anchors.fill: parent
                source: card.thumbnailPath
                asynchronous: true
                fillMode: Image.PreserveAspectCrop
                sourceSize.width: Math.ceil(frame.width * Screen.devicePixelRatio)
                sourceSize.height: Math.ceil(frame.height * Screen.devicePixelRatio)
                visible: status === Image.Ready
            }
            Kirigami.Icon {
                anchors.centerIn: parent
                width: Kirigami.Units.iconSizes.medium
                height: width
                source: "preferences-desktop-wallpaper"
                color: Kirigami.Theme.disabledTextColor
                visible: thumbnail.status !== Image.Ready
            }

            NewBadge {
                anchors {
                    left: parent.left
                    bottom: parent.bottom
                    margins: Kirigami.Units.smallSpacing
                }
                visible: card.isNew
            }

            // Badges, top right.
            Row {
                anchors {
                    top: parent.top
                    right: parent.right
                    margins: Kirigami.Units.smallSpacing
                }
                spacing: Kirigami.Units.smallSpacing / 2
                // The model holds no theme colours: a model that depends on
                // Kirigami.Theme is re-evaluated while the theme propagates a
                // change, the Repeater destroys its delegates mid-propagation,
                // and PlatformTheme then notifies freed objects (crash on tab
                // switch).
                Repeater {
                    model: [
                        { show: card.performanceTier >= 2, icon: "speedometer", tone: "negative",
                          tip: card.performanceTier >= 3 ? i18n("Very heavy on the graphics card") : i18n("Heavy on the graphics card") },
                        { show: card.hasBuffers, icon: "layer-visible-on", tone: "", tip: i18n("Multi-pass shader") },
                        { show: card.needsAudio, icon: "audio-volume-high", tone: "", tip: i18n("Reacts to sound") },
                        { show: !card.greeterAvailable && ShaderLibrarySingleton.greeterPathPresent, icon: "system-lock-screen",
                          tone: "neutral", tip: i18n("Not available on the sign-in screen: this shader is only in your user library.") }
                    ]
                    delegate: Rectangle {
                        required property var modelData
                        visible: modelData.show
                        width: Kirigami.Units.iconSizes.small + Kirigami.Units.smallSpacing
                        height: width
                        radius: width / 2
                        color: Qt.rgba(Kirigami.Theme.backgroundColor.r, Kirigami.Theme.backgroundColor.g,
                                       Kirigami.Theme.backgroundColor.b, 0.85)
                        Kirigami.Icon {
                            anchors.centerIn: parent
                            width: Kirigami.Units.iconSizes.small - 2
                            height: width
                            source: modelData.icon
                            color: modelData.tone === "negative" ? Kirigami.Theme.negativeTextColor
                                 : modelData.tone === "neutral" ? Kirigami.Theme.neutralTextColor
                                 : Kirigami.Theme.textColor
                        }
                        HoverHandler { id: badgeHover }
                        QQC2.ToolTip.text: modelData.tip
                        QQC2.ToolTip.visible: badgeHover.hovered
                        QQC2.ToolTip.delay: Kirigami.Units.toolTipDelay
                    }
                }
            }

            // Favourite toggle, top left; always shown when set.
            QQC2.ToolButton {
                anchors {
                    top: parent.top
                    left: parent.left
                    margins: Kirigami.Units.smallSpacing / 2
                }
                visible: card.isFavorite || card.hovered
                implicitWidth: Kirigami.Units.iconSizes.small + Kirigami.Units.smallSpacing * 2
                implicitHeight: implicitWidth
                padding: Kirigami.Units.smallSpacing
                display: QQC2.AbstractButton.IconOnly
                text: card.isFavorite ? i18n("Remove from favourites") : i18n("Add to favourites")
                // The style's icon slot needs more room than the badge gives it
                // and draws nothing.
                contentItem: HeartIcon {
                    filled: card.isFavorite
                    color: card.isFavorite ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.textColor
                }
                QQC2.ToolTip.text: text
                QQC2.ToolTip.visible: hovered
                QQC2.ToolTip.delay: Kirigami.Units.toolTipDelay
                background: Rectangle {
                    radius: width / 2
                    color: Qt.rgba(Kirigami.Theme.backgroundColor.r, Kirigami.Theme.backgroundColor.g,
                                   Kirigami.Theme.backgroundColor.b, 0.85)
                }
                onClicked: card.favoriteToggled()
            }
        }

        QQC2.Label {
            Layout.fillWidth: true
            text: card.shaderName || i18n("Untitled")
            elide: Text.ElideRight
            color: card.textColor
            font.bold: card.selected
        }
        QQC2.Label {
            Layout.fillWidth: true
            visible: !card.compact
            text: card.author.length > 0 ? card.author : " "
            elide: Text.ElideRight
            font: Kirigami.Theme.smallFont
            color: card.mutedTextColor
        }
        Item { Layout.fillHeight: true }
    }

    HoverHandler { id: hover }

    // Behind the favourite button, so its clicks do not select the card.
    MouseArea {
        anchors.fill: parent
        z: -1
        acceptedButtons: Qt.LeftButton | Qt.RightButton
        cursorShape: Qt.PointingHandCursor
        onClicked: function(mouse) {
            if (mouse.button === Qt.RightButton) card.contextMenuRequested(Qt.point(mouse.x, mouse.y))
            else card.clicked()
        }
        onDoubleClicked: function(mouse) {
            if (mouse.button === Qt.LeftButton) card.doubleClicked()
        }
        onPressAndHold: function(mouse) { card.contextMenuRequested(Qt.point(mouse.x, mouse.y)) }
    }
}
