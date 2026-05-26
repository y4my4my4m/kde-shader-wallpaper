// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#ifndef SHADERTOYAPI_H
#define SHADERTOYAPI_H

#include <QObject>
#include <QtQml/qqmlregistration.h>
#include <QNetworkAccessManager>
#include <QUrl>
#include <QJsonObject>
#include <QJsonArray>

class ShaderConverter;

/**
 * @brief Shadertoy API client for importing shaders
 * 
 * Supports:
 * - Fetching shader by ID from API
 * - Parsing shader URL to extract ID
 * - Downloading shader assets (textures, cubemaps)
 * - Converting Shadertoy format to Qt-compatible format
 */
class ShadertoyAPI : public QObject
{
    Q_OBJECT
    QML_ELEMENT

    Q_PROPERTY(QString apiKey READ apiKey WRITE setApiKey NOTIFY apiKeyChanged)
    Q_PROPERTY(bool busy READ busy NOTIFY busyChanged)
    Q_PROPERTY(QString lastError READ lastError NOTIFY lastErrorChanged)

public:
    // Default API key (can be overridden by user)
    static inline const QString DEFAULT_API_KEY = QStringLiteral("BdHtWn"); // Shadertoy public API key
    
    explicit ShadertoyAPI(QObject *parent = nullptr);
    ~ShadertoyAPI() override;

    // Property getters
    QString apiKey() const { return m_apiKey; }
    bool busy() const { return m_busy; }
    QString lastError() const { return m_lastError; }

    // Property setters
    void setApiKey(const QString &key);

    /**
     * @brief Fetch shader from Shadertoy by ID
     * @param shaderId The shader ID (e.g., "XsX3RB")
     */
    Q_INVOKABLE void fetchShader(const QString &shaderId);
    
    /**
     * @brief Import shader from Shadertoy URL
     * @param url Full URL (e.g., "https://www.shadertoy.com/view/XsX3RB")
     */
    Q_INVOKABLE void importFromUrl(const QString &url);
    
    /**
     * @brief Parse shader ID from URL
     * @return Shader ID or empty string if invalid
     */
    Q_INVOKABLE QString parseIdFromUrl(const QString &url);
    
    /**
     * @brief Search shaders on Shadertoy
     * @param query Search query
     * @param sort Sort order: "popular", "newest", "love", "hot"
     * @param count Number of results (max 100)
     */
    Q_INVOKABLE void searchShaders(const QString &query, const QString &sort = QStringLiteral("popular"), int count = 25);
    
    /**
     * @brief Get popular/featured shaders
     */
    Q_INVOKABLE void fetchPopular(int count = 25);

    /**
     * @brief Cancel ongoing request
     */
    Q_INVOKABLE void cancel();

    /**
     * @brief Check if shader uses features we support
     */
    Q_INVOKABLE bool isSupportedShader(const QJsonObject &shaderInfo);
    
    /**
     * @brief Scrape shader from Shadertoy webpage (bypasses API)
     * @param url Full Shadertoy URL
     * 
     * This fetches the HTML page directly and extracts the shader JSON
     * from the embedded JavaScript. Use when API is unavailable.
     */
    Q_INVOKABLE void scrapeFromPage(const QString &url);

Q_SIGNALS:
    void apiKeyChanged();
    void busyChanged();
    void lastErrorChanged();
    
    /**
     * @brief Emitted when shader is successfully fetched
     * @param shaderData JSON object with shader data
     */
    void shaderFetched(const QJsonObject &shaderData);
    
    /**
     * @brief Emitted when shader is converted and ready to use
     * @param mainCode Main image shader code
     * @param bufferCodes Map of buffer names to code
     * @param commonCode Shared code prepended to all passes
     * @param metadata Shader metadata (name, author, description, etc.)
     */
    void shaderReady(const QString &mainCode, 
                     const QVariantMap &bufferCodes,
                     const QString &commonCode,
                     const QVariantMap &metadata);
    
    /**
     * @brief Emitted with search results
     * @param results Array of shader info objects
     */
    void searchResults(const QJsonArray &results);
    
    /**
     * @brief Emitted when an error occurs
     */
    void errorOccurred(const QString &error);
    
    /**
     * @brief Emitted for download progress
     */
    void progressChanged(int current, int total, const QString &status);

private Q_SLOTS:
    void handleShaderResponse();
    void handleSearchResponse();
    void handleScrapeResponse();

private:
    void setError(const QString &error);
    void clearError();
    void setBusy(bool busy);
    QJsonObject processShaderJson(const QJsonObject &json);
    QString convertRenderPass(const QJsonObject &pass);
    QUrl resolveInputUrl(const QJsonObject &input);
    QJsonObject extractShaderJsonFromHtml(const QString &html);
    void processExtractedShader(const QJsonObject &shader);

    QString m_apiKey = DEFAULT_API_KEY;
    bool m_busy = false;
    QString m_lastError;
    
    QNetworkAccessManager *m_networkManager = nullptr;
    QNetworkReply *m_currentReply = nullptr;
    
    ShaderConverter *m_converter = nullptr;
};

#endif // SHADERTOYAPI_H

