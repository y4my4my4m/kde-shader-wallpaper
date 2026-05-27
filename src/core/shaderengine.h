// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#ifndef SHADERENGINE_H
#define SHADERENGINE_H

#include <QQuickFramebufferObject>
#include <QQuickWindow>
#include <QPointer>
#include <QtQml/qqmlregistration.h>
#include <QOpenGLShaderProgram>
#include <QOpenGLFramebufferObject>
#include <QOpenGLTexture>
#include <QElapsedTimer>
#include <QTimer>
#include <QUrl>
#include <QVector4D>
#include <QVector3D>
#include <QVector2D>

class QFileSystemWatcher;
#include <memory>
#include <array>
#include <deque>

class ShaderBuffer;
class UniformManager;
class CursorTracker;
class AudioCapture;

/**
 * @brief Main shader rendering engine using QQuickFramebufferObject
 * 
 * Provides multi-pass rendering with 4 buffers (A/B/C/D) like Shadertoy,
 * configurable frame rate, and full uniform support.
 */
class ShaderEngine : public QQuickFramebufferObject
{
    Q_OBJECT
    QML_ELEMENT

    // Shader source
    Q_PROPERTY(QUrl shaderSource READ shaderSource WRITE setShaderSource NOTIFY shaderSourceChanged)
    Q_PROPERTY(QString shaderCode READ shaderCode WRITE setShaderCode NOTIFY shaderCodeChanged)
    
    // Playback control
    Q_PROPERTY(bool running READ running WRITE setRunning NOTIFY runningChanged)
    Q_PROPERTY(qreal speed READ speed WRITE setSpeed NOTIFY speedChanged)
    Q_PROPERTY(int targetFps READ targetFps WRITE setTargetFps NOTIFY targetFpsChanged)
    Q_PROPERTY(int currentFps READ currentFps NOTIFY currentFpsChanged)

    // Render resolution scale. 1.0 = native, < 1.0 trades fidelity for FPS,
    // > 1.0 is supersampling. Clamped to [0.25, 2.0]. The FBO is allocated
    // at (item size * scale) and Qt's scene graph bilinearly upscales to
    // the item's rect (legacy #23).
    Q_PROPERTY(qreal resolutionScale READ resolutionScale WRITE setResolutionScale NOTIFY resolutionScaleChanged)

    // Cap the pixel height of buffer-pass FBOs (0 = native/full size).
    // Wave simulations like water_ripple need a coarse grid (~540 px tall,
    // Shadertoy-scale) or ripples look microscopic on 1440p/4K monitors.
    // The buffer texture is linearly upsampled when the main pass reads it.
    Q_PROPERTY(int bufferSimulationMaxHeight READ bufferSimulationMaxHeight
               WRITE setBufferSimulationMaxHeight NOTIFY bufferSimulationMaxHeightChanged)
    
    // Time control
    Q_PROPERTY(qreal iTime READ iTime NOTIFY iTimeChanged)
    Q_PROPERTY(int iFrame READ iFrame NOTIFY iFrameChanged)
    
    // Mouse input
    Q_PROPERTY(QVector4D iMouse READ iMouse WRITE setIMouse NOTIFY iMouseChanged)
    Q_PROPERTY(bool mouseEnabled READ mouseEnabled WRITE setMouseEnabled NOTIFY mouseEnabledChanged)
    Q_PROPERTY(qreal mouseBias READ mouseBias WRITE setMouseBias NOTIFY mouseBiasChanged)
    
    // Channels (textures or buffers)
    Q_PROPERTY(QUrl iChannel0 READ iChannel0 WRITE setIChannel0 NOTIFY iChannel0Changed)
    Q_PROPERTY(QUrl iChannel1 READ iChannel1 WRITE setIChannel1 NOTIFY iChannel1Changed)
    Q_PROPERTY(QUrl iChannel2 READ iChannel2 WRITE setIChannel2 NOTIFY iChannel2Changed)
    Q_PROPERTY(QUrl iChannel3 READ iChannel3 WRITE setIChannel3 NOTIFY iChannel3Changed)
    
