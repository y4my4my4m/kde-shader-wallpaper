/*
 *
 *  Shader Wallpaper
 *  Copyright (C) 2020 @y4my4my4m | github.com/y4my4my4m
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 *  This software uses some of the QML code from JaredTao/jared2020@163.com's ToyShader for Android.
 *  See: https://github.com/jaredtao/TaoShaderToy/
 *
 *  Thanks to: Rog131 <samrog131@hotmail.com>, adhe <adhemarks2@gmail.com>
 *  for their work on the SmartVideoWallpaper plugin, I've used this as a reference for
 *  pausing the shader when fullscreen/maximed or when resources are busy
 *
 *  Thanks to github.com/simons-public for his contributions
 */

import QtQuick
import QtQuick.Controls

import org.kde.plasma.core
import org.kde.plasma.components as PlasmaComponents
import org.kde.plasma.extras as PlasmaExtras
import org.kde.plasma.plasmoid
import org.kde.plasma.plasma5support as P5Support
import Qt5Compat.GraphicalEffects

WallpaperItem {
    id: main

    WindowModel {
        id: windowModel
        screenGeometry: main.parent.screenGeometry
    }

    // Main
    ShaderEffect {
        id: shader
        anchors.fill: parent
        property vector3d iResolution: (wallpaper.width, wallpaper.height, 0)
        property real iTime: 0
        property int iFrame: 10
        property vector4d iMouse
        property var iDate

        property var iChannel0: wallpaper.configuration.iChannel0_flag ? ich0 : ""
        property var iChannel1: wallpaper.configuration.iChannel1_flag ? ich1 : ""
        property var iChannel2: wallpaper.configuration.iChannel2_flag ? ich2 : ""
        property var iChannel3: wallpaper.configuration.iChannel3_flag ? ich3 : ""

        property var iChannelResolution: [calcResolution(iChannel0), calcResolution(iChannel1), calcResolution(iChannel2), calcResolution(iChannel3)]
        readonly property vector3d defaultResolution: Qt.vector3d(shader.width, shader.height, shader.width / shader.height)
        function calcResolution(channel) {
            if (channel) {
                // return Qt.vector3d(channel.width, channel.height, channel.width / channel.height);

                return Qt.vector3d(1920, 1080, 1920 / 1080); // Magic numbers?
            } else {
                return Qt.vector3d(1920, 1080, 1920 / 1080);
                // return defaultResolution;
            }
        }

        fragmentShader: Qt.resolvedUrl(wallpaper.configuration.selectedShaderPath)

        Image {
            id: ich0
            source: Qt.resolvedUrl(wallpaper.configuration.iChannel0)
            visible: false
        }
        Image {
            id: ich1
            source: Qt.resolvedUrl(wallpaper.configuration.iChannel1)
            visible: false
        }
        Image {
            id: ich2
            source: Qt.resolvedUrl(wallpaper.configuration.iChannel2)
            visible: false
        }
        Image {
            id: ich3
            source: Qt.resolvedUrl(wallpaper.configuration.iChannel3)
            visible: false
        }
        Component.onCompleted: {
            // initialize properties
            // TODO: call on change if screenresized? or is KDE smart? :thinking:
            // seems to already be resolution responsive
            iResolution.x = wallpaper.width;
            iResolution.y = wallpaper.height;
        }
    }

    Component.onCompleted: Qt.createQmlObject(`import QtQuick
        MouseArea {
            id: mouseTrackingArea
            propagateComposedEvents: true
            preventStealing: false
            enabled: wallpaper.configuration.mouseAllowed
            anchors.fill: parent
            hoverEnabled: true
            onPositionChanged: (mouse) => {
                mouse.accepted = false
                shader.iMouse.x = mouseX * wallpaper.configuration.mouseSpeedBias
                shader.iMouse.y = -mouseY * wallpaper.configuration.mouseSpeedBias
            }
            onClicked:(mouse) => {
                mouse.accepted = false
                shader.iMouse.z = mouseX
                shader.iMouse.w = mouseY
            }
            // this still doesnt work... guess a C++ wrapper is all that can be done?
            onPressed:(mouse) => {
                mouse.accepted = false
            }
            onPressAndHold:(mouse) => {
                mouse.accepted = false
            }
            onDoubleClicked:(mouse) => {
                mouse.accepted = false
            }
            onCanceled:(mouse) => {
                mouse.accepted = false
            }
            onEntered:(mouse) => {
                mouse.accepted = false
            }
            onExited:(mouse) => {
                mouse.accepted = false
            }
            onReleased:(mouse) => {
                mouse.accepted = false
            }
            onWheel: (mouse) => {
                mouse.accepted = false
            }
        }`, parent.parent, "mouseTrackerArea")

    Timer {
        id: timer1
        running: wallpaper.configuration.running ? windowModel.runShader : false
        triggeredOnStart: true
        interval: 16
        repeat: true
        onTriggered: {
            var now = new Date();
            var year = now.getFullYear();
            var month = now.getMonth() + 1;
            var day = now.getDate();
            var hour = now.getHours();
            var minute = now.getMinutes();
            var second = now.getSeconds();
            var startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            var secondsSinceMidnight = (now - startOfDay) / 1000;

            shader.iTime += 0.016 * (wallpaper.configuration.shaderSpeed ? wallpaper.configuration.shaderSpeed : 1.0);
            shader.iFrame += 1;
            shader.iDate = Qt.vector4d(0., 0., 0., secondsSinceMidnight);
        }
    }
}
