// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "uniformmanager.h"

#include <QDateTime>
#include <QTime>
#include <cmath>

UniformManager::UniformManager(QObject *parent)
    : QObject(parent)
{
    m_elapsedTimer.start();
    m_lastFrameTime = m_elapsedTimer.elapsed();
    m_fpsTimestamp = m_lastFrameTime;
    
    // Initialize channel resolutions to default
    for (auto &res : m_channelResolutions) {
        res = m_resolution;
    }
    
    updateDate();
}

UniformManager::~UniformManager() = default;

QVector4D UniformManager::date() const
{
    QDateTime now = QDateTime::currentDateTime();
    QDate d = now.date();
    QTime t = now.time();
    
    float secondsSinceMidnight = t.hour() * 3600.0f + 
                                  t.minute() * 60.0f + 
                                  t.second() + 
                                  t.msec() / 1000.0f;
    
    return QVector4D(d.year(), d.month(), d.day(), secondsSinceMidnight);
}

QVector3D UniformManager::channelResolution(int channel) const
{
    if (channel >= 0 && channel < 4) {
        return m_channelResolutions[channel];
    }
    return m_resolution;
}

qreal UniformManager::channelTime(int channel) const
{
    if (channel >= 0 && channel < 4) {
        return m_channelTimes[channel];
    }
    return m_time;
}

void UniformManager::setResolution(const QVector3D &resolution)
{
    if (m_resolution == resolution) return;
    m_resolution = resolution;
    Q_EMIT resolutionChanged();
}

void UniformManager::setResolution(int width, int height)
{
    float aspect = (height > 0) ? static_cast<float>(width) / height : 1.0f;
    setResolution(QVector3D(width, height, aspect));
}

void UniformManager::setTime(qreal time)
{
    if (qFuzzyCompare(m_time, time)) return;
    m_time = time;
    Q_EMIT timeChanged();
}

void UniformManager::setSpeed(qreal speed)
{
    if (qFuzzyCompare(m_speed, speed)) return;
    m_speed = speed;
    Q_EMIT speedChanged();
}

void UniformManager::setFrame(int frame)
{
    if (m_frame == frame) return;
    m_frame = frame;
    Q_EMIT frameChanged();
}

void UniformManager::setMouse(const QVector4D &mouse)
{
    const QVector2D cur(mouse.x(), mouse.y());
    const QVector2D prev = m_hasMouseHistory ? m_lastMousePos : cur;
    const bool posChanged = !m_hasMouseHistory || m_lastMousePos != cur;

    m_mousePrev = prev;
    m_lastMousePos = cur;
    m_hasMouseHistory = true;

    if (m_mouse == mouse && !posChanged) return;
    m_mouse = mouse;
    Q_EMIT mouseChanged();
    if (posChanged) {
        Q_EMIT mousePrevChanged();
    }
}

void UniformManager::setMousePosition(qreal x, qreal y)
{
    // Update xy while preserving zw (click position)
    m_mouse.setX(x);
    m_mouse.setY(y);
    Q_EMIT mouseChanged();
}

void UniformManager::setMouseClick(qreal x, qreal y)
{
    // Update click position (zw)
    m_mouse.setZ(x);
    m_mouse.setW(y);
    Q_EMIT mouseChanged();
}

void UniformManager::setMousePressed(bool pressed)
{
    if (m_mousePressed == pressed) return;
    m_mousePressed = pressed;
    
    // Shadertoy convention: negative z when mouse is pressed
    if (pressed) {
        m_mouse.setZ(std::abs(m_mouse.z()));
    } else {
        m_mouse.setZ(-std::abs(m_mouse.z()));
    }
    
    Q_EMIT mousePressedChanged();
    Q_EMIT mouseChanged();
}

void UniformManager::setSampleRate(qreal rate)
{
    if (qFuzzyCompare(m_sampleRate, rate)) return;
    m_sampleRate = rate;
    Q_EMIT sampleRateChanged();
}

void UniformManager::setChannelResolution(int channel, const QVector3D &resolution)
{
    if (channel >= 0 && channel < 4) {
        m_channelResolutions[channel] = resolution;
    }
}

void UniformManager::setChannelTime(int channel, qreal time)
{
    if (channel >= 0 && channel < 4) {
        m_channelTimes[channel] = time;
    }
}

void UniformManager::tick()
{
    qint64 currentTime = m_elapsedTimer.elapsed();
    qint64 deltaMs = currentTime - m_lastFrameTime;
    m_lastFrameTime = currentTime;
    
    // Calculate time delta in seconds
    m_timeDelta = deltaMs / 1000.0;
    Q_EMIT timeDeltaChanged();
    
    // Update shader time
    m_time += m_timeDelta * m_speed;
    Q_EMIT timeChanged();
    
    // Update channel times
    for (int i = 0; i < 4; i++) {
        m_channelTimes[i] = m_time;
    }
    
    // Update frame counter
    m_frame++;
    m_frameCount++;
    Q_EMIT frameChanged();
    
    // Update FPS every second
    if (currentTime - m_fpsTimestamp >= 1000) {
        updateFrameRate();
        m_fpsTimestamp = currentTime;
        m_frameCount = 0;
    }
    
    // Update date
    updateDate();
}

void UniformManager::reset()
{
    m_time = 0.0;
    m_frame = 0;
    m_elapsedTimer.restart();
    m_lastFrameTime = 0;
    m_fpsTimestamp = 0;
    m_frameCount = 0;
    
    for (auto &t : m_channelTimes) {
        t = 0.0;
    }
    
    Q_EMIT timeChanged();
    Q_EMIT frameChanged();
}

void UniformManager::updateDate()
{
    m_date = date();
    Q_EMIT dateChanged();
}

void UniformManager::updateFrameRate()
{
    m_frameRate = m_frameCount;
    Q_EMIT frameRateChanged();
}

void UniformManager::applyTo(QOpenGLShaderProgram *program)
{
    if (!program) return;
    
    // Resolution
    program->setUniformValue("iResolution", m_resolution);
    
    // Time
    program->setUniformValue("iTime", static_cast<float>(m_time));
    program->setUniformValue("iTimeDelta", static_cast<float>(m_timeDelta));
    program->setUniformValue("iFrameRate", static_cast<float>(m_frameRate));
    
    // Frame
    program->setUniformValue("iFrame", m_frame);
    
    // Mouse
    program->setUniformValue("iMouse", m_mouse);
    program->setUniformValue("iMousePrev", m_mousePrev);
    
    // Date
    program->setUniformValue("iDate", date());
    
    // Sample rate
    program->setUniformValue("iSampleRate", static_cast<float>(m_sampleRate));
    
    // Channel resolutions
    QVector3D resolutions[4];
    for (int i = 0; i < 4; i++) {
        resolutions[i] = m_channelResolutions[i];
    }
    program->setUniformValueArray("iChannelResolution", resolutions, 4);
    
    // Channel times
    float times[4];
    for (int i = 0; i < 4; i++) {
        times[i] = static_cast<float>(m_channelTimes[i]);
    }
    program->setUniformValueArray("iChannelTime", times, 4, 1);
    
    // Channel sampler locations
    for (int i = 0; i < 4; i++) {
        program->setUniformValue(QStringLiteral("iChannel%1").arg(i).toUtf8().constData(), i);
    }
}

