// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "cursortracker.h"

#include <QGuiApplication>
#include <QCursor>
#include <QScreen>

#ifdef HAVE_XCB
#include <xcb/xcb.h>
#endif

CursorTracker::CursorTracker(QObject *parent)
    : QObject(parent)
{
    m_pollTimer = new QTimer(this);
    connect(m_pollTimer, &QTimer::timeout, this, &CursorTracker::pollCursor);
    
    // Detect platform
    QString platform = QGuiApplication::platformName();
    m_isX11 = (platform == QLatin1String("xcb"));
    m_isWayland = (platform == QLatin1String("wayland"));
    
    // Get primary screen
    m_screen = QGuiApplication::primaryScreen();
    
    // Initialize platform-specific cursor tracking
    if (m_isX11) {
        initX11();
    } else if (m_isWayland) {
        initWayland();
    }
}

CursorTracker::~CursorTracker()
{
    stopPolling();
    
#ifdef HAVE_XCB
    if (m_xcbConnection) {
        xcb_disconnect(m_xcbConnection);
        m_xcbConnection = nullptr;
    }
#endif
}

bool CursorTracker::available() const
{
#ifdef HAVE_XCB
    if (m_isX11) return true;
#endif
    // On Wayland, we can still track cursor within the wallpaper via QML
    // but not globally. Return true but note limitations in UI.
    return true;
}

QVector4D CursorTracker::iMouse() const
{
    qreal x = m_position.x();
    qreal y = m_position.y();
    qreal z = m_pressed ? m_clickPosition.x() : -m_clickPosition.x();
    qreal w = m_clickPosition.y();

    // Flip Y: Qt/wallpaper-local has Y=0 at top, GLSL fragCoord Y=0 at bottom.
    // MUST use the wallpaper item height (referenceHeight), not QScreen height.
    const qreal refH = m_referenceHeight > 0.0
        ? m_referenceHeight
        : (m_normalizeCoordinates ? 1.0
           : (m_screen ? m_screen->size().height() : 0.0));
    if (refH > 0.0) {
        y = refH - y;
        w = refH - w;
    }

    // FBO / fragCoord use device pixels; MouseArea coords are logical.
    const qreal dpr = m_devicePixelRatio > 0.0 ? m_devicePixelRatio : 1.0;
    x *= dpr;
    y *= dpr;
    z *= dpr;
    w *= dpr;

    return QVector4D(x, y, z, w);
}

void CursorTracker::setEnabled(bool enabled)
{
    if (m_enabled == enabled) return;
    m_enabled = enabled;
    
    if (m_enabled) {
        startPolling();
    } else {
        stopPolling();
    }
    
    Q_EMIT enabledChanged();
}

void CursorTracker::setPollInterval(int interval)
{
    if (m_pollInterval == interval) return;
    m_pollInterval = qMax(1, interval);
    
    if (m_pollTimer->isActive()) {
        m_pollTimer->setInterval(m_pollInterval);
    }
    
    Q_EMIT pollIntervalChanged();
}

void CursorTracker::setSensitivity(qreal sensitivity)
{
    if (qFuzzyCompare(m_sensitivity, sensitivity)) return;
    m_sensitivity = sensitivity;
    Q_EMIT sensitivityChanged();
    Q_EMIT iMouseChanged();
}

void CursorTracker::setScreen(QScreen *screen)
{
    if (m_screen == screen) return;
    m_screen = screen;
    Q_EMIT screenChanged();
}

void CursorTracker::setReferenceWidth(qreal width)
{
    if (qFuzzyCompare(m_referenceWidth, width)) return;
    m_referenceWidth = width;
    Q_EMIT referenceSizeChanged();
    Q_EMIT iMouseChanged();
}

void CursorTracker::setReferenceHeight(qreal height)
{
    if (qFuzzyCompare(m_referenceHeight, height)) return;
    m_referenceHeight = height;
    Q_EMIT referenceSizeChanged();
    Q_EMIT iMouseChanged();
}

void CursorTracker::setDevicePixelRatio(qreal ratio)
{
    ratio = qMax(0.01, ratio);
    if (qFuzzyCompare(m_devicePixelRatio, ratio)) return;
    m_devicePixelRatio = ratio;
    Q_EMIT devicePixelRatioChanged();
    Q_EMIT iMouseChanged();
}

void CursorTracker::setNormalizeCoordinates(bool normalize)
{
    if (m_normalizeCoordinates == normalize) return;
    m_normalizeCoordinates = normalize;
    Q_EMIT normalizeCoordinatesChanged();
}

void CursorTracker::refresh()
{
    if (!m_enabled) return;
    pollCursor();
}

void CursorTracker::updatePosition(qreal x, qreal y)
{
    QPointF newPos(x, y);
    
    if (m_normalizeCoordinates && m_screen) {
        const qreal refW = m_referenceWidth > 0.0 ? m_referenceWidth : m_screen->size().width();
        const qreal refH = m_referenceHeight > 0.0 ? m_referenceHeight : m_screen->size().height();
        newPos.setX(x / refW);
        newPos.setY(y / refH);
    }
    
    if (m_position != newPos) {
        m_position = newPos;
        Q_EMIT positionChanged();
        Q_EMIT iMouseChanged();
    }
}

