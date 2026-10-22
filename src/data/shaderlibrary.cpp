// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "shaderlibrary.h"
#include "shadermetadata.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QFileSystemWatcher>
#include <QJsonDocument>
#include <QJsonArray>
#include <QSaveFile>
#include <QStandardPaths>
#include <QRegularExpression>
#include <QDateTime>
#include <QQmlEngine>
#include <QProcess>
#include <QSet>
#include <QHash>
#include <QTimer>

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

namespace {

bool directoryHasShaderFiles(const QString &libraryRoot)
{
    const QDir shadersDir(libraryRoot + QStringLiteral("/Shaders"));
    if (!shadersDir.exists()) {
        return false;
    }
    return !shadersDir.entryList({QStringLiteral("*.frag"), QStringLiteral("*.glsl")}, QDir::Files).isEmpty();
}

QString resolveLibraryRoot()
{
    const QString relativePath =
        QStringLiteral("plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui");

    const QStringList located = QStandardPaths::locateAll(
        QStandardPaths::GenericDataLocation, relativePath, QStandardPaths::LocateDirectory);

    for (const QString &candidate : located) {
        if (directoryHasShaderFiles(candidate)) {
            return candidate;
        }
    }

    static const QStringList fallbacks = {
        QStringLiteral("/usr/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui"),
    };
    for (const QString &candidate : fallbacks) {
        if (directoryHasShaderFiles(candidate)) {
            return candidate;
        }
    }

    if (!located.isEmpty()) {
        return located.constFirst();
    }
    for (const QString &candidate : fallbacks) {
        if (QDir(candidate).exists()) {
            return candidate;
        }
    }

    const QString dataPath =
        QStandardPaths::writableLocation(QStandardPaths::GenericDataLocation);
    return dataPath + QLatin1Char('/') + relativePath;
}

} // namespace

ShaderLibrary::ShaderLibrary(QObject *parent)
    : QObject(parent)
{
    s_instance = this;

    m_libraryPath = resolveLibraryRoot();
    m_canonicalLibraryRoot = QFileInfo(m_libraryPath).canonicalFilePath();

    m_userDataPath = QStandardPaths::writableLocation(QStandardPaths::GenericDataLocation)
                   + QStringLiteral("/shaderwallpaper");
    QDir().mkpath(m_userDataPath);
    m_canonicalUserDataPath = QFileInfo(m_userDataPath).canonicalFilePath();

    // /usr/.../contents/ui is the location the PLM greeter reads from
    // (running as the plasmalogin user it cannot see ~/.local, nor the user
    // data root). Shaders without a twin there are not greeter-available.
    static const QString systemRoot = QStringLiteral(
        "/usr/share/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui");
    if (directoryHasShaderFiles(systemRoot)) {
        m_greeterPath = systemRoot;
    }

    m_categories = DEFAULT_CATEGORIES;

    migrateUserData();
    loadIndex();
    refresh();
    watchIndexFile();
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
    m_canonicalLibraryRoot = QFileInfo(m_libraryPath).canonicalFilePath();
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
    const int countBeforeScan = m_shaders.size();
    QStringList scanRoots = {
        m_libraryPath + QStringLiteral("/Shaders"),
        m_libraryPath + QStringLiteral("/Shaders6"),
    };
    if (m_userDataPath != m_libraryPath) {
        scanRoots.append(m_userDataPath + QStringLiteral("/Shaders"));
    }
    for (const QString &root : scanRoots) {
        if (QDir(root).exists()) {
            scanDirectory(root, QStringLiteral(""));
        }
    }

    // 2) Drop entries whose backing file is no longer on disk. We collect
    // them first to avoid mutating m_shaders while iterating it.
    QList<std::shared_ptr<ShaderMetadata>> stale;
    stale.reserve(m_shaders.size());
    // A stale bundled entry comes back from the read-only bundled index on
    // every start; only dropping an overlay entry is worth a write.
    bool staleInOverlay = false;
    for (const auto &s : m_shaders) {
        const QString p = s->shaderPath().toLocalFile();
        if (p.isEmpty()) continue;          // inline / virtual entries
        if (QFile::exists(p)) continue;     // still on disk
        stale.append(s);
        staleInOverlay = staleInOverlay || inOverlay(*s);
    }
    for (const auto &s : stale) {
        const QString id = s->id();
        m_pathMap.remove(s->shaderPath().toString());
        m_shaderMap.remove(id);
        m_shaders.removeOne(s);
        Q_EMIT shaderRemoved(id);
    }

    updateGreeterAvailability();

    m_loading = false;
    Q_EMIT loadingChanged();
    Q_EMIT shaderCountChanged();

    // Persist only when the scan actually added or removed something —
    // the index file is shared across processes, and every write is a
    // chance to overwrite another process's newer state.
    if (m_shaders.size() + stale.size() != countBeforeScan || staleInOverlay) {
        saveIndex();
    }
}

