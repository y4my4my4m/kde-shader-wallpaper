// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#ifndef SHADERLISTMODEL_H
#define SHADERLISTMODEL_H

#include <QAbstractListModel>
#include <QtQml/qqmlregistration.h>
#include <QSortFilterProxyModel>
#include <QList>

#include "../data/shadermetadata.h"

class ShaderLibrary;

/**
 * @brief List model for displaying shaders in QML
 */
class ShaderListModel : public QAbstractListModel
{
    Q_OBJECT
    QML_ELEMENT

    Q_PROPERTY(int count READ count NOTIFY countChanged)
    Q_PROPERTY(QString category READ category WRITE setCategory NOTIFY categoryChanged)
    Q_PROPERTY(QString searchQuery READ searchQuery WRITE setSearchQuery NOTIFY searchQueryChanged)
    Q_PROPERTY(bool showFavoritesOnly READ showFavoritesOnly WRITE setShowFavoritesOnly NOTIFY showFavoritesOnlyChanged)

public:
    enum Roles {
        IdRole = Qt::UserRole + 1,
        NameRole,
        AuthorRole,
        DescriptionRole,
        CategoryRole,
        TagsRole,
        ShaderPathRole,
        ThumbnailPathRole,
        SourceRole,
        SourceIdRole,
        LikesRole,
        ViewsRole,
        FavoriteRole,
        HasBuffersRole,
        NeedsAudioRole,
        NeedsTexturesRole,
        MetadataRole,
        // Performance metrics
        PerformanceTierRole,
        AverageFrameTimeRole,
        EstimatedPowerCostRole,
        LastMeasuredDateRole
    };
    Q_ENUM(Roles)

    explicit ShaderListModel(QObject *parent = nullptr);
    ~ShaderListModel() override;

    // QAbstractListModel interface
    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

    // Property getters
    int count() const { return m_shaders.count(); }
    QString category() const { return m_category; }
    QString searchQuery() const { return m_searchQuery; }
    bool showFavoritesOnly() const { return m_showFavoritesOnly; }

    // Property setters
    void setCategory(const QString &category);
    void setSearchQuery(const QString &query);
    void setShowFavoritesOnly(bool show);

    // Methods
    Q_INVOKABLE void refresh();
    Q_INVOKABLE ShaderMetadata* get(int index) const;
    Q_INVOKABLE int indexOf(const QString &id) const;
    Q_INVOKABLE void toggleFavorite(int index);

Q_SIGNALS:
    void countChanged();
    void categoryChanged();
    void searchQueryChanged();
    void showFavoritesOnlyChanged();

private Q_SLOTS:
    void onShaderAdded(const QString &id);
    void onShaderRemoved(const QString &id);
    void onShaderUpdated(const QString &id);

private:
    void applyFilters();

    QList<ShaderMetadata*> m_shaders;
    QString m_category;
    QString m_searchQuery;
    bool m_showFavoritesOnly = false;
    ShaderLibrary *m_library = nullptr;
};

/**
 * @brief Sortable/filterable proxy model for shaders
 */
class ShaderSortFilterModel : public QSortFilterProxyModel
{
    Q_OBJECT
    QML_ELEMENT

    Q_PROPERTY(ShaderListModel* sourceModel READ shaderSourceModel WRITE setShaderSourceModel NOTIFY sourceModelChanged)
    Q_PROPERTY(QString sortRole READ sortRoleName WRITE setSortRoleName NOTIFY sortRoleChanged)
    Q_PROPERTY(bool sortAscending READ sortAscending WRITE setSortAscending NOTIFY sortAscendingChanged)

public:
    explicit ShaderSortFilterModel(QObject *parent = nullptr);

    ShaderListModel* shaderSourceModel() const;
    void setShaderSourceModel(ShaderListModel *model);
    
    QString sortRoleName() const { return m_sortRoleName; }
    void setSortRoleName(const QString &role);
    
    bool sortAscending() const { return m_sortAscending; }
    void setSortAscending(bool ascending);

    Q_INVOKABLE ShaderMetadata* get(int index) const;

Q_SIGNALS:
    void sourceModelChanged();
    void sortRoleChanged();
    void sortAscendingChanged();

protected:
    bool lessThan(const QModelIndex &left, const QModelIndex &right) const override;

private:
    QString m_sortRoleName = QStringLiteral("name");
    bool m_sortAscending = true;
};

#endif // SHADERLISTMODEL_H

