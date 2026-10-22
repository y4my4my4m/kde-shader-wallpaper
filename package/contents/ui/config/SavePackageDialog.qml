// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import org.kde.kirigamiaddons.formcard as FormCard
import "../shaderwallpaper"

// Writes the current shader (all passes, routing) to Shaders/Packages/<name>/.
Kirigami.Dialog {
    id: dialog
    parent: QQC2.Overlay.overlay

    required property var root

    title: i18n("Save as Package")
    preferredWidth: Kirigami.Units.gridUnit * 28
    standardButtons: Kirigami.Dialog.Cancel

    readonly property string folderName: nameField.text.trim().replace(/[^A-Za-z0-9_-]+/g, "_")

    onOpened: {
        nameField.text = root.currentShaderName.replace(/\s+/g, "_")
        nameField.forceActiveFocus()
        nameField.selectAll()
    }

    customFooterActions: [
        Kirigami.Action {
            text: i18n("Save")
            icon.name: "document-save"
            enabled: dialog.folderName.length > 0
            onTriggered: dialog.save()
        }
    ]

    function save() {
        const r = root
        const bufferCodes = {}
        if (r.cfg_commonCode) bufferCodes.commonCode = r.cfg_commonCode
        const names = ["A", "B", "C", "D"]
        const channels = {}
        const bufferChannels = {}
        for (let c = 0; c < 4; c++) {
            channels["imageChannel" + c] = r["cfg_imageChannel" + c]
            if (r["cfg_iChannel" + c + "Enabled"] && r["cfg_iChannel" + c])
                channels["iChannel" + c] = r["cfg_iChannel" + c]
        }
        for (let i = 0; i < 4; i++) {
            const X = names[i]
            if (r["cfg_useBuffer" + X] && r["cfg_buffer" + X + "Code"])
                bufferCodes["buffer" + X + "Code"] = r["cfg_buffer" + X + "Code"]
            for (let k = 0; k < 4; k++) bufferChannels["buffer" + X + "Channel" + k] = r["cfg_buffer" + X + "Channel" + k]
        }
        const config = {
            name: nameField.text.trim(),
            author: authorField.text.trim(),
            description: descriptionField.text.trim(),
            channels: channels,
            bufferChannels: bufferChannels
        }
        const target = ShaderLibrarySingleton.userDataPath + "/Shaders/Packages/" + folderName
        const ok = ShaderLibrarySingleton.saveShaderPackage("file://" + target, r.mainCode(), bufferCodes, config)
        close()
        if (ok) {
            ShaderLibrarySingleton.refresh()
            r.showStatus(i18n("Saved to %1.", target), Kirigami.MessageType.Positive)
        } else {
            r.showStatus(i18n("Could not save the package."), Kirigami.MessageType.Error)
        }
    }

    ColumnLayout {
        spacing: Kirigami.Units.smallSpacing
        QQC2.Label { text: i18n("Name:") }
        QQC2.TextField {
            id: nameField
            Layout.fillWidth: true
            placeholderText: i18n("my_shader")
            onAccepted: if (dialog.folderName.length > 0) dialog.save()
        }
        QQC2.Label { text: i18n("Author:") }
        QQC2.TextField {
            id: authorField
            Layout.fillWidth: true
        }
        QQC2.Label { text: i18n("Description:") }
        QQC2.TextArea {
            id: descriptionField
            Layout.fillWidth: true
            Layout.preferredHeight: Kirigami.Units.gridUnit * 3
            wrapMode: TextEdit.Wrap
        }
        QQC2.Label {
            Layout.fillWidth: true
            wrapMode: Text.WrapAnywhere
            font: Kirigami.Theme.smallFont
            color: Kirigami.Theme.disabledTextColor
            text: i18n("Folder: Shaders/Packages/%1/", dialog.folderName || "…")
        }
    }
}
