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
bool WindowTracker::initXcb()
{
    xcb_connection_t *conn = xcb_connect(nullptr, nullptr);
    if (!conn || xcb_connection_has_error(conn)) {
        if (!m_connectFailureLogged) {
            qWarning() << "WindowTracker: Failed to connect to X server";
            m_connectFailureLogged = true;
        }
        if (conn) xcb_disconnect(conn);
        m_xcbConnection = nullptr;
        if (m_dbusAvailable) {
            m_dbusAvailable = false;
            Q_EMIT availableChanged();
        }
        return false;
    }

    m_xcbConnection = conn;
    m_connectFailureLogged = false;
    m_atomCache.clear();
    m_watchedClients.clear();
    m_windowsDirty = true;
    if (!m_dbusAvailable) {
        m_dbusAvailable = true;
        Q_EMIT availableChanged();
    }

    // Subscribe to top-level window activity on the root window. This is
    // notification only (SubstructureNotify, not Redirect) so it can't
    // conflict with the window manager. It lets pollWindows() skip all X
    // traffic while the desktop is idle instead of re-querying every
    // window 20 times a second. PropertyChange delivers
    // _NET_SHOWING_DESKTOP and _NET_CLIENT_LIST updates: Show Desktop hides
    // windows without unmapping their frames.
    const xcb_setup_t *setup = xcb_get_setup(conn);
    xcb_screen_t *screen = xcb_setup_roots_iterator(setup).data;
    if (screen) {
        const uint32_t mask = XCB_EVENT_MASK_SUBSTRUCTURE_NOTIFY | XCB_EVENT_MASK_PROPERTY_CHANGE;
        xcb_change_window_attributes(conn, screen->root, XCB_CW_EVENT_MASK, &mask);
        xcb_flush(conn);
    }

    m_xcbNotifier = new QSocketNotifier(xcb_get_file_descriptor(conn),
                                        QSocketNotifier::Read, this);
    connect(m_xcbNotifier, &QSocketNotifier::activated,
            this, [this]() { processXcbEvents(); });

    qDebug() << "WindowTracker: Connected to X server via XCB (event-driven)";
    return true;
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
        // A broken connection keeps the socket readable: the notifier stays
        // off until ensureXcbConnection() replaces the connection.
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
        case XCB_PROPERTY_NOTIFY: {
            const auto *pn = reinterpret_cast<xcb_property_notify_event_t *>(ev);
            // Atoms are interned by updateWindowListFromSystem(); before the
            // first poll the cache is empty and every change counts.
            const uint32_t showing = m_atomCache.value("_NET_SHOWING_DESKTOP", XCB_ATOM_NONE);
            const uint32_t clients = m_atomCache.value("_NET_CLIENT_LIST", XCB_ATOM_NONE);
            const uint32_t state = m_atomCache.value("_NET_WM_STATE", XCB_ATOM_NONE);
            const uint32_t desktop = m_atomCache.value("_NET_CURRENT_DESKTOP", XCB_ATOM_NONE);
            if (showing == XCB_ATOM_NONE || pn->atom == showing || pn->atom == clients
                || pn->atom == state || pn->atom == desktop) {
                m_windowsDirty = true;
            }
            break;
        }
        default:
            break;
        }
        free(ev);
    }
}

