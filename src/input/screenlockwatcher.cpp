// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>
#include "screenlockwatcher.h"

#include <QDBusConnection>
#include <QDBusMessage>
#include <QDBusPendingCallWatcher>
#include <QDBusPendingReply>

namespace {
inline const QString kService()   { return QStringLiteral("org.freedesktop.ScreenSaver"); }
inline const QString kPath()      { return QStringLiteral("/ScreenSaver"); }
inline const QString kInterface() { return QStringLiteral("org.freedesktop.ScreenSaver"); }
}

ScreenLockWatcher::ScreenLockWatcher(QObject *parent)
    : QObject(parent)
{
    // Deferred: QML assigns `enabled` after construction, and a watcher
    // created disabled must never touch the bus.
    QMetaObject::invokeMethod(this, &ScreenLockWatcher::applyEnabled, Qt::QueuedConnection);
}

ScreenLockWatcher::~ScreenLockWatcher()
{
    if (m_started) {
        QDBusConnection::sessionBus().disconnect(QString(), kPath(), kInterface(),
                                                 QStringLiteral("ActiveChanged"),
                                                 this, SLOT(onActiveChanged(bool)));
    }
}

void ScreenLockWatcher::setEnabled(bool enabled)
{
    if (m_enabled == enabled) return;
    m_enabled = enabled;
    Q_EMIT enabledChanged();
    applyEnabled();
}

void ScreenLockWatcher::applyEnabled()
{
    if (m_enabled && !m_started) {
        start();
    } else if (!m_enabled && m_started) {
        stop();
    }
}

void ScreenLockWatcher::start()
{
    m_started = true;
    const quint64 generation = ++m_generation;
    QDBusConnection bus = QDBusConnection::sessionBus();

    // An empty service name: QtDBus resolves the owner of a named service
    // with a blocking GetNameOwner call.
    bus.connect(QString(), kPath(), kInterface(), QStringLiteral("ActiveChanged"),
                this, SLOT(onActiveChanged(bool)));

    // Asynchronous: a blocking call on plasmashell's GUI thread stalls the
    // shell for as long as the screen locker takes to answer.
    const QDBusMessage msg = QDBusMessage::createMethodCall(kService(), kPath(), kInterface(),
                                                            QStringLiteral("GetActive"));
    auto *watcher = new QDBusPendingCallWatcher(bus.asyncCall(msg), this);
    connect(watcher, &QDBusPendingCallWatcher::finished, this,
            [this, generation](QDBusPendingCallWatcher *call) {
                const QDBusPendingReply<bool> reply = *call;
                call->deleteLater();
                if (generation == m_generation && m_started && !reply.isError()) {
                    setLocked(reply.value());
                }
            });
}

void ScreenLockWatcher::stop()
{
    m_started = false;
    QDBusConnection::sessionBus().disconnect(QString(), kPath(), kInterface(),
                                             QStringLiteral("ActiveChanged"),
                                             this, SLOT(onActiveChanged(bool)));
    setLocked(false);
}

void ScreenLockWatcher::onActiveChanged(bool active)
{
    if (m_started) {
        setLocked(active);
    }
}

void ScreenLockWatcher::setLocked(bool locked)
{
    if (m_locked == locked) return;
    m_locked = locked;
    Q_EMIT lockedChanged();
}
