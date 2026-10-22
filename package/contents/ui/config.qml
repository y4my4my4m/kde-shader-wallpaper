// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

// ────────────────────────────────────────────────────────────────────────────
// Wallpaper-plugin config root.
//
// This file is instantiated in TWO different contexts:
//
//   A) In-process (Right-click desktop → Configure Desktop)
//      Loaded by plasma-desktop's ConfigurationContainmentAppearance.qml.
//      A `wallpaper` context object is provided whose `.configuration` is
//      the LIVE containment KConfigPropertyMap — writes to it propagate to
//      the running WallpaperItem immediately ("live preview").
//
//   B) Out-of-process (System Settings → Wallpaper)
//      Loaded by plasma-workspace's `kcm_wallpaper`. There is NO `wallpaper`
//      context object; instead, the KCM passes a `wallpaperConfiguration`
//      property on this component (a KConfigPropertyMap backed by an
//      on-disk containment group). On Apply, the KCM serializes our `cfg_*`
//      values via DBus to plasmashell's `setWallpaper`.
//
//   C) PLM Login Screen → Configure Appearance…
//      Loaded by plasma-login-manager's WallpaperConfig StackView. It passes
//      `configDialog` (= the PLM KCM) in replace() props; read config from
//      `configDialog.wallpaperConfiguration`. The parent Appearance page also
//      exposes `wallpaper` (= wallpaperIntegration) but StackView-loaded items
//      do not inherit that scope — do NOT rely on bare `wallpaper` here.
//
// To work in both contexts the plugin must:
//   1. Expose `wallpaperConfiguration` as a root property defaulting to
//      `wallpaper.configuration` (so KCM can override it as a prop).
//   2. Declare every kcfg key as a `cfg_<name>` property on the ROOT of the
//      QML component the KCM/desktop-shell instantiates (i.e. THIS file —
//      not on a child loaded via Loader). Both `ConfigurationContainmentAppearance`
//      and `kcm_wallpaper` iterate `wallpaperConfig.keys()` and assign
//      `main.currentItem["cfg_"+key] = wallpaperConfig[key]` for each match.
//   3. Emit a top-level `configurationChanged()` signal whenever any cfg_*
//      changes — this is what the KCM uses to enable the Apply button (and
//      what the in-process flow uses to copy cfg_* back into the live config).
//   4. Optionally provide a `saveConfig()` function called by the host shell.
//
// The actual visible UI lives in ConfigContent.qml (or SetupWizard.qml when
// the native engine isn't installed yet), loaded asynchronously with the
// cfg_* values as initial properties. configRoot.cfg_* ↔ contentLoader.item.cfg_*
// are mirrored in both directions afterwards. This file does not import the
// engine module (see EngineStatus.qml).
// ────────────────────────────────────────────────────────────────────────────
ColumnLayout {
    id: configRoot

    Layout.fillWidth: true
    Layout.fillHeight: true

    // ════════════════════════════════════════════════════════════════════════
    // KCM / shell contract
    // ════════════════════════════════════════════════════════════════════════

    // Dual-mode bridge — see file header. Order matters: PLM passes
    // configDialog; desktop wallpaper KCM sets wallpaperConfiguration directly
    // as an initial property (overrides this binding); in-process desktop
    // config uses wallpaper.configuration.
    property var configDialog: null
    property var wallpaperConfiguration: (configDialog && configDialog.wallpaperConfiguration)
        ? configDialog.wallpaperConfiguration
        : ((typeof wallpaper !== "undefined" && wallpaper && wallpaper.configuration)
            ? wallpaper.configuration
            : null)

    // Both ConfigurationContainmentAppearance.qml and kcm_wallpaper's main.qml
    // connect to this signal to enable the Apply button (and, in the desktop
    // flow, to copy our cfg_* back into the live wallpaper configuration).
    signal configurationChanged()

    // In-process desktop dialog (plasma-desktop ContainmentConfigView):
    // wallpaperConfiguration is the running wallpaper's own map, so every
    // write below is a live preview on the desktop. PLM and the System
    // Settings KCM hand us a map that is not live.
    readonly property bool liveDesktopDialog: configDialog !== null
        && ("applyWallpaper" in configDialog) && ("containmentPlugin" in configDialog)

    // Desktop wallpaper settings: the in-process dialog or System Settings'
    // wallpaper KCM (KQuickConfigModule class WallpaperModule). Not the
    // lock screen or sign-in screen pages.
    readonly property bool desktopWallpaperContext: liveDesktopDialog
        || (typeof kcm !== "undefined" && kcm !== null && String(kcm).indexOf("WallpaperModule") === 0)

    // Values as of the last save (or page creation). In the live desktop
    // dialog a page destroyed without saveConfig() writes these back, so
    // Cancel / Discard also undoes the live preview.
    property var _committed: ({})
    property bool _livePreviewDirty: false
    function _snapshotCommitted() {
        const snap = {}
        _cfgKeys.forEach(function(key) {
            const v = configRoot[key]
            snap[key] = _isList(v) ? Array.prototype.slice.call(v) : v
        })
        _committed = snap
        _livePreviewDirty = false
    }

    // Called by the host shell / KCM right before it copies cfg_* out.
    function saveConfig() {
        _snapshotCommitted()
    }

    // configVersion 1 → 2. Version 1 ran the file whenever a path was set;
    // leftover code (an import that kept the path, the old editor) would
    // otherwise start running. Path wins, the inline copies go. Runs before
    // the host signals are wired, so the page opens clean; the values are
    // saved with the next Apply.
    function _migrateConfig() {
        if (cfg_configVersion >= 2) return
        if (cfg_selectedShaderPath.length > 0 && cfg_selectedShaderCode.length > 0) {
            cfg_selectedShaderCode = ""
            cfg_commonCode = ""
            cfg_bufferACode = ""
            cfg_bufferBCode = ""
            cfg_bufferCCode = ""
            cfg_bufferDCode = ""
        }
        cfg_configVersion = 2
    }

    Component.onDestruction: {
        if (!liveDesktopDialog || !_livePreviewDirty || !wallpaperConfiguration) return
        _cfgKeys.forEach(function(key) {
            const name = key.substring(4)
            if (!(key in _committed)) return
            if (_differs(wallpaperConfiguration[name], _committed[key]))
                wallpaperConfiguration[name] = _committed[key]
        })
    }

    // ════════════════════════════════════════════════════════════════════════
    // cfg_<key> declarations — MUST live on the QML root the host instantiates.
    //
    // Initial values: read from `wallpaperConfiguration` when present (the
    // common case in both contexts), falling back to literals matching
    // main.xml so the UI is sensible even when wallpaperConfiguration is null
    // or returns undefined for a key. Use `??` (not `||`) where 0 / false /
    // empty string is a meaningful user setting; use `||` only where 0 truly
    // means "not configured" (e.g. targetFps).
    // ════════════════════════════════════════════════════════════════════════

    // — Shader selection
    property string cfg_selectedShaderPath: wallpaperConfiguration ? (wallpaperConfiguration.selectedShaderPath ?? "Shaders/PS3_MenuColor.frag") : "Shaders/PS3_MenuColor.frag"
    property string cfg_selectedShaderCode: wallpaperConfiguration ? (wallpaperConfiguration.selectedShaderCode ?? "") : ""
    property int    cfg_selectedShaderIndex: wallpaperConfiguration ? (wallpaperConfiguration.selectedShaderIndex ?? 0) : 0
    property int    cfg_configVersion: wallpaperConfiguration ? (wallpaperConfiguration.configVersion ?? 1) : 1

    // — Playback
    property bool   cfg_running: wallpaperConfiguration ? (wallpaperConfiguration.running ?? true) : true
    property double cfg_shaderSpeed: wallpaperConfiguration ? (wallpaperConfiguration.shaderSpeed ?? 1.0) : 1.0
    property int    cfg_targetFps: wallpaperConfiguration ? (wallpaperConfiguration.targetFps || 60) : 60
    property double cfg_resolutionScale: wallpaperConfiguration ? (wallpaperConfiguration.resolutionScale || 1.0) : 1.0
    property int    cfg_pauseMode: wallpaperConfiguration ? (wallpaperConfiguration.pauseMode ?? 0) : 0
    property bool   cfg_checkActiveScreen: wallpaperConfiguration ? (wallpaperConfiguration.checkActiveScreen ?? true) : true
    property bool   cfg_showPauseIndicator: wallpaperConfiguration ? (wallpaperConfiguration.showPauseIndicator ?? false) : false
    // List-typed keys are NOT bound to wallpaperConfiguration (see _syncListKey):
    // a binding hands out a fresh JS array on every re-evaluation, so it can
    // never compare equal to the previous value.
    property var    cfg_excludeWindows: []

    // — Mouse
    property bool   cfg_mouseEnabled: wallpaperConfiguration ? (wallpaperConfiguration.mouseEnabled ?? false) : false
    property double cfg_mouseBias: wallpaperConfiguration ? (wallpaperConfiguration.mouseBias ?? 1.0) : 1.0

    // — Audio
    property bool   cfg_audioEnabled: wallpaperConfiguration ? (wallpaperConfiguration.audioEnabled ?? false) : false
    property int    cfg_audioChannel: wallpaperConfiguration ? (wallpaperConfiguration.audioChannel ?? 0) : 0
    property double cfg_audioSensitivity: wallpaperConfiguration ? (wallpaperConfiguration.audioSensitivity || 40.0) : 40.0

    // — Window tracking
    property bool   cfg_windowsEnabled: wallpaperConfiguration ? (wallpaperConfiguration.windowsEnabled ?? false) : false

    // — Channels
    property string cfg_iChannel0: wallpaperConfiguration ? (wallpaperConfiguration.iChannel0 ?? "") : ""
    property bool   cfg_iChannel0Enabled: wallpaperConfiguration ? (wallpaperConfiguration.iChannel0Enabled ?? false) : false
    property string cfg_iChannel1: wallpaperConfiguration ? (wallpaperConfiguration.iChannel1 ?? "") : ""
    property bool   cfg_iChannel1Enabled: wallpaperConfiguration ? (wallpaperConfiguration.iChannel1Enabled ?? false) : false
    property string cfg_iChannel2: wallpaperConfiguration ? (wallpaperConfiguration.iChannel2 ?? "") : ""
    property bool   cfg_iChannel2Enabled: wallpaperConfiguration ? (wallpaperConfiguration.iChannel2Enabled ?? false) : false
    property string cfg_iChannel3: wallpaperConfiguration ? (wallpaperConfiguration.iChannel3 ?? "") : ""
    property bool   cfg_iChannel3Enabled: wallpaperConfiguration ? (wallpaperConfiguration.iChannel3Enabled ?? false) : false

    // — Buffer toggles
    property bool cfg_useBufferA: wallpaperConfiguration ? (wallpaperConfiguration.useBufferA ?? false) : false
    property bool cfg_useBufferB: wallpaperConfiguration ? (wallpaperConfiguration.useBufferB ?? false) : false
    property bool cfg_useBufferC: wallpaperConfiguration ? (wallpaperConfiguration.useBufferC ?? false) : false
    property bool cfg_useBufferD: wallpaperConfiguration ? (wallpaperConfiguration.useBufferD ?? false) : false

    // — Per-pass shader code
    property string cfg_commonCode:  wallpaperConfiguration ? (wallpaperConfiguration.commonCode  ?? "") : ""
    property string cfg_bufferACode: wallpaperConfiguration ? (wallpaperConfiguration.bufferACode ?? "") : ""
    property string cfg_bufferBCode: wallpaperConfiguration ? (wallpaperConfiguration.bufferBCode ?? "") : ""
    property string cfg_bufferCCode: wallpaperConfiguration ? (wallpaperConfiguration.bufferCCode ?? "") : ""
    property string cfg_bufferDCode: wallpaperConfiguration ? (wallpaperConfiguration.bufferDCode ?? "") : ""

    // — Per-buffer channel routing (-1 = None; 0..3 = Texture; 10..13 = BufferA..D; 20 = Audio)
    property int cfg_imageChannel0:   wallpaperConfiguration ? (wallpaperConfiguration.imageChannel0   ?? 0)  : 0
    property int cfg_imageChannel1:   wallpaperConfiguration ? (wallpaperConfiguration.imageChannel1   ?? 1)  : 1
    property int cfg_imageChannel2:   wallpaperConfiguration ? (wallpaperConfiguration.imageChannel2   ?? 2)  : 2
    property int cfg_imageChannel3:   wallpaperConfiguration ? (wallpaperConfiguration.imageChannel3   ?? 3)  : 3
    property int cfg_bufferAChannel0: wallpaperConfiguration ? (wallpaperConfiguration.bufferAChannel0 ?? -1) : -1
    property int cfg_bufferAChannel1: wallpaperConfiguration ? (wallpaperConfiguration.bufferAChannel1 ?? -1) : -1
    property int cfg_bufferAChannel2: wallpaperConfiguration ? (wallpaperConfiguration.bufferAChannel2 ?? -1) : -1
    property int cfg_bufferAChannel3: wallpaperConfiguration ? (wallpaperConfiguration.bufferAChannel3 ?? -1) : -1
    property int cfg_bufferBChannel0: wallpaperConfiguration ? (wallpaperConfiguration.bufferBChannel0 ?? -1) : -1
    property int cfg_bufferBChannel1: wallpaperConfiguration ? (wallpaperConfiguration.bufferBChannel1 ?? -1) : -1
    property int cfg_bufferBChannel2: wallpaperConfiguration ? (wallpaperConfiguration.bufferBChannel2 ?? -1) : -1
    property int cfg_bufferBChannel3: wallpaperConfiguration ? (wallpaperConfiguration.bufferBChannel3 ?? -1) : -1
    property int cfg_bufferCChannel0: wallpaperConfiguration ? (wallpaperConfiguration.bufferCChannel0 ?? -1) : -1
    property int cfg_bufferCChannel1: wallpaperConfiguration ? (wallpaperConfiguration.bufferCChannel1 ?? -1) : -1
    property int cfg_bufferCChannel2: wallpaperConfiguration ? (wallpaperConfiguration.bufferCChannel2 ?? -1) : -1
    property int cfg_bufferCChannel3: wallpaperConfiguration ? (wallpaperConfiguration.bufferCChannel3 ?? -1) : -1
    property int cfg_bufferDChannel0: wallpaperConfiguration ? (wallpaperConfiguration.bufferDChannel0 ?? -1) : -1
    property int cfg_bufferDChannel1: wallpaperConfiguration ? (wallpaperConfiguration.bufferDChannel1 ?? -1) : -1
    property int cfg_bufferDChannel2: wallpaperConfiguration ? (wallpaperConfiguration.bufferDChannel2 ?? -1) : -1
    property int cfg_bufferDChannel3: wallpaperConfiguration ? (wallpaperConfiguration.bufferDChannel3 ?? -1) : -1

    // 0 = shader's own @sim-max-height header, else native.
    property int cfg_bufferSimulationMaxHeight: wallpaperConfiguration ? (wallpaperConfiguration.bufferSimulationMaxHeight ?? 0) : 0

    // — Debug & performance HUD
    property bool cfg_showFps:              wallpaperConfiguration ? (wallpaperConfiguration.showFps ?? false) : false
    property bool cfg_showPerformance:      wallpaperConfiguration ? (wallpaperConfiguration.showPerformance ?? false) : false
    property bool cfg_showPerformanceGraph: wallpaperConfiguration ? (wallpaperConfiguration.showPerformanceGraph ?? true) : true
    property bool cfg_performanceExpanded:  wallpaperConfiguration ? (wallpaperConfiguration.performanceExpanded ?? true) : true
    property int  cfg_gpuTdp:               wallpaperConfiguration ? (wallpaperConfiguration.gpuTdp || 75) : 75

    // — Playlist
    property bool cfg_playlistEnabled:         wallpaperConfiguration ? (wallpaperConfiguration.playlistEnabled ?? false) : false
    property var  cfg_playlistShaders:         []   // see _syncListKey
    property int  cfg_playlistIntervalMinutes: wallpaperConfiguration ? (wallpaperConfiguration.playlistIntervalMinutes || 10) : 10
    property bool cfg_playlistShuffle:         wallpaperConfiguration ? (wallpaperConfiguration.playlistShuffle ?? false) : false
    property int  cfg_playlistSource:          wallpaperConfiguration ? (wallpaperConfiguration.playlistSource ?? 0) : 0

    // — Hot-reload
    property bool cfg_watchSourceFile: wallpaperConfiguration ? (wallpaperConfiguration.watchSourceFile ?? false) : false

    // — Experimental engine features
    property bool   cfg_experimentalScreenUniforms:   wallpaperConfiguration ? (wallpaperConfiguration.experimentalScreenUniforms ?? false) : false
    property bool   cfg_experimentalDesktopUniform:   wallpaperConfiguration ? (wallpaperConfiguration.experimentalDesktopUniform ?? false) : false
    property bool   cfg_experimentalParallax:         wallpaperConfiguration ? (wallpaperConfiguration.experimentalParallax ?? false) : false
    property double cfg_experimentalParallaxStrength: wallpaperConfiguration ? (wallpaperConfiguration.experimentalParallaxStrength ?? 0.25) : 0.25
    property bool   cfg_experimentalHdrPipeline:      wallpaperConfiguration ? (wallpaperConfiguration.experimentalHdrPipeline ?? false) : false
    property bool   cfg_dither:                       wallpaperConfiguration ? (wallpaperConfiguration.dither ?? true) : true

    // — Shader tweaks
    property bool cfg_enableShaderTweaks: wallpaperConfiguration ? (wallpaperConfiguration.enableShaderTweaks ?? false) : false

    // — Dismissable UI banners
    property bool cfg_infoPlasma6Preview_dismissed: wallpaperConfiguration ? (wallpaperConfiguration.infoPlasma6Preview_dismissed ?? false) : false
    property bool cfg_warningResources_dismissed:   wallpaperConfiguration ? (wallpaperConfiguration.warningResources_dismissed ?? false) : false
    property bool cfg_emergencyHelp_dismissed:      wallpaperConfiguration ? (wallpaperConfiguration.emergencyHelp_dismissed ?? false) : false

    // ════════════════════════════════════════════════════════════════════════
    // cfg_* ↔ contentLoader.item.cfg_* wiring
    //
    // The host reads and writes cfg_* on this root only; the controls live in
    // ConfigContent.qml. Per key:
    //   configRoot.cfg_<key>Changed → wallpaperConfiguration (live preview)
    //                                 and contentLoader.item.cfg_<key>
    //   item.cfg_<key>Changed       → configRoot.cfg_<key> and
    //                                 configurationChanged() (dirty state)
    // Every mirror compares first, so a round trip terminates.
    //
    // Explicit key list: for-in over dynamic QObject properties does not
    // enumerate them reliably across Qt versions, and a missed key never
    // propagates. Kept in step with the declarations above and main.xml.
    // ════════════════════════════════════════════════════════════════════════

    readonly property var _cfgKeys: [
        "cfg_selectedShaderPath", "cfg_selectedShaderCode", "cfg_selectedShaderIndex", "cfg_configVersion",
        "cfg_running", "cfg_shaderSpeed", "cfg_targetFps", "cfg_resolutionScale",
        "cfg_pauseMode", "cfg_checkActiveScreen", "cfg_excludeWindows", "cfg_showPauseIndicator",
        "cfg_mouseEnabled", "cfg_mouseBias",
        "cfg_audioEnabled", "cfg_audioChannel", "cfg_audioSensitivity",
        "cfg_windowsEnabled",
        "cfg_iChannel0", "cfg_iChannel0Enabled",
        "cfg_iChannel1", "cfg_iChannel1Enabled",
        "cfg_iChannel2", "cfg_iChannel2Enabled",
        "cfg_iChannel3", "cfg_iChannel3Enabled",
        "cfg_useBufferA", "cfg_useBufferB", "cfg_useBufferC", "cfg_useBufferD",
        "cfg_commonCode", "cfg_bufferACode", "cfg_bufferBCode", "cfg_bufferCCode", "cfg_bufferDCode",
        "cfg_imageChannel0", "cfg_imageChannel1", "cfg_imageChannel2", "cfg_imageChannel3",
        "cfg_bufferAChannel0", "cfg_bufferAChannel1", "cfg_bufferAChannel2", "cfg_bufferAChannel3",
        "cfg_bufferBChannel0", "cfg_bufferBChannel1", "cfg_bufferBChannel2", "cfg_bufferBChannel3",
        "cfg_bufferCChannel0", "cfg_bufferCChannel1", "cfg_bufferCChannel2", "cfg_bufferCChannel3",
        "cfg_bufferDChannel0", "cfg_bufferDChannel1", "cfg_bufferDChannel2", "cfg_bufferDChannel3",
        "cfg_bufferSimulationMaxHeight",
        "cfg_showFps",
        "cfg_showPerformance", "cfg_showPerformanceGraph", "cfg_performanceExpanded", "cfg_gpuTdp",
        "cfg_playlistEnabled", "cfg_playlistShaders", "cfg_playlistIntervalMinutes", "cfg_playlistShuffle",
        "cfg_playlistSource",
        "cfg_watchSourceFile",
        "cfg_experimentalScreenUniforms", "cfg_experimentalDesktopUniform",
        "cfg_experimentalParallax", "cfg_experimentalParallaxStrength",
        "cfg_experimentalHdrPipeline", "cfg_dither",
        "cfg_enableShaderTweaks",
        "cfg_infoPlasma6Preview_dismissed", "cfg_warningResources_dismissed", "cfg_emergencyHelp_dismissed"
    ]

    function _pushToLiveConfig(key, value) {
        if (!wallpaperConfiguration) return
        if (!_differs(wallpaperConfiguration[key], value)) return
        wallpaperConfiguration[key] = value
        _livePreviewDirty = true
    }

    // ── list-typed keys (StringList in main.xml: excludeWindows, playlistShaders)
    // The host KCM (plasma-workspace kcms/wallpaper, 6.7) connects EVERY
    // cfg_*Changed signal of this root to a handler that rewrites ALL keys
    // into kcm.configuration. With a list key bound to wallpaperConfiguration
    // that rewrite re-evaluates the binding, yields a new JS array (=== is
    // identity for arrays), fires cfg_*Changed again, the KCM rewrites again…
    // until "RangeError: Maximum call stack size exceeded" on Apply — and
    // whatever the KCM had not written yet (selectedShaderPath among it) was
    // silently lost. Lists are therefore compared by content and synced
    // imperatively from valueChanged instead of through a binding.
    readonly property var _listKeys: ["excludeWindows", "playlistShaders"]
    function _isList(v) { return v !== null && v !== undefined && typeof v === "object" && ("length" in v) }
    function _differs(a, b) {
        if (_isList(a) || _isList(b)) return JSON.stringify(a ?? []) !== JSON.stringify(b ?? [])
        return a !== b
    }
    function _syncListKey(key) {
        if (!wallpaperConfiguration) return
        const v = wallpaperConfiguration[key] ?? []
        if (_differs(v, configRoot["cfg_" + key])) configRoot["cfg_" + key] = Array.prototype.slice.call(v)
    }
    Connections {
        target: wallpaperConfiguration
        function onValueChanged(key, value) { if (configRoot._listKeys.indexOf(key) >= 0) configRoot._syncListKey(key) }
    }

    // Set during the initial push in Loader.onLoaded: loading the page must
    // not write the live config or dirty the host.
    property bool _suppressBroadcast: false
    property var _listSnapshot: ({})

    Component.onCompleted: {
        _listKeys.forEach(_syncListKey)
        _migrateConfig()
        _snapshotCommitted()
        // configRoot.cfg_<key>Changed → broadcast: KCM signal, live config, UI.
        let wired = 0
        let missing = []
        _cfgKeys.forEach(function(key) {
            const sig = configRoot[key + "Changed"]
            if (!sig) {
                missing.push(key)
                return
            }
            sig.connect(function() {
                if (_suppressBroadcast) return
                // A list assigned by the host KCM (it pushes every key back
                // after each Apply, when plasmashell reports wallpaperChanged)
                // is a fresh array each time: same content, new identity, and
                // the signal fires. Ignore it unless the content changed.
                if (_isList(configRoot[key])) {
                    const j = JSON.stringify(configRoot[key])
                    if (_listSnapshot[key] === j) return
                    _listSnapshot[key] = j
                }
                // configurationChanged() (= "mark the KCM dirty") is NOT emitted
                // here: this handler also runs for the KCM's own push-back after
                // Apply, which must not re-dirty the module. It is emitted from
                // the item→configRoot mirror below, i.e. only for edits that
                // originate in the UI.
                _pushToLiveConfig(key.substring(4), configRoot[key])
                const item = contentLoader.item
                if (item && (key in item) && _differs(item[key], configRoot[key])) {
                    item[key] = configRoot[key]
                }
            })
            wired++
        })
        console.log("[ShaderWallpaper] configRoot wired", wired, "cfg_* signals;",
                    missing.length, "missing:", missing.join(","))
    }

    // ════════════════════════════════════════════════════════════════════════
    // UI
    // ════════════════════════════════════════════════════════════════════════

    // Plasma's containment-config form reads a `formLayout` alias on the
    // wallpaper page root for label alignment with the wallpaper-type combo.
    // A hidden zero-size FormLayout satisfies it.
    property alias formLayout: hiddenFormLayout
    Kirigami.FormLayout {
        id: hiddenFormLayout
        visible: false
        width: 0
        height: 0
    }

    // Native engine availability; SetupWizard.qml replaces the settings
    // while it is missing.
    EngineStatus { id: engineStatus }
    Connections {
        target: engineStatus
        function onAvailableChanged() { contentLoader.loadContent() }
        function onFailedChanged() { contentLoader.loadContent() }
    }

    // Asynchronous with initial properties: the host may build a throwaway
    // instance of this page only to enumerate cfg_* keys; destroying it
    // cancels the incubation, so the heavy content (preview engine, shader
    // library models) is never built for it. The page that stays forces
    // completion shortly after: with an animation running, Qt interleaves
    // incubation with frames at a third of a frame each (about 1 ms per
    // frame at 240 Hz), which makes a fully asynchronous load crawl.
    Timer {
        id: forceLoadTimer
        interval: 150
        onTriggered: contentLoader.asynchronous = false
    }

    Loader {
        id: contentLoader
        Layout.fillWidth: true
        Layout.fillHeight: true
        asynchronous: true

        function loadContent() {
            if (status !== Loader.Null) return
            if (!engineStatus.available) {
                setSource("SetupWizard.qml", { engineError: engineStatus.error })
                forceLoadTimer.start()
                return
            }
            const props = { hostConfigDialog: configRoot.configDialog,
                            liveDesktopDialog: configRoot.liveDesktopDialog,
                            desktopWallpaperContext: configRoot.desktopWallpaperContext }
            configRoot._cfgKeys.forEach(function(key) {
                const v = configRoot[key]
                props[key] = configRoot._isList(v) ? Array.prototype.slice.call(v) : v
            })
            setSource("ConfigContent.qml", props)
            forceLoadTimer.start()
        }

        Component.onCompleted: if (engineStatus.available || engineStatus.failed) loadContent()

        onLoaded: {
            // SetupWizard.qml has no cfg_* properties.
            if (!item || !engineStatus.available) return

            // Values that changed while the item incubated.
            _suppressBroadcast = true
            _cfgKeys.forEach(function(key) {
                if ((key in item) && _differs(item[key], configRoot[key])) {
                    item[key] = configRoot[key]
                }
            })
            _suppressBroadcast = false

            // item.cfg_*Changed → configRoot.cfg_*. Each handler compares
            // first, so the configRoot → item mirror above terminates.
            let wired = 0
            let missing = []
            _cfgKeys.forEach(function(key) {
                if (!(key in item)) {
                    missing.push(key)
                    return
                }
                const sig = item[key + "Changed"]
                if (!sig) return
                sig.connect(function() {
                    if (_differs(configRoot[key], item[key])) {
                        configRoot[key] = item[key]
                        configRoot.configurationChanged()
                    }
                })
                wired++
            })
            // Apply to all screens wrote this screen too: Discard keeps it.
            if (item.screensSynced) item.screensSynced.connect(configRoot._snapshotCommitted)
            console.log("[ShaderWallpaper] contentLoader wired", wired,
                        "cfg_* item signals;",
                        missing.length, "missing on item:", missing.join(","))
        }
    }
}
