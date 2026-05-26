// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

/**
 * Card component for displaying a shader in the gallery
 */
Rectangle {
    id: root
    
    property string shaderId: ""
    property string shaderName: ""
    property url shaderPath
    property url thumbnailPath
    property string author: ""
    property string category: ""
    property bool isFavorite: false
    property bool hasBuffers: false
    property bool needsAudio: false
    property bool selected: false
    // hovered is set by MouseArea below, with safe default
    property bool hovered: false
    // True when this shader is in the gallery's "recent" list — the
    // gallery view passes through Settings-backed state from QtCore.
    property bool recentlyUsed: false
    
    // Performance metrics
    property int performanceTier: -1  // -1 = not measured, 0=Low, 1=Medium, 2=High, 3=Extreme
    property real averageFrameTime: 0.0
    property int powerCost: 0
    
    // Computed performance tier color - use function to avoid undefined issues
    function getPerformanceTierColor() {
        if (performanceTier === 0) return "#27ae60"  // Green - Low demand
        if (performanceTier === 1) return "#f1c40f"  // Yellow - Medium
        if (performanceTier === 2) return "#e67e22"  // Orange - High
        if (performanceTier === 3) return "#e74c3c"  // Red - Extreme
        return "transparent"
    }
    readonly property color performanceTierColor: getPerformanceTierColor()
    
    readonly property string performanceTierName: {
        if (performanceTier === 0) return i18n("Low")
        if (performanceTier === 1) return i18n("Medium")
        if (performanceTier === 2) return i18n("High")
        if (performanceTier === 3) return i18n("Extreme")
        return ""
    }

    // Human-friendly recommendation badge derived from the perf tier.
    // Tier 0 (≤4 ms/frame) → laptop-friendly; tier 3+ → "needs strong GPU".
    readonly property string performanceRecommendation: {
        if (performanceTier === 0) return i18n("Great for laptops")
        if (performanceTier === 1) return ""
        if (performanceTier === 2) return i18n("Discrete GPU")
        if (performanceTier === 3) return i18n("High-end GPU")
        return ""
    }
    readonly property color performanceRecommendationColor: {
        if (performanceTier === 0) return "#27ae60"
        if (performanceTier === 2) return "#e67e22"
        if (performanceTier === 3) return "#e74c3c"
        return "transparent"
    }
    
    signal clicked()
    signal favoriteToggled()
    signal doubleClicked()
    
    radius: Kirigami.Units.cornerRadius
    color: root.selected ? Kirigami.Theme.highlightColor :
           root.hovered ? Kirigami.Theme.hoverColor :
           Kirigami.Theme.backgroundColor

    border.width: root.selected ? 2 : 1
    border.color: root.selected ? Kirigami.Theme.highlightColor :
                  root.hovered ? (Kirigami.Theme.focusColor || Kirigami.Theme.highlightColor) :
                  (Kirigami.Theme.separatorColor || Kirigami.Theme.backgroundColor)

    // Smooth hover + selection animations
    Behavior on color { ColorAnimation { duration: 150 } }
    Behavior on border.color { ColorAnimation { duration: 150 } }
    Behavior on border.width { NumberAnimation { duration: 100 } }
    Behavior on scale { NumberAnimation { duration: 120; easing.type: Easing.OutCubic } }

    // Slight "lift" effect on hover — makes the gallery feel responsive
    // without being distracting.
    scale: root.hovered && !root.selected ? 1.02 : 1.0
    transformOrigin: Item.Center
    
    // Use ColumnLayout for proper proportional sizing
    ColumnLayout {
        anchors.fill: parent
        anchors.margins: Kirigami.Units.smallSpacing
        spacing: Kirigami.Units.smallSpacing
        
        // Thumbnail container - takes remaining space
        Rectangle {
            id: thumbnailContainer
            Layout.fillWidth: true
            Layout.fillHeight: true
            
            radius: Kirigami.Units.smallSpacing
            color: Kirigami.Theme.alternateBackgroundColor
            clip: true
            
            Image {
                id: thumbnail
                anchors.fill: parent
                source: root.thumbnailPath
                fillMode: Image.PreserveAspectCrop
                visible: status === Image.Ready
                
                // Smooth scaling
                smooth: true
                mipmap: true
            }
            
            // Placeholder when no thumbnail
            Kirigami.Icon {
                anchors.centerIn: parent
                width: Kirigami.Units.iconSizes.large
                height: width
                source: "preferences-desktop-wallpaper"
                visible: thumbnail.status !== Image.Ready
                opacity: 0.4
            }
            
            // Feature badges
            Row {
                anchors {
                    top: parent.top
                    right: parent.right
                    margins: Kirigami.Units.smallSpacing / 2
                }
                spacing: 2
                
                // Performance tier badge
                Rectangle {
                    visible: root.performanceTier >= 0
                    width: perfLabel.width + 6
                    height: Kirigami.Units.iconSizes.small + 2
                    radius: 3
                    color: root.performanceTierColor
                    opacity: 0.9
                    
                    Text {
                        id: perfLabel
                        anchors.centerIn: parent
                        text: {
                            switch (root.performanceTier) {
                                case 0: return "⚡"
                                case 1: return "⚡⚡"
                                case 2: return "🔥"
                                case 3: return "🔥🔥"
                                default: return ""
                            }
                        }
                        font.pixelSize: 10
                    }
                    
                    ToolTip.visible: perfMouseArea.containsMouse
                    ToolTip.text: {
                        var text = i18n("GPU Demand: %1", root.performanceTierName)
                        if (root.averageFrameTime > 0) {
                            text += "\n" + i18n("Render time: %1 ms/frame", root.averageFrameTime.toFixed(2))
                            // Estimate relative power (lower = more efficient)
                            var efficiency = root.averageFrameTime < 4 ? i18n("Very efficient") :
                                           root.averageFrameTime < 8 ? i18n("Efficient") :
                                           root.averageFrameTime < 16 ? i18n("Moderate") :
                                           i18n("Power hungry")
                            text += "\n" + efficiency
                        }
                        return text
                    }
                    
                    MouseArea {
                        id: perfMouseArea
                        anchors.fill: parent
                        hoverEnabled: true
                    }
                }
                
                // Buffers badge
                Rectangle {
                    visible: root.hasBuffers
                    width: bufferIcon.width + 4
                    height: width
                    radius: width / 2
                    color: Kirigami.Theme.positiveBackgroundColor
                    
                    Kirigami.Icon {
                        id: bufferIcon
                        anchors.centerIn: parent
                        width: Kirigami.Units.iconSizes.small
                        height: width
                        source: "layer-visible-on"
                    }
                    
                    ToolTip.visible: bufferMouseArea.containsMouse
                    ToolTip.text: i18n("Uses buffers")
                    
                    MouseArea {
                        id: bufferMouseArea
                        anchors.fill: parent
                        hoverEnabled: true
                    }
                }
                
                // Audio badge
                Rectangle {
                    visible: root.needsAudio
                    width: audioIcon.width + 4
                    height: width
                    radius: width / 2
                    color: Kirigami.Theme.neutralBackgroundColor
                    
                    Kirigami.Icon {
                        id: audioIcon
                        anchors.centerIn: parent
                        width: Kirigami.Units.iconSizes.small
                        height: width
                        source: "audio-volume-high"
                    }
                    
                    ToolTip.visible: audioMouseArea.containsMouse
                    ToolTip.text: i18n("Audio reactive")
                    
                    MouseArea {
                        id: audioMouseArea
                        anchors.fill: parent
                        hoverEnabled: true
                    }
                }
            }
            
            // Favorite button. Implemented as Item+Icon+MouseArea (rather
            // than a Button) so we don't have to fight with the QML Button's
            // internal mouse handling. z: 10 keeps the button visible over
            // the card's hover overlay, and the explicit MouseArea here is
            // hit-tested before the card's outer MouseArea (which now has
            // z: -1 — see below) so a click on the heart toggles favourite
            // without also selecting the card.
            Item {
                id: favoriteButton
                anchors {
                    top: parent.top
                    left: parent.left
                    margins: 4
                }
                z: 10
                width: Kirigami.Units.iconSizes.small + 8
                height: Kirigami.Units.iconSizes.small + 8

                Rectangle {
                    anchors.fill: parent
                    radius: width / 2
                    color: favMouse.containsMouse
                        ? Kirigami.Theme.hoverColor
                        : "transparent"
                    opacity: 0.8
                }

                Kirigami.Icon {
                    anchors.centerIn: parent
                    width: Kirigami.Units.iconSizes.small
                    height: width
                    source: root.isFavorite ? "emblem-favorite" : "emblem-favorite-symbolic"
                    color: root.isFavorite ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.textColor
                }

                MouseArea {
                    id: favMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.favoriteToggled()

                    ToolTip.visible: containsMouse
                    ToolTip.text: root.isFavorite ? i18n("Remove from favorites") : i18n("Add to favorites")
                }
            }

            // "Recent" chip — top-right of the thumbnail, next to the
            // perf/audio badges, so users can see at a glance which
            // shaders they've recently tried.
            Rectangle {
                visible: root.recentlyUsed
                anchors {
                    bottom: parent.bottom
                    left: parent.left
                    margins: 4
                }
                z: 10
                radius: 3
                color: Qt.rgba(0, 0, 0, 0.55)
                width: recentRow.implicitWidth + 8
                height: recentRow.implicitHeight + 4
                RowLayout {
                    id: recentRow
                    anchors.centerIn: parent
                    spacing: 3
                    Kirigami.Icon {
                        source: "view-history"
                        Layout.preferredWidth: Kirigami.Units.iconSizes.small * 0.75
                        Layout.preferredHeight: Layout.preferredWidth
                        color: "white"
                    }
                    Label {
                        text: i18n("Recent")
                        color: "white"
                        font.pointSize: Kirigami.Theme.smallFont.pointSize * 0.85
                        font.bold: true
                    }
                }
            }
        }
        
        // Shader info - fixed height at bottom
        ColumnLayout {
            id: infoColumn
            Layout.fillWidth: true
            spacing: 0

            Label {
                Layout.fillWidth: true
                text: root.shaderName || i18n("Untitled")
                elide: Text.ElideRight
                font.bold: true
                font.pointSize: Kirigami.Theme.defaultFont.pointSize * 0.85
            }

            Label {
                Layout.fillWidth: true
                visible: root.author.length > 0
                text: root.author
                elide: Text.ElideRight
                font.pointSize: Kirigami.Theme.smallFont.pointSize
                opacity: 0.6
            }

            // Recommendation badge (UI 7): friendly-text tag computed
            // from the shader's measured performance tier. Stays
            // invisible for tier 1 (the average shader) so the gallery
            // isn't covered in stickers.
            Rectangle {
                Layout.fillWidth: false
                Layout.topMargin: 2
                visible: root.performanceRecommendation.length > 0
                radius: 3
                color: Qt.rgba(root.performanceRecommendationColor.r,
                               root.performanceRecommendationColor.g,
                               root.performanceRecommendationColor.b,
                               0.18)
                border.color: root.performanceRecommendationColor
                border.width: 1
                implicitWidth: recoLabel.implicitWidth + 8
                implicitHeight: recoLabel.implicitHeight + 2
                Label {
                    id: recoLabel
                    anchors.centerIn: parent
                    text: root.performanceRecommendation
                    color: root.performanceRecommendationColor
                    font.pointSize: Kirigami.Theme.smallFont.pointSize * 0.92
                    font.bold: true
                }
            }
        }
    }
    
    // Click handling. z: -1 puts this MouseArea behind the card content
    // so child interactive elements (the favorite button + badges with
    // their own MouseAreas) get clicked first. Hover still works because
    // QML delivers hover events to every item under the cursor.
    MouseArea {
        id: mouseArea
        anchors.fill: parent
        hoverEnabled: true
        z: -1

        // Update root.hovered when mouse enters/exits
        onContainsMouseChanged: root.hovered = containsMouse

        onClicked: root.clicked()
        onDoubleClicked: root.doubleClicked()
    }
    
    // Hover animation
    Behavior on color {
        ColorAnimation { duration: 150 }
    }
    
    Behavior on border.color {
        ColorAnimation { duration: 150 }
    }
}
