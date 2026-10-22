#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Headless renderer and compile checker for Shader Wallpaper shaders.

Mirrors ShaderEngineRenderer (src/core/shaderengine.cpp): the source
fragments (version lines, GLES precision block, defines, header, footer) are
read from that file and assembled as the engine does, including what
QOpenGLShader inserts after the version line. Buffer passes ping-pong
between two float FBOs, are substepped N = clamp(round(dt*240), 1, 8) per
frame (iSubstep / iSubsteps), buffer self-reads are GL_NEAREST and
image-pass buffer reads are GL_LINEAR. The image pass is dithered by 1/255
unless --hdr or --no-dither. Textures are flipped so uv (0,0) is the
image's bottom-left. fragCoord, iMouse and iWindowRects use GL's
bottom-left origin.

Inputs are synthetic and deterministic: a 120 BPM test track feeds the
512x2 audio texture (row 0 = spectrum, dB [-100,-30] -> [0,1], smoothing
0.8, 2048-point FFT; row 1 = waveform in [0,1]), a scripted cursor path
feeds iMouse, and scripted windows feed iWindowRects / iWindowVelocities.

Requires PyOpenGL, numpy and Pillow; runs on any EGL driver without a
display server.

    render_shader.py Shaders/Foo.frag --at 2,5,9 --out /tmp/foo.png
    render_shader.py Shaders/Foo.frag --gif /tmp/foo.gif --duration 6
    render_shader.py --check Shaders/            # compile every shader
    render_shader.py --check Shaders/ --gles     # same, OpenGL ES context
"""

import os

os.environ.setdefault("PYOPENGL_PLATFORM", "egl")

import argparse
import ctypes
import math
import re
import sys
from pathlib import Path

import numpy as np
from OpenGL import EGL, _configflags

# Per-call GL error checking off (a glGetError after every GL call, and a
# stale error is reported against whichever call checks next). GL errors are
# read once per frame instead (Renderer.step). The flag is snapshotted into
# _configflags at first import and read when each GL entry point is first
# resolved; EGL's import needs it on.
_configflags.ERROR_CHECKING = False
from OpenGL import GL  # noqa: E402
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
ENGINE_CPP = REPO / "src" / "core" / "shaderengine.cpp"

AUDIO_WIDTH = 512
FFT_SIZE = 2048
SAMPLE_RATE = 44100
MAX_WINDOWS = 16


# ---------------------------------------------------------------- engine glue

ENGINE_CONSTANTS = ("glslVersionDesktop", "glslVersionGles", "glslPrecisionGles", "shadertoyDefines",
                    "vertexShaderSource", "shaderHeader", "shaderFooter")


def engine_sources():
    """The raw-string source constants of shaderengine.cpp, by name."""
    src = ENGINE_CPP.read_text()

    def raw(name):
        m = re.search(r"static const char \*%s = R\"\((.*?)\)\";" % name, src, re.S)
        if not m:
            sys.exit("render_shader: %s not found in %s" % (name, ENGINE_CPP))
        return m.group(1)

    return {name: raw(name) for name in ENGINE_CONSTANTS}


# prepareUserSource() in shaderengine.cpp.
DIRECTIVE_RE = re.compile(r"^[ \t]*#[ \t]*(version|extension)\b")
PRECISION_RE = re.compile(r"\bprecision[ \t]+(?:lowp|mediump|highp)[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*;")


def prepare_user_source(code, extensions):
    """Blanks #version / #extension lines and precision statements in place;
    collects #extension lines (deduplicated) into `extensions`."""
    lines = code.split("\n")
    for i, line in enumerate(lines):
        m = DIRECTIVE_RE.match(line)
        if m:
            if m.group(1) == "extension":
                ext = line.strip()
                if ext not in extensions:
                    extensions.append(ext)
            lines[i] = ""
            continue
        if "precision" in line:
            lines[i] = PRECISION_RE.sub("", line)
    return "\n".join(lines)


SHARED_RE = re.compile(
    r"^[ \t]*const[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*=[^;]*;[ \t]*//.*@shared\b")


def split_shared(code, common):
    """splitSharedConsts() in shaderengine.cpp: main-file consts marked
    @shared move to the front of the common code of every pass."""
    if "@shared" not in code:
        return code, common
    lines = code.split("\n")
    shared = ""
    for i, line in enumerate(lines):
        if "@shared" in line and SHARED_RE.match(line):
            shared += "#line %d 0\n%s\n" % (i + 1, line)
            lines[i] = ""
    if not shared:
        return code, common
    return "\n".join(lines), shared + "#line 1 1\n" + common


def assemble_fragment(eng, gles, common, code):
    """assembleFragmentSource() in shaderengine.cpp."""
    extensions = []
    prepared_common = prepare_user_source(common, extensions)
    prepared_code = prepare_user_source(code, extensions)
    src = eng["glslVersionGles"] if gles else eng["glslVersionDesktop"]
    for ext in extensions:
        src += ext + "\n"
    if gles:
        src += eng["glslPrecisionGles"]
    src += eng["shadertoyDefines"]
    src += eng["shaderHeader"]
    if common:
        src += "#line 1 1\n" + prepared_common + "\n"
    return src + "#line 1 0\n" + prepared_code + eng["shaderFooter"]


