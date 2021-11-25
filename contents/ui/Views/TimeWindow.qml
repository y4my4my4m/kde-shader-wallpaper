import QtQuick 2.12
import QtQuick.Layouts 1
import QtQuick.Controls 2.12
import QtQuick.Window 2.15
//We need units from it
import org.kde.plasma.core 2.0 as Plasmacore
import org.kde.plasma.wallpapers.image 2.0 as Wallpaper
import org.kde.kquickcontrolsaddons 2.0

// import "../Components"

import org.kde.plasma.core 2.0 as PlasmaCore

Window {
  id: timeWindow
  property alias cfg_fadeToNext: checkFadeToNext.checked
  property alias cfg_fadeToRandom: checkFadeToRandom.checked

  //**********************
  //*** Configuration  ***
  //**********************

  ColumnLayout {

    //********************************
    //*** GUI Shader Customization ***
    //********************************

    //*******************
    //*** Performance ***
    //*******************


    ColumnLayout {

      RowLayout {

        // Timer {
        //     interval: 500;
        //     running: true;
        //     repeat: true;
        //     onTriggered: function() {
        //       time.text = Date().toString();
        //     }
        // }

        CheckBox {
          id: checkFadeToNext
          text: i18n("Fade to next")
          checked: true
          Timer {
            interval: fadeToNextTimerNum.value * 1000 * 60;
            running: checkFadeToNext.checked;
            repeat: true;
            onTriggered: function () {
              selectedShaderField.text = Qt.resolvedUrl("./Shaders/" + folderListModel.get(curIndex++, "fileName"));
              getShaderContent();
            }
          }
          onCheckedChanged: function () {
            if (checked) checkFadeToRandom.checked = false;
          }
        }

        SpinBox {
          id: fadeToNextTimerNum
          value: 3
          textFromValue: function (value) {
            return value + ' minutes';
          }
        }
      }
      RowLayout {

        CheckBox {
          id: checkFadeToRandom
          text: i18n("Fade to random")
          checked: true
          Timer {
            interval: fadeToRandomTimerNum.value * 1000 * 60;
            running: checkFadeToRandom.checked;
            repeat: true;
            onTriggered: function () {
              var tempIndex = Math.floor(Math.random(0, folderListModel.count) * folderListModel.count);
              selectedShaderField.text = Qt.resolvedUrl("./Shaders/" + folderListModel.get(tempIndex, "fileName"));
              getShaderContent();
            }
          }
          onCheckedChanged: function () {
            if (checked) checkFadeToNext.checked = false;
          }
        }

        SpinBox {
          id: fadeToRandomTimerNum
          value: 3
          textFromValue: function (value) {
            return value + ' minutes';
          }
        }
        Text {
          text: i18n(" OR every")
          color: "white"
        }
        Tumbler {
          id: dateTumbler
          model: ["day", "week", "2 weeks", "month", "4 months", "year"]
          delegate: delegateComponent
        }
        Text {
          text: i18n("at")
          color: "white"
        }
        RowLayout {
          Tumbler {
            id: hoursTumbler
            model: 12
            delegate: delegateComponent
          }

          Tumbler {
            id: minutesTumbler
            model: 60
            delegate: delegateComponent
          }
          Tumbler {
            id: amPmTumbler
            model: ["AM", "PM"]
            delegate: delegateComponent
          }
        }
        Text {
          id: time
          color: "white"
        }
      }

    }

  }

}


}

//*******************
//*** Components  ***
//*******************


// *********************
// ***     timer     ***
// *********************
function fadeTimer(desiredTime) {

}

}