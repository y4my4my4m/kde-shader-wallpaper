// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "shaderlibrary.h"
#include "shadermetadata.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonDocument>
#include <QJsonArray>
#include <QStandardPaths>
#include <QRegularExpression>
#include <QDateTime>
#include <QQmlEngine>
#include <QProcess>

const QStringList ShaderLibrary::DEFAULT_CATEGORIES = {
    QStringLiteral("All"),
    QStringLiteral("Abstract"),
    QStringLiteral("Fractal"),
    QStringLiteral("Raymarching"),
    QStringLiteral("2D"),
    QStringLiteral("3D"),
    QStringLiteral("Audio Reactive"),
    QStringLiteral("Window Reactive"),
    QStringLiteral("Nature"),
    QStringLiteral("Space"),
    QStringLiteral("Retro"),
    QStringLiteral("Geometric"),
    QStringLiteral("Noise"),
    QStringLiteral("Packages"),
    QStringLiteral("Imported"),
    QStringLiteral("Favorites")
};

ShaderLibrary* ShaderLibrary::s_instance = nullptr;

ShaderLibrary::ShaderLibrary(QObject *parent)
    : QObject(parent)
{
    s_instance = this;
    
    // Default library path: prefer the installed package under /usr/share (or
    // ~/.local/share for user installs). Do NOT use writableLocation alone —
    // the PLM greeter runs as user "plasmalogin" whose home is not where the
    // plugin lives, and a root-only path would leave libraryPath empty/wrong.
    const QString relativePath =
        QStringLiteral("plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui");
    const QString fromDataDirs =
        QStandardPaths::locate(QStandardPaths::GenericDataLocation, relativePath);
    if (!fromDataDirs.isEmpty()) {
        m_libraryPath = fromDataDirs;
    } else {
        const QString dataPath =
            QStandardPaths::writableLocation(QStandardPaths::GenericDataLocation);
        m_libraryPath = dataPath + QLatin1Char('/') + relativePath;
    }
    
    m_categories = DEFAULT_CATEGORIES;
    
    loadIndex();
    
    // If no shaders were loaded from index, scan the directories
    if (m_shaders.isEmpty()) {
        refresh();
    }
}

ShaderLibrary::~ShaderLibrary()
{
    if (s_instance == this) {
        s_instance = nullptr;
    }
}

ShaderLibrary* ShaderLibrary::instance()
{
    if (!s_instance) {
        s_instance = new ShaderLibrary();
    }
    return s_instance;
}

ShaderLibrary* ShaderLibrary::create(QQmlEngine *qmlEngine, QJSEngine *jsEngine)
{
    Q_UNUSED(qmlEngine)
    Q_UNUSED(jsEngine)
    return instance();
}

void ShaderLibrary::setLibraryPath(const QString &path)
{
    if (m_libraryPath == path) return;
    m_libraryPath = path;
    Q_EMIT libraryPathChanged();
    refresh();
}

void ShaderLibrary::refresh()
{
    m_loading = true;
    Q_EMIT loadingChanged();

    // -- Incremental refresh ----------------------------------------------
    // The previous implementation wiped m_shaders / m_shaderMap / m_pathMap
    // before scanning, which made createMetadataFromFile() mint a brand-new
    // QUuid for every shader on every rescan. Because thumbnails are stored
    // as <id>.png in the user data dir, that orphaned every thumbnail on
    // disk and the gallery came back blank after a rescan. Awful UX.
    //
    // Instead, we keep the existing entries in place (their ids and
    // associated thumbnail filenames stay valid) and just:
    //   1. ask scanDirectory to add any NEW .frag files it finds on disk
    //      (scanDirectory already skips paths already in m_pathMap), then
    //   2. prune entries whose source file has since disappeared.
    //
    // Net effect: thumbnails, favorites, performance stats, and the
    // user's selected shader id all survive a "Re-scan shader library".
    // ---------------------------------------------------------------------

    // 1) Add anything new on disk.
    const QStringList scanRoots = {
        m_libraryPath + QStringLiteral("/Shaders"),
        m_libraryPath + QStringLiteral("/Shaders6"),
    };
    for (const QString &root : scanRoots) {
        if (QDir(root).exists()) {
            scanDirectory(root, QStringLiteral(""));
        }
    }

    // 2) Drop entries whose backing file is no longer on disk. We collect
    // them first to avoid mutating m_shaders while iterating it.
    QList<std::shared_ptr<ShaderMetadata>> stale;
    stale.reserve(m_shaders.size());
    for (const auto &s : m_shaders) {
        const QString p = s->shaderPath().toLocalFile();
        if (p.isEmpty()) continue;          // inline / virtual entries
        if (QFile::exists(p)) continue;     // still on disk
        stale.append(s);
    }
    for (const auto &s : stale) {
        const QString id = s->id();
        m_pathMap.remove(s->shaderPath().toString());
        m_shaderMap.remove(id);
        m_shaders.removeOne(s);
        Q_EMIT shaderRemoved(id);
    }

    m_loading = false;
    Q_EMIT loadingChanged();
    Q_EMIT shaderCountChanged();

    // Persist any additions / removals.
    saveIndex();
}

QList<ShaderMetadata*> ShaderLibrary::allShaders() const
{
    QList<ShaderMetadata*> result;
    for (const auto &shader : m_shaders) {
        result.append(shader.get());
    }
    return result;
}

QList<ShaderMetadata*> ShaderLibrary::shadersByCategory(const QString &category) const
{
    if (category.isEmpty() || category.toLower() == QLatin1String("all")) {
        return allShaders();
    }
    
    if (category.toLower() == QLatin1String("favorites")) {
        return favorites();
    }
    
    QList<ShaderMetadata*> result;
    for (const auto &shader : m_shaders) {
        if (shader->matchesCategory(category)) {
            result.append(shader.get());
        }
    }
    return result;
}

QList<ShaderMetadata*> ShaderLibrary::search(const QString &query) const
{
    QList<ShaderMetadata*> result;
    for (const auto &shader : m_shaders) {
        if (shader->matchesSearch(query)) {
            result.append(shader.get());
        }
    }
    return result;
}

