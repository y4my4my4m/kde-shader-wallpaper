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

Item {
  id: settingsRoot
  property alias cfg_checkGl3Ver: checkGl3Ver.checked
  property alias cfg_checkedSmartPlay: checkedSmartPlay.checked

  ColumnLayout {

    RowLayout {
      Layout.fillHeight: true
      Layout.fillWidth: true
      Layout.topMargin:30
      Text {
        width: 100
        color: "white"
        padding: 5
      }
      CheckBox {
        id: checkGl3Ver
        text: i18n("Compatibility mode (GL3 version)")
        checked: true
      }
    }
    // TODO: Fullscreen/Busy
    RowLayout {
      Text {
        width: 100
        color: "white"
        padding: 5
      }
      CheckBox {
        id: checkedSmartPlay
        checked: false
        text: i18n("Pause the shader when covered by maximized or full-screen windows.")
      }
    }
  }
}