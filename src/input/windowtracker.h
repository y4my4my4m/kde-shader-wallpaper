#pragma once

#include <QObject>
#include <QTimer>
#include <QRect>
#include <QVariantList>

/**
 * @brief Tracks window geometries from KWin for shader interaction
 * 
 * Uses KWin's D-Bus interface to get window positions and sizes.
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
    Q_PROPERTY(bool available READ available CONSTANT)
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

private Q_SLOTS:
    void pollWindows();

private:
    struct WindowInfo {
        QString id;
        QRectF geometry;
        QRectF prevGeometry;
        QPointF velocity;
        bool isVisible = true;
    };

    void initDBus();
    void updateWindowList();
    void updateWindowListFromSystem();
    void tryKWinScript();
    void parseWindowsFromSupportInfo(const QString &info, qreal screenHeight);
    void calculateVelocities(qreal dt);
    QRectF mapRectToShader(const QRectF &globalTopLeft) const;

    bool m_enabled = false;
    int m_pollInterval = 50;  // 20 Hz default - fast enough for smooth effects
    QTimer *m_pollTimer = nullptr;
    
    QList<WindowInfo> m_windows;
    
    qint64 m_lastPollTime = 0;
    bool m_dbusAvailable = false;

    qreal m_referenceWidth = 0.0;
    qreal m_referenceHeight = 0.0;
    qreal m_devicePixelRatio = 1.0;
    qreal m_screenVirtualX = 0.0;
    qreal m_screenVirtualY = 0.0;
    
#ifdef HAVE_XCB
    void *m_xcbConnection = nullptr;  // xcb_connection_t*
    void initXcb();
    void cleanupXcb();
#endif
};

