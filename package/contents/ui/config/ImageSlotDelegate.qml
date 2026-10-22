// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import org.kde.kirigamiaddons.formcard as FormCard

// One image slot (iChannel texture): thumbnail, file name, Browse, Clear,
// drag and drop.
FormCard.AbstractFormDelegate {
    id: delegate

    required property var root
    required property int slot

    readonly property string path: root["cfg_iChannel" + slot] || ""
    readonly property bool used: root["cfg_iChannel" + slot + "Enabled"] === true
    readonly property bool needed: root.shaderUsage.textures[slot] === true
    readonly property bool fromShader: path.length > 0 && root.shaderImages[slot] === path
    readonly property string fileName: path.length > 0 ? path.substring(path.lastIndexOf("/") + 1) : ""

    focusPolicy: Qt.NoFocus
    background: Rectangle {
        radius: Kirigami.Units.cornerRadius
        color: drop.containsDrag ? Qt.rgba(Kirigami.Theme.highlightColor.r, Kirigami.Theme.highlightColor.g,
                                           Kirigami.Theme.highlightColor.b, 0.2)
                                 : "transparent"
    }

    DropArea {
        id: drop
        anchors.fill: parent
        keys: ["text/uri-list"]
        onEntered: function(drag) {
            for (let i = 0; i < drag.urls.length; ++i) {
                if (/\.(png|jpe?g|webp|bmp|tiff?)$/i.test(drag.urls[i])) {
                    drag.accept(Qt.CopyAction)
                    return
                }
            }
            drag.accepted = false
        }
        onDropped: function(dropEvent) {
            for (let i = 0; i < dropEvent.urls.length; ++i) {
                const u = dropEvent.urls[i].toString()
                if (/\.(png|jpe?g|webp|bmp|tiff?)$/i.test(u)) {
                    delegate.root.setImage(delegate.slot, u)
                    dropEvent.accept(Qt.CopyAction)
                    return
                }
            }
        }
    }

    contentItem: RowLayout {
        spacing: Kirigami.Units.largeSpacing

        Rectangle {
            Layout.preferredWidth: Kirigami.Units.gridUnit * 4
            Layout.preferredHeight: Kirigami.Units.gridUnit * 2.25
            radius: Kirigami.Units.cornerRadius
            color: Kirigami.Theme.alternateBackgroundColor
            border.width: 1
            border.color: Kirigami.ColorUtils.linearInterpolation(Kirigami.Theme.backgroundColor, Kirigami.Theme.textColor, 0.15)
            clip: true
            Image {
                id: thumb
                anchors.fill: parent
                anchors.margins: 1
                visible: status === Image.Ready && delegate.used
                source: delegate.path.length > 0 ? delegate.root.resolveUrl(delegate.path) : ""
                asynchronous: true
                fillMode: Image.PreserveAspectCrop
                sourceSize.width: width * 2
                sourceSize.height: height * 2
            }
            Kirigami.Icon {
                anchors.centerIn: parent
                visible: !thumb.visible
                implicitWidth: Kirigami.Units.iconSizes.small
                implicitHeight: Kirigami.Units.iconSizes.small
                source: thumb.status === Image.Error ? "image-missing" : "viewimage"
                color: Kirigami.Theme.disabledTextColor
            }
        }

        ColumnLayout {
            Layout.fillWidth: true
            spacing: 0
            RowLayout {
                spacing: Kirigami.Units.smallSpacing
                QQC2.Label {
                    text: i18n("Image %1", delegate.slot + 1)
                }
                StatusChip {
                    visible: delegate.fromShader
                    text: i18n("Comes with the shader")
                    tone: Kirigami.Theme.positiveTextColor
                    toolTip: i18n("The shader names this image in its header and it was set when the shader was applied.")
                }
                StatusChip {
                    visible: delegate.needed && !delegate.fromShader
                    text: i18n("Used by this shader")
                    tone: delegate.used && delegate.path.length > 0 ? Kirigami.Theme.positiveTextColor
                                                                   : Kirigami.Theme.neutralTextColor
                }
            }
            QQC2.Label {
                Layout.fillWidth: true
                text: delegate.path.length === 0 ? i18n("No image")
                    : (delegate.used ? delegate.fileName : i18n("%1 (off)", delegate.fileName))
                elide: Text.ElideMiddle
                font: Kirigami.Theme.smallFont
                color: Kirigami.Theme.disabledTextColor
                QQC2.ToolTip.text: delegate.path
                QQC2.ToolTip.visible: pathHover.hovered && delegate.path.length > 0
                HoverHandler { id: pathHover }
            }
        }

        QQC2.Switch {
            visible: delegate.path.length > 0
            checked: delegate.used
            text: i18n("Use")
            display: QQC2.AbstractButton.IconOnly
            QQC2.ToolTip.text: checked ? i18n("Turn this image off") : i18n("Turn this image on")
            QQC2.ToolTip.visible: hovered
            onToggled: delegate.root["cfg_iChannel" + delegate.slot + "Enabled"] = checked
        }
        QQC2.Button {
            icon.name: "document-open"
            text: i18n("Browse…")
            onClicked: delegate.root.openImageDialog(delegate.slot)
        }
        QQC2.ToolButton {
            icon.name: "edit-clear"
            display: QQC2.AbstractButton.IconOnly
            text: i18n("Clear image")
            enabled: delegate.path.length > 0
            QQC2.ToolTip.text: text
            QQC2.ToolTip.visible: hovered
            onClicked: delegate.root.setImage(delegate.slot, "")
        }
    }
}
