import QtQuick 2.12
import QtQuick.Layouts 1
import QtQuick.Controls 2.12
import QtQuick.Dialogs 1.3
import Qt.labs.folderlistmodel 2
import "./Comp"

import org.kde.plasma.core 2.0 as PlasmaCore

Item {
  property alias cfg_selectedShader: selectedShaderField.text
  // property alias cfg_selectedShaderContent: ""
  property alias cfg_checkGl3Ver:  checkGl3Ver.checked
  // property double cfg_shaderSpeed: shaderSpeedVal
  // property alias cfg_checkedSmartPlay: checkedSmartPlay.checked
  // property alias cfg_checkedBusyPlay:  checkedBusyPlay.checked

  // property bool isPaused: false
  function getShaderContent(){
    var xhr = new XMLHttpRequest;
    xhr.open("GET", selectedShaderField.text); // set Method and File
    xhr.onreadystatechange = function () {
      if(xhr.readyState === XMLHttpRequest.DONE){ // if request_status == DONE
        var response = xhr.responseText;
        // console.log("shader content:\n"+response);
        wallpaper.configuration.selectedShaderContent = response;
      }
    }
    xhr.send(); // begin the request
  }

  RowLayout {
    spacing: units.largeSpacing / 2
  }

  ColumnLayout {

    RowLayout {
      spacing: units.largeSpacing / 2
    }

    RowLayout {
      spacing: units.largeSpacing / 2
      Label {
        Layout.minimumWidth: width
        Layout.maximumWidth: width
        width: formAlignment - units.largeSpacing
        horizontalAlignment: Text.AlignRight
        text: "Selected Shader:"
      }

      ComboBox {
        id: selectedShader
        Layout.minimumWidth: width
        Layout.maximumWidth: width
        width: 435
        model: FolderListModel {
            id: folderListModel
            showDirs: false
            nameFilters: ["*.frag"]
            folder: "./Shaders"
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
          selectedShaderField.text = Qt.resolvedUrl("./Shaders/"+model.get(currentIndex, "fileName"));
          getShaderContent();
        }
      }

      // TODO: Add FPS/Pause GUI options
      // Image {
      //     source: "./Img/reset.png"
      //     width: 32
      //     height: 32
      //
      //     MouseArea {
      //         anchors.fill: parent
      //         onClicked: {
      //           // toy.restart()
      //           // console.log(root)
      //         }
      //     }
      // }
      //
      // Image {
      //     width: 32
      //     height: 32
      //     source: isPaused ?  "./Img/resume.png" : "./Img/pause.png"
      //
      //     MouseArea {
      //         anchors.fill: parent
      //         onClicked: {
      //           isPaused = !isPaused;
      //           // root.toyLoader.doPause(isPaused)
      //           // toy.running != toy.running
      //         }
      //     }
      //     Rectangle {
      //         anchors.fill: parent
      //         color: "transparent"
      //         border.width: parent.containsMouse ? 1 : 0
      //         border.color: "gray"
      //     }
      // }


      // ImageBtn {
      //     width: 32
      //     height: 32
      //     tipText: "Reset"
      //     imageUrl: "./Img/reset.png"
      //     onClicked: {
      //         // toy.restart()
      //     }
      //     Rectangle {
      //         anchors.fill: parent
      //         color: "transparent"
      //         border.width: parent.containsMouse ? 1 : 0
      //         border.color: "gray"
      //     }
      // }
      //     ImageBtn {
      //         width: 32
      //         height: 32
      //         imageUrl: isPaused ?  "qrc:/Img/resume.png" : "qrc:/Img/pause.png"
      //         tipText: isPaused ? "Resume" : "Pause"
      //         property bool isPaused: false
      //         onClicked: {
      //             toy.running = isPaused
      //             isPaused = !isPaused;
      //         }
      //         Rectangle {
      //             anchors.fill: parent
      //             color: "transparent"
      //             border.width: parent.containsMouse ? 1 : 0
      //             border.color: "gray"
      //         }
      //     }
    }

    // TShaderToy {
    //   id: toy
    // }
    // FPSItem {
    //     id: fpsItem
    //     running: toy.running
    // }
    // RowLayout {
    //   spacing: units.largeSpacing / 2
    //
    //   Text {
    //       Layout.minimumWidth: width
    //       Layout.maximumWidth: width
    //       width: formAlignment - units.largeSpacing
    //       horizontalAlignment: Text.AlignRight
    //       text: toy.iTime.toFixed(2) + ":"
    //       color: "white"
    //       anchors.verticalCenter: parent.verticalCenter
    //   }
    //   Text {
    //       Layout.minimumWidth: width
    //       Layout.maximumWidth: width
    //       width: formAlignment - units.largeSpacing
    //       text: fpsItem.fps + " fps"
    //       color: "white"
    //       anchors.verticalCenter: parent.verticalCenter
    //   }
    // }

    RowLayout {
      spacing: units.largeSpacing / 2

      Label {
        Layout.minimumWidth: width
        Layout.maximumWidth: width
        width: formAlignment - units.largeSpacing
        horizontalAlignment: Text.AlignRight
        text: "Shader Path:"
      }
      TextField {
        id: selectedShaderField
        Layout.minimumWidth: width
        Layout.maximumWidth: width
        width: 435
      }
      Button {
          id: imageButton
          implicitWidth: height
          PlasmaCore.IconItem {
              anchors.fill: parent
              source: "document-open"
              PlasmaCore.ToolTipArea {
                  anchors.fill: parent
                  subText: "Pick Shader"
              }
          }
          MouseArea {
              anchors.fill: parent
              onClicked: {
                fileDialog.folder = fileDialog.shortcuts.home+"/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Shaders/"
                fileDialog.open()
              }
          }
      }
    }

    RowLayout {
      spacing: units.largeSpacing / 2
      Label {
        Layout.minimumWidth: width
        Layout.maximumWidth: width
        width: formAlignment - units.largeSpacing
        horizontalAlignment: Text.AlignRight
        text: "Roadmap:"
      }
      Label {
        Layout.minimumWidth: width
        Layout.maximumWidth: width
        width: formAlignment - units.largeSpacing
        horizontalAlignment: Text.AlignLeft
        text: "Version 1.2 - iGPU fix\nVersion 1.3 - list all + 70 new shaders(current version)\nVersion 2.0 - Customize shaders via GUI\nVersion 3.0 - Directly load shaders from shadertoy.com or file"
      }
    }

    RowLayout {
      spacing: units.largeSpacing / 2
    }

    RowLayout {
      spacing: units.largeSpacing / 2
      Label {
        Layout.minimumWidth: width
        Layout.maximumWidth: width
        width: formAlignment - units.largeSpacing
        horizontalAlignment: Text.AlignRight
        text: "Notice:"
      }
      Label {
        Layout.minimumWidth: width
        Layout.maximumWidth: width
        width: formAlignment - units.largeSpacing
        horizontalAlignment: Text.AlignLeft
        text: "Some high quality wallpapers have poor performance on high resolution (2k+)\nor depending on your GPU.\n\nIn case of emergency, delete folder in\n\"~/.local/share/plasma/wallpaper/online.knowmad.shaderwallpaper\",\nthen run: \"pkill plasmashell && plasmashell &\" to relaunch it.\n\nUse with caution."
      }
    }

    ColumnLayout {
      spacing: units.largeSpacing
      Layout.minimumWidth: width
      Layout.maximumWidth: width
      width: formAlignment - units.largeSpacing
      anchors.verticalCenter: parent.verticalCenter

      RowLayout {
        spacing: units.largeSpacing / 2
      }

      RowLayout {
        spacing: units.largeSpacing
        Layout.minimumWidth: width
        Layout.maximumWidth: width
        width: formAlignment - units.largeSpacing
        Rectangle{
          width: 300;
          height: 1
          color: "#555"
        }
      }
      RowLayout{
        spacing: units.largeSpacing / 2
        Layout.minimumWidth: width
        Layout.maximumWidth: width
        width: formAlignment - units.largeSpacing
        CheckBox {
          id: checkGl3Ver
          text: i18n("Change gl3 version\nfor shader compatibility")
          checked: false
          onCheckedChanged: {
            // none of this works...how to reference the main.qml lol
            // console.log(JSON.stringify(main))
            // console.log(JSON.stringify(Item.toy))
          }
        }
      }


      RowLayout{
        spacing: units.largeSpacing / 2
        Layout.minimumWidth: width
        Layout.maximumWidth: width
        width: formAlignment - units.largeSpacing
        Label {
          // Layout.fillWidth: true
          width:100
          text: i18n("Speed: %1", wallpaper.configuration.shaderSpeed)
        }
        Slider {
          Layout.fillWidth: true
          // value: cfg_shaderSpeed
          // defaults to a real range of [0..1]
          // value: previewImage.hue
          value: wallpaper.configuration.shaderSpeed
          onValueChanged: wallpaper.configuration.shaderSpeed = value
        }
      }
    //
    //   RowLayout{
    //     spacing: units.largeSpacing / 2
    //     Layout.minimumWidth: width
    //     Layout.maximumWidth: width
    //     width: formAlignment - units.largeSpacing
    //     CheckBox {
    //       id: checkedSmartPlay
    //       text: i18n("Pause when maximized or fullscreen")
    //       checked: false
    //       // onCheckedChanged: {
    //       //     checkedBusyPlay.checked = !checkedSmartPlay.checked
    //       // }
    //     }
    //   }
    //
    //   RowLayout{
    //     spacing: units.largeSpacing / 2
    //     Layout.minimumWidth: width
    //     Layout.maximumWidth: width
    //     CheckBox {
    //       id: checkedBusyPlay
    //       text: i18n("Pause when PC needs resources")
    //       checked: false
    //       // onCheckedChanged: {
    //       //     checkedSmartPlay.checked = !checkedBusyPlay.checked
    //       // }
    //     }
    //   }
      RowLayout{
        spacing: units.largeSpacing
        Layout.minimumWidth: width
        Layout.maximumWidth: width
        Rectangle{
          width: 340;
          height: 1
          color: "#555"
        }
      }

    }


    Item {
      Layout.fillHeight: true
    }

    FileDialog {
        id: fileDialog
        selectMultiple : false
        title: "Pick a shader file"
        // nameFilters: [ "Video files (*.mp4 *.mpg *.ogg *.mov *.webm *.flv *.matroska *.avi *wmv)", "All files (*)" ]
        onAccepted: {
            selectedShaderField.text = fileDialog.fileUrls[0]
            getShaderContent();
        }
    }
  }
}
