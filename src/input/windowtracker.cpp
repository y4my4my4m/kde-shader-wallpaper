#include "windowtracker.h"
#include <algorithm>
#include <QDateTime>
#include <QGuiApplication>
#include <QScreen>
#include <QSocketNotifier>
#include <QVarLengthArray>
#include <QDebug>

#ifdef HAVE_XCB
#include <xcb/xcb.h>
#endif

#ifdef HAVE_TASKMANAGER
#include <KWindowSystem>
#include <abstracttasksmodel.h>
#include <activityinfo.h>
#include <virtualdesktopinfo.h>
#include <windowtasksmodel.h>
#endif

WindowTracker::WindowTracker(QObject *parent)
    : QObject(parent)
    , m_pollTimer(new QTimer(this))
{
    // Coarse (default) timers have ±5% slack — at render-rate intervals the
    // resulting cadence jitter is visible as uneven window-motion updates.
    m_pollTimer->setTimerType(Qt::PreciseTimer);
    connect(m_pollTimer, &QTimer::timeout, this, &WindowTracker::pollTick);
    connect(this, &WindowTracker::windowsChanged, this, [this]() { ++m_changeSerial; });
#ifdef HAVE_TASKMANAGER
    // A Wayland client sees no other client's windows; over XWayland only
    // X11 clients. KWin grants plasmashell Plasma's window list.
    if (KWindowSystem::isPlatformWayland()) {
        m_logicalGeometry = true;
        m_dbusAvailable = true;
        return;
    }
#endif
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
    m_clients.clear();
    m_clientsValid = false;
    m_watchedAtoms.fill(XCB_ATOM_NONE);
    m_windowsDirty = true;
    m_listDirty = true;
    if (!m_dbusAvailable) {
        m_dbusAvailable = true;
        Q_EMIT availableChanged();
    }

    // Subscribe to top-level window activity on the root window. This is
    // notification only (SubstructureNotify, not Redirect) so it can't
    // conflict with the window manager. Polls run only after X reports
    // activity. PropertyChange delivers _NET_SHOWING_DESKTOP and
    // _NET_CLIENT_LIST updates: Show Desktop hides windows without
    // unmapping their frames.
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
            this, [this]() { onXcbReadable(); });
    m_xcbNotifier->setEnabled(!m_pollTimer->isActive());

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
        case XCB_CONFIGURE_NOTIFY:
            m_windowsDirty = true;
            break;
        case XCB_CREATE_NOTIFY:
        case XCB_DESTROY_NOTIFY:
        case XCB_MAP_NOTIFY:
        case XCB_UNMAP_NOTIFY:
        case XCB_REPARENT_NOTIFY:
            m_listDirty = true;
            break;
        case XCB_PROPERTY_NOTIFY: {
            // Atoms are interned by the first full poll; before it every
            // property change counts.
            const auto *pn = reinterpret_cast<xcb_property_notify_event_t *>(ev);
            bool relevant = m_watchedAtoms[0] == XCB_ATOM_NONE;
            for (uint32_t atom : m_watchedAtoms) {
                relevant = relevant || pn->atom == atom;
            }
            if (relevant) {
                m_listDirty = true;
            }
            break;
        }
        default:
            break;
        }
        free(ev);
    }
}

void WindowTracker::onXcbReadable()
{
    processXcbEvents();
    if (!m_enabled || m_pollTimer->isActive()) return;
    if (!xcbHealthy()) {
        // Reconnect attempts run on the poll timer.
        setPolling(true);
        return;
    }
    if (m_windowsDirty || m_listDirty) {
        // First poll at once, the rest paced by the timer.
        setPolling(true);
        pollWindows();
    }
}

bool WindowTracker::xcbHealthy() const
{
    xcb_connection_t *conn = static_cast<xcb_connection_t*>(m_xcbConnection);
    return conn && !xcb_connection_has_error(conn);
}
#endif

