// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "shadertoyapi.h"
#include "shaderconverter.h"

#include <QNetworkReply>
#include <QJsonDocument>
#include <QJsonArray>
#include <QRegularExpression>
#include <QUrlQuery>

static const QString API_BASE = QStringLiteral("https://www.shadertoy.com/api/v1");

ShadertoyAPI::ShadertoyAPI(QObject *parent)
    : QObject(parent)
    , m_networkManager(new QNetworkAccessManager(this))
    , m_converter(new ShaderConverter(this))
{
}

ShadertoyAPI::~ShadertoyAPI()
{
    cancel();
}

void ShadertoyAPI::setApiKey(const QString &key)
{
    if (m_apiKey == key) return;
    m_apiKey = key.isEmpty() ? QString(DEFAULT_API_KEY) : key;
    Q_EMIT apiKeyChanged();
}

void ShadertoyAPI::fetchShader(const QString &shaderId)
{
    if (shaderId.isEmpty()) {
        setError(QStringLiteral("Shader ID is empty"));
        return;
    }
    
    cancel();
    clearError();
    setBusy(true);
    
    QUrl url(QStringLiteral("%1/shaders/%2").arg(API_BASE, shaderId));
    QUrlQuery query;
    query.addQueryItem(QStringLiteral("key"), m_apiKey);
    url.setQuery(query);
    
    QNetworkRequest request(url);
    request.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    
    m_currentReply = m_networkManager->get(request);
    connect(m_currentReply, &QNetworkReply::finished, this, &ShadertoyAPI::handleShaderResponse);
    
    Q_EMIT progressChanged(0, 100, QStringLiteral("Fetching shader..."));
}

void ShadertoyAPI::importFromUrl(const QString &url)
{
    QString shaderId = parseIdFromUrl(url);
    if (shaderId.isEmpty()) {
        setError(QStringLiteral("Invalid Shadertoy URL"));
        return;
    }
    
    fetchShader(shaderId);
}

void ShadertoyAPI::scrapeFromPage(const QString &url)
{
    QString shaderId = parseIdFromUrl(url);
    if (shaderId.isEmpty()) {
        setError(QStringLiteral("Invalid Shadertoy URL"));
        return;
    }
    
    cancel();
    clearError();
    setBusy(true);
    
    // Construct the page URL (not the API URL)
    QUrl pageUrl(QStringLiteral("https://www.shadertoy.com/view/%1").arg(shaderId));
    
    QNetworkRequest request(pageUrl);
    // Set comprehensive browser-like headers to avoid being blocked
    request.setHeader(QNetworkRequest::UserAgentHeader, 
        QStringLiteral("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"));
    request.setRawHeader("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8");
    request.setRawHeader("Accept-Language", "en-US,en;q=0.9");
    request.setRawHeader("Accept-Encoding", "gzip, deflate, br");
    request.setRawHeader("Cache-Control", "no-cache");
    request.setRawHeader("Pragma", "no-cache");
    request.setRawHeader("Sec-Ch-Ua", "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\"");
    request.setRawHeader("Sec-Ch-Ua-Mobile", "?0");
    request.setRawHeader("Sec-Ch-Ua-Platform", "\"Linux\"");
    request.setRawHeader("Sec-Fetch-Dest", "document");
    request.setRawHeader("Sec-Fetch-Mode", "navigate");
    request.setRawHeader("Sec-Fetch-Site", "none");
    request.setRawHeader("Sec-Fetch-User", "?1");
    request.setRawHeader("Upgrade-Insecure-Requests", "1");
    
    m_currentReply = m_networkManager->get(request);
    connect(m_currentReply, &QNetworkReply::finished, this, &ShadertoyAPI::handleScrapeResponse);
    
    Q_EMIT progressChanged(0, 100, QStringLiteral("Fetching page..."));
}

