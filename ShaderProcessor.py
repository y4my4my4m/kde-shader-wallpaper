import re
from pathlib import Path

# Configuration
DIRECTORY_PATH = Path("package/contents/ui/Shaders/ConvertMe")

# Variables to map to the ubuf struct
VARS_TO_MAP = [
    "iTime",
    "iTimeDelta",
    "iFrameRate",
    "iSampleRate",
    "iFrame",
    "iDate",
    "iMouse",
    "iResolution",
    "iChannelTime",
    "iChannelResolution",
]

HEADER = """#version 450

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float iTime;
    float iTimeDelta;
    float iFrameRate;
    float iSampleRate;
    int iFrame;
    vec4 iDate;
    vec4 iMouse;
    vec3 iResolution;
    float iChannelTime[4];
    vec3 iChannelResolution[4];
} ubuf;

layout(binding = 1) uniform sampler2D iChannel0;
layout(binding = 2) uniform sampler2D iChannel1;
layout(binding = 3) uniform sampler2D iChannel2;
layout(binding = 4) uniform sampler2D iChannel3;

vec2 fragCoord = vec2(qt_TexCoord0.x, 1.0 - qt_TexCoord0.y) * ubuf.iResolution.xy;
"""

FOOTER = """
void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
"""

# Compile a single regex for all variables
# Uses a negative lookbehind to ensure we don't double-prefix ubuf.ubuf.iTime
VAR_PATTERN = re.compile(rf"(?<!\.)\b({'|'.join(VARS_TO_MAP)})\b")


def process_shader(file_path: Path):
    content = file_path.read_text(encoding="utf-8")

    # Check if already processed (Idempotency)
    if "layout(std140, binding = 0) uniform buf" in content:
        return False

    # Strip existing #version
    content = re.sub(r"^\s*#version\s+.*?\n", "", content, flags=re.MULTILINE)

    # Strip existing void main().
    # Instead of parsing braces, we strip everything from 'void main' to the end
    # of the file, assuming it was added by a previous run or is boilerplate.
    content = re.sub(r"void\s+main\s*\([\s\S]*$", "", content).strip()

    # Map variables to ubuf. in a single pass
    content = VAR_PATTERN.sub(lambda m: f"ubuf.{m.group(1)}", content)

    # Reassemble
    final_content = f"{HEADER}\n{content}\n{FOOTER}"
    file_path.write_text(final_content, encoding="utf-8")
    return True


if __name__ == "__main__":
    if not DIRECTORY_PATH.exists():
        print(f"Error: {DIRECTORY_PATH} does not exist.")
    else:
        for shader in DIRECTORY_PATH.rglob("*.frag"):
            if process_shader(shader):
                print(f"Successfully processed: {shader.name}")
            else:
                print(f"Skipped (already processed): {shader.name}")
