// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#ifndef SHADERLIBRARY_H
#define SHADERLIBRARY_H

#include <QObject>
#include <QtQml/qqmlregistration.h>
#include <QString>
#include <QStringList>
#include <QUrl>
#include <QList>
#include <QMap>
#include <memory>

#include "shadermetadata.h"

/**
 * @brief Manages the shader library (local and imported shaders)
 * 
 * Provides:
 * - Shader indexing and discovery
 * - Category management
 * - Search and filtering
 * - Thumbnail generation
 * - Favorites management
 */
class QQmlEngine;
class QJSEngine;

class ShaderLibrary : public QObject
{
    Q_OBJECT
    // NOTE: deliberately NOT using QML_SINGLETON / QML_ELEMENT here.
    //
    // Those macros tell qmltyperegistrar to register the class as a QML
    // singleton named "ShaderLibrary", which Qt instantiates via its own
    // default-constructor factory. That ends up creating a SECOND copy
    // alongside the one ShaderLibrary::instance() returns, and the two
    // singletons silently desynchronise (different m_shaders, different
    // categories, etc.) — which manifested as "getShaderByPath is not a
    // function" because the QML-engine-managed singleton hasn't had its
    // metaobject fully wired up yet at first access.
    //
    // We register the singleton manually in shaderwallpaperplugin.cpp,
    // returning ShaderLibrary::instance() so there's exactly one of us.

    Q_PROPERTY(QString libraryPath READ libraryPath WRITE setLibraryPath NOTIFY libraryPathChanged)
    Q_PROPERTY(int shaderCount READ shaderCount NOTIFY shaderCountChanged)
    Q_PROPERTY(QStringList categories READ categories NOTIFY categoriesChanged)
    Q_PROPERTY(bool loading READ loading NOTIFY loadingChanged)

public:
    // Default categories
    static const QStringList DEFAULT_CATEGORIES;

    explicit ShaderLibrary(QObject *parent = nullptr);
    ~ShaderLibrary() override;

    static ShaderLibrary* instance();
    static ShaderLibrary* create(QQmlEngine *qmlEngine, QJSEngine *jsEngine);

    // Property getters
    QString libraryPath() const { return m_libraryPath; }
    int shaderCount() const { return m_shaders.count(); }
    QStringList categories() const { return m_categories; }
    bool loading() const { return m_loading; }

    // Property setters
    void setLibraryPath(const QString &path);

    /**
     * @brief Scan library path for shaders
     */
    Q_INVOKABLE void refresh();
    
    /**
     * @brief Get all shaders
     */
    Q_INVOKABLE QList<ShaderMetadata*> allShaders() const;
    
    /**
     * @brief Get shaders in a category
     */
    Q_INVOKABLE QList<ShaderMetadata*> shadersByCategory(const QString &category) const;
    
    /**
     * @brief Search shaders by query
     */
    Q_INVOKABLE QList<ShaderMetadata*> search(const QString &query) const;
    
    /**
     * @brief Get shader by ID
     */
    Q_INVOKABLE ShaderMetadata* getShader(const QString &id) const;
    
    /**
     * @brief Get shader by path
     */
    Q_INVOKABLE ShaderMetadata* getShaderByPath(const QUrl &path) const;
    
    /**
     * @brief Add a shader to the library
     */
    Q_INVOKABLE bool addShader(ShaderMetadata *metadata);
    
    /**
     * @brief Remove a shader from the library
     */
    Q_INVOKABLE bool removeShader(const QString &id);
    
    /**
     * @brief Update shader metadata
     */
    Q_INVOKABLE bool updateShader(ShaderMetadata *metadata);
    
    /**
     * @brief Toggle favorite status
     */
    Q_INVOKABLE void toggleFavorite(const QString &id);
    
    /**
     * @brief Get favorite shaders
     */
    Q_INVOKABLE QList<ShaderMetadata*> favorites() const;
    
    /**
     * @brief Add a new category
     */
    Q_INVOKABLE void addCategory(const QString &category);
    
    /**
     * @brief Remove a category
     */
    Q_INVOKABLE void removeCategory(const QString &category);
    
    /**
     * @brief Generate thumbnail for a shader (placeholder - use saveThumbnail)
     */
    Q_INVOKABLE void generateThumbnail(const QString &id);
    
    /**
     * @brief Generate all missing thumbnails
     */
    Q_INVOKABLE void generateAllThumbnails();
    
    /**
     * @brief Save a thumbnail image for a shader
     * @param shaderId The shader's ID
     * @param imagePath Path to the captured image
     * @return The saved thumbnail URL
     */
    Q_INVOKABLE QUrl saveThumbnail(const QString &shaderId, const QString &imagePath);
    
    /**
     * @brief Get the thumbnail path for a shader
     * @param shaderId The shader's ID
     * @return The path where the thumbnail should be saved
     */
    Q_INVOKABLE QString getThumbnailPath(const QString &shaderId) const;
    
    /**
     * @brief Check if a shader needs a thumbnail
     */
    Q_INVOKABLE bool needsThumbnail(const QString &shaderId) const;

