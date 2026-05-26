#include "windowtracker.h"
#include <QDateTime>
#include <QGuiApplication>
#include <QScreen>
#include <QDebug>

#ifdef HAVE_XCB
#include <xcb/xcb.h>
#endif

WindowTracker::WindowTracker(QObject *parent)
    : QObject(parent)
    , m_pollTimer(new QTimer(this))
{
    connect(m_pollTimer, &QTimer::timeout, this, &WindowTracker::pollWindows);
#ifdef HAVE_XCB
    initXcb();
#endif
}

WindowTracker::~WindowTracker()
{
#ifdef HAVE_XCB
    cleanupXcb();
#endif
}

#ifdef HAVE_XCB
void WindowTracker::initXcb()
{
    xcb_connection_t *conn = xcb_connect(nullptr, nullptr);
    if (!conn || xcb_connection_has_error(conn)) {
        qWarning() << "WindowTracker: Failed to connect to X server";
        if (conn) xcb_disconnect(conn);
        m_xcbConnection = nullptr;
        m_dbusAvailable = false;
        return;
    }
    
    m_xcbConnection = conn;
    m_dbusAvailable = true;
    qDebug() << "WindowTracker: Connected to X server via XCB";
}

void WindowTracker::cleanupXcb()
{
    if (m_xcbConnection) {
        xcb_disconnect(static_cast<xcb_connection_t*>(m_xcbConnection));
        m_xcbConnection = nullptr;
    }
}
#endif

void WindowTracker::initDBus()
{
    // Legacy - now using XCB directly
}

bool WindowTracker::available() const
{
    return m_dbusAvailable;
}

void WindowTracker::setEnabled(bool enabled)
{
    if (m_enabled == enabled) return;
    m_enabled = enabled;
    
    if (m_enabled) {
        qDebug() << "WindowTracker: Enabled with poll interval" << m_pollInterval << "ms";
        m_lastPollTime = QDateTime::currentMSecsSinceEpoch();
        pollWindows();  // Initial poll
        m_pollTimer->start(m_pollInterval);
    } else {
        qDebug() << "WindowTracker: Disabled";
        m_pollTimer->stop();
        m_windows.clear();
        Q_EMIT windowsChanged();
    }
    
    Q_EMIT enabledChanged();
}

void WindowTracker::setPollInterval(int ms)
{
    if (m_pollInterval == ms) return;
    m_pollInterval = qMax(16, ms);  // Minimum ~60Hz
    
    if (m_pollTimer->isActive()) {
        m_pollTimer->setInterval(m_pollInterval);
    }
    
    Q_EMIT pollIntervalChanged();
}

void WindowTracker::setReferenceWidth(qreal width)
{
    if (qFuzzyCompare(m_referenceWidth, width)) return;
    m_referenceWidth = width;
    Q_EMIT referenceSizeChanged();
    Q_EMIT windowsChanged();
}

void WindowTracker::setReferenceHeight(qreal height)
{
    if (qFuzzyCompare(m_referenceHeight, height)) return;
    m_referenceHeight = height;
    Q_EMIT referenceSizeChanged();
    Q_EMIT windowsChanged();
}

void WindowTracker::setDevicePixelRatio(qreal ratio)
{
    ratio = qMax(0.01, ratio);
    if (qFuzzyCompare(m_devicePixelRatio, ratio)) return;
    m_devicePixelRatio = ratio;
    Q_EMIT devicePixelRatioChanged();
    Q_EMIT windowsChanged();
}

void WindowTracker::setScreenVirtualX(qreal x)
{
    if (qFuzzyCompare(m_screenVirtualX, x)) return;
    m_screenVirtualX = x;
    Q_EMIT screenVirtualChanged();
    Q_EMIT windowsChanged();
}

void WindowTracker::setScreenVirtualY(qreal y)
{
    if (qFuzzyCompare(m_screenVirtualY, y)) return;
    m_screenVirtualY = y;
    Q_EMIT screenVirtualChanged();
    Q_EMIT windowsChanged();
}

QRectF WindowTracker::mapRectToShader(const QRectF &globalTopLeft) const
{
    // XCB geometry: global desktop coords, Y=0 at top.
    // Shader fragCoord / iMouse: this wallpaper's FBO, Y=0 at bottom, device pixels.
    const qreal dpr = m_devicePixelRatio > 0.0 ? m_devicePixelRatio : 1.0;
    const qreal refH = (m_referenceHeight > 0.0 ? m_referenceHeight : 1080.0) * dpr;
    const qreal originX = m_screenVirtualX * dpr;
    const qreal originY = m_screenVirtualY * dpr;

    const qreal localX = globalTopLeft.x() - originX;
    const qreal localY = refH - (globalTopLeft.y() - originY) - globalTopLeft.height();

    return QRectF(localX, localY, globalTopLeft.width(), globalTopLeft.height());
}