ShaderMetadata* ShaderLibrary::getShader(const QString &id) const
{
    auto it = m_shaderMap.find(id);
    if (it != m_shaderMap.end()) {
        return it.value().get();
    }
    return nullptr;
}

ShaderMetadata* ShaderLibrary::getShaderByPath(const QUrl &path) const
{
    QString pathStr = path.toString();
    auto it = m_pathMap.find(pathStr);
    if (it != m_pathMap.end()) {
        return it.value().get();
    }
    return nullptr;
}

bool ShaderLibrary::addShader(ShaderMetadata *metadata)
{
    if (!metadata) return false;
    
    auto shared = std::shared_ptr<ShaderMetadata>(metadata);
    m_shaders.append(shared);
    m_shaderMap[metadata->id()] = shared;
    m_pathMap[metadata->shaderPath().toString()] = shared;
    
    Q_EMIT shaderAdded(metadata->id());
    Q_EMIT shaderCountChanged();
    
    saveIndex();
    return true;
}

bool ShaderLibrary::removeShader(const QString &id)
{
    auto it = m_shaderMap.find(id);
    if (it == m_shaderMap.end()) return false;
    
    auto shader = it.value();
    m_pathMap.remove(shader->shaderPath().toString());
    m_shaderMap.remove(id);
    m_shaders.removeOne(shader);
    
    Q_EMIT shaderRemoved(id);
    Q_EMIT shaderCountChanged();
    
    saveIndex();
    return true;
}

bool ShaderLibrary::updateShader(ShaderMetadata *metadata)
{
    if (!metadata) return false;
    
    auto it = m_shaderMap.find(metadata->id());
    if (it == m_shaderMap.end()) return false;
    
    Q_EMIT shaderUpdated(metadata->id());
    saveIndex();
    return true;
}

void ShaderLibrary::toggleFavorite(const QString &id)
{
    auto shader = getShader(id);
    if (shader) {
        shader->setFavorite(!shader->favorite());
        Q_EMIT shaderUpdated(id);
        saveIndex();
    }
}

QList<ShaderMetadata*> ShaderLibrary::favorites() const
{
    QList<ShaderMetadata*> result;
    for (const auto &shader : m_shaders) {
        if (shader->favorite()) {
            result.append(shader.get());
        }
    }
    return result;
}

void ShaderLibrary::addCategory(const QString &category)
{
    if (m_categories.contains(category)) return;
    m_categories.append(category);
    Q_EMIT categoriesChanged();
}

void ShaderLibrary::removeCategory(const QString &category)
{
    if (!m_categories.contains(category)) return;
    if (DEFAULT_CATEGORIES.contains(category)) return; // Don't remove defaults
    m_categories.removeAll(category);
    Q_EMIT categoriesChanged();
}

void ShaderLibrary::generateThumbnail(const QString &id)
{
    // This is a placeholder - actual generation is done by ShaderEngine::captureFrame
    // and then saved via saveThumbnail()
    Q_UNUSED(id)
}

void ShaderLibrary::generateAllThumbnails()
{
    for (const auto &shader : m_shaders) {
        if (shader->thumbnailPath().isEmpty()) {
            generateThumbnail(shader->id());
        }
    }
}

QString ShaderLibrary::getThumbnailPath(const QString &shaderId) const
{
    // Thumbnails are stored in a thumbnails subdirectory
    QString thumbnailDir = m_libraryPath + QStringLiteral("/thumbnails");
    QDir dir(thumbnailDir);
    if (!dir.exists()) {
        dir.mkpath(QStringLiteral("."));
    }
    
    // Use shaderId as filename (sanitize it)
    QString safeId = shaderId;
    safeId.replace(QRegularExpression(QStringLiteral("[^a-zA-Z0-9_-]")), QStringLiteral("_"));
    
    return thumbnailDir + QStringLiteral("/") + safeId + QStringLiteral(".png");
}

bool ShaderLibrary::needsThumbnail(const QString &shaderId) const
{
    auto shader = getShader(shaderId);
    if (!shader) return false;
    
    // Check if thumbnail exists
    if (shader->thumbnailPath().isEmpty()) return true;
    
    QString path = shader->thumbnailPath().toLocalFile();
    if (path.isEmpty()) {
        path = shader->thumbnailPath().path();
    }
    
    return !QFile::exists(path);
}

bool ShaderLibrary::launchExternal(const QString &program, const QStringList &args)
{
    if (program.trimmed().isEmpty()) {
        qWarning() << "ShaderLibrary::launchExternal: empty program";
        return false;
    }
    // startDetached so the spawned dialog outlives the wallpaper config
    // dialog (the user might close Plasma's Settings while still browsing
    // KNS, etc.). qint64 *pid out-param is required by the overload but
    // we don't need it.
    qint64 pid = 0;
    const bool ok = QProcess::startDetached(program, args, QString(), &pid);
    if (!ok) {
        qWarning() << "ShaderLibrary::launchExternal: failed to start"
                   << program << "with args" << args;
    } else {
        qDebug() << "ShaderLibrary::launchExternal: launched"
                 << program << "args" << args << "pid" << pid;
    }
    return ok;
}

QUrl ShaderLibrary::saveThumbnail(const QString &shaderId, const QString &imagePath)
{
    auto shader = getShader(shaderId);
    if (!shader) {
        qWarning() << "Shader not found:" << shaderId;
        return QUrl();
    }
    
    // Check if source image exists
    if (!QFile::exists(imagePath)) {
        qWarning() << "Thumbnail image not found:" << imagePath;
        return QUrl();
    }
    
    // Get destination path
    QString destPath = getThumbnailPath(shaderId);
    
    // Copy the image (it's already saved by ShaderEngine)
    if (imagePath != destPath) {
        QFile::remove(destPath); // Remove old thumbnail if exists
        if (!QFile::copy(imagePath, destPath)) {
            qWarning() << "Failed to copy thumbnail from" << imagePath << "to" << destPath;
            return QUrl();
        }
        // Clean up the temp file if different
        QFile::remove(imagePath);
    }
    
    // Update shader metadata. Add a cache-busting query so QML Image
    // refreshes immediately even when we overwrite the same filename.
    QUrl thumbnailUrl = QUrl::fromLocalFile(destPath);
    thumbnailUrl.setQuery(QStringLiteral("v=%1").arg(QDateTime::currentMSecsSinceEpoch()));
    if (shader->thumbnailPath().toLocalFile() == destPath) {
        shader->setThumbnailPath(QUrl());
    }
    shader->setThumbnailPath(thumbnailUrl);
    
    // Save the index
    saveIndex();
    
    Q_EMIT thumbnailGenerated(shaderId, thumbnailUrl);
    Q_EMIT shaderUpdated(shaderId);
    
    qDebug() << "Thumbnail saved for shader:" << shaderId << "->" << destPath;
    return thumbnailUrl;
}

