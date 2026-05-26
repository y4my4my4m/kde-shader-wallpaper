// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "shaderwallpaperplugin.h"

#include "core/shaderengine.h"
#include "core/shaderbuffer.h"
#include "core/uniformmanager.h"
#include "core/performancemonitor.h"
#include "input/cursortracker.h"
#include "input/audiocapture.h"
#include "input/windowtracker.h"
#include "input/virtualdesktopwatcher.h"
#include "import/shadertoyapi.h"
#include "data/presetmanager.h"
#include "data/shaderlibrary.h"
#include "data/plmgreetersetup.h"
#include "models/shaderlistmodel.h"
#include "models/categorymodel.h"

void ShaderWallpaperPlugin::registerTypes(const char *uri)
{
    Q_ASSERT(QLatin1String(uri) == QLatin1String("online.knowmad.shaderwallpaper"));

    // Core rendering
    qmlRegisterType<ShaderEngine>(uri, 1, 0, "ShaderEngine");
    qmlRegisterType<ShaderBuffer>(uri, 1, 0, "ShaderBuffer");
    qmlRegisterType<UniformManager>(uri, 1, 0, "UniformManager");
    qmlRegisterType<PerformanceMonitor>(uri, 1, 0, "PerformanceMonitor");

    // Input handling
    qmlRegisterType<CursorTracker>(uri, 1, 0, "CursorTracker");
    qmlRegisterType<AudioCapture>(uri, 1, 0, "AudioCapture");
    qmlRegisterType<WindowTracker>(uri, 1, 0, "WindowTracker");
    qmlRegisterType<VirtualDesktopWatcher>(uri, 1, 0, "VirtualDesktopWatcher");

    // Shadertoy import
    qmlRegisterType<ShadertoyAPI>(uri, 1, 0, "ShadertoyAPI");

    // Data management
    qmlRegisterType<PresetManager>(uri, 1, 0, "PresetManager");
    qmlRegisterType<ShaderLibrary>(uri, 1, 0, "ShaderLibrary");

    // Models for QML views
    qmlRegisterType<ShaderListModel>(uri, 1, 0, "ShaderListModel");
    qmlRegisterType<CategoryModel>(uri, 1, 0, "CategoryModel");

    qmlRegisterType<PlmGreeterSetup>(uri, 1, 0, "PlmGreeterSetup");
    qmlRegisterSingletonType<PlmGreeterSetup>(uri, 1, 0, "PlmGreeterSetupSingleton",
        [](QQmlEngine *engine, QJSEngine *scriptEngine) -> QObject * {
            Q_UNUSED(engine)
            Q_UNUSED(scriptEngine)
            static PlmGreeterSetup instance;
            return &instance;
        });

    // Register singletons
    qmlRegisterSingletonType<ShaderLibrary>(uri, 1, 0, "ShaderLibrarySingleton",
        [](QQmlEngine *engine, QJSEngine *scriptEngine) -> QObject * {
            Q_UNUSED(engine)
            Q_UNUSED(scriptEngine)
            return ShaderLibrary::instance();
        });
}

