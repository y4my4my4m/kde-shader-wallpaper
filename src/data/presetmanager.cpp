// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "presetmanager.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonDocument>
#include <QJsonArray>
#include <QStandardPaths>
#include <QDateTime>

PresetManager::PresetManager(QObject *parent)
    : QObject(parent)
{
    // Default presets path
    QString dataPath = QStandardPaths::writableLocation(QStandardPaths::GenericDataLocation);
    m_presetsPath = dataPath + QStringLiteral("/shaderwallpaper/presets");
    
    ensurePresetsDirectory();
    refresh();
}

PresetManager::~PresetManager() = default;

QStringList PresetManager::presetNames() const
{
    return m_presetNames;
}

int PresetManager::presetCount() const
{
    return m_presetNames.count();
}

void PresetManager::setPresetsPath(const QString &path)
{
    if (m_presetsPath == path) return;
    m_presetsPath = path;
    ensurePresetsDirectory();
    refresh();
    Q_EMIT presetsPathChanged();
}

void PresetManager::setCurrentPreset(const QString &name)
{
    if (m_currentPreset == name) return;
    m_currentPreset = name;
    Q_EMIT currentPresetChanged();
}

bool PresetManager::savePreset(const QString &name, const QVariantMap &config)
{
    if (name.isEmpty()) {
        Q_EMIT error(QStringLiteral("Preset name cannot be empty"));
        return false;
    }
    
    ensurePresetsDirectory();
    
    QString filePath = presetFilePath(name);
    QFile file(filePath);
    
    if (!file.open(QIODevice::WriteOnly)) {
        Q_EMIT error(QStringLiteral("Failed to save preset: %1").arg(file.errorString()));
        return false;
    }
    
    QJsonObject json = configToJson(config);
    
    // Add metadata
    json[QStringLiteral("name")] = name;
    json[QStringLiteral("created")] = QDateTime::currentDateTime().toString(Qt::ISODate);
    json[QStringLiteral("version")] = 1;
    
    QJsonDocument doc(json);
    file.write(doc.toJson(QJsonDocument::Indented));
    file.close();
    
    // Update list
    if (!m_presetNames.contains(name)) {
        m_presetNames.append(name);
        m_presetNames.sort();
        Q_EMIT presetNamesChanged();
        Q_EMIT presetCountChanged();
    }
    
    setCurrentPreset(name);
    Q_EMIT presetSaved(name);
    
    return true;
}

QVariantMap PresetManager::loadPreset(const QString &name)
{
    QString filePath = presetFilePath(name);
    QFile file(filePath);
    
    if (!file.open(QIODevice::ReadOnly)) {
        Q_EMIT error(QStringLiteral("Failed to load preset: %1").arg(file.errorString()));
        return {};
    }
    
    QByteArray data = file.readAll();
    file.close();
    
    QJsonParseError parseError;
    QJsonDocument doc = QJsonDocument::fromJson(data, &parseError);
    
    if (parseError.error != QJsonParseError::NoError) {
        Q_EMIT error(QStringLiteral("Failed to parse preset: %1").arg(parseError.errorString()));
        return {};
    }
    
    QVariantMap config = jsonToConfig(doc.object());
    
    setCurrentPreset(name);
    Q_EMIT presetLoaded(name, config);
    
    return config;
}

bool PresetManager::deletePreset(const QString &name)
{
    QString filePath = presetFilePath(name);
    QFile file(filePath);
    
    if (!file.remove()) {
        Q_EMIT error(QStringLiteral("Failed to delete preset: %1").arg(file.errorString()));
        return false;
    }
    
    m_presetNames.removeAll(name);
    Q_EMIT presetNamesChanged();
    Q_EMIT presetCountChanged();
    Q_EMIT presetDeleted(name);
    
    if (m_currentPreset == name) {
        setCurrentPreset(QString());
    }
    
    return true;
}

bool PresetManager::renamePreset(const QString &oldName, const QString &newName)
{
    if (oldName == newName) return true;
    if (newName.isEmpty()) {
        Q_EMIT error(QStringLiteral("New name cannot be empty"));
        return false;
    }
    if (presetExists(newName)) {
        Q_EMIT error(QStringLiteral("A preset with that name already exists"));
        return false;
    }
    
    QString oldPath = presetFilePath(oldName);
    QString newPath = presetFilePath(newName);
    
    // Load, modify, and save with new name
    QFile file(oldPath);
    if (!file.open(QIODevice::ReadOnly)) {
        Q_EMIT error(QStringLiteral("Failed to read preset"));
        return false;
    }
    
    QJsonDocument doc = QJsonDocument::fromJson(file.readAll());
    file.close();
    
    QJsonObject json = doc.object();
    json[QStringLiteral("name")] = newName;
    
    QFile newFile(newPath);
    if (!newFile.open(QIODevice::WriteOnly)) {
        Q_EMIT error(QStringLiteral("Failed to write renamed preset"));
        return false;
    }
    
    newFile.write(QJsonDocument(json).toJson());
    newFile.close();
    
    // Delete old file
    QFile::remove(oldPath);
    
    // Update list
    m_presetNames.removeAll(oldName);
    m_presetNames.append(newName);
    m_presetNames.sort();
    Q_EMIT presetNamesChanged();
    
    if (m_currentPreset == oldName) {
        setCurrentPreset(newName);
    }
    
    return true;
}

