// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#ifndef SHADERWALLPAPERPLUGIN_H
#define SHADERWALLPAPERPLUGIN_H

#include <QQmlExtensionPlugin>

class ShaderWallpaperPlugin : public QQmlExtensionPlugin
{
    Q_OBJECT
    Q_PLUGIN_METADATA(IID QQmlExtensionInterface_iid)

public:
    void registerTypes(const char *uri) override;
};

#endif // SHADERWALLPAPERPLUGIN_H