void ShaderLibrary::updateGreeterAvailability()
{
    // If there's no /usr install detected, default everything to "available"
    // (the badge is hidden anyway via greeterPathPresent in QML).
    if (m_greeterPath.isEmpty()) {
        for (const auto &shader : m_shaders) {
            shader->setGreeterAvailable(true);
        }
        return;
    }

    // For each shader in the writable library, check whether the same
    // package-relative path exists under /usr/.../contents/ui. Stock
    // shaders are in both → available. Imports / user-only shaders are
    // missing in /usr → not available.
    const QString libRootPrefix = m_libraryPath + QLatin1Char('/');
    for (const auto &shader : m_shaders) {
        const QString local = shader->shaderPath().toLocalFile();
        if (local.isEmpty()) {
            shader->setGreeterAvailable(false);
            continue;
        }
        if (local.startsWith(libRootPrefix)) {
            const QString rel = local.mid(libRootPrefix.size());
            const QString twin = m_greeterPath + QLatin1Char('/') + rel;
            shader->setGreeterAvailable(QFile::exists(twin));
        } else {
            // Shader lives outside the library root (e.g. file added by drag
            // from elsewhere). The greeter can't see arbitrary user paths.
            shader->setGreeterAvailable(false);
        }
    }
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

    // The same shader file can be named several ways depending on who wrote
    // the value: relative "Shaders/X.frag" (saved config), absolute via the
    // ~/.local symlink (this process's scan), or the symlink's canonical
    // target (hosts that canonicalize QML urls). Compare in collapsed form
    // before giving up.
    const QString wanted = toRelativeShaderPath(pathStr);
    if (wanted.isEmpty()) {
        return nullptr;
    }
    for (const auto &shader : m_shaders) {
        if (toRelativeShaderPath(shader->shaderPath().toString()) == wanted) {
            return shader.get();
        }
    }
    return nullptr;
}

QString ShaderLibrary::toRelativeShaderPath(const QString &input) const
{
    if (input.isEmpty()) {
        return input;
    }

    QString path = input;
    // Strip a file:// URL scheme so we work purely on filesystem paths.
    if (path.startsWith(QLatin1String("file://"))) {
        path = QUrl(path).toLocalFile();
    }

    // Anything under .../plasma/wallpapers/<plugin>/contents/ui/ on either
    // ~/.local/share or /usr/share collapses to the path that follows
    // contents/ui/ — e.g. "Shaders/AlienVoxel.frag". Qt.resolvedUrl() in
    // ShaderSystem.qml then resolves that against whichever copy of the
    // plugin is actually running (user copy for the desktop, /usr copy for
    // the PLM greeter), so the same saved value is portable across both.
    static const QLatin1String marker(
        "/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui/");
    const int idx = path.indexOf(marker);
    if (idx >= 0) {
        return path.mid(idx + marker.size());
    }

    // The user data root mirrors contents/ui; its files collapse the same
    // way and resolve through userFileUrl()/resolveLibraryFile().
    //
    // Some hosts canonicalize QML urls (the System Settings wallpaper KCM
    // does, the in-process desktop dialog doesn't), so a symlinked install
    // (~/.local/... -> a git checkout) hands over the symlink target path,
    // which lacks the marker. Collapse against both raw and canonical roots.
    const QString roots[] = {
        m_userDataPath, m_canonicalUserDataPath, m_libraryPath, m_canonicalLibraryRoot,
    };
    for (const QString &root : roots) {
        if (!root.isEmpty() && path.startsWith(root + QLatin1Char('/'))) {
            return path.mid(root.size() + 1);
        }
    }
    const QString canonical = QFileInfo(path).canonicalFilePath();
    if (!canonical.isEmpty()) {
        for (const QString &root : {m_canonicalUserDataPath, m_canonicalLibraryRoot}) {
            if (!root.isEmpty() && canonical.startsWith(root + QLatin1Char('/'))) {
                return canonical.mid(root.size() + 1);
            }
        }
    }
    return input;
}

