// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import org.kde.kirigami as Kirigami

// Gradient tile with three waves; fixed colours on any theme.
Rectangle {
    id: tile
    implicitWidth: Kirigami.Units.gridUnit * 4
    implicitHeight: implicitWidth
    radius: width / 4
    gradient: Gradient {
        GradientStop { position: 0.0; color: "#8a6bff" }
        GradientStop { position: 1.0; color: "#14b5c4" }
    }

    Canvas {
        anchors.fill: parent
        anchors.margins: parent.width * 0.2
        onWidthChanged: requestPaint()
        onHeightChanged: requestPaint()
        onPaint: {
            const ctx = getContext("2d")
            const w = width, h = height
            ctx.reset()
            ctx.lineCap = "round"
            ctx.lineWidth = Math.max(1.5, w * 0.085)
            ctx.strokeStyle = "white"
            const rows = [0.24, 0.5, 0.76]
            for (let r = 0; r < rows.length; r++) {
                ctx.globalAlpha = 1.0 - r * 0.25
                ctx.beginPath()
                const steps = 32
                for (let i = 0; i <= steps; i++) {
                    const t = i / steps
                    const x = ctx.lineWidth / 2 + t * (w - ctx.lineWidth)
                    const y = h * rows[r] + Math.sin(t * Math.PI * 2 + r * 0.9) * h * 0.09
                    if (i === 0) ctx.moveTo(x, y)
                    else ctx.lineTo(x, y)
                }
                ctx.stroke()
            }
        }
    }
}
