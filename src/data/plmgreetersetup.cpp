// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "plmgreetersetup.h"

#include <QCoreApplication>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QProcess>
#include <QStandardPaths>

namespace {
constexpr char PLUGIN_ID[] = "online.knowmad.shaderwallpaper";
constexpr char SYSTEM_PLUGIN_METADATA[] =
    "/usr/share/plasma/wallpapers/online.knowmad.shaderwallpaper/metadata.json";
constexpr char MAIN_CONF[] = "/etc/plasmalogin.conf";
constexpr char CONF_DROP_IN_DIR[] = "/etc/plasmalogin.conf.d";

#ifndef PLM_GREETER_HELPER_PATH
#define PLM_GREETER_HELPER_PATH "/usr/libexec/shaderwallpaper/enable-plm-greeter"
#endif

bool detectPlm()
{
    if (!QStandardPaths::findExecutable(QStringLiteral("plasmalogin")).isEmpty()) {
        return true;
    }
    if (QFile::exists(QStringLiteral("/usr/lib/plasmalogin/defaults.conf"))) {
        return true;
    }
    return QFile::exists(QStringLiteral("/usr/share/dbus-1/system-services/org.kde.plasmalogin.service"));
}

// True if the file has a line `WallpaperPluginId=online.knowmad.shaderwallpaper`
// (ignoring comments). PLM merges /etc/plasmalogin.conf + everything in
// /etc/plasmalogin.conf.d/, so a hit in either counts.
bool fileRegistersPlugin(const QString &path)
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        return false;
    }
    const QByteArray needle = QByteArray("WallpaperPluginId=") + PLUGIN_ID;
    while (!file.atEnd()) {
        const QByteArray line = file.readLine().trimmed();
        if (line.startsWith('#')) {
            continue;
        }
        if (line == needle) {
            return true;
        }
    }
    return false;
}

bool loginScreenRegistered()
{
    if (fileRegistersPlugin(QString::fromUtf8(MAIN_CONF))) {
        return true;
    }
    QDir dropIns(QString::fromUtf8(CONF_DROP_IN_DIR));
    if (!dropIns.exists()) {
        return false;
    }
    for (const QFileInfo &fi : dropIns.entryInfoList(QDir::Files | QDir::NoDotAndDotDot)) {
        if (fileRegistersPlugin(fi.absoluteFilePath())) {
            return true;
        }
    }
    return false;
}
} // namespace

PlmGreeterSetup::PlmGreeterSetup(QObject *parent)
    : QObject(parent)
{
    refresh();
}

QString PlmGreeterSetup::helperExecutablePath() const
{
    const QString compiled = QStringLiteral(PLM_GREETER_HELPER_PATH);
    if (QFileInfo::exists(compiled) && QFileInfo(compiled).isExecutable()) {
        return compiled;
    }
    const QString inPath = QStandardPaths::findExecutable(QStringLiteral("enable-plm-greeter"));
    if (!inPath.isEmpty()) {
        return inPath;
    }
    // Dev tree fallback (uninstalled build, running from build dir).
    const QDir appDir(QCoreApplication::applicationDirPath());
    const QString devScript = appDir.absoluteFilePath(
        QStringLiteral("../../../../../scripts/enable-plm-greeter.sh"));
    if (QFileInfo(devScript).isExecutable()) {
        return devScript;
    }
    return {};
}

QString PlmGreeterSetup::resolveInstallScript() const
{
    const QString home = QDir::homePath();
    const QString local = home
        + QStringLiteral("/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/scripts/install-plm-greeter.sh");
    if (QFile::exists(local)) {
        return local;
    }
    return QStringLiteral(
        "/usr/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/scripts/install-plm-greeter.sh");
}

void PlmGreeterSetup::refresh()
{
    const bool plm = detectPlm();
    const bool systemPlugin = QFile::exists(QString::fromUtf8(SYSTEM_PLUGIN_METADATA));
    const bool enabled = loginScreenRegistered();
    const QString helper = helperExecutablePath();

    QString cmd = QStringLiteral("bash ") + resolveInstallScript();
    QString message;
    if (!plm) {
        message = tr("Requires Plasma Login Manager. Other display managers (SDDM, GDM…) are not supported here.");
    } else if (!systemPlugin) {
        message = tr("Needs a one-time system-wide install for the sign-in screen.");
    } else if (enabled) {
        message = tr("Enabled. Log out to see Shader Wallpaper on the sign-in screen.");
    } else {
        message = tr("Installed but not yet enabled for the sign-in screen.");
    }

    bool changed = false;
    auto assign = [&changed](auto &lhs, auto rhs) {
        if (lhs != rhs) { lhs = std::move(rhs); changed = true; }
    };
    assign(m_plmInstalled, plm);
    assign(m_systemPluginInstalled, systemPlugin);
    assign(m_loginScreenEnabled, enabled);
    assign(m_helperInstalled, !helper.isEmpty());
    assign(m_installCommand, cmd);
    assign(m_statusMessage, message);

    if (changed) {
        Q_EMIT statusChanged();
    }
}

void PlmGreeterSetup::enableLoginScreen()
{
    if (m_busy) {
        return;
    }
    if (!m_plmInstalled) {
        Q_EMIT enableFinished(false, tr("Plasma Login Manager is not installed."));
        return;
    }
    if (!m_systemPluginInstalled) {
        Q_EMIT enableFinished(false,
            tr("System install required first. Run in a terminal:\n%1").arg(m_installCommand));
        return;
    }
    const QString helper = helperExecutablePath();
    if (helper.isEmpty()) {
        Q_EMIT enableFinished(false,
            tr("Registration helper missing. Reinstall with:\n%1").arg(m_installCommand));
        return;
    }

    m_busy = true;
    Q_EMIT busyChanged();

    m_process = new QProcess(this);
    connect(m_process, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished), this,
            [this, helper](int exitCode, QProcess::ExitStatus status) {
                const QString stderrText = QString::fromUtf8(m_process->readAllStandardError()).trimmed();
                m_process->deleteLater();
                m_process = nullptr;
                m_busy = false;
                Q_EMIT busyChanged();
                refresh();

                if (exitCode == 0 && status == QProcess::NormalExit) {
                    if (!m_loginScreenEnabled) {
                        Q_EMIT enableFinished(false,
                            tr("Registration ran but PLM config did not pick it up. "
                               "Try in a terminal: sudo %1").arg(helper));
                        return;
                    }
                    Q_EMIT enableFinished(true, QString());
                } else if (exitCode == 126 || exitCode == 127) {
                    Q_EMIT enableFinished(false, tr("Could not run the helper (pkexec missing?)."));
                } else if (stderrText.contains(QStringLiteral("dismissed"), Qt::CaseInsensitive)) {
                    Q_EMIT enableFinished(false, tr("Administrator authorization was cancelled."));
                } else {
                    Q_EMIT enableFinished(false,
                        stderrText.isEmpty() ? tr("Registration failed.") : stderrText);
                }
            });

    m_process->start(QStringLiteral("pkexec"), {helper});
}

bool PlmGreeterSetup::openLoginScreenSettings()
{
    if (QProcess::startDetached(QStringLiteral("systemsettings"), {QStringLiteral("kcm_plasmalogin")})) {
        return true;
    }
    return QProcess::startDetached(QStringLiteral("kcmshell6"), {QStringLiteral("kcm_plasmalogin")});
}
