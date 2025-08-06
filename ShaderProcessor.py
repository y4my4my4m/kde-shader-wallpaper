import os
import re

# Specify the directory where your .frag files are located
directory_path = 'package/contents/ui/Shaders/ConvertMe'

# List of variables to update
variables_to_update = [
    'iTime', 'iTimeDelta', 'iFrameRate', 'iSampleRate',
    'iFrame', 'iDate', 'iMouse', 'iResolution',
    r'iChannelTime', r'iChannelResolution'
]

# Header to be prepended to the shader file
header = '''#version 450

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
'''

# Footer to be appended, containing the main entry point
footer = '''
void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
'''

for root, dirs, files in os.walk(directory_path):
    for file in files:
        if file.endswith('.frag'):
            file_path = os.path.join(root, file)
            with open(file_path, 'r+', encoding='utf-8') as f:
                content = f.read()

                # 1. Remove any existing #version directive to avoid conflicts
                content = re.sub(r'^\s*#version\s+.*?\n', '', content, flags=re.MULTILINE)

                # 2. Remove any pre-existing main() function
                content = re.sub(r'void\s+main\s*\([^)]*\)\s*\{[\s\S]*?\}', '', content)

                # 3. Prepend 'ubuf.' to all shadertoy uniforms
                for var in variables_to_update:
                    pattern = r'(?<!\.)\b' + var + r'\b'
                    replacement = 'ubuf.' + var
                    content = re.sub(pattern, replacement, content)

                # 4. Assemble the final, complete shader
                final_content = header + '\n' + content.strip() + '\n' + footer

                # Write the updated content back to the file
                f.seek(0)
                f.write(final_content)
                f.truncate()

            print(f"Successfully processed {file}")
