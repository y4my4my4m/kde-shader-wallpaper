// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import QtQuick.Window
import org.kde.kirigami as Kirigami
import "../shaderwallpaper"

// Persistent header: live preview, current shader, primary actions and the
// screen this page configures.
Item {
    id: header

    required property var root
    readonly property alias previewEngine: previewEngine

    implicitHeight: layout.implicitHeight + Kirigami.Units.largeSpacing * 2

    // The preview renders only while someone can see it: dialog window
    // active and visible, no sheet over the page.
    readonly property bool previewActive: header.visible
        && header.Window.window !== null
        && header.Window.window.visible
        && header.Window.active
        && root.openDialogs === 0

    RowLayout {
        id: layout
        anchors {
            fill: parent
            margins: Kirigami.Units.largeSpacing
        }
        spacing: Kirigami.Units.largeSpacing

        // ── preview ───────────────────────────────────────────────────────
        Rectangle {
            id: previewFrame
            readonly property real targetWidth: Math.max(Kirigami.Units.gridUnit * 8,
                Math.min(Kirigami.Units.gridUnit * 20, header.width * 0.36))
            Layout.preferredWidth: targetWidth
            Layout.preferredHeight: Math.round(targetWidth * 9 / 16)
            Layout.alignment: Qt.AlignTop
            radius: Kirigami.Units.cornerRadius
            color: Kirigami.Theme.alternateBackgroundColor
            border.width: 1
            border.color: root.previewBroken ? Kirigami.Theme.negativeTextColor
                                             : Kirigami.ColorUtils.linearInterpolation(Kirigami.Theme.backgroundColor, Kirigami.Theme.textColor, 0.2)
            clip: true

            ShaderEngine {
                id: previewEngine
                objectName: "previewEngine"
                anchors.fill: parent
                anchors.margins: 1
                // Wheel and clicks pass through to the page.
                enabled: false

                readonly property bool _inline: root.cfg_selectedShaderCode.length > 0
                shaderSource: !_inline && root.cfg_selectedShaderPath.length > 0
                    ? root.engineUrl(root.cfg_selectedShaderPath)
                    : ""
                // Code setters are ignored while a file is bound; see
                // ShaderSystem.qml.
                readonly property bool _inlineMode: String(shaderSource) === ""
                shaderCode: _inlineMode ? root.cfg_selectedShaderCode : ""
                commonCode: _inlineMode ? root.cfg_commonCode : ""
                bufferACode: _inlineMode ? root.cfg_bufferACode : ""
                bufferBCode: _inlineMode ? root.cfg_bufferBCode : ""
                bufferCCode: _inlineMode ? root.cfg_bufferCCode : ""
                bufferDCode: _inlineMode ? root.cfg_bufferDCode : ""

                running: root.cfg_running && header.previewActive
                speed: root.cfg_shaderSpeed
                // Native scale: the tile is at most 20 grid units wide, and the
                // scaled path (glBlitFramebuffer from the low-res FBO) crashed
                // intermittently in the NVIDIA driver here.
                targetFps: 30
                resolutionScale: 1.0
                bufferSimulationMaxHeight: root.cfg_bufferSimulationMaxHeight
                dither: root.cfg_dither
                mouseEnabled: false
                audioEnabled: false
                // Re-pushed after every source change; see ShaderSystem.qml.
                useBufferA: { void shaderSource; return root.cfg_useBufferA }
                useBufferB: { void shaderSource; return root.cfg_useBufferB }
                useBufferC: { void shaderSource; return root.cfg_useBufferC }
                useBufferD: { void shaderSource; return root.cfg_useBufferD }
                iChannel0Enabled: root.cfg_iChannel0Enabled
                iChannel1Enabled: root.cfg_iChannel1Enabled
                iChannel2Enabled: root.cfg_iChannel2Enabled
                iChannel3Enabled: root.cfg_iChannel3Enabled
                iChannel0: root.cfg_iChannel0Enabled && root.cfg_iChannel0 ? root.resolveUrl(root.cfg_iChannel0) : ""
                iChannel1: root.cfg_iChannel1Enabled && root.cfg_iChannel1 ? root.resolveUrl(root.cfg_iChannel1) : ""
                iChannel2: root.cfg_iChannel2Enabled && root.cfg_iChannel2 ? root.resolveUrl(root.cfg_iChannel2) : ""
                iChannel3: root.cfg_iChannel3Enabled && root.cfg_iChannel3 ? root.resolveUrl(root.cfg_iChannel3) : ""
                imageChannels: [root.cfg_imageChannel0, root.cfg_imageChannel1, root.cfg_imageChannel2, root.cfg_imageChannel3]
                bufferAChannels: [root.cfg_bufferAChannel0, root.cfg_bufferAChannel1, root.cfg_bufferAChannel2, root.cfg_bufferAChannel3]
                bufferBChannels: [root.cfg_bufferBChannel0, root.cfg_bufferBChannel1, root.cfg_bufferBChannel2, root.cfg_bufferBChannel3]
                bufferCChannels: [root.cfg_bufferCChannel0, root.cfg_bufferCChannel1, root.cfg_bufferCChannel2, root.cfg_bufferCChannel3]
                bufferDChannels: [root.cfg_bufferDChannel0, root.cfg_bufferDChannel1, root.cfg_bufferDChannel2, root.cfg_bufferDChannel3]
            }

            // Placeholder / error overlay.
            Rectangle {
                anchors.fill: parent
                anchors.margins: 1
                visible: root.previewBroken || (!root.fileBacked && !root.inlineOverride)
                color: Kirigami.Theme.backgroundColor
                ColumnLayout {
                    anchors.centerIn: parent
                    width: parent.width - Kirigami.Units.largeSpacing * 2
                    spacing: Kirigami.Units.smallSpacing
                    Kirigami.Icon {
                        Layout.alignment: Qt.AlignHCenter
                        implicitWidth: Kirigami.Units.iconSizes.medium
                        implicitHeight: Kirigami.Units.iconSizes.medium
                        source: root.previewBroken ? "dialog-error" : "preferences-desktop-wallpaper"
                        color: root.previewBroken ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.disabledTextColor
                    }
                    QQC2.Label {
                        Layout.fillWidth: true
                        horizontalAlignment: Text.AlignHCenter
                        wrapMode: Text.WordWrap
                        text: root.previewBroken ? i18n("Does not compile") : i18n("No shader")
                        color: root.previewBroken ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.disabledTextColor
                    }
                }
            }

            // Play / pause, bound to the wallpaper's own running flag.
            QQC2.RoundButton {
                id: playButton
                anchors {
                    left: parent.left
                    bottom: parent.bottom
                    margins: Kirigami.Units.smallSpacing
                }
                visible: !root.previewBroken
                icon.name: root.cfg_running ? "media-playback-pause" : "media-playback-start"
                display: QQC2.AbstractButton.IconOnly
                text: root.cfg_running ? i18n("Pause the wallpaper") : i18n("Play the wallpaper")
                QQC2.ToolTip.text: text
                QQC2.ToolTip.visible: hovered
                QQC2.ToolTip.delay: Kirigami.Units.toolTipDelay
                onClicked: root.cfg_running = !root.cfg_running
            }

            // Frame cost chip.
            Rectangle {
                anchors {
                    right: parent.right
                    bottom: parent.bottom
                    margins: Kirigami.Units.smallSpacing
                }
                visible: !root.previewBroken && previewEngine.averageFrameTime > 0 && previewEngine.running
                radius: height / 2
                color: Qt.rgba(Kirigami.Theme.backgroundColor.r, Kirigami.Theme.backgroundColor.g,
                               Kirigami.Theme.backgroundColor.b, 0.85)
                implicitWidth: costRow.implicitWidth + Kirigami.Units.largeSpacing
                implicitHeight: costRow.implicitHeight + Kirigami.Units.smallSpacing
                RowLayout {
                    id: costRow
                    anchors.centerIn: parent
                    spacing: Kirigami.Units.smallSpacing
                    Rectangle {
                        implicitWidth: Kirigami.Units.smallSpacing * 2
                        implicitHeight: implicitWidth
                        radius: width / 2
                        color: costLabel.cost <= 4 ? Kirigami.Theme.positiveTextColor
                             : costLabel.cost <= 12 ? Kirigami.Theme.neutralTextColor
                             : Kirigami.Theme.negativeTextColor
                    }
                    QQC2.Label {
                        id: costLabel
                        readonly property real cost: previewEngine.averageFrameTime
                        font: Kirigami.Theme.smallFont
                        text: cost <= 4 ? i18nc("@info GPU cost", "Light")
                            : cost <= 12 ? i18nc("@info GPU cost", "Moderate")
                            : i18nc("@info GPU cost", "Heavy")
                        QQC2.ToolTip.text: i18n("%1 fps in this preview, %2 ms per frame", previewEngine.currentFps,
                                                previewEngine.averageFrameTime.toFixed(1))
                        QQC2.ToolTip.visible: costHover.hovered
                        HoverHandler { id: costHover }
                    }
                }
            }
        }

        // ── shader info and actions ───────────────────────────────────────
        ColumnLayout {
            Layout.fillWidth: true
            Layout.alignment: Qt.AlignTop
            spacing: Kirigami.Units.smallSpacing

            RowLayout {
                Layout.fillWidth: true
                spacing: Kirigami.Units.smallSpacing
                Kirigami.Heading {
                    objectName: "shaderTitle"
                    Layout.fillWidth: true
                    level: 2
                    font.bold: true
                    text: root.currentShaderName
                    elide: Text.ElideRight
                    maximumLineCount: 1
                }
                QQC2.ToolButton {
                    visible: root.currentShaderId.length > 0
                    readonly property bool fav: root.currentShader !== null && root.currentShader.favorite === true
                    icon.name: "love"
                    icon.color: fav ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.disabledTextColor
                    checked: fav
                    display: QQC2.AbstractButton.IconOnly
                    text: fav ? i18n("Remove from favourites") : i18n("Add to favourites")
                    QQC2.ToolTip.text: text
                    QQC2.ToolTip.visible: hovered
                    QQC2.ToolTip.delay: Kirigami.Units.toolTipDelay
                    onClicked: root.toggleFavorite(root.currentShaderId)
                }
            }

            Flow {
                Layout.fillWidth: true
                spacing: Kirigami.Units.smallSpacing
                QQC2.Label {
                    visible: text.length > 0
                    text: root.currentShaderCategory
                    color: Kirigami.Theme.disabledTextColor
                }
                StatusChip {
                    visible: root.isEdited
                    text: i18nc("@info shader running from an edited copy", "Edited")
                    iconName: "document-edit"
                    tone: Kirigami.Theme.neutralTextColor
                    toolTip: i18n("Running an edited copy. The file on disk is unchanged.")
                }
                StatusChip {
                    visible: !root.fileBacked && root.inlineOverride
                    text: i18n("Custom code")
                    iconName: "code-context"
                }
                StatusChip {
                    visible: root.cfg_useBufferA || root.cfg_useBufferB || root.cfg_useBufferC || root.cfg_useBufferD
                    text: i18n("Multi-pass")
                    iconName: "layer-visible-on"
                    toolTip: i18n("Renders through feedback buffers")
                }
                StatusChip {
                    visible: root.cfg_audioEnabled
                    text: i18n("Sound")
                    iconName: "audio-volume-high"
                }
                StatusChip {
                    visible: root.cfg_mouseEnabled
                    text: i18n("Mouse")
                    iconName: "input-mouse"
                }
                StatusChip {
                    visible: root.cfg_windowsEnabled
                    text: i18n("Windows")
                    iconName: "window"
                }
            }

            RowLayout {
                Layout.fillWidth: true
                Layout.topMargin: Kirigami.Units.smallSpacing
                spacing: Kirigami.Units.smallSpacing
                QQC2.Button {
                    objectName: "browseButton"
                    text: i18n("Browse")
                    icon.name: "view-list-icons"
                    onClicked: root.focusGallery()
                }
                QQC2.Button {
                    text: i18n("Shuffle")
                    icon.name: "media-playlist-shuffle"
                    QQC2.ToolTip.text: i18n("Apply a random shader from the gallery's current selection")
                    QQC2.ToolTip.visible: hovered
                    QQC2.ToolTip.delay: Kirigami.Units.toolTipDelay
                    onClicked: root.shuffle()
                }
                QQC2.ToolButton {
                    id: overflowButton
                    objectName: "overflowButton"
                    icon.name: "overflow-menu"
                    display: QQC2.AbstractButton.IconOnly
                    text: i18n("More actions")
                    QQC2.ToolTip.text: text
                    QQC2.ToolTip.visible: hovered
                    QQC2.ToolTip.delay: Kirigami.Units.toolTipDelay
                    down: overflowMenu.visible
                    onPressed: overflowMenu.visible ? overflowMenu.close() : overflowMenu.popup(overflowButton, 0, overflowButton.height)

                    QQC2.Menu {
                        id: overflowMenu
                        objectName: "overflowMenu"
                        QQC2.MenuItem {
                            text: i18n("Import from Shadertoy…")
                            icon.name: "document-import"
                            onTriggered: root.openImport()
                        }
                        QQC2.MenuItem {
                            text: i18n("Open File…")
                            icon.name: "document-open"
                            onTriggered: root.openShaderFile()
                        }
                        QQC2.MenuItem {
                            text: i18n("Get More Shaders…")
                            icon.name: "get-hot-new-stuff"
                            onTriggered: root.openGetMore()
                        }
                        QQC2.MenuSeparator {}
                        QQC2.MenuItem {
                            text: i18n("Regenerate Thumbnail")
                            icon.name: "view-refresh"
                            enabled: root.fileBacked && !root.inlineOverride && !root.previewBroken
                                     && previewEngine.currentFps > 0
                            onTriggered: {
                                if (root.captureThumbnailForCurrentShader(true))
                                    root.showStatus(i18n("Thumbnail updated."), Kirigami.MessageType.Positive)
                            }
                        }
                        QQC2.MenuItem {
                            text: i18n("Open in Editor")
                            icon.name: "document-edit"
                            enabled: root.fileBacked
                            onTriggered: root.openInEditor()
                        }
                        QQC2.MenuItem {
                            text: i18n("Revert to Original File")
                            icon.name: "edit-undo"
                            visible: root.isEdited
                            height: visible ? implicitHeight : 0
                            onTriggered: root.revertToFile()
                        }
                    }
                }
                Item { Layout.fillWidth: true }
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: Kirigami.Units.smallSpacing
                visible: root.screenName.length > 0 || root.multiScreen
                Kirigami.Icon {
                    implicitWidth: Kirigami.Units.iconSizes.small
                    implicitHeight: Kirigami.Units.iconSizes.small
                    source: "video-display"
                    color: Kirigami.Theme.disabledTextColor
                }
                QQC2.Label {
                    Layout.fillWidth: true
                    elide: Text.ElideRight
                    color: Kirigami.Theme.disabledTextColor
                    text: root.screenName.length > 0
                        ? i18nc("@info which monitor these settings apply to", "Screen: %1", root.screenName)
                        : i18n("Settings for one screen")
                }
                QQC2.Button {
                    objectName: "applyAllScreensButton"
                    visible: root.wallpaperSyncAvailable
                    enabled: !root.syncBusy
                    flat: true
                    icon.name: "monitor"
                    text: i18n("Apply to All Screens")
                    onClicked: root.confirmApplyToAllScreens()
                }
            }
        }
    }
}
