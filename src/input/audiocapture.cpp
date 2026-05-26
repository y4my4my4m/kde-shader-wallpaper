// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "audiocapture.h"

#include <QDebug>
#include <cmath>
#include <algorithm>

#ifdef HAVE_PIPEWIRE
#include <pipewire/pipewire.h>
#include <spa/param/audio/format-utils.h>
#endif

// Simple FFT implementation (Cooley-Tukey radix-2)
namespace {

void fft(float *real, float *imag, int n) {
    if (n <= 1) return;
    
    // Bit-reversal permutation
    for (int i = 1, j = 0; i < n; i++) {
        int bit = n >> 1;
        for (; j & bit; bit >>= 1) {
            j ^= bit;
        }
        j ^= bit;
        
        if (i < j) {
            std::swap(real[i], real[j]);
            std::swap(imag[i], imag[j]);
        }
    }
    
    // Cooley-Tukey iterative FFT
    for (int len = 2; len <= n; len <<= 1) {
        float angle = -2.0f * M_PI / len;
        float wReal = std::cos(angle);
        float wImag = std::sin(angle);
        
        for (int i = 0; i < n; i += len) {
            float curReal = 1.0f;
            float curImag = 0.0f;
            
            for (int j = 0; j < len / 2; j++) {
                int u = i + j;
                int v = i + j + len / 2;
                
                float tReal = curReal * real[v] - curImag * imag[v];
                float tImag = curReal * imag[v] + curImag * real[v];
                
                real[v] = real[u] - tReal;
                imag[v] = imag[u] - tImag;
                real[u] += tReal;
                imag[u] += tImag;
                
                float newReal = curReal * wReal - curImag * wImag;
                curImag = curReal * wImag + curImag * wReal;
                curReal = newReal;
            }
        }
    }
}

} // anonymous namespace

AudioCapture::AudioCapture(QObject *parent)
    : QObject(parent)
{
    m_waveform.resize(TEXTURE_WIDTH);
    m_spectrum.resize(TEXTURE_WIDTH);
    m_smoothedSpectrum.resize(TEXTURE_WIDTH);
    m_fftInput.resize(m_fftSize);
    m_fftOutput.resize(m_fftSize);
    
    // Timer for processing audio data on main thread (prevents Qt threading issues)
    // Fixed audio update rate - independent of shader FPS for consistent audio response
    m_processTimer = new QTimer(this);
    m_processTimer->setInterval(1000 / m_audioUpdateRate);  // e.g., 60Hz = ~16ms
    connect(m_processTimer, &QTimer::timeout, this, &AudioCapture::processAudioData);
    
#ifdef HAVE_PIPEWIRE
    pw_init(nullptr, nullptr);
#endif
}

AudioCapture::~AudioCapture()
{
    stop();
    
#ifdef HAVE_PIPEWIRE
    pw_deinit();
#endif
}

bool AudioCapture::available() const
{
#ifdef HAVE_PIPEWIRE
    return true;
#else
    return false;
#endif
}

void AudioCapture::setEnabled(bool enabled)
{
    if (m_enabled == enabled) return;
    m_enabled = enabled;
    
    if (m_enabled) {
        start();
    } else {
        stop();
    }
    
    Q_EMIT enabledChanged();
}

void AudioCapture::setFftSize(int size)
{
    // Must be power of 2
    int validSize = 1;
    while (validSize < size && validSize < 4096) {
        validSize <<= 1;
    }
    
    if (m_fftSize == validSize) return;
    m_fftSize = validSize;
    
    m_fftInput.resize(m_fftSize);
    m_fftOutput.resize(m_fftSize);
    
    Q_EMIT fftSizeChanged();
}

void AudioCapture::setSmoothing(qreal smoothing)
{
    if (qFuzzyCompare(m_smoothing, smoothing)) return;
    m_smoothing = qBound(0.0, smoothing, 0.99);
    Q_EMIT smoothingChanged();
}

