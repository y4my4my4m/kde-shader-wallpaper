// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "shaderlistmodel.h"
#include "data/shaderlibrary.h"
#include "data/shadermetadata.h"

// ============================================================================
// ShaderListModel
// ============================================================================

ShaderListModel::ShaderListModel(QObject *parent)
    : QAbstractListModel(parent)
{
    m_library = ShaderLibrary::instance();
    
    connect(m_library, &ShaderLibrary::shaderAdded, this, &ShaderListModel::onShaderAdded);
    connect(m_library, &ShaderLibrary::shaderRemoved, this, &ShaderListModel::onShaderRemoved);
    connect(m_library, &ShaderLibrary::shaderUpdated, this, &ShaderListModel::onShaderUpdated);
    
    refresh();
}

ShaderListModel::~ShaderListModel() = default;

int ShaderListModel::rowCount(const QModelIndex &parent) const
{
    if (parent.isValid()) return 0;
    return m_shaders.count();
}

QVariant ShaderListModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() >= m_shaders.count()) {
        return QVariant();
    }
    
    ShaderMetadata *shader = m_shaders.at(index.row());
    if (!shader) return QVariant();
    
    switch (role) {
        case IdRole: return shader->id();
        case NameRole: return shader->name();
        case AuthorRole: return shader->author();
        case DescriptionRole: return shader->description();
        case CategoryRole: return shader->category();
        case TagsRole: return shader->tags();
        case ShaderPathRole: return shader->shaderPath();
        case ThumbnailPathRole: return shader->thumbnailPath();
        case SourceRole: return shader->source();
        case SourceIdRole: return shader->sourceId();
        case LikesRole: return shader->likes();
        case ViewsRole: return shader->views();
        case FavoriteRole: return shader->favorite();
        case HasBuffersRole: return shader->hasBuffers();
        case NeedsAudioRole: return shader->needsAudio();
        case NeedsTexturesRole: return shader->needsTextures();
        case MetadataRole: return QVariant::fromValue(shader);
        // Performance metrics
        case PerformanceTierRole: return shader->performanceTier();
        case AverageFrameTimeRole: return shader->averageFrameTime();
        case EstimatedPowerCostRole: return shader->estimatedPowerCost();
        case LastMeasuredDateRole: return shader->lastMeasuredDate();
        default: return QVariant();
    }
}

QHash<int, QByteArray> ShaderListModel::roleNames() const
{
    static QHash<int, QByteArray> roles = {
        {IdRole, "shaderId"},
        {NameRole, "name"},
        {AuthorRole, "author"},
        {DescriptionRole, "description"},
        {CategoryRole, "category"},
        {TagsRole, "tags"},
        {ShaderPathRole, "shaderPath"},
        {ThumbnailPathRole, "thumbnailPath"},
        {SourceRole, "source"},
        {SourceIdRole, "sourceId"},
        {LikesRole, "likes"},
        {ViewsRole, "views"},
        {FavoriteRole, "favorite"},
        {HasBuffersRole, "hasBuffers"},
        {NeedsAudioRole, "needsAudio"},
        {NeedsTexturesRole, "needsTextures"},
        {MetadataRole, "metadata"},
        // Performance metrics
        {PerformanceTierRole, "performanceTier"},
        {AverageFrameTimeRole, "averageFrameTime"},
        {EstimatedPowerCostRole, "estimatedPowerCost"},
        {LastMeasuredDateRole, "lastMeasuredDate"}
    };
    return roles;
}

void ShaderListModel::setCategory(const QString &category)
{
    if (m_category == category) return;
    m_category = category;
    applyFilters();
    Q_EMIT categoryChanged();
}

void ShaderListModel::setSearchQuery(const QString &query)
{
    if (m_searchQuery == query) return;
    m_searchQuery = query;
    applyFilters();
    Q_EMIT searchQueryChanged();
}

void ShaderListModel::setShowFavoritesOnly(bool show)
{
    if (m_showFavoritesOnly == show) return;
    m_showFavoritesOnly = show;
    applyFilters();
    Q_EMIT showFavoritesOnlyChanged();
}

void ShaderListModel::refresh()
{
    applyFilters();
}

ShaderMetadata* ShaderListModel::get(int index) const
{
    if (index >= 0 && index < m_shaders.count()) {
        return m_shaders.at(index);
    }
    return nullptr;
}

