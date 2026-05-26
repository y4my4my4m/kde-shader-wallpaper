// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#include "performancemonitor.h"

#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QStandardPaths>
#include <QDir>
#include <QDateTime>
#include <numeric>
#include <algorithm>

PerformanceMonitor::PerformanceMonitor(QObject *parent)
    : QObject(parent)
{
    // Stats update timer - updates statistics every 500ms
    m_statsTimer = new QTimer(this);
    m_statsTimer->setInterval(500);
    connect(m_statsTimer, &QTimer::timeout, this, &PerformanceMonitor::updateStats);
    m_statsTimer->start();
    
    // Load saved performance data
    loadPerformanceData();
}

PerformanceMonitor::~PerformanceMonitor()
{
    // Save performance data on destruction
    savePerformanceData();
}

int PerformanceMonitor::averageFps() const
{
    if (m_averageFrameTime <= 0.0) return 0;
    return static_cast<int>(1000.0 / m_averageFrameTime);
}

QString PerformanceMonitor::performanceTierName() const
{
    switch (m_performanceTier) {
        case TierLow: return QStringLiteral("Low");
        case TierMedium: return QStringLiteral("Medium");
        case TierHigh: return QStringLiteral("High");
        case TierExtreme: return QStringLiteral("Extreme");
        default: return QStringLiteral("Unknown");
    }
}

QString PerformanceMonitor::performanceTierColor() const
{
    switch (m_performanceTier) {
        case TierLow: return QStringLiteral("#27ae60");     // Green
        case TierMedium: return QStringLiteral("#f1c40f");  // Yellow
        case TierHigh: return QStringLiteral("#e67e22");    // Orange
        case TierExtreme: return QStringLiteral("#e74c3c"); // Red
        default: return QStringLiteral("#95a5a6");          // Gray
    }
}

QString PerformanceMonitor::powerCostLabel() const
{
    if (m_estimatedPowerCost < 20) return QStringLiteral("Very Low");
    if (m_estimatedPowerCost < 40) return QStringLiteral("Low");
    if (m_estimatedPowerCost < 60) return QStringLiteral("Medium");
    if (m_estimatedPowerCost < 80) return QStringLiteral("High");
    return QStringLiteral("Very High");
}

QVariantList PerformanceMonitor::frameTimeHistory() const
{
    QVariantList list;
    list.reserve(m_frameTimeHistory.size());
    for (qreal time : m_frameTimeHistory) {
        list.append(time);
    }
    return list;
}

QVariantList PerformanceMonitor::fpsHistory() const
{
    QVariantList list;
    list.reserve(m_fpsHistory.size());
    for (int fps : m_fpsHistory) {
        list.append(fps);
    }
    return list;
}

void PerformanceMonitor::setHistorySize(int size)
{
    if (m_historySize == size) return;
    m_historySize = qBound(30, size, 600);  // 0.5s to 10s at 60fps
    
    // Trim history if needed
    while (m_frameTimeHistory.size() > static_cast<size_t>(m_historySize)) {
        m_frameTimeHistory.pop_front();
    }
    while (m_fpsHistory.size() > static_cast<size_t>(m_historySize)) {
        m_fpsHistory.pop_front();
    }
    
    Q_EMIT historySizeChanged();
}

void PerformanceMonitor::setCurrentShaderId(const QString &id)
{
    if (m_currentShaderId == id) return;
    
    // Save metrics for previous shader before switching
    if (!m_currentShaderId.isEmpty() && m_averageFrameTime > 0) {
        QVariantMap metrics;
        metrics[QStringLiteral("averageFrameTime")] = m_averageFrameTime;
        metrics[QStringLiteral("performanceTier")] = m_performanceTier;
        metrics[QStringLiteral("powerCost")] = m_estimatedPowerCost;
        metrics[QStringLiteral("lastMeasured")] = QDateTime::currentDateTime().toString(Qt::ISODate);
        m_performanceDatabase[m_currentShaderId] = metrics;
    }
    
    m_currentShaderId = id;
    
    // Reset stats for new shader
    reset();
    
    Q_EMIT shaderChanged();
}

void PerformanceMonitor::setHasBuffers(bool has)
{
    if (m_hasBuffers == has) return;
    m_hasBuffers = has;
    updatePowerCost();
    Q_EMIT shaderChanged();
}

void PerformanceMonitor::setHasAudio(bool has)
{
    if (m_hasAudio == has) return;
    m_hasAudio = has;
    updatePowerCost();
    Q_EMIT shaderChanged();
}

void PerformanceMonitor::setEnabled(bool enabled)
{
    if (m_enabled == enabled) return;
    m_enabled = enabled;
    
    if (m_enabled) {
        m_statsTimer->start();
    } else {
        m_statsTimer->stop();
    }
    
    Q_EMIT enabledChanged();
}

void PerformanceMonitor::setRecording(bool recording)
{
    if (m_recording == recording) return;
    m_recording = recording;
    Q_EMIT recordingChanged();
}

void PerformanceMonitor::beginFrame()
{
    if (!m_enabled || !m_recording) return;
    m_frameTimer.start();
}

void PerformanceMonitor::endFrame()
{
    if (!m_enabled || !m_recording) return;
    
    qreal elapsed = m_frameTimer.nsecsElapsed() / 1000000.0;  // ns to ms
    addFrameTime(elapsed);
    
    m_currentFrameTime = elapsed;
    Q_EMIT frameTimeChanged();
    Q_EMIT frameRecorded(elapsed);
}

void PerformanceMonitor::recordFps(int fps)
{
    if (!m_enabled) return;
    
    m_currentFps = fps;
    
    // Add to FPS history
    m_fpsHistory.push_back(fps);
    while (m_fpsHistory.size() > static_cast<size_t>(m_historySize)) {
        m_fpsHistory.pop_front();
    }
}

