// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "shaderengine.h"
#include "shadercompiler.h"
#include "data/shaderlibrary.h"

#include <QFile>
#include <QFileSystemWatcher>
#include <QDateTime>
#include <QDir>
#include <QOpenGLContext>
#include <QOpenGLFunctions>
#include <QOpenGLExtraFunctions>
#include <QImage>
#include <QQuickItemGrabResult>
#include <cmath>

// Default vertex shader for fullscreen quad
static const char *vertexShaderSource = R"(
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

// Shader header that wraps Shadertoy-style shaders
static const char *shaderHeader = R"(
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
uniform vec2 iMousePrev; // previous-frame cursor position (pixels, same space as iMouse.xy)
uniform vec4 iDate;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];

uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;

// Window tracking (for window-reactive effects)
// iWindowCount: number of active windows (0-16)
// iWindowRects[i]: vec4(x, y, width, height) in pixels
// iWindowVelocities[i]: vec2(vx, vy) velocity in pixels/second
uniform int iWindowCount;
uniform vec4 iWindowRects[16];
uniform vec4 iWindowRectsPrev[16];
uniform vec2 iWindowVelocities[16];

// Multi-monitor (experimental). All zero when the feature is off.
//   iScreenOffset: this screen's top-left in pixels, within the full
//                  virtual-desktop bounding box. Add it to fragCoord
//                  to get global "desktop pixel" coordinates.
//   iScreenIndex:  0-based index of this screen.
//   iScreenCount:  total number of screens.
uniform vec2 iScreenOffset;
uniform int  iScreenIndex;
uniform int  iScreenCount;

// Per-virtual-desktop (experimental). Zero / 1 / 0 by default.
//   iVirtualDesktop:      current virtual desktop index (0-based)
//   iVirtualDesktopCount: total virtual desktops
//   iVirtualDesktopAnim:  0..1 transition progress during a switch
uniform int   iVirtualDesktop;
uniform int   iVirtualDesktopCount;
uniform float iVirtualDesktopAnim;

)";

static const char *shaderFooter = R"(

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
)";

// Default shader (simple gradient)
static const char *defaultShader = R"(
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0, 2, 4));
    fragColor = vec4(col, 1.0);
}
)";

ShaderEngine::ShaderEngine(QQuickItem *parent)
    : QQuickFramebufferObject(parent)
{
    setFlag(ItemHasContents, true);
    setMirrorVertically(true);

    // Render timer for animation
    m_renderTimer = new QTimer(this);
    connect(m_renderTimer, &QTimer::timeout, this, &ShaderEngine::handleTimeout);

    // FPS measurement timer
    m_fpsTimer = new QTimer(this);
    m_fpsTimer->setInterval(1000);
    connect(m_fpsTimer, &QTimer::timeout, this, &ShaderEngine::updateFps);
    m_fpsTimer->start();

    m_gateClock.start();
    m_frameTimer.start();

    // Track the QQuickWindow we end up parented to so we can pause rendering
    // when the window is hidden (legacy #100, #106).
    connect(this, &QQuickItem::windowChanged,
            this, &ShaderEngine::handleWindowChanged);

    // Set default shader
    m_shaderCode = QLatin1String(defaultShader);

    // Start running by default
    if (m_running) {
        m_renderTimer->start(1000 / m_targetFps);
    }
}

ShaderEngine::~ShaderEngine() = default;

QQuickFramebufferObject::Renderer *ShaderEngine::createRenderer() const
{
    return new ShaderEngineRenderer();
}

void ShaderEngine::handleTimeout()
{
    if (!m_running) return;

    // Real FPS gate (legacy #85): coalesce update() requests so we never ask
    // the scene graph for frames faster than targetFps, regardless of how
    // often the QTimer fires. m_gateClock is free-running and never restarted,
    // so the diff below is always monotonically non-negative.
    const qint64 nowMs = m_gateClock.isValid()
        ? m_gateClock.nsecsElapsed() / 1'000'000
        : 0;
    const qint64 minIntervalMs = m_targetFps > 0 ? (1000 / m_targetFps) : 0;
    if (m_lastUpdateRequestMs > 0 && minIntervalMs > 0
        && (nowMs - m_lastUpdateRequestMs) < minIntervalMs - 1) {
        return;
    }
    m_lastUpdateRequestMs = nowMs;

    update();  // Time advances inside accumulateFrame(), driven by synchronize().
}

void ShaderEngine::accumulateFrame()
{
    // Called from the renderer's synchronize() while the GUI thread is
    // blocked, so it's safe to mutate ShaderEngine state from here.
    //
    // Driving iTime from the render-sync point (rather than the QTimer)
    // means exactly one wall-clock delta is applied per rendered frame,
    // even if many QTimer ticks were coalesced or the window was hidden
    // (legacy #43, #106).

    if (!m_running) return;

    const qint64 elapsedNs = m_frameTimer.isValid() ? m_frameTimer.nsecsElapsed() : 0;
    m_frameTimer.restart();

    qreal dt = elapsedNs / 1'000'000'000.0;

    // Clamp: prevents post-suspend / post-stall iTime jumps from breaking
    // shaders that depend on monotonic small deltas (legacy #106). 100ms
    // matches typical lockscreen / sleep behavior — anything bigger is
    // almost certainly the window having been invisible.
    static constexpr qreal MAX_DT_S = 0.1;
    if (dt > MAX_DT_S) {
        static bool warnedOnce = false;
        if (!warnedOnce) {
            qWarning() << "ShaderEngine: dt clamp engaged ("
                       << dt << "s -> " << MAX_DT_S
                       << "s). Likely after sleep / hidden window.";
            warnedOnce = true;
        }
        dt = MAX_DT_S;
    } else if (dt < 0.0) {
        dt = 0.0;
    }

    m_iTime += dt * m_speed;
    m_iFrame++;
    m_frameCount++;

    Q_EMIT iTimeChanged();
    Q_EMIT iFrameChanged();
}

void ShaderEngine::setCompileLog(const QString &log)
{
    const bool shouldClearStaleError = log.isEmpty() && !m_errorMessage.isEmpty();
    if (m_compileLog == log) {
        if (shouldClearStaleError) {
            clearError();
        }
        return;
    }
    m_compileLog = log;
    Q_EMIT compileLogChanged();
    if (shouldClearStaleError) {
        clearError();
    }
}

void ShaderEngine::updatePerformanceStats(qreal frameTimeMs)
{
    m_frameTime = frameTimeMs;
    Q_EMIT frameTimeChanged();
    
    // Add to history
    m_frameTimeHistory.push_back(frameTimeMs);
    while (m_frameTimeHistory.size() > PERF_HISTORY_SIZE) {
        m_frameTimeHistory.pop_front();
    }
    
    // Calculate statistics
    if (!m_frameTimeHistory.empty()) {
        qreal sum = 0.0;
        qreal minTime = 999.0;
        qreal maxTime = 0.0;
        
        for (qreal t : m_frameTimeHistory) {
            sum += t;
            if (t < minTime) minTime = t;
            if (t > maxTime) maxTime = t;
        }
        
        m_averageFrameTime = sum / m_frameTimeHistory.size();
        m_minFrameTime = minTime;
        m_maxFrameTime = maxTime;
        
        Q_EMIT performanceStatsChanged();
    }
}

void ShaderEngine::updateFps()
{
    m_currentFps = m_frameCount;
    m_frameCount = 0;
    Q_EMIT currentFpsChanged();
}

void ShaderEngine::handleWindowChanged(QQuickWindow *window)
{
    // Just track the window — we no longer stop the render timer based on
    // visibility changes. Plasma's containment window has unreliable
    // visibility() semantics during compositor reloads, virtual-desktop
    // switches, and various transient states; using those signals to
    // pause/resume produced a "shader goes black and won't recover"
    // regression for some users. The dt clamp in accumulateFrame() is the
    // real safeguard against post-suspend time jumps (legacy #106), so
    // we can keep the timer running unconditionally.
    m_trackedWindow = window;
    m_windowVisible = true;
}

void ShaderEngine::handleWindowVisibilityChanged()
{
    // Kept for back-compat with the .moc-generated slot table but
    // intentionally a no-op now. See handleWindowChanged() comment.
}

void ShaderEngine::applyVisibilityState(bool visible)
{
    // Intentionally a no-op now; see handleWindowChanged() comment.
    Q_UNUSED(visible)
}

void ShaderEngine::setShaderSource(const QUrl &source)
{
    if (m_shaderSource == source) return;
    
    qDebug() << "ShaderEngine::setShaderSource changed to:" << source;
    m_shaderSource = source;
    m_loadShadersFromDisk = !m_shaderSource.isEmpty();

    if (m_loadShadersFromDisk) {
        loadShaderPackageFromDisk();
    }

    // Hot-reload (C8): retarget the file watcher when the active shader
    // file changes so the user can switch shaders and continue editing.
    if (m_watchSourceFile) {
        rewatchShaderFiles();
    }

    Q_EMIT shaderSourceChanged();
}

