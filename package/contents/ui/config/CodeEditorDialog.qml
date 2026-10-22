// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import "../shaderwallpaper"
import "../ShaderApply.js" as ShaderApply

// Code editor for every pass. A library shader opens with its files' code;
// the first edit switches the wallpaper to an in-config copy of all passes
// (selectedShaderCode set, path kept as identity). The file on disk is never
// written. Edits reach the config 400 ms after the last keystroke.
Kirigami.Dialog {
    id: dialog
    parent: QQC2.Overlay.overlay

    required property var root

    title: i18n("Edit Shader Code")
    preferredWidth: Kirigami.Units.gridUnit * 56
    padding: Kirigami.Units.largeSpacing
    standardButtons: Kirigami.Dialog.Close

    readonly property var passes: [
        { key: "main", label: i18n("Image"), cfg: "cfg_selectedShaderCode" },
        { key: "common", label: i18n("Common"), cfg: "cfg_commonCode" },
        { key: "A", label: i18n("Buffer A"), cfg: "cfg_bufferACode", use: "cfg_useBufferA" },
        { key: "B", label: i18n("Buffer B"), cfg: "cfg_bufferBCode", use: "cfg_useBufferB" },
        { key: "C", label: i18n("Buffer C"), cfg: "cfg_bufferCCode", use: "cfg_useBufferC" },
        { key: "D", label: i18n("Buffer D"), cfg: "cfg_bufferDCode", use: "cfg_useBufferD" }
    ]
    property bool _loading: false

    function load() {
        _loading = true
        const r = root
        let disk = {}
        if (r.fileBacked && !r.inlineOverride)
            disk = ShaderLibrarySingleton.loadBufferCodes(ShaderApply.toFileUrl(ShaderLibrarySingleton, r.cfg_selectedShaderPath)) || {}
        editors.itemAt(0).text = r.mainCode()
        editors.itemAt(1).text = r.cfg_commonCode || disk.commonCode || ""
        const names = ["A", "B", "C", "D"]
        for (let i = 0; i < 4; i++)
            editors.itemAt(2 + i).text = r["cfg_buffer" + names[i] + "Code"] || disk["buffer" + names[i] + "Code"] || ""
        _loading = false
    }

    function commit() {
        commitTimer.stop()
        const r = root
        const texts = []
        for (let i = 0; i < 6; i++) texts.push(editors.itemAt(i).text)
        // Buffers and common code first: they must be in the config before
        // selectedShaderCode switches the engines away from the files.
        for (let j = 1; j < 6; j++)
            if (r[passes[j].cfg] !== texts[j]) r[passes[j].cfg] = texts[j]
        r.setInlineCode(texts[0])
    }

    customFooterActions: [
        Kirigami.Action {
            text: i18n("Clear All Buffer Code")
            icon.name: "edit-clear-all"
            onTriggered: {
                for (let i = 1; i < 6; i++) editors.itemAt(i).text = ""
                dialog.commit()
            }
        }
    ]

    onOpened: {
        tabs.currentIndex = 0
        load()
    }
    onClosed: if (commitTimer.running) commit()

    Timer {
        id: commitTimer
        interval: 400
        onTriggered: dialog.commit()
    }

    ColumnLayout {
        spacing: Kirigami.Units.smallSpacing

        Kirigami.InlineMessage {
            Layout.fillWidth: true
            visible: dialog.root.fileBacked
            type: dialog.root.isEdited ? Kirigami.MessageType.Warning : Kirigami.MessageType.Information
            text: dialog.root.isEdited
                ? i18n("Running your edited copy. The file on disk is unchanged.")
                : i18n("Edits apply to a copy; the file on disk is never changed.")
            actions: [
                Kirigami.Action {
                    text: i18n("Revert to File")
                    icon.name: "edit-undo"
                    visible: dialog.root.isEdited
                    onTriggered: {
                        commitTimer.stop()
                        dialog.root.revertToFile()
                        dialog.load()
                    }
                }
            ]
        }

        QQC2.TabBar {
            id: tabs
            Layout.fillWidth: true
            component PassTab: QQC2.TabButton {
                property int pass
                text: {
                    const p = dialog.passes[pass]
                    return p.use && !dialog.root[p.use]
                        ? i18nc("@title:tab pass that is switched off", "%1 (off)", p.label) : p.label
                }
            }
            PassTab { pass: 0 }
            PassTab { pass: 1 }
            PassTab { pass: 2 }
            PassTab { pass: 3 }
            PassTab { pass: 4 }
            PassTab { pass: 5 }
        }

        // Fixed height: the dialog sizes to its content, and a TextArea's
        // implicit height is its whole text.
        StackLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: Math.max(Kirigami.Units.gridUnit * 8,
                Math.min(Kirigami.Units.gridUnit * 24,
                         (dialog.parent ? dialog.parent.height : 0) - Kirigami.Units.gridUnit * 14))
            currentIndex: tabs.currentIndex

            Repeater {
                id: editors
                model: 6
                delegate: QQC2.ScrollView {
                    required property int index
                    property alias text: area.text
                    QQC2.TextArea {
                        id: area
                        font.family: "monospace"
                        wrapMode: TextEdit.NoWrap
                        selectByMouse: true
                        placeholderText: index === 1
                            ? i18n("// Functions and constants shared by every pass")
                            : "void mainImage(out vec4 fragColor, in vec2 fragCoord)\n{\n}"
                        onTextChanged: if (!dialog._loading) commitTimer.restart()
                    }
                }
            }
        }

        RowLayout {
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing
            Kirigami.Icon {
                implicitWidth: Kirigami.Units.iconSizes.small
                implicitHeight: Kirigami.Units.iconSizes.small
                source: dialog.root.previewBroken ? "dialog-error" : "dialog-ok-apply"
                color: dialog.root.previewBroken ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.positiveTextColor
            }
            QQC2.Label {
                Layout.fillWidth: true
                elide: Text.ElideRight
                font.family: dialog.root.previewBroken ? "monospace" : Kirigami.Theme.defaultFont.family
                color: dialog.root.previewBroken ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.textColor
                text: dialog.root.previewBroken
                    ? (dialog.root.firstLogLine || i18n("Does not compile"))
                    : i18n("Compiles")
            }
            QQC2.Button {
                visible: dialog.root.previewBroken
                text: i18n("Show Log")
                icon.name: "view-list-text"
                onClicked: dialog.root.openCompileLog()
            }
        }
    }
}
