// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "shadercompiler.h"

#include <QFile>
#include <QRegularExpression>
#include <QProcess>
#include <QTemporaryFile>
#include <QDir>

#ifdef HAVE_SHADERC
#include <shaderc/shaderc.hpp>
#endif

// GLSL 330 header for OpenGL compatibility
static const char *glsl330Header = R"(
#version 330 core
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

// GLSL 450 header for Qt6 RHI / Vulkan
static const char *glsl450Header = R"(
#version 450

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

// Convenience aliases
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

static const char *shaderFooterCode = R"(

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
)";

ShaderCompiler::ShaderCompiler(QObject *parent)
    : QObject(parent)
{
}

ShaderCompiler::~ShaderCompiler() = default;

bool ShaderCompiler::canCompileRuntime() const
{
#ifdef HAVE_SHADERC
    return true;
#elif defined(HAVE_GLSLANG)
    return true;
#else
    return false;
#endif
}

QString ShaderCompiler::shaderHeader()
{
    return QLatin1String(glsl330Header);
}

QString ShaderCompiler::shaderFooter()
{
    return QLatin1String(shaderFooterCode);
}

QString ShaderCompiler::convertShadertoyToQt(const QString &shadertoyCode)
{
    clearError();
    
    QString processed = preprocessShadertoyCode(shadertoyCode);
    
    // Build the complete shader
    QString result = QLatin1String(glsl330Header) + processed + QLatin1String(shaderFooterCode);
    
    return result;
}

QString ShaderCompiler::convertShadertoyToQt6(const QString &shadertoyCode)
{
    clearError();
    
    QString processed = preprocessShadertoyCode(shadertoyCode);
    
    // For GLSL 450, we need to wrap uniform access
    processed = replaceBuiltinVariables(processed);
    
    // Build the complete shader
    QString result = QLatin1String(glsl450Header) + processed + QLatin1String(shaderFooterCode);
    
    return result;
}

QString ShaderCompiler::preprocessShadertoyCode(const QString &code)
{
    QString result = code;
    
    // Remove any existing #version directives (we'll add our own)
    QRegularExpression versionRegex(QStringLiteral(R"(#version\s+\d+(\s+\w+)?\s*\n?)"));
    result.remove(versionRegex);
    
    // Remove any existing precision qualifiers
    QRegularExpression precisionRegex(QStringLiteral(R"(precision\s+(highp|mediump|lowp)\s+\w+\s*;\s*\n?)"));
    result.remove(precisionRegex);
    
    // Handle WebGL-specific texture functions
    result.replace(QLatin1String("texture2D("), QLatin1String("texture("));
    result.replace(QLatin1String("textureCube("), QLatin1String("texture("));
    
    // Remove any main() function (we'll add our own that calls mainImage)
    QRegularExpression mainRegex(QStringLiteral(R"(void\s+main\s*\(\s*\)\s*\{[^}]*mainImage[^}]*\})"));
    result.remove(mainRegex);
    
    // Clean up any standalone main declaration
    QRegularExpression emptyMainRegex(QStringLiteral(R"(void\s+main\s*\(\s*\)\s*\{\s*\})"));
    result.remove(emptyMainRegex);
    
    return result.trimmed();
}

QString ShaderCompiler::replaceBuiltinVariables(const QString &code)
{
    QString result = code;
    
    // For GLSL 450 with uniform buffer, we use #defines in the header
    // so no replacement is needed here
    
    return result;
}

QByteArray ShaderCompiler::compileToSpirv(const QString &glslCode, bool isFragment)
{
    clearError();
    Q_EMIT compilationStarted();
    
#ifdef HAVE_SHADERC
    shaderc::Compiler compiler;
    shaderc::CompileOptions options;
    
    // Set compilation options
    options.SetTargetEnvironment(shaderc_target_env_vulkan, shaderc_env_version_vulkan_1_0);
    options.SetOptimizationLevel(shaderc_optimization_level_performance);
    
    shaderc_shader_kind kind = isFragment ? shaderc_glsl_fragment_shader : shaderc_glsl_vertex_shader;
    
    auto result = compiler.CompileGlslToSpv(
        glslCode.toStdString(),
        kind,
        "shader",
        options
    );
    
    if (result.GetCompilationStatus() != shaderc_compilation_status_success) {
        setError(QString::fromStdString(result.GetErrorMessage()));
        Q_EMIT compilationFinished(false);
        return QByteArray();
    }
    
    QByteArray spirv;
    spirv.resize((result.end() - result.begin()) * sizeof(uint32_t));
    memcpy(spirv.data(), result.begin(), spirv.size());
    
    Q_EMIT compilationFinished(true);
    return spirv;
#else
    // Fallback: try using qsb tool from Qt
    setError(QStringLiteral("Runtime SPIR-V compilation not available. Install shaderc or use precompiled shaders."));
    Q_EMIT compilationFinished(false);
    return QByteArray();
#endif
}

