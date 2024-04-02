import QtQuick 2.0

Rect {
    width: 1920
    height: 1080
    color: "red"
    id: mouseAreaTracker

    MouseArea {
        anchors.fill: parent
        hoverEnabled: true
        onPositionChanged: {
            console.log(mouseX, mouseY);
            parent.wallpaper.shader.mouseCoordinatesChanged(mouseX, mouseY)
        }
    }
}