def assemble_vertex(eng, gles):
    """assembleVertexSource() in shaderengine.cpp."""
    src = eng["glslVersionGles"] if gles else eng["glslVersionDesktop"]
    if gles:
        src += eng["glslPrecisionGles"]
    return src + eng["vertexShaderSource"]


QT_BLEND_EQUATION_ADVANCED = ["#ifdef GL_KHR_blend_equation_advanced",
                              "#extension GL_ARB_fragment_coord_conventions : enable",
                              "#extension GL_KHR_blend_equation_advanced : enable",
                              "#endif"]
QT_QUALIFIER_DEFINES = ["#define lowp", "#define mediump", "#define highp"]


def qt_shader_source(src, gles, fragment):
    """What QOpenGLShader::compileSourceCode() hands the driver (Qt 6.11,
    read from its "Problematic shader source" dump): after the #version line
    the blend-equation-advanced block (fragment stage), the qualifier
    defines (desktop GL) and "#line <version line>"."""
    lines = src.split("\n")
    for i, line in enumerate(lines):
        if line.lstrip().startswith("#version"):
            insert = (QT_BLEND_EQUATION_ADVANCED if fragment else []) + ([] if gles else QT_QUALIFIER_DEFINES)
            insert = insert + ["#line %d" % (i + 1)]
            return "\n".join(lines[:i + 1] + insert + lines[i + 1:])
    return src


TEXTURE_RE = re.compile(r"^[ \t]*//[ \t]*@texture([0-3])[ \t]*:?[ \t]*(\S+)", re.I | re.M)
SIM_HEIGHT_RE = re.compile(r"^[ \t]*//[ \t]*@sim-max-height[ \t]*:?[ \t]*(\d+)", re.I | re.M)
CHANNEL_RE = re.compile(r"^[ \t]*//[ \t]*@channels?[ \t]*:?[ \t]*([^\r\n]*)", re.I | re.M)


def parse_channels(code, self_index):
    """ChannelDirective.js parse(); returns 4 ints or None per slot."""
    head = "\n".join(code.split("\n")[:60])
    m = CHANNEL_RE.search(head)
    if not m:
        return None
    out = [None] * 4
    toks = [t for t in re.split(r"[,\s]+", m.group(1)) if t != ""]
    for i, tok in enumerate(toks[:4]):
        t = tok.strip().lower()
        if t in ("none", "-", "off"):
            out[i] = -1
        elif t in ("audio", "fft", "music"):
            out[i] = 20
        elif t == "self":
            out[i] = self_index
        elif re.fullmatch(r"buffer([a-d])|([a-d])", t):
            letter = t[-1]
            out[i] = 10 + "abcd".index(letter)
        elif re.fullmatch(r"(?:tex|texture|image)([0-3])", t):
            out[i] = int(t[-1])
        elif re.fullmatch(r"-?\d+", t):
            out[i] = int(t)
    return out


def discover_package(main_path):
    main_path = Path(main_path)
    base = main_path.with_suffix("")
    passes = {}
    for letter in "ABCD":
        p = Path(str(base) + "_buffer%s.frag" % letter)
        if p.exists():
            passes[letter] = p.read_text()
    common = ""
    for suffix in ("_common.glsl", "_common.frag", "_Common.frag"):
        p = Path(str(base) + suffix)
        if p.exists():
            common = p.read_text()
            break
    return main_path.read_text(), passes, common


# ---------------------------------------------------------------- EGL context

class Context:
    def __init__(self, gles=False):
        self.gles = gles
        Context.current_gles = gles
        dpy = EGL.eglGetDisplay(EGL.EGL_DEFAULT_DISPLAY)
        major, minor = EGL.EGLint(), EGL.EGLint()
        if not EGL.eglInitialize(dpy, ctypes.pointer(major), ctypes.pointer(minor)):
            sys.exit("render_shader: eglInitialize failed")
        renderable = EGL.EGL_OPENGL_ES3_BIT if gles else EGL.EGL_OPENGL_BIT
        attribs = [EGL.EGL_SURFACE_TYPE, EGL.EGL_PBUFFER_BIT,
                   EGL.EGL_RENDERABLE_TYPE, renderable,
                   EGL.EGL_RED_SIZE, 8, EGL.EGL_GREEN_SIZE, 8,
                   EGL.EGL_BLUE_SIZE, 8, EGL.EGL_ALPHA_SIZE, 8, EGL.EGL_NONE]
        config = EGL.EGLConfig()
        n = EGL.EGLint()
        EGL.eglChooseConfig(dpy, (EGL.EGLint * len(attribs))(*attribs),
                            ctypes.pointer(config), 1, ctypes.pointer(n))
        if n.value < 1:
            sys.exit("render_shader: no EGL config")
        surf = EGL.eglCreatePbufferSurface(
            dpy, config, (EGL.EGLint * 5)(EGL.EGL_WIDTH, 16, EGL.EGL_HEIGHT, 16, EGL.EGL_NONE))
        if gles:
            EGL.eglBindAPI(EGL.EGL_OPENGL_ES_API)
            ca = [EGL.EGL_CONTEXT_MAJOR_VERSION, 3, EGL.EGL_CONTEXT_MINOR_VERSION, 0, EGL.EGL_NONE]
        else:
            EGL.eglBindAPI(EGL.EGL_OPENGL_API)
            # Compatibility profile: Qt Quick's default QSurfaceFormat.
            ca = [EGL.EGL_CONTEXT_MAJOR_VERSION, 3, EGL.EGL_CONTEXT_MINOR_VERSION, 3,
                  EGL.EGL_CONTEXT_OPENGL_PROFILE_MASK,
                  EGL.EGL_CONTEXT_OPENGL_COMPATIBILITY_PROFILE_BIT, EGL.EGL_NONE]
        ctx = EGL.eglCreateContext(dpy, config, EGL.EGL_NO_CONTEXT, (EGL.EGLint * len(ca))(*ca))
        if not ctx:
            sys.exit("render_shader: eglCreateContext failed")
        EGL.eglMakeCurrent(dpy, surf, surf, ctx)
        self.renderer = GL.glGetString(GL.GL_RENDERER).decode()


