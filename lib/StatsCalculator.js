class StatsCalculator {
    constructor(forwarder) {
        this.forwarder = forwarder;
        
        // ENHANCED: Global Statistics untuk Dashboard dan API
        this.globalStats = {
            session: {
                startTime: null,
                messageCount: 0,
                bytesCount: 0,
                messagesPerMinute: 0,
                lastMinuteMessages: [],
                uniqueMessages: new Set(),
                messageTypes: {
                    AIS: 0,
                    GNSS: 0,
                    SERIAL: 0,
                    DATA: 0
                },
                errorCount: 0,
                reconnectCount: 0,
                peakRate: 0,
                averageRate: 0
            },
            application: {
                totalSessions: 0,
                totalLifetimeMessages: 0,
                totalLifetimeBytes: 0,
                uptimeStart: Date.now(),
                lastActivity: null,
                activeStreams: 0
            },
            configurations: {
                serialCount: 0,
                ipCount: 0,
                serialActive: 0,
                ipActive: 0,
                totalActive: 0
            }
        };
    }

    // NEW: Reset session statistics dengan lifecycle tracking
    resetSessionStats() {
        // Save current session summary untuk application history
        if (this.globalStats.session.startTime) {
            const sessionSummary = {
                duration: Date.now() - this.globalStats.session.startTime.getTime(),
                totalMessages: this.globalStats.session.messageCount,
                peakRate: this.globalStats.session.peakRate,
                averageRate: this.globalStats.session.averageRate,
                errorCount: this.globalStats.session.errorCount
            };
            console.log('📊 Session completed:', sessionSummary);
            
            // Update application lifetime stats
            this.globalStats.application.totalLifetimeMessages += this.globalStats.session.messageCount;
            this.globalStats.application.totalLifetimeBytes += this.globalStats.session.bytesCount;
        }

        // Reset session stats
        this.globalStats.session = {
            startTime: new Date(),
            messageCount: 0,
            bytesCount: 0,
            messagesPerMinute: 0,
            lastMinuteMessages: [],
            uniqueMessages: new Set(),
            messageTypes: {
                AIS: 0,
                GNSS: 0,
                SERIAL: 0,
                DATA: 0
            },
            errorCount: 0,
            reconnectCount: 0,
            peakRate: 0,
            averageRate: 0
        };

        // Increment application session counter
        this.globalStats.application.totalSessions++;
        
        console.log('📊 Session statistics reset - New session started');
    }

    // NEW: Calculate live statistics dengan advanced metrics
    calculateLiveStats() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        
        // Filter messages in last minute
        this.globalStats.session.lastMinuteMessages = this.globalStats.session.lastMinuteMessages.filter(
            timestamp => timestamp > oneMinuteAgo
        );
        
        // Calculate messages per minute
        this.globalStats.session.messagesPerMinute = this.globalStats.session.lastMinuteMessages.length;
        
        // Update peak rate
        if (this.globalStats.session.messagesPerMinute > this.globalStats.session.peakRate) {
            this.globalStats.session.peakRate = this.globalStats.session.messagesPerMinute;
        }
        
        // Calculate average rate
        if (this.globalStats.session.startTime) {
            const totalMinutes = (now - this.globalStats.session.startTime.getTime()) / 60000;
            this.globalStats.session.averageRate = totalMinutes > 0 ? 
                Math.round(this.globalStats.session.messageCount / totalMinutes) : 0;
        }

        // Update application last activity
        this.globalStats.application.lastActivity = now;
        this.globalStats.application.activeStreams = this.forwarder.isForwarding ? 1 : 0;
    }

    // NEW: Advanced message type detection
    detectMessageType(message) {
        const trimmed = message.trim();
        
        // AIS messages (Automatic Identification System)
        if (trimmed.startsWith('!AIVDM') || trimmed.startsWith('!AIVDO')) {
            return 'AIS';
        }
        
        // GNSS messages (GPS, GLONASS, Galileo, BeiDou)
        if (trimmed.startsWith('$GP') || trimmed.startsWith('$GN') || 
            trimmed.startsWith('$GL') || trimmed.startsWith('$GB') ||
            trimmed.startsWith('$GA')) {
            return 'GNSS';
        }
        
        // Serial protocol messages (format: KEY:VALUE or KEY=VALUE)
        if (/^[A-Z0-9_]+[:=]/.test(trimmed)) {
            return 'SERIAL';
        }
        
        // Raw data atau unknown format
        return 'DATA';
    }

    // NEW: Start comprehensive statistics calculation
    startStatsCalculator() {
        // Calculate live stats every second
        setInterval(() => {
            this.calculateLiveStats();
        }, 1000);

        // ❌ DISABLED: Broadcasting ke TCP clients yang menyebabkan output kotor
        // setInterval(() => {
        //     if (this.forwarder.tcpDataClients.length > 0) {
        //         this.broadcastStatsUpdate();
        //     }
        // }, 5000);

        // Update configuration cache every 5 seconds
        setInterval(() => {
            this.forwarder.updateConfigCache();
        }, 5000);

        console.log('📊 Stats calculator started - Live metrics active');
    }

    // NEW: Create formatted stats display untuk debugging
    createStatsDisplay() {
        const now = new Date();
        const sessionUptime = this.globalStats.session.startTime ? 
            Math.floor((now - this.globalStats.session.startTime) / 1000) : 0;
        const applicationUptime = Math.floor((now - this.globalStats.application.uptimeStart) / 1000);

        const formatUptime = (seconds) => {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            return `${h}h ${m}m ${s}s`;
        };

        return `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                           📊 LIVE SESSION STATISTICS                         ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║    Messages: ${this.globalStats.session.messageCount.toString().padStart(8)}              Bytes: ${this.formatBytes(this.globalStats.session.bytesCount).padStart(12)} ║
║                      Unique: ${this.globalStats.session.uniqueMessages.size.toString().padStart(8)}                                           ║
║                                                                               ║
║       Rate: ${this.globalStats.session.messagesPerMinute.toString().padStart(4)} /min     Peak: ${this.globalStats.session.peakRate.toString().padStart(4)} /min     Avg: ${this.globalStats.session.averageRate.toString().padStart(4)} /min ║
║                                                      Uptime: ${formatUptime(sessionUptime).padStart(10)} ║
║     Errors: ${this.globalStats.session.errorCount.toString().padStart(8)}            Reconnects: ${this.globalStats.session.reconnectCount.toString().padStart(8)}                    ║
║                                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                          📊 MESSAGE TYPE BREAKDOWN                           ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║    AIS: ${this.globalStats.session.messageTypes.AIS.toString().padStart(8)} (${this.calculatePercentage('AIS').padStart(3)}%)     GNSS: ${this.globalStats.session.messageTypes.GNSS.toString().padStart(8)} (${this.calculatePercentage('GNSS').padStart(2)}%)     ║
║ SERIAL: ${this.globalStats.session.messageTypes.SERIAL.toString().padStart(8)} (${this.calculatePercentage('SERIAL').padStart(2)}%)     DATA: ${this.globalStats.session.messageTypes.DATA.toString().padStart(8)} (${this.calculatePercentage('DATA').padStart(2)}%)     ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`;
    }

    // Helper methods for stats display
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    calculatePercentage(messageType) {
        const total = this.globalStats.session.messageCount;
        if (total === 0) return '0';
        const count = this.globalStats.session.messageTypes[messageType];
        return Math.round((count / total) * 100).toString();
    }

    // ❌ DISABLED: Tidak broadcast statistik ke monitoring clients
    // untuk mencegah output TCP kotor dengan karakter aneh
    broadcastStatsUpdate() {
        // Do nothing to disable live stats broadcast
        return;
    }
}

module.exports = StatsCalculator;
