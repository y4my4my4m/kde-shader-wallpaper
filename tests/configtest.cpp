// SPDX-License-Identifier: GPL-3.0-or-later

#include <KConfigGroup>
#include <KConfigLoader>
#include <KConfigPropertyMap>
#include <KLocalizedQmlContext>
#include <KSharedConfig>
#include <QApplication>
#include <QDir>
#include <QFile>
#include <QQmlContext>
#include <QQmlEngine>
#include <QQuickItem>
#include <QSet>
#include <QSettings>
#include <QTemporaryDir>
#include <QUrl>
#include <QtQuickTest/quicktest.h>

using namespace Qt::StringLiterals;

class Fixture final : public QObject {
    Q_OBJECT
    Q_PROPERTY(QUrl configUrl READ configUrl CONSTANT)
public:
    explicit Fixture(QObject *parent = nullptr) : QObject(parent) {
        m_ui = qEnvironmentVariable("SHADER_WALLPAPER_UI");
    }
    QUrl configUrl() const { return QUrl::fromLocalFile(m_ui + u"/config.qml"_s); }
    Q_INVOKABLE QObject *createProfile(const QVariantMap &seed) {
        const QString path = m_dir.filePath(QString::number(++m_serial) + u".rc"_s);
        {
            auto config = KSharedConfig::openConfig(path, KConfig::SimpleConfig);
            KConfigGroup group(config, u"General"_s);
            for (auto it = seed.cbegin(); it != seed.cend(); ++it) {
                QVariant value = it.value();
                if (value.canConvert<QJSValue>()) {
                    value = value.value<QJSValue>().toVariant();
                }
                if (it.key() == u"excludeWindows"_s || it.key() == u"playlistShaders"_s) {
                    value = value.toStringList();
                }
                group.writeEntry(it.key(), value);
            }
            config->sync();
        }
        return load(path);
    }
    Q_INVOKABLE QObject *reopen(QObject *object) {
        auto map = qobject_cast<KConfigPropertyMap *>(object);
        Q_ASSERT(map);
        // A new filename also avoids KSharedConfig's in-process cache: this
        // map must be reconstructed from bytes actually written to disk.
        const QString path = m_dir.filePath(QString::number(++m_serial) + u".rc"_s);
        if (!QFile::copy(m_files.value(map), path)) {
            qFatal("Cannot read persisted fixture");
        }
        return load(path);
    }
    Q_INVOKABLE QVariantList itemsByType(QObject *root, const QString &type) const {
        QVariantList result;
        QList<QObject *> pending{root};
        QSet<QObject *> visited;
        while (!pending.isEmpty()) {
            auto object = pending.takeLast();
            if (visited.contains(object)) {
                continue;
            }
            visited.insert(object);
            if (QString::fromLatin1(object->metaObject()->className()).startsWith(type + QLatin1Char('_'))) {
                result.append(QVariant::fromValue(object));
            }
            pending.append(object->children());
            // Repeater delegates can have a different QObject owner than
            // their visual parent; include both trees when finding controls.
            if (auto item = qobject_cast<QQuickItem *>(object)) {
                for (auto child : item->childItems()) {
                    pending.append(child);
                }
            }
        }
        return result;
    }

private:
    QObject *load(const QString &path) {
        QFile schema(QDir(m_ui).absoluteFilePath(u"../config/main.xml"_s));
        if (!schema.exists()) {
            qFatal("Cannot find config schema");
        }
        auto loader = new KConfigLoader(path, &schema, this);
        auto map = new KConfigPropertyMap(loader, loader);
        m_files.insert(map, path);
        QQmlEngine::setObjectOwnership(map, QQmlEngine::CppOwnership);
        return map;
    }
    QTemporaryDir m_dir;
    QString m_ui;
    int m_serial = 0;
    QHash<KConfigPropertyMap *, QString> m_files;
};

class Setup final : public QObject {
    Q_OBJECT
public Q_SLOTS:
    void qmlEngineAvailable(QQmlEngine *engine) {
        auto l10n = new KLocalizedQmlContext(engine);
        l10n->setTranslationDomain(u"plasma_wallpaper_online.knowmad.shaderwallpaper"_s);
        engine->rootContext()->setContextObject(l10n);
        engine->rootContext()->setContextProperty(u"Fixture"_s, new Fixture(engine));
    }
};

int main(int argc, char **argv) {
    if (!qEnvironmentVariableIsSet("SHADER_TEST_SANDBOX")) {
        qFatal("Run through CTest or run_configuration_tests.py to isolate application data");
    }
    QApplication app(argc, argv);
    app.setOrganizationName(u"ShaderWallpaperTests"_s);
    app.setApplicationName(u"config-regression"_s);
    QSettings settings;
    settings.setValue(u"ShaderWallpaperOnboarding/onboarded"_s, true);
    settings.sync();
    Setup setup;
    return quick_test_main_with_setup(argc, argv, "shader-config-tests", QUICK_TEST_SOURCE_DIR, &setup);
}
#include "configtest.moc"