void CursorTracker::updateClick(qreal x, qreal y, bool pressed)
{
    QPointF clickPos(x, y);
    
    if (m_normalizeCoordinates && m_screen) {
        const qreal refW = m_referenceWidth > 0.0 ? m_referenceWidth : m_screen->size().width();
        const qreal refH = m_referenceHeight > 0.0 ? m_referenceHeight : m_screen->size().height();
        clickPos.setX(x / refW);
        clickPos.setY(y / refH);
    }
    
    bool changed = false;
    
    if (m_clickPosition != clickPos) {
        m_clickPosition = clickPos;
        changed = true;
        Q_EMIT clickPositionChanged();
    }
    
    if (m_pressed != pressed) {
        m_pressed = pressed;
        changed = true;
        Q_EMIT pressedChanged();
    }
    
    if (changed) {
        Q_EMIT iMouseChanged();
    }
}

void CursorTracker::updatePressed(bool pressed)
{
    if (m_pressed == pressed) return;
    m_pressed = pressed;
    
    // Update click position to current position when pressed
    if (pressed) {
        m_clickPosition = m_position;
        Q_EMIT clickPositionChanged();
    }
    
    Q_EMIT pressedChanged();
    Q_EMIT iMouseChanged();
}

void CursorTracker::startPolling()
{
    if (!m_pollTimer->isActive()) {
        m_pollTimer->start(m_pollInterval);
    }
}

void CursorTracker::stopPolling()
{
    m_pollTimer->stop();
}

void CursorTracker::pollCursor()
{
    QPoint globalPos = getGlobalCursorPosition();
    bool buttonState = getButtonState();
    
    // Transform to local/normalized coordinates if needed
    QPointF localPos = globalPos;
    
    if (m_screen) {
        // Global cursor → wallpaper-local (top-left origin, same as MouseArea).
        QRect screenGeom = m_screen->geometry();
        localPos = QPointF(globalPos.x() - screenGeom.x(),
                           globalPos.y() - screenGeom.y());
        
        if (m_normalizeCoordinates) {
            const qreal refW = m_referenceWidth > 0.0 ? m_referenceWidth : screenGeom.width();
            const qreal refH = m_referenceHeight > 0.0 ? m_referenceHeight : screenGeom.height();
            localPos.setX(localPos.x() / refW);
            localPos.setY(localPos.y() / refH);
        }
    }
    
    bool posChanged = (m_position != localPos);
    bool buttonChanged = (m_pressed != buttonState);
    
    if (posChanged) {
        m_position = localPos;
        Q_EMIT positionChanged();
    }
    
    if (buttonChanged) {
        m_pressed = buttonState;
        
        if (buttonState) {
            // Record click position
            m_clickPosition = localPos;
            Q_EMIT clickPositionChanged();
        }
        
        Q_EMIT pressedChanged();
    }
    
    if (posChanged || buttonChanged) {
        Q_EMIT iMouseChanged();
    }
}

bool CursorTracker::initX11()
{
#ifdef HAVE_XCB
    // Connect to X server
    int screenNum;
    m_xcbConnection = xcb_connect(nullptr, &screenNum);
    
    if (xcb_connection_has_error(m_xcbConnection)) {
        m_xcbConnection = nullptr;
        return false;
    }
    
    // Get the screen
    const xcb_setup_t *setup = xcb_get_setup(m_xcbConnection);
    xcb_screen_iterator_t iter = xcb_setup_roots_iterator(setup);
    
    for (int i = 0; i < screenNum; i++) {
        xcb_screen_next(&iter);
    }
    
    m_xcbScreen = iter.data;
    m_initialized = true;
    return true;
#else
    return false;
#endif
}

bool CursorTracker::initWayland()
{
    // On Wayland, we can't easily get global cursor position
    // due to security restrictions. We rely on QML MouseArea
    // for cursor tracking within the wallpaper.
    m_initialized = true;
    return true;
}

QPoint CursorTracker::getGlobalCursorPosition()
{
#ifdef HAVE_XCB
    if (m_isX11 && m_xcbConnection && m_xcbScreen) {
        xcb_query_pointer_cookie_t cookie = xcb_query_pointer(m_xcbConnection, m_xcbScreen->root);
        xcb_query_pointer_reply_t *reply = xcb_query_pointer_reply(m_xcbConnection, cookie, nullptr);
        
        if (reply) {
            QPoint pos(reply->root_x, reply->root_y);
            free(reply);
            return pos;
        }
    }
#endif
    
    // Fallback to Qt's cursor position (works on X11, limited on Wayland)
    return QCursor::pos();
}

bool CursorTracker::getButtonState()
{
#ifdef HAVE_XCB
    if (m_isX11 && m_xcbConnection && m_xcbScreen) {
        xcb_query_pointer_cookie_t cookie = xcb_query_pointer(m_xcbConnection, m_xcbScreen->root);
        xcb_query_pointer_reply_t *reply = xcb_query_pointer_reply(m_xcbConnection, cookie, nullptr);
        
        if (reply) {
            // Check for any mouse button pressed
            bool pressed = (reply->mask & (XCB_BUTTON_MASK_1 | XCB_BUTTON_MASK_2 | XCB_BUTTON_MASK_3)) != 0;
            free(reply);
            return pressed;
        }
    }
#endif
    
    // Can't reliably detect button state without platform-specific code
    return m_pressed;
}