def compile_program(vs_src, fs_src):
    """Returns (program, None) or (None, log)."""
    gles = getattr(Context, "current_gles", False)

    def stage(kind, src):
        sh = GL.glCreateShader(kind)
        GL.glShaderSource(sh, qt_shader_source(src, gles, kind == GL.GL_FRAGMENT_SHADER))
        GL.glCompileShader(sh)
        if not GL.glGetShaderiv(sh, GL.GL_COMPILE_STATUS):
            log = GL.glGetShaderInfoLog(sh)
            return None, log.decode(errors="replace") if isinstance(log, bytes) else str(log)
        return sh, None

    vs, err = stage(GL.GL_VERTEX_SHADER, vs_src)
    if err:
        return None, "vertex: " + err
    fs, err = stage(GL.GL_FRAGMENT_SHADER, fs_src)
    if err:
        return None, err
    prog = GL.glCreateProgram()
    GL.glAttachShader(prog, vs)
    GL.glAttachShader(prog, fs)
    GL.glBindAttribLocation(prog, 0, "position")
    GL.glBindAttribLocation(prog, 1, "texCoord")
    GL.glLinkProgram(prog)
    if not GL.glGetProgramiv(prog, GL.GL_LINK_STATUS):
        log = GL.glGetProgramInfoLog(prog)
        return None, "link: " + (log.decode(errors="replace") if isinstance(log, bytes) else str(log))
    return prog, None


# ---------------------------------------------------------------- inputs

class SyntheticAudio:
    """120 BPM loop: kick on quarters, bass on eighths, a pad chord, hats
    on off-beats, a snare on 2 and 4. Silent for the first `silence_s`."""

    def __init__(self, silence_s=0.0, smoothing=0.8):
        self.silence_s = silence_s
        self.smoothing = smoothing
        self.smoothed = np.zeros(AUDIO_WIDTH, np.float32)
        self.window = 0.5 * (1.0 - np.cos(2.0 * np.pi * np.arange(FFT_SIZE) / (FFT_SIZE - 1)))
        self.rng = np.random.default_rng(7)
        self.noise = self.rng.uniform(-1, 1, SAMPLE_RATE * 4).astype(np.float32)

    def signal(self, t):
        beat = 0.5
        x = np.zeros_like(t)
        tb = np.mod(t, beat)
        kick_f = 50.0 + 90.0 * np.exp(-tb * 30.0)
        kick_phase = 2 * np.pi * (50.0 * tb + 90.0 / 30.0 * (1 - np.exp(-tb * 30.0)))
        x += 0.9 * np.sin(kick_phase) * np.exp(-tb * 9.0)
        del kick_f
        bar = np.floor(t / (beat * 4)).astype(int)
        roots = np.array([55.0, 55.0, 65.41, 49.0])[bar % 4]
        e = np.mod(t, beat / 2)
        x += 0.35 * np.sign(np.sin(2 * np.pi * roots * t)) * np.exp(-e * 6.0)
        for mult in (4.0, 5.0, 6.0):
            x += 0.07 * np.sin(2 * np.pi * roots * mult * t + mult)
        idx = (np.floor(t * SAMPLE_RATE).astype(int)) % self.noise.size
        hat_t = np.mod(t - beat / 2, beat)
        hat = self.noise[idx] - np.roll(self.noise, 1)[idx]
        x += 0.25 * hat * np.exp(-hat_t * 60.0)
        sn_t = np.mod(t - beat, beat * 2)
        x += 0.35 * self.noise[idx] * np.exp(-sn_t * 18.0) + 0.3 * np.sin(2 * np.pi * 190 * t) * np.exp(-sn_t * 25.0)
        x *= np.where(t < self.silence_s, 0.0, 1.0)
        return 0.5 * x

    def texture(self, time_s):
        t = time_s - (np.arange(FFT_SIZE)[::-1] / SAMPLE_RATE)
        s = self.signal(t).astype(np.float32)
        spec = np.fft.rfft(s * self.window)
        amp = np.abs(spec[:AUDIO_WIDTH]) * (4.0 / FFT_SIZE)
        db = 20.0 * np.log10(np.maximum(amp, 1e-6))
        norm = np.clip((db + 100.0) / 70.0, 0.0, 1.0)
        self.smoothed = self.smoothing * self.smoothed + (1.0 - self.smoothing) * norm
        wave = (np.clip(s[-AUDIO_WIDTH:], -1, 1) + 1.0) * 0.5
        tex = np.ones((2, AUDIO_WIDTH, 4), np.float32)
        tex[0, :, :3] = self.smoothed[:, None]
        tex[1, :, :3] = wave[:, None]
        return tex