bool PresetManager::duplicatePreset(const QString &name, const QString &newName)
{
    if (newName.isEmpty()) {
        Q_EMIT error(QStringLiteral("New name cannot be empty"));
        return false;
    }
    if (presetExists(newName)) {
        Q_EMIT error(QStringLiteral("A preset with that name already exists"));
        return false;
    }
    
    QVariantMap config = loadPreset(name);
    if (config.isEmpty()) {
        return false;
    }
    
    return savePreset(newName, config);
}

bool PresetManager::presetExists(const QString &name) const
{
    return m_presetNames.contains(name);
}

bool PresetManager::exportPreset(const QString &name, const QString &filePath)
{
    QString sourcePath = presetFilePath(name);
    return QFile::copy(sourcePath, filePath);
}

bool PresetManager::importPreset(const QString &filePath)
{
    QFile file(filePath);
    if (!file.open(QIODevice::ReadOnly)) {
        Q_EMIT error(QStringLiteral("Failed to read import file"));
        return false;
    }
    
    QJsonDocument doc = QJsonDocument::fromJson(file.readAll());
    file.close();
    
    if (!doc.isObject()) {
        Q_EMIT error(QStringLiteral("Invalid preset file format"));
        return false;
    }
    
    QJsonObject json = doc.object();
    QString name = json[QStringLiteral("name")].toString();
    
    if (name.isEmpty()) {
        // Use filename as preset name
        QFileInfo info(filePath);
        name = info.baseName();
    }
    
    // Avoid name collision
    QString baseName = name;
    int counter = 1;
    while (presetExists(name)) {
        name = QStringLiteral("%1 (%2)").arg(baseName).arg(counter++);
    }
    
    QVariantMap config = jsonToConfig(json);
    return savePreset(name, config);
}

QVariantMap PresetManager::getPresetInfo(const QString &name)
{
    QString filePath = presetFilePath(name);
    QFile file(filePath);
    
    if (!file.open(QIODevice::ReadOnly)) {
        return {};
    }
    
    QJsonDocument doc = QJsonDocument::fromJson(file.readAll());
    file.close();
    
    QJsonObject json = doc.object();
    
    QVariantMap info;
    info[QStringLiteral("name")] = json[QStringLiteral("name")].toString();
    info[QStringLiteral("created")] = json[QStringLiteral("created")].toString();
    info[QStringLiteral("shaderPath")] = json[QStringLiteral("shaderPath")].toString();
    info[QStringLiteral("shaderName")] = json[QStringLiteral("shaderName")].toString();
    
    return info;
}

void PresetManager::refresh()
{
    m_presetNames.clear();
    
    QDir dir(m_presetsPath);
    if (!dir.exists()) {
        Q_EMIT presetNamesChanged();
        Q_EMIT presetCountChanged();
        return;
    }
    
    QStringList filters;
    filters << QStringLiteral("*.json");
    
    QFileInfoList files = dir.entryInfoList(filters, QDir::Files, QDir::Name);
    for (const QFileInfo &info : files) {
        m_presetNames.append(info.baseName());
    }
    
    Q_EMIT presetNamesChanged();
    Q_EMIT presetCountChanged();
}

void PresetManager::ensurePresetsDirectory()
{
    QDir dir(m_presetsPath);
    if (!dir.exists()) {
        dir.mkpath(QStringLiteral("."));
    }
}

QString PresetManager::presetFilePath(const QString &name) const
{
    return m_presetsPath + QStringLiteral("/") + name + QStringLiteral(".json");
}

QJsonObject PresetManager::configToJson(const QVariantMap &config) const
{
    return QJsonObject::fromVariantMap(config);
}

QVariantMap PresetManager::jsonToConfig(const QJsonObject &json) const
{
    return json.toVariantMap();
}

QVariantMap PresetManager::createConfig(
    const QString &shaderPath,
    const QString &shaderCode,
    const QVariantMap &channels,
    qreal speed,
    bool mouseEnabled,
    qreal mouseBias,
    bool audioEnabled,
    int audioChannel,
    const QVariantMap &buffers,
    const QVariantMap &customUniforms)
{
    QVariantMap config;
    
    config[QStringLiteral("shaderPath")] = shaderPath;
    config[QStringLiteral("shaderCode")] = shaderCode;
    config[QStringLiteral("channels")] = channels;
    config[QStringLiteral("speed")] = speed;
    config[QStringLiteral("mouseEnabled")] = mouseEnabled;
    config[QStringLiteral("mouseBias")] = mouseBias;
    config[QStringLiteral("audioEnabled")] = audioEnabled;
    config[QStringLiteral("audioChannel")] = audioChannel;
    config[QStringLiteral("buffers")] = buffers;
    config[QStringLiteral("customUniforms")] = customUniforms;
    
    return config;
}

