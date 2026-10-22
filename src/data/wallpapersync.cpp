// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "wallpapersync.h"

#include <QDBusConnection>
#include <QDBusMessage>
#include <QDBusPendingCall>
#include <QDBusPendingCallWatcher>
#include <QJsonDocument>
#include <QJsonObject>

namespace {
// package/metadata.json KPlugin.Id
constexpr char kPluginId[] = "online.knowmad.shaderwallpaper";
}

WallpaperSync::WallpaperSync(QObject *parent)
    : QObject(parent)
{
}

QString WallpaperSync::buildScript(const QVariantMap &config)
{
    // Values reach the script only as a JSON literal. JSON is valid
    // JavaScript except for raw U+2028/U+2029 inside strings, which engines
    // before ES2019 reject; those are escaped.
    QString json = QString::fromUtf8(
        QJsonDocument(QJsonObject::fromVariantMap(config)).toJson(QJsonDocument::Compact));
    json.replace(QChar(0x2028), QLatin1String("\\u2028"));
    json.replace(QChar(0x2029), QLatin1String("\\u2029"));

    return QStringLiteral(
        "var config = %1;\n"
        "var pluginId = \"%2\";\n"
        "var all = desktops();\n"
        "for (var i = 0; i < all.length; ++i) {\n"
        "    var d = all[i];\n"
        "    d.wallpaperPlugin = pluginId;\n"
        "    d.currentConfigGroup = [\"Wallpaper\", pluginId, \"General\"];\n"
        "    for (var key in config) {\n"
        "        d.writeConfig(key, config[key]);\n"
        "    }\n"
        "    d.reloadConfig();\n"
        "}\n").arg(json, QLatin1String(kPluginId));
}

void WallpaperSync::applyToAllScreens(const QVariantMap &config)
{
    QDBusMessage message = QDBusMessage::createMethodCall(
        QStringLiteral("org.kde.plasmashell"), QStringLiteral("/PlasmaShell"),
        QStringLiteral("org.kde.PlasmaShell"), QStringLiteral("evaluateScript"));
    message << buildScript(config);

    // Queued: inside plasmashell the service is local, and QtDBus executes
    // a local call synchronously, which would reload the containments while
    // the calling QML handler is still on the stack.
    QMetaObject::invokeMethod(this, [this, message]() {
        auto *watcher = new QDBusPendingCallWatcher(
            QDBusConnection::sessionBus().asyncCall(message), this);
        connect(watcher, &QDBusPendingCallWatcher::finished, this,
                [this](QDBusPendingCallWatcher *w) {
            w->deleteLater();
            if (w->isError()) {
                Q_EMIT finished(false, w->error().message());
            } else {
                Q_EMIT finished(true, QString());
            }
        });
    }, Qt::QueuedConnection);
}
