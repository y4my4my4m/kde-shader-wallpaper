// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

/**
 * Setup wizard shown when the C++ plugin is not installed.
 * Guides users through the installation process.
 */
Item {
    id: root
    
    signal installComplete()
    
    // Hardcoded path - no file:// prefix issues
    readonly property string buildCommand: "bash ~/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/scripts/build.sh"
    
    property string selectedDistro: ""
    
    // Dependency commands per distro
    function getDependencyCommand(distro) {
        switch(distro) {
            case "arch":
                return "sudo pacman -S --needed cmake extra-cmake-modules qt6-base qt6-declarative libplasma pipewire libpipewire xcb-util"
            case "fedora":
                return "sudo dnf install cmake extra-cmake-modules gcc-c++ qt6-qtbase-devel qt6-qtdeclarative-devel libplasma-devel pipewire-devel libxcb-devel"
            case "ubuntu":
                return "sudo apt install cmake extra-cmake-modules build-essential qt6-base-dev qt6-declarative-dev libplasma-dev libpipewire-0.3-dev libxcb1-dev"
            case "opensuse":
                return "sudo zypper install cmake extra-cmake-modules gcc-c++ qt6-base-devel qt6-declarative-devel libplasma-devel pipewire-devel libxcb-devel"
            default:
                return "# Check README for your distribution's dependencies"
        }
    }
    
    Rectangle {
        anchors.fill: parent
        color: Kirigami.Theme.backgroundColor
        
        ScrollView {
            anchors.fill: parent
            contentWidth: availableWidth
            
            ColumnLayout {
                width: parent.width
                spacing: 0
                
                // Header
                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: Kirigami.Units.gridUnit * 8
                    
                    gradient: Gradient {
                        GradientStop { position: 0.0; color: Qt.rgba(Kirigami.Theme.highlightColor.r, Kirigami.Theme.highlightColor.g, Kirigami.Theme.highlightColor.b, 0.15) }
                        GradientStop { position: 1.0; color: "transparent" }
                    }
                    
                    ColumnLayout {
                        anchors.centerIn: parent
                        spacing: Kirigami.Units.smallSpacing
                        
                        Kirigami.Icon {
                            source: "preferences-desktop-effects"
                            Layout.preferredWidth: Kirigami.Units.iconSizes.huge
                            Layout.preferredHeight: Kirigami.Units.iconSizes.huge
                            Layout.alignment: Qt.AlignHCenter
                        }
                        
                        Label {
                            text: "Shader Wallpaper"
                            font.pointSize: Kirigami.Theme.defaultFont.pointSize * 1.8
                            font.bold: true
                            Layout.alignment: Qt.AlignHCenter
                        }
                        
                        Label {
                            text: i18n("One more step to get started!")
                            opacity: 0.8
                            Layout.alignment: Qt.AlignHCenter
                        }
                    }
                }
                
                // Main content
                ColumnLayout {
                    Layout.fillWidth: true
                    Layout.margins: Kirigami.Units.gridUnit * 2
                    Layout.maximumWidth: Kirigami.Units.gridUnit * 40
                    Layout.alignment: Qt.AlignHCenter
                    spacing: Kirigami.Units.largeSpacing * 2
                    
                    // Why section
                    Kirigami.Card {
                        Layout.fillWidth: true
                        
                        header: Kirigami.Heading {
                            text: i18n("Why is this needed?")
                            level: 3
                        }
                        
                        contentItem: Label {
                            text: i18n("Shader Wallpaper needs to compile a small native plugin for your system to enable:\n\n" +
                                      "• High-performance OpenGL rendering\n" +
                                      "• Audio reactive effects (PipeWire)\n" +
                                      "• Global mouse tracking\n" +
                                      "• Window-aware shader effects\n\n" +
                                      "This only takes a minute!")
                            wrapMode: Text.WordWrap
                        }
                    }
                    
                    // Step 1: Dependencies (optional)
                    Kirigami.Card {
                        Layout.fillWidth: true
                        
                        header: RowLayout {
                            Kirigami.Heading {
                                text: i18n("Step 1: Install Dependencies")
                                level: 3
                                Layout.fillWidth: true
                            }
                            Label {
                                text: i18n("(optional)")
                                opacity: 0.6
                            }
                        }
                        
                        contentItem: ColumnLayout {
                            spacing: Kirigami.Units.smallSpacing
                            
                            Label {
                                text: i18n("Select your distro if you need to install build tools:")
                                wrapMode: Text.WordWrap
                                Layout.fillWidth: true
                                opacity: 0.8
                            }
                            
                            Flow {
                                Layout.fillWidth: true
                                spacing: Kirigami.Units.smallSpacing
                                
                                Repeater {
                                    model: [
                                        { id: "arch", name: "Arch / Manjaro" },
                                        { id: "fedora", name: "Fedora" },
                                        { id: "ubuntu", name: "Ubuntu / Debian" },
                                        { id: "opensuse", name: "openSUSE" }
                                    ]
                                    
                                    Button {
                                        text: modelData.name
                                        flat: selectedDistro !== modelData.id
                                        highlighted: selectedDistro === modelData.id
                                        onClicked: selectedDistro = (selectedDistro === modelData.id) ? "" : modelData.id
                                    }
                                }
                            }
                            
                            // Dependency command
                            Rectangle {
                                Layout.fillWidth: true
                                Layout.preferredHeight: depText.height + Kirigami.Units.largeSpacing
                                visible: selectedDistro !== ""
                                color: "#1e1e2e"
                                radius: Kirigami.Units.smallSpacing
                                
                                RowLayout {
                                    anchors.fill: parent
                                    anchors.margins: Kirigami.Units.smallSpacing
                                    
                                    TextEdit {
                                        id: depText
                                        Layout.fillWidth: true
                                        readOnly: true
                                        font.family: "monospace"
                                        font.pointSize: 9
                                        color: "#cdd6f4"
                                        text: getDependencyCommand(selectedDistro)
                                        wrapMode: TextEdit.WrapAtWordBoundaryOrAnywhere
                                        selectByMouse: true
                                    }
                                    
                                    Button {
                                        icon.name: "edit-copy"
                                        flat: true
                                        onClicked: {
                                            depText.selectAll()
                                            depText.copy()
                                            depText.deselect()
                                        }
                                        ToolTip.visible: hovered
                                        ToolTip.text: i18n("Copy")
                                    }
                                }
                            }
                        }
                    }
                    
                    // Step 2: Build & Install
                    Kirigami.Card {
                        Layout.fillWidth: true
                        
                        header: Kirigami.Heading {
                            text: i18n("Step 2: Build & Install")
                            level: 3
                        }
                        
                        contentItem: ColumnLayout {
                            spacing: Kirigami.Units.largeSpacing
                            
                            Label {
                                text: i18n("Copy this command and run it in your terminal (Konsole, etc.):")
                                wrapMode: Text.WordWrap
                                Layout.fillWidth: true
                            }
                            
                            // Command box
                            Rectangle {
                                Layout.fillWidth: true
                                Layout.preferredHeight: buildText.height + Kirigami.Units.largeSpacing
                                color: "#1e1e2e"
                                radius: Kirigami.Units.smallSpacing
                                
                                RowLayout {
                                    anchors.fill: parent
                                    anchors.margins: Kirigami.Units.smallSpacing
                                    
                                    TextEdit {
                                        id: buildText
                                        Layout.fillWidth: true
                                        readOnly: true
                                        font.family: "monospace"
                                        font.pointSize: 11
                                        color: "#a6e3a1"
                                        text: buildCommand
                                        wrapMode: TextEdit.WrapAtWordBoundaryOrAnywhere
                                        selectByMouse: true
                                    }
                                    
                                    Button {
                                        icon.name: "edit-copy"
                                        flat: true
                                        onClicked: {
                                            buildText.selectAll()
                                            buildText.copy()
                                            buildText.deselect()
                                            copyToast.visible = true
                                            copyTimer.restart()
                                        }
                                        ToolTip.visible: hovered
                                        ToolTip.text: i18n("Copy")
                                    }
                                }
                            }
                            
                            // Big copy button
                            Button {
                                Layout.fillWidth: true
                                Layout.preferredHeight: Kirigami.Units.gridUnit * 3
                                highlighted: true
                                
                                contentItem: RowLayout {
                                    anchors.centerIn: parent
                                    spacing: Kirigami.Units.smallSpacing
                                    
                                    Kirigami.Icon {
                                        source: "edit-copy"
                                        Layout.preferredWidth: Kirigami.Units.iconSizes.medium
                                        Layout.preferredHeight: Kirigami.Units.iconSizes.medium
                                    }
                                    
                                    Label {
                                        text: i18n("Copy Install Command")
                                        font.bold: true
                                    }
                                }
                                
                                onClicked: {
                                    buildText.selectAll()
                                    buildText.copy()
                                    buildText.deselect()
                                    copyToast.visible = true
                                    copyTimer.restart()
                                }
                            }
                            
                            Label {
                                id: copyToast
                                text: "✓ " + i18n("Copied! Paste in terminal with Ctrl+Shift+V")
                                color: Kirigami.Theme.positiveTextColor
                                visible: false
                                Layout.alignment: Qt.AlignHCenter
                                
                                Timer {
                                    id: copyTimer
                                    interval: 3000
                                    onTriggered: copyToast.visible = false
                                }
                            }
                            
                            Label {
                                text: i18n("The installer will: download source → build plugin → install to ~/.local")
                                wrapMode: Text.WordWrap
                                Layout.fillWidth: true
                                opacity: 0.6
                                font.pointSize: Kirigami.Theme.smallFont.pointSize
                            }
                        }
                    }
                    
                    // Step 3: Restart
                    Kirigami.Card {
                        Layout.fillWidth: true
                        
                        header: Kirigami.Heading {
                            text: i18n("Step 3: Restart Plasma")
                            level: 3
                        }
                        
                        contentItem: ColumnLayout {
                            spacing: Kirigami.Units.smallSpacing
                            
                            Label {
                                text: i18n("After the build completes, restart Plasma to load the plugin:")
                                wrapMode: Text.WordWrap
                                Layout.fillWidth: true
                            }
                            
                            Rectangle {
                                Layout.fillWidth: true
                                Layout.preferredHeight: restartText.height + Kirigami.Units.largeSpacing
                                color: "#1e1e2e"
                                radius: Kirigami.Units.smallSpacing
                                
                                RowLayout {
                                    anchors.fill: parent
                                    anchors.margins: Kirigami.Units.smallSpacing
                                    
                                    TextEdit {
                                        id: restartText
                                        Layout.fillWidth: true
                                        readOnly: true
                                        font.family: "monospace"
                                        font.pointSize: 10
                                        color: "#fab387"
                                        text: "pkill plasmashell && plasmashell &"
                                        selectByMouse: true
                                    }
                                    
                                    Button {
                                        icon.name: "edit-copy"
                                        flat: true
                                        onClicked: {
                                            restartText.selectAll()
                                            restartText.copy()
                                            restartText.deselect()
                                        }
                                        ToolTip.visible: hovered
                                        ToolTip.text: i18n("Copy")
                                    }
                                }
                            }
                        }
                    }
                    
                    // Footer
                    RowLayout {
                        Layout.fillWidth: true
                        Layout.topMargin: Kirigami.Units.largeSpacing
                        
                        Item { Layout.fillWidth: true }
                        
                        Button {
                            icon.name: "help-about"
                            text: i18n("Help")
                            onClicked: Qt.openUrlExternally("https://github.com/y4my4my4m/kde-shader-wallpaper")
                        }
                        
                        Button {
                            icon.name: "internet-web-browser"
                            text: i18n("Ko-fi")
                            onClicked: Qt.openUrlExternally("https://ko-fi.com/I2I525V5R")
                        }
                    }
                }
            }
        }
    }
}
