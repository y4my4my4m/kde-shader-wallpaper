// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import org.kde.kirigamiaddons.formcard as FormCard
import ".."

TabScroll {
    id: tab

    required property var root
    maximumContentWidth: root.formMaxWidth

    // ── Passes and inputs ─────────────────────────────────────────────────
    Header { title: i18n("Render Passes and Inputs") }
    Card {
        FormCard.AbstractFormDelegate {
            background: null
            focusPolicy: Qt.NoFocus
            contentItem: ColumnLayout {
                spacing: Kirigami.Units.smallSpacing
                QQC2.Label {
                    Layout.fillWidth: true
                    text: i18n("Buffers are extra passes that keep their result between frames, for feedback effects and simulations.")
                    wrapMode: Text.WordWrap
                    color: Kirigami.Theme.disabledTextColor
                    font: Kirigami.Theme.smallFont
                }
                Flow {
                    Layout.fillWidth: true
                    spacing: Kirigami.Units.largeSpacing
                    Repeater {
                        model: ["A", "B", "C", "D"]
                        delegate: QQC2.CheckBox {
                            required property string modelData
                            text: i18n("Buffer %1", modelData)
                            checked: tab.root["cfg_useBuffer" + modelData] === true
                            onToggled: tab.root["cfg_useBuffer" + modelData] = checked
                        }
                    }
                }
            }
        }
        FormCard.FormDelegateSeparator {}
        RoutingTable {
            root: tab.root
        }
        FormCard.FormDelegateSeparator {}
        FormCard.FormButtonDelegate {
            icon.name: "edit-reset"
            text: i18n("Reset inputs to shader defaults")
            description: i18n("Uses the routing the shader declares, or the standard multi-pass layout.")
            onClicked: tab.root.resetRoutingToShaderDefaults()
        }
    }

    // ── Code ──────────────────────────────────────────────────────────────
    Header { title: i18n("Code") }
    Card {
        FormCard.FormButtonDelegate {
            icon.name: "document-edit"
            text: i18n("Edit shader code…")
            description: tab.root.isEdited
                ? i18n("Running an edited copy. The file on disk is unchanged.")
                : i18n("Edit the image pass, common code and buffers. Edits apply to a copy; the file on disk is never changed.")
            onClicked: tab.root.openCodeEditor()
        }
        FormCard.FormButtonDelegate {
            visible: tab.root.isEdited
            icon.name: "edit-undo"
            text: i18n("Revert to original file")
            onClicked: tab.root.revertToFile()
        }
        FormCard.FormButtonDelegate {
            icon.name: "document-save-as"
            text: i18n("Save as package…")
            description: i18n("Bundles the shader, its buffers and input routing into a folder in your library.")
            enabled: tab.root.fileBacked || tab.root.inlineOverride
            onClicked: tab.root.openSavePackage()
        }
        FormCard.FormSwitchDelegate {
            text: i18n("Reload when the file changes")
            description: i18n("Watches the shader file and its buffer files on disk and reloads them when you save in another editor.")
            checked: tab.root.cfg_watchSourceFile
            onToggled: tab.root.cfg_watchSourceFile = checked
        }
    }

    // ── Presets ───────────────────────────────────────────────────────────
    Header { title: i18n("Presets") }
    Card {
        FormCard.AbstractFormDelegate {
            background: null
            focusPolicy: Qt.NoFocus
            contentItem: PresetPanel {
                root: tab.root
            }
        }
    }

    // ── Rendering ─────────────────────────────────────────────────────────
    Header { title: i18n("Rendering") }
    Card {
        FormCard.FormComboBoxDelegate {
            text: i18n("Simulation resolution")
            description: i18n("Height of the buffer passes. Lower makes simulations coarser and cheaper.")
            // 16384 exceeds any output height: buffers stay native even
            // when the shader asks for a cap.
            readonly property var heights: [0, 360, 540, 720, 1080, 16384]
            model: [
                i18n("Automatic (shader decides)"),
                i18n("360 px"), i18n("540 px"), i18n("720 px"), i18n("1080 px"),
                i18n("Native")
            ]
            currentIndex: {
                const i = heights.indexOf(tab.root.cfg_bufferSimulationMaxHeight)
                return i >= 0 ? i : 0
            }
            onActivated: function(index) { tab.root.cfg_bufferSimulationMaxHeight = heights[index] }
        }
        FormCard.FormSwitchDelegate {
            text: i18n("Reduce colour banding")
            description: i18n("Adds imperceptible noise to smooth gradients.")
            checked: tab.root.cfg_dither
            onToggled: tab.root.cfg_dither = checked
        }
        FormCard.FormSwitchDelegate {
            text: i18n("High dynamic range pipeline")
            description: i18n("Renders through 16-bit float buffers so bright values and fine gradients survive. Plasma still shows the desktop in SDR; uses more video memory.")
            checked: tab.root.cfg_experimentalHdrPipeline
            onToggled: tab.root.cfg_experimentalHdrPipeline = checked
        }
    }

    // ── Experimental ──────────────────────────────────────────────────────
    Header { title: i18n("Experimental") }
    Card {
        FormCard.FormSwitchDelegate {
            text: i18n("Span all screens")
            description: i18n("Tells the shader where this screen sits among all screens (iScreenOffset, iScreenIndex, iScreenCount), so one shader can cover every monitor as a single canvas.")
            checked: tab.root.cfg_experimentalScreenUniforms
            onToggled: tab.root.cfg_experimentalScreenUniforms = checked
        }
        FormCard.FormSwitchDelegate {
            text: i18n("Virtual desktop number")
            description: i18n("Tells the shader which virtual desktop is shown (iVirtualDesktop, iVirtualDesktopCount).")
            checked: tab.root.cfg_experimentalDesktopUniform
            onToggled: tab.root.cfg_experimentalDesktopUniform = checked
        }
        FormCard.FormSwitchDelegate {
            text: i18n("Pan when switching virtual desktops")
            description: i18n("Slides the wallpaper sideways, like a parallax background.")
            checked: tab.root.cfg_experimentalParallax
            onToggled: tab.root.cfg_experimentalParallax = checked
        }
        SliderDelegate {
            visible: tab.root.cfg_experimentalParallax
            label: i18n("Pan distance")
            from: 0.05
            to: 0.5
            stepSize: 0.05
            value: tab.root.cfg_experimentalParallaxStrength
            formatValue: function(v) { return i18n("%1 %", Math.round(v * 100)) }
            onMoved: function(v) { tab.root.cfg_experimentalParallaxStrength = Math.round(v * 20) / 20 }
        }
    }

    // ── Performance overlay (collapsed) ───────────────────────────────────
    Header { title: i18n("Performance Overlay") }
    Card {
        FormCard.FormButtonDelegate {
            id: perfExpander
            property bool expanded: false
            icon.name: expanded ? "arrow-up" : "arrow-down"
            text: i18n("Frame time and power estimate on the desktop")
            description: tab.root.cfg_showPerformance ? i18n("Shown") : i18n("Hidden")
            onClicked: expanded = !expanded
        }
        FormCard.FormSwitchDelegate {
            visible: perfExpander.expanded
            text: i18n("Show performance overlay")
            checked: tab.root.cfg_showPerformance
            onToggled: tab.root.cfg_showPerformance = checked
        }
        FormCard.FormSwitchDelegate {
            visible: perfExpander.expanded && tab.root.cfg_showPerformance
            text: i18n("Frame time graph")
            checked: tab.root.cfg_showPerformanceGraph
            onToggled: tab.root.cfg_showPerformanceGraph = checked
        }
        FormCard.FormSwitchDelegate {
            visible: perfExpander.expanded && tab.root.cfg_showPerformance
            text: i18n("Start expanded")
            checked: tab.root.cfg_performanceExpanded
            onToggled: tab.root.cfg_performanceExpanded = checked
        }
        SliderDelegate {
            visible: perfExpander.expanded && tab.root.cfg_showPerformance
            label: i18n("Graphics card power (TDP)")
            description: i18n("Used for the power estimate. Typical: 15 W integrated, 75 W entry, 150 W mid-range, 250 W and more high-end.")
            from: 15
            to: 350
            stepSize: 5
            value: tab.root.cfg_gpuTdp
            formatValue: function(v) { return i18n("%1 W", Math.round(v)) }
            onMoved: function(v) { tab.root.cfg_gpuTdp = Math.round(v) }
        }
    }
}