void AudioCapture::setAudioUpdateRate(int rate)
{
    // Clamp to reasonable range: 15Hz to 120Hz
    // 15Hz is minimum for smooth visuals, 120Hz is overkill but allowed
    rate = qBound(15, rate, 120);
    if (m_audioUpdateRate == rate) return;
    m_audioUpdateRate = rate;
    
    // Update timer interval
    if (m_processTimer) {
        m_processTimer->setInterval(1000 / m_audioUpdateRate);
    }
    
    Q_EMIT audioUpdateRateChanged();
}

void AudioCapture::setSensitivity(qreal sensitivity)
{
    // Clamp to reasonable range: 0.0 to 100.0
    // Default 40.0 provides good reactivity for most audio sources
    sensitivity = qBound(0.0, sensitivity, 100.0);
    if (qFuzzyCompare(m_sensitivity, sensitivity)) return;
    m_sensitivity = sensitivity;
    Q_EMIT sensitivityChanged();
}

QVariantList AudioCapture::getTextureData()
{
    QMutexLocker locker(&m_dataMutex);
    
    // Create 512x2 RGBA texture data
    // Shadertoy format:
    //   Row 0 (y=0.25): FFT spectrum (frequency domain)
    //   Row 1 (y=0.75): Waveform (time domain)
    QVariantList data;
    data.reserve(TEXTURE_WIDTH * TEXTURE_HEIGHT * 4);
    
    // Row 0: Spectrum/FFT (frequency data) - sampled at y=0.25 in shaders
    for (int i = 0; i < TEXTURE_WIDTH; i++) {
        float freq = (i < m_smoothedSpectrum.size()) ? m_smoothedSpectrum[i] : 0.0f;
        
        data.append(freq); // R
        data.append(freq); // G
        data.append(freq); // B
        data.append(1.0f); // A
    }
    
    // Row 1: Waveform (time domain) - sampled at y=0.75 in shaders
    for (int i = 0; i < TEXTURE_WIDTH; i++) {
        float sample = (i < m_waveform.size()) ? m_waveform[i] : 0.0f;
        sample = (sample + 1.0f) * 0.5f; // Normalize from [-1,1] to [0,1]
        
        data.append(sample); // R
        data.append(sample); // G
        data.append(sample); // B
        data.append(1.0f);   // A
    }
    
    return data;
}

QVector<float> AudioCapture::getWaveform()
{
    QMutexLocker locker(&m_dataMutex);
    return m_waveform;
}

QVector<float> AudioCapture::getSpectrum()
{
    QMutexLocker locker(&m_dataMutex);
    return m_smoothedSpectrum;
}

