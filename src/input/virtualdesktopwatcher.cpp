// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>
#include "virtualdesktopwatcher.h"

#include <QDBusConnection>
#include <QDBusInterface>
#include <QDBusPendingCall>
#include <QDBusPendingCallWatcher>
#include <QDBusPendingReply>
#include <QDBusMessage>
#include <QDateTime>
#include <QDebug>

// All KWin queries in this file are ASYNCHRONOUS. This object lives on
// plasmashell's GUI thread; a synchronous D-Bus call here stalls the whole
// shell (wallpaper rendering included) for as long as KWin takes to answer.
// The old implementation did exactly that on a 2s poll timer and produced a
// visible frame hitch every 2 seconds.

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

void VirtualDesktopWatcher::refresh()
{
    if (!m_enabled) return;
    requestDesktopCount();
    requestCurrentDesktop();
}

void VirtualDesktopWatcher::requestDesktopCount()
{
    if (m_countInFlight) return;
    m_countInFlight = true;

    QDBusMessage msg = QDBusMessage::createMethodCall(
        kKWinService(), kKWinPath(),
        QStringLiteral("org.freedesktop.DBus.Properties"),
        QStringLiteral("Get"));
    msg << kKWinInterface() << QStringLiteral("count");

    auto *watcher = new QDBusPendingCallWatcher(
        QDBusConnection::sessionBus().asyncCall(msg), this);
    connect(watcher, &QDBusPendingCallWatcher::finished, this,
            [this](QDBusPendingCallWatcher *w) {
        w->deleteLater();
        m_countInFlight = false;
        QDBusPendingReply<QVariant> reply = *w;
        if (!reply.isValid()) return;
        int count = reply.value().toInt();
        if (count < 1) count = 1;
        if (count != m_desktopCount) {
            m_desktopCount = count;
            Q_EMIT desktopCountChanged();
        }
    });
}

void VirtualDesktopWatcher::requestCurrentDesktop()
{
    if (m_currentInFlight) return;
    m_currentInFlight = true;

    if (m_currentApiMode >= 0) {
        // Probe / use currentRow (present on some Plasma versions).
        QDBusMessage msg = QDBusMessage::createMethodCall(
            kKWinService(), kKWinPath(), kKWinInterface(),
            QStringLiteral("currentRow"));
        auto *watcher = new QDBusPendingCallWatcher(
            QDBusConnection::sessionBus().asyncCall(msg), this);
        connect(watcher, &QDBusPendingCallWatcher::finished, this,
                [this](QDBusPendingCallWatcher *w) {
            w->deleteLater();
            QDBusPendingReply<uint> reply = *w;
            if (reply.isValid()) {
                m_currentApiMode = 1;
                m_currentInFlight = false;
                applyCurrentDesktop(qMax(0, int(reply.value()) - 1)); // KWin is 1-based here
            } else if (m_currentApiMode == 0) {
                // Probe failed — fall back to the legacy API from now on.
                m_currentApiMode = -1;
                m_currentInFlight = false;
                requestCurrentDesktop();
            } else {
                m_currentInFlight = false;
            }
        });
        return;
    }

    // Legacy org.kde.KWin /KWin currentDesktop.
    QDBusMessage msg = QDBusMessage::createMethodCall(
        kKWinService(), QStringLiteral("/KWin"),
        QStringLiteral("org.kde.KWin"),
        QStringLiteral("currentDesktop"));
    auto *watcher = new QDBusPendingCallWatcher(
        QDBusConnection::sessionBus().asyncCall(msg), this);
    connect(watcher, &QDBusPendingCallWatcher::finished, this,
            [this](QDBusPendingCallWatcher *w) {
        w->deleteLater();
        m_currentInFlight = false;
        QDBusPendingReply<int> reply = *w;
        if (reply.isValid()) {
            applyCurrentDesktop(qMax(0, reply.value() - 1));
        }
    });
}

void VirtualDesktopWatcher::applyCurrentDesktop(int newIdx)
{
    if (newIdx == m_currentDesktop) return;

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
