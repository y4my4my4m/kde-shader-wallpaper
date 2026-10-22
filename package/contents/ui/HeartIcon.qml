// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Shapes

// Heart outline, or filled when `filled`. Path from Breeze's 16x16 "love"
// icon; the theme has no filled counterpart.
Item {
    id: heart

    property bool filled: false
    property color color: "black"

    implicitWidth: 16
    implicitHeight: 16

    Shape {
        width: 16
        height: 16
        scale: Math.min(heart.width, heart.height) / 16
        transformOrigin: Item.TopLeft
        x: (heart.width - 16 * scale) / 2
        y: (heart.height - 16 * scale) / 2
        // Geometry renderer has no edge antialiasing of its own.
        layer.enabled: true
        layer.samples: 4
        layer.smooth: true

        ShapePath {
            strokeWidth: -1
            fillColor: heart.color
            fillRule: ShapePath.OddEvenFill
            PathSvg {
                path: heart.filled
                    ? "M 4 2 C 2.343 2 1 3.343 1 5 C 1 9 6 12 8 14 C 10 12 15 9 15 5 C 15 3.343 13.657 2 12 2 C 9 2 8 4 8 4 C 8 4 7 2 4 2 z"
                    : "M 4 2 C 2.343 2 1 3.343 1 5 C 1 9 6 12 8 14 C 10 12 15 9 15 5 C 15 3.343 13.657 2 12 2 C 9 2 8 4 8 4 C 8 4 7 2 4 2 z "
                      + "M 4 3 C 5.719 2.987 6.636 3.858 7.336 5 L 8.627 5 C 9.444 3.748 10.628 3.016 12 3 C 13.117 3 14 3.883 14 5 "
                      + "C 14 6.583 12.964 8.122 11.543 9.543 C 10.358 10.728 9.076 11.709 8 12.67 C 6.924 11.709 5.642 10.728 4.457 9.543 "
                      + "C 3.036 8.122 2 6.583 2 5 C 2 3.883 2.883 3 4 3 z"
            }
        }
    }
}
