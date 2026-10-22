// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "shaderengine.h"
#include "framebufferutils.h"
#include "data/shaderlibrary.h"

#include <algorithm>

#include <QFile>
#include <QFileSystemWatcher>
#include <QDateTime>
#include <QDir>
#include <QOpenGLContext>
#include <QOpenGLFunctions>
#include <QOpenGLExtraFunctions>
#if !QT_CONFIG(opengles2)
#include <QOpenGLTimerQuery>
#endif
#include <QImage>
#include <QQuickItemGrabResult>
#include <QRegularExpression>
#include <cmath>

// Fragment and vertex sources are assembled per context:
//   version line, hoisted #extension lines, GLES precision block,
//   shadertoyDefines, shaderHeader (vertexShaderSource for the vertex
//   stage), "#line 1 1" + common code, "#line 1 0" + pass code, shaderFooter.
// scripts/dev/render_shader.py reads these constants and mirrors the
// assembly in assemble_fragment() / assemble_vertex().

// NVIDIA's ES compiler accepts "#version 330 core" and applies GLSL ES 1.00
// rules to it (dFdx then needs GL_OES_standard_derivatives, issue #123).
static const char *glslVersionDesktop = R"(#version 330 core
)";

static const char *glslVersionGles = R"(#version 300 es
)";

static const char *glslPrecisionGles = R"(precision highp float;
precision highp int;
precision highp sampler2D;
)";

// Shadertoy defines HW_PERFORMANCE (1 on desktop); GLSL ES rejects an
// undefined macro in #if.
static const char *shadertoyDefines = R"(#define HW_PERFORMANCE 1
)";

// Default vertex shader for fullscreen quad
static const char *vertexShaderSource = R"(
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
in vec2 fragCoord;
in vec2 qt_TexCoord0;
out vec4 fragColor;

uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform float iFrameRate;
uniform int iFrame;
uniform int iSubstep;  // 0-based buffer-pass substep within this frame
uniform int iSubsteps; // buffer-pass substeps this frame (>= 1)
uniform vec4 iMouse;
uniform vec2 iMousePrev; // previous-frame cursor position (pixels, same space as iMouse.xy)
uniform vec4 iDate;
uniform float iSampleRate;
uniform float iDitherAmount;
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

// Dither: sum of two hash12 (Dave Hoskins, "Hash without Sine") samples
// minus 1 is a triangular PDF on (-1, 1), scaled to +-1 LSB.
static const char *shaderFooter = R"(

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    vec3 ditherA = fract(gl_FragCoord.xyx * 0.1031);
    ditherA += dot(ditherA, ditherA.yzx + 33.33);
    vec3 ditherB = fract((gl_FragCoord.xyx + 19.19) * 0.1031);
    ditherB += dot(ditherB, ditherB.yzx + 33.33);
    float ditherNoise = fract((ditherA.x + ditherA.y) * ditherA.z)
                      + fract((ditherB.x + ditherB.y) * ditherB.z) - 1.0;
    color.rgb += ditherNoise * iDitherAmount;
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

namespace {

// Removes what the engine supplies itself (#version, precision statements)
// and collects #extension lines for hoisting. Removed text leaves blank
// lines or spaces behind, so line numbers stay those of the user's file.
// On desktop GL QOpenGLShader injects "#define mediump" etc., which turns a
// user "precision mediump float;" into a syntax error.
QString prepareUserSource(const QString &code, QStringList &extensions)
{
    static const QRegularExpression directiveRe(
        QStringLiteral("^[ \\t]*#[ \\t]*(version|extension)\\b"));
    static const QRegularExpression precisionRe(
        QStringLiteral("\\bprecision[ \\t]+(?:lowp|mediump|highp)[ \\t]+[A-Za-z_][A-Za-z0-9_]*[ \\t]*;"));

    QStringList lines = code.split(QLatin1Char('\n'));
    for (QString &line : lines) {
        const QRegularExpressionMatch m = directiveRe.match(line);
        if (m.hasMatch()) {
            if (m.capturedView(1) == QLatin1String("extension")) {
                const QString ext = line.trimmed();
                if (!extensions.contains(ext)) {
                    extensions.append(ext);
                }
            }
            line.clear();
            continue;
        }
        if (line.contains(QLatin1String("precision"))) {
            line.remove(precisionRe);
        }
    }
    return lines.join(QLatin1Char('\n'));
}

// Errors report "0(n)" for the pass code and "1(n)" for common code, n
// being the line in that file.
QString assembleFragmentSource(bool gles, const QString &common, const QString &code)
{
    QStringList extensions;
    const QString preparedCommon = prepareUserSource(common, extensions);
    const QString preparedCode = prepareUserSource(code, extensions);

    QString src = QLatin1String(gles ? glslVersionGles : glslVersionDesktop);
    for (const QString &ext : std::as_const(extensions)) {
        src += ext + QLatin1Char('\n');
    }
    if (gles) {
        src += QLatin1String(glslPrecisionGles);
    }
    src += QLatin1String(shadertoyDefines);
    src += QLatin1String(shaderHeader);
    if (!common.isEmpty()) {
        src += QLatin1String("#line 1 1\n") + preparedCommon + QLatin1Char('\n');
    }
    src += QLatin1String("#line 1 0\n") + preparedCode + QLatin1String(shaderFooter);
    return src;
}

QString assembleVertexSource(bool gles)
{
    QString src = QLatin1String(gles ? glslVersionGles : glslVersionDesktop);
    if (gles) {
        src += QLatin1String(glslPrecisionGles);
    }
    return src + QLatin1String(vertexShaderSource);
}

// "// @sim-max-height N" in the first 60 lines.
int parseSimMaxHeightDirective(const QString &code)
{
    static const QRegularExpression re(
        QStringLiteral("^[ \\t]*//[ \\t]*@sim-max-height[ \\t]*:?[ \\t]*(\\d+)"),
        QRegularExpression::MultilineOption | QRegularExpression::CaseInsensitiveOption);
    qsizetype end = -1;
    for (int line = 0; line < 60; ++line) {
        end = code.indexOf(QLatin1Char('\n'), end + 1);
        if (end < 0) {
            break;
        }
    }
    const QStringView head = end < 0 ? QStringView(code) : QStringView(code).left(end);
    const QRegularExpressionMatch m = re.matchView(head);
    return m.hasMatch() ? m.capturedView(1).toInt() : 0;
}

} // namespace

