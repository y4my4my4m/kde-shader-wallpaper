// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#ifndef AUDIOCAPTURE_H
#define AUDIOCAPTURE_H

#include <QObject>
#include <QtQml/qqmlregistration.h>
#include <QVector>
#include <QVariantList>
#include <QMutex>
#include <QTimer>

#ifdef HAVE_PIPEWIRE
#include <pipewire/pipewire.h>
#include <spa/utils/hook.h>
#else
// Forward declarations when PipeWire not available
struct pw_thread_loop;
struct pw_stream;
struct pw_context;
struct pw_core;
#endif

/**
 * @brief Captures system audio for audio-reactive shaders
 * 
 * Uses PipeWire to capture system audio output and generates:
 * - Waveform data (512 samples)
 * - FFT spectrum data (512 bins)
 * 
 * Data is formatted as a 512x2 texture where:
 * - Row 0: Waveform (time domain)
 * - Row 1: FFT spectrum (frequency domain)
 * 
 * This matches Shadertoy's audio input format.
 */
class AudioCapture : public QObject
{
    Q_OBJECT
    QML_ELEMENT

    Q_PROPERTY(bool enabled READ enabled WRITE setEnabled NOTIFY enabledChanged)
    Q_PROPERTY(bool available READ available CONSTANT)
    Q_PROPERTY(bool capturing READ capturing NOTIFY capturingChanged)
    Q_PROPERTY(qreal volume READ volume NOTIFY volumeChanged)
    Q_PROPERTY(qreal bass READ bass NOTIFY bassChanged)
    Q_PROPERTY(qreal mid READ mid NOTIFY midChanged)
    Q_PROPERTY(qreal treble READ treble NOTIFY trebleChanged)
    Q_PROPERTY(int sampleRate READ sampleRate NOTIFY sampleRateChanged)
    Q_PROPERTY(int fftSize READ fftSize WRITE setFftSize NOTIFY fftSizeChanged)
    Q_PROPERTY(qreal smoothing READ smoothing WRITE setSmoothing NOTIFY smoothingChanged)
    Q_PROPERTY(int audioUpdateRate READ audioUpdateRate WRITE setAudioUpdateRate NOTIFY audioUpdateRateChanged)
    Q_PROPERTY(qreal sensitivity READ sensitivity WRITE setSensitivity NOTIFY sensitivityChanged)

public:
    static constexpr int TEXTURE_WIDTH = 512;
    static constexpr int TEXTURE_HEIGHT = 2;
    static constexpr int DEFAULT_SAMPLE_RATE = 44100;
    static constexpr int DEFAULT_FFT_SIZE = 512;

    explicit AudioCapture(QObject *parent = nullptr);
    ~AudioCapture() override;

    // Property getters
    bool enabled() const { return m_enabled; }
    bool available() const;
    bool capturing() const { return m_capturing; }
    qreal volume() const { return m_volume; }
    qreal bass() const { return m_bass; }
    qreal mid() const { return m_mid; }
    qreal treble() const { return m_treble; }
    int sampleRate() const { return m_sampleRate; }
    int fftSize() const { return m_fftSize; }
    qreal smoothing() const { return m_smoothing; }
    int audioUpdateRate() const { return m_audioUpdateRate; }
    qreal sensitivity() const { return m_sensitivity; }

    // Property setters
    void setEnabled(bool enabled);
    void setFftSize(int size);
    void setSmoothing(qreal smoothing);
    void setAudioUpdateRate(int rate);
    void setSensitivity(qreal sensitivity);

    /**
     * @brief Get audio texture data (512x2 RGBA)
     * @return Vector of RGBA float values
     */
    Q_INVOKABLE QVariantList getTextureData();
    
    /**
     * @brief Get raw waveform data
     */
    QVector<float> getWaveform();
    
    /**
     * @brief Get FFT spectrum data
     */
    QVector<float> getSpectrum();

    // Start/stop capture
    Q_INVOKABLE bool start();
    Q_INVOKABLE void stop();

Q_SIGNALS:
    void enabledChanged();
    void capturingChanged();
    void volumeChanged();
    void bassChanged();
    void midChanged();
    void trebleChanged();
    void sampleRateChanged();
    void fftSizeChanged();
    void smoothingChanged();
    void audioUpdateRateChanged();
    void sensitivityChanged();
    void audioDataReady();
    void error(const QString &message);

private Q_SLOTS:
    void processAudioData();

private:
    void computeFFT();
    void updateBands();
    
    bool m_enabled = false;
    bool m_capturing = false;
    qreal m_volume = 0.0;
    qreal m_bass = 0.0;
    qreal m_mid = 0.0;
    qreal m_treble = 0.0;
    int m_sampleRate = DEFAULT_SAMPLE_RATE;
    int m_fftSize = DEFAULT_FFT_SIZE;
    qreal m_smoothing = 0.8;
    // Fixed audio processing rate (Hz) - independent of shader FPS
    // 60Hz provides good responsiveness without excessive CPU usage
    int m_audioUpdateRate = 60;
    // Sensitivity multiplier for FFT magnitude (0-100 range)
    // Lower values = less sensitive, higher = more sensitive
    // Default 40.0 provides good reactivity for most audio sources
    qreal m_sensitivity = 40.0;
    
    // Audio buffers
    QVector<float> m_waveform;
    QVector<float> m_spectrum;
    QVector<float> m_smoothedSpectrum;
    QMutex m_dataMutex;
    
    // FFT data
    QVector<float> m_fftInput;
    QVector<float> m_fftOutput;
    
    // Timer for processing on main thread
    QTimer *m_processTimer = nullptr;
    
#ifdef HAVE_PIPEWIRE
    // PipeWire objects - using thread_loop for non-blocking operation
    pw_thread_loop *m_threadLoop = nullptr;
    pw_stream *m_stream = nullptr;
    pw_context *m_context = nullptr;
    pw_core *m_core = nullptr;
    struct spa_hook m_streamListener;
    
    static void onProcess(void *data);
    static void onStreamStateChanged(void *data, pw_stream_state old, 
                                      pw_stream_state state, const char *error);
#endif
};

#endif // AUDIOCAPTURE_H
