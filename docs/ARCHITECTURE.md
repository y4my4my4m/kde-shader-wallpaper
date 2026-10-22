# Architecture Overview

This document describes the technical architecture of Shader Wallpaper for KDE Plasma 6.

## Project Structure

```
kde-shader-wallpaper/
├── package/                    # Plasma wallpaper package
│   ├── contents/
│   │   ├── config/
│   │   │   └── main.xml        # Configuration schema
│   │   └── ui/
│   │       ├── main.qml        # Main wallpaper display
│   │       ├── config.qml      # Settings panel
│   │       ├── GalleryView.qml # Shader browser
│   │       ├── ShaderCard.qml  # Gallery card component
│   │       ├── ImportDialog.qml # Shadertoy import UI
│   │       ├── PresetPanel.qml # Preset save/load
│   │       ├── PerformanceWidget.qml
│   │       ├── WindowModel.qml # Pause detection
│   │       ├── Shaders/        # Source .frag files (compiled at runtime)
│   │       ├── Resources/      # Images and icons
│   │       └── shaderwallpaper/ # C++ plugin
│   └── metadata.json           # Package metadata
│
├── src/                        # C++ backend source
│   ├── core/                   # Rendering engine
│   │   ├── shaderengine.*      # QQuickFramebufferObject
│   │   ├── shaderbuffer.*      # Multi-pass buffer support
│   │   ├── shadercompiler.*    # Runtime shader compilation
│   │   ├── uniformmanager.*    # Uniform value management
│   │   └── performancemonitor.* # FPS/frame time tracking
│   │
│   ├── input/                  # Input handling
│   │   ├── cursortracker.*     # Global cursor (XCB/Wayland)
│   │   ├── audiocapture.*      # PipeWire audio
│   │   ├── windowtracker.*     # Window position tracking
│   │   └── screenlockwatcher.* # Session lock state (pause)
│   │
│   ├── import/                 # Shader import
│   │   ├── shadertoyapi.*      # Shadertoy REST client
│   │   └── shaderconverter.*   # GLSL → Qt6 conversion
│   │
│   ├── data/                   # Data management
│   │   ├── presetmanager.*     # Preset save/load
│   │   ├── shaderlibrary.*     # Shader indexing
│   │   └── shadermetadata.*    # Shader metadata
│   │
│   ├── models/                 # QML models
│   │   ├── shaderlistmodel.*   # Shader grid model
│   │   └── categorymodel.*     # Category tabs
│   │
│   └── plugin/                 # Qt plugin registration
│       └── shaderwallpaperplugin.*
│
├── scripts/                    # Build and utility scripts
│   ├── build.sh                # Build script
│   ├── dev.sh                  # Sandbox build + dev harness (qml6)
│   ├── dev/render_shader.py    # Headless renderer / compile check
│   └── migrate_shaders.py      # Library indexing
│
├── docs/                       # Documentation
│   ├── DEVELOPMENT.md          # Developer guide
│   └── ARCHITECTURE.md         # This file
│
├── CMakeLists.txt              # Build configuration
├── CONTRIBUTING.md             # Contribution guidelines
├── LICENSE                     # GPL-3.0-or-later
└── README.md                   # Project overview
```

## Component Overview

### ShaderEngine (C++)

The core rendering component, implemented as a `QQuickFramebufferObject`:

```
┌─────────────────────────────────────────────────┐
│                  ShaderEngine                    │
│  ┌───────────────────────────────────────────┐  │
│  │            UniformManager                 │  │
│  │  • iTime, iMouse, iResolution, etc.       │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │            ShaderBuffer(s)                │  │
│  │  • Buffer A, B, C, D (ping-pong FBOs)     │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │         PerformanceMonitor                │  │
│  │  • Frame time tracking, FPS calculation   │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Input Pipeline

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ X11 (XCB)   │────▶│ CursorTracker│────▶│ ShaderEngine  │
│ or Wayland  │     │              │     │ (iMouse)      │
└─────────────┘     └──────────────┘     └───────────────┘

┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  PipeWire   │────▶│ AudioCapture │────▶│ ShaderEngine  │
│             │     │ (FFT)        │     │ (iChannel)    │
└─────────────┘     └──────────────┘     └───────────────┘

┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  KWin       │────▶│WindowTracker │────▶│ ShaderEngine  │
│             │     │              │     │ (iWindowRects)│
└─────────────┘     └──────────────┘     └───────────────┘
```

### Multi-Pass Rendering