ShaderEngine::ShaderEngine(QQuickItem *parent)
    : QQuickFramebufferObject(parent)
{
    setFlag(ItemHasContents, true);
    setMirrorVertically(true);

    // Render timer for animation. Must be PreciseTimer: the default coarse
    // type has ±5% slack, enough to make frame pacing visibly uneven at low
    // FPS caps.
    m_renderTimer = new QTimer(this);
    m_renderTimer->setTimerType(Qt::PreciseTimer);
    connect(m_renderTimer, &QTimer::timeout, this, &ShaderEngine::handleTimeout);

    // FPS measurement timer
    m_fpsTimer = new QTimer(this);
    m_fpsTimer->setInterval(1000);
    connect(m_fpsTimer, &QTimer::timeout, this, &ShaderEngine::updateFps);
    m_fpsTimer->start();

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
    // This timer is the ONLY thing that calls update() while running —
    // that's what enforces targetFps. Input callbacks (mouse, window,
    // audio) must only write engine state; synchronize() picks it up on
    // the next timer-paced frame.
    if (!m_running) return;
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

    m_lastTimeDelta = dt * m_speed;
    m_iTime += m_lastTimeDelta;
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

void ShaderEngine::setCompileStatus(const QString &log, bool failed)
{
    if (m_compileLog != log) {
        m_compileLog = log;
        Q_EMIT compileLogChanged();
    }
    if (m_compileFailed != failed) {
        m_compileFailed = failed;
        Q_EMIT compileFailedChanged();
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
    } else {
        // Inline code mode: a load error belongs to the previous file.
        clearError();
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
    updateSimMaxHeightDirective();
    restartFrameCount();
    
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

void ShaderEngine::setHdrPipeline(bool enabled)
{
    if (m_hdrPipeline == enabled) return;
    m_hdrPipeline = enabled;
    Q_EMIT hdrPipelineChanged();
    // Renderer drops & recreates its FBOs with the new format on the next
    // synchronize().
    update();
}

void ShaderEngine::setDither(bool enabled)
{
    if (m_dither == enabled) return;
    m_dither = enabled;
    Q_EMIT ditherChanged();
    update();
}

void ShaderEngine::updateSimMaxHeightDirective()
{
    const int directive = parseSimMaxHeightDirective(m_shaderCode);
    if (m_simMaxHeightDirective == directive) return;
    m_simMaxHeightDirective = directive;
    update();
}

void ShaderEngine::requestRepaintIfPaused()
{
    // The render timer paces frames while running.
    if (!m_running) {
        update();
    }
}

QUrl ShaderEngine::resolveTextureUrl(const QUrl &url)
{
    if (url.isEmpty() || !url.isRelative()) {
        return url;
    }
    const QString path = url.path();
    if (QDir::isAbsolutePath(path)) {
        return QUrl::fromLocalFile(path);
    }
    return QUrl::fromLocalFile(ShaderLibrary::instance()->resolveLibraryFile(path));
}

void ShaderEngine::setTargetFps(int fps)
{
    if (m_targetFps == fps) return;
    // Allow up to 360Hz for high-refresh monitors (legacy #43 - the UI
    // slider goes to 360 too). Below 1 makes no sense.
    m_targetFps = qBound(1, fps, 360);

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
    // No update(): mouse polls must not push the render rate past targetFps.
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
    m_resolvedChannelUrls[0] = resolveTextureUrl(url);
    Q_EMIT iChannel0Changed();
    update();
}

void ShaderEngine::setIChannel1(const QUrl &url)
{
    if (m_iChannel1 == url) return;
    m_iChannel1 = url;
    m_resolvedChannelUrls[1] = resolveTextureUrl(url);
    Q_EMIT iChannel1Changed();
    update();
}

void ShaderEngine::setIChannel2(const QUrl &url)
{
    if (m_iChannel2 == url) return;
    m_iChannel2 = url;
    m_resolvedChannelUrls[2] = resolveTextureUrl(url);
    Q_EMIT iChannel2Changed();
    update();
}

void ShaderEngine::setIChannel3(const QUrl &url)
{
    if (m_iChannel3 == url) return;
    m_iChannel3 = url;
    m_resolvedChannelUrls[3] = resolveTextureUrl(url);
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
    restartFrameCount();
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
    restartFrameCount();
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
    restartFrameCount();
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
    restartFrameCount();
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
    restartFrameCount();
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
    // Audio FFT is sampled on the next timer-paced render; do not call
    // update() here or PipeWire's feed bypasses targetFps.
}

void ShaderEngine::setAudioSource(AudioCapture *source)
{
    if (m_audioSource == source) return;
    m_audioSource = source;
    Q_EMIT audioSourceChanged();
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
    requestRepaintIfPaused();
}

void ShaderEngine::setScreenIndex(int index)
{
    if (m_screenIndex == index) return;
    m_screenIndex = index;
    Q_EMIT screenIndexChanged();
    requestRepaintIfPaused();
}

void ShaderEngine::setScreenCount(int count)
{
    if (m_screenCount == count) return;
    m_screenCount = count;
    Q_EMIT screenCountChanged();
    requestRepaintIfPaused();
}

void ShaderEngine::setVirtualDesktop(int desktop)
{
    if (m_virtualDesktop == desktop) return;
    m_virtualDesktop = desktop;
    Q_EMIT virtualDesktopChanged();
    requestRepaintIfPaused();
}

void ShaderEngine::setVirtualDesktopCount(int count)
{
    if (m_virtualDesktopCount == count) return;
    m_virtualDesktopCount = count;
    Q_EMIT virtualDesktopCountChanged();
    requestRepaintIfPaused();
}

void ShaderEngine::setVirtualDesktopAnim(qreal a)
{
    if (qFuzzyCompare(m_virtualDesktopAnim + 1.0, a + 1.0)) return;
    m_virtualDesktopAnim = a;
    Q_EMIT virtualDesktopAnimChanged();
}

void ShaderEngine::setWindowCount(int count)
{
    if (m_windowCount == count) return;
    m_windowCount = count;
    Q_EMIT windowCountChanged();
}

void ShaderEngine::setWindowRects(const QVariantList &rects)
{
    m_windowRects = rects;
    // Bump sequence even if values are identical — the simple act of a
    // fresh poll arriving is what the renderer wants to know (it resets
    // the extrapolation timer from this snapshot).
    ++m_windowRectsSequence;
    Q_EMIT windowRectsChanged();
    // No update(): window polls must not push the render rate past targetFps.
}

void ShaderEngine::setWindowVelocities(const QVariantList &velocities)
{
    m_windowVelocities = velocities;
    Q_EMIT windowVelocitiesChanged();
}

void ShaderEngine::restartFrameCount()
{
    // New code starts at iFrame 0, as on Shadertoy: buffer passes commonly
    // initialise their state on that frame, and the renderer clears the
    // buffers of changed code at the same time.
    m_iFrame = -1;
    Q_EMIT iFrameChanged();
}

void ShaderEngine::resetTime()
{
    m_iTime = 0.0;
    m_iFrame = -1;
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
    // like "Shaders/Foo.frag". Resolve those against the user data
    // root, then the active package, regardless of install location.
    path = ShaderLibrary::instance()->resolveLibraryFile(path);

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
        updateSimMaxHeightDirective();
        Q_EMIT shaderCodeChanged();
        Q_EMIT shaderRecompiled();
        changed = true;
    }

    const QVariantMap bufferData = library->loadBufferCodes(QUrl::fromLocalFile(path));

    // Passes and common code absent from this package are cleared, not
    // inherited from the previous shader.
    auto applyBuffer = [&](const char *key, QString &slot, void (ShaderEngine::*signal)()) {
        const QString code = bufferData.value(QString::fromLatin1(key)).toString();
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

    const QString common = bufferData.value(QStringLiteral("commonCode")).toString();
    if (m_commonCode != common) {
        m_commonCode = common;
        Q_EMIT commonCodeChanged();
        Q_EMIT shaderRecompiled();
        changed = true;
    }

    auto applyUseBuffer = [&](const char *key, bool &slot, void (ShaderEngine::*signal)()) {
        const bool use = bufferData.value(QString::fromLatin1(key)).toBool();
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
        restartFrameCount();
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

namespace {
// Texture unit for audio uploads; channels occupy units 0..3.
constexpr int kAudioUploadUnit = 4;
constexpr int kCompileBackoffInitialMs = 1000;
constexpr int kCompileBackoffMaxMs = 16000;
constexpr qint64 kFboRetryMs = 2000;
const char *const kChannelSamplerNames[4] = {"iChannel0", "iChannel1", "iChannel2", "iChannel3"};
}

ShaderEngineRenderer::ShaderEngineRenderer()
{
}

ShaderEngineRenderer::~ShaderEngineRenderer()
{
    QOpenGLContext *ctx = QOpenGLContext::currentContext();
    releaseGLResources(ctx && ctx != m_glContext.data());
}

bool ShaderEngineRenderer::ensureContext()
{
    QOpenGLContext *ctx = QOpenGLContext::currentContext();
    if (!ctx || !ctx->isValid()) {
        if (!m_contextWarned) {
            qWarning() << "ShaderEngine: no valid OpenGL context current; skipping frames";
            m_contextWarned = true;
        }
        return false;
    }
    m_contextWarned = false;

    if (ctx != m_glContext.data()) {
        if (m_hadContext) {
            qWarning() << "ShaderEngine: OpenGL context replaced; recreating GL resources";
            releaseGLResources(true);
        }
        m_glContext = ctx;
        m_hadContext = true;
        m_isGles = ctx->isOpenGLES();
        auto *f = ctx->functions();
        qInfo().nospace() << "ShaderEngine: GL_VERSION \""
                          << reinterpret_cast<const char *>(f->glGetString(GL_VERSION))
                          << "\", GL_RENDERER \""
                          << reinterpret_cast<const char *>(f->glGetString(GL_RENDERER))
                          << "\", isOpenGLES " << m_isGles;
    }
    return true;
}

void ShaderEngineRenderer::releaseGLResources(bool abandon)
{
    // With another context current, objects are abandoned rather than
    // deleted: their destructors would issue GL calls into that context.
    auto drop = [abandon](auto &object) {
        if (abandon) {
            (void)object.release();
        } else {
            object.reset();
        }
    };
    drop(m_shaderProgram);
    for (auto &program : m_bufferPrograms) {
        drop(program);
    }
    for (auto &fbo : m_bufferFBOs) {
        drop(fbo);
    }
    for (auto &fbo : m_bufferFBOsBack) {
        drop(fbo);
    }
    for (auto &texture : m_channelTextures) {
        drop(texture);
    }
    drop(m_lowResFBO);
#if !QT_CONFIG(opengles2)
    for (auto &query : m_timerQueries) {
        drop(query);
    }
#endif

    QOpenGLContext *ctx = QOpenGLContext::currentContext();
    if (!abandon && ctx && ctx->isValid() && ctx == m_glContext.data()) {
        auto *f = ctx->extraFunctions();
        if (m_vao) {
            f->glDeleteVertexArrays(1, &m_vao);
        }
        if (m_vbo) {
            f->glDeleteBuffers(1, &m_vbo);
        }
        if (m_audioTexId) {
            f->glDeleteTextures(1, &m_audioTexId);
        }
    }
    m_vao = 0;
    m_vbo = 0;
    m_audioTexId = 0;

    m_mainCompile = PassCompileState();
    m_bufferCompile.fill(PassCompileState());
    m_compileBackoffTimer.invalidate();
    m_compileBackoffMs = 0;
    m_fallbackFailed = false;
    m_channelUrls.fill(QUrl());
    m_channelFailedUrls.fill(QUrl());
    m_lowResSize = QSize();
    m_lowResFailTimer.invalidate();
    for (auto &timer : m_bufferFboFailTimers) {
        timer.invalidate();
    }
    m_timerQueryHead = 0;
    m_timerQueryPending = 0;
    m_timerQueryActive = false;
    m_timerQueriesProbed = false;
    m_timerQueriesSupported = false;
    m_initialized = false;
}

void ShaderEngineRenderer::initializeGL()
{
    if (m_initialized) return;

    QOpenGLContext *ctx = QOpenGLContext::currentContext();
    auto *f = ctx->functions();
    f->initializeOpenGLFunctions();

    createQuadVAO();

    // Audio texture: 512x2 RGBA float. RGBA32F is not filterable on GLES 3.0
    // without OES_texture_float_linear (the texture is then incomplete and
    // samples black); RGBA16F is.
    const GLint audioFormat =
        (m_isGles && !ctx->hasExtension(QByteArrayLiteral("GL_OES_texture_float_linear")))
            ? GL_RGBA16F : GL_RGBA32F;
    f->glGenTextures(1, &m_audioTexId);
    f->glActiveTexture(GL_TEXTURE0);
    f->glBindTexture(GL_TEXTURE_2D, m_audioTexId);
    f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    f->glTexImage2D(GL_TEXTURE_2D, 0, audioFormat, 512, 2, 0, GL_RGBA, GL_FLOAT, nullptr);
    f->glBindTexture(GL_TEXTURE_2D, 0);

    // synchronize() may already have compiled the user shader.
    if (!m_shaderProgram) {
        compileFallbackProgram();
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

ShaderEngineRenderer::CompileResult ShaderEngineRenderer::buildProgram(
    const QString &common, const QString &code, const QString &passLabel,
    std::unique_ptr<QOpenGLShaderProgram> &program, QString &error)
{
    // Compile into a temporary program; callers swap it in only on success,
    // so a failing edit keeps the last working program on screen.
    auto candidate = std::make_unique<QOpenGLShaderProgram>();
    QString stage;
    bool ok = candidate->addShaderFromSourceCode(QOpenGLShader::Vertex, assembleVertexSource(m_isGles));
    if (!ok) {
        stage = QStringLiteral("Vertex shader");
    }
    if (ok) {
        ok = candidate->addShaderFromSourceCode(QOpenGLShader::Fragment,
                                                assembleFragmentSource(m_isGles, common, code));
        if (!ok) {
            stage = QStringLiteral("Fragment shader");
        }
    }
    if (ok) {
        ok = candidate->link();
        if (!ok) {
            stage = QStringLiteral("Linker");
        }
    }

    if (ok) {
        program = std::move(candidate);
        m_compileBackoffTimer.invalidate();
        m_compileBackoffMs = 0;
        return CompileResult::Ok;
    }

    // A failure without a log is the signature of a lost or invalid context
    // ("could not create shader program"), not of the source.
    const QString log = candidate->log().trimmed();
    if (log.isEmpty()) {
        qWarning() << "ShaderEngine:" << stage << "(" << passLabel << ") failed without a log; retrying later";
        return CompileResult::Transient;
    }

    error = QStringLiteral("%1 (%2) failed:\n%3").arg(stage, passLabel, log);
    if (!common.isEmpty()) {
        error += QStringLiteral("\n(source 0 = this pass, source 1 = common code)");
    }
    qWarning().noquote() << "ShaderEngine:" << error;
    return CompileResult::Failed;
}

void ShaderEngineRenderer::compileMainPass(const QString &code, const QString &common)
{
    qDebug() << "Compiling main shader, code length:" << code.length();
    std::unique_ptr<QOpenGLShaderProgram> program;
    QString error;
    switch (buildProgram(common, code, QStringLiteral("main pass"), program, error)) {
    case CompileResult::Ok:
        m_shaderProgram = std::move(program);
        m_mainCompile = {code, common, true, QString()};
        break;
    case CompileResult::Failed:
        m_mainCompile = {code, common, true, error};
        break;
    case CompileResult::Transient:
        noteTransientCompileFailure();
        break;
    }
}

void ShaderEngineRenderer::compileBufferPass(int bufferIndex, const QString &code, const QString &common)
{
    if (bufferIndex < 0 || bufferIndex >= 4) return;

    qDebug() << "Compiling Buffer" << bufferIndex << "shader, code length:" << code.length();
    const QString label = QStringLiteral("buffer %1").arg(QLatin1Char('A' + bufferIndex));
    std::unique_ptr<QOpenGLShaderProgram> program;
    QString error;
    switch (buildProgram(common, code, label, program, error)) {
    case CompileResult::Ok:
        m_bufferPrograms[bufferIndex] = std::move(program);
        m_bufferCompile[bufferIndex] = {code, common, true, QString()};
        break;
    case CompileResult::Failed:
        m_bufferCompile[bufferIndex] = {code, common, true, error};
        break;
    case CompileResult::Transient:
        noteTransientCompileFailure();
        break;
    }
}

void ShaderEngineRenderer::compileFallbackProgram()
{
    // Placeholder while no user program exists. Pass compile states are
    // left untouched: this is not the user's code.
    if (m_fallbackFailed || !compileAllowed()) return;
    std::unique_ptr<QOpenGLShaderProgram> program;
    QString error;
    switch (buildProgram(QString(), QLatin1String(defaultShader), QStringLiteral("default shader"),
                         program, error)) {
    case CompileResult::Ok:
        m_shaderProgram = std::move(program);
        break;
    case CompileResult::Failed:
        m_fallbackFailed = true;
        break;
    case CompileResult::Transient:
        noteTransientCompileFailure();
        break;
    }
}

bool ShaderEngineRenderer::compileAllowed() const
{
    return !m_compileBackoffTimer.isValid() || m_compileBackoffTimer.elapsed() >= m_compileBackoffMs;
}

void ShaderEngineRenderer::noteTransientCompileFailure()
{
    m_compileBackoffMs = m_compileBackoffMs == 0
        ? kCompileBackoffInitialMs
        : qMin(m_compileBackoffMs * 2, kCompileBackoffMaxMs);
    m_compileBackoffTimer.restart();
}

void ShaderEngineRenderer::reportCompileStatus(const std::array<bool, 4> &activeBuffers)
{
    QStringList failures;
    if (!m_mainCompile.error.isEmpty()) {
        failures.append(m_mainCompile.error);
    }
    for (int i = 0; i < 4; ++i) {
        if (activeBuffers[i] && !m_bufferCompile[i].error.isEmpty()) {
            failures.append(m_bufferCompile[i].error);
        }
    }
    const QString log = failures.join(QStringLiteral("\n\n"));
    const bool failed = !failures.isEmpty();

    if (!m_engineForCallbacks) return;
    if (m_compileStatusReported && log == m_reportedCompileLog && failed == m_reportedCompileFailed) {
        return;
    }
    m_compileStatusReported = true;
    m_reportedCompileLog = log;
    m_reportedCompileFailed = failed;
    QMetaObject::invokeMethod(m_engineForCallbacks.data(), "setCompileStatus",
                              Qt::QueuedConnection,
                              Q_ARG(QString, log), Q_ARG(bool, failed));
}

void ShaderEngineRenderer::loadTexture(int channel, const QUrl &url)
{
    if (channel < 0 || channel >= 4) return;

    QString path = url.toLocalFile();
    if (path.isEmpty()) {
        path = url.scheme() == QLatin1String("qrc") ? QLatin1Char(':') + url.path() : url.path();
    }

    QImage image(path);
    if (image.isNull()) {
        // The texture of a previous URL must not stay bound in its place.
        m_channelTextures[channel].reset();
        m_channelUrls[channel].clear();
        if (m_channelFailedUrls[channel] != url) {
            qWarning() << "Failed to load texture:" << path
                       << "- retrying every" << kTextureRetryMs << "ms";
            m_channelFailedUrls[channel] = url;
        }
        m_channelRetryTimers[channel].restart();
        return;
    }

#if QT_VERSION >= QT_VERSION_CHECK(6, 9, 0)
    m_channelTextures[channel] = std::make_unique<QOpenGLTexture>(image.flipped(Qt::Vertical));
#else
    m_channelTextures[channel] = std::make_unique<QOpenGLTexture>(image.mirrored(false, true));
#endif
    m_channelTextures[channel]->setWrapMode(QOpenGLTexture::Repeat);
    m_channelTextures[channel]->setMinificationFilter(QOpenGLTexture::LinearMipMapLinear);
    m_channelTextures[channel]->setMagnificationFilter(QOpenGLTexture::Linear);

    if (m_channelFailedUrls[channel] == url) {
        qInfo() << "Loaded texture after earlier failure:" << path;
    }
    m_channelUrls[channel] = url;
    m_channelFailedUrls[channel].clear();
    m_channelRetryTimers[channel].invalidate();
}

QVector3D ShaderEngineRenderer::channelResolution(int inputType) const
{
    // Shadertoy semantics: the size of what is bound, vec3(0) when nothing is.
    auto size3 = [](int w, int h) {
        return QVector3D(w, h, h > 0 ? float(w) / float(h) : 0.0f);
    };
    if (inputType >= 0 && inputType <= 3) {
        const auto &texture = m_channelTextures[inputType];
        if (m_channelEnabled[inputType] && texture) {
            return size3(texture->width(), texture->height());
        }
    } else if (inputType >= 10 && inputType <= 13) {
        if (m_useBuffers[inputType - 10]) {
            const QSize size = m_bufferSimSize.isValid() ? m_bufferSimSize : m_fboSize;
            if (!size.isEmpty()) {
                return size3(size.width(), size.height());
            }
        }
    } else if (inputType == 20) {
        if (m_audioEnabled) {
            return size3(512, 2);
        }
    }
    return QVector3D();
}

void ShaderEngineRenderer::updateUniforms(QOpenGLShaderProgram *program, const std::array<int, 4> &mapping,
                                          bool forBufferPass, int substep, int substeps)
{
    if (!program) return;

    QVector3D resolution = m_iResolution;
    QVector4D mouse = m_iMouse;
    QVector2D mousePrev = m_iMousePrev;
    std::array<float, MAX_WINDOWS * 4> windowRects = m_windowRects;
    std::array<float, MAX_WINDOWS * 4> windowRectsPrev = m_windowRectsPrev;
    std::array<float, MAX_WINDOWS * 2> windowVelocities = m_windowVelocities;

    // Mouse and window inputs are in output-FBO pixels. A pass that renders
    // into a smaller target (buffer simulation grid, or the low-res main
    // pass when resolutionScale != 1) gets them scaled into its own pixel
    // space, so fragCoord, iMouse and iWindowRects agree.
    QSize passSize = m_fboSize;
    if (forBufferPass && m_bufferSimSize.isValid()) {
        passSize = m_bufferSimSize;
        resolution = QVector3D(m_bufferSimSize.width(), m_bufferSimSize.height(),
                               float(m_bufferSimSize.width()) / m_bufferSimSize.height());
    } else if (!forBufferPass && m_lowResFBO && m_lowResFBO->isValid() && m_lowResSize.isValid()) {
        passSize = m_lowResSize;
    }
    if (!m_fboSize.isEmpty() && !passSize.isEmpty() && passSize != m_fboSize) {
        const float sx = float(passSize.width())  / float(m_fboSize.width());
        const float sy = float(passSize.height()) / float(m_fboSize.height());
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
    // Buffer passes are substepped (see render()): each of the N passes this
    // frame advances 1/N of the frame's delta, so simulations step at a
    // fixed rate regardless of render FPS.
    const float passDelta = forBufferPass
        ? (float)(m_iTimeDelta / qMax(1, m_bufferSubSteps))
        : (float)m_iTimeDelta;
    program->setUniformValue("iTimeDelta", passDelta);
    program->setUniformValue("iFrameRate", m_iFrameRate);
    program->setUniformValue("iFrame", m_iFrame);
    program->setUniformValue("iSubstep", substep);
    program->setUniformValue("iSubsteps", substeps);
    program->setUniformValue("iMouse", mouse);
    program->setUniformValue("iMousePrev", mousePrev);
    program->setUniformValue("iDate", m_iDate);
    program->setUniformValue("iSampleRate", 44100.0f);

    // +-1 LSB of an 8-bit target; buffer passes and float outputs get none.
    const bool hdrOutput = m_hdrPipeline && m_hdrSupported;
    const float ditherAmount = (!forBufferPass && m_dither && !hdrOutput) ? 1.0f / 255.0f : 0.0f;
    program->setUniformValue("iDitherAmount", ditherAmount);

    QVector3D channelRes[4];
    for (int i = 0; i < 4; i++) {
        channelRes[i] = channelResolution(mapping[i]);
    }
    program->setUniformValueArray("iChannelResolution", channelRes, 4);

    // Channel times (all same as iTime for now)
    float channelTimes[4] = {(float)m_iTime, (float)m_iTime, (float)m_iTime, (float)m_iTime};
    program->setUniformValueArray("iChannelTime", channelTimes, 4, 1);

    for (int i = 0; i < 4; i++) {
        program->setUniformValue(kChannelSamplerNames[i], i);
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

void ShaderEngineRenderer::bindChannelInput(int channelSlot, int inputType, int currentBuffer)
{
    auto *f = QOpenGLContext::currentContext()->extraFunctions();
    f->glActiveTexture(GL_TEXTURE0 + channelSlot);

    // Every unit is rebound for every pass: an unrouted, disabled or missing
    // input samples texture 0, never what the unit held before.
    // Input types: -1=None, 0-3=Texture0-3, 10-13=BufferA-D, 20=Audio
    GLuint texId = 0;
    GLenum filter = 0;

    if (inputType >= 0 && inputType <= 3) {
        if (m_channelEnabled[inputType] && m_channelTextures[inputType]) {
            texId = m_channelTextures[inputType]->textureId();
        }
    } else if (inputType >= 10 && inputType <= 13) {
        const int bufferIdx = inputType - 10;
        if (m_useBuffers[bufferIdx]) {
            ensureBufferFBOs(bufferIdx);
            // A pass renders into (m_pingPong ? m_bufferFBOs : m_bufferFBOsBack).
            // Self-reference reads the other surface (previous step); any
            // other reader gets the surface written most recently.
            const bool self = bufferIdx == currentBuffer;
            const auto &fbo = (m_pingPong != self) ? m_bufferFBOs[bufferIdx] : m_bufferFBOsBack[bufferIdx];
            if (fbo && fbo->isValid()) {
                texId = fbo->texture();
                // NEAREST for simulation reads, LINEAR for the image pass.
                filter = (currentBuffer >= 0) ? GL_NEAREST : GL_LINEAR;
            }
        }
    } else if (inputType == 20) {
        if (m_audioEnabled) {
            texId = m_audioTexId;
        }
    } else if (inputType != -1) {
        static int warnCount = 0;
        if (warnCount++ < 5) {
            qWarning() << "Invalid inputType" << inputType << "for channel" << channelSlot << "- treating as None";
        }
    }

    f->glBindTexture(GL_TEXTURE_2D, texId);
    if (filter != 0) {
        f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, filter);
        f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, filter);
        f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    }
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

    const bool needsFBOs =
        !m_bufferFBOs[bufferIndex]
        || !m_bufferFBOsBack[bufferIndex]
        || m_bufferFBOs[bufferIndex]->size() != bufSize
        || m_bufferFBOsBack[bufferIndex]->size() != bufSize;
    if (!needsFBOs) {
        return;
    }

    QElapsedTimer &failTimer = m_bufferFboFailTimers[bufferIndex];
    if (failTimer.isValid() && failTimer.elapsed() < kFboRetryMs) {
        return;
    }

    auto pair = FramebufferUtils::createBufferPair(bufSize);
    if (!pair) {
        m_bufferFBOs[bufferIndex].reset();
        m_bufferFBOsBack[bufferIndex].reset();
        if (!failTimer.isValid()) {
            qWarning() << "Buffer" << bufferIndex
                       << "FBO creation failed for GL_RGBA32F, GL_RGBA16F, and GL_RGBA8; retrying every"
                       << kFboRetryMs << "ms";
        }
        failTimer.restart();
        return;
    }
    failTimer.invalidate();

    m_bufferFBOs[bufferIndex] = std::move(pair.front);
    m_bufferFBOsBack[bufferIndex] = std::move(pair.back);

    configureBufferTexture(m_bufferFBOs[bufferIndex]->texture());
    configureBufferTexture(m_bufferFBOsBack[bufferIndex]->texture());

    auto *f = QOpenGLContext::currentContext()->functions();
    for (QOpenGLFramebufferObject *fbo :
         {m_bufferFBOs[bufferIndex].get(), m_bufferFBOsBack[bufferIndex].get()}) {
        fbo->bind();
        f->glClearColor(0.0f, 0.0f, 0.0f, 0.0f);
        f->glClear(GL_COLOR_BUFFER_BIT);
        fbo->release();
    }

    qInfo() << "Created Buffer" << bufferIndex << "FBO pair, size:" << bufSize
            << "format:" << FramebufferUtils::textureFormatName(pair.internalTextureFormat)
            << "(native" << m_fboSize << ", simMaxH" << m_bufferSimulationMaxHeight << ")";
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

void ShaderEngineRenderer::renderBuffer(int bufferIndex, int substep)
{
    if (bufferIndex < 0 || bufferIndex >= 4) return;
    if (!m_useBuffers[bufferIndex]) return;

    auto *f = QOpenGLContext::currentContext()->extraFunctions();

    // Always ensure FBOs exist for enabled buffers
    ensureBufferFBOs(bufferIndex);

    // Discard state left by a previous shader. Both surfaces, because the pass
    // reads the one it is not writing; clearing only the target would leave
    // the stale half to be read back on the very next frame.
    if (m_bufferNeedsClear[bufferIndex]) {
        m_bufferNeedsClear[bufferIndex] = false;
        for (QOpenGLFramebufferObject *b : {m_bufferFBOs[bufferIndex].get(),
                                            m_bufferFBOsBack[bufferIndex].get()}) {
            if (b && b->isValid()) {
                b->bind();
                f->glClearColor(0.0f, 0.0f, 0.0f, 0.0f);
                f->glClear(GL_COLOR_BUFFER_BIT);
                b->release();
            }
        }
    }

    // Get the correct FBO (ping-pong)
    auto &fbo = m_pingPong ? m_bufferFBOs[bufferIndex] : m_bufferFBOsBack[bufferIndex];

    if (!fbo || !fbo->isValid()) {
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
        updateUniforms(m_bufferPrograms[bufferIndex].get(), m_bufferChannelMapping[bufferIndex],
                       true, substep, m_bufferSubSteps);

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
    updateUniforms(m_shaderProgram.get(), m_effectiveImageMapping, false, 0, 1);

    static int frameCount = 0;
    if (frameCount++ < 5) {
        qDebug() << "renderMainPass: Binding channels. Mappings:"
                 << m_effectiveImageMapping[0] << m_effectiveImageMapping[1]
                 << m_effectiveImageMapping[2] << m_effectiveImageMapping[3];
    }
    for (int i = 0; i < 4; i++) {
        bindChannelInput(i, m_effectiveImageMapping[i], -1);  // -1 = no current buffer (image pass)
    }

    f->glBindVertexArray(m_vao);
    f->glDrawArrays(GL_TRIANGLES, 0, 6);
    f->glBindVertexArray(0);

    m_shaderProgram->release();
}

void ShaderEngineRenderer::uploadAudioTexture()
{
    // 512x2 RGBA = 4096 floats. Row 0: FFT spectrum, row 1: waveform.
    if (!m_audioEnabled || !m_audioTexId || m_audioData.size() < 512 * 2 * 4) return;

    auto *f = QOpenGLContext::currentContext()->functions();
    f->glActiveTexture(GL_TEXTURE0 + kAudioUploadUnit);
    f->glBindTexture(GL_TEXTURE_2D, m_audioTexId);
    f->glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, 512, 2, GL_RGBA, GL_FLOAT, m_audioData.data());
    f->glBindTexture(GL_TEXTURE_2D, 0);
    f->glActiveTexture(GL_TEXTURE0);
}

void ShaderEngineRenderer::beginFrameTiming()
{
    m_perfTimer.start();
#if !QT_CONFIG(opengles2)
    if (!m_timerQueriesProbed) {
        m_timerQueriesProbed = true;
        // QOpenGLTimerQuery warns and fails on GLES; skip it there.
        m_timerQueriesSupported = !m_isGles;
        for (auto &query : m_timerQueries) {
            if (!m_timerQueriesSupported) break;
            query = std::make_unique<QOpenGLTimerQuery>();
            m_timerQueriesSupported = query->create();
        }
        if (!m_timerQueriesSupported) {
            for (auto &query : m_timerQueries) {
                query.reset();
            }
        }
        qInfo() << "ShaderEngine: frame time source:"
                << (m_timerQueriesSupported ? "GPU timer queries" : "CPU submit time");
    }
    if (!m_timerQueriesSupported) return;

    // Read back finished queries oldest first; never wait on one.
    while (m_timerQueryPending > 0) {
        const int oldest = (m_timerQueryHead - m_timerQueryPending + kTimerQueryCount) % kTimerQueryCount;
        QOpenGLTimerQuery *query = m_timerQueries[oldest].get();
        if (!query->isResultAvailable()) break;
        m_lastFrameTime = query->waitForResult() / 1.0e6;  // ns -> ms
        m_frameTimeFresh = true;
        --m_timerQueryPending;
    }
    if (m_timerQueryPending < kTimerQueryCount) {
        m_timerQueries[m_timerQueryHead]->begin();
        m_timerQueryActive = true;
    }
#endif
}

void ShaderEngineRenderer::endFrameTiming()
{
#if !QT_CONFIG(opengles2)
    if (m_timerQueryActive) {
        m_timerQueries[m_timerQueryHead]->end();
        m_timerQueryActive = false;
        m_timerQueryHead = (m_timerQueryHead + 1) % kTimerQueryCount;
        ++m_timerQueryPending;
        return;
    }
    if (m_timerQueriesSupported) return;  // ring full: this frame goes unmeasured
#endif
    m_lastFrameTime = m_perfTimer.nsecsElapsed() / 1.0e6;  // ns -> ms
    m_frameTimeFresh = true;
}

void ShaderEngineRenderer::render()
{
    if (!ensureContext()) return;
    if (!m_initialized) {
        initializeGL();
    }
    if (!m_shaderProgram) {
        compileFallbackProgram();
    }

    beginFrameTiming();

    auto *f = QOpenGLContext::currentContext()->functions();

    // (Re)allocate the low-res FBO if the resolution scale changed.
    ensureLowResFBO();

    // Before the buffer passes, so they sample this frame's audio.
    uploadAudioTexture();

    f->glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
    f->glClear(GL_COLOR_BUFFER_BIT);

    // Render buffer passes in order, substepped: pixel-lattice simulations
    // (wave PDEs etc.) advance a fixed amount per PASS, so running one pass
    // per frame ties simulation speed to render FPS. Instead run enough
    // passes per frame to hold a fixed ~240 steps/sec, each fed 1/N of the
    // frame's iTimeDelta (see updateUniforms). At a 240fps cap this is one
    // pass per frame — identical to the old behavior; at 60fps it's four.
    // shaderSpeed scales m_iTimeDelta upstream, so it scales the step count
    // too, keeping each step inside the sim's stability budget.
    m_bufferSubSteps = std::clamp((int)std::lround(m_iTimeDelta * 240.0), 1, 8);
    for (int s = 0; s < m_bufferSubSteps; s++) {
        for (int i = 0; i < 4; i++) {
            if (m_useBuffers[i]) {
                renderBuffer(i, s);
            }
        }
        // Each substep must read the previous substep's output, not the
        // previous frame's. The end-of-frame toggle below completes the
        // final swap.
        if (s + 1 < m_bufferSubSteps) {
            m_pingPong = !m_pingPong;
        }
    }

    // Render main pass (writes to either Qt's output FBO or m_lowResFBO).
    renderMainPass();

    // If we rendered into the low-res FBO, blit it (scaled) to Qt's output.
    if (m_lowResFBO && m_lowResFBO->isValid()) {
        blitLowResToOutput();
    }

    endFrameTiming();

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

    if (m_lowResFBO && m_lowResFBO->size() == target
        && m_lowResFBOIsHdr == (m_hdrPipeline && m_hdrSupported)) {
        return;  // Already the right size and format.
    }

    // After a failed allocation the main pass renders at native size until
    // the retry interval passes or the target size changes.
    if (m_lowResFailTimer.isValid() && m_lowResFailSize == target
        && m_lowResFailTimer.elapsed() < kFboRetryMs) {
        return;
    }

    m_lowResSize = target;
    // Match the output FBO's format — glBlitFramebuffer requires the read
    // and draw buffers to both be fixed-point or both be float.
    const bool wantHdr = m_hdrPipeline && m_hdrSupported;
    m_lowResFBO = std::make_unique<QOpenGLFramebufferObject>(
        target, QOpenGLFramebufferObject::NoAttachment, GL_TEXTURE_2D,
        wantHdr ? GL_RGBA16F : GL_RGBA8);
    m_lowResFBOIsHdr = wantHdr;

    if (!m_lowResFBO->isValid()) {
        if (!m_lowResFailTimer.isValid() || m_lowResFailSize != target) {
            qWarning() << "ShaderEngine: low-res FBO allocation failed for size" << target
                       << "- rendering at native size, retrying every" << kFboRetryMs << "ms";
        }
        m_lowResFailTimer.restart();
        m_lowResFailSize = target;
        m_lowResFBO.reset();
        m_lowResSize = QSize();
    } else {
        m_lowResFailTimer.invalidate();
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

    if (m_hdrPipeline && m_hdrSupported) {
        // HDR pipeline: keep shader output in float16 all the way to the
        // scene graph. On fallback, m_hdrSupported also keeps the low-res
        // FBO in a blit-compatible fixed-point format.
        format.setInternalTextureFormat(GL_RGBA16F);
        auto *fbo = new QOpenGLFramebufferObject(size, format);
        if (fbo->isValid()) {
            qInfo() << "ShaderEngine: HDR pipeline active — GL_RGBA16F output FBO" << size;
            return fbo;
        }
        qWarning() << "ShaderEngine: GL_RGBA16F output FBO unsupported, falling back to RGBA8";
        delete fbo;
        m_hdrSupported = false;
        format.setInternalTextureFormat(GL_RGBA8);
    }

    return new QOpenGLFramebufferObject(size, format);
}

void ShaderEngineRenderer::synchronize(QQuickFramebufferObject *item)
{
    auto *engine = static_cast<ShaderEngine*>(item);
    m_engineForCallbacks = engine;

    if (!ensureContext()) return;

    // Advance iTime exactly once per rendered frame, with a wall-clock
    // delta that gets clamped to a sane max so post-suspend / hidden-window
    // resumes don't cause shader time to leap forward (legacy #43, #106).
    engine->accumulateFrame();

    if (m_frameTimeFresh) {
        m_frameTimeFresh = false;
        QMetaObject::invokeMethod(engine, "updatePerformanceStats",
                                  Qt::QueuedConnection,
                                  Q_ARG(qreal, m_lastFrameTime));
    }

    // Pull updated timing/mouse uniforms into the renderer copy.
    m_iTime = engine->iTime();
    m_iTimeDelta = engine->lastTimeDelta();
    m_iFrameRate = engine->currentFps() > 0
        ? float(engine->currentFps())
        : float(engine->targetFps());
    m_iFrame = engine->iFrame();
    // Snapshot mouse: previous render-frame position vs current, in
    // output-FBO pixels; updateUniforms() scales it to each pass's target.
    // mouseBias scales pixel-space coords (Shadertoy iMouse convention).
    const qreal mouseBias = engine->mouseBias();
    QVector4D engineMouse = engine->iMouse();
    if (!engine->mouseEnabled()) {
        const qreal dpr = engine->window() ? engine->window()->effectiveDevicePixelRatio() : 1.0;
        const float centerX = 0.5f * float(engine->width() * dpr);
        const float centerY = 0.5f * float(engine->height() * dpr);
        engineMouse = QVector4D(centerX, centerY, 0.0f, 0.0f);
    } else if (!qFuzzyCompare(mouseBias, 1.0)) {
        engineMouse = QVector4D(engineMouse.x() * mouseBias,
                                engineMouse.y() * mouseBias,
                                engineMouse.z() * mouseBias,
                                engineMouse.w() * mouseBias);
    }
    const QVector2D mouseCur(engineMouse.x(), engineMouse.y());
    m_iMousePrev = m_hasPrevMousePos ? m_prevMousePos : mouseCur;
    m_prevMousePos = mouseCur;
    m_hasPrevMousePos = true;
    m_iMouse = engineMouse;

    m_resolutionScale = engine->resolutionScale();
    m_bufferSimulationMaxHeight = engine->effectiveBufferSimulationMaxHeight();
    m_bufferSimSize = computeBufferSimSize();
    m_dither = engine->dither();

    // HDR pipeline toggle: the output FBO's format is fixed at creation, so
    // force Qt to call createFramebufferObject() again with the new format.
    if (m_hdrPipeline != engine->hdrPipeline()) {
        m_hdrPipeline = engine->hdrPipeline();
        invalidateFramebufferObject();
    }

    // Calculate iDate
    QDateTime now = QDateTime::currentDateTime();
    QDate date = now.date();
    QTime time = now.time();
    float secondsSinceMidnight = time.hour() * 3600.0f + time.minute() * 60.0f + time.second() + time.msec() / 1000.0f;
    m_iDate = QVector4D(date.year(), date.month(), date.day(), secondsSinceMidnight);

    // --- Shader compilation ----------------------------------------------
    // Each pass recompiles only when its (code, common) pair differs from
    // the last attempt, successful or not.
    const QString commonCode = engine->commonCode();
    const QString newCode = engine->shaderCode();

    static bool loggedOnce = false;
    if (!loggedOnce) {
        qDebug() << "=== MAIN SHADER STATUS ===";
        qDebug() << "newCode length:" << newCode.length();
        qDebug() << "attempted code length:" << m_mainCompile.code.length();
        qDebug() << "m_shaderProgram valid:" << (m_shaderProgram != nullptr);
        qDebug() << "==========================";
        loggedOnce = true;
    }

    if (newCode.isEmpty()) {
        static bool warnedEmpty = false;
        if (!warnedEmpty) {
            qWarning() << "Main shader code is EMPTY! This will cause black screen if reading from buffers.";
            warnedEmpty = true;
        }
    } else if ((!m_mainCompile.attempted || newCode != m_mainCompile.code
                || commonCode != m_mainCompile.common)
               && compileAllowed()) {
        if (newCode != m_mainCompile.code) {
            // A different shader package: every buffer's state is now stale.
            m_bufferNeedsClear.fill(true);
        }
        compileMainPass(newCode, commonCode);
    }

    // Update buffer settings
    m_useBuffers[0] = engine->useBufferA();
    m_useBuffers[1] = engine->useBufferB();
    m_useBuffers[2] = engine->useBufferC();
    m_useBuffers[3] = engine->useBufferD();

    const QString bufferCodes[4] = {
        engine->bufferACode(),
        engine->bufferBCode(),
        engine->bufferCCode(),
        engine->bufferDCode()
    };

    std::array<bool, 4> activeBuffers = {false, false, false, false};
    for (int i = 0; i < 4; i++) {
        if (!m_useBuffers[i]) {
            continue;
        }
        if (bufferCodes[i].isEmpty()) {
            static bool warned[4] = {false, false, false, false};
            if (!warned[i]) {
                qWarning() << "Buffer" << i << "is enabled but has no code!";
                warned[i] = true;
            }
            // The previous shader's program must not keep running here.
            m_bufferPrograms[i].reset();
            m_bufferCompile[i] = PassCompileState();
            continue;
        }
        activeBuffers[i] = true;
        const PassCompileState &state = m_bufferCompile[i];
        if ((!state.attempted || bufferCodes[i] != state.code || commonCode != state.common)
            && compileAllowed()) {
            compileBufferPass(i, bufferCodes[i], commonCode);
            // New code, so the accumulated state belongs to the old
            // shader - discard it rather than hand it over.
            m_bufferNeedsClear[i] = true;
        }
    }

    reportCompileStatus(activeBuffers);

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

    // --- Channel textures ------------------------------------------------
    const bool enabled[4] = {
        engine->iChannel0Enabled(),
        engine->iChannel1Enabled(),
        engine->iChannel2Enabled(),
        engine->iChannel3Enabled()
    };

    for (int i = 0; i < 4; i++) {
        m_channelEnabled[i] = enabled[i];
        const QUrl url = engine->resolvedChannelUrl(i);
        if (!enabled[i] || url.isEmpty()) {
            // Forget the channel entirely so re-enabling it reloads (#73).
            m_channelTextures[i].reset();
            m_channelUrls[i].clear();
            m_channelFailedUrls[i].clear();
            m_channelRetryTimers[i].invalidate();
            continue;
        }
        // On cold boot the URL can arrive before the file is readable, or
        // before the enabled flag (legacy #73): a failed URL is retried
        // every kTextureRetryMs instead of being given up on.
        if (url == m_channelUrls[i] && m_channelTextures[i]) {
            continue;
        }
        if (url == m_channelFailedUrls[i] && m_channelRetryTimers[i].isValid()
            && m_channelRetryTimers[i].elapsed() < kTextureRetryMs) {
            continue;
        }
        loadTexture(i, url);
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

    // --- Audio -----------------------------------------------------------
    m_audioEnabled = engine->audioEnabled();
    m_audioChannel = qBound(0, engine->audioChannel(), 3);

    if (m_audioEnabled) {
        if (AudioCapture *source = engine->audioSource()) {
            source->copyTextureData(m_audioData);
        } else {
            const QVariantList audioList = engine->audioData();
            m_audioData.resize(audioList.size());
            for (int i = 0; i < audioList.size(); i++) {
                m_audioData[i] = audioList[i].toFloat();
            }
        }
    }

    // Legacy routing: the "Audio channel" setting predates per-pass
    // mappings. It applies only while no active pass routes audio (20).
    m_effectiveImageMapping = m_imageChannelMapping;
    if (m_audioEnabled) {
        auto routesAudio = [](const std::array<int, 4> &mapping) {
            return std::find(mapping.begin(), mapping.end(), 20) != mapping.end();
        };
        bool routed = routesAudio(m_imageChannelMapping);
        for (int b = 0; b < 4 && !routed; b++) {
            routed = m_useBuffers[b] && routesAudio(m_bufferChannelMapping[b]);
        }
        if (!routed) {
            m_effectiveImageMapping[m_audioChannel] = 20;
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
