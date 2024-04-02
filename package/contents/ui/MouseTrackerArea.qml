import QtQuick

MouseArea {
    id: mouseTrackingArea
    propagateComposedEvents: true
    preventStealing: true
    enabled: true
    anchors.fill: parent
    hoverEnabled: true
    onPositionChanged: {
        shader.iMouse.x = mouseX
        shader.iMouse.y = mouseY
    }
    onClicked: {
        shader.iMouse.z = mouseX
        shader.iMouse.w = mouseY
    }
}