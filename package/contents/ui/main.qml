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
import org.kde.plasma.core as PlasmaCore

import org.kde.plasma.plasma5support as P5Support
import org.kde.plasma.plasmoid
import Qt5Compat.GraphicalEffects

//import "./Components"

WallpaperItem {
    id: main

    ShaderEffect {
        anchors.fill: parent
        id: shader
        property vector3d       iResolution: (wallpaper.width, wallpaper.height, 0);
        property real           iTime: 0
        property int            iFrame: 10
        property vector4d       iMouse;
        property var            iDate;
        property var            iChannel0: ich0; //only Image or ShaderEffectSource
        property var            iChannel1: ich1; //only Image or ShaderEffectSource
        property var            iChannel2: ich2; //only Image or ShaderEffectSource
        property var            iChannel3: ich3; //only Image or ShaderEffectSource
        // property real        iTimeDelta: 100
        // property real        iFrameRate
        // property double      shaderSpeed: 1.0
        // property var         iChannelTime: [0, 1, 2, 3]
        // property var         iChannelResolution: [calcResolution(iChannel0), calcResolution(iChannel1), calcResolution(iChannel2), calcResolution(iChannel3)]

        // fragmentShader: wallpaper.configuration.selectedShaderPath
        fragmentShader: "Shaders6/channelImage.frag.qsb"

        Image {
            id: ich0
            // source: wallpaper.configuration.iChannel0_flag ? Qt.resolvedUrl(wallpaper.configuration.iChannel0) : ''
            source: Qt.resolvedUrl(wallpaper.configuration.iChannel0)
            visible:false
        }
        Image {
            id: ich1
            // source: wallpaper.configuration.iChannel1_flag ? Qt.resolvedUrl(wallpaper.configuration.iChannel1) : ''
            source: Qt.resolvedUrl(wallpaper.configuration.iChannel1)
            visible:false
        }
        Image {
            id: ich2
            // source: wallpaper.configuration.iChannel2_flag ? Qt.resolvedUrl(wallpaper.configuration.iChannel2) : ''
            source: Qt.resolvedUrl(wallpaper.configuration.iChannel2)
            visible:false
        }
        Image {
            id: ich3
            // source: wallpaper.configuration.iChannel3_flag ? Qt.resolvedUrl(wallpaper.configuration.iChannel3) : ''
            source: Qt.resolvedUrl(wallpaper.configuration.iChannel3)
            visible: false
        }
        // ShaderEffectSource {
        //     id: iChannel0Source
        //     live: true
        //     hideSource: true
        //     sourceItem: Image {}
        // }
        Component.onCompleted: {
            // initialize properties
            // TODO: call on change if screenresized? or is KDE smart? :thinking:
            iResolution.x = wallpaper.width;
            iResolution.y = wallpaper.height;
            // for (var property in wallpaper) {
            //     console.log(property + ": " + wallpaper[property]);
            // }
        }

        Timer {
            id: timer1
            running: true
            triggeredOnStart: true
            interval: 16
            repeat: true
            onTriggered: {
                var now = new Date();
                var year = now.getFullYear();
                var month = now.getMonth() +1;
                var day = now.getDate();
                var hour = now.getHours();
                var minute = now.getMinutes();
                var second = now.getSeconds();
                // console.log(iDateTime);
                var now = new Date();
                var startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                var secondsSinceMidnight = (now - startOfDay) / 1000;
                // for (var property in shader.parent.parent.parent.parent) {

                //     console.log(property + ": " + shader.parent.parent.parent.parent[property])
                // }
                // console.log(shader.iMouse.w, shader.iMouse.z);
                shader.iTime += 0.016 * (wallpaper.configuration.shaderSpeed ? wallpaper.configuration.shaderSpeed : 1.0) // TODO: surely not the right way to do this?.. oh well..
                shader.iFrame += 1;
                shader.iDate = Qt.vector4d(0., 0., 0., secondsSinceMidnight);
            }
        }
    }

    Component.onCompleted: Qt.createQmlObject(
        `import QtQuick
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
        }`,
        parent.parent.parent,
        "mouseTrackerArea"
    );
}