QString ShaderLibrary::userFileUrl(const QString &relativePath) const
{
    if (relativePath.isEmpty() || QDir::isAbsolutePath(relativePath)
            || relativePath.startsWith(QLatin1String("file:"))) {
        return QString();
    }
    const QString path = m_userDataPath + QLatin1Char('/') + relativePath;
    return QFileInfo::exists(path) ? QUrl::fromLocalFile(path).toString() : QString();
}

QString ShaderLibrary::resolveLibraryFile(const QString &path) const
{
    if (path.isEmpty() || QDir::isAbsolutePath(path)) {
        return path;
    }
    const QString user = m_userDataPath + QLatin1Char('/') + path;
    if (QFileInfo::exists(user)) {
        return user;
    }
    return QDir(m_libraryPath).filePath(path);
}

bool ShaderLibrary::isShadowed(const QString &absolutePath) const
{
    if (m_userDataPath == m_libraryPath) {
        return false;
    }
    const QString prefix = m_libraryPath + QLatin1Char('/');
    return absolutePath.startsWith(prefix)
        && QFileInfo::exists(m_userDataPath + QLatin1Char('/') + absolutePath.mid(prefix.size()));
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

QString ShaderLibrary::thumbnailFileForId(const QString &shaderId) const
{
    QString safeId = shaderId;
    safeId.replace(QRegularExpression(QStringLiteral("[^a-zA-Z0-9_-]")), QStringLiteral("_"));
    return QStringLiteral("thumbnails/") + safeId + QStringLiteral(".png");
}

QString ShaderLibrary::getThumbnailPath(const QString &shaderId) const
{
    // Generated thumbnails go to the user data root; bundled ones stay in
    // the package directory.
    QDir dir(m_userDataPath + QStringLiteral("/thumbnails"));
    if (!dir.exists()) {
        dir.mkpath(QStringLiteral("."));
    }
    return m_userDataPath + QLatin1Char('/') + thumbnailFileForId(shaderId);
}

bool ShaderLibrary::needsThumbnail(const QString &shaderId) const
{
    auto shader = getShader(shaderId);
    if (!shader) return false;

    const QUrl resolved = resolveIndexUrl(shader->thumbnailPath());
    QString path = resolved.toLocalFile();
    if (path.isEmpty()) {
        path = resolved.path();
    }
    if (!path.isEmpty() && QFile::exists(path)) {
        return false;
    }

    // The entry lost its thumbnail path but the file named after the id
    // is still on disk.
    const QString byId = resolveLibraryFile(thumbnailFileForId(shaderId));
    if (QFile::exists(byId)) {
        shader->setThumbnailPath(QUrl::fromLocalFile(byId));
        QMetaObject::invokeMethod(const_cast<ShaderLibrary *>(this), "shaderUpdated",
                                  Qt::QueuedConnection, Q_ARG(QString, shaderId));
        return false;
    }
    return true;
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
    QString savePath = m_userDataPath + QStringLiteral("/Shaders/Imported/") + filename;

    QDir dir(m_userDataPath + QStringLiteral("/Shaders/Imported"));
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
    path = resolveLibraryFile(path);
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

    const QString dirPath = m_userDataPath + QStringLiteral("/Shaders/Imported");
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

namespace {

// False when the file is missing or does not parse (partial write).
bool readIndexObject(const QString &path, QJsonObject *out)
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) {
        return false;
    }
    const QJsonDocument doc = QJsonDocument::fromJson(file.readAll());
    if (!doc.isObject()) {
        return false;
    }
    *out = doc.object();
    return true;
}

// Recursive copy; existing destination files are kept, symlinked
// directories are not followed.
void copyTreeMissing(const QString &from, const QString &to)
{
    const QDir source(from);
    if (!source.exists()) {
        return;
    }
    QDir().mkpath(to);
    const QFileInfoList entries =
        source.entryInfoList(QDir::Files | QDir::Dirs | QDir::NoDotAndDotDot);
    for (const QFileInfo &entry : entries) {
        const QString target = to + QLatin1Char('/') + entry.fileName();
        if (entry.isDir()) {
            if (!entry.isSymLink()) {
                copyTreeMissing(entry.absoluteFilePath(), target);
            }
        } else if (!QFileInfo::exists(target)) {
            QFile::copy(entry.absoluteFilePath(), target);
        }
    }
}

} // namespace