void WindowTracker::refresh()
{
    if (m_enabled) {
        pollWindows();
    }
}

void WindowTracker::pollWindows()
{
    if (!m_dbusAvailable) return;
    
    qint64 now = QDateTime::currentMSecsSinceEpoch();
    qreal dt = (now - m_lastPollTime) / 1000.0;
    m_lastPollTime = now;
    
    updateWindowList();
    calculateVelocities(dt);
    
    Q_EMIT windowsChanged();
}

void WindowTracker::updateWindowList()
{
    updateWindowListFromSystem();
}

#ifdef HAVE_XCB
// Helper to get window geometry
static bool getWindowGeometry(xcb_connection_t *conn, xcb_window_t win, QRectF &outGeom)
{
    xcb_get_geometry_cookie_t cookie = xcb_get_geometry(conn, win);
    xcb_get_geometry_reply_t *geom = xcb_get_geometry_reply(conn, cookie, nullptr);
    
    if (!geom) return false;
    
    // Get absolute coordinates by translating to root
    xcb_translate_coordinates_cookie_t transCookie = 
        xcb_translate_coordinates(conn, win, geom->root, 0, 0);
    xcb_translate_coordinates_reply_t *trans = 
        xcb_translate_coordinates_reply(conn, transCookie, nullptr);
    
    if (trans) {
        outGeom = QRectF(trans->dst_x, trans->dst_y, geom->width, geom->height);
        free(trans);
    } else {
        outGeom = QRectF(geom->x, geom->y, geom->width, geom->height);
    }
    
    free(geom);
    return true;
}

// Helper to check if window is viewable (mapped and visible)
static bool isWindowVisible(xcb_connection_t *conn, xcb_window_t win)
{
    xcb_get_window_attributes_cookie_t cookie = xcb_get_window_attributes(conn, win);
    xcb_get_window_attributes_reply_t *attrs = xcb_get_window_attributes_reply(conn, cookie, nullptr);
    
    if (!attrs) return false;
    
    bool visible = (attrs->map_state == XCB_MAP_STATE_VIEWABLE);
    free(attrs);
    return visible;
}

// Helper to get atom (cached for performance)
static xcb_atom_t getAtom(xcb_connection_t *conn, const char *name, QMap<QByteArray, xcb_atom_t> &cache)
{
    QByteArray key(name);
    if (cache.contains(key)) {
        return cache[key];
    }
    
    xcb_intern_atom_cookie_t cookie = xcb_intern_atom(conn, 0, strlen(name), name);
    xcb_intern_atom_reply_t *reply = xcb_intern_atom_reply(conn, cookie, nullptr);
    
    if (!reply) return XCB_ATOM_NONE;
    
    xcb_atom_t atom = reply->atom;
    free(reply);
    cache[key] = atom;
    return atom;
}

// Helper to get window property
static QVector<xcb_window_t> getWindowList(xcb_connection_t *conn, xcb_window_t root, xcb_atom_t atom)
{
    QVector<xcb_window_t> windows;
    
    xcb_get_property_cookie_t cookie = xcb_get_property(conn, 0, root, atom, 
                                                         XCB_ATOM_WINDOW, 0, 1024);
    xcb_get_property_reply_t *reply = xcb_get_property_reply(conn, cookie, nullptr);
    
    if (reply && reply->type == XCB_ATOM_WINDOW) {
        int count = xcb_get_property_value_length(reply) / sizeof(xcb_window_t);
        xcb_window_t *data = (xcb_window_t *)xcb_get_property_value(reply);
        
        for (int i = 0; i < count; i++) {
            windows.append(data[i]);
        }
    }
    
    if (reply) free(reply);
    return windows;
}

// Check if window has a specific state atom
static bool hasState(xcb_connection_t *conn, xcb_window_t win, xcb_atom_t stateAtom, xcb_atom_t targetState)
{
    xcb_get_property_cookie_t cookie = xcb_get_property(conn, 0, win, stateAtom, 
                                                         XCB_ATOM_ATOM, 0, 32);
    xcb_get_property_reply_t *reply = xcb_get_property_reply(conn, cookie, nullptr);
    
    if (!reply) return false;
    
    bool found = false;
    if (reply->type == XCB_ATOM_ATOM) {
        int count = xcb_get_property_value_length(reply) / sizeof(xcb_atom_t);
        xcb_atom_t *atoms = (xcb_atom_t *)xcb_get_property_value(reply);
        
        for (int i = 0; i < count; i++) {
            if (atoms[i] == targetState) {
                found = true;
                break;
            }
        }
    }
    
    free(reply);
    return found;
}

