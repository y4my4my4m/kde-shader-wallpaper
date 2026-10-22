// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Layouts
import org.kde.kirigamiaddons.formcard as FormCard

// FormHeader aligned with Card.
FormCard.FormHeader {
    Layout.fillWidth: true
    maximumWidth: Math.max(0, (parent ? parent.width : 0) - 2)
}
