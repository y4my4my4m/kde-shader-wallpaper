#include "windowtracker.h"
#include <QDateTime>
#include <QGuiApplication>
#include <QScreen>
#include <QSocketNotifier>
#include <QDebug>

#ifdef HAVE_XCB
#include <xcb/xcb.h>
#endif

WindowTracker::WindowTracker(QObject *parent)
    : QObject(parent)
    , m_pollTimer(new QTimer(this))
{
    // Coarse (default) timers have ±5% slack — at render-rate intervals the
    // resulting cadence jitter is visible as uneven window-motion updates.
    m_pollTimer->setTimerType(Qt::PreciseTimer);
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

    // Subscribe to top-level window activity on the root window. This is
    // notification only (SubstructureNotify, not Redirect) so it can't
    // conflict with the window manager. It lets pollWindows() skip all X
    // traffic while the desktop is idle instead of re-querying every
    // window 20 times a second.
    const xcb_setup_t *setup = xcb_get_setup(conn);
    xcb_screen_t *screen = xcb_setup_roots_iterator(setup).data;
    if (screen) {
        const uint32_t mask = XCB_EVENT_MASK_SUBSTRUCTURE_NOTIFY;
        xcb_change_window_attributes(conn, screen->root, XCB_CW_EVENT_MASK, &mask);
        xcb_flush(conn);
    }

    m_xcbNotifier = new QSocketNotifier(xcb_get_file_descriptor(conn),
                                        QSocketNotifier::Read, this);
    connect(m_xcbNotifier, &QSocketNotifier::activated,
            this, [this]() { processXcbEvents(); });

    qDebug() << "WindowTracker: Connected to X server via XCB (event-driven)";
}

void WindowTracker::cleanupXcb()
{
    delete m_xcbNotifier;
    m_xcbNotifier = nullptr;
    if (m_xcbConnection) {
        xcb_disconnect(static_cast<xcb_connection_t*>(m_xcbConnection));
        m_xcbConnection = nullptr;
    }
}

void WindowTracker::processXcbEvents()
{
    xcb_connection_t *conn = static_cast<xcb_connection_t*>(m_xcbConnection);
    if (!conn) return;
    if (xcb_connection_has_error(conn)) {
        if (m_xcbNotifier) m_xcbNotifier->setEnabled(false);
        return;
    }

    while (xcb_generic_event_t *ev = xcb_poll_for_event(conn)) {
        switch (ev->response_type & ~0x80) {
        case XCB_CREATE_NOTIFY:
        case XCB_DESTROY_NOTIFY:
        case XCB_MAP_NOTIFY:
        case XCB_UNMAP_NOTIFY:
        case XCB_REPARENT_NOTIFY:
        case XCB_CONFIGURE_NOTIFY:
            m_windowsDirty = true;
            break;
        default:
            break;
        }
        free(ev);
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
    m_pollInterval = qMax(4, ms);  // Minimum ~250Hz — QML paces this to targetFps
    
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
        m_windowsDirty = true; // forced refresh bypasses the idle skip
        pollWindows();
    }
}

void WindowTracker::pollWindows()
{
    if (!m_dbusAvailable) return;

#ifdef HAVE_XCB
    // Replies read during the last poll may have queued events on the
    // connection without waking the socket notifier — drain them here too.
    processXcbEvents();
#endif

    // Idle desktop: X reported no window activity and no tracked window
    // still carries velocity that needs decaying. Skip entirely — zero
    // round trips, zero allocations.
    if (!m_windowsDirty && !m_hadMotion) return;
    m_windowsDirty = false;

    qint64 now = QDateTime::currentMSecsSinceEpoch();
    // Clamp dt: after an idle stretch (skipped polls) the previous
    // timestamp is old, and dividing the first movement delta by minutes
    // yields ~zero velocity — which suppresses the wake for one poll.
    // Movement that woke us happened within the last couple of intervals.
    qreal dt = qMin((now - m_lastPollTime) / 1000.0, m_pollInterval * 2 / 1000.0);
    m_lastPollTime = now;

    const QVector<WindowInfo> before = m_windows;
    updateWindowList();
    calculateVelocities(dt);

    // Only notify when something actually changed. The QML side rebuilds
    // three QVariantLists on every windowsChanged; emitting at the full
    // poll rate on an idle desktop churns JS garbage for nothing (and the
    // resulting GC pauses read as periodic frame hitches).
    bool changed = before.size() != m_windows.size();
    if (!changed) {
        for (int i = 0; i < m_windows.size(); ++i) {
            if (before[i].id != m_windows[i].id
                || before[i].geometry != m_windows[i].geometry
                || before[i].velocity != m_windows[i].velocity) {
                changed = true;
                break;
            }
        }
    }
    // Keep polling (without X events) until all velocities have decayed
    // to zero, so a window that just stopped still gets its final
    // zero-velocity update.
    m_hadMotion = false;
    for (const auto &win : m_windows) {
        if (!win.velocity.isNull()) {
            m_hadMotion = true;
            break;
        }
    }

    if (changed) {
        Q_EMIT windowsChanged();
    }
}