void ShaderEngine::setWatchSourceFile(bool enabled)
{
    if (m_watchSourceFile == enabled) return;
    m_watchSourceFile = enabled;

    if (m_watchSourceFile) {
        // Lazy-construct watcher + debounce timer. The debounce avoids
        // editor-save-storms where the file is rewritten 2-3 times in a
        // few ms (vim's swap dance, vscode atomic save, etc.). 200ms is
        // long enough for the editor to settle, short enough to feel live.
        if (!m_fileWatcher) {
            m_fileWatcher = new QFileSystemWatcher(this);
            connect(m_fileWatcher, &QFileSystemWatcher::fileChanged,
                    this, [this](const QString &path) {
                // Some editors save by rename — the watcher may stop
                // watching after the inode is replaced. Always re-add.
                if (!m_fileWatcher->files().contains(path)) {
                    m_fileWatcher->addPath(path);
                }
                if (m_reloadDebounce) m_reloadDebounce->start();
            });
        }
        if (!m_reloadDebounce) {
            m_reloadDebounce = new QTimer(this);
            m_reloadDebounce->setSingleShot(true);
            m_reloadDebounce->setInterval(200);
            connect(m_reloadDebounce, &QTimer::timeout, this, [this]() {
                qDebug() << "Hot-reload: reloading shader files from disk";
                reloadShaderFilesFromDisk();
            });
        }
        rewatchShaderFiles();
    } else {
        if (m_fileWatcher) {
            QStringList watched = m_fileWatcher->files();
            if (!watched.isEmpty()) m_fileWatcher->removePaths(watched);
        }
        m_watchedPaths.clear();
    }

    Q_EMIT watchSourceFileChanged();
}

void ShaderEngine::setShaderCode(const QString &code)
{
    // When a shader file path is set, disk is authoritative (see loadShaderPackageFromDisk).
    if (m_loadShadersFromDisk) {
        return;
    }

    if (m_shaderCode == code) return;
    
    qDebug() << "ShaderEngine::setShaderCode changed, new length:" << code.length();
    m_shaderCode = code;
    
    Q_EMIT shaderCodeChanged();
    Q_EMIT shaderRecompiled();
    update();
}

void ShaderEngine::setRunning(bool running)
{
    if (m_running == running) return;
    m_running = running;

    if (m_running) {
        // Reset the per-frame timer so the first frame after un-pausing
        // contributes a small delta rather than the full pause duration.
        m_frameTimer.restart();
        m_lastUpdateRequestMs = 0;
        m_renderTimer->start(1000 / m_targetFps);
    } else {
        m_renderTimer->stop();
    }

    Q_EMIT runningChanged();
}

void ShaderEngine::setSpeed(qreal speed)
{
    if (qFuzzyCompare(m_speed, speed)) return;
    m_speed = speed;
    Q_EMIT speedChanged();
}

void ShaderEngine::setResolutionScale(qreal scale)
{
    // 5% min keeps the FBO from going below the 64×64 floor in
    // ensureLowResFBO(). 4× max allows true supersampling — heavy but
    // legitimate; the QML gate behind the "Unlock 4×" toggle prevents
    // users from accidentally going there. Cap at 4× to keep VRAM use
    // bounded (a 4K screen at 4× is 32K pixels per frame).
    const qreal clamped = qBound(0.05, scale, 4.0);
    if (qFuzzyCompare(m_resolutionScale, clamped)) return;
    m_resolutionScale = clamped;
    Q_EMIT resolutionScaleChanged();
    // Force renderer to drop & recreate the FBO with the new size.
    update();
}

void ShaderEngine::setBufferSimulationMaxHeight(int height)
{
    const int clamped = qMax(0, height);
    if (m_bufferSimulationMaxHeight == clamped) return;
    m_bufferSimulationMaxHeight = clamped;
    Q_EMIT bufferSimulationMaxHeightChanged();
    update();
}

void ShaderEngine::setTargetFps(int fps)
{
    if (m_targetFps == fps) return;
    // Allow up to 360Hz for high-refresh monitors (legacy #43 - the UI
    // slider goes to 360 too). Below 1 makes no sense.
    m_targetFps = qBound(1, fps, 360);

    // Reset the gate so the next handleTimeout fire isn't pre-throttled
    // against the old interval.
    m_lastUpdateRequestMs = 0;

    if (m_running) {
        m_renderTimer->setInterval(1000 / m_targetFps);
    }

    Q_EMIT targetFpsChanged();
}

void ShaderEngine::setIMouse(const QVector4D &mouse)
{
    if (m_iMouse == mouse) return;
    m_iMouse = mouse;
    Q_EMIT iMouseChanged();
    update();
}

void ShaderEngine::setMouseEnabled(bool enabled)
{
    if (m_mouseEnabled == enabled) return;
    m_mouseEnabled = enabled;
    Q_EMIT mouseEnabledChanged();
}

void ShaderEngine::setMouseBias(qreal bias)
{
    if (qFuzzyCompare(m_mouseBias, bias)) return;
    m_mouseBias = bias;
    Q_EMIT mouseBiasChanged();
}

void ShaderEngine::setIChannel0(const QUrl &url)
{
    if (m_iChannel0 == url) return;
    m_iChannel0 = url;
    Q_EMIT iChannel0Changed();
    update();
}

void ShaderEngine::setIChannel1(const QUrl &url)
{
    if (m_iChannel1 == url) return;
    m_iChannel1 = url;
    Q_EMIT iChannel1Changed();
    update();
}

void ShaderEngine::setIChannel2(const QUrl &url)
{
    if (m_iChannel2 == url) return;
    m_iChannel2 = url;
    Q_EMIT iChannel2Changed();
    update();
}

void ShaderEngine::setIChannel3(const QUrl &url)
{
    if (m_iChannel3 == url) return;
    m_iChannel3 = url;
    Q_EMIT iChannel3Changed();
    update();
}

void ShaderEngine::setIChannel0Enabled(bool enabled)
{
    if (m_iChannel0Enabled == enabled) return;
    m_iChannel0Enabled = enabled;
    Q_EMIT iChannel0EnabledChanged();
    update();
}

void ShaderEngine::setIChannel1Enabled(bool enabled)
{
    if (m_iChannel1Enabled == enabled) return;
    m_iChannel1Enabled = enabled;
    Q_EMIT iChannel1EnabledChanged();
    update();
}

void ShaderEngine::setIChannel2Enabled(bool enabled)
{
    if (m_iChannel2Enabled == enabled) return;
    m_iChannel2Enabled = enabled;
    Q_EMIT iChannel2EnabledChanged();
    update();
}

void ShaderEngine::setIChannel3Enabled(bool enabled)
{
    if (m_iChannel3Enabled == enabled) return;
    m_iChannel3Enabled = enabled;
    Q_EMIT iChannel3EnabledChanged();
    update();
}

void ShaderEngine::setUseBufferA(bool use)
{
    if (m_useBufferA == use) return;
    m_useBufferA = use;
    Q_EMIT useBufferAChanged();
    if (m_watchSourceFile) rewatchShaderFiles();
    update();
}

void ShaderEngine::setUseBufferB(bool use)
{
    if (m_useBufferB == use) return;
    m_useBufferB = use;
    Q_EMIT useBufferBChanged();
    if (m_watchSourceFile) rewatchShaderFiles();
    update();
}

void ShaderEngine::setUseBufferC(bool use)
{
    if (m_useBufferC == use) return;
    m_useBufferC = use;
    Q_EMIT useBufferCChanged();
    if (m_watchSourceFile) rewatchShaderFiles();
    update();
}

void ShaderEngine::setUseBufferD(bool use)
{
    if (m_useBufferD == use) return;
    m_useBufferD = use;
    Q_EMIT useBufferDChanged();
    if (m_watchSourceFile) rewatchShaderFiles();
    update();
}

void ShaderEngine::setCommonCode(const QString &code)
{
    if (m_loadShadersFromDisk) {
        return;
    }

    if (m_commonCode == code) return;
    m_commonCode = code;
    Q_EMIT commonCodeChanged();
    Q_EMIT shaderRecompiled();  // Force recompile of all shaders with new common code
    update();
}

void ShaderEngine::setBufferACode(const QString &code)
{
    if (m_loadShadersFromDisk) {
        return;
    }

    if (m_bufferACode == code) return;
    m_bufferACode = code;
    Q_EMIT bufferACodeChanged();
    update();
}

void ShaderEngine::setBufferBCode(const QString &code)
{
    if (m_loadShadersFromDisk) {
        return;
    }

    if (m_bufferBCode == code) return;
    m_bufferBCode = code;
    Q_EMIT bufferBCodeChanged();
    update();
}

void ShaderEngine::setBufferCCode(const QString &code)
{
    if (m_loadShadersFromDisk) {
        return;
    }

    if (m_bufferCCode == code) return;
    m_bufferCCode = code;
    Q_EMIT bufferCCodeChanged();
    update();
}

void ShaderEngine::setBufferDCode(const QString &code)
{
    if (m_loadShadersFromDisk) {
        return;
    }

    if (m_bufferDCode == code) return;
    m_bufferDCode = code;
    Q_EMIT bufferDCodeChanged();
    update();
}

void ShaderEngine::setImageChannels(const QVariantList &channels)
{
    if (m_imageChannels == channels) return;
    m_imageChannels = channels;
    Q_EMIT imageChannelsChanged();
    update();
}

void ShaderEngine::setBufferAChannels(const QVariantList &channels)
{
    if (m_bufferAChannels == channels) return;
    m_bufferAChannels = channels;
    Q_EMIT bufferAChannelsChanged();
    update();
}