    // Channel flags
    Q_PROPERTY(bool iChannel0Enabled READ iChannel0Enabled WRITE setIChannel0Enabled NOTIFY iChannel0EnabledChanged)
    Q_PROPERTY(bool iChannel1Enabled READ iChannel1Enabled WRITE setIChannel1Enabled NOTIFY iChannel1EnabledChanged)
    Q_PROPERTY(bool iChannel2Enabled READ iChannel2Enabled WRITE setIChannel2Enabled NOTIFY iChannel2EnabledChanged)
    Q_PROPERTY(bool iChannel3Enabled READ iChannel3Enabled WRITE setIChannel3Enabled NOTIFY iChannel3EnabledChanged)
    
    // Buffer configuration
    Q_PROPERTY(bool useBufferA READ useBufferA WRITE setUseBufferA NOTIFY useBufferAChanged)
    Q_PROPERTY(bool useBufferB READ useBufferB WRITE setUseBufferB NOTIFY useBufferBChanged)
    Q_PROPERTY(bool useBufferC READ useBufferC WRITE setUseBufferC NOTIFY useBufferCChanged)
    Q_PROPERTY(bool useBufferD READ useBufferD WRITE setUseBufferD NOTIFY useBufferDChanged)
    
    Q_PROPERTY(QString commonCode READ commonCode WRITE setCommonCode NOTIFY commonCodeChanged)
    Q_PROPERTY(QString bufferACode READ bufferACode WRITE setBufferACode NOTIFY bufferACodeChanged)
    Q_PROPERTY(QString bufferBCode READ bufferBCode WRITE setBufferBCode NOTIFY bufferBCodeChanged)
    Q_PROPERTY(QString bufferCCode READ bufferCCode WRITE setBufferCCode NOTIFY bufferCCodeChanged)
    Q_PROPERTY(QString bufferDCode READ bufferDCode WRITE setBufferDCode NOTIFY bufferDCodeChanged)
    
    // Per-pass channel mapping (each pass has its own 4 channels)
    // Values: -1=None, 0-3=Texture0-3, 10-13=BufferA-D, 20=Audio
    Q_PROPERTY(QVariantList imageChannels READ imageChannels WRITE setImageChannels NOTIFY imageChannelsChanged)
    Q_PROPERTY(QVariantList bufferAChannels READ bufferAChannels WRITE setBufferAChannels NOTIFY bufferAChannelsChanged)
    Q_PROPERTY(QVariantList bufferBChannels READ bufferBChannels WRITE setBufferBChannels NOTIFY bufferBChannelsChanged)
    Q_PROPERTY(QVariantList bufferCChannels READ bufferCChannels WRITE setBufferCChannels NOTIFY bufferCChannelsChanged)
    Q_PROPERTY(QVariantList bufferDChannels READ bufferDChannels WRITE setBufferDChannels NOTIFY bufferDChannelsChanged)
    
    // Audio
    Q_PROPERTY(bool audioEnabled READ audioEnabled WRITE setAudioEnabled NOTIFY audioEnabledChanged)
    Q_PROPERTY(int audioChannel READ audioChannel WRITE setAudioChannel NOTIFY audioChannelChanged)
    Q_PROPERTY(QVariantList audioData READ audioData WRITE setAudioData NOTIFY audioDataChanged)
    
    // Multi-monitor uniforms (experimental). When set, the shader gets:
    //   uniform vec2 iScreenOffset; // this screen's top-left in pixels
    //                                // within the virtual desktop
    //   uniform int  iScreenIndex;  // 0-based ordinal
    //   uniform int  iScreenCount;  // total screens
    // Useful for shaders that span all monitors as one continuous canvas.
    Q_PROPERTY(QVector2D screenOffset READ screenOffset WRITE setScreenOffset NOTIFY screenOffsetChanged)
    Q_PROPERTY(int screenIndex READ screenIndex WRITE setScreenIndex NOTIFY screenIndexChanged)
    Q_PROPERTY(int screenCount READ screenCount WRITE setScreenCount NOTIFY screenCountChanged)

