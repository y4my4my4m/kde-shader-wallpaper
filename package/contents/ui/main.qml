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
        property var screen: Screen
        property var screenSize: !!screen.geometry ? Qt.size(screen.geometry.width, screen.geometry.height):  Qt.size(screen.width, screen.height)
        property vector3d   iResolution: screenSize
        // property int        screenWidth: Screen.width
        // property int        screenHeight: Screen.height
        // property real       iTime: 0
        // property real       iTimeDelta: 100
        // property int        iFrame: 10
        // property real       iFrameRate
        // property double     shaderSpeed: 1.0
        // property vector4d   iMouse;
        // property vector4d   iDate;
        // property real       iSampleRate: 44100

        property variant source: theSource;

        property real iTime: 1
        fragmentShader: "_waves.frag.qsb"

        // Component.onCompleted: console.log(Screen.width);
        // readonly property vector3d defaultResolution: Qt.vector3d(shader.width, shader.height, shader.width / shader.height)

        // ShaderEffectSource {
        //     id: iChannel0Source
        //     live: true
        //     hideSource: true
        //     // sourceItem: Image {}
        // }

        ShaderEffectSource {
            anchors.fill: parent
            id: theSource
            sourceItem: theItem
        }
        Timer {
            id: timer1
            running: true
            triggeredOnStart: true
            interval: 16
            repeat: true
            onTriggered: {
                shader.iTime += 0.016 * 1.2; // TODO: surely not the right way to do this?.. oh well..
            }
        }
    }
}
