/*
 *
 *  Shader Wallpaper
 *  Copyright (C) 2020 @y4my4my4m | github.com/@y4my4my4m
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
 *  Thanks to @simons-public on github for his contributions
 */

import QtQuick 2.12
import QtQuick.Controls 2.12
import "./Comp"

Item {
    id: main
    Loader {
      id: toyLoader
      source: wallpaper.configuration.SelectedShader
      anchors.fill: parent
      onLoaded: {
        toy.pixelShader = item.pixelShader
        if (item.iChannel0) {
          toy.iChannel0 = item.iChannel0
        }
        if (item.iChannel1) {
          toy.iChannel1 = item.iChannel1
        }
        if (item.iChannel2) {
          toy.iChannel2 = item.iChannel2
        }
        if (item.iChannel3) {
          toy.iChannel3 = item.iChannel3
        }
        toy.restart()
      }
    }
    TShaderToy {
      id: toy
      anchors.fill: parent
      running: false
    }

    // function doPause(){
    //   toy.running != item.running
    // }
}
