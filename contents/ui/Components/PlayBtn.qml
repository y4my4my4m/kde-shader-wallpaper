import QtQuick 2.12
import QtQuick.Controls 2.12
import QtQuick.Layouts 1
// Resume/Pause
Item {
    id: playBtnRoot
    property bool running: true
    property bool isPaused: false

    // ColumnLayout {
    // spacing: units.largeSpacing
    // Layout.fillWidth: true


    RowLayout {

        Label {
            width: 100
            text: i18n("Pause:")
        }
        ImageBtn {
            width: 32
            height: 32
            imageUrl: playBtnRoot.isPaused ? "../Resources/play.svg" : "../Resources/pause.svg"
            tipText: playBtnRoot.isPaused ? "Resume" : "Pause"
            onClicked: {
                playBtnRoot.running = isPaused
                isPaused = !isPaused;
            }
            Rectangle {
                anchors.fill: parent
                color: "transparent"
                border.width: parent.containsMouse ? 1 : 0
                border.color: "gray"
            }
        }

        Text {
            text: playBtnRoot.running ? fpsItem.fps + " fps" : "stopped"
            color: "white"
        }

    }
    // }
}