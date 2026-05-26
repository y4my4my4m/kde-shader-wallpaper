// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2024 @y4my4my4m <y4my4my4m@protonmail.com>

#include "shaderbuffer.h"

#include <QOpenGLContext>
#include <QOpenGLFunctions>

// Vertex shader (same as main engine)
static const char *bufferVertexShader = R"(
#version 330 core
layout(location = 0) in vec2 position;
layout(location = 1) in vec2 texCoord;
out vec2 fragCoord;
out vec2 qt_TexCoord0;
uniform vec3 iResolution;

void main() {
    gl_Position = vec4(position, 0.0, 1.0);
    qt_TexCoord0 = texCoord;
    fragCoord = texCoord * iResolution.xy;
}
)";

static const char *bufferShaderHeader = R"(
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
uniform vec2 iMousePrev;
uniform vec4 iDate;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];

uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;

)";

static const char *bufferShaderFooter = R"(

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
)";

// ============================================================================
// ShaderBuffer Implementation
// ============================================================================

ShaderBuffer::ShaderBuffer(QObject *parent)
    : QObject(parent)
{
}

ShaderBuffer::~ShaderBuffer() = default;

void ShaderBuffer::setName(const QString &name)
{
    if (m_name == name) return;
    m_name = name;
    Q_EMIT nameChanged();
}

void ShaderBuffer::setShaderCode(const QString &code)
{
    if (m_shaderCode == code) return;
    m_shaderCode = code;
    m_compiled = false;
    Q_EMIT shaderCodeChanged();
}

void ShaderBuffer::setEnabled(bool enabled)
{
    if (m_enabled == enabled) return;
    m_enabled = enabled;
    Q_EMIT enabledChanged();
}

void ShaderBuffer::setChannel0Input(int input)
{
    if (m_channelInputs[0] == input) return;
    m_channelInputs[0] = input;
    Q_EMIT channel0InputChanged();
}

void ShaderBuffer::setChannel1Input(int input)
{
    if (m_channelInputs[1] == input) return;
    m_channelInputs[1] = input;
    Q_EMIT channel1InputChanged();
}

void ShaderBuffer::setChannel2Input(int input)
{
    if (m_channelInputs[2] == input) return;
    m_channelInputs[2] = input;
    Q_EMIT channel2InputChanged();
}

void ShaderBuffer::setChannel3Input(int input)
{
    if (m_channelInputs[3] == input) return;
    m_channelInputs[3] = input;
    Q_EMIT channel3InputChanged();
}

void ShaderBuffer::initialize(const QSize &size)
{
    if (m_initialized && m_size == size) return;

    m_size = size;
    createFBOs();
    m_initialized = true;

    Q_EMIT sizeChanged();
}

void ShaderBuffer::resize(const QSize &size)
{
    if (m_size == size) return;

    m_size = size;
    createFBOs();

    Q_EMIT sizeChanged();
}

void ShaderBuffer::createFBOs()
{
    QOpenGLFramebufferObjectFormat format;
    format.setAttachment(QOpenGLFramebufferObject::NoAttachment);
    format.setInternalTextureFormat(GL_RGBA32F);
    format.setMipmap(false);

    m_fbo[0] = std::make_unique<QOpenGLFramebufferObject>(m_size, format);
    m_fbo[1] = std::make_unique<QOpenGLFramebufferObject>(m_size, format);

    auto *f = QOpenGLContext::currentContext()->functions();

    for (int i = 0; i < 2; i++) {
        GLuint tex = m_fbo[i]->texture();

        // Important for simulation buffers:
        // - NEAREST prevents filtering/smearing between simulation pixels.
        // - CLAMP_TO_EDGE prevents accidental wrapping.
        f->glBindTexture(GL_TEXTURE_2D, tex);
        f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
        f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
        f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        f->glBindTexture(GL_TEXTURE_2D, 0);

        // Clear both ping-pong buffers.
        m_fbo[i]->bind();
        f->glClearColor(0.0f, 0.0f, 0.0f, 0.0f);
        f->glClear(GL_COLOR_BUFFER_BIT);
        m_fbo[i]->release();
    }
}

