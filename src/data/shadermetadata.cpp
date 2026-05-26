// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "shadermetadata.h"

#include <QJsonArray>
#include <QUuid>

ShaderMetadata::ShaderMetadata(QObject *parent)
    : QObject(parent)
{
    m_id = QUuid::createUuid().toString(QUuid::WithoutBraces);
}

ShaderMetadata::ShaderMetadata(const QJsonObject &json, QObject *parent)
    : QObject(parent)
{
    fromJson(json);
}

ShaderMetadata::~ShaderMetadata() = default;

void ShaderMetadata::setId(const QString &id)
{
    if (m_id == id) return;
    m_id = id;
    Q_EMIT idChanged();
}

void ShaderMetadata::setName(const QString &name)
{
    if (m_name == name) return;
    m_name = name;
    Q_EMIT nameChanged();
}

void ShaderMetadata::setAuthor(const QString &author)
{
    if (m_author == author) return;
    m_author = author;
    Q_EMIT authorChanged();
}

void ShaderMetadata::setDescription(const QString &description)
{
    if (m_description == description) return;
    m_description = description;
    Q_EMIT descriptionChanged();
}

void ShaderMetadata::setCategory(const QString &category)
{
    if (m_category == category) return;
    m_category = category;
    Q_EMIT categoryChanged();
}

void ShaderMetadata::setTags(const QStringList &tags)
{
    if (m_tags == tags) return;
    m_tags = tags;
    Q_EMIT tagsChanged();
}

void ShaderMetadata::setShaderPath(const QUrl &path)
{
    if (m_shaderPath == path) return;
    m_shaderPath = path;
    Q_EMIT shaderPathChanged();
}

void ShaderMetadata::setThumbnailPath(const QUrl &path)
{
    if (m_thumbnailPath == path) return;
    m_thumbnailPath = path;
    Q_EMIT thumbnailPathChanged();
}

void ShaderMetadata::setSource(const QString &source)
{
    if (m_source == source) return;
    m_source = source;
    Q_EMIT sourceChanged();
}

void ShaderMetadata::setSourceId(const QString &id)
{
    if (m_sourceId == id) return;
    m_sourceId = id;
    Q_EMIT sourceIdChanged();
}

void ShaderMetadata::setLikes(int likes)
{
    if (m_likes == likes) return;
    m_likes = likes;
    Q_EMIT likesChanged();
}

void ShaderMetadata::setViews(int views)
{
    if (m_views == views) return;
    m_views = views;
    Q_EMIT viewsChanged();
}

void ShaderMetadata::setFavorite(bool favorite)
{
    if (m_favorite == favorite) return;
    m_favorite = favorite;
    Q_EMIT favoriteChanged();
}

void ShaderMetadata::setHasBuffers(bool has)
{
    if (m_hasBuffers == has) return;
    m_hasBuffers = has;
    Q_EMIT hasBufChanged();
}

void ShaderMetadata::setNeedsAudio(bool needs)
{
    if (m_needsAudio == needs) return;
    m_needsAudio = needs;
    Q_EMIT needsAudioChanged();
}

void ShaderMetadata::setNeedsTextures(bool needs)
{
    if (m_needsTextures == needs) return;
    m_needsTextures = needs;
    Q_EMIT needsTexturesChanged();
}

void ShaderMetadata::setPerformanceTier(int tier)
{
    if (m_performanceTier == tier) return;
    m_performanceTier = tier;
    Q_EMIT performanceChanged();
}

void ShaderMetadata::setAverageFrameTime(qreal time)
{
    if (qFuzzyCompare(m_averageFrameTime, time)) return;
    m_averageFrameTime = time;
    Q_EMIT performanceChanged();
}

void ShaderMetadata::setEstimatedPowerCost(int cost)
{
    if (m_estimatedPowerCost == cost) return;
    m_estimatedPowerCost = cost;
    Q_EMIT performanceChanged();
}

void ShaderMetadata::setLastMeasuredDate(const QString &date)
{
    if (m_lastMeasuredDate == date) return;
    m_lastMeasuredDate = date;
    Q_EMIT performanceChanged();
}

void ShaderMetadata::setGreeterAvailable(bool available)
{
    if (m_greeterAvailable == available) return;
    m_greeterAvailable = available;
    Q_EMIT greeterAvailableChanged();
}

QString ShaderMetadata::performanceTierName() const
{
    switch (m_performanceTier) {
        case 0: return QStringLiteral("Low");
        case 1: return QStringLiteral("Medium");
        case 2: return QStringLiteral("High");
        case 3: return QStringLiteral("Extreme");
        default: return QStringLiteral("Unknown");
    }
}

