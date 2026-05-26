// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import "shaderwallpaper" as ShaderPlugin

// Root MUST be a ColumnLayout (not Item) so it participates in Plasma's
// wallpaper-config page layout and gets a real width from
// ConfigurationContainmentAppearance.qml's outer ColumnLayout
// (width: appearanceRoot.availableWidth). With Item, we sit at our
// implicitWidth (~480 px) regardless of how wide the dialog is — which
// is what produced the "tiny scrollbar in a narrow column" symptom.
ColumnLayout {
    id: configRoot

    Layout.fillWidth: true
    Layout.fillHeight: true

    // Check if the C++ plugin is installed
    ShaderPlugin.PluginStatus { id: pluginStatus }

    // Conditionally load the appropriate UI:
    // - SetupWizard.qml when plugin is NOT installed
    // - ConfigContent.qml when plugin IS installed
    Loader {
        id: loader
        Layout.fillWidth: true
        Layout.fillHeight: true
        source: pluginStatus.installed ? "ConfigContent.qml" : "SetupWizard.qml"

        // Show a brief loading indicator while the loader is working
        BusyIndicator {
            anchors.centerIn: parent
            visible: parent.status === Loader.Loading
            running: visible
        }
    }
}