MOUSE_POS = [0.62, 0.4]
PRESS_SPANS = []


def mouse_at(t, w, h, mode):
    if mode == "none":
        return 0.5 * w, 0.5 * h
    if mode in ("still", "hold"):
        return MOUSE_POS[0] * w, MOUSE_POS[1] * h
    if mode == "hop":
        # Rests 2.5 s at each of three spots on bare wall, cycling.
        spots = ((0.30 * w, 0.22 * h), (0.52 * w, 0.78 * h), (0.10 * w, 0.75 * h))
        return spots[int(t / 2.5) % len(spots)]
    # Lissajous sweep with a pause every 4 s.
    phase = t if (t % 4.0) < 3.0 else math.floor(t / 4.0) * 4.0 + 3.0
    return (0.5 + 0.32 * math.sin(phase * 0.9)) * w, (0.5 + 0.28 * math.sin(phase * 1.37 + 1.0)) * h


def windows_at(t, w, h, mode):
    """List of (x, y, ww, hh) bottom-left origin."""
    if mode == "none":
        return []
    ww, hh = 0.36 * w, 0.42 * h
    wins = [(0.08 * w, 0.42 * h, ww, hh),
            (0.62 * w, 0.12 * h, 0.28 * w, 0.30 * h)]
    if mode == "drag":
        # Window 0 is dragged around for 2.5 s out of every 5 s.
        cyc = t % 5.0
        k = min(cyc, 2.5)
        ease = 0.5 - 0.5 * math.cos(math.pi * k / 2.5)
        x = 0.08 * w + ease * 0.36 * w
        y = 0.42 * h - 0.25 * h * math.sin(math.pi * ease)
        if math.floor(t / 5.0) % 2 == 1:
            x = 0.44 * w - ease * 0.36 * w
        wins[0] = (x, y, ww, hh)
    return wins


# ---------------------------------------------------------------- renderer