void ShaderEngine::setBufferBChannels(const QVariantList &channels)
{
    if (m_bufferBChannels == channels) return;
    m_bufferBChannels = channels;
    Q_EMIT bufferBChannelsChanged();
    update();
}

void ShaderEngine::setBufferCChannels(const QVariantList &channels)
{
    if (m_bufferCChannels == channels) return;
    m_bufferCChannels = channels;
    Q_EMIT bufferCChannelsChanged();
    update();
}

void ShaderEngine::setBufferDChannels(const QVariantList &channels)
{
    if (m_bufferDChannels == channels) return;
    m_bufferDChannels = channels;
    Q_EMIT bufferDChannelsChanged();
    update();
}

void ShaderEngine::setAudioEnabled(bool enabled)
{
    if (m_audioEnabled == enabled) return;
    m_audioEnabled = enabled;
    Q_EMIT audioEnabledChanged();
    update();
}

void ShaderEngine::setAudioChannel(int channel)
{
    if (m_audioChannel == channel) return;
    m_audioChannel = qBound(0, channel, 3);
    Q_EMIT audioChannelChanged();
    update();
}

void ShaderEngine::setAudioData(const QVariantList &data)
{
    m_audioData = data;
    Q_EMIT audioDataChanged();
    update();
}

void ShaderEngine::setWindowsEnabled(bool enabled)
{
    if (m_windowsEnabled == enabled) return;
    m_windowsEnabled = enabled;
    Q_EMIT windowsEnabledChanged();
    update();
}

void ShaderEngine::setScreenOffset(const QVector2D &offset)
{
    if (m_screenOffset == offset) return;
    m_screenOffset = offset;
    Q_EMIT screenOffsetChanged();
    update();
}

void ShaderEngine::setScreenIndex(int index)
{
    if (m_screenIndex == index) return;
    m_screenIndex = index;
    Q_EMIT screenIndexChanged();
    update();
}

void ShaderEngine::setScreenCount(int count)
{
    if (m_screenCount == count) return;
    m_screenCount = count;
    Q_EMIT screenCountChanged();
    update();
}

void ShaderEngine::setVirtualDesktop(int desktop)
{
    if (m_virtualDesktop == desktop) return;
    m_virtualDesktop = desktop;
    Q_EMIT virtualDesktopChanged();
    update();
}

void ShaderEngine::setVirtualDesktopCount(int count)
{
    if (m_virtualDesktopCount == count) return;
    m_virtualDesktopCount = count;
    Q_EMIT virtualDesktopCountChanged();
    update();
}

void ShaderEngine::setVirtualDesktopAnim(qreal a)
{
    if (qFuzzyCompare(m_virtualDesktopAnim + 1.0, a + 1.0)) return;
    m_virtualDesktopAnim = a;
    Q_EMIT virtualDesktopAnimChanged();
    update();
}

void ShaderEngine::setWindowCount(int count)
{
    if (m_windowCount == count) return;
    m_windowCount = count;
    Q_EMIT windowCountChanged();
    update();
}

void ShaderEngine::setWindowRects(const QVariantList &rects)
{
    m_windowRects = rects;
    // Bump sequence even if values are identical — the simple act of a
    // fresh poll arriving is what the renderer wants to know (it resets
    // the extrapolation timer from this snapshot).
    ++m_windowRectsSequence;
    Q_EMIT windowRectsChanged();
    update();
}

void ShaderEngine::setWindowVelocities(const QVariantList &velocities)
{
    m_windowVelocities = velocities;
    Q_EMIT windowVelocitiesChanged();
    update();
}

void ShaderEngine::resetTime()
{
    m_iTime = 0.0;
    m_iFrame = 0;
    m_frameTimer.restart();
    Q_EMIT iTimeChanged();
    Q_EMIT iFrameChanged();
    update();
}

void ShaderEngine::pause()
{
    setRunning(false);
}

void ShaderEngine::play()
{
    setRunning(true);
}

void ShaderEngine::togglePlayPause()
{
    setRunning(!m_running);
}

bool ShaderEngine::loadShader(const QUrl &url)
{
    setShaderSource(url);
    return !hasError();
}

bool ShaderEngine::compileShader(const QString &code)
{
    setShaderCode(code);
    return !hasError();
}

void ShaderEngine::captureFrame(const QString &savePath)
{
    // Grab at the item's native aspect (full width preserves detail),
    // then center-crop to 16:9 before saving. Without the crop, 32:9
    // ultrawide users get thumbnails that look squashed in the gallery
    // because Qt scales-to-fit when the source/target aspects differ.
    //
    // Native width clipped to 640 so the offscreen render isn't huge —
    // we only need a thumbnail.
    const int grabWidth = 640;
    const qreal aspect = (width() > 0 && height() > 0)
        ? (qreal(width()) / qreal(height()))
        : (16.0 / 9.0);
    const int grabHeight = qMax(1, qRound(grabWidth / aspect));

    QSharedPointer<QQuickItemGrabResult> grabResult =
        grabToImage(QSize(grabWidth, grabHeight));

    if (!grabResult) {
        qWarning() << "Failed to initiate frame capture";
        return;
    }

    connect(grabResult.data(), &QQuickItemGrabResult::ready, this,
        [this, grabResult, savePath]() {
            QImage image = grabResult->image();
            if (image.isNull()) {
                qWarning() << "Captured image is null";
                return;
            }

            // Center-crop to 16:9, then downscale to a uniform 480×270
            // so every thumbnail is the same physical size regardless
            // of monitor aspect.
            const qreal targetAspect = 16.0 / 9.0;
            const qreal srcAspect = qreal(image.width()) / qreal(image.height());
            QImage cropped = image;
            if (srcAspect > targetAspect) {
                // Source is wider than 16:9 — crop sides.
                const int newW = qRound(image.height() * targetAspect);
                const int x = (image.width() - newW) / 2;
                cropped = image.copy(x, 0, newW, image.height());
            } else if (srcAspect < targetAspect) {
                // Source is taller than 16:9 — crop top/bottom.
                const int newH = qRound(image.width() / targetAspect);
                const int y = (image.height() - newH) / 2;
                cropped = image.copy(0, y, image.width(), newH);
            }
            const QImage scaled = cropped.scaled(
                QSize(480, 270),
                Qt::IgnoreAspectRatio,
                Qt::SmoothTransformation);

            if (scaled.save(savePath, "PNG")) {
                qDebug() << "Thumbnail saved to:" << savePath
                         << "(" << scaled.size() << ")";
                Q_EMIT frameCaptured(savePath);
            } else {
                qWarning() << "Failed to save thumbnail to:" << savePath;
            }
        });
}

void ShaderEngine::loadShaderFromSource()
{
    loadShaderPackageFromDisk();
}

void ShaderEngine::loadShaderPackageFromDisk()
{
    if (m_shaderSource.isEmpty()) {
        qDebug() << "loadShaderPackageFromDisk: source is empty, skipping";
        return;
    }

    qDebug() << "loadShaderPackageFromDisk: loading from" << m_shaderSource;

    QString path = m_shaderSource.toLocalFile();
    if (path.isEmpty()) {
        path = m_shaderSource.path();
    }

    // Some shader_index.json files store portable relative paths
    // like "Shaders/Foo.frag". Resolve those against the active
    // library root so loading works regardless of install location.
    if (!path.isEmpty() && !QDir::isAbsolutePath(path)) {
        path = QDir(ShaderLibrary::instance()->libraryPath()).filePath(path);
    }

    if (path.isEmpty()) {
        setError(QStringLiteral("Shader path is empty"));
        return;
    }

    m_shaderBasePath = path;

    ShaderLibrary *library = ShaderLibrary::instance();
    const QString mainCode = library->loadShaderCode(QUrl::fromLocalFile(path));
    if (mainCode.isEmpty()) {
        setError(QStringLiteral("Failed to open shader file: %1").arg(path));
        return;
    }

    clearError();

    bool changed = false;
    if (m_shaderCode != mainCode) {
        m_shaderCode = mainCode;
        Q_EMIT shaderCodeChanged();
        Q_EMIT shaderRecompiled();
        changed = true;
    }

    const QVariantMap bufferData = library->loadBufferCodes(QUrl::fromLocalFile(path));

    auto applyBuffer = [&](const char *key, QString &slot, void (ShaderEngine::*signal)()) {
        const QString qKey = QString::fromLatin1(key);
        if (!bufferData.contains(qKey)) {
            return;
        }
        const QString code = bufferData[qKey].toString();
        if (slot == code) {
            return;
        }
        slot = code;
        (this->*signal)();
        changed = true;
    };

    applyBuffer("bufferACode", m_bufferACode, &ShaderEngine::bufferACodeChanged);
    applyBuffer("bufferBCode", m_bufferBCode, &ShaderEngine::bufferBCodeChanged);
    applyBuffer("bufferCCode", m_bufferCCode, &ShaderEngine::bufferCCodeChanged);
    applyBuffer("bufferDCode", m_bufferDCode, &ShaderEngine::bufferDCodeChanged);

    if (bufferData.contains(QStringLiteral("commonCode"))) {
        const QString common = bufferData[QStringLiteral("commonCode")].toString();
        if (m_commonCode != common) {
            m_commonCode = common;
            Q_EMIT commonCodeChanged();
            Q_EMIT shaderRecompiled();
            changed = true;
        }
    }

    auto applyUseBuffer = [&](const char *key, bool &slot, void (ShaderEngine::*signal)()) {
        const QString qKey = QString::fromLatin1(key);
        if (!bufferData.contains(qKey)) {
            return;
        }
        const bool use = bufferData[qKey].toBool();
        if (slot == use) {
            return;
        }
        slot = use;
        (this->*signal)();
        changed = true;
    };

    applyUseBuffer("useBufferA", m_useBufferA, &ShaderEngine::useBufferAChanged);
    applyUseBuffer("useBufferB", m_useBufferB, &ShaderEngine::useBufferBChanged);
    applyUseBuffer("useBufferC", m_useBufferC, &ShaderEngine::useBufferCChanged);
    applyUseBuffer("useBufferD", m_useBufferD, &ShaderEngine::useBufferDChanged);

    qDebug() << "loadShaderPackageFromDisk: main" << mainCode.length()
             << "bytes, bufferA" << m_bufferACode.length() << "bytes";

    if (changed) {
        update();
    }
}

