// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#ifndef UNIFORMMANAGER_H
#define UNIFORMMANAGER_H

#include <QObject>
#include <QtQml/qqmlregistration.h>
#include <QVector3D>
#include <QVector4D>
#include <QDateTime>
#include <QElapsedTimer>
#include <QOpenGLShaderProgram>
#include <array>

/**
 * @brief Manages all shader uniform values
 * 
 * Provides Shadertoy-compatible uniforms:
 * - iResolution: viewport resolution (x, y, aspect ratio)
 * - iTime: shader playback time in seconds
 * - iTimeDelta: render time in seconds
 * - iFrame: shader playback frame
 * - iFrameRate: frames per second
 * - iMouse: mouse input (xy = current pos, zw = click pos)
 * - iDate: year, month, day, seconds since midnight
 * - iChannelResolution[4]: resolution of each channel
 * - iChannelTime[4]: playback time of each channel
 * - iSampleRate: sound sample rate (typically 44100)
 */
class UniformManager : public QObject
{
    Q_OBJECT
    QML_ELEMENT

    // Resolution
    Q_PROPERTY(QVector3D resolution READ resolution WRITE setResolution NOTIFY resolutionChanged)
    
    // Time
    Q_PROPERTY(qreal time READ time WRITE setTime NOTIFY timeChanged)
    Q_PROPERTY(qreal timeDelta READ timeDelta NOTIFY timeDeltaChanged)
    Q_PROPERTY(qreal speed READ speed WRITE setSpeed NOTIFY speedChanged)
    
    // Frame
    Q_PROPERTY(int frame READ frame WRITE setFrame NOTIFY frameChanged)
    Q_PROPERTY(qreal frameRate READ frameRate NOTIFY frameRateChanged)
    
    // Mouse
    Q_PROPERTY(QVector4D mouse READ mouse WRITE setMouse NOTIFY mouseChanged)
    Q_PROPERTY(QVector2D mousePrev READ mousePrev NOTIFY mousePrevChanged)
    Q_PROPERTY(bool mousePressed READ mousePressed WRITE setMousePressed NOTIFY mousePressedChanged)
    
    // Date
    Q_PROPERTY(QVector4D date READ date NOTIFY dateChanged)
    
    // Audio
    Q_PROPERTY(qreal sampleRate READ sampleRate WRITE setSampleRate NOTIFY sampleRateChanged)

public:
    explicit UniformManager(QObject *parent = nullptr);
    ~UniformManager() override;

    // Property getters
    QVector3D resolution() const { return m_resolution; }
    qreal time() const { return m_time; }
    qreal timeDelta() const { return m_timeDelta; }
    qreal speed() const { return m_speed; }
    int frame() const { return m_frame; }
    qreal frameRate() const { return m_frameRate; }
    QVector4D mouse() const { return m_mouse; }
    QVector2D mousePrev() const { return m_mousePrev; }
    bool mousePressed() const { return m_mousePressed; }
    QVector4D date() const;
    qreal sampleRate() const { return m_sampleRate; }
    
    // Channel resolutions
    QVector3D channelResolution(int channel) const;
    qreal channelTime(int channel) const;

    // Property setters
    void setResolution(const QVector3D &resolution);
    void setResolution(int width, int height);
    void setTime(qreal time);
    void setSpeed(qreal speed);
    void setFrame(int frame);
    void setMouse(const QVector4D &mouse);
    void setMousePosition(qreal x, qreal y);
    void setMouseClick(qreal x, qreal y);
    void setMousePressed(bool pressed);
    void setSampleRate(qreal rate);
    void setChannelResolution(int channel, const QVector3D &resolution);
    void setChannelTime(int channel, qreal time);

    // Frame update
    Q_INVOKABLE void tick();
    Q_INVOKABLE void reset();
    
    // Apply uniforms to shader program
    void applyTo(QOpenGLShaderProgram *program);

Q_SIGNALS:
    void resolutionChanged();
    void timeChanged();
    void timeDeltaChanged();
    void speedChanged();
    void frameChanged();
    void frameRateChanged();
    void mouseChanged();
    void mousePrevChanged();
    void mousePressedChanged();
    void dateChanged();
    void sampleRateChanged();

private:
    void updateDate();
    void updateFrameRate();

    // Resolution
    QVector3D m_resolution{1920.0f, 1080.0f, 1920.0f / 1080.0f};
    
    // Time
    qreal m_time = 0.0;
    qreal m_timeDelta = 0.0;
    qreal m_speed = 1.0;
    QElapsedTimer m_elapsedTimer;
    qint64 m_lastFrameTime = 0;
    
    // Frame
    int m_frame = 0;
    qreal m_frameRate = 60.0;
    int m_frameCount = 0;
    qint64 m_fpsTimestamp = 0;
    
    // Mouse
    QVector4D m_mouse{0.0f, 0.0f, 0.0f, 0.0f};
    QVector2D m_mousePrev{0.0f, 0.0f};
    QVector2D m_lastMousePos{0.0f, 0.0f};
    bool m_hasMouseHistory = false;
    bool m_mousePressed = false;
    
    // Date
    QVector4D m_date;
    
    // Audio
    qreal m_sampleRate = 44100.0;
    
    // Channel info
    std::array<QVector3D, 4> m_channelResolutions;
    std::array<qreal, 4> m_channelTimes = {0.0, 0.0, 0.0, 0.0};
};

#endif // UNIFORMMANAGER_H

