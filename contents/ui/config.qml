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
  property alias cfg_selectedShader: selectedShaderField.text
  property int curIndex: 0;




  //************************
  //*** Shader Selection ***
  //************************

  ColumnLayout {
    RowLayout {

      Label {
        Layout.minimumWidth: width
        Layout.maximumWidth: width
        width: formAlignment - units.largeSpacing / 2
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
            text: fileBaseName.replace("_", " ")
          }
        }

        textRole: "fileBaseName"
        displayText: currentText.replace("_", " ")

        onCurrentTextChanged: {
          currentIndex: curIndex;
          selectedShaderField.text = Qt.resolvedUrl("./Shaders/" + model.get(currentIndex, "fileName"));
          shaderCustomizer.getShaderContent();
        }
      }
    }

    RowLayout {

      Label {
        Layout.minimumWidth: width
        Layout.maximumWidth: width
        width: formAlignment - units.largeSpacing / 2
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
            fileDialog.folder = fileDialog.shortcuts.home + "/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/Shaders/"
            fileDialog.open()
          }
        }
      }

    }

  // }

  //********************************
  //*** GUI Shader Customization ***
  //********************************

  // Title
  // ColumnLayout {
  //   RowLayout {
  //     Layout.topMargin: 25
  //     Layout.bottomMargin: 5
  //     Text {
  //       width:100
  //       font.bold: true
  //       color: "white"
  //       font.pointSize: 16
  //       text: i18n("Customization:")
  //     }
  //     Rectangle{
  //       Layout.fillWidth: true
  //       height: 1
  //       color: Qt.rgba(255,255,255,0.25);
  //     }
  //   }

  //   ShaderCustomizer {
  //     id: shaderCustomizer
  //     selectedShaderField: selectedShaderField
  //   }

  // }
  //*******************
  //*** Components  ***
  //*******************


  //**********************
  //*** Configuration  ***
  //**********************
  // ColumnLayout {
    RowLayout {
      PlayBtn {
        id: playPause
        running: wallpaper.configuration.running
        // rootItem: fpsItem
      }
    }
    // Shader Speed
    RowLayout {

      Layout.minimumHeight: height
      width: formAlignment - units.largeSpacing / 2

      Text {
        color: "white"
        padding: 5
        width: 100
        text: i18n("Speed: %1\n(default is 1.0)", wallpaper.configuration.shaderSpeed)
      }

      Slider {
        from: -10.0
        to: 10.0
        id: speedSlider
        stepSize: 0.01
        Layout.fillWidth: true
        value: wallpaper.configuration.shaderSpeed ? wallpaper.configuration.shaderSpeed : 1.0
        onValueChanged: wallpaper.configuration.shaderSpeed = value
      }
      Text {
        text: ""
        padding: 5
      }
      Rectangle {
        // anchors.fill: parent
        // anchors.centerIn: parent
        border.color: Qt.rgba(255, 255, 255, 0.05)
        border.width: 1
        radius: 4
        color: "transparent"
      }
    }


    RowLayout {
      Button {
        // anchors.centerIn: parent
        text: qsTr("Customize Shader")
        onClicked: {
          var component = Qt.createComponent("child.qml")
          if (component.status === Component.Ready) {
            var window = component.createObject("root")
            window.show()
          }
        }
      }
    }
  }

  ColumnLayout {
    RowLayout {
      FPSItem {
        id: fpsItem
        running: wallpaper.configuration.running
      }
    }
  }

  // Support
  ColumnLayout {

    Layout.fillWidth: true
    Label {
      font.bold: true
      font.pointSize: 14
      text: "Support:"
    }

    Text {
      text: "<a href='https://github.com/y4my4my4m'>Github</a> | <a href='https://twitter.com/y4my4my4m'>Twitter</a>"
      onLinkActivated: Qt.openUrlExternally(link)
      color: "white"
      MouseArea {
        anchors.fill: parent
        acceptedButtons: Qt.NoButton // we don't want to eat clicks on the Text
        cursorShape: parent.hoveredLink ? Qt.PointingHandCursor : Qt.ArrowCursor
      }
    }
  }

  // Content
  ColumnLayout {
    Layout.fillHeight: true
    Layout.fillWidth: true
    // Notice
    RowLayout {
      Layout.bottomMargin: 20
      Text {
        color: "white"
        text: "In case of emergency, delete folder in\n\"~/.local/share/plasma/wallpaper/online.knowmad.shaderwallpaper\",\nthen run: \"pkill plasmashell && plasmashell &\" to relaunch it.\n\nUse with caution."
      }
    }

    RowLayout {
      Layout.fillWidth: true
      // Donation
      ColumnLayout {
        Layout.fillWidth: true
        Layout.bottomMargin: 20
        Layout.maximumWidth: 200
        Label {
          font.bold: true
          font.pointSize: 14
          text: "Donate:"
        }

        Text {
          Layout.minimumWidth: width
          Layout.maximumWidth: width
          width: formAlignment - units.largeSpacing
          horizontalAlignment: Text.AlignLeft
          text: "<a href='https://ko-fi.com/y4my4my4m'>ko-fi</a>"
          onLinkActivated: Qt.openUrlExternally(link)
          color: "white"
          MouseArea {
            anchors.fill: parent
            acceptedButtons: Qt.NoButton
            cursorShape: parent.hoveredLink ? Qt.PointingHandCursor : Qt.ArrowCursor
          }
        }
      }

    }
  }
}