// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import QtQuick.Dialogs
import org.kde.kirigami as Kirigami
import "shaderwallpaper"
import "ShaderApply.js" as ShaderApply

// Saved shader setups: shader, buffers, routing, images, inputs, playback.
ColumnLayout {
    id: panel

    // The settings page (ConfigContent); cfg_* are read and written on it.
    required property var root

    signal presetLoaded(var config)
    signal presetSaved(string name)

    spacing: Kirigami.Units.smallSpacing

    PresetManager {
        id: presetManager
        onPresetLoaded: function(name, config) {
            panel.root.applyConfigMap(ShaderApply.configFromPreset(ShaderLibrarySingleton, config))
            panel.presetLoaded(config)
        }
        onError: function(message) {
            errorMessage.text = message
            errorMessage.visible = true
        }
    }

    QQC2.Label {
        Layout.fillWidth: true
        text: i18n("A preset stores the shader with its buffers, inputs, images and playback settings.")
        wrapMode: Text.WordWrap
        font: Kirigami.Theme.smallFont
        color: Kirigami.Theme.disabledTextColor
    }

    QQC2.ScrollView {
        Layout.fillWidth: true
        Layout.preferredHeight: Math.min(Kirigami.Units.gridUnit * 9,
                                         Math.max(Kirigami.Units.gridUnit * 3, presetList.contentHeight + 2))
        ListView {
            id: presetList
            clip: true
            model: presetManager.presetNames
            delegate: QQC2.ItemDelegate {
                required property string modelData
                width: ListView.view.width
                highlighted: presetManager.currentPreset === modelData
                text: modelData
                onClicked: presetManager.loadPreset(modelData)
                contentItem: RowLayout {
                    QQC2.Label {
                        Layout.fillWidth: true
                        text: modelData
                        elide: Text.ElideRight
                    }
                    QQC2.ToolButton {
                        icon.name: "edit-delete"
                        display: QQC2.AbstractButton.IconOnly
                        text: i18n("Delete preset")
                        QQC2.ToolTip.text: text
                        QQC2.ToolTip.visible: hovered
                        onClicked: {
                            deletePrompt.presetName = modelData
                            deletePrompt.open()
                        }
                    }
                }
            }
            Kirigami.PlaceholderMessage {
                anchors.centerIn: parent
                width: parent.width - Kirigami.Units.largeSpacing * 2
                visible: presetList.count === 0
                text: i18n("No presets yet")
            }
        }
    }

    Kirigami.InlineMessage {
        id: errorMessage
        Layout.fillWidth: true
        type: Kirigami.MessageType.Error
        showCloseButton: true
        visible: false
    }

    RowLayout {
        Layout.fillWidth: true
        QQC2.Button {
            icon.name: "list-add"
            text: i18n("Save Current…")
            onClicked: savePrompt.open()
        }
        Item { Layout.fillWidth: true }
        QQC2.Button {
            icon.name: "document-import"
            text: i18n("Import…")
            onClicked: importFileDialog.open()
        }
        QQC2.Button {
            icon.name: "document-export"
            text: i18n("Export…")
            enabled: presetManager.currentPreset.length > 0
            onClicked: exportFileDialog.open()
        }
    }

    Kirigami.PromptDialog {
        id: savePrompt
        parent: QQC2.Overlay.overlay
        title: i18n("Save Preset")
        standardButtons: Kirigami.Dialog.Cancel
        onOpened: {
            nameField.text = panel.root.currentShaderName
            nameField.selectAll()
            nameField.forceActiveFocus()
        }
        function save() {
            const name = nameField.text.trim()
            if (name.length === 0) return
            presetManager.savePreset(name, ShaderApply.presetFromConfig(panel.root, "cfg_"))
            presetManager.currentPreset = name
            panel.presetSaved(name)
            close()
        }
        customFooterActions: [
            Kirigami.Action {
                text: i18n("Save")
                icon.name: "document-save"
                enabled: nameField.text.trim().length > 0
                onTriggered: savePrompt.save()
            }
        ]
        QQC2.TextField {
            id: nameField
            Layout.fillWidth: true
            placeholderText: i18n("Preset name")
            onAccepted: savePrompt.save()
        }
    }

    Kirigami.PromptDialog {
        id: deletePrompt
        parent: QQC2.Overlay.overlay
        property string presetName
        title: i18n("Delete Preset")
        subtitle: i18n("Delete “%1”? This cannot be undone.", presetName)
        standardButtons: Kirigami.Dialog.Cancel
        customFooterActions: [
            Kirigami.Action {
                text: i18n("Delete")
                icon.name: "edit-delete"
                onTriggered: {
                    presetManager.deletePreset(deletePrompt.presetName)
                    deletePrompt.close()
                }
            }
        ]
    }

    FileDialog {
        id: importFileDialog
        title: i18n("Import Preset")
        nameFilters: [i18n("Preset files (*.json)"), i18n("All files (*)")]
        fileMode: FileDialog.OpenFile
        onAccepted: presetManager.importPreset(decodeURIComponent(selectedFile.toString().replace(/^file:\/\//, "")))
    }

    FileDialog {
        id: exportFileDialog
        title: i18n("Export Preset")
        nameFilters: [i18n("Preset files (*.json)")]
        fileMode: FileDialog.SaveFile
        defaultSuffix: "json"
        onAccepted: presetManager.exportPreset(presetManager.currentPreset,
                                               decodeURIComponent(selectedFile.toString().replace(/^file:\/\//, "")))
    }
}
