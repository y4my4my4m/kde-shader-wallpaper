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
    // property alias cfg_selectedShader:   selectedShaderField.text
    // property alias cfg_checkGl3Ver:      checkGl3Ver.checked
    // property alias cfg_checkedSmartPlay: checkedSmartPlay.checked
    // property alias cfg_iChannel0_flag:   iChannel0_flag.checked
    // property alias cfg_iChannel1_flag:   iChannel1_flag.checked
    // property alias cfg_iChannel2_flag:   iChannel2_flag.checked
    // property alias cfg_iChannel3_flag:   iChannel3_flag.checked
    // property alias cfg_fadeToNext:       checkFadeToNext.checked
    // property alias cfg_fadeToRandom:     checkFadeToRandom.checked
    property int curIndex: 0;
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
                    text: fileBaseName.replace("_"," ")
                }
            }

            textRole: "fileBaseName"
            displayText: currentText.replace("_"," ")

            onCurrentTextChanged: {
                currentIndex: curIndex;
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
        title: i18nd("@dialog_title:pick_shader", "Pick a shader")
        nameFilters: [ "Shader files (*.frag, *.frag.qsb)", "All files (*)" ]
        visible: false
        currentFolder: `${StandardPaths.writableLocation(StandardPaths.HomeLocation)}/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Shaders6/`
        onAccepted: {
            wallpaper.configuration.selectedShaderPath = selectedFile; 
        }
    }
}