QString ShaderLibrary::userIndexPath() const
{
    return m_userDataPath + QStringLiteral("/shader_index.json");
}

void ShaderLibrary::migrateUserData()
{
    if (QFile::exists(userIndexPath())) {
        return;
    }

    // Builds without a user data root kept favorites, thumbnails, imports and
    // saved packages in the package directory, which upgrades replace. A
    // system-wide install is read-only and holds none of it.
    const QString localPackage =
        QStandardPaths::writableLocation(QStandardPaths::GenericDataLocation)
        + QStringLiteral("/plasma/wallpapers/online.knowmad.shaderwallpaper/contents/ui");
    QStringList sources;
    QSet<QString> canonicalSources;
    for (const QString &dir : {m_libraryPath, localPackage}) {
        const QString canonical = QFileInfo(dir).canonicalFilePath();
        if (!canonical.isEmpty() && !canonicalSources.contains(canonical)) {
            canonicalSources.insert(canonical);
            sources.append(dir);
        }
    }

    QJsonArray shaders;
    QJsonArray categories;
    QSet<QString> seenIds;
    for (const QString &source : std::as_const(sources)) {
        QJsonObject root;
        if (!QFileInfo(source).isWritable()
                || !readIndexObject(source + QStringLiteral("/shader_index.json"), &root)) {
            continue;
        }
        qInfo() << "ShaderLibrary: migrating user data from" << source << "to" << m_userDataPath;

        for (const QString &sub : {QStringLiteral("Shaders/Imported"), QStringLiteral("Shaders/Packages")}) {
            copyTreeMissing(source + QLatin1Char('/') + sub, m_userDataPath + QLatin1Char('/') + sub);
        }

        const QString prefix = source + QLatin1Char('/');
        const auto localFile = [&prefix](const QString &value) {
            const QUrl url(value);
            const QString path = url.isLocalFile() ? url.toLocalFile() : value;
            return path.isEmpty() || QDir::isAbsolutePath(path) ? path : prefix + path;
        };

        // Carried over: user files, external imports and favorites. Bundled
        // shaders without user state come from the bundled index.
        for (const auto &ref : root[QStringLiteral("shaders")].toArray()) {
            QJsonObject entry = ref.toObject();
            const QString id = entry[QStringLiteral("id")].toString();
            if (id.isEmpty() || seenIds.contains(id)) {
                continue;
            }
            const QString shaderFile = localFile(entry[QStringLiteral("shaderPath")].toString());
            const QString rel = shaderFile.startsWith(prefix) ? shaderFile.mid(prefix.size())
                                                              : toRelativeShaderPath(shaderFile);
            const bool external = QDir::isAbsolutePath(rel);
            const bool userFile = rel.startsWith(QLatin1String("Shaders/Imported/"))
                               || rel.startsWith(QLatin1String("Shaders/Packages/"));
            if (!external && !userFile && !entry[QStringLiteral("favorite")].toBool()) {
                continue;
            }
            seenIds.insert(id);
            entry[QStringLiteral("shaderPath")] = external ? QUrl::fromLocalFile(rel).toString() : rel;

            const QFileInfo thumb(localFile(entry[QStringLiteral("thumbnailPath")].toString()));
            if (thumb.isFile()) {
                const QString target = QStringLiteral("thumbnails/") + thumb.fileName();
                const QString targetFile = m_userDataPath + QLatin1Char('/') + target;
                QDir().mkpath(m_userDataPath + QStringLiteral("/thumbnails"));
                if (QFileInfo::exists(targetFile) || QFile::copy(thumb.absoluteFilePath(), targetFile)) {
                    entry[QStringLiteral("thumbnailPath")] = target;
                }
            }
            shaders.append(entry);
        }

        for (const auto &category : root[QStringLiteral("categories")].toArray()) {
            if (!categories.contains(category)) {
                categories.append(category);
            }
        }
    }

    // Written even when empty: its presence marks the migration done and
    // gives the other processes' watchers a file to watch.
    QJsonObject out;
    out[QStringLiteral("shaders")] = shaders;
    out[QStringLiteral("categories")] = categories;
    out[QStringLiteral("version")] = 1;
    QSaveFile file(userIndexPath());
    if (QDir().mkpath(m_userDataPath) && file.open(QIODevice::WriteOnly)) {
        file.write(QJsonDocument(out).toJson());
        file.commit();
    }
}

