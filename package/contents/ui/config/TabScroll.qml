// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

// Vertical scroller for a settings tab: one centred column, capped width.
// Flickable plus WheelHandler: inside a QQC2.ScrollView the FormCard
// delegates (ItemDelegates) swallow wheel events.
//
// Every width here is clamped at 0. During construction the viewport can
// be 0 px wide; a negative width on a layout holding FormCards sends the
// polish loop into an endless intrinsic-size cycle (plasmashell freeze,
// PR #135).
Flickable {
    id: flick

    property real maximumContentWidth: Kirigami.Units.gridUnit * 56
    default property alias content: column.data
    readonly property real columnWidth: column.width

    readonly property real _viewportWidth: Math.max(0, width - scrollBar.implicitWidth)

    clip: true
    contentWidth: _viewportWidth
    contentHeight: column.implicitHeight + Kirigami.Units.largeSpacing * 3
    flickableDirection: Flickable.VerticalFlick
    boundsBehavior: Flickable.StopAtBounds
    pixelAligned: true

    QQC2.ScrollBar.vertical: QQC2.ScrollBar {
        id: scrollBar
        policy: QQC2.ScrollBar.AsNeeded
    }

    WheelHandler {
        target: null
        orientation: Qt.Vertical
        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
        grabPermissions: PointerHandler.CanTakeOverFromAnything
        onWheel: function(event) {
            const delta = event.pixelDelta.y !== 0
                ? event.pixelDelta.y
                : event.angleDelta.y / 120 * Kirigami.Units.gridUnit * 3
            flick.contentY = Math.max(0, Math.min(Math.max(0, flick.contentHeight - flick.height),
                                                  flick.contentY - delta))
            event.accepted = true
        }
    }

    ColumnLayout {
        id: column
        width: Math.max(0, Math.min(flick._viewportWidth - Kirigami.Units.largeSpacing * 2,
                                    flick.maximumContentWidth))
        x: Math.max(0, Math.round((flick._viewportWidth - width) / 2))
        y: Kirigami.Units.largeSpacing
        spacing: 0
    }
}