// While the timer runs, each tick drains the X queue and the socket
// notifier is off: during a drag the WM emits one ConfigureNotify per
// pointer event, which would otherwise wake this thread at the pointer's
// report rate on top of the polls.
void WindowTracker::setPolling(bool on)
{
    if (on) {
        if (!m_pollTimer->isActive()) {
            m_pollTimer->start(m_pollInterval);
        }
    } else {
        m_pollTimer->stop();
    }
#ifdef HAVE_XCB
    if (m_xcbNotifier && xcbHealthy()) {
        m_xcbNotifier->setEnabled(!on);
    }
#endif
}
#ifdef HAVE_XCB

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

#ifdef HAVE_TASKMANAGER
void WindowTracker::createTasks()
{
    if (m_tasks) return;
    using TaskManager::AbstractTasksModel;
    m_tasks = new TaskManager::WindowTasksModel(this);
    m_desktopInfo = new TaskManager::VirtualDesktopInfo(this);
    m_activityInfo = new TaskManager::ActivityInfo(this);

    // Roles that can change the tracked set or a rect. StackingOrder
    // (every raise), IsActive, titles and icons cannot.
    connect(m_tasks, &QAbstractItemModel::dataChanged, this,
            [this](const QModelIndex &, const QModelIndex &, const QList<int> &roles) {
        static const QList<int> tracked = {
            AbstractTasksModel::Geometry,
            AbstractTasksModel::ScreenGeometry,
            AbstractTasksModel::IsMinimized,
            AbstractTasksModel::IsShaded,
            AbstractTasksModel::VirtualDesktops,
            AbstractTasksModel::IsOnAllVirtualDesktops,
            AbstractTasksModel::Activities,
        };
        if (roles.isEmpty()
            || std::any_of(roles.cbegin(), roles.cend(), [](int role) { return tracked.contains(role); })) {
            onTasksChanged();
        }
    });
    connect(m_tasks, &QAbstractItemModel::rowsInserted, this, &WindowTracker::onTasksChanged);
    connect(m_tasks, &QAbstractItemModel::rowsRemoved, this, &WindowTracker::onTasksChanged);
    connect(m_tasks, &QAbstractItemModel::rowsMoved, this, &WindowTracker::onTasksChanged);
    connect(m_tasks, &QAbstractItemModel::modelReset, this, &WindowTracker::onTasksChanged);
    connect(m_tasks, &QAbstractItemModel::layoutChanged, this, &WindowTracker::onTasksChanged);
    connect(m_desktopInfo, &TaskManager::VirtualDesktopInfo::currentDesktopChanged,
            this, &WindowTracker::onTasksChanged);
#ifdef HAVE_TASKMANAGER_SCREEN_DESKTOPS
    connect(m_desktopInfo, &TaskManager::VirtualDesktopInfo::currentDesktopForScreenChanged,
            this, &WindowTracker::onTasksChanged);
#endif
    connect(m_activityInfo, &TaskManager::ActivityInfo::currentActivityChanged,
            this, &WindowTracker::onTasksChanged);
    connect(KWindowSystem::self(), &KWindowSystem::showingDesktopChanged,
            this, &WindowTracker::onTasksChanged);
    qDebug() << "WindowTracker: Using Plasma's window list (Wayland)";
}

void WindowTracker::destroyTasks()
{
    if (!m_tasks) return;
    disconnect(KWindowSystem::self(), nullptr, this, nullptr);
    // Deferred: the model may be inside one of its own signal emissions.
    for (QObject *object : std::initializer_list<QObject *>{m_tasks, m_desktopInfo, m_activityInfo}) {
        disconnect(object, nullptr, this, nullptr);
        object->deleteLater();
    }
    m_tasks = nullptr;
    m_desktopInfo = nullptr;
    m_activityInfo = nullptr;
}

