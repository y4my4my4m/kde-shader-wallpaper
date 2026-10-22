// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>
//
// Shader Wallpaper for KDE Plasma 6
// https://github.com/y4my4my4m/kde-shader-wallpaper

import QtQuick
import org.kde.plasma.plasmoid

WallpaperItem {
    id: main

    // The native engine (QML module in shaderwallpaper/) is absent after a
    // KDE Store install until the settings page builds it. This file never
    // imports it; ShaderSystem.qml, which does, loads only when it is present.
    EngineStatus { id: engineStatus }

    readonly property bool pluginAvailable: engineStatus.available

    // ────────────────────────────────────────────────────────────────────────
    // Host-surface detection + config bridge.
    //
    // This WallpaperItem is loaded by three different hosts:
    //
    //   Desktop  — plasmashell / Desktop.qml
    //              `wallpaper` context → WallpaperItem; config via
    //              wallpaper.configuration (or our own `configuration`).
    //
    //   Lock     — kscreenlocker_greet / LockScreen.qml
    //              `wallpaper` context → WallpaperIntegration; config via
    //              wallpaper.configuration.
    //
    //   Login    — Plasma Login Manager (PLM) / plasma-login-wallpaper
    //              NO `wallpaper` context object — PLM injects a
    //              `configuration` KConfigPropertyMap directly onto this
    //              WallpaperItem root (see plasma-login-manager
    //              WallpaperApp::setupWallpaperPlugin). Config must be read
    //              from WallpaperItem.configuration instead.
    //
    // PLM's System Settings KCM omits third-party plugins from its wallpaper-type
    // dropdown (KDE bug 517325). Register the plugin in /etc/plasmalogin.conf
    // ([Greeter] WallpaperPluginId=online.knowmad.shaderwallpaper), then pick a
    // shader in System Settings → Login Screen → ⋮ → Configure Appearance…
    //
    // See scripts/install-plm-greeter.sh (and the "Login screen" card in
    // ConfigContent.qml, which calls the same script via pkexec).
    //
    // Detection: inspect the host QQuickView's `source` URL (same trick as
    // Smart Video Wallpaper Reborn and other dual-mode plugins).
    // ────────────────────────────────────────────────────────────────────────
    property bool lockScreenMode: false
    property bool loginScreenMode: false

    // Authoritative config map for ShaderSystem — works in all three hosts.
    readonly property var effectiveConfiguration: {
        if (typeof wallpaper !== "undefined" && wallpaper && wallpaper.configuration)
            return wallpaper.configuration
        return configuration
    }

    Item {
        anchors.fill: parent
        onWindowChanged: function(window) {
            if (!window) return
            const src = ("source" in window) ? window.source.toString() : ""
            main.lockScreenMode = src.endsWith("LockScreen.qml")
            // PLM's wallpaper service hosts us inside
            // qrc:/…/org/kde/plasma/login/wallpaper/main.qml
            main.loginScreenMode = src.indexOf("plasma/login/wallpaper") >= 0
            if (main.lockScreenMode) {
                console.log("Shader Wallpaper: lock-screen mode")
            } else if (main.loginScreenMode) {
                console.log("Shader Wallpaper: PLM login-screen mode")
            }
        }
    }

    function startEngine() {
        if (pluginLoader.status !== Loader.Null) return
        console.log("Shader Wallpaper: Plugin found!")
        // Initial properties: the config map is present when
        // ShaderSystem's bindings first evaluate. A Binding applies only
        // after completion; the first evaluation would see null and load
        // the main.xml default shader from disk (issue #114).
        pluginLoader.setSource("ShaderSystem.qml", {
            wallpaperConfig: main.effectiveConfiguration,
            lockScreenMode: main.lockScreenMode,
            loginScreenMode: main.loginScreenMode
        })
    }

    Component.onCompleted: {
        if (engineStatus.available) {
            startEngine()
        } else if (engineStatus.failed) {
            console.log("Shader Wallpaper: engine not installed -", engineStatus.error)
        }
    }

    Connections {
        target: engineStatus
        function onAvailableChanged() {
            if (engineStatus.available) main.startEngine()
        }
    }

    // Shown until the engine is installed and Plasma restarted.
    Loader {
        anchors.fill: parent
        active: engineStatus.failed
        sourceComponent: EngineMissing {
            showMessage: !main.lockScreenMode && !main.loginScreenMode
        }
    }

    Loader {
        id: pluginLoader
        anchors.fill: parent
    }

    Binding {
        target: pluginLoader.item
        property: "wallpaperConfig"
        value: main.effectiveConfiguration
        when: pluginLoader.item !== null
    }
    Binding {
        target: pluginLoader.item
        property: "lockScreenMode"
        value: main.lockScreenMode
        when: pluginLoader.item !== null
    }
    Binding {
        target: pluginLoader.item
        property: "loginScreenMode"
        value: main.loginScreenMode
        when: pluginLoader.item !== null
    }
}