    // Per-virtual-desktop uniforms (experimental):
    //   uniform int   iVirtualDesktop;       // current desktop index
    //   uniform int   iVirtualDesktopCount;  // total desktops
    //   uniform float iVirtualDesktopAnim;   // 0..1 transition prog
    Q_PROPERTY(int virtualDesktop READ virtualDesktop WRITE setVirtualDesktop NOTIFY virtualDesktopChanged)
    Q_PROPERTY(int virtualDesktopCount READ virtualDesktopCount WRITE setVirtualDesktopCount NOTIFY virtualDesktopCountChanged)
    Q_PROPERTY(qreal virtualDesktopAnim READ virtualDesktopAnim WRITE setVirtualDesktopAnim NOTIFY virtualDesktopAnimChanged)

    // Hot-reload (C8): when true, the engine watches the active shader's
    // .frag files on disk (main pass + enabled buffer passes + common)
    // and reloads them the moment they change (debounced). Lets the user
    // edit shaders in their favourite editor and see the wallpaper update
    // in real time. Defaults to false because watching every desktop's
    // wallpaper files is wasteful for normal users.
    Q_PROPERTY(bool watchSourceFile READ watchSourceFile WRITE setWatchSourceFile NOTIFY watchSourceFileChanged)

    // Window tracking (for window-reactive effects)
    Q_PROPERTY(bool windowsEnabled READ windowsEnabled WRITE setWindowsEnabled NOTIFY windowsEnabledChanged)
    Q_PROPERTY(int windowCount READ windowCount WRITE setWindowCount NOTIFY windowCountChanged)
    Q_PROPERTY(QVariantList windowRects READ windowRects WRITE setWindowRects NOTIFY windowRectsChanged)
    Q_PROPERTY(QVariantList windowVelocities READ windowVelocities WRITE setWindowVelocities NOTIFY windowVelocitiesChanged)
    
    // Status
    Q_PROPERTY(QString errorMessage READ errorMessage NOTIFY errorMessageChanged)
    Q_PROPERTY(bool hasError READ hasError NOTIFY hasErrorChanged)

    // Most recent GL compile/link log (read-only, for the config UI's
    // compile-error pane). Populated by the renderer via a queued
    // invocation whenever compileShader / compileBufferShader fails.
    Q_PROPERTY(QString compileLog READ compileLog NOTIFY compileLogChanged)
    
    // Performance metrics
    Q_PROPERTY(qreal frameTime READ frameTime NOTIFY frameTimeChanged)
    Q_PROPERTY(qreal averageFrameTime READ averageFrameTime NOTIFY performanceStatsChanged)
    Q_PROPERTY(qreal minFrameTime READ minFrameTime NOTIFY performanceStatsChanged)
    Q_PROPERTY(qreal maxFrameTime READ maxFrameTime NOTIFY performanceStatsChanged)

public:
    explicit ShaderEngine(QQuickItem *parent = nullptr);
    ~ShaderEngine() override;

    Renderer *createRenderer() const override;

    // Property getters
    QUrl shaderSource() const { return m_shaderSource; }
    QString shaderCode() const { return m_shaderCode; }
    bool running() const { return m_running; }
    qreal speed() const { return m_speed; }
    int targetFps() const { return m_targetFps; }
    int currentFps() const { return m_currentFps; }
    qreal resolutionScale() const { return m_resolutionScale; }
    int bufferSimulationMaxHeight() const { return m_bufferSimulationMaxHeight; }
    qreal iTime() const { return m_iTime; }
    int iFrame() const { return m_iFrame; }
    QVector4D iMouse() const { return m_iMouse; }
    bool mouseEnabled() const { return m_mouseEnabled; }
    qreal mouseBias() const { return m_mouseBias; }
    