bool AudioCapture::start()
{
#ifdef HAVE_PIPEWIRE
    if (m_capturing) return true;
    
    qDebug() << "Starting audio capture with PipeWire thread loop...";
    
    // Create thread loop (runs PipeWire in its own thread - non-blocking!)
    m_threadLoop = pw_thread_loop_new("shader-audio", nullptr);
    if (!m_threadLoop) {
        Q_EMIT error(QStringLiteral("Failed to create PipeWire thread loop"));
        return false;
    }
    
    // Create context from thread loop
    m_context = pw_context_new(pw_thread_loop_get_loop(m_threadLoop), nullptr, 0);
    if (!m_context) {
        pw_thread_loop_destroy(m_threadLoop);
        m_threadLoop = nullptr;
        Q_EMIT error(QStringLiteral("Failed to create PipeWire context"));
        return false;
    }
    
    // Lock the loop before connecting
    pw_thread_loop_lock(m_threadLoop);
    
    // Start the thread loop
    if (pw_thread_loop_start(m_threadLoop) < 0) {
        pw_thread_loop_unlock(m_threadLoop);
        pw_context_destroy(m_context);
        pw_thread_loop_destroy(m_threadLoop);
        m_context = nullptr;
        m_threadLoop = nullptr;
        Q_EMIT error(QStringLiteral("Failed to start PipeWire thread loop"));
        return false;
    }
    
    // Connect to PipeWire
    m_core = pw_context_connect(m_context, nullptr, 0);
    if (!m_core) {
        pw_thread_loop_unlock(m_threadLoop);
        pw_thread_loop_stop(m_threadLoop);
        pw_context_destroy(m_context);
        pw_thread_loop_destroy(m_threadLoop);
        m_context = nullptr;
        m_threadLoop = nullptr;
        Q_EMIT error(QStringLiteral("Failed to connect to PipeWire"));
        return false;
    }
    
    // Setup stream properties
    auto props = pw_properties_new(
        PW_KEY_MEDIA_TYPE, "Audio",
        PW_KEY_MEDIA_CATEGORY, "Capture",
        PW_KEY_MEDIA_ROLE, "Music",
        PW_KEY_NODE_NAME, "shader-wallpaper-audio",
        PW_KEY_STREAM_CAPTURE_SINK, "true",  // Capture from output (system audio)
        nullptr
    );
    
    // Stream events
    static const struct pw_stream_events stream_events = {
        .version = PW_VERSION_STREAM_EVENTS,
        .state_changed = onStreamStateChanged,
        .process = onProcess,
    };
    
    // Create stream
    m_stream = pw_stream_new(m_core, "audio-capture", props);
    if (!m_stream) {
        pw_core_disconnect(m_core);
        pw_thread_loop_unlock(m_threadLoop);
        pw_thread_loop_stop(m_threadLoop);
        pw_context_destroy(m_context);
        pw_thread_loop_destroy(m_threadLoop);
        m_core = nullptr;
        m_context = nullptr;
        m_threadLoop = nullptr;
        Q_EMIT error(QStringLiteral("Failed to create PipeWire stream"));
        return false;
    }
    
    spa_zero(m_streamListener);
    pw_stream_add_listener(m_stream, &m_streamListener, &stream_events, this);
    
    // Setup audio format
    uint8_t buffer[1024];
    struct spa_pod_builder b = SPA_POD_BUILDER_INIT(buffer, sizeof(buffer));
    
    struct spa_audio_info_raw info = {
        .format = SPA_AUDIO_FORMAT_F32,
        .rate = (uint32_t)m_sampleRate,
        .channels = 1,
    };
    
    const struct spa_pod *params[1];
    params[0] = spa_format_audio_raw_build(&b, SPA_PARAM_EnumFormat, &info);
    
    // Connect stream
    int result = pw_stream_connect(m_stream,
        PW_DIRECTION_INPUT,
        PW_ID_ANY,
        (pw_stream_flags)(PW_STREAM_FLAG_AUTOCONNECT | PW_STREAM_FLAG_MAP_BUFFERS),
        params, 1);
    
    pw_thread_loop_unlock(m_threadLoop);
    
    if (result < 0) {
        pw_thread_loop_lock(m_threadLoop);
        spa_hook_remove(&m_streamListener);
        pw_stream_destroy(m_stream);
        pw_core_disconnect(m_core);
        pw_thread_loop_unlock(m_threadLoop);
        pw_thread_loop_stop(m_threadLoop);
        pw_context_destroy(m_context);
        pw_thread_loop_destroy(m_threadLoop);
        m_stream = nullptr;
        m_core = nullptr;
        m_context = nullptr;
        m_threadLoop = nullptr;
        Q_EMIT error(QStringLiteral("Failed to connect stream: %1").arg(QString::fromLocal8Bit(strerror(-result))));
        return false;
    }
    
    // Start the processing timer on main thread
    m_processTimer->start();
    
    m_capturing = true;
    Q_EMIT capturingChanged();
    qDebug() << "Audio capture started successfully";
    return true;
#else
    Q_EMIT error(QStringLiteral("PipeWire support not compiled in"));
    return false;
#endif
}

