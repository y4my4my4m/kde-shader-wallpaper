import QtQuick
import QtQuick.Controls
import org.kde.kquickcontrols as KQuickControls
import QtQuick.Dialogs
import QtQuick.Layouts
import QtMultimedia
import org.kde.kirigami as Kirigami
import org.kde.kquickcontrols 2.0 as KQuickControls
import org.kde.plasma.core as PlasmaCore
import org.kde.kirigami as Kirigami
import QtCore
import Qt.labs.folderlistmodel 2.15

Kirigami.FormLayout {
    id: root
    twinFormLayouts: parentLayout // required by parent
    property alias formLayout: root // required by parent
    // property alias cfg_checkedSmartPlay: checkedSmartPlay.checked
    // property alias cfg_iChannel0_flag:   iChannel0_flag.checked
    // property alias cfg_iChannel1_flag:   iChannel1_flag.checked
    // property alias cfg_iChannel2_flag:   iChannel2_flag.checked
    // property alias cfg_iChannel3_flag:   iChannel3_flag.checked
    // property alias cfg_fadeToNext:       checkFadeToNext.checked
    // property alias cfg_fadeToRandom:     checkFadeToRandom.checked
    RowLayout {
        Kirigami.FormData.label: i18nd("online.knowmad.shaderwallpaper", "Select shader:");
        ComboBox {
            id: selectedShader
            Layout.minimumWidth: width
            Layout.maximumWidth: width 
            width: 435
            model: FolderListModel {
                id: folderListModel
                showDirs: false
                nameFilters: ["*.frag.qsb"]
                folder: `${StandardPaths.writableLocation(StandardPaths.HomeLocation)}/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Shaders6/`
            }
            delegate: Component {
                id: folderListDelegate
                ItemDelegate {
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
            icon.name: "folder-shaders-symbolic"
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
            checked: false
            onCheckedChanged: {
                if (!checked) wallpaper.configuration.iChannel0 = ""
                else wallpaper.configuration.iChannel0 = iChannel0Field.text;
            }
        }
        TextField {
            id: iChannel0Field
            placeholderText: "path to iChannel0"
            text: wallpaper.configuration.iChannel0
            onEditingFinished: {
                wallpaper.configuration.iChannel0 =  iChannel0Field.text;
            }
        }

        Button {
            id: ich0FileButton
            icon.name: "x-shape-image-symbolic.svg"
            text: i18nd("@button:open_ich_dialog", "Select Image")
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
            checked: false
            onCheckedChanged: {
                if (!checked) wallpaper.configuration.iChannel1 = ""
                else wallpaper.configuration.iChannel1 = iChannel1Field.text;
            }
        }
        TextField {
            id: iChannel1Field
            placeholderText: "path to iChannel1"
            text: wallpaper.configuration.iChannel1
            onEditingFinished: {
                if(iChannel1Field.text !== "") iChannel1_flag.checked
                wallpaper.configuration.iChannel1 = iChannel1Field.text;
            }
        }

        Button {
            id: ich1FileButton
            icon.name: "x-shape-image-symbolic.svg"
            text: i18nd("@button:open_ich_dialog", "Select Image")
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
            checked: false
            onCheckedChanged: {
                if (!checked) wallpaper.configuration.iChannel2 = ""
                else wallpaper.configuration.iChannel2 = iChannel2Field.text;
            }
        }
        TextField {
            id: iChannel2Field
            placeholderText: "path to iChannel2"
            text: wallpaper.configuration.iChannel2
            onEditingFinished: {
                wallpaper.configuration.iChannel2 = iChannel2Field.text;
            }
        }

        Button {
            id: ich2FileButton
            icon.name: "x-shape-image-symbolic.svg"
            text: i18nd("@button:open_ich_dialog", "Select Image")
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
            checked: false
            onCheckedChanged: {
                if (!checked) wallpaper.configuration.iChannel3 = ""
                else wallpaper.configuration.iChannel3 = iChannel3Field.text;
            }
        }
        TextField {
            id: iChannel3Field
            placeholderText: "path to iChannel3"
            text: wallpaper.configuration.iChannel3
            onEditingFinished: {
                wallpaper.configuration.iChannel3 = iChannel3Field.text;
            }
        }

        Button {
            id: ich3FileButton
            icon.name: "x-shape-image-symbolic.svg"
            text: i18nd("@button:open_ich_dialog", "Select Image")
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
        visible: true
    }

    Kirigami.InlineMessage {
        id: warningResources
        Layout.fillWidth: true
        type: Kirigami.MessageType.Warning
        text: qsTr("Some shaders might consume more power than others, beware!")
        visible: true
    }

    Kirigami.InlineMessage {
        id: emergencyHelp
        Layout.fillWidth: true
        type: Kirigami.MessageType.Information
        text: qsTr("In case of emergency, delete folder in\n`~/.local/share/plasma/wallpaper/online.knowmad.shaderwallpaper`,\nthen run: \"pkill plasmashell && plasmashell &\" to relaunch it.\n\nUse with caution.")
        visible: true
    }
    Kirigami.InlineMessage {
        Layout.fillWidth: true
        text: qsTr("Submit your shaders on <a href=\"https://github.com/y4my4my4m/kde-shader-wallpaper\">Github</a> or open an issue for support/features!")
        visible: true
    }

    FileDialog {
        id: fileDialog
        fileMode : FileDialog.OpenFile
        title: i18nd("@dialog_title:choose_shader", "Choose a shader")
        nameFilters: [ "Shader files (*.frag, *.frag.qsb)", "All files (*)" ]
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
        nameFilters: [ "Image files (*.png, *.jpg)", "All files (*)" ]
        visible: false
        title: i18nd("@dialog_title:choose_ichannel", "Choose an Image")
        currentFolder: `${StandardPaths.writableLocation(StandardPaths.HomeLocation)}/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Resources/`
        onAccepted: {
            iChannel0Field.text = selectedFile
        }
    }

    FileDialog {
        id: fileDialog_ich1
        fileMode : FileDialog.OpenFile
        nameFilters: [ "Image files (*.png, *.jpg)", "All files (*)" ]
        visible: false
        title: i18nd("@dialog_title:choose_ichannel", "Choose an Image")
        currentFolder: `${StandardPaths.writableLocation(StandardPaths.HomeLocation)}/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Resources/`
        
        onAccepted: {
            iChannel1Field.text = fileDialog_ich1.fileUrls[0]
        }
    }

    FileDialog {
        id: fileDialog_ich2
        fileMode : FileDialog.OpenFile
        nameFilters: [ "Image files (*.png, *.jpg)", "All files (*)" ]
        visible: false
        title: i18nd("@dialog_title:choose_ichannel", "Choose an Image")
        currentFolder: `${StandardPaths.writableLocation(StandardPaths.HomeLocation)}/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Resources/`
        onAccepted: {
            iChannel2Field.text = fileDialog_ich2.fileUrls[0]
        }
    }
    FileDialog {
        id: fileDialog_ich3
        fileMode : FileDialog.OpenFile
        nameFilters: [ "Image files (*.png, *.jpg)", "All files (*)" ]
        visible: false
        title: i18nd("@dialog_title:choose_ichannel", "Choose an Image")
        currentFolder: `${StandardPaths.writableLocation(StandardPaths.HomeLocation)}/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Resources/`
        onAccepted: {
            iChannel3Field.text = fileDialog_ich3.fileUrls[0]
        }
    }
}