bool ShaderCompiler::validate(const QString &code)
{
    clearError();
    
    // Basic validation: check for mainImage function
    if (!code.contains(QLatin1String("mainImage"))) {
        setError(QStringLiteral("Shader must contain a mainImage function"));
        return false;
    }
    
    // Check for matching braces
    int braceCount = 0;
    for (const QChar &c : code) {
        if (c == QLatin1Char('{')) braceCount++;
        else if (c == QLatin1Char('}')) braceCount--;
        
        if (braceCount < 0) {
            setError(QStringLiteral("Mismatched braces in shader code"));
            return false;
        }
    }
    
    if (braceCount != 0) {
        setError(QStringLiteral("Mismatched braces in shader code"));
        return false;
    }
    
    // Check for mainImage signature
    QRegularExpression mainImageRegex(QStringLiteral(R"(void\s+mainImage\s*\(\s*out\s+vec4\s+\w+\s*,\s*(in\s+)?vec2\s+\w+\s*\))"));
    if (!mainImageRegex.match(code).hasMatch()) {
        // Also accept the variant without 'out' and 'in' keywords
        QRegularExpression altRegex(QStringLiteral(R"(void\s+mainImage\s*\(\s*vec4\s+\w+\s*,\s*vec2\s+\w+\s*\))"));
        if (!altRegex.match(code).hasMatch()) {
            setError(QStringLiteral("mainImage function must have signature: void mainImage(out vec4 fragColor, in vec2 fragCoord)"));
            return false;
        }
    }
    
    return true;
}

bool ShaderCompiler::generateQsb(const QString &glslCode, const QString &outputPath)
{
    clearError();
    
    // Create temporary file for GLSL
    QTemporaryFile tempFile;
    tempFile.setFileTemplate(QDir::tempPath() + QStringLiteral("/shader_XXXXXX.frag"));
    
    if (!tempFile.open()) {
        setError(QStringLiteral("Failed to create temporary file"));
        return false;
    }
    
    // Write the shader code
    QString fullCode = convertShadertoyToQt6(glslCode);
    tempFile.write(fullCode.toUtf8());
    tempFile.flush();
    
    // Run qsb tool
    QProcess qsb;
    QStringList args = {
        QStringLiteral("--glsl"), QStringLiteral("100 es,120,150"),
        QStringLiteral("--hlsl"), QStringLiteral("50"),
        QStringLiteral("--msl"), QStringLiteral("12"),
        QStringLiteral("-o"), outputPath,
        tempFile.fileName()
    };
    
    // Try common qsb locations
    QStringList qsbPaths = {
        QStringLiteral("/usr/lib/qt6/bin/qsb"),
        QStringLiteral("/usr/lib64/qt6/bin/qsb"),
        QStringLiteral("/usr/local/lib/qt6/bin/qsb"),
        QStringLiteral("qsb")
    };
    
    bool found = false;
    for (const QString &path : qsbPaths) {
        qsb.start(path, args);
        if (qsb.waitForStarted(1000)) {
            found = true;
            break;
        }
    }
    
    if (!found) {
        setError(QStringLiteral("qsb tool not found. Please ensure Qt6 Shader Tools are installed."));
        return false;
    }
    
    if (!qsb.waitForFinished(30000)) {
        setError(QStringLiteral("qsb compilation timed out"));
        return false;
    }
    
    if (qsb.exitCode() != 0) {
        setError(QStringLiteral("qsb failed: %1").arg(QString::fromUtf8(qsb.readAllStandardError())));
        return false;
    }
    
    return true;
}

void ShaderCompiler::setError(const QString &error)
{
    if (m_lastError == error) return;
    m_lastError = error;
    Q_EMIT lastErrorChanged();
}

void ShaderCompiler::clearError()
{
    setError(QString());
}

