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
│   │       ├── Shaders/        # Source .frag files
│   │       ├── Shaders6/       # Compiled .qsb shaders
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
│   │   └── windowtracker.*     # Window position tracking
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
│   ├── shader_processor.py     # Shader preprocessing
│   ├── shader_compiler.py      # Batch shader compilation
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

## Key Technologies

| Component | Technology |
|-----------|------------|
| UI Framework | Qt 6 / QML with Kirigami |
| Rendering | OpenGL via QQuickFramebufferObject |
| Shader Format | SPIR-V (compiled with qsb) |
| Audio | PipeWire |
| Cursor (X11) | XCB |
| Build System | CMake with Extra CMake Modules |
| Package Format | Plasma Wallpaper Package |

## Performance Considerations

1. **FPS Limiting**: ShaderEngine uses a timer to limit frame rate
2. **Pause Detection**: WindowModel monitors for fullscreen/maximized windows
3. **Audio Processing**: Runs at fixed 60Hz independent of shader FPS
4. **Buffer Optimization**: Ping-pong buffering reduces GPU stalls

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

