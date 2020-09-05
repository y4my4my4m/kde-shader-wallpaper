import QtQuick 2.12
import QtQuick.Layouts 1
import QtQuick.Controls 2.12
import QtQuick.Dialogs 1.2
import "./Comp"

import org.kde.plasma.core 2.0 as PlasmaCore

Item {
  property alias cfg_SelectedShader: selectedShaderField.text
  // property alias cfg_checkedSmartPlay: checkedSmartPlay.checked
  // property alias cfg_checkedBusyPlay:  checkedBusyPlay.checked

  // property bool isPaused: false

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
        model: ListModel{
          ListElement { name: "Waves"; path: "./Shader/Shader_Waves.qml"}
          ListElement { name: "Waves (Slower)"; path: "./Shader/Shader_Waves3.qml"}
          ListElement { name: "Protean"; path: "./Shader/Shader_Protean.qml"}
          ListElement { name: "Creation"; path: "./Shader/Shader_Creation.qml"}
          ListElement { name: "SIG2014"; path: "./Shader/Shader_SIG2014.qml"}
          ListElement { name: "Earthbound"; path: "./Shader/Shader_Earthbound.qml"}
          ListElement { name: "Earthbound2"; path: "./Shader/Shader_Earthbound2.qml"}
          ListElement { name: "Earthbound3"; path: "./Shader/Shader_Earthbound3.qml"}
          ListElement { name: "Earthbound4"; path: "./Shader/Shader_Earthbound4.qml"}
          ListElement { name: "Earthbound5"; path: "./Shader/Shader_Earthbound5.qml"}
          ListElement { name: "Sanctuary"; path: "./Shader/Shader_Sanctuary.qml"}
          ListElement { name: "Snail"; path: "./Shader/Shader_Snail.qml"}
          ListElement { name: "Wolfenstein"; path: "./Shader/Shader_Wolfenstein.qml"}
          ListElement { name: "Journey"; path: "./Shader/Shader_Journey.qml"}
          ListElement { name: "Fovea"; path: "./Shader/Shader_Fovea.qml"}
          ListElement { name: "Kirby"; path: "./Shader/Shader_Kirby.qml"}
          ListElement { name: "Super Plumber"; path: "./Shader/Shader_SuperPlumber.qml"}
          ListElement { name: "Matrix"; path: "./Shader/Shader_Matrix.qml"}
          ListElement { name: "Matrix2"; path: "./Shader/Shader_Matrix2.qml"}
        }
        textRole: "name"
        onCurrentTextChanged: {
          selectedShaderField.text = model.get(currentIndex).path
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
              onClicked: {fileDialog.open() }
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
        text: "Version 1.0 - Simply load shaders\nVersion 1.1 - File Dialog added (current version)\nVersion 2.0 - Customize shaders via GUI\nVersion 3.0 - Directly load shaders from shadertoy.com or file"
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

    // ColumnLayout {
    //   spacing: units.largeSpacing
    //   Layout.minimumWidth: width
    //   Layout.maximumWidth: width
    //   width: formAlignment - units.largeSpacing
    //   anchors.verticalCenter: parent.verticalCenter
    //
    //   RowLayout {
    //     spacing: units.largeSpacing / 2
    //   }
    //
    //   RowLayout{
    //     spacing: units.largeSpacing
    //     Layout.minimumWidth: width
    //     Layout.maximumWidth: width
    //     width: formAlignment - units.largeSpacing
    //     Rectangle{
    //       width: 240;
    //       height: 1
    //       color: "#555"
    //     }
    //   }
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
    //   RowLayout{
    //     spacing: units.largeSpacing
    //     Layout.minimumWidth: width
    //     Layout.maximumWidth: width
    //     Rectangle{
    //       width: 240;
    //       height: 1
    //       color: "#555"
    //     }
    //   }
    // }


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
        }
    }
  }
}
