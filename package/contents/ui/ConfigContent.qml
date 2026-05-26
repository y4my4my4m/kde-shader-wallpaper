// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls
import QtQuick.Dialogs
import QtQuick.Layouts
import QtQuick.Window
import org.kde.kirigami as Kirigami
import org.kde.kirigamiaddons.formcard as FormCard
import org.kde.plasma.core as PlasmaCore
import QtCore
import "shaderwallpaper"

// onboarding state lives in QSettings, persisted across reinstalls

// Root MUST be a ColumnLayout (not Item) so it participates in Plasma's
// wallpaper-config page layout — see config.qml comment. Using Item here
// stranded us at implicitWidth regardless of the actual dialog width,
// which was the real cause of the "tiny / left-side / mid-panel"
// scrollbar symptom.
ColumnLayout {
    id: configItem

    Layout.fillWidth: true
    Layout.fillHeight: true
    spacing: 0

    // ====================================================================
    // Drag-and-drop (UI 3)
    //
    // Anywhere on the form:  .frag / .glsl  →  applyShaderFromPath()
    // (Per-iChannel rows have their own DropArea for image files — see
    // the Texture Channels section.)
    // ====================================================================
    DropArea {
        id: globalShaderDrop
        anchors.fill: parent
        z: -1  // sits behind the visible controls; only handles drag events
        keys: ["text/uri-list"]
        onEntered: function(drag) {
            // Accept if any url ends in a known shader extension.
            for (var i = 0; i < drag.urls.length; ++i) {
                if (/\.(frag\.qsb|frag|glsl)$/i.test(drag.urls[i])) {
                    drag.accept(Qt.CopyAction)
                    dropHint.dropKind = "shader"
                    dropHint.opacity = 1
                    return
                }
            }
        }
        onExited: dropHint.opacity = 0
        onDropped: function(drop) {
            dropHint.opacity = 0
            for (var i = 0; i < drop.urls.length; ++i) {
                var u = drop.urls[i].toString()
                if (/\.(frag\.qsb|frag|glsl)$/i.test(u)) {
                    var local = u.replace(/^file:\/\//, "")
                    configItem.applyShaderFromPath(local, "")
                    drop.accept(Qt.CopyAction)
                    return
                }
            }
        }
    }

    // Floating hint shown while the user drags a valid file over the form.
    Rectangle {
        id: dropHint
        property string dropKind: ""
        anchors.centerIn: parent
        z: 999
        opacity: 0
        visible: opacity > 0
        radius: Kirigami.Units.smallSpacing
        color: Qt.rgba(0.1, 0.5, 0.8, 0.92)
        width: dropHintLabel.implicitWidth + Kirigami.Units.largeSpacing * 4
        height: dropHintLabel.implicitHeight + Kirigami.Units.largeSpacing * 2
        Behavior on opacity { NumberAnimation { duration: 150 } }
        Label {
            id: dropHintLabel
            anchors.centerIn: parent
            color: "white"
            font.bold: true
            font.pointSize: Kirigami.Theme.defaultFont.pointSize * 1.1
            text: dropHint.dropKind === "shader"
                ? i18n("Drop to load shader")
                : i18n("Drop to set texture")
        }
    }

    // Plasma's wallpaper config infrastructure expects a `formLayout`
    // property alias for label alignment with the wallpaper-type combo
    // above us. Our visible form is a FormCard-based ColumnLayout, so we
    // expose a hidden zero-size Kirigami.FormLayout purely to satisfy the
    // API contract.
    property alias formLayout: hiddenFormLayout
    Kirigami.FormLayout {
        id: hiddenFormLayout
        visible: false
        width: 0
        height: 0
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // cfg_<key> properties used by the UI controls below.
    //
    // These intentionally use LITERAL defaults (not `wallpaper.configuration.X`)
    // because:
    //   • In the System Settings KCM context, `wallpaper` is undefined —
    //     bindings to it silently degrade to 0/empty, which is what produced
    //     the "Speed = 0.00x, FPS = 0, Render scale = 0%" symptom.
    //   • The authoritative cfg_* values are declared on `configRoot` in
    //     config.qml (which is what the host shell instantiates) and pushed
    //     to us via bidirectional wiring in config.qml's Loader.onLoaded.
    //   • User edits to these properties flow back to configRoot through the
    //     same wiring, then on to the live wallpaper / KCM as appropriate.
    //
    // The literals just need to be reasonable bootstrap values for the brief
    // window between component creation and Loader.onLoaded firing.
    // ════════════════════════════════════════════════════════════════════════

    // — Shader selection
    property string cfg_selectedShaderPath: ""
    property string cfg_selectedShaderCode: ""
    property int    cfg_selectedShaderIndex: 0

    // — Playback
    property bool   cfg_running: true
    property double cfg_shaderSpeed: 1.0
    property int    cfg_targetFps: 60
    property int    cfg_pauseMode: 0
    property real   cfg_resolutionScale: 1.0

    // — Mouse
    property bool   cfg_mouseEnabled: false
    property double cfg_mouseBias: 1.0

    // — Audio
    property bool   cfg_audioEnabled: false
    property int    cfg_audioChannel: 0
    property double cfg_audioSensitivity: 40.0

    // — Window tracking / pause detection
    property bool   cfg_windowsEnabled: false
    property bool   cfg_checkActiveScreen: true
    property var    cfg_excludeWindows: []

    // — Performance HUD
    property bool   cfg_showPerformance: false
    property bool   cfg_showPerformanceGraph: true
    property bool   cfg_performanceExpanded: true
    property int    cfg_gpuTdp: 75

    // — Playlist
    property bool   cfg_playlistEnabled: false
    property var    cfg_playlistShaders: []
    property int    cfg_playlistIntervalMinutes: 10
    property bool   cfg_playlistShuffle: false

    // — Experimental engine features
    property bool   cfg_experimentalScreenUniforms: false
    property bool   cfg_experimentalDesktopUniform: false
    property bool   cfg_experimentalParallax: false
    property real   cfg_experimentalParallaxStrength: 0.25
    property bool   cfg_watchSourceFile: false
    property bool   cfg_enableShaderTweaks: false

    // — iChannel textures
    property string cfg_iChannel0: "./Resources/wallpaper2.png"
    property string cfg_iChannel1: "./Resources/wallpaper2.png"
    property string cfg_iChannel2: "./Resources/Shadertoy_Organic_2.jpg"
    property string cfg_iChannel3: "./Resources/Shadertoy_Organic_2.jpg"
    property bool   cfg_iChannel0Enabled: true
    property bool   cfg_iChannel1Enabled: true
    property bool   cfg_iChannel2Enabled: true
    property bool   cfg_iChannel3Enabled: false

    // — Buffer toggles
    property bool cfg_useBufferA: false
    property bool cfg_useBufferB: false
    property bool cfg_useBufferC: false
    property bool cfg_useBufferD: false

    // — Per-pass shader code
    property string cfg_commonCode: ""
    property string cfg_bufferACode: ""
    property string cfg_bufferBCode: ""
    property string cfg_bufferCCode: ""
    property string cfg_bufferDCode: ""

    // — Per-buffer channel routing
    //   (-1 = None; 0..3 = Texture0..3; 10..13 = BufferA..D; 20 = Audio)
    property int cfg_imageChannel0: 0
    property int cfg_imageChannel1: 1
    property int cfg_imageChannel2: 2
    property int cfg_imageChannel3: 3
    property int cfg_bufferAChannel0: -1
    property int cfg_bufferAChannel1: -1
    property int cfg_bufferAChannel2: -1
    property int cfg_bufferAChannel3: -1
    property int cfg_bufferBChannel0: -1
    property int cfg_bufferBChannel1: -1
    property int cfg_bufferBChannel2: -1
    property int cfg_bufferBChannel3: -1
    property int cfg_bufferCChannel0: -1
    property int cfg_bufferCChannel1: -1
    property int cfg_bufferCChannel2: -1
    property int cfg_bufferCChannel3: -1
    property int cfg_bufferDChannel0: -1
    property int cfg_bufferDChannel1: -1
    property int cfg_bufferDChannel2: -1
    property int cfg_bufferDChannel3: -1

    Palette {
        id: palette
    }

    // First-launch onboarding state (UI 6). Persisted in QSettings so
    // it only ever shows once unless the user clicks "Re-run wizard"
    // (which is wired up in the About card via a debug action).
    Settings {
        id: onboardSettings
        category: "ShaderWallpaperOnboarding"
        property bool onboarded: false
    }

    Component.onCompleted: {
        refreshShaderUsage()
        if (!onboardSettings.onboarded) {
            onboardingSheet.startStep = 0
            Qt.callLater(function() { onboardingSheet.open() })
        }
    }

    // FormCard's default maximumWidth (30 grid units, ~360 px) causes the
    // wallpaper config to render as a narrow centered column with empty
    // space on either side. Cap at 100 grid units (~1200 px) instead so
    // the panel fills its available width on typical screens but doesn't
    // get absurdly wide on 4K / ultrawide setups.
    readonly property real cardMaxWidth: Kirigami.Units.gridUnit * 100

    // Side gutter — added uniformly to every card and header so content
    // doesn't run flush against the panel edges.
    readonly property real cardSideMargin: Kirigami.Units.largeSpacing

    // "Allow extreme supersampling" toggle. Lives at root so the slider
    // (deeply nested) and the checkbox (sibling delegate) can both read
    // it via the stable `configItem.allowExtremeUpscale` reference
    // instead of fragile parent.parent.parent chains that point at the
    // wrong item.
    property bool allowExtremeUpscale: false

    // ----------------------------------------------------------------------
    // Static analysis of the currently-loaded shader, refreshed whenever
    // the shader path or any of the code blobs change.
    //
    // The TEXTURE detection follows the actual routing — for each active
    // pass, we look at which iChannelN slots its code references, then
    // resolve each through the corresponding cfg_<pass>ChannelN to see
    // whether that slot is mapped to a Texture (0..3) or to a Buffer
    // (10..13) / Audio (20) / None (-1). Only "Texture N" routings need
    // a user-provided image. The old version just regex-flagged any
    // iChannelN reference in the code, so the water shader's iChannel0
    // (which is mapped to Buffer A self-feedback, NOT a texture) was
    // showing a misleading "pick iChannel0 image" hint.
    // ----------------------------------------------------------------------
    property var shaderUsage: ({ window: false, mouse: false, textures: [false, false, false, false] })

    function _passCode(passKey) {
        if (passKey === "image") return cfg_selectedShaderCode || ""
        if (passKey === "A") return cfg_bufferACode || ""
        if (passKey === "B") return cfg_bufferBCode || ""
        if (passKey === "C") return cfg_bufferCCode || ""
        if (passKey === "D") return cfg_bufferDCode || ""
        return ""
    }
    function _passRouting(passKey) {
        if (passKey === "image") return [cfg_imageChannel0, cfg_imageChannel1, cfg_imageChannel2, cfg_imageChannel3]
        if (passKey === "A") return [cfg_bufferAChannel0, cfg_bufferAChannel1, cfg_bufferAChannel2, cfg_bufferAChannel3]
        if (passKey === "B") return [cfg_bufferBChannel0, cfg_bufferBChannel1, cfg_bufferBChannel2, cfg_bufferBChannel3]
        if (passKey === "C") return [cfg_bufferCChannel0, cfg_bufferCChannel1, cfg_bufferCChannel2, cfg_bufferCChannel3]
        if (passKey === "D") return [cfg_bufferDChannel0, cfg_bufferDChannel1, cfg_bufferDChannel2, cfg_bufferDChannel3]
        return [-1, -1, -1, -1]
    }

    function refreshShaderUsage() {
        var combined = (cfg_selectedShaderCode || "")
                     + "\n" + (cfg_commonCode || "")
                     + "\n" + (cfg_bufferACode || "")
                     + "\n" + (cfg_bufferBCode || "")
                     + "\n" + (cfg_bufferCCode || "")
                     + "\n" + (cfg_bufferDCode || "")
        if (cfg_selectedShaderPath && combined.length < 50) {
            combined += "\n" + (ShaderLibrarySingleton.loadShaderCode(cfg_selectedShaderPath) || "")
        }

        // Walk every active pass, see which iChannelN its code references,
        // resolve each through the routing → mark needed texture slots.
        var activePasses = ["image"]
        if (cfg_useBufferA) activePasses.push("A")
        if (cfg_useBufferB) activePasses.push("B")
        if (cfg_useBufferC) activePasses.push("C")
        if (cfg_useBufferD) activePasses.push("D")

        var neededTextures = [false, false, false, false]
        for (var p = 0; p < activePasses.length; p++) {
            var pass = activePasses[p]
            // Pass code + common code (since common is prepended to every pass)
            var code = _passCode(pass) + "\n" + (cfg_commonCode || "")
            if (cfg_selectedShaderPath && pass === "image" && code.length < 50) {
                code = ShaderLibrarySingleton.loadShaderCode(cfg_selectedShaderPath) || ""
            }
            var routing = _passRouting(pass)
            for (var ch = 0; ch < 4; ch++) {
                var re = new RegExp("\\biChannel" + ch + "\\b")
                if (!re.test(code)) continue
                var route = routing[ch]
                if (route >= 0 && route <= 3) {
                    neededTextures[route] = true
                }
            }
        }

        shaderUsage = {
            window: /\biWindow(Count|Rects|Velocities)\b/.test(combined),
            mouse: /\biMouse\b/.test(combined),
            textures: neededTextures,
        }
    }

    Connections {
        target: configItem
        function onCfg_selectedShaderPathChanged() { configItem.refreshShaderUsage() }
        function onCfg_selectedShaderCodeChanged() { configItem.refreshShaderUsage() }
        function onCfg_commonCodeChanged() { configItem.refreshShaderUsage() }
        function onCfg_bufferACodeChanged() { configItem.refreshShaderUsage() }
        function onCfg_bufferBCodeChanged() { configItem.refreshShaderUsage() }
        function onCfg_bufferCCodeChanged() { configItem.refreshShaderUsage() }
        function onCfg_bufferDCodeChanged() { configItem.refreshShaderUsage() }
    }
    // refreshShaderUsage is called in the merged Component.onCompleted
    // up top (where the onboarding sheet is also triggered).

    // ----------------------------------------------------------------------
    // Display helpers for the Shader card.
    // ----------------------------------------------------------------------
    function prettyShaderName(path) {
        if (!path) return ""
        var s = path.toString()
        var slash = s.lastIndexOf("/")
        var base = slash < 0 ? s : s.substring(slash + 1)
        // Strip .frag / .frag.qsb / .glsl
        return base.replace(/\.(frag\.qsb|frag|glsl)$/i, "")
    }
    function prettyShaderPath(path) {
        if (!path) return ""
        var s = path.toString()
        // Drop file:// prefix and collapse $HOME to ~ for readability.
        s = s.replace(/^file:\/\//, "")
        s = s.replace(/^\/home\/[^/]+\//, "~/")
        return s
    }
    function shaderThumbnailUrl(path) {
        if (!path) return ""
        var shader = ShaderLibrarySingleton.getShaderByPath(path)
        if (shader && shader.thumbnailPath) {
            return shader.thumbnailPath
        }
        return ""
    }

    // ----------------------------------------------------------------------
    // Helper: apply a shader chosen from the gallery or a file dialog.
    // Writes only to cfg_* aliases so Plasma's Apply / dirty-tracking works.
    // ----------------------------------------------------------------------
    function applyShaderFromPath(path, displayName) {
        if (!path) return
        cfg_selectedShaderPath = path
        cfg_selectedShaderCode = ""

        var bufferData = ShaderLibrarySingleton.loadBufferCodes(path)
        cfg_commonCode = bufferData.commonCode || ""
        cfg_bufferACode = bufferData.bufferACode || ""
        cfg_bufferBCode = bufferData.bufferBCode || ""
        cfg_bufferCCode = bufferData.bufferCCode || ""
        cfg_bufferDCode = bufferData.bufferDCode || ""

        cfg_useBufferA = !!bufferData.useBufferA
        cfg_useBufferB = !!bufferData.useBufferB
        cfg_useBufferC = !!bufferData.useBufferC
        cfg_useBufferD = !!bufferData.useBufferD

        // Default channel routings for buffer-based shaders (self-feedback +
        // image pass reads Buffer A output). Mirrors the old behavior.
        if (cfg_useBufferA) {
            cfg_bufferAChannel0 = 10; cfg_bufferAChannel1 = -1
            cfg_bufferAChannel2 = -1; cfg_bufferAChannel3 = -1
            cfg_imageChannel0 = 10; cfg_imageChannel1 = 1
            cfg_imageChannel2 = 2;  cfg_imageChannel3 = 3
        }
        if (cfg_useBufferB) {
            cfg_bufferBChannel0 = 11; cfg_bufferBChannel1 = -1
            cfg_bufferBChannel2 = -1; cfg_bufferBChannel3 = -1
        }
        if (cfg_useBufferC) {
            cfg_bufferCChannel0 = 12; cfg_bufferCChannel1 = -1
            cfg_bufferCChannel2 = -1; cfg_bufferCChannel3 = -1
        }
        if (cfg_useBufferD) {
            cfg_bufferDChannel0 = 13; cfg_bufferDChannel1 = -1
            cfg_bufferDChannel2 = -1; cfg_bufferDChannel3 = -1
        }

        // Auto-detect which engine features the shader actually uses so we
        // flip the matching toggle without the user having to find it.
        // Combine main + all buffer + common code for the scan.
        var allCode = ShaderLibrarySingleton.loadShaderCode(path) || ""
        if (cfg_commonCode) allCode += "\n" + cfg_commonCode
        if (cfg_bufferACode) allCode += "\n" + cfg_bufferACode
        if (cfg_bufferBCode) allCode += "\n" + cfg_bufferBCode
        if (cfg_bufferCCode) allCode += "\n" + cfg_bufferCCode
        if (cfg_bufferDCode) allCode += "\n" + cfg_bufferDCode

        if (/\biWindow(Count|Rects|Velocities)\b/.test(allCode)) {
            cfg_windowsEnabled = true
            console.log("  Auto-enabled window tracking (shader uses iWindow*)")
        }
        if (/\biMouse\b/.test(allCode) && !cfg_mouseEnabled) {
            cfg_mouseEnabled = true
            console.log("  Auto-enabled mouse interaction (shader uses iMouse)")
        }

        console.log("Loaded shader:", displayName || path,
                    "A=" + cfg_useBufferA, "B=" + cfg_useBufferB,
                    "C=" + cfg_useBufferC, "D=" + cfg_useBufferD)
    }

    // ----------------------------------------------------------------------
    // Helper: apply an imported (Shadertoy) shader with optional buffers.
    // ----------------------------------------------------------------------
    function applyImportedShader(mainCode, bufferCodes, commonCode) {
        cfg_selectedShaderCode = mainCode || ""
        cfg_commonCode = commonCode || ""

        var bc = bufferCodes || {}
        cfg_bufferACode = bc["BufferA"] || ""
        cfg_bufferBCode = bc["BufferB"] || ""
        cfg_bufferCCode = bc["BufferC"] || ""
        cfg_bufferDCode = bc["BufferD"] || ""

        cfg_useBufferA = !!bc["BufferA"]
        cfg_useBufferB = !!bc["BufferB"]
        cfg_useBufferC = !!bc["BufferC"]
        cfg_useBufferD = !!bc["BufferD"]
    }

    // ────────────────────────────────────────────────────────────────────────
    // No live-preview bridge here anymore.
    //
    // Mirroring cfg_<key> changes into the host wallpaper / KCM configuration
    // is now done centrally in config.qml — which is the QML root that the
    // host shell instantiates and the only place that can correctly speak the
    // Plasma wallpaper-config contract (signal `configurationChanged`,
    // bidirectional cfg_*/wallpaperConfiguration mirroring, etc.). See the
    // header comment in config.qml.
    //
    // configRoot.cfg_* ↔ configItem.cfg_* is wired up in config.qml's
    // contentLoader.onLoaded, so any cfg_* change we make here propagates
    // back to configRoot, which in turn handles `wallpaperConfiguration[key]`
    // writes (live preview in-process) and `configurationChanged` (KCM
    // dirty tracking).
    // ────────────────────────────────────────────────────────────────────────

    // ---------------------------------------------------------------------
    // Thumbnail capture from the in-config preview engine.
    //
    // The wallpaper-side ShaderSystem.qml has its own capture path, but it
    // is unreliable: the wallpaper instance can be paused, hidden behind a
    // maximised window, or simply on a different output than the user is
    // looking at when they change shaders from the Configure dialog. The
    // result is the gallery cards stay empty even after browsing many
    // shaders.
    //
    // The Configure dialog already renders the *selected* shader at 30 fps
    // in the small preview tile (`previewEngine`), so we piggy-back on
    // that: a couple of seconds after a clean compile, grab a 480x270
    // thumbnail from the preview and hand it to the shader library. This
    // makes both manual ("Regenerate" button) and automatic captures
    // resilient — the preview is always on-screen while the dialog is up.
    // ---------------------------------------------------------------------
    Connections {
        target: previewEngine
        function onFrameCaptured(path) {
            if (!cfg_selectedShaderPath) return
            var shader = ShaderLibrarySingleton.getShaderByPath(cfg_selectedShaderPath)
            if (!shader) {
                console.warn("ConfigContent: captured frame for unknown shader path",
                             cfg_selectedShaderPath)
                return
            }
            ShaderLibrarySingleton.saveThumbnail(shader.id, path)
        }
        function onShaderRecompiled() { previewThumbnailTimer.restart() }
        function onHasErrorChanged() {
            if (!previewEngine.hasError) previewThumbnailTimer.restart()
        }
    }

    Connections {
        target: configItem
        function onCfg_selectedShaderPathChanged() { previewThumbnailTimer.restart() }
    }

    // Fires once the preview has been rendering long enough that we're
    // sure we're capturing the new shader, not the previous one. 2.5s is a
    // safety margin over the 30 fps preview (so >=75 frames have rendered)
    // and well past compile + first-frame latency.
    Timer {
        id: previewThumbnailTimer
        interval: 2500
        repeat: false
        onTriggered: configItem.captureThumbnailForCurrentShader(false)
    }

    // Public helper: kick off a capture for whatever shader is selected.
    // `force` == true is what the "Regenerate" button uses; without it
    // we no-op when a thumbnail already exists, so the auto-capture
    // doesn't keep rewriting good thumbnails on every shader change.
    function previewErrorActive() {
        // UI truth source: explicit messages/logs.
        // We intentionally don't trust previewEngine.hasError alone here
        // because that flag can become stale after a successful recompile.
        var hasCompileLog = previewEngine && previewEngine.compileLog && previewEngine.compileLog.length > 0
        var hasErrorMessage = previewEngine && previewEngine.errorMessage && previewEngine.errorMessage.length > 0
        return hasCompileLog || hasErrorMessage
    }

    function captureThumbnailForCurrentShader(force) {
        if (!cfg_selectedShaderPath) return false
        if (previewErrorActive()) return false
        if (previewEngine.currentFps <= 0) return false

        var lib = ShaderLibrarySingleton
        var shader = lib.getShaderByPath(cfg_selectedShaderPath)
        if (!shader) return false

        if (!force && !lib.needsThumbnail(shader.id)) return false

        var dst = lib.getThumbnailPath(shader.id)
        previewEngine.captureFrame(dst)
        return true
    }

    // Channel mapping model for ComboBoxes (at root level for accessibility)
    // Values: -1=None, 0-3=Texture0-3, 10-13=BufferA-D, 20=Audio
    ListModel {
        id: channelSourceModel
        ListElement { text: "None"; value: -1 }
        ListElement { text: "Texture 0"; value: 0 }
        ListElement { text: "Texture 1"; value: 1 }
        ListElement { text: "Texture 2"; value: 2 }
        ListElement { text: "Texture 3"; value: 3 }
        ListElement { text: "Buffer A"; value: 10 }
        ListElement { text: "Buffer B"; value: 11 }
        ListElement { text: "Buffer C"; value: 12 }
        ListElement { text: "Buffer D"; value: 13 }
        ListElement { text: "Audio"; value: 20 }
    }
    
    // Helper function to find model index from value (at root level for accessibility)
    function findChannelIndex(value) {
        for (var i = 0; i < channelSourceModel.count; i++) {
            if (channelSourceModel.get(i).value === value) return i
        }
        return 0  // Default to "None"
    }
    
    // ====================================================================
    // Visible form. Our own ScrollView because Plasma's wallpaper-config
    // page system doesn't provide one (pages on the pageStack don't
    // auto-scroll unless they're Kirigami.ScrollablePage). With configItem
    // now a ColumnLayout root that grows to the dialog's full width via
    // Layout.fillWidth, the ScrollView finally has the right size and its
    // scrollbar lives at the actual right edge of the panel.
    // ====================================================================
    // Replaced QQC2.ScrollView with a hand-rolled Flickable + ScrollBar
    // because the ScrollView's wheel routing kept failing on form-card
    // descendants — wheel events would never make it past the
    // ItemDelegate-based FormCard rows down to the inner Flickable.
    // Flickable + an explicit WheelHandler with CanTakeOverFromAnything
    // grab permissions handles wheel reliably even with greedy children.
    Flickable {
        id: flick
        Layout.fillWidth: true
        Layout.fillHeight: true
        contentWidth: width - flickScrollBar.width
        contentHeight: mainColumn.implicitHeight
        clip: true
        flickableDirection: Flickable.VerticalFlick
        boundsBehavior: Flickable.StopAtBounds
        // 'pixelAligned' avoids subpixel jitter on slow trackpad scrolls.
        pixelAligned: true

        // Top-level wheel handler that grabs wheel events even if a
        // greedy child (sliders, spinboxes, hover-handling form delegates)
        // wants to consume them. We forward to the flickable's contentY.
        WheelHandler {
            target: null  // attach to parent (flick) for hit-testing
            orientation: Qt.Vertical
            acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
            grabPermissions: PointerHandler.CanTakeOverFromAnything
            onWheel: function(event) {
                const pixelDelta = event.pixelDelta.y !== 0
                    ? event.pixelDelta.y
                    : event.angleDelta.y / 120 * Kirigami.Units.gridUnit * 3
                const newY = flick.contentY - pixelDelta
                flick.contentY = Math.max(0,
                    Math.min(flick.contentHeight - flick.height, newY))
                event.accepted = true
            }
        }

        ScrollBar.vertical: ScrollBar {
            id: flickScrollBar
            policy: ScrollBar.AsNeeded
        }

        ColumnLayout {
            id: mainColumn
            // Bind directly to the Flickable's content area so cards
            // span the full available width and the scrollbar lives at
            // the real right edge of the panel.
            width: flick.width - flickScrollBar.width
            spacing: 0

            // ============================================================
            // Quick filter — type a word and only matching sections stay
            // visible. Tags below each section's header.
            // ============================================================
            property string searchFilter: ""
            function matchSearch(tags) {
                if (!searchFilter || searchFilter.length === 0) return true
                return tags.toLowerCase().indexOf(searchFilter.toLowerCase()) >= 0
            }

            RowLayout {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                Layout.topMargin: Kirigami.Units.largeSpacing
                Layout.bottomMargin: Kirigami.Units.smallSpacing
                spacing: Kirigami.Units.smallSpacing

                Kirigami.SearchField {
                    id: configSearchField
                    Layout.fillWidth: true
                    placeholderText: i18n("Filter settings… (try \"mouse\", \"buffer\", \"fps\")")
                    onTextChanged: mainColumn.searchFilter = text
                    focusSequence: "Ctrl+F"
                }

                Label {
                    visible: mainColumn.searchFilter.length > 0
                    text: i18n("Filtering")
                    opacity: 0.6
                    font.italic: true
                }
            }

            // ============================================================
            // Shader selection
            // ============================================================
            FormCard.FormHeader {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                title: i18n("Shader")
                visible: mainColumn.matchSearch("shader source gallery import file browse load preview thumbnail")
            }

            FormCard.FormCard {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                visible: mainColumn.matchSearch("shader source gallery import file browse load preview thumbnail")

                FormCard.AbstractFormDelegate {
                    Layout.fillWidth: true
                    background: null
                    contentItem: RowLayout {
                        spacing: Kirigami.Units.largeSpacing

                        // Live mini-preview of the selected shader. Runs at
                        // 30 FPS and 50% resolution so it costs ~5% of what
                        // the real wallpaper does. Bound to the same cfg_*
                        // properties, so it updates instantly when the user
                        // tweaks anything. Falls back to a placeholder icon
                        // when the shader hasn't compiled yet.
                        Rectangle {
                            id: previewFrame
                            Layout.preferredWidth: 240
                            Layout.preferredHeight: 135   // 16:9
                            radius: Kirigami.Units.smallSpacing
                            color: Kirigami.Theme.alternateBackgroundColor
                                ? Kirigami.Theme.alternateBackgroundColor
                                : Qt.rgba(0, 0, 0, 0.2)
                            border.width: 1
                            border.color: previewErrorActive()
                                ? Kirigami.Theme.negativeTextColor
                                : (Kirigami.Theme.separatorColor
                                    ? Kirigami.Theme.separatorColor
                                    : Qt.rgba(1, 1, 1, 0.15))
                            clip: true

                            Behavior on border.color {
                                ColorAnimation { duration: 200 }
                            }

                            ShaderEngine {
                                id: previewEngine
                                anchors.fill: parent
                                anchors.margins: 1
                                // Don't let the preview swallow wheel events
                                // — the surrounding form ScrollView needs them.
                                enabled: false
                                shaderSource: cfg_selectedShaderPath
                                    ? (cfg_selectedShaderPath.indexOf("://") >= 0
                                        ? cfg_selectedShaderPath
                                        : "file://" + cfg_selectedShaderPath)
                                    : ""
                                shaderCode: cfg_selectedShaderCode
                                running: cfg_running
                                speed: cfg_shaderSpeed
                                targetFps: 30
                                resolutionScale: 0.5
                                mouseEnabled: false
                                audioEnabled: false
                                commonCode: cfg_commonCode
                                bufferACode: cfg_bufferACode
                                bufferBCode: cfg_bufferBCode
                                bufferCCode: cfg_bufferCCode
                                bufferDCode: cfg_bufferDCode
                                useBufferA: cfg_useBufferA
                                useBufferB: cfg_useBufferB
                                useBufferC: cfg_useBufferC
                                useBufferD: cfg_useBufferD
                                iChannel0Enabled: cfg_iChannel0Enabled
                                iChannel1Enabled: cfg_iChannel1Enabled
                                iChannel2Enabled: cfg_iChannel2Enabled
                                iChannel3Enabled: cfg_iChannel3Enabled
                                iChannel0: cfg_iChannel0Enabled && cfg_iChannel0
                                    ? (cfg_iChannel0.indexOf("://") >= 0 ? cfg_iChannel0 : "file://" + cfg_iChannel0) : ""
                                iChannel1: cfg_iChannel1Enabled && cfg_iChannel1
                                    ? (cfg_iChannel1.indexOf("://") >= 0 ? cfg_iChannel1 : "file://" + cfg_iChannel1) : ""
                                iChannel2: cfg_iChannel2Enabled && cfg_iChannel2
                                    ? (cfg_iChannel2.indexOf("://") >= 0 ? cfg_iChannel2 : "file://" + cfg_iChannel2) : ""
                                iChannel3: cfg_iChannel3Enabled && cfg_iChannel3
                                    ? (cfg_iChannel3.indexOf("://") >= 0 ? cfg_iChannel3 : "file://" + cfg_iChannel3) : ""
                                imageChannels: [cfg_imageChannel0, cfg_imageChannel1, cfg_imageChannel2, cfg_imageChannel3]
                                bufferAChannels: [cfg_bufferAChannel0, cfg_bufferAChannel1, cfg_bufferAChannel2, cfg_bufferAChannel3]
                                bufferBChannels: [cfg_bufferBChannel0, cfg_bufferBChannel1, cfg_bufferBChannel2, cfg_bufferBChannel3]
                                bufferCChannels: [cfg_bufferCChannel0, cfg_bufferCChannel1, cfg_bufferCChannel2, cfg_bufferCChannel3]
                                bufferDChannels: [cfg_bufferDChannel0, cfg_bufferDChannel1, cfg_bufferDChannel2, cfg_bufferDChannel3]
                            }

                            // "Compiling…" / error overlay
                            Rectangle {
                                anchors.fill: parent
                                visible: previewErrorActive()
                                    || (!cfg_selectedShaderPath && !cfg_selectedShaderCode)
                                color: Qt.rgba(0, 0, 0, 0.65)

                                ColumnLayout {
                                    anchors.centerIn: parent
                                    spacing: Kirigami.Units.smallSpacing
                                    Kirigami.Icon {
                                        Layout.alignment: Qt.AlignHCenter
                                        Layout.preferredWidth: Kirigami.Units.iconSizes.large
                                        Layout.preferredHeight: Kirigami.Units.iconSizes.large
                                        source: previewErrorActive()
                                            ? "dialog-error"
                                            : "preferences-desktop-effects"
                                        color: "white"
                                    }
                                    Label {
                                        Layout.alignment: Qt.AlignHCenter
                                        color: "white"
                                        text: previewErrorActive()
                                            ? i18n("Compile error")
                                            : i18n("No shader")
                                        font.bold: true
                                    }
                                }
                            }

                            // FPS chip in the corner — gives an at-a-glance
                            // sense of how heavy the shader is without
                            // needing the perf-widget overlay.
                            Rectangle {
                                anchors {
                                    bottom: parent.bottom
                                    right: parent.right
                                    margins: 4
                                }
                                visible: !previewErrorActive() && previewEngine.currentFps > 0
                                width: fpsChip.implicitWidth + 10
                                height: fpsChip.implicitHeight + 4
                                radius: 3
                                color: Qt.rgba(0, 0, 0, 0.55)
                                Label {
                                    id: fpsChip
                                    anchors.centerIn: parent
                                    color: "white"
                                    font.pointSize: Kirigami.Theme.smallFont.pointSize
                                    text: previewEngine.currentFps + " fps · "
                                        + previewEngine.averageFrameTime.toFixed(1) + " ms"
                                }
                            }
                        }

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: Kirigami.Units.smallSpacing / 2

                            Label {
                                Layout.fillWidth: true
                                text: cfg_selectedShaderPath
                                    ? prettyShaderName(cfg_selectedShaderPath)
                                    : (cfg_selectedShaderCode && cfg_selectedShaderCode.length > 0
                                        ? i18n("(custom code, %1 chars)", cfg_selectedShaderCode.length)
                                        : i18n("No shader selected"))
                                font.bold: true
                                elide: Text.ElideMiddle
                                font.pointSize: Math.round(Kirigami.Theme.defaultFont.pointSize * 1.25)
                            }
                            Label {
                                Layout.fillWidth: true
                                visible: cfg_selectedShaderPath.length > 0
                                text: prettyShaderPath(cfg_selectedShaderPath)
                                elide: Text.ElideMiddle
                                opacity: 0.55
                                font.pointSize: Math.round(Kirigami.Theme.defaultFont.pointSize * 0.85)
                            }

                            // Active buffer pills + estimated power load
                            RowLayout {
                                Layout.fillWidth: true
                                spacing: Kirigami.Units.smallSpacing
                                visible: cfg_useBufferA || cfg_useBufferB
                                    || cfg_useBufferC || cfg_useBufferD
                                    || previewEngine.averageFrameTime > 0

                                Repeater {
                                    model: [
                                        { name: "A", on: cfg_useBufferA },
                                        { name: "B", on: cfg_useBufferB },
                                        { name: "C", on: cfg_useBufferC },
                                        { name: "D", on: cfg_useBufferD },
                                    ]
                                    delegate: Rectangle {
                                        visible: modelData.on
                                        radius: 3
                                        color: Kirigami.Theme.highlightColor
                                        width: bufBadgeLabel.implicitWidth + 8
                                        height: bufBadgeLabel.implicitHeight + 4
                                        Label {
                                            id: bufBadgeLabel
                                            anchors.centerIn: parent
                                            text: modelData.name
                                            color: Kirigami.Theme.highlightedTextColor
                                            font.bold: true
                                            font.pointSize: Math.round(Kirigami.Theme.defaultFont.pointSize * 0.8)
                                        }
                                    }
                                }

                                Rectangle {
                                    visible: previewEngine.averageFrameTime > 0
                                    width: powerLabel.implicitWidth + 12
                                    height: powerLabel.implicitHeight + 4
                                    radius: 3
                                    // Color-code by frame time: green ≤ 4ms,
                                    // yellow ≤ 8ms, orange ≤ 16ms, red beyond.
                                    color: previewEngine.averageFrameTime <= 4
                                        ? "#27ae60"
                                        : previewEngine.averageFrameTime <= 8
                                            ? "#f1c40f"
                                            : previewEngine.averageFrameTime <= 16
                                                ? "#e67e22"
                                                : "#e74c3c"
                                    Behavior on color { ColorAnimation { duration: 300 } }
                                    Label {
                                        id: powerLabel
                                        anchors.centerIn: parent
                                        color: "white"
                                        text: {
                                            var ft = previewEngine.averageFrameTime
                                            if (ft <= 4) return i18n("Light")
                                            if (ft <= 8) return i18n("Moderate")
                                            if (ft <= 16) return i18n("Heavy")
                                            return i18n("Very heavy")
                                        }
                                        font.bold: true
                                        font.pointSize: Math.round(Kirigami.Theme.defaultFont.pointSize * 0.78)
                                    }
                                }

                                Item { Layout.fillWidth: true }
                            }
                        }
                    }
                }

                // Compile error pane — shows the GL log inline whenever the
                // selected shader fails to compile, with a "View full log"
                // action that opens the detail sheet. Keeps the WORKING
                // shader rendering in the preview (see compileShader fix).
                FormCard.AbstractFormDelegate {
                    Layout.fillWidth: true
                    visible: previewErrorActive()

                    Behavior on opacity { NumberAnimation { duration: 200 } }
                    opacity: visible ? 1 : 0

                    background: Rectangle {
                        color: Kirigami.Theme.negativeBackgroundColor
                            ? Kirigami.Theme.negativeBackgroundColor
                            : Qt.rgba(0.9, 0.3, 0.2, 0.15)
                        radius: Kirigami.Units.smallSpacing
                    }

                    contentItem: RowLayout {
                        spacing: Kirigami.Units.smallSpacing
                        Kirigami.Icon {
                            source: "dialog-error"
                            Layout.preferredWidth: Kirigami.Units.iconSizes.small
                            Layout.preferredHeight: Kirigami.Units.iconSizes.small
                            color: Kirigami.Theme.negativeTextColor
                        }
                        Label {
                            Layout.fillWidth: true
                            text: previewEngine.compileLog
                                ? previewEngine.compileLog.split("\n")[0]
                                : i18n("Shader failed to compile.")
                            wrapMode: Text.NoWrap
                            elide: Text.ElideRight
                            color: Kirigami.Theme.negativeTextColor
                            font.family: "monospace"
                            font.pointSize: Kirigami.Theme.smallFont.pointSize
                        }
                        Button {
                            text: i18n("View full log")
                            icon.name: "view-list-text"
                            onClicked: compileLogSheet.open()
                        }
                    }
                }

                FormCard.FormDelegateSeparator {}

                FormCard.AbstractFormDelegate {
                    Layout.fillWidth: true
                    background: null
                    contentItem: RowLayout {
                        spacing: Kirigami.Units.smallSpacing
                        Button {
                            text: i18n("Browse Gallery")
                            icon.name: "view-list-icons"
                            Layout.fillWidth: true
                            onClicked: gallerySheet.open()
                        }
                        Button {
                            text: i18n("Import from URL…")
                            icon.name: "document-import"
                            onClicked: importDialog.open()
                        }
                        Button {
                            text: i18n("Open File…")
                            icon.name: "document-open"
                            onClicked: fileDialog.open()
                        }
                        Button {
                            text: i18n("More shaders…")
                            icon.name: "folder-download"
                            ToolTip.visible: hovered
                            ToolTip.text: i18n("Where to find .frag shader files — the KDE Store does not host individual shaders.")
                            onClicked: getNewShadersSheet.open()
                        }
                    }
                }

                // Inline hints — fire only when the current shader references
                // an input that isn't fully configured yet, with a one-click
                // action to fix the problem.
                //
                // NOTE: deliberately NOT using Kirigami.InlineMessage's
                // `actions` here. Kirigami's ActionToolBar (which renders
                // the actions) reads `action.tooltip` and segfaults when
                // any action object resolves to null during creation — and
                // it does with our Repeater-generated Kirigami.Action
                // objects. Using a plain RowLayout with a Button avoids
                // the buggy code path entirely.
                Repeater {
                    model: [
                        {
                            key: "window",
                            visible: shaderUsage.window && !cfg_windowsEnabled,
                            text: i18n("This shader reacts to window positions but window tracking is off."),
                            actionLabel: i18n("Enable window tracking"),
                            actionIcon: "window-duplicate",
                            onTrigger: function() { cfg_windowsEnabled = true }
                        },
                        {
                            key: "mouse",
                            visible: shaderUsage.mouse && !cfg_mouseEnabled,
                            text: i18n("This shader reads iMouse but mouse interaction is off."),
                            actionLabel: i18n("Enable mouse"),
                            actionIcon: "input-mouse",
                            onTrigger: function() { cfg_mouseEnabled = true }
                        },
                        {
                            key: "tex0",
                            visible: shaderUsage.textures[0] && (!cfg_iChannel0Enabled || !cfg_iChannel0),
                            text: i18n("This shader needs Texture 0 — pick an image."),
                            actionLabel: i18n("Pick image"),
                            actionIcon: "document-open",
                            onTrigger: function() { channel0Dialog.open() }
                        },
                        {
                            key: "tex1",
                            visible: shaderUsage.textures[1] && (!cfg_iChannel1Enabled || !cfg_iChannel1),
                            text: i18n("This shader needs Texture 1 — pick an image."),
                            actionLabel: i18n("Pick image"),
                            actionIcon: "document-open",
                            onTrigger: function() { channel1Dialog.open() }
                        },
                        {
                            key: "tex2",
                            visible: shaderUsage.textures[2] && (!cfg_iChannel2Enabled || !cfg_iChannel2),
                            text: i18n("This shader needs Texture 2 — pick an image."),
                            actionLabel: i18n("Pick image"),
                            actionIcon: "document-open",
                            onTrigger: function() { channel2Dialog.open() }
                        },
                        {
                            key: "tex3",
                            visible: shaderUsage.textures[3] && (!cfg_iChannel3Enabled || !cfg_iChannel3),
                            text: i18n("This shader needs Texture 3 — pick an image."),
                            actionLabel: i18n("Pick image"),
                            actionIcon: "document-open",
                            onTrigger: function() { channel3Dialog.open() }
                        },
                    ]
                    delegate: FormCard.AbstractFormDelegate {
                        Layout.fillWidth: true
                        // Animate appear/disappear so the form doesn't
                        // pop. Using opacity + an explicit height-collapse
                        // because QML Item.visible alone doesn't animate.
                        Layout.preferredHeight: modelData.visible ? implicitHeight : 0
                        opacity: modelData.visible ? 1 : 0
                        clip: true
                        Behavior on Layout.preferredHeight {
                            NumberAnimation { duration: 200; easing.type: Easing.OutCubic }
                        }
                        Behavior on opacity {
                            NumberAnimation { duration: 200 }
                        }

                        background: Rectangle {
                            color: Kirigami.Theme.alternateBackgroundColor
                            border.color: Kirigami.Theme.focusColor
                            border.width: 1
                            radius: Kirigami.Units.smallSpacing
                            opacity: 0.5
                        }
                        contentItem: RowLayout {
                            spacing: Kirigami.Units.largeSpacing
                            Kirigami.Icon {
                                source: "dialog-information-symbolic"
                                Layout.preferredWidth: Kirigami.Units.iconSizes.small
                                Layout.preferredHeight: Kirigami.Units.iconSizes.small
                                color: Kirigami.Theme.focusColor
                            }
                            Label {
                                Layout.fillWidth: true
                                text: modelData.text
                                wrapMode: Text.WordWrap
                            }
                            Button {
                                text: modelData.actionLabel
                                icon.name: modelData.actionIcon
                                onClicked: modelData.onTrigger()
                            }
                        }
                    }
                }
            }

            // ============================================================
            // Shader Tweaks (experimental, off by default)
            //
            // Sits visually under the Shader card so users see the live
            // preview update as they adjust constants. The panel never
            // mutates the .frag on disk — it produces a modified-in-memory
            // copy that we route into the engine via the inline-code path,
            // temporarily replacing the shader-from-file binding. Toggle
            // back off (Experimental → "Shader Tweaks") to restore the
            // original file binding.
            // ============================================================
            FormCard.FormHeader {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                title: i18n("Shader Tweaks")
                visible: cfg_enableShaderTweaks
                    && mainColumn.matchSearch("shader tweak tweaks constant define color colour vec3 float live edit")
            }

            FormCard.FormCard {
                id: shaderTweaksCard
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                visible: cfg_enableShaderTweaks
                    && mainColumn.matchSearch("shader tweak tweaks constant define color colour vec3 float live edit")

                // --- Design notes -------------------------------------------------
                // The panel parses one shader's source and emits modified GLSL.
                // We feed that into the engine via cfg_selectedShaderCode. But
                // ShaderEngine::setShaderCode is a no-op while a file path is
                // bound (disk is authoritative), so we have to *temporarily clear
                // cfg_selectedShaderPath* while tweaks are live, then restore it
                // when the user resets or disables tweaks.
                //
                // The naive implementation creates a feedback loop:
                //     emit modified  ->  clear path  ->  binding sees empty path
                //                                       ->  reload disk = empty
                //                                       ->  panel re-parses ""
                //                                       ->  emit "" (reset)
                //                                       ->  host restores path
                //                                       ->  binding sees real path
                //                                       ->  reload disk = original
                //                                       ->  emit modified again
                //                                       ->  …flicker every frame
                //
                // The fix below is to cache the disk source by *shader id*, only
                // updating the cache when the id actually changes — never when
                // we ourselves emptied the path to apply an inline override.
                // ------------------------------------------------------------------

                // Resolve the absolute path on disk regardless of how the user
                // typed it (file://, plain absolute, or library-relative).
                function _absolutePath(p) {
                    if (!p || p.length === 0) return ""
                    if (p.indexOf("file://") === 0) p = p.substring(7)
                    if (p.length > 0 && p.charAt(0) !== "/")
                        p = ShaderLibrarySingleton.libraryPath + "/" + p
                    return p
                }
                function _shaderIdForPath(p) {
                    if (!p || p.length === 0) return ""
                    var s = ShaderLibrarySingleton.getShaderByPath(p)
                    return s ? s.id : p
                }

                // The most recent real path / id we observed. Updated only when
                // cfg_selectedShaderPath is non-empty AND yields a different
                // shader. _stashedSource is the on-disk source for that shader
                // and is the *single source of truth* the panel parses; it is
                // NEVER recomputed from cfg_selectedShaderPath while we have an
                // active tweak override (i.e. while cfg_selectedShaderPath is
                // transiently empty), which is what breaks the feedback loop.
                property string _stashedPath: ""
                property string _stashedShaderId: ""
                property string _stashedSource: ""

                // Internal guard. Goes true the moment we send a tweaksChanged
                // value into cfg_*; we use it to ignore the immediate path-empty
                // round-trip we caused. Cleared on a small timer.
                property bool _ignorePathChange: false

                function _captureCurrent() {
                    var rawPath = cfg_selectedShaderPath
                    if (!rawPath || rawPath.length === 0) return
                    // Dedup on the raw path (not the looked-up id), because
                    // _shaderIdForPath() falls back to the path string when
                    // the library hasn't indexed the shader yet — and two
                    // different shaders can both fall through to the same
                    // fallback, which previously made us stick to whichever
                    // we captured first (the famous "I picked 2D_Clouds
                    // but tweaks show ps3menu" bug).
                    if (rawPath === _stashedPath && _stashedSource.length > 0) {
                        return
                    }
                    var abs = _absolutePath(rawPath)
                    var url = abs.length > 0 ? "file://" + abs : ""
                    var src = url ? (ShaderLibrarySingleton.loadShaderCode(url) || "") : ""
                    _stashedPath = rawPath
                    _stashedShaderId = _shaderIdForPath(rawPath)
                    _stashedSource = src
                }

                Component.onCompleted: if (cfg_enableShaderTweaks) _captureCurrent()
                Connections {
                    target: configItem
                    function onCfg_selectedShaderPathChanged() {
                        // Only ignore the "path went empty" transition that
                        // we ourselves trigger to apply an inline override.
                        // A genuine shader switch (e.g. via the Gallery) is
                        // always non-empty, so it must still capture.
                        if (shaderTweaksCard._ignorePathChange
                                && cfg_selectedShaderPath.length === 0) {
                            return
                        }
                        shaderTweaksCard._captureCurrent()
                    }
                    function onCfg_enableShaderTweaksChanged() {
                        if (cfg_enableShaderTweaks) {
                            shaderTweaksCard._captureCurrent()
                        } else {
                            // Master toggle off: drop any inline override and
                            // restore the file binding if needed.
                            shaderTweaksCard._ignorePathChange = true
                            cfg_selectedShaderCode = ""
                            if (shaderTweaksCard._stashedPath.length > 0
                                    && cfg_selectedShaderPath.length === 0) {
                                cfg_selectedShaderPath = shaderTweaksCard._stashedPath
                            }
                            // Clear the guard on next tick so we resume tracking
                            // genuine future user-initiated shader switches.
                            Qt.callLater(function() {
                                shaderTweaksCard._ignorePathChange = false
                            })
                        }
                    }
                }

                FormCard.AbstractFormDelegate {
                    Layout.fillWidth: true
                    background: null
                    contentItem: ShaderTweaksPanel {
                        id: shaderTweaksPanel
                        active: cfg_enableShaderTweaks && shaderTweaksCard._stashedSource.length > 0
                        sourceCode: shaderTweaksCard._stashedSource
                        shaderId:   shaderTweaksCard._stashedShaderId

                        onTweaksChanged: function(modifiedCode) {
                            if (!cfg_enableShaderTweaks) return
                            shaderTweaksCard._ignorePathChange = true
                            if (modifiedCode && modifiedCode.length > 0) {
                                // ORDER MATTERS: ShaderEngine::setShaderCode is
                                // a no-op while a file path is bound (disk is
                                // authoritative). We must clear the path FIRST
                                // so the subsequent setShaderCode actually
                                // takes effect — otherwise the engine silently
                                // drops the tweaked source and we see no
                                // change.
                                if (cfg_selectedShaderPath.length > 0) {
                                    cfg_selectedShaderPath = ""
                                }
                                cfg_selectedShaderCode = modifiedCode
                            } else {
                                // No overrides remaining: clear inline code and
                                // restore the file binding so subsequent disk
                                // edits / hot-reload start working again.
                                cfg_selectedShaderCode = ""
                                if (shaderTweaksCard._stashedPath.length > 0
                                        && cfg_selectedShaderPath.length === 0) {
                                    cfg_selectedShaderPath = shaderTweaksCard._stashedPath
                                }
                            }
                            // Release the guard on the next event-loop tick so
                            // genuine future shader-switches still capture.
                            Qt.callLater(function() {
                                shaderTweaksCard._ignorePathChange = false
                            })
                        }

                        // -- Save: confirm, then overwrite the original file.
                        onSaveRequested: function(modifiedCode) {
                            shaderTweaksSaveConfirm.pendingCode = modifiedCode
                            shaderTweaksSaveConfirm.open()
                        }

                        // -- Save As: prompt for a name, then write a copy
                        //    into ~/.local/share/.../Shaders/Imported/ and
                        //    switch the active shader to it.
                        onSaveAsRequested: function(modifiedCode) {
                            shaderTweaksSaveAsPrompt.pendingCode = modifiedCode
                            // Suggest "<original name> (tweaked)" so the user
                            // doesn't have to type the basename from scratch.
                            var base = prettyShaderName(shaderTweaksCard._stashedPath)
                            if (!base || base.length === 0) base = "Shader"
                            shaderTweaksSaveAsPrompt.suggestedName = base + " (tweaked)"
                            shaderTweaksSaveAsPrompt.open()
                        }
                    }
                }

                // ------- Save (overwrite) confirmation ----------------------
                Kirigami.PromptDialog {
                    id: shaderTweaksSaveConfirm
                    title: i18n("Save tweaks to file?")
                    subtitle: i18n("This will overwrite %1 with the tweaked source. The original cannot be recovered unless you have a backup.",
                                   prettyShaderPath(shaderTweaksCard._stashedPath))
                    standardButtons: Kirigami.Dialog.NoButton
                    property string pendingCode: ""
                    customFooterActions: [
                        Kirigami.Action {
                            text: i18n("Overwrite")
                            icon.name: "document-save"
                            onTriggered: {
                                var ok = ShaderLibrarySingleton.saveShaderCode(
                                    Qt.url("file://" + shaderTweaksCard._absolutePath(shaderTweaksCard._stashedPath)),
                                    shaderTweaksSaveConfirm.pendingCode)
                                if (ok) {
                                    // The tweaks are now in the file — clear
                                    // every override so the engine re-reads
                                    // the (newly saved) on-disk source and we
                                    // start from a clean slate.
                                    shaderTweaksPanel.resetAll()
                                    shaderTweaksCard._stashedSource = ShaderLibrarySingleton.loadShaderCode(
                                        Qt.url("file://" + shaderTweaksCard._absolutePath(shaderTweaksCard._stashedPath))) || ""
                                }
                                shaderTweaksSaveConfirm.close()
                            }
                        },
                        Kirigami.Action {
                            text: i18n("Cancel")
                            icon.name: "dialog-cancel"
                            onTriggered: shaderTweaksSaveConfirm.close()
                        }
                    ]
                }

                // ------- Save As (name prompt) ------------------------------
                Kirigami.PromptDialog {
                    id: shaderTweaksSaveAsPrompt
                    title: i18n("Save tweaked shader as…")
                    subtitle: i18n("A new .frag will be created in your Imported library and the wallpaper will switch to it.")
                    standardButtons: Kirigami.Dialog.NoButton
                    property string pendingCode: ""
                    property string suggestedName: ""
                    onOpened: { saveAsNameField.text = suggestedName; saveAsNameField.selectAll(); saveAsNameField.forceActiveFocus() }
                    customFooterActions: [
                        Kirigami.Action {
                            text: i18n("Save copy")
                            icon.name: "document-save-as"
                            enabled: saveAsNameField.text.trim().length > 0
                            onTriggered: {
                                var url = ShaderLibrarySingleton.saveShaderAs(
                                    saveAsNameField.text.trim(),
                                    shaderTweaksSaveAsPrompt.pendingCode,
                                    "Imported")
                                if (url && url.toString().length > 0) {
                                    // Reset the panel so the user starts the
                                    // new file with no pending overrides, then
                                    // switch the active shader to the freshly
                                    // saved copy.
                                    shaderTweaksPanel.resetAll()
                                    configItem.applyShaderFromPath(url.toString(),
                                                                   saveAsNameField.text.trim())
                                }
                                shaderTweaksSaveAsPrompt.close()
                            }
                        },
                        Kirigami.Action {
                            text: i18n("Cancel")
                            icon.name: "dialog-cancel"
                            onTriggered: shaderTweaksSaveAsPrompt.close()
                        }
                    ]
                    TextField {
                        id: saveAsNameField
                        Layout.fillWidth: true
                        placeholderText: i18n("Shader name (letters, numbers, dash, underscore)…")
                    }
                }
            }

            // ============================================================
            // Playback
            // ============================================================
            FormCard.FormHeader {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                title: i18n("Playback")
                visible: mainColumn.matchSearch("playback status pause play speed fps framerate render resolution scale quality")
            }

            FormCard.FormCard {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                visible: mainColumn.matchSearch("playback status pause play speed fps framerate render resolution scale quality")

                FormCard.AbstractFormDelegate {
                    Layout.fillWidth: true
                    background: null
                    contentItem: RowLayout {
                        spacing: Kirigami.Units.largeSpacing
                        Label {
                            text: i18n("Status")
                            Layout.preferredWidth: Kirigami.Units.gridUnit * 9
                        }
                        Button {
                            icon.name: cfg_running ? "media-playback-pause" : "media-playback-start"
                            text: cfg_running ? i18n("Pause") : i18n("Play")
                            onClicked: cfg_running = !cfg_running
                        }
                        Button {
                            icon.name: "view-refresh"
                            text: i18n("Reset time")
                            onClicked: {
                                // Reset is engine-side; UI just signals via cfg
                                // change. ShaderEngine exposes resetTime() but
                                // we'd need a way to call it from config —
                                // future: hook a Q_INVOKABLE through wallpaper.
                            }
                        }
                        Item { Layout.fillWidth: true }
                    }
                }

                FormCard.FormDelegateSeparator {}

                FormCard.AbstractFormDelegate {
                    Layout.fillWidth: true
                    background: null
                    contentItem: RowLayout {
                        spacing: Kirigami.Units.largeSpacing
                        Label {
                            text: i18n("Speed")
                            Layout.preferredWidth: Kirigami.Units.gridUnit * 9
                        }
                        Slider {
                            id: speedSlider
                            Layout.fillWidth: true
                            from: -5.0
                            to: 5.0
                            stepSize: 0.05
                            value: cfg_shaderSpeed
                            onMoved: cfg_shaderSpeed = value
                        }
                        SpinBox {
                            from: -500
                            to: 500
                            value: Math.round(cfg_shaderSpeed * 100)
                            onValueModified: cfg_shaderSpeed = value / 100
                            textFromValue: function(value) { return (value / 100).toFixed(2) + "×" }
                            valueFromText: function(text) { return Math.round(parseFloat(text) * 100) }
                            Layout.preferredWidth: Kirigami.Units.gridUnit * 6
                        }
                    }
                }

                FormCard.FormDelegateSeparator {}

                FormCard.AbstractFormDelegate {
                    Layout.fillWidth: true
                    background: null
                    contentItem: ColumnLayout {
                        spacing: Kirigami.Units.smallSpacing
                        RowLayout {
                            Layout.fillWidth: true
                            spacing: Kirigami.Units.largeSpacing
                            Label {
                                text: i18n("Target FPS")
                                Layout.preferredWidth: Kirigami.Units.gridUnit * 9
                            }
                            Slider {
                                id: fpsSlider
                                Layout.fillWidth: true
                                from: 15
                                to: 360
                                stepSize: 1
                                value: cfg_targetFps
                                onMoved: cfg_targetFps = Math.round(value)
                            }
                            Label {
                                text: cfg_targetFps + " FPS"
                                Layout.minimumWidth: Kirigami.Units.gridUnit * 4
                                horizontalAlignment: Text.AlignRight
                            }
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Kirigami.Units.gridUnit * 9 + Kirigami.Units.largeSpacing
                            spacing: Kirigami.Units.smallSpacing
                            Repeater {
                                model: [30, 60, 120, 144, 240]
                                delegate: Button {
                                    text: modelData
                                    flat: true
                                    implicitWidth: Kirigami.Units.gridUnit * 2.5
                                    highlighted: cfg_targetFps === modelData
                                    onClicked: { fpsSlider.value = modelData; cfg_targetFps = modelData }
                                }
                            }
                            Item { Layout.fillWidth: true }
                        }
                    }
                }

                FormCard.FormDelegateSeparator {}

                FormCard.AbstractFormDelegate {
                    Layout.fillWidth: true
                    background: null

                    contentItem: ColumnLayout {
                        spacing: Kirigami.Units.smallSpacing

                        // Main slider row
                        RowLayout {
                            Layout.fillWidth: true
                            spacing: Kirigami.Units.largeSpacing
                            Label {
                                text: i18n("Render scale")
                                Layout.preferredWidth: Kirigami.Units.gridUnit * 9
                            }
                            Slider {
                                id: resScaleSlider
                                Layout.fillWidth: true
                                from: 0.05  // 5% — extreme downscale
                                to: configItem.allowExtremeUpscale ? 4.0 : 2.0
                                stepSize: 0.05
                                value: cfg_resolutionScale
                                onMoved: cfg_resolutionScale = value
                            }
                            Label {
                                text: Math.round(cfg_resolutionScale * 100) + "%"
                                Layout.minimumWidth: Kirigami.Units.gridUnit * 4
                                horizontalAlignment: Text.AlignRight
                                color: cfg_resolutionScale > 2.0
                                    ? Kirigami.Theme.negativeTextColor
                                    : Kirigami.Theme.textColor
                            }
                        }

                        // Preset chips
                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Kirigami.Units.gridUnit * 9 + Kirigami.Units.largeSpacing
                            spacing: Kirigami.Units.smallSpacing
                            Repeater {
                                model: [0.25, 0.5, 0.75, 1.0, 1.5, 2.0]
                                delegate: Button {
                                    text: Math.round(modelData * 100) + "%"
                                    flat: true
                                    implicitWidth: Kirigami.Units.gridUnit * 3
                                    highlighted: Math.abs(cfg_resolutionScale - modelData) < 0.01
                                    onClicked: { resScaleSlider.value = modelData; cfg_resolutionScale = modelData }
                                }
                            }
                            Label {
                                text: i18n("Lower = faster, higher = sharper")
                                opacity: 0.6
                                font.italic: true
                                Layout.leftMargin: Kirigami.Units.largeSpacing
                            }
                            Item { Layout.fillWidth: true }
                        }
                    }
                }

                // Separate row for the supersampling unlock — a CheckBox
                // reads better than a small button next to the chips.
                FormCard.AbstractFormDelegate {
                    Layout.fillWidth: true
                    background: null

                    contentItem: RowLayout {
                        spacing: Kirigami.Units.smallSpacing
                        Item {
                            Layout.preferredWidth: Kirigami.Units.gridUnit * 9
                                + Kirigami.Units.largeSpacing
                        }
                        CheckBox {
                            id: extremeUpscaleCheck
                            text: i18n("Allow extreme supersampling (up to 4×)")
                            checked: configItem.allowExtremeUpscale
                            onToggled: {
                                configItem.allowExtremeUpscale = checked
                                if (!checked && cfg_resolutionScale > 2.0) {
                                    cfg_resolutionScale = 2.0
                                }
                            }
                        }
                        Label {
                            visible: extremeUpscaleCheck.checked
                            text: i18n("⚠ may use heavy GPU load — only matters when you set scale above 200%")
                            color: Kirigami.Theme.negativeTextColor
                            font.italic: true
                            Layout.leftMargin: Kirigami.Units.smallSpacing
                        }
                        Item { Layout.fillWidth: true }
                    }
                }

                FormCard.FormDelegateSeparator {}

                FormCard.FormComboBoxDelegate {
                    text: i18n("Pause when")
                    description: i18n("Stops rendering — saves GPU when the wallpaper isn't visible.")
                    model: [
                        i18n("Maximized or fullscreen window"),
                        i18n("Any active window present"),
                        i18n("Any window visible"),
                        i18n("Never pause"),
                    ]
                    currentIndex: cfg_pauseMode
                    onCurrentValueChanged: cfg_pauseMode = currentIndex
                }
            }

            // ============================================================
            // Inputs (mouse + audio + window tracking)
            // ============================================================
            FormCard.FormHeader {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                title: i18n("Inputs")
                visible: mainColumn.matchSearch("input mouse cursor sensitivity audio reactivity pipewire window tracking imouse iwindow")
            }

            FormCard.FormCard {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                visible: mainColumn.matchSearch("input mouse cursor sensitivity audio reactivity pipewire window tracking imouse iwindow")

                FormCard.FormSwitchDelegate {
                    text: i18n("Mouse interaction")
                    description: i18n("Send cursor position to the shader as <tt>iMouse</tt>.")
                    checked: cfg_mouseEnabled
                    onToggled: cfg_mouseEnabled = checked
                }

                FormCard.AbstractFormDelegate {
                    Layout.fillWidth: true
                    Layout.preferredHeight: cfg_mouseEnabled ? implicitHeight : 0
                    opacity: cfg_mouseEnabled ? 1 : 0
                    clip: true
                    Behavior on Layout.preferredHeight {
                        NumberAnimation { duration: 200; easing.type: Easing.OutCubic }
                    }
                    Behavior on opacity { NumberAnimation { duration: 200 } }
                    background: null
                    contentItem: RowLayout {
                        spacing: Kirigami.Units.largeSpacing
                        Label {
                            text: i18n("Sensitivity")
                            Layout.leftMargin: Kirigami.Units.gridUnit * 2
                            Layout.preferredWidth: Kirigami.Units.gridUnit * 9
                        }
                        Slider {
                            Layout.fillWidth: true
                            from: 0.1
                            to: 5.0
                            stepSize: 0.05
                            value: cfg_mouseBias
                            onMoved: cfg_mouseBias = value
                        }
                        Label {
                            text: cfg_mouseBias.toFixed(2) + "×"
                            Layout.minimumWidth: Kirigami.Units.gridUnit * 4
                            horizontalAlignment: Text.AlignRight
                        }
                    }
                }

                FormCard.FormDelegateSeparator {}

                FormCard.FormSwitchDelegate {
                    text: i18n("Audio reactivity")
                    description: i18n("Capture system audio via PipeWire and expose it as an <tt>iChannel</tt>.")
                    checked: cfg_audioEnabled
                    onToggled: cfg_audioEnabled = checked
                }

                FormCard.FormComboBoxDelegate {
                    visible: cfg_audioEnabled
                    text: i18n("Audio channel")
                    model: ["iChannel0", "iChannel1", "iChannel2", "iChannel3"]
                    currentIndex: cfg_audioChannel
                    onCurrentValueChanged: cfg_audioChannel = currentIndex
                }

                FormCard.AbstractFormDelegate {
                    Layout.fillWidth: true
                    Layout.preferredHeight: cfg_audioEnabled ? implicitHeight : 0
                    opacity: cfg_audioEnabled ? 1 : 0
                    clip: true
                    Behavior on Layout.preferredHeight {
                        NumberAnimation { duration: 200; easing.type: Easing.OutCubic }
                    }
                    Behavior on opacity { NumberAnimation { duration: 200 } }
                    background: null
                    contentItem: RowLayout {
                        spacing: Kirigami.Units.largeSpacing
                        Label {
                            text: i18n("Sensitivity")
                            Layout.leftMargin: Kirigami.Units.gridUnit * 2
                            Layout.preferredWidth: Kirigami.Units.gridUnit * 9
                        }
                        Slider {
                            Layout.fillWidth: true
                            from: 0
                            to: 100
                            stepSize: 1
                            value: cfg_audioSensitivity
                            onMoved: cfg_audioSensitivity = value
                        }
                        Label {
                            text: cfg_audioSensitivity.toFixed(0)
                            Layout.minimumWidth: Kirigami.Units.gridUnit * 4
                            horizontalAlignment: Text.AlignRight
                        }
                    }
                }

                FormCard.FormDelegateSeparator {}

                FormCard.FormSwitchDelegate {
                    text: i18n("Window tracking")
                    description: i18n("Expose window positions as <tt>iWindowRects[]</tt>, <tt>iWindowVelocities[]</tt>, and <tt>iWindowCount</tt>.")
                    checked: cfg_windowsEnabled
                    onToggled: cfg_windowsEnabled = checked
                }
            }

            // ============================================================
            // Texture channels (iChannel0..3)
            // ============================================================
            FormCard.FormHeader {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                title: i18n("Texture Channels")
                visible: mainColumn.matchSearch("texture channel ichannel image picture sampler")
            }

            FormCard.FormCard {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                visible: mainColumn.matchSearch("texture channel ichannel image picture sampler")

                Repeater {
                    model: 4
                    delegate: ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 0
                        property int channelIdx: index

                        FormCard.AbstractFormDelegate {
                            Layout.fillWidth: true
                            background: Rectangle {
                                color: channelDrop.containsDrag
                                    ? Qt.rgba(0.1, 0.5, 0.8, 0.18)
                                    : "transparent"
                                radius: Kirigami.Units.smallSpacing
                                Behavior on color { ColorAnimation { duration: 150 } }
                            }

                            // Per-row drop target for image textures.
                            DropArea {
                                id: channelDrop
                                anchors.fill: parent
                                keys: ["text/uri-list"]
                                onEntered: function(drag) {
                                    for (var i = 0; i < drag.urls.length; ++i) {
                                        if (/\.(png|jpe?g|webp|bmp|tiff?)$/i.test(drag.urls[i])) {
                                            drag.accept(Qt.CopyAction)
                                            dropHint.dropKind = "image"
                                            dropHint.opacity = 1
                                            return
                                        }
                                    }
                                }
                                onExited: dropHint.opacity = 0
                                onDropped: function(drop) {
                                    dropHint.opacity = 0
                                    for (var i = 0; i < drop.urls.length; ++i) {
                                        var u = drop.urls[i].toString()
                                        if (/\.(png|jpe?g|webp|bmp|tiff?)$/i.test(u)) {
                                            var local = u.replace(/^file:\/\//, "")
                                            if (channelIdx === 0) { cfg_iChannel0 = local; cfg_iChannel0Enabled = true }
                                            else if (channelIdx === 1) { cfg_iChannel1 = local; cfg_iChannel1Enabled = true }
                                            else if (channelIdx === 2) { cfg_iChannel2 = local; cfg_iChannel2Enabled = true }
                                            else if (channelIdx === 3) { cfg_iChannel3 = local; cfg_iChannel3Enabled = true }
                                            drop.accept(Qt.CopyAction)
                                            return
                                        }
                                    }
                                }
                            }

                            contentItem: RowLayout {
                                spacing: Kirigami.Units.largeSpacing
                                CheckBox {
                                    text: "iChannel" + channelIdx
                                    Layout.preferredWidth: Kirigami.Units.gridUnit * 9
                                    checked: {
                                        if (channelIdx === 0) return cfg_iChannel0Enabled
                                        if (channelIdx === 1) return cfg_iChannel1Enabled
                                        if (channelIdx === 2) return cfg_iChannel2Enabled
                                        if (channelIdx === 3) return cfg_iChannel3Enabled
                                        return false
                                    }
                                    onToggled: {
                                        if (channelIdx === 0) cfg_iChannel0Enabled = checked
                                        else if (channelIdx === 1) cfg_iChannel1Enabled = checked
                                        else if (channelIdx === 2) cfg_iChannel2Enabled = checked
                                        else if (channelIdx === 3) cfg_iChannel3Enabled = checked
                                    }
                                }
                                TextField {
                                    Layout.fillWidth: true
                                    enabled: {
                                        if (channelIdx === 0) return cfg_iChannel0Enabled
                                        if (channelIdx === 1) return cfg_iChannel1Enabled
                                        if (channelIdx === 2) return cfg_iChannel2Enabled
                                        if (channelIdx === 3) return cfg_iChannel3Enabled
                                        return false
                                    }
                                    text: {
                                        if (channelIdx === 0) return cfg_iChannel0
                                        if (channelIdx === 1) return cfg_iChannel1
                                        if (channelIdx === 2) return cfg_iChannel2
                                        if (channelIdx === 3) return cfg_iChannel3
                                        return ""
                                    }
                                    placeholderText: i18n("Path or URL of texture image")
                                    onEditingFinished: {
                                        if (channelIdx === 0) cfg_iChannel0 = text
                                        else if (channelIdx === 1) cfg_iChannel1 = text
                                        else if (channelIdx === 2) cfg_iChannel2 = text
                                        else if (channelIdx === 3) cfg_iChannel3 = text
                                    }
                                }
                                Button {
                                    icon.name: "document-open"
                                    text: i18n("Browse…")
                                    onClicked: {
                                        if (channelIdx === 0) channel0Dialog.open()
                                        else if (channelIdx === 1) channel1Dialog.open()
                                        else if (channelIdx === 2) channel2Dialog.open()
                                        else if (channelIdx === 3) channel3Dialog.open()
                                    }
                                }
                            }
                        }

                        FormCard.FormDelegateSeparator {
                            visible: channelIdx < 3
                        }
                    }
                }
            }

            // ============================================================
            // Buffers (multi-pass)
            // ============================================================
            FormCard.FormHeader {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                title: i18n("Multi-pass Buffers")
                visible: mainColumn.matchSearch("buffer multipass pass code editor common channel routing mapping a b c d")
            }

            FormCard.FormCard {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                visible: mainColumn.matchSearch("buffer multipass pass code editor common channel routing mapping a b c d")

                FormCard.AbstractFormDelegate {
                    Layout.fillWidth: true
                    background: null
                    contentItem: ColumnLayout {
                        spacing: Kirigami.Units.smallSpacing
                        Label {
                            text: i18n("Enable additional render passes for feedback effects, blur chains, fluid simulations, etc.")
                            wrapMode: Text.WordWrap
                            opacity: 0.7
                            font.italic: true
                            Layout.fillWidth: true
                        }
                        RowLayout {
                            spacing: Kirigami.Units.largeSpacing
                            Label {
                                text: i18n("Active buffers")
                                Layout.preferredWidth: Kirigami.Units.gridUnit * 9
                            }
                            CheckBox { text: "A"; checked: cfg_useBufferA; onToggled: cfg_useBufferA = checked }
                            CheckBox { text: "B"; checked: cfg_useBufferB; onToggled: cfg_useBufferB = checked }
                            CheckBox { text: "C"; checked: cfg_useBufferC; onToggled: cfg_useBufferC = checked }
                            CheckBox { text: "D"; checked: cfg_useBufferD; onToggled: cfg_useBufferD = checked }
                            Item { Layout.fillWidth: true }
                        }
                    }
                }

                FormCard.FormDelegateSeparator {}

                FormCard.FormButtonDelegate {
                    text: i18n("Channel routing…")
                    description: i18n("Configure which input each iChannel reads from for each render pass.")
                    icon.name: "configure"
                    onClicked: channelMappingSheet.open()
                }

                FormCard.FormButtonDelegate {
                    text: i18n("Edit shader code…")
                    description: {
                        var bits = []
                        if (cfg_bufferACode) bits.push("A " + cfg_bufferACode.length + "ch")
                        if (cfg_bufferBCode) bits.push("B " + cfg_bufferBCode.length + "ch")
                        if (cfg_bufferCCode) bits.push("C " + cfg_bufferCCode.length + "ch")
                        if (cfg_bufferDCode) bits.push("D " + cfg_bufferDCode.length + "ch")
                        if (cfg_commonCode) bits.push("common " + cfg_commonCode.length + "ch")
                        return bits.length > 0
                            ? i18n("Currently loaded: %1", bits.join(" · "))
                            : i18n("Edit the main image pass, common code, and any active buffer passes.")
                    }
                    icon.name: "document-edit"
                    onClicked: bufferCodeSheet.open()
                }

                FormCard.FormButtonDelegate {
                    text: i18n("Save as package…")
                    description: i18n("Bundle the current shader + buffers into a reusable package directory.")
                    icon.name: "document-save"
                    enabled: (cfg_selectedShaderCode && cfg_selectedShaderCode.length > 0)
                        || cfg_useBufferA || cfg_useBufferB || cfg_useBufferC || cfg_useBufferD
                    onClicked: savePackageDialog.open()
                }
            }

            // ============================================================
            // Presets
            // ============================================================
            FormCard.FormHeader {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                title: i18n("Presets")
                visible: mainColumn.matchSearch("preset save load configuration export import")
            }

            FormCard.FormCard {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                visible: mainColumn.matchSearch("preset save load configuration export import")

                FormCard.AbstractFormDelegate {
                    Layout.fillWidth: true
                    background: null
                    contentItem: PresetPanel {
                        Layout.fillWidth: true
                        currentConfig: ({
                            shaderPath: cfg_selectedShaderPath,
                            shaderCode: cfg_selectedShaderCode,
                            speed: cfg_shaderSpeed,
                            targetFps: cfg_targetFps,
                            resolutionScale: cfg_resolutionScale,
                            mouseEnabled: cfg_mouseEnabled,
                            mouseBias: cfg_mouseBias,
                            audioEnabled: cfg_audioEnabled,
                            audioChannel: cfg_audioChannel,
                            audioSensitivity: cfg_audioSensitivity,
                            channels: {
                                channel0: cfg_iChannel0, channel0Enabled: cfg_iChannel0Enabled,
                                channel1: cfg_iChannel1, channel1Enabled: cfg_iChannel1Enabled,
                                channel2: cfg_iChannel2, channel2Enabled: cfg_iChannel2Enabled,
                                channel3: cfg_iChannel3, channel3Enabled: cfg_iChannel3Enabled,
                            },
                            buffers: {
                                useBufferA: cfg_useBufferA, useBufferB: cfg_useBufferB,
                                useBufferC: cfg_useBufferC, useBufferD: cfg_useBufferD,
                            },
                        })

                        onPresetLoaded: (config) => {
                            if (config.shaderPath) cfg_selectedShaderPath = config.shaderPath
                            if (config.speed !== undefined) cfg_shaderSpeed = config.speed
                            if (config.targetFps !== undefined) cfg_targetFps = config.targetFps
                            if (config.resolutionScale !== undefined) cfg_resolutionScale = config.resolutionScale
                            if (config.mouseEnabled !== undefined) cfg_mouseEnabled = config.mouseEnabled
                            if (config.mouseBias !== undefined) cfg_mouseBias = config.mouseBias
                            if (config.audioEnabled !== undefined) cfg_audioEnabled = config.audioEnabled
                            if (config.audioChannel !== undefined) cfg_audioChannel = config.audioChannel
                            if (config.audioSensitivity !== undefined) cfg_audioSensitivity = config.audioSensitivity
                            if (config.channels) {
                                if (config.channels.channel0) cfg_iChannel0 = config.channels.channel0
                                if (config.channels.channel1) cfg_iChannel1 = config.channels.channel1
                                if (config.channels.channel2) cfg_iChannel2 = config.channels.channel2
                                if (config.channels.channel3) cfg_iChannel3 = config.channels.channel3
                            }
                            if (config.buffers) {
                                if (config.buffers.useBufferA !== undefined) cfg_useBufferA = config.buffers.useBufferA
                                if (config.buffers.useBufferB !== undefined) cfg_useBufferB = config.buffers.useBufferB
                                if (config.buffers.useBufferC !== undefined) cfg_useBufferC = config.buffers.useBufferC
                                if (config.buffers.useBufferD !== undefined) cfg_useBufferD = config.buffers.useBufferD
                            }
                        }
                    }
                }
            }

            // ============================================================
            // Performance monitoring (collapsible)
            // ============================================================
            FormCard.FormHeader {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                title: i18n("Performance Monitor")
                visible: mainColumn.matchSearch("performance monitor fps widget power gpu tdp watt graph")
            }

            FormCard.FormCard {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                visible: mainColumn.matchSearch("performance monitor fps widget power gpu tdp watt graph")

                FormCard.FormSwitchDelegate {
                    id: perfSwitch
                    text: i18n("Show performance widget")
                    description: i18n("Overlay showing real-time FPS, frame time, and estimated power draw.")
                    checked: cfg_showPerformance
                    onToggled: cfg_showPerformance = checked
                }

                FormCard.FormSwitchDelegate {
                    visible: cfg_showPerformance
                    text: i18n("Show frame-time graph")
                    checked: cfg_showPerformanceGraph !== false
                    onToggled: cfg_showPerformanceGraph = checked
                }

                FormCard.FormSwitchDelegate {
                    visible: cfg_showPerformance
                    text: i18n("Start expanded")
                    checked: cfg_performanceExpanded !== false
                    onToggled: cfg_performanceExpanded = checked
                }

                FormCard.AbstractFormDelegate {
                    Layout.fillWidth: true
                    visible: cfg_showPerformance
                    background: null
                    contentItem: ColumnLayout {
                        spacing: Kirigami.Units.smallSpacing
                        RowLayout {
                            Layout.fillWidth: true
                            spacing: Kirigami.Units.largeSpacing
                            Label {
                                text: i18n("GPU TDP")
                                Layout.preferredWidth: Kirigami.Units.gridUnit * 9
                            }
                            Slider {
                                Layout.fillWidth: true
                                from: 15
                                to: 350
                                stepSize: 5
                                value: cfg_gpuTdp
                                onMoved: cfg_gpuTdp = Math.round(value)
                            }
                            Label {
                                text: cfg_gpuTdp + " W"
                                Layout.minimumWidth: Kirigami.Units.gridUnit * 4
                                horizontalAlignment: Text.AlignRight
                            }
                        }
                        Label {
                            Layout.fillWidth: true
                            Layout.leftMargin: Kirigami.Units.gridUnit * 9 + Kirigami.Units.largeSpacing
                            text: i18n("Typical: 15W iGPU · 75W entry · 150W mid · 250W+ high-end")
                            opacity: 0.6
                            font.italic: true
                            wrapMode: Text.WordWrap
                        }
                    }
                }
            }

            // ============================================================
            // Playlist (A3)
            // ============================================================
            FormCard.FormHeader {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                title: i18n("Playlist")
                visible: mainColumn.matchSearch("playlist rotate shuffle cycle interval random schedule auto")
            }

            FormCard.FormCard {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                visible: mainColumn.matchSearch("playlist rotate shuffle cycle interval random schedule auto")

                FormCard.FormSwitchDelegate {
                    id: playlistSwitch
                    text: i18n("Auto-rotate through a playlist of shaders")
                    description: i18n("Switch to the next shader in your playlist after a chosen interval.")
                    checked: cfg_playlistEnabled
                    onToggled: cfg_playlistEnabled = checked
                }

                FormCard.AbstractFormDelegate {
                    Layout.fillWidth: true
                    visible: cfg_playlistEnabled
                    background: null
                    contentItem: RowLayout {
                        spacing: Kirigami.Units.largeSpacing
                        Label {
                            text: i18n("Change every")
                            Layout.preferredWidth: Kirigami.Units.gridUnit * 9
                        }
                        SpinBox {
                            from: 1
                            to: 480
                            value: cfg_playlistIntervalMinutes
                            stepSize: 1
                            editable: true
                            onValueModified: cfg_playlistIntervalMinutes = value
                        }
                        Label { text: i18n("minutes") }
                        Item { Layout.fillWidth: true }
                    }
                }

                FormCard.FormSwitchDelegate {
                    visible: cfg_playlistEnabled
                    text: i18n("Shuffle (random next shader)")
                    description: i18n("If off, the playlist is played in order.")
                    checked: cfg_playlistShuffle
                    onToggled: cfg_playlistShuffle = checked
                }

                FormCard.AbstractFormDelegate {
                    Layout.fillWidth: true
                    visible: cfg_playlistEnabled
                    background: null
                    contentItem: ColumnLayout {
                        spacing: Kirigami.Units.smallSpacing
                        Label {
                            Layout.fillWidth: true
                            text: cfg_playlistShaders && cfg_playlistShaders.length > 0
                                ? i18np("%1 shader in playlist", "%1 shaders in playlist", cfg_playlistShaders.length)
                                : i18n("Playlist is empty — add the current shader, or pick from the gallery.")
                            wrapMode: Text.WordWrap
                            opacity: 0.75
                        }
                        RowLayout {
                            spacing: Kirigami.Units.smallSpacing
                            Layout.fillWidth: true
                            Button {
                                text: i18n("Add current shader")
                                icon.name: "list-add"
                                enabled: cfg_selectedShaderPath.length > 0
                                onClicked: {
                                    var list = (cfg_playlistShaders || []).slice()
                                    if (list.indexOf(cfg_selectedShaderPath) === -1) {
                                        list.push(cfg_selectedShaderPath)
                                        cfg_playlistShaders = list
                                    }
                                }
                            }
                            Button {
                                text: i18n("Remove current shader")
                                icon.name: "list-remove"
                                enabled: cfg_playlistShaders && cfg_playlistShaders.indexOf(cfg_selectedShaderPath) >= 0
                                onClicked: {
                                    var list = (cfg_playlistShaders || []).slice()
                                    var idx = list.indexOf(cfg_selectedShaderPath)
                                    if (idx >= 0) {
                                        list.splice(idx, 1)
                                        cfg_playlistShaders = list
                                    }
                                }
                            }
                            Button {
                                text: i18n("Manage…")
                                icon.name: "view-list-text"
                                onClicked: playlistSheet.open()
                            }
                            Item { Layout.fillWidth: true }
                            Button {
                                text: i18n("Clear")
                                icon.name: "edit-clear"
                                flat: true
                                enabled: cfg_playlistShaders && cfg_playlistShaders.length > 0
                                onClicked: cfg_playlistShaders = []
                            }
                        }
                    }
                }
            }

            // ============================================================
            // Experimental (B5 / B6 / B7 / C8)
            // ============================================================
            FormCard.FormHeader {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                title: i18n("Experimental")
                visible: mainColumn.matchSearch("experimental multi monitor screen virtual desktop parallax hot reload watch editor screenoffset iscreenoffset iscreenindex ivirtualdesktop")
            }

            FormCard.FormCard {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                visible: mainColumn.matchSearch("experimental multi monitor screen virtual desktop parallax hot reload watch editor screenoffset iscreenoffset iscreenindex ivirtualdesktop")

                Kirigami.InlineMessage {
                    Layout.fillWidth: true
                    Layout.margins: Kirigami.Units.largeSpacing
                    type: Kirigami.MessageType.Warning
                    visible: true
                    text: i18n("These features are experimental — they may not work on every Plasma setup, and the shader interface may change in a future release.")
                }

                FormCard.FormSwitchDelegate {
                    text: i18n("Multi-monitor uniforms (iScreenOffset / iScreenIndex / iScreenCount)")
                    description: i18n("Let the shader know which screen it's drawing on so it can span all monitors as one canvas. Add 'uniform vec2 iScreenOffset;' to your shader and add it to fragCoord.")
                    checked: cfg_experimentalScreenUniforms
                    onToggled: cfg_experimentalScreenUniforms = checked
                }

                FormCard.FormSwitchDelegate {
                    text: i18n("Virtual-desktop uniforms (iVirtualDesktop)")
                    description: i18n("Exposes 'uniform int iVirtualDesktop;' and 'uniform int iVirtualDesktopCount;' so a shader can change its colour or composition per desktop.")
                    checked: cfg_experimentalDesktopUniform
                    onToggled: cfg_experimentalDesktopUniform = checked
                }

                FormCard.FormSwitchDelegate {
                    text: i18n("Parallax on virtual-desktop switch")
                    description: i18n("Animates a horizontal pan when you switch workspaces (no shader changes needed).")
                    checked: cfg_experimentalParallax
                    onToggled: cfg_experimentalParallax = checked
                }

                FormCard.AbstractFormDelegate {
                    Layout.fillWidth: true
                    visible: cfg_experimentalParallax
                    background: null
                    contentItem: RowLayout {
                        spacing: Kirigami.Units.largeSpacing
                        Label {
                            text: i18n("Parallax strength")
                            Layout.preferredWidth: Kirigami.Units.gridUnit * 11
                        }
                        Slider {
                            Layout.fillWidth: true
                            from: 0.05
                            to: 0.5
                            stepSize: 0.05
                            value: cfg_experimentalParallaxStrength
                            onMoved: cfg_experimentalParallaxStrength = Math.round(value * 20) / 20
                        }
                        Label {
                            text: Math.round(cfg_experimentalParallaxStrength * 100) + "%"
                            Layout.minimumWidth: Kirigami.Units.gridUnit * 3
                            horizontalAlignment: Text.AlignRight
                        }
                    }
                }

                FormCard.FormSwitchDelegate {
                    id: hotReloadSwitch
                    text: i18n("Hot-reload shader files on save (developer mode)")
                    description: i18n("Watches the main .frag plus any enabled buffer passes (e.g. bufferA.frag) and common code on disk, then re-applies them when you save in your editor.")
                    checked: cfg_watchSourceFile
                    onToggled: cfg_watchSourceFile = checked
                }

                FormCard.FormSwitchDelegate {
                    id: shaderTweaksSwitch
                    text: i18n("Shader Tweaks (live-edit constants and colours)")
                    description: i18n("Parses the active shader for top-level float / vec3 / #define constants and exposes them as live controls in a dedicated 'Shader Tweaks' card above. Tweaks override the file in memory only — your .frag is never modified.")
                    checked: cfg_enableShaderTweaks
                    onToggled: cfg_enableShaderTweaks = checked
                }

                FormCard.FormButtonDelegate {
                    text: i18n("Open current shader in default editor")
                    description: i18n("Launches your system's default editor on the active shader file so you can iterate quickly.")
                    icon.name: "document-edit"
                    enabled: cfg_selectedShaderPath.length > 0
                                && cfg_selectedShaderPath.indexOf("file://") === 0
                    onClicked: Qt.openUrlExternally(cfg_selectedShaderPath)
                }
            }

            // ============================================================
            // About / help
            // ============================================================
            FormCard.FormHeader {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                title: i18n("About")
                visible: mainColumn.matchSearch("about help github kofi support documentation credit license")
            }

            FormCard.FormCard {
                Layout.fillWidth: true
                Layout.leftMargin: configItem.cardSideMargin
                Layout.rightMargin: configItem.cardSideMargin
                maximumWidth: configItem.cardMaxWidth
                visible: mainColumn.matchSearch("about help github kofi support documentation credit license")

                FormCard.FormButtonDelegate {
                    text: i18n("Help & documentation")
                    icon.name: "help-about"
                    onClicked: helpSheet.open()
                }
                FormCard.FormButtonDelegate {
                    text: i18n("Re-run setup wizard")
                    description: i18n("Walk through shader picking and input setup again.")
                    icon.name: "tools-wizard"
                    onClicked: {
                        onboardingSheet.startStep = 0
                        onboardingSheet.open()
                    }
                }
                FormCard.FormButtonDelegate {
                    id: regenThumbButton
                    text: i18n("Regenerate this shader's thumbnail")
                    description: previewErrorActive()
                        ? i18n("Preview is in an error state — fix the shader, then try again.")
                        : (previewEngine.currentFps > 0
                            ? i18n("Capture a fresh 16:9 thumbnail straight from the preview tile above. The new image appears in the gallery immediately.")
                            : i18n("Waiting for the preview to start rendering…"))
                    icon.name: "view-refresh"
                    enabled: cfg_selectedShaderPath.length > 0
                        && !previewErrorActive()
                        && previewEngine.currentFps > 0
                    onClicked: {
                        // Capture straight from the in-config preview tile.
                        // Avoids the old round-trip through the live wallpaper,
                        // which often failed silently (wallpaper paused,
                        // shader not loaded yet, different process race).
                        var ok = configItem.captureThumbnailForCurrentShader(true)
                        if (!ok) {
                            console.warn("Regenerate thumbnail: preview not ready",
                                "fps=" + previewEngine.currentFps,
                                "err=" + previewErrorActive(),
                                "path=" + cfg_selectedShaderPath)
                        }
                    }
                }
                FormCard.FormButtonDelegate {
                    text: i18n("GitHub")
                    description: "github.com/y4my4my4m/kde-shader-wallpaper"
                    icon.name: "internet-web-browser"
                    onClicked: Qt.openUrlExternally("https://github.com/y4my4my4m/kde-shader-wallpaper")
                }
                FormCard.FormButtonDelegate {
                    text: i18n("Support on Ko-fi")
                    description: i18n("Support the development of this project.")
                    icon.name: "internet-web-browser"
                    onClicked: Qt.openUrlExternally("https://ko-fi.com/I2I525V5R")
                }
            }

            // Bottom padding so the last card isn't flush against the
            // dialog's lower edge.
            Item {
                Layout.fillWidth: true
                Layout.preferredHeight: Kirigami.Units.largeSpacing * 2
            }
        }
    }

    // ========================================
    // Dialogs (outside scroll area)
    // ========================================
    
    Kirigami.OverlaySheet {
        id: gallerySheet
        title: i18n("Shader Gallery")
        // Walk up to the closest Window so the sheet centers over the
        // ENTIRE config dialog instead of just our ColumnLayout child
        // (which got the sheet pinned to the bottom of the visible area
        // after switching the root from Item to ColumnLayout — ColumnLayout
        // children get positioned, so configItem.parent doesn't span the
        // dialog the way the old Item-anchors.fill version did).
        parent: configItem.Window.window
            ? configItem.Window.window.contentItem
            : (configItem.parent || configItem)

        // Resolve the current selection's shader id so the gallery can
        // visually highlight the card we're already running. Recomputed
        // whenever cfg_selectedShaderPath changes.
        readonly property string currentShaderId: {
            if (!cfg_selectedShaderPath) return ""
            var s = ShaderLibrarySingleton.getShaderByPath(cfg_selectedShaderPath)
            return s ? s.id : ""
        }

        // Footer with the live-preview message + a Done button. The user
        // can browse / try shaders as much as they want; the gallery
        // stays open until they explicitly hit Done (or X / Escape).
        footer: RowLayout {
            spacing: Kirigami.Units.smallSpacing
            Kirigami.Icon {
                source: "preferences-desktop-effects"
                Layout.preferredWidth: Kirigami.Units.iconSizes.smallMedium
                Layout.preferredHeight: Kirigami.Units.iconSizes.smallMedium
                opacity: 0.6
            }
            Label {
                Layout.fillWidth: true
                text: gallerySheet.currentShaderId.length > 0
                    ? i18n("Live preview: %1", prettyShaderName(cfg_selectedShaderPath))
                    : i18n("Click any shader to preview it on your desktop. Close when you're happy.")
                elide: Text.ElideMiddle
                opacity: 0.85
            }
            Button {
                text: i18n("Done")
                icon.name: "dialog-ok-apply"
                onClicked: gallerySheet.close()
            }
        }

        GalleryView {
            id: galleryView
            // Width can use most of the dialog. The OverlaySheet adds about
            // a `largeSpacing` of internal margin on each side, so leave a
            // small budget so we don't trigger the outer horizontal scroll.
            implicitWidth: Math.min(Kirigami.Units.gridUnit * 90,
                                    gallerySheet.parent
                                        ? gallerySheet.parent.width - Kirigami.Units.gridUnit * 4
                                        : 1200)
            // Height must account for OverlaySheet's own chrome — the
            // sheet's `y` (≈ 3 grid units), its header + separator
            // (≈ Kirigami.Units.iconSizes.smallMedium + largeSpacing*2),
            // its footer (≈ 2 grid units for the Done button + padding),
            // plus its top/bottom Popup padding (default ~24 px). If we
            // hand the sheet an implicitHeight larger than the visible
            // ScrollView, *both* our internal Flickable scrollbar and the
            // OverlaySheet's outer scrollbar show up — the "two slidebars"
            // bug. Subtracting 10 grid units of safety leaves headroom
            // even on small displays.
            implicitHeight: Math.min(Kirigami.Units.gridUnit * 40,
                                     gallerySheet.parent
                                         ? gallerySheet.parent.height - Kirigami.Units.gridUnit * 10
                                         : 660)

            // Keep the gallery's selected highlight in sync with whatever
            // is actually applied to the wallpaper — so when the user
            // reopens the sheet, they can immediately see "I'm on this
            // shader". onShaderSelected sets its own selectedShaderId
            // first, but we re-bind here for the reopen case.
            selectedShaderId: gallerySheet.currentShaderId
            selectedShaderPath: cfg_selectedShaderPath

            // CRITICAL: do NOT close the sheet here. The user wants to be
            // able to try many shaders in succession without re-opening
            // the gallery each time. Apply now; close via the footer's
            // Done button (or the X / Escape).
            onShaderSelected: (id, path, name) => {
                configItem.applyShaderFromPath(path, name)
            }
        }
    }
    
    ImportDialog {
        id: importDialog

        onShaderImported: (code, metadata) => {
            configItem.applyImportedShader(code, {}, "")
        }

        onShaderWithBuffersImported: (mainCode, bufferCodes, commonCode, metadata) => {
            configItem.applyImportedShader(mainCode, bufferCodes || {}, commonCode || "")
        }
    }
    
    // First-launch onboarding wizard (UI 6). A small 4-step flow that
    // gets a brand-new user to a working, personalised wallpaper in
    // under a minute. Re-openable from the About card.
    Kirigami.OverlaySheet {
        id: onboardingSheet
        title: i18n("Welcome to Shader Wallpaper")
        parent: configItem.Window.window
            ? configItem.Window.window.contentItem
            : (configItem.parent || configItem)

        property int startStep: 0
        property int currentStep: 0
        property string pickedCategory: ""
        property string pickedShaderPath: ""

        onAboutToShow: currentStep = startStep

        ColumnLayout {
            id: onboardingContent
            spacing: Kirigami.Units.largeSpacing
            implicitWidth: Kirigami.Units.gridUnit * 42
            Layout.preferredWidth: implicitWidth

            // Progress dots
            RowLayout {
                Layout.alignment: Qt.AlignHCenter
                spacing: Kirigami.Units.smallSpacing
                Repeater {
                    model: 4
                    delegate: Rectangle {
                        width: 8; height: 8; radius: 4
                        color: index === onboardingSheet.currentStep
                            ? Kirigami.Theme.highlightColor
                            : (index < onboardingSheet.currentStep
                                ? Kirigami.Theme.positiveTextColor
                                : Kirigami.Theme.disabledTextColor)
                        Behavior on color { ColorAnimation { duration: 200 } }
                    }
                }
            }

            StackLayout {
                id: onboardStack
                Layout.fillWidth: true
                Layout.preferredHeight: Kirigami.Units.gridUnit * 18
                currentIndex: onboardingSheet.currentStep

                // ===== Step 0: Welcome =====
                ColumnLayout {
                    spacing: Kirigami.Units.largeSpacing
                    Item { Layout.fillHeight: true }
                    Kirigami.Icon {
                        Layout.alignment: Qt.AlignHCenter
                        Layout.preferredWidth: Kirigami.Units.iconSizes.huge
                        Layout.preferredHeight: Kirigami.Units.iconSizes.huge
                        source: "preferences-desktop-effects"
                    }
                    Label {
                        Layout.alignment: Qt.AlignHCenter
                        text: i18n("Live shaders on your desktop")
                        font.bold: true
                        font.pointSize: Math.round(Kirigami.Theme.defaultFont.pointSize * 1.4)
                    }
                    Label {
                        Layout.fillWidth: true
                        Layout.leftMargin: Kirigami.Units.largeSpacing * 2
                        Layout.rightMargin: Kirigami.Units.largeSpacing * 2
                        wrapMode: Text.WordWrap
                        horizontalAlignment: Text.AlignHCenter
                        opacity: 0.8
                        text: i18n("This 30-second wizard will help you pick a shader, choose any inputs it needs, and get something pretty on your desktop. You can re-run it from About → Re-run setup wizard.")
                    }
                    Item { Layout.fillHeight: true }
                }

                // ===== Step 1: Pick a category =====
                ColumnLayout {
                    spacing: Kirigami.Units.largeSpacing
                    Label {
                        text: i18n("Pick a vibe")
                        font.bold: true
                        font.pointSize: Math.round(Kirigami.Theme.defaultFont.pointSize * 1.2)
                    }
                    Label {
                        Layout.fillWidth: true
                        wrapMode: Text.WordWrap
                        opacity: 0.7
                        text: i18n("Categories are tags applied to bundled shaders. You can change category later from the gallery.")
                    }
                    Flow {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        spacing: Kirigami.Units.smallSpacing
                        // Use the live CategoryModel — same data the gallery
                        // sees. Skip "All" and "Favorites" (uninteresting
                        // first picks) and any category with zero shaders.
                        Repeater {
                            model: CategoryModel {}
                            delegate: Button {
                                visible: model.name !== "All"
                                    && model.name !== "Favorites"
                                    && model.count > 0
                                text: i18n("%1 (%2)", model.name, model.count)
                                icon.name: model.icon || ""
                                checkable: true
                                autoExclusive: true
                                checked: onboardingSheet.pickedCategory === model.name
                                onClicked: onboardingSheet.pickedCategory = model.name
                            }
                        }
                    }
                }

                // ===== Step 2: Pick a shader from that category =====
                ColumnLayout {
                    spacing: Kirigami.Units.largeSpacing
                    Label {
                        text: i18n("Pick a shader")
                        font.bold: true
                        font.pointSize: Math.round(Kirigami.Theme.defaultFont.pointSize * 1.2)
                    }
                    Label {
                        Layout.fillWidth: true
                        wrapMode: Text.WordWrap
                        opacity: 0.7
                        text: onboardingSheet.pickedCategory
                            ? i18n("Browsing the %1 category. Click a card to select.", onboardingSheet.pickedCategory)
                            : i18n("Go back and pick a category first.")
                    }

                    ScrollView {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        clip: true
                        contentWidth: availableWidth

                        Flow {
                            id: onboardShaderFlow
                            width: parent.width
                            spacing: Kirigami.Units.smallSpacing
                            Repeater {
                                id: onboardShaderRepeater
                                model: ShaderListModel {
                                    id: onboardModel
                                    category: onboardingSheet.pickedCategory
                                }
                                delegate: Rectangle {
                                    width: 150
                                    height: 110
                                    radius: Kirigami.Units.smallSpacing
                                    color: onboardingSheet.pickedShaderPath === model.shaderPath.toString()
                                        ? Kirigami.Theme.highlightColor
                                        : (cardHover.containsMouse
                                            ? Kirigami.Theme.hoverColor
                                            : Kirigami.Theme.alternateBackgroundColor)
                                    border.width: onboardingSheet.pickedShaderPath === model.shaderPath.toString() ? 2 : 1
                                    border.color: onboardingSheet.pickedShaderPath === model.shaderPath.toString()
                                        ? Kirigami.Theme.highlightColor
                                        : (Kirigami.Theme.separatorColor || Qt.rgba(1, 1, 1, 0.15))

                                    Behavior on color { ColorAnimation { duration: 150 } }
                                    Behavior on border.color { ColorAnimation { duration: 150 } }

                                    ColumnLayout {
                                        anchors.fill: parent
                                        anchors.margins: Kirigami.Units.smallSpacing
                                        spacing: Kirigami.Units.smallSpacing
                                        Image {
                                            Layout.fillWidth: true
                                            Layout.fillHeight: true
                                            source: model.thumbnailPath || ""
                                            fillMode: Image.PreserveAspectCrop
                                            visible: status === Image.Ready
                                        }
                                        Kirigami.Icon {
                                            Layout.alignment: Qt.AlignHCenter
                                            Layout.preferredWidth: Kirigami.Units.iconSizes.large
                                            Layout.preferredHeight: Kirigami.Units.iconSizes.large
                                            source: "preferences-desktop-effects"
                                            visible: !model.thumbnailPath
                                            opacity: 0.4
                                        }
                                        Label {
                                            Layout.fillWidth: true
                                            horizontalAlignment: Text.AlignHCenter
                                            text: model.name || i18n("Untitled")
                                            elide: Text.ElideMiddle
                                            font.pointSize: Kirigami.Theme.smallFont.pointSize
                                        }
                                    }

                                    MouseArea {
                                        id: cardHover
                                        anchors.fill: parent
                                        hoverEnabled: true
                                        cursorShape: Qt.PointingHandCursor
                                        onClicked: onboardingSheet.pickedShaderPath = model.shaderPath.toString()
                                    }
                                }
                            }
                        }
                    }
                }

                // ===== Step 3: Finish + summary =====
                ColumnLayout {
                    spacing: Kirigami.Units.largeSpacing

                    Label {
                        text: i18n("All set!")
                        font.bold: true
                        font.pointSize: Math.round(Kirigami.Theme.defaultFont.pointSize * 1.2)
                    }

                    // Selection summary card — gives weight to the choice
                    // and confirms what will happen when they hit Finish.
                    Rectangle {
                        Layout.fillWidth: true
                        Layout.preferredHeight: Kirigami.Units.gridUnit * 8
                        radius: Kirigami.Units.smallSpacing
                        color: Kirigami.Theme.alternateBackgroundColor
                            ? Kirigami.Theme.alternateBackgroundColor
                            : Qt.rgba(0, 0, 0, 0.15)
                        border.width: 1
                        border.color: Kirigami.Theme.highlightColor

                        RowLayout {
                            anchors.fill: parent
                            anchors.margins: Kirigami.Units.largeSpacing
                            spacing: Kirigami.Units.largeSpacing

                            Kirigami.Icon {
                                source: "preferences-desktop-effects"
                                Layout.preferredWidth: Kirigami.Units.iconSizes.huge
                                Layout.preferredHeight: Kirigami.Units.iconSizes.huge
                            }
                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 0
                                Label {
                                    Layout.fillWidth: true
                                    text: onboardingSheet.pickedShaderPath
                                        ? prettyShaderName(onboardingSheet.pickedShaderPath)
                                        : i18n("(no shader picked)")
                                    font.bold: true
                                    font.pointSize: Math.round(Kirigami.Theme.defaultFont.pointSize * 1.3)
                                    elide: Text.ElideRight
                                }
                                Label {
                                    Layout.fillWidth: true
                                    text: i18n("From the %1 category",
                                               onboardingSheet.pickedCategory || i18n("(none)"))
                                    opacity: 0.7
                                    font.pointSize: Kirigami.Theme.smallFont.pointSize
                                }
                            }
                        }
                    }

                    Label {
                        Layout.fillWidth: true
                        wrapMode: Text.WordWrap
                        text: i18n("Click Finish to apply this shader. Any inputs it needs (mouse, audio, window tracking, texture channels) will be auto-detected and enabled — you can change them later from the Inputs section, and you can pick another shader from the gallery at any time.")
                        opacity: 0.8
                    }

                    Item { Layout.fillHeight: true }
                }
            }

            // Bottom navigation
            RowLayout {
                Layout.fillWidth: true
                Button {
                    visible: onboardingSheet.currentStep === 0
                    text: i18n("Skip")
                    flat: true
                    onClicked: { onboardSettings.onboarded = true; onboardingSheet.close() }
                }
                Button {
                    visible: onboardingSheet.currentStep > 0
                    text: i18n("Back")
                    icon.name: "go-previous"
                    onClicked: onboardingSheet.currentStep -= 1
                }
                Item { Layout.fillWidth: true }
                Button {
                    visible: onboardingSheet.currentStep < 3
                    enabled: {
                        if (onboardingSheet.currentStep === 1) return onboardingSheet.pickedCategory.length > 0
                        if (onboardingSheet.currentStep === 2) return onboardingSheet.pickedShaderPath.length > 0
                        return true
                    }
                    text: i18n("Next")
                    icon.name: "go-next"
                    onClicked: onboardingSheet.currentStep += 1
                }
                Button {
                    visible: onboardingSheet.currentStep === 3
                    text: i18n("Finish")
                    icon.name: "dialog-ok-apply"
                    highlighted: true
                    onClicked: {
                        if (onboardingSheet.pickedShaderPath) {
                            configItem.applyShaderFromPath(onboardingSheet.pickedShaderPath, "")
                        }
                        onboardSettings.onboarded = true
                        onboardingSheet.close()
                    }
                }
            }
        }
    }

    // Full GL compile log sheet — opened by the "View full log" button
    // on the compile-error pane in the Shader card. The log can come from
    // two sources: GL compile/link failures (compileLog) and file-load
    // errors (errorMessage from loadShaderFromSource). We surface both.
    Kirigami.OverlaySheet {
        id: compileLogSheet
        title: i18n("Shader Compile Error")
        parent: configItem.Window.window
            ? configItem.Window.window.contentItem
            : (configItem.parent || configItem)

        readonly property string combinedLog: {
            var parts = []
            if (previewEngine.errorMessage && previewEngine.errorMessage.length > 0)
                parts.push(previewEngine.errorMessage)
            if (previewEngine.compileLog && previewEngine.compileLog.length > 0)
                parts.push(previewEngine.compileLog)
            return parts.length > 0 ? parts.join("\n\n") : ""
        }

        ColumnLayout {
            id: compileLogContent
            spacing: Kirigami.Units.largeSpacing
            implicitWidth: Kirigami.Units.gridUnit * 75
            Layout.preferredWidth: implicitWidth

            Kirigami.InlineMessage {
                Layout.fillWidth: true
                type: Kirigami.MessageType.Warning
                visible: true
                text: i18n("The new shader couldn't compile, so the previous working shader is still rendering. Fix the errors below and the new shader will take effect automatically.")
            }

            ScrollView {
                Layout.fillWidth: true
                Layout.preferredHeight: Kirigami.Units.gridUnit * 22
                TextArea {
                    readOnly: true
                    wrapMode: TextEdit.Wrap
                    font.family: "monospace"
                    font.pointSize: 10
                    text: compileLogSheet.combinedLog.length > 0
                        ? compileLogSheet.combinedLog
                        : i18n("(No log was reported by the GL driver. This usually means the shader file couldn't be loaded — check the path is readable.)")
                    selectByMouse: true
                    color: compileLogSheet.combinedLog.length > 0
                        ? Kirigami.Theme.textColor
                        : Kirigami.Theme.disabledTextColor
                }
            }

            RowLayout {
                Layout.alignment: Qt.AlignRight
                Button {
                    text: i18n("Copy to clipboard")
                    icon.name: "edit-copy"
                    enabled: compileLogSheet.combinedLog.length > 0
                    onClicked: {
                        textCopyHelper.text = compileLogSheet.combinedLog
                        textCopyHelper.selectAll()
                        textCopyHelper.copy()
                    }
                }
                Button {
                    text: i18n("Close")
                    icon.name: "dialog-close"
                    onClicked: compileLogSheet.close()
                }
            }
            // Off-screen TextEdit acts as a clipboard helper.
            TextEdit {
                id: textCopyHelper
                visible: false
            }
        }
    }

    Kirigami.OverlaySheet {
        id: helpSheet
        title: i18n("Shader Wallpaper Help")
        parent: configItem.Window.window
            ? configItem.Window.window.contentItem
            : (configItem.parent || configItem)

        // Per Kirigami OverlaySheet impl, the sheet's implicitWidth /
        // implicitHeight derive from the child's Layout.preferredWidth /
        // Layout.preferredHeight (or implicitWidth/Height) — pinning
        // those on the child directly avoids the binding loop the
        // "implicitWidth on sheet, width on child" pattern produced.
        ColumnLayout {
            id: helpSheetContent
            spacing: Kirigami.Units.largeSpacing
            implicitWidth: Kirigami.Units.gridUnit * 45
            Layout.preferredWidth: implicitWidth
            
            Label {
                Layout.fillWidth: true
                wrapMode: Text.WordWrap
                text: i18n("Shader Wallpaper allows you to run GLSL shaders as your desktop wallpaper.\n\n" +
                          "Features:\n" +
                          "• Browse and select from bundled shaders\n" +
                          "• Import shaders from Shadertoy.com\n" +
                          "• Configure texture channels (iChannel0-3)\n" +
                          "• Audio reactive shaders via PipeWire\n" +
                          "• Mouse interaction support\n" +
                          "• Save and load presets\n\n" +
                          "Emergency: If shader causes issues, delete:\n" +
                          "~/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/\n\n" +
                          "Then run: pkill plasmashell && plasmashell &")
            }
        }
    }
    
    FileDialog {
        id: fileDialog
        title: i18n("Select Shader")
        nameFilters: ["Shader files (*.frag *.frag.qsb *.glsl)", "All files (*)"]

        onAccepted: configItem.applyShaderFromPath(selectedFile, "")
    }

    FileDialog {
        id: channel0Dialog
        title: i18n("Select Texture for iChannel0")
        nameFilters: ["Image files (*.png *.jpg *.jpeg *.webp)", "All files (*)"]
        onAccepted: cfg_iChannel0 = selectedFile
    }

    FileDialog {
        id: channel1Dialog
        title: i18n("Select Texture for iChannel1")
        nameFilters: ["Image files (*.png *.jpg *.jpeg *.webp)", "All files (*)"]
        onAccepted: cfg_iChannel1 = selectedFile
    }

    FileDialog {
        id: channel2Dialog
        title: i18n("Select Texture for iChannel2")
        nameFilters: ["Image files (*.png *.jpg *.jpeg *.webp)", "All files (*)"]
        onAccepted: cfg_iChannel2 = selectedFile
    }

    FileDialog {
        id: channel3Dialog
        title: i18n("Select Texture for iChannel3")
        nameFilters: ["Image files (*.png *.jpg *.jpeg *.webp)", "All files (*)"]
        onAccepted: cfg_iChannel3 = selectedFile
    }
    
    // Save Shader Package Dialog
    Dialog {
        id: savePackageDialog
        title: i18n("Save Shader Package")
        standardButtons: Dialog.Ok | Dialog.Cancel
        modal: true
        
        ColumnLayout {
            spacing: Kirigami.Units.largeSpacing
            
            Label {
                text: i18n("Save shader with buffers as a package directory:")
                wrapMode: Text.WordWrap
            }
            
            Label {
                text: i18n("Package Name:")
            }
            
            TextField {
                id: packageNameField
                Layout.fillWidth: true
                placeholderText: i18n("my_shader")
                text: {
                    // Try to extract name from current shader path
                    if (cfg_selectedShaderPath) {
                        var path = cfg_selectedShaderPath.toString()
                        var parts = path.split("/")
                        var filename = parts[parts.length - 1]
                        return filename.replace(/\.(frag|glsl|qsb)$/i, "").replace(/\s+/g, "_")
                    }
                    return ""
                }
            }
            
            Label {
                text: i18n("Author:")
            }
            
            TextField {
                id: packageAuthorField
                Layout.fillWidth: true
                placeholderText: i18n("Your name")
            }
            
            Label {
                text: i18n("Description:")
            }
            
            TextArea {
                id: packageDescriptionField
                Layout.fillWidth: true
                Layout.preferredHeight: 60
                placeholderText: i18n("Description of this shader")
            }
            
            Kirigami.InlineMessage {
                Layout.fillWidth: true
                type: Kirigami.MessageType.Information
                text: i18n("Package will be saved to: Shaders/Packages/%1/", packageNameField.text || "unnamed")
            }
            
            // Show what will be included
            GroupBox {
                title: i18n("Package Contents")
                Layout.fillWidth: true
                
                ColumnLayout {
                    Label { text: "• main.frag (main shader)" }
                    Label {
                        visible: cfg_useBufferA && cfg_bufferACode
                        text: "• bufferA.frag"
                    }
                    Label {
                        visible: cfg_useBufferB && cfg_bufferBCode
                        text: "• bufferB.frag"
                    }
                    Label {
                        visible: cfg_useBufferC && cfg_bufferCCode
                        text: "• bufferC.frag"
                    }
                    Label {
                        visible: cfg_useBufferD && cfg_bufferDCode
                        text: "• bufferD.frag"
                    }
                    Label {
                        visible: cfg_commonCode.length > 0
                        text: "• common.glsl"
                    }
                    Label { text: "• manifest.json (configuration)" }
                }
            }
        }
        
        onAccepted: {
            if (packageNameField.text.length === 0) {
                return
            }
            
            // Collect buffer codes from the cfg_ aliases (live values).
            var bufferCodes = {}
            if (cfg_commonCode)  bufferCodes.commonCode  = cfg_commonCode
            if (cfg_bufferACode) bufferCodes.bufferACode = cfg_bufferACode
            if (cfg_bufferBCode) bufferCodes.bufferBCode = cfg_bufferBCode
            if (cfg_bufferCCode) bufferCodes.bufferCCode = cfg_bufferCCode
            if (cfg_bufferDCode) bufferCodes.bufferDCode = cfg_bufferDCode
            
            // Collect config
            var config = {
                name: packageNameField.text,
                author: packageAuthorField.text,
                description: packageDescriptionField.text,
                channels: {
                    imageChannel0: cfg_imageChannel0,
                    imageChannel1: cfg_imageChannel1,
                    imageChannel2: cfg_imageChannel2,
                    imageChannel3: cfg_imageChannel3
                },
                bufferChannels: {
                    bufferAChannel0: cfg_bufferAChannel0,
                    bufferAChannel1: cfg_bufferAChannel1,
                    bufferAChannel2: cfg_bufferAChannel2,
                    bufferAChannel3: cfg_bufferAChannel3,
                    bufferBChannel0: cfg_bufferBChannel0,
                    bufferBChannel1: cfg_bufferBChannel1,
                    bufferBChannel2: cfg_bufferBChannel2,
                    bufferBChannel3: cfg_bufferBChannel3
                }
            }
            
            // Get main shader code
            var mainCode = cfg_selectedShaderCode
            if (!mainCode && cfg_selectedShaderPath) {
                mainCode = ShaderLibrarySingleton.loadShaderCode(cfg_selectedShaderPath)
            }
            
            // Build target directory path
            var targetDir = ShaderLibrarySingleton.libraryPath + "/Shaders/Packages/" + packageNameField.text
            
            // Save package
            var success = ShaderLibrarySingleton.saveShaderPackage(targetDir, mainCode, bufferCodes, config)
            
            if (success) {
                console.log("Shader package saved to:", targetDir)
                // Refresh the library to pick up the new package
                ShaderLibrarySingleton.refresh()
            }
        }
    }
    
    // ----------------------------------------------------------------------
    // "More shaders" sheet — honest guidance on where .frag files come from.
    //
    // The KDE Store's "Plasma Wallpaper Plugin" category is for wallpaper
    // ENGINES (Image, Video, Shader Wallpaper plugin itself…) — not
    // individual shader files. Uploading .frag packs there as
    // Plasma/Wallpaper kpackages would pollute that category and confuse
    // users. There is no GHNS content type for shader files today.
    // ----------------------------------------------------------------------
    Kirigami.OverlaySheet {
        id: getNewShadersSheet
        title: i18n("Get more shaders")
        parent: configItem.Window.window
            ? configItem.Window.window.contentItem
            : (configItem.parent || configItem)

        ColumnLayout {
            spacing: Kirigami.Units.largeSpacing
            implicitWidth: Kirigami.Units.gridUnit * 48
            Layout.preferredWidth: Kirigami.Units.gridUnit * 48

            Kirigami.InlineMessage {
                Layout.fillWidth: true
                type: Kirigami.MessageType.Information
                text: i18n("Individual shaders are .frag files, not KDE Store packages. The store only lists wallpaper engines (like this plugin) — not shader artwork. Use the options below to add shaders.")
            }

            // Option 1 — bundled collection on GitHub.
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: ghRow.implicitHeight + Kirigami.Units.largeSpacing * 2
                color: Kirigami.Theme.alternateBackgroundColor
                radius: 4
                RowLayout {
                    id: ghRow
                    anchors.fill: parent
                    anchors.margins: Kirigami.Units.largeSpacing
                    spacing: Kirigami.Units.largeSpacing
                    Kirigami.Icon {
                        source: "github"
                        fallback: "folder-git"
                        Layout.preferredWidth: Kirigami.Units.iconSizes.large
                        Layout.preferredHeight: Kirigami.Units.iconSizes.large
                    }
                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 0
                        Label { text: i18n("Built-in shader collection (GitHub)"); font.bold: true }
                        Label {
                            Layout.fillWidth: true
                            text: i18n("Browse the shaders shipped with this project. Download a .frag file, then drag-and-drop it onto this settings window or use Open File… above.")
                            wrapMode: Text.WordWrap
                            opacity: 0.7
                            font.pixelSize: Kirigami.Theme.smallFont.pixelSize
                        }
                    }
                    Button {
                        text: i18n("Open in browser")
                        icon.name: "internet-web-browser"
                        onClicked: {
                            Qt.openUrlExternally("https://github.com/y4my4my4m/kde-shader-wallpaper/tree/master/package/contents/ui/Shaders")
                            getNewShadersSheet.close()
                        }
                    }
                }
            }

            // Option 2 — import from Shadertoy / URL.
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: importRow.implicitHeight + Kirigami.Units.largeSpacing * 2
                color: Kirigami.Theme.alternateBackgroundColor
                radius: 4
                RowLayout {
                    id: importRow
                    anchors.fill: parent
                    anchors.margins: Kirigami.Units.largeSpacing
                    spacing: Kirigami.Units.largeSpacing
                    Kirigami.Icon {
                        source: "document-import"
                        Layout.preferredWidth: Kirigami.Units.iconSizes.large
                        Layout.preferredHeight: Kirigami.Units.iconSizes.large
                    }
                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 0
                        Label { text: i18n("Import from Shadertoy or URL"); font.bold: true }
                        Label {
                            Layout.fillWidth: true
                            text: i18n("Paste a Shadertoy link or GLSL code directly — no store needed.")
                            wrapMode: Text.WordWrap
                            opacity: 0.7
                            font.pixelSize: Kirigami.Theme.smallFont.pixelSize
                        }
                    }
                    Button {
                        text: i18n("Import…")
                        icon.name: "document-import"
                        onClicked: {
                            getNewShadersSheet.close()
                            importDialog.open()
                        }
                    }
                }
            }

            // Option 3 — drag-and-drop reminder.
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: dropRow.implicitHeight + Kirigami.Units.largeSpacing * 2
                color: Kirigami.Theme.alternateBackgroundColor
                radius: 4
                RowLayout {
                    id: dropRow
                    anchors.fill: parent
                    anchors.margins: Kirigami.Units.largeSpacing
                    spacing: Kirigami.Units.largeSpacing
                    Kirigami.Icon {
                        source: "object-flip-vertical"
                        Layout.preferredWidth: Kirigami.Units.iconSizes.large
                        Layout.preferredHeight: Kirigami.Units.iconSizes.large
                    }
                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 0
                        Label { text: i18n("Drag and drop"); font.bold: true }
                        Label {
                            Layout.fillWidth: true
                            text: i18n("Drop any .frag file anywhere on this settings panel to load it instantly.")
                            wrapMode: Text.WordWrap
                            opacity: 0.7
                            font.pixelSize: Kirigami.Theme.smallFont.pixelSize
                        }
                    }
                }
            }

            Item { Layout.preferredHeight: Kirigami.Units.smallSpacing }

            RowLayout {
                Layout.fillWidth: true
                Item { Layout.fillWidth: true }
                Button {
                    text: i18n("Close")
                    onClicked: getNewShadersSheet.close()
                }
            }
        }
    }

    // ----------------------------------------------------------------------
    // Playlist management sheet (A3) — lets users reorder and remove items.
    // We deliberately keep this simple (no drag-reorder yet) since the
    // typical playlist is 3-10 entries and a "move up / move down" pair is
    // plenty.
    // ----------------------------------------------------------------------
    Kirigami.OverlaySheet {
        id: playlistSheet
        title: i18n("Playlist (%1 shaders)", (cfg_playlistShaders || []).length)
        parent: configItem.Window.window
            ? configItem.Window.window.contentItem
            : (configItem.parent || configItem)

        ColumnLayout {
            spacing: Kirigami.Units.largeSpacing
            implicitWidth: Kirigami.Units.gridUnit * 55
            Layout.preferredWidth: Kirigami.Units.gridUnit * 55

            Label {
                Layout.fillWidth: true
                visible: (cfg_playlistShaders || []).length === 0
                text: i18n("Your playlist is empty. Pick a shader in the gallery, then click 'Add current shader' in the Playlist section above.")
                wrapMode: Text.WordWrap
                opacity: 0.7
            }

            ListView {
                Layout.fillWidth: true
                Layout.preferredHeight: Math.min(400, Math.max(80, (cfg_playlistShaders || []).length * 56))
                clip: true
                spacing: Kirigami.Units.smallSpacing
                model: cfg_playlistShaders || []

                delegate: Rectangle {
                    width: ListView.view.width
                    height: 52
                    color: Kirigami.Theme.alternateBackgroundColor
                    radius: 4
                    border.width: 1
                    border.color: Qt.rgba(0, 0, 0, 0.08)

                    RowLayout {
                        anchors.fill: parent
                        anchors.margins: Kirigami.Units.smallSpacing
                        spacing: Kirigami.Units.smallSpacing

                        Label {
                            Layout.preferredWidth: Kirigami.Units.gridUnit * 2
                            text: (index + 1) + "."
                            horizontalAlignment: Text.AlignRight
                            opacity: 0.6
                        }

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 0
                            Label {
                                Layout.fillWidth: true
                                text: {
                                    var s = ShaderLibrarySingleton.getShaderByPath(modelData)
                                    return s ? s.name : modelData.split("/").pop().replace(".frag", "")
                                }
                                elide: Text.ElideRight
                                font.bold: true
                            }
                            Label {
                                Layout.fillWidth: true
                                text: modelData.replace("file://", "")
                                elide: Text.ElideLeft
                                opacity: 0.5
                                font.pixelSize: 10
                            }
                        }

                        Button {
                            icon.name: "arrow-up"
                            flat: true
                            enabled: index > 0
                            onClicked: {
                                var list = cfg_playlistShaders.slice()
                                var tmp = list[index]
                                list[index] = list[index - 1]
                                list[index - 1] = tmp
                                cfg_playlistShaders = list
                            }
                        }
                        Button {
                            icon.name: "arrow-down"
                            flat: true
                            enabled: index < (cfg_playlistShaders.length - 1)
                            onClicked: {
                                var list = cfg_playlistShaders.slice()
                                var tmp = list[index]
                                list[index] = list[index + 1]
                                list[index + 1] = tmp
                                cfg_playlistShaders = list
                            }
                        }
                        Button {
                            icon.name: "go-jump"
                            flat: true
                            text: i18n("Play")
                            onClicked: cfg_selectedShaderPath = modelData
                        }
                        Button {
                            icon.name: "list-remove"
                            flat: true
                            onClicked: {
                                var list = cfg_playlistShaders.slice()
                                list.splice(index, 1)
                                cfg_playlistShaders = list
                            }
                        }
                    }
                }
            }

            RowLayout {
                Layout.fillWidth: true
                Item { Layout.fillWidth: true }
                Button {
                    text: i18n("Close")
                    onClicked: playlistSheet.close()
                }
            }
        }
    }

    // Channel Mapping Configuration Sheet
    Kirigami.OverlaySheet {
        id: channelMappingSheet
        title: i18n("Channel Mapping")
        parent: configItem.Window.window
            ? configItem.Window.window.contentItem
            : (configItem.parent || configItem)

        ColumnLayout {
            id: channelMappingContent
            spacing: Kirigami.Units.largeSpacing
            implicitWidth: Kirigami.Units.gridUnit * 50
            Layout.preferredWidth: implicitWidth
            
            Kirigami.InlineMessage {
                Layout.fillWidth: true
                type: Kirigami.MessageType.Information
                text: i18n("Configure which input each iChannel reads from for each render pass. Each pass (Image, Buffer A-D) can have different inputs.")
            }
            
            // Image Pass
            GroupBox {
                title: i18n("Image Pass (Main Output)")
                Layout.fillWidth: true
                
                GridLayout {
                    columns: 4
                    columnSpacing: Kirigami.Units.smallSpacing
                    
                    Label { text: "iChannel0:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_imageChannel0)
                        onActivated: cfg_imageChannel0 = currentValue
                    }

                    Label { text: "iChannel1:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_imageChannel1)
                        onActivated: cfg_imageChannel1 = currentValue
                    }

                    Label { text: "iChannel2:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_imageChannel2)
                        onActivated: cfg_imageChannel2 = currentValue
                    }

                    Label { text: "iChannel3:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_imageChannel3)
                        onActivated: cfg_imageChannel3 = currentValue
                    }
                }
            }
            
            // Buffer A
            GroupBox {
                title: i18n("Buffer A")
                Layout.fillWidth: true
                visible: cfg_useBufferA
                
                GridLayout {
                    columns: 4
                    columnSpacing: Kirigami.Units.smallSpacing
                    
                    Label { text: "iChannel0:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_bufferAChannel0)
                        onActivated: cfg_bufferAChannel0 = currentValue
                    }

                    Label { text: "iChannel1:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_bufferAChannel1)
                        onActivated: cfg_bufferAChannel1 = currentValue
                    }

                    Label { text: "iChannel2:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_bufferAChannel2)
                        onActivated: cfg_bufferAChannel2 = currentValue
                    }

                    Label { text: "iChannel3:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_bufferAChannel3)
                        onActivated: cfg_bufferAChannel3 = currentValue
                    }
                }
            }
            
            // Buffer B
            GroupBox {
                title: i18n("Buffer B")
                Layout.fillWidth: true
                visible: cfg_useBufferB
                
                GridLayout {
                    columns: 4
                    columnSpacing: Kirigami.Units.smallSpacing
                    
                    Label { text: "iChannel0:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_bufferBChannel0)
                        onActivated: cfg_bufferBChannel0 = currentValue
                    }

                    Label { text: "iChannel1:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_bufferBChannel1)
                        onActivated: cfg_bufferBChannel1 = currentValue
                    }

                    Label { text: "iChannel2:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_bufferBChannel2)
                        onActivated: cfg_bufferBChannel2 = currentValue
                    }

                    Label { text: "iChannel3:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_bufferBChannel3)
                        onActivated: cfg_bufferBChannel3 = currentValue
                    }
                }
            }
            
            // Buffer C
            GroupBox {
                title: i18n("Buffer C")
                Layout.fillWidth: true
                visible: cfg_useBufferC
                
                GridLayout {
                    columns: 4
                    columnSpacing: Kirigami.Units.smallSpacing
                    
                    Label { text: "iChannel0:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_bufferCChannel0)
                        onActivated: cfg_bufferCChannel0 = currentValue
                    }

                    Label { text: "iChannel1:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_bufferCChannel1)
                        onActivated: cfg_bufferCChannel1 = currentValue
                    }

                    Label { text: "iChannel2:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_bufferCChannel2)
                        onActivated: cfg_bufferCChannel2 = currentValue
                    }

                    Label { text: "iChannel3:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_bufferCChannel3)
                        onActivated: cfg_bufferCChannel3 = currentValue
                    }
                }
            }
            
            // Buffer D
            GroupBox {
                title: i18n("Buffer D")
                Layout.fillWidth: true
                visible: cfg_useBufferD
                
                GridLayout {
                    columns: 4
                    columnSpacing: Kirigami.Units.smallSpacing
                    
                    Label { text: "iChannel0:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_bufferDChannel0)
                        onActivated: cfg_bufferDChannel0 = currentValue
                    }

                    Label { text: "iChannel1:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_bufferDChannel1)
                        onActivated: cfg_bufferDChannel1 = currentValue
                    }

                    Label { text: "iChannel2:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_bufferDChannel2)
                        onActivated: cfg_bufferDChannel2 = currentValue
                    }

                    Label { text: "iChannel3:" }
                    ComboBox {
                        model: channelSourceModel
                        textRole: "text"
                        valueRole: "value"
                        currentIndex: findChannelIndex(cfg_bufferDChannel3)
                        onActivated: cfg_bufferDChannel3 = currentValue
                    }
                }
            }
            
            Label {
                Layout.fillWidth: true
                wrapMode: Text.WordWrap
                font.italic: true
                opacity: 0.7
                text: i18n("Note: 'Buffer A' in a channel refers to Buffer A's output from the previous frame, enabling feedback effects. Self-referencing (e.g., Buffer A reading from Buffer A) creates persistence/motion blur.")
            }
        }
    }
    
    // Buffer Code Editor Sheet
    Kirigami.OverlaySheet {
        id: bufferCodeSheet
        title: i18n("Edit Shader Code")
        parent: configItem.Window.window
            ? configItem.Window.window.contentItem
            : (configItem.parent || configItem)

        ColumnLayout {
            id: bufferCodeContent
            spacing: Kirigami.Units.largeSpacing
            implicitWidth: Kirigami.Units.gridUnit * 60
            Layout.preferredWidth: implicitWidth
            
            TabBar {
                id: codeEditorTabs
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
                Layout.preferredHeight: Kirigami.Units.gridUnit * 20
                currentIndex: codeEditorTabs.currentIndex
                
                // Common code
                ScrollView {
                    TextArea {
                        id: editCommonCode
                        font.family: "monospace"
                        font.pointSize: 10
                        text: cfg_commonCode
                        wrapMode: TextEdit.NoWrap
                        placeholderText: "// Shared functions and constants\n// Prepended to all passes"
                        onTextChanged: if (text !== cfg_commonCode) cfg_commonCode = text
                    }
                }

                // Main Image code
                ScrollView {
                    TextArea {
                        id: editMainCode
                        font.family: "monospace"
                        font.pointSize: 10
                        text: cfg_selectedShaderCode
                        wrapMode: TextEdit.NoWrap
                        placeholderText: "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n    // Main shader code\n}"
                        onTextChanged: if (text !== cfg_selectedShaderCode) cfg_selectedShaderCode = text
                    }
                }

                // Buffer A code
                ScrollView {
                    TextArea {
                        id: editBufferACode
                        font.family: "monospace"
                        font.pointSize: 10
                        text: cfg_bufferACode
                        wrapMode: TextEdit.NoWrap
                        placeholderText: "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n    // Buffer A code\n}"
                        onTextChanged: if (text !== cfg_bufferACode) cfg_bufferACode = text
                    }
                }

                // Buffer B code
                ScrollView {
                    TextArea {
                        id: editBufferBCode
                        font.family: "monospace"
                        font.pointSize: 10
                        text: cfg_bufferBCode
                        wrapMode: TextEdit.NoWrap
                        placeholderText: "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n    // Buffer B code\n}"
                        onTextChanged: if (text !== cfg_bufferBCode) cfg_bufferBCode = text
                    }
                }

                // Buffer C code
                ScrollView {
                    TextArea {
                        id: editBufferCCode
                        font.family: "monospace"
                        font.pointSize: 10
                        text: cfg_bufferCCode
                        wrapMode: TextEdit.NoWrap
                        placeholderText: "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n    // Buffer C code\n}"
                        onTextChanged: if (text !== cfg_bufferCCode) cfg_bufferCCode = text
                    }
                }

                // Buffer D code
                ScrollView {
                    TextArea {
                        id: editBufferDCode
                        font.family: "monospace"
                        font.pointSize: 10
                        text: cfg_bufferDCode
                        wrapMode: TextEdit.NoWrap
                        placeholderText: "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n    // Buffer D code\n}"
                        onTextChanged: if (text !== cfg_bufferDCode) cfg_bufferDCode = text
                    }
                }
            }
            
            Kirigami.InlineMessage {
                Layout.fillWidth: true
                type: Kirigami.MessageType.Information
                text: i18n("Changes are saved automatically. Each buffer needs its own mainImage() function. Common code is shared across all passes.")
            }
            
            RowLayout {
                Layout.alignment: Qt.AlignRight
                
                Button {
                    text: i18n("Clear All Buffer Code")
                    icon.name: "edit-clear"

                    onClicked: {
                        cfg_commonCode = ""
                        cfg_bufferACode = ""
                        cfg_bufferBCode = ""
                        cfg_bufferCCode = ""
                        cfg_bufferDCode = ""
                    }
                }
                
                Button {
                    text: i18n("Close")
                    icon.name: "dialog-close"
                    onClicked: bufferCodeSheet.close()
                }
            }
        }
    }
}