QString ShadertoyAPI::parseIdFromUrl(const QString &url)
{
    // Match URLs like:
    // https://www.shadertoy.com/view/XsX3RB
    // https://shadertoy.com/view/XsX3RB
    // www.shadertoy.com/view/XsX3RB
    // shadertoy.com/view/XsX3RB
    
    QRegularExpression regex(QStringLiteral(R"((?:https?://)?(?:www\.)?shadertoy\.com/view/([A-Za-z0-9]+))"));
    QRegularExpressionMatch match = regex.match(url);
    
    if (match.hasMatch()) {
        return match.captured(1);
    }
    
    // Maybe it's just the ID
    QRegularExpression idRegex(QStringLiteral(R"(^[A-Za-z0-9]{6,8}$)"));
    if (idRegex.match(url).hasMatch()) {
        return url;
    }
    
    return QString();
}

void ShadertoyAPI::searchShaders(const QString &query, const QString &sort, int count)
{
    cancel();
    clearError();
    setBusy(true);
    
    QUrl url(QStringLiteral("%1/shaders/query/%2").arg(API_BASE, query));
    QUrlQuery urlQuery;
    urlQuery.addQueryItem(QStringLiteral("key"), m_apiKey);
    urlQuery.addQueryItem(QStringLiteral("sort"), sort);
    urlQuery.addQueryItem(QStringLiteral("num"), QString::number(qBound(1, count, 100)));
    url.setQuery(urlQuery);
    
    QNetworkRequest request(url);
    m_currentReply = m_networkManager->get(request);
    connect(m_currentReply, &QNetworkReply::finished, this, &ShadertoyAPI::handleSearchResponse);
    
    Q_EMIT progressChanged(0, 100, QStringLiteral("Searching shaders..."));
}

void ShadertoyAPI::fetchPopular(int count)
{
    searchShaders(QString(), QStringLiteral("popular"), count);
}

void ShadertoyAPI::cancel()
{
    if (m_currentReply) {
        m_currentReply->abort();
        m_currentReply->deleteLater();
        m_currentReply = nullptr;
    }
    setBusy(false);
}

bool ShadertoyAPI::isSupportedShader(const QJsonObject &shaderInfo)
{
    QJsonArray renderpasses = shaderInfo[QStringLiteral("renderpass")].toArray();
    
    for (const auto &passRef : renderpasses) {
        QJsonObject pass = passRef.toObject();
        QString type = pass[QStringLiteral("type")].toString();
        
        // We support: image, buffer
        // We don't support: sound, cubemap (yet)
        if (type == QLatin1String("sound")) {
            return false;
        }
        
        // Check inputs
        QJsonArray inputs = pass[QStringLiteral("inputs")].toArray();
        for (const auto &inputRef : inputs) {
            QJsonObject input = inputRef.toObject();
            QString inputType = input[QStringLiteral("ctype")].toString();
            
            // We support: texture, buffer, keyboard
            // Limited support: cubemap, video, music, webcam, microphone
            if (inputType == QLatin1String("video") || inputType == QLatin1String("webcam") || inputType == QLatin1String("microphone")) {
                // These require special handling
            }
        }
    }
    
    return true;
}

