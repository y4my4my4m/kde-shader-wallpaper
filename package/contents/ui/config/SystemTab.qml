// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import org.kde.kirigamiaddons.formcard as FormCard
import "../shaderwallpaper"

TabScroll {
    id: tab

    required property var root
    maximumContentWidth: root.formMaxWidth

    PlmGreeterSetup {
        id: plmSetup
        Component.onCompleted: refresh()
        onEnableFinished: function(success, message) {
            tab.plmError = success ? "" : message
        }
    }
    property string plmError: ""

    // ── Sign-in screen (Plasma Login Manager) ─────────────────────────────
    // The sign-in screen runs before login and only sees plugins installed
    // under /usr.
    Header { title: i18n("Sign-in Screen") }
    Card {
        FormCard.FormTextDelegate {
            visible: !plmSetup.plmInstalled
            text: i18n("Shader wallpapers on the sign-in screen need Plasma Login Manager, which this system does not use.")
            textItem.wrapMode: Text.WordWrap
        }
        FormCard.FormButtonDelegate {
            visible: !plmSetup.plmInstalled
            icon.name: "help-about"
            text: i18n("About Plasma Login Manager")
            onClicked: Qt.openUrlExternally("https://wiki.archlinux.org/title/Plasma_Login_Manager")
        }

        FormCard.FormTextDelegate {
            visible: plmSetup.plmInstalled && !plmSetup.systemPluginInstalled
            text: i18n("Shader Wallpaper is installed for your user only. The sign-in screen runs before you log in and can only use a system-wide copy.")
            description: i18n("Run this command in a terminal once, then log out:")
            textItem.wrapMode: Text.WordWrap
        }
        FormCard.AbstractFormDelegate {
            visible: plmSetup.plmInstalled && !plmSetup.systemPluginInstalled
            background: null
            focusPolicy: Qt.NoFocus
            contentItem: RowLayout {
                spacing: Kirigami.Units.smallSpacing
                QQC2.TextField {
                    id: commandField
                    Layout.fillWidth: true
                    readOnly: true
                    selectByMouse: true
                    font.family: "monospace"
                    text: plmSetup.installCommand
                }
                QQC2.Button {
                    icon.name: "edit-copy"
                    text: i18n("Copy")
                    onClicked: {
                        tab.root.copyToClipboard(plmSetup.installCommand)
                        tab.root.showStatus(i18n("Command copied."), Kirigami.MessageType.Positive)
                    }
                }
            }
        }

        FormCard.FormTextDelegate {
            visible: plmSetup.plmInstalled && plmSetup.systemPluginInstalled && !plmSetup.loginScreenEnabled
            text: i18n("Installed system-wide. One more step registers it with the sign-in screen.")
            description: i18n("Writes WallpaperPluginId=online.knowmad.shaderwallpaper to /etc/plasmalogin.conf.")
            textItem.wrapMode: Text.WordWrap
        }
        FormCard.FormButtonDelegate {
            visible: plmSetup.plmInstalled && plmSetup.systemPluginInstalled && !plmSetup.loginScreenEnabled
            icon.name: "system-lock-screen"
            text: i18n("Enable on the sign-in screen")
            description: i18n("Asks for your administrator password.")
            enabled: !plmSetup.busy && plmSetup.helperInstalled
            onClicked: plmSetup.enableLoginScreen()
        }

        FormCard.FormTextDelegate {
            visible: plmSetup.plmInstalled && plmSetup.loginScreenEnabled
            leading: Kirigami.Icon {
                source: "dialog-ok-apply"
                implicitWidth: Kirigami.Units.iconSizes.smallMedium
                implicitHeight: Kirigami.Units.iconSizes.smallMedium
                color: Kirigami.Theme.positiveTextColor
            }
            text: i18n("Enabled on the sign-in screen")
            description: i18n("The sign-in screen has its own shader, chosen in its own settings.")
        }
        FormCard.FormButtonDelegate {
            visible: plmSetup.plmInstalled && plmSetup.loginScreenEnabled
            icon.name: "systemsettings"
            text: i18n("Choose the sign-in screen shader…")
            onClicked: plmSetup.openLoginScreenSettings()
        }

        FormCard.AbstractFormDelegate {
            visible: tab.plmError.length > 0
            background: null
            focusPolicy: Qt.NoFocus
            contentItem: Kirigami.InlineMessage {
                visible: true
                type: Kirigami.MessageType.Error
                text: tab.plmError
            }
        }
    }

    // ── Help ──────────────────────────────────────────────────────────────
    Header { title: i18n("Help") }
    Card {
        FormCard.FormButtonDelegate {
            icon.name: "tools-wizard"
            text: i18n("Run the setup assistant again")
            description: i18n("Pick a style and a shader in a few steps.")
            onClicked: tab.root.openOnboarding()
        }
        FormCard.FormButtonDelegate {
            id: troubleshootExpander
            property bool expanded: false
            icon.name: expanded ? "arrow-up" : "arrow-down"
            text: i18n("If the desktop stops responding")
            onClicked: expanded = !expanded
        }
        FormCard.FormTextDelegate {
            visible: troubleshootExpander.expanded
            text: i18n("Pick a lighter shader, or set the wallpaper type back to Image. If the settings cannot be reached, this terminal command puts a picture on every screen:")
            description: "plasma-apply-wallpaperimage /usr/share/wallpapers/Next"
            textItem.wrapMode: Text.WordWrap
            descriptionItem.wrapMode: Text.WrapAnywhere
            descriptionItem.font.family: "monospace"
        }
    }

    // ── About ─────────────────────────────────────────────────────────────
    Header { title: i18n("About") }
    Card {
        FormCard.FormTextDelegate {
            text: i18n("Shader Wallpaper")
            description: i18n("Live GLSL shaders on the Plasma desktop, lock screen and sign-in screen. Licensed under the GPL 3.0 or later.")
            descriptionItem.wrapMode: Text.WordWrap
        }
        FormCard.FormButtonDelegate {
            icon.name: "internet-web-browser"
            text: i18n("Project page")
            description: "github.com/y4my4my4m/kde-shader-wallpaper"
            onClicked: Qt.openUrlExternally("https://github.com/y4my4my4m/kde-shader-wallpaper")
        }
        FormCard.FormButtonDelegate {
            icon.name: "tools-report-bug"
            text: i18n("Report a problem")
            onClicked: Qt.openUrlExternally("https://github.com/y4my4my4m/kde-shader-wallpaper/issues")
        }
        FormCard.FormButtonDelegate {
            icon.name: "help-donate"
            text: i18n("Support development")
            description: "ko-fi.com"
            onClicked: Qt.openUrlExternally("https://ko-fi.com/I2I525V5R")
        }
    }
}
