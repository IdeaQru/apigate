class HistoricalDataTracker {
    constructor(forwarder) {
        this.forwarder = forwarder;
        
        // ENHANCED: Historical Data Tracking untuk Charts
        this.historicalData = {
            // Speed history untuk speed chart (last 10 minutes)
            speedHistory: [],
            maxSpeedHistoryPoints: 60, // 60 points untuk 10 menit (update setiap 10 detik)

            // Message volume history (last hour)
            messageVolumeHistory: [],
            maxVolumeHistoryPoints: 60, // 60 points untuk 1 jam (update setiap menit)

            // Error/reconnect history
            errorHistory: [],
            maxErrorHistoryPoints: 24, // 24 points untuk 24 jam (update setiap jam)

            // Performance metrics history
            performanceHistory: [],
            maxPerformanceHistoryPoints: 48, // 48 points untuk 24 jam (update setiap 30 menit)

            // Real-time chart data (last 5 minutes untuk real-time display)
            realtimeData: [],
            maxRealtimePoints: 30 // 30 points untuk 5 menit (update setiap 10 detik)
        };
    }

    // NEW: Start historical data tracking dengan berbagai interval
    startHistoricalDataTracking() {
        // Update real-time chart data setiap 10 detik
        setInterval(() => {
            this.updateRealtimeChartData();
        }, 10000);

        // Update speed history setiap 10 detik
        setInterval(() => {
            this.updateSpeedHistory();
        }, 10000);

        // Update message volume history setiap 1 menit
        setInterval(() => {
            this.updateMessageVolumeHistory();
        }, 60000);

        // Update error history setiap 1 jam
        setInterval(() => {
            this.updateErrorHistory();
        }, 3600000);

        // Update performance history setiap 30 menit
        setInterval(() => {
            this.updatePerformanceHistory();
        }, 1800000);

        console.log('📈 Historical data tracking started');
    }

    // NEW: Update real-time chart data (untuk speed chart yang live)
    updateRealtimeChartData() {
        const now = Date.now();
        const dataPoint = {
            timestamp: now,
            time: new Date(now).toLocaleTimeString(),
            messagesPerMinute: this.forwarder.globalStats.session.messagesPerMinute,
            bytesPerMinute: this.calculateBytesPerMinute(),
            activeConnections: this.forwarder.tcpDataClients.length,
            errorRate: this.calculateErrorRate()
        };

        this.historicalData.realtimeData.push(dataPoint);

        // Keep only last 30 points (5 minutes)
        if (this.historicalData.realtimeData.length > this.historicalData.maxRealtimePoints) {
            this.historicalData.realtimeData = this.historicalData.realtimeData.slice(-this.historicalData.maxRealtimePoints);
        }

        console.log(`📈 Real-time data updated: ${dataPoint.messagesPerMinute} msg/min`);
    }

    // NEW: Update speed history (untuk speed chart long-term)
    updateSpeedHistory() {
        const now = Date.now();
        const dataPoint = {
            timestamp: now,
            time: new Date(now).toLocaleTimeString(),
            currentSpeed: this.forwarder.globalStats.session.messagesPerMinute,
            averageSpeed: this.forwarder.globalStats.session.averageRate,
            peakSpeed: this.forwarder.globalStats.session.peakRate,
            totalMessages: this.forwarder.globalStats.session.messageCount
        };

        this.historicalData.speedHistory.push(dataPoint);

        // Keep only last 60 points (10 minutes)
        if (this.historicalData.speedHistory.length > this.historicalData.maxSpeedHistoryPoints) {
            this.historicalData.speedHistory = this.historicalData.speedHistory.slice(-this.historicalData.maxSpeedHistoryPoints);
        }
    }

    // NEW: Update message volume history
    updateMessageVolumeHistory() {
        const now = Date.now();
        const dataPoint = {
            timestamp: now,
            time: new Date(now).toLocaleTimeString(),
            totalMessages: this.forwarder.globalStats.session.messageCount,
            totalBytes: this.forwarder.globalStats.session.bytesCount,
            uniqueMessages: this.forwarder.globalStats.session.uniqueMessages.size,
            messageTypes: { ...this.forwarder.globalStats.session.messageTypes }
        };

        this.historicalData.messageVolumeHistory.push(dataPoint);

        // Keep only last 60 points (1 hour)
        if (this.historicalData.messageVolumeHistory.length > this.historicalData.maxVolumeHistoryPoints) {
            this.historicalData.messageVolumeHistory = this.historicalData.messageVolumeHistory.slice(-this.historicalData.maxVolumeHistoryPoints);
        }
    }

    // NEW: Update error history
    updateErrorHistory() {
        const now = Date.now();
        const dataPoint = {
            timestamp: now,
            time: new Date(now).toLocaleString(),
            errorCount: this.forwarder.globalStats.session.errorCount,
            reconnectCount: this.forwarder.globalStats.session.reconnectCount,
            sessionUptime: this.forwarder.globalStats.session.startTime ?
                (now - this.forwarder.globalStats.session.startTime.getTime()) / 1000 : 0
        };

        this.historicalData.errorHistory.push(dataPoint);

        // Keep only last 24 points (24 hours)
        if (this.historicalData.errorHistory.length > this.historicalData.maxErrorHistoryPoints) {
            this.historicalData.errorHistory = this.historicalData.errorHistory.slice(-this.historicalData.maxErrorHistoryPoints);
        }
    }

    // NEW: Update performance history
    updatePerformanceHistory() {
        const now = Date.now();
        const dataPoint = {
            timestamp: now,
            time: new Date(now).toLocaleString(),
            averageSpeed: this.forwarder.globalStats.session.averageRate,
            peakSpeed: this.forwarder.globalStats.session.peakRate,
            totalSessions: this.forwarder.globalStats.application.totalSessions,
            lifetimeMessages: this.forwarder.globalStats.application.totalLifetimeMessages,
            applicationUptime: (now - this.forwarder.globalStats.application.uptimeStart) / 1000
        };

        this.historicalData.performanceHistory.push(dataPoint);

        // Keep only last 48 points (24 hours)
        if (this.historicalData.performanceHistory.length > this.historicalData.maxPerformanceHistoryPoints) {
            this.historicalData.performanceHistory = this.historicalData.performanceHistory.slice(-this.historicalData.maxPerformanceHistoryPoints);
        }
    }

    // NEW: Calculate bytes per minute untuk chart
    calculateBytesPerMinute() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;

        // Calculate bytes in last minute from message history
        let bytesInLastMinute = 0;
        this.forwarder.globalStats.session.lastMinuteMessages.forEach(timestamp => {
            if (timestamp > oneMinuteAgo) {
                bytesInLastMinute += 50; // Estimate 50 bytes per message (adjust as needed)
            }
        });

        return bytesInLastMinute;
    }

    // NEW: Calculate error rate untuk chart
    calculateErrorRate() {
        if (this.forwarder.globalStats.session.messageCount === 0) return 0;
        return (this.forwarder.globalStats.session.errorCount / this.forwarder.globalStats.session.messageCount) * 100;
    }

    // NEW: Generate chart-ready data untuk frontend
    generateChartData() {
        return {
            // Real-time speed chart (last 5 minutes)
            realtimeSpeed: {
                labels: this.historicalData.realtimeData.map(point => point.time),
                datasets: [{
                    label: 'Messages/Minute',
                    data: this.historicalData.realtimeData.map(point => point.messagesPerMinute),
                    borderColor: '#ff6da7',
                    backgroundColor: 'rgba(255, 109, 167, 0.1)',
                    tension: 0.4
                }]
            },

            // Speed history chart (last 10 minutes)
            speedHistory: {
                labels: this.historicalData.speedHistory.map(point => point.time),
                datasets: [
                    {
                        label: 'Current Speed',
                        data: this.historicalData.speedHistory.map(point => point.currentSpeed),
                        borderColor: '#ff6da7',
                        backgroundColor: 'rgba(255, 109, 167, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Average Speed',
                        data: this.historicalData.speedHistory.map(point => point.averageSpeed),
                        borderColor: '#00f0ff',
                        backgroundColor: 'rgba(0, 240, 255, 0.1)',
                        tension: 0.4
                    }
                ]
            },

            // Message volume chart (last hour)
            messageVolume: {
                labels: this.historicalData.messageVolumeHistory.map(point => point.time),
                datasets: [{
                    label: 'Total Messages',
                    data: this.historicalData.messageVolumeHistory.map(point => point.totalMessages),
                    borderColor: '#a855f7',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    tension: 0.4
                }]
            },

            // Message type breakdown chart
            messageTypes: {
                labels: ['AIS', 'GNSS', 'SERIAL', 'DATA'],
                datasets: [{
                    data: [
                        this.forwarder.globalStats.session.messageTypes.AIS,
                        this.forwarder.globalStats.session.messageTypes.GNSS,
                        this.forwarder.globalStats.session.messageTypes.SERIAL,
                        this.forwarder.globalStats.session.messageTypes.DATA
                    ],
                    backgroundColor: [
                        '#ff6da7',
                        '#00f0ff',
                        '#a855f7',
                        '#10b981'
                    ]
                }]
            },

            // Error/reconnect chart (last 24 hours)
            errorHistory: {
                labels: this.historicalData.errorHistory.map(point => point.time),
                datasets: [
                    {
                        label: 'Errors',
                        data: this.historicalData.errorHistory.map(point => point.errorCount),
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Reconnects',
                        data: this.historicalData.errorHistory.map(point => point.reconnectCount),
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.4
                    }
                ]
            }
        };
    }
}

module.exports = HistoricalDataTracker;
