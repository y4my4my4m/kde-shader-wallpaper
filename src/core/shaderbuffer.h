// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2024 @y4my4m <y4my4m@protonmail.com>

#ifndef SHADERBUFFER_H
#define SHADERBUFFER_H

#include <QObject>
#include <QtQml/qqmlregistration.h>
#include <QOpenGLFramebufferObject>
#include <QOpenGLShaderProgram>
#include <QSize>

#include <array>
#include <functional>
#include <memory>

/**
 * @brief Represents a single shader buffer pass (BufferA/B/C/D)
 *
 * Each buffer can render to its own FBO and be used as input
 * to other buffers or the main image pass. Supports ping-pong
 * buffering for feedback effects.
 */
class ShaderBuffer : public QObject
{
    Q_OBJECT
    QML_ELEMENT

    Q_PROPERTY(QString name READ name WRITE setName NOTIFY nameChanged)
    Q_PROPERTY(QString shaderCode READ shaderCode WRITE setShaderCode NOTIFY shaderCodeChanged)
    Q_PROPERTY(bool enabled READ enabled WRITE setEnabled NOTIFY enabledChanged)
    Q_PROPERTY(int width READ width NOTIFY sizeChanged)
    Q_PROPERTY(int height READ height NOTIFY sizeChanged)

    // Input channel configuration
    Q_PROPERTY(int channel0Input READ channel0Input WRITE setChannel0Input NOTIFY channel0InputChanged)
    Q_PROPERTY(int channel1Input READ channel1Input WRITE setChannel1Input NOTIFY channel1InputChanged)
    Q_PROPERTY(int channel2Input READ channel2Input WRITE setChannel2Input NOTIFY channel2InputChanged)
    Q_PROPERTY(int channel3Input READ channel3Input WRITE setChannel3Input NOTIFY channel3InputChanged)

public:
    enum class InputType {
        None = -1,
        Texture0 = 0,
        Texture1 = 1,
        Texture2 = 2,
        Texture3 = 3,
        BufferA = 10,
        BufferB = 11,
        BufferC = 12,
        BufferD = 13,
        Audio = 20,
        Keyboard = 21,
        Webcam = 22,
        Cubemap = 30
    };
    Q_ENUM(InputType)

    explicit ShaderBuffer(QObject *parent = nullptr);
    ~ShaderBuffer() override;

    QString name() const { return m_name; }
    QString shaderCode() const { return m_shaderCode; }
    bool enabled() const { return m_enabled; }
    int width() const { return m_size.width(); }
    int height() const { return m_size.height(); }

    int channel0Input() const { return m_channelInputs[0]; }
    int channel1Input() const { return m_channelInputs[1]; }
    int channel2Input() const { return m_channelInputs[2]; }
    int channel3Input() const { return m_channelInputs[3]; }

    void setName(const QString &name);
    void setShaderCode(const QString &code);
    void setEnabled(bool enabled);
    void setChannel0Input(int input);
    void setChannel1Input(int input);
    void setChannel2Input(int input);
    void setChannel3Input(int input);

    void initialize(const QSize &size);
    void resize(const QSize &size);
    bool compile();

    void render(const std::function<void(QOpenGLShaderProgram*)> &uniformSetter,
                const std::function<GLuint(int)> &getTexture);

    void swapBuffers();

    GLuint currentTexture() const;
    GLuint previousTexture() const;
    QOpenGLFramebufferObject* currentFBO();
    QOpenGLShaderProgram* program() { return m_program.get(); }

    bool isCompiled() const { return m_compiled; }
    QString compileError() const { return m_compileError; }

Q_SIGNALS:
    void nameChanged();
    void shaderCodeChanged();
    void enabledChanged();
    void sizeChanged();
    void channel0InputChanged();
    void channel1InputChanged();
    void channel2InputChanged();
    void channel3InputChanged();
    void compiled();
    void compileErrorChanged();

private:
    void createFBOs();

    QString m_name;
    QString m_shaderCode;
    bool m_enabled = false;
    QSize m_size;

    std::array<int, 4> m_channelInputs = {-1, -1, -1, -1};

    std::unique_ptr<QOpenGLShaderProgram> m_program;
    std::unique_ptr<QOpenGLFramebufferObject> m_fbo[2];
    int m_currentBuffer = 0;

    bool m_compiled = false;
    QString m_compileError;
    bool m_initialized = false;
};

/**
 * @brief Manages all four shader buffers
 */
class BufferManager : public QObject
{
    Q_OBJECT
    QML_ELEMENT

    Q_PROPERTY(ShaderBuffer* bufferA READ bufferA CONSTANT)
    Q_PROPERTY(ShaderBuffer* bufferB READ bufferB CONSTANT)
    Q_PROPERTY(ShaderBuffer* bufferC READ bufferC CONSTANT)
    Q_PROPERTY(ShaderBuffer* bufferD READ bufferD CONSTANT)

public:
    explicit BufferManager(QObject *parent = nullptr);
    ~BufferManager() override;

    ShaderBuffer* bufferA() { return m_buffers[0].get(); }
    ShaderBuffer* bufferB() { return m_buffers[1].get(); }
    ShaderBuffer* bufferC() { return m_buffers[2].get(); }
    ShaderBuffer* bufferD() { return m_buffers[3].get(); }

    ShaderBuffer* buffer(int index);

    void initialize(const QSize &size);
    void resize(const QSize &size);

    void renderAll(const std::function<void(QOpenGLShaderProgram*)> &uniformSetter,
                   const std::function<GLuint(int)> &getTexture);

    void swapAll();

    GLuint getBufferTexture(int bufferIndex);

private:
    std::array<std::unique_ptr<ShaderBuffer>, 4> m_buffers;
};

#endif // SHADERBUFFER_H