```
Frame N:
┌────────────────────────────────────────────────────────┐
│                                                        │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌───────┐  │
│  │Buffer A │──▶│Buffer B │──▶│Buffer C │──▶│Buffer │  │
│  │ Pass    │   │ Pass    │   │ Pass    │   │D Pass │  │
│  └─────────┘   └─────────┘   └─────────┘   └───────┘  │
│       │             │             │             │      │
│       └─────────────┴─────────────┴─────────────┘      │
│                         │                              │
│                    ┌────▼────┐                         │
│                    │  Image  │                         │
│                    │  Pass   │                         │
│                    └────┬────┘                         │
│                         │                              │
│                    ┌────▼────┐                         │
│                    │ Screen  │                         │
│                    │ Output  │                         │
│                    └─────────┘                         │
└────────────────────────────────────────────────────────┘
```

### Configuration Flow

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ config.qml  │────▶│   Plasma     │────▶│ main.xml      │
│ (UI)        │     │ ConfigModule │     │ (Schema)      │
└─────────────┘     └──────────────┘     └───────────────┘
       │                                        │
       ▼                                        ▼
┌─────────────┐                         ┌───────────────┐
│ PresetPanel │                         │wallpaper.     │
│ (save/load) │                         │configuration  │
└─────────────┘                         └───────────────┘
                                               │
                                               ▼
                                        ┌───────────────┐
                                        │ ShaderEngine  │
                                        │ (properties)  │
                                        └───────────────┘
```

### Shader Library Data

ShaderLibrary reads two roots with the same layout:

| Root | Location | Contents |
|------|----------|----------|
| Package | `<prefix>/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui` | Bundled shaders, `shader_index.json` (ids, metadata), `thumbnails/`. Read-only for system-wide installs; replaced on upgrade. |
| User | `~/.local/share/shaderwallpaper` | `shader_index.json` overlay, generated `thumbnails/`, `Shaders/Imported/`, `Shaders/Packages/`, `presets/`. |

- Paths in configs and indexes are contents/ui-relative (`Shaders/X.frag`). They resolve in the user root first, then the package.
- The user index holds user-owned shaders in full and, for bundled shaders, only favorite and thumbnail state. A bundled shader absent from it is in its bundled state. Overlay entries match bundled ones by id, then by path, so favorites survive an upgrade that re-mints bundled ids.
- A user-root file at the same relative path as a bundled file replaces it.
- On first start without a user index, user data from a writable package directory (favorites, `Shaders/Imported`, `Shaders/Packages`, their thumbnails) is copied into the user root. The package directory is not modified.
- Several processes (plasmashell, System Settings, greeters) share the user index: writes are atomic (`QSaveFile`) and each process merges external writes through a `QFileSystemWatcher`.

## Key Technologies

| Component | Technology |
|-----------|------------|
| UI Framework | Qt 6 / QML with Kirigami |
| Rendering | OpenGL via QQuickFramebufferObject |
| Shader Format | GLSL source, compiled at runtime (`#version 330 core`, or `300 es` on OpenGL ES) |
| Audio | PipeWire |
| Cursor (X11) | XCB |
| Build System | CMake with Extra CMake Modules |
| Package Format | Plasma Wallpaper Package |

## Performance Considerations

1. **FPS Limiting**: ShaderEngine uses a timer to limit frame rate. Only that timer calls `update()`; other items animating in the same window do not re-render the shader
2. **Pause Detection**: WindowModel monitors for fullscreen/maximized windows; the desktop instance also pauses while the session is locked (ScreenLockWatcher, `org.freedesktop.ScreenSaver.ActiveChanged`)
3. **Audio Processing**: Runs at fixed 60Hz independent of shader FPS
4. **Buffer Optimization**: Ping-pong buffering reduces GPU stalls. A buffer pass that steps once per frame declares `// @substeps 1` and skips the substep copies
5. **Window Tracking**: X events gate the polls. An idle desktop costs no timer and no X requests; a moved window costs two requests per tracked candidate; map, unmap, client list and attribute changes re-read every client. The renderer reads the tracker directly (`windowSource`)
6. **Per-frame Signals**: `iTimeChanged`, `iFrameChanged` and the frame-time statistics reach the GUI thread only while `frameSignals` is on, which follows the performance HUD
7. **Renderer CPU**: Uniform locations are cached per program, and the `@shared` split of the main file runs only when the code changes

## Building from Source

```bash
mkdir build && cd build
cmake -DCMAKE_INSTALL_PREFIX=~/.local ..
make -j$(nproc)
make install
```

## Testing

```bash
# Test the wallpaper in isolation
plasmoidviewer -a online.knowmad.shaderwallpaper

# View logs
journalctl -f | grep -i shader
```