// Mirrors onXcbReadable(): changes only flag work while the timer runs.
void WindowTracker::onTasksChanged()
{
    m_listDirty = true;
    if (!m_enabled || m_pollTimer->isActive()) return;
    // First poll at once, the rest paced by the timer.
    setPolling(true);
    pollWindows();
}
#endif

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
#ifdef HAVE_TASKMANAGER
        if (m_logicalGeometry) {
            createTasks();
        }
#endif
        m_lastPollTime = QDateTime::currentMSecsSinceEpoch();
        // Window activity while disabled went unrecorded.
        m_listDirty = true;
        setPolling(true);
        pollWindows();  // Initial poll
    } else {
        qDebug() << "WindowTracker: Disabled";
        setPolling(false);
#ifdef HAVE_TASKMANAGER
        destroyTasks();
#endif
        m_windows.clear();
        m_hadMotion = false;
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
    // Window geometry: global desktop coords, Y=0 at top; device pixels on
    // X11, logical pixels on Wayland.
    // Shader fragCoord / iMouse: this wallpaper's FBO, Y=0 at bottom, device pixels.
    const qreal dpr = m_devicePixelRatio > 0.0 ? m_devicePixelRatio : 1.0;
    const qreal refH = (m_referenceHeight > 0.0 ? m_referenceHeight : 1080.0) * dpr;
    const qreal originX = m_screenVirtualX * dpr;
    const qreal originY = m_screenVirtualY * dpr;
    const qreal scale = m_logicalGeometry ? dpr : 1.0;
    const QRectF global(globalTopLeft.topLeft() * scale, globalTopLeft.size() * scale);

    const qreal localX = global.x() - originX;
    const qreal localY = refH - (global.y() - originY) - global.height();

    return QRectF(localX, localY, global.width(), global.height());
}

// Velocity: device pixels per second, global Y=0 at top.
QPointF WindowTracker::mapVelocityToShader(const QPointF &velocity) const
{
    if (!m_logicalGeometry) return velocity;
    return velocity * (m_devicePixelRatio > 0.0 ? m_devicePixelRatio : 1.0);
}

void WindowTracker::refresh()
{
    if (m_enabled) {
        m_listDirty = true; // forced refresh bypasses the idle skip
        pollWindows();
    }
}

void WindowTracker::pollTick()
{
#ifdef HAVE_TASKMANAGER
    if (m_tasks) {
        if (!m_listDirty && !m_hadMotion) {
            // Idle: the next model change restarts the timer.
            setPolling(false);
            return;
        }
        pollWindows();
        return;
    }
#endif
#ifdef HAVE_XCB
    if (xcbHealthy()) {
        processXcbEvents();
        if (!m_windowsDirty && !m_listDirty && !m_hadMotion) {
            // Idle: the socket notifier restarts the timer on X activity.
            setPolling(false);
            return;
        }
    }
    pollWindows();
#else
    setPolling(false);
#endif
}

// Seconds since the previous poll.
qreal WindowTracker::pollDelta()
{
    qint64 now = QDateTime::currentMSecsSinceEpoch();
    // Clamp dt: after an idle stretch (skipped polls) the previous
    // timestamp is old, and dividing the first movement delta by minutes
    // yields ~zero velocity — which suppresses the wake for one poll.
    // Movement that woke us happened within the last couple of intervals.
    qreal dt = qMin((now - m_lastPollTime) / 1000.0, m_pollInterval * 2 / 1000.0);
    m_lastPollTime = now;
    return dt;
}

// Velocities of m_windows against the same windows in `before`. True when
// the list, a rect or a velocity changed. Sets m_hadMotion.
bool WindowTracker::updateMotion(const QList<WindowInfo> &before, qreal dt)
{
    for (WindowInfo &win : m_windows) {
        win.prevGeometry = win.geometry;
        for (const WindowInfo &old : before) {
            if (old.id == win.id) {
                win.prevGeometry = old.geometry;
                break;
            }
        }
    }
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
    // Keep polling (without window events) until all velocities have decayed
    // to zero, so a window that just stopped still gets its final
    // zero-velocity update.
    m_hadMotion = false;
    for (const auto &win : m_windows) {
        if (!win.velocity.isNull()) {
            m_hadMotion = true;
            break;
        }
    }
    return changed;
}

