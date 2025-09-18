// Main Application Class - ENHANCED WITH MULTI-INSTANCE SUPPORT
class SerialTCPApp {
    constructor() {
        this.startTime = Date.now();
        this.currentStatus = { isForwarding: false, currentConfig: null };
        this.lastStatus = null; // ✅ ADD: Store last status
        this.messageCount = 0;
        this.errorCount = 0;
        this.statusTimer = null;
        this.uptimeTimer = null;
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing TCP Bridge Application...');
        
        // Wait for DOM to be ready
        if (document.readyState !== 'complete') {
            await new Promise(resolve => window.addEventListener('load', resolve));
        }

        try {
            // Initialize event listeners
            this.setupEventListeners();
            
            // Start timers
            this.startStatusPolling();
            this.startUptimeCounter();
            
            // Load initial data
            await this.loadInitialData();
            
            // Hide loading screen and show app
            await this.showApplication();
            
            console.log('✅ TCP Bridge Application initialized successfully');
            
        } catch (error) {
            console.error('💥 Application initialization failed:', error);
            this.showError('Failed to initialize application');
        }
    }

    setupEventListeners() {
        // Stop forwarding button
        const stopBtn = document.getElementById('stopForwarding');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopForwarding());
        }

        // Test message
        const sendTestBtn = document.getElementById('sendTest');
        const testMessageInput = document.getElementById('testMessage');
        
        if (sendTestBtn) {
            sendTestBtn.addEventListener('click', () => this.sendTestMessage());
        }
        
        if (testMessageInput) {
            testMessageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendTestMessage();
                }
            });
        }

        // Refresh all button
        const refreshAllBtn = document.getElementById('refreshAll');
        if (refreshAllBtn) {
            refreshAllBtn.addEventListener('click', () => this.refreshAllData());
        }

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'r':
                        e.preventDefault();
                        this.refreshAllData();
                        break;
                    case 's':
                        e.preventDefault();
                        this.stopForwarding();
                        break;
                }
            }
        });

        // Window beforeunload
        window.addEventListener('beforeunload', (e) => {
            if (this.currentStatus.isForwarding) {
                e.preventDefault();
                e.returnValue = 'You have active bridges running. Are you sure you want to leave?';
            }
        });

        console.log('🎮 Event listeners initialized');
    }

    async loadInitialData() {
        try {
            console.log('📊 Loading initial application data...');
            
            const status = await window.apiService.getStatus();
            this.updateStatus(status);
            
            // Update test info
            this.updateTestInfo();
            
        } catch (error) {
            console.error('📊 Failed to load initial data:', error);
            this.errorCount++;
        }
    }

    async showApplication() {
        const loadingSpinner = document.getElementById('loadingSpinner');
        const appContainer = document.getElementById('appContainer');
        
        if (loadingSpinner && appContainer) {
            // Hide loading with fade out
            await window.AppHelpers.animate.fadeOut(loadingSpinner, 500);
            loadingSpinner.style.display = 'none';
            
            // Show app with dramatic entrance
            appContainer.style.display = 'flex';
            appContainer.style.opacity = '0';
            appContainer.style.transform = 'scale(0.95)';
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            appContainer.style.transition = 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
            appContainer.style.opacity = '1';
            appContainer.style.transform = 'scale(1)';
            
            // Welcome message
            window.toastManager?.success('🚀 TCP Bridge initialized successfully!');
            window.monitorPageManager?.logInfo('TCP Bridge online - All systems operational');
        }
    }

    startStatusPolling() {
        if (this.statusTimer) {
            clearInterval(this.statusTimer);
        }

        this.statusTimer = setInterval(async () => {
            try {
                const status = await window.apiService.getStatus();
                this.lastStatus = status; // ✅ Store for reference
                this.updateStatus(status);
            } catch (error) {
                console.error('Status polling error:', error);
                this.errorCount++;
            }
        }, window.APP_CONSTANTS?.UI?.STATUS_POLL_INTERVAL || 2000);
    }

    startUptimeCounter() {
        if (this.uptimeTimer) {
            clearInterval(this.uptimeTimer);
        }

        this.uptimeTimer = setInterval(() => {
            this.updateUptimeDisplay();
        }, 1000);
    }

    updateStatus(status) {
        this.currentStatus = status;
        
        // Update status indicator
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${status.isForwarding ? 'status-running' : 'status-stopped'}`;
        }

        // ✅ CRITICAL FIX: Call updateStatusDetails method
        this.updateStatusDetails(status);
        
        // Update connection badge
        this.updateConnectionBadge(status);
        
        // Update test info
        this.updateTestInfo();
    }

    // ✅ CRITICAL FIX: Add missing updateStatusDetails method
    updateStatusDetails(status) {
        try {
            console.log('🔄 Updating status details:', {
                isForwarding: status.isForwarding,
                totalInstances: status.totalInstances,
                activeInstances: status.activeInstances,
                totalConnections: status.totalConnections
            });
            
            // Update main status info
            this.updateMainStatusInfo(status);
            
            // Update instances info
            this.updateInstancesInfo(status);
            
            // Update auto servers info
            this.updateAutoServersInfo(status);
            
            // Update connection details
            this.updateConnectionDetails(status);
            
            // Update forwarding status
            this.updateForwardingStatus(status.isForwarding, status.currentConfig);
            
            // Update last activity
            if (status.lastActivity) {
                this.updateLastActivity(status.lastActivity);
            }
            
        } catch (error) {
            console.error('❌ Error updating status details:', error);
        }
    }

    // ✅ HELPER: Update main status info
    updateMainStatusInfo(status) {
        // Update main status display
        const mainStatusElement = document.getElementById('mainStatus');
        if (mainStatusElement) {
            const statusText = status.isForwarding ? 
                `🟢 ACTIVE (${status.activeInstances || 0} instances)` : 
                '⚪ INACTIVE';
            mainStatusElement.textContent = statusText;
        }

        // Update total connections
        const connectionsElement = document.getElementById('totalConnections');
        if (connectionsElement) {
            connectionsElement.textContent = (status.totalConnections || 0).toString();
        }
    }

    // ✅ HELPER: Update instances info
    updateInstancesInfo(status) {
        const instancesElement = document.getElementById('instancesInfo');
        if (instancesElement && status.instances) {
            const instanceCount = status.totalInstances || 0;
            const runningInstances = status.activeInstances || 0;
            instancesElement.textContent = `${runningInstances}/${instanceCount} instances running`;
        }

        // Update detailed instances list
        const instancesListElement = document.getElementById('instancesList');
        if (instancesListElement && status.instances && Array.isArray(status.instances)) {
            let instancesHTML = '';
            
            status.instances.forEach((instance, index) => {
                const statusIcon = instance.status === 'running' ? '🟢' : '⚪';
                const uptimeText = this.formatUptime(instance.uptime || 0);
                
                instancesHTML += `
                    <div class="instance-item">
                        <span>${statusIcon} ${instance.configName || 'Unknown'}</span>
                        <small>${instance.type} | ${uptimeText} | ${instance.stats?.messageCount || 0} msgs</small>
                    </div>
                `;
            });
            
            instancesListElement.innerHTML = instancesHTML || '<div class="no-instances">No instances running</div>';
        }
    }

    // ✅ HELPER: Update auto servers info
    updateAutoServersInfo(status) {
        const serversElement = document.getElementById('autoServersInfo');
        if (serversElement && status.autoServers) {
            const serverCount = status.autoServers.totalServers || 0;
            const activeConnections = status.autoServers.servers?.reduce((total, server) => total + (server.connections || 0), 0) || 0;
            serversElement.textContent = `${serverCount} auto-servers, ${activeConnections} connections`;
        }

        // Update detailed servers list
        const serversListElement = document.getElementById('autoServersList');
        if (serversListElement && status.autoServers && status.autoServers.servers) {
            let serversHTML = '';
            
            status.autoServers.servers.forEach(server => {
                const statusIcon = server.isListening ? '🟢' : '⚪';
                const uptimeText = this.formatUptime(server.uptime || 0);
                
                serversHTML += `
                    <div class="server-item">
                        <span>${statusIcon} Port ${server.port}</span>
                        <small>${server.connections} clients | ${server.aisMessages || 0} AIS | ${uptimeText}</small>
                    </div>
                `;
            });
            
            serversListElement.innerHTML = serversHTML || '<div class="no-servers">No auto-servers active</div>';
        }
    }

    // ✅ HELPER: Update connection details
    updateConnectionDetails(status) {
        const connectionInfoElement = document.getElementById('connectionDetails');
        if (connectionInfoElement && status.connectionInfo) {
            const connInfo = status.connectionInfo;
            let connectionHTML = `
                <div class="connection-detail">
                    <strong>Type:</strong> ${connInfo.type || 'Unknown'}
                </div>
                <div class="connection-detail">
                    <strong>Status:</strong> ${connInfo.status || 'Unknown'}
                </div>
            `;
            
            if (connInfo.host && connInfo.port) {
                connectionHTML += `
                    <div class="connection-detail">
                        <strong>Target:</strong> ${connInfo.host}:${connInfo.port}
                    </div>
                `;
            }
            
            if (connInfo.mode) {
                connectionHTML += `
                    <div class="connection-detail">
                        <strong>Mode:</strong> ${connInfo.mode}
                    </div>
                `;
            }
            
            connectionInfoElement.innerHTML = connectionHTML;
        }
    }

    // ✅ HELPER: Update forwarding status
    updateForwardingStatus(isForwarding, currentConfig) {
        const statusElement = document.getElementById('forwardingStatus');
        if (statusElement) {
            statusElement.textContent = isForwarding ? 'Active' : 'Inactive';
            statusElement.className = `status ${isForwarding ? 'active' : 'inactive'}`;
        }

        const configElement = document.getElementById('currentConfigName');
        if (configElement) {
            if (currentConfig) {
                configElement.textContent = currentConfig.name || 'Unknown Config';
            } else {
                configElement.textContent = 'No active configuration';
            }
        }
    }

    // ✅ HELPER: Update last activity
    updateLastActivity(lastActivity) {
        const activityElement = document.getElementById('lastActivity');
        if (activityElement) {
            const activityTime = new Date(lastActivity);
            const now = new Date();
            const diffMs = now - activityTime;
            const diffSeconds = Math.floor(diffMs / 1000);
            
            let activityText;
            if (diffSeconds < 60) {
                activityText = `${diffSeconds}s ago`;
            } else if (diffSeconds < 3600) {
                activityText = `${Math.floor(diffSeconds / 60)}m ago`;
            } else {
                activityText = `${Math.floor(diffSeconds / 3600)}h ago`;
            }
            
            activityElement.textContent = activityText;
        }
    }

    // ✅ HELPER: Update connection badge
    updateConnectionBadge(status) {
        const badge = document.getElementById('connectionBadge');
        if (badge) {
            const totalConnections = status.totalConnections || 0;
            badge.textContent = totalConnections.toString();
            
            // Update badge color based on connection count
            badge.className = 'connection-badge';
            if (totalConnections > 10) {
                badge.classList.add('high-traffic');
            } else if (totalConnections > 5) {
                badge.classList.add('medium-traffic');
            } else if (totalConnections > 0) {
                badge.classList.add('low-traffic');
            }
        }
    }

    updateTestInfo() {
        const testInfo = document.querySelector('.test-info');
        if (!testInfo) return;

        const tcpOutInfo = document.getElementById('tcpOutputInfo');
        if (tcpOutInfo) {
            if (this.currentStatus.currentConfig) {
                const config = this.currentStatus.currentConfig;
                tcpOutInfo.textContent = `${config.tcpOutHost}:${config.tcpOutPort}`;
            } else {
                tcpOutInfo.textContent = 'Not configured';
            }
        }

        // ✅ NEW: Update multi-instance test info
        const multiInstanceInfo = document.getElementById('multiInstanceTestInfo');
        if (multiInstanceInfo && this.lastStatus) {
            if (this.lastStatus.autoServers && this.lastStatus.autoServers.servers) {
                let testInfoHTML = '<h4>Test Endpoints:</h4>';
                this.lastStatus.autoServers.servers.forEach(server => {
                    testInfoHTML += `
                        <div class="test-endpoint">
                            <code>telnet 127.0.0.1 ${server.port}</code>
                            <small>${server.connections} connected</small>
                        </div>
                    `;
                });
                multiInstanceInfo.innerHTML = testInfoHTML;
            }
        }
    }

    updateUptimeDisplay() {
        const uptimeElement = document.getElementById('uptimeDisplay');
        if (uptimeElement) {
            const uptime = Date.now() - this.startTime;
            uptimeElement.textContent = this.formatUptime(uptime);
        }
    }

    // ✅ UTILITY: Format uptime helper
    formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    async sendTestMessage() {
        const messageInput = document.getElementById('testMessage');
        if (!messageInput) return;

        const message = messageInput.value.trim();
        if (!message) {
            window.toastManager?.error('❌ Please enter a test payload');
            messageInput.focus();
            return;
        }

        // Add loading effect
        messageInput.style.borderColor = 'var(--cyan-neon)';
        messageInput.style.boxShadow = '0 0 20px rgba(0, 240, 255, 0.3)';

        try {
            await window.apiService.sendTestMessage(message);
            window.toastManager?.success(`🚀 Test payload launched: "${message}"`);
            window.monitorPageManager?.logInfo(`Test payload sent: ${message}`);
            
            this.messageCount++;
            messageInput.value = '';
            
        } catch (error) {
            console.error('Send test error:', error);
            window.toastManager?.error(`❌ Failed to send test payload: ${error.message}`);
            this.errorCount++;
        } finally {
            // Reset input styling
            messageInput.style.borderColor = '';
            messageInput.style.boxShadow = '';
        }
    }

    async stopForwarding() {
        console.log('🛑 Emergency stop initiated...');
        
        try {
            await window.apiService.stopForwarding();
            window.toastManager?.success('🛑 All bridges stopped successfully!');
            window.monitorPageManager?.logInfo('Emergency stop - All bridges deactivated');
            
            // Refresh all data
            await this.refreshAllData();
            
        } catch (error) {
            console.error('Stop forwarding error:', error);
            window.toastManager?.error(`❌ Failed to stop forwarding: ${error.message}`);
            this.errorCount++;
        }
    }

    async refreshAllData() {
        console.log('🔄 Refreshing all system data...');
        
        try {
            // Show loading indicator
            const refreshBtn = document.getElementById('refreshAll');
            if (refreshBtn) {
                const originalIcon = refreshBtn.querySelector('.btn-icon').textContent;
                refreshBtn.querySelector('.btn-icon').textContent = '⏳';
                refreshBtn.disabled = true;
                
                setTimeout(() => {
                    refreshBtn.querySelector('.btn-icon').textContent = originalIcon;
                    refreshBtn.disabled = false;
                }, 2000);
            }

            // Refresh data based on current tab
            const currentTab = window.navigationManager?.getCurrentTab();
            
            switch (currentTab) {
                case 'serial':
                    await window.serialPageManager?.loadSerialData();
                    break;
                case 'ip':
                    await window.ipPageManager?.loadIPData();
                    await window.ipPageManager?.updateInstancesStatus();
                    break;
                case 'dashboard':
                    await window.dashboardManager?.loadDashboardData();
                    break;
                case 'monitor':
                    await window.monitorPageManager?.loadInitialData();
                    break;
            }

            // Refresh status
            const status = await window.apiService.getStatus();
            this.updateStatus(status);
            
            window.toastManager?.success('🔄 System data refreshed');
            
        } catch (error) {
            console.error('Refresh error:', error);
            window.toastManager?.error('❌ Failed to refresh data');
            this.errorCount++;
        }
    }

    showError(message) {
        console.error('💥 Application error:', message);
        window.toastManager?.error(`💥 ${message}`);
    }

    // Public API methods for other components
    openModal(modalId, options) {
        return window.modalManager?.open(modalId, options);
    }

    closeModal(modalId) {
        return window.modalManager?.close(modalId);
    }

    switchTab(tabName) {
        return window.navigationManager?.switchMainTab(tabName);
    }

    clearLogs() {
        return window.monitorPageManager?.clearLogs();
    }

    exportLogs() {
        return window.monitorPageManager?.exportLogs();
    }

    // ✅ PUBLIC API: Get current application status
    getApplicationStatus() {
        return {
            uptime: Date.now() - this.startTime,
            messageCount: this.messageCount,
            errorCount: this.errorCount,
            isRunning: !!this.statusTimer,
            lastStatus: this.lastStatus,
            currentStatus: this.currentStatus
        };
    }

    // ✅ PUBLIC API: Force status update
    async forceStatusUpdate() {
        try {
            const status = await window.apiService.getStatus();
            this.updateStatus(status);
            return status;
        } catch (error) {
            console.error('Force status update error:', error);
            throw error;
        }
    }

    // Cleanup
    destroy() {
        console.log('🧹 Cleaning up TCP Bridge Application...');
        
        if (this.statusTimer) {
            clearInterval(this.statusTimer);
        }
        if (this.uptimeTimer) {
            clearInterval(this.uptimeTimer);
        }
        
        // Cleanup other managers
        window.dashboardManager?.destroy();
        window.monitorPageManager?.destroy();
        window.ipPageManager?.destroy();
        window.chartManager?.destroy();
        
        console.log('✅ TCP Bridge Application cleanup complete');
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌟 DOM Content Loaded - Initializing TCP Bridge Application...');
    
    // Create global app instance
    window.app = new SerialTCPApp();
    
    console.log('🚀 TCP Bridge Application ready and available as window.app');
    
    // ✅ ADD: Global debug helper
    window.debugApp = function() {
        console.log('=== TCP BRIDGE APP DEBUG ===');
        console.log('App status:', window.app.getApplicationStatus());
        console.log('Last API status:', window.app.lastStatus);
        console.log('Current status:', window.app.currentStatus);
        console.log('IP Page Manager:', window.ipPageManager?.getStatus());
        console.log('============================');
    };
});

// Enhanced global error handlers
window.addEventListener('error', (event) => {
    console.error('💥 Global error:', event.error);
    if (window.app) {
        window.app.showError('Unexpected system error occurred');
        window.monitorPageManager?.logError(`Global error: ${event.error.message}`);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('💥 Unhandled promise rejection:', event.reason);
    if (window.app) {
        window.app.showError('System promise rejection');
        window.monitorPageManager?.logError(`Unhandled rejection: ${event.reason}`);
    }
});

// Console welcome message
console.log(`
🌟 ====================================== 🌟
      Welcome to TCP Bridge Terminal
      Serial/IP to TCP Forwarder v2.0
      Theme: Dark Pink Cyber Edition
      Multi-Instance Support: ENABLED
🌟 ====================================== 🌟
`);

console.log('🎨 Dark Pink theme loaded successfully!');
console.log('🚀 All systems operational - Ready for action!');
console.log('🔥 Multi-instance support active!');
