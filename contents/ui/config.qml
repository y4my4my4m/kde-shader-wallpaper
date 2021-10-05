import QtQuick 2.12
import QtQuick.Layouts 1
import QtQuick.Controls 2.12
import QtQuick.Dialogs 1.3
import Qt.labs.folderlistmodel 2
import QtQuick.Window 2.15
//We need units from it
import org.kde.plasma.core 2.0 as Plasmacore
import org.kde.plasma.wallpapers.image 2.0 as Wallpaper
import org.kde.kquickcontrolsaddons 2.0

import "./Components"
// import "./Views"


Item {
  id: configRoot
  property alias cfg_selectedShader:   selectedShaderField.text
  property int curIndex: 0;



  PlayBtn {
    id: playPause
    running: wallpaper.configuration.running
    // rootItem: fpsItem
  }

  //**********************
  //*** Configuration  ***
  //**********************
  ColumnLayout {

    //************************
    //*** Shader Selection ***
    //************************

    ColumnLayout {
      RowLayout {
        Button {
            // anchors.centerIn: parent
            text: qsTr("Click me")
            onClicked: {
                var component = Qt.createComponent("child.qml")
                if (component.status === Component.Ready) {
                  var window    = component.createObject("root")
                  window.show()
                }
            }
        }
      }
    }
    ColumnLayout {
      RowLayout {

        Label {
          Layout.minimumWidth: width
          Layout.maximumWidth: width
          width: formAlignment - units.largeSpacing /2
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
            currentIndex: curIndex;
            selectedShaderField.text = Qt.resolvedUrl("./Shaders/"+model.get(currentIndex, "fileName"));
            shaderCustomizer.getShaderContent();
          }
        }
      }

      RowLayout {

        Label {
          Layout.minimumWidth: width
          Layout.maximumWidth: width
          width: formAlignment - units.largeSpacing /2
          horizontalAlignment: Text.AlignRight
          text: "Shader Path:"
        }

        TextField {
          id: selectedShaderField
          Layout.minimumWidth: width
          Layout.maximumWidth: width
          width: 435
          onEditingFinished: {
            selectedShaderField.text;
            shaderCustomizer.getShaderContent();
          }
        }

        Button {
          id: imageButton
          implicitWidth: height
          // PlasmaCore.IconItem {
          //   anchors.fill: parent
          //   source: "document-open"
          //   PlasmaCore.ToolTipArea {
          //     anchors.fill: parent
          //     subText: "Pick Shader"
          //   }
          // }
          MouseArea {
            anchors.fill: parent
            onClicked: {
              fileDialog.folder = fileDialog.shortcuts.home+"/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Shaders/"
              fileDialog.open()
            }
          }
        }

      }

    }

    //********************************
    //*** GUI Shader Customization ***
    //********************************

    // Title
    RowLayout {
      Layout.topMargin: 25
      Layout.bottomMargin: 5
      Text {
        width:100
        font.bold: true
        color: "white"
        font.pointSize: 16
        text: i18n("Customization:")
      }
      Rectangle{
        Layout.fillWidth: true
        height: 1
        color: Qt.rgba(255,255,255,0.25);
      }
    }

    ShaderCustomizer {
      id: shaderCustomizer
      selectedShaderField: selectedShaderField
    }

  }

  //*******************
  //*** Components  ***
  //*******************

  FPSItem {
    id: fpsItem
    running: wallpaper.configuration.running
  }

}
