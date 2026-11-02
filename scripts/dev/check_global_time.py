#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Check the built native engine's shared clock across late start/pause/reset.

Requires a desktop session, qml6, Pillow, and an already built engine. The
red channel encodes iGlobalTime; green encodes each engine's independent
iTime. Two engines use different FPS caps, staggered starts, a pause/resume
and a reset. Red must match while green must demonstrate distinct clocks.
"""

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image


QML = r'''
import QtQuick
import QtQuick.Window
import __MODULE__ as Wallpaper
Window {
    id: win
    width: 320; height: 180; visible: true
    title: "Shader Wallpaper shared clock check"
    property string probe: "#ifndef SHADER_WALLPAPER_GLOBAL_TIME\n#error shared clock missing\n#endif\nvoid mainImage(out vec4 c,in vec2 p){c=vec4(fract(iGlobalTime*0.05),fract(iTime*0.05),0.0,1.0);}"
    Wallpaper.ShaderEngine {
        id: first
        width: 160; height: 180
        shaderCode: win.probe
        targetFps: 60; running: true; dither: false
        onCompileFailedChanged: if (compileFailed) { console.error(compileLog); Qt.exit(1) }
    }
    Loader {
        id: second; x: 160; width: 160; height: 180; active: false
        sourceComponent: Component {
            Wallpaper.ShaderEngine {
                shaderCode: win.probe
                targetFps: 30; running: true; dither: false
                onCompileFailedChanged: if (compileFailed) { console.error(compileLog); Qt.exit(1) }
            }
        }
    }
    Timer { interval: 900; running: true; onTriggered: second.active = true }
    Timer { interval: 1200; running: true; onTriggered: first.running = false }
    Timer { interval: 2600; running: true; onTriggered: first.running = true }
    Timer { interval: 2800; running: true; onTriggered: second.item.resetTime() }
    Timer {
        interval: 3600; running: true
        onTriggered: win.contentItem.grabToImage(function(result) {
            Qt.exit(result.saveToFile(__CAPTURE__) ? 0 : 1)
        })
    }
}
'''


def main():
    """Run the native engine probe and check its captured uniform values."""
    repo = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=repo / "build/global-time-check")
    args = parser.parse_args()
    module = repo / "package/contents/ui/shaderwallpaper"
    runtime = shutil.which("qml6") or shutil.which("qml")
    if not runtime or not (module / "qmldir").is_file():
        parser.error("build the native engine and install the Qt QML runtime first")
    args.out = args.out.resolve()
    args.out.mkdir(parents=True, exist_ok=True)
    capture = args.out / "clocks.png"
    capture.unlink(missing_ok=True)
    qml = QML.replace("__MODULE__", json.dumps(module.as_uri()))
    qml = qml.replace("__CAPTURE__", json.dumps(str(capture)))
    with tempfile.TemporaryDirectory(prefix="shader-clock-check-") as temp:
        path = Path(temp) / "check.qml"
        path.write_text(qml)
        subprocess.run([runtime, str(path)], check=True, timeout=20)
    with Image.open(capture) as image:
        # Fractional desktop scaling can change the capture pixel size.
        first = image.getpixel((image.width // 4, image.height // 2))[:3]
        second = image.getpixel((3 * image.width // 4, image.height // 2))[:3]
    assert abs(first[0] - second[0]) <= 2, ("shared clocks differ", first, second)
    assert abs(first[1] - second[1]) >= 10, ("local clocks did not diverge", first, second)
    report = dict(first=first, second=second, global_clock_matches=True, local_clocks_differ=True)
    (args.out / "checks.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
