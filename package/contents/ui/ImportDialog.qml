// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import QtQuick.Dialogs
import org.kde.kirigami as Kirigami
import "shaderwallpaper"
import "ShaderApply.js" as ShaderApply

// Import from Shadertoy, pasted code, or a local file.
Kirigami.Dialog {
    id: dialog
    parent: QQC2.Overlay.overlay

    // routing: ShaderApply.routingFromShadertoy() output, or null.
    signal shaderImported(string mainCode, var bufferCodes, string commonCode, var routing, var metadata)
    signal shaderFileChosen(url url)

    title: i18n("Import Shader")
    preferredWidth: Kirigami.Units.gridUnit * 38
    padding: Kirigami.Units.largeSpacing
    standardButtons: Kirigami.Dialog.Close

    readonly property bool importing: shadertoyApi.busy

    // Pending multi-pass Shadertoy result, shown for review before import.
    property var pending: null
    property var pendingRouting: null

    onClosed: {
        pending = null
        errorMessage.visible = false
    }

    ShadertoyAPI {
        id: shadertoyApi
        onShaderFetched: function(shaderData) {
            dialog.pendingRouting = ShaderApply.routingFromShadertoy(shaderData)
        }
        onShaderReady: function(mainCode, bufferCodes, commonCode, metadata) {
            const multi = Object.keys(bufferCodes || {}).length > 0 || (commonCode && commonCode.trim().length > 0)
            const result = { mainCode: mainCode, bufferCodes: bufferCodes || {}, commonCode: commonCode || "",
                             metadata: metadata || {}, routing: dialog.pendingRouting }
            if (multi) {
                dialog.pending = result
            } else {
                dialog.finish(result)
            }
        }
        onErrorOccurred: function(error) {
            errorMessage.text = error
            errorMessage.visible = true
        }
    }

    function finish(r) {
        shaderImported(r.mainCode, r.bufferCodes, r.commonCode, r.routing, r.metadata)
        close()
    }

    function passPresent(key) {
        if (!pending) return false
        if (key === "main") return pending.mainCode.length > 0
        if (key === "common") return pending.commonCode.length > 0
        for (const k in pending.bufferCodes) {
            const m = /buffer\s*([a-d])/i.exec(k)
            if (m && m[1].toUpperCase() === key && pending.bufferCodes[k]) return true
        }
        return false
    }

    component CodeArea: QQC2.ScrollView {
        id: codeArea
        property alias text: area.text
        property string hint: "void mainImage(out vec4 fragColor, in vec2 fragCoord)\n{\n}"
        QQC2.TextArea {
            id: area
            font.family: "monospace"
            wrapMode: TextEdit.NoWrap
            placeholderText: codeArea.hint
        }
    }

    ColumnLayout {
        spacing: Kirigami.Units.largeSpacing

        QQC2.TabBar {
            id: tabs
            Layout.fillWidth: true
            visible: dialog.pending === null
            QQC2.TabButton { text: i18n("Shadertoy"); icon.name: "internet-web-browser" }
            QQC2.TabButton { text: i18n("Paste Code"); icon.name: "edit-paste" }
            QQC2.TabButton { text: i18n("File"); icon.name: "document-open" }
        }

        StackLayout {
            id: importStack
            Layout.fillWidth: true
            // Height of the shown page, not the tallest one.
            Layout.preferredHeight: children[currentIndex] ? children[currentIndex].implicitHeight : 0
            visible: dialog.pending === null
            currentIndex: tabs.currentIndex

            // ── Shadertoy ─────────────────────────────────────────────────
            ColumnLayout {
                spacing: Kirigami.Units.smallSpacing
                QQC2.Label {
                    Layout.fillWidth: true
                    text: i18n("Shadertoy link or shader ID:")
                }
                QQC2.TextField {
                    id: urlField
                    Layout.fillWidth: true
                    placeholderText: "https://www.shadertoy.com/view/XXXXXX"
                    onAccepted: if (text.length > 0 && !dialog.importing) apiButton.clicked()
                }
                RowLayout {
                    QQC2.Button {
                        id: apiButton
                        text: i18n("Import")
                        icon.name: "download"
                        enabled: urlField.text.length > 0 && !dialog.importing
                        onClicked: {
                            errorMessage.visible = false
                            dialog.pendingRouting = null
                            shadertoyApi.importFromUrl(urlField.text)
                        }
                    }
                    QQC2.Button {
                        text: i18n("Read from Web Page")
                        icon.name: "globe"
                        enabled: urlField.text.length > 0 && !dialog.importing
                        QQC2.ToolTip.text: i18n("Use when the Shadertoy API refuses the request. Input routing is not available this way.")
                        QQC2.ToolTip.visible: hovered
                        QQC2.ToolTip.delay: Kirigami.Units.toolTipDelay
                        onClicked: {
                            errorMessage.visible = false
                            dialog.pendingRouting = null
                            shadertoyApi.scrapeFromPage(urlField.text)
                        }
                    }
                    QQC2.BusyIndicator {
                        visible: dialog.importing
                        running: visible
                        implicitHeight: Kirigami.Units.iconSizes.smallMedium
                        implicitWidth: implicitHeight
                    }
                }
                QQC2.Label {
                    Layout.fillWidth: true
                    wrapMode: Text.WordWrap
                    font: Kirigami.Theme.smallFont
                    color: Kirigami.Theme.disabledTextColor
                    text: i18n("Shaders that use the keyboard, video, webcam or cube maps import but may not look the same.")
                }
            }

            // ── Paste ─────────────────────────────────────────────────────
            ColumnLayout {
                spacing: Kirigami.Units.smallSpacing
                QQC2.TabBar {
                    id: passTabs
                    Layout.fillWidth: true
                    QQC2.TabButton { text: i18n("Image") }
                    QQC2.TabButton { text: i18n("Common") }
                    QQC2.TabButton { text: i18n("Buffer A") }
                    QQC2.TabButton { text: i18n("Buffer B") }
                    QQC2.TabButton { text: i18n("Buffer C") }
                    QQC2.TabButton { text: i18n("Buffer D") }
                }
                StackLayout {
                    id: pasteStack
                    Layout.fillWidth: true
                    Layout.preferredHeight: Kirigami.Units.gridUnit * 11
                    currentIndex: passTabs.currentIndex
                    CodeArea { id: pasteImage }
                    CodeArea { id: pasteCommon; hint: i18n("// Functions and constants shared by every pass") }
                    CodeArea { id: pasteA }
                    CodeArea { id: pasteB }
                    CodeArea { id: pasteC }
                    CodeArea { id: pasteD }
                }
                QQC2.Button {
                    Layout.alignment: Qt.AlignRight
                    text: i18n("Use This Code")
                    icon.name: "dialog-ok-apply"
                    enabled: pasteImage.text.trim().length > 0
                    onClicked: dialog.finish({
                        mainCode: pasteImage.text, commonCode: pasteCommon.text.trim(),
                        bufferCodes: { BufferA: pasteA.text.trim(), BufferB: pasteB.text.trim(),
                                       BufferC: pasteC.text.trim(), BufferD: pasteD.text.trim() },
                        routing: null, metadata: { source: "paste" }
                    })
                }
            }

            // ── File ──────────────────────────────────────────────────────
            ColumnLayout {
                spacing: Kirigami.Units.smallSpacing
                QQC2.Label {
                    Layout.fillWidth: true
                    wrapMode: Text.WordWrap
                    text: i18n("Adds a .frag file to your library and applies it. Buffer files named like shader_bufferA.frag next to it are picked up too.")
                }
                QQC2.Button {
                    text: i18n("Choose File…")
                    icon.name: "document-open"
                    onClicked: fileDialog.open()
                }
            }
        }

        // ── review of a multi-pass import ─────────────────────────────────
        ColumnLayout {
            Layout.fillWidth: true
            visible: dialog.pending !== null
            spacing: Kirigami.Units.smallSpacing
            Kirigami.Heading {
                level: 3
                Layout.fillWidth: true
                wrapMode: Text.WordWrap
                text: dialog.pending
                    ? i18nc("@title shader name and author", "%1 by %2",
                            dialog.pending.metadata.name || i18n("Untitled"),
                            dialog.pending.metadata.author || i18n("unknown author"))
                    : ""
            }
            QQC2.Label {
                Layout.fillWidth: true
                wrapMode: Text.WordWrap
                text: i18n("This shader has several passes. They are imported together with their input routing.")
            }
            Repeater {
                model: [
                    { key: "main", label: i18n("Image") },
                    { key: "common", label: i18n("Common code") },
                    { key: "A", label: i18n("Buffer A") },
                    { key: "B", label: i18n("Buffer B") },
                    { key: "C", label: i18n("Buffer C") },
                    { key: "D", label: i18n("Buffer D") }
                ]
                delegate: RowLayout {
                    required property var modelData
                    readonly property bool present: dialog.passPresent(modelData.key)
                    visible: present || modelData.key === "main"
                    Kirigami.Icon {
                        implicitWidth: Kirigami.Units.iconSizes.small
                        implicitHeight: Kirigami.Units.iconSizes.small
                        source: present ? "dialog-ok-apply" : "dialog-error"
                        color: present ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.negativeTextColor
                    }
                    QQC2.Label { text: modelData.label }
                }
            }
            RowLayout {
                Layout.alignment: Qt.AlignRight
                QQC2.Button {
                    text: i18n("Back")
                    icon.name: "go-previous"
                    onClicked: dialog.pending = null
                }
                QQC2.Button {
                    text: i18n("Import All Passes")
                    icon.name: "document-import"
                    enabled: dialog.passPresent("main")
                    onClicked: dialog.finish(dialog.pending)
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
    }

    FileDialog {
        id: fileDialog
        title: i18n("Choose Shader File")
        nameFilters: [i18n("Shader files (*.frag *.glsl)"), i18n("All files (*)")]
        onAccepted: {
            ShaderLibrarySingleton.importShader(selectedFile)
            dialog.shaderFileChosen(selectedFile)
            dialog.close()
        }
    }
}