void AudioCapture::stop()
{
#ifdef HAVE_PIPEWIRE
    if (!m_capturing) return;
    
    qDebug() << "Stopping audio capture...";
    
    // Stop the processing timer
    if (m_processTimer) {
        m_processTimer->stop();
    }
    
    if (m_threadLoop) {
        pw_thread_loop_lock(m_threadLoop);
        
        // Remove listener before destroying stream
        spa_hook_remove(&m_streamListener);
        
        if (m_stream) {
            pw_stream_destroy(m_stream);
            m_stream = nullptr;
        }
        
        if (m_core) {
            pw_core_disconnect(m_core);
            m_core = nullptr;
        }
        
        pw_thread_loop_unlock(m_threadLoop);
        
        pw_thread_loop_stop(m_threadLoop);
        
        if (m_context) {
            pw_context_destroy(m_context);
            m_context = nullptr;
        }
        
        pw_thread_loop_destroy(m_threadLoop);
        m_threadLoop = nullptr;
    }
    
    m_capturing = false;
    Q_EMIT capturingChanged();
    qDebug() << "Audio capture stopped";
#endif
}

void AudioCapture::processAudioData()
{
    if (!m_capturing) return;
    
    computeFFT();
    updateBands();
    Q_EMIT audioDataReady();
}

void AudioCapture::computeFFT()
{
    QMutexLocker locker(&m_dataMutex);
    
    // Copy waveform to FFT input with windowing (Hann window)
    for (int i = 0; i < m_fftSize && i < m_waveform.size(); i++) {
        float window = 0.5f * (1.0f - std::cos(2.0f * M_PI * i / (m_fftSize - 1)));
        m_fftInput[i] = m_waveform[i] * window;
    }
    
    // Zero padding if needed
    for (int i = m_waveform.size(); i < m_fftSize; i++) {
        m_fftInput[i] = 0.0f;
    }
    
    // Perform FFT
    m_fftOutput.fill(0.0f);
    fft(m_fftInput.data(), m_fftOutput.data(), m_fftSize);
    
    // Calculate magnitude spectrum with logarithmic frequency mapping
    // This maps linear FFT bins to logarithmic frequency scale (like Shadertoy)
    int numBins = m_fftSize / 2;
    
    for (int i = 0; i < TEXTURE_WIDTH; i++) {
        // Logarithmic frequency mapping: map texture x [0-512] to frequency bins logarithmically
        // This gives more resolution to bass frequencies (where most musical content is)
        float t = static_cast<float>(i) / TEXTURE_WIDTH;
        
        // Use exponential mapping: low frequencies get more bins
        // Map t from [0,1] to frequency bin index using log scale
        float minFreq = 1.0f;  // Start from bin 1 (skip DC)
        float maxFreq = static_cast<float>(numBins - 1);
        float freqBin = minFreq * std::pow(maxFreq / minFreq, t);
        
        // Interpolate between adjacent bins for smoother result
        int bin0 = static_cast<int>(freqBin);
        int bin1 = qMin(bin0 + 1, numBins - 1);
        float frac = freqBin - bin0;
        
        // Get magnitudes for both bins
        float re0 = m_fftInput[bin0];
        float im0 = m_fftOutput[bin0];
        float mag0 = std::sqrt(re0 * re0 + im0 * im0);
        
        float re1 = m_fftInput[bin1];
        float im1 = m_fftOutput[bin1];
        float mag1 = std::sqrt(re1 * re1 + im1 * im1);
        
        // Interpolate magnitude
        float magnitude = mag0 + frac * (mag1 - mag0);
        
        // Normalize by FFT size and apply scaling
        // Use a gentler normalization similar to Shadertoy:
        // - Scale magnitude to reasonable range (typically 0-1)
        // - Apply soft compression to prevent clipping while preserving dynamics
        magnitude /= (m_fftSize * 0.5f);  // Basic normalization
        
        // Apply soft compression (tanh-like curve) to keep values in 0-1 range
        // while preserving dynamics - this is more like how Shadertoy handles it
        // The multiplier controls sensitivity (lower = less sensitive)
        float normalized = magnitude * static_cast<float>(m_sensitivity);
        normalized = normalized / (1.0f + normalized);  // Soft clamp using 1/(1+x) curve
        
        m_spectrum[i] = normalized;
        
        // Apply smoothing (temporal smoothing for visual appeal)
        m_smoothedSpectrum[i] = m_smoothing * m_smoothedSpectrum[i] + 
                                 (1.0f - m_smoothing) * normalized;
    }
}