// Check window type - returns true if it's a normal/dialog window we should track
static bool isNormalWindow(xcb_connection_t *conn, xcb_window_t win, 
                           xcb_atom_t typeAtom, xcb_atom_t typeNormal, xcb_atom_t typeDialog,
                           xcb_atom_t typeDesktop, xcb_atom_t typeDock, xcb_atom_t typeSplash,
                           xcb_atom_t typeToolbar, xcb_atom_t typeMenu, xcb_atom_t typeUtility)
{
    xcb_get_property_cookie_t cookie = xcb_get_property(conn, 0, win, typeAtom, 
                                                         XCB_ATOM_ATOM, 0, 32);
    xcb_get_property_reply_t *reply = xcb_get_property_reply(conn, cookie, nullptr);
    
    if (!reply || reply->type != XCB_ATOM_ATOM) {
        if (reply) free(reply);
        // No type set - assume it's a normal window
        return true;
    }
    
    int count = xcb_get_property_value_length(reply) / sizeof(xcb_atom_t);
    xcb_atom_t *atoms = (xcb_atom_t *)xcb_get_property_value(reply);
    
    bool isNormal = false;
    bool isExcluded = false;
    
    for (int i = 0; i < count; i++) {
        // Check for types we want
        if (atoms[i] == typeNormal || atoms[i] == typeDialog) {
            isNormal = true;
        }
        // Check for types we DON'T want
        if (atoms[i] == typeDesktop || atoms[i] == typeDock || 
            atoms[i] == typeSplash || atoms[i] == typeToolbar ||
            atoms[i] == typeMenu || atoms[i] == typeUtility) {
            isExcluded = true;
        }
    }
    
    free(reply);
    
    // Exclude if it has an excluded type
    if (isExcluded) return false;
    
    // Include if it's marked as normal/dialog, or has no specific type
    return isNormal || count == 0;
}
#endif

void WindowTracker::updateWindowListFromSystem()
{
#ifdef HAVE_XCB
    xcb_connection_t *conn = static_cast<xcb_connection_t*>(m_xcbConnection);
    if (!conn) return;
    
    // Check connection is still valid
    if (xcb_connection_has_error(conn)) {
        qWarning() << "WindowTracker: X connection error, reconnecting...";
        cleanupXcb();
        initXcb();
        return;
    }
    
    // Store previous positions for velocity calculation
    QMap<QString, QRectF> prevPositions;
    for (const auto &win : m_windows) {
        prevPositions[win.id] = win.geometry;
    }
    
    m_windows.clear();
    
    // Get screen info
    const xcb_setup_t *setup = xcb_get_setup(conn);
    xcb_screen_iterator_t iter = xcb_setup_roots_iterator(setup);
    xcb_screen_t *screen = iter.data;
    
    if (!screen) return;
    
    xcb_window_t root = screen->root;
    qreal screenHeight = screen->height_in_pixels;
    
    // Cache atoms for performance
    static QMap<QByteArray, xcb_atom_t> atomCache;
    
    xcb_atom_t netClientList = getAtom(conn, "_NET_CLIENT_LIST", atomCache);
    xcb_atom_t netWmState = getAtom(conn, "_NET_WM_STATE", atomCache);
    xcb_atom_t netWmStateHidden = getAtom(conn, "_NET_WM_STATE_HIDDEN", atomCache);
    
    // Window type atoms for filtering
    xcb_atom_t netWmWindowType = getAtom(conn, "_NET_WM_WINDOW_TYPE", atomCache);
    xcb_atom_t typeNormal = getAtom(conn, "_NET_WM_WINDOW_TYPE_NORMAL", atomCache);
    xcb_atom_t typeDialog = getAtom(conn, "_NET_WM_WINDOW_TYPE_DIALOG", atomCache);
    xcb_atom_t typeDesktop = getAtom(conn, "_NET_WM_WINDOW_TYPE_DESKTOP", atomCache);
    xcb_atom_t typeDock = getAtom(conn, "_NET_WM_WINDOW_TYPE_DOCK", atomCache);
    xcb_atom_t typeSplash = getAtom(conn, "_NET_WM_WINDOW_TYPE_SPLASH", atomCache);
    xcb_atom_t typeToolbar = getAtom(conn, "_NET_WM_WINDOW_TYPE_TOOLBAR", atomCache);
    xcb_atom_t typeMenu = getAtom(conn, "_NET_WM_WINDOW_TYPE_MENU", atomCache);
    xcb_atom_t typeUtility = getAtom(conn, "_NET_WM_WINDOW_TYPE_UTILITY", atomCache);
    
    QVector<xcb_window_t> windowList = getWindowList(conn, root, netClientList);
    
    for (xcb_window_t win : windowList) {
        if (m_windows.size() >= MAX_WINDOWS) break;
        
        // Check if window is visible
        if (!isWindowVisible(conn, win)) continue;
        
        // Check if window is hidden (minimized)
        if (hasState(conn, win, netWmState, netWmStateHidden)) continue;
        
        // Check window type - skip desktop, dock, splash, toolbar, menu, utility
        if (!isNormalWindow(conn, win, netWmWindowType, typeNormal, typeDialog,
                           typeDesktop, typeDock, typeSplash, typeToolbar, typeMenu, typeUtility)) {
            continue;
        }
        
        // Get window geometry
        QRectF geom;
        if (!getWindowGeometry(conn, win, geom)) continue;
        
        // Skip tiny windows (toolbars, popups, etc.)
        if (geom.width() < 100 || geom.height() < 100) continue;
        
        // Skip windows that are the same size as the screen (likely desktop/wallpaper)
        if (geom.width() >= screenHeight * 0.95 && geom.height() >= screenHeight * 0.95) {
            continue;
        }
        
        // Skip very thin windows (likely panels)
        if (geom.width() < 150 || geom.height() < 150) continue;
        
        // Store global desktop geometry (Y=0 at top); map to shader space in windowRectsFlat().
        WindowInfo info;
        info.id = QString::number(win, 16);
        info.geometry = geom;
        
        // Restore previous geometry for velocity
        if (prevPositions.contains(info.id)) {
            info.prevGeometry = prevPositions[info.id];
        } else {
            info.prevGeometry = info.geometry;
        }
        
        info.isVisible = true;
        m_windows.append(info);
    }
    
    // Only log when the set of tracked windows actually changes — the
    // previous "every 100 frames" throttle still spammed ~30 lines/sec
    // when the user had ≥8 windows open, which flooded the journal.
    static int lastReportedCount = -1;
    if (m_windows.size() != lastReportedCount) {
        lastReportedCount = m_windows.size();
        qDebug() << "WindowTracker: now tracking" << m_windows.size()
                 << "windows (out of" << windowList.size() << "total)";
    }
#else
    qWarning() << "WindowTracker: XCB not available";
#endif
}

