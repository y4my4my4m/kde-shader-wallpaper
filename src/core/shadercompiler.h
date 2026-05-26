// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#ifndef SHADERCOMPILER_H
#define SHADERCOMPILER_H

#include <QObject>
#include <QtQml/qqmlregistration.h>
#include <QString>
#include <QByteArray>

/**
 * @brief Handles runtime shader compilation and conversion
 * 
 * Supports:
 * - Shadertoy GLSL to Qt-compatible GLSL conversion
 * - Runtime GLSL to SPIR-V compilation (via shaderc or glslang)
 * - Shader validation and error reporting
 */
class ShaderCompiler : public QObject
{
    Q_OBJECT
    QML_ELEMENT

    Q_PROPERTY(bool canCompileRuntime READ canCompileRuntime CONSTANT)
    Q_PROPERTY(QString lastError READ lastError NOTIFY lastErrorChanged)

public:
    explicit ShaderCompiler(QObject *parent = nullptr);
    ~ShaderCompiler() override;

    /**
     * @brief Check if runtime GLSL->SPIRV compilation is available
     */
    bool canCompileRuntime() const;
    
    /**
     * @brief Get the last error message
     */
    QString lastError() const { return m_lastError; }

    /**
     * @brief Convert Shadertoy-style GLSL to Qt-compatible GLSL 330
     * @param shadertoyCode The original Shadertoy code
     * @return Converted GLSL code ready for Qt's ShaderEffect or OpenGL
     */
    Q_INVOKABLE QString convertShadertoyToQt(const QString &shadertoyCode);
    
    /**
     * @brief Convert Shadertoy-style GLSL to GLSL 450 (Vulkan/Qt6 RHI)
     * @param shadertoyCode The original Shadertoy code
     * @return Converted GLSL 450 code
     */
    Q_INVOKABLE QString convertShadertoyToQt6(const QString &shadertoyCode);
    
    /**
     * @brief Compile GLSL to SPIR-V at runtime
     * @param glslCode GLSL source code
     * @param isFragment True for fragment shader, false for vertex
     * @return SPIR-V bytecode, empty on failure
     */
    Q_INVOKABLE QByteArray compileToSpirv(const QString &glslCode, bool isFragment = true);
    
    /**
     * @brief Validate shader code without full compilation
     * @param code Shader source code
     * @return True if valid
     */
    Q_INVOKABLE bool validate(const QString &code);
    
    /**
     * @brief Generate a .qsb (Qt Shader Baker) file
     * @param glslCode GLSL source code
     * @param outputPath Path to write .qsb file
     * @return True on success
     */
    Q_INVOKABLE bool generateQsb(const QString &glslCode, const QString &outputPath);

    /**
     * @brief Get header for Qt-compatible shaders
     */
    static QString shaderHeader();
    
    /**
     * @brief Get footer for Qt-compatible shaders
     */
    static QString shaderFooter();

Q_SIGNALS:
    void lastErrorChanged();
    void compilationStarted();
    void compilationFinished(bool success);

private:
    void setError(const QString &error);
    void clearError();
    
    QString preprocessShadertoyCode(const QString &code);
    QString replaceBuiltinVariables(const QString &code);
    
    QString m_lastError;
};

#endif // SHADERCOMPILER_H