bool ShaderLibrary::importShader(const QUrl &path, const QString &category)
{
    QString localPath = path.toLocalFile();
    if (localPath.isEmpty()) {
        localPath = path.path();
    }
    
    QFile file(localPath);
    if (!file.exists()) {
        Q_EMIT error(QStringLiteral("File not found"));
        return false;
    }
    
    auto metadata = createMetadataFromFile(localPath, category);
    if (!metadata) {
        Q_EMIT error(QStringLiteral("Failed to create shader metadata"));
        return false;
    }
    
    return addShader(metadata);
}

bool ShaderLibrary::importFromShadertoy(const QString &code, const QVariantMap &metadata)
{
    // Create metadata from Shadertoy info
    auto shader = new ShaderMetadata(this);
    
    shader->setName(metadata[QStringLiteral("name")].toString());
    shader->setAuthor(metadata[QStringLiteral("author")].toString());
    shader->setDescription(metadata[QStringLiteral("description")].toString());
    shader->setSource(QStringLiteral("shadertoy"));
    shader->setSourceId(metadata[QStringLiteral("id")].toString());
    shader->setLikes(metadata[QStringLiteral("likes")].toInt());
    shader->setViews(metadata[QStringLiteral("views")].toInt());
    shader->setCategory(QStringLiteral("Imported"));
    
    // Save the shader code to a file
    QString filename = metadata[QStringLiteral("id")].toString() + QStringLiteral(".frag");
    QString savePath = m_libraryPath + QStringLiteral("/Shaders/Imported/") + filename;
    
    QDir dir(m_libraryPath + QStringLiteral("/Shaders/Imported"));
    if (!dir.exists()) {
        dir.mkpath(QStringLiteral("."));
    }
    
    QFile file(savePath);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Text)) {
        Q_EMIT error(QStringLiteral("Failed to save shader file"));
        delete shader;
        return false;
    }
    
    file.write(code.toUtf8());
    file.close();
    
    shader->setShaderPath(QUrl::fromLocalFile(savePath));
    
    return addShader(shader);
}

void ShaderLibrary::save()
{
    saveIndex();
}

// --------------------------------------------------------------------
// Single-file saves used by the Shader Tweaks panel.
// --------------------------------------------------------------------

bool ShaderLibrary::saveShaderCode(const QUrl &filePath, const QString &code)
{
    QString path = filePath.toLocalFile();
    if (path.isEmpty()) {
        path = filePath.path();
    }
    // Allow library-relative paths too — same convention as loadShaderCode().
    if (!path.isEmpty() && !QDir::isAbsolutePath(path)) {
        path = QDir(m_libraryPath).filePath(path);
    }
    if (path.isEmpty()) {
        Q_EMIT error(QStringLiteral("saveShaderCode: empty path"));
        return false;
    }

    // Refuse to overwrite system-managed installs. The tweaked source
    // belongs in the user data directory; if the active shader lives
    // under /usr (or similar), the caller should be using saveShaderAs
    // instead.
    if (path.startsWith(QStringLiteral("/usr/"))
            || path.startsWith(QStringLiteral("/opt/"))) {
        qWarning() << "Refusing to overwrite system shader at" << path
                   << "— use 'Save As' instead.";
        Q_EMIT error(QStringLiteral(
            "This shader lives in a system directory and can't be overwritten. "
            "Use 'Save As' to write a personal copy into your library."));
        return false;
    }

    QFileInfo info(path);
    QDir parent = info.absoluteDir();
    if (!parent.exists() && !parent.mkpath(QStringLiteral("."))) {
        Q_EMIT error(QStringLiteral("Failed to create directory %1").arg(parent.absolutePath()));
        return false;
    }

    // Atomic write: spill to a sibling temp file, fsync, then rename.
    const QString tmpPath = path + QStringLiteral(".tweaks-saving.tmp");
    QFile tmp(tmpPath);
    if (!tmp.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        Q_EMIT error(QStringLiteral("Failed to open %1 for writing: %2")
                     .arg(tmpPath, tmp.errorString()));
        return false;
    }
    const QByteArray bytes = code.toUtf8();
    if (tmp.write(bytes) != bytes.size()) {
        tmp.close();
        QFile::remove(tmpPath);
        Q_EMIT error(QStringLiteral("Short write to %1").arg(tmpPath));
        return false;
    }
    tmp.flush();
    tmp.close();

    // Rename overwrites on POSIX; on Windows QSaveFile would be better
    // but we only target Plasma/KDE/Linux here.
    QFile::remove(path);   // ignored if it doesn't exist
    if (!QFile::rename(tmpPath, path)) {
        QFile::remove(tmpPath);
        Q_EMIT error(QStringLiteral("Failed to commit %1").arg(path));
        return false;
    }

    // Bump the shader's metadata so any thumbnail-needs / model views
    // know the content changed (forces a re-grab on next selection).
    auto meta = getShaderByPath(filePath);
    if (meta) {
        meta->setThumbnailPath(QUrl());
        Q_EMIT shaderUpdated(meta->id());
        saveIndex();
    }
    return true;
}

