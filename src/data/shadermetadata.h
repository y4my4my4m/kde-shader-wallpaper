// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#ifndef SHADERMETADATA_H
#define SHADERMETADATA_H

#include <QObject>
#include <QtQml/qqmlregistration.h>
#include <QString>
#include <QStringList>
#include <QUrl>
#include <QVariantMap>
#include <QJsonObject>

/**
 * @brief Holds metadata for a shader
 */
class ShaderMetadata : public QObject
{
    Q_OBJECT
    QML_ELEMENT

    Q_PROPERTY(QString id READ id WRITE setId NOTIFY idChanged)
    Q_PROPERTY(QString name READ name WRITE setName NOTIFY nameChanged)
    Q_PROPERTY(QString author READ author WRITE setAuthor NOTIFY authorChanged)
    Q_PROPERTY(QString description READ description WRITE setDescription NOTIFY descriptionChanged)
    Q_PROPERTY(QString category READ category WRITE setCategory NOTIFY categoryChanged)
    Q_PROPERTY(QStringList tags READ tags WRITE setTags NOTIFY tagsChanged)
    Q_PROPERTY(QUrl shaderPath READ shaderPath WRITE setShaderPath NOTIFY shaderPathChanged)
    Q_PROPERTY(QUrl thumbnailPath READ thumbnailPath WRITE setThumbnailPath NOTIFY thumbnailPathChanged)
    Q_PROPERTY(QString source READ source WRITE setSource NOTIFY sourceChanged)
    Q_PROPERTY(QString sourceId READ sourceId WRITE setSourceId NOTIFY sourceIdChanged)
    Q_PROPERTY(int likes READ likes WRITE setLikes NOTIFY likesChanged)
    Q_PROPERTY(int views READ views WRITE setViews NOTIFY viewsChanged)
    Q_PROPERTY(bool favorite READ favorite WRITE setFavorite NOTIFY favoriteChanged)
    Q_PROPERTY(bool hasBuffers READ hasBuffers WRITE setHasBuffers NOTIFY hasBufChanged)
    Q_PROPERTY(bool needsAudio READ needsAudio WRITE setNeedsAudio NOTIFY needsAudioChanged)
    Q_PROPERTY(bool needsTextures READ needsTextures WRITE setNeedsTextures NOTIFY needsTexturesChanged)
    
    // Performance metrics
    Q_PROPERTY(int performanceTier READ performanceTier WRITE setPerformanceTier NOTIFY performanceChanged)
    Q_PROPERTY(qreal averageFrameTime READ averageFrameTime WRITE setAverageFrameTime NOTIFY performanceChanged)
    Q_PROPERTY(int estimatedPowerCost READ estimatedPowerCost WRITE setEstimatedPowerCost NOTIFY performanceChanged)
    Q_PROPERTY(QString lastMeasuredDate READ lastMeasuredDate WRITE setLastMeasuredDate NOTIFY performanceChanged)

    // True if this shader's file also exists under /usr/share/...
    // i.e. the PLM greeter (which only reads /usr) can actually load it.
    // Stock shaders are always true; user imports under ~/.local only are false.
    // Set by ShaderLibrary at scan time.
    Q_PROPERTY(bool greeterAvailable READ greeterAvailable WRITE setGreeterAvailable NOTIFY greeterAvailableChanged)

public:
    explicit ShaderMetadata(QObject *parent = nullptr);
    explicit ShaderMetadata(const QJsonObject &json, QObject *parent = nullptr);
    ~ShaderMetadata() override;

    // Property getters
    QString id() const { return m_id; }
    QString name() const { return m_name; }
    QString author() const { return m_author; }
    QString description() const { return m_description; }
    QString category() const { return m_category; }
    QStringList tags() const { return m_tags; }
    QUrl shaderPath() const { return m_shaderPath; }
    QUrl thumbnailPath() const { return m_thumbnailPath; }
    QString source() const { return m_source; }
    QString sourceId() const { return m_sourceId; }
    int likes() const { return m_likes; }
    int views() const { return m_views; }
    bool favorite() const { return m_favorite; }
    bool hasBuffers() const { return m_hasBuffers; }
    bool needsAudio() const { return m_needsAudio; }
    bool needsTextures() const { return m_needsTextures; }
    int performanceTier() const { return m_performanceTier; }
    qreal averageFrameTime() const { return m_averageFrameTime; }
    int estimatedPowerCost() const { return m_estimatedPowerCost; }
    QString lastMeasuredDate() const { return m_lastMeasuredDate; }
    bool greeterAvailable() const { return m_greeterAvailable; }

    // Property setters
    void setId(const QString &id);
    void setName(const QString &name);
    void setAuthor(const QString &author);
    void setDescription(const QString &description);
    void setCategory(const QString &category);
    void setTags(const QStringList &tags);
    void setShaderPath(const QUrl &path);
    void setThumbnailPath(const QUrl &path);
    void setSource(const QString &source);
    void setSourceId(const QString &id);
    void setLikes(int likes);
    void setViews(int views);
    void setFavorite(bool favorite);
    void setHasBuffers(bool has);
    void setNeedsAudio(bool needs);
    void setNeedsTextures(bool needs);
    void setPerformanceTier(int tier);
    void setAverageFrameTime(qreal time);
    void setEstimatedPowerCost(int cost);
    void setLastMeasuredDate(const QString &date);
    void setGreeterAvailable(bool available);

    // Serialization
    Q_INVOKABLE QJsonObject toJson() const;
    Q_INVOKABLE void fromJson(const QJsonObject &json);
    Q_INVOKABLE QVariantMap toVariantMap() const;

    // Helpers
    Q_INVOKABLE bool matchesSearch(const QString &query) const;
    Q_INVOKABLE bool matchesCategory(const QString &cat) const;
    Q_INVOKABLE bool hasTag(const QString &tag) const;
    
    // Performance helpers
    Q_INVOKABLE QString performanceTierName() const;
    Q_INVOKABLE QString performanceTierColor() const;
    Q_INVOKABLE bool hasPerformanceData() const { return m_performanceTier >= 0; }

Q_SIGNALS:
    void idChanged();
    void nameChanged();
    void authorChanged();
    void descriptionChanged();
    void categoryChanged();
    void tagsChanged();
    void shaderPathChanged();
    void thumbnailPathChanged();
    void sourceChanged();
    void sourceIdChanged();
    void likesChanged();
    void viewsChanged();
    void favoriteChanged();
    void hasBufChanged();
    void needsAudioChanged();
    void needsTexturesChanged();
    void performanceChanged();
    void greeterAvailableChanged();

private:
    QString m_id;
    QString m_name;
    QString m_author;
    QString m_description;
    QString m_category;
    QStringList m_tags;
    QUrl m_shaderPath;
    QUrl m_thumbnailPath;
    QString m_source;      // "local", "shadertoy", "imported"
    QString m_sourceId;    // Original ID if from Shadertoy
    int m_likes = 0;
    int m_views = 0;
    bool m_favorite = false;
    bool m_hasBuffers = false;
    bool m_needsAudio = false;
    bool m_needsTextures = false;
    
    // Performance metrics
    int m_performanceTier = -1;  // -1 = not measured
    qreal m_averageFrameTime = 0.0;
    int m_estimatedPowerCost = 0;
    QString m_lastMeasuredDate;
    bool m_greeterAvailable = true;  // assume yes until ShaderLibrary says otherwise
};

#endif // SHADERMETADATA_H

