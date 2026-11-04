#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Compare separately rendered Nacre screens with one desktop-sized render.

Uses the real engine's shader assembly and headless renderer. The layout is
two 2560x1440 outputs with a 431-pixel vertical offset. Independent iTime
values exercise late starts and resumes while iGlobalTime stays shared.
"""

import argparse
import json
import tempfile
from pathlib import Path
from types import SimpleNamespace

import numpy as np
from PIL import Image

import render_shader as headless


def render(source, size, desktop, offset, local_time, global_time, gles, background=None, count=2):
    """Draw one output, using output-pixel screen geometry, without dither."""
    args = SimpleNamespace(
        width=size[0], height=size[1], gles=gles, channels="", audio="none",
        audio_silence=0.0, sim_max_height=0, tex0=background, tex1=None,
        tex2=None, tex3=None, default_wallpaper="", scale=1.0, hdr=False,
        half_float=False, fps=60.0, speed=1.0, mouse="none", windows="none",
        show_windows=False, no_dither=True, screen_offset=offset,
        desktop_size=desktop, screen_count=count, global_time=global_time,
    )
    renderer = headless.Renderer(args, source, {}, "")
    assert renderer._loc(renderer.programs["image"], "iGlobalTime") >= 0
    renderer.time = local_time - 1.0 / args.fps
    renderer.step(1.0 / args.fps)
    image, _ = renderer.snapshot()
    gl = headless.GL
    gl.glDeleteFramebuffers(1, [renderer.out_fbo])
    textures = [renderer.out_tex, renderer.audio_tex] + [t[0] for t in renderer.tex.values()]
    gl.glDeleteTextures(len(textures), textures)
    gl.glDeleteVertexArrays(1, [renderer.vao])
    for program in renderer.programs.values():
        gl.glDeleteProgram(program)
    return image


def main():
    """Check image crops, shared phase, and the disabled-span fallback."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gles", action="store_true")
    parser.add_argument("--out", type=Path, default=headless.REPO / "build/nacre-spanning")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    context = headless.Context(args.gles)
    source = (headless.REPO / "package/contents/ui/Shaders/Nacre.frag").read_text()
    desktop = (5120, 1871)
    size = (2560, 1440)
    offsets = [(0, 0), (2560, 431)]
    results = []
    with tempfile.TemporaryDirectory(prefix="nacre-span-") as temp:
        background = Path(temp) / "background.png"
        x, y = np.meshgrid(np.linspace(0, 1, 600), np.linspace(0, 1, 800))
        colors = np.stack((0.2 + 0.6 * x, 0.15 + 0.7 * y,
                           0.25 + 0.5 * ((x * 10).astype(int) % 2)), axis=-1)
        Image.fromarray((colors * 255).astype(np.uint8)).save(background)
        for time, image in [(60, None), (43200, None), (60, str(background))]:
            reference = render(source, desktop, desktop, (0, 0), 0, time, args.gles, image)
            composite = Image.new("RGB", desktop, "#20232b")
            for index, offset in enumerate(offsets):
                output = render(source, size, desktop, offset, 5000 * index, time, args.gles, image)
                left, top = offset[0], desktop[1] - offset[1] - size[1]
                crop = reference.crop((left, top, left + size[0], top + size[1]))
                delta = np.abs(np.asarray(output).astype(np.int16) - np.asarray(crop).astype(np.int16))
                result = dict(time=time, background=bool(image), screen=index,
                              mean_error=float(delta.mean()), p99_error=float(np.percentile(delta, 99)),
                              max_error=int(delta.max()))
                results.append(result)
                print(json.dumps(result))
                # Different 2x2 derivative-quad parity at an odd Y offset
                # can change filtered specular highlights by a few levels.
                assert result["mean_error"] < 0.05, result
                assert result["p99_error"] <= 1 and result["max_error"] <= 12, result
                composite.paste(output, (left, top))
            name = "background" if image else f"{time}s"
            composite.resize((1920, 702), Image.Resampling.LANCZOS).save(args.out / f"{name}.png")

        normal = render(source, (640, 360), (640, 360), (0, 0), 60, 60, args.gles, count=1)
        disabled = render(source, (640, 360), desktop, offsets[1], 60, 4000, args.gles, count=1)
        assert np.array_equal(np.asarray(normal), np.asarray(disabled)), "span-off changed single-screen playback"
    report = dict(api="GLES" if args.gles else "GL", renderer=context.renderer,
                  layout=dict(desktop=desktop, screen=size, offsets=offsets),
                  span_off_identical=True, comparisons=results)
    (args.out / "checks.json").write_text(json.dumps(report, indent=2) + "\n")
    print("Nacre spanning checks passed")


if __name__ == "__main__":
    main()