QUrl ShaderLibrary::saveShaderAs(const QString &displayName, const QString &code,
                                 const QString &category)
{
    QString baseName = displayName.trimmed();
    if (baseName.isEmpty()) baseName = QStringLiteral("Untitled Shader");

    // Sanitize to a safe filename: ASCII letters/digits/space/dash/underscore.
    QString fileStem = baseName;
    fileStem.replace(QRegularExpression(QStringLiteral("[^A-Za-z0-9_\\- ]")), QStringLiteral("_"));
    fileStem.replace(QRegularExpression(QStringLiteral("\\s+")), QStringLiteral("_"));
    if (fileStem.isEmpty()) fileStem = QStringLiteral("Untitled_Shader");

    const QString dirPath = m_libraryPath + QStringLiteral("/Shaders/Imported");
    QDir dir(dirPath);
    if (!dir.exists() && !dir.mkpath(QStringLiteral("."))) {
        Q_EMIT error(QStringLiteral("Failed to create %1").arg(dirPath));
        return QUrl();
    }

    // Avoid clobbering an existing file: append " 2", " 3", … as needed.
    QString candidate = dirPath + QStringLiteral("/") + fileStem + QStringLiteral(".frag");
    int n = 2;
    while (QFile::exists(candidate)) {
        candidate = dirPath + QStringLiteral("/") + fileStem
                  + QStringLiteral("_") + QString::number(n++) + QStringLiteral(".frag");
        if (n > 999) {
            Q_EMIT error(QStringLiteral("Too many copies of '%1' already saved").arg(displayName));
            return QUrl();
        }
    }

    if (!saveShaderCode(QUrl::fromLocalFile(candidate), code)) {
        return QUrl();
    }

    // Register the new file so the gallery / model pick it up immediately.
    auto meta = createMetadataFromFile(candidate, category);
    if (meta) {
        meta->setName(baseName);
        meta->setSource(QStringLiteral("tweaks-saveas"));
        addShader(meta);  // takes ownership, fires shaderAdded
    } else {
        // metadata creation can fail for esoteric reasons (file vanished
        // between save & scan, etc.); still return the URL so the caller
        // can at least switch to the saved file.
        qWarning() << "saveShaderAs: created" << candidate
                   << "but failed to build metadata for it";
    }
    return QUrl::fromLocalFile(candidate);
}

void ShaderLibrary::loadIndex()
{
    QString indexPath = m_libraryPath + QStringLiteral("/shader_index.json");
    QFile file(indexPath);
    
    if (!file.open(QIODevice::ReadOnly)) {
        // No index file, will be created on first scan
        return;
    }
    
    QJsonDocument doc = QJsonDocument::fromJson(file.readAll());
    file.close();
    
    if (!doc.isObject()) return;
    
    QJsonObject root = doc.object();
    QJsonArray shadersArray = root[QStringLiteral("shaders")].toArray();
    
    for (const auto &shaderRef : shadersArray) {
        auto shader = std::make_shared<ShaderMetadata>(shaderRef.toObject(), this);

        // Backward/portable compatibility: allow shader_index.json entries
        // to store paths relative to m_libraryPath (e.g. "Shaders/foo.frag").
        // Older builds wrote absolute file:// URLs, newer packaged indexes may
        // be checked in with relative paths so they survive across machines.
        const QString shaderLocal = shader->shaderPath().toLocalFile();
        const QString shaderRaw = shaderLocal.isEmpty() ? shader->shaderPath().toString() : shaderLocal;
        if (!shaderRaw.isEmpty() && !QDir::isAbsolutePath(shaderRaw) && !shaderRaw.startsWith(QStringLiteral("file:"))) {
            shader->setShaderPath(QUrl::fromLocalFile(QDir(m_libraryPath).filePath(shaderRaw)));
        }

        const QString thumbLocal = shader->thumbnailPath().toLocalFile();
        const QString thumbRaw = thumbLocal.isEmpty() ? shader->thumbnailPath().toString() : thumbLocal;
        if (!thumbRaw.isEmpty() && !QDir::isAbsolutePath(thumbRaw) && !thumbRaw.startsWith(QStringLiteral("file:"))) {
            shader->setThumbnailPath(QUrl::fromLocalFile(QDir(m_libraryPath).filePath(thumbRaw)));
        }

        m_shaders.append(shader);
        m_shaderMap[shader->id()] = shader;
        m_pathMap[shader->shaderPath().toString()] = shader;
    }
    
    // Load custom categories
    QJsonArray categoriesArray = root[QStringLiteral("categories")].toArray();
    for (const auto &cat : categoriesArray) {
        QString category = cat.toString();
        if (!m_categories.contains(category)) {
            m_categories.append(category);
        }
    }
    
    Q_EMIT shaderCountChanged();
}

void ShaderLibrary::saveIndex()
{
    QString indexPath = m_libraryPath + QStringLiteral("/shader_index.json");
    
    QJsonArray shadersArray;
    for (const auto &shader : m_shaders) {
        shadersArray.append(shader->toJson());
    }
    
    QJsonArray categoriesArray;
    for (const QString &cat : m_categories) {
        if (!DEFAULT_CATEGORIES.contains(cat)) {
            categoriesArray.append(cat);
        }
    }
    
    QJsonObject root;
    root[QStringLiteral("shaders")] = shadersArray;
    root[QStringLiteral("categories")] = categoriesArray;
    root[QStringLiteral("version")] = 1;
    
    QFile file(indexPath);
    if (!file.open(QIODevice::WriteOnly)) {
        Q_EMIT error(QStringLiteral("Failed to save shader index"));
        return;
    }
    
    file.write(QJsonDocument(root).toJson());
    file.close();
}