bool WindowTracker::ensureXcbConnection()
{
    xcb_connection_t *conn = static_cast<xcb_connection_t*>(m_xcbConnection);
    if (conn && !xcb_connection_has_error(conn)) {
        return true;
    }

    // Exponential backoff, 1 s to 30 s: xcb_connect blocks for the X
    // handshake, and without an X server every attempt fails.
    if (m_reconnectTimer.isValid() && m_reconnectTimer.elapsed() < m_reconnectDelayMs) {
        return false;
    }
    if (conn) {
        qWarning() << "WindowTracker: X connection error, reconnecting";
        if (!m_windows.isEmpty()) {
            m_windows.clear();
            m_hadMotion = false;
            Q_EMIT windowsChanged();
        }
    }
    cleanupXcb();
    if (initXcb()) {
        m_reconnectTimer.invalidate();
        m_reconnectDelayMs = 0;
        return true;
    }
    m_reconnectDelayMs = m_reconnectDelayMs == 0 ? 1000 : qMin(m_reconnectDelayMs * 2, 30000);
    m_reconnectTimer.restart();
    return false;
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
#ifdef HAVE_XCB
    if (!ensureXcbConnection()) return;

    // Replies read during the last poll may have queued events on the
    // connection without waking the socket notifier — drain them here too.
    processXcbEvents();
#else
    if (!m_dbusAvailable) return;
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

// Four CARDINALs (left, right, top, bottom) from an already-fetched
// _NET_FRAME_EXTENTS or _GTK_FRAME_EXTENTS reply; false when absent.
static bool frameExtents(xcb_get_property_reply_t *reply, uint32_t out[4])
{
    if (!reply || reply->type != XCB_ATOM_CARDINAL || xcb_get_property_value_length(reply) < 16) return false;
    const uint32_t *v = static_cast<const uint32_t *>(xcb_get_property_value(reply));
    for (int i = 0; i < 4; i++) out[i] = v[i];
    return true;
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
    
    // A connection that broke mid-poll is replaced on the next poll.
    if (xcb_connection_has_error(conn)) {
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
    
    QMap<QByteArray, xcb_atom_t> &atomCache = m_atomCache;
    
    xcb_atom_t netClientList = getAtom(conn, "_NET_CLIENT_LIST", atomCache);
    xcb_atom_t netWmState = getAtom(conn, "_NET_WM_STATE", atomCache);
    xcb_atom_t netWmStateHidden = getAtom(conn, "_NET_WM_STATE_HIDDEN", atomCache);
    xcb_atom_t netShowingDesktop = getAtom(conn, "_NET_SHOWING_DESKTOP", atomCache);
    getAtom(conn, "_NET_CURRENT_DESKTOP", atomCache);
    
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
    xcb_atom_t netFrameExtents = getAtom(conn, "_NET_FRAME_EXTENTS", atomCache);
    xcb_atom_t gtkFrameExtents = getAtom(conn, "_GTK_FRAME_EXTENTS", atomCache);
    
    // Show Desktop (_NET_SHOWING_DESKTOP = 1) hides every client without
    // unmapping it or setting _NET_WM_STATE_HIDDEN: no window is visible.
    bool showingDesktop = false;
    {
        xcb_get_property_cookie_t cookie =
            xcb_get_property(conn, 0, root, netShowingDesktop, XCB_ATOM_CARDINAL, 0, 1);
        xcb_get_property_reply_t *reply = xcb_get_property_reply(conn, cookie, nullptr);
        if (reply && reply->type == XCB_ATOM_CARDINAL && xcb_get_property_value_length(reply) >= 4) {
            showingDesktop = *static_cast<uint32_t *>(xcb_get_property_value(reply)) != 0;
        }
        free(reply);
    }

    QVector<xcb_window_t> windowList = showingDesktop
        ? QVector<xcb_window_t>()
        : getWindowList(conn, root, netClientList);

    // PropertyNotify on each client for _NET_WM_STATE changes (minimize,
    // hidden) that arrive without an unmap. The mask is per connection, so
    // selecting it does not disturb the client's own event mask.
    bool selected = false;
    for (xcb_window_t win : std::as_const(windowList)) {
        if (!m_watchedClients.contains(win)) {
            const uint32_t mask = XCB_EVENT_MASK_PROPERTY_CHANGE;
            xcb_change_window_attributes(conn, win, XCB_CW_EVENT_MASK, &mask);
            m_watchedClients.insert(win);
            selected = true;
        }
    }
    if (!showingDesktop && m_watchedClients.size() > windowList.size() * 2 + 32) {
        const QSet<uint32_t> live(windowList.cbegin(), windowList.cend());
        m_watchedClients.intersect(live);
    }
    if (selected) {
        xcb_flush(conn);
    }

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
        xcb_get_property_cookie_t frame;
        xcb_get_property_cookie_t gtkFrame;
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
        p.frame = xcb_get_property(conn, 0, win, netFrameExtents, XCB_ATOM_CARDINAL, 0, 4);
        p.gtkFrame = xcb_get_property(conn, 0, win, gtkFrameExtents, XCB_ATOM_CARDINAL, 0, 4);
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
        xcb_get_property_reply_t *frameReply =
            xcb_get_property_reply(conn, p.frame, nullptr);
        xcb_get_property_reply_t *gtkFrameReply =
            xcb_get_property_reply(conn, p.gtkFrame, nullptr);

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

            // Rects cover the visible window: the client area grows by the
            // server-side decoration (_NET_FRAME_EXTENTS) and shrinks by the
            // invisible shadow margin of client-side decorations
            // (_GTK_FRAME_EXTENTS). Order in both is left, right, top, bottom.
            uint32_t ext[4];
            if (frameExtents(frameReply, ext)) {
                geom.adjust(-qreal(ext[0]), -qreal(ext[2]), qreal(ext[1]), qreal(ext[3]));
            }
            if (frameExtents(gtkFrameReply, ext)
                && ext[0] + ext[1] < geom.width() && ext[2] + ext[3] < geom.height()) {
                geom.adjust(qreal(ext[0]), qreal(ext[2]), -qreal(ext[1]), -qreal(ext[3]));
            }

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
        free(frameReply);
        free(gtkFrameReply);
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