void WindowTracker::pollWindows()
{
#ifdef HAVE_TASKMANAGER
    if (m_tasks) {
        if (!m_listDirty && !m_hadMotion) return;
        m_listDirty = false;
        const qreal dt = pollDelta();
        const QList<WindowInfo> before = m_windows;
        queryTasks();
        const bool changed = updateMotion(before, dt);
        if (m_enabled && !m_pollTimer->isActive() && m_hadMotion) {
            setPolling(true);
        }
        if (changed) {
            Q_EMIT windowsChanged();
        }
        return;
    }
#endif
#ifdef HAVE_XCB
    if (!ensureXcbConnection()) return;

    // Replies read during the last poll may have queued events on the
    // connection without waking the socket notifier — drain them here too.
    processXcbEvents();

    // Idle desktop: X reported no window activity and no tracked window
    // still carries velocity that needs decaying. Skip entirely — zero
    // round trips, zero allocations.
    if (!m_windowsDirty && !m_listDirty && !m_hadMotion) return;
    // Motion decay without X activity re-reads geometry only.
    const bool full = m_listDirty || !m_clientsValid;
    m_windowsDirty = false;
    m_listDirty = false;

    const qreal dt = pollDelta();

    const QList<WindowInfo> before = m_windows;
    if (!(full ? queryClients() : queryGeometry())) {
        // A vanished window or a broken connection: next poll starts over.
        m_listDirty = true;
    }
    const bool changed = updateMotion(before, dt);

    // Events that arrived with the replies.
    processXcbEvents();
    if (m_enabled && !m_pollTimer->isActive()
        && (m_windowsDirty || m_listDirty || m_hadMotion || !xcbHealthy())) {
        setPolling(true);
    }

    if (changed) {
        Q_EMIT windowsChanged();
    }
#endif
}

