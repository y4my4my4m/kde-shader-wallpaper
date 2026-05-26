// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs
import org.kde.kirigami as Kirigami
import "shaderwallpaper"

/**
 * Panel for managing shader presets
 */
ColumnLayout {
    id: root
    
    property var currentConfig: ({})
    
    signal presetLoaded(var config)
    signal presetSaved(string name)
    
    PresetManager {
        id: presetManager
        
        onPresetLoaded: (name, config) => {
            root.presetLoaded(config)
        }
        
        onError: (message) => {
            errorLabel.text = message
            errorLabel.visible = true
        }
    }
    
    spacing: Kirigami.Units.smallSpacing
    
    // Header
    RowLayout {
        Layout.fillWidth: true
        
        Label {
            text: i18n("Presets")
            font.bold: true
        }
        
        Item { Layout.fillWidth: true }
        
        Button {
            icon.name: "list-add"
            text: i18n("Save")
            
            onClicked: saveDialog.open()
        }
    }
    
    // Preset list
    ScrollView {
        Layout.fillWidth: true
        Layout.preferredHeight: 150
        
        ListView {
            id: presetList
            
            model: presetManager.presetNames
            
            delegate: ItemDelegate {
                width: presetList.width
                
                contentItem: RowLayout {
                    Label {
                        Layout.fillWidth: true
                        text: modelData
                        elide: Text.ElideRight
                    }
                    
                    ToolButton {
                        icon.name: "document-open"
                        
                        onClicked: presetManager.loadPreset(modelData)
                        
                        ToolTip.visible: hovered
                        ToolTip.text: i18n("Load preset")
                    }
                    
                    ToolButton {
                        icon.name: "edit-delete"
                        
                        onClicked: {
                            deleteConfirmDialog.presetName = modelData
                            deleteConfirmDialog.open()
                        }
                        
                        ToolTip.visible: hovered
                        ToolTip.text: i18n("Delete preset")
                    }
                }
                
                highlighted: presetManager.currentPreset === modelData
                
                onClicked: presetManager.loadPreset(modelData)
            }
            
            // Empty state
            Label {
                anchors.centerIn: parent
                visible: presetList.count === 0
                text: i18n("No presets saved yet")
                opacity: 0.6
            }
        }
    }
    
    // Current preset info
    Label {
        visible: presetManager.currentPreset.length > 0
        text: i18n("Current: %1", presetManager.currentPreset)
        font.italic: true
        opacity: 0.7
    }
    
    // Error message
    Kirigami.InlineMessage {
        id: errorLabel
        Layout.fillWidth: true
        type: Kirigami.MessageType.Error
        visible: false
        showCloseButton: true
    }
    
    // Import/Export buttons
    RowLayout {
        Layout.fillWidth: true
        
        Button {
            text: i18n("Import")
            icon.name: "document-import"
            
            onClicked: importFileDialog.open()
        }
        
        Button {
            text: i18n("Export")
            icon.name: "document-export"
            enabled: presetManager.currentPreset.length > 0
            
            onClicked: exportFileDialog.open()
        }
    }
    
    // Save preset dialog
    Dialog {
        id: saveDialog
        title: i18n("Save Preset")
        standardButtons: Dialog.Ok | Dialog.Cancel
        
        ColumnLayout {
            anchors.fill: parent
            
            Label {
                text: i18n("Preset name:")
            }
            
            TextField {
                id: presetNameField
                Layout.fillWidth: true
                placeholderText: i18n("My Shader Preset")
            }
        }
        
        onAccepted: {
            if (presetNameField.text.length > 0) {
                presetManager.savePreset(presetNameField.text, root.currentConfig)
                presetNameField.text = ""
                root.presetSaved(presetNameField.text)
            }
        }
    }
    
    // Delete confirmation dialog
    Dialog {
        id: deleteConfirmDialog
        title: i18n("Delete Preset")
        standardButtons: Dialog.Yes | Dialog.No
        
        property string presetName: ""
        
        Label {
            text: i18n("Are you sure you want to delete '%1'?", deleteConfirmDialog.presetName)
        }
        
        onAccepted: {
            presetManager.deletePreset(presetName)
        }
    }
    
    // File dialogs
    FileDialog {
        id: importFileDialog
        title: i18n("Import Preset")
        nameFilters: ["Preset files (*.json)", "All files (*)"]
        fileMode: FileDialog.OpenFile
        
        onAccepted: {
            presetManager.importPreset(selectedFile)
        }
    }
    
    FileDialog {
        id: exportFileDialog
        title: i18n("Export Preset")
        nameFilters: ["Preset files (*.json)"]
        fileMode: FileDialog.SaveFile
        defaultSuffix: "json"
        
        onAccepted: {
            presetManager.exportPreset(presetManager.currentPreset, selectedFile)
        }
    }
}

