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
    // property int curIndex: 0;

    RowLayout {
        Button {
            id: imageButton
            icon.name: "folder-shaders-symbolic"
            text: i18nd("@button:toggle_show_shaders", "Select shader")
            onClicked: {
                fileDialog.open()
            }
        }
        Button {
            icon.name: "visibility-symbolic"
            text: i18nd("@button:toggle_show_shaders", shadersList.visible ? "Hide shaders list" : "Show shaders list")
            checkable: true
            checked: shadersList.visible
            onClicked: {
                shadersList.visible = !shadersList.visible
            }
        }
    }

    RowLayout {

        Label {
            text: i18n("Speed: %1\n(default is 1.0)", wallpaper.configuration.shaderSpeed)
        }
        Slider {
            from: -10.0
            to: 10.0
            id: speedSlider
            stepSize: 0.01
            value: wallpaper.configuration.shaderSpeed ? wallpaper.configuration.shaderSpeed : 1.0
            onValueChanged: wallpaper.configuration.shaderSpeed = value
        }
    }

    ColumnLayout {
        id: shadersList
        visible: true
        Repeater {
            RowLayout {
                Button{
                    icon.name: "edit-delete-remove"
                    onClicked: {
                    }
                }
                Label {
                    text: index.toString() +" "
                    wrapMode: Text.Wrap
                    Layout.maximumWidth: 300
                    font: Kirigami.Theme.smallFont
                }
            }
        }
    }



    Kirigami.InlineMessage {
        id: warningResources
        Layout.fillWidth: true
        type: Kirigami.MessageType.Warning
        text: qsTr("Some shaders might consume more power than others!")
        visible: true
    }

    Label {
        text: qsTr("This is super early preview!\n Plasma6's Shader-Wallpaper is on it's way! :)")
        opacity: 1
        wrapMode: Text.Wrap
    }

    FileDialog {
        id: fileDialog
        fileMode : FileDialog.OpenFile
        title: i18nd("@dialog_title:pick_shader", "Pick a shader")
        nameFilters: [ "Shader files (*.frag, *.frag.qsb)", "All files (*)" ]
        visible: false
        currentFolder: Qt.resolvedUrl("./package/contents/ui/Shaders6")
        onAccepted: {
            console.log(selectedFile);
            wallpaper.configuration.selectedShaderPath = selectedFile; 
        }
    }
}