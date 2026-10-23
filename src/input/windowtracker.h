#pragma once

#include <QObject>
#include <QElapsedTimer>
#include <QMap>
#include <QSet>
#include <QTimer>
#include <QRect>
#include <QVariantList>

#include <array>

class QAbstractItemModel;
class QSocketNotifier;

#ifdef HAVE_TASKMANAGER
namespace TaskManager
{
class ActivityInfo;
class VirtualDesktopInfo;
}
#endif

/**
 * @brief Tracks window geometries from KWin for shader interaction
 * 
 * X11: XCB events on the root window. Wayland: Plasma's window list
 * (libtaskmanager), which KWin grants to plasmashell.
 * Windows can be passed to shaders as uniform arrays, allowing
 * effects like ripples when windows move, particles bouncing off windows, etc.
 * 
 * Maximum 16 windows tracked (shader uniform array limit)
 */
class WindowTracker : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool enabled READ enabled WRITE setEnabled NOTIFY enabledChanged)
    Q_PROPERTY(int pollInterval READ pollInterval WRITE setPollInterval NOTIFY pollIntervalChanged)
    Q_PROPERTY(int windowCount READ windowCount NOTIFY windowsChanged)
    Q_PROPERTY(QVariantList windowRects READ windowRects NOTIFY windowsChanged)
    Q_PROPERTY(QVariantList windowVelocities READ windowVelocities NOTIFY windowsChanged)
    Q_PROPERTY(bool available READ available NOTIFY availableChanged)
    // Match CursorTracker / ShaderEngine FBO space (OpenGL Y, device pixels).
    Q_PROPERTY(qreal referenceWidth READ referenceWidth WRITE setReferenceWidth NOTIFY referenceSizeChanged)
    Q_PROPERTY(qreal referenceHeight READ referenceHeight WRITE setReferenceHeight NOTIFY referenceSizeChanged)
    Q_PROPERTY(qreal devicePixelRatio READ devicePixelRatio WRITE setDevicePixelRatio NOTIFY devicePixelRatioChanged)
    Q_PROPERTY(qreal screenVirtualX READ screenVirtualX WRITE setScreenVirtualX NOTIFY screenVirtualChanged)
    Q_PROPERTY(qreal screenVirtualY READ screenVirtualY WRITE setScreenVirtualY NOTIFY screenVirtualChanged)

public:
    explicit WindowTracker(QObject *parent = nullptr);
    ~WindowTracker() override;

    static constexpr int MAX_WINDOWS = 16;

    bool enabled() const { return m_enabled; }
    int pollInterval() const { return m_pollInterval; }
    int windowCount() const { return m_windows.size(); }
    bool available() const;
    qreal referenceWidth() const { return m_referenceWidth; }
    qreal referenceHeight() const { return m_referenceHeight; }
    qreal devicePixelRatio() const { return m_devicePixelRatio; }
    qreal screenVirtualX() const { return m_screenVirtualX; }
    qreal screenVirtualY() const { return m_screenVirtualY; }

    // Returns list of QRectF (x, y, width, height) for each window
    QVariantList windowRects() const;
    
    // Returns list of QPointF (vx, vy) velocities for each window
    QVariantList windowVelocities() const;
    
    // Flat arrays for shader uniforms (4 floats per window: x, y, w, h)
    Q_INVOKABLE QVariantList windowRectsFlat() const;
    // Velocity arrays (2 floats per window: vx, vy)
    Q_INVOKABLE QVariantList windowVelocitiesFlat() const;
    // windowRectsFlat() and windowVelocitiesFlat() without QVariant.
    void copyFlat(float rects[MAX_WINDOWS * 4], float velocities[MAX_WINDOWS * 2]) const;
    // Incremented on every windowsChanged.
    quint64 changeSerial() const { return m_changeSerial; }

public Q_SLOTS:
    void setEnabled(bool enabled);
    void setPollInterval(int ms);
    void refresh();  // Force immediate refresh
    void setReferenceWidth(qreal width);
    void setReferenceHeight(qreal height);
    void setDevicePixelRatio(qreal ratio);
    void setScreenVirtualX(qreal x);
    void setScreenVirtualY(qreal y);

Q_SIGNALS:
    void enabledChanged();
    void pollIntervalChanged();
    void windowsChanged();
    void referenceSizeChanged();
    void devicePixelRatioChanged();
    void screenVirtualChanged();
    void availableChanged();

private Q_SLOTS:
    void pollTick();

private:
    struct WindowInfo {
        uint32_t id = 0;  // X window id of the client; hash of the Plasma window uuid on Wayland
        QRectF geometry;
        QRectF prevGeometry;
        QPointF velocity;
        bool isVisible = true;
    };

    void pollWindows();
    void setPolling(bool on);
    qreal pollDelta();
    bool updateMotion(const QList<WindowInfo> &before, qreal dt);
    void calculateVelocities(qreal dt);
    QRectF mapRectToShader(const QRectF &globalTopLeft) const;
    QPointF mapVelocityToShader(const QPointF &velocity) const;

    bool m_enabled = false;
    int m_pollInterval = 50;  // 20 Hz default - fast enough for smooth effects
    // Runs only while a poll has work: X reported activity, a tracked window
    // still moves, or the X connection awaits a reconnect.
    QTimer *m_pollTimer = nullptr;

    QList<WindowInfo> m_windows;
    quint64 m_changeSerial = 0;

    qint64 m_lastPollTime = 0;
    bool m_dbusAvailable = false;

    qreal m_referenceWidth = 0.0;
    qreal m_referenceHeight = 0.0;
    qreal m_devicePixelRatio = 1.0;
    qreal m_screenVirtualX = 0.0;
    qreal m_screenVirtualY = 0.0;
    // Window geometry is in logical pixels (Wayland) rather than device
    // pixels (X11).
    bool m_logicalGeometry = false;

    // Event-driven gating: X notifies us when a top-level window is
    // created/destroyed/moved/mapped (SubstructureNotify on the root), when a
    // root property such as _NET_SHOWING_DESKTOP changes, and when a
    // client's state, type or frame extents change (PropertyChange).
    // ConfigureNotify alone sets m_windowsDirty: the next poll re-reads the
    // geometry of the cached candidates only. Everything else sets
    // m_listDirty: the client list and every client's attributes are re-read.
    bool m_windowsDirty = true;   // a top-level window was configured
    bool m_listDirty = true;      // windows, client list or attributes changed
    bool m_hadMotion = false;     // a tracked window still has nonzero velocity

#ifdef HAVE_TASKMANAGER
    // Wayland: Plasma's window list (org_kde_plasma_window_management), in
    // window creation order. Exists while enabled. Every change it reports
    // sets m_listDirty; polls read the model locally, without round trips.
    QAbstractItemModel *m_tasks = nullptr;
    TaskManager::VirtualDesktopInfo *m_desktopInfo = nullptr;
    TaskManager::ActivityInfo *m_activityInfo = nullptr;
    void createTasks();
    void destroyTasks();
    void onTasksChanged();
    void queryTasks();
#endif

#ifdef HAVE_XCB
    // A _NET_CLIENT_LIST entry as of the last full poll, in list order.
    // Candidates are viewable, not hidden and of a tracked type; extents
    // are 0 when the property is absent.
    struct ClientInfo {
        uint32_t win = 0;
        bool candidate = false;
        uint32_t frame[4] = {0, 0, 0, 0};    // _NET_FRAME_EXTENTS l, r, t, b
        uint32_t gtkFrame[4] = {0, 0, 0, 0}; // _GTK_FRAME_EXTENTS l, r, t, b
    };
    QList<ClientInfo> m_clients;
    bool m_clientsValid = false;

    void *m_xcbConnection = nullptr;  // xcb_connection_t*
    QSocketNotifier *m_xcbNotifier = nullptr;
    // Atoms are per X server: cleared on reconnect.
    QMap<QByteArray, uint32_t> m_atomCache;
    // Properties whose change flags a full poll: _NET_SHOWING_DESKTOP,
    // _NET_CLIENT_LIST, _NET_WM_STATE, _NET_CURRENT_DESKTOP,
    // _NET_WM_WINDOW_TYPE, _NET_FRAME_EXTENTS, _GTK_FRAME_EXTENTS. None
    // until the first full poll interns them.
    std::array<uint32_t, 7> m_watchedAtoms = {};
    // Client windows whose PropertyNotify this connection has selected.
    // Cleared on reconnect.
    QSet<uint32_t> m_watchedClients;
    // Reconnect backoff after the X connection broke (X / XWayland restart).
    QElapsedTimer m_reconnectTimer;
    int m_reconnectDelayMs = 0;
    bool m_connectFailureLogged = false;
    bool initXcb();
    void cleanupXcb();
    void processXcbEvents();
    void onXcbReadable();
    bool ensureXcbConnection();
    bool xcbHealthy() const;
    bool queryClients();
    bool queryGeometry();
#endif
};

