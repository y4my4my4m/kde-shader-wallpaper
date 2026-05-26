// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "shaderconverter.h"

#include <QRegularExpression>

// GLSL 330 header
static const char *glsl330Header = R"(#version 330 core

in vec2 fragCoord;
in vec2 qt_TexCoord0;
out vec4 fragColor;

uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform float iFrameRate;
uniform int iFrame;
uniform vec4 iMouse;
uniform vec4 iDate;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];

uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;

)";

// GLSL 450 header for Qt6 RHI
static const char *glsl450Header = R"(#version 450

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

#define iTime ubuf.iTime
#define iTimeDelta ubuf.iTimeDelta
#define iFrameRate ubuf.iFrameRate
#define iFrame ubuf.iFrame
#define iMouse ubuf.iMouse
#define iDate ubuf.iDate
#define iResolution ubuf.iResolution
#define iSampleRate ubuf.iSampleRate
#define iChannelTime ubuf.iChannelTime
#define iChannelResolution ubuf.iChannelResolution

vec2 fragCoord = vec2(qt_TexCoord0.x, 1.0 - qt_TexCoord0.y) * ubuf.iResolution.xy;

)";

static const char *shaderFooter = R"(

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
)";

ShaderConverter::ShaderConverter(QObject *parent)
    : QObject(parent)
{
}

ShaderConverter::~ShaderConverter() = default;

QString ShaderConverter::convert(const QString &shadertoyCode, TargetVersion target)
{
    QString code = shadertoyCode;
    
    // Preprocess
    code = preprocessCode(code);
    
    // Replace deprecated functions
    code = replaceDeprecatedFunctions(code);
    
    // Fix common issues
    code = fixCommonIssues(code);
    
    // Replace builtin variables for GLSL 450 if needed
    if (target == TargetVersion::GLSL_450) {
        code = replaceBuiltinVariables(code, target);
    }
    
    // Add header
    code = addHeader(code, target);
    
    // Add footer if mainImage exists but no main
    if (hasMainImage(shadertoyCode)) {
        code = addFooter(code);
    }
    
    return code;
}

QString ShaderConverter::toGLSL330(const QString &shadertoyCode)
{
    return convert(shadertoyCode, TargetVersion::GLSL_330);
}

QString ShaderConverter::toGLSL450(const QString &shadertoyCode)
{
    return convert(shadertoyCode, TargetVersion::GLSL_450);
}

QString ShaderConverter::wrapMainImage(const QString &code)
{
    if (hasMainImage(code)) {
        return code;
    }
    
    // Wrap the code in a mainImage function
    QString wrapped = QStringLiteral("void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n");
    wrapped += code;
    wrapped += QStringLiteral("\n}\n");
    
    return wrapped;
}

bool ShaderConverter::hasMainImage(const QString &code)
{
    QRegularExpression regex(QStringLiteral(R"(void\s+mainImage\s*\()"));
    return regex.match(code).hasMatch();
}

QStringList ShaderConverter::detectFeatures(const QString &code)
{
    QStringList features;
    
    // Check for various Shadertoy features
    if (code.contains(QStringLiteral("iChannel0"))) features << QStringLiteral("iChannel0");
    if (code.contains(QStringLiteral("iChannel1"))) features << QStringLiteral("iChannel1");
    if (code.contains(QStringLiteral("iChannel2"))) features << QStringLiteral("iChannel2");
    if (code.contains(QStringLiteral("iChannel3"))) features << QStringLiteral("iChannel3");
    
    if (code.contains(QStringLiteral("iMouse"))) features << QStringLiteral("mouse");
    if (code.contains(QStringLiteral("iDate"))) features << QStringLiteral("date");
    if (code.contains(QStringLiteral("iTime"))) features << QStringLiteral("time");
    if (code.contains(QStringLiteral("iFrame"))) features << QStringLiteral("frame");
    
    // Check for texture sampling
    if (code.contains(QStringLiteral("texture(")) || code.contains(QStringLiteral("texture2D("))) {
        features << QStringLiteral("textures");
    }
    
    // Check for 3D/raymarching patterns
    QRegularExpression raymarchRegex(QStringLiteral(R"((?:raymar|sdf|distance\s*field|signed\s*distance|sphere\s*tracing))"), 
                                      QRegularExpression::CaseInsensitiveOption);
    if (raymarchRegex.match(code).hasMatch()) {
        features << QStringLiteral("raymarching");
    }
    
    // Check for noise functions
    if (code.contains(QStringLiteral("noise")) || code.contains(QStringLiteral("hash")) || code.contains(QStringLiteral("random"))) {
        features << QStringLiteral("noise");
    }
    
    // Check for matrix operations
    if (code.contains(QStringLiteral("mat2")) || code.contains(QStringLiteral("mat3")) || code.contains(QStringLiteral("mat4"))) {
        features << QStringLiteral("matrices");
    }
    
    return features;
}