    QUrl iChannel0() const { return m_iChannel0; }
    QUrl iChannel1() const { return m_iChannel1; }
    QUrl iChannel2() const { return m_iChannel2; }
    QUrl iChannel3() const { return m_iChannel3; }
    
    bool iChannel0Enabled() const { return m_iChannel0Enabled; }
    bool iChannel1Enabled() const { return m_iChannel1Enabled; }
    bool iChannel2Enabled() const { return m_iChannel2Enabled; }
    bool iChannel3Enabled() const { return m_iChannel3Enabled; }
    
    bool useBufferA() const { return m_useBufferA; }
    bool useBufferB() const { return m_useBufferB; }
    bool useBufferC() const { return m_useBufferC; }
    bool useBufferD() const { return m_useBufferD; }
    
    QString commonCode() const { return m_commonCode; }
    QString bufferACode() const { return m_bufferACode; }
    QString bufferBCode() const { return m_bufferBCode; }
    QString bufferCCode() const { return m_bufferCCode; }
    QString bufferDCode() const { return m_bufferDCode; }
    
    QVariantList imageChannels() const { return m_imageChannels; }
    QVariantList bufferAChannels() const { return m_bufferAChannels; }
    QVariantList bufferBChannels() const { return m_bufferBChannels; }
    QVariantList bufferCChannels() const { return m_bufferCChannels; }
    QVariantList bufferDChannels() const { return m_bufferDChannels; }
    
    bool audioEnabled() const { return m_audioEnabled; }
    int audioChannel() const { return m_audioChannel; }
    QVariantList audioData() const { return m_audioData; }
    
    bool watchSourceFile() const { return m_watchSourceFile; }
    void setWatchSourceFile(bool enabled);

private:
    QStringList computeWatchPaths() const;
    void rewatchShaderFiles();
    void reloadShaderFilesFromDisk();
public:

    QVector2D screenOffset() const { return m_screenOffset; }
    int screenIndex() const { return m_screenIndex; }
    int screenCount() const { return m_screenCount; }
    int virtualDesktop() const { return m_virtualDesktop; }
    int virtualDesktopCount() const { return m_virtualDesktopCount; }
    qreal virtualDesktopAnim() const { return m_virtualDesktopAnim; }

    bool windowsEnabled() const { return m_windowsEnabled; }
    int windowCount() const { return m_windowCount; }
    QVariantList windowRects() const { return m_windowRects; }
    QVariantList windowVelocities() const { return m_windowVelocities; }
    // Monotonic counter bumped on every setWindowRects(). The renderer
    // uses it to detect when a fresh poll snapshot arrived so it can
    // restart the velocity-extrapolation timer (smooth wake on top of
    // a 30Hz poll feed; see ShaderEngineRenderer::m_windowRectsBase).
    qint64 windowRectsSequence() const { return m_windowRectsSequence; }
    
    QString errorMessage() const { return m_errorMessage; }
    bool hasError() const { return !m_errorMessage.isEmpty(); }
    QString compileLog() const { return m_compileLog; }
    
    qreal frameTime() const { return m_frameTime; }
    qreal averageFrameTime() const { return m_averageFrameTime; }
    qreal minFrameTime() const { return m_minFrameTime; }
    qreal maxFrameTime() const { return m_maxFrameTime; }

    // Property setters
    void setShaderSource(const QUrl &source);
    void setShaderCode(const QString &code);
    void setRunning(bool running);
    void setSpeed(qreal speed);
    void setTargetFps(int fps);
    void setResolutionScale(qreal scale);
    void setBufferSimulationMaxHeight(int height);
    void setIMouse(const QVector4D &mouse);
    void setMouseEnabled(bool enabled);
    void setMouseBias(qreal bias);
    