QJsonObject ShaderLibrary::indexEntry(const ShaderMetadata &shader) const
{
    QJsonObject json = shader.toJson();
    // contents/ui-relative paths keep the index machine-independent;
    // loadIndex() resolves them against the user root, then the package.
    json[QStringLiteral("shaderPath")] =
        toRelativeShaderPath(json[QStringLiteral("shaderPath")].toString());
    json[QStringLiteral("thumbnailPath")] =
        toRelativeShaderPath(json[QStringLiteral("thumbnailPath")].toString());
    return json;
}

bool ShaderLibrary::inOverlay(const ShaderMetadata &shader) const
{
    const auto bundled = m_bundledEntries.constFind(shader.id());
    return bundled == m_bundledEntries.constEnd() || *bundled != indexEntry(shader);
}

void ShaderLibrary::loadIndex()
{
    QJsonObject bundled;
    readIndexObject(m_libraryPath + QStringLiteral("/shader_index.json"), &bundled);
    QJsonObject user;
    readIndexObject(userIndexPath(), &user);
    m_release = bundled[QStringLiteral("release")].toString();
    for (const auto &id : user[QStringLiteral("seen")].toArray()) {
        m_seenNew.insert(id.toString());
    }

    const auto load = [this](const QJsonObject &obj) {
        auto shader = std::make_shared<ShaderMetadata>(obj, this);
        // Paths are contents/ui-relative ("Shaders/foo.frag"), or absolute
        // file:// URLs from older builds and external imports.
        shader->setShaderPath(resolveIndexUrl(shader->shaderPath()));
        shader->setThumbnailPath(resolveIndexUrl(shader->thumbnailPath()));
        if (shader->thumbnailPath().isEmpty()) {
            const QString byId = resolveLibraryFile(thumbnailFileForId(shader->id()));
            if (QFile::exists(byId)) {
                shader->setThumbnailPath(QUrl::fromLocalFile(byId));
            }
        }
        return shader;
    };
    const auto insert = [this](const std::shared_ptr<ShaderMetadata> &shader) {
        m_shaders.append(shader);
        m_shaderMap[shader->id()] = shader;
        m_pathMap[shader->shaderPath().toString()] = shader;
    };

    for (const auto &ref : bundled[QStringLiteral("shaders")].toArray()) {
        const auto shader = load(ref.toObject());
        m_bundledEntries.insert(shader->id(), indexEntry(*shader));
        m_bundledIdByPath.insert(comparablePath(shader->shaderPath()), shader->id());
        insert(shader);
    }

    for (const auto &ref : user[QStringLiteral("shaders")].toArray()) {
        const auto shader = load(ref.toObject());
        // Matched by id, or by path when an upgraded bundled index re-minted
        // the id; the bundled id wins.
        auto base = m_shaderMap.value(shader->id());
        if (!base) {
            const QString bundledId = m_bundledIdByPath.value(comparablePath(shader->shaderPath()));
            base = bundledId.isEmpty() ? nullptr : m_shaderMap.value(bundledId);
        }
        if (!base) {
            insert(shader);
            continue;
        }
        base->setFavorite(shader->favorite());
        if (QFile::exists(shader->thumbnailPath().toLocalFile())) {
            base->setThumbnailPath(shader->thumbnailPath());
        }
    }

    for (const QJsonObject *root : {&bundled, &user}) {
        for (const auto &cat : (*root)[QStringLiteral("categories")].toArray()) {
            const QString category = cat.toString();
            if (!category.isEmpty() && !m_categories.contains(category)) {
                m_categories.append(category);
            }
        }
    }

    updateNewFlags();
    Q_EMIT shaderCountChanged();
}

