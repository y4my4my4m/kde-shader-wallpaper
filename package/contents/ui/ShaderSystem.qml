// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>
//
// ShaderSystem - Main shader rendering component
// Only loaded when the C++ plugin is available

import QtQuick
import QtQuick.Controls
import org.kde.plasma.plasmoid
import "shaderwallpaper"

Item {
    id: shaderSystem
    anchors.fill: parent
    clip: true  // ShaderEngine overscans during parallax — clip to screen

    // ────────────────────────────────────────────────────────────────────────
    // Host plumbing (set by main.qml Loader.onLoaded).
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

    // Window model for pause detection
    WindowModel {
        id: windowModel
        screenGeometry: shaderSystem.parent?.parent?.screenGeometry ?? Qt.rect(0, 0, 1920, 1080)
    }

    // Cursor tracker for global mouse position. We explicitly bind
    // `screen` so the Y-flip uses THIS wallpaper's screen height (not
    // QGuiApplication::primaryScreen — which on multi-monitor setups
    // with different heights would put the impulse off-cursor).
    CursorTracker {
        id: cursorTracker
        enabled: shaderSystem._allowMouse && shaderEngine.running
        sensitivity: wallpaperConfig.mouseBias || 1.0
        screen: shaderSystem.Window.window ? shaderSystem.Window.window.screen : null
        // Same pixel space as fragCoord / iResolution (ShaderEngine FBO).
        referenceWidth: shaderEngine.width
        referenceHeight: shaderEngine.height
        devicePixelRatio: shaderSystem.Window.window
                            ? shaderSystem.Window.window.screen.devicePixelRatio
                            : 1.0

        onIMouseChanged: {
            shaderEngine.iMouse = iMouse
        }
    }

    function refreshShaderInput() {
        if (shaderSystem._allowMouse) {
            cursorTracker.refresh()
            shaderEngine.iMouse = cursorTracker.iMouse
        }
        if (shaderSystem._allowWindows) {
            windowTracker.refresh()
            shaderEngine.windowCount = windowTracker.windowCount
            shaderEngine.windowRects = windowTracker.windowRectsFlat()
            shaderEngine.windowVelocities = windowTracker.windowVelocitiesFlat()
        }
    }

    // Audio capture for audio-reactive shaders
    AudioCapture {
        id: audioCapture
        enabled: shaderSystem._allowAudio && shaderEngine.running
        sensitivity: wallpaperConfig.audioSensitivity || 40.0
        
        onAudioDataReady: {
            shaderEngine.audioData = audioCapture.getTextureData()
        }
    }
    
    // Window tracking for window-reactive effects
    WindowTracker {
        id: windowTracker
        enabled: shaderSystem._allowWindows && shaderEngine.running
        pollInterval: 33  // 30Hz polling
        referenceWidth: shaderEngine.width
        referenceHeight: shaderEngine.height
        devicePixelRatio: cursorTracker.devicePixelRatio
        screenVirtualX: screenInfo.myGeom ? screenInfo.myGeom.x : 0
        screenVirtualY: screenInfo.myGeom ? screenInfo.myGeom.y : 0
        
        onWindowsChanged: {
            shaderEngine.windowCount = windowTracker.windowCount
            shaderEngine.windowRects = windowTracker.windowRectsFlat()
            shaderEngine.windowVelocities = windowTracker.windowVelocitiesFlat()
        }
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
    // ------------------------------------------------------------------
    QtObject {
        id: screenInfo
        property var screens: Qt.application.screens
        property rect myGeom: shaderSystem.parent?.parent?.screenGeometry
                              ?? Qt.rect(0, 0, 1920, 1080)
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
        property int myIndex: {
            for (var i = 0; i < screens.length; i++) {
                if (screens[i].virtualX === myGeom.x
                 && screens[i].virtualY === myGeom.y) return i;
            }
            return 0;
        }
    }
    Connections {
        target: screenInfo
        function onMyGeomChanged() { _pushScreenUniforms() }
        function onMyIndexChanged() { _pushScreenUniforms() }
    }
    function _pushScreenUniforms() {
        if (!shaderSystem._allowExperimentalScreens) {
            shaderEngine.screenOffset = Qt.vector2d(0, 0)
            shaderEngine.screenIndex  = 0
            shaderEngine.screenCount  = 1
            return
        }
        shaderEngine.screenOffset = Qt.vector2d(
            screenInfo.myGeom.x - screenInfo.virtualX0,
            screenInfo.myGeom.y - screenInfo.virtualY0)
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
    // virtual desktop. Overscan is necessary so the panned shader
    // doesn't leave black bars on the edges. We only overscan when the
    // feature is on, so single-desktop / parallax-off users pay zero
    // overhead.
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

        // Three operating modes:
        //   1. selectedShaderPath set       → load that file from disk.
        //   2. selectedShaderPath empty,
        //      selectedShaderCode set       → run that GLSL inline.
        //                                     (Used by the Shader Tweaks
        //                                     panel and ImportDialog.)
        //   3. both empty                   → fall back to the bundled
        //                                     default so the desktop is
        //                                     never blank.
        //
        // CRITICAL: in mode 2 we MUST send an empty shaderSource so the
        // engine's m_loadShadersFromDisk flag clears and setShaderCode
        // actually takes effect. The previous always-fall-back behaviour
        // here made tweaks/inline shaders silently revert to the default
        // file on the live wallpaper instance.
        // Resolves the saved selectedShaderPath in two contexts:
        //   - relative "Shaders/Foo.frag"     → resolved against this QML file
        //   - absolute file:///... under any plugin install dir → collapsed
        //     to relative first, then resolved against the *current* QML
        //     directory (the user picked it from ~/.local on the desktop but
        //     the greeter runs from /usr, so we can't keep the absolute path)
        //   - absolute path outside the plugin install (user's own .frag) →
        //     pass through unchanged
        shaderSource: wallpaperConfig && wallpaperConfig.selectedShaderPath
            ? Qt.resolvedUrl(ShaderLibrarySingleton.toRelativeShaderPath(
                  wallpaperConfig.selectedShaderPath.toString()))
            : ((wallpaperConfig && wallpaperConfig.selectedShaderCode && wallpaperConfig.selectedShaderCode.length > 0)
                ? ""
                : Qt.resolvedUrl("Shaders/PS3_MenuColor.frag"))
        shaderCode: wallpaperConfig && wallpaperConfig.selectedShaderPath
            ? ""
            : ((wallpaperConfig && wallpaperConfig.selectedShaderCode) || "")

        running: wallpaperConfig && wallpaperConfig.running && shouldRun
        speed: wallpaperConfig ? (wallpaperConfig.shaderSpeed || 1.0) : 1.0
        targetFps: wallpaperConfig ? (wallpaperConfig.targetFps || 60) : 60
        resolutionScale: wallpaperConfig ? (wallpaperConfig.resolutionScale || 1.0) : 1.0

        // Mouse input — disabled in lock-screen mode.
        mouseEnabled: shaderSystem._allowMouse
        mouseBias: wallpaperConfig.mouseBias || 1.0

        // Audio input — disabled in lock-screen mode.
        audioEnabled: shaderSystem._allowAudio
        audioChannel: wallpaperConfig.audioChannel || 0

        // Window tracking — disabled in lock-screen mode.
        windowsEnabled: shaderSystem._allowWindows

        // Hot-reload (C8) — disabled in lock-screen mode (dev workflow).
        watchSourceFile: shaderSystem._allowWatchSource

        // Texture channels — only resolve a URL when the user has actually
        // picked a texture *and* enabled the channel. Empty path = no load
        // (avoids loading the package-relative default that doesn't ship).
        iChannel0: (wallpaperConfig.iChannel0Enabled && wallpaperConfig.iChannel0)
            ? Qt.resolvedUrl(wallpaperConfig.iChannel0) : ""
        iChannel1: (wallpaperConfig.iChannel1Enabled && wallpaperConfig.iChannel1)
            ? Qt.resolvedUrl(wallpaperConfig.iChannel1) : ""
        iChannel2: (wallpaperConfig.iChannel2Enabled && wallpaperConfig.iChannel2)
            ? Qt.resolvedUrl(wallpaperConfig.iChannel2) : ""
        iChannel3: (wallpaperConfig.iChannel3Enabled && wallpaperConfig.iChannel3)
            ? Qt.resolvedUrl(wallpaperConfig.iChannel3) : ""

        iChannel0Enabled: wallpaperConfig.iChannel0Enabled === true
        iChannel1Enabled: wallpaperConfig.iChannel1Enabled === true
        iChannel2Enabled: wallpaperConfig.iChannel2Enabled === true
        iChannel3Enabled: wallpaperConfig.iChannel3Enabled === true

        // Buffer configuration
        useBufferA: wallpaperConfig.useBufferA || false
        useBufferB: wallpaperConfig.useBufferB || false
        useBufferC: wallpaperConfig.useBufferC || false
        useBufferD: wallpaperConfig.useBufferD || false

        // Common code (shared across all passes)
        commonCode: wallpaperConfig.commonCode || ""
        
        bufferACode: wallpaperConfig.bufferACode || ""
        bufferBCode: wallpaperConfig.bufferBCode || ""
        bufferCCode: wallpaperConfig.bufferCCode || ""
        bufferDCode: wallpaperConfig.bufferDCode || ""
        
        // Per-pass channel mappings
        imageChannels: [
            wallpaperConfig.imageChannel0 ?? 0,
            wallpaperConfig.imageChannel1 ?? 1,
            wallpaperConfig.imageChannel2 ?? 2,
            wallpaperConfig.imageChannel3 ?? 3
        ]
        bufferAChannels: [
            wallpaperConfig.bufferAChannel0 ?? -1,
            wallpaperConfig.bufferAChannel1 ?? -1,
            wallpaperConfig.bufferAChannel2 ?? -1,
            wallpaperConfig.bufferAChannel3 ?? -1
        ]
        bufferBChannels: [
            wallpaperConfig.bufferBChannel0 ?? -1,
            wallpaperConfig.bufferBChannel1 ?? -1,
            wallpaperConfig.bufferBChannel2 ?? -1,
            wallpaperConfig.bufferBChannel3 ?? -1
        ]
        bufferCChannels: [
            wallpaperConfig.bufferCChannel0 ?? -1,
            wallpaperConfig.bufferCChannel1 ?? -1,
            wallpaperConfig.bufferCChannel2 ?? -1,
            wallpaperConfig.bufferCChannel3 ?? -1
        ]
        bufferDChannels: [
            wallpaperConfig.bufferDChannel0 ?? -1,
            wallpaperConfig.bufferDChannel1 ?? -1,
            wallpaperConfig.bufferDChannel2 ?? -1,
            wallpaperConfig.bufferDChannel3 ?? -1
        ]

        // In lock/login greeter mode force "never pause".
        property bool shouldRun: {
            if (shaderSystem.restrictedMode) return true
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

    // Refresh mouse/window input every QML frame for smooth buffer trails.
    FrameAnimation {
        running: shaderEngine.running
              && (shaderSystem._allowMouse || shaderSystem._allowWindows)
        onTriggered: shaderSystem.refreshShaderInput()
    }

    // Mouse tracking area (fallback for Wayland). Disabled on greeter surfaces
    // so we don't intercept events the login/lock UI needs.
    MouseArea {
        id: mouseArea
        anchors.fill: parent
        enabled: !shaderSystem.restrictedMode
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

    // Performance HUD — hidden on greeter surfaces.
    PerformanceWidget {
        id: performanceWidget
        visible: !shaderSystem.restrictedMode && (wallpaperConfig.showPerformance || false)
        anchors {
            top: parent.top
            right: parent.right
            margins: 10
        }
        
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
            if (wallpaperConfig.useBufferA || wallpaperConfig.useBufferB ||
                wallpaperConfig.useBufferC || wallpaperConfig.useBufferD) {
                modifier += 15
            }
            if (wallpaperConfig.audioEnabled) {
                modifier += 5
            }
            
            return Math.min(100, baseCost + modifier)
        }
        
        expanded: wallpaperConfig.performanceExpanded !== false
        showGraph: wallpaperConfig.showPerformanceGraph !== false
        gpuTdp: wallpaperConfig.gpuTdp || 75
    }
    
    // Connect frame time updates to the widget
    Connections {
        target: shaderEngine
        function onFrameTimeChanged() {
            if (performanceWidget.visible) {
                performanceWidget.addFrameTime(shaderEngine.frameTime)
            }
        }
    }

    // Pause indicator
    Rectangle {
        visible: !shaderEngine.running && wallpaperConfig && wallpaperConfig.running
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

    // Thumbnail generation timer
    Timer {
        id: thumbnailTimer
        interval: 2000
        repeat: false
        
        onTriggered: {
            if (shaderSystem.restrictedMode) return
            if (shaderEngine.running && !shaderEngine.hasError) {
                var shaderId = getShaderIdFromPath(wallpaperConfig.selectedShaderPath)
                if (shaderId && ShaderLibrarySingleton.needsThumbnail(shaderId)) {
                    var thumbPath = ShaderLibrarySingleton.getThumbnailPath(shaderId)
                    console.log("Capturing thumbnail for:", shaderId)
                    shaderEngine.captureFrame(thumbPath)
                }
            }
        }
    }
    
    // Handle thumbnail capture completion
    Connections {
        target: shaderEngine
        function onFrameCaptured(path) {
            var shaderId = getShaderIdFromPath(wallpaperConfig.selectedShaderPath)
            if (shaderId) {
                ShaderLibrarySingleton.saveThumbnail(shaderId, path)
            }
        }
    }
    
    // Helper to extract shader ID from path
    function getShaderIdFromPath(path) {
        if (!path) return ""
        var shader = ShaderLibrarySingleton.getShaderByPath(path)
        return shader ? shader.id : ""
    }

    Component.onCompleted: {
        console.log("Shader Wallpaper v4.0 initialized")
        if (!wallpaperConfig) {
            console.warn("Shader Wallpaper: wallpaperConfig not wired yet")
            return
        }
        console.log("Shader:", wallpaperConfig.selectedShaderPath)
        
        if (wallpaperConfig.selectedShaderPath) {
            thumbnailTimer.start()
        }
    }
    
    Connections {
        target: wallpaperConfig
        enabled: wallpaperConfig !== null
        function onSelectedShaderPathChanged() {
            thumbnailTimer.restart()
        }
    }

    // ------------------------------------------------------------------
    // Playlist (A3) — rotates through wallpaperConfig.playlistShaders
    // every playlistIntervalMinutes. In shuffle mode picks a random one
    // each time (never repeats the current one twice in a row); in
    // sequence mode advances to the next list entry, wrapping around.
    // ------------------------------------------------------------------
    Timer {
        id: playlistTimer
        interval: Math.max(5, (wallpaperConfig.playlistIntervalMinutes || 10)) * 60 * 1000
        repeat: true
        running: !shaderSystem.restrictedMode
              && wallpaperConfig.playlistEnabled
              && (wallpaperConfig.playlistShaders || []).length >= 2
        triggeredOnStart: false

        onTriggered: {
            var list = wallpaperConfig.playlistShaders || []
            if (list.length < 2) return
            var current = wallpaperConfig.selectedShaderPath || ""
            var nextPath
            if (wallpaperConfig.playlistShuffle) {
                var attempts = 0
                do {
                    nextPath = list[Math.floor(Math.random() * list.length)]
                    attempts++
                } while (nextPath === current && attempts < 8)
            } else {
                var idx = list.indexOf(current)
                if (idx < 0) idx = -1
                nextPath = list[(idx + 1) % list.length]
            }
            if (nextPath) wallpaperConfig.selectedShaderPath = nextPath
        }
    }
}

