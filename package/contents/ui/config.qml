// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import "shaderwallpaper" as ShaderPlugin

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
// the C++ plugin isn't installed yet). We sync configRoot.cfg_* ↔
// contentLoader.item.cfg_* on load and on every change in either direction,
// which keeps ConfigContent.qml's existing per-control cfg_* bindings
// untouched.
// ────────────────────────────────────────────────────────────────────────────
ColumnLayout {
    id: configRoot

    Layout.fillWidth: true
    Layout.fillHeight: true

    // ════════════════════════════════════════════════════════════════════════
    // KCM / shell contract
    // ════════════════════════════════════════════════════════════════════════

    // Dual-mode bridge — see file header.
    property var wallpaperConfiguration: (typeof wallpaper !== "undefined" && wallpaper) ? wallpaper.configuration : null

    // Both ConfigurationContainmentAppearance.qml and kcm_wallpaper's main.qml
    // connect to this signal to enable the Apply button (and, in the desktop
    // flow, to copy our cfg_* back into the live wallpaper configuration).
    signal configurationChanged()

    // Called by the KCM right before save; placeholder — no per-save cleanup
    // needed today.
    function saveConfig() {}

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
    property string cfg_selectedShaderPath: wallpaperConfiguration ? (wallpaperConfiguration.selectedShaderPath ?? "Shaders6/Ps3menu.frag.qsb") : "Shaders6/Ps3menu.frag.qsb"
    property string cfg_selectedShaderCode: wallpaperConfiguration ? (wallpaperConfiguration.selectedShaderCode ?? "") : ""
    property int    cfg_selectedShaderIndex: wallpaperConfiguration ? (wallpaperConfiguration.selectedShaderIndex ?? 0) : 0

    // — Playback
    property bool   cfg_running: wallpaperConfiguration ? (wallpaperConfiguration.running ?? true) : true
    property double cfg_shaderSpeed: wallpaperConfiguration ? (wallpaperConfiguration.shaderSpeed ?? 1.0) : 1.0
    property int    cfg_targetFps: wallpaperConfiguration ? (wallpaperConfiguration.targetFps || 60) : 60
    property double cfg_resolutionScale: wallpaperConfiguration ? (wallpaperConfiguration.resolutionScale || 1.0) : 1.0
    property int    cfg_pauseMode: wallpaperConfiguration ? (wallpaperConfiguration.pauseMode ?? 0) : 0
    property bool   cfg_checkActiveScreen: wallpaperConfiguration ? (wallpaperConfiguration.checkActiveScreen ?? true) : true
    property var    cfg_excludeWindows: wallpaperConfiguration ? (wallpaperConfiguration.excludeWindows ?? []) : []

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
    property string cfg_iChannel0: wallpaperConfiguration ? (wallpaperConfiguration.iChannel0 ?? "./Resources/wallpaper2.png") : "./Resources/wallpaper2.png"
    property bool   cfg_iChannel0Enabled: wallpaperConfiguration ? (wallpaperConfiguration.iChannel0Enabled ?? true) : true
    property string cfg_iChannel1: wallpaperConfiguration ? (wallpaperConfiguration.iChannel1 ?? "./Resources/wallpaper2.png") : "./Resources/wallpaper2.png"
    property bool   cfg_iChannel1Enabled: wallpaperConfiguration ? (wallpaperConfiguration.iChannel1Enabled ?? true) : true
    property string cfg_iChannel2: wallpaperConfiguration ? (wallpaperConfiguration.iChannel2 ?? "./Resources/Shadertoy_Organic_2.jpg") : "./Resources/Shadertoy_Organic_2.jpg"
    property bool   cfg_iChannel2Enabled: wallpaperConfiguration ? (wallpaperConfiguration.iChannel2Enabled ?? true) : true
    property string cfg_iChannel3: wallpaperConfiguration ? (wallpaperConfiguration.iChannel3 ?? "./Resources/Shadertoy_Organic_2.jpg") : "./Resources/Shadertoy_Organic_2.jpg"
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

    // — Debug & performance HUD
    property bool cfg_showFps:              wallpaperConfiguration ? (wallpaperConfiguration.showFps ?? false) : false
    property bool cfg_showPerformance:      wallpaperConfiguration ? (wallpaperConfiguration.showPerformance ?? false) : false
    property bool cfg_showPerformanceGraph: wallpaperConfiguration ? (wallpaperConfiguration.showPerformanceGraph ?? true) : true
    property bool cfg_performanceExpanded:  wallpaperConfiguration ? (wallpaperConfiguration.performanceExpanded ?? true) : true
    property int  cfg_gpuTdp:               wallpaperConfiguration ? (wallpaperConfiguration.gpuTdp || 75) : 75

    // — Playlist
    property bool cfg_playlistEnabled:         wallpaperConfiguration ? (wallpaperConfiguration.playlistEnabled ?? false) : false
    property var  cfg_playlistShaders:         wallpaperConfiguration ? (wallpaperConfiguration.playlistShaders ?? []) : []
    property int  cfg_playlistIntervalMinutes: wallpaperConfiguration ? (wallpaperConfiguration.playlistIntervalMinutes || 10) : 10
    property bool cfg_playlistShuffle:         wallpaperConfiguration ? (wallpaperConfiguration.playlistShuffle ?? false) : false

    // — Hot-reload
    property bool cfg_watchSourceFile: wallpaperConfiguration ? (wallpaperConfiguration.watchSourceFile ?? false) : false

    // — Experimental engine features
    property bool   cfg_experimentalScreenUniforms:   wallpaperConfiguration ? (wallpaperConfiguration.experimentalScreenUniforms ?? false) : false
    property bool   cfg_experimentalDesktopUniform:   wallpaperConfiguration ? (wallpaperConfiguration.experimentalDesktopUniform ?? false) : false
    property bool   cfg_experimentalParallax:         wallpaperConfiguration ? (wallpaperConfiguration.experimentalParallax ?? false) : false
    property double cfg_experimentalParallaxStrength: wallpaperConfiguration ? (wallpaperConfiguration.experimentalParallaxStrength ?? 0.25) : 0.25

    // — Shader tweaks
    property bool cfg_enableShaderTweaks: wallpaperConfiguration ? (wallpaperConfiguration.enableShaderTweaks ?? false) : false

    // — Dismissable UI banners
    property bool cfg_infoPlasma6Preview_dismissed: wallpaperConfiguration ? (wallpaperConfiguration.infoPlasma6Preview_dismissed ?? false) : false
    property bool cfg_warningResources_dismissed:   wallpaperConfiguration ? (wallpaperConfiguration.warningResources_dismissed ?? false) : false
    property bool cfg_emergencyHelp_dismissed:      wallpaperConfiguration ? (wallpaperConfiguration.emergencyHelp_dismissed ?? false) : false

    // ════════════════════════════════════════════════════════════════════════
    // cfg_* ↔ contentLoader.item.cfg_* bidirectional wiring + signal plumbing
    //
    // Why this exists:
    //   The KCM/shell only interacts with cfg_* on THIS file's root, but the
    //   actual UI controls live in ConfigContent.qml which is loaded into
    //   `contentLoader` below. To keep ConfigContent.qml's existing per-control
    //   bindings untouched, we mirror values in both directions on every change.
    //
    // For each cfg_<key> we:
    //   • Connect configRoot.cfg_<key>Changed →
    //       1. emit configurationChanged()                 // KCM/shell dirty tracking
    //       2. write through to wallpaperConfiguration     // in-process live preview
    //       3. mirror to contentLoader.item.cfg_<key>      // refresh the UI
    //   • Connect contentLoader.item.cfg_<key>Changed →
    //       mirror back to configRoot.cfg_<key>            // user moved a slider, etc.
    //
    // The mirrors are no-ops when the value already matches, so they don't
    // cause binding loops.
    //
    // We use an EXPLICIT key list rather than `for (k in configRoot)` because
    // QML's for-in enumeration of dynamic QObject properties is unreliable
    // across Qt versions — and silent enumeration failure here would mean
    // saved values never propagate, which is exactly the failure mode we hit.
    // Keep this list in lock-step with the cfg_* property declarations above
    // (and with package/contents/config/main.xml).
    // ════════════════════════════════════════════════════════════════════════

    readonly property var _cfgKeys: [
        "cfg_selectedShaderPath", "cfg_selectedShaderCode", "cfg_selectedShaderIndex",
        "cfg_running", "cfg_shaderSpeed", "cfg_targetFps", "cfg_resolutionScale",
        "cfg_pauseMode", "cfg_checkActiveScreen", "cfg_excludeWindows",
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
        "cfg_showFps",
        "cfg_showPerformance", "cfg_showPerformanceGraph", "cfg_performanceExpanded", "cfg_gpuTdp",
        "cfg_playlistEnabled", "cfg_playlistShaders", "cfg_playlistIntervalMinutes", "cfg_playlistShuffle",
        "cfg_watchSourceFile",
        "cfg_experimentalScreenUniforms", "cfg_experimentalDesktopUniform",
        "cfg_experimentalParallax", "cfg_experimentalParallaxStrength",
        "cfg_enableShaderTweaks",
        "cfg_infoPlasma6Preview_dismissed", "cfg_warningResources_dismissed", "cfg_emergencyHelp_dismissed"
    ]

    function _pushToLiveConfig(key, value) {
        if (!wallpaperConfiguration) return
        if (wallpaperConfiguration[key] === value) return
        wallpaperConfiguration[key] = value
    }

    // Suppresses configurationChanged / live-preview side effects during the
    // initial value push in Loader.onLoaded (we don't want loading the UI to
    // mark the KCM dirty). Ping-pongs between configRoot ↔ item during normal
    // edits are prevented by the equality checks in each handler — once
    // values match, the second-direction handler's `!==` test is false and
    // nothing fires.
    property bool _suppressBroadcast: false

    Component.onCompleted: {
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
                configRoot.configurationChanged()
                _pushToLiveConfig(key.substring(4), configRoot[key])
                const item = contentLoader.item
                if (item && (key in item) && item[key] !== configRoot[key]) {
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

    // Plasma's containment-config form expects a `formLayout` alias on the
    // wallpaper plugin's root, for label-column alignment with the wallpaper-
    // type combo above us. We expose a hidden zero-size FormLayout to satisfy
    // that contract without affecting visible layout.
    property alias formLayout: hiddenFormLayout
    Kirigami.FormLayout {
        id: hiddenFormLayout
        visible: false
        width: 0
        height: 0
    }

    // Detect whether the C++ plugin .so is installed; show the setup wizard
    // when it isn't.
    ShaderPlugin.PluginStatus { id: pluginStatus }

    Loader {
        id: contentLoader
        Layout.fillWidth: true
        Layout.fillHeight: true
        source: pluginStatus.installed ? "ConfigContent.qml" : "SetupWizard.qml"

        onLoaded: {
            if (!item) return

            // Initial push: configRoot.cfg_* → item.cfg_* (so the UI shows
            // current values rather than its declared type-defaults).
            // Suppress broadcast so this doesn't spuriously mark the host KCM
            // dirty or fire a live-preview reload before anything has actually
            // changed.
            _suppressBroadcast = true
            _cfgKeys.forEach(function(key) {
                if ((key in item) && item[key] !== configRoot[key]) {
                    item[key] = configRoot[key]
                }
            })
            _suppressBroadcast = false

            // Wire item.cfg_*Changed → configRoot.cfg_* . The equality check
            // in each handler prevents ping-pong: when the user moves a
            // slider, item.cfg_X changes, we assign it to configRoot.cfg_X,
            // configRoot's handler then tries to push back to item but
            // `item[key] !== configRoot[key]` is false at that point so the
            // chain terminates.
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
                    if (configRoot[key] !== item[key]) {
                        configRoot[key] = item[key]
                    }
                })
                wired++
            })
            console.log("[ShaderWallpaper] contentLoader wired", wired,
                        "cfg_* item signals;",
                        missing.length, "missing on item:", missing.join(","))
        }

        BusyIndicator {
            anchors.centerIn: parent
            visible: parent.status === Loader.Loading
            running: visible
        }
    }
}