namespace {
// "4.2.1" -> "4.2"
QString majorMinor(const QString &version)
{
    const QStringList parts = version.split(QLatin1Char('.'));
    return parts.size() >= 2 ? parts[0] + QLatin1Char('.') + parts[1] : version;
}
} // namespace

void ShaderLibrary::updateNewFlags()
{
    const QString release = majorMinor(m_release);
    int count = 0;
    for (const auto &shader : std::as_const(m_shaders)) {
        const bool isNew = !release.isEmpty() && !shader->addedIn().isEmpty()
            && majorMinor(shader->addedIn()) == release
            && !m_seenNew.contains(shader->id());
        if (shader->isNew() != isNew) {
            shader->setIsNew(isNew);
            Q_EMIT shaderUpdated(shader->id());
        }
        count += isNew ? 1 : 0;
    }
    if (m_newCount != count) {
        m_newCount = count;
        Q_EMIT newCountChanged();
    }
}

void ShaderLibrary::markSeen(const QString &id)
{
    const auto shader = getShader(id);
    if (!shader || !shader->isNew()) {
        return;
    }
    m_seenNew.insert(id);
    updateNewFlags();
    saveIndex();
}

void ShaderLibrary::markAllSeen()
{
    if (m_newCount == 0) {
        return;
    }
    for (const auto &shader : std::as_const(m_shaders)) {
        if (shader->isNew()) {
            m_seenNew.insert(shader->id());
        }
    }
    updateNewFlags();
    saveIndex();
}

void ShaderLibrary::saveIndex()
{
    QJsonArray shadersArray;
    for (const auto &shader : m_shaders) {
        const QJsonObject json = indexEntry(*shader);
        const auto bundled = m_bundledEntries.constFind(shader->id());
        if (bundled != m_bundledEntries.constEnd() && *bundled == json) {
            continue;
        }
        shadersArray.append(json);
    }

    QJsonArray categoriesArray;
    for (const QString &cat : m_categories) {
        if (!DEFAULT_CATEGORIES.contains(cat)) {
            categoriesArray.append(cat);
        }
    }

    // Ids of shaders no longer marked with a release drop out.
    QStringList seen;
    for (const QString &id : std::as_const(m_seenNew)) {
        const auto shader = m_shaderMap.value(id);
        if (shader && !shader->addedIn().isEmpty()) {
            seen.append(id);
        }
    }
    seen.sort();

    QJsonObject root;
    root[QStringLiteral("shaders")] = shadersArray;
    root[QStringLiteral("categories")] = categoriesArray;
    root[QStringLiteral("version")] = 1;
    if (!seen.isEmpty()) {
        root[QStringLiteral("seen")] = QJsonArray::fromStringList(seen);
    }

    if (!QDir().mkpath(m_userDataPath)) {
        Q_EMIT error(QStringLiteral("Failed to create %1").arg(m_userDataPath));
        return;
    }

    // Atomic write: a truncated index fails to parse on next start, which
    // re-mints every shader (and loses favorites) — never leave one behind.
    QSaveFile file(userIndexPath());
    if (!file.open(QIODevice::WriteOnly)) {
        Q_EMIT error(QStringLiteral("Failed to save shader index"));
        return;
    }

    file.write(QJsonDocument(root).toJson());
    if (!file.commit()) {
        Q_EMIT error(QStringLiteral("Failed to commit shader index: %1")
                     .arg(file.errorString()));
        return;
    }

    // QSaveFile replaces the file by rename, which drops it from the
    // watcher — re-arm so we keep seeing other processes' writes.
    watchIndexFile();
}