    void setIChannel0(const QUrl &url);
    void setIChannel1(const QUrl &url);
    void setIChannel2(const QUrl &url);
    void setIChannel3(const QUrl &url);
    
    void setIChannel0Enabled(bool enabled);
    void setIChannel1Enabled(bool enabled);
    void setIChannel2Enabled(bool enabled);
    void setIChannel3Enabled(bool enabled);
    
    void setUseBufferA(bool use);
    void setUseBufferB(bool use);
    void setUseBufferC(bool use);
    void setUseBufferD(bool use);
    
    void setCommonCode(const QString &code);
    void setBufferACode(const QString &code);
    void setBufferBCode(const QString &code);
    void setBufferCCode(const QString &code);
    void setBufferDCode(const QString &code);
    
    void setImageChannels(const QVariantList &channels);
    void setBufferAChannels(const QVariantList &channels);
    void setBufferBChannels(const QVariantList &channels);
    void setBufferCChannels(const QVariantList &channels);
    void setBufferDChannels(const QVariantList &channels);
    
    void setAudioEnabled(bool enabled);
    void setAudioChannel(int channel);
    void setAudioData(const QVariantList &data);
    
    void setScreenOffset(const QVector2D &offset);
    void setScreenIndex(int index);
    void setScreenCount(int count);
    void setVirtualDesktop(int desktop);
    void setVirtualDesktopCount(int count);
    void setVirtualDesktopAnim(qreal a);

    void setWindowsEnabled(bool enabled);
    void setWindowCount(int count);
    void setWindowRects(const QVariantList &rects);
    void setWindowVelocities(const QVariantList &velocities);

    // Methods
    Q_INVOKABLE void resetTime();
    Q_INVOKABLE void pause();
    Q_INVOKABLE void play();
    Q_INVOKABLE void togglePlayPause();
    Q_INVOKABLE bool loadShader(const QUrl &url);
    Q_INVOKABLE bool compileShader(const QString &code);
    Q_INVOKABLE void captureFrame(const QString &savePath);

    // Called from the renderer's synchronize() to advance iTime / iFrame
    // exactly once per rendered frame, with a clamped wall-clock delta.
    // GUI thread is blocked during synchronize(), so this is safe to mutate
    // ShaderEngine state from the render thread.
    void accumulateFrame();

Q_SIGNALS:
    void shaderSourceChanged();
    void shaderCodeChanged();
    void runningChanged();
    void speedChanged();
    void targetFpsChanged();
    void currentFpsChanged();
    void resolutionScaleChanged();
    void bufferSimulationMaxHeightChanged();
    void iTimeChanged();
    void iFrameChanged();
    void iMouseChanged();
    void mouseEnabledChanged();
    void mouseBiasChanged();
    
    void iChannel0Changed();
    void iChannel1Changed();
    void iChannel2Changed();
    void iChannel3Changed();
    
    void iChannel0EnabledChanged();
    void iChannel1EnabledChanged();
    void iChannel2EnabledChanged();
    void iChannel3EnabledChanged();
    
    void useBufferAChanged();
    void useBufferBChanged();
    void useBufferCChanged();
    void useBufferDChanged();
    
    void commonCodeChanged();
    void bufferACodeChanged();
    void bufferBCodeChanged();
    void bufferCCodeChanged();
    void bufferDCodeChanged();
    
    void imageChannelsChanged();
    void bufferAChannelsChanged();
    void bufferBChannelsChanged();
    void bufferCChannelsChanged();
    void bufferDChannelsChanged();
    
    void audioEnabledChanged();
    void audioChannelChanged();
    void audioDataChanged();
    
    void watchSourceFileChanged();
    void sourceFileReloaded();  // fired when hot-reload triggered a reload

    void screenOffsetChanged();
    void screenIndexChanged();
    void screenCountChanged();
    void virtualDesktopChanged();
    void virtualDesktopCountChanged();
    void virtualDesktopAnimChanged();