QStringList ShaderEngine::computeWatchPaths() const
{
    QStringList paths;

    if (!m_shaderSource.isEmpty()) {
        QString mainPath = m_shaderSource.toLocalFile();
        if (mainPath.isEmpty()) {
            mainPath = m_shaderSource.path();
        }
        if (!mainPath.isEmpty() && QFile::exists(mainPath)) {
            paths.append(mainPath);
        }
    }

    QString basePath = m_shaderBasePath;
    if (basePath.isEmpty() && !m_shaderSource.isEmpty()) {
        basePath = m_shaderSource.toLocalFile();
        if (basePath.isEmpty()) {
            basePath = m_shaderSource.path();
        }
    }
    if (basePath.isEmpty()) {
        return paths;
    }

    const QVariantMap bufferPaths =
        ShaderLibrary::instance()->getBufferFilePaths(QUrl::fromLocalFile(basePath));

    const bool useBuffers[4] = {m_useBufferA, m_useBufferB, m_useBufferC, m_useBufferD};
    const char *bufferKeys[4] = {"BufferA", "BufferB", "BufferC", "BufferD"};
    for (int i = 0; i < 4; ++i) {
        if (!useBuffers[i] || !bufferPaths.contains(QLatin1String(bufferKeys[i]))) {
            continue;
        }
        const QString p = bufferPaths[QLatin1String(bufferKeys[i])].toUrl().toLocalFile();
        if (!p.isEmpty() && !paths.contains(p)) {
            paths.append(p);
        }
    }

    if (bufferPaths.contains(QStringLiteral("Common"))) {
        const QString p = bufferPaths[QStringLiteral("Common")].toUrl().toLocalFile();
        if (!p.isEmpty() && !paths.contains(p)) {
            paths.append(p);
        }
    }

    return paths;
}

void ShaderEngine::rewatchShaderFiles()
{
    if (!m_fileWatcher || !m_watchSourceFile) {
        return;
    }

    const QStringList want = computeWatchPaths();
    const QStringList have = m_fileWatcher->files();

    for (const QString &path : have) {
        if (!want.contains(path)) {
            m_fileWatcher->removePath(path);
            m_watchedPaths.removeAll(path);
        }
    }

    for (const QString &path : want) {
        if (!m_fileWatcher->files().contains(path)) {
            m_fileWatcher->addPath(path);
            if (!m_watchedPaths.contains(path)) {
                m_watchedPaths.append(path);
            }
        }
    }

    if (!want.isEmpty()) {
        qDebug() << "Hot-reload: now watching" << want;
    }
}

void ShaderEngine::reloadShaderFilesFromDisk()
{
    if (!m_shaderSource.isEmpty()) {
        loadShaderPackageFromDisk();
    }

    Q_EMIT sourceFileReloaded();
}

void ShaderEngine::setError(const QString &error)
{
    if (m_errorMessage == error) return;
    m_errorMessage = error;
    Q_EMIT errorMessageChanged();
    Q_EMIT hasErrorChanged();
}

void ShaderEngine::clearError()
{
    setError(QString());
}

// ============================================================================
// Renderer Implementation
// ============================================================================

ShaderEngineRenderer::ShaderEngineRenderer()
{
}

ShaderEngineRenderer::~ShaderEngineRenderer()
{
    auto *ctx = QOpenGLContext::currentContext();
    if (ctx) {
        auto *f = ctx->extraFunctions();
        if (m_vao) {
            f->glDeleteVertexArrays(1, &m_vao);
        }
        if (m_vbo) {
            f->glDeleteBuffers(1, &m_vbo);
        }
    }
}

void ShaderEngineRenderer::initializeGL()
{
    if (m_initialized) return;
    
    auto *f = QOpenGLContext::currentContext()->functions();
    f->initializeOpenGLFunctions();
    
    createQuadVAO();
    
    // Create audio texture (512x2, RGBA float)
    m_audioTexture = std::make_unique<QOpenGLTexture>(QOpenGLTexture::Target2D);
    m_audioTexture->setMinMagFilters(QOpenGLTexture::Linear, QOpenGLTexture::Linear);
    m_audioTexture->setWrapMode(QOpenGLTexture::ClampToEdge);
    m_audioTexture->setSize(512, 2);
    m_audioTexture->setFormat(QOpenGLTexture::RGBA32F);
    m_audioTexture->allocateStorage();
    
    // Only create default shader if we don't already have a valid one
    // (synchronize() may have already compiled the custom shader)
    if (!m_shaderProgram || !m_shaderProgram->isLinked()) {
        qDebug() << "initializeGL: No shader yet, compiling default";
        compileShader(QLatin1String(defaultShader));
    } else {
        qDebug() << "initializeGL: Keeping existing shader (code length:" << m_currentShaderCode.length() << ")";
    }
    
    m_initialized = true;
}

void ShaderEngineRenderer::createQuadVAO()
{
    auto *f = QOpenGLContext::currentContext()->extraFunctions();
    
    // Fullscreen quad vertices (position + texcoord)
    static const float quadVertices[] = {
        // Position    // TexCoord
        -1.0f,  1.0f,  0.0f, 1.0f,
        -1.0f, -1.0f,  0.0f, 0.0f,
         1.0f, -1.0f,  1.0f, 0.0f,
        
        -1.0f,  1.0f,  0.0f, 1.0f,
         1.0f, -1.0f,  1.0f, 0.0f,
         1.0f,  1.0f,  1.0f, 1.0f
    };
    
    f->glGenVertexArrays(1, &m_vao);
    f->glGenBuffers(1, &m_vbo);
    
    f->glBindVertexArray(m_vao);
    f->glBindBuffer(GL_ARRAY_BUFFER, m_vbo);
    f->glBufferData(GL_ARRAY_BUFFER, sizeof(quadVertices), quadVertices, GL_STATIC_DRAW);
    
    // Position attribute
    f->glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)0);
    f->glEnableVertexAttribArray(0);
    
    // TexCoord attribute
    f->glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)(2 * sizeof(float)));
    f->glEnableVertexAttribArray(1);
    
    f->glBindVertexArray(0);
}

void ShaderEngineRenderer::compileShader(const QString &code)
{
    qDebug() << ">>> compileShader called, code length:" << code.length();

    // Compile into a temporary program FIRST. Only swap m_shaderProgram
    // on full success — otherwise we'd reset the working program to
    // nullptr on the first compile error and the wallpaper would go
    // black until the user picked a different shader. (That's the
    // "shader randomly goes black" regression that's been hounding us.)
    auto candidate = std::make_unique<QOpenGLShaderProgram>();

    if (!candidate->addShaderFromSourceCode(QOpenGLShader::Vertex, vertexShaderSource)) {
        const QString log = candidate->log();
        qWarning() << "Vertex shader compilation failed:" << log;
        reportCompileFailure(QStringLiteral("Vertex shader (main pass)"), log);
        return;  // m_shaderProgram untouched
    }

    QString fullFragmentShader = QLatin1String(shaderHeader);
    if (!m_currentCommonCode.isEmpty()) {
        fullFragmentShader += QStringLiteral("\n// === COMMON CODE ===\n");
        fullFragmentShader += m_currentCommonCode;
        fullFragmentShader += QStringLiteral("\n// === END COMMON CODE ===\n\n");
    }
    fullFragmentShader += code + QLatin1String(shaderFooter);

    if (!candidate->addShaderFromSourceCode(QOpenGLShader::Fragment, fullFragmentShader)) {
        const QString log = candidate->log();
        qWarning() << "Main fragment shader compilation failed:" << log;
        reportCompileFailure(QStringLiteral("Fragment shader (main pass)"), log);
        return;  // m_shaderProgram untouched
    }

    if (!candidate->link()) {
        const QString log = candidate->log();
        qWarning() << "Main shader program linking failed:" << log;
        reportCompileFailure(QStringLiteral("Linker (main pass)"), log);
        return;  // m_shaderProgram untouched
    }

    qDebug() << ">>> Main shader compiled successfully!";
    m_shaderProgram = std::move(candidate);
    m_currentShaderCode = code;
    reportCompileSuccess();
}

