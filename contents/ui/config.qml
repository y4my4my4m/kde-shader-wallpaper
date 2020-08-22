import QtQuick 2.12
import QtQuick.Layouts 1
import QtQuick.Controls 2.12
import Qt.labs.folderlistmodel 2

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
              Layout.minimumWidth: width
              Layout.maximumWidth: width
              width: 435

              model: FolderListModel {
                  id: folderListModel
                  showDirs: false
                  nameFilters: ["*.qml"]
                  folder: "./Shader"
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
                  selectedShaderField.text = "./Shader/" + model.get(currentIndex, "fileName")
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
