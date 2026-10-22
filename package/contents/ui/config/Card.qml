// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Layouts
import org.kde.kirigamiaddons.formcard as FormCard

// FormCard filling its TabScroll column. The cap sits 2 px under the
// column width so FormCard keeps its rounded, bordered desktop style.
FormCard.FormCard {
    Layout.fillWidth: true
    maximumWidth: Math.max(0, (parent ? parent.width : 0) - 2)
}