QString ShaderConverter::preprocessCode(const QString &code)
{
    QString result = code;
    
    // Remove existing #version directives
    QRegularExpression versionRegex(QStringLiteral(R"(#version\s+\d+(\s+\w+)?\s*\n?)"));
    result.remove(versionRegex);
    
    // Remove precision qualifiers (not needed in desktop GLSL)
    QRegularExpression precisionRegex(QStringLiteral(R"(precision\s+(highp|mediump|lowp)\s+\w+\s*;\s*\n?)"));
    result.remove(precisionRegex);
    
    // Remove existing main() function that just calls mainImage
    QRegularExpression simpleMainRegex(QStringLiteral(
        R"(void\s+main\s*\(\s*\)\s*\{\s*(?:vec4\s+\w+\s*=\s*vec4\s*\([^)]*\)\s*;)?\s*mainImage\s*\([^)]*\)\s*;\s*(?:fragColor\s*=\s*\w+\s*;)?\s*\})"
    ));
    result.remove(simpleMainRegex);
    
    return result.trimmed();
}

QString ShaderConverter::replaceDeprecatedFunctions(const QString &code)
{
    QString result = code;
    
    // texture2D -> texture
    result.replace(QRegularExpression(QStringLiteral(R"(\btexture2D\s*\()")), QStringLiteral("texture("));
    
    // texture2DLod -> textureLod
    result.replace(QRegularExpression(QStringLiteral(R"(\btexture2DLod\s*\()")), QStringLiteral("textureLod("));
    
    // texture2DProj -> textureProj
    result.replace(QRegularExpression(QStringLiteral(R"(\btexture2DProj\s*\()")), QStringLiteral("textureProj("));
    
    // textureCube -> texture
    result.replace(QRegularExpression(QStringLiteral(R"(\btextureCube\s*\()")), QStringLiteral("texture("));
    
    // textureCubeLod -> textureLod
    result.replace(QRegularExpression(QStringLiteral(R"(\btextureCubeLod\s*\()")), QStringLiteral("textureLod("));
    
    return result;
}

QString ShaderConverter::replaceBuiltinVariables(const QString &code, TargetVersion target)
{
    if (target != TargetVersion::GLSL_450) {
        return code;
    }
    
    QString result = code;
    
    // For GLSL 450, we use #defines in the header so uniform access
    // is already handled. But we need to handle array access specially.
    
    // Replace iChannelTime[X] with ubuf.iChannelTime[X]
    QRegularExpression channelTimeRegex(QStringLiteral(R"(\biChannelTime\s*\[)"));
    result.replace(channelTimeRegex, QStringLiteral("ubuf.iChannelTime["));
    
    // Replace iChannelResolution[X] with ubuf.iChannelResolution[X]
    QRegularExpression channelResRegex(QStringLiteral(R"(\biChannelResolution\s*\[)"));
    result.replace(channelResRegex, QStringLiteral("ubuf.iChannelResolution["));
    
    return result;
}

QString ShaderConverter::fixCommonIssues(const QString &code)
{
    QString result = code;
    
    // Fix double negation in smoothstep that some old GLSL doesn't handle
    // (this is valid but can cause issues)
    
    // Fix atan with two arguments (atan2 behavior)
    // In GLSL, atan(y, x) is the proper form
    
    // Ensure vec2/vec3/vec4 constructors have proper arguments
    // This is a common issue when copying code between versions
    
    // Fix mod() with negative values (behavior differs between implementations)
    // Add a safe mod function if needed
    
    // Handle different precision between platforms
    // Add epsilon where needed for floating point comparisons
    
    return result;
}

QString ShaderConverter::addHeader(const QString &code, TargetVersion target)
{
    QString header;
    
    switch (target) {
        case TargetVersion::GLSL_330:
            header = QLatin1String(glsl330Header);
            break;
        case TargetVersion::GLSL_450:
            header = QLatin1String(glsl450Header);
            break;
        case TargetVersion::GLSL_ES_300:
            header = QStringLiteral("#version 300 es\n");
            header += QStringLiteral("precision highp float;\n");
            header += QLatin1String(glsl330Header).mid(QStringLiteral("#version 330 core\n").length());
            break;
    }
    
    return header + QStringLiteral("\n") + code;
}

QString ShaderConverter::addFooter(const QString &code)
{
    return code + QLatin1String(shaderFooter);
}