void WindowTracker::tryKWinScript()
{
    // Not used when we have XCB
}

void WindowTracker::parseWindowsFromSupportInfo(const QString &info, qreal screenHeight)
{
    Q_UNUSED(info)
    Q_UNUSED(screenHeight)
    // Not used when we have XCB
}

void WindowTracker::calculateVelocities(qreal dt)
{
    if (dt <= 0) return;
    
    for (auto &win : m_windows) {
        qreal dx = win.geometry.x() - win.prevGeometry.x();
        qreal dy = win.geometry.y() - win.prevGeometry.y();
        
        win.velocity = QPointF(dx / dt, dy / dt);
    }
}

QVariantList WindowTracker::windowRects() const
{
    QVariantList result;
    for (const auto &win : m_windows) {
        result.append(QVariant::fromValue(mapRectToShader(win.geometry)));
    }
    return result;
}

QVariantList WindowTracker::windowVelocities() const
{
    QVariantList result;
    for (const auto &win : m_windows) {
        result.append(QVariant::fromValue(win.velocity));
    }
    return result;
}

QVariantList WindowTracker::windowRectsFlat() const
{
    QVariantList result;
    
    for (int i = 0; i < MAX_WINDOWS; i++) {
        if (i < m_windows.size()) {
            const QRectF local = mapRectToShader(m_windows[i].geometry);
            result.append(static_cast<float>(local.x()));
            result.append(static_cast<float>(local.y()));
            result.append(static_cast<float>(local.width()));
            result.append(static_cast<float>(local.height()));
        } else {
            result.append(0.0f);
            result.append(0.0f);
            result.append(0.0f);
            result.append(0.0f);
        }
    }
    
    return result;
}

QVariantList WindowTracker::windowVelocitiesFlat() const
{
    QVariantList result;
    
    for (int i = 0; i < MAX_WINDOWS; i++) {
        if (i < m_windows.size()) {
            const auto &win = m_windows[i];
            result.append(static_cast<float>(win.velocity.x()));
            result.append(static_cast<float>(win.velocity.y()));
        } else {
            result.append(0.0f);
            result.append(0.0f);
        }
    }
    
    return result;
}
