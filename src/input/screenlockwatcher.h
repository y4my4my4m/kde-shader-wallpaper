// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>
#pragma once

#include <QObject>

/**
 * @brief Session lock state from org.freedesktop.ScreenSaver.
 *
 * kscreenlocker emits ActiveChanged(bool) on /ScreenSaver when the session
 * locks and unlocks; GetActive is asked once, asynchronously, on start.
 * Without the service, locked stays false. Nothing touches the bus while
 * disabled.
 */
class ScreenLockWatcher : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool enabled READ enabled WRITE setEnabled NOTIFY enabledChanged)
    Q_PROPERTY(bool locked READ locked NOTIFY lockedChanged)

public:
    explicit ScreenLockWatcher(QObject *parent = nullptr);
    ~ScreenLockWatcher() override;

    bool enabled() const { return m_enabled; }
    bool locked() const { return m_locked; }
    void setEnabled(bool enabled);

Q_SIGNALS:
    void enabledChanged();
    void lockedChanged();

private Q_SLOTS:
    void onActiveChanged(bool active);

private:
    void applyEnabled();
    void start();
    void stop();
    void setLocked(bool locked);

    bool m_enabled = true;
    bool m_started = false;
    bool m_locked = false;
    // Bumped by start(): a GetActive reply from an earlier start is stale.
    quint64 m_generation = 0;
};
