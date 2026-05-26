// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#ifndef SHADERCONVERTER_H
#define SHADERCONVERTER_H

#include <QObject>
#include <QtQml/qqmlregistration.h>
#include <QString>
#include <QStringList>
#include <QMap>

/**
 * @brief Converts Shadertoy GLSL to Qt-compatible GLSL
 * 
 * Handles:
 * - GLSL ES to GLSL 330/450 conversion
 * - Adding proper headers and footers
 * - Replacing deprecated functions
 * - Fixing common compatibility issues
 */
class ShaderConverter : public QObject
{
    Q_OBJECT
    QML_ELEMENT

    Q_PROPERTY(QString lastError READ lastError NOTIFY lastErrorChanged)

public:
    explicit ShaderConverter(QObject *parent = nullptr);
    ~ShaderConverter() override;

    enum class TargetVersion {
        GLSL_330,   // OpenGL 3.3 (desktop)
        GLSL_450,   // Vulkan / Qt6 RHI
        GLSL_ES_300 // OpenGL ES 3.0
    };
    Q_ENUM(TargetVersion)

    QString lastError() const { return m_lastError; }

    /**
     * @brief Convert Shadertoy code to Qt-compatible GLSL
     * @param shadertoyCode Original Shadertoy mainImage code
     * @param target Target GLSL version
     * @return Converted GLSL code
     */
    Q_INVOKABLE QString convert(const QString &shadertoyCode, 
                                 TargetVersion target = TargetVersion::GLSL_330);
    
    /**
     * @brief Convert to GLSL 330 for OpenGL rendering
     */
    Q_INVOKABLE QString toGLSL330(const QString &shadertoyCode);
    
    /**
     * @brief Convert to GLSL 450 for Qt6 RHI
     */
    Q_INVOKABLE QString toGLSL450(const QString &shadertoyCode);
    
    /**
     * @brief Wrap code in mainImage function if needed
     */
    Q_INVOKABLE QString wrapMainImage(const QString &code);
    
    /**
     * @brief Check if code already has mainImage function
     */
    Q_INVOKABLE bool hasMainImage(const QString &code);
    
    /**
     * @brief Get list of detected features in shader
     */
    Q_INVOKABLE QStringList detectFeatures(const QString &code);

Q_SIGNALS:
    void lastErrorChanged();

private:
    QString preprocessCode(const QString &code);
    QString replaceDeprecatedFunctions(const QString &code);
    QString replaceBuiltinVariables(const QString &code, TargetVersion target);
    QString fixCommonIssues(const QString &code);
    QString addHeader(const QString &code, TargetVersion target);
    QString addFooter(const QString &code);
    
    QString m_lastError;
};

#endif // SHADERCONVERTER_H