    /**
     * @brief Detach-launch an external process (used for the "Get New
     *        Shaders" KNS dialog and "Open in external editor"). Returns
     *        true if the process was successfully spawned (Qt doesn't
     *        tell us whether the program found its target file).
     */
    Q_INVOKABLE bool launchExternal(const QString &program, const QStringList &args = {});
    
    /**
     * @brief Import shader from file
     */
    Q_INVOKABLE bool importShader(const QUrl &path, const QString &category = QStringLiteral("Imported"));
    
    /**
     * @brief Import shader from Shadertoy
     */
    Q_INVOKABLE bool importFromShadertoy(const QString &code, const QVariantMap &metadata);
    
    /**
     * @brief Save library index to disk
     */
    Q_INVOKABLE void save();
    
    /**
     * @brief Get paths to buffer files associated with a shader
     * @param shaderPath Path to the main shader file
     * @return Map of buffer names (BufferA, BufferB, etc.) to file paths
     * 
     * Looks for files following naming convention:
     * - shader.frag -> shader_bufferA.frag, shader_bufferB.frag, etc.
     */
    Q_INVOKABLE QVariantMap getBufferFilePaths(const QUrl &shaderPath) const;
    
    /**
     * @brief Load shader code from a file
     * @param filePath Path to the shader file
     * @return The shader code, or empty string on error
     */
    Q_INVOKABLE QString loadShaderCode(const QUrl &filePath) const;
    
    /**
     * @brief Load all buffer codes for a shader
     * @param shaderPath Path to the main shader file
     * @return Map of buffer names (bufferACode, bufferBCode, etc.) to shader code
     */
    Q_INVOKABLE QVariantMap loadBufferCodes(const QUrl &shaderPath) const;
    
    /**
     * @brief Check if a shader has associated buffer files
     * @param shaderPath Path to the main shader file
     * @return True if at least one buffer file exists
     */
    Q_INVOKABLE bool hasBufferFiles(const QUrl &shaderPath) const;
    
    /**
     * @brief Save a shader package (main + buffers + config) to a directory
     * @param directory Target directory path
     * @param mainCode Main shader code
     * @param bufferCodes Map of buffer names to code
     * @param config Additional configuration (channel mappings, etc.)
     * @return True on success
     */
    Q_INVOKABLE bool saveShaderPackage(const QUrl &directory, const QString &mainCode, 
                                       const QVariantMap &bufferCodes, const QVariantMap &config);
    
    /**
     * @brief Load a shader package from a directory
     * @param directory Path to the shader package directory
     * @return Map containing mainCode, bufferCodes, and config
     */
    Q_INVOKABLE QVariantMap loadShaderPackage(const QUrl &directory) const;

    /**
     * @brief Overwrite an existing single-file shader with new GLSL code.
     *
     * Used by the Shader Tweaks panel's "Save" action to commit the
     * tweaked literals back to disk. Refuses to write into the system
     * package directory (under /usr) to protect distro installs, and
     * writes atomically via a temp file + rename so a crash mid-write
     * can't corrupt the original.
     *
     * @return true on success.
     */
    Q_INVOKABLE bool saveShaderCode(const QUrl &filePath, const QString &code);

    /**
     * @brief Save the given GLSL as a new shader file in the user's
     * Imported library. Used by Tweaks' "Save As" action.
     *
     * @param displayName User-supplied human-readable name. Will be
     *                    sanitised to produce a safe filename.
     * @param code        Full GLSL source.
     * @param category    Category to file the new shader under
     *                    (defaults to "Imported").
     * @return The QUrl of the freshly-written shader file, or an empty
     *         URL on failure.
     */
    Q_INVOKABLE QUrl saveShaderAs(const QString &displayName, const QString &code,
                                  const QString &category = QStringLiteral("Imported"));

Q_SIGNALS:
    void libraryPathChanged();
    void shaderCountChanged();
    void categoriesChanged();
    void loadingChanged();
    void shaderAdded(const QString &id);
    void shaderRemoved(const QString &id);
    void shaderUpdated(const QString &id);
    void thumbnailGenerated(const QString &id, const QUrl &thumbnailPath);
    void error(const QString &message);

private:
    void loadIndex();
    void saveIndex();
    void scanDirectory(const QString &path, const QString &category);
    ShaderMetadata* createMetadataFromFile(const QString &path, const QString &category);
    ShaderMetadata* createMetadataFromPackage(const QString &packagePath, const QString &category);
    QString detectCategory(const QString &shaderCode);
    QString generateShaderName(const QString &path);
    
    static ShaderLibrary* s_instance;
    
    QString m_libraryPath;
    QList<std::shared_ptr<ShaderMetadata>> m_shaders;
    QMap<QString, std::shared_ptr<ShaderMetadata>> m_shaderMap; // By ID
    QMap<QString, std::shared_ptr<ShaderMetadata>> m_pathMap;   // By path
    QStringList m_categories;
    bool m_loading = false;
};

#endif // SHADERLIBRARY_H