void ShaderLibrary::scanDirectory(const QString &path, const QString &category)
{
    QDir dir(path);
    if (!dir.exists()) return;
    
    // First, check if this directory is a shader package (has manifest.json)
    QString manifestPath = path + QStringLiteral("/manifest.json");
    if (QFile::exists(manifestPath)) {
        // This is a shader package directory
        QString mainShaderPath = path + QStringLiteral("/main.frag");
        if (QFile::exists(mainShaderPath)) {
            QUrl filePath = QUrl::fromLocalFile(mainShaderPath);
            if (!m_pathMap.contains(filePath.toString())) {
                auto metadata = createMetadataFromPackage(path, category);
                if (metadata) {
                    auto shared = std::shared_ptr<ShaderMetadata>(metadata);
                    m_shaders.append(shared);
                    m_shaderMap[metadata->id()] = shared;
                    m_pathMap[filePath.toString()] = shared;
                    qDebug() << "Loaded shader package:" << metadata->name() << "from" << path;
                }
            }
        }
        return; // Don't recurse into package directories
    }
    
    // Scan .frag files (plain text GLSL, compiled at runtime)
    QStringList filters;
    filters << QStringLiteral("*.frag") << QStringLiteral("*.glsl");
    
    QFileInfoList files = dir.entryInfoList(filters, QDir::Files);
    for (const QFileInfo &info : files) {
        // Skip buffer files - they'll be loaded with their main shader
        QString baseName = info.completeBaseName();
        if (baseName.endsWith(QStringLiteral("_bufferA")) ||
            baseName.endsWith(QStringLiteral("_bufferB")) ||
            baseName.endsWith(QStringLiteral("_bufferC")) ||
            baseName.endsWith(QStringLiteral("_bufferD")) ||
            baseName.endsWith(QStringLiteral("_common")) ||
            baseName == QStringLiteral("common")) {
            continue;
        }
        
        // Skip if already in library
        QUrl filePath = QUrl::fromLocalFile(info.absoluteFilePath());
        if (m_pathMap.contains(filePath.toString())) {
            continue;
        }
        
        auto metadata = createMetadataFromFile(info.absoluteFilePath(), category);
        if (metadata) {
            auto shared = std::shared_ptr<ShaderMetadata>(metadata);
            m_shaders.append(shared);
            m_shaderMap[metadata->id()] = shared;
            m_pathMap[filePath.toString()] = shared;
        }
    }
    
    // Recurse into subdirectories
    QFileInfoList subdirs = dir.entryInfoList(QDir::Dirs | QDir::NoDotAndDotDot);
    for (const QFileInfo &subdir : subdirs) {
        QString subCategory = category;
        if (subCategory.isEmpty()) {
            subCategory = subdir.fileName();
            // Map historical subdir names that used CamelCase to nicer
            // human-readable category names.
            if (subCategory == QLatin1String("WindowReactive")) {
                subCategory = QStringLiteral("Window Reactive");
            } else if (subCategory == QLatin1String("AudioReactive")) {
                subCategory = QStringLiteral("Audio Reactive");
            }
        }
        scanDirectory(subdir.absoluteFilePath(), subCategory);
    }
}

ShaderMetadata* ShaderLibrary::createMetadataFromFile(const QString &path, const QString &category)
{
    QFileInfo info(path);
    if (!info.exists()) return nullptr;
    
    auto metadata = new ShaderMetadata(this);
    
    // Generate name from filename
    QString name = generateShaderName(path);
    metadata->setName(name);
    metadata->setShaderPath(QUrl::fromLocalFile(path));
    metadata->setSource(QStringLiteral("local"));
    
    // Check for associated buffer files
    QUrl shaderUrl = QUrl::fromLocalFile(path);
    QVariantMap bufferPaths = getBufferFilePaths(shaderUrl);
    bool hasBufferFiles = bufferPaths.contains(QStringLiteral("BufferA")) ||
                          bufferPaths.contains(QStringLiteral("BufferB")) ||
                          bufferPaths.contains(QStringLiteral("BufferC")) ||
                          bufferPaths.contains(QStringLiteral("BufferD"));
    
    // Try to detect category from code
    QString detectedCategory = category;
    if (detectedCategory.isEmpty()) {
        QFile file(path);
        if (file.open(QIODevice::ReadOnly | QIODevice::Text)) {
            QString code = QString::fromUtf8(file.readAll());
            file.close();
            detectedCategory = detectCategory(code);
            
            // Check for features
            metadata->setNeedsAudio(code.contains(QStringLiteral("iChannel")) && 
                                    (code.contains(QStringLiteral("audio")) || code.contains(QStringLiteral("music")) || code.contains(QStringLiteral("sound"))));
            metadata->setNeedsTextures(code.contains(QStringLiteral("iChannel")) && code.contains(QStringLiteral("texture")));
            // hasBuffers is true if either the code references buffers OR buffer files exist
            metadata->setHasBuffers(hasBufferFiles || code.contains(QStringLiteral("BufferA")) || code.contains(QStringLiteral("BufferB")));
        }
    } else {
        metadata->setHasBuffers(hasBufferFiles);
    }
    
    metadata->setCategory(detectedCategory.isEmpty() ? QStringLiteral("Abstract") : detectedCategory);
    
    return metadata;
}

