// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KDE contributors

#ifndef FRAMEBUFFERUTILS_H
#define FRAMEBUFFERUTILS_H

#include <QOpenGLFramebufferObject>
#include <QSize>

#include <array>
#include <memory>

namespace FramebufferUtils
{

struct BufferPair
{
    std::unique_ptr<QOpenGLFramebufferObject> front;
    std::unique_ptr<QOpenGLFramebufferObject> back;
    GLenum internalTextureFormat = 0;

    explicit operator bool() const
    {
        return front && front->isValid() && back && back->isValid();
    }
};

inline const char *textureFormatName(GLenum format)
{
    switch (format) {
    case GL_RGBA32F:
        return "GL_RGBA32F";
    case GL_RGBA16F:
        return "GL_RGBA16F";
    case GL_RGBA8:
        return "GL_RGBA8";
    default:
        return "unknown";
    }
}

inline BufferPair createBufferPair(const QSize &size)
{
    // Preserve full precision where supported. Some OpenGL contexts created by
    // Plasma cannot render to RGBA32F, so progressively use broader formats.
    constexpr std::array<GLenum, 3> formats = {
        GL_RGBA32F,
        GL_RGBA16F,
        GL_RGBA8,
    };

    QOpenGLFramebufferObjectFormat format;
    format.setAttachment(QOpenGLFramebufferObject::NoAttachment);
    format.setMipmap(false);

    for (const GLenum internalFormat : formats) {
        format.setInternalTextureFormat(internalFormat);

        BufferPair pair;
        pair.front = std::make_unique<QOpenGLFramebufferObject>(size, format);
        pair.back = std::make_unique<QOpenGLFramebufferObject>(size, format);
        pair.internalTextureFormat = internalFormat;

        // Ping-pong buffers must use the same renderable format.
        if (pair) {
            return pair;
        }
    }

    return {};
}

}

#endif // FRAMEBUFFERUTILS_H
