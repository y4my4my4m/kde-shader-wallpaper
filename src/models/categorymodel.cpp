// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "categorymodel.h"
#include "data/shaderlibrary.h"

CategoryModel::CategoryModel(QObject *parent)
    : QAbstractListModel(parent)
{
    m_library = ShaderLibrary::instance();
    
    connect(m_library, &ShaderLibrary::categoriesChanged, this, &CategoryModel::onCategoriesChanged);
    
    loadCategories();
}

CategoryModel::~CategoryModel() = default;

int CategoryModel::rowCount(const QModelIndex &parent) const
{
    if (parent.isValid()) return 0;
    return m_categories.count();
}

QVariant CategoryModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() >= m_categories.count()) {
        return QVariant();
    }
    
    const QString &category = m_categories.at(index.row());
    
    switch (role) {
        case NameRole:
            return category;
        case CountRole:
            return shaderCount(category);
        case IconRole:
            return categoryIcon(category);
        default:
            return QVariant();
    }
}

QHash<int, QByteArray> CategoryModel::roleNames() const
{
    static QHash<int, QByteArray> roles = {
        {NameRole, "name"},
        {CountRole, "count"},
        {IconRole, "icon"}
    };
    return roles;
}

int CategoryModel::currentIndex() const
{
    return m_categories.indexOf(m_currentCategory);
}

void CategoryModel::setCurrentCategory(const QString &category)
{
    if (m_currentCategory == category) return;
    m_currentCategory = category;
    Q_EMIT currentCategoryChanged();
    Q_EMIT currentIndexChanged();
}

void CategoryModel::setCurrentIndex(int index)
{
    if (index >= 0 && index < m_categories.count()) {
        setCurrentCategory(m_categories.at(index));
    }
}

void CategoryModel::refresh()
{
    loadCategories();
}

QString CategoryModel::get(int index) const
{
    if (index >= 0 && index < m_categories.count()) {
        return m_categories.at(index);
    }
    return QString();
}

int CategoryModel::indexOf(const QString &category) const
{
    return m_categories.indexOf(category);
}

int CategoryModel::shaderCount(const QString &category) const
{
    if (category.toLower() == QLatin1String("all")) {
        return m_library->shaderCount();
    }
    if (category.toLower() == QLatin1String("favorites")) {
        return m_library->favorites().count();
    }
    return m_library->shadersByCategory(category).count();
}

void CategoryModel::onCategoriesChanged()
{
    loadCategories();
}

void CategoryModel::loadCategories()
{
    beginResetModel();
    m_categories = m_library->categories();
    endResetModel();
    Q_EMIT countChanged();
}

QString CategoryModel::categoryIcon(const QString &category) const
{
    // Return appropriate icon names for each category
    static QMap<QString, QString> icons = {
        {QStringLiteral("All"), QStringLiteral("view-list-symbolic")},
        {QStringLiteral("Abstract"), QStringLiteral("preferences-desktop-color")},
        {QStringLiteral("Fractal"), QStringLiteral("view-grid-symbolic")},
        {QStringLiteral("Raymarching"), QStringLiteral("object-rotate-right")},
        {QStringLiteral("2D"), QStringLiteral("view-form")},
        {QStringLiteral("3D"), QStringLiteral("transform-shear")},
        {QStringLiteral("Audio Reactive"), QStringLiteral("audio-volume-high")},
        {QStringLiteral("Nature"), QStringLiteral("weather-clear")},
        {QStringLiteral("Space"), QStringLiteral("preferences-desktop-wallpaper")},
        {QStringLiteral("Retro"), QStringLiteral("preferences-desktop-gaming")},
        {QStringLiteral("Geometric"), QStringLiteral("kruler")},
        {QStringLiteral("Noise"), QStringLiteral("preferences-system-performance")},
        {QStringLiteral("Imported"), QStringLiteral("folder-download")},
        {QStringLiteral("Favorites"), QStringLiteral("emblem-favorite")}
    };
    
    return icons.value(category, QStringLiteral("applications-graphics"));
}