void ShadertoyAPI::handleShaderResponse()
{
    if (!m_currentReply) return;
    
    Q_EMIT progressChanged(50, 100, QStringLiteral("Processing shader..."));
    
    if (m_currentReply->error() != QNetworkReply::NoError) {
        setError(QStringLiteral("Network error: %1").arg(m_currentReply->errorString()));
        m_currentReply->deleteLater();
        m_currentReply = nullptr;
        setBusy(false);
        return;
    }
    
    QByteArray data = m_currentReply->readAll();
    m_currentReply->deleteLater();
    m_currentReply = nullptr;
    
    QJsonParseError parseError;
    QJsonDocument doc = QJsonDocument::fromJson(data, &parseError);
    
    if (parseError.error != QJsonParseError::NoError) {
        setError(QStringLiteral("JSON parse error: %1").arg(parseError.errorString()));
        setBusy(false);
        return;
    }
    
    QJsonObject root = doc.object();
    
    // Check for API error
    if (root.contains(QStringLiteral("Error"))) {
        setError(root[QStringLiteral("Error")].toString());
        setBusy(false);
        return;
    }
    
    QJsonObject shader = root[QStringLiteral("Shader")].toObject();
    Q_EMIT shaderFetched(shader);
    
    Q_EMIT progressChanged(75, 100, QStringLiteral("Converting shader..."));
    
    // Process and convert the shader
    QJsonObject processed = processShaderJson(shader);
    
    // Extract metadata
    QJsonObject info = shader[QStringLiteral("info")].toObject();
    QVariantMap metadata;
    metadata[QStringLiteral("id")] = info[QStringLiteral("id")].toString();
    metadata[QStringLiteral("name")] = info[QStringLiteral("name")].toString();
    metadata[QStringLiteral("author")] = info[QStringLiteral("username")].toString();
    metadata[QStringLiteral("description")] = info[QStringLiteral("description")].toString();
    metadata[QStringLiteral("likes")] = info[QStringLiteral("likes")].toInt();
    metadata[QStringLiteral("views")] = info[QStringLiteral("viewed")].toInt();
    metadata[QStringLiteral("date")] = info[QStringLiteral("date")].toString();
    metadata[QStringLiteral("tags")] = info[QStringLiteral("tags")].toArray().toVariantList();
    
    // Convert each renderpass
    QString mainCode;
    QString commonCode;
    QVariantMap bufferCodes;
    
    QJsonArray renderpasses = shader[QStringLiteral("renderpass")].toArray();
    for (const auto &passRef : renderpasses) {
        QJsonObject pass = passRef.toObject();
        QString type = pass[QStringLiteral("type")].toString();
        QString code = pass[QStringLiteral("code")].toString();
        
        // Common code doesn't need full conversion (no mainImage wrapper)
        if (type == QLatin1String("common")) {
            // Just do basic preprocessing for common code
            commonCode = code;
            continue;
        }
        
        // Convert to Qt-compatible GLSL
        QString convertedCode = m_converter->convert(code);
        
        if (type == QLatin1String("image")) {
            mainCode = convertedCode;
        } else if (type == QLatin1String("buffer")) {
            QString name = pass[QStringLiteral("name")].toString();
            if (name.isEmpty()) {
                // Use output ID to determine buffer name
                QJsonArray outputs = pass[QStringLiteral("outputs")].toArray();
                if (!outputs.isEmpty()) {
                    int outputId = outputs[0].toObject()[QStringLiteral("id")].toInt();
                    // Shadertoy buffer IDs: 257=BufferA, 258=BufferB, etc.
                    switch (outputId) {
                        case 257: name = QStringLiteral("BufferA"); break;
                        case 258: name = QStringLiteral("BufferB"); break;
                        case 259: name = QStringLiteral("BufferC"); break;
                        case 260: name = QStringLiteral("BufferD"); break;
                        default: name = QStringLiteral("Buffer%1").arg(outputId);
                    }
                }
            }
            bufferCodes[name] = convertedCode;
        }
    }
    
    Q_EMIT progressChanged(100, 100, QStringLiteral("Done!"));
    Q_EMIT shaderReady(mainCode, bufferCodes, commonCode, metadata);
    
    setBusy(false);
}

void ShadertoyAPI::handleSearchResponse()
{
    if (!m_currentReply) return;
    
    if (m_currentReply->error() != QNetworkReply::NoError) {
        setError(QStringLiteral("Network error: %1").arg(m_currentReply->errorString()));
        m_currentReply->deleteLater();
        m_currentReply = nullptr;
        setBusy(false);
        return;
    }
    
    QByteArray data = m_currentReply->readAll();
    m_currentReply->deleteLater();
    m_currentReply = nullptr;
    
    QJsonDocument doc = QJsonDocument::fromJson(data);
    QJsonObject root = doc.object();
    
    if (root.contains(QStringLiteral("Error"))) {
        setError(root[QStringLiteral("Error")].toString());
        setBusy(false);
        return;
    }
    
    QJsonArray results = root[QStringLiteral("Results")].toArray();
    Q_EMIT searchResults(results);
    
    setBusy(false);
}