class Renderer:
    def __init__(self, args, main_code, passes, common):
        self.args = args
        self.w, self.h = args.width, args.height
        eng = engine_sources()
        vs = assemble_vertex(eng, args.gles)
        self.passes = passes
        self.programs = {}
        self.uniform_locations = {}
        self.gl_error_reported = False
        main_code, common = split_shared(main_code, common)
        prog, err = compile_program(vs, assemble_fragment(eng, args.gles, common, main_code))
        if err:
            sys.exit("Fragment shader (main pass) failed:\n" + err)
        self.programs["image"] = prog
        for letter, code in passes.items():
            prog, err = compile_program(vs, assemble_fragment(eng, args.gles, common, code))
            if err:
                sys.exit("Fragment shader (buffer %s) failed:\n%s" % (letter, err))
            self.programs[letter] = prog

        # Routing: engine defaults, then the @channels directive.
        self.image_map = [0, 1, 2, 3]
        self.buf_map = {l: [-1, -1, -1, -1] for l in "ABCD"}
        main_dir = parse_channels(main_code, 10)
        if args.channels:
            main_dir = parse_channels("// @channels " + args.channels, 10)
        if main_dir:
            self.image_map = [v if v is not None else d for v, d in zip(main_dir, self.image_map)]
        for letter in passes:
            idx = 10 + "ABCD".index(letter)
            own = parse_channels(passes[letter], idx)
            src = own if own else (parse_channels(main_code, idx) if main_dir else None)
            if args.channels and not own:
                src = parse_channels("// @channels " + args.channels, idx)
            if src:
                self.buf_map[letter] = [v if v is not None else d for v, d in zip(src, self.buf_map[letter])]
            elif letter == "A":
                # ConfigContent default: Buffer A feeds channel 0 of both passes.
                self.buf_map["A"] = [10, -1, -1, -1]
                if not main_dir:
                    self.image_map[0] = 10
        uses_audio = 20 in self.image_map or any(20 in m for m in self.buf_map.values())
        self.audio = SyntheticAudio(silence_s=args.audio_silence) if (uses_audio and args.audio != "none") else None

        self.sim_size = (self.w, self.h)
        sim_h = args.sim_max_height
        if not sim_h:
            m = SIM_HEIGHT_RE.search("\n".join(main_code.split("\n")[:60]))
            sim_h = int(m.group(1)) if m else 0
        if sim_h and self.h > sim_h:
            s = sim_h / self.h
            self.sim_size = (max(64, round(self.w * s)), max(64, sim_h))

        self._quad()
        self.tex = {}
        # "// @textureN path" directives, relative to package contents/ui;
        # explicit --texN options win.
        head = "\n".join(main_code.split("\n")[:60])
        explicit = [args.tex0, args.tex1, args.tex2, args.tex3]
        for m in TEXTURE_RE.finditer(head):
            n = int(m.group(1))
            if not explicit[n]:
                explicit[n] = str(REPO / "package" / "contents" / "ui" / m.group(2).strip())
        for i, path in enumerate(explicit):
            if path:
                self.tex[i] = self._image_texture(path)
        if 1 not in self.tex and args.default_wallpaper:
            self.tex[1] = self._image_texture(args.default_wallpaper)
        self.audio_tex = GL.glGenTextures(1)
        GL.glBindTexture(GL.GL_TEXTURE_2D, self.audio_tex)
        for p, v in ((GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR), (GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR),
                     (GL.GL_TEXTURE_WRAP_S, GL.GL_CLAMP_TO_EDGE), (GL.GL_TEXTURE_WRAP_T, GL.GL_CLAMP_TO_EDGE)):
            GL.glTexParameteri(GL.GL_TEXTURE_2D, p, v)
        GL.glTexImage2D(GL.GL_TEXTURE_2D, 0, GL.GL_RGBA32F, AUDIO_WIDTH, 2, 0, GL.GL_RGBA, GL.GL_FLOAT, None)

        self.fbo = {}
        for letter in passes:
            self.fbo[letter] = [self._float_fbo(*self.sim_size), self._float_fbo(*self.sim_size)]
        # resolutionScale: the image pass renders at this size and is
        # upscaled for output, as ShaderEngineRenderer's low-res FBO.
        self.out_w = max(64, round(self.w * args.scale)) if args.scale != 1.0 else self.w
        self.out_h = max(64, round(self.h * args.scale)) if args.scale != 1.0 else self.h
        self.out_fbo, self.out_tex = self._fbo(self.out_w, self.out_h, GL.GL_RGBA16F if args.hdr else GL.GL_RGBA8)
        self.ping = False
        self.time = 0.0
        self.frame = 0
        self.prev_mouse = None
        self.prev_rects = [0.0] * (MAX_WINDOWS * 4)
        self.prev_wins = None

    def _quad(self):
        verts = np.array([-1, 1, 0, 1, -1, -1, 0, 0, 1, -1, 1, 0,
                          -1, 1, 0, 1, 1, -1, 1, 0, 1, 1, 1, 1], np.float32)
        self.vao = GL.glGenVertexArrays(1)
        vbo = GL.glGenBuffers(1)
        GL.glBindVertexArray(self.vao)
        GL.glBindBuffer(GL.GL_ARRAY_BUFFER, vbo)
        GL.glBufferData(GL.GL_ARRAY_BUFFER, verts.nbytes, verts, GL.GL_STATIC_DRAW)
        GL.glVertexAttribPointer(0, 2, GL.GL_FLOAT, False, 16, ctypes.c_void_p(0))
        GL.glEnableVertexAttribArray(0)
        GL.glVertexAttribPointer(1, 2, GL.GL_FLOAT, False, 16, ctypes.c_void_p(8))
        GL.glEnableVertexAttribArray(1)
        GL.glBindVertexArray(0)

    def _image_texture(self, path):
        img = Image.open(path).convert("RGBA").transpose(Image.FLIP_TOP_BOTTOM)
        data = np.asarray(img, np.uint8)
        tex = GL.glGenTextures(1)
        GL.glBindTexture(GL.GL_TEXTURE_2D, tex)
        GL.glTexImage2D(GL.GL_TEXTURE_2D, 0, GL.GL_RGBA8, img.width, img.height, 0,
                        GL.GL_RGBA, GL.GL_UNSIGNED_BYTE, data)
        GL.glGenerateMipmap(GL.GL_TEXTURE_2D)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR_MIPMAP_LINEAR)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_WRAP_S, GL.GL_REPEAT)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_WRAP_T, GL.GL_REPEAT)
        return (tex, img.width, img.height)

    def _fbo(self, w, h, fmt):
        tex = GL.glGenTextures(1)
        GL.glBindTexture(GL.GL_TEXTURE_2D, tex)
        # GLES 3.0 accepts RGBA8 storage only with GL_UNSIGNED_BYTE data.
        data_type = GL.GL_UNSIGNED_BYTE if fmt == GL.GL_RGBA8 else GL.GL_FLOAT
        GL.glTexImage2D(GL.GL_TEXTURE_2D, 0, fmt, w, h, 0, GL.GL_RGBA, data_type, None)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_NEAREST)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_NEAREST)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_WRAP_S, GL.GL_CLAMP_TO_EDGE)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_WRAP_T, GL.GL_CLAMP_TO_EDGE)
        fbo = GL.glGenFramebuffers(1)
        GL.glBindFramebuffer(GL.GL_FRAMEBUFFER, fbo)
        GL.glFramebufferTexture2D(GL.GL_FRAMEBUFFER, GL.GL_COLOR_ATTACHMENT0, GL.GL_TEXTURE_2D, tex, 0)
        GL.glClearColor(0, 0, 0, 0)
        GL.glClear(GL.GL_COLOR_BUFFER_BIT)
        return fbo, tex

    def _float_fbo(self, w, h):
        return self._fbo(w, h, GL.GL_RGBA32F if not self.args.half_float else GL.GL_RGBA16F)

    def _loc(self, prog, name):
        key = (prog, name)
        loc = self.uniform_locations.get(key)
        if loc is None:
            loc = GL.glGetUniformLocation(prog, name)
            self.uniform_locations[key] = loc
        return loc

    def _set_uniforms(self, prog, res, dt, mouse, mouse_prev, rects, rects_prev, vels, for_buffer, ch_res,
                      substep, substeps):
        def loc(n):
            return self._loc(prog, n)
        GL.glUniform3f(loc("iResolution"), res[0], res[1], res[0] / res[1])
        GL.glUniform1f(loc("iTime"), self.time)
        GL.glUniform1f(loc("iTimeDelta"), dt)
        GL.glUniform1f(loc("iFrameRate"), float(self.args.fps))
        GL.glUniform1i(loc("iFrame"), self.frame)
        GL.glUniform1i(loc("iSubstep"), substep)
        GL.glUniform1i(loc("iSubsteps"), substeps)
        GL.glUniform4f(loc("iMouse"), *mouse)
        GL.glUniform2f(loc("iMousePrev"), *mouse_prev)
        GL.glUniform4f(loc("iDate"), 2026.0, 10.0, 22.0, 43200.0 + self.time)
        GL.glUniform1f(loc("iSampleRate"), 44100.0)
        dither = not for_buffer and not self.args.hdr and not self.args.no_dither
        GL.glUniform1f(loc("iDitherAmount"), 1.0 / 255.0 if dither else 0.0)
        GL.glUniform3fv(loc("iChannelResolution"), 4, np.array(ch_res, np.float32))
        GL.glUniform1fv(loc("iChannelTime"), 4, np.array([self.time] * 4, np.float32))
        for i in range(4):
            GL.glUniform1i(loc("iChannel%d" % i), i)
        GL.glUniform1i(loc("iWindowCount"), self.win_count)
        GL.glUniform4fv(loc("iWindowRects"), MAX_WINDOWS, np.array(rects, np.float32))
        GL.glUniform4fv(loc("iWindowRectsPrev"), MAX_WINDOWS, np.array(rects_prev, np.float32))
        GL.glUniform2fv(loc("iWindowVelocities"), MAX_WINDOWS, np.array(vels, np.float32))
        GL.glUniform2f(loc("iScreenOffset"), 0.0, 0.0)
        GL.glUniform1i(loc("iScreenIndex"), 0)
        GL.glUniform1i(loc("iScreenCount"), 1)
        GL.glUniform1i(loc("iVirtualDesktop"), 0)
        GL.glUniform1i(loc("iVirtualDesktopCount"), 1)
        GL.glUniform1f(loc("iVirtualDesktopAnim"), 0.0)

    def _bind(self, slot, input_type, current):
        GL.glActiveTexture(GL.GL_TEXTURE0 + slot)
        GL.glBindTexture(GL.GL_TEXTURE_2D, 0)
        if 0 <= input_type <= 3:
            if input_type in self.tex:
                GL.glBindTexture(GL.GL_TEXTURE_2D, self.tex[input_type][0])
        elif 10 <= input_type <= 13:
            letter = "ABCD"[input_type - 10]
            if letter not in self.fbo:
                return
            if current == letter:
                tex = self.fbo[letter][0 if not self.ping else 1][1]  # the one not being written
                filt = GL.GL_NEAREST
            else:
                tex = self.fbo[letter][1 if not self.ping else 0][1]
                filt = GL.GL_NEAREST if current else GL.GL_LINEAR
            GL.glBindTexture(GL.GL_TEXTURE_2D, tex)
            GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, filt)
            GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, filt)
        elif input_type == 20 and self.audio is not None:
            GL.glBindTexture(GL.GL_TEXTURE_2D, self.audio_tex)

    def _ch_res(self, mapping, res):
        out = []
        for i in range(4):
            t = mapping[i]
            if 0 <= t <= 3 and t in self.tex:
                _, tw, th = self.tex[t]
                out += [tw, th, tw / th]
            elif t == 20 and self.audio is not None:
                out += [512, 2, 256]
            elif 10 <= t <= 13 and "ABCD"[t - 10] in self.passes:
                out += [self.sim_size[0], self.sim_size[1], self.sim_size[0] / self.sim_size[1]]
            else:
                out += [0.0, 0.0, 0.0]
        return out

    def step(self, dt):
        """One engine frame: accumulateFrame + synchronize + render."""
        a = self.args
        self.time += dt * a.speed
        sdt = dt * a.speed
        w, h = self.w, self.h

        mx, my = mouse_at(self.time, w, h, a.mouse)
        mouse = (mx, my, 0.0, 0.0)
        if a.mouse in ("click", "hold"):
            mouse = (mx, my, mx, my)
        for span in PRESS_SPANS:
            if span[0] <= self.time < span[1]:
                if span[2] is not None:
                    mx, my = span[2][0] * w, span[2][1] * h
                mouse = (mx, my, mx, my)
        mprev = self.prev_mouse if self.prev_mouse else (mx, my)
        self.prev_mouse = (mx, my)

        wins = windows_at(self.time, w, h, a.windows)
        self.win_count = len(wins)
        rects = [0.0] * (MAX_WINDOWS * 4)
        vels = [0.0] * (MAX_WINDOWS * 2)
        for i, r in enumerate(wins):
            rects[i * 4:i * 4 + 4] = r
            if self.prev_wins and i < len(self.prev_wins) and sdt > 0:
                vels[i * 2] = (r[0] - self.prev_wins[i][0]) / dt
                vels[i * 2 + 1] = (r[1] - self.prev_wins[i][1]) / dt
        rects_prev = self.prev_rects
        self.prev_rects = rects
        self.prev_wins = wins

        if self.audio is not None:
            tex = self.audio.texture(self.time)
            GL.glBindTexture(GL.GL_TEXTURE_2D, self.audio_tex)
            GL.glTexSubImage2D(GL.GL_TEXTURE_2D, 0, 0, 0, AUDIO_WIDTH, 2, GL.GL_RGBA, GL.GL_FLOAT, tex)

        GL.glBindVertexArray(self.vao)
        substeps = max(1, min(8, round(sdt * 240.0)))
        sw, sh = self.sim_size
        sx, sy = sw / w, sh / h

        def scale_rects(rs):
            out = list(rs)
            for i in range(MAX_WINDOWS):
                out[i * 4] *= sx
                out[i * 4 + 1] *= sy
                out[i * 4 + 2] *= sx
                out[i * 4 + 3] *= sy
            return out

        bm = (mouse[0] * sx, mouse[1] * sy, mouse[2] * sx, mouse[3] * sy)
        bmp = (mprev[0] * sx, mprev[1] * sy)
        bvel = [v * (sx if i % 2 == 0 else sy) for i, v in enumerate(vels)]
        for s in range(substeps):
            for letter in "ABCD":
                if letter not in self.passes:
                    continue
                target = self.fbo[letter][1 if not self.ping else 0]
                GL.glBindFramebuffer(GL.GL_FRAMEBUFFER, target[0])
                GL.glViewport(0, 0, sw, sh)
                GL.glClear(GL.GL_COLOR_BUFFER_BIT)
                prog = self.programs[letter]
                GL.glUseProgram(prog)
                self._set_uniforms(prog, (sw, sh), sdt / substeps, bm, bmp, scale_rects(rects),
                                   scale_rects(rects_prev), bvel, True,
                                   self._ch_res(self.buf_map[letter], (sw, sh)), s, substeps)
                for i in range(4):
                    self._bind(i, self.buf_map[letter][i], letter)
                GL.glDrawArrays(GL.GL_TRIANGLES, 0, 6)
            if s + 1 < substeps:
                self.ping = not self.ping

        ow, oh = self.out_w, self.out_h
        GL.glBindFramebuffer(GL.GL_FRAMEBUFFER, self.out_fbo)
        GL.glViewport(0, 0, ow, oh)
        GL.glClearColor(0, 0, 0, 1)
        GL.glClear(GL.GL_COLOR_BUFFER_BIT)
        prog = self.programs["image"]
        GL.glUseProgram(prog)
        # Pixel-space inputs scaled into the image pass's own target, as in
        # ShaderEngineRenderer::updateUniforms().
        ox, oy = ow / w, oh / h
        im_mouse = (mouse[0] * ox, mouse[1] * oy, mouse[2] * ox, mouse[3] * oy)
        im_mprev = (mprev[0] * ox, mprev[1] * oy)
        im_rects = [v * (ox if i % 2 == 0 else oy) for i, v in enumerate(rects)]
        im_rprev = [v * (ox if i % 2 == 0 else oy) for i, v in enumerate(rects_prev)]
        im_vels = [v * (ox if i % 2 == 0 else oy) for i, v in enumerate(vels)]
        self._set_uniforms(prog, (ow, oh), sdt, im_mouse, im_mprev, im_rects, im_rprev, im_vels, False,
                           self._ch_res(self.image_map, (ow, oh)), 0, 1)
        for i in range(4):
            self._bind(i, self.image_map[i], None)
        GL.glDrawArrays(GL.GL_TRIANGLES, 0, 6)
        self.ping = not self.ping
        self.frame += 1
        err = GL.glGetError()
        if err != GL.GL_NO_ERROR and not self.gl_error_reported:
            print("render_shader: GL error 0x%04x in frame %d" % (err, self.frame), file=sys.stderr)
            self.gl_error_reported = True

    def snapshot(self, overlay=True):
        GL.glBindFramebuffer(GL.GL_FRAMEBUFFER, self.out_fbo)
        ow, oh = self.out_w, self.out_h
        if self.args.hdr:
            data = GL.glReadPixels(0, 0, ow, oh, GL.GL_RGBA, GL.GL_FLOAT)
            arr = np.frombuffer(data, np.float32).reshape(oh, ow, 4)[::-1]
        else:
            # GLES 3.0 reads back a normalized color buffer only as bytes.
            data = GL.glReadPixels(0, 0, ow, oh, GL.GL_RGBA, GL.GL_UNSIGNED_BYTE)
            arr = np.frombuffer(data, np.uint8).reshape(oh, ow, 4)[::-1].astype(np.float32) / 255.0
        stats = {
            "nan": int(np.isnan(arr).sum()),
            "mean": float(np.nanmean(arr[..., :3])),
            "max": float(np.nanmax(arr[..., :3])),
        }
        img = (np.clip(np.nan_to_num(arr[..., :3]), 0, 1) * 255 + 0.5).astype(np.uint8)
        im = Image.fromarray(img, "RGB")
        if (ow, oh) != (self.w, self.h):
            im = im.resize((self.w, self.h), Image.BILINEAR)
        if overlay and self.args.windows != "none" and self.args.show_windows:
            from PIL import ImageDraw
            d = ImageDraw.Draw(im)
            for x, y, ww, hh in reversed(windows_at(self.time, self.w, self.h, self.args.windows)):
                top = self.h - y - hh
                d.rectangle([x, top, x + ww, self.h - y], fill=(236, 238, 241), outline=(150, 155, 160))
                d.rectangle([x, top, x + ww, top + 22], fill=(206, 210, 216))
        return im, stats


