// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>
#include "virtualdesktopwatcher.h"

#include <QDBusConnection>
#include <QDBusInterface>
#include <QDBusReply>
#include <QDBusMessage>
#include <QElapsedTimer>
#include <QDateTime>
#include <QDebug>

namespace {
inline const QString kKWinService()   { return QStringLiteral("org.kde.KWin"); }
inline const QString kKWinPath()      { return QStringLiteral("/VirtualDesktopManager"); }
inline const QString kKWinInterface() { return QStringLiteral("org.kde.KWin.VirtualDesktopManager"); }
}

VirtualDesktopWatcher::VirtualDesktopWatcher(QObject *parent)
    : QObject(parent)
{
    m_iface = new QDBusInterface(kKWinService(), kKWinPath(), kKWinInterface(),
                                 QDBusConnection::sessionBus(), this);

    // Signals — these names match Plasma 5/6's KWin VirtualDesktopManager.
    // We connect to the strings rather than typed function pointers because
    // QDBusInterface doesn't generate a typed proxy.
    QDBusConnection::sessionBus().connect(
        kKWinService(), kKWinPath(), kKWinInterface(),
        QStringLiteral("currentChanged"),
        this, SLOT(refresh()));
    QDBusConnection::sessionBus().connect(
        kKWinService(), kKWinPath(), kKWinInterface(),
        QStringLiteral("desktopsChanged"),
        this, SLOT(refresh()));

    // Low-frequency fallback poll — only relevant if the D-Bus signals
    // aren't delivered (e.g. on weird WM setups). 2s is plenty.
    m_pollTimer.setInterval(2000);
    connect(&m_pollTimer, &QTimer::timeout, this, &VirtualDesktopWatcher::refresh);
    if (m_enabled) m_pollTimer.start();

    // Animation timer — runs at ~60Hz only while a transition is in flight
    // (started/stopped from refresh()).
    m_animTimer.setInterval(16);
    connect(&m_animTimer, &QTimer::timeout, this, &VirtualDesktopWatcher::animateStep);

    refresh();
}

VirtualDesktopWatcher::~VirtualDesktopWatcher() = default;

bool VirtualDesktopWatcher::available() const
{
    return m_iface && m_iface->isValid();
}

void VirtualDesktopWatcher::setEnabled(bool enabled)
{
    if (m_enabled == enabled) return;
    m_enabled = enabled;
    Q_EMIT enabledChanged();
    if (m_enabled) {
        m_pollTimer.start();
        refresh();
    } else {
        m_pollTimer.stop();
        m_animTimer.stop();
    }
}

QString VirtualDesktopWatcher::currentIdString() const
{
    if (!m_iface || !m_iface->isValid()) return {};
    QDBusReply<QString> reply = m_iface->call(QStringLiteral("current"));
    if (reply.isValid()) return reply.value();
    return {};
}

int VirtualDesktopWatcher::indexFromId(const QString &id) const
{
    return m_desktopIds.indexOf(id);
}

void VirtualDesktopWatcher::rebuildIdList()
{
    m_desktopIds.clear();
    if (!m_iface || !m_iface->isValid()) return;

    // KWin returns a list of structs (id, name, position) — we just want
    // the ids in their reported order. Use desktopRows or desktops()…
    // Different Plasma versions have different APIs; try the most common.
    QDBusReply<QStringList> reply = m_iface->call(QStringLiteral("desktopsRows")); // unlikely to work but try
    if (!reply.isValid()) {
        // Fallback: try the property "desktops" via QVariant
        QVariant v = m_iface->property("desktops");
        if (v.isValid()) {
            // It's an array of structs — we can't fully decode without
            // generated proxies, so fall back to counting via 'count'.
        }
    }

    // Simpler & reliable: query 'count' property and accept that we may
    // not have stable UUIDs. The transitionProgress feature still works
    // if we just map current desktop index numerically.
    QVariant countV = m_iface->property("count");
    int count = countV.toInt();
    if (count < 1) count = 1;
    if (count != m_desktopCount) {
        m_desktopCount = count;
        Q_EMIT desktopCountChanged();
    }
}

void VirtualDesktopWatcher::refresh()
{
    if (!m_enabled) return;
    if (!m_iface || !m_iface->isValid()) return;

    rebuildIdList();

    // Try to get the current desktop's position/index. KWin's
    // VirtualDesktopManager exposes a 'current' property that returns
    // the UUID string, plus 'desktops' for the list — but as a struct
    // array which is hard to decode without generated proxies. As a
    // pragmatic alternative we use the legacy `currentRow()` or fall
    // back to parsing the active window's desktop. For now, use the
    // 'desktopRows' to detect changes:
    int newIdx = m_currentDesktop;

    // Try the simple 'currentRow' first (some Plasma versions have it).
    QDBusReply<uint> currentRowReply = m_iface->call(QStringLiteral("currentRow"));
    if (currentRowReply.isValid()) {
        newIdx = qMax(0, int(currentRowReply.value()) - 1); // KWin is 1-based here
    } else {
        // Otherwise fall back to KGlobalAccel-style approach via
        // org.kde.KWin /KWin currentDesktop (legacy API)
        QDBusInterface kwinLegacy(kKWinService(), QStringLiteral("/KWin"),
                                  QStringLiteral("org.kde.KWin"),
                                  QDBusConnection::sessionBus());
        if (kwinLegacy.isValid()) {
            QDBusReply<int> legacy = kwinLegacy.call(QStringLiteral("currentDesktop"));
            if (legacy.isValid()) newIdx = qMax(0, legacy.value() - 1);
        }
    }

    if (newIdx != m_currentDesktop) {
        m_previousDesktop = m_currentDesktop;
        m_currentDesktop = newIdx;
        Q_EMIT currentDesktopChanged();
        Q_EMIT desktopSwitched(m_previousDesktop, m_currentDesktop);

        // Kick off the transition animation
        m_animStartMs = double(QDateTime::currentMSecsSinceEpoch());
        m_transitionProgress = 0.0;
        Q_EMIT transitionProgressChanged();
        m_animTimer.start();
    }
}

void VirtualDesktopWatcher::animateStep()
{
    qreal now = double(QDateTime::currentMSecsSinceEpoch());
    qreal t = (now - m_animStartMs) / kAnimDurationMs;
    if (t >= 1.0) {
        m_transitionProgress = 1.0;
        Q_EMIT transitionProgressChanged();
        m_animTimer.stop();
        return;
    }
    if (t < 0.0) t = 0.0;
    // Smoothstep for a nicer ease-in-out
    qreal eased = t * t * (3.0 - 2.0 * t);
    m_transitionProgress = eased;
    Q_EMIT transitionProgressChanged();
}
