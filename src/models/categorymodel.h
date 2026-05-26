// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#ifndef CATEGORYMODEL_H
#define CATEGORYMODEL_H

#include <QAbstractListModel>
#include <QtQml/qqmlregistration.h>
#include <QStringList>

class ShaderLibrary;

/**
 * @brief List model for shader categories
 */
class CategoryModel : public QAbstractListModel
{
    Q_OBJECT
    QML_ELEMENT

    Q_PROPERTY(int count READ count NOTIFY countChanged)
    Q_PROPERTY(QString currentCategory READ currentCategory WRITE setCurrentCategory NOTIFY currentCategoryChanged)
    Q_PROPERTY(int currentIndex READ currentIndex WRITE setCurrentIndex NOTIFY currentIndexChanged)

public:
    enum Roles {
        NameRole = Qt::UserRole + 1,
        CountRole,
        IconRole
    };
    Q_ENUM(Roles)

    explicit CategoryModel(QObject *parent = nullptr);
    ~CategoryModel() override;

    // QAbstractListModel interface
    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

    // Property getters
    int count() const { return m_categories.count(); }
    QString currentCategory() const { return m_currentCategory; }
    int currentIndex() const;

    // Property setters
    void setCurrentCategory(const QString &category);
    void setCurrentIndex(int index);

    // Methods
    Q_INVOKABLE void refresh();
    Q_INVOKABLE QString get(int index) const;
    Q_INVOKABLE int indexOf(const QString &category) const;
    Q_INVOKABLE int shaderCount(const QString &category) const;

Q_SIGNALS:
    void countChanged();
    void currentCategoryChanged();
    void currentIndexChanged();

private Q_SLOTS:
    void onCategoriesChanged();

private:
    void loadCategories();
    QString categoryIcon(const QString &category) const;

    QStringList m_categories;
    QString m_currentCategory = QStringLiteral("All");
    ShaderLibrary *m_library = nullptr;
};

#endif // CATEGORYMODEL_H