    void windowsEnabledChanged();
    void windowCountChanged();
    void windowRectsChanged();
    void windowVelocitiesChanged();
    
    void errorMessageChanged();
    void hasErrorChanged();
    void compileLogChanged();
    void frameTimeChanged();
    void performanceStatsChanged();
    
    void shaderRecompiled();
    void renderRequested();
    void frameCaptured(const QString &path);

public Q_SLOTS:
    void updatePerformanceStats(qreal frameTimeMs);
    void setCompileLog(const QString &log);

private Q_SLOTS:
    void handleTimeout();
    void updateFps();
    void handleWindowChanged(QQuickWindow *window);
    void handleWindowVisibilityChanged();

private:
    void loadShaderFromSource();
    void loadShaderPackageFromDisk();
    void setError(const QString &error);
    void clearError();
    void applyVisibilityState(bool visible);
    // Coalesce update() so animation/input cannot bypass targetFps (legacy #85).
    void requestUpdate();

    // Shader sources
    QUrl m_shaderSource;
    QString m_shaderCode;
    
    // Playback state
    bool m_running = true;
    qreal m_speed = 1.0;
    int m_targetFps = 60;
    int m_currentFps = 0;
    qreal m_resolutionScale = 1.0;
    int m_bufferSimulationMaxHeight = 0;
    
    // Timing
    qreal m_iTime = 0.0;
    int m_iFrame = 0;
    QElapsedTimer m_gateClock;        // Free-running monotonic clock for the FPS gate.
    QElapsedTimer m_frameTimer;       // Per-frame delta for iTime accumulation.
    QTimer *m_renderTimer = nullptr;
    QTimer *m_fpsTimer = nullptr;
    int m_frameCount = 0;
    qint64 m_lastUpdateRequestMs = 0; // Throttling cursor for the FPS gate.

    // Window visibility tracking. When the wallpaper window goes hidden
    // (lockscreen overlay, compositor suspends paint of the wallpaper, etc.)
    // we stop the render timer to avoid burning GPU on frames the user
    // can't see (legacy #100), and so iTime doesn't drift behind a
    // multi-minute pause (legacy #106).
    QQuickWindow *m_trackedWindow = nullptr;
    bool m_windowVisible = true;
    
    // Mouse
    QVector4D m_iMouse;
    bool m_mouseEnabled = false;
    qreal m_mouseBias = 1.0;
    
    // Channels
    QUrl m_iChannel0;
    QUrl m_iChannel1;
    QUrl m_iChannel2;
    QUrl m_iChannel3;
    
    bool m_iChannel0Enabled = true;
    bool m_iChannel1Enabled = true;
    bool m_iChannel2Enabled = true;
    bool m_iChannel3Enabled = false;
    
    // Buffers
    bool m_useBufferA = false;
    bool m_useBufferB = false;
    bool m_useBufferC = false;
    bool m_useBufferD = false;
    
    QString m_commonCode;  // Shared code prepended to all passes
    QString m_bufferACode;
    QString m_bufferBCode;
    QString m_bufferCCode;
    QString m_bufferDCode;
    
    // Per-pass channel mapping: [ch0, ch1, ch2, ch3] for each pass
    // Values: -1=None, 0-3=Texture0-3, 10-13=BufferA-D, 20=Audio
    QVariantList m_imageChannels = {0, 1, 2, 3};  // Default: use textures
    QVariantList m_bufferAChannels = {-1, -1, -1, -1};
    QVariantList m_bufferBChannels = {-1, -1, -1, -1};
    QVariantList m_bufferCChannels = {-1, -1, -1, -1};
    QVariantList m_bufferDChannels = {-1, -1, -1, -1};
    
    // Audio
    bool m_audioEnabled = false;
    int m_audioChannel = 0;
    QVariantList m_audioData;
    
