// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import org.kde.kirigamiaddons.formcard as FormCard

// Input routing per render pass: rows are the active passes, columns the
// four shader inputs (iChannel0..3).
FormCard.AbstractFormDelegate {
    id: table

    required property var root

    // Routing values, main.xml: -1 none, 0..3 image slot, 10..13 buffer
    // previous frame, 20 audio spectrum.
    readonly property var sources: [
        { value: -1, text: i18nc("@item:inlistbox input source", "None"), short: i18nc("@item input source", "None") },
        { value: 0, text: i18n("Image 1"), short: i18n("Image 1") },
        { value: 1, text: i18n("Image 2"), short: i18n("Image 2") },
        { value: 2, text: i18n("Image 3"), short: i18n("Image 3") },
        { value: 3, text: i18n("Image 4"), short: i18n("Image 4") },
        { value: 10, text: i18n("Buffer A (previous frame)"), short: i18n("Buffer A") },
        { value: 11, text: i18n("Buffer B (previous frame)"), short: i18n("Buffer B") },
        { value: 12, text: i18n("Buffer C (previous frame)"), short: i18n("Buffer C") },
        { value: 13, text: i18n("Buffer D (previous frame)"), short: i18n("Buffer D") },
        { value: 20, text: i18n("Sound spectrum"), short: i18n("Sound") }
    ]
    function indexOfValue(v) {
        for (let i = 0; i < sources.length; i++) if (sources[i].value === v) return i
        return 0
    }

    readonly property var passes: {
        const list = [{ key: "image", label: i18nc("@label the final render pass", "Image") }]
        const names = ["A", "B", "C", "D"]
        for (let i = 0; i < 4; i++)
            if (root["cfg_useBuffer" + names[i]]) list.push({ key: names[i], label: i18n("Buffer %1", names[i]) })
        return list
    }
    function cfgKey(pass, ch) {
        return pass === "image" ? "cfg_imageChannel" + ch : "cfg_buffer" + pass + "Channel" + ch
    }

    background: null
    focusPolicy: Qt.NoFocus

    contentItem: GridLayout {
        columns: 5
        columnSpacing: Kirigami.Units.smallSpacing
        rowSpacing: Kirigami.Units.smallSpacing

        QQC2.Label {
            text: i18nc("@title:column render pass", "Pass")
            font.bold: true
        }
        Repeater {
            model: 4
            delegate: QQC2.Label {
                required property int index
                Layout.fillWidth: true
                text: i18nc("@title:column shader input number", "Input %1", index)
                font.bold: true
                QQC2.ToolTip.text: "iChannel" + index
                QQC2.ToolTip.visible: inputHover.hovered
                HoverHandler { id: inputHover }
            }
        }

        Repeater {
            model: table.passes.length * 5
            delegate: Loader {
                required property int index
                readonly property var pass: table.passes[Math.floor(index / 5)]
                readonly property int column: index % 5
                Layout.fillWidth: column > 0
                Layout.minimumWidth: column > 0 ? Kirigami.Units.gridUnit * 4 : 0
                sourceComponent: column === 0 ? passLabel : sourceCombo

                Component {
                    id: passLabel
                    QQC2.Label {
                        text: pass ? pass.label : ""
                    }
                }
                Component {
                    id: sourceCombo
                    QQC2.ComboBox {
                        readonly property string key: pass ? table.cfgKey(pass.key, column - 1) : ""
                        model: table.sources
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: key ? table.indexOfValue(table.root[key]) : 0
                        displayText: table.sources[currentIndex] ? table.sources[currentIndex].short : ""
                        onActivated: function(i) { if (key) table.root[key] = table.sources[i].value }
                        Accessible.name: pass ? i18n("%1, input %2", pass.label, column - 1) : ""
                    }
                }
            }
        }
    }
}
