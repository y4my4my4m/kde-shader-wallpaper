// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>
#pragma once

#include <QObject>
#include <QTimer>
#include <QString>
#include <QStringList>

class QDBusInterface;

/**
 * @brief Tracks the user's current virtual desktop via KWin's D-Bus API.
 *
 * Exposes:
 *   - currentDesktop (0-based index)
 *   - desktopCount
 *   - transitionProgress (0..1, animates briefly when desktop changes — used
 *     by the parallax effect so the shader can smoothly pan as the user
 *     switches workspaces)
 *
 * Listens to org.kde.KWin.VirtualDesktopManager's currentChanged /
 * desktopsChanged signals via D-Bus (with a low-frequency fallback poll
 * in case the signal doesn't arrive on a particular Plasma build).
 */
class VirtualDesktopWatcher : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool enabled READ enabled WRITE setEnabled NOTIFY enabledChanged)
    Q_PROPERTY(int currentDesktop READ currentDesktop NOTIFY currentDesktopChanged)
    Q_PROPERTY(int desktopCount READ desktopCount NOTIFY desktopCountChanged)
    Q_PROPERTY(qreal transitionProgress READ transitionProgress NOTIFY transitionProgressChanged)
    Q_PROPERTY(bool available READ available CONSTANT)

public:
    explicit VirtualDesktopWatcher(QObject *parent = nullptr);
    ~VirtualDesktopWatcher() override;

    bool enabled() const { return m_enabled; }
    int currentDesktop() const { return m_currentDesktop; }
    int desktopCount() const { return m_desktopCount; }
    qreal transitionProgress() const { return m_transitionProgress; }
    bool available() const;

    void setEnabled(bool enabled);

Q_SIGNALS:
    void enabledChanged();
    void currentDesktopChanged();
    void desktopCountChanged();
    void transitionProgressChanged();
    /// Emitted once per actual desktop change, AFTER currentDesktop has been
    /// updated. The QML side can use this to start the parallax animation.
    void desktopSwitched(int previous, int current);

private Q_SLOTS:
    void refresh();
    void animateStep();

private:
    QString currentIdString() const;
    int indexFromId(const QString &id) const;
    void rebuildIdList();

    bool m_enabled = true;
    int m_currentDesktop = 0;
    int m_previousDesktop = 0;
    int m_desktopCount = 1;
    qreal m_transitionProgress = 0.0;

    QStringList m_desktopIds; // KWin's vdesktop UUIDs in order; index = our 0-based desktop number
    QDBusInterface *m_iface = nullptr;
    QTimer m_pollTimer;       // 1s fallback poll
    QTimer m_animTimer;       // ~60Hz transition animation
    qreal m_animStartMs = 0.0;
    static constexpr qreal kAnimDurationMs = 350.0;
};
