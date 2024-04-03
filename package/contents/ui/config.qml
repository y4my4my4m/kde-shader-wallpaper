import QtQuick
import QtQuick.Controls
import QtQuick.Dialogs
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import org.kde.plasma.core as PlasmaCore
import QtCore
import Qt.labs.folderlistmodel 2.15

Kirigami.FormLayout {
    id: root
    twinFormLayouts: parentLayout // required by parent
    property alias formLayout: root // required by parent
    
    RowLayout {
        Kirigami.FormData.label: i18nd("online.knowmad.shaderwallpaper", "Select shader:");
        ComboBox {
            id: selectedShader
            Layout.minimumWidth: width
            Layout.maximumWidth: width 
            width: 240
            model: FolderListModel {
                id: folderListModel
                showDirs: false
                nameFilters: ["*.frag.qsb"]
                folder: `${StandardPaths.writableLocation(StandardPaths.HomeLocation)}/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Shaders6/`
            }
            delegate: Component {
                id: folderListDelegate
                ItemDelegate {
                    width: parent.width
                    text: fileBaseName.replace("_"," ").charAt(0).toUpperCase() + fileBaseName.replace("_"," ").slice(1)
                }
            }

            textRole: "fileBaseName"
            currentIndex: wallpaper.configuration.selectedShaderIndex
            displayText: currentIndex === -1 ? "Custom Shader" : currentText.replace("_"," ").charAt(0).toUpperCase() + currentText.replace("_"," ").slice(1)

            onCurrentTextChanged: {
                wallpaper.configuration.selectedShaderIndex = currentIndex;
                if (wallpaper.configuration.selectedShaderIndex === -1) {
                    return
                };
                wallpaper.configuration.selectedShaderPath = Qt.resolvedUrl("./Shaders6/"+model.get(currentIndex, "fileName"));
            }
        }

        Button {
            id: shaderFileButton
            icon.name: "folder-symbolic"
            text: i18nd("@button:toggle_select_shader", "Select File")
            onClicked: {
                fileDialog.open()
            }
        }
    }
    // use Item instead to remove the line
    Kirigami.Separator {
        Kirigami.FormData.isSection: true
        Kirigami.FormData.label: i18nd("online.knowmad.shaderwallpaper", "Configuration:");
    }

    RowLayout {
        Kirigami.FormData.label: i18nd("online.knowmad.shaderwallpaper", "Shader speed:");
        ColumnLayout {
            Slider {
                Layout.minimumWidth: width
                Layout.maximumWidth: width 
                width: 435
                from: -10.0
                to: 10.0
                id: speedSlider
                stepSize: 0.01
                value: wallpaper.configuration.shaderSpeed ? wallpaper.configuration.shaderSpeed : 1.0
                onValueChanged: wallpaper.configuration.shaderSpeed = value
            }
        }
        ColumnLayout {
            Label {
                text: i18n("%1", wallpaper.configuration.shaderSpeed)
            }
        }
    }

    RowLayout {
        Kirigami.FormData.label: i18nd("online.knowmad.shaderwallpaper", "Mouse allowed:");
        Button {
            icon.name: checked? "followmouse-symbolic" : "hidemouse-symbolic"
            text: i18nd("@button:toggle_use_mouse", checked? "Enabled" : "Disabled")
            checkable: true
            checked: wallpaper.configuration.mouseAllowed
            onClicked: {
                wallpaper.configuration.mouseAllowed = !wallpaper.configuration.mouseAllowed
            }
        }
    }

    // iChannel0
    RowLayout {
        Kirigami.FormData.label: i18nd("online.knowmad.shaderwallpaper", "iChannel0:");
        CheckBox {
            id: iChannel0_flag
            width: 35
            checked: wallpaper.configuration.iChannel0_flag
            onCheckedChanged: {
                wallpaper.configuration.iChannel0_flag = checked
                if (!checked) wallpaper.configuration.iChannel0 = ""
                else wallpaper.configuration.iChannel0 = iChannel0Field.text;
            }
        }
        TextField {
            id: iChannel0Field
            placeholderText: "path to iChannel0"
            text: wallpaper.configuration.iChannel0
            visible: iChannel0_flag.checked
            onEditingFinished: {
                wallpaper.configuration.iChannel0 =  iChannel0Field.text;
                ich0_thumbnail.source = wallpaper.configuration.iChannel0
            }
        }

        Image {
            id: ich0_thumbnail
            source: wallpaper.configuration.iChannel0
            fillMode: Image.PreserveAspectFit
            visible: iChannel0_flag.checked && iChannel0Field.text !== ""
            Layout.preferredWidth: 36
            Layout.preferredHeight: 36
        }
        Button {
            id: ich0FileButton
            icon.name: "x-shape-image-symbolic.svg"
            text: i18nd("@button:open_ich_dialog", "Select Image")
            visible: iChannel0_flag.checked
            onClicked: {
                fileDialog_ich0.open()
            }
        }
    }
    // iChannel1
    RowLayout {
        Kirigami.FormData.label: i18nd("online.knowmad.shaderwallpaper", "iChannel1:");
        CheckBox {
            id: iChannel1_flag
            width: 35
            checked: wallpaper.configuration.iChannel1_flag
            onCheckedChanged: {
                wallpaper.configuration.iChannel1_flag = checked
                if (!checked) wallpaper.configuration.iChannel1 = ""
                else wallpaper.configuration.iChannel1 = iChannel1Field.text;
            }
        }
        TextField {
            id: iChannel1Field
            placeholderText: "path to iChannel1"
            text: wallpaper.configuration.iChannel1
            visible: iChannel1_flag.checked
            onEditingFinished: {
                wallpaper.configuration.iChannel1 =  iChannel1Field.text;
                ich1_thumbnail.source = wallpaper.configuration.iChannel1
            }
        }

        Image {
            id: ich1_thumbnail
            source: wallpaper.configuration.iChannel1
            fillMode: Image.PreserveAspectFit
            visible: iChannel1_flag.checked && iChannel1Field.text !== ""
            Layout.preferredWidth: 36
            Layout.preferredHeight: 36
        }
        Button {
            id: ich1FileButton
            icon.name: "x-shape-image-symbolic.svg"
            text: i18nd("@button:open_ich_dialog", "Select Image")
            visible: iChannel1_flag.checked
            onClicked: {
                fileDialog_ich1.open()
            }
        }
    }
    // iChannel2
    RowLayout {
        Kirigami.FormData.label: i18nd("online.knowmad.shaderwallpaper", "iChannel2:");
        CheckBox {
            id: iChannel2_flag
            width: 35
            checked: wallpaper.configuration.iChannel2_flag
            onCheckedChanged: {
                wallpaper.configuration.iChannel2_flag = checked
                if (!checked) wallpaper.configuration.iChannel2 = ""
                else wallpaper.configuration.iChannel2 = iChannel2Field.text;
            }
        }
        TextField {
            id: iChannel2Field
            placeholderText: "path to iChannel2"
            text: wallpaper.configuration.iChannel2
            visible: iChannel2_flag.checked
            onEditingFinished: {
                wallpaper.configuration.iChannel2 =  iChannel2Field.text;
                ich2_thumbnail.source = wallpaper.configuration.iChannel2
            }
        }

        Image {
            id: ich2_thumbnail
            source: wallpaper.configuration.iChannel2
            fillMode: Image.PreserveAspectFit
            visible: iChannel2_flag.checked && iChannel2Field.text !== ""
            Layout.preferredWidth: 36
            Layout.preferredHeight: 36
        }
        Button {
            id: ich2FileButton
            icon.name: "x-shape-image-symbolic.svg"
            text: i18nd("@button:open_ich_dialog", "Select Image")
            visible: iChannel2_flag.checked
            onClicked: {
                fileDialog_ich2.open()
            }
        }
    }
    // iChannel3
    RowLayout {
        Kirigami.FormData.label: i18nd("online.knowmad.shaderwallpaper", "iChannel3:");
        CheckBox {
            id: iChannel3_flag
            width: 35
            checked: wallpaper.configuration.iChannel3_flag
            onCheckedChanged: {
                wallpaper.configuration.iChannel3_flag = checked
                if (!checked) wallpaper.configuration.iChannel3 = ""
                else wallpaper.configuration.iChannel3 = iChannel3Field.text;
            }
        }
        TextField {
            id: iChannel3Field
            placeholderText: "path to iChannel3"
            text: wallpaper.configuration.iChannel3
            visible: iChannel3_flag.checked
            onEditingFinished: {
                wallpaper.configuration.iChannel3 =  iChannel3Field.text;
                ich3_thumbnail.source = wallpaper.configuration.iChannel3
            }
        }

        Image {
            id: ich3_thumbnail
            source: wallpaper.configuration.iChannel3
            fillMode: Image.PreserveAspectFit
            visible: iChannel3_flag.checked && iChannel3Field.text !== ""
            Layout.preferredWidth: 36
            Layout.preferredHeight: 36
        }
        Button {
            id: ich3FileButton
            icon.name: "x-shape-image-symbolic.svg"
            text: i18nd("@button:open_ich_dialog", "Select Image")
            visible: iChannel3_flag.checked
            onClicked: {
                fileDialog_ich3.open()
            }
        }
    }

    Kirigami.Separator {
        Kirigami.FormData.isSection: true
        Kirigami.FormData.label: i18nd("online.knowmad.shaderwallpaper", "Info:");
    }

    Kirigami.InlineMessage {
        id: infoPlasma6Preview
        Layout.fillWidth: true
        type: Kirigami.MessageType.Positive
        text: qsTr("This is an early preview!\nOfficial release will have more many more features :)")
        showCloseButton: true
        visible: !wallpaper.configuration.infoPlasma6Preview_dismissed
        onVisibleChanged: {
            wallpaper.configuration.infoPlasma6Preview_dismissed = true;
        }
    }

    Kirigami.InlineMessage {
        id: warningResources
        Layout.fillWidth: true
        type: Kirigami.MessageType.Warning
        text: qsTr("Some shaders might consume more power than others, beware!")
        showCloseButton: true
        visible: !wallpaper.configuration.warningResources_dismissed
        onVisibleChanged: {
            wallpaper.configuration.warningResources_dismissed = true;
        }
    }

    
    Kirigami.InlineMessage {
        Layout.fillWidth: true
        text: qsTr("Submit your shaders on <a href=\"https://github.com/y4my4my4m/kde-shader-wallpaper\">Github</a> or open an issue for support/features!")
        onLinkActivated: Qt.openUrlExternally(link)
        visible: true
    }

    RowLayout{
        spacing: 20
        Button {
            id: emergencyHelpButton
            icon.name: "help-about-symbolic"
            text: i18nd("@button:toggle_emergency_help", "Help!")
            onClicked: {
            emergencyHelp.open()
            }
        }

        Button {
            id: kofiButton
            text: i18nd("@button:kofi", "Kofi")
            contentItem: AnimatedImage {
                source: "Resources/kofi.gif"
                sourceSize.width: 24
                sourceSize.height: 24
                fillMode: Image.Pad
                horizontalAlignment: Image.AlignLeft
                transform: Translate { x: 4 }
            }
            onClicked: {
                Qt.openUrlExternally("https://ko-fi.com/I2I525V5R")
            }
        }
    }

    FileDialog {
        id: fileDialog
        fileMode : FileDialog.OpenFile
        title: i18nd("@dialog_title:choose_shader", "Choose a shader")
        // will accept and auto convert .frag in the near future
        nameFilters: [ "Shader files (*.frag.qsb)", "All files (*)" ]
        visible: false
        currentFolder: `${StandardPaths.writableLocation(StandardPaths.HomeLocation)}/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Shaders6/`
        onAccepted: {
            wallpaper.configuration.selectedShaderIndex = -1;
            wallpaper.configuration.selectedShaderPath = selectedFile;
        }
    }


    // TODO: re-use the same file dialog...
    FileDialog {
        id: fileDialog_ich0
        fileMode : FileDialog.OpenFile
        nameFilters: [ "Image files (*.png *.jpg *.gif *.webp *.apng *.svg *.tiff)", "All files (*)" ]
        visible: false
        title: i18nd("@dialog_title:choose_ichannel", "Choose an Image")
        currentFolder: `${StandardPaths.writableLocation(StandardPaths.HomeLocation)}/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Resources/`
        onAccepted: {
            wallpaper.configuration.iChannel0 = selectedFile
        }
    }

    FileDialog {
        id: fileDialog_ich1
        fileMode : FileDialog.OpenFile
        nameFilters: [ "Image files (*.png *.jpg *.gif *.webp *.apng *.svg *.tiff)", "All files (*)" ]
        visible: false
        title: i18nd("@dialog_title:choose_ichannel", "Choose an Image")
        currentFolder: `${StandardPaths.writableLocation(StandardPaths.HomeLocation)}/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Resources/`
        
        onAccepted: {
            wallpaper.configuration.iChannel1 = selectedFile
        }
    }

    FileDialog {
        id: fileDialog_ich2
        fileMode : FileDialog.OpenFile
        nameFilters: [ "Image files (*.png *.jpg *.gif *.webp *.apng *.svg *.tiff)", "All files (*)" ]
        visible: false
        title: i18nd("@dialog_title:choose_ichannel", "Choose an Image")
        currentFolder: `${StandardPaths.writableLocation(StandardPaths.HomeLocation)}/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Resources/`
        onAccepted: {
            wallpaper.configuration.iChannel2 = selectedFile
        }
    }
    FileDialog {
        id: fileDialog_ich3
        fileMode : FileDialog.OpenFile
        nameFilters: [ "Image files (*.png *.jpg *.gif *.webp *.apng *.svg *.tiff)", "All files (*)" ]
        visible: false
        title: i18nd("@dialog_title:choose_ichannel", "Choose an Image")
        currentFolder: `${StandardPaths.writableLocation(StandardPaths.HomeLocation)}/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Resources/`
        onAccepted: {
            wallpaper.configuration.iChannel3 = selectedFile
        }
    }
    Kirigami.OverlaySheet {
        id: emergencyHelp
        parent: applicationWindow().overlay
        Label {
            Layout.preferredWidth: Kirigami.Units.gridUnit * 25
            wrapMode: Text.WordWrap
            text: qsTr("In case of emergency:\nDelete the folder in\n`~/.local/share/plasma/wallpaper/online.knowmad.shaderwallpaper`\nthen run: \"pkill plasmashell && plasmashell &\" to restart plasmashell.\n\nUse with caution.")
        }
    }
}