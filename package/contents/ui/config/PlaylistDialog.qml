// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import "../shaderwallpaper"
import "../ShaderApply.js" as ShaderApply

Kirigami.Dialog {
    id: dialog
    parent: QQC2.Overlay.overlay

    required property var root
    readonly property var entries: root.cfg_playlistShaders || []

    title: i18n("Playlist")
    preferredWidth: Kirigami.Units.gridUnit * 34
    preferredHeight: Kirigami.Units.gridUnit * 26
    standardButtons: Kirigami.Dialog.Close

    customFooterActions: [
        Kirigami.Action {
            text: i18n("Add Current Shader")
            icon.name: "list-add"
            enabled: dialog.root.fileBacked
                     && dialog.entries.indexOf(ShaderLibrarySingleton.toRelativeShaderPath(dialog.root.cfg_selectedShaderPath)) < 0
            onTriggered: dialog.root.addToPlaylist(dialog.root.cfg_selectedShaderPath)
        },
        Kirigami.Action {
            text: i18n("Clear")
            icon.name: "edit-clear-all"
            enabled: dialog.entries.length > 0
            onTriggered: dialog.root.cfg_playlistShaders = []
        }
    ]

    function move(from, to) {
        const list = Array.prototype.slice.call(entries)
        if (to < 0 || to >= list.length) return
        const item = list.splice(from, 1)[0]
        list.splice(to, 0, item)
        root.cfg_playlistShaders = list
    }
    function removeAt(i) {
        const list = Array.prototype.slice.call(entries)
        list.splice(i, 1)
        root.cfg_playlistShaders = list
    }

    ListView {
        id: list
        clip: true
        model: dialog.entries
        implicitHeight: contentHeight

        delegate: QQC2.ItemDelegate {
            id: row
            required property string modelData
            required property int index
            readonly property var meta: ShaderLibrarySingleton.getShaderByPath(modelData)
            width: ListView.view.width
            text: meta ? meta.name : ShaderApply.displayName(modelData)
            onClicked: dialog.root.applyShaderFromPath(modelData)
            contentItem: RowLayout {
                spacing: Kirigami.Units.largeSpacing
                QQC2.Label {
                    text: (row.index + 1).toString()
                    color: Kirigami.Theme.disabledTextColor
                    Layout.preferredWidth: Kirigami.Units.gridUnit
                    horizontalAlignment: Text.AlignRight
                }
                Rectangle {
                    Layout.preferredWidth: Kirigami.Units.gridUnit * 3
                    Layout.preferredHeight: Kirigami.Units.gridUnit * 1.7
                    radius: Kirigami.Units.cornerRadius
                    color: Kirigami.Theme.alternateBackgroundColor
                    clip: true
                    Image {
                        anchors.fill: parent
                        source: row.meta && row.meta.thumbnailPath ? row.meta.thumbnailPath : ""
                        asynchronous: true
                        fillMode: Image.PreserveAspectCrop
                        sourceSize.width: width * 2
                        sourceSize.height: height * 2
                    }
                }
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 0
                    QQC2.Label {
                        Layout.fillWidth: true
                        text: row.text
                        elide: Text.ElideRight
                        font.bold: ShaderLibrarySingleton.toRelativeShaderPath(dialog.root.cfg_selectedShaderPath) === row.modelData
                    }
                    QQC2.Label {
                        Layout.fillWidth: true
                        visible: !row.meta
                        text: i18n("Missing from the library")
                        font: Kirigami.Theme.smallFont
                        color: Kirigami.Theme.negativeTextColor
                    }
                }
                QQC2.ToolButton {
                    icon.name: "arrow-up"
                    display: QQC2.AbstractButton.IconOnly
                    text: i18n("Move up")
                    enabled: row.index > 0
                    onClicked: dialog.move(row.index, row.index - 1)
                }
                QQC2.ToolButton {
                    icon.name: "arrow-down"
                    display: QQC2.AbstractButton.IconOnly
                    text: i18n("Move down")
                    enabled: row.index < dialog.entries.length - 1
                    onClicked: dialog.move(row.index, row.index + 1)
                }
                QQC2.ToolButton {
                    icon.name: "list-remove"
                    display: QQC2.AbstractButton.IconOnly
                    text: i18n("Remove")
                    QQC2.ToolTip.text: text
                    QQC2.ToolTip.visible: hovered
                    onClicked: dialog.removeAt(row.index)
                }
            }
        }

        Kirigami.PlaceholderMessage {
            anchors.centerIn: parent
            width: Math.max(0, parent.width - Kirigami.Units.gridUnit * 4)
            visible: list.count === 0
            icon.name: "view-media-playlist"
            text: i18n("The playlist is empty")
            explanation: i18n("Right-click a shader in the gallery and choose Add to Playlist, or add the current shader below.")
        }
    }
}
