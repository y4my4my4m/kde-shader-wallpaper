import QtQuick 2.12
import QtQuick.Controls 2.12
Item {
    id: fpsRoot
    property int fps: 144
    property int frameCount: 0
    property bool running: true

    Item {
        width: 32
        height: 32
        RotationAnimation on rotation {
            from: 0
            to: 360
            running: true
            loops: Animation.Infinite
            duration: 1000
        }
        onRotationChanged: frameCount++
    }
    Timer {
        interval: 1000
        repeat: true
        running: fpsRoot.running
        onRunningChanged: {
            if (running) {
                fps = 144
                frameCount = 0
            }
        }
        onTriggered: {
            fps = frameCount
            frameCount = 0
        }
    }
}
