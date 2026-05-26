// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>
//
// Dev harness window for fast iteration on ShaderEngine.
// Runs via `qml6` (or `qml`) — no plasmashell needed.
// Use `scripts/dev.sh` to build, install to sandbox, and launch this file.

import QtCore
import QtQuick
import QtQuick.Controls
import QtQuick.Dialogs
import QtQuick.Layouts
import QtQuick.Window
import online.knowmad.shaderwallpaper

ApplicationWindow {
    id: harness

    width: 1280
    height: 760
    minimumWidth: 640
    minimumHeight: 480
    visible: true
    title: qsTr("Shader Wallpaper Dev Harness")

    // ===== Persistence (mimics KConfig) =====
    Settings {
        id: persistent
        category: "ShaderWallpaperDev"
        property string selectedShaderPath: ""
        property string selectedShaderCode: ""
        property real shaderSpeed: 1.0
        property int targetFps: 60
        property real resolutionScale: 1.0
        property bool running: true
        property bool mouseEnabled: false
        property real mouseBias: 1.0
        property bool audioEnabled: false
        property int audioChannel: 0
        property real audioSensitivity: 40.0
        property bool iChannel0Enabled: true
        property string iChannel0: ""
        property bool iChannel1Enabled: false
        property string iChannel1: ""
        property bool iChannel2Enabled: false
        property string iChannel2: ""
        property bool iChannel3Enabled: false
        property string iChannel3: ""
        property bool showPerformance: true
        property int sidebarWidth: 320
    }

    // ===== Where Shaders/ lives (sandbox install) =====
    // Set by scripts/dev.sh via SHADER_PACKAGE_PATH env var.
    property string packagePath: Qt.application.arguments.length > 1
        ? Qt.application.arguments[Qt.application.arguments.length - 1]
        : ""
    property url packageUrl: packagePath.length > 0
        ? Qt.resolvedUrl("file://" + packagePath + "/")
        : ""

    // ===== Status bar text helpers =====
    function fmtNum(v, digits) {
        return Number(v).toFixed(digits === undefined ? 2 : digits)
    }
    function basename(p) {
        if (!p) return ""
        var s = p.toString()
        var ix = s.lastIndexOf("/")
        return ix < 0 ? s : s.substring(ix + 1)
    }

    // ===== Header =====
    header: ToolBar {
        RowLayout {
            anchors.fill: parent
            spacing: 8

            Label {
                text: qsTr("Dev Harness")
                font.bold: true
                leftPadding: 12
            }
            ToolSeparator {}
            Label {
                text: qsTr("Shader:")
                opacity: 0.7
            }
            Label {
                text: persistent.selectedShaderPath
                    ? basename(persistent.selectedShaderPath)
                    : qsTr("<default gradient>")
                elide: Text.ElideMiddle
                Layout.maximumWidth: 320
            }
            Item { Layout.fillWidth: true }
            Label {
                text: qsTr("FPS: %1   t=%2s   frame=%3")
                    .arg(shaderEngine.currentFps)
                    .arg(fmtNum(shaderEngine.iTime, 1))
                    .arg(shaderEngine.iFrame)
                opacity: 0.7
            }
            ToolButton {
                text: shaderEngine.running ? qsTr("⏸ Pause") : qsTr("▶ Play")
                onClicked: persistent.running = !persistent.running
                ToolTip.visible: hovered
                ToolTip.text: qsTr("Space")
            }
            ToolButton {
                text: qsTr("↻ Reset")
                onClicked: shaderEngine.resetTime()
                ToolTip.visible: hovered
                ToolTip.text: qsTr("R")
            }
        }
    }

    // ===== Main layout: shader fills, controls on the right =====
    SplitView {
        anchors.fill: parent
        orientation: Qt.Horizontal

        ShaderEngine {
            id: shaderEngine
            SplitView.fillWidth: true
            SplitView.minimumWidth: 200

            shaderSource: persistent.selectedShaderPath.length > 0
                ? (persistent.selectedShaderPath.indexOf("://") >= 0
                    ? persistent.selectedShaderPath
                    : "file://" + persistent.selectedShaderPath)
                : ""
            shaderCode: persistent.selectedShaderCode
            running: persistent.running
            speed: persistent.shaderSpeed
            targetFps: persistent.targetFps
            resolutionScale: persistent.resolutionScale
            mouseEnabled: persistent.mouseEnabled
            mouseBias: persistent.mouseBias
            audioEnabled: persistent.audioEnabled
            audioChannel: persistent.audioChannel

            iChannel0Enabled: persistent.iChannel0Enabled
            iChannel1Enabled: persistent.iChannel1Enabled
            iChannel2Enabled: persistent.iChannel2Enabled
            iChannel3Enabled: persistent.iChannel3Enabled

            iChannel0: persistent.iChannel0Enabled && persistent.iChannel0
                ? "file://" + persistent.iChannel0 : ""
            iChannel1: persistent.iChannel1Enabled && persistent.iChannel1
                ? "file://" + persistent.iChannel1 : ""
            iChannel2: persistent.iChannel2Enabled && persistent.iChannel2
                ? "file://" + persistent.iChannel2 : ""
            iChannel3: persistent.iChannel3Enabled && persistent.iChannel3
                ? "file://" + persistent.iChannel3 : ""

            onHasErrorChanged: if (hasError) console.warn("[shader error]", errorMessage)

            FrameAnimation {
                running: persistent.mouseEnabled && shaderEngine.running
                onTriggered: {
                    if (!persistent.mouseEnabled) return
                    var bias = persistent.mouseBias
                    var mx = shaderEngine.iMouse.x
                    var my = shaderEngine.iMouse.y
                    // MouseArea updates iMouse on move; FrameAnimation keeps
                    // iMousePrev advancing every frame for buffer feedback shaders.
                    shaderEngine.iMouse = Qt.vector4d(
                        mx, my,
                        shaderEngine.iMouse.z,
                        shaderEngine.iMouse.w)
                }
            }

            MouseArea {
                anchors.fill: parent
                acceptedButtons: Qt.LeftButton | Qt.RightButton
                hoverEnabled: persistent.mouseEnabled
                onPositionChanged: function(m) {
                    if (!persistent.mouseEnabled) return
                    var bias = persistent.mouseBias
                    shaderEngine.iMouse = Qt.vector4d(
                        m.x * bias,
                        (parent.height - m.y) * bias,
                        shaderEngine.iMouse.z,
                        shaderEngine.iMouse.w)
                }
                onPressed: function(m) {
                    if (!persistent.mouseEnabled) return
                    shaderEngine.iMouse = Qt.vector4d(
                        m.x, parent.height - m.y, m.x, parent.height - m.y)
                }
                onReleased: {
                    if (!persistent.mouseEnabled) return
                    shaderEngine.iMouse = Qt.vector4d(
                        shaderEngine.iMouse.x,
                        shaderEngine.iMouse.y,
                        -Math.abs(shaderEngine.iMouse.z),
                        -Math.abs(shaderEngine.iMouse.w))
                }
            }
        }

        Pane {
            id: sidebar
            SplitView.preferredWidth: persistent.sidebarWidth
            SplitView.minimumWidth: 240
            padding: 12

            ScrollView {
                anchors.fill: parent
                clip: true
                contentWidth: availableWidth

                ColumnLayout {
                    width: parent.availableWidth
                    spacing: 10

                    GroupBox {
                        title: qsTr("Shader source")
                        Layout.fillWidth: true
                        ColumnLayout {
                            anchors.fill: parent
                            RowLayout {
                                Layout.fillWidth: true
                                Button {
                                    text: qsTr("Open .frag…")
                                    onClicked: shaderFileDialog.open()
                                }
                                Button {
                                    text: qsTr("Clear")
                                    enabled: persistent.selectedShaderPath.length > 0
                                        || persistent.selectedShaderCode.length > 0
                                    onClicked: {
                                        persistent.selectedShaderPath = ""
                                        persistent.selectedShaderCode = ""
                                    }
                                }
                            }
                            Label {
                                Layout.fillWidth: true
                                wrapMode: Text.Wrap
                                text: persistent.selectedShaderPath
                                    ? basename(persistent.selectedShaderPath)
                                    : qsTr("Using built-in default")
                                font.italic: true
                                opacity: 0.7
                            }
                            Button {
                                Layout.fillWidth: true
                                text: qsTr("Browse bundled shaders…")
                                enabled: packagePath.length > 0
                                onClicked: bundledShaderDialog.open()
                            }
                            Label {
                                visible: packagePath.length === 0
                                Layout.fillWidth: true
                                wrapMode: Text.Wrap
                                color: "tomato"
                                font.italic: true
                                text: qsTr("Tip: launch via scripts/dev.sh to enable bundled-shader browsing.")
                            }
                        }
                    }

                    GroupBox {
                        title: qsTr("Playback")
                        Layout.fillWidth: true
                        ColumnLayout {
                            anchors.fill: parent
                            RowLayout {
                                Layout.fillWidth: true
                                Label { text: qsTr("Speed"); Layout.preferredWidth: 80 }
                                Slider {
                                    Layout.fillWidth: true
                                    from: -5.0; to: 5.0; stepSize: 0.05
                                    value: persistent.shaderSpeed
                                    onMoved: persistent.shaderSpeed = value
                                }
                                Label { text: fmtNum(persistent.shaderSpeed); Layout.preferredWidth: 40 }
                            }
                            RowLayout {
                                Layout.fillWidth: true
                                Label { text: qsTr("Target FPS"); Layout.preferredWidth: 80 }
                                Slider {
                                    Layout.fillWidth: true
                                    from: 5; to: 240; stepSize: 1
                                    value: persistent.targetFps
                                    onMoved: persistent.targetFps = Math.round(value)
                                }
                                Label { text: persistent.targetFps; Layout.preferredWidth: 40 }
                            }
                            RowLayout {
                                Layout.fillWidth: true
                                Label { text: qsTr("Resolution"); Layout.preferredWidth: 80 }
                                Slider {
                                    Layout.fillWidth: true
                                    from: 0.25; to: 2.0; stepSize: 0.05
                                    value: persistent.resolutionScale
                                    onMoved: persistent.resolutionScale = value
                                }
                                Label {
                                    text: Math.round(persistent.resolutionScale * 100) + "%"
                                    Layout.preferredWidth: 40
                                }
                            }
                        }
                    }

                    GroupBox {
                        title: qsTr("Mouse")
                        Layout.fillWidth: true
                        ColumnLayout {
                            anchors.fill: parent
                            CheckBox {
                                text: qsTr("Enable iMouse")
                                checked: persistent.mouseEnabled
                                onToggled: persistent.mouseEnabled = checked
                            }
                            RowLayout {
                                Layout.fillWidth: true
                                visible: persistent.mouseEnabled
                                Label { text: qsTr("Bias"); Layout.preferredWidth: 80 }
                                Slider {
                                    Layout.fillWidth: true
                                    from: 0.1; to: 5.0; stepSize: 0.05
                                    value: persistent.mouseBias
                                    onMoved: persistent.mouseBias = value
                                }
                                Label {
                                    text: fmtNum(persistent.mouseBias)
                                    Layout.preferredWidth: 40
                                }
                            }
                        }
                    }

                    GroupBox {
                        title: qsTr("iChannels")
                        Layout.fillWidth: true
                        ColumnLayout {
                            anchors.fill: parent
                            Repeater {
                                model: 4
                                delegate: RowLayout {
                                    Layout.fillWidth: true
                                    property int idx: index
                                    CheckBox {
                                        text: "iChannel" + idx
                                        checked: harness.channelEnabledAt(idx)
                                        onToggled: harness.setChannelEnabled(idx, checked)
                                    }
                                    Item { Layout.fillWidth: true }
                                    Button {
                                        text: qsTr("…")
                                        ToolTip.visible: hovered
                                        ToolTip.text: harness.channelPathAt(idx) || qsTr("Select texture")
                                        onClicked: {
                                            channelTextureDialog.currentChannel = idx
                                            channelTextureDialog.open()
                                        }
                                    }
                                }
                            }
                        }
                    }

                    GroupBox {
                        title: qsTr("Audio")
                        Layout.fillWidth: true
                        ColumnLayout {
                            anchors.fill: parent
                            CheckBox {
                                text: qsTr("Enable audio")
                                checked: persistent.audioEnabled
                                onToggled: persistent.audioEnabled = checked
                            }
                        }
                    }

                    GroupBox {
                        title: qsTr("Diagnostics")
                        Layout.fillWidth: true
                        ColumnLayout {
                            anchors.fill: parent
                            Label {
                                Layout.fillWidth: true
                                wrapMode: Text.Wrap
                                font.family: "monospace"
                                font.pointSize: 9
                                text: qsTr("avg %1ms · min %2ms · max %3ms")
                                    .arg(fmtNum(shaderEngine.averageFrameTime))
                                    .arg(fmtNum(shaderEngine.minFrameTime))
                                    .arg(fmtNum(shaderEngine.maxFrameTime))
                            }
                            Label {
                                visible: shaderEngine.hasError
                                Layout.fillWidth: true
                                wrapMode: Text.Wrap
                                color: "tomato"
                                text: shaderEngine.errorMessage
                            }
                            Button {
                                Layout.fillWidth: true
                                text: qsTr("Reset all dev settings")
                                onClicked: harness.resetSettings()
                            }
                        }
                    }

                    Label {
                        Layout.fillWidth: true
                        wrapMode: Text.Wrap
                        opacity: 0.55
                        font.italic: true
                        text: qsTr("Shortcuts: Space=play/pause, R=reset time, Ctrl+Q=quit")
                    }
                }
            }
        }
        onResizingChanged: if (!resizing) persistent.sidebarWidth = sidebar.width
    }

    // ===== Dialogs =====
    FileDialog {
        id: shaderFileDialog
        title: qsTr("Open shader file")
        nameFilters: ["Shader files (*.frag *.glsl)", "All files (*)"]
        onAccepted: {
            var p = selectedFile.toString().replace(/^file:\/\//, "")
            persistent.selectedShaderPath = p
            persistent.selectedShaderCode = ""
        }
    }

    FileDialog {
        id: bundledShaderDialog
        title: qsTr("Pick a bundled shader")
        nameFilters: ["Shader files (*.frag)", "All files (*)"]
        currentFolder: packagePath.length > 0
            ? "file://" + packagePath + "/contents/ui/Shaders"
            : ""
        onAccepted: {
            var p = selectedFile.toString().replace(/^file:\/\//, "")
            persistent.selectedShaderPath = p
            persistent.selectedShaderCode = ""
        }
    }

    FileDialog {
        id: channelTextureDialog
        property int currentChannel: 0
        title: qsTr("Pick texture")
        nameFilters: ["Image files (*.png *.jpg *.jpeg *.webp)", "All files (*)"]
        onAccepted: {
            var p = selectedFile.toString().replace(/^file:\/\//, "")
            harness.setChannelPath(currentChannel, p)
            harness.setChannelEnabled(currentChannel, true)
        }
    }

    // ===== Channel helpers =====
    function channelEnabledAt(idx) {
        if (idx === 0) return persistent.iChannel0Enabled
        if (idx === 1) return persistent.iChannel1Enabled
        if (idx === 2) return persistent.iChannel2Enabled
        if (idx === 3) return persistent.iChannel3Enabled
        return false
    }
    function setChannelEnabled(idx, on) {
        if (idx === 0) persistent.iChannel0Enabled = on
        else if (idx === 1) persistent.iChannel1Enabled = on
        else if (idx === 2) persistent.iChannel2Enabled = on
        else if (idx === 3) persistent.iChannel3Enabled = on
    }
    function channelPathAt(idx) {
        if (idx === 0) return persistent.iChannel0
        if (idx === 1) return persistent.iChannel1
        if (idx === 2) return persistent.iChannel2
        if (idx === 3) return persistent.iChannel3
        return ""
    }
    function setChannelPath(idx, p) {
        if (idx === 0) persistent.iChannel0 = p
        else if (idx === 1) persistent.iChannel1 = p
        else if (idx === 2) persistent.iChannel2 = p
        else if (idx === 3) persistent.iChannel3 = p
    }

    function resetSettings() {
        persistent.selectedShaderPath = ""
        persistent.selectedShaderCode = ""
        persistent.shaderSpeed = 1.0
        persistent.targetFps = 60
        persistent.resolutionScale = 1.0
        persistent.running = true
        persistent.mouseEnabled = false
        persistent.mouseBias = 1.0
        persistent.audioEnabled = false
        persistent.audioChannel = 0
        persistent.iChannel0Enabled = true
        persistent.iChannel1Enabled = false
        persistent.iChannel2Enabled = false
        persistent.iChannel3Enabled = false
        persistent.iChannel0 = ""
        persistent.iChannel1 = ""
        persistent.iChannel2 = ""
        persistent.iChannel3 = ""
    }

    // ===== Keyboard shortcuts =====
    Shortcut {
        sequence: "Space"
        onActivated: persistent.running = !persistent.running
    }
    Shortcut {
        sequence: "R"
        onActivated: shaderEngine.resetTime()
    }
    Shortcut {
        sequence: "Ctrl+Q"
        onActivated: Qt.quit()
    }

    Component.onCompleted: {
        console.log("[harness] package path:", packagePath || "(none)")
        console.log("[harness] qml args:", Qt.application.arguments.join(" "))
    }
}
