// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import "../shaderwallpaper"
import ".."

// First-run assistant: welcome, pick a category, pick a shader.
Kirigami.Dialog {
    id: dialog
    parent: QQC2.Overlay.overlay

    required property var root

    title: i18n("Welcome to Shader Wallpaper")
    preferredWidth: Kirigami.Units.gridUnit * 40
    padding: Kirigami.Units.largeSpacing
    standardButtons: Kirigami.Dialog.NoButton

    property int step: 0
    property string category: ""
    property string pickedPath: ""

    onOpened: {
        step = 0
        pickedPath = ""
    }

    customFooterActions: [
        Kirigami.Action {
            text: dialog.step === 0 ? i18n("Skip") : i18n("Back")
            icon.name: dialog.step === 0 ? "dialog-cancel" : "go-previous"
            onTriggered: dialog.step === 0 ? dialog.close() : dialog.step--
        },
        Kirigami.Action {
            text: dialog.step === 2 ? i18n("Use This Shader") : i18n("Next")
            icon.name: dialog.step === 2 ? "dialog-ok-apply" : "go-next"
            enabled: dialog.step === 0
                     || (dialog.step === 1 && dialog.category.length > 0)
                     || (dialog.step === 2 && dialog.pickedPath.length > 0)
            onTriggered: {
                if (dialog.step < 2) {
                    dialog.step++
                } else {
                    dialog.root.applyShaderFromPath(dialog.pickedPath)
                    dialog.close()
                }
            }
        }
    ]

    CategoryModel { id: categoryModel }

    // Fixed height: the dialog sizes to its content, and a GridView has no
    // useful implicit height (a layout overrides its own implicitHeight).
    Item {
        implicitHeight: Math.max(Kirigami.Units.gridUnit * 10,
            Math.min(Kirigami.Units.gridUnit * 22, (dialog.parent ? dialog.parent.height : 0) - Kirigami.Units.gridUnit * 10))

        StackLayout {
            anchors.fill: parent
            currentIndex: dialog.step

            // ── welcome ───────────────────────────────────────────────────────
            ColumnLayout {
                spacing: Kirigami.Units.largeSpacing
                Item { Layout.fillHeight: true }
                Kirigami.Icon {
                    Layout.alignment: Qt.AlignHCenter
                    implicitWidth: Kirigami.Units.iconSizes.huge
                    implicitHeight: Kirigami.Units.iconSizes.huge
                    source: "preferences-desktop-wallpaper"
                }
                Kirigami.Heading {
                    Layout.fillWidth: true
                    horizontalAlignment: Text.AlignHCenter
                    level: 2
                    text: i18n("Live shaders on your desktop")
                }
                QQC2.Label {
                    Layout.fillWidth: true
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.WordWrap
                    text: i18n("Pick a style and a shader in two steps. Inputs the shader needs, such as the mouse or sound, are turned on for you. You can run this again from the System tab.")
                }
                Item { Layout.fillHeight: true }
            }

            // ── category ──────────────────────────────────────────────────────
            ColumnLayout {
                spacing: Kirigami.Units.largeSpacing
                Kirigami.Heading {
                    level: 3
                    text: i18n("Pick a style")
                }
                Flow {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    spacing: Kirigami.Units.smallSpacing
                    Repeater {
                        model: categoryModel
                        delegate: QQC2.Button {
                            required property var model
                            visible: model.name !== "All" && model.name !== "Favorites" && model.count > 0
                            text: i18nc("@action:button category and shader count", "%1 (%2)", model.name, model.count)
                            icon.name: model.icon || ""
                            checkable: true
                            checked: dialog.category === model.name
                            onClicked: {
                                dialog.category = model.name
                                dialog.pickedPath = ""
                            }
                        }
                    }
                }
            }

            // ── shader ────────────────────────────────────────────────────────
            ColumnLayout {
                spacing: Kirigami.Units.largeSpacing
                Kirigami.Heading {
                    level: 3
                    text: i18n("Pick a shader")
                }
                GridView {
                    id: shaderGrid
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true
                    cellWidth: Math.max(1, Math.floor((width - Kirigami.Units.gridUnit) / Math.max(1, Math.floor(width / (Kirigami.Units.gridUnit * 10)))))
                    cellHeight: Math.round(cellWidth * 9 / 16) + Kirigami.Units.gridUnit * 2.5
                    QQC2.ScrollBar.vertical: QQC2.ScrollBar {}
                    model: ShaderListModel {
                        category: dialog.step === 2 ? dialog.category : "__none__"
                    }
                    delegate: Item {
                        required property string shaderId
                        required property string name
                        required property url shaderPath
                        required property url thumbnailPath
                        width: shaderGrid.cellWidth
                        height: shaderGrid.cellHeight
                        ShaderCard {
                            anchors.fill: parent
                            anchors.margins: Kirigami.Units.smallSpacing
                            shaderName: parent.name
                            // Index entries can name a thumbnail file that is gone.
                            thumbnailPath: ShaderLibrarySingleton.needsThumbnail(parent.shaderId) ? "" : parent.thumbnailPath
                            compact: true
                            selected: dialog.pickedPath === parent.shaderPath.toString()
                            onClicked: dialog.pickedPath = parent.shaderPath.toString()
                            onDoubleClicked: {
                                dialog.root.applyShaderFromPath(parent.shaderPath.toString())
                                dialog.close()
                            }
                        }
                    }
                }
            }
        }
    }
}
