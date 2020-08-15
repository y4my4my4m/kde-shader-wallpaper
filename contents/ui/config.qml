/*
 * Copyright (C) 2020 by Marcel Richter <Richter02@protonmail.com>
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Library General Public License as
 * published by the Free Software Foundation; either version 2 or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details
 *
 * You should have received a copy of the GNU Library General Public
 * License along with this program; if not, write to the
 * Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

import QtQuick 2.12
import QtQuick.Layouts 1
import QtQuick.Controls 2.12

ColumnLayout {
    // property alias cfg_DisplayPage: displayPageField.text
    // property alias cfg_ZoomFactor: zoomFactorSlider.value
    // property alias cfg_EnableInputFocus: enableInputFocusCheckBox.checked

    RowLayout {
        spacing: units.largeSpacing / 2
        Label {
            Layout.minimumWidth: width
            Layout.maximumWidth: width
            width: formAlignment - units.largeSpacing
            horizontalAlignment: Text.AlignRight

            text: "Select a Shader"
        }
        ComboBox {
            model: ListModel{
                ListElement { name: "3I23Rh"; path: "./Shader/Shader_3I23Rh.qml"}
                ListElement { name: "4ddfwx"; path: "./Shader/Shader_4ddfWX.qml"}
                ListElement { name: "Id3Gz2"; path: "./Shader/Shader_Id3Gz2.qml"}
                ListElement { name: "Waves"; path: "./Shader/Shader_Waves.qml"}
            }
            textRole: "name"
            onCurrentTextChanged: {
                main.toyLoader.source = model.get(currentIndex).path
            }
        }
        // ImageBtn {
        //     width: 32
        //     height: 32
        //     tipText: "Reset"
        //     imageUrl: "qrc:/Img/reset.png"
        //     onClicked: {
        //         toy.restart()
        //     }
        //     Rectangle {
        //         anchors.fill: parent
        //         color: "transparent"
        //         border.width: parent.containsMouse ? 1 : 0
        //         border.color: "gray"
        //     }
        // }
    //     ImageBtn {
    //         width: 32
    //         height: 32
    //         imageUrl: isPaused ?  "qrc:/Img/resume.png" : "qrc:/Img/pause.png"
    //         tipText: isPaused ? "Resume" : "Pause"
    //         property bool isPaused: false
    //         onClicked: {
    //             toy.running = isPaused
    //             isPaused = !isPaused;
    //         }
    //         Rectangle {
    //             anchors.fill: parent
    //             color: "transparent"
    //             border.width: parent.containsMouse ? 1 : 0
    //             border.color: "gray"
    //         }
    //     }
    //     Text {
    //         text: toy.iTime.toFixed(2)
    //         color: "black"
    //         anchors.verticalCenter: parent.verticalCenter
    //     }
    //     Text {
    //         text: fpsItem.fps + " fps"
    //         color: "black"
    //         anchors.verticalCenter: parent.verticalCenter
    //     }
    }

    Item {
        Layout.fillHeight: true
    }
}
