// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import org.kde.kirigamiaddons.formcard as FormCard

// FormCard row: label and value on one line, slider below.
FormCard.AbstractFormDelegate {
    id: delegate

    property string label
    property string description
    property alias from: slider.from
    property alias to: slider.to
    // Snapping happens in onMoved: a stepSize on the Slider makes the
    // desktop style draw one tick mark per step.
    property real stepSize: 0
    property real value
    property var formatValue: function(v) { return Number(v).toFixed(2) }

    signal moved(real value)

    background: null
    focusPolicy: Qt.NoFocus

    contentItem: ColumnLayout {
        spacing: Kirigami.Units.smallSpacing
        RowLayout {
            Layout.fillWidth: true
            QQC2.Label {
                Layout.fillWidth: true
                text: delegate.label
                elide: Text.ElideRight
            }
            QQC2.Label {
                text: delegate.formatValue(slider.value)
            }
        }
        QQC2.Slider {
            id: slider
            Layout.fillWidth: true
            value: delegate.value
            enabled: delegate.enabled
            onMoved: delegate.moved(delegate.stepSize > 0
                ? Math.round((value - from) / delegate.stepSize) * delegate.stepSize + from
                : value)
            Accessible.name: delegate.label
        }
        QQC2.Label {
            Layout.fillWidth: true
            visible: delegate.description.length > 0
            text: delegate.description
            wrapMode: Text.WordWrap
            font: Kirigami.Theme.smallFont
            color: Kirigami.Theme.disabledTextColor
        }
    }
}