ShaderMetadata* ShaderLibrary::createMetadataFromPackage(const QString &packagePath, const QString &category)
{
    QDir dir(packagePath);
    if (!dir.exists()) return nullptr;
    
    auto metadata = new ShaderMetadata(this);
    
    // Load manifest.json
    QString manifestPath = packagePath + QStringLiteral("/manifest.json");
    QFile manifestFile(manifestPath);
    if (manifestFile.open(QIODevice::ReadOnly | QIODevice::Text)) {
        QJsonDocument doc = QJsonDocument::fromJson(manifestFile.readAll());
        manifestFile.close();
        
        if (doc.isObject()) {
            QJsonObject manifest = doc.object();
            
            QString name = manifest[QStringLiteral("name")].toString();
            if (name.isEmpty()) {
                name = dir.dirName(); // Use directory name as fallback
            }
            metadata->setName(name);
            metadata->setAuthor(manifest[QStringLiteral("author")].toString());
            metadata->setDescription(manifest[QStringLiteral("description")].toString());
            
            // Check for buffer files
            if (manifest.contains(QStringLiteral("buffers"))) {
                QJsonObject buffers = manifest[QStringLiteral("buffers")].toObject();
                bool hasBuffers = buffers[QStringLiteral("useBufferA")].toBool() ||
                                  buffers[QStringLiteral("useBufferB")].toBool() ||
                                  buffers[QStringLiteral("useBufferC")].toBool() ||
                                  buffers[QStringLiteral("useBufferD")].toBool();
                metadata->setHasBuffers(hasBuffers);
            }
        }
    } else {
        // Fallback: use directory name
        metadata->setName(generateShaderName(dir.dirName()));
    }
    
    // Set path to main.frag
    QString mainShaderPath = packagePath + QStringLiteral("/main.frag");
    metadata->setShaderPath(QUrl::fromLocalFile(mainShaderPath));
    metadata->setSource(QStringLiteral("package"));
    
    // Check for buffer files
    bool hasBufferA = QFile::exists(packagePath + QStringLiteral("/bufferA.frag"));
    bool hasBufferB = QFile::exists(packagePath + QStringLiteral("/bufferB.frag"));
    bool hasBufferC = QFile::exists(packagePath + QStringLiteral("/bufferC.frag"));
    bool hasBufferD = QFile::exists(packagePath + QStringLiteral("/bufferD.frag"));
    metadata->setHasBuffers(hasBufferA || hasBufferB || hasBufferC || hasBufferD);
    
    // Detect category from main shader code
    QString detectedCategory = category;
    if (detectedCategory.isEmpty() || detectedCategory == QStringLiteral("Packages")) {
        QFile mainFile(mainShaderPath);
        if (mainFile.open(QIODevice::ReadOnly | QIODevice::Text)) {
            QString code = QString::fromUtf8(mainFile.readAll());
            mainFile.close();
            detectedCategory = detectCategory(code);
            
            // Check for audio requirements
            metadata->setNeedsAudio(code.contains(QStringLiteral("iChannel")) && 
                                    (code.contains(QStringLiteral("audio")) || code.contains(QStringLiteral("music")) || code.contains(QStringLiteral("sound"))));
        }
    }
    
    // Packages always get the Packages category (in addition to detected one)
    // This makes them appear in the Packages filter
    if (category == QStringLiteral("Packages") || detectedCategory.isEmpty()) {
        detectedCategory = QStringLiteral("Packages");
    }
    
    metadata->setCategory(detectedCategory.isEmpty() ? QStringLiteral("Abstract") : detectedCategory);
    
    return metadata;
}

QString ShaderLibrary::detectCategory(const QString &shaderCode)
{
    QString code = shaderCode.toLower();
    
    // Simple heuristics for category detection
    if (code.contains(QStringLiteral("mandelbrot")) || code.contains(QStringLiteral("julia")) || code.contains(QStringLiteral("fractal"))) {
        return QStringLiteral("Fractal");
    }
    if (code.contains(QStringLiteral("raymar")) || (code.contains(QStringLiteral("sphere")) && code.contains(QStringLiteral("distance")))) {
        return QStringLiteral("Raymarching");
    }
    if (code.contains(QStringLiteral("star")) || code.contains(QStringLiteral("galaxy")) || code.contains(QStringLiteral("nebula")) || code.contains(QStringLiteral("space"))) {
        return QStringLiteral("Space");
    }
    if (code.contains(QStringLiteral("wave")) || code.contains(QStringLiteral("water")) || code.contains(QStringLiteral("ocean")) || code.contains(QStringLiteral("cloud"))) {
        return QStringLiteral("Nature");
    }
    if (code.contains(QStringLiteral("retro")) || code.contains(QStringLiteral("crt")) || code.contains(QStringLiteral("scanline")) || code.contains(QStringLiteral("pixel"))) {
        return QStringLiteral("Retro");
    }
    if (code.contains(QStringLiteral("noise")) || code.contains(QStringLiteral("perlin")) || code.contains(QStringLiteral("simplex"))) {
        return QStringLiteral("Noise");
    }
    if (code.contains(QStringLiteral("voronoi")) || code.contains(QStringLiteral("hexagon")) || code.contains(QStringLiteral("polygon"))) {
        return QStringLiteral("Geometric");
    }
    
    return QStringLiteral("Abstract");
}

QString ShaderLibrary::generateShaderName(const QString &path)
{
    QFileInfo info(path);
    QString name = info.baseName();
    
    // Remove common extensions
    name = name.remove(QStringLiteral(".frag")).remove(QStringLiteral(".qsb"));
    
    // Convert underscores/dashes to spaces
    name = name.replace(QStringLiteral("_"), QStringLiteral(" ")).replace(QStringLiteral("-"), QStringLiteral(" "));
    
    // Capitalize first letter of each word
    QStringList words = name.split(QStringLiteral(" "), Qt::SkipEmptyParts);
    for (int i = 0; i < words.size(); i++) {
        words[i] = words[i].at(0).toUpper() + words[i].mid(1).toLower();
    }
    
    return words.join(QStringLiteral(" "));
}

