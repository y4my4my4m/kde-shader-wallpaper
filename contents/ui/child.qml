import QtQuick 2.3
import QtQuick.Layouts 1
import QtQuick.Controls 1.2
import QtQuick.Window 2.15
import "./Components"

Window {
    id: root
    // property alias cfg_selectedShader:   selectedShaderField.text
    // property int curIndex: 0;
    title: i18n("Desktop Shader Customization")
    width: 400;height: 200
    color: "transparent"
    Text {
        anchors.centerIn: parent
        text: qsTr("Hello World.")
    }

    ColumnLayout {
        RowLayout {
            Layout.topMargin: 25
            Layout.bottomMargin: 25
            Layout.leftMargin: 25
            Layout.rightMargin: 25
            Text {
                width: 100
                font.bold: true
                color: "white"
                font.pointSize: 16
                text: i18n("Customization:")
            }
            Rectangle {
                Layout.fillWidth: true
                Layout.topMargin: 25
                Layout.bottomMargin: 25
                Layout.leftMargin: 25
                Layout.rightMargin: 25
                height: 1
                color: Qt.rgba(255, 255, 255, 0.25);
            }
        }
        ShaderCustomizer {
            id: shaderCustomizer
            selectedShaderField: selectedShaderField
        }
    }

}