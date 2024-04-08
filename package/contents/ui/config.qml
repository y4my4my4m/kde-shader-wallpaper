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
    property alias cfg_pauseMode: pauseModeCombo.currentIndex
    property bool cfg_isPaused: runningCombo.checked
    
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
    ComboBox {
        Kirigami.FormData.label: i18nd("@buttonGroup:pause_mode", "Pause:")
        id: pauseModeCombo
        model: [
            {
                'label': i18nd("@option:pause_mode", "Maximized or full-screen windows")
            },
            {
                'label': i18nd("@option:pause_mode", "Active window is present")
            },
            {
                'label': i18nd("@option:pause_mode", "At least one window is shown")
            },
            {
                'label': i18nd("@option:pause_mode", "Never")
            }
        ]
        textRole: "label"
        onCurrentIndexChanged: cfg_pauseMode = currentIndex
        currentIndex: cfg_pauseMode
    }
    CheckBox {
        id: activeScreenOnlyCheckbx
        Kirigami.FormData.label: i18nd("@checkbox:screen_filter", "Filter:")
        checked: wallpaper.configuration.checkActiveScreen
        text: i18n("Only check for windows in active screen")
        onCheckedChanged: {
            wallpaper.configuration.checkActiveScreen = checked
        }
    }
    // use Item instead to remove the line
    Kirigami.Separator {
        Kirigami.FormData.isSection: true
        Kirigami.FormData.label: i18nd("online.knowmad.shaderwallpaper", "Configuration:");
    }

    RowLayout{
        Kirigami.FormData.label: i18nd("online.knowmad.shaderwallpaper", cfg_isPaused ? "Playing" : "Paused");
        CheckBox {
            id: runningCombo
            checked: wallpaper.configuration.running
            text: i18n("Play/Pause the shader")
            onCheckedChanged: {
                wallpaper.configuration.running = checked
            }
        }
    }

    RowLayout {
        Kirigami.FormData.label: i18nd("online.knowmad.shaderwallpaper", "Shader speed:");
        ColumnLayout {
            Slider {
                Layout.preferredWidth: Kirigami.Units.gridUnit * 16
                from: -10.0
                to: 10.0
                id: speedSlider
                stepSize: 0.01
                value: wallpaper.configuration.shaderSpeed ? wallpaper.configuration.shaderSpeed : 1.0
                onValueChanged: {
                    shaderSpeedField.text = String(value.toFixed(2));
                    wallpaper.configuration.shaderSpeed = shaderSpeedField.text;
                }
            }
        }
        ColumnLayout {
            TextField {
                id: shaderSpeedField
                text: wallpaper.configuration.shaderSpeed ? String(wallpaper.configuration.shaderSpeed.toFixed(2)) : "1.00"
                inputMethodHints: Qt.NumberInput
                Layout.preferredWidth: Kirigami.Units.gridUnit * 3
                onEditingFinished: {
                    let inputValue = parseFloat(text);
                    if (isNaN(inputValue) || inputValue < speedSlider.from) {
                        inputValue = speedSlider.from;
                    } else if (inputValue > speedSlider.to) {
                        inputValue = speedSlider.to;
                    }
                    text = inputValue.toFixed(2);
                    speedSlider.value = inputValue;
                    wallpaper.configuration.shaderSpeed = inputValue;
                }
                Keys.onPressed: {
                    if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
                        shaderSpeedField.focus = false; // Unfocus the TextField
                        event.accepted = true; // Prevent further propagation of the key event
                    }
                }
                background: Rectangle {
                    color: shaderSpeedField.activeFocus ? "white" : "transparent"
                    border.color: shaderSpeedField.activeFocus ? "#3DAEE9" : "transparent"
                    border.width: 1
                    radius: 2
                    anchors.fill: shaderSpeedField
                    anchors.margins: -2
                }
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
            ToolTip.visible: hovered
            ToolTip.text: qsTr("Enabling this will allow the shader to interact with the cursor but will prevent interaction with desktop elements")
        }
    }

    RowLayout {
        visible: wallpaper.configuration.mouseAllowed
        Kirigami.FormData.label: i18nd("online.knowmad.shaderwallpaper", "Mouse bias:");
        ColumnLayout {
            Slider {
                Layout.preferredWidth: Kirigami.Units.gridUnit * 16
                from: -10.0
                to: 10.0
                id: mouseBiasSlider
                stepSize: 0.01
                value: wallpaper.configuration.mouseSpeedBias ? wallpaper.configuration.mouseSpeedBias : 1.0
                onValueChanged: {
                    mouseBiasField.text = String(value.toFixed(2));
                    wallpaper.configuration.mouseSpeedBias = mouseBiasField.text;
                }
            }
        }
        ColumnLayout {
            TextField {
                id: mouseBiasField
                text: wallpaper.configuration.mouseSpeedBias ? String(wallpaper.configuration.mouseSpeedBias.toFixed(2)) : "1.00"
                inputMethodHints: Qt.NumberInput
                Layout.preferredWidth: Kirigami.Units.gridUnit * 3
                onEditingFinished: {
                    let inputValue = parseFloat(text);
                    if (isNaN(inputValue) || inputValue < mouseBiasSlider.from) {
                        inputValue = mouseBiasSlider.from;
                    } else if (inputValue > mouseBiasSlider.to) {
                        inputValue = mouseBiasSlider.to;
                    }
                    text = inputValue.toFixed(2);
                    mouseBiasSlider.value = inputValue;
                    wallpaper.configuration.mouseSpeedBias = inputValue;
                }
                Keys.onPressed: {
                    if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
                        mouseBiasField.focus = false; // Unfocus the TextField
                        event.accepted = true; // Prevent further propagation of the key event
                    }
                }
                background: Rectangle {
                    color: mouseBiasField.activeFocus ? "white" : "transparent"
                    border.color: mouseBiasField.activeFocus ? "#3DAEE9" : "transparent"
                    border.width: 1
                    radius: 2
                    anchors.fill: mouseBiasField
                    anchors.margins: -2
                }
            }
        }
    }

    Kirigami.InlineMessage {
        id: infoiChannelSettings
        Layout.fillWidth: true
        type: Kirigami.MessageType.Info
        text: qsTr("Different shaders use different iChannels!\nPlay with the settings below!")
        showCloseButton: true
        visible: !wallpaper.configuration.infoiChannelSettings_dismissed
        onVisibleChanged: {
            wallpaper.configuration.infoiChannelSettings_dismissed = true;
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
                wallpaper.configuration.iChannel0 = iChannel0Field.text;
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
                wallpaper.configuration.iChannel1 = iChannel1Field.text;
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
                wallpaper.configuration.iChannel2 = iChannel2Field.text;
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
                wallpaper.configuration.iChannel3 = iChannel3Field.text;
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

    RowLayout{
        spacing:  Kirigami.Units.gridUnit * 10
        Button {
            Layout.preferredWidth: Kirigami.Units.gridUnit * 5
            Layout.preferredHeight: Kirigami.Units.gridUnit * 3
            
            id: emergencyHelpButton
            icon.name: "help-about-symbolic"
            text: i18nd("@button:toggle_emergency_help", "Help!")
            onClicked: {
            emergencyHelp.open()
            }
        }

        Button {
            id: kofiButton
            Layout.preferredWidth: Kirigami.Units.gridUnit * 5
            Layout.preferredHeight: Kirigami.Units.gridUnit * 3
            
            contentItem: RowLayout {
                AnimatedImage {
                    source: "Resources/kofi.gif"
                    sourceSize.width: 36
                    sourceSize.height: 36
                    fillMode: Image.Pad
                    horizontalAlignment: Image.AlignLeft
                    transform: Translate { x: 8 }
                }
                Text {
                    text: i18nd("@button:kofi", "Kofi")      
                    horizontalAlignment: Text.AlignHCenter      
                    transform: Translate { x: -8 }            
                }
            }
            onClicked: {
                Qt.openUrlExternally("https://ko-fi.com/I2I525V5R")
            }
        }
    }

    Kirigami.InlineMessage {
        Layout.preferredWidth: Kirigami.Units.gridUnit * 20
        text: qsTr("Submit your shaders on <a href=\"https://github.com/y4my4my4m/kde-shader-wallpaper\">Github</a> or open an issue for support/features!")
        onLinkActivated: Qt.openUrlExternally(link)
        visible: true
    }

    RowLayout {
        Layout.bottomMargin: 20 
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