// Skip tiny/thin windows (toolbars, popups, panels, etc.) and windows that
// cover the whole screen (likely desktop/wallpaper).
[[maybe_unused]] static bool trackedSize(const QRectF &geom, qreal screenWidth, qreal screenHeight)
{
    return geom.width() >= 150 && geom.height() >= 150
        && !(geom.width() >= screenWidth * 0.95 && geom.height() >= screenHeight * 0.95);
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
// _NET_FRAME_EXTENTS or _GTK_FRAME_EXTENTS reply; zeros when absent.
static void frameExtents(xcb_get_property_reply_t *reply, uint32_t out[4])
{
    for (int i = 0; i < 4; i++) out[i] = 0;
    if (!reply || reply->type != XCB_ATOM_CARDINAL || xcb_get_property_value_length(reply) < 16) return;
    const uint32_t *v = static_cast<const uint32_t *>(xcb_get_property_value(reply));
    for (int i = 0; i < 4; i++) out[i] = v[i];
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

// Visible rect of a client in global desktop coordinates (Y=0 at top):
// the client area grows by the server-side decoration (_NET_FRAME_EXTENTS)
// and shrinks by the invisible shadow margin of client-side decorations
// (_GTK_FRAME_EXTENTS). Order in both is left, right, top, bottom.
static QRectF clientRect(const xcb_get_geometry_reply_t *geomReply,
                         const xcb_translate_coordinates_reply_t *transReply,
                         const uint32_t frame[4], const uint32_t gtkFrame[4])
{
    QRectF geom = transReply
        ? QRectF(transReply->dst_x, transReply->dst_y, geomReply->width, geomReply->height)
        : QRectF(geomReply->x, geomReply->y, geomReply->width, geomReply->height);
    geom.adjust(-qreal(frame[0]), -qreal(frame[2]), qreal(frame[1]), qreal(frame[3]));
    if (gtkFrame[0] + gtkFrame[1] < geom.width() && gtkFrame[2] + gtkFrame[3] < geom.height()) {
        geom.adjust(qreal(gtkFrame[0]), qreal(gtkFrame[2]), -qreal(gtkFrame[1]), -qreal(gtkFrame[3]));
    }
    return geom;
}
#endif

#ifdef HAVE_XCB
// Full poll: client list, attributes and geometry of every client. Fills
// m_clients for later geometry-only polls. False when the connection broke.
bool WindowTracker::queryClients()
{
    xcb_connection_t *conn = static_cast<xcb_connection_t*>(m_xcbConnection);
    m_windows.clear();
    m_clientsValid = false;
    if (!conn || xcb_connection_has_error(conn)) return false;
    
    const xcb_setup_t *setup = xcb_get_setup(conn);
    xcb_screen_t *screen = xcb_setup_roots_iterator(setup).data;
    if (!screen) return false;
    
    xcb_window_t root = screen->root;
    const qreal screenWidth = screen->width_in_pixels;
    const qreal screenHeight = screen->height_in_pixels;
    
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
    m_watchedAtoms = {netShowingDesktop, netClientList, netWmState,
                      atomCache.value("_NET_CURRENT_DESKTOP", XCB_ATOM_NONE),
                      netWmWindowType, netFrameExtents, gtkFrameExtents};
    
    // Show Desktop (_NET_SHOWING_DESKTOP = 1) hides every client without
    // unmapping it or setting _NET_WM_STATE_HIDDEN: no window is visible.
    // Both root properties in one round trip.
    xcb_get_property_cookie_t showingCookie =
        xcb_get_property(conn, 0, root, netShowingDesktop, XCB_ATOM_CARDINAL, 0, 1);
    xcb_get_property_cookie_t listCookie =
        xcb_get_property(conn, 0, root, netClientList, XCB_ATOM_WINDOW, 0, 1024);
    bool showingDesktop = false;
    if (xcb_get_property_reply_t *reply = xcb_get_property_reply(conn, showingCookie, nullptr)) {
        if (reply->type == XCB_ATOM_CARDINAL && xcb_get_property_value_length(reply) >= 4) {
            showingDesktop = *static_cast<uint32_t *>(xcb_get_property_value(reply)) != 0;
        }
        free(reply);
    }
    QVector<xcb_window_t> windowList;
    if (xcb_get_property_reply_t *reply = xcb_get_property_reply(conn, listCookie, nullptr)) {
        if (!showingDesktop && reply->type == XCB_ATOM_WINDOW) {
            const int count = xcb_get_property_value_length(reply) / sizeof(xcb_window_t);
            const xcb_window_t *data = static_cast<const xcb_window_t *>(xcb_get_property_value(reply));
            windowList.assign(data, data + count);
        }
        free(reply);
    }

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

    m_clients.clear();
    m_clients.reserve(probes.size());
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

        ClientInfo client;
        client.win = p.win;
        client.candidate =
            // Visible (mapped)?
            attrs && attrs->map_state == XCB_MAP_STATE_VIEWABLE
            // Not minimized?
            && !propertyHasAtom(stateReply, netWmStateHidden)
            // Skip desktop, dock, splash, toolbar, menu, utility.
            && isNormalWindowType(typeReply, typeNormal, typeDialog,
                                  typeDesktop, typeDock, typeSplash,
                                  typeToolbar, typeMenu, typeUtility);
        frameExtents(frameReply, client.frame);
        frameExtents(gtkFrameReply, client.gtkFrame);
        m_clients.append(client);

        if (client.candidate && geomReply && m_windows.size() < MAX_WINDOWS) {
            const QRectF geom = clientRect(geomReply, transReply, client.frame, client.gtkFrame);
            if (trackedSize(geom, screenWidth, screenHeight)) {
                // Store global desktop geometry (Y=0 at top); map to shader
                // space in windowRectsFlat().
                WindowInfo info;
                info.id = p.win;
                info.geometry = geom;
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
    m_clientsValid = !xcb_connection_has_error(conn);
    
    // Only log when the set of tracked windows actually changes — the
    // previous "every 100 frames" throttle still spammed ~30 lines/sec
    // when the user had ≥8 windows open, which flooded the journal.
    static int lastReportedCount = -1;
    if (m_windows.size() != lastReportedCount) {
        lastReportedCount = m_windows.size();
        qDebug() << "WindowTracker: now tracking" << m_windows.size()
                 << "windows (out of" << windowList.size() << "total)";
    }
    return m_clientsValid;
}

// Geometry-only poll: position and size of the cached candidates, two
// requests each, one round trip. Attributes, the client list and Show
// Desktop are unchanged, or a full poll would have been flagged. False when
// a window vanished or the connection broke.
bool WindowTracker::queryGeometry()
{
    xcb_connection_t *conn = static_cast<xcb_connection_t*>(m_xcbConnection);
    m_windows.clear();
    if (!conn || xcb_connection_has_error(conn)) return false;
    xcb_screen_t *screen = xcb_setup_roots_iterator(xcb_get_setup(conn)).data;
    if (!screen) return false;
    const qreal screenWidth = screen->width_in_pixels;
    const qreal screenHeight = screen->height_in_pixels;

    struct Probe {
        int client;
        xcb_get_geometry_cookie_t geom;
        xcb_translate_coordinates_cookie_t trans;
    };
    QVarLengthArray<Probe, 32> probes;
    for (int i = 0; i < m_clients.size(); ++i) {
        const xcb_window_t win = m_clients[i].win;
        if (m_clients[i].candidate) {
            probes.append({i, xcb_get_geometry(conn, win), xcb_translate_coordinates(conn, win, screen->root, 0, 0)});
        }
    }
    xcb_flush(conn);

    bool complete = true;
    for (const Probe &p : probes) {
        xcb_get_geometry_reply_t *geomReply = xcb_get_geometry_reply(conn, p.geom, nullptr);
        xcb_translate_coordinates_reply_t *transReply =
            xcb_translate_coordinates_reply(conn, p.trans, nullptr);
        const ClientInfo &client = m_clients[p.client];
        if (!geomReply) {
            complete = false;
        } else if (m_windows.size() < MAX_WINDOWS) {
            const QRectF geom = clientRect(geomReply, transReply, client.frame, client.gtkFrame);
            if (trackedSize(geom, screenWidth, screenHeight)) {
                WindowInfo info;
                info.id = client.win;
                info.geometry = geom;
                info.isVisible = true;
                m_windows.append(info);
            }
        }
        free(geomReply);
        free(transReply);
    }
    return complete && !xcb_connection_has_error(conn);
}
#endif

#ifdef HAVE_TASKMANAGER
// Wayland counterpart of queryClients(): the same windows the X11 path
// counts, in the same order. KWin's frame geometry is the visible frame,
// shadows excluded, in logical pixels.
void WindowTracker::queryTasks()
{
    using TaskManager::AbstractTasksModel;
    m_windows.clear();
    // Show Desktop hides every window without minimizing it.
    if (KWindowSystem::showingDesktop()) return;

    // Size filter against the bounding box of all outputs, as the X root
    // window spans them.
    const QScreen *primary = QGuiApplication::primaryScreen();
    const QRect desktop = primary ? primary->virtualGeometry() : QRect();
    const QVariant currentDesktop = m_desktopInfo->currentDesktop();
    const QString currentActivity = m_activityInfo->currentActivity();
    static const QString allActivities = QStringLiteral("00000000-0000-0000-0000-000000000000");

    const int rows = m_tasks->rowCount();
    for (int row = 0; row < rows && m_windows.size() < MAX_WINDOWS; ++row) {
        const QModelIndex idx = m_tasks->index(row, 0);
        // A shaded window's client area is unmapped on X11.
        if (idx.data(AbstractTasksModel::IsMinimized).toBool()
            || idx.data(AbstractTasksModel::IsShaded).toBool()) {
            continue;
        }
        // No desktops: on all of them.
        const QVariantList desktops = idx.data(AbstractTasksModel::VirtualDesktops).toList();
        if (!desktops.isEmpty() && !currentDesktop.toString().isEmpty()) {
            QVariant shown = currentDesktop;
#ifdef HAVE_TASKMANAGER_SCREEN_DESKTOPS
            const QRect screenGeometry = idx.data(AbstractTasksModel::ScreenGeometry).toRect();
            const QList<QScreen *> screens = QGuiApplication::screens();
            for (const QScreen *screen : screens) {
                if (screen->geometry() == screenGeometry) {
                    shown = m_desktopInfo->currentDesktopByScreenName(screen->name());
                    break;
                }
            }
#endif
            if (!desktops.contains(shown)) continue;
        }
        // No activities, or the null uuid: on all of them.
        const QStringList activities = idx.data(AbstractTasksModel::Activities).toStringList();
        if (!currentActivity.isEmpty() && !activities.isEmpty()
            && !activities.contains(allActivities) && !activities.contains(currentActivity)) {
            continue;
        }
        const QRectF geom = idx.data(AbstractTasksModel::Geometry).toRect();
        if (!trackedSize(geom, desktop.width(), desktop.height())) continue;

        WindowInfo info;
        // WinIdList on Wayland: the window's uuid.
        info.id = uint32_t(qHash(idx.data(AbstractTasksModel::WinIdList).toList().value(0).toString()));
        info.geometry = geom;
        info.isVisible = true;
        m_windows.append(info);
    }

    static int lastReportedCount = -1;
    if (m_windows.size() != lastReportedCount) {
        lastReportedCount = m_windows.size();
        qDebug() << "WindowTracker: now tracking" << m_windows.size()
                 << "windows (out of" << rows << "total)";
    }
}
#endif

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
        result.append(QVariant::fromValue(mapVelocityToShader(win.velocity)));
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

void WindowTracker::copyFlat(float rects[MAX_WINDOWS * 4], float velocities[MAX_WINDOWS * 2]) const
{
    for (int i = 0; i < MAX_WINDOWS; i++) {
        if (i < m_windows.size()) {
            const QRectF local = mapRectToShader(m_windows[i].geometry);
            rects[i * 4 + 0] = static_cast<float>(local.x());
            rects[i * 4 + 1] = static_cast<float>(local.y());
            rects[i * 4 + 2] = static_cast<float>(local.width());
            rects[i * 4 + 3] = static_cast<float>(local.height());
            const QPointF velocity = mapVelocityToShader(m_windows[i].velocity);
            velocities[i * 2 + 0] = static_cast<float>(velocity.x());
            velocities[i * 2 + 1] = static_cast<float>(velocity.y());
        } else {
            rects[i * 4 + 0] = rects[i * 4 + 1] = rects[i * 4 + 2] = rects[i * 4 + 3] = 0.0f;
            velocities[i * 2 + 0] = velocities[i * 2 + 1] = 0.0f;
        }
    }
}

QVariantList WindowTracker::windowVelocitiesFlat() const
{
    QVariantList result;
    
    for (int i = 0; i < MAX_WINDOWS; i++) {
        if (i < m_windows.size()) {
            const QPointF velocity = mapVelocityToShader(m_windows[i].velocity);
            result.append(static_cast<float>(velocity.x()));
            result.append(static_cast<float>(velocity.y()));
        } else {
            result.append(0.0f);
            result.append(0.0f);
        }
    }
    
    return result;
}
