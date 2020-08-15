/*
 * The License is: Whatever, who gives a fuck.
 */

import QtQuick 2.12
import QtQuick.Controls 2.12
import "./Comp"

Item {
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
}