bool ShaderBuffer::compile()
{
    if (m_shaderCode.isEmpty()) {
        m_compileError = QStringLiteral("No shader code provided");
        return false;
    }

    m_program = std::make_unique<QOpenGLShaderProgram>();

    // Compile vertex shader
    if (!m_program->addShaderFromSourceCode(QOpenGLShader::Vertex, bufferVertexShader)) {
        m_compileError = QStringLiteral("Vertex shader error: %1").arg(m_program->log());
        m_compiled = false;
        Q_EMIT compileErrorChanged();
        return false;
    }

    // Build full fragment shader
    QString fullShader =
        QLatin1String(bufferShaderHeader)
        + m_shaderCode
        + QLatin1String(bufferShaderFooter);

    // Compile fragment shader
    if (!m_program->addShaderFromSourceCode(QOpenGLShader::Fragment, fullShader)) {
        m_compileError = QStringLiteral("Fragment shader error: %1").arg(m_program->log());
        m_compiled = false;
        Q_EMIT compileErrorChanged();
        return false;
    }

    // Link program
    if (!m_program->link()) {
        m_compileError = QStringLiteral("Linking error: %1").arg(m_program->log());
        m_compiled = false;
        Q_EMIT compileErrorChanged();
        return false;
    }

    m_compiled = true;
    m_compileError.clear();
    Q_EMIT compiled();
    return true;
}

void ShaderBuffer::render(const std::function<void(QOpenGLShaderProgram*)> &uniformSetter,
                          const std::function<GLuint(int)> &getTexture)
{
    if (!m_enabled || !m_compiled || !m_program) return;
    if (!m_fbo[m_currentBuffer]) return;

    auto *f = QOpenGLContext::currentContext()->functions();

    // Bind to current FBO.
    // This is the write target for this frame.
    m_fbo[m_currentBuffer]->bind();

    f->glViewport(0, 0, m_size.width(), m_size.height());
    f->glClear(GL_COLOR_BUFFER_BIT);

    m_program->bind();

    // Set uniforms via callback.
    if (uniformSetter) {
        uniformSetter(m_program.get());
    }

    // Resolve current buffer index from name.
    const int thisBufferIndex =
        m_name == QLatin1String("BufferA") ? 0 :
        m_name == QLatin1String("BufferB") ? 1 :
        m_name == QLatin1String("BufferC") ? 2 :
        m_name == QLatin1String("BufferD") ? 3 : -1;

    // InputType enum values.
    const int bufferA = static_cast<int>(InputType::BufferA);
    const int bufferB = static_cast<int>(InputType::BufferB);
    const int bufferC = static_cast<int>(InputType::BufferC);
    const int bufferD = static_cast<int>(InputType::BufferD);

    // Bind input textures.
    //
    // Important:
    // Buffer self-reference must bind previousTexture(), not currentTexture().
    // Otherwise a Shadertoy-style feedback buffer reads from the same texture it
    // is rendering into, which causes incorrect/undefined feedback behavior.
    for (int i = 0; i < 4; i++) {
        f->glActiveTexture(GL_TEXTURE0 + i);

        const int input = m_channelInputs[i];
        GLuint tex = 0;

        const bool inputIsBuffer =
            input == bufferA ||
            input == bufferB ||
            input == bufferC ||
            input == bufferD;

        const int inputBufferIndex =
            input == bufferA ? 0 :
            input == bufferB ? 1 :
            input == bufferC ? 2 :
            input == bufferD ? 3 : -1;

        if (inputIsBuffer) {
            if (inputBufferIndex == thisBufferIndex) {
                // Self-reference:
                // BufferA reading BufferA should read the previous ping-pong texture.
                tex = previousTexture();
            } else if (getTexture) {
                // Reading another buffer:
                // BufferB reading BufferA should read BufferA's current rendered texture.
                tex = getTexture(input);
            }
        } else if (input >= 0 && getTexture) {
            // Non-buffer input, such as image/file/camera/video texture.
            tex = getTexture(input);
        }

        if (tex > 0) {
            f->glBindTexture(GL_TEXTURE_2D, tex);
        } else {
            f->glBindTexture(GL_TEXTURE_2D, 0);
        }

        m_program->setUniformValue(
            QStringLiteral("iChannel%1").arg(i).toUtf8().constData(),
            i
        );
    }

    // Draw fullscreen quad.
    // Assumes VAO is already bound by caller.
    f->glDrawArrays(GL_TRIANGLES, 0, 6);

    // Unbind channel textures to avoid leaking texture state.
    for (int i = 0; i < 4; i++) {
        f->glActiveTexture(GL_TEXTURE0 + i);
        f->glBindTexture(GL_TEXTURE_2D, 0);
    }

    f->glActiveTexture(GL_TEXTURE0);

    m_program->release();
    m_fbo[m_currentBuffer]->release();
}

