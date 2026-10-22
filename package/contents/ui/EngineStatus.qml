// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick

// Availability of the native engine (the QML module in shaderwallpaper/).
//
// QML imports are static: a file that imports a missing module fails to
// compile as a whole. main.qml and config.qml therefore never import the
// module; everything that does is loaded through a Loader once `available`
// is true. Qt.createComponent reports the probe's import error through
// status and errorString() without printing it.
//
// The engine caches import results per QQmlEngine: a module installed while
// the process runs stays unavailable until the process restarts.
QtObject {
    readonly property Component probe: Qt.createComponent(Qt.resolvedUrl("EngineProbe.qml"))

    readonly property bool available: probe !== null && probe.status === Component.Ready
    readonly property bool failed: probe === null || probe.status === Component.Error
    readonly property string error: (probe && probe.status === Component.Error)
        ? probe.errorString().trim() : ""
}
