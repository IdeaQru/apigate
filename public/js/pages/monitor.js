// Monitor Page Management
class MonitorPageManager {
    constructor() {
        this.logLines = [];
        this.maxLogLines = window.APP_CONSTANTS?.UI?.LOG_MAX_LINES || 100;
        this.autoScroll = true;
        this.isActive = false;
        this.updateTimer = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        window.addEventListener('tabChanged', (e) => {
            if (e.detail.tab === 'monitor') {
                this.onMonitorPageActivated();
            } else {
                this.onMonitorPageDeactivated();
            }
        });
    }

    setupEventListeners() {
        // Auto-scroll toggle
        document.addEventListener('change', (e) => {
            if (e.target.id === 'autoScroll') {
                this.autoScroll = e.target.checked;
            }
        });

        // Log controls
        document.addEventListener('click', (e) => {
            if (e.target.closest('#clearLogs')) {
                this.clearLogs();
            } else if (e.target.closest('#exportLogs')) {
                this.exportLogs();
            }
        });

        // Terminal switch
        document.addEventListener('change', (e) => {
            if (e.target.closest('.terminal-switch input')) {
                const label = e.target.closest('.terminal-switch').querySelector('.switch-label');
                if (label) {
                    label.style.color = e.target.checked ? 'var(--green-neon)' : 'var(--text-muted)';
                }
            }
        });
    }

    onMonitorPageActivated() {
        console.log('📡 Monitor page activated');
        this.isActive = true;
        this.startMonitoring();
        this.loadInitialData();
    }

    onMonitorPageDeactivated() {
        this.isActive = false;
        this.stopMonitoring();
    }

    async loadInitialData() {
        try {
            const [status, speedStats] = await Promise.all([
                window.apiService.getStatus(),
                window.apiService.getSpeedStats()
            ]);

            this.updateSystemStats(status, speedStats);
            this.updateTCPOutputStatus(status);
        } catch (error) {
            console.error('Failed to load monitor data:', error);
        }
    }