    // Experimental: multi-monitor screen uniforms
    QVector2D m_screenOffset;
    int m_screenIndex = 0;
    int m_screenCount = 1;

    // Experimental: per-virtual-desktop uniforms
    int m_virtualDesktop = 0;
    int m_virtualDesktopCount = 1;
    qreal m_virtualDesktopAnim = 0.0;

    // Window tracking
    bool m_windowsEnabled = false;
    int m_windowCount = 0;
    QVariantList m_windowRects;       // Flat: [x1,y1,w1,h1, x2,y2,w2,h2, ...]
    QVariantList m_windowVelocities;  // Flat: [vx1,vy1, vx2,vy2, ...]
    qint64 m_windowRectsSequence = 0; // bumped on setWindowRects

    // Hot-reload (C8) — QFileSystemWatcher + debounce timer
    bool m_watchSourceFile = false;
    QFileSystemWatcher *m_fileWatcher = nullptr;
    QTimer *m_reloadDebounce = nullptr;
    QStringList m_watchedPaths;
    QString m_shaderBasePath;  // last main-shader path, for buffer/common discovery
    bool m_loadShadersFromDisk = false;  // when true, inline QML code is ignored

    // Error handling
    QString m_errorMessage;
    QString m_compileLog;
    
    // Performance metrics
    qreal m_frameTime = 0.0;
    qreal m_averageFrameTime = 0.0;
    qreal m_minFrameTime = 999.0;
    qreal m_maxFrameTime = 0.0;
    std::deque<qreal> m_frameTimeHistory;
    static constexpr int PERF_HISTORY_SIZE = 60;
};

/**
 * @brief OpenGL renderer for ShaderEngine
 */
class ShaderEngineRenderer : public QQuickFramebufferObject::Renderer
{
public:
    ShaderEngineRenderer();
    ~ShaderEngineRenderer() override;

    void render() override;
    QOpenGLFramebufferObject *createFramebufferObject(const QSize &size) override;
    void synchronize(QQuickFramebufferObject *item) override;

private:
    void initializeGL();
    void compileShader(const QString &code);
    void compileBufferShader(int bufferIndex, const QString &code);
    void reportCompileFailure(const QString &stage, const QString &log);
    void reportCompileSuccess();
    void ensureBufferFBOs(int bufferIndex);
    void renderBuffer(int bufferIndex);
    void renderMainPass();
    QSize computeBufferSimSize() const;
    void updateUniforms(QOpenGLShaderProgram *program, bool forBufferPass = false);
    void loadTexture(int channel, const QUrl &url);
    void createQuadVAO();
    void bindChannelInput(int channelSlot, int inputType, int currentBuffer);
    void ensureLowResFBO();
    void blitLowResToOutput();

    bool m_initialized = false;
    bool m_needsRecompile = false;
    
    // Main shader
    std::unique_ptr<QOpenGLShaderProgram> m_shaderProgram;
    QString m_currentShaderCode;
    QString m_currentCommonCode;  // Common code to prepend to all shaders
    
    // Buffer shaders and FBOs
    std::array<std::unique_ptr<QOpenGLShaderProgram>, 4> m_bufferPrograms;
    std::array<std::unique_ptr<QOpenGLFramebufferObject>, 4> m_bufferFBOs;
    std::array<std::unique_ptr<QOpenGLFramebufferObject>, 4> m_bufferFBOsBack; // Ping-pong
    std::array<bool, 4> m_useBuffers = {false, false, false, false};
    std::array<QString, 4> m_bufferCodes;
    
    // Channel textures
    std::array<std::unique_ptr<QOpenGLTexture>, 4> m_channelTextures;
    std::array<QUrl, 4> m_channelUrls;
    // Last URL on each channel that failed to load. Lets us skip retrying
    // every frame (was producing "Failed to load texture:" spam at 60+ Hz
    // whenever a channel was enabled but pointed at a missing file).
    std::array<QUrl, 4> m_channelFailedUrls;
    std::array<bool, 4> m_channelEnabled = {true, true, true, false};
    