void ShaderEngineRenderer::compileBufferShader(int bufferIndex, const QString &code)
{
    if (bufferIndex < 0 || bufferIndex >= 4) return;

    qDebug() << "Compiling Buffer" << bufferIndex << "shader, code length:" << code.length();

    // Same swap-on-success pattern as the main pass — keep the working
    // buffer program if compilation fails, so a typo in Buffer B doesn't
    // black out a working main image.
    auto candidate = std::make_unique<QOpenGLShaderProgram>();
    auto &program = candidate;
    const char bufLetter = 'A' + bufferIndex;

    if (!program->addShaderFromSourceCode(QOpenGLShader::Vertex, vertexShaderSource)) {
        const QString log = program->log();
        qWarning() << "Buffer" << bufferIndex << "vertex shader compilation failed:" << log;
        reportCompileFailure(QStringLiteral("Vertex shader (buffer %1)").arg(bufLetter), log);
        return;
    }
    
    // Build full fragment shader with common code prepended
    QString fullFragmentShader = QLatin1String(shaderHeader);
    if (!m_currentCommonCode.isEmpty()) {
        fullFragmentShader += QStringLiteral("\n// === COMMON CODE ===\n");
        fullFragmentShader += m_currentCommonCode;
        fullFragmentShader += QStringLiteral("\n// === END COMMON CODE ===\n\n");
    }
    fullFragmentShader += code + QLatin1String(shaderFooter);
    
    if (!program->addShaderFromSourceCode(QOpenGLShader::Fragment, fullFragmentShader)) {
        const QString log = program->log();
        qWarning() << "Buffer" << bufferIndex << "fragment shader compilation failed:" << log;
        reportCompileFailure(QStringLiteral("Fragment shader (buffer %1)").arg(bufLetter), log);
        return;
    }

    if (!program->link()) {
        const QString log = program->log();
        qWarning() << "Buffer" << bufferIndex << "shader program linking failed:" << log;
        reportCompileFailure(QStringLiteral("Linker (buffer %1)").arg(bufLetter), log);
        return;
    }

    qDebug() << "Buffer" << bufferIndex << "shader compiled successfully!";
    m_bufferPrograms[bufferIndex] = std::move(candidate);
    m_bufferCodes[bufferIndex] = code;
    reportCompileSuccess();
}

void ShaderEngineRenderer::reportCompileFailure(const QString &stage, const QString &log)
{
    if (m_engineForCallbacks) {
        const QString full = QStringLiteral("%1 failed:\n%2")
            .arg(stage, log.isEmpty() ? QStringLiteral("(no log)") : log);
        QMetaObject::invokeMethod(m_engineForCallbacks.data(), "setCompileLog",
                                  Qt::QueuedConnection,
                                  Q_ARG(QString, full));
    }
}

void ShaderEngineRenderer::reportCompileSuccess()
{
    if (m_engineForCallbacks) {
        QMetaObject::invokeMethod(m_engineForCallbacks.data(), "setCompileLog",
                                  Qt::QueuedConnection,
                                  Q_ARG(QString, QString()));
    }
}

void ShaderEngineRenderer::loadTexture(int channel, const QUrl &url)
{
    if (channel < 0 || channel >= 4) return;

    QString path = url.toLocalFile();
    if (path.isEmpty()) {
        path = url.path();
    }

    QImage image(path);
    if (image.isNull()) {
        // Remember this URL so the per-frame retry in updateUniforms() does
        // not log "Failed to load texture: …" every frame. We only complain
        // once per URL change.
        if (m_channelFailedUrls[channel] != url) {
            qWarning() << "Failed to load texture:" << path;
            m_channelFailedUrls[channel] = url;
        }
        return;
    }

    m_channelTextures[channel] = std::make_unique<QOpenGLTexture>(image.flipped(Qt::Vertical));
    m_channelTextures[channel]->setWrapMode(QOpenGLTexture::Repeat);
    m_channelTextures[channel]->setMinificationFilter(QOpenGLTexture::LinearMipMapLinear);
    m_channelTextures[channel]->setMagnificationFilter(QOpenGLTexture::Linear);

    m_channelUrls[channel] = url;
    m_channelFailedUrls[channel] = QUrl(); // recovered — clear failure cache
}

void ShaderEngineRenderer::updateUniforms(QOpenGLShaderProgram *program, bool forBufferPass)
{
    if (!program) return;

    QVector3D resolution = m_iResolution;
    QVector4D mouse = m_iMouse;
    QVector2D mousePrev = m_iMousePrev;
    std::array<float, MAX_WINDOWS * 4> windowRects = m_windowRects;
    std::array<float, MAX_WINDOWS * 4> windowRectsPrev = m_windowRectsPrev;
    std::array<float, MAX_WINDOWS * 2> windowVelocities = m_windowVelocities;

    // When the buffer pass renders into a downscaled simulation grid,
    // scale all pixel-space inputs so the shader's fragCoord and iMouse
    // live in the same coordinate system.
    if (forBufferPass && !m_fboSize.isEmpty() && m_bufferSimSize.isValid()
        && m_bufferSimSize != m_fboSize) {
        const float sx = float(m_bufferSimSize.width())  / float(m_fboSize.width());
        const float sy = float(m_bufferSimSize.height()) / float(m_fboSize.height());
        resolution = QVector3D(m_bufferSimSize.width(), m_bufferSimSize.height(),
                             float(m_bufferSimSize.width()) / m_bufferSimSize.height());
        mouse.setX(mouse.x() * sx);
        mouse.setY(mouse.y() * sy);
        mouse.setZ(mouse.z() * sx);
        mouse.setW(mouse.w() * sy);
        mousePrev.setX(mousePrev.x() * sx);
        mousePrev.setY(mousePrev.y() * sy);

        for (int i = 0; i < MAX_WINDOWS; ++i) {
            windowRects[i * 4 + 0] *= sx;
            windowRects[i * 4 + 1] *= sy;
            windowRects[i * 4 + 2] *= sx;
            windowRects[i * 4 + 3] *= sy;
            windowRectsPrev[i * 4 + 0] *= sx;
            windowRectsPrev[i * 4 + 1] *= sy;
            windowRectsPrev[i * 4 + 2] *= sx;
            windowRectsPrev[i * 4 + 3] *= sy;
            windowVelocities[i * 2 + 0] *= sx;
            windowVelocities[i * 2 + 1] *= sy;
        }
    }
    
    program->setUniformValue("iResolution", resolution);
    program->setUniformValue("iTime", (float)m_iTime);
    program->setUniformValue("iTimeDelta", 1.0f / 60.0f); // TODO: actual delta
    program->setUniformValue("iFrameRate", 60.0f); // TODO: actual framerate
    program->setUniformValue("iFrame", m_iFrame);
    program->setUniformValue("iMouse", mouse);
    program->setUniformValue("iMousePrev", mousePrev);
    program->setUniformValue("iDate", m_iDate);
    program->setUniformValue("iSampleRate", 44100.0f);
    
    // Channel resolutions
    const QSize bufferSize = m_bufferSimSize.isValid() ? m_bufferSimSize : m_fboSize;
    const QVector3D bufferResolution(
        bufferSize.width(), bufferSize.height(),
        bufferSize.isEmpty() ? 1.0f
                             : float(bufferSize.width()) / float(bufferSize.height()));

    QVector3D channelRes[4];
    for (int i = 0; i < 4; i++) {
        if (m_channelTextures[i]) {
            channelRes[i] = QVector3D(m_channelTextures[i]->width(), 
                                       m_channelTextures[i]->height(), 
                                       (float)m_channelTextures[i]->width() / m_channelTextures[i]->height());
        } else if (!forBufferPass && m_imageChannelMapping[i] >= 10
                   && m_imageChannelMapping[i] <= 13 && !bufferSize.isEmpty()) {
            // Image pass sampling a sim buffer — report the buffer FBO size.
            channelRes[i] = bufferResolution;
        } else {
            channelRes[i] = resolution;
        }
    }
    program->setUniformValueArray("iChannelResolution", channelRes, 4);
    
    // Channel times (all same as iTime for now)
    float channelTimes[4] = {(float)m_iTime, (float)m_iTime, (float)m_iTime, (float)m_iTime};
    program->setUniformValueArray("iChannelTime", channelTimes, 4, 1);
    
    // Bind textures
    for (int i = 0; i < 4; i++) {
        program->setUniformValue(QStringLiteral("iChannel%1").arg(i).toUtf8().constData(), i);
    }
    
    // Window tracking uniforms (for window-reactive shaders)
    program->setUniformValue("iWindowCount", m_windowCount);
    if (m_windowsEnabled) {
        program->setUniformValueArray("iWindowRects",
            reinterpret_cast<const GLfloat*>(windowRects.data()), MAX_WINDOWS, 4);
        program->setUniformValueArray("iWindowRectsPrev",
            reinterpret_cast<const GLfloat*>(windowRectsPrev.data()), MAX_WINDOWS, 4);
        program->setUniformValueArray("iWindowVelocities",
            reinterpret_cast<const GLfloat*>(windowVelocities.data()), MAX_WINDOWS, 2);
    }

    // Multi-monitor / virtual-desktop uniforms — always set (zeroed if
    // the feature is off in config). The cost is trivial and shaders
    // can sample them freely without needing a feature flag.
    program->setUniformValue("iScreenOffset", m_screenOffset);
    program->setUniformValue("iScreenIndex",  m_screenIndex);
    program->setUniformValue("iScreenCount",  m_screenCount);
    program->setUniformValue("iVirtualDesktop",      m_virtualDesktop);
    program->setUniformValue("iVirtualDesktopCount", m_virtualDesktopCount);
    program->setUniformValue("iVirtualDesktopAnim", (float)m_virtualDesktopAnim);
}

