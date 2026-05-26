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
    // Lock-screen mode (set by main.qml's Loader.onLoaded).
    //
    // When true, we treat the user's configured inputs as ceilings rather
    // than literal values:
    //   • mouse / audio / window tracking are forced OFF — kscreenlocker_greet
    //     can't reliably acquire those, and they're nonsensical anyway since
    //     no user input/audio/windows should be reaching the lock surface.
    //   • watchSourceFile is forced OFF — saving a .frag while locked is a
    //     development workflow that doesn't belong here.
    //   • pauseMode is forced to "never" — the window/active-window heuristics
    //     trip on lock-screen UI surfaces.
    //   • targetFps is clamped — animation on a lock screen costs battery for
    //     a screen the user isn't actually looking at; 30 fps is plenty for
    //     ambient motion. (Hard clamp, ignores user setting in lock mode.)
    //   • All experimental engine features are disabled, since they query
    //     virtual desktops / multi-monitor topology that the lock screen
    //     doesn't expose.
    // The user's saved desktop settings are untouched — they come back
    // verbatim the next time the desktop instance loads.
    // ────────────────────────────────────────────────────────────────────────
    property bool lockScreenMode: false
    readonly property int  _lockFpsCap: 30
    readonly property bool _allowMouse:   !lockScreenMode && (wallpaper.configuration.mouseEnabled || false)
    readonly property bool _allowAudio:   !lockScreenMode && (wallpaper.configuration.audioEnabled || false)
    readonly property bool _allowWindows: !lockScreenMode && (wallpaper.configuration.windowsEnabled || false)
    readonly property bool _allowExperimentalDesktop: !lockScreenMode && (wallpaper.configuration.experimentalDesktopUniform || false)
    readonly property bool _allowExperimentalParallax: !lockScreenMode && (wallpaper.configuration.experimentalParallax || false)
    readonly property bool _allowExperimentalScreens:  !lockScreenMode && (wallpaper.configuration.experimentalScreenUniforms || false)
    readonly property bool _allowWatchSource: !lockScreenMode && (wallpaper.configuration.watchSourceFile || false)

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
        sensitivity: wallpaper.configuration.mouseBias || 1.0
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
        sensitivity: wallpaper.configuration.audioSensitivity || 40.0
        
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
        target: wallpaper.configuration
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
                                   ? Math.max(0, Math.min(1, wallpaper.configuration.experimentalParallaxStrength || 0.25))
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
        shaderSource: wallpaper.configuration.selectedShaderPath
            ? Qt.resolvedUrl(wallpaper.configuration.selectedShaderPath)
            : ((wallpaper.configuration.selectedShaderCode && wallpaper.configuration.selectedShaderCode.length > 0)
                ? ""
                : Qt.resolvedUrl("Shaders/PS3_MenuColor.frag"))
        shaderCode: wallpaper.configuration.selectedShaderPath
            ? ""
            : (wallpaper.configuration.selectedShaderCode || "")

        // Playback control. In lock-screen mode we clamp FPS to a power-
        // friendly ceiling regardless of the user's desktop setting — a
        // screen the user isn't looking at doesn't need 144 Hz.
        running: wallpaper.configuration.running && shouldRun
        speed: wallpaper.configuration.shaderSpeed || 1.0
        targetFps: {
            const f = wallpaper.configuration.targetFps || 60
            return shaderSystem.lockScreenMode ? Math.min(f, shaderSystem._lockFpsCap) : f
        }
        resolutionScale: wallpaper.configuration.resolutionScale || 1.0

        // Mouse input — disabled in lock-screen mode.
        mouseEnabled: shaderSystem._allowMouse
        mouseBias: wallpaper.configuration.mouseBias || 1.0

        // Audio input — disabled in lock-screen mode.
        audioEnabled: shaderSystem._allowAudio
        audioChannel: wallpaper.configuration.audioChannel || 0

        // Window tracking — disabled in lock-screen mode.
        windowsEnabled: shaderSystem._allowWindows

        // Hot-reload (C8) — disabled in lock-screen mode (dev workflow).
        watchSourceFile: shaderSystem._allowWatchSource

        // Texture channels
        iChannel0: wallpaper.configuration.iChannel0Enabled 
            ? Qt.resolvedUrl(wallpaper.configuration.iChannel0 || "Resources/wallpaper2.png")
            : ""
        iChannel1: wallpaper.configuration.iChannel1Enabled 
            ? Qt.resolvedUrl(wallpaper.configuration.iChannel1 || "Resources/wallpaper2.png")
            : ""
        iChannel2: wallpaper.configuration.iChannel2Enabled 
            ? Qt.resolvedUrl(wallpaper.configuration.iChannel2 || "Resources/Shadertoy_Organic_2.jpg")
            : ""
        iChannel3: wallpaper.configuration.iChannel3Enabled 
            ? Qt.resolvedUrl(wallpaper.configuration.iChannel3 || "Resources/Shadertoy_Organic_2.jpg")
            : ""

        iChannel0Enabled: wallpaper.configuration.iChannel0Enabled !== false
        iChannel1Enabled: wallpaper.configuration.iChannel1Enabled !== false
        iChannel2Enabled: wallpaper.configuration.iChannel2Enabled !== false
        iChannel3Enabled: wallpaper.configuration.iChannel3Enabled || false

        // Buffer configuration
        useBufferA: wallpaper.configuration.useBufferA || false
        useBufferB: wallpaper.configuration.useBufferB || false
        useBufferC: wallpaper.configuration.useBufferC || false
        useBufferD: wallpaper.configuration.useBufferD || false

        // Common code (shared across all passes)
        commonCode: wallpaper.configuration.commonCode || ""
        
        bufferACode: wallpaper.configuration.bufferACode || ""
        bufferBCode: wallpaper.configuration.bufferBCode || ""
        bufferCCode: wallpaper.configuration.bufferCCode || ""
        bufferDCode: wallpaper.configuration.bufferDCode || ""
        
        // Per-pass channel mappings
        imageChannels: [
            wallpaper.configuration.imageChannel0 ?? 0,
            wallpaper.configuration.imageChannel1 ?? 1,
            wallpaper.configuration.imageChannel2 ?? 2,
            wallpaper.configuration.imageChannel3 ?? 3
        ]
        bufferAChannels: [
            wallpaper.configuration.bufferAChannel0 ?? -1,
            wallpaper.configuration.bufferAChannel1 ?? -1,
            wallpaper.configuration.bufferAChannel2 ?? -1,
            wallpaper.configuration.bufferAChannel3 ?? -1
        ]
        bufferBChannels: [
            wallpaper.configuration.bufferBChannel0 ?? -1,
            wallpaper.configuration.bufferBChannel1 ?? -1,
            wallpaper.configuration.bufferBChannel2 ?? -1,
            wallpaper.configuration.bufferBChannel3 ?? -1
        ]
        bufferCChannels: [
            wallpaper.configuration.bufferCChannel0 ?? -1,
            wallpaper.configuration.bufferCChannel1 ?? -1,
            wallpaper.configuration.bufferCChannel2 ?? -1,
            wallpaper.configuration.bufferCChannel3 ?? -1
        ]
        bufferDChannels: [
            wallpaper.configuration.bufferDChannel0 ?? -1,
            wallpaper.configuration.bufferDChannel1 ?? -1,
            wallpaper.configuration.bufferDChannel2 ?? -1,
            wallpaper.configuration.bufferDChannel3 ?? -1
        ]

        // Determine if shader should run based on pause mode.
        // In lock-screen mode we force "never pause" — the window
        // heuristics trip on lock-screen UI overlays.
        property bool shouldRun: {
            if (shaderSystem.lockScreenMode) return true
            switch (wallpaper.configuration.pauseMode) {
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

    // Mouse tracking area (fallback for Wayland). Disabled in lock-screen
    // mode so we don't intercept events the lock UI needs.
    MouseArea {
        id: mouseArea
        anchors.fill: parent
        enabled: !shaderSystem.lockScreenMode
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

    // Performance monitoring widget — hidden on lock screen regardless of
    // user preference (no diagnostics needed on a customer-facing surface).
    PerformanceWidget {
        id: performanceWidget
        visible: !shaderSystem.lockScreenMode && (wallpaper.configuration.showPerformance || false)
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
            if (wallpaper.configuration.useBufferA || wallpaper.configuration.useBufferB ||
                wallpaper.configuration.useBufferC || wallpaper.configuration.useBufferD) {
                modifier += 15
            }
            if (wallpaper.configuration.audioEnabled) {
                modifier += 5
            }
            
            return Math.min(100, baseCost + modifier)
        }
        
        expanded: wallpaper.configuration.performanceExpanded !== false
        showGraph: wallpaper.configuration.showPerformanceGraph !== false
        gpuTdp: wallpaper.configuration.gpuTdp || 75
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
        visible: !shaderEngine.running && wallpaper.configuration.running
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
            if (shaderEngine.running && !shaderEngine.hasError) {
                var shaderId = getShaderIdFromPath(wallpaper.configuration.selectedShaderPath)
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
            var shaderId = getShaderIdFromPath(wallpaper.configuration.selectedShaderPath)
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
        console.log("Shader:", wallpaper.configuration.selectedShaderPath)
        
        if (wallpaper.configuration.selectedShaderPath) {
            thumbnailTimer.start()
        }
    }
    
    Connections {
        target: wallpaper.configuration
        function onSelectedShaderPathChanged() {
            thumbnailTimer.restart()
        }
    }

    // ------------------------------------------------------------------
    // Playlist (A3) — rotates through wallpaper.configuration.playlistShaders
    // every playlistIntervalMinutes. In shuffle mode picks a random one
    // each time (never repeats the current one twice in a row); in
    // sequence mode advances to the next list entry, wrapping around.
    // ------------------------------------------------------------------
    Timer {
        id: playlistTimer
        interval: Math.max(5, (wallpaper.configuration.playlistIntervalMinutes || 10)) * 60 * 1000
        repeat: true
        running: wallpaper.configuration.playlistEnabled
              && (wallpaper.configuration.playlistShaders || []).length >= 2
        triggeredOnStart: false

        onTriggered: {
            var list = wallpaper.configuration.playlistShaders || []
            if (list.length < 2) return
            var current = wallpaper.configuration.selectedShaderPath || ""
            var nextPath
            if (wallpaper.configuration.playlistShuffle) {
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
            if (nextPath) wallpaper.configuration.selectedShaderPath = nextPath
        }
    }
}