void PerformanceMonitor::reset()
{
    m_frameTimes.clear();
    m_currentFrameTime = 0.0;
    m_averageFrameTime = 0.0;
    m_minFrameTime = 999.0;
    m_maxFrameTime = 0.0;
    m_currentFps = 0;
    m_performanceTier = TierMedium;
    m_estimatedPowerCost = 50;
    
    Q_EMIT statsChanged();
    Q_EMIT performanceTierChanged();
    Q_EMIT powerCostChanged();
}

void PerformanceMonitor::resetHistory()
{
    m_frameTimeHistory.clear();
    m_fpsHistory.clear();
    Q_EMIT historyChanged();
}

QVariantMap PerformanceMonitor::getShaderPerformance(const QString &shaderId) const
{
    if (m_performanceDatabase.contains(shaderId)) {
        return m_performanceDatabase[shaderId];
    }
    return QVariantMap();
}

void PerformanceMonitor::savePerformanceData()
{
    QString path = getPerformanceDataPath();
    QDir().mkpath(QFileInfo(path).absolutePath());
    
    QJsonObject root;
    for (auto it = m_performanceDatabase.constBegin(); it != m_performanceDatabase.constEnd(); ++it) {
        root[it.key()] = QJsonObject::fromVariantMap(it.value());
    }
    
    QFile file(path);
    if (file.open(QIODevice::WriteOnly)) {
        file.write(QJsonDocument(root).toJson(QJsonDocument::Compact));
        file.close();
        qDebug() << "Saved performance data:" << m_performanceDatabase.size() << "shaders";
    } else {
        qWarning() << "Failed to save performance data:" << path;
    }
}

void PerformanceMonitor::loadPerformanceData()
{
    QString path = getPerformanceDataPath();
    QFile file(path);
    
    if (!file.exists()) return;
    
    if (file.open(QIODevice::ReadOnly)) {
        QJsonDocument doc = QJsonDocument::fromJson(file.readAll());
        file.close();
        
        if (doc.isObject()) {
            QJsonObject root = doc.object();
            for (auto it = root.constBegin(); it != root.constEnd(); ++it) {
                m_performanceDatabase[it.key()] = it.value().toObject().toVariantMap();
            }
            qDebug() << "Loaded performance data for" << m_performanceDatabase.size() << "shaders";
        }
    }
}

void PerformanceMonitor::updateStats()
{
    if (!m_enabled) return;
    
    calculateStats();
    
    // Update performance tier based on average frame time
    int newTier = calculatePerformanceTier(m_averageFrameTime);
    if (newTier != m_performanceTier) {
        m_performanceTier = newTier;
        Q_EMIT performanceTierChanged();
    }
    
    updatePowerCost();
    
    Q_EMIT statsChanged();
    Q_EMIT historyChanged();
}

void PerformanceMonitor::updatePowerCost()
{
    int newCost = calculatePowerCost();
    if (newCost != m_estimatedPowerCost) {
        m_estimatedPowerCost = newCost;
        Q_EMIT powerCostChanged();
    }
}

void PerformanceMonitor::addFrameTime(qreal ms)
{
    // Add to rolling stats window
    m_frameTimes.push_back(ms);
    while (m_frameTimes.size() > STATS_WINDOW) {
        m_frameTimes.pop_front();
    }
    
    // Add to history for graphing
    m_frameTimeHistory.push_back(ms);
    while (m_frameTimeHistory.size() > static_cast<size_t>(m_historySize)) {
        m_frameTimeHistory.pop_front();
    }
}

void PerformanceMonitor::calculateStats()
{
    if (m_frameTimes.empty()) return;
    
    // Calculate average
    qreal sum = std::accumulate(m_frameTimes.begin(), m_frameTimes.end(), 0.0);
    m_averageFrameTime = sum / m_frameTimes.size();
    
    // Calculate min/max
    auto [minIt, maxIt] = std::minmax_element(m_frameTimes.begin(), m_frameTimes.end());
    m_minFrameTime = *minIt;
    m_maxFrameTime = *maxIt;
}

int PerformanceMonitor::calculatePerformanceTier(qreal avgFrameTime) const
{
    // Classification based on frame time
    // Lower frame time = better performance = lower tier number
    if (avgFrameTime < 4.0) return TierLow;       // < 4ms = very efficient
    if (avgFrameTime < 8.0) return TierMedium;    // 4-8ms = moderate
    if (avgFrameTime < 16.0) return TierHigh;     // 8-16ms = demanding
    return TierExtreme;                            // > 16ms = very demanding
}

int PerformanceMonitor::calculatePowerCost() const
{
    // Base cost from frame time (0-60 range)
    int baseCost = 0;
    if (m_averageFrameTime <= 0) {
        baseCost = 50;  // Unknown
    } else if (m_averageFrameTime < 2.0) {
        baseCost = 10;
    } else if (m_averageFrameTime < 4.0) {
        baseCost = 20;
    } else if (m_averageFrameTime < 8.0) {
        baseCost = 35;
    } else if (m_averageFrameTime < 16.0) {
        baseCost = 50;
    } else if (m_averageFrameTime < 33.0) {
        baseCost = 70;
    } else {
        baseCost = 85;
    }
    
    // Modifiers for shader complexity
    int modifier = 0;
    if (m_hasBuffers) modifier += 15;  // Multi-pass shaders use more resources
    if (m_hasAudio) modifier += 5;     // Audio processing adds overhead
    
    return qBound(0, baseCost + modifier, 100);
}

QString PerformanceMonitor::getPerformanceDataPath() const
{
    QString dataPath = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    return dataPath + QStringLiteral("/shaderwallpaper/performance.json");
}




