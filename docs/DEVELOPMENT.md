# Shader Development Guide

This guide covers everything you need to know about creating, importing, and customizing shaders for Shader Wallpaper.

## Table of Contents

- [Fast Iteration (Dev Harness)](#fast-iteration-dev-harness)
- [Shader Basics](#shader-basics)
- [Importing from Shadertoy](#importing-from-shadertoy)
- [Creating Custom Shaders](#creating-custom-shaders)
- [Multi-Pass Shaders](#multi-pass-shaders)
- [Audio Reactive Shaders](#audio-reactive-shaders)
- [Window Reactive Shaders](#window-reactive-shaders)
- [Available Uniforms](#available-uniforms)

## Fast Iteration (Dev Harness)

Working on the C++ engine or QML UI no longer requires killing `plasmashell` on every change. The dev harness builds the plugin into a per-user sandbox prefix and runs the renderer inside a normal Qt window via `qml6` — your real desktop is never touched.

```bash
# One-shot build + install + launch
./scripts/dev.sh

# Same, but rebuild & relaunch automatically whenever you edit src/ or package/
./scripts/dev.sh --watch

# Skip the build step, just relaunch the last-installed sandbox
./scripts/dev.sh --no-build

# Wipe the build dir before building (use after big refactors)
./scripts/dev.sh --clean

# Reset the harness's persisted config (simulates first-boot install)
./scripts/dev-reset.sh
```

Requirements:

- `qt6-declarative` (provides the `qml6` runtime)
- `inotify-tools` for the `--watch` mode

Sandbox layout (fully isolated from your real session):

```
$HOME/.cache/shaderwallpaper-dev/
├── prefix/         CMAKE_INSTALL_PREFIX (plugin + package)
└── config/         XDG_CONFIG_HOME (QSettings used by the harness)
```

The harness window lets you pick any `.frag` file (including the bundled `Shaders/` from the sandbox install), adjust speed / FPS / resolution scale / mouse / audio / iChannel textures, and shows live frame-time stats. Keyboard shortcuts: **Space** play/pause, **R** reset time, **Ctrl+Q** quit.

When you're ready to test inside a real Plasma session, use the existing `./scripts/build.sh install` flow (which installs to `~/.local` instead of the sandbox).


## Shader Basics

Shaders are written in GLSL and compiled at runtime by OpenGL. The format follows Shadertoy conventions with a `mainImage` function:

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Normalize coordinates to 0-1 range
    vec2 uv = fragCoord / iResolution.xy;
    
    // Create a simple gradient
    vec3 color = vec3(uv.x, uv.y, sin(iTime) * 0.5 + 0.5);
    
    fragColor = vec4(color, 1.0);
}
```

**Key Points:**
- Shaders are plain `.frag` text files
- Compiled at runtime (no pre-compilation needed)
- Shadertoy-compatible uniform names (`iTime`, `iResolution`, etc.)

## Importing from Shadertoy

### Automatic Import (Recommended)

1. In the wallpaper settings, click **Import**
2. Paste a Shadertoy URL (e.g., `https://www.shadertoy.com/view/XsXXDn`)
3. The shader will be automatically converted

### Manual Import

1. Copy the shader code from Shadertoy
2. Save as a `.frag` file in `~/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/Shaders/`
3. Refresh the gallery

## Creating Custom Shaders

### Minimal Shader Template

```glsl
// My Custom Shader
// Author: Your Name

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    
    // Your shader code here
    vec3 color = vec3(uv, 0.5 + 0.5 * sin(iTime));
    
    fragColor = vec4(color, 1.0);
}
```

### Adding to the Gallery

Place your `.frag` file in `package/contents/ui/Shaders/` and reinstall:

```bash
kpackagetool6 -t Plasma/Wallpaper --upgrade package
```

## Multi-Pass Shaders (Buffers)

Shader Wallpaper supports multi-pass rendering with up to 4 buffers (A, B, C, D).

### File Structure

For multi-pass shaders, create separate files:
- `myshader.frag` - Main image pass
- `myshader_bufferA.frag` - Buffer A
- `myshader_bufferB.frag` - Buffer B (optional)
- etc.

### Buffer Sampling

In your main shader, read from buffers via `iChannel`:

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    
    // Read from Buffer A (previous frame creates feedback effect)
    vec4 bufferA = texture(iChannel0, uv);
    
    fragColor = bufferA;
}
```

### Channel Mapping

Configure in settings which inputs each pass reads:
- `-1` = None
- `0-3` = Texture channels
- `10-13` = Buffer A-D outputs
- `20` = Audio data

## Audio Reactive Shaders

### Enabling Audio

1. Enable **Audio Reactivity** in settings
2. Select which `iChannel` receives audio data

### Audio Data Format

The audio texture is 512x2 pixels:
- **Row 0 (y ≈ 0.25)**: Waveform (time domain)
- **Row 1 (y ≈ 0.75)**: Spectrum (frequency domain)

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    
    // Get frequency at this x position (bass on left, treble on right)
    float freq = texture(iChannel0, vec2(uv.x, 0.75)).x;
    
    // Get waveform at this x position
    float wave = texture(iChannel0, vec2(uv.x, 0.25)).x;
    
    // Visualize
    float intensity = freq * 2.0;
    vec3 color = vec3(intensity, intensity * 0.5, uv.y);
    
    fragColor = vec4(color, 1.0);
}
```

## Window Reactive Shaders

Shaders can react to window positions on your desktop!

### Enabling Window Tracking

Enable **Window Tracking** in settings.

### Available Uniforms

```glsl
uniform int iWindowCount;           // Number of windows
uniform vec4 iWindowRects[8];       // Window rectangles (x, y, w, h) in pixels
uniform vec2 iWindowVelocities[8];  // Window movement velocities
```

### Example: Ripples Around Windows

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec3 color = vec3(0.1, 0.15, 0.2);  // Background
    
    // Add ripples around each window
    for (int i = 0; i < iWindowCount && i < 8; i++) {
        vec4 rect = iWindowRects[i];
        vec2 center = rect.xy + rect.zw * 0.5;
        
        float dist = distance(fragCoord, center);
        float ripple = sin(dist * 0.05 - iTime * 3.0) * 0.5 + 0.5;
        ripple *= exp(-dist * 0.005);  // Fade with distance
        
        color += vec3(ripple * 0.3, ripple * 0.2, ripple * 0.4);
    }
    
    fragColor = vec4(color, 1.0);
}
```

See `Shaders/WindowReactive/` for more examples.

## Available Uniforms

### Standard Shadertoy Uniforms

| Uniform | Type | Description |
|---------|------|-------------|
| `iTime` | float | Shader playback time (seconds) |
| `iTimeDelta` | float | Time since last frame (seconds) |
| `iFrame` | int | Frame number |
| `iFrameRate` | float | Current frame rate |
| `iResolution` | vec3 | Viewport resolution (x, y, pixel aspect) |
| `iMouse` | vec4 | Mouse (xy=current pos, zw=click pos) |
| `iDate` | vec4 | Date (year, month, day, seconds) |
| `iChannel0-3` | sampler2D | Texture/buffer channels |
| `iChannelTime[4]` | float[] | Channel playback time |
| `iChannelResolution[4]` | vec3[] | Channel resolution |

### Window Tracking Uniforms (Custom)

| Uniform | Type | Description |
|---------|------|-------------|
| `iWindowCount` | int | Number of tracked windows |
| `iWindowRects[8]` | vec4[] | Window rectangles (x, y, w, h) |
| `iWindowVelocities[8]` | vec2[] | Window velocities |

## Tips & Best Practices

1. **Start Simple** - Test with a basic shader before complex ones
2. **Check Performance** - Use the performance widget to monitor FPS
3. **Optimize Loops** - Use `for` loops with known bounds
4. **Handle Edge Cases** - Check for division by zero
5. **Test Both Sessions** - Test on X11 and Wayland if possible
6. **Add Comments** - Include author and source URL in shader comments

## Resources

- [Shadertoy](https://www.shadertoy.com) - Shader inspiration and examples
- [The Book of Shaders](https://thebookofshaders.com) - Learn GLSL
- [GLSL Sandbox](http://glslsandbox.com/) - More shader examples
