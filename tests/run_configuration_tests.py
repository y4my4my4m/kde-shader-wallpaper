#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Isolate the package, settings, metadata and D-Bus services; enforce a watchdog."""
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile

binary = Path(sys.argv[1]).resolve()
source = Path(sys.argv[2]).resolve()
with tempfile.TemporaryDirectory(prefix="shader-config-test-") as temporary:
    env = os.environ.copy()
    for key, leaf in (("XDG_CONFIG_HOME", "config"), ("XDG_CACHE_HOME", "cache"),
                      ("XDG_DATA_HOME", "data"), ("XDG_RUNTIME_DIR", "runtime")):
        path = Path(temporary) / leaf
        path.mkdir(mode=0o700)
        env[key] = str(path)
    package = Path(env["XDG_DATA_HOME"]) / "plasma/wallpapers/online.knowmad.shaderwallpaper"
    shutil.copytree(source / "package", package)
    module = package / "contents/ui/shaderwallpaper"
    # Use the same module manifest as installation, even if a configure-only
    # build has recreated ECM's resource-only manifest in the source package.
    shutil.copyfile(source / "src/qmldir.in", module / "qmldir")
    shutil.copyfile(source / "src/qml/PluginStatus.qml", module / "PluginStatus.qml")
    env.update(QT_QPA_PLATFORM="offscreen", QT_QUICK_BACKEND="software",
               QT_QUICK_CONTROLS_STYLE="org.kde.desktop", QT_QPA_PLATFORMTHEME="",
               SHADER_WALLPAPER_UI=str(package / "contents/ui"),
               SHADER_TEST_SANDBOX=temporary)
    # Portal helpers may retain their inherited output handles after the test
    # exits. A file keeps those handles separate from CTest's output pipe.
    with (Path(temporary) / "test.log").open("w+") as log:
        process = subprocess.Popen(["dbus-run-session", "--", str(binary), *sys.argv[3:]],
                                   env=env, start_new_session=True,
                                   stdout=log, stderr=subprocess.STDOUT)
        try:
            result = process.wait(timeout=90)
        except subprocess.TimeoutExpired:
            print("FAIL: configuration event loop exceeded the 90-second watchdog", flush=True)
            result = 124
        finally:
            # All descendants belong to this disposable session. Clean them
            # up even on success, before removing its settings and runtime dir.
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait()
        log.seek(0)
        sys.stdout.write(log.read())
    raise SystemExit(result)