void ShaderLibrary::watchIndexFile()
{
    const QString indexPath = userIndexPath();
    if (!QFile::exists(indexPath)) {
        return;
    }

    if (!m_indexWatcher) {
        m_indexWatcher = new QFileSystemWatcher(this);
        m_indexReloadDebounce = new QTimer(this);
        m_indexReloadDebounce->setSingleShot(true);
        m_indexReloadDebounce->setInterval(250);
        connect(m_indexReloadDebounce, &QTimer::timeout,
                this, &ShaderLibrary::mergeIndexFromDisk);
        connect(m_indexWatcher, &QFileSystemWatcher::fileChanged,
                this, [this](const QString &path) {
            // Atomic saves replace the inode — always re-add.
            if (!m_indexWatcher->files().contains(path) && QFile::exists(path)) {
                m_indexWatcher->addPath(path);
            }
            m_indexReloadDebounce->start();
        });
    }

    if (!m_indexWatcher->files().contains(indexPath)) {
        m_indexWatcher->addPath(indexPath);
    }
}

QUrl ShaderLibrary::resolveIndexUrl(const QUrl &url) const
{
    const QString local = url.toLocalFile();
    const QString raw = local.isEmpty() ? url.toString() : local;
    if (!raw.isEmpty() && !QDir::isAbsolutePath(raw) && !raw.startsWith(QStringLiteral("file:"))) {
        return QUrl::fromLocalFile(resolveLibraryFile(raw));
    }
    return url;
}

QString ShaderLibrary::comparablePath(const QUrl &url) const
{
    const QUrl resolved = resolveIndexUrl(url);
    const QString path = resolved.isLocalFile() ? resolved.toLocalFile()
                                                : resolved.toString(QUrl::RemoveQuery);
    return toRelativeShaderPath(path);
}