void AudioCapture::updateBands()
{
    // Calculate frequency bands (bass, mid, treble)
    // Assuming 44100 Hz sample rate:
    // Bass: 20-250 Hz -> bins 0-2
    // Mid: 250-4000 Hz -> bins 2-46
    // Treble: 4000-20000 Hz -> bins 46-232
    
    int bassEnd = 3;
    int midEnd = 47;
    int trebleEnd = qMin(233, TEXTURE_WIDTH);
    
    float bassSum = 0, midSum = 0, trebleSum = 0;
    
    for (int i = 0; i < bassEnd; i++) {
        bassSum += m_smoothedSpectrum[i];
    }
    for (int i = bassEnd; i < midEnd; i++) {
        midSum += m_smoothedSpectrum[i];
    }
    for (int i = midEnd; i < trebleEnd; i++) {
        trebleSum += m_smoothedSpectrum[i];
    }
    
    m_bass = bassSum / bassEnd;
    m_mid = midSum / (midEnd - bassEnd);
    m_treble = trebleSum / (trebleEnd - midEnd);
    
    // Calculate overall volume
    float sum = 0;
    for (const auto &s : m_waveform) {
        sum += std::abs(s);
    }
    m_volume = sum / m_waveform.size();
    
    Q_EMIT volumeChanged();
    Q_EMIT bassChanged();
    Q_EMIT midChanged();
    Q_EMIT trebleChanged();
}

#ifdef HAVE_PIPEWIRE
void AudioCapture::onProcess(void *data)
{
    AudioCapture *self = static_cast<AudioCapture*>(data);
    
    struct pw_buffer *buf = pw_stream_dequeue_buffer(self->m_stream);
    if (!buf) return;
    
    struct spa_buffer *sbuf = buf->buffer;
    if (!sbuf->datas[0].data) {
        pw_stream_queue_buffer(self->m_stream, buf);
        return;
    }
    
    float *samples = static_cast<float*>(sbuf->datas[0].data);
    int numSamples = sbuf->datas[0].chunk->size / sizeof(float);
    
    if (samples && numSamples > 0) {
        QMutexLocker locker(&self->m_dataMutex);
        
        // Copy samples to waveform buffer
        int copyCount = qMin(numSamples, TEXTURE_WIDTH);
        for (int i = 0; i < copyCount; i++) {
            self->m_waveform[i] = samples[i];
        }
    }
    
    pw_stream_queue_buffer(self->m_stream, buf);
}

void AudioCapture::onStreamStateChanged(void *data, enum pw_stream_state old,
                                         enum pw_stream_state state, const char *error)
{
    Q_UNUSED(old)
    AudioCapture *self = static_cast<AudioCapture*>(data);
    
    switch (state) {
        case PW_STREAM_STATE_ERROR:
            qWarning() << "Audio stream error:" << (error ? error : "unknown");
            QMetaObject::invokeMethod(self, [self, error]() {
                Q_EMIT self->error(QStringLiteral("Stream error: %1").arg(error ? QLatin1String(error) : QStringLiteral("unknown")));
            }, Qt::QueuedConnection);
            break;
        case PW_STREAM_STATE_STREAMING:
            qDebug() << "Audio capture streaming started";
            break;
        case PW_STREAM_STATE_PAUSED:
            qDebug() << "Audio capture paused";
            break;
        default:
            break;
    }
}
#endif
