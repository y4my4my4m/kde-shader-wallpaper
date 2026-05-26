// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

/**
 * Performance monitoring widget with real-time graph
 * Shows frame times, FPS, and power cost estimation
 */
Rectangle {
    id: root
    
    // Performance data (bind to ShaderEngine or PerformanceMonitor)
    property real currentFps: 60
    property real frameTime: 16.67
    property real averageFrameTime: 16.67
    property real minFrameTime: 16.67
    property real maxFrameTime: 16.67
    property int performanceTier: 1  // 0=Low, 1=Medium, 2=High, 3=Extreme
    property int powerCost: 50       // 0-100 scale
    
    // GPU power estimation
    // Typical GPU TDP values: 15W (integrated), 75W (low-end), 150W (mid-range), 250W (high-end)
    property int gpuTdp: 75  // Assumed GPU TDP in watts (can be configured)
    property int gpuIdlePower: 10  // Idle power draw in watts
    
    // Display options
    property bool expanded: true
    property bool showGraph: true
    property int historySize: 120
    
    // Calculate estimated power in watts based on frame time
    // Assumes shader is the primary GPU load
    readonly property real estimatedWatts: {
        if (averageFrameTime <= 0) return gpuIdlePower
        
        // Calculate GPU utilization based on frame time
        // Target is 16.67ms for 60fps - if we're using less, we're using less GPU
        var targetFrameTime = 1000.0 / 60.0  // 16.67ms
        var utilization = Math.min(1.0, averageFrameTime / targetFrameTime)
        
        // Add base overhead for just running a shader (minimum ~20% of idle difference)
        var shaderOverhead = 0.2
        
        // Interpolate between idle and TDP based on utilization
        var powerRange = gpuTdp - gpuIdlePower
        return gpuIdlePower + (powerRange * (shaderOverhead + utilization * (1 - shaderOverhead)))
    }
    
    // Estimate hourly energy cost in Wh
    readonly property real estimatedWhPerHour: estimatedWatts
    
    // Estimate daily cost (assuming 8 hours of usage)
    readonly property real estimatedKwhPerDay: (estimatedWatts * 8) / 1000.0
    
    // Frame time history for graph
    property var frameTimeHistory: []
    
    // Appearance
    color: "#CC1a1a2e"  // Dark semi-transparent
    radius: 8
    border.width: 1
    border.color: tierColor
    
    // Computed tier color
    readonly property color tierColor: {
        switch (performanceTier) {
            case 0: return "#27ae60"  // Green - Low demand
            case 1: return "#f1c40f"  // Yellow - Medium
            case 2: return "#e67e22"  // Orange - High
            case 3: return "#e74c3c"  // Red - Extreme
            default: return "#95a5a6" // Gray - Unknown
        }
    }
    
    readonly property string tierName: {
        switch (performanceTier) {
            case 0: return i18n("Low")
            case 1: return i18n("Medium")
            case 2: return i18n("High")
            case 3: return i18n("Extreme")
            default: return i18n("Unknown")
        }
    }
    
    readonly property string powerLabel: {
        if (powerCost < 20) return i18n("Very Low")
        if (powerCost < 40) return i18n("Low")
        if (powerCost < 60) return i18n("Medium")
        if (powerCost < 80) return i18n("High")
        return i18n("Very High")
    }
    
    implicitWidth: expanded ? 220 : 80
    implicitHeight: expanded ? (showGraph ? 160 : 120) : 32  // More height when graph is off to fit content
    
    Behavior on implicitWidth { NumberAnimation { duration: 200; easing.type: Easing.OutQuad } }
    Behavior on implicitHeight { NumberAnimation { duration: 200; easing.type: Easing.OutQuad } }
    
    // Add frame time to history
    function addFrameTime(time) {
        var history = frameTimeHistory.slice()
        history.push(time)
        while (history.length > historySize) {
            history.shift()
        }
        frameTimeHistory = history
        graphCanvas.requestPaint()
    }
    
    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 8
        spacing: 4
        visible: root.expanded  // Only show when expanded
        
        // Header row with toggle and main stats
        RowLayout {
            Layout.fillWidth: true
            spacing: 6
            
            // Performance tier indicator (colored dot)
            Rectangle {
                width: 12
                height: 12
                radius: 6
                color: root.tierColor
                
                // Pulse animation for high/extreme tiers
                SequentialAnimation on opacity {
                    running: root.performanceTier >= 2
                    loops: Animation.Infinite
                    NumberAnimation { to: 0.5; duration: 500 }
                    NumberAnimation { to: 1.0; duration: 500 }
                }
            }
            
            // FPS display
            Text {
                text: Math.round(root.currentFps) + " FPS"
                color: "white"
                font.bold: true
                font.pixelSize: 14
                font.family: "JetBrains Mono, Fira Code, monospace"
            }
            
            Item { Layout.fillWidth: true }
            
            // Expand/collapse button
            Button {
                flat: true
                icon.name: root.expanded ? "arrow-up" : "arrow-down"
                icon.width: 12
                icon.height: 12
                padding: 2
                implicitWidth: 20
                implicitHeight: 20
                onClicked: root.expanded = !root.expanded
                
                background: Rectangle {
                    color: parent.hovered ? "#40ffffff" : "transparent"
                    radius: 4
                }
            }
        }
        
        // Expanded content
        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true
            visible: root.expanded
            opacity: root.expanded ? 1.0 : 0.0
            
            Behavior on opacity { NumberAnimation { duration: 150 } }
            
            ColumnLayout {
                anchors.fill: parent
                spacing: 4
                
                // Frame time stats row
                RowLayout {
                    Layout.fillWidth: true
                    spacing: 8
                    
                    // Frame time
                    Column {
                        spacing: 0
                        
                        Text {
                            text: i18n("Frame")
                            color: "#aaa"
                            font.pixelSize: 9
                        }
                        Text {
                            text: root.frameTime.toFixed(2) + " ms"
                            color: "white"
                            font.pixelSize: 11
                            font.family: "JetBrains Mono, Fira Code, monospace"
                        }
                    }
                    
                    // Min/Avg/Max
                    Column {
                        spacing: 0
                        
                        Text {
                            text: i18n("Avg")
                            color: "#aaa"
                            font.pixelSize: 9
                        }
                        Text {
                            text: root.averageFrameTime.toFixed(2) + " ms"
                            color: root.tierColor
                            font.pixelSize: 11
                            font.family: "JetBrains Mono, Fira Code, monospace"
                        }
                    }
                    
                    // Range
                    Column {
                        spacing: 0
                        
                        Text {
                            text: i18n("Range")
                            color: "#aaa"
                            font.pixelSize: 9
                        }
                        Text {
                            text: root.minFrameTime.toFixed(1) + "-" + root.maxFrameTime.toFixed(1)
                            color: "#ccc"
                            font.pixelSize: 10
                            font.family: "JetBrains Mono, Fira Code, monospace"
                        }
                    }
                }
                
                // Power estimate display
                RowLayout {
                    Layout.fillWidth: true
                    spacing: 6
                    
                    // Power icon
                    Text {
                        text: "⚡"
                        font.pixelSize: 12
                    }
                    
                    Column {
                        spacing: 0
                        
                        Text {
                            text: i18n("Est. Power")
                            color: "#aaa"
                            font.pixelSize: 9
                        }
                        Text {
                            text: root.estimatedWatts.toFixed(1) + " W"
                            color: root.tierColor
                            font.pixelSize: 12
                            font.bold: true
                            font.family: "JetBrains Mono, Fira Code, monospace"
                        }
                    }
                    
                    // Power bar
                    Rectangle {
                        Layout.fillWidth: true
                        height: 8
                        radius: 4
                        color: "#30ffffff"
                        
                        Rectangle {
                            width: parent.width * Math.min(1.0, root.estimatedWatts / root.gpuTdp)
                            height: parent.height
                            radius: 4
                            
                            gradient: Gradient {
                                orientation: Gradient.Horizontal
                                GradientStop { position: 0.0; color: "#27ae60" }
                                GradientStop { position: 0.5; color: "#f1c40f" }
                                GradientStop { position: 1.0; color: "#e74c3c" }
                            }
                            
                            Behavior on width { NumberAnimation { duration: 300 } }
                        }
                    }
                    
                    Column {
                        spacing: 0
                        
                        Text {
                            text: i18n("Daily")
                            color: "#aaa"
                            font.pixelSize: 9
                        }
                        Text {
                            text: root.estimatedKwhPerDay.toFixed(2) + " kWh"
                            color: "#ccc"
                            font.pixelSize: 10
                            font.family: "JetBrains Mono, Fira Code, monospace"
                        }
                    }
                }
                
                // Frame time graph
                Rectangle {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    visible: root.showGraph
                    color: "#15ffffff"
                    radius: 4
                    
                    // Dynamic max time based on average performance
                    // Use smaller range for fast shaders to show more detail
                    property real graphMaxTime: {
                        if (root.averageFrameTime < 5) return 20.0   // For 200+ FPS shaders
                        if (root.averageFrameTime < 10) return 30.0  // For 100+ FPS shaders
                        return 50.0  // For slower shaders
                    }
                    
                    // 240 FPS line (4.17ms) - for high refresh rate monitors
                    Rectangle {
                        anchors.left: parent.left
                        anchors.right: parent.right
                        y: parent.height * (1 - 4.17 / parent.graphMaxTime)
                        height: 1
                        color: "#4027ae60"
                        visible: parent.graphMaxTime <= 20
                        
                        Text {
                            anchors.right: parent.right
                            anchors.bottom: parent.top
                            text: "240"
                            color: "#6027ae60"
                            font.pixelSize: 8
                        }
                    }
                    
                    // 120 FPS line (8.33ms)
                    Rectangle {
                        anchors.left: parent.left
                        anchors.right: parent.right
                        y: parent.height * (1 - 8.33 / parent.graphMaxTime)
                        height: 1
                        color: "#4027ae60"
                        visible: parent.graphMaxTime <= 30
                        
                        Text {
                            anchors.right: parent.right
                            anchors.bottom: parent.top
                            text: "120"
                            color: "#6027ae60"
                            font.pixelSize: 8
                        }
                    }
                    
                    // 60 FPS line (16.67ms)
                    Rectangle {
                        anchors.left: parent.left
                        anchors.right: parent.right
                        y: parent.height * (1 - 16.67 / parent.graphMaxTime)
                        height: 1
                        color: "#40f1c40f"
                        
                        Text {
                            anchors.right: parent.right
                            anchors.bottom: parent.top
                            text: "60"
                            color: "#60f1c40f"
                            font.pixelSize: 8
                        }
                    }
                    
                    // 30 FPS line (33.33ms)
                    Rectangle {
                        anchors.left: parent.left
                        anchors.right: parent.right
                        y: parent.height * (1 - 33.33 / parent.graphMaxTime)
                        height: 1
                        color: "#40e74c3c"
                        visible: parent.graphMaxTime >= 50
                        
                        Text {
                            anchors.right: parent.right
                            anchors.bottom: parent.top
                            text: "30"
                            color: "#60e74c3c"
                            font.pixelSize: 8
                        }
                    }
                    
                    // Graph canvas
                    Canvas {
                        id: graphCanvas
                        anchors.fill: parent
                        anchors.margins: 2
                        
                        property real maxTime: parent.graphMaxTime
                        
                        onPaint: {
                            var ctx = getContext("2d")
                            ctx.clearRect(0, 0, width, height)
                            
                            if (root.frameTimeHistory.length < 2) return
                            
                            var history = root.frameTimeHistory
                            
                            // Draw fill gradient
                            var gradient = ctx.createLinearGradient(0, 0, 0, height)
                            gradient.addColorStop(0, "rgba(231, 76, 60, 0.3)")
                            gradient.addColorStop(0.5, "rgba(241, 196, 15, 0.2)")
                            gradient.addColorStop(1, "rgba(39, 174, 96, 0.1)")
                            
                            ctx.beginPath()
                            ctx.moveTo(0, height)
                            
                            for (var i = 0; i < history.length; i++) {
                                var x = (i / (root.historySize - 1)) * width
                                var y = height - (Math.min(history[i], maxTime) / maxTime) * height
                                ctx.lineTo(x, y)
                            }
                            
                            ctx.lineTo(width, height)
                            ctx.closePath()
                            ctx.fillStyle = gradient
                            ctx.fill()
                            
                            // Draw line
                            ctx.beginPath()
                            ctx.moveTo(0, height - (Math.min(history[0], maxTime) / maxTime) * height)
                            
                            for (var j = 1; j < history.length; j++) {
                                var lx = (j / (root.historySize - 1)) * width
                                var ly = height - (Math.min(history[j], maxTime) / maxTime) * height
                                ctx.lineTo(lx, ly)
                            }
                            
                            ctx.strokeStyle = root.tierColor
                            ctx.lineWidth = 1.5
                            ctx.stroke()
                        }
                    }
                }
                
                // Tier label
                RowLayout {
                    Layout.fillWidth: true
                    
                    Text {
                        text: i18n("Demand:")
                        color: "#aaa"
                        font.pixelSize: 10
                    }
                    
                    Text {
                        text: root.tierName
                        color: root.tierColor
                        font.bold: true
                        font.pixelSize: 10
                    }
                    
                    Item { Layout.fillWidth: true }
                    
                    // Graph toggle
                    Button {
                        flat: true
                        icon.name: root.showGraph ? "view-visible" : "view-hidden"
                        icon.width: 10
                        icon.height: 10
                        padding: 2
                        implicitWidth: 18
                        implicitHeight: 18
                        onClicked: root.showGraph = !root.showGraph
                        
                        ToolTip.visible: hovered
                        ToolTip.text: root.showGraph ? i18n("Hide graph") : i18n("Show graph")
                        
                        background: Rectangle {
                            color: parent.hovered ? "#40ffffff" : "transparent"
                            radius: 3
                        }
                    }
                }
            }
        }
    }
    
    // Collapsed state - just show minimal info with expand button
    RowLayout {
        anchors.fill: parent
        anchors.margins: 6
        visible: !root.expanded
        spacing: 4
        
        Rectangle {
            width: 8
            height: 8
            radius: 4
            color: root.tierColor
        }
        
        Text {
            text: Math.round(root.currentFps)
            color: "white"
            font.bold: true
            font.pixelSize: 12
            font.family: "JetBrains Mono, Fira Code, monospace"
        }
        
        Text {
            text: "FPS"
            color: "#aaa"
            font.pixelSize: 10
        }
        
        Item { Layout.fillWidth: true }
        
        // Expand button in collapsed mode
        Button {
            flat: true
            icon.name: "arrow-down"
            icon.width: 10
            icon.height: 10
            padding: 2
            implicitWidth: 16
            implicitHeight: 16
            onClicked: root.expanded = true
            
            background: Rectangle {
                color: parent.hovered ? "#40ffffff" : "transparent"
                radius: 3
            }
        }
    }
    
    // Mouse area for drag (optional)
    MouseArea {
        anchors.fill: parent
        propagateComposedEvents: true
        cursorShape: Qt.ArrowCursor
        
        onClicked: (mouse) => {
            // Allow click through for buttons
            mouse.accepted = false
        }
    }
}

