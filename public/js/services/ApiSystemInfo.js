/**
 * API System Information Methods
 * Handles system status, serial ports, and monitoring data
 */

class ApiSystemInfo {
    constructor(core) {
        this.core = core;
    }

    // SYSTEM INFORMATION API - ENHANCED
    async getSerialPorts() {
        try {
            console.log('🔍 Scanning for serial ports...');
            const ports = await this.core.get('/api/serial-ports');
            
            if (!Array.isArray(ports)) {
                throw new Error('Invalid response format: expected array');
            }
            
            console.log(`✅ Found ${ports.length} serial ports`);
            
            // Enhance port information
            const enhancedPorts = ports.map(port => ({
                path: port.path || 'Unknown',
                manufacturer: port.manufacturer || 'Unknown Manufacturer',
                vendorId: port.vendorId || null,
                productId: port.productId || null,
                serialNumber: port.serialNumber || null,
                pnpId: port.pnpId || null,
                locationId: port.locationId || null,
                // Add display name for UI
                displayName: `${port.path} - ${port.manufacturer || 'Unknown Device'}`
            }));
            
            return enhancedPorts;
        } catch (error) {
            console.error('❌ Failed to scan serial ports:', error);
            // Return empty array to prevent UI crashes
            return [];
        }
    }

    async getDashboardStats() {
        try {
            console.log('📊 Loading dashboard statistics...');
            const stats = await this.core.get('/api/dashboard-stats', { useCache: false });
            
            // Validate response structure
            if (!stats || typeof stats !== 'object') {
                throw new Error('Invalid response format: expected object');
            }
            
            // Ensure required sections exist with defaults
            const enhancedStats = {
                heroStats: {
                    serialCount: 0,
                    ipCount: 0,
                    activeCount: 0,
                    messageCount: 0,
                    ...stats.heroStats
                },
                performanceStats: {
                    currentSpeed: 0,
                    averageSpeed: 0,
                    peakSpeed: 0,
                    totalMessages: 0,
                    messagesPerMinute: 0,
                    ...stats.performanceStats
                },
                configSummary: {
                    serialTotal: 0,
                    serialActive: 0,
                    ipTotal: 0,
                    ipActive: 0,
                    ...stats.configSummary
                },
                systemHealth: {
                    uptimeSeconds: 0,
                    lastActivity: null,
                    errorCount: 0,
                    reconnectCount: 0,
                    isForwarding: false,
                    hasActiveConfig: false,
                    monitoringClientsConnected: 0,
                    ...stats.systemHealth
                },
                messageTypes: {
                    AIS: 0,
                    GNSS: 0,
                    SERIAL: 0,
                    DATA: 0,
                    ...stats.messageTypes
                },
                activeConfig: stats.activeConfig || null,
                telnetCommand: stats.telnetCommand || null,
                timestamp: stats.timestamp || Date.now()
            };
            
            console.log('✅ Dashboard statistics loaded');
            return enhancedStats;
        } catch (error) {
            console.error('❌ Failed to load dashboard statistics:', error);
            // Return default stats to prevent UI crashes
            return this.getDefaultDashboardStats();
        }
    }

async getStatus() {
    try {
        console.log('🔍 Getting system status...');
        const status = await this.core.get('/api/status', { useCache: false });
        
        // ✅ SIMPLIFIED: Use totalConnections from backend (much cleaner!)
        let connectionInfo = {
            clientCount: status.totalConnections || 0, // ✅ Direct dari backend
            type: 'none',
            status: 'disconnected',
            ...status.connectionInfo // Override dengan data backend jika ada
        };

        // ✅ Jika backend tidak kirim totalConnections, hitung sebagai fallback
        if (status.totalConnections === undefined && status.connectionInfo?.clientCount === undefined) {
            let calculatedCount = 0;
            
            if (status.monitorServer?.connectedClients) {
                calculatedCount += status.monitorServer.connectedClients;
            }
            
            if (status.connectionInfo?.tcpServer?.clientCount) {
                calculatedCount += status.connectionInfo.tcpServer.clientCount;
            }
            
            if (status.connectionInfo?.tcpClient?.isConnected) {
                calculatedCount += 1;
            }
            
            connectionInfo.clientCount = calculatedCount;
            console.log('⚠️ Calculated connection count as fallback:', calculatedCount);
        }

        // ✅ Enhanced status response
        const enhancedStatus = {
            isForwarding: Boolean(status.isForwarding),
            currentConfig: status.currentConfig || null,
            lastActivity: status.lastActivity || null,
            connectionInfo: connectionInfo, // ✅ Uses totalConnections from backend
            tcpOutputStatus: status.tcpOutputStatus || { isConnected: false },
            totalConnections: status.totalConnections || connectionInfo.clientCount, // ✅ Pass through
            activeStreams: status.activeStreams || (status.isForwarding ? 1 : 0), // ✅ Pass through active streams
            monitorServer: {
                port: null,
                status: 'stopped',
                connectedClients: 0,
                telnetCommand: 'No monitor available',
                ...status.monitorServer
            },
            globalStats: status.globalStats || {},
            messageStats: status.messageStats || {},
            systemHealth: {
                activeStreams: status.activeStreams,
                totalConnections: status.totalConnections,
                ...status.systemHealth
            },
            timestamp: status.timestamp || Date.now(),
            // ✅ Pass through debug info dari backend
            debug: status.debug || null
        };
        
        console.log('✅ System status retrieved:', {
            totalConnections: enhancedStatus.totalConnections,
            activeStreams: enhancedStatus.activeStreams,
            clientCount: connectionInfo.clientCount,
            isForwarding: enhancedStatus.isForwarding
        });
        
        return enhancedStatus;
    } catch (error) {
        console.error('❌ Failed to get system status:', error);
        // Return default status to prevent crashes
        return this.getDefaultStatus();
    }
}




