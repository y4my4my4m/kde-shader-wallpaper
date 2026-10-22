// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import QtQuick.Window
import org.kde.kirigami as Kirigami
import org.kde.kirigamiaddons.formcard as FormCard

TabScroll {
    id: tab

    required property var root
    maximumContentWidth: root.formMaxWidth

    // Unlock states start from the stored value; a click hands them to the
    // user (the assignment replaces the binding).
    property bool reverseAllowed: root.cfg_shaderSpeed < 0
    property bool extremeScaleAllowed: root.cfg_resolutionScale > 2.0

    // ── Playback ──────────────────────────────────────────────────────────
    Header { title: i18n("Playback") }
    Card {
        FormCard.FormSwitchDelegate {
            text: i18n("Animate the wallpaper")
            description: i18n("Off freezes the current frame and stops all GPU work.")
            checked: tab.root.cfg_running
            onToggled: tab.root.cfg_running = checked
        }
        FormCard.FormDelegateSeparator {}
        SliderDelegate {
            id: speedSlider
            label: i18n("Speed")
            from: tab.reverseAllowed ? -3 : 0
            to: 3
            stepSize: 0.05
            value: tab.root.cfg_shaderSpeed
            formatValue: function(v) { return i18nc("@info playback speed multiplier", "%1×", Number(v).toFixed(2)) }
            onMoved: function(v) { tab.root.cfg_shaderSpeed = Math.round(v * 100) / 100 }
        }
        FormCard.FormCheckDelegate {
            text: i18n("Allow reverse playback")
            checked: tab.reverseAllowed
            onToggled: {
                tab.reverseAllowed = checked
                if (!checked && tab.root.cfg_shaderSpeed < 0)
                    tab.root.cfg_shaderSpeed = -tab.root.cfg_shaderSpeed
            }
        }
        FormCard.FormDelegateSeparator {}

        FormCard.FormComboBoxDelegate {
            id: fpsCombo
            objectName: "fpsCombo"
            text: i18n("Frame rate")
            description: i18n("Higher is smoother and uses more power.")
            readonly property int monitorRate: {
                const w = tab.Window.window
                const r = w && w.screen ? Math.round(w.screen.refreshRate) : 0
                return r > 0 ? r : 60
            }
            readonly property var presets: [30, 60, 120, 144, 240]
            property bool customChosen: false
            textRole: "text"
            valueRole: "value"
            model: presets.map(function(v) { return { text: i18n("%1 fps", v), value: v } })
                .concat([{ text: i18n("Monitor refresh rate (%1 Hz)", monitorRate), value: -1 },
                         { text: i18n("Custom"), value: -2 }])
            currentIndex: {
                if (customChosen) return presets.length + 1
                const i = presets.indexOf(tab.root.cfg_targetFps)
                if (i >= 0) return i
                if (tab.root.cfg_targetFps === monitorRate) return presets.length
                return presets.length + 1
            }
            onActivated: function(index) {
                customChosen = index === presets.length + 1
                if (index < presets.length) tab.root.cfg_targetFps = presets[index]
                else if (index === presets.length) tab.root.cfg_targetFps = monitorRate
            }
        }
        SpinBoxDelegate {
            visible: fpsCombo.currentIndex === fpsCombo.presets.length + 1
            label: i18n("Custom frame rate (fps)")
            from: 1
            to: 500
            value: tab.root.cfg_targetFps
            onValueModified: function(v) { tab.root.cfg_targetFps = v }
        }
        FormCard.FormDelegateSeparator {}

        FormCard.FormComboBoxDelegate {
            id: scaleCombo
            text: i18n("Render resolution")
            description: i18n("Lower is faster, higher is sharper.")
            readonly property var presets: [0.5, 0.75, 1.0, 1.5, 2.0]
            property bool customChosen: false
            textRole: "text"
            valueRole: "value"
            model: presets.map(function(v) {
                return { text: v === 1.0 ? i18n("100 % (native)") : i18n("%1 %", Math.round(v * 100)), value: v }
            }).concat([{ text: i18n("Custom"), value: -1 }])
            currentIndex: {
                if (customChosen) return presets.length
                for (let i = 0; i < presets.length; i++)
                    if (Math.abs(tab.root.cfg_resolutionScale - presets[i]) < 0.001) return i
                return presets.length
            }
            onActivated: function(index) {
                customChosen = index === presets.length
                if (index < presets.length) tab.root.cfg_resolutionScale = presets[index]
            }
        }
        SpinBoxDelegate {
            visible: scaleCombo.currentIndex === scaleCombo.presets.length
            label: i18n("Custom resolution (%)")
            from: 5
            to: tab.extremeScaleAllowed ? 400 : 200
            stepSize: 5
            value: Math.round(tab.root.cfg_resolutionScale * 100)
            onValueModified: function(v) { tab.root.cfg_resolutionScale = v / 100 }
        }
        FormCard.FormCheckDelegate {
            visible: scaleCombo.currentIndex === scaleCombo.presets.length
            text: i18n("Allow up to 400 %")
            description: i18n("Supersampling above 200 % multiplies GPU load.")
            checked: tab.extremeScaleAllowed
            onToggled: {
                tab.extremeScaleAllowed = checked
                if (!checked && tab.root.cfg_resolutionScale > 2.0) tab.root.cfg_resolutionScale = 2.0
            }
        }
    }

    // ── Pause ─────────────────────────────────────────────────────────────
    Header { title: i18n("Pause") }
    Card {
        FormCard.FormComboBoxDelegate {
            text: i18n("Pause when")
            model: [
                i18n("A window is maximized or full screen"),
                i18n("Any window is focused"),
                i18n("Any window is open"),
                i18n("Never")
            ]
            currentIndex: Math.max(0, Math.min(3, tab.root.cfg_pauseMode))
            onActivated: function(index) { tab.root.cfg_pauseMode = index }
            description: {
                switch (tab.root.cfg_pauseMode) {
                case 1:
                case 2:
                    return i18n("Saves the most power. This Settings window counts as a window too, so the desktop pauses while it is in front.")
                case 3:
                    return i18n("The shader always runs, even behind other windows.")
                default:
                    return i18n("Saves power when the desktop is covered.")
                }
            }
        }
        FormCard.FormSwitchDelegate {
            text: i18n("Only count windows on this screen")
            checked: tab.root.cfg_checkActiveScreen
            enabled: tab.root.cfg_pauseMode !== 3
            onToggled: tab.root.cfg_checkActiveScreen = checked
        }
        FormCard.FormSwitchDelegate {
            text: i18n("Show a “Paused” badge on the desktop")
            checked: tab.root.cfg_showPauseIndicator
            enabled: tab.root.cfg_pauseMode !== 3
            onToggled: tab.root.cfg_showPauseIndicator = checked
        }
        FormCard.FormDelegateSeparator {}
        FormCard.FormTextDelegate {
            text: i18n("Ignored applications")
            description: (tab.root.cfg_excludeWindows || []).length > 0
                ? i18n("Windows of these applications never pause the wallpaper.")
                : i18n("None. Windows of applications listed here never pause the wallpaper.")
        }
        Repeater {
            model: tab.root.cfg_excludeWindows || []
            delegate: FormCard.FormTextDelegate {
                required property string modelData
                required property int index
                leading: Kirigami.Icon {
                    source: modelData
                    fallback: "application-x-executable"
                    implicitWidth: Kirigami.Units.iconSizes.smallMedium
                    implicitHeight: Kirigami.Units.iconSizes.smallMedium
                }
                text: modelData
                trailing: QQC2.ToolButton {
                    icon.name: "list-remove"
                    display: QQC2.AbstractButton.IconOnly
                    text: i18n("Remove %1", modelData)
                    QQC2.ToolTip.text: text
                    QQC2.ToolTip.visible: hovered
                    onClicked: {
                        const list = Array.prototype.slice.call(tab.root.cfg_excludeWindows || [])
                        list.splice(index, 1)
                        tab.root.cfg_excludeWindows = list
                    }
                }
            }
        }
        FormCard.FormTextFieldDelegate {
            id: excludeField
            label: i18n("Add application")
            placeholderText: i18n("Application id, e.g. org.kde.konsole")
            function addEntry() {
                const id = text.trim().replace(/\.desktop$/, "")
                if (id.length === 0) return
                const list = Array.prototype.slice.call(tab.root.cfg_excludeWindows || [])
                if (list.indexOf(id) < 0) {
                    list.push(id)
                    tab.root.cfg_excludeWindows = list
                }
                clear()
            }
            onAccepted: addEntry()
            trailing: QQC2.Button {
                icon.name: "list-add"
                text: i18n("Add")
                enabled: excludeField.text.trim().length > 0
                onClicked: excludeField.addEntry()
            }
        }
    }

    // ── Automatic shader changes ──────────────────────────────────────────
    Header { title: i18n("Change Shader Automatically") }
    Card {
        FormCard.FormSwitchDelegate {
            text: i18n("Change shader automatically")
            description: i18n("Switches to another shader on a timer.")
            checked: tab.root.cfg_playlistEnabled
            onToggled: tab.root.cfg_playlistEnabled = checked
        }
        SpinBoxDelegate {
            visible: tab.root.cfg_playlistEnabled
            label: i18n("Every (minutes)")
            from: 1
            to: 1440
            value: tab.root.cfg_playlistIntervalMinutes
            onValueModified: function(v) { tab.root.cfg_playlistIntervalMinutes = v }
        }
        FormCard.FormComboBoxDelegate {
            visible: tab.root.cfg_playlistEnabled
            text: i18n("Pick from")
            model: [
                i18np("Playlist (%1 shader)", "Playlist (%1 shaders)", (tab.root.cfg_playlistShaders || []).length),
                i18n("Favourites"),
                i18n("All shaders")
            ]
            currentIndex: Math.max(0, Math.min(2, tab.root.cfg_playlistSource))
            onActivated: function(index) { tab.root.cfg_playlistSource = index }
        }
        FormCard.FormComboBoxDelegate {
            visible: tab.root.cfg_playlistEnabled
            text: i18n("Order")
            model: [i18n("Random"), i18n("In order")]
            currentIndex: tab.root.cfg_playlistShuffle ? 0 : 1
            onActivated: function(index) { tab.root.cfg_playlistShuffle = index === 0 }
        }
        FormCard.FormButtonDelegate {
            icon.name: "view-media-playlist"
            text: i18n("Manage playlist…")
            description: (tab.root.cfg_playlistShaders || []).length === 0
                ? i18n("Empty. Add shaders from the gallery’s context menu or here.")
                : i18np("%1 shader", "%1 shaders", (tab.root.cfg_playlistShaders || []).length)
            onClicked: tab.root.openPlaylist()
        }
        FormCard.FormTextDelegate {
            visible: tab.root.cfg_playlistEnabled && tab.root.cfg_playlistSource === 0
                     && (tab.root.cfg_playlistShaders || []).length < 2
            leading: Kirigami.Icon {
                source: "dialog-warning"
                implicitWidth: Kirigami.Units.iconSizes.smallMedium
                implicitHeight: Kirigami.Units.iconSizes.smallMedium
            }
            text: i18n("Add at least two shaders to the playlist, or pick from Favourites or All shaders.")
            textItem.wrapMode: Text.WordWrap
        }
    }
}
