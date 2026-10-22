// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtCore
import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import "../shaderwallpaper"
import "../ShaderApply.js" as ShaderApply

// Renders shaders without a thumbnail, one at a time, while the gallery is
// on screen (fresh installs otherwise show blank cards until each shader has
// been displayed once). Shows as a progress chip with a live miniature.
// Settings-dialog only: the wallpaper never runs this.
RowLayout {
    id: generator

    // Gallery visible and the dialog window shown.
    property bool active: false

    property var queue: []
    property var forced: ({})
    property int total: 0
    property int completed: 0
    property string currentId: ""
    property string currentName: ""
    property string captureId: ""
    property real startedAt: 0
    property int startFrame: 0
    property bool cancelled: false
    // Consecutive shaders that produced no frame at all. The engine is not
    // rendering (window hidden, no GL); stop instead of marking shaders bad.
    property int noFrameStreak: 0
    readonly property bool busy: currentId.length > 0
    readonly property bool pending: busy || queue.length > 0

    // Per shader: compile result within this budget, then at least this
    // many frames or this much time before the capture.
    readonly property int settleMs: 300
    readonly property int minFrames: 20
    readonly property int maxWaitMs: 1500
    readonly property int giveUpMs: 5000

    visible: pending && !cancelled
    spacing: Kirigami.Units.smallSpacing

    Settings {
        id: store
        category: "ShaderWallpaperThumbnails"
        // id → true for shaders that failed to compile or render.
        property string failedJson: "{}"
    }
    function _failed() {
        try { return JSON.parse(store.failedJson || "{}") } catch (e) { return {} }
    }
    function _markFailed(id) {
        const f = _failed()
        f[id] = true
        store.failedJson = JSON.stringify(f)
    }

    function scan() {
        if (cancelled) return
        const lib = ShaderLibrarySingleton
        const failed = _failed()
        const all = lib.allShaders()
        const q = []
        for (let i = 0; i < all.length; i++) {
            const id = all[i].id
            if (!failed[id] && lib.needsThumbnail(id)) q.push(id)
        }
        queue = q
        total = q.length
        completed = 0
        if (q.length > 0) _next()
    }

    // Regenerates one shader's thumbnail, ahead of the queue.
    function enqueue(id) {
        if (!id) return
        cancelled = false
        const f = forced
        f[id] = true
        forced = f
        queue = [id].concat(queue.filter(function(x) { return x !== id }))
        total = Math.max(total, completed + queue.length + (busy ? 1 : 0))
        if (!busy) _next()
    }

    function cancel() {
        cancelled = true
        queue = []
        _stopCurrent()
    }

    function _stopCurrent() {
        currentId = ""
        currentName = ""
        captureId = ""
        engine.shaderSource = ""
    }

    function _next() {
        _stopCurrent()
        if (!active || cancelled) return
        const lib = ShaderLibrarySingleton
        while (queue.length > 0) {
            const id = queue[0]
            queue = queue.slice(1)
            const meta = lib.getShader(id)
            if (!meta) continue
            if (!forced[id] && !lib.needsThumbnail(id)) { completed++; continue }
            const map = ShaderApply.forPath(lib, String(meta.shaderPath))
            engine.imageChannels = [map.imageChannel0, map.imageChannel1, map.imageChannel2, map.imageChannel3]
            engine.bufferAChannels = [map.bufferAChannel0, map.bufferAChannel1, map.bufferAChannel2, map.bufferAChannel3]
            engine.bufferBChannels = [map.bufferBChannel0, map.bufferBChannel1, map.bufferBChannel2, map.bufferBChannel3]
            engine.bufferCChannels = [map.bufferCChannel0, map.bufferCChannel1, map.bufferCChannel2, map.bufferCChannel3]
            engine.bufferDChannels = [map.bufferDChannel0, map.bufferDChannel1, map.bufferDChannel2, map.bufferDChannel3]
            for (let t = 0; t < 4; t++) {
                const tex = map["iChannel" + t]
                engine["iChannel" + t] = tex ? ShaderApply.toFileUrl(lib, tex) : ""
                engine["iChannel" + t + "Enabled"] = !!tex
            }
            engine.shaderSource = ShaderApply.toFileUrl(lib, String(meta.shaderPath))
            currentId = id
            currentName = meta.name
            startedAt = Date.now()
            startFrame = engine.iFrame
            return
        }
        total = 0
        completed = 0
    }

    // remember: persist the failure so later sessions skip this shader.
    function _finish(ok, remember) {
        const id = currentId
        if (!ok && remember && id) _markFailed(id)
        if (id) {
            const f = forced
            delete f[id]
            forced = f
        }
        completed++
        _next()
    }

    function _poll() {
        if (!busy) return
        const elapsed = Date.now() - startedAt
        if (captureId.length > 0) {
            if (elapsed > giveUpMs * 2) _finish(false, false)
            return
        }
        if (elapsed < settleMs) return
        if (engine.compileFailed || engine.hasError) {
            noFrameStreak = 0
            _finish(false, true)
            return
        }
        const frames = engine.iFrame >= startFrame ? engine.iFrame - startFrame : engine.iFrame
        if ((frames >= minFrames || elapsed >= maxWaitMs) && frames > 0) {
            noFrameStreak = 0
            captureId = currentId
            engine.captureFrame(ShaderLibrarySingleton.getThumbnailPath(currentId))
        } else if (elapsed >= giveUpMs) {
            if (++noFrameStreak >= 3) {
                console.warn("Shader Wallpaper: preview engine renders no frames; preview generation stopped")
                cancel()
                return
            }
            _finish(false, false)
        }
    }

    onActiveChanged: {
        if (active) {
            if (busy) return
            if (queue.length > 0) _next()
            else Qt.callLater(scan)
        } else if (busy) {
            queue = [currentId].concat(queue)
            _stopCurrent()
        }
    }

    Connections {
        target: engine
        function onFrameCaptured(path) {
            const id = generator.captureId
            if (!id) return
            ShaderLibrarySingleton.saveThumbnail(id, path)
            generator._finish(true, false)
        }
    }

    Timer {
        interval: 100
        repeat: true
        running: generator.busy && generator.active
        onTriggered: generator._poll()
    }

    // Live miniature. The engine renders at full thumbnail size; only the
    // item is scaled down (an item's own transform is not applied to its
    // FBO size or to grabToImage).
    Rectangle {
        Layout.preferredWidth: Kirigami.Units.gridUnit * 3
        Layout.preferredHeight: Math.round(Layout.preferredWidth * 9 / 16)
        radius: Kirigami.Units.cornerRadius
        color: Kirigami.Theme.alternateBackgroundColor
        clip: true
        ShaderEngine {
            id: engine
            width: 480
            height: 270
            scale: parent.width / 480
            transformOrigin: Item.TopLeft
            enabled: false
            running: generator.busy && generator.active
            targetFps: 60
            resolutionScale: 1.0
            mouseEnabled: false
            audioEnabled: false
            iChannel0Enabled: false
            iChannel1Enabled: false
            iChannel2Enabled: false
            iChannel3Enabled: false
        }
    }

    QQC2.Label {
        text: i18n("Creating previews %1 of %2", Math.min(generator.completed + 1, Math.max(generator.total, 1)),
                   Math.max(generator.total, 1))
        font: Kirigami.Theme.smallFont
        QQC2.ToolTip.text: generator.currentName
        QQC2.ToolTip.visible: genHover.hovered && generator.currentName.length > 0
        HoverHandler { id: genHover }
    }
    QQC2.ToolButton {
        icon.name: "dialog-cancel"
        display: QQC2.AbstractButton.IconOnly
        text: i18n("Stop creating previews")
        QQC2.ToolTip.text: text
        QQC2.ToolTip.visible: hovered
        onClicked: generator.cancel()
    }
}
