// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtCore
import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Dialogs
import QtQuick.Layouts
import QtQuick.Window
import org.kde.kirigami as Kirigami
import "shaderwallpaper"
import "config"
import "ShaderApply.js" as ShaderApply
import "ChannelDirective.js" as ChannelDirective

// Settings page. config.qml (the root the host instantiates) owns the
// cfg_* contract and mirrors every cfg_* below in both directions; the
// literals here are only the type defaults before the initial properties
// arrive. Child pages read and write cfg_* through `root: configItem`.
//
// Root is a ColumnLayout: Plasma's wallpaper page sizes its child through
// Layout attached properties, an Item root stays at implicit size.
ColumnLayout {
    id: configItem
    objectName: "configContent"

    Layout.fillWidth: true
    Layout.fillHeight: true
    spacing: 0

    // ── host context (initial properties from config.qml) ────────────────
    property var hostConfigDialog: null
    property bool liveDesktopDialog: false
    property bool desktopWallpaperContext: false

    // Apply to all screens succeeded; this screen's values are saved too.
    signal screensSynced()

    // ── cfg_* ─────────────────────────────────────────────────────────────
    property string cfg_selectedShaderPath: ""
    property string cfg_selectedShaderCode: ""
    property int    cfg_selectedShaderIndex: 0
    property int    cfg_configVersion: 2
    property bool   cfg_showFps: false
    property bool   cfg_infoPlasma6Preview_dismissed: false
    property bool   cfg_warningResources_dismissed: false
    property bool   cfg_emergencyHelp_dismissed: false

    property bool   cfg_running: true
    property double cfg_shaderSpeed: 1.0
    property int    cfg_targetFps: 60
    property int    cfg_pauseMode: 0
    property real   cfg_resolutionScale: 1.0
    property bool   cfg_checkActiveScreen: true
    property var    cfg_excludeWindows: []
    property bool   cfg_showPauseIndicator: false

    property bool   cfg_mouseEnabled: false
    property double cfg_mouseBias: 1.0
    property bool   cfg_audioEnabled: false
    property int    cfg_audioChannel: 0
    property double cfg_audioSensitivity: 40.0
    property bool   cfg_windowsEnabled: false

    property bool   cfg_showPerformance: false
    property bool   cfg_showPerformanceGraph: true
    property bool   cfg_performanceExpanded: true
    property int    cfg_gpuTdp: 75

    property bool   cfg_playlistEnabled: false
    property var    cfg_playlistShaders: []
    property int    cfg_playlistIntervalMinutes: 10
    property bool   cfg_playlistShuffle: false
    property int    cfg_playlistSource: 0

    property bool   cfg_experimentalScreenUniforms: false
    property bool   cfg_experimentalDesktopUniform: false
    property bool   cfg_experimentalParallax: false
    property real   cfg_experimentalParallaxStrength: 0.25
    property bool   cfg_experimentalHdrPipeline: false
    property bool   cfg_dither: true
    property bool   cfg_watchSourceFile: false
    property bool   cfg_enableShaderTweaks: false
    property int    cfg_bufferSimulationMaxHeight: 0

    property string cfg_iChannel0: ""
    property string cfg_iChannel1: ""
    property string cfg_iChannel2: ""
    property string cfg_iChannel3: ""
    property bool   cfg_iChannel0Enabled: false
    property bool   cfg_iChannel1Enabled: false
    property bool   cfg_iChannel2Enabled: false
    property bool   cfg_iChannel3Enabled: false

    property bool cfg_useBufferA: false
    property bool cfg_useBufferB: false
    property bool cfg_useBufferC: false
    property bool cfg_useBufferD: false

    property string cfg_commonCode: ""
    property string cfg_bufferACode: ""
    property string cfg_bufferBCode: ""
    property string cfg_bufferCCode: ""
    property string cfg_bufferDCode: ""

    // Routing: -1 none, 0..3 image slot, 10..13 buffer A..D, 20 audio.
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

    // ── layout constants ──────────────────────────────────────────────────
    readonly property real formMaxWidth: Kirigami.Units.gridUnit * 56
    readonly property real pageMaxWidth: Kirigami.Units.gridUnit * 100

    // ── current shader ────────────────────────────────────────────────────
    property var currentShader: null
    function _refreshCurrentShader() {
        currentShader = cfg_selectedShaderPath.length > 0
            ? ShaderLibrarySingleton.getShaderByPath(cfg_selectedShaderPath) : null
    }
    onCfg_selectedShaderPathChanged: {
        _refreshCurrentShader()
        _scheduleUsage()
        previewThumbnailTimer.restart()
    }
    Connections {
        target: ShaderLibrarySingleton
        function onShaderCountChanged() { configItem._refreshCurrentShader() }
        function onShaderUpdated(id) { if (id === configItem.currentShaderId) configItem._refreshCurrentShader() }
    }

    readonly property string currentShaderId: currentShader ? currentShader.id : ""
    readonly property bool inlineOverride: cfg_selectedShaderCode.length > 0
    readonly property bool fileBacked: cfg_selectedShaderPath.length > 0
    // A library shader running from an edited in-config copy (tweaks or
    // the code editor).
    readonly property bool isEdited: fileBacked && inlineOverride
    readonly property string currentShaderName: {
        if (currentShader && currentShader.name) return currentShader.name
        if (fileBacked) return ShaderApply.displayName(cfg_selectedShaderPath)
        if (inlineOverride) return i18n("Custom shader code")
        return i18n("No shader selected")
    }
    readonly property string currentShaderCategory: currentShader ? (currentShader.category || "") : ""

    // ── compile state, from the settings preview ─────────────────────────
    readonly property var previewEngine: header.previewEngine
    readonly property bool compileFailed: previewEngine !== null && previewEngine.compileFailed === true
    readonly property string compileLog: previewEngine ? (previewEngine.compileLog || "") : ""
    readonly property string loadError: previewEngine && previewEngine.hasError ? (previewEngine.errorMessage || "") : ""
    readonly property bool previewBroken: compileFailed || loadError.length > 0
    readonly property string combinedLog: [loadError, compileLog].filter(function(s) { return s.length > 0 }).join("\n\n")
    // The driver's first "error" line, else the first line.
    readonly property string firstLogLine: {
        const lines = combinedLog.split("\n").filter(function(l) { return l.trim().length > 0 })
        for (let i = 0; i < lines.length; i++)
            if (/error/i.test(lines[i]) && !/failed:?\s*$/i.test(lines[i])) return lines[i].trim()
        return lines.length > 0 ? lines[0].trim() : ""
    }

    // ── dialogs covering the page pause the preview ──────────────────────
    property int openDialogs: 0
    function noteDialog(open) { openDialogs = Math.max(0, openDialogs + (open ? 1 : -1)) }

    // ── shader input usage (drives the needs-attention hints) ────────────
    property var shaderUsage: ({ window: false, mouse: false, audio: false, textures: [false, false, false, false] })
    // Images the current shader declares with @textureN header lines.
    property var shaderImages: [null, null, null, null]

    function mainCode() {
        if (inlineOverride) return cfg_selectedShaderCode
        return fileBacked ? (ShaderLibrarySingleton.loadShaderCode(ShaderApply.toFileUrl(ShaderLibrarySingleton, cfg_selectedShaderPath)) || "") : ""
    }

    function passRouting(pass) {
        if (pass === "image") return [cfg_imageChannel0, cfg_imageChannel1, cfg_imageChannel2, cfg_imageChannel3]
        return [0, 1, 2, 3].map(function(c) { return configItem["cfg_buffer" + pass + "Channel" + c] })
    }

    function refreshShaderUsage() {
        const main = mainCode()
        const codes = { image: main, A: cfg_bufferACode, B: cfg_bufferBCode, C: cfg_bufferCCode, D: cfg_bufferDCode }
        const passes = ["image"]
        if (cfg_useBufferA) passes.push("A")
        if (cfg_useBufferB) passes.push("B")
        if (cfg_useBufferC) passes.push("C")
        if (cfg_useBufferD) passes.push("D")
        const textures = [false, false, false, false]
        let audio = false
        for (let p = 0; p < passes.length; p++) {
            const code = (codes[passes[p]] || "") + "\n" + cfg_commonCode
            const routing = passRouting(passes[p])
            for (let ch = 0; ch < 4; ch++) {
                if (!new RegExp("\\biChannel" + ch + "\\b").test(code)) continue
                if (routing[ch] >= 0 && routing[ch] <= 3) textures[routing[ch]] = true
                if (routing[ch] === 20) audio = true
            }
        }
        shaderImages = ChannelDirective.parseTextures(main)
        const all = [main, cfg_commonCode, cfg_bufferACode, cfg_bufferBCode, cfg_bufferCCode, cfg_bufferDCode].join("\n")
        shaderUsage = {
            window: /\biWindow(Count|Rects|Velocities)\b/.test(all),
            mouse: /\biMouse\b/.test(all),
            audio: audio,
            textures: textures
        }
    }
    function _scheduleUsage() { Qt.callLater(refreshShaderUsage) }
    onCfg_selectedShaderCodeChanged: _scheduleUsage()
    onCfg_commonCodeChanged: _scheduleUsage()
    onCfg_bufferACodeChanged: _scheduleUsage()
    onCfg_bufferBCodeChanged: _scheduleUsage()
    onCfg_bufferCCodeChanged: _scheduleUsage()
    onCfg_bufferDCodeChanged: _scheduleUsage()
    function _watchUsageInputs() {
        const keys = ShaderApply.ROUTING_KEYS.concat(["useBufferA", "useBufferB", "useBufferC", "useBufferD"])
        for (let i = 0; i < keys.length; i++) configItem["cfg_" + keys[i] + "Changed"].connect(_scheduleUsage)
    }

    // Some active pass routes the audio spectrum (value 20) to an input.
    readonly property bool routesAudio: {
        const passes = ["image"]
        if (cfg_useBufferA) passes.push("A")
        if (cfg_useBufferB) passes.push("B")
        if (cfg_useBufferC) passes.push("C")
        if (cfg_useBufferD) passes.push("D")
        for (let p = 0; p < passes.length; p++)
            if (passRouting(passes[p]).indexOf(20) >= 0) return true
        return false
    }

    function imageSlotPath(slot) { return configItem["cfg_iChannel" + slot] || "" }
    function imageSlotEnabled(slot) { return configItem["cfg_iChannel" + slot + "Enabled"] === true }
    readonly property int firstMissingImage: {
        for (let i = 0; i < 4; i++)
            if (shaderUsage.textures[i] && (!imageSlotEnabled(i) || imageSlotPath(i).length === 0)) return i
        return -1
    }

    // ── shader switching ──────────────────────────────────────────────────
    function applyConfigMap(map) {
        ShaderApply.applyMap(configItem, map, "cfg_")
    }

    function _textureState() {
        return ShaderApply.collect(configItem, ShaderApply.TEXTURE_STATE_KEYS, "cfg_")
    }

    // automatic: a shader change the user did not pick (shuffle) leaves the
    // input preferences (mouse, windows, sound) as they are.
    property bool _applyingShader: false
    function applyShaderFromPath(path, automatic) {
        if (!path || _applyingShader) return
        _applyingShader = true
        try {
            const m = ShaderApply.forPath(ShaderLibrarySingleton, path, _textureState())
            applyConfigMap(automatic ? ShaderApply.withoutInputs(m) : m)
            recentShaders.mark(cfg_selectedShaderPath)
        } catch (e) {
            console.warn("applyShaderFromPath failed for", path, ":", e)
        } finally {
            _applyingShader = false
        }
    }

    function applyImportedShader(mainCode, bufferCodes, commonCode, routing) {
        applyConfigMap(ShaderApply.forImported(mainCode, bufferCodes, commonCode, routing,
                                               ShaderLibrarySingleton, _textureState()))
    }

    // Inline replacement for the current library shader (tweaks, editor).
    // Empty code returns to the file.
    function setInlineCode(code) {
        cfg_configVersion = ShaderApply.CONFIG_VERSION
        if (cfg_selectedShaderCode !== code) cfg_selectedShaderCode = code
    }

    function revertToFile() {
        if (fileBacked) applyShaderFromPath(cfg_selectedShaderPath)
    }

    function resetRoutingToShaderDefaults() {
        const m = fileBacked
            ? ShaderApply.forPath(ShaderLibrarySingleton, cfg_selectedShaderPath)
            : ShaderApply.forImported(cfg_selectedShaderCode, { BufferA: cfg_useBufferA ? cfg_bufferACode : "",
                                                                BufferB: cfg_useBufferB ? cfg_bufferBCode : "",
                                                                BufferC: cfg_useBufferC ? cfg_bufferCCode : "",
                                                                BufferD: cfg_useBufferD ? cfg_bufferDCode : "" },
                                      cfg_commonCode, null)
        applyConfigMap(ShaderApply.routingOnly(m))
    }

    // Pool for Shuffle: the gallery's current filter when it has been
    // opened, else the whole library.
    property var galleryPool: null
    function shuffle() {
        let pool = galleryPool && galleryPool.length > 0 ? galleryPool : null
        if (!pool) {
            pool = []
            const all = ShaderLibrarySingleton.allShaders()
            for (let i = 0; i < all.length; i++) pool.push(String(all[i].shaderPath))
        }
        if (pool.length === 0) return
        const current = ShaderApply.toFileUrl(ShaderLibrarySingleton, cfg_selectedShaderPath)
        let pick = ""
        for (let attempt = 0; attempt < 8; attempt++) {
            pick = pool[Math.floor(Math.random() * pool.length)]
            if (pool.length < 2 || ShaderApply.toFileUrl(ShaderLibrarySingleton, pick) !== current) break
        }
        applyShaderFromPath(pick, true)
    }

    // URLs resolved against the user data root, then this directory (the
    // plugin's contents/ui).
    function engineUrl(path) {
        if (!path) return ""
        const rel = ShaderLibrarySingleton.toRelativeShaderPath(String(path))
        return ShaderLibrarySingleton.userFileUrl(rel) || Qt.resolvedUrl(rel)
    }
    function resolveUrl(path) {
        return path ? Qt.resolvedUrl(String(path)) : ""
    }

    function shaderFileUrl() {
        return fileBacked ? ShaderApply.toFileUrl(ShaderLibrarySingleton, cfg_selectedShaderPath) : ""
    }

    function openInEditor() {
        const url = shaderFileUrl()
        if (url) Qt.openUrlExternally(url)
    }

    function toggleFavorite(id) {
        if (id) ShaderLibrarySingleton.toggleFavorite(id)
    }

    function addToPlaylist(path) {
        const rel = ShaderLibrarySingleton.toRelativeShaderPath(String(path))
        if (!rel) return
        const list = Array.prototype.slice.call(cfg_playlistShaders || [])
        if (list.indexOf(rel) < 0) {
            list.push(rel)
            cfg_playlistShaders = list
            showStatus(i18n("Added to the playlist."), Kirigami.MessageType.Positive)
        }
    }

    // ── thumbnails from the settings preview ──────────────────────────────
    // A frame is captured once the preview has rendered the shader for a
    // while; the id is fixed when the capture starts.
    property string _captureId: ""
    function captureThumbnailForCurrentShader(force) {
        if (!fileBacked || inlineOverride || previewBroken || !previewEngine) return false
        if (previewEngine.currentFps <= 0) return false
        const id = currentShaderId
        if (!id) return false
        if (!force && !ShaderLibrarySingleton.needsThumbnail(id)) return false
        _captureId = id
        previewEngine.captureFrame(ShaderLibrarySingleton.getThumbnailPath(id))
        return true
    }
    Connections {
        target: configItem.previewEngine
        function onFrameCaptured(path) {
            const id = configItem._captureId
            configItem._captureId = ""
            if (id) ShaderLibrarySingleton.saveThumbnail(id, path)
        }
        function onShaderRecompiled() { previewThumbnailTimer.restart() }
    }
    Timer {
        id: previewThumbnailTimer
        interval: 2500
        onTriggered: configItem.captureThumbnailForCurrentShader(false)
    }

    // ── misc helpers ──────────────────────────────────────────────────────
    function copyToClipboard(text) {
        clipboardHelper.text = text
        clipboardHelper.selectAll()
        clipboardHelper.copy()
        clipboardHelper.text = ""
    }
    TextEdit { id: clipboardHelper; visible: false }

    function showStatus(text, type) {
        statusMessage.type = type === undefined ? Kirigami.MessageType.Information : type
        statusMessage.text = text
        statusMessage.visible = true
        statusTimer.restart()
    }

    function openImageDialog(slot) {
        imageDialog.slot = slot
        imageDialog.open()
    }

    function setImage(slot, path) {
        const local = decodeURIComponent(String(path).replace(/^file:\/\//, ""))
        configItem["cfg_iChannel" + slot] = local
        configItem["cfg_iChannel" + slot + "Enabled"] = local.length > 0
    }

    function showTab(index) {
        tabBar.currentIndex = index
    }

    function focusGallery() {
        showTab(0)
        Qt.callLater(function() { if (galleryLoader.item) galleryLoader.item.focusSearch() })
    }

    // ── which screen this page configures ─────────────────────────────────
    function _screenLabel(s) {
        if (!s) return ""
        const model = [s.manufacturer, s.model].filter(function(x) { return x && x.length > 0 }).join(" ")
        return model.length > 0 ? i18nc("@info screen connector and model", "%1 (%2)", s.name, model) : s.name
    }
    readonly property string screenName: {
        const screens = Qt.application.screens
        // The config view's context exposes the containment item as
        // `plasmoid`; its screenGeometry identifies the output.
        if (typeof plasmoid !== "undefined" && plasmoid) {
            const c = plasmoid.plasmoid ? plasmoid.plasmoid : plasmoid
            const g = c ? c.screenGeometry : undefined
            if (g && g.width > 0) {
                for (let i = 0; i < screens.length; i++)
                    if (screens[i].virtualX === g.x && screens[i].virtualY === g.y) return _screenLabel(screens[i])
            }
        }
        // The desktop dialog opens on the screen it configures.
        if (liveDesktopDialog && configItem.Window.window && configItem.Window.window.screen)
            return _screenLabel(configItem.Window.window.screen)
        return ""
    }
    readonly property bool multiScreen: Qt.application.screens.length > 1

    // Only for desktop wallpaper settings: from the lock or sign-in screen
    // pages it would put the greeter's settings on every desktop.
    readonly property bool wallpaperSyncAvailable: desktopWallpaperContext && typeof WallpaperSync !== "undefined"
    property bool syncBusy: false
    function applyToAllScreens() {
        if (!wallpaperSyncAvailable) return
        syncBusy = true
        WallpaperSync.applyToAllScreens(ShaderApply.collect(configItem, ShaderApply.SCREEN_SYNC_KEYS, "cfg_"))
    }
    Connections {
        target: configItem.wallpaperSyncAvailable ? WallpaperSync : null
        function onFinished(ok, error) {
            configItem.syncBusy = false
            if (ok) {
                configItem.screensSynced()
                configItem.showStatus(i18n("This shader now runs on every screen."), Kirigami.MessageType.Positive)
            }
            else configItem.showStatus(i18n("Could not update the other screens: %1", error || i18n("unknown error")),
                                       Kirigami.MessageType.Error)
        }
    }

    // ── persistent UI state ───────────────────────────────────────────────
    Settings {
        id: uiSettings
        category: "ShaderWallpaperConfig"
        property int lastTab: 0
    }
    Settings {
        id: onboardSettings
        category: "ShaderWallpaperOnboarding"
        property bool onboarded: false
    }
    // Recently applied shaders, newest first, as relative paths.
    QtObject {
        id: recentShaders
        property var list: {
            try { return JSON.parse(recentSettings.recentPathsJson || "[]") } catch (e) { return [] }
        }
        function mark(path) {
            if (!path) return
            const l = list.filter(function(x) { return x !== path })
            l.unshift(path)
            if (l.length > 40) l.length = 40
            recentSettings.recentPathsJson = JSON.stringify(l)
        }
    }
    readonly property var recentPaths: recentShaders.list
    Settings {
        id: recentSettings
        category: "ShaderWallpaperGallery"
        property string recentPathsJson: "[]"
    }

    Component.onCompleted: {
        _watchUsageInputs()
        _refreshCurrentShader()
        refreshShaderUsage()
        if (!onboardSettings.onboarded) {
            onboardSettings.onboarded = true
            Qt.callLater(function() { onboardingDialog.open() })
        }
    }

    // Single layout child: the drop target spans the whole page without
    // being placed by the root layout.
    Item {
        id: page
        Layout.fillWidth: true
        Layout.fillHeight: true
        implicitHeight: pageLayout.implicitHeight

        // ── drag and drop: shader files anywhere on the page ─────────────────
        DropArea {
            id: shaderDrop
            anchors.fill: parent
            z: -1
            keys: ["text/uri-list"]
            onEntered: function(drag) {
                for (let i = 0; i < drag.urls.length; ++i) {
                    if (/\.(frag\.qsb|frag|glsl)$/i.test(drag.urls[i])) {
                        drag.accept(Qt.CopyAction)
                        return
                    }
                }
                drag.accepted = false
            }
            onDropped: function(drop) {
                for (let i = 0; i < drop.urls.length; ++i) {
                    const u = drop.urls[i].toString()
                    if (/\.(frag\.qsb|frag|glsl)$/i.test(u)) {
                        configItem.applyShaderFromPath(u)
                        drop.accept(Qt.CopyAction)
                        return
                    }
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // Visible page
        // ══════════════════════════════════════════════════════════════════════
        ColumnLayout {
            id: pageLayout
            anchors.fill: parent
            spacing: 0

            ConfigHeader {
                id: header
                root: configItem
                Layout.fillWidth: true
                Layout.maximumWidth: configItem.pageMaxWidth
                Layout.alignment: Qt.AlignHCenter
            }

            ColumnLayout {
                Layout.fillWidth: true
                Layout.maximumWidth: configItem.pageMaxWidth
                Layout.alignment: Qt.AlignHCenter
                Layout.leftMargin: Kirigami.Units.largeSpacing
                Layout.rightMargin: Kirigami.Units.largeSpacing
                spacing: Kirigami.Units.smallSpacing

                Kirigami.InlineMessage {
                    id: compileMessage
                    Layout.fillWidth: true
                    type: Kirigami.MessageType.Error
                    visible: configItem.previewBroken
                    text: {
                        const first = configItem.firstLogLine
                        const head = configItem.loadError.length > 0
                            ? i18n("This shader could not be loaded. The desktop keeps showing the previous shader.")
                            : i18n("This shader does not compile. The desktop keeps showing the previous shader.")
                        return first.length > 0 ? head + "<br><tt>" + first.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</tt>" : head
                    }
                    actions: [
                        Kirigami.Action {
                            text: i18n("Show log")
                            icon.name: "view-list-text"
                            onTriggered: compileLogDialog.open()
                        },
                        Kirigami.Action {
                            text: i18n("Copy")
                            icon.name: "edit-copy"
                            onTriggered: configItem.copyToClipboard(configItem.combinedLog)
                        }
                    ]
                }

                Kirigami.InlineMessage {
                    Layout.fillWidth: true
                    type: Kirigami.MessageType.Warning
                    visible: !configItem.previewBroken && configItem.firstMissingImage >= 0
                    text: i18n("This shader reads Image %1 — choose an image.", configItem.firstMissingImage + 1)
                    actions: [
                        Kirigami.Action {
                            text: i18n("Choose image…")
                            icon.name: "document-open"
                            onTriggered: configItem.openImageDialog(Math.max(0, configItem.firstMissingImage))
                        }
                    ]
                }

                Kirigami.InlineMessage {
                    Layout.fillWidth: true
                    type: Kirigami.MessageType.Information
                    visible: !configItem.previewBroken && configItem.shaderUsage.audio && !configItem.cfg_audioEnabled
                    text: i18n("Needs sound input — enable React to sound.")
                    actions: [
                        Kirigami.Action {
                            text: i18n("Enable")
                            icon.name: "audio-volume-high"
                            onTriggered: configItem.cfg_audioEnabled = true
                        }
                    ]
                }

                Kirigami.InlineMessage {
                    Layout.fillWidth: true
                    type: Kirigami.MessageType.Information
                    visible: !configItem.previewBroken && configItem.shaderUsage.mouse && !configItem.cfg_mouseEnabled
                    text: i18n("This shader follows the mouse — enable Follow mouse.")
                    actions: [
                        Kirigami.Action {
                            text: i18n("Enable")
                            icon.name: "input-mouse"
                            onTriggered: configItem.cfg_mouseEnabled = true
                        }
                    ]
                }

                Kirigami.InlineMessage {
                    Layout.fillWidth: true
                    type: Kirigami.MessageType.Information
                    visible: !configItem.previewBroken && configItem.shaderUsage.window && !configItem.cfg_windowsEnabled
                    text: i18n("This shader reacts to windows — enable React to windows.")
                    actions: [
                        Kirigami.Action {
                            text: i18n("Enable")
                            icon.name: "window"
                            onTriggered: configItem.cfg_windowsEnabled = true
                        }
                    ]
                }

                Kirigami.InlineMessage {
                    id: statusMessage
                    Layout.fillWidth: true
                    showCloseButton: true
                    visible: false
                }
                Timer {
                    id: statusTimer
                    interval: 8000
                    onTriggered: if (statusMessage.type !== Kirigami.MessageType.Error) statusMessage.visible = false
                }
            }

            QQC2.TabBar {
                id: tabBar
                objectName: "configTabBar"
                Layout.fillWidth: true
                Layout.maximumWidth: configItem.pageMaxWidth
                Layout.alignment: Qt.AlignHCenter
                Layout.topMargin: Kirigami.Units.smallSpacing
                currentIndex: Math.max(0, Math.min(4, uiSettings.lastTab))
                onCurrentIndexChanged: uiSettings.lastTab = currentIndex

                QQC2.TabButton { text: i18n("Gallery"); icon.name: "view-list-icons" }
                QQC2.TabButton { text: i18n("Playback"); icon.name: "media-playback-start" }
                QQC2.TabButton { text: i18n("Inputs"); icon.name: "input-mouse" }
                QQC2.TabButton { text: i18n("Advanced"); icon.name: "configure" }
                QQC2.TabButton { text: i18n("System"); icon.name: "preferences-system" }
            }

            Kirigami.Separator {
                Layout.fillWidth: true
            }

            StackLayout {
                id: tabStack
                Layout.fillWidth: true
                Layout.fillHeight: true
                Layout.minimumHeight: Kirigami.Units.gridUnit * 12
                currentIndex: tabBar.currentIndex

                Loader {
                    id: galleryLoader
            objectName: "galleryLoader"
                    property bool wanted: tabStack.currentIndex === 0 || wanted
                    active: wanted
                    sourceComponent: GalleryView {
                        root: configItem
                        shown: tabStack.currentIndex === 0
                    }
                }
                Loader {
                    property bool wanted: tabStack.currentIndex === 1 || wanted
                    active: wanted
                    sourceComponent: PlaybackTab { root: configItem }
                }
                Loader {
                    property bool wanted: tabStack.currentIndex === 2 || wanted
                    active: wanted
                    sourceComponent: InputsTab { root: configItem }
                }
                Loader {
                    property bool wanted: tabStack.currentIndex === 3 || wanted
                    active: wanted
                    sourceComponent: AdvancedTab { root: configItem }
                }
                Loader {
                    property bool wanted: tabStack.currentIndex === 4 || wanted
                    active: wanted
                    sourceComponent: SystemTab { root: configItem }
                }
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // Dialogs
    // ══════════════════════════════════════════════════════════════════════
    Kirigami.Dialog {
        id: compileLogDialog
        parent: QQC2.Overlay.overlay
        title: configItem.loadError.length > 0 ? i18n("Shader load error") : i18n("Shader compile log")
        preferredWidth: Kirigami.Units.gridUnit * 50
        standardButtons: Kirigami.Dialog.Close
        onVisibleChanged: configItem.noteDialog(visible)
        customFooterActions: [
            Kirigami.Action {
                text: i18n("Copy")
                icon.name: "edit-copy"
                enabled: configItem.combinedLog.length > 0
                onTriggered: configItem.copyToClipboard(configItem.combinedLog)
            }
        ]
        ColumnLayout {
            spacing: Kirigami.Units.smallSpacing
            QQC2.Label {
                Layout.fillWidth: true
                Layout.margins: Kirigami.Units.largeSpacing
                wrapMode: Text.WordWrap
                text: i18n("The desktop keeps showing the previous shader until this one compiles.")
            }
            QQC2.ScrollView {
                Layout.fillWidth: true
                Layout.preferredHeight: Kirigami.Units.gridUnit * 20
                QQC2.TextArea {
                    readOnly: true
                    selectByMouse: true
                    wrapMode: TextEdit.Wrap
                    font.family: "monospace"
                    text: configItem.combinedLog.length > 0
                        ? configItem.combinedLog
                        : i18n("The driver reported no log.")
                }
            }
        }
    }

    ImportDialog {
        id: importDialog
        onVisibleChanged: configItem.noteDialog(visible)
        onShaderImported: function(mainCode, bufferCodes, commonCode, routing, metadata) {
            configItem.applyImportedShader(mainCode, bufferCodes, commonCode, routing)
        }
        onShaderFileChosen: function(url) { configItem.applyShaderFromPath(url) }
    }

    Kirigami.Dialog {
        id: getMoreDialog
        parent: QQC2.Overlay.overlay
        title: i18n("Get more shaders")
        preferredWidth: Kirigami.Units.gridUnit * 34
        standardButtons: Kirigami.Dialog.Close
        onVisibleChanged: configItem.noteDialog(visible)
        ColumnLayout {
            spacing: 0
            Kirigami.InlineMessage {
                Layout.fillWidth: true
                Layout.margins: Kirigami.Units.largeSpacing
                visible: true
                type: Kirigami.MessageType.Information
                text: i18n("Shaders are single .frag files. The KDE Store lists wallpaper plugins, not individual shaders.")
            }
            QQC2.ItemDelegate {
                Layout.fillWidth: true
                icon.name: "internet-web-browser"
                text: i18n("Browse the bundled collection on GitHub")
                onClicked: {
                    Qt.openUrlExternally("https://github.com/y4my4my4m/kde-shader-wallpaper/tree/master/package/contents/ui/Shaders")
                    getMoreDialog.close()
                }
            }
            QQC2.ItemDelegate {
                Layout.fillWidth: true
                icon.name: "document-import"
                text: i18n("Import from Shadertoy or paste code…")
                onClicked: { getMoreDialog.close(); importDialog.open() }
            }
            QQC2.ItemDelegate {
                Layout.fillWidth: true
                icon.name: "document-open"
                text: i18n("Open a .frag file…")
                onClicked: { getMoreDialog.close(); shaderFileDialog.open() }
            }
            QQC2.Label {
                Layout.fillWidth: true
                Layout.margins: Kirigami.Units.largeSpacing
                wrapMode: Text.WordWrap
                color: Kirigami.Theme.disabledTextColor
                text: i18n("You can also drop a .frag file anywhere on this page.")
            }
        }
    }

    Kirigami.PromptDialog {
        id: applyAllPrompt
        parent: QQC2.Overlay.overlay
        title: i18n("Use this shader on all screens?")
        subtitle: i18n("The shader, its inputs and playback speed replace the settings of every other screen.")
        standardButtons: Kirigami.Dialog.Cancel
        onVisibleChanged: configItem.noteDialog(visible)
        customFooterActions: [
            Kirigami.Action {
                text: i18n("Apply to all screens")
                icon.name: "video-display"
                onTriggered: {
                    applyAllPrompt.close()
                    configItem.applyToAllScreens()
                }
            }
        ]
    }

    PlaylistDialog {
        id: playlistDialog
        root: configItem
        onVisibleChanged: configItem.noteDialog(visible)
    }

    CodeEditorDialog {
        id: codeEditorDialog
        root: configItem
        onVisibleChanged: configItem.noteDialog(visible)
    }

    SavePackageDialog {
        id: savePackageDialog
        root: configItem
        onVisibleChanged: configItem.noteDialog(visible)
    }

    OnboardingDialog {
        id: onboardingDialog
        root: configItem
        onVisibleChanged: configItem.noteDialog(visible)
    }

    FileDialog {
        id: shaderFileDialog
        title: i18n("Open Shader File")
        nameFilters: [i18n("Shader files (*.frag *.frag.qsb *.glsl)"), i18n("All files (*)")]
        onAccepted: configItem.applyShaderFromPath(selectedFile.toString())
    }

    FileDialog {
        id: imageDialog
        property int slot: 0
        title: i18n("Choose Image %1", slot + 1)
        nameFilters: [i18n("Images (*.png *.jpg *.jpeg *.webp *.bmp *.tif *.tiff)"), i18n("All files (*)")]
        onAccepted: configItem.setImage(slot, selectedFile.toString())
    }

    // Dialog entry points for child pages.
    function openCompileLog() { compileLogDialog.open() }
    function openImport() { importDialog.open() }
    function openShaderFile() { shaderFileDialog.open() }
    function openGetMore() { getMoreDialog.open() }
    function openPlaylist() { playlistDialog.open() }
    function openCodeEditor() { codeEditorDialog.open() }
    function openSavePackage() { savePackageDialog.open() }
    function openOnboarding() { onboardingDialog.open() }
    function confirmApplyToAllScreens() { applyAllPrompt.open() }
}
