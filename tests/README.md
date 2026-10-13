# Configuration regression tests

Run from the repository root:

```sh
cmake -S . -B build -DBUILD_TESTING=ON
cmake --build build
ctest --test-dir build --output-on-failure
```

Tests require Qt Quick Test, Qt Widgets, KF6 Config/QML and I18nQml development packages, Python 3, `dbus-run-session`, and the same Kirigami, FormCard and desktop control QML imports as the plugin. Configure with `-DBUILD_TESTING=OFF` to omit test dependencies.

The runner copies the built package into disposable application data and isolates configuration, cache, runtime files and D-Bus. Tests load the actual configuration UI with real `KConfigLoader`/`KConfigPropertyMap` objects. They cover the desktop and wallpaper KCM's temporary-page lifecycle, scalar and list settings, real gallery selection, live map updates, disk persistence, reopening and independent display configuration maps.

The zero-width case keeps the configuration visible before resizing through narrow and normal widths. `TestCase.visible: true` is essential: hidden items do not exercise the layout polish that froze Plasma. With the original negative-width bindings this case stops the event loop and the process watchdog fails the test; the clamped layout completes.

These tests run offscreen with software rendering. They do not measure GPU performance or verify physical monitor rendering. Actual Plasma session testing is separate; the desktop/KCM hosts here reproduce their configuration contracts.