// Helper to bind a texture based on input type
void ShaderEngineRenderer::bindChannelInput(int channelSlot, int inputType, int currentBuffer)
{
    auto *f = QOpenGLContext::currentContext()->extraFunctions();
    f->glActiveTexture(GL_TEXTURE0 + channelSlot);
    
    // Validate inputType - reject garbage values
    if (inputType < -1 || (inputType > 3 && inputType < 10) || (inputType > 13 && inputType != 20) || inputType > 20) {
        // Invalid input type - treat as None
        static int warnCount = 0;
        if (warnCount++ < 5) {
            qWarning() << "Invalid inputType" << inputType << "for channel" << channelSlot << "- treating as None";
        }
        return;
    }
    
    // Input types: -1=None, 0-3=Texture0-3, 10-13=BufferA-D, 20=Audio
    if (inputType >= 0 && inputType <= 3) {
        // Texture input
        if (m_channelEnabled[inputType] && m_channelTextures[inputType]) {
            m_channelTextures[inputType]->bind();
        }
    } else if (inputType >= 10 && inputType <= 13) {
        // Buffer input
        int bufferIdx = inputType - 10;
        
        // If the buffer isn't enabled, don't try to bind it - just skip silently
        if (!m_useBuffers[bufferIdx]) {
            // Buffer not enabled - nothing to bind, this is fine
            return;
        }
        
        // Make sure buffer FBOs exist
        ensureBufferFBOs(bufferIdx);
        
        // Check for self-reference (use previous frame's buffer)
        if (bufferIdx == currentBuffer && currentBuffer >= 0) {
            auto &fboOther = m_pingPong ? m_bufferFBOsBack[bufferIdx] : m_bufferFBOs[bufferIdx];
            if (fboOther && fboOther->isValid()) {
                GLuint texId = fboOther->texture();
                f->glBindTexture(GL_TEXTURE_2D, texId);
                f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
                f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
                f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
                f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
            } else {
                qWarning() << "Self-ref: Buffer" << bufferIdx << "FBO is null or invalid!";
            }
        } else {
            // Use current frame's buffer output (what was just rendered)
            // Buffer renders to: m_pingPong ? m_bufferFBOs : m_bufferFBOsBack
            // So we read from the same one
            auto &fbo = m_pingPong ? m_bufferFBOs[bufferIdx] : m_bufferFBOsBack[bufferIdx];
            if (fbo && fbo->isValid()) {
                GLuint texId = fbo->texture();
                static int logCount = 0;
                if (logCount++ < 10) {
                    qDebug() << "Binding Buffer" << bufferIdx << "texture ID:" << texId 
                             << "to channel" << channelSlot << "size:" << fbo->size()
                             << "pingPong:" << m_pingPong;
                }
                f->glBindTexture(GL_TEXTURE_2D, texId);
                const GLenum filter = (currentBuffer >= 0) ? GL_NEAREST : GL_LINEAR;
                f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, filter);
                f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, filter);
                f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
                f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
            } else {
                qWarning() << "Buffer" << bufferIdx << "FBO is null or invalid for channel" << channelSlot;
            }
        }
    } else if (inputType == 20 && m_audioEnabled && m_audioTexture) {
        // Audio input
        m_audioTexture->bind();
    }
    // inputType == -1: None, don't bind anything
}

void ShaderEngineRenderer::ensureBufferFBOs(int bufferIndex)
{
    if (bufferIndex < 0 || bufferIndex >= 4) return;
    if (m_fboSize.isEmpty()) {
        qWarning() << "Cannot create buffer FBO: size is empty";
        return;
    }

    m_bufferSimSize = computeBufferSimSize();
    const QSize &bufSize = m_bufferSimSize;

    auto configureBufferTexture = [](GLuint tex) {
        auto *f = QOpenGLContext::currentContext()->functions();
        f->glBindTexture(GL_TEXTURE_2D, tex);
        // NEAREST for texelFetch simulation reads; image pass rebinding uses LINEAR.
        f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
        f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
        f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        f->glBindTexture(GL_TEXTURE_2D, 0);
    };

    QOpenGLFramebufferObjectFormat bufferFormat;
    bufferFormat.setAttachment(QOpenGLFramebufferObject::NoAttachment);
    bufferFormat.setInternalTextureFormat(GL_RGBA32F);
    
    // Ensure both ping-pong FBOs exist for this buffer
    if (!m_bufferFBOs[bufferIndex] || m_bufferFBOs[bufferIndex]->size() != bufSize) {
        m_bufferFBOs[bufferIndex] = std::make_unique<QOpenGLFramebufferObject>(bufSize, bufferFormat);
        
        if (!m_bufferFBOs[bufferIndex]->isValid()) {
            qWarning() << "Buffer" << bufferIndex << "FBO creation failed!";
        } else {
            configureBufferTexture(m_bufferFBOs[bufferIndex]->texture());
            qDebug() << "Created Buffer" << bufferIndex << "FBO, size:" << bufSize
                     << "(native" << m_fboSize << ", simMaxH" << m_bufferSimulationMaxHeight << ")";
        }
        
        // Clear the new FBO
        auto *f = QOpenGLContext::currentContext()->functions();
        m_bufferFBOs[bufferIndex]->bind();
        f->glClearColor(0.0f, 0.0f, 0.0f, 0.0f);
        f->glClear(GL_COLOR_BUFFER_BIT);
        m_bufferFBOs[bufferIndex]->release();
    }
    
    if (!m_bufferFBOsBack[bufferIndex] || m_bufferFBOsBack[bufferIndex]->size() != bufSize) {
        m_bufferFBOsBack[bufferIndex] = std::make_unique<QOpenGLFramebufferObject>(bufSize, bufferFormat);
        
        if (!m_bufferFBOsBack[bufferIndex]->isValid()) {
            qWarning() << "Buffer" << bufferIndex << "back FBO creation failed!";
        } else {
            configureBufferTexture(m_bufferFBOsBack[bufferIndex]->texture());
        }
        
        // Clear the new FBO
        auto *f = QOpenGLContext::currentContext()->functions();
        m_bufferFBOsBack[bufferIndex]->bind();
        f->glClearColor(0.0f, 0.0f, 0.0f, 0.0f);
        f->glClear(GL_COLOR_BUFFER_BIT);
        m_bufferFBOsBack[bufferIndex]->release();
    }
}

QSize ShaderEngineRenderer::computeBufferSimSize() const
{
    if (m_fboSize.isEmpty()) {
        return {};
    }
    if (m_bufferSimulationMaxHeight <= 0
        || m_fboSize.height() <= m_bufferSimulationMaxHeight) {
        return m_fboSize;
    }
    const qreal scale = qreal(m_bufferSimulationMaxHeight) / qreal(m_fboSize.height());
    return QSize(qMax(64, int(std::lround(m_fboSize.width() * scale))),
                 qMax(64, m_bufferSimulationMaxHeight));
}

void ShaderEngineRenderer::renderBuffer(int bufferIndex)
{
    if (bufferIndex < 0 || bufferIndex >= 4) return;
    if (!m_useBuffers[bufferIndex]) return;
    
    auto *f = QOpenGLContext::currentContext()->extraFunctions();
    
    // Always ensure FBOs exist for enabled buffers
    ensureBufferFBOs(bufferIndex);
    
    // Get the correct FBO (ping-pong)
    auto &fbo = m_pingPong ? m_bufferFBOs[bufferIndex] : m_bufferFBOsBack[bufferIndex];
    
    if (!fbo || !fbo->isValid()) {
        qWarning() << "Buffer" << bufferIndex << "FBO is invalid!";
        return;
    }
    
    fbo->bind();
    const QSize bufSize = m_bufferSimSize.isValid() ? m_bufferSimSize : m_fboSize;
    f->glViewport(0, 0, bufSize.width(), bufSize.height());
    f->glClear(GL_COLOR_BUFFER_BIT);

    // Only render if we have a compiled shader
    if (m_bufferPrograms[bufferIndex] && m_bufferPrograms[bufferIndex]->isLinked()) {
        static bool loggedBufferRender = false;
        if (!loggedBufferRender) {
            qDebug() << "renderBuffer" << bufferIndex << "channel mappings:"
                     << m_bufferChannelMapping[bufferIndex][0]
                     << m_bufferChannelMapping[bufferIndex][1]
                     << m_bufferChannelMapping[bufferIndex][2]
                     << m_bufferChannelMapping[bufferIndex][3];
            loggedBufferRender = true;
        }

        m_bufferPrograms[bufferIndex]->bind();
        // fragCoord = texCoord * iResolution.xy in the vertex shader,
        // so iResolution MUST match this pass's viewport. Using a stale
        // m_iResolution from the previous frame's main pass (which may
        // be the low-res FBO when resolutionScale != 1) broke buffer
        // simulations — mouse coords and texelFetch were wrong.
        m_iResolution = QVector3D(bufSize.width(), bufSize.height(),
                                  float(bufSize.width()) / float(bufSize.height()));
        updateUniforms(m_bufferPrograms[bufferIndex].get(), true);
        
        // Bind textures based on per-buffer channel mapping
        for (int i = 0; i < 4; i++) {
            bindChannelInput(i, m_bufferChannelMapping[bufferIndex][i], bufferIndex);
        }
        
        f->glBindVertexArray(m_vao);
        f->glDrawArrays(GL_TRIANGLES, 0, 6);
        f->glBindVertexArray(0);
        
        m_bufferPrograms[bufferIndex]->release();
    } else {
        static int warnCount = 0;
        if (warnCount++ < 5) {
            qWarning() << "Buffer" << bufferIndex << "has no compiled shader program!";
        }
    }
    
    fbo->release();
}

