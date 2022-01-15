import QtQuick 2.3
import QtQuick.Layouts 1
import QtQuick.Controls 1.2
import QtQuick.Window 2.15
import org.kde.plasma.core 2.0 as PlasmaCore

import "./Components"

Window {
    id: root
    // property alias cfg_selectedShader:   selectedShaderField.text
    // property int curIndex: 0;
    title: i18n("Desktop Shader Customization")
    width: 640;height: 480
    color: PlasmaCore.Theme.backgroundColor
    ColumnLayout {
        RowLayout {
            Layout.topMargin: 25
            Layout.leftMargin: 25
            Layout.rightMargin: 25
            Text {
                width: 100
                font.bold: true
                color: "white"
                font.pointSize: 16
                text: i18n("Customization:")
            }
        }
        RowLayout {
            ShaderCustomizer {
                Layout.bottomMargin: 25
                Layout.leftMargin: 25
                Layout.rightMargin: 25
                id: shaderCustomizer
                selectedShaderField: selectedShaderField
            }
        }
    }

}