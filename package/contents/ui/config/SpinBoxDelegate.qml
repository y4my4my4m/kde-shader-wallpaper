// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import org.kde.kirigamiaddons.formcard as FormCard

// FormCard row with a SpinBox that reports user edits only (valueModified).
// FormSpinBoxDelegate exposes valueChanged alone, which also fires when the
// SpinBox clamps a bound value during construction.
FormCard.AbstractFormDelegate {
    id: delegate

    property string label
    property alias from: spin.from
    property alias to: spin.to
    property alias stepSize: spin.stepSize
    property int value
    property var textFromValue: function(v, locale) { return Number(v).toLocaleString(locale, "f", 0) }

    signal valueModified(int value)

    background: null
    focusPolicy: Qt.NoFocus

    contentItem: RowLayout {
        spacing: Kirigami.Units.largeSpacing
        QQC2.Label {
            Layout.fillWidth: true
            text: delegate.label
            elide: Text.ElideRight
        }
        QQC2.SpinBox {
            id: spin
            value: delegate.value
            editable: true
            textFromValue: delegate.textFromValue
            onValueModified: delegate.valueModified(value)
            Accessible.name: delegate.label
        }
    }
}
