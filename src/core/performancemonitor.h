// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 @y4my4my4m <y4my4m@protonmail.com>

#ifndef PERFORMANCEMONITOR_H
#define PERFORMANCEMONITOR_H

#include <QObject>
#include <QtQml/qqmlregistration.h>
#include <QElapsedTimer>
#include <QTimer>
#include <QVariantList>
#include <QUrl>
#include <array>
#include <deque>

/**
 * @brief Performance monitoring for shader rendering
 * 
 * Tracks:
 * - Frame render times (ms)
 * - FPS statistics
 * - Performance tier classification
 * - Historical data for graphing
 * - Power/energy estimation
 */
class PerformanceMonitor : public QObject
{
    Q_OBJECT
    QML_ELEMENT

    // Real-time metrics
    Q_PROPERTY(qreal currentFrameTime READ currentFrameTime NOTIFY frameTimeChanged)
    Q_PROPERTY(qreal averageFrameTime READ averageFrameTime NOTIFY statsChanged)
    Q_PROPERTY(qreal minFrameTime READ minFrameTime NOTIFY statsChanged)
    Q_PROPERTY(qreal maxFrameTime READ maxFrameTime NOTIFY statsChanged)
    Q_PROPERTY(int currentFps READ currentFps NOTIFY statsChanged)
    Q_PROPERTY(int averageFps READ averageFps NOTIFY statsChanged)
    
    // Performance tier (0=Low, 1=Medium, 2=High, 3=Extreme)
    Q_PROPERTY(int performanceTier READ performanceTier NOTIFY performanceTierChanged)
    Q_PROPERTY(QString performanceTierName READ performanceTierName NOTIFY performanceTierChanged)
    Q_PROPERTY(QString performanceTierColor READ performanceTierColor NOTIFY performanceTierChanged)
    
    // Power estimation (relative scale 0-100)
    Q_PROPERTY(int estimatedPowerCost READ estimatedPowerCost NOTIFY powerCostChanged)
    Q_PROPERTY(QString powerCostLabel READ powerCostLabel NOTIFY powerCostChanged)
    
    // Graph data (last N frame times for visualization)
    Q_PROPERTY(QVariantList frameTimeHistory READ frameTimeHistory NOTIFY historyChanged)
    Q_PROPERTY(QVariantList fpsHistory READ fpsHistory NOTIFY historyChanged)
    Q_PROPERTY(int historySize READ historySize WRITE setHistorySize NOTIFY historySizeChanged)
    
    // Shader info for context
    Q_PROPERTY(QString currentShaderId READ currentShaderId WRITE setCurrentShaderId NOTIFY shaderChanged)
    Q_PROPERTY(bool hasBuffers READ hasBuffers WRITE setHasBuffers NOTIFY shaderChanged)
    Q_PROPERTY(bool hasAudio READ hasAudio WRITE setHasAudio NOTIFY shaderChanged)
    
    // Control
    Q_PROPERTY(bool enabled READ enabled WRITE setEnabled NOTIFY enabledChanged)
    Q_PROPERTY(bool recording READ recording WRITE setRecording NOTIFY recordingChanged)

public:
    explicit PerformanceMonitor(QObject *parent = nullptr);
    ~PerformanceMonitor() override;

    // Performance tier enum for easy access
    enum PerformanceTier {
        TierLow = 0,      // < 4ms (> 250 FPS potential)
        TierMedium = 1,   // 4-8ms (120-250 FPS potential)
        TierHigh = 2,     // 8-16ms (60-120 FPS potential)
        TierExtreme = 3   // > 16ms (< 60 FPS potential)
    };
    Q_ENUM(PerformanceTier)

    // Property getters
    qreal currentFrameTime() const { return m_currentFrameTime; }
    qreal averageFrameTime() const { return m_averageFrameTime; }
    qreal minFrameTime() const { return m_minFrameTime; }
    qreal maxFrameTime() const { return m_maxFrameTime; }
    int currentFps() const { return m_currentFps; }
    int averageFps() const;
    
    int performanceTier() const { return m_performanceTier; }
    QString performanceTierName() const;
    QString performanceTierColor() const;
    
    int estimatedPowerCost() const { return m_estimatedPowerCost; }
    QString powerCostLabel() const;
    
    QVariantList frameTimeHistory() const;
    QVariantList fpsHistory() const;
    int historySize() const { return m_historySize; }
    
    QString currentShaderId() const { return m_currentShaderId; }
    bool hasBuffers() const { return m_hasBuffers; }
    bool hasAudio() const { return m_hasAudio; }
    
    bool enabled() const { return m_enabled; }
    bool recording() const { return m_recording; }
    
    // Property setters
    void setHistorySize(int size);
    void setCurrentShaderId(const QString &id);
    void setHasBuffers(bool has);
    void setHasAudio(bool has);
    void setEnabled(bool enabled);
    void setRecording(bool recording);

    // Recording methods - call from shader engine
    Q_INVOKABLE void beginFrame();
    Q_INVOKABLE void endFrame();
    Q_INVOKABLE void recordFps(int fps);
    
    // Statistics management
    Q_INVOKABLE void reset();
    Q_INVOKABLE void resetHistory();
    
    // Get stored performance data for a shader
    Q_INVOKABLE QVariantMap getShaderPerformance(const QString &shaderId) const;
    
    // Save/load performance database
    Q_INVOKABLE void savePerformanceData();
    Q_INVOKABLE void loadPerformanceData();

Q_SIGNALS:
    void frameTimeChanged();
    void statsChanged();
    void performanceTierChanged();
    void powerCostChanged();
    void historyChanged();
    void historySizeChanged();
    void shaderChanged();
    void enabledChanged();
    void recordingChanged();
    void frameRecorded(qreal frameTime);

private Q_SLOTS:
    void updateStats();
    void updatePowerCost();

private:
    void addFrameTime(qreal ms);
    void calculateStats();
    int calculatePerformanceTier(qreal avgFrameTime) const;
    int calculatePowerCost() const;
    QString getPerformanceDataPath() const;

    // State
    bool m_enabled = true;
    bool m_recording = true;
    
    // Frame timing
    QElapsedTimer m_frameTimer;
    qreal m_currentFrameTime = 0.0;
    int m_currentFps = 0;
    
    // Statistics (rolling window)
    static constexpr int STATS_WINDOW = 120;  // 2 seconds at 60fps
    std::deque<qreal> m_frameTimes;
    qreal m_averageFrameTime = 0.0;
    qreal m_minFrameTime = 999.0;
    qreal m_maxFrameTime = 0.0;
    
    // History for graph (longer window)
    int m_historySize = 120;  // Configurable
    std::deque<qreal> m_frameTimeHistory;
    std::deque<int> m_fpsHistory;
    
    // Classification
    int m_performanceTier = TierMedium;
    int m_estimatedPowerCost = 50;
    
    // Context
    QString m_currentShaderId;
    bool m_hasBuffers = false;
    bool m_hasAudio = false;
    
    // Stats update timer
    QTimer *m_statsTimer = nullptr;
    
    // Performance database (shader ID -> metrics)
    QMap<QString, QVariantMap> m_performanceDatabase;
};

#endif // PERFORMANCEMONITOR_H