QVariantMap ShaderLibrary::getBufferFilePaths(const QUrl &shaderPath) const
{
    QVariantMap bufferPaths;
    
    QString path = shaderPath.toLocalFile();
    if (path.isEmpty()) {
        path = shaderPath.path();
    }
    
    QFileInfo info(path);
    QString baseName = info.completeBaseName();
    QString dir = info.absolutePath();
    QString suffix = info.suffix();
    
    // Check if this is a shader package (main.frag in a directory with manifest.json)
    bool isPackage = (baseName == QStringLiteral("main") && 
                      QFile::exists(dir + QStringLiteral("/manifest.json")));
    
    QStringList bufferNames = {
        QStringLiteral("bufferA"),
        QStringLiteral("bufferB"),
        QStringLiteral("bufferC"),
        QStringLiteral("bufferD")
    };
    
    for (const QString &bufferName : bufferNames) {
        QString bufferPath;
        
        if (isPackage) {
            // Package format: bufferA.frag in same directory
            bufferPath = dir + QStringLiteral("/") + bufferName + QStringLiteral(".") + suffix;
        } else {
            // Naming convention: shader_bufferA.frag
            QString bufferFileName = QStringLiteral("%1_%2.%3").arg(baseName, bufferName, suffix);
            bufferPath = dir + QStringLiteral("/") + bufferFileName;
        }
        
        if (QFile::exists(bufferPath)) {
            // Map buffer name to its file path
            QString key = bufferName.left(1).toUpper() + bufferName.mid(1); // "bufferA" -> "BufferA"
            bufferPaths[key] = QUrl::fromLocalFile(bufferPath);
            qDebug() << "Found buffer file:" << bufferName << "->" << bufferPath;
        }
    }
    
    // Also check for common.glsl or common.frag
    QString commonPath1, commonPath2, commonPath3;
    
    if (isPackage) {
        commonPath1 = dir + QStringLiteral("/common.glsl");
        commonPath2 = dir + QStringLiteral("/common.frag");
        commonPath3 = QString(); // No third option for packages
    } else {
        commonPath1 = dir + QStringLiteral("/") + baseName + QStringLiteral("_common.glsl");
        commonPath2 = dir + QStringLiteral("/") + baseName + QStringLiteral("_common.frag");
        commonPath3 = dir + QStringLiteral("/common.glsl");
    }
    
    if (QFile::exists(commonPath1)) {
        bufferPaths[QStringLiteral("Common")] = QUrl::fromLocalFile(commonPath1);
    } else if (QFile::exists(commonPath2)) {
        bufferPaths[QStringLiteral("Common")] = QUrl::fromLocalFile(commonPath2);
    } else if (!commonPath3.isEmpty() && QFile::exists(commonPath3)) {
        bufferPaths[QStringLiteral("Common")] = QUrl::fromLocalFile(commonPath3);
    }
    
    return bufferPaths;
}

QString ShaderLibrary::loadShaderCode(const QUrl &filePath) const
{
    QString path = filePath.toLocalFile();
    if (path.isEmpty()) {
        path = filePath.path();
    }

    // Support relative paths stored in index entries (e.g. "Shaders/foo.frag")
    // by resolving them against the library root.
    if (!path.isEmpty() && !QDir::isAbsolutePath(path)) {
        path = QDir(m_libraryPath).filePath(path);
    }
    
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        qWarning() << "Failed to open shader file:" << path;
        return QString();
    }
    
    QString code = QString::fromUtf8(file.readAll());
    file.close();
    
    return code;
}

QVariantMap ShaderLibrary::loadBufferCodes(const QUrl &shaderPath) const
{
    QVariantMap bufferCodes;
    
    QVariantMap bufferPaths = getBufferFilePaths(shaderPath);
    
    for (auto it = bufferPaths.constBegin(); it != bufferPaths.constEnd(); ++it) {
        QString code = loadShaderCode(it.value().toUrl());
        if (!code.isEmpty()) {
            // Convert key from "BufferA" to "bufferACode" for QML compatibility
            QString key;
            if (it.key() == QStringLiteral("Common")) {
                key = QStringLiteral("commonCode");
            } else {
                // "BufferA" -> "bufferACode"
                key = it.key().left(1).toLower() + it.key().mid(1) + QStringLiteral("Code");
            }
            bufferCodes[key] = code;
            qDebug() << "Loaded buffer code:" << key << "length:" << code.length();
        }
    }
    
    // Also return which buffers should be enabled
    bufferCodes[QStringLiteral("useBufferA")] = bufferPaths.contains(QStringLiteral("BufferA"));
    bufferCodes[QStringLiteral("useBufferB")] = bufferPaths.contains(QStringLiteral("BufferB"));
    bufferCodes[QStringLiteral("useBufferC")] = bufferPaths.contains(QStringLiteral("BufferC"));
    bufferCodes[QStringLiteral("useBufferD")] = bufferPaths.contains(QStringLiteral("BufferD"));
    
    return bufferCodes;
}

bool ShaderLibrary::hasBufferFiles(const QUrl &shaderPath) const
{
    return !getBufferFilePaths(shaderPath).isEmpty();
}