void ShadertoyAPI::handleScrapeResponse()
{
    if (!m_currentReply) return;
    
    Q_EMIT progressChanged(30, 100, QStringLiteral("Parsing page..."));
    
    // Get HTTP status code
    int httpStatus = m_currentReply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
    QString httpReason = m_currentReply->attribute(QNetworkRequest::HttpReasonPhraseAttribute).toString();
    
    if (m_currentReply->error() != QNetworkReply::NoError) {
        QString errorDetail = m_currentReply->errorString();
        QByteArray responseBody = m_currentReply->readAll();
        
        QString fullError = QStringLiteral("Network error (HTTP %1 %2): %3")
            .arg(httpStatus)
            .arg(httpReason)
            .arg(errorDetail);
        
        // Add response body snippet if available
        if (!responseBody.isEmpty()) {
            QString bodySnippet = QString::fromUtf8(responseBody.left(200));
            fullError += QStringLiteral("\nResponse: %1").arg(bodySnippet);
        }
        
        setError(fullError);
        m_currentReply->deleteLater();
        m_currentReply = nullptr;
        setBusy(false);
        return;
    }
    
    QByteArray data = m_currentReply->readAll();
    m_currentReply->deleteLater();
    m_currentReply = nullptr;
    
    // Check for empty response
    if (data.isEmpty()) {
        setError(QStringLiteral("Server returned empty response (HTTP %1). Shadertoy may be blocking automated requests.").arg(httpStatus));
        setBusy(false);
        return;
    }
    
    QString html = QString::fromUtf8(data);
    
    // Check for various error conditions
    if (html.contains(QStringLiteral("404")) && html.contains(QStringLiteral("Not Found"))) {
        setError(QStringLiteral("Shader not found (404)"));
        setBusy(false);
        return;
    }
    
    // Check for access denied / rate limiting
    if (html.contains(QStringLiteral("Access Denied")) || 
        html.contains(QStringLiteral("Rate Limit")) ||
        html.contains(QStringLiteral("Captcha")) ||
        html.contains(QStringLiteral("blocked"))) {
        setError(QStringLiteral("Access denied by Shadertoy. The site may be blocking automated requests or requiring CAPTCHA."));
        setBusy(false);
        return;
    }
    
    // Extract shader JSON from the page
    QJsonObject shader = extractShaderJsonFromHtml(html);
    
    if (shader.isEmpty()) {
        setError(QStringLiteral("Could not extract shader data from page. The shader may be private or the page structure has changed."));
        setBusy(false);
        return;
    }
    
    Q_EMIT progressChanged(50, 100, QStringLiteral("Processing shader..."));
    
    // Process the shader the same way as API response
    processExtractedShader(shader);
}

