// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#ifndef PLMGREETERSETUP_H
#define PLMGREETERSETUP_H

#include <QObject>
#include <QString>

class QProcess;

/**
 * @brief Plasma Login Manager greeter status + registration helper for QML.
 *
 * Reports whether PLM is the active display manager, whether Shader Wallpaper
 * is installed system-wide (a requirement for the pre-login greeter), and
 * whether /etc/plasmalogin.conf is registering the plugin. The enable button
 * runs the polkit-elevated helper that writes the conf file.
 */
class PlmGreeterSetup : public QObject
{
    Q_OBJECT

    // System state — read by the Login screen card in ConfigContent.qml.
    Q_PROPERTY(bool plmInstalled READ plmInstalled NOTIFY statusChanged)
    Q_PROPERTY(bool systemPluginInstalled READ systemPluginInstalled NOTIFY statusChanged)
    Q_PROPERTY(bool loginScreenEnabled READ loginScreenEnabled NOTIFY statusChanged)
    Q_PROPERTY(bool helperInstalled READ helperInstalled NOTIFY statusChanged)

    // One-line copy users can paste into a terminal to perform the system install.
    Q_PROPERTY(QString installCommand READ installCommand NOTIFY statusChanged)

    // Single state-dependent string the UI surfaces verbatim.
    Q_PROPERTY(QString statusMessage READ statusMessage NOTIFY statusChanged)

    Q_PROPERTY(bool busy READ busy NOTIFY busyChanged)

public:
    explicit PlmGreeterSetup(QObject *parent = nullptr);

    bool plmInstalled() const { return m_plmInstalled; }
    bool systemPluginInstalled() const { return m_systemPluginInstalled; }
    bool loginScreenEnabled() const { return m_loginScreenEnabled; }
    bool helperInstalled() const { return m_helperInstalled; }
    QString installCommand() const { return m_installCommand; }
    QString statusMessage() const { return m_statusMessage; }
    bool busy() const { return m_busy; }

    Q_INVOKABLE void refresh();
    Q_INVOKABLE void enableLoginScreen();
    Q_INVOKABLE bool openLoginScreenSettings();

Q_SIGNALS:
    void statusChanged();
    void busyChanged();
    void enableFinished(bool success, const QString &message);

private:
    QString helperExecutablePath() const;
    QString resolveInstallScript() const;

    bool m_plmInstalled = false;
    bool m_systemPluginInstalled = false;
    bool m_loginScreenEnabled = false;
    bool m_helperInstalled = false;
    bool m_busy = false;
    QString m_installCommand;
    QString m_statusMessage;

    QProcess *m_process = nullptr;
};

#endif // PLMGREETERSETUP_H
