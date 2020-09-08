import QtQuick 2.12
import QtQuick.Layouts 1
import QtQuick.Controls 2.12
import QtQuick.Dialogs 1.3
import Qt.labs.folderlistmodel 2
import "./Comp"

import org.kde.plasma.core 2.0 as PlasmaCore

Item {
  property alias cfg_selectedShader: selectedShaderField.text
  property alias cfg_checkGl3Ver:  checkGl3Ver.checked
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
    }

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
        text: "Support:"
      }
      Label {
        Layout.minimumWidth: width
        Layout.maximumWidth: width
        width: formAlignment - units.largeSpacing
        horizontalAlignment: Text.AlignLeft
        text: "<a href='https://github.com/y4my4my4m'>Github</a> | <a href='https://twitter.com/y4my4my4m'>Twitter</a>"
        onLinkActivated: Qt.openUrlExternally(link)
        MouseArea {
            anchors.fill: parent
            acceptedButtons: Qt.NoButton // we don't want to eat clicks on the Text
            cursorShape: parent.hoveredLink ? Qt.PointingHandCursor : Qt.ArrowCursor
        }
      }
    }

    RowLayout {
      spacing: units.largeSpacing / 2
    }

    RowLayout {
      spacing: units.largeSpacing
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
        text: "In case of emergency, delete folder in\n\"~/.local/share/plasma/wallpaper/online.knowmad.shaderwallpaper\",\nthen run: \"pkill plasmashell && plasmashell &\" to relaunch it.\n\nUse with caution."
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

  //********************************
  //*** GUI Shader Customization ***
  //********************************

  ColumnLayout {

    spacing: units.largeSpacing
    // Layout.minimumWidth: width
    // Layout.maximumWidth: width
    // width: formAlignment - units.largeSpacing
    anchors.verticalCenter: parent.verticalCenter


    RowLayout {
      ColumnLayout {
        spacing: units.largeSpacing
        Layout.minimumWidth: width
        Layout.maximumWidth: 340
        width: formAlignment - units.largeSpacing

        // Shader Speed
        Rectangle{
          width: 340;
          height: 1
          color: "#555"
        }
        Label {
          width:100
          text: i18n("Speed: %1\n(default is 1.0)", wallpaper.configuration.shaderSpeed)
        }
        Slider {
          from: 0.0
          to: 10.0
          id: speedSlider
          stepSize: 0.01
          Layout.fillWidth: true
          value: wallpaper.configuration.shaderSpeed ? wallpaper.configuration.shaderSpeed : 1.0
          onValueChanged: wallpaper.configuration.shaderSpeed = value
        }

        // Shader Color 1
        // TODO: Since the shader is just a long string, it should be possible to conditionally RegEx scan for
        //       any vec3(double,double,double) and procedurally add color pickers
        Rectangle{
          width: 340;
          height: 1
          color: "#555"
        }

        Button {
          id: colorDialogCheckbox
          text: i18n("Change default color")
          onClicked: {
            colorDialog.visible = !colorDialog.visible
          }
        }

        Rectangle{
          width: 340;
          height: 1
          color: "#555"
        }
      }
    }

    //*********************
    //*** Compatibility ***
    //*********************

    RowLayout {
      spacing: units.largeSpacing / 2
    }

    RowLayout {

      ColumnLayout {
        spacing: units.largeSpacing
        width: formAlignment - units.largeSpacing

        Label {
          width:100
          text: i18n("Compatibility:")
        }
        CheckBox {
          id: checkGl3Ver
          text: i18n("Change gl3 version\n")
          checked: true
        }
        Rectangle{
          width: 340;
          height: 1
          color: "#555"
        }

      }
    }

    ColorDialog {
        id: colorDialog
        title: "(Experimental) Please choose a color"
        onAccepted: {
            console.log("You chose: " + colorDialog.color)
            Qt.quit()
        }
        onRejected: {
            console.log("Canceled")
            Qt.quit()
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

  }


  //****************************
  //*** Shader Loading Logic ***
  //****************************

  function getShaderContent(){
    var xhr = new XMLHttpRequest;
    xhr.open("GET", selectedShaderField.text); // get from "file:///" string
    xhr.onreadystatechange = function () {
      if(xhr.readyState === XMLHttpRequest.DONE){
        var response = xhr.responseText;
        // console.log("shader content:\n"+response);
        wallpaper.configuration.selectedShaderContent = response;
      }
    }
    xhr.send();
  }

}