void ShaderBuffer::swapBuffers()
{
    m_currentBuffer = 1 - m_currentBuffer;
}

GLuint ShaderBuffer::currentTexture() const
{
    if (m_fbo[m_currentBuffer]) {
        return m_fbo[m_currentBuffer]->texture();
    }
    return 0;
}

GLuint ShaderBuffer::previousTexture() const
{
    const int prevBuffer = 1 - m_currentBuffer;
    if (m_fbo[prevBuffer]) {
        return m_fbo[prevBuffer]->texture();
    }
    return 0;
}

QOpenGLFramebufferObject* ShaderBuffer::currentFBO()
{
    return m_fbo[m_currentBuffer].get();
}

// ============================================================================
// BufferManager Implementation
// ============================================================================

BufferManager::BufferManager(QObject *parent)
    : QObject(parent)
{
    m_buffers[0] = std::make_unique<ShaderBuffer>(this);
    m_buffers[0]->setName(QStringLiteral("BufferA"));

    m_buffers[1] = std::make_unique<ShaderBuffer>(this);
    m_buffers[1]->setName(QStringLiteral("BufferB"));

    m_buffers[2] = std::make_unique<ShaderBuffer>(this);
    m_buffers[2]->setName(QStringLiteral("BufferC"));

    m_buffers[3] = std::make_unique<ShaderBuffer>(this);
    m_buffers[3]->setName(QStringLiteral("BufferD"));
}

BufferManager::~BufferManager() = default;

ShaderBuffer* BufferManager::buffer(int index)
{
    if (index >= 0 && index < 4) {
        return m_buffers[index].get();
    }
    return nullptr;
}

void BufferManager::initialize(const QSize &size)
{
    for (auto &buffer : m_buffers) {
        buffer->initialize(size);
    }
}

void BufferManager::resize(const QSize &size)
{
    for (auto &buffer : m_buffers) {
        buffer->resize(size);
    }
}

void BufferManager::renderAll(const std::function<void(QOpenGLShaderProgram*)> &uniformSetter,
                              const std::function<GLuint(int)> &getTexture)
{
    // Render buffers in order: A -> B -> C -> D.
    //
    // Important:
    // Do not call swapAll() before rendering the final Image pass.
    //
    // Correct frame order:
    //   1. renderAll()
    //   2. render final Image shader, reading BufferA currentTexture()
    //   3. swapAll()
    for (auto &buffer : m_buffers) {
        if (buffer->enabled()) {
            buffer->render(uniformSetter, getTexture);
        }
    }
}

void BufferManager::swapAll()
{
    for (auto &buffer : m_buffers) {
        buffer->swapBuffers();
    }
}

GLuint BufferManager::getBufferTexture(int bufferIndex)
{
    if (bufferIndex >= 0 && bufferIndex < 4) {
        return m_buffers[bufferIndex]->currentTexture();
    }
    return 0;
}