// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#ifndef PRESETMANAGER_H
#define PRESETMANAGER_H

#include <QObject>
#include <QtQml/qqmlregistration.h>
#include <QString>
#include <QStringList>
#include <QVariantMap>
#include <QJsonObject>

/**
 * @brief Manages shader presets (saved configurations)
 * 
 * Presets store:
 * - Shader path/code
 * - iChannel configurations
 * - Speed and timing settings
 * - Mouse/audio settings
 * - Buffer configurations
 * - Custom uniform values
 */
class PresetManager : public QObject
{
    Q_OBJECT
    QML_ELEMENT

    Q_PROPERTY(QString presetsPath READ presetsPath WRITE setPresetsPath NOTIFY presetsPathChanged)
    Q_PROPERTY(QStringList presetNames READ presetNames NOTIFY presetNamesChanged)
    Q_PROPERTY(QString currentPreset READ currentPreset WRITE setCurrentPreset NOTIFY currentPresetChanged)
    Q_PROPERTY(int presetCount READ presetCount NOTIFY presetCountChanged)

public:
    explicit PresetManager(QObject *parent = nullptr);
    ~PresetManager() override;

    // Property getters
    QString presetsPath() const { return m_presetsPath; }
    QStringList presetNames() const;
    QString currentPreset() const { return m_currentPreset; }
    int presetCount() const;

    // Property setters
    void setPresetsPath(const QString &path);
    void setCurrentPreset(const QString &name);

    /**
     * @brief Save current configuration as a preset
     * @param name Preset name
     * @param config Configuration data
     * @return True on success
     */
    Q_INVOKABLE bool savePreset(const QString &name, const QVariantMap &config);
    
    /**
     * @brief Load a preset by name
     * @param name Preset name
     * @return Configuration data, empty on failure
     */
    Q_INVOKABLE QVariantMap loadPreset(const QString &name);
    
    /**
     * @brief Delete a preset
     * @param name Preset name
     * @return True on success
     */
    Q_INVOKABLE bool deletePreset(const QString &name);
    
    /**
     * @brief Rename a preset
     */
    Q_INVOKABLE bool renamePreset(const QString &oldName, const QString &newName);
    
    /**
     * @brief Duplicate a preset
     */
    Q_INVOKABLE bool duplicatePreset(const QString &name, const QString &newName);
    
    /**
     * @brief Check if preset exists
     */
    Q_INVOKABLE bool presetExists(const QString &name) const;
    
    /**
     * @brief Export preset to file
     */
    Q_INVOKABLE bool exportPreset(const QString &name, const QString &filePath);
    
    /**
     * @brief Import preset from file
     */
    Q_INVOKABLE bool importPreset(const QString &filePath);
    
    /**
     * @brief Get preset metadata (without loading full config)
     */
    Q_INVOKABLE QVariantMap getPresetInfo(const QString &name);
    
    /**
     * @brief Refresh preset list from disk
     */
    Q_INVOKABLE void refresh();

    // Helper to create config from current state
    static QVariantMap createConfig(
        const QString &shaderPath,
        const QString &shaderCode,
        const QVariantMap &channels,
        qreal speed,
        bool mouseEnabled,
        qreal mouseBias,
        bool audioEnabled,
        int audioChannel,
        const QVariantMap &buffers,
        const QVariantMap &customUniforms = {}
    );

Q_SIGNALS:
    void presetsPathChanged();
    void presetNamesChanged();
    void currentPresetChanged();
    void presetCountChanged();
    void presetSaved(const QString &name);
    void presetLoaded(const QString &name, const QVariantMap &config);
    void presetDeleted(const QString &name);
    void error(const QString &message);

private:
    void ensurePresetsDirectory();
    QString presetFilePath(const QString &name) const;
    QJsonObject configToJson(const QVariantMap &config) const;
    QVariantMap jsonToConfig(const QJsonObject &json) const;

    QString m_presetsPath;
    QString m_currentPreset;
    QStringList m_presetNames;
};

#endif // PRESETMANAGER_H