QString ShaderMetadata::performanceTierColor() const
{
    switch (m_performanceTier) {
        case 0: return QStringLiteral("#27ae60");   // Green
        case 1: return QStringLiteral("#f1c40f");   // Yellow
        case 2: return QStringLiteral("#e67e22");   // Orange
        case 3: return QStringLiteral("#e74c3c");   // Red
        default: return QStringLiteral("#95a5a6");  // Gray
    }
}

QJsonObject ShaderMetadata::toJson() const
{
    QJsonObject json;
    
    json[QStringLiteral("id")] = m_id;
    json[QStringLiteral("name")] = m_name;
    json[QStringLiteral("author")] = m_author;
    json[QStringLiteral("description")] = m_description;
    json[QStringLiteral("category")] = m_category;
    json[QStringLiteral("tags")] = QJsonArray::fromStringList(m_tags);
    json[QStringLiteral("shaderPath")] = m_shaderPath.toString();
    json[QStringLiteral("thumbnailPath")] = m_thumbnailPath.toString();
    json[QStringLiteral("source")] = m_source;
    json[QStringLiteral("sourceId")] = m_sourceId;
    json[QStringLiteral("likes")] = m_likes;
    json[QStringLiteral("views")] = m_views;
    json[QStringLiteral("favorite")] = m_favorite;
    json[QStringLiteral("hasBuffers")] = m_hasBuffers;
    json[QStringLiteral("needsAudio")] = m_needsAudio;
    json[QStringLiteral("needsTextures")] = m_needsTextures;
    
    // Performance metrics
    if (m_performanceTier >= 0) {
        json[QStringLiteral("performanceTier")] = m_performanceTier;
        json[QStringLiteral("averageFrameTime")] = m_averageFrameTime;
        json[QStringLiteral("estimatedPowerCost")] = m_estimatedPowerCost;
        json[QStringLiteral("lastMeasuredDate")] = m_lastMeasuredDate;
    }
    
    return json;
}

void ShaderMetadata::fromJson(const QJsonObject &json)
{
    setId(json[QStringLiteral("id")].toString());
    setName(json[QStringLiteral("name")].toString());
    setAuthor(json[QStringLiteral("author")].toString());
    setDescription(json[QStringLiteral("description")].toString());
    setCategory(json[QStringLiteral("category")].toString());
    
    QStringList tags;
    QJsonArray tagsArray = json[QStringLiteral("tags")].toArray();
    for (const auto &tag : tagsArray) {
        tags.append(tag.toString());
    }
    setTags(tags);
    
    setShaderPath(QUrl(json[QStringLiteral("shaderPath")].toString()));
    setThumbnailPath(QUrl(json[QStringLiteral("thumbnailPath")].toString()));
    setSource(json[QStringLiteral("source")].toString());
    setSourceId(json[QStringLiteral("sourceId")].toString());
    setLikes(json[QStringLiteral("likes")].toInt());
    setViews(json[QStringLiteral("views")].toInt());
    setFavorite(json[QStringLiteral("favorite")].toBool());
    setHasBuffers(json[QStringLiteral("hasBuffers")].toBool());
    setNeedsAudio(json[QStringLiteral("needsAudio")].toBool());
    setNeedsTextures(json[QStringLiteral("needsTextures")].toBool());
    
    // Performance metrics (optional)
    if (json.contains(QStringLiteral("performanceTier"))) {
        setPerformanceTier(json[QStringLiteral("performanceTier")].toInt());
        setAverageFrameTime(json[QStringLiteral("averageFrameTime")].toDouble());
        setEstimatedPowerCost(json[QStringLiteral("estimatedPowerCost")].toInt());
        setLastMeasuredDate(json[QStringLiteral("lastMeasuredDate")].toString());
    }
}

QVariantMap ShaderMetadata::toVariantMap() const
{
    return toJson().toVariantMap();
}

bool ShaderMetadata::matchesSearch(const QString &query) const
{
    if (query.isEmpty()) return true;
    
    QString lowerQuery = query.toLower();
    
    if (m_name.toLower().contains(lowerQuery)) return true;
    if (m_author.toLower().contains(lowerQuery)) return true;
    if (m_description.toLower().contains(lowerQuery)) return true;
    if (m_category.toLower().contains(lowerQuery)) return true;
    
    for (const QString &tag : m_tags) {
        if (tag.toLower().contains(lowerQuery)) return true;
    }
    
    return false;
}

bool ShaderMetadata::matchesCategory(const QString &cat) const
{
    if (cat.isEmpty() || cat.toLower() == QLatin1String("all")) return true;
    return m_category.toLower() == cat.toLower();
}

bool ShaderMetadata::hasTag(const QString &tag) const
{
    for (const QString &t : m_tags) {
        if (t.toLower() == tag.toLower()) return true;
    }
    return false;
}

