// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs
import org.kde.kirigami as Kirigami
import "shaderwallpaper"

/**
 * Dialog for importing shaders from Shadertoy or files
 */
Kirigami.OverlaySheet {
    id: root
    
    property bool importing: shadertoyApi.busy
    
    // Emitted for main shader code (simple shaders)
    signal shaderImported(string code, var metadata)
    // Emitted when shader with buffers/common code is imported
    signal shaderWithBuffersImported(string mainCode, var bufferCodes, string commonCode, var metadata)
    
    title: i18n("Import Shader")
    
    ShadertoyAPI {
        id: shadertoyApi
        
        onShaderReady: (mainCode, bufferCodes, commonCode, metadata) => {
            // Check if we have buffer codes or common code
            let hasBuffers = Object.keys(bufferCodes).length > 0
            let hasCommon = commonCode && commonCode.trim().length > 0
            
            if (hasBuffers || hasCommon) {
                // Show buffer confirmation dialog
                bufferPreviewDialog.mainCode = mainCode
                bufferPreviewDialog.bufferCodes = bufferCodes
                bufferPreviewDialog.commonCode = commonCode || ""
                bufferPreviewDialog.metadata = metadata
                bufferPreviewDialog.open()
            } else {
                root.shaderImported(mainCode, metadata)
                root.close()
            }
        }
        
        onErrorOccurred: (error) => {
            errorLabel.text = error
            errorLabel.visible = true
        }
    }
    
    ColumnLayout {
        spacing: Kirigami.Units.largeSpacing
        // Pin both implicit dimensions so Kirigami's OverlaySheet has
        // stable size hints with no chance of a binding loop.
        implicitWidth: Kirigami.Units.gridUnit * 30
        Layout.preferredWidth: Kirigami.Units.gridUnit * 30

        // Import method tabs
        TabBar {
            id: importTabs
            Layout.fillWidth: true
            
            TabButton {
                text: i18n("Shadertoy URL")
                icon.name: "internet-web-browser"
            }
            
            TabButton {
                text: i18n("Paste Code")
                icon.name: "edit-paste"
            }
            
            TabButton {
                text: i18n("Local File")
                icon.name: "document-open"
            }
        }
        
        StackLayout {
            Layout.fillWidth: true
            currentIndex: importTabs.currentIndex
            
            // Shadertoy URL import
            ColumnLayout {
                spacing: Kirigami.Units.smallSpacing
                
                Label {
                    text: i18n("Enter a Shadertoy URL or shader ID:")
                }
                
                TextField {
                    id: shadertoyUrlField
                    Layout.fillWidth: true
                    placeholderText: "https://www.shadertoy.com/view/XXXXXX"
                }
                
                RowLayout {
                    spacing: Kirigami.Units.smallSpacing
                    
                    Button {
                        text: i18n("Import via API")
                        enabled: shadertoyUrlField.text.length > 0 && !root.importing
                        icon.name: "download"
                        
                        ToolTip.visible: hovered
                        ToolTip.text: i18n("Use Shadertoy API (requires working API)")
                        ToolTip.delay: 500
                        
                        onClicked: {
                            errorLabel.visible = false
                            shadertoyApi.importFromUrl(shadertoyUrlField.text)
                        }
                    }
                    
                    Button {
                        text: i18n("Scrape Page")
                        enabled: shadertoyUrlField.text.length > 0 && !root.importing
                        icon.name: "globe"
                        
                        ToolTip.visible: hovered
                        ToolTip.text: i18n("Scrape shader directly from webpage (use when API is unavailable)")
                        ToolTip.delay: 500
                        
                        onClicked: {
                            errorLabel.visible = false
                            shadertoyApi.scrapeFromPage(shadertoyUrlField.text)
                        }
                    }
                }
                
                // API status warning
                Kirigami.InlineMessage {
                    Layout.fillWidth: true
                    type: Kirigami.MessageType.Warning
                    text: i18n("Shadertoy API may be temporarily unavailable. Try 'Scrape Page' if API import fails.")
                    visible: !root.importing
                }
                
                // Progress indicator
                ProgressBar {
                    Layout.fillWidth: true
                    visible: root.importing
                    indeterminate: true
                }
                
                Label {
                    visible: root.importing
                    text: i18n("Fetching shader from Shadertoy...")
                }
            }
            
            // Paste code import
            ColumnLayout {
                spacing: Kirigami.Units.smallSpacing
                
                Label {
                    text: i18n("Paste your shader code (mainImage function):")
                }
                
                // Tab bar for Common/Main/Buffer selection
                TabBar {
                    id: codePassTabs
                    Layout.fillWidth: true
                    
                    TabButton { text: i18n("Common") }
                    TabButton { text: i18n("Main Image") }
                    TabButton { text: i18n("Buffer A") }
                    TabButton { text: i18n("Buffer B") }
                    TabButton { text: i18n("Buffer C") }
                    TabButton { text: i18n("Buffer D") }
                }
                
                StackLayout {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 180
                    currentIndex: codePassTabs.currentIndex
                    
                    ScrollView {
                        TextArea {
                            id: commonCodeArea
                            font.family: "monospace"
                            placeholderText: "// Shared code (functions, constants, structs)\n// This is prepended to ALL passes\n\n#define PI 3.14159265359\n\nfloat hash(vec2 p) { ... }"
                            wrapMode: TextEdit.NoWrap
                        }
                    }
                    
                    ScrollView {
                        TextArea {
                            id: codeTextArea
                            font.family: "monospace"
                            placeholderText: "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n    // Your main image shader code here\n}"
                            wrapMode: TextEdit.NoWrap
                        }
                    }
                    
                    ScrollView {
                        TextArea {
                            id: bufferACode
                            font.family: "monospace"
                            placeholderText: "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n    // Buffer A code (leave empty if not used)\n}"
                            wrapMode: TextEdit.NoWrap
                        }
                    }
                    
                    ScrollView {
                        TextArea {
                            id: bufferBCode
                            font.family: "monospace"
                            placeholderText: "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n    // Buffer B code (leave empty if not used)\n}"
                            wrapMode: TextEdit.NoWrap
                        }
                    }
                    
                    ScrollView {
                        TextArea {
                            id: bufferCCode
                            font.family: "monospace"
                            placeholderText: "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n    // Buffer C code (leave empty if not used)\n}"
                            wrapMode: TextEdit.NoWrap
                        }
                    }
                    
                    ScrollView {
                        TextArea {
                            id: bufferDCode
                            font.family: "monospace"
                            placeholderText: "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n    // Buffer D code (leave empty if not used)\n}"
                            wrapMode: TextEdit.NoWrap
                        }
                    }
                }
                
                RowLayout {
                    TextField {
                        id: shaderNameField
                        Layout.fillWidth: true
                        placeholderText: i18n("Shader name (optional)")
                    }
                    
                    Button {
                        text: i18n("Import")
                        enabled: codeTextArea.text.length > 0
                        icon.name: "document-import"
                        
                        onClicked: {
                            let metadata = {
                                name: shaderNameField.text || "Custom Shader",
                                author: "User",
                                source: "paste"
                            }
                            
                            // Collect buffer codes
                            let bufferCodes = {}
                            if (bufferACode.text.trim()) bufferCodes["BufferA"] = bufferACode.text
                            if (bufferBCode.text.trim()) bufferCodes["BufferB"] = bufferBCode.text
                            if (bufferCCode.text.trim()) bufferCodes["BufferC"] = bufferCCode.text
                            if (bufferDCode.text.trim()) bufferCodes["BufferD"] = bufferDCode.text
                            
                            let commonCode = commonCodeArea.text.trim()
                            
                            if (Object.keys(bufferCodes).length > 0 || commonCode) {
                                root.shaderWithBuffersImported(codeTextArea.text, bufferCodes, commonCode, metadata)
                            } else {
                                root.shaderImported(codeTextArea.text, metadata)
                            }
                            root.close()
                        }
                    }
                }
                
                Label {
                    Layout.fillWidth: true
                    wrapMode: Text.WordWrap
                    font.italic: true
                    opacity: 0.7
                    text: i18n("Tip: Use 'Common' for shared functions/constants. For multi-pass shaders, paste each buffer's code in its respective tab.")
                }
            }
            
            // Local file import
            ColumnLayout {
                spacing: Kirigami.Units.smallSpacing
                
                Label {
                    text: i18n("Select a shader file (.frag, .glsl):")
                }
                
                RowLayout {
                    TextField {
                        id: filePathField
                        Layout.fillWidth: true
                        readOnly: true
                        placeholderText: i18n("No file selected")
                    }
                    
                    Button {
                        text: i18n("Browse...")
                        icon.name: "document-open"
                        
                        onClicked: fileDialog.open()
                    }
                }
                
                Button {
                    text: i18n("Import")
                    enabled: filePathField.text.length > 0
                    icon.name: "document-import"
                    Layout.alignment: Qt.AlignRight
                    
                    onClicked: {
                        ShaderLibrarySingleton.importShader(filePathField.text)
                        root.close()
                    }
                }
            }
        }
        
        // Error message
        Kirigami.InlineMessage {
            id: errorLabel
            Layout.fillWidth: true
            type: Kirigami.MessageType.Error
            visible: false
            showCloseButton: true
        }
        
        // Tips
        Kirigami.InlineMessage {
            Layout.fillWidth: true
            type: Kirigami.MessageType.Information
            text: i18n("Note: Complex shaders with multiple buffers may require additional setup.")
            visible: importTabs.currentIndex === 0
        }
    }
    
    FileDialog {
        id: fileDialog
        title: i18n("Select Shader File")
        nameFilters: ["Shader files (*.frag *.glsl)", "All files (*)"]
        
        onAccepted: {
            filePathField.text = selectedFile
        }
    }
    
    // Buffer preview/confirmation dialog
    Kirigami.OverlaySheet {
        id: bufferPreviewDialog
        
        property string mainCode: ""
        property var bufferCodes: ({})
        property string commonCode: ""
        property var metadata: ({})
        
        title: i18n("Multi-Pass Shader Detected")
        
        ColumnLayout {
            spacing: Kirigami.Units.largeSpacing
            implicitWidth: Kirigami.Units.gridUnit * 35
            Layout.preferredWidth: Kirigami.Units.gridUnit * 35

            Kirigami.InlineMessage {
                Layout.fillWidth: true
                type: Kirigami.MessageType.Information
                text: i18n("This shader uses multiple render passes and/or shared code. Review and import below.")
            }
            
            // Shader info
            Label {
                text: i18n("Shader: %1 by %2", 
                    bufferPreviewDialog.metadata.name || "Unknown",
                    bufferPreviewDialog.metadata.author || "Unknown")
                font.bold: true
            }
            
            // Pass summary
            GridLayout {
                Layout.fillWidth: true
                columns: 2
                columnSpacing: Kirigami.Units.largeSpacing
                rowSpacing: Kirigami.Units.smallSpacing
                
                Label { text: i18n("Common:"); font.bold: true }
                Label { 
                    text: bufferPreviewDialog.commonCode ? "✓ " + i18n("Present (%1 chars)", bufferPreviewDialog.commonCode.length) : "—"
                    color: bufferPreviewDialog.commonCode ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.disabledTextColor
                }
                
                Label { text: i18n("Main Image:"); font.bold: true }
                Label { 
                    text: bufferPreviewDialog.mainCode ? "✓ " + i18n("Present") : "✗ " + i18n("Missing")
                    color: bufferPreviewDialog.mainCode ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.negativeTextColor
                }
                
                Label { text: "Buffer A:"; font.bold: true }
                Label { 
                    text: bufferPreviewDialog.bufferCodes["BufferA"] ? "✓ " + i18n("Present") : "—"
                    color: bufferPreviewDialog.bufferCodes["BufferA"] ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.disabledTextColor
                }
                
                Label { text: "Buffer B:"; font.bold: true }
                Label { 
                    text: bufferPreviewDialog.bufferCodes["BufferB"] ? "✓ " + i18n("Present") : "—"
                    color: bufferPreviewDialog.bufferCodes["BufferB"] ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.disabledTextColor
                }
                
                Label { text: "Buffer C:"; font.bold: true }
                Label { 
                    text: bufferPreviewDialog.bufferCodes["BufferC"] ? "✓ " + i18n("Present") : "—"
                    color: bufferPreviewDialog.bufferCodes["BufferC"] ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.disabledTextColor
                }
                
                Label { text: "Buffer D:"; font.bold: true }
                Label { 
                    text: bufferPreviewDialog.bufferCodes["BufferD"] ? "✓ " + i18n("Present") : "—"
                    color: bufferPreviewDialog.bufferCodes["BufferD"] ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.disabledTextColor
                }
            }
            
            Kirigami.Separator { Layout.fillWidth: true }
            
            Label {
                Layout.fillWidth: true
                wrapMode: Text.WordWrap
                text: i18n("Note: After importing, make sure to:\n" +
                          "1. Enable the required buffers in the 'Shader Buffers' section\n" +
                          "2. Configure iChannel inputs to connect buffers correctly\n" +
                          "3. Common code is automatically prepended to all passes")
            }
            
            RowLayout {
                Layout.alignment: Qt.AlignRight
                spacing: Kirigami.Units.smallSpacing
                
                Button {
                    text: i18n("Cancel")
                    icon.name: "dialog-cancel"
                    onClicked: bufferPreviewDialog.close()
                }
                
                Button {
                    text: i18n("Import All")
                    icon.name: "document-import"
                    highlighted: true
                    
                    onClicked: {
                        root.shaderWithBuffersImported(
                            bufferPreviewDialog.mainCode,
                            bufferPreviewDialog.bufferCodes,
                            bufferPreviewDialog.commonCode,
                            bufferPreviewDialog.metadata
                        )
                        bufferPreviewDialog.close()
                        root.close()
                    }
                }
            }
        }
    }
}

