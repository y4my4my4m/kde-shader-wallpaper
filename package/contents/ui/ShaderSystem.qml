// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>
//
// ShaderSystem - Main shader rendering component
// Only loaded when the C++ plugin is available

import QtQuick
import QtQuick.Controls
import QtQuick.Window
import org.kde.plasma.plasmoid
import "shaderwallpaper"
import "ShaderApply.js" as ShaderApply

Item {
    id: shaderSystem
    anchors.fill: parent
    clip: true  // ShaderEngine overscans during parallax — clip to screen

    // ────────────────────────────────────────────────────────────────────────
    // Host plumbing (initial properties from main.qml, Bindings afterwards).
    //
    // wallpaperConfig — KConfigPropertyMap from whichever host loaded us.
    // lockScreenMode / loginScreenMode — restrict inputs on non-desktop
    // surfaces (kscreenlocker greeter, PLM login greeter).
    // ────────────────────────────────────────────────────────────────────────
    property var  wallpaperConfig: null
    property bool lockScreenMode: false
    property bool loginScreenMode: false
    readonly property bool restrictedMode: lockScreenMode || loginScreenMode
    readonly property bool _allowMouse:   !restrictedMode && (wallpaperConfig ? (wallpaperConfig.mouseEnabled || false) : false)
    readonly property bool _allowAudio:   !restrictedMode && (wallpaperConfig ? (wallpaperConfig.audioEnabled || false) : false)
    readonly property bool _allowWindows: !restrictedMode && (wallpaperConfig ? (wallpaperConfig.windowsEnabled || false) : false)
    readonly property bool _allowExperimentalDesktop: !restrictedMode && (wallpaperConfig ? (wallpaperConfig.experimentalDesktopUniform || false) : false)
    readonly property bool _allowExperimentalParallax: !restrictedMode && (wallpaperConfig ? (wallpaperConfig.experimentalParallax || false) : false)
    readonly property bool _allowExperimentalScreens:  !restrictedMode && (wallpaperConfig ? (wallpaperConfig.experimentalScreenUniforms || false) : false)
    readonly property bool _allowWatchSource: !restrictedMode && (wallpaperConfig ? (wallpaperConfig.watchSourceFile || false) : false)

    // Shader identity and inline override. A non-empty selectedShaderCode
    // replaces the file (tweaks, code editor, imports); selectedShaderPath
    // keeps naming the library entry for thumbnails, playlist and gallery.
    readonly property string _shaderPath: wallpaperConfig ? String(wallpaperConfig.selectedShaderPath || "") : ""
    // configVersion 1 ran the file whenever a path was set; its leftover
    // code is ignored until _migrateConfig() clears it.
    readonly property bool _legacyConfig: wallpaperConfig ? (wallpaperConfig.configVersion || 1) < 2 : false
    readonly property string _inlineCode: wallpaperConfig && !(_legacyConfig && _shaderPath.length > 0)
        ? String(wallpaperConfig.selectedShaderCode || "") : ""
    readonly property bool _inlineActive: _inlineCode.length > 0

    // Shader Wallpaper 3.x stored compiled Qt shaders: "Shaders6/<Name>.frag.qsb"
    // or an absolute .qsb path. Returns the bundled 4.x shader of the same base
    // name, "" for none (bundled default), null for a path that is not 3.x.
    function _legacyQsbTarget(path) {
        const match = /([^\/]+)\.frag\.qsb$/i.exec(path)
        if (!match) return null
        const wanted = match[1].toLowerCase() + ".frag"
        const shaders = ShaderLibrarySingleton.allShaders()
        for (let i = 0; i < shaders.length; i++) {
            const rel = ShaderLibrarySingleton.toRelativeShaderPath(String(shaders[i].shaderPath))
            if (rel.substring(rel.lastIndexOf("/") + 1).toLowerCase() === wanted) return rel
        }
        return ""
    }

    function _migrateConfig() {
        if (!wallpaperConfig || !_legacyConfig) return
        try {
            const qsbTarget = _legacyQsbTarget(_shaderPath)
            if (qsbTarget === "") {
                wallpaperConfig.selectedShaderPath = ""
            } else if (qsbTarget !== null) {
                const state = ShaderApply.collect(wallpaperConfig, ShaderApply.TEXTURE_STATE_KEYS, "")
                ShaderApply.applyMap(wallpaperConfig,
                                     ShaderApply.withoutInputs(ShaderApply.forPath(ShaderLibrarySingleton, qsbTarget, state)), "")
            }
            if (_shaderPath.length > 0 && String(wallpaperConfig.selectedShaderCode || "").length > 0) {
                wallpaperConfig.selectedShaderCode = ""
                wallpaperConfig.commonCode = ""
                wallpaperConfig.bufferACode = ""
                wallpaperConfig.bufferBCode = ""
                wallpaperConfig.bufferCCode = ""
                wallpaperConfig.bufferDCode = ""
            }
            wallpaperConfig.configVersion = ShaderApply.CONFIG_VERSION
        } catch (e) {
            console.warn("Shader Wallpaper: config migration failed:", e)
        }
    }
    onWallpaperConfigChanged: _migrateConfig()

    // Window model for pause detection
    WindowModel {
        id: windowModel
        config: shaderSystem.wallpaperConfig
        screenGeometry: Qt.rect(Screen.virtualX, Screen.virtualY,
                                Screen.width, Screen.height)
    }

    // Output pixels per logical pixel: the FBO's own ratio; before the
    // engine has a window, the item-attached Screen's. Under Wayland
    // fractional scaling Screen.devicePixelRatio is the output scale rounded
    // up and differs from the FBO's.
    readonly property real _pixelRatio: shaderEngine.devicePixelRatio > 0 ? shaderEngine.devicePixelRatio
                                      : shaderSystem.Screen.devicePixelRatio > 0
                                          ? shaderSystem.Screen.devicePixelRatio : 1.0
    on_PixelRatioChanged: _pushScreenUniforms()

    // Cursor tracker for global mouse position. `screen` is this wallpaper's
    // QScreen* (plasmashell's DesktopView is a C++ QQuickWindow), so the Y
    // flip follows this screen. It is undefined until the window is mapped,
    // and a QML Window host (dev harness) exposes a QQuickScreenInfo, which
    // has no `geometry`; in both cases the tracker uses the primary screen.
    CursorTracker {
        id: cursorTracker
        enabled: shaderSystem._allowMouse && shaderEngine.running
        sensitivity: (wallpaperConfig && wallpaperConfig.mouseBias) || 1.0
        screen: {
            const w = shaderSystem.Window.window
            return (w && w.screen && w.screen.geometry !== undefined) ? w.screen : null
        }
        // Same pixel space as fragCoord / iResolution (ShaderEngine FBO).
        referenceWidth: shaderEngine.width
        referenceHeight: shaderEngine.height
        devicePixelRatio: shaderSystem._pixelRatio
        // Wayland: no global pointer; the desktop window's own pointer
        // events, in the same coordinates as mouseArea below.
        hoverItem: shaderSystem

        onIMouseChanged: {
            shaderEngine.iMouse = iMouse
        }
    }

    // Audio capture for audio-reactive shaders
    // The engine reads the spectrum texture from this object directly
    // (ShaderEngine.audioSource).
    AudioCapture {
        id: audioCapture
        enabled: shaderSystem._allowAudio && shaderEngine.running
        sensitivity: (wallpaperConfig && wallpaperConfig.audioSensitivity) || 40.0
    }
    
    // Window tracking for window-reactive effects
    WindowTracker {
        id: windowTracker
        enabled: shaderSystem._allowWindows && shaderEngine.running
        // Poll at the shader's render cadence: a fixed 30Hz reads as visible
        // steps when dragging windows on high-refresh displays. The tracker
        // polls only after X (or Plasma's window list on Wayland) reports
        // window activity, so the cost is during actual window motion.
        pollInterval: Math.max(4, Math.round(1000 / (shaderEngine.targetFps || 60)))
        referenceWidth: shaderEngine.width
        referenceHeight: shaderEngine.height
        devicePixelRatio: cursorTracker.devicePixelRatio
        screenVirtualX: screenInfo.myGeom ? screenInfo.myGeom.x : 0
        screenVirtualY: screenInfo.myGeom ? screenInfo.myGeom.y : 0
    }

    // Session lock (issue #100). The desktop wallpaper is hidden behind the
    // lock screen, which draws its own instance (restrictedMode).
    ScreenLockWatcher {
        id: screenLock
        enabled: !shaderSystem.restrictedMode
    }

    // ------------------------------------------------------------------
    // Experimental: virtual-desktop tracking (B6 / B7)
    // ------------------------------------------------------------------
    VirtualDesktopWatcher {
        id: vdesktopWatcher
        enabled: shaderSystem._allowExperimentalDesktop
              || shaderSystem._allowExperimentalParallax
        onCurrentDesktopChanged: shaderEngine.virtualDesktop = currentDesktop
        onDesktopCountChanged:   shaderEngine.virtualDesktopCount = desktopCount
        onTransitionProgressChanged: shaderEngine.virtualDesktopAnim = transitionProgress
    }

    // ------------------------------------------------------------------
    // Experimental: multi-monitor uniforms (B5)
    //
    // Computes this screen's offset within the virtual desktop bounding
    // box across all monitors so a single shader can treat all screens
    // as one continuous canvas. Each Plasma wallpaper instance runs
    // per-screen — they all see the same Qt.application.screens list but
    // each one is positioned at its own screen origin.
    //
    // Screen is read through shaderSystem (an Item). Attached to the
    // QtObject itself it resolves to the primary screen, which put every
    // secondary-screen wallpaper at the primary's offset (WindowTracker
    // origin, iScreenOffset, iScreenIndex).
    // ------------------------------------------------------------------
    QtObject {
        id: screenInfo
        property var screens: Qt.application.screens
        property rect myGeom: Qt.rect(shaderSystem.Screen.virtualX, shaderSystem.Screen.virtualY,
                                      shaderSystem.Screen.width, shaderSystem.Screen.height)
        property real virtualX0: {
            var x = Number.POSITIVE_INFINITY;
            for (var i = 0; i < screens.length; i++)
                x = Math.min(x, screens[i].virtualX);
            return isFinite(x) ? x : 0;
        }
        property real virtualY0: {
            var y = Number.POSITIVE_INFINITY;
            for (var i = 0; i < screens.length; i++)
                y = Math.min(y, screens[i].virtualY);
            return isFinite(y) ? y : 0;
        }
        property real virtualX1: {
            var x = Number.NEGATIVE_INFINITY;
            for (var i = 0; i < screens.length; i++)
                x = Math.max(x, screens[i].virtualX + screens[i].width);
            return isFinite(x) ? x : myGeom.width;
        }
        property real virtualY1: {
            var y = Number.NEGATIVE_INFINITY;
            for (var i = 0; i < screens.length; i++)
                y = Math.max(y, screens[i].virtualY + screens[i].height);
            return isFinite(y) ? y : myGeom.height;
        }
        // Left to right, then top to bottom: independent of the order Qt
        // lists screens in.
        property int myIndex: {
            var order = [];
            for (var i = 0; i < screens.length; i++) order.push(screens[i]);
            order.sort(function(a, b) { return (a.virtualX - b.virtualX) || (a.virtualY - b.virtualY) });
            for (var j = 0; j < order.length; j++) {
                if (order[j].virtualX === myGeom.x
                 && order[j].virtualY === myGeom.y) return j;
            }
            return 0;
        }
    }
    Connections {
        target: screenInfo
        function onMyGeomChanged() { _pushScreenUniforms() }
        function onMyIndexChanged() { _pushScreenUniforms() }
        function onVirtualX1Changed() { _pushScreenUniforms() }
        function onVirtualY1Changed() { _pushScreenUniforms() }
    }
    function _pushScreenUniforms() {
        if (!shaderSystem._allowExperimentalScreens) {
            shaderEngine.screenOffset = Qt.vector2d(0, 0)
            shaderEngine.desktopResolution = Qt.vector2d(0, 0)
            shaderEngine.screenIndex  = 0
            shaderEngine.screenCount  = 1
            return
        }
        // Logical screen geometry to output pixels, GL origin (Y up).
        const dpr = shaderSystem._pixelRatio
        const g = screenInfo.myGeom
        shaderEngine.screenOffset = Qt.vector2d(
            (g.x - screenInfo.virtualX0) * dpr,
            (screenInfo.virtualY1 - (g.y + g.height)) * dpr)
        shaderEngine.desktopResolution = Qt.vector2d(
            (screenInfo.virtualX1 - screenInfo.virtualX0) * dpr,
            (screenInfo.virtualY1 - screenInfo.virtualY0) * dpr)
        shaderEngine.screenIndex = screenInfo.myIndex
        shaderEngine.screenCount = screenInfo.screens.length
    }
    Connections {
        target: wallpaperConfig
        enabled: wallpaperConfig !== null
        function onExperimentalScreenUniformsChanged() { _pushScreenUniforms() }
    }

    // ------------------------------------------------------------------
    // Parallax pan on virtual-desktop switch (B7).
    //
    // The ShaderEngine is rendered at (1 + 2*strength) times the
    // viewport width and shifted horizontally based on the current
    // virtual desktop; the overscan keeps the edges covered while panning.
    // No overscan while the feature is off.
    // ------------------------------------------------------------------
    property real _parallaxStrength: shaderSystem._allowExperimentalParallax
                                   ? Math.max(0, Math.min(1, wallpaperConfig.experimentalParallaxStrength || 0.25))
                                   : 0.0
    property real _desktopFraction: {
        var n = Math.max(1, shaderEngine.virtualDesktopCount - 1)
        return shaderEngine.virtualDesktop / n  // 0..1
    }
    // -1..+1 normalised position, mapped to overscan pixels.
    property real _parallaxOffsetPx: -(_desktopFraction - 0.5) * 2.0
                                   * _parallaxStrength * width

    // Main shader rendering engine
    ShaderEngine {
        id: shaderEngine
        x: -shaderSystem._parallaxStrength * shaderSystem.width
           + shaderSystem._parallaxOffsetPx
        y: 0
        width: shaderSystem.width * (1.0 + 2.0 * shaderSystem._parallaxStrength)
        height: shaderSystem.height
        Behavior on x { NumberAnimation { duration: 350; easing.type: Easing.OutCubic } }

        // Operating modes:
        //   no config yet                 → nothing loaded.
        //   selectedShaderCode set        → run that GLSL inline; the path,
        //                                   if any, is identity only.
        //   selectedShaderPath set        → load the file (and its buffer /
        //                                   common files) from disk.
        //   both empty                    → bundled default.
        //
        // Path forms: relative "Shaders/Foo.frag" resolves against this
        // file; absolute paths under any plugin install collapse to relative
        // first (desktop runs from ~/.local, the greeter from /usr); other
        // absolute paths pass through.
        shaderSource: {
            if (!shaderSystem.wallpaperConfig || shaderSystem._inlineActive) return ""
            if (shaderSystem._shaderPath.length > 0) {
                const rel = ShaderLibrarySingleton.toRelativeShaderPath(shaderSystem._shaderPath)
                return ShaderLibrarySingleton.userFileUrl(rel) || Qt.resolvedUrl(rel)
            }
            return Qt.resolvedUrl("Shaders/PS3_MenuColor.frag")
        }
        // The code setters are no-ops while a file is bound. Depending on
        // shaderSource re-applies them after the engine leaves disk mode,
        // whichever of the two bindings updates first.
        readonly property bool _inlineMode: String(shaderSource) === ""
        shaderCode: _inlineMode ? shaderSystem._inlineCode : ""

        running: wallpaperConfig && wallpaperConfig.running && shouldRun
        speed: wallpaperConfig ? (wallpaperConfig.shaderSpeed || 1.0) : 1.0
        targetFps: wallpaperConfig ? (wallpaperConfig.targetFps || 60) : 60
        resolutionScale: wallpaperConfig ? (wallpaperConfig.resolutionScale || 1.0) : 1.0
        // 0 = buffer sims run at full native resolution (default). Users on
        // weak GPUs can cap the sim grid height here; the image pass
        // upsamples linearly.
        bufferSimulationMaxHeight: wallpaperConfig
            ? (wallpaperConfig.bufferSimulationMaxHeight || 0)
            : 0
        hdrPipeline: (wallpaperConfig && wallpaperConfig.experimentalHdrPipeline) || false
        dither: wallpaperConfig ? (wallpaperConfig.dither !== false) : true
        // Only the performance HUD reads the per-frame signals.
        frameSignals: performanceLoader.active

        // Mouse input — disabled in lock-screen mode.
        mouseEnabled: shaderSystem._allowMouse
        mouseBias: (wallpaperConfig && wallpaperConfig.mouseBias) || 1.0

        // Audio input — disabled in lock-screen mode.
        audioEnabled: shaderSystem._allowAudio
        audioChannel: (wallpaperConfig && wallpaperConfig.audioChannel) || 0
        audioSource: audioCapture

        // Window tracking — disabled in lock-screen mode. The renderer reads
        // the tracker directly, without a QML round trip per poll.
        windowsEnabled: shaderSystem._allowWindows
        windowSource: windowTracker

        // Hot-reload (C8) — disabled in lock-screen mode (dev workflow).
        watchSourceFile: shaderSystem._allowWatchSource

        // Texture channels — only resolve a URL when the user has actually
        // picked a texture *and* enabled the channel. Empty path = no load
        // (avoids loading the package-relative default that doesn't ship).
        iChannel0: (wallpaperConfig && wallpaperConfig.iChannel0Enabled && wallpaperConfig.iChannel0)
            ? Qt.resolvedUrl(wallpaperConfig.iChannel0) : ""
        iChannel1: (wallpaperConfig && wallpaperConfig.iChannel1Enabled && wallpaperConfig.iChannel1)
            ? Qt.resolvedUrl(wallpaperConfig.iChannel1) : ""
        iChannel2: (wallpaperConfig && wallpaperConfig.iChannel2Enabled && wallpaperConfig.iChannel2)
            ? Qt.resolvedUrl(wallpaperConfig.iChannel2) : ""
        iChannel3: (wallpaperConfig && wallpaperConfig.iChannel3Enabled && wallpaperConfig.iChannel3)
            ? Qt.resolvedUrl(wallpaperConfig.iChannel3) : ""

        iChannel0Enabled: wallpaperConfig ? wallpaperConfig.iChannel0Enabled === true : false
        iChannel1Enabled: wallpaperConfig ? wallpaperConfig.iChannel1Enabled === true : false
        iChannel2Enabled: wallpaperConfig ? wallpaperConfig.iChannel2Enabled === true : false
        iChannel3Enabled: wallpaperConfig ? wallpaperConfig.iChannel3Enabled === true : false

        // Buffer flags. A file load sets the engine's flags from the files on
        // disk without touching the config, and the setters ignore an
        // unchanged value: depending on shaderSource re-pushes the config
        // value after every source change.
        useBufferA: { void shaderSource; return !!(wallpaperConfig && wallpaperConfig.useBufferA) }
        useBufferB: { void shaderSource; return !!(wallpaperConfig && wallpaperConfig.useBufferB) }
        useBufferC: { void shaderSource; return !!(wallpaperConfig && wallpaperConfig.useBufferC) }
        useBufferD: { void shaderSource; return !!(wallpaperConfig && wallpaperConfig.useBufferD) }

        commonCode:  _inlineMode && wallpaperConfig ? (wallpaperConfig.commonCode  || "") : ""
        bufferACode: _inlineMode && wallpaperConfig ? (wallpaperConfig.bufferACode || "") : ""
        bufferBCode: _inlineMode && wallpaperConfig ? (wallpaperConfig.bufferBCode || "") : ""
        bufferCCode: _inlineMode && wallpaperConfig ? (wallpaperConfig.bufferCCode || "") : ""
        bufferDCode: _inlineMode && wallpaperConfig ? (wallpaperConfig.bufferDCode || "") : ""

        // Per-pass channel mappings
        imageChannels: wallpaperConfig ? [
            wallpaperConfig.imageChannel0 ?? 0,
            wallpaperConfig.imageChannel1 ?? 1,
            wallpaperConfig.imageChannel2 ?? 2,
            wallpaperConfig.imageChannel3 ?? 3
        ] : [0, 1, 2, 3]
        bufferAChannels: wallpaperConfig ? [
            wallpaperConfig.bufferAChannel0 ?? -1,
            wallpaperConfig.bufferAChannel1 ?? -1,
            wallpaperConfig.bufferAChannel2 ?? -1,
            wallpaperConfig.bufferAChannel3 ?? -1
        ] : [-1, -1, -1, -1]
        bufferBChannels: wallpaperConfig ? [
            wallpaperConfig.bufferBChannel0 ?? -1,
            wallpaperConfig.bufferBChannel1 ?? -1,
            wallpaperConfig.bufferBChannel2 ?? -1,
            wallpaperConfig.bufferBChannel3 ?? -1
        ] : [-1, -1, -1, -1]
        bufferCChannels: wallpaperConfig ? [
            wallpaperConfig.bufferCChannel0 ?? -1,
            wallpaperConfig.bufferCChannel1 ?? -1,
            wallpaperConfig.bufferCChannel2 ?? -1,
            wallpaperConfig.bufferCChannel3 ?? -1
        ] : [-1, -1, -1, -1]
        bufferDChannels: wallpaperConfig ? [
            wallpaperConfig.bufferDChannel0 ?? -1,
            wallpaperConfig.bufferDChannel1 ?? -1,
            wallpaperConfig.bufferDChannel2 ?? -1,
            wallpaperConfig.bufferDChannel3 ?? -1
        ] : [-1, -1, -1, -1]

        // In lock/login greeter mode force "never pause".
        property bool shouldRun: {
            if (shaderSystem.restrictedMode) return true
            if (screenLock.locked) return false
            if (!wallpaperConfig) return true
            switch (wallpaperConfig.pauseMode) {
                case 0: return !windowModel.maximizedExists
                case 1: return !windowModel.activeExists
                case 2: return !windowModel.visibleExists
                case 3:
                default: return true
            }
        }

        // Error handling
        onHasErrorChanged: {
            if (hasError) {
                console.warn("Shader error:", errorMessage)
            }
        }
    }

    // Input flows into the engine only via the trackers' own poll timers
    // (onIMouseChanged, windowSource above). Do NOT re-poll them from a
    // FrameAnimation or similar: a running animation forces the whole window
    // to render at display refresh, which defeats the FPS limit, and the
    // synchronous XCB window poll is too heavy to run per frame.

    // Mouse tracking area, for hover and presses that no item above takes.
    // X11 polls the global pointer and Wayland filters the window's events
    // (CursorTracker.hoverItem). Disabled on greeter surfaces, whose UI
    // needs the events.
    MouseArea {
        id: mouseArea
        anchors.fill: parent
        // Absent unless the shader follows the mouse: nothing in the
        // wallpaper then takes part in desktop input (issue #72).
        enabled: !shaderSystem.restrictedMode && shaderSystem._allowMouse
        visible: enabled
        hoverEnabled: shaderSystem._allowMouse
        propagateComposedEvents: true
        preventStealing: false

        onPositionChanged: (mouse) => {
            mouse.accepted = false
            if (shaderSystem._allowMouse) {
                cursorTracker.updatePosition(mouseX, mouseY)
            }
        }

        onPressed: (mouse) => {
            mouse.accepted = false
            if (shaderSystem._allowMouse) {
                cursorTracker.updateClick(mouseX, mouseY, true)
            }
        }

        onReleased: (mouse) => {
            mouse.accepted = false
            if (shaderSystem._allowMouse) {
                cursorTracker.updatePressed(false)
            }
        }

        onClicked: (mouse) => mouse.accepted = false
        onDoubleClicked: (mouse) => mouse.accepted = false
        onWheel: (wheel) => wheel.accepted = false
    }

    // Performance HUD — hidden on greeter surfaces. Instantiated only while
    // shown; the engine's per-frame signals (frameSignals) follow it.
    Loader {
        id: performanceLoader
        active: !shaderSystem.restrictedMode && wallpaperConfig != null
              && (wallpaperConfig.showPerformance || false)
        anchors {
            top: parent.top
            right: parent.right
            margins: 10
        }

        sourceComponent: PerformanceWidget {
            id: performanceWidget

            currentFps: shaderEngine.currentFps
            frameTime: shaderEngine.frameTime
            averageFrameTime: shaderEngine.averageFrameTime
            minFrameTime: shaderEngine.minFrameTime
            maxFrameTime: shaderEngine.maxFrameTime

            performanceTier: {
                var avg = shaderEngine.averageFrameTime
                if (avg <= 0) return 1
                if (avg < 4.0) return 0
                if (avg < 8.0) return 1
                if (avg < 16.0) return 2
                return 3
            }

            powerCost: {
                var baseCost = 0
                var avg = shaderEngine.averageFrameTime

                if (avg <= 0) baseCost = 50
                else if (avg < 2.0) baseCost = 10
                else if (avg < 4.0) baseCost = 20
                else if (avg < 8.0) baseCost = 35
                else if (avg < 16.0) baseCost = 50
                else if (avg < 33.0) baseCost = 70
                else baseCost = 85

                var modifier = 0
                if (wallpaperConfig && (wallpaperConfig.useBufferA || wallpaperConfig.useBufferB ||
                    wallpaperConfig.useBufferC || wallpaperConfig.useBufferD)) {
                    modifier += 15
                }
                if (wallpaperConfig && wallpaperConfig.audioEnabled) {
                    modifier += 5
                }

                return Math.min(100, baseCost + modifier)
            }

            expanded: !wallpaperConfig || wallpaperConfig.performanceExpanded !== false
            showGraph: !wallpaperConfig || wallpaperConfig.showPerformanceGraph !== false
            gpuTdp: (wallpaperConfig && wallpaperConfig.gpuTdp) || 75

            // The history feeds the graph only.
            Connections {
                target: shaderEngine
                function onFrameTimeChanged() {
                    if (performanceWidget.showGraph) {
                        performanceWidget.addFrameTime(shaderEngine.frameTime)
                    }
                }
            }
        }
    }

    // Pause badge, opt-in: in pause modes 1/2 an active or visible window
    // is the normal state, so an unconditional badge sat centre-screen
    // whenever the desktop was revealed.
    Rectangle {
        visible: !shaderSystem.restrictedMode && wallpaperConfig !== null
              && wallpaperConfig.showPauseIndicator === true
              && wallpaperConfig.running === true && !shaderEngine.running
        anchors.centerIn: parent
        width: pauseIcon.width + 40
        height: pauseIcon.height + 20
        color: "#80000000"
        radius: 10

        Row {
            id: pauseIcon
            anchors.centerIn: parent
            spacing: 10

            Image {
                source: "Resources/pause.svg"
                width: 24
                height: 24
            }

            Text {
                text: i18n("Paused")
                color: "white"
                font.pixelSize: 16
                anchors.verticalCenter: parent.verticalCenter
            }
        }
    }

    // Thumbnail capture for the shader on screen. The id is fixed when the
    // capture is scheduled and when it starts, so a shader switch in
    // between never files one shader's frame under another's id.
    property string _thumbnailCaptureId: ""

    Timer {
        id: thumbnailTimer
        interval: 2000
        repeat: false
        property string scheduledId: ""

        onTriggered: {
            if (shaderSystem.restrictedMode || !wallpaperConfig) return
            if (!shaderEngine.running || shaderSystem._inlineActive) return
            if (shaderEngine.compileFailed || shaderEngine.hasError) return
            var shaderId = getShaderIdFromPath(shaderSystem._shaderPath)
            if (!shaderId || shaderId !== scheduledId) return
            if (!ShaderLibrarySingleton.needsThumbnail(shaderId)) return
            shaderSystem._thumbnailCaptureId = shaderId
            shaderEngine.captureFrame(ShaderLibrarySingleton.getThumbnailPath(shaderId))
        }
    }

    function _scheduleThumbnail() {
        thumbnailTimer.scheduledId = getShaderIdFromPath(shaderSystem._shaderPath)
        if (thumbnailTimer.scheduledId) thumbnailTimer.restart()
        else thumbnailTimer.stop()
    }

    Connections {
        target: shaderEngine
        function onFrameCaptured(path) {
            const id = shaderSystem._thumbnailCaptureId
            shaderSystem._thumbnailCaptureId = ""
            if (id) ShaderLibrarySingleton.saveThumbnail(id, path)
        }
    }

    function getShaderIdFromPath(path) {
        if (!path) return ""
        var shader = ShaderLibrarySingleton.getShaderByPath(path)
        return shader ? shader.id : ""
    }

    Component.onCompleted: {
        _pushScreenUniforms()
        console.log("Shader Wallpaper initialized")
        _migrateConfig()
        if (!wallpaperConfig) {
            console.warn("Shader Wallpaper: no wallpaper configuration")
            return
        }
        console.log("Shader:", shaderSystem._shaderPath,
                    shaderSystem._inlineActive ? "(inline code)" : "")
        _scheduleThumbnail()
    }

    Connections {
        target: wallpaperConfig
        enabled: wallpaperConfig !== null
        function onSelectedShaderPathChanged() { shaderSystem._scheduleThumbnail() }
        function onSelectedShaderCodeChanged() { shaderSystem._scheduleThumbnail() }
    }

    // ------------------------------------------------------------------
    // Automatic shader changes. Pool: playlistSource 0 = playlistShaders,
    // 1 = favourites, 2 = whole library. Each change applies the full
    // shader config (buffers, routing, inputs) through ShaderApply.
    // ------------------------------------------------------------------
    function _shaderPool() {
        if (!wallpaperConfig) return []
        const lib = ShaderLibrarySingleton
        const source = wallpaperConfig.playlistSource || 0
        let raw = []
        if (source === 0) {
            raw = Array.prototype.slice.call(wallpaperConfig.playlistShaders || [])
        } else {
            const metas = source === 1 ? lib.favorites() : lib.allShaders()
            for (let i = 0; i < metas.length; i++) raw.push(String(metas[i].shaderPath))
        }
        const pool = []
        for (let j = 0; j < raw.length; j++) {
            const rel = lib.toRelativeShaderPath(String(raw[j]))
            if (rel.length > 0 && pool.indexOf(rel) < 0) pool.push(rel)
        }
        return pool
    }

    function advancePlaylist() {
        const pool = _shaderPool()
        if (pool.length < 2) return
        const current = ShaderLibrarySingleton.toRelativeShaderPath(shaderSystem._shaderPath)
        let next
        if (wallpaperConfig.playlistShuffle) {
            let attempts = 0
            do {
                next = pool[Math.floor(Math.random() * pool.length)]
                attempts++
            } while (next === current && attempts < 8)
        } else {
            next = pool[(pool.indexOf(current) + 1) % pool.length]
        }
        if (!next) return
        // Shader, buffers, routing and declared images only: the input
        // preferences (mouse, windows, sound) are the user's.
        const state = ShaderApply.collect(wallpaperConfig, ShaderApply.TEXTURE_STATE_KEYS, "")
        ShaderApply.applyMap(wallpaperConfig,
                             ShaderApply.withoutInputs(ShaderApply.forPath(ShaderLibrarySingleton, next, state)), "")
    }

    Timer {
        id: playlistTimer
        interval: Math.max(1, (wallpaperConfig && wallpaperConfig.playlistIntervalMinutes) || 10) * 60 * 1000
        repeat: true
        running: !shaderSystem.restrictedMode
              && wallpaperConfig !== null
              && wallpaperConfig.playlistEnabled === true
              && ((wallpaperConfig.playlistSource || 0) !== 0
                  || (wallpaperConfig.playlistShaders || []).length >= 2)
        onTriggered: shaderSystem.advancePlaylist()
    }
}