QJsonObject ShadertoyAPI::extractShaderJsonFromHtml(const QString &html)
{
    // Shadertoy embeds shader data in a JavaScript variable
    // Look for patterns like: var gShaderToy = { ... }
    // or within a script tag containing shader info JSON
    
    QJsonObject result;
    
    // Pattern 1: Look for gShaderToy object initialization
    // The page typically has: gShaderToy.SetTexture(...) and shader code in the DOM
    
    // Pattern 2: Look for the shader JSON in a script tag
    // Sometimes it's in: <script id="shader-code"> or similar
    
    // Pattern 3: Look for renderpass data in embedded JSON
    // The most reliable is finding the JSON blob with "renderpass" array
    
    // Try to find JSON object containing renderpass
    QRegularExpression jsonRegex(QStringLiteral(
        R"(\{[^{}]*"renderpass"\s*:\s*\[[^\]]*\{[^}]*"code"\s*:[^}]*\}[^\]]*\][^{}]*\})"
    ), QRegularExpression::DotMatchesEverythingOption);
    
    // More targeted: look for the shader initialization
    // Shadertoy uses: gShaderToy.mEffect.mPasses[i] = {...code:...}
    
    // Alternative: Look for the info JSON that contains shader metadata
    QRegularExpression infoRegex(QStringLiteral(
        R"("info"\s*:\s*\{[^}]*"id"\s*:\s*"[^"]+""[^}]*\})"
    ));
    
    // Most reliable: Find the full shader JSON embedded in the page
    // Shadertoy typically includes: {"ver":"x.x","info":{...},"renderpass":[...]}
    
    // Look for renderpass array with code
    QRegularExpression codeBlockRegex(QStringLiteral(
        R"("code"\s*:\s*"((?:[^"\\]|\\.)*))"
    ));
    
    QRegularExpression fullShaderRegex(QStringLiteral(
        R"(\{"ver"\s*:\s*"[^"]*"\s*,\s*"info"\s*:\s*\{[^}]+\}\s*,\s*"renderpass"\s*:\s*\[[\s\S]*?\]\s*\})"
    ));
    
    QRegularExpressionMatch fullMatch = fullShaderRegex.match(html);
    if (fullMatch.hasMatch()) {
        QString jsonStr = fullMatch.captured(0);
        QJsonParseError parseError;
        QJsonDocument doc = QJsonDocument::fromJson(jsonStr.toUtf8(), &parseError);
        if (parseError.error == QJsonParseError::NoError && doc.isObject()) {
            return doc.object();
        }
    }
    
    // Fallback: Try to find shader data in different format
    // Look for the shader initialization script
    QRegularExpression scriptDataRegex(QStringLiteral(
        R"(gShaderToy\.SetShader\s*\(\s*(\{[\s\S]*?\})\s*\))"
    ));
    
    QRegularExpressionMatch scriptMatch = scriptDataRegex.match(html);
    if (scriptMatch.hasMatch()) {
        QString jsonStr = scriptMatch.captured(1);
        QJsonParseError parseError;
        QJsonDocument doc = QJsonDocument::fromJson(jsonStr.toUtf8(), &parseError);
        if (parseError.error == QJsonParseError::NoError && doc.isObject()) {
            return doc.object();
        }
    }
    
    // Another fallback: extract individual pieces
    // Look for shader info
    QRegularExpression nameRegex(QStringLiteral(R"(<title>([^<]*) - Shadertoy)"));
    QRegularExpressionMatch nameMatch = nameRegex.match(html);
    QString shaderName = nameMatch.hasMatch() ? nameMatch.captured(1).trimmed() : QStringLiteral("Unknown Shader");
    
    // Look for author
    QRegularExpression authorRegex(QStringLiteral(R"re(href="/user/([^"]+)")re"));
    QRegularExpressionMatch authorMatch = authorRegex.match(html);
    QString author = authorMatch.hasMatch() ? authorMatch.captured(1) : QStringLiteral("Unknown");
    
    // Try to find code blocks - Shadertoy shows code in <pre> or in JavaScript strings
    // The main shader code is often in a textarea or div with specific id
    QRegularExpression textareaRegex(QStringLiteral(
        R"(<textarea[^>]*id="code"[^>]*>([\s\S]*?)</textarea>)"
    ));
    
    QRegularExpressionMatch textareaMatch = textareaRegex.match(html);
    if (textareaMatch.hasMatch()) {
        QString code = textareaMatch.captured(1);
        // Unescape HTML entities
        code.replace(QStringLiteral("&lt;"), QStringLiteral("<"));
        code.replace(QStringLiteral("&gt;"), QStringLiteral(">"));
        code.replace(QStringLiteral("&amp;"), QStringLiteral("&"));
        code.replace(QStringLiteral("&quot;"), QStringLiteral("\""));
        code.replace(QStringLiteral("&#39;"), QStringLiteral("'"));
        
        // Build a minimal shader object
        QJsonObject info;
        info[QStringLiteral("name")] = shaderName;
        info[QStringLiteral("username")] = author;
        info[QStringLiteral("description")] = QString();
        
        QJsonObject imagePass;
        imagePass[QStringLiteral("type")] = QStringLiteral("image");
        imagePass[QStringLiteral("code")] = code;
        imagePass[QStringLiteral("inputs")] = QJsonArray();
        imagePass[QStringLiteral("outputs")] = QJsonArray();
        
        QJsonArray renderpasses;
        renderpasses.append(imagePass);
        
        result[QStringLiteral("info")] = info;
        result[QStringLiteral("renderpass")] = renderpasses;
        
        return result;
    }
    
    // Last resort: look for code in JavaScript strings
    // Shadertoy may have code like: mSources[0] = "void mainImage..."
    QRegularExpression jsCodeRegex(QStringLiteral(
        R"(mSources\[\d+\]\s*=\s*"((?:[^"\\]|\\.)*))"
    ));
    
    QRegularExpressionMatchIterator it = jsCodeRegex.globalMatch(html);
    QStringList codes;
    while (it.hasNext()) {
        QRegularExpressionMatch match = it.next();
        QString code = match.captured(1);
        // Unescape JavaScript string
        code.replace(QStringLiteral("\\n"), QStringLiteral("\n"));
        code.replace(QStringLiteral("\\t"), QStringLiteral("\t"));
        code.replace(QStringLiteral("\\\""), QStringLiteral("\""));
        code.replace(QStringLiteral("\\'"), QStringLiteral("'"));
        code.replace(QStringLiteral("\\\\"), QStringLiteral("\\"));
        codes.append(code);
    }
    
    if (!codes.isEmpty()) {
        QJsonObject info;
        info[QStringLiteral("name")] = shaderName;
        info[QStringLiteral("username")] = author;
        
        QJsonArray renderpasses;
        
        // First code is usually the image pass, rest are buffers
        for (int i = 0; i < codes.size(); i++) {
            QJsonObject pass;
            pass[QStringLiteral("code")] = codes[i];
            pass[QStringLiteral("inputs")] = QJsonArray();
            pass[QStringLiteral("outputs")] = QJsonArray();
            
            if (i == 0 || codes[i].contains(QStringLiteral("mainImage"))) {
                // Determine if this is a buffer or main image
                // In Shadertoy, buffers come before the image pass
                if (i < codes.size() - 1) {
                    pass[QStringLiteral("type")] = QStringLiteral("buffer");
                    pass[QStringLiteral("name")] = QStringLiteral("Buffer%1").arg(QChar('A' + i));
                } else {
                    pass[QStringLiteral("type")] = QStringLiteral("image");
                }
            }
            
            renderpasses.append(pass);
        }
        
        result[QStringLiteral("info")] = info;
        result[QStringLiteral("renderpass")] = renderpasses;
    }
    
    return result;
}

void ShadertoyAPI::processExtractedShader(const QJsonObject &shader)
{
    Q_EMIT shaderFetched(shader);
    
    Q_EMIT progressChanged(75, 100, QStringLiteral("Converting shader..."));
    
    // Extract metadata
    QJsonObject info = shader[QStringLiteral("info")].toObject();
    QVariantMap metadata;
    metadata[QStringLiteral("id")] = info[QStringLiteral("id")].toString();
    metadata[QStringLiteral("name")] = info[QStringLiteral("name")].toString();
    metadata[QStringLiteral("author")] = info[QStringLiteral("username")].toString();
    metadata[QStringLiteral("description")] = info[QStringLiteral("description")].toString();
    metadata[QStringLiteral("likes")] = info[QStringLiteral("likes")].toInt();
    metadata[QStringLiteral("views")] = info[QStringLiteral("viewed")].toInt();
    metadata[QStringLiteral("date")] = info[QStringLiteral("date")].toString();
    metadata[QStringLiteral("tags")] = info[QStringLiteral("tags")].toArray().toVariantList();
    metadata[QStringLiteral("source")] = QStringLiteral("scrape"); // Mark as scraped
    
    // Convert each renderpass
    QString mainCode;
    QString commonCode;
    QVariantMap bufferCodes;
    
    QJsonArray renderpasses = shader[QStringLiteral("renderpass")].toArray();
    for (const auto &passRef : renderpasses) {
        QJsonObject pass = passRef.toObject();
        QString type = pass[QStringLiteral("type")].toString();
        QString code = pass[QStringLiteral("code")].toString();
        
        // Skip empty code
        if (code.isEmpty()) continue;
        
        // Common code doesn't need full conversion (no mainImage wrapper)
        if (type == QLatin1String("common")) {
            commonCode = code;
            continue;
        }
        
        // Convert to Qt-compatible GLSL
        QString convertedCode = m_converter->convert(code);
        
        if (type == QLatin1String("image")) {
            mainCode = convertedCode;
        } else if (type == QLatin1String("buffer")) {
            QString name = pass[QStringLiteral("name")].toString();
            if (name.isEmpty()) {
                // Use output ID to determine buffer name
                QJsonArray outputs = pass[QStringLiteral("outputs")].toArray();
                if (!outputs.isEmpty()) {
                    int outputId = outputs[0].toObject()[QStringLiteral("id")].toInt();
                    switch (outputId) {
                        case 257: name = QStringLiteral("BufferA"); break;
                        case 258: name = QStringLiteral("BufferB"); break;
                        case 259: name = QStringLiteral("BufferC"); break;
                        case 260: name = QStringLiteral("BufferD"); break;
                        default: name = QStringLiteral("Buffer%1").arg(outputId);
                    }
                } else {
                    // Assign based on order
                    static int bufferIndex = 0;
                    name = QStringLiteral("Buffer%1").arg(QChar('A' + (bufferIndex++ % 4)));
                }
            }
            bufferCodes[name] = convertedCode;
        }
    }
    
    // If no main code found but we have buffer codes, 
    // the last non-buffer pass might be the main
    if (mainCode.isEmpty() && !bufferCodes.isEmpty()) {
        // Check if any renderpass wasn't categorized
        for (const auto &passRef : renderpasses) {
            QJsonObject pass = passRef.toObject();
            QString type = pass[QStringLiteral("type")].toString();
            QString code = pass[QStringLiteral("code")].toString();
            
            if (type.isEmpty() && !code.isEmpty()) {
                mainCode = m_converter->convert(code);
                break;
            }
        }
    }
    
    Q_EMIT progressChanged(100, 100, QStringLiteral("Done!"));
    Q_EMIT shaderReady(mainCode, bufferCodes, commonCode, metadata);
    
    setBusy(false);
}

QJsonObject ShadertoyAPI::processShaderJson(const QJsonObject &json)
{
    // Process shader JSON and extract relevant info
    QJsonObject result;
    
    QJsonObject info = json[QStringLiteral("info")].toObject();
    result[QStringLiteral("name")] = info[QStringLiteral("name")];
    result[QStringLiteral("author")] = info[QStringLiteral("username")];
    result[QStringLiteral("description")] = info[QStringLiteral("description")];
    
    QJsonArray renderpasses = json[QStringLiteral("renderpass")].toArray();
    QJsonArray processedPasses;
    
    for (const auto &passRef : renderpasses) {
        QJsonObject pass = passRef.toObject();
        QJsonObject processedPass;
        
        processedPass[QStringLiteral("type")] = pass[QStringLiteral("type")];
        processedPass[QStringLiteral("code")] = pass[QStringLiteral("code")];
        processedPass[QStringLiteral("name")] = pass[QStringLiteral("name")];
        
        // Process inputs
        QJsonArray inputs = pass[QStringLiteral("inputs")].toArray();
        QJsonArray processedInputs;
        
        for (const auto &inputRef : inputs) {
            QJsonObject input = inputRef.toObject();
            QJsonObject processedInput;
            
            processedInput[QStringLiteral("channel")] = input[QStringLiteral("channel")];
            processedInput[QStringLiteral("type")] = input[QStringLiteral("ctype")];
            processedInput[QStringLiteral("id")] = input[QStringLiteral("id")];
            
            // Resolve texture URLs
            if (input[QStringLiteral("ctype")].toString() == QLatin1String("texture")) {
                processedInput[QStringLiteral("url")] = resolveInputUrl(input).toString();
            }
            
            processedInputs.append(processedInput);
        }
        
        processedPass[QStringLiteral("inputs")] = processedInputs;
        processedPasses.append(processedPass);
    }
    
    result[QStringLiteral("renderpasses")] = processedPasses;
    
    return result;
}

QString ShadertoyAPI::convertRenderPass(const QJsonObject &pass)
{
    QString code = pass[QStringLiteral("code")].toString();
    return m_converter->convert(code);
}

QUrl ShadertoyAPI::resolveInputUrl(const QJsonObject &input)
{
    // Shadertoy texture URLs
    // Example: "/media/a/xxx.jpg"
    QString src = input[QStringLiteral("src")].toString();
  
    if (src.startsWith(QStringLiteral("/media/"))) {
        return QUrl(QStringLiteral("https://www.shadertoy.com") + src);
    }
    
    return QUrl(src);
}

void ShadertoyAPI::setError(const QString &error)
{
    if (m_lastError == error) return;
    m_lastError = error;
    Q_EMIT lastErrorChanged();
    Q_EMIT errorOccurred(error);
}

void ShadertoyAPI::clearError()
{
    setError(QString());
}

void ShadertoyAPI::setBusy(bool busy)
{
    if (m_busy == busy) return;
    m_busy = busy;
    Q_EMIT busyChanged();
}

