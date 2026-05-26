// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>
//
// Shader Wallpaper for KDE Plasma 6
// https://github.com/y4my4my4m/kde-shader-wallpaper

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.plasma5support as P5Support
import org.kde.kirigami as Kirigami
import "shaderwallpaper" as ShaderPlugin

WallpaperItem {
    id: main

    // Check plugin status - stub returns false, real plugin returns true
    ShaderPlugin.PluginStatus { id: pluginStatus }

    property bool pluginAvailable: pluginStatus.installed

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

    Component.onCompleted: {
        if (pluginAvailable) {
            console.log("Shader Wallpaper: Plugin found!")
            pluginLoader.active = true
        } else {
            console.log("Shader Wallpaper: Plugin not installed -", pluginStatus.message)
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // Fallback UI when plugin is not installed
    // ═══════════════════════════════════════════════════════════════════════
    
    Rectangle {
        anchors.fill: parent
        visible: !pluginAvailable
        
        // Animated gradient background
        gradient: Gradient {
            GradientStop { position: 0.0; color: "#1a1a2e" }
            GradientStop { position: 0.5; color: "#16213e" }
            GradientStop { position: 1.0; color: "#0f3460" }
        }
        
        // Subtle animation
        Rectangle {
            id: glowOrb
            width: parent.width * 0.8
            height: width
            radius: width / 2
            anchors.centerIn: parent
            opacity: 0.15
            color: "transparent"
            
            Rectangle {
                anchors.fill: parent
                radius: parent.radius
                opacity: 0.3
                color: "#e94560"
            }
            
            SequentialAnimation on scale {
                loops: Animation.Infinite
                NumberAnimation { to: 1.1; duration: 3000; easing.type: Easing.InOutSine }
                NumberAnimation { to: 0.9; duration: 3000; easing.type: Easing.InOutSine }
            }
        }
        
        // Setup message
        ColumnLayout {
            anchors.centerIn: parent
            spacing: Kirigami.Units.largeSpacing
            
            Kirigami.Icon {
                source: "preferences-desktop-effects"
                Layout.preferredWidth: Kirigami.Units.iconSizes.enormous
                Layout.preferredHeight: Kirigami.Units.iconSizes.enormous
                Layout.alignment: Qt.AlignHCenter
                opacity: 0.8
            }
            
            Label {
                text: "Shader Wallpaper"
                font.pointSize: 24
                font.bold: true
                color: "white"
                Layout.alignment: Qt.AlignHCenter
            }
            
            Label {
                text: i18n("Plugin not installed")
                font.pointSize: 14
                color: "#e94560"
                Layout.alignment: Qt.AlignHCenter
            }
            
            Label {
                text: i18n("Right-click desktop → Configure Desktop\nto complete setup")
                horizontalAlignment: Text.AlignHCenter
                color: "white"
                opacity: 0.7
                Layout.alignment: Qt.AlignHCenter
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // Main plugin content (loaded only if plugin is available)
    // ═══════════════════════════════════════════════════════════════════════
    
    Loader {
        id: pluginLoader
        anchors.fill: parent
        active: false
        source: "ShaderSystem.qml"
    }

    Binding {
        target: pluginLoader.item
        property: "wallpaperConfig"
        value: main.effectiveConfiguration
        when: pluginLoader.item
    }
    Binding {
        target: pluginLoader.item
        property: "lockScreenMode"
        value: main.lockScreenMode
        when: pluginLoader.item
    }
    Binding {
        target: pluginLoader.item
        property: "loginScreenMode"
        value: main.loginScreenMode
        when: pluginLoader.item
    }
}