# ---------------------------------------------------------------- commands

def check_all(root, gles):
    ctx = Context(gles)
    eng = engine_sources()
    vs = assemble_vertex(eng, gles)
    print("renderer:", ctx.renderer, "(GLES)" if gles else "")
    files = sorted(p for p in Path(root).rglob("*.frag")
                   if not re.search(r"_(buffer[A-D]|common|Common)$", p.stem))
    failed = 0
    for main in files:
        code, passes, common = discover_package(main)
        code, common = split_shared(code, common)
        units = [("image", code)] + [("buffer " + l, c) for l, c in passes.items()]
        for name, src in units:
            _, err = compile_program(vs, assemble_fragment(eng, gles, common, src))
            if err:
                failed += 1
                first = "\n    ".join(err.strip().split("\n")[:4])
                print("FAIL %s [%s]\n    %s" % (main.relative_to(root), name, first))
    print("%d shader files, %d failing units" % (len(files), failed))
    return 1 if failed else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("shader", nargs="?")
    ap.add_argument("--check", metavar="DIR", help="compile every shader under DIR and exit")
    ap.add_argument("--gles", action="store_true", help="OpenGL ES 3.0 context with the engine's GLES header")
    ap.add_argument("--size", default="960x540")
    ap.add_argument("--fps", type=float, default=60.0)
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--at", default="", help="comma list of times (s) to capture")
    ap.add_argument("--duration", type=float, default=0.0)
    ap.add_argument("--out", default="out.png", help="output png; several --at times make a contact sheet")
    ap.add_argument("--gif", default="", help="animated gif of the whole run")
    ap.add_argument("--gif-fps", type=float, default=20.0)
    ap.add_argument("--channels", default="", help="override the @channels directive")
    ap.add_argument("--tex0")
    ap.add_argument("--tex1")
    ap.add_argument("--tex2")
    ap.add_argument("--tex3")
    ap.add_argument("--default-wallpaper", default="", help="texture for iChannel1 when --tex1 is absent")
    ap.add_argument("--audio", default="synth", choices=["synth", "none"])
    ap.add_argument("--audio-silence", type=float, default=0.0, help="seconds of silence before the track")
    ap.add_argument("--mouse", default="sweep", choices=["sweep", "still", "hop", "none", "click", "hold"])
    ap.add_argument("--mouse-pos", default="", help="x,y fractions of the screen for --mouse still/hold")
    ap.add_argument("--press", default="", help="button held during these spans, ';'-separated; '@x,y' (screen fractions) moves the cursor there, e.g. 2.0-2.2;5-5.6@0.5,0.4")
    ap.add_argument("--windows", default="none", choices=["none", "static", "drag"])
    ap.add_argument("--show-windows", action="store_true", help="draw the windows over the output")
    ap.add_argument("--sim-max-height", type=int, default=0)
    ap.add_argument("--half-float", action="store_true", help="RGBA16F buffers")
    ap.add_argument("--hdr", action="store_true")
    ap.add_argument("--scale", type=float, default=1.0, help="render resolution scale of the image pass")
    ap.add_argument("--no-dither", action="store_true", help="engine dither property off")
    a = ap.parse_args()

    if a.check:
        sys.exit(check_all(a.check, a.gles))
    if not a.shader:
        ap.error("shader path required")
    a.width, a.height = (int(v) for v in a.size.lower().split("x"))
    for span in filter(None, a.press.split(";")):
        pos = None
        if "@" in span:
            span, at = span.split("@")
            pos = tuple(float(v) for v in at.split(","))
        t0, t1 = span.split("-")
        PRESS_SPANS.append((float(t0), float(t1), pos))
    if a.mouse_pos:
        MOUSE_POS[:] = [float(v) for v in a.mouse_pos.split(",")]

    Context(a.gles)
    code, passes, common = discover_package(a.shader)
    r = Renderer(a, code, passes, common)

    times = sorted(float(t) for t in a.at.split(",") if t.strip())
    end = max([a.duration] + times) if (times or a.duration) else 3.0
    dt = 1.0 / a.fps
    shots, frames = [], []
    gif_next = 0.0
    nan_seen = False
    while r.time < end - 1e-9:
        r.step(dt)
        while times and r.time >= times[0] - 1e-9:
            im, st = r.snapshot()
            shots.append((times.pop(0), im, st))
            print("t=%.2f mean=%.3f max=%.3f nan=%d" % (r.time, st["mean"], st["max"], st["nan"]))
            nan_seen |= st["nan"] > 0
        if a.gif and r.time >= gif_next:
            im, _ = r.snapshot()
            frames.append(im.resize((a.width // 2, a.height // 2)))
            gif_next += 1.0 / a.gif_fps
    if not shots and not a.gif:
        im, st = r.snapshot()
        shots.append((r.time, im, st))
        print("t=%.2f mean=%.3f max=%.3f nan=%d" % (r.time, st["mean"], st["max"], st["nan"]))
    if shots:
        if len(shots) == 1:
            shots[0][1].save(a.out)
        else:
            cols = 2 if len(shots) <= 4 else 3
            rows = math.ceil(len(shots) / cols)
            tw, th = a.width // 2, a.height // 2
            sheet = Image.new("RGB", (cols * tw, rows * th))
            for i, (_, im, _) in enumerate(shots):
                sheet.paste(im.resize((tw, th)), ((i % cols) * tw, (i // cols) * th))
            sheet.save(a.out)
        print("wrote", a.out)
    if frames:
        frames[0].save(a.gif, save_all=True, append_images=frames[1:],
                       duration=int(1000 / a.gif_fps), loop=0)
        print("wrote", a.gif)
    sys.exit(2 if nan_seen else 0)


if __name__ == "__main__":
    main()