void ShaderLibrary::mergeIndexFromDisk()
{
    // Fold another process's index write into our in-memory state so a later
    // save from this process doesn't roll their changes back. Merging our own
    // write back is a harmless no-op — every field already matches — so we
    // don't bother distinguishing writers.
    QJsonObject root;
    if (!readIndexObject(userIndexPath(), &root)) {
        return;  // missing or partial write: in-memory state stands, the next save rewrites it
    }

    bool seenGrew = false;
    for (const auto &id : root[QStringLiteral("seen")].toArray()) {
        if (!m_seenNew.contains(id.toString())) {
            m_seenNew.insert(id.toString());
            seenGrew = true;
        }
    }
    if (seenGrew) {
        updateNewFlags();
    }

    // Disk state is the bundled index with the overlay applied, layered as
    // loadIndex() does. A bundled shader absent from the overlay is back at
    // its bundled state (e.g. unfavorited by another process).
    QList<QJsonObject> entries;
    entries.reserve(m_bundledEntries.size());
    QHash<QString, qsizetype> rowById;
    for (auto it = m_bundledEntries.cbegin(); it != m_bundledEntries.cend(); ++it) {
        rowById.insert(it.key(), entries.size());
        entries.append(it.value());
    }
    for (const auto &ref : root[QStringLiteral("shaders")].toArray()) {
        const QJsonObject obj = ref.toObject();
        const QString id = obj[QStringLiteral("id")].toString();
        if (id.isEmpty()) {
            continue;
        }
        qsizetype row = rowById.value(id, -1);
        if (row < 0) {
            const QString bundledId = m_bundledIdByPath.value(
                comparablePath(QUrl(obj[QStringLiteral("shaderPath")].toString())));
            row = bundledId.isEmpty() ? -1 : rowById.value(bundledId, -1);
        }
        if (row < 0) {
            rowById.insert(id, entries.size());
            entries.append(obj);
            continue;
        }
        QJsonObject &entry = entries[row];
        entry[QStringLiteral("favorite")] = obj[QStringLiteral("favorite")];
        const QString thumb = obj[QStringLiteral("thumbnailPath")].toString();
        if (QFile::exists(resolveIndexUrl(QUrl(thumb)).toLocalFile())) {
            entry[QStringLiteral("thumbnailPath")] = thumb;
        }
    }

    QSet<QString> diskIds;
    for (const QJsonObject &obj : std::as_const(entries)) {
        diskIds.insert(obj[QStringLiteral("id")].toString());
    }

    // Built on the first unknown id: entries whose id the disk lacks, by
    // collapsed shader path.
    QHash<QString, std::shared_ptr<ShaderMetadata>> unmatchedByPath;
    bool unmatchedBuilt = false;
    bool saveNeeded = false;

    for (const QJsonObject &obj : std::as_const(entries)) {
        const QString id = obj[QStringLiteral("id")].toString();
        if (id.isEmpty()) {
            continue;
        }

        std::shared_ptr<ShaderMetadata> shader = m_shaderMap.value(id);
        bool adopted = false;
        if (!shader) {
            // A file scanned by two processes gets an id from each, and each
            // save would drop the other's entry. Take the disk's id for the
            // same file; an unknown file is left to refresh().
            if (!unmatchedBuilt) {
                unmatchedBuilt = true;
                for (const auto &candidate : std::as_const(m_shaders)) {
                    if (!diskIds.contains(candidate->id())) {
                        unmatchedByPath.insert(comparablePath(candidate->shaderPath()), candidate);
                    }
                }
            }
            const QString key = comparablePath(QUrl(obj[QStringLiteral("shaderPath")].toString()));
            shader = key.isEmpty() ? nullptr : unmatchedByPath.take(key);
            if (!shader) {
                continue;
            }
            qInfo() << "ShaderLibrary: adopting index id" << id << "for" << key
                    << "(was" << shader->id() << ")";
            m_shaderMap.remove(shader->id());
            shader->setId(id);
            m_shaderMap.insert(id, shader);
            adopted = true;
        }

        bool changed = adopted;
        const bool diskFavorite = obj[QStringLiteral("favorite")].toBool();
        // Adopting merges two entries for one file: a favorite set on either
        // survives, and goes back to disk if only ours had it.
        const bool favorite = adopted ? (diskFavorite || shader->favorite()) : diskFavorite;
        if (favorite != diskFavorite) {
            saveNeeded = true;
        }
        if (shader->favorite() != favorite) {
            shader->setFavorite(favorite);
            changed = true;
        }

        const QString thumbRaw = obj[QStringLiteral("thumbnailPath")].toString();
        if (!thumbRaw.isEmpty()) {
            const QUrl diskThumb = resolveIndexUrl(QUrl(thumbRaw));
            if (comparablePath(diskThumb) != comparablePath(shader->thumbnailPath())) {
                shader->setThumbnailPath(diskThumb);
                changed = true;
            }
        }

        if (changed) {
            Q_EMIT shaderUpdated(id);
        }
    }

    if (saveNeeded) {
        saveIndex();
    }
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
            if (!m_pathMap.contains(filePath.toString()) && !isShadowed(mainShaderPath)) {
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
        if (m_pathMap.contains(filePath.toString()) || isShadowed(info.absoluteFilePath())) {
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
    // by resolving them against the library roots.
    path = resolveLibraryFile(path);

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

    // Shader packages store channel routing in manifest.json — surface it so
    // the config UI can restore it when the package is applied.
    QString mainPath = shaderPath.toLocalFile();
    if (mainPath.isEmpty()) {
        mainPath = shaderPath.path();
    }
    mainPath = resolveLibraryFile(mainPath);
    const QFileInfo mainInfo(mainPath);
    const QString manifestPath = mainInfo.absolutePath() + QStringLiteral("/manifest.json");
    if (mainInfo.completeBaseName() == QStringLiteral("main") && QFile::exists(manifestPath)) {
        QFile manifestFile(manifestPath);
        if (manifestFile.open(QIODevice::ReadOnly | QIODevice::Text)) {
            const QJsonDocument doc = QJsonDocument::fromJson(manifestFile.readAll());
            manifestFile.close();
            if (doc.isObject()) {
                const QJsonObject manifest = doc.object();
                if (manifest.contains(QStringLiteral("channels"))) {
                    bufferCodes[QStringLiteral("channels")] =
                        manifest[QStringLiteral("channels")].toObject().toVariantMap();
                }
                if (manifest.contains(QStringLiteral("bufferChannels"))) {
                    bufferCodes[QStringLiteral("bufferChannels")] =
                        manifest[QStringLiteral("bufferChannels")].toObject().toVariantMap();
                }
            }
        }
    }

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