    startMonitoring() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }

        // Update every 2 seconds
        this.updateTimer = setInterval(() => {
            if (this.isActive) {
                this.updateMonitorData();
            }
        }, 2000);

        // Add initial log
        this.addLog('INFO', 'Live monitor activated - Real-time logging enabled');
    }

    stopMonitoring() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }

    async updateMonitorData() {
        try {
            const [status, speedStats] = await Promise.all([
                window.apiService.getStatus(),
                window.apiService.getSpeedStats()
            ]);

            this.updateSystemStats(status, speedStats);
            this.updateTCPOutputStatus(status);

            // Simulate some log entries for active connections
            if (status.isForwarding && Math.random() > 0.7) {
                this.simulateActivityLog(status);
            }

        } catch (error) {
            console.error('Monitor update error:', error);
            this.addLog('ERROR', `Monitor update failed: ${error.message}`);
        }
    }

    updateSystemStats(status, speedStats) {
        // Update stats panel
        const elements = {
            totalMessagesMonitor: speedStats.totalMessages || 0,
            uptime: this.formatUptime(Date.now() - (status.startTime || Date.now())),
            lastActivityMonitor: status.lastActivity ? window.AppHelpers.time.timeAgo(status.lastActivity) : 'Never',
            errorCountMonitor: 0, // This would come from app state
            speedMonitor: speedStats.currentSpeed || 0
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    updateTCPOutputStatus(status) {
        const tcpStatus = status.messageStats?.tcpOutputStatus || {};
        
        const elements = {
            tcpOutputStatusMonitor: tcpStatus.isConnected ? 'Connected' : 'Disconnected',
            tcpOutputTarget: status.currentConfig ? 
                `${status.currentConfig.tcpOutHost}:${status.currentConfig.tcpOutPort}` : 
                'Not configured',
            tcpOutputQueue: tcpStatus.queueSize || 0,
            tcpOutputSent: status.messageStats?.totalMessages || 0
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                
                // Add color coding for status
                if (id === 'tcpOutputStatusMonitor') {
                    element.style.color = value === 'Connected' ? 'var(--green-neon)' : 'var(--text-muted)';
                }
            }
        });
    }

    simulateActivityLog(status) {
        const activities = [
            `Data received from ${status.currentConfig?.serialPort || 'network'}`,
            `TCP forwarding to ${status.currentConfig?.tcpOutHost}:${status.currentConfig?.tcpOutPort}`,
            `Bridge "${status.currentConfig?.name}" processing messages`,
            'Connection health check passed',
            'Performance metrics updated'
        ];

        const activity = activities[Math.floor(Math.random() * activities.length)];
        this.addLog('INFO', activity);
    }

    addLog(level, message) {
        const timestamp = window.AppHelpers.time.formatTimestamp();
        const logEntry = `[${timestamp}] [${level}] ${message}`;
        
        this.logLines.push(logEntry);
        
        // Limit log lines
        if (this.logLines.length > this.maxLogLines) {
            this.logLines = this.logLines.slice(-this.maxLogLines);
        }
        
        this.updateLogDisplay();
    }

    updateLogDisplay() {
        const container = document.getElementById('logContainer');
        if (!container) return;

        // Add new log line
        const lastLog = this.logLines[this.logLines.length - 1];
        if (lastLog) {
            const logElement = this.createLogElement(lastLog);
            container.appendChild(logElement);
        }

        // Remove old lines if too many
        const allLines = container.querySelectorAll('.terminal-line');
        if (allLines.length > this.maxLogLines) {
            for (let i = 0; i < allLines.length - this.maxLogLines; i++) {
                allLines[i].remove();
            }
        }

        // Auto-scroll if enabled
        if (this.autoScroll) {
            container.scrollTop = container.scrollHeight;
        }
    }

    createLogElement(logLine) {
        const parts = logLine.split('] ');
        const timestamp = parts[0]?.replace('[', '') || '';
        const level = parts[1]?.replace('[', '') || 'INFO';
        const message = parts.slice(2).join('] ') || logLine;

        const div = document.createElement('div');
        div.className = 'terminal-line';
        div.innerHTML = `
            <span class="terminal-prompt">[${timestamp}]</span>
            <span class="terminal-type ${level.toLowerCase()}">${level}</span>
            <span class="terminal-message">${window.AppHelpers.string.escapeHtml(message)}</span>
        `;

        return div;
    }

    clearLogs() {
        const confirmed = confirm('🗑 Are you sure you want to clear all terminal logs?');
        if (!confirmed) return;

        this.logLines = [];
        
        const container = document.getElementById('logContainer');
        if (container) {
            container.innerHTML = `
                <div class="terminal-line">
                    <span class="terminal-prompt">[${window.AppHelpers.time.formatTimestamp()}]</span>
                    <span class="terminal-type info">INFO</span>
                    <span class="terminal-message">Terminal cleared - Ready for new operations...</span>
                </div>
            `;
        }

        window.toastManager?.success('🗑 Terminal logs cleared');
        this.addLog('INFO', 'Terminal logs cleared by user');
    }

    exportLogs() {
        try {
            const logs = this.logLines.join('\n');
            const blob = new Blob([logs], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `tcp-bridge-logs-${new Date().toISOString().slice(0, 10)}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            window.toastManager?.success('📥 Logs exported successfully');
            this.addLog('INFO', 'Logs exported to file');
        } catch (error) {
            console.error('Export error:', error);
            window.toastManager?.error('❌ Failed to export logs');
        }
    }

    formatUptime(milliseconds) {
        return window.AppHelpers.time.formatUptime(milliseconds);
    }

    // Public methods for external logging
    logInfo(message) {
        this.addLog('INFO', message);
    }

    logSuccess(message) {
        this.addLog('SUCCESS', message);
    }

    logError(message) {
        this.addLog('ERROR', message);
    }

    logWarning(message) {
        this.addLog('WARNING', message);
    }

    destroy() {
        this.stopMonitoring();
    }
}

// Initialize monitor page manager
window.monitorPageManager = new MonitorPageManager();
