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
- [Tweakable Constants](#tweakable-constants)
- [Headless Rendering and Compile Checks](#headless-rendering-and-compile-checks)

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
2. Save as a `.frag` file in `~/.local/share/shaderwallpaper/Shaders/Imported/`
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

### Channel Directive (recommended)

Instead of relying on the settings UI, a shader can declare its own routing
in a header comment. When the shader is picked (gallery, file dialog, presets
excluded) the routing below is written to the config and audio capture is
switched on or off to match:

```glsl
// Ring_Spectrum - six rotating rings driven by the FFT
// @channels audio, bufferA
```

One token per `iChannel0..3`, in order: `audio` (FFT texture), `bufferA`..`bufferD`
(or `A`..`D`), `self` (the pass's own buffer, inside a `_bufferX.frag`),
`tex0`..`tex3` (static texture slots), `none`. Missing trailing tokens keep the
defaults. The line in the main file also applies to every buffer pass that
carries no directive of its own; a buffer file may state a different one.

Without a directive the generic default applies: Buffer A feeds channel 0 of
both passes, which is wrong for the usual "audio on 0, feedback on 1" layout.

## Audio Reactive Shaders

### Enabling Audio

1. Enable **Audio Reactivity** in settings
2. Select which `iChannel` receives audio data

### Audio Data Format

The audio texture is 512x2 pixels, laid out like Shadertoy's:
- **Row 0 (y ≈ 0.25)**: Spectrum. Texel *i* is FFT bin *i* of a 2048-point FFT
  (linear in frequency, ~21.5 Hz per texel at 44.1 kHz, 0 to ~11 kHz), level in
  dB mapped from [-100, -30] to [0, 1], smoothed over time (factor 0.8).
- **Row 1 (y ≈ 0.75)**: Waveform, the newest 512 samples mapped from [-1, 1] to [0, 1].

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    
    // Get frequency at this x position (bass on left, treble on right)
    float freq = texture(iChannel0, vec2(uv.x, 0.25)).x;
    
    // Get waveform at this x position
    float wave = texture(iChannel0, vec2(uv.x, 0.75)).x;
    
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
uniform int  iWindowCount;           // Number of windows (0-16)
uniform vec4 iWindowRects[16];       // (x, y, w, h) in pixels, GL origin (bottom-left)
uniform vec4 iWindowRectsPrev[16];   // The same rects one rendered frame earlier
uniform vec2 iWindowVelocities[16];  // Pixels per second
```

Each rect covers the visible window: a server-side title bar and border are
included, the invisible shadow margin of a client-side-decorated window
(`_GTK_FRAME_EXTENTS`) is not. Docks and panels are not reported.

Rects are extrapolated with their velocity every rendered frame, so they
track a dragged window smoothly between tracker polls. In a buffer pass that
runs on a reduced grid (see `@sim-max-height`), rects, velocities and the
mouse are scaled to that grid.

### Example: Ripples Around Windows

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec3 color = vec3(0.1, 0.15, 0.2);  // Background
    
    // Add ripples around each window
    for (int i = 0; i < iWindowCount && i < 16; i++) {
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
| `iTime` | float | Shader playback time (seconds, scaled by speed) |
| `iTimeDelta` | float | Time since the last frame (seconds). In a buffer pass, the share of one substep |
| `iFrame` | int | Frame number |
| `iFrameRate` | float | Measured frame rate |
| `iResolution` | vec3 | Viewport of the current pass (x, y, x/y) |
| `iMouse` | vec4 | xy = cursor, zw = last click position, z > 0 while a button is held |
| `iDate` | vec4 | Year, month, day, seconds since midnight |
| `iSampleRate` | float | 44100 |
| `iChannel0-3` | sampler2D | Texture / buffer / audio channels |
| `iChannelTime[4]` | float[] | Same as iTime |
| `iChannelResolution[4]` | vec3[] | Size of what is bound to each channel (x, y, x/y); zero when the channel is unbound |

`HW_PERFORMANCE` is defined as 1, as on desktop Shadertoy.

A zero `iChannelResolution[n]` tells a shader that nothing is bound, e.g. to
fall back to a procedural background when the user picked no image:

```glsl
bool hasImage = iChannelResolution[1].x > 0.0;
```

### Engine Uniforms (Custom)

| Uniform | Type | Description |
|---------|------|-------------|
| `iMousePrev` | vec2 | Cursor position one rendered frame earlier |
| `iWindowCount`, `iWindowRects[16]`, `iWindowRectsPrev[16]`, `iWindowVelocities[16]` | | See [Window Reactive Shaders](#window-reactive-shaders) |
| `iSubstep`, `iSubsteps` | int | Buffer passes run several substeps per frame (about 240 steps per second). Index of the current substep and the count this frame; 0 and 1 in the image pass and in a `@substeps 1` buffer pass |
| `iScreenOffset`, `iDesktopResolution` | vec2 | Multi-monitor (experimental setting): this screen's bottom-left within the bounding box of all screens, and that box's size, in output pixels with the GL origin. `fragCoord + iScreenOffset` is a desktop-wide pixel position; `iDesktopResolution` equals `iResolution.xy` on a single screen |
| `iScreenIndex`, `iScreenCount` | int | Screen ordinal and count |
| `iVirtualDesktop`, `iVirtualDesktopCount` | int | Current virtual desktop and count |
| `iVirtualDesktopAnim` | float | 0..1 progress of a desktop switch |

### Header Directives

Comment lines in the first 60 lines of the main `.frag` configure the engine:

| Directive | Effect |
|-----------|--------|
| `// @channels audio, bufferA` | Channel routing, see [Channel Directive](#channel-directive-recommended) |
| `// @texture0 Resources/Shadertoy_Rusty_Metal.jpg` | Default image for a texture slot (`@texture0`..`@texture3`), path relative to `package/contents/ui`. Applied when the shader is picked; slots the shader does not declare keep the user's images |
| `// @sim-max-height 600` | Buffer passes render at most this many rows (aspect kept); the image pass samples them with linear filtering. Wave simulations keep the same look and cost on every monitor. The **Simulation resolution** setting overrides it |
| `// @substeps 1` | Read from a buffer file (`_bufferA.frag` etc.), not the main file. The pass renders once per frame, on the last substep, with `iSubstep` 0, `iSubsteps` 1 and the whole frame's `iTimeDelta`. Other passes see its output as they would see a pass that copies itself on every substep but the last. For passes that step once per frame: same result, without the copy passes |

A pass that steps once per frame and copies itself on the other substeps,

```glsl
if (iSubstep != iSubsteps - 1) { fragColor = texelFetch(iChannel0, ivec2(fragCoord), 0); return; }
float frameDt = iTimeDelta * float(iSubsteps);
```

renders the same image with `// @substeps 1` in its header, and the copy
branch is then never taken. Only `iSubstep` changes: 0 instead of
`iSubsteps - 1`, which matters to a pass that hashes it.

### GLSL Version

Do not write `#version` or `precision` lines; the engine strips them and adds
its own header: `#version 330 core` on desktop OpenGL, `#version 300 es` with
`highp` defaults when Plasma runs on OpenGL ES. `#extension` lines are moved
to just after that header. Compile errors report line numbers of your file.

## Tweakable Constants

The **Tweak this shader** panel lists annotated constants of the main
`.frag` file. Each must be a single top-level line with a literal value:

```glsl
const float SPEED = 1.0;              // @range(0.1, 5.0, 0.1) @label("Speed")
const int   COUNT = 300;              // @range(50, 1000, 10) @label("Birds")
const bool  NIGHT = true;             // @label("Follow the clock")
const vec3  TINT  = vec3(1.0, 0.9, 0.8); // @color @label("Tint")
```

`@range(min, max[, step])` sets a slider, `@label` its caption, `@color`
forces a colour picker. A changed value recompiles the shader and clears
buffer state.

Buffer passes and the common file do not see the main file. A constant
marked `@shared` is moved to the front of the common code of every pass, so
simulation parameters can be tweaked too:

```glsl
const int ANTS = 480; // @range(64, 1024, 32) @label("Ants") @shared
```

A `@shared` constant must not also be declared in `_common.frag`. Compile
errors in it report its line in the main file.

## Headless Rendering and Compile Checks

`scripts/dev/render_shader.py` compiles and renders shaders without Plasma,
through EGL, using the engine's own header and footer (read from
`src/core/shaderengine.cpp`) and the same multi-pass, substep and channel
rules. Inputs are synthetic and repeatable: a 120 BPM test track for audio, a
scripted cursor and scripted windows. Needs PyOpenGL, numpy and Pillow.

```bash
# Compile every bundled shader (desktop GL, then an OpenGL ES context)
python3 scripts/dev/render_shader.py --check package/contents/ui/Shaders
python3 scripts/dev/render_shader.py --check package/contents/ui/Shaders --gles

# Contact sheet at four moments, with a dragged window drawn on top
python3 scripts/dev/render_shader.py package/contents/ui/Shaders/WindowReactive/water_ripple_windows_v2.frag \
    --windows drag --show-windows --at 1,2,3,4 --out /tmp/water.png

# Animated GIF of an audio-reactive shader
python3 scripts/dev/render_shader.py package/contents/ui/Shaders/Ring_Spectrum.frag --gif /tmp/ring.gif --duration 6
```

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
