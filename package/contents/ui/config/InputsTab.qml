// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import org.kde.kirigamiaddons.formcard as FormCard

TabScroll {
    id: tab

    required property var root
    maximumContentWidth: root.formMaxWidth

    Header { title: i18n("Interaction") }
    Card {
        FormCard.FormSwitchDelegate {
            text: i18n("Follow mouse")
            description: tab.root.shaderUsage.mouse
                ? i18n("This shader uses the cursor position (iMouse).")
                : i18n("Sends the cursor position to the shader (iMouse). This shader does not use it.")
            checked: tab.root.cfg_mouseEnabled
            onToggled: tab.root.cfg_mouseEnabled = checked
        }
        SliderDelegate {
            visible: tab.root.cfg_mouseEnabled
            label: i18n("Mouse sensitivity")
            from: 0.1
            to: 5.0
            stepSize: 0.05
            value: tab.root.cfg_mouseBias
            formatValue: function(v) { return i18nc("@info multiplier", "%1×", Number(v).toFixed(2)) }
            onMoved: function(v) { tab.root.cfg_mouseBias = Math.round(v * 100) / 100 }
        }
        FormCard.FormDelegateSeparator {}
        FormCard.FormSwitchDelegate {
            text: i18n("React to sound")
            description: tab.root.shaderUsage.audio
                ? i18n("This shader listens to what your computer plays (PipeWire), as a spectrum texture.")
                : i18n("Captures what your computer plays (PipeWire) as a spectrum texture. This shader does not read it.")
            checked: tab.root.cfg_audioEnabled
            onToggled: tab.root.cfg_audioEnabled = checked
        }
        SliderDelegate {
            visible: tab.root.cfg_audioEnabled
            label: i18n("Sound sensitivity")
            from: 1
            to: 100
            stepSize: 1
            value: tab.root.cfg_audioSensitivity
            formatValue: function(v) { return Math.round(v).toString() }
            onMoved: function(v) { tab.root.cfg_audioSensitivity = Math.round(v) }
        }
        FormCard.FormComboBoxDelegate {
            visible: tab.root.cfg_audioEnabled && !tab.root.routesAudio
            text: i18n("Spectrum input")
            description: i18n("The shader input that receives the sound spectrum. Routing set on the Advanced tab takes precedence.")
            model: [0, 1, 2, 3].map(function(i) { return i18nc("@item:inlistbox shader input number", "Input %1", i) })
            currentIndex: Math.max(0, Math.min(3, tab.root.cfg_audioChannel))
            onActivated: function(index) { tab.root.cfg_audioChannel = index }
        }
        FormCard.FormDelegateSeparator {}
        FormCard.FormSwitchDelegate {
            text: i18n("React to windows")
            description: tab.root.shaderUsage.window
                ? i18n("This shader reacts to window positions and movement (iWindowRects).")
                : i18n("Sends window positions and movement to the shader (iWindowRects). This shader does not use them.")
            checked: tab.root.cfg_windowsEnabled
            onToggled: tab.root.cfg_windowsEnabled = checked
        }
    }

    Header { title: i18n("Images") }
    Card {
        FormCard.FormTextDelegate {
            text: i18n("Pictures the shader can sample (iChannel textures). Drop an image file on a row to use it.")
            textItem.wrapMode: Text.WordWrap
            textItem.color: Kirigami.Theme.disabledTextColor
        }
        Repeater {
            model: 4
            delegate: ImageSlotDelegate {
                required property int index
                root: tab.root
                slot: index
            }
        }
    }
}