    // Per-pass channel mapping
    std::array<int, 4> m_imageChannelMapping = {0, 1, 2, 3};  // Default: texture 0-3
    std::array<std::array<int, 4>, 4> m_bufferChannelMapping = {{
        {-1, -1, -1, -1},  // Buffer A defaults to None
        {-1, -1, -1, -1},  // Buffer B
        {-1, -1, -1, -1},  // Buffer C
        {-1, -1, -1, -1}   // Buffer D
    }};
    
    // Audio texture
    std::unique_ptr<QOpenGLTexture> m_audioTexture;
    std::vector<float> m_audioData;
    bool m_audioEnabled = false;
    int m_audioChannel = 0;
    
    // Window tracking (max 16 windows). m_windowRects holds the
    // velocity-extrapolated position recomputed every render frame so
    // the wake position matches the smoothly-moving window on screen
    // (WindowTracker polls at ~30Hz, render runs at 60+Hz — without
    // extrapolation the wake step-juddered in poll-rate increments).
    static constexpr int MAX_WINDOWS = 16;
    bool m_windowsEnabled = false;
    int m_windowCount = 0;
    std::array<float, MAX_WINDOWS * 4> m_windowRects = {};      // extrapolated this frame
    std::array<float, MAX_WINDOWS * 4> m_windowRectsBase = {};  // last poll snapshot
    std::array<float, MAX_WINDOWS * 4> m_windowRectsPrev = {};  // previous render-frame extrapolation
    std::array<float, MAX_WINDOWS * 2> m_windowVelocities = {}; // vx, vy per window (px/sec)
    qint64 m_windowRectsSequenceSeen = -1;
    QElapsedTimer m_windowRectsBaseTimer;

    // Experimental: multi-monitor + virtual desktop uniforms.
    QVector2D m_screenOffset;
    int m_screenIndex = 0;
    int m_screenCount = 1;
    int m_virtualDesktop = 0;
    int m_virtualDesktopCount = 1;
    qreal m_virtualDesktopAnim = 0.0;
    
    // Uniforms from ShaderEngine
    QVector3D m_iResolution;
    qreal m_iTime = 0.0;
    int m_iFrame = 0;
    QVector4D m_iMouse;
    QVector4D m_iDate;
    QVector2D m_iMousePrev;
    bool m_hasPrevMousePos = false;
    QVector2D m_prevMousePos;

    // Quad geometry
    GLuint m_vao = 0;
    GLuint m_vbo = 0;

    // FBO size (the Qt-provided output FBO size, == item size).
    QSize m_fboSize;

    // Buffer-pass simulation size. When bufferSimulationMaxHeight > 0 the
    // buffer FBOs are rendered at this smaller size (aspect preserved) so
    // wave simulations have Shadertoy-scale cell counts on big monitors.
    int m_bufferSimulationMaxHeight = 0;
    QSize m_bufferSimSize;

    // Resolution scaling (legacy #23). When scale != 1.0 the main pass
    // renders into m_lowResFBO at (m_fboSize * scale), then we glBlit it
    // into Qt's output FBO at full size with GL_LINEAR filtering.
    qreal m_resolutionScale = 1.0;
    QSize m_lowResSize;
    std::unique_ptr<QOpenGLFramebufferObject> m_lowResFBO;
    
    // Ping-pong state
    bool m_pingPong = false;
    
    // Performance measurement
    QElapsedTimer m_perfTimer;
    qreal m_lastFrameTime = 0.0;

    // Cached pointer to the ShaderEngine for queued cross-thread invocations
    // (compile log reporting). Set in synchronize().
    QPointer<ShaderEngine> m_engineForCallbacks;

public:
    qreal lastFrameTime() const { return m_lastFrameTime; }
};

#endif // SHADERENGINE_H