    async getMonitorInfo() {
        try {
            console.log('📡 Getting monitor information...');
            const info = await this.core.get('/api/monitor-info', { useCache: false });
            
            const enhancedInfo = {
                monitorPort: info.monitorPort || null,
                monitorStatus: info.monitorStatus || 'stopped',
                connectedClients: info.connectedClients || 0,
                recentMessages: info.recentMessages || [],
                telnetCommand: info.telnetCommand || 'No active monitoring server',
                sessionStats: info.sessionStats || {},
                applicationStats: info.applicationStats || {},
                configurationStats: info.configurationStats || {},
                timestamp: info.timestamp || Date.now()
            };
            
            console.log('✅ Monitor information retrieved');
            return enhancedInfo;
        } catch (error) {
            console.error('❌ Failed to get monitor information:', error);
            return this.getDefaultMonitorInfo();
        }
    }

    async getSpeedStats() {
        try {
            console.log('⚡ Getting speed statistics...');
            const stats = await this.core.get('/api/speed-stats', { useCache: false });
            
            const enhancedStats = {
                currentSpeed: stats.currentSpeed || 0,
                averageSpeed: stats.averageSpeed || 0,
                peakSpeed: stats.peakSpeed || 0,
                totalMessages: stats.totalMessages || 0,
                messagesThisMinute: stats.messagesThisMinute || 0,
                sessionStats: stats.sessionStats || {},
                applicationStats: stats.applicationStats || {},
                configurationStats: stats.configurationStats || {},
                chartData: stats.chartData || {},
                timestamp: Date.now()
            };
            
            console.log('✅ Speed statistics retrieved');
            return enhancedStats;
        } catch (error) {
            console.error('❌ Failed to get speed statistics:', error);
            return this.getDefaultSpeedStats();
        }
    }

    async getChartData() {
        try {
            console.log('📈 Getting chart data...');
            const response = await this.core.get('/api/chart-data', { useCache: false });
            
            if (!response.success) {
                throw new Error(response.error || 'Chart data request failed');
            }
            
            const chartData = response.data || {};
            
            // Validate chart data structure
            const enhancedChartData = {
                realtimeSpeed: chartData.realtimeSpeed || { labels: [], datasets: [] },
                speedHistory: chartData.speedHistory || { labels: [], datasets: [] },
                messageVolume: chartData.messageVolume || { labels: [], datasets: [] },
                messageTypes: chartData.messageTypes || { labels: [], datasets: [] },
                errorHistory: chartData.errorHistory || { labels: [], datasets: [] },
                timestamp: response.timestamp || Date.now()
            };
            
            console.log('✅ Chart data retrieved');
            return enhancedChartData;
        } catch (error) {
            console.error('❌ Failed to get chart data:', error);
            return this.getDefaultChartData();
        }
    }

    // Default fallback data methods
    getDefaultDashboardStats() {
        return {
            heroStats: { serialCount: 0, ipCount: 0, activeCount: 0, messageCount: 0 },
            performanceStats: { currentSpeed: 0, averageSpeed: 0, peakSpeed: 0, totalMessages: 0, messagesPerMinute: 0 },
            configSummary: { serialTotal: 0, serialActive: 0, ipTotal: 0, ipActive: 0 },
            systemHealth: { uptimeSeconds: 0, lastActivity: null, errorCount: 0, reconnectCount: 0, isForwarding: false, hasActiveConfig: false, monitoringClientsConnected: 0 },
            messageTypes: { AIS: 0, GNSS: 0, SERIAL: 0, DATA: 0 },
            activeConfig: null,
            telnetCommand: null,
            timestamp: Date.now()
        };
    }

    getDefaultStatus() {
        return {
            isForwarding: false,
            currentConfig: null,
            lastActivity: null,
            connectionInfo: {},
            tcpOutputStatus: { isConnected: false },
            monitorServer: { port: null, status: 'stopped', connectedClients: 0, telnetCommand: 'No monitor available' },
            globalStats: {},
            messageStats: {},
            systemHealth: {},
            timestamp: Date.now()
        };
    }

    getDefaultMonitorInfo() {
        return {
            monitorPort: null,
            monitorStatus: 'stopped',
            connectedClients: 0,
            recentMessages: [],
            telnetCommand: 'No active monitoring server',
            sessionStats: {},
            applicationStats: {},
            configurationStats: {},
            timestamp: Date.now()
        };
    }

    getDefaultSpeedStats() {
        return {
            currentSpeed: 0,
            averageSpeed: 0,
            peakSpeed: 0,
            totalMessages: 0,
            messagesThisMinute: 0,
            sessionStats: {},
            applicationStats: {},
            configurationStats: {},
            chartData: {},
            timestamp: Date.now()
        };
    }

    getDefaultChartData() {
        return {
            realtimeSpeed: { labels: [], datasets: [] },
            speedHistory: { labels: [], datasets: [] },
            messageVolume: { labels: [], datasets: [] },
            messageTypes: { labels: [], datasets: [] },
            errorHistory: { labels: [], datasets: [] },
            timestamp: Date.now()
        };
    }
}

// Export for use in other modules
window.ApiSystemInfo = ApiSystemInfo;
