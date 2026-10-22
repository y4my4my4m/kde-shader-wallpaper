// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>
#include "virtualdesktopwatcher.h"

#include <QDBusConnection>
#include <QDBusPendingCall>
#include <QDBusPendingCallWatcher>
#include <QDBusPendingReply>
#include <QDBusMessage>
#include <QDBusServiceWatcher>
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
    // Low-frequency fallback poll — only relevant if the D-Bus signals
    // aren't delivered (e.g. on weird WM setups). 2s is plenty.
    m_pollTimer.setInterval(2000);
    connect(&m_pollTimer, &QTimer::timeout, this, &VirtualDesktopWatcher::refresh);

    // Animation timer — runs at ~60Hz only while a transition is in flight
    // (started/stopped from refresh()).
    m_animTimer.setInterval(16);
    connect(&m_animTimer, &QTimer::timeout, this, &VirtualDesktopWatcher::animateStep);

    // Deferred: QML assigns `enabled` after construction, and a watcher
    // created disabled must never touch the bus.
    QMetaObject::invokeMethod(this, &VirtualDesktopWatcher::applyEnabled, Qt::QueuedConnection);
}

VirtualDesktopWatcher::~VirtualDesktopWatcher() = default;

void VirtualDesktopWatcher::setEnabled(bool enabled)
{
    if (m_enabled == enabled) return;
    m_enabled = enabled;
    Q_EMIT enabledChanged();
    applyEnabled();
}

void VirtualDesktopWatcher::applyEnabled()
{
    if (m_enabled && !m_started) {
        start();
    } else if (!m_enabled && m_started) {
        stop();
    }
}

void VirtualDesktopWatcher::start()
{
    m_started = true;
    QDBusConnection bus = QDBusConnection::sessionBus();

    // An empty service name: QtDBus resolves the owner of a named service
    // with a blocking GetNameOwner call. Only KWin emits on this path and
    // interface.
    bus.connect(QString(), kKWinPath(), kKWinInterface(),
                QStringLiteral("currentChanged"), this, SLOT(refresh()));
    bus.connect(QString(), kKWinPath(), kKWinInterface(),
                QStringLiteral("desktopsChanged"), this, SLOT(refresh()));

    if (!m_serviceWatcher) {
        m_serviceWatcher = new QDBusServiceWatcher(kKWinService(), bus,
                                                   QDBusServiceWatcher::WatchForOwnerChange, this);
        connect(m_serviceWatcher, &QDBusServiceWatcher::serviceRegistered, this, [this]() {
            setAvailable(true);
            refresh();
        });
        connect(m_serviceWatcher, &QDBusServiceWatcher::serviceUnregistered, this, [this]() {
            setAvailable(false);
        });
    }

    requestAvailability();
    m_pollTimer.start();
    refresh();
}

void VirtualDesktopWatcher::stop()
{
    m_started = false;
    m_pollTimer.stop();
    m_animTimer.stop();

    QDBusConnection bus = QDBusConnection::sessionBus();
    bus.disconnect(QString(), kKWinPath(), kKWinInterface(),
                   QStringLiteral("currentChanged"), this, SLOT(refresh()));
    bus.disconnect(QString(), kKWinPath(), kKWinInterface(),
                   QStringLiteral("desktopsChanged"), this, SLOT(refresh()));

    delete m_serviceWatcher;
    m_serviceWatcher = nullptr;
}

void VirtualDesktopWatcher::setAvailable(bool available)
{
    if (m_available == available) return;
    m_available = available;
    Q_EMIT availableChanged();
}

void VirtualDesktopWatcher::requestAvailability()
{
    QDBusMessage msg = QDBusMessage::createMethodCall(
        QStringLiteral("org.freedesktop.DBus"), QStringLiteral("/org/freedesktop/DBus"),
        QStringLiteral("org.freedesktop.DBus"), QStringLiteral("NameHasOwner"));
    msg << kKWinService();

    auto *watcher = new QDBusPendingCallWatcher(
        QDBusConnection::sessionBus().asyncCall(msg), this);
    connect(watcher, &QDBusPendingCallWatcher::finished, this,
            [this](QDBusPendingCallWatcher *w) {
        w->deleteLater();
        QDBusPendingReply<bool> reply = *w;
        if (reply.isValid()) {
            setAvailable(reply.value());
        }
    });
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
    if (!m_enabled || newIdx == m_currentDesktop) return;

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
