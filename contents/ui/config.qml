import QtQuick 2.12
import QtQuick.Layouts 1
import QtQuick.Controls 2.12

ColumnLayout {

      property alias cfg_SelectedShader: selectedShaderField.text

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
                  ListElement { name: "Protean"; path: "./Shader/Shader_Protean.qml"}
                  ListElement { name: "Creation"; path: "./Shader/Shader_Creation.qml"}
                  ListElement { name: "SIG2014"; path: "./Shader/Shader_SIG2014.qml"}
                  ListElement { name: "Earthbound"; path: "./Shader/Shader_Earthbound.qml"}
                  ListElement { name: "Earthbound2"; path: "./Shader/Shader_Earthbound2.qml"}
                  ListElement { name: "Sanctuary"; path: "./Shader/Shader_Sanctuary.qml"}
                  ListElement { name: "Snail"; path: "./Shader/Shader_Snail.qml"}
                  ListElement { name: "Wolfenstein"; path: "./Shader/Shader_Wolfenstein.qml"}
                  ListElement { name: "Journey"; path: "./Shader/Shader_Journey.qml"}
                  ListElement { name: "Fovea"; path: "./Shader/Shader_Fovea.qml"}
                  ListElement { name: "Kirby"; path: "./Shader/Shader_Kirby.qml"}
                  ListElement { name: "Super Plumber"; path: "./Shader/Shader_SuperPlumber.qml"}
              }
              textRole: "name"
              onCurrentTextChanged: {
                  selectedShaderField.text = model.get(currentIndex).path
                  // console.debug(JSON.stringify(main.Loader))
                  // main.toyLoader.source = model.get(currentIndex).path
              }
          }

          // TODO: Add FPS/Pause GUI options
          // ImageBtn {
          //     width: 32
          //     height: 32
          //     tipText: "Reset"
          //     imageUrl: "qrc:/Img/reset.png"
          //     onClicked: {
          //         toy.restart()
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
          //     Text {
          //         text: toy.iTime.toFixed(2)
          //         color: "black"
          //         anchors.verticalCenter: parent.verticalCenter
          //     }
          //     Text {
          //         text: fpsItem.fps + " fps"
          //         color: "black"
          //         anchors.verticalCenter: parent.verticalCenter
          //     }
      }

      RowLayout {
          spacing: units.largeSpacing / 2

          Label {
              Layout.minimumWidth: width
              Layout.maximumWidth: width
              width: formAlignment - units.largeSpacing
              horizontalAlignment: Text.AlignRight
              text: "Load Shader from Path:"
          }
          TextField {
            id: selectedShaderField
            Layout.minimumWidth: width
            Layout.maximumWidth: width
            width: 435
          }
      }

      RowLayout {
          spacing: units.largeSpacing
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
              text: "Version 1.0 - Simply load shaders (current version)\nVersion 2.0 - Customize shaders via GUI\nVersion 3.0 - Directly load shaders from shadertoy.com or file"
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

      Item {
          Layout.fillHeight: true
      }
}
