import QtQuick 2.3
import QtQuick.Layouts 1
import QtQuick.Controls 1.2
import QtQuick.Window 2.15

Window {
    id: root
    width: 100; height: 100
    
    property alias cfg_fadeToNext:       checkFadeToNext.checked
    property alias cfg_fadeToRandom:     checkFadeToRandom.checked

    Text {
        anchors.centerIn: parent
        text: qsTr("Hello World.")
    }

}
