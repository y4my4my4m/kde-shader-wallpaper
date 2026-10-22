// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#ifndef WALLPAPERSYNC_H
#define WALLPAPERSYNC_H

#include <QObject>
#include <QString>
#include <QVariantMap>

/**
 * @brief Applies one wallpaper configuration to every desktop (issue #114).
 *
 * Runs a desktop script through org.kde.PlasmaShell.evaluateScript: each
 * containment switches to this plugin, and every key of @p config is written
 * to its [Wallpaper][online.knowmad.shaderwallpaper][General] group.
 * QML singleton "WallpaperSync"; the D-Bus call is asynchronous and reports
 * through finished().
 */
class WallpaperSync : public QObject
{
    Q_OBJECT

public:
    explicit WallpaperSync(QObject *parent = nullptr);

    Q_INVOKABLE void applyToAllScreens(const QVariantMap &config);

    static QString buildScript(const QVariantMap &config);

Q_SIGNALS:
    void finished(bool ok, const QString &error);
};

#endif // WALLPAPERSYNC_H