void WindowTracker::updateWindowList()
{
    updateWindowListFromSystem();
}

#ifdef HAVE_XCB
// Check an already-fetched atom-list property for a specific atom.
static bool propertyHasAtom(xcb_get_property_reply_t *reply, xcb_atom_t target)
{
    if (!reply || reply->type != XCB_ATOM_ATOM) return false;
    int count = xcb_get_property_value_length(reply) / sizeof(xcb_atom_t);
    xcb_atom_t *atoms = (xcb_atom_t *)xcb_get_property_value(reply);
    for (int i = 0; i < count; i++) {
        if (atoms[i] == target) return true;
    }
    return false;
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

// Check window type from an already-fetched _NET_WM_WINDOW_TYPE property.
static bool isNormalWindowType(xcb_get_property_reply_t *reply,
                               xcb_atom_t typeNormal, xcb_atom_t typeDialog,
                               xcb_atom_t typeDesktop, xcb_atom_t typeDock, xcb_atom_t typeSplash,
                               xcb_atom_t typeToolbar, xcb_atom_t typeMenu, xcb_atom_t typeUtility)
{
    if (!reply || reply->type != XCB_ATOM_ATOM) {
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
    qreal screenWidth = screen->width_in_pixels;
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

    // XCB is asynchronous by design: issue every request for every window
    // up front, flush once, then collect the replies. Total stall on the
    // GUI thread is ~one X round trip instead of five per window (the old
    // serial version blocked up to ~1000 times/second with 10 windows).
    struct Probe {
        xcb_window_t win;
        xcb_get_window_attributes_cookie_t attr;
        xcb_get_property_cookie_t state;
        xcb_get_property_cookie_t type;
        xcb_get_geometry_cookie_t geom;
        xcb_translate_coordinates_cookie_t trans;
    };
    QVector<Probe> probes;
    probes.reserve(windowList.size());
    for (xcb_window_t win : windowList) {
        Probe p;
        p.win   = win;
        p.attr  = xcb_get_window_attributes(conn, win);
        p.state = xcb_get_property(conn, 0, win, netWmState, XCB_ATOM_ATOM, 0, 32);
        p.type  = xcb_get_property(conn, 0, win, netWmWindowType, XCB_ATOM_ATOM, 0, 32);
        p.geom  = xcb_get_geometry(conn, win);
        p.trans = xcb_translate_coordinates(conn, win, root, 0, 0);
        probes.append(p);
    }
    xcb_flush(conn);

    for (const Probe &p : probes) {
        // Always collect every reply, even for windows we end up skipping —
        // unconsumed cookies leak in xcb.
        xcb_get_window_attributes_reply_t *attrs =
            xcb_get_window_attributes_reply(conn, p.attr, nullptr);
        xcb_get_property_reply_t *stateReply =
            xcb_get_property_reply(conn, p.state, nullptr);
        xcb_get_property_reply_t *typeReply =
            xcb_get_property_reply(conn, p.type, nullptr);
        xcb_get_geometry_reply_t *geomReply =
            xcb_get_geometry_reply(conn, p.geom, nullptr);
        xcb_translate_coordinates_reply_t *transReply =
            xcb_translate_coordinates_reply(conn, p.trans, nullptr);

        bool keep = m_windows.size() < MAX_WINDOWS
            // Visible (mapped)?
            && attrs && attrs->map_state == XCB_MAP_STATE_VIEWABLE
            // Not minimized?
            && !propertyHasAtom(stateReply, netWmStateHidden)
            // Skip desktop, dock, splash, toolbar, menu, utility.
            && isNormalWindowType(typeReply, typeNormal, typeDialog,
                                  typeDesktop, typeDock, typeSplash,
                                  typeToolbar, typeMenu, typeUtility)
            && geomReply;

        if (keep) {
            QRectF geom = transReply
                ? QRectF(transReply->dst_x, transReply->dst_y,
                         geomReply->width, geomReply->height)
                : QRectF(geomReply->x, geomReply->y,
                         geomReply->width, geomReply->height);

            // Skip tiny/thin windows (toolbars, popups, panels, etc.) and
            // windows that cover the whole screen (likely desktop/wallpaper).
            if (geom.width() >= 150 && geom.height() >= 150
                && !(geom.width() >= screenWidth * 0.95
                     && geom.height() >= screenHeight * 0.95)) {
                // Store global desktop geometry (Y=0 at top); map to shader
                // space in windowRectsFlat().
                WindowInfo info;
                info.id = QString::number(p.win, 16);
                info.geometry = geom;
                info.prevGeometry = prevPositions.value(info.id, geom);
                info.isVisible = true;
                m_windows.append(info);
            }
        }

        free(attrs);
        free(stateReply);
        free(typeReply);
        free(geomReply);
        free(transReply);
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