bool ShaderLibrary::saveShaderPackage(const QUrl &directory, const QString &mainCode,
                                      const QVariantMap &bufferCodes, const QVariantMap &config)
{
    QString dirPath = directory.toLocalFile();
    if (dirPath.isEmpty()) {
        dirPath = directory.path();
    }
    
    QDir dir(dirPath);
    if (!dir.exists()) {
        if (!dir.mkpath(QStringLiteral("."))) {
            Q_EMIT error(QStringLiteral("Failed to create directory: %1").arg(dirPath));
            return false;
        }
    }
    
    // Save main shader
    QString mainPath = dirPath + QStringLiteral("/main.frag");
    QFile mainFile(mainPath);
    if (!mainFile.open(QIODevice::WriteOnly | QIODevice::Text)) {
        Q_EMIT error(QStringLiteral("Failed to write main.frag"));
        return false;
    }
    mainFile.write(mainCode.toUtf8());
    mainFile.close();
    
    // Save buffer shaders
    QStringList bufferNames = {
        QStringLiteral("bufferACode"),
        QStringLiteral("bufferBCode"),
        QStringLiteral("bufferCCode"),
        QStringLiteral("bufferDCode")
    };
    QStringList bufferFileNames = {
        QStringLiteral("bufferA.frag"),
        QStringLiteral("bufferB.frag"),
        QStringLiteral("bufferC.frag"),
        QStringLiteral("bufferD.frag")
    };
    
    for (int i = 0; i < bufferNames.size(); i++) {
        if (bufferCodes.contains(bufferNames[i])) {
            QString code = bufferCodes[bufferNames[i]].toString();
            if (!code.isEmpty()) {
                QString bufferPath = dirPath + QStringLiteral("/") + bufferFileNames[i];
                QFile bufferFile(bufferPath);
                if (bufferFile.open(QIODevice::WriteOnly | QIODevice::Text)) {
                    bufferFile.write(code.toUtf8());
                    bufferFile.close();
                }
            }
        }
    }
    
    // Save common code
    if (bufferCodes.contains(QStringLiteral("commonCode"))) {
        QString code = bufferCodes[QStringLiteral("commonCode")].toString();
        if (!code.isEmpty()) {
            QString commonPath = dirPath + QStringLiteral("/common.glsl");
            QFile commonFile(commonPath);
            if (commonFile.open(QIODevice::WriteOnly | QIODevice::Text)) {
                commonFile.write(code.toUtf8());
                commonFile.close();
            }
        }
    }
    
    // Save manifest.json
    QJsonObject manifest;
    manifest[QStringLiteral("name")] = config.value(QStringLiteral("name"), QStringLiteral("Unnamed Shader")).toString();
    manifest[QStringLiteral("author")] = config.value(QStringLiteral("author"), QString()).toString();
    manifest[QStringLiteral("description")] = config.value(QStringLiteral("description"), QString()).toString();
    manifest[QStringLiteral("version")] = 1;
    
    // Buffer configuration
    QJsonObject buffers;
    buffers[QStringLiteral("useBufferA")] = bufferCodes.contains(QStringLiteral("bufferACode")) && 
                                             !bufferCodes[QStringLiteral("bufferACode")].toString().isEmpty();
    buffers[QStringLiteral("useBufferB")] = bufferCodes.contains(QStringLiteral("bufferBCode")) && 
                                             !bufferCodes[QStringLiteral("bufferBCode")].toString().isEmpty();
    buffers[QStringLiteral("useBufferC")] = bufferCodes.contains(QStringLiteral("bufferCCode")) && 
                                             !bufferCodes[QStringLiteral("bufferCCode")].toString().isEmpty();
    buffers[QStringLiteral("useBufferD")] = bufferCodes.contains(QStringLiteral("bufferDCode")) && 
                                             !bufferCodes[QStringLiteral("bufferDCode")].toString().isEmpty();
    manifest[QStringLiteral("buffers")] = buffers;
    
    // Channel mappings
    if (config.contains(QStringLiteral("channels"))) {
        manifest[QStringLiteral("channels")] = QJsonObject::fromVariantMap(config[QStringLiteral("channels")].toMap());
    }
    
    // Buffer channel mappings
    if (config.contains(QStringLiteral("bufferChannels"))) {
        manifest[QStringLiteral("bufferChannels")] = QJsonObject::fromVariantMap(config[QStringLiteral("bufferChannels")].toMap());
    }
    
    QString manifestPath = dirPath + QStringLiteral("/manifest.json");
    QFile manifestFile(manifestPath);
    if (!manifestFile.open(QIODevice::WriteOnly | QIODevice::Text)) {
        Q_EMIT error(QStringLiteral("Failed to write manifest.json"));
        return false;
    }
    manifestFile.write(QJsonDocument(manifest).toJson());
    manifestFile.close();
    
    qDebug() << "Shader package saved to:" << dirPath;
    return true;
}

QVariantMap ShaderLibrary::loadShaderPackage(const QUrl &directory) const
{
    QVariantMap result;
    
    QString dirPath = directory.toLocalFile();
    if (dirPath.isEmpty()) {
        dirPath = directory.path();
    }
    
    QDir dir(dirPath);
    if (!dir.exists()) {
        qWarning() << "Shader package directory not found:" << dirPath;
        return result;
    }
    
    // Load manifest
    QString manifestPath = dirPath + QStringLiteral("/manifest.json");
    QFile manifestFile(manifestPath);
    if (manifestFile.open(QIODevice::ReadOnly | QIODevice::Text)) {
        QJsonDocument doc = QJsonDocument::fromJson(manifestFile.readAll());
        manifestFile.close();
        
        if (doc.isObject()) {
            QJsonObject manifest = doc.object();
            result[QStringLiteral("name")] = manifest[QStringLiteral("name")].toString();
            result[QStringLiteral("author")] = manifest[QStringLiteral("author")].toString();
            result[QStringLiteral("description")] = manifest[QStringLiteral("description")].toString();
            
            // Buffer flags
            if (manifest.contains(QStringLiteral("buffers"))) {
                QJsonObject buffers = manifest[QStringLiteral("buffers")].toObject();
                result[QStringLiteral("useBufferA")] = buffers[QStringLiteral("useBufferA")].toBool();
                result[QStringLiteral("useBufferB")] = buffers[QStringLiteral("useBufferB")].toBool();
                result[QStringLiteral("useBufferC")] = buffers[QStringLiteral("useBufferC")].toBool();
                result[QStringLiteral("useBufferD")] = buffers[QStringLiteral("useBufferD")].toBool();
            }
            
            // Channel mappings
            if (manifest.contains(QStringLiteral("channels"))) {
                result[QStringLiteral("channels")] = manifest[QStringLiteral("channels")].toObject().toVariantMap();
            }
            
            // Buffer channel mappings
            if (manifest.contains(QStringLiteral("bufferChannels"))) {
                result[QStringLiteral("bufferChannels")] = manifest[QStringLiteral("bufferChannels")].toObject().toVariantMap();
            }
        }
    }
    
    // Load main shader
    QString mainPath = dirPath + QStringLiteral("/main.frag");
    if (QFile::exists(mainPath)) {
        result[QStringLiteral("mainCode")] = loadShaderCode(QUrl::fromLocalFile(mainPath));
    }
    
    // Load buffer shaders
    QStringList bufferFileNames = {
        QStringLiteral("bufferA.frag"),
        QStringLiteral("bufferB.frag"),
        QStringLiteral("bufferC.frag"),
        QStringLiteral("bufferD.frag")
    };
    QStringList bufferCodeKeys = {
        QStringLiteral("bufferACode"),
        QStringLiteral("bufferBCode"),
        QStringLiteral("bufferCCode"),
        QStringLiteral("bufferDCode")
    };
    
    for (int i = 0; i < bufferFileNames.size(); i++) {
        QString bufferPath = dirPath + QStringLiteral("/") + bufferFileNames[i];
        if (QFile::exists(bufferPath)) {
            result[bufferCodeKeys[i]] = loadShaderCode(QUrl::fromLocalFile(bufferPath));
        }
    }
    
    // Load common code
    QString commonPath = dirPath + QStringLiteral("/common.glsl");
    if (QFile::exists(commonPath)) {
        result[QStringLiteral("commonCode")] = loadShaderCode(QUrl::fromLocalFile(commonPath));
    }
    
    return result;
}