int ShaderListModel::indexOf(const QString &id) const
{
    for (int i = 0; i < m_shaders.count(); i++) {
        if (m_shaders.at(i)->id() == id) {
            return i;
        }
    }
    return -1;
}

void ShaderListModel::toggleFavorite(int index)
{
    if (index >= 0 && index < m_shaders.count()) {
        ShaderMetadata *shader = m_shaders.at(index);
        m_library->toggleFavorite(shader->id());
        Q_EMIT dataChanged(createIndex(index, 0), createIndex(index, 0), {FavoriteRole});
    }
}

void ShaderListModel::onShaderAdded(const QString &id)
{
    Q_UNUSED(id)
    applyFilters();
}

void ShaderListModel::onShaderRemoved(const QString &id)
{
    int index = indexOf(id);
    if (index >= 0) {
        beginRemoveRows(QModelIndex(), index, index);
        m_shaders.removeAt(index);
        endRemoveRows();
        Q_EMIT countChanged();
    }
}

void ShaderListModel::onShaderUpdated(const QString &id)
{
    int index = indexOf(id);
    if (index >= 0) {
        Q_EMIT dataChanged(createIndex(index, 0), createIndex(index, 0));
    }
}

void ShaderListModel::applyFilters()
{
    beginResetModel();
    
    // Get base list
    if (m_showFavoritesOnly) {
        m_shaders = m_library->favorites();
    } else if (!m_category.isEmpty() && m_category.toLower() != QStringLiteral("all")) {
        m_shaders = m_library->shadersByCategory(m_category);
    } else {
        m_shaders = m_library->allShaders();
    }
    
    // Apply search filter
    if (!m_searchQuery.isEmpty()) {
        QList<ShaderMetadata*> filtered;
        for (auto shader : m_shaders) {
            if (shader->matchesSearch(m_searchQuery)) {
                filtered.append(shader);
            }
        }
        m_shaders = filtered;
    }
    
    endResetModel();
    Q_EMIT countChanged();
}

// ============================================================================
// ShaderSortFilterModel
// ============================================================================

ShaderSortFilterModel::ShaderSortFilterModel(QObject *parent)
    : QSortFilterProxyModel(parent)
{
    setDynamicSortFilter(true);
}

ShaderListModel* ShaderSortFilterModel::shaderSourceModel() const
{
    return qobject_cast<ShaderListModel*>(sourceModel());
}

void ShaderSortFilterModel::setShaderSourceModel(ShaderListModel *model)
{
    if (sourceModel() == model) return;
    setSourceModel(model);
    Q_EMIT sourceModelChanged();
}

void ShaderSortFilterModel::setSortRoleName(const QString &role)
{
    if (m_sortRoleName == role) return;
    m_sortRoleName = role;
    
    // Map role name to role enum
    auto roles = roleNames();
    for (auto it = roles.begin(); it != roles.end(); ++it) {
        if (it.value() == role.toLatin1()) {
            setSortRole(it.key());
            break;
        }
    }
    
    sort(0, m_sortAscending ? Qt::AscendingOrder : Qt::DescendingOrder);
    Q_EMIT sortRoleChanged();
}

void ShaderSortFilterModel::setSortAscending(bool ascending)
{
    if (m_sortAscending == ascending) return;
    m_sortAscending = ascending;
    sort(0, m_sortAscending ? Qt::AscendingOrder : Qt::DescendingOrder);
    Q_EMIT sortAscendingChanged();
}

ShaderMetadata* ShaderSortFilterModel::get(int index) const
{
    QModelIndex sourceIndex = mapToSource(this->index(index, 0));
    if (!sourceIndex.isValid()) return nullptr;
    
    auto model = shaderSourceModel();
    if (model) {
        return model->get(sourceIndex.row());
    }
    return nullptr;
}

bool ShaderSortFilterModel::lessThan(const QModelIndex &left, const QModelIndex &right) const
{
    QVariant leftData = sourceModel()->data(left, sortRole());
    QVariant rightData = sourceModel()->data(right, sortRole());
    
    // Handle different types
    if (leftData.typeId() == QMetaType::QString) {
        return leftData.toString().compare(rightData.toString(), Qt::CaseInsensitive) < 0;
    }
    
    if (leftData.typeId() == QMetaType::Int) {
        return leftData.toInt() < rightData.toInt();
    }
    
    if (leftData.typeId() == QMetaType::Bool) {
        return leftData.toBool() < rightData.toBool();
    }
    
    return QSortFilterProxyModel::lessThan(left, right);
}