void ShaderEngineRenderer::renderMainPass()
{
    auto *f = QOpenGLContext::currentContext()->extraFunctions();

    // Bind the main pass output: either Qt's output FBO at native resolution,
    // or the intermediate low-res FBO when resolution-scale is active. In
    // the low-res case render() does the glBlit upscale afterwards.
    if (m_lowResFBO && m_lowResFBO->isValid()) {
        m_lowResFBO->bind();
        f->glViewport(0, 0, m_lowResSize.width(), m_lowResSize.height());
        // iResolution must match what the shader actually rasterizes onto
        // so fragCoord / iResolution stays in [0,1] like the user expects.
        m_iResolution = QVector3D(m_lowResSize.width(), m_lowResSize.height(),
                                  (float)m_lowResSize.width() / m_lowResSize.height());
    } else {
        framebufferObject()->bind();
        f->glViewport(0, 0, m_fboSize.width(), m_fboSize.height());
        m_iResolution = QVector3D(m_fboSize.width(), m_fboSize.height(),
                                  (float)m_fboSize.width() / m_fboSize.height());
    }
    
    if (!m_shaderProgram || !m_shaderProgram->isLinked()) {
        static bool warned = false;
        if (!warned) {
            qWarning() << "renderMainPass: No valid shader program!";
            warned = true;
        }
        return;
    }
    
    m_shaderProgram->bind();
    updateUniforms(m_shaderProgram.get());
    
    // Bind channel textures based on image channel mapping
    static int frameCount = 0;
    if (frameCount++ < 5) {
        qDebug() << "renderMainPass: Binding channels. Mappings:" 
                 << m_imageChannelMapping[0] << m_imageChannelMapping[1] 
                 << m_imageChannelMapping[2] << m_imageChannelMapping[3];
    }
    for (int i = 0; i < 4; i++) {
        bindChannelInput(i, m_imageChannelMapping[i], -1);  // -1 = no current buffer (image pass)
    }
    
    // Update audio texture data if enabled
    if (m_audioEnabled && m_audioTexture) {
        // Upload audio data to texture if we have data
        if (!m_audioData.empty()) {
            m_audioTexture->bind();
            // Expected format: 512x2 RGBA (4096 floats total)
            // Row 0: waveform, Row 1: FFT spectrum
            if (m_audioData.size() >= 512 * 2 * 4) {
                f->glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, 512, 2, 
                                   GL_RGBA, GL_FLOAT, m_audioData.data());
            }
        }
        f->glActiveTexture(GL_TEXTURE0 + m_audioChannel);
        m_audioTexture->bind();
    }
    
    f->glBindVertexArray(m_vao);
    f->glDrawArrays(GL_TRIANGLES, 0, 6);
    f->glBindVertexArray(0);
    
    m_shaderProgram->release();
}

void ShaderEngineRenderer::render()
{
    // Start performance measurement
    m_perfTimer.start();

    if (!m_initialized) {
        initializeGL();
    }

    auto *f = QOpenGLContext::currentContext()->functions();

    // (Re)allocate the low-res FBO if the resolution scale changed.
    ensureLowResFBO();

    f->glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
    f->glClear(GL_COLOR_BUFFER_BIT);

    // Render buffer passes in order
    for (int i = 0; i < 4; i++) {
        if (m_useBuffers[i]) {
            renderBuffer(i);
        }
    }

    // Render main pass (writes to either Qt's output FBO or m_lowResFBO).
    renderMainPass();

    // If we rendered into the low-res FBO, blit it (scaled) to Qt's output.
    if (m_lowResFBO && m_lowResFBO->isValid()) {
        blitLowResToOutput();
    }

    // Ensure GPU work is complete before measuring time
    f->glFinish();

    // Record frame time
    m_lastFrameTime = m_perfTimer.nsecsElapsed() / 1000000.0;  // Convert to ms

    // Toggle ping-pong for next frame
    m_pingPong = !m_pingPong;
}

void ShaderEngineRenderer::ensureLowResFBO()
{
    // No scale change requested -> render directly to Qt's FBO.
    if (qFuzzyCompare(m_resolutionScale, 1.0) || m_fboSize.isEmpty()) {
        m_lowResFBO.reset();
        m_lowResSize = QSize();
        return;
    }

    QSize target(qMax(64, (int)std::lround(m_fboSize.width() * m_resolutionScale)),
                 qMax(64, (int)std::lround(m_fboSize.height() * m_resolutionScale)));

    if (m_lowResFBO && m_lowResFBO->size() == target) {
        return;  // Already the right size.
    }

    m_lowResSize = target;
    m_lowResFBO = std::make_unique<QOpenGLFramebufferObject>(
        target, QOpenGLFramebufferObject::NoAttachment, GL_TEXTURE_2D, GL_RGBA8);

    if (!m_lowResFBO->isValid()) {
        qWarning() << "ShaderEngine: low-res FBO allocation failed for size" << target;
        m_lowResFBO.reset();
        m_lowResSize = QSize();
    } else {
        qDebug() << "ShaderEngine: low-res FBO allocated"
                 << target << "from native" << m_fboSize
                 << "scale" << m_resolutionScale;
    }
}

void ShaderEngineRenderer::blitLowResToOutput()
{
    if (!m_lowResFBO || !m_lowResFBO->isValid()) return;

    auto *f = QOpenGLContext::currentContext()->extraFunctions();

    // glBlitFramebuffer: scale the low-res color attachment up onto Qt's
    // output FBO with linear filtering. This is the equivalent of a "render
    // scale" slider in games and matches what users expect from #23.
    f->glBindFramebuffer(GL_READ_FRAMEBUFFER, m_lowResFBO->handle());
    f->glBindFramebuffer(GL_DRAW_FRAMEBUFFER, framebufferObject()->handle());

    f->glBlitFramebuffer(
        0, 0, m_lowResSize.width(), m_lowResSize.height(),
        0, 0, m_fboSize.width(), m_fboSize.height(),
        GL_COLOR_BUFFER_BIT,
        GL_LINEAR);

    // Leave the output FBO bound for any post-render work.
    f->glBindFramebuffer(GL_FRAMEBUFFER, framebufferObject()->handle());
}

QOpenGLFramebufferObject *ShaderEngineRenderer::createFramebufferObject(const QSize &size)
{
    m_fboSize = size;
    m_iResolution = QVector3D(size.width(), size.height(), (float)size.width() / size.height());
    m_bufferSimSize = computeBufferSimSize();

    QOpenGLFramebufferObjectFormat format;
    // No depth/stencil (we only draw a fullscreen quad — no z-test needed)
    // and NO MSAA. MSAA on the output FBO is invisible for a fullscreen
    // quad anyway, but it broke resolution-scale entirely: glBlitFramebuffer
    // from a non-MSAA low-res FBO to a 4x-MSAA output FBO is invalid in
    // the OpenGL spec and silently produces black output. That's why
    // every preview (hardcoded to 0.5x scale) AND any wallpaper with
    // render scale != 100% rendered black.
    format.setAttachment(QOpenGLFramebufferObject::NoAttachment);
    format.setSamples(0);

    return new QOpenGLFramebufferObject(size, format);
}

