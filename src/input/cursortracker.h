// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#ifndef CURSORTRACKER_H
#define CURSORTRACKER_H

#include <QObject>
#include <QtQml/qqmlregistration.h>
#include <QPoint>
#include <QPointF>
#include <QTimer>
#include <QVector4D>
#include <QScreen>

#ifdef HAVE_XCB
#include <xcb/xcb.h>
#endif

/**
 * @brief Tracks global cursor position across X11 and Wayland
 * 
 * Provides iMouse-compatible output:
 * - xy: current cursor position (normalized or pixels)
 * - zw: position where mouse was last clicked
 * - Sign of z indicates button state (positive = pressed)
 */
class CursorTracker : public QObject
{
    Q_OBJECT
    QML_ELEMENT

    Q_PROPERTY(bool enabled READ enabled WRITE setEnabled NOTIFY enabledChanged)
    Q_PROPERTY(int pollInterval READ pollInterval WRITE setPollInterval NOTIFY pollIntervalChanged)
    Q_PROPERTY(QPointF position READ position NOTIFY positionChanged)
    Q_PROPERTY(QPointF clickPosition READ clickPosition NOTIFY clickPositionChanged)
    Q_PROPERTY(bool pressed READ pressed NOTIFY pressedChanged)
    Q_PROPERTY(QVector4D iMouse READ iMouse NOTIFY iMouseChanged)
    Q_PROPERTY(bool available READ available CONSTANT)
    Q_PROPERTY(qreal sensitivity READ sensitivity WRITE setSensitivity NOTIFY sensitivityChanged)
    
    // Screen / wallpaper geometry for coordinate transformation.
    // iMouse.xy MUST live in the same pixel space as fragCoord (0..width,
    // 0..height with Y=0 at bottom). MouseArea gives Qt-local coords
    // (Y=0 at top); we flip Y using referenceHeight, NOT QScreen height,
    // because the wallpaper item is often shorter than the full screen
    // (panel, struts). Using screen height caused iMouse to drift toward
    // the origin as X/Y increased — ripples looked strong at (0,0) only.
    Q_PROPERTY(QScreen* screen READ screen WRITE setScreen NOTIFY screenChanged)
    Q_PROPERTY(qreal referenceWidth READ referenceWidth WRITE setReferenceWidth NOTIFY referenceSizeChanged)
    Q_PROPERTY(qreal referenceHeight READ referenceHeight WRITE setReferenceHeight NOTIFY referenceSizeChanged)
    Q_PROPERTY(qreal devicePixelRatio READ devicePixelRatio WRITE setDevicePixelRatio NOTIFY devicePixelRatioChanged)
    Q_PROPERTY(bool normalizeCoordinates READ normalizeCoordinates WRITE setNormalizeCoordinates NOTIFY normalizeCoordinatesChanged)

public:
    explicit CursorTracker(QObject *parent = nullptr);
    ~CursorTracker() override;

    // Property getters
    bool enabled() const { return m_enabled; }
    int pollInterval() const { return m_pollInterval; }
    QPointF position() const { return m_position; }
    QPointF clickPosition() const { return m_clickPosition; }
    bool pressed() const { return m_pressed; }
    QVector4D iMouse() const;
    bool available() const;
    qreal sensitivity() const { return m_sensitivity; }
    QScreen* screen() const { return m_screen; }
    qreal referenceWidth() const { return m_referenceWidth; }
    qreal referenceHeight() const { return m_referenceHeight; }
    qreal devicePixelRatio() const { return m_devicePixelRatio; }
    bool normalizeCoordinates() const { return m_normalizeCoordinates; }

    // Property setters
    void setEnabled(bool enabled);
    void setPollInterval(int interval);
    void setSensitivity(qreal sensitivity);
    void setScreen(QScreen *screen);
    void setReferenceWidth(qreal width);
    void setReferenceHeight(qreal height);
    void setDevicePixelRatio(qreal ratio);
    void setNormalizeCoordinates(bool normalize);

    // Poll global cursor now (call once per render frame for smooth buffer effects).
    Q_INVOKABLE void refresh();

    // Manual position update (for QML MouseArea fallback)
    Q_INVOKABLE void updatePosition(qreal x, qreal y);
    Q_INVOKABLE void updateClick(qreal x, qreal y, bool pressed);
    Q_INVOKABLE void updatePressed(bool pressed);

Q_SIGNALS:
    void enabledChanged();
    void pollIntervalChanged();
    void positionChanged();
    void clickPositionChanged();
    void pressedChanged();
    void iMouseChanged();
    void sensitivityChanged();
    void screenChanged();
    void referenceSizeChanged();
    void devicePixelRatioChanged();
    void normalizeCoordinatesChanged();

private Q_SLOTS:
    void pollCursor();

private:
    void startPolling();
    void stopPolling();
    bool initX11();
    bool initWayland();
    QPoint getGlobalCursorPosition();
    bool getButtonState();
    
    bool m_enabled = false;
    int m_pollInterval = 16; // ~60 Hz
    QPointF m_position;
    QPointF m_clickPosition;
    bool m_pressed = false;
    qreal m_sensitivity = 1.0;
    QScreen *m_screen = nullptr;
    qreal m_referenceWidth = 0.0;
    qreal m_referenceHeight = 0.0;
    qreal m_devicePixelRatio = 1.0;
    bool m_normalizeCoordinates = false;
    
    QTimer *m_pollTimer = nullptr;
    
    // X11 specific
#ifdef HAVE_XCB
    xcb_connection_t *m_xcbConnection = nullptr;
    xcb_screen_t *m_xcbScreen = nullptr;
#endif
    
    // Platform detection
    bool m_isX11 = false;
    bool m_isWayland = false;
    bool m_initialized = false;
};

#endif // CURSORTRACKER_H