void ShaderEngineRenderer::synchronize(QQuickFramebufferObject *item)
{
    auto *engine = static_cast<ShaderEngine*>(item);
    m_engineForCallbacks = engine;

    // Advance iTime exactly once per rendered frame, with a wall-clock
    // delta that gets clamped to a sane max so post-suspend / hidden-window
    // resumes don't cause shader time to leap forward (legacy #43, #106).
    engine->accumulateFrame();

    // Pass frame time from previous render back to the engine
    if (m_lastFrameTime > 0.0) {
        QMetaObject::invokeMethod(engine, "updatePerformanceStats",
                                  Qt::QueuedConnection,
                                  Q_ARG(qreal, m_lastFrameTime));
    }

    // Pull updated timing/mouse uniforms into the renderer copy.
    m_iTime = engine->iTime();
    m_iFrame = engine->iFrame();
    // Snapshot mouse: previous render-frame position vs current.
    const QVector4D engineMouse = engine->iMouse();
    const QVector2D mouseCur(engineMouse.x(), engineMouse.y());
    m_iMousePrev = m_hasPrevMousePos ? m_prevMousePos : mouseCur;
    m_prevMousePos = mouseCur;
    m_hasPrevMousePos = true;
    m_iMouse = engineMouse;

    m_resolutionScale = engine->resolutionScale();
    m_bufferSimulationMaxHeight = engine->bufferSimulationMaxHeight();
    m_bufferSimSize = computeBufferSimSize();
    
    // Calculate iDate
    QDateTime now = QDateTime::currentDateTime();
    QDate date = now.date();
    QTime time = now.time();
    float secondsSinceMidnight = time.hour() * 3600.0f + time.minute() * 60.0f + time.second() + time.msec() / 1000.0f;
    m_iDate = QVector4D(date.year(), date.month(), date.day(), secondsSinceMidnight);
    
    // Check if common code changed - if so, recompile everything
    QString newCommonCode = engine->commonCode();
    bool commonCodeChanged = (newCommonCode != m_currentCommonCode);
    if (commonCodeChanged) {
        m_currentCommonCode = newCommonCode;
        qDebug() << "Common code changed, length:" << newCommonCode.length();
    }
    
    // Check if shader code changed or common code changed
    QString newCode = engine->shaderCode();
    
    // Debug: always log main shader status
    static bool loggedOnce = false;
    if (!loggedOnce) {
        qDebug() << "=== MAIN SHADER STATUS ===";
        qDebug() << "newCode length:" << newCode.length();
        qDebug() << "m_currentShaderCode length:" << m_currentShaderCode.length();
        qDebug() << "codes equal:" << (newCode == m_currentShaderCode);
        qDebug() << "m_shaderProgram valid:" << (m_shaderProgram != nullptr);
        if (m_shaderProgram) {
            qDebug() << "m_shaderProgram linked:" << m_shaderProgram->isLinked();
        }
        qDebug() << "==========================";
        loggedOnce = true;
    }
    
    if (newCode.isEmpty()) {
        static bool warnedEmpty = false;
        if (!warnedEmpty) {
            qWarning() << "Main shader code is EMPTY! This will cause black screen if reading from buffers.";
            warnedEmpty = true;
        }
    }
    
    // Force recompile if we have code but no valid program
    bool needsCompile = false;
    if (!newCode.isEmpty()) {
        if (newCode != m_currentShaderCode) {
            qDebug() << "Main shader code CHANGED, need recompile";
            needsCompile = true;
        } else if (commonCodeChanged) {
            qDebug() << "Common code changed, need recompile main shader";
            needsCompile = true;
        } else if (!m_shaderProgram || !m_shaderProgram->isLinked()) {
            qDebug() << "Main shader program invalid, need compile";
            needsCompile = true;
        }
    }
    
    if (needsCompile) {
        qDebug() << "Compiling main shader, code length:" << newCode.length();
        compileShader(newCode);
    }
    
    // Update buffer settings
    m_useBuffers[0] = engine->useBufferA();
    m_useBuffers[1] = engine->useBufferB();
    m_useBuffers[2] = engine->useBufferC();
    m_useBuffers[3] = engine->useBufferD();
    
    // Compile buffer shaders if changed (or common code changed)
    QString bufferCodes[4] = {
        engine->bufferACode(),
        engine->bufferBCode(),
        engine->bufferCCode(),
        engine->bufferDCode()
    };
    
    for (int i = 0; i < 4; i++) {
        if (m_useBuffers[i]) {
            if (!bufferCodes[i].isEmpty()) {
                // Recompile if buffer code changed OR common code changed
                if (bufferCodes[i] != m_bufferCodes[i] || commonCodeChanged) {
                    qDebug() << "Buffer" << i << "code changed, recompiling. Length:" << bufferCodes[i].length();
                    compileBufferShader(i, bufferCodes[i]);
                }
            } else {
                static bool warned[4] = {false, false, false, false};
                if (!warned[i]) {
                    qWarning() << "Buffer" << i << "is enabled but has no code!";
                    warned[i] = true;
                }
            }
        }
    }
    
    // Debug: log channel mappings
    static bool loggedMappings = false;
    if (!loggedMappings && (m_useBuffers[0] || m_useBuffers[1] || m_useBuffers[2] || m_useBuffers[3])) {
        qDebug() << "Image channel mapping:" << m_imageChannelMapping[0] << m_imageChannelMapping[1] << m_imageChannelMapping[2] << m_imageChannelMapping[3];
        for (int i = 0; i < 4; i++) {
            if (m_useBuffers[i]) {
                qDebug() << "Buffer" << i << "channel mapping:" << m_bufferChannelMapping[i][0] << m_bufferChannelMapping[i][1] << m_bufferChannelMapping[i][2] << m_bufferChannelMapping[i][3];
            }
        }
        loggedMappings = true;
    }
    
    // Update channel textures
    QUrl channels[4] = {
        engine->iChannel0(),
        engine->iChannel1(),
        engine->iChannel2(),
        engine->iChannel3()
    };
    
    bool enabled[4] = {
        engine->iChannel0Enabled(),
        engine->iChannel1Enabled(),
        engine->iChannel2Enabled(),
        engine->iChannel3Enabled()
    };
    
    for (int i = 0; i < 4; i++) {
        m_channelEnabled[i] = enabled[i];
        if (!enabled[i] || channels[i].isEmpty()) {
            continue;
        }
        // Fixes legacy #73: on cold boot the URL binding can arrive *before*
        // the enabled binding propagates, leaving us with a matching URL but
        // no texture. Load whenever the URL changed OR no texture is cached
        // yet for this channel — UNLESS we already tried this URL and failed,
        // in which case retrying every frame just spams qWarning.
        const bool urlChanged = channels[i] != m_channelUrls[i];
        const bool textureMissing = !m_channelTextures[i];
        const bool alreadyFailed = (channels[i] == m_channelFailedUrls[i]);
        if ((urlChanged || textureMissing) && !alreadyFailed) {
            loadTexture(i, channels[i]);
        }
    }
    
    // Update per-pass channel mappings
    QVariantList imageChans = engine->imageChannels();
    for (int i = 0; i < 4 && i < imageChans.size(); i++) {
        m_imageChannelMapping[i] = imageChans[i].toInt();
    }
    
    QVariantList bufferChannels[4] = {
        engine->bufferAChannels(),
        engine->bufferBChannels(),
        engine->bufferCChannels(),
        engine->bufferDChannels()
    };
    
    static bool loggedBufferChannels = false;
    if (!loggedBufferChannels) {
        qDebug() << "Buffer channels from QML:";
        for (int b = 0; b < 4; b++) {
            qDebug() << "  Buffer" << b << ":" << bufferChannels[b];
        }
        loggedBufferChannels = true;
    }
    
    for (int b = 0; b < 4; b++) {
        for (int c = 0; c < 4 && c < bufferChannels[b].size(); c++) {
            m_bufferChannelMapping[b][c] = bufferChannels[b][c].toInt();
        }
    }
    
    // Update audio settings
    m_audioEnabled = engine->audioEnabled();
    m_audioChannel = engine->audioChannel();
    
    // Copy audio data (convert QVariantList to vector<float>)
    if (m_audioEnabled) {
        QVariantList audioList = engine->audioData();
        m_audioData.resize(audioList.size());
        for (int i = 0; i < audioList.size(); i++) {
            m_audioData[i] = audioList[i].toFloat();
        }
    }
    
    // --- Window tracking with velocity extrapolation -------------------
    // WindowTracker polls XCB at ~30Hz; render runs at 60+Hz. Without
    // extrapolation, m_windowRects stays identical for 2 render frames
    // then teleports — wakes look like 30Hz step-judder. We snapshot
    // each poll into m_windowRectsBase and integrate velocity * age
    // every render frame so the rect smoothly tracks the on-screen
    // window position. Age is capped so a runaway extrapolation (e.g.
    // WindowTracker disabled) can't drift indefinitely.
    m_windowRectsPrev = m_windowRects;
    m_windowsEnabled = engine->windowsEnabled();
    m_windowCount = engine->windowCount();

    if (m_windowsEnabled) {
        const qint64 seq = engine->windowRectsSequence();
        if (seq != m_windowRectsSequenceSeen) {
            m_windowRectsSequenceSeen = seq;
            const QVariantList rects = engine->windowRects();
            for (int i = 0; i < MAX_WINDOWS * 4; ++i) {
                m_windowRectsBase[i] = (i < rects.size()) ? rects[i].toFloat() : 0.0f;
            }
            const QVariantList velocities = engine->windowVelocities();
            for (int i = 0; i < MAX_WINDOWS * 2; ++i) {
                m_windowVelocities[i] = (i < velocities.size()) ? velocities[i].toFloat() : 0.0f;
            }
            m_windowRectsBaseTimer.restart();
        }

        // Time since last poll, capped to ~80 ms so dropped polls don't
        // let a window's wake drift away from where the window actually is.
        float ageSec = 0.0f;
        if (m_windowRectsBaseTimer.isValid()) {
            ageSec = std::min(0.08f, float(m_windowRectsBaseTimer.elapsed()) / 1000.0f);
        }

        for (int i = 0; i < MAX_WINDOWS; ++i) {
            m_windowRects[i * 4 + 0] = m_windowRectsBase[i * 4 + 0]
                                     + m_windowVelocities[i * 2 + 0] * ageSec;
            m_windowRects[i * 4 + 1] = m_windowRectsBase[i * 4 + 1]
                                     + m_windowVelocities[i * 2 + 1] * ageSec;
            m_windowRects[i * 4 + 2] = m_windowRectsBase[i * 4 + 2];
            m_windowRects[i * 4 + 3] = m_windowRectsBase[i * 4 + 3];
        }
    }

    // Mirror experimental screen/desktop state into the renderer
    // so renderMainPass / renderBuffer can plug them in as uniforms.
    m_screenOffset        = engine->screenOffset();
    m_screenIndex         = engine->screenIndex();
    m_screenCount         = engine->screenCount();
    m_virtualDesktop      = engine->virtualDesktop();
    m_virtualDesktopCount = engine->virtualDesktopCount();
    m_virtualDesktopAnim  = engine->virtualDesktopAnim();
}

