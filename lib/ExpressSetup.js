const cors = require('cors');
const express = require('express');
const path = require('path');
const { SerialPort } = require('serialport');

class ExpressSetup {
    constructor(forwarder) {
        this.forwarder = forwarder;
    }

    setupExpress() {
        // ✅ FIX: Middleware setup dengan syntax yang benar
        this.forwarder.app.use(cors());
        this.forwarder.app.use(express.json()); // ✅ Correct: express.json(), bukan this.forwarder.app.json()
        this.forwarder.app.use(express.static('public')); // ✅ Correct: express.static(), bukan this.forwarder.app.static()

        // Routes
        this.setupSerialRoutes();
        this.setupIpRoutes();
        this.setupSystemRoutes();
        this.setupControlRoutes();
        this.setupMonitoringRoutes();
    }

    setupSerialRoutes() {
        // Get all serial configurations
        this.forwarder.app.get('/api/serial-configs', async (req, res) => {
            try {
                const configs = await this.forwarder.csvHandler.getSerialConfigs();
                res.json(configs);
            } catch (error) {
                console.error('Error loading serial configs:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Create serial configuration
        this.forwarder.app.post('/api/serial-configs', async (req, res) => {
            try {
                console.log('Creating serial config:', req.body);
                const config = await this.forwarder.csvHandler.saveSerialConfig(req.body);
                await this.forwarder.updateConfigCache();
                res.json(config);
            } catch (error) {
                console.error('Error creating serial config:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Update serial configuration
        this.forwarder.app.put('/api/serial-configs/:id', async (req, res) => {
            try {
                console.log('Updating serial config:', req.params.id, req.body);
                const config = await this.forwarder.csvHandler.saveSerialConfig({
                    ...req.body,
                    id: req.params.id
                });
                await this.forwarder.updateConfigCache();
                res.json(config);
            } catch (error) {
                console.error('Error updating serial config:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Delete serial configuration
        this.forwarder.app.delete('/api/serial-configs/:id', async (req, res) => {
            try {
                console.log('Deleting serial config:', req.params.id);
                
                // Stop forwarding if this config is active
                if (this.forwarder.currentConfig && this.forwarder.currentConfig.id === req.params.id) {
                    await this.forwarder.stopForwarding();
                }
                
                const result = await this.forwarder.csvHandler.deleteSerialConfig(req.params.id);
                await this.forwarder.updateConfigCache();
                res.json({ success: true, deleted: result });
            } catch (error) {
                console.error('Error deleting serial config:', error);
                res.status(500).json({ error: error.message });
            }
        });
    }

    setupIpRoutes() {
        // Get all IP configurations
        this.forwarder.app.get('/api/ip-configs', async (req, res) => {
            try {
                const configs = await this.forwarder.csvHandler.getIpConfigs();
                res.json(configs);
            } catch (error) {
                console.error('Error loading IP configs:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Create IP configuration
        this.forwarder.app.post('/api/ip-configs', async (req, res) => {
            try {
                console.log('Creating IP config:', req.body);
                const config = await this.forwarder.csvHandler.saveIpConfig(req.body);
                await this.forwarder.updateConfigCache();
                res.json(config);
            } catch (error) {
                console.error('Error creating IP config:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Update IP configuration
        this.forwarder.app.put('/api/ip-configs/:id', async (req, res) => {
            try {
                console.log('Updating IP config:', req.params.id, req.body);
                const config = await this.forwarder.csvHandler.saveIpConfig({
                    ...req.body,
                    id: req.params.id
                });
                await this.forwarder.updateConfigCache();
                res.json(config);
            } catch (error) {
                console.error('Error updating IP config:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Delete IP configuration
        this.forwarder.app.delete('/api/ip-configs/:id', async (req, res) => {
            try {
                console.log('Deleting IP config:', req.params.id);
                
                // Stop forwarding if this config is active
                if (this.forwarder.currentConfig && this.forwarder.currentConfig.id === req.params.id) {
                    await this.forwarder.stopForwarding();
                }
                
                const result = await this.forwarder.csvHandler.deleteIpConfig(req.params.id);
                await this.forwarder.updateConfigCache();
                res.json({ success: true, deleted: result });
            } catch (error) {
                console.error('Error deleting IP config:', error);
                res.status(500).json({ error: error.message });
            }
        });
    }

    setupSystemRoutes() {
        // Get available serial ports
        this.forwarder.app.get('/api/serial-ports', async (req, res) => {
            try {
                const ports = await SerialPort.list();
                res.json(ports.map(port => ({
                    path: port.path,
                    manufacturer: port.manufacturer || 'Unknown',
                    vendorId: port.vendorId,
                    productId: port.productId
                })));
            } catch (error) {
                console.error('Error listing serial ports:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Dashboard statistics endpoint
        this.forwarder.app.get('/api/dashboard-stats', async (req, res) => {
            try {
                await this.forwarder.updateConfigCache();
                
                const applicationUptime = Date.now() - this.forwarder.globalStats.application.uptimeStart;
                const uptimeSeconds = Math.floor(applicationUptime / 1000);

                const dashboardStats = {
                    heroStats: {
                        serialCount: this.forwarder.globalStats.configurations.serialCount,
                        ipCount: this.forwarder.globalStats.configurations.ipCount,
                        activeCount: this.forwarder.globalStats.configurations.totalActive,
                        messageCount: this.forwarder.globalStats.session.messageCount || this.forwarder.globalStats.application.totalLifetimeMessages
                    },
                    performanceStats: {
                        currentSpeed: this.forwarder.globalStats.session.messagesPerMinute,
                        averageSpeed: this.forwarder.globalStats.session.averageRate,
                        peakSpeed: this.forwarder.globalStats.session.peakRate,
                        totalMessages: this.forwarder.globalStats.session.messageCount,
                        messagesPerMinute: this.forwarder.globalStats.session.messagesPerMinute
                    },
                    configSummary: {
                        serialTotal: this.forwarder.globalStats.configurations.serialCount,
                        serialActive: this.forwarder.globalStats.configurations.serialActive,
                        ipTotal: this.forwarder.globalStats.configurations.ipCount,
                        ipActive: this.forwarder.globalStats.configurations.ipActive
                    },
                    systemHealth: {
                        uptimeSeconds: uptimeSeconds,
                        lastActivity: this.forwarder.globalStats.application.lastActivity,
                        errorCount: this.forwarder.globalStats.session.errorCount,
                        reconnectCount: this.forwarder.globalStats.session.reconnectCount
                    },
                    messageTypes: this.forwarder.globalStats.session.messageTypes,
                    activeConfig: this.forwarder.currentConfig ? {
                        id: this.forwarder.currentConfig.id,
                        name: this.forwarder.currentConfig.name,
                        type: this.forwarder.currentConfig.serialPort ? 'serial' : 'ip',
                        source: this.forwarder.currentConfig.serialPort || 
                                `${this.forwarder.currentConfig.ipHost}:${this.forwarder.currentConfig.ipPort}`,
                        tcpOutput: `${this.forwarder.currentConfig.tcpOutHost}:${this.forwarder.currentConfig.tcpOutPort}`,
                        monitorPort: this.forwarder.tcpDataPort
                    } : null,
                    telnetCommand: this.forwarder.tcpDataPort ? 
                        `telnet localhost ${this.forwarder.tcpDataPort}` : null,
                    timestamp: Date.now()
                };
                
                res.json(dashboardStats);
            } catch (error) {
                console.error('Error getting dashboard stats:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Speed statistics endpoint
        this.forwarder.app.get('/api/speed-stats', (req, res) => {
            try {
                res.json({
                    currentSpeed: this.forwarder.globalStats.session.messagesPerMinute,
                    averageSpeed: this.forwarder.globalStats.session.averageRate,
                    peakSpeed: this.forwarder.globalStats.session.peakRate,
                    totalMessages: this.forwarder.globalStats.session.messageCount,
                    messagesThisMinute: this.forwarder.globalStats.session.messagesPerMinute,
                    sessionStats: this.forwarder.globalStats.session,
                    applicationStats: this.forwarder.globalStats.application,
                    configurationStats: this.forwarder.globalStats.configurations,
                    chartData: this.forwarder.generateChartData()
                });
            } catch (error) {
                console.error('Error getting speed stats:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Chart data endpoint
        this.forwarder.app.get('/api/chart-data', (req, res) => {
            try {
                const chartData = this.forwarder.generateChartData();
                res.json({
                    success: true,
                    data: chartData,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('Error generating chart data:', error);
                res.status(500).json({ error: error.message });
            }
        });
    }

  setupControlRoutes() {
    // ✅ MISSING: Multi-instance start forwarding (body-based)
    this.forwarder.app.post('/api/start-forwarding', async (req, res) => {
        try {
            console.log('🚀 API: Multi-instance start forwarding request:', req.body);
            const { type, configId } = req.body;

            if (!type || !configId) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Type and configId are required' 
                });
            }

            console.log(`🚀 Starting ${type} forwarding for config: ${configId}`);

            // Check if forwarder has multi-instance support
            if (typeof this.forwarder.startInstance === 'function') {
                // Multi-instance approach
                const result = await this.forwarder.startInstance(type, configId);
                
                console.log('✅ API: Multi-instance start success:', result);
                res.json({
                    success: true,
                    instanceId: result.instanceId,
                    monitorPort: result.monitorPort,
                    totalInstances: this.forwarder.instances?.size || 1,
                    activeInstances: this.forwarder.activeInstances?.size || 1,
                    message: `${type} forwarding started successfully`,
                    data: result
                });
            } else {
                // Legacy single-instance approach
                await this.forwarder.startForwarding(type, configId);
                
                console.log('✅ API: Legacy start success');
                res.json({
                    success: true,
                    instanceId: `legacy_${Date.now()}`,
                    config: this.forwarder.currentConfig,
                    monitorPort: this.forwarder.tcpDataPort,
                    totalInstances: 1,
                    activeInstances: this.forwarder.isForwarding ? 1 : 0,
                    message: `${type} forwarding started successfully`,
                    telnetCommand: this.forwarder.tcpDataPort ? 
                        `telnet localhost ${this.forwarder.tcpDataPort}` : null
                });
            }

        } catch (error) {
            console.error('❌ API: Start forwarding error:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message,
                details: error.stack
            });
        }
    });

    // ✅ MISSING: Individual instance stop
    this.forwarder.app.post('/api/stop-instance', async (req, res) => {
        try {
            console.log('🛑 API: Stop individual instance request:', req.body);
            const { instanceId } = req.body;

            if (!instanceId) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Instance ID is required' 
                });
            }

            // Check if forwarder has multi-instance support
            if (typeof this.forwarder.stopInstance === 'function' && this.forwarder.instances) {
                // Multi-instance approach
                const instanceData = this.forwarder.instances.get(instanceId);
                if (!instanceData) {
                    return res.status(404).json({ 
                        success: false, 
                        error: `Instance ${instanceId} not found` 
                    });
                }

                await this.forwarder.stopInstance(instanceId);
                
                console.log('✅ API: Individual instance stopped:', instanceId);
                res.json({
                    success: true,
                    instanceId: instanceId,
                    message: `Instance ${instanceId} stopped successfully`,
                    totalInstances: this.forwarder.instances.size,
                    activeInstances: this.forwarder.activeInstances.size
                });
            } else {
                // Legacy fallback - stop all
                console.log('⚠️ API: Individual stop not supported, using global stop');
                await this.forwarder.stopForwarding();
                
                res.json({
                    success: true,
                    instanceId: instanceId,
                    message: 'Global stop executed (individual stop not supported)',
                    totalInstances: 0,
                    activeInstances: 0
                });
            }

        } catch (error) {
            console.error('❌ API: Stop individual instance error:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });

    // ✅ MISSING: Get individual instance details
    this.forwarder.app.get('/api/instance/:instanceId', async (req, res) => {
        try {
            const { instanceId } = req.params;
            console.log('🔍 API: Get individual instance request:', instanceId);

            // Check if forwarder has multi-instance support
            if (this.forwarder.instances && this.forwarder.instances.has(instanceId)) {
                const instanceData = this.forwarder.instances.get(instanceId);
                
                const instanceInfo = {
                    instanceId: instanceData.instanceId,
                    type: instanceData.type,
                    configId: instanceData.configId,
                    configName: instanceData.config?.name || 'Unknown',
                    status: instanceData.status,
                    startTime: instanceData.startTime,
                    uptime: Date.now() - (instanceData.startTime || Date.now()),
                    connections: {
                        inputConnected: !!instanceData.connections?.input,
                        outputConnected: !!instanceData.connections?.output,
                        monitorPort: instanceData.connections?.monitor?.port || null,
                        monitorClients: instanceData.connections?.monitor?.clients?.length || 0
                    },
                    stats: instanceData.stats || {
                        messageCount: 0,
                        bytesCount: 0,
                        errorCount: 0,
                        lastActivity: Date.now()
                    }
                };

                console.log('✅ API: Individual instance details retrieved:', instanceId);
                res.json({
                    success: true,
                    instance: instanceInfo
                });
            } else {
                return res.status(404).json({ 
                    success: false, 
                    error: `Instance ${instanceId} not found` 
                });
            }

        } catch (error) {
            console.error('❌ API: Get individual instance error:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });

    // ✅ MISSING: Get all instances
    this.forwarder.app.get('/api/instances', async (req, res) => {
        try {
            console.log('📋 API: Get all instances request');

            // Check if forwarder has multi-instance support
            if (typeof this.forwarder.getAllInstancesStatus === 'function') {
                const instancesStatus = this.forwarder.getAllInstancesStatus();
                
                console.log('✅ API: All instances retrieved (multi-instance)');
                res.json({
                    success: true,
                    totalInstances: this.forwarder.instances?.size || 0,
                    activeInstances: this.forwarder.activeInstances?.size || 0,
                    instances: instancesStatus
                });
            } else {
                // Legacy fallback - single instance
                const legacyInstance = [];
                
                if (this.forwarder.isForwarding && this.forwarder.currentConfig) {
                    legacyInstance.push({
                        instanceId: `legacy_${Date.now()}`,
                        type: this.forwarder.currentConfig.serialPort ? 'serial' : 'ip',
                        configId: this.forwarder.currentConfig.id,
                        configName: this.forwarder.currentConfig.name,
                        status: 'running',
                        startTime: Date.now() - 60000, // Estimate
                        uptime: 60000,
                        connections: {
                            inputConnected: true,
                            outputConnected: !!this.forwarder.tcpOutputClient,
                            monitorPort: this.forwarder.tcpDataPort,
                            monitorClients: this.forwarder.tcpDataClients?.length || 0
                        },
                        stats: this.forwarder.messageStats || {}
                    });
                }

                console.log('✅ API: Legacy instance status retrieved');
                res.json({
                    success: true,
                    totalInstances: legacyInstance.length,
                    activeInstances: legacyInstance.length,
                    instances: legacyInstance
                });
            }

        } catch (error) {
            console.error('❌ API: Get all instances error:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message,
                totalInstances: 0,
                activeInstances: 0,
                instances: []
            });
        }
    });

    // ✅ MISSING: Restart individual instance
    this.forwarder.app.post('/api/restart-instance', async (req, res) => {
        try {
            console.log('🔄 API: Restart individual instance request:', req.body);
            const { instanceId } = req.body;

            if (!instanceId) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Instance ID is required' 
                });
            }

            // Check if forwarder has multi-instance support
            if (typeof this.forwarder.stopInstance === 'function' && 
                typeof this.forwarder.startInstance === 'function' && 
                this.forwarder.instances) {
                
                const instanceData = this.forwarder.instances.get(instanceId);
                if (!instanceData) {
                    return res.status(404).json({ 
                        success: false, 
                        error: `Instance ${instanceId} not found` 
                    });
                }

                // Stop then start the instance
                const configId = instanceData.configId;
                const type = instanceData.type;

                await this.forwarder.stopInstance(instanceId);
                const result = await this.forwarder.startInstance(type, configId);
                
                console.log('✅ API: Individual instance restarted:', instanceId);
                res.json({
                    success: true,
                    oldInstanceId: instanceId,
                    newInstanceId: result.instanceId,
                    message: `Instance restarted successfully`,
                    data: result
                });
            } else {
                return res.status(501).json({ 
                    success: false, 
                    error: 'Individual restart not supported by this forwarder version' 
                });
            }

        } catch (error) {
            console.error('❌ API: Restart individual instance error:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });

    // ✅ ENHANCED: Monitor info with multi-instance support
    this.forwarder.app.get('/api/monitor-info', async (req, res) => {
        try {
            console.log('📡 API: Get monitor info request');
            
            let monitorInfo = {
                monitorServers: [],
                totalClients: 0,
                globalMonitorPort: this.forwarder.tcpDataPort || null,
                telnetCommands: []
            };

            // Multi-instance monitor info
            if (this.forwarder.instances && this.forwarder.instances.size > 0) {
                this.forwarder.instances.forEach((instanceData, instanceId) => {
                    if (instanceData.connections?.monitor) {
                        const monitorPort = instanceData.connections.monitor.port;
                        const clientCount = instanceData.connections.monitor.clients?.length || 0;
                        
                        monitorInfo.monitorServers.push({
                            instanceId: instanceId,
                            instanceName: instanceData.config?.name || instanceId,
                            port: monitorPort,
                            clients: clientCount,
                            telnetCommand: `telnet localhost ${monitorPort}`
                        });
                        
                        monitorInfo.totalClients += clientCount;
                        
                        if (monitorPort) {
                            monitorInfo.telnetCommands.push(`telnet localhost ${monitorPort} # ${instanceData.config?.name || instanceId}`);
                        }
                    }
                });
            } else {
                // Legacy single monitor
                if (this.forwarder.tcpDataPort) {
                    const clientCount = this.forwarder.tcpDataClients?.length || 0;
                    
                    monitorInfo.monitorServers.push({
                        instanceId: 'legacy',
                        instanceName: this.forwarder.currentConfig?.name || 'Legacy Instance',
                        port: this.forwarder.tcpDataPort,
                        clients: clientCount,
                        telnetCommand: `telnet localhost ${this.forwarder.tcpDataPort}`
                    });
                    
                    monitorInfo.totalClients = clientCount;
                    monitorInfo.telnetCommands.push(`telnet localhost ${this.forwarder.tcpDataPort}`);
                }
            }

            console.log('✅ API: Monitor info retrieved');
            res.json({
                success: true,
                monitorInfo: monitorInfo,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('❌ API: Get monitor info error:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });

    // ✅ EXISTING: Keep existing routes
    // Start forwarding (parameter-based - legacy support)
    this.forwarder.app.post('/api/start-forwarding/:type/:id', async (req, res) => {
        try {
            console.log('🚀 API: Legacy start forwarding (params):', req.params);
            await this.forwarder.startForwarding(req.params.type, req.params.id);
            res.json({
                success: true,
                message: 'Forwarding started successfully',
                config: this.forwarder.currentConfig,
                monitorPort: this.forwarder.tcpDataPort,
                telnetCommand: this.forwarder.tcpDataPort ? 
                    `telnet localhost ${this.forwarder.tcpDataPort}` : null,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Start forwarding error:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message,
                timestamp: Date.now()
            });
        }
    });

    // ✅ ENHANCED: Stop forwarding with multi-instance support
    this.forwarder.app.post('/api/stop-forwarding', async (req, res) => {
        try {
            console.log('🛑 API: Stop forwarding request (global)');
            
            // Check if forwarder has multi-instance support
            if (typeof this.forwarder.stopAllInstances === 'function') {
                await this.forwarder.stopAllInstances();
                console.log('✅ API: All instances stopped');
                
                res.json({ 
                    success: true, 
                    message: 'All instances stopped successfully',
                    totalInstances: 0,
                    activeInstances: 0,
                    timestamp: Date.now()
                });
            } else {
                // Legacy single instance stop
                await this.forwarder.stopForwarding();
                console.log('✅ API: Legacy forwarding stopped');
                
                res.json({ 
                    success: true, 
                    message: 'Forwarding stopped successfully',
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('Stop forwarding error:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message,
                timestamp: Date.now()
            });
        }
    });

    // ✅ EXISTING: Keep all other existing routes (send-test, emergency-stop)
    this.forwarder.app.post('/api/send-test', (req, res) => {
        try {
            const { message } = req.body;
            
            if (!message) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Message is required',
                    timestamp: Date.now()
                });
            }

            let sentToInstances = 0;

            // Multi-instance send test
            if (this.forwarder.instances && this.forwarder.instances.size > 0) {
                this.forwarder.instances.forEach((instanceData, instanceId) => {
                    if (instanceData.status === 'running' && instanceData.connections?.output) {
                        try {
                            // Send to instance output
                            if (typeof instanceData.connections.output.send === 'function') {
                                instanceData.connections.output.send(message + '\r\n');
                                sentToInstances++;
                            }
                        } catch (error) {
                            console.warn(`Failed to send test message to instance ${instanceId}:`, error.message);
                        }
                    }
                });

                res.json({ 
                    success: true, 
                    message: `Test message sent to ${sentToInstances} active instances`,
                    sentToInstances: sentToInstances,
                    testMessage: message,
                    timestamp: Date.now()
                });
            } else {
                // Legacy single instance
                if (!this.forwarder.currentConfig) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'No active configuration',
                        timestamp: Date.now()
                    });
                }

                if (!this.forwarder.isForwarding) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Forwarding is not active',
                        timestamp: Date.now()
                    });
                }

                // Process the test message
                this.forwarder.forwardToTCP(message);
                
                res.json({ 
                    success: true, 
                    message: `Test message sent: ${message}`,
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('Send test error:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message,
                timestamp: Date.now()
            });
        }
    });
    
    // ✅ EXISTING: Emergency stop endpoint
    this.forwarder.app.post('/api/emergency-stop', async (req, res) => {
        try {
            console.log('🚨 Emergency stop requested');
            
            // Multi-instance emergency stop
            if (typeof this.forwarder.stopAllInstances === 'function') {
                await this.forwarder.stopAllInstances();
                console.log('✅ Emergency stop: All instances stopped');
            } else {
                // Legacy emergency stop
                await this.forwarder.stopForwarding();
                console.log('✅ Emergency stop: Legacy forwarding stopped');
            }
            
            res.json({ 
                success: true, 
                message: 'Emergency stop completed',
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Emergency stop error:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message,
                timestamp: Date.now()
            });
        }
    });

    console.log('✅ All control routes configured (including multi-instance support):');
    console.log('   🚀 POST /api/start-forwarding (body-based)');
    console.log('   🚀 POST /api/start-forwarding/:type/:id (param-based)');
    console.log('   🛑 POST /api/stop-forwarding (global)');
    console.log('   🛑 POST /api/stop-instance (individual)');
    console.log('   🔍 GET  /api/instance/:instanceId');
    console.log('   📋 GET  /api/instances');
    console.log('   🔄 POST /api/restart-instance');
    console.log('   📡 GET  /api/monitor-info');
    console.log('   📤 POST /api/send-test');
    console.log('   🚨 POST /api/emergency-stop');
}


setupMonitoringRoutes() {
    // ✅ ENHANCED: Get current status with multi-instance support
    this.forwarder.app.get('/api/status', async (req, res) => {
        try {
            console.log('📊 API: Getting enhanced status...');
            
            // Get system status (handles both single and multi-instance)
            const systemStatus = await this.forwarder.getSystemStatus();
            
            // Enhanced connection counting
            let totalConnections = 0;
            let instancesArray = [];

            // Multi-instance status
            if (this.forwarder.instances && this.forwarder.instances.size > 0) {
                console.log(`📊 Multi-instance status: ${this.forwarder.instances.size} instances`);
                
                this.forwarder.instances.forEach((instanceData, instanceId) => {
                    const monitorClients = instanceData.connections?.monitor?.clients?.length || 0;
                    const outputConnected = !!instanceData.connections?.output;
                    const inputConnected = !!instanceData.connections?.input;
                    
                    totalConnections += monitorClients;
                    if (outputConnected) totalConnections++;
                    if (inputConnected) totalConnections++;

                    instancesArray.push({
                        instanceId: instanceData.instanceId,
                        type: instanceData.type,
                        configId: instanceData.configId,
                        configName: instanceData.config?.name || 'Unknown',
                        status: instanceData.status,
                        startTime: instanceData.startTime,
                        uptime: Date.now() - (instanceData.startTime || Date.now()),
                        connections: {
                            inputConnected: inputConnected,
                            outputConnected: outputConnected,
                            monitorPort: instanceData.connections?.monitor?.port || null,
                            monitorClients: monitorClients
                        },
                        stats: instanceData.stats || {}
                    });
                });

                console.log(`📊 Multi-instance: ${instancesArray.length} instances, ${totalConnections} total connections`);
            } else {
                // Legacy single instance
                const monitorClients = this.forwarder.tcpDataClients?.length || 0;
                totalConnections += monitorClients;
                
                // Count TCP server clients (if in server mode)
                if (this.forwarder.tcpServerHandler) {
                    const serverClients = this.forwarder.tcpServerHandler.getConnectedClientCount() || 0;
                    totalConnections += serverClients;
                }
                
                // Count TCP client connection (if in client mode and connected)
                if (this.forwarder.tcpClientHandler?.isConnected) {
                    totalConnections += 1;
                }

                // Legacy instance info
                if (this.forwarder.isForwarding && this.forwarder.currentConfig) {
                    instancesArray.push({
                        instanceId: `legacy_${this.forwarder.currentConfig.id}`,
                        type: this.forwarder.currentConfig.serialPort ? 'serial' : 'ip',
                        configId: this.forwarder.currentConfig.id,
                        configName: this.forwarder.currentConfig.name,
                        status: 'running',
                        startTime: Date.now() - 60000, // Estimate
                        uptime: 60000,
                        connections: {
                            inputConnected: true,
                            outputConnected: !!this.forwarder.tcpOutputClient,
                            monitorPort: this.forwarder.tcpDataPort,
                            monitorClients: monitorClients
                        },
                        stats: this.forwarder.messageStats || {}
                    });
                }

                console.log(`📊 Legacy: ${instancesArray.length} instances, ${totalConnections} total connections`);
            }

            // Build enhanced connection info
            let connectionInfo = {
                clientCount: totalConnections,
                type: 'none',
                status: 'disconnected'
            };

            if (this.forwarder.isForwarding && this.forwarder.currentConfig) {
                if (this.forwarder.currentConfig.serialPort) {
                    connectionInfo = {
                        type: 'serial',
                        port: this.forwarder.currentConfig.serialPort,
                        baudRate: this.forwarder.currentConfig.baudRate,
                        isOpen: this.forwarder.serialPort?.isOpen || false,
                        clientCount: totalConnections,
                        status: this.forwarder.serialPort?.isOpen ? 'connected' : 'disconnected'
                    };
                } else {
                    connectionInfo = {
                        type: 'ip',
                        host: this.forwarder.currentConfig.ipHost,
                        port: this.forwarder.currentConfig.ipPort,
                        mode: this.forwarder.currentConfig.connectionMode || 'server',
                        clientCount: totalConnections,
                        status: this.forwarder.tcpHandler?.getConnectionStatus() || {},
                        tcpServer: this.forwarder.tcpServerHandler ? {
                            isListening: this.forwarder.tcpServerHandler.isListening,
                            clientCount: this.forwarder.tcpServerHandler.getConnectedClientCount()
                        } : null,
                        tcpClient: this.forwarder.tcpClientHandler ? {
                            isConnected: this.forwarder.tcpClientHandler.isConnected,
                            reconnectAttempts: this.forwarder.tcpClientHandler.reconnectAttempts
                        } : null
                    };
                }
            }

            const tcpOutputStatus = this.forwarder.tcpOutputClient?.getStatus() || {
                isConnected: false,
                queueSize: 0
            };

            // Enhanced response with multi-instance data
            const enhancedStatus = {
                // Legacy compatibility
                isForwarding: this.forwarder.isForwarding,
                currentConfig: this.forwarder.currentConfig,
                lastActivity: this.forwarder.lastActivityTime,
                connectionInfo: connectionInfo,
                tcpOutputStatus: tcpOutputStatus,
                monitorServer: {
                    port: this.forwarder.tcpDataPort || null,
                    status: this.forwarder.messageStats?.monitorServerStatus || 'stopped',
                    connectedClients: this.forwarder.tcpDataClients?.length || 0,
                    telnetCommand: this.forwarder.tcpDataPort ? 
                        `telnet localhost ${this.forwarder.tcpDataPort}` : 'No monitor available'
                },
                globalStats: this.forwarder.globalStats,
                messageStats: this.forwarder.messageStats,
                totalConnections: totalConnections,
                
                // ✅ NEW: Multi-instance data
                totalInstances: this.forwarder.instances?.size || (this.forwarder.isForwarding ? 1 : 0),
                activeInstances: this.forwarder.activeInstances?.size || (this.forwarder.isForwarding ? 1 : 0),
                instances: instancesArray,
                multiInstanceSupport: typeof this.forwarder.startInstance === 'function',
                
                // Include system status
                ...systemStatus,
                
                timestamp: Date.now()
            };

            console.log('✅ Enhanced status response:', {
                totalInstances: enhancedStatus.totalInstances,
                activeInstances: enhancedStatus.activeInstances,
                instancesCount: enhancedStatus.instances.length,
                totalConnections: enhancedStatus.totalConnections,
                multiInstanceSupport: enhancedStatus.multiInstanceSupport
            });

            res.json(enhancedStatus);

        } catch (error) {
            console.error('❌ Enhanced status error:', error);
            res.status(500).json({ 
                error: error.message,
                isForwarding: false,
                totalInstances: 0,
                activeInstances: 0,
                instances: [],
                multiInstanceSupport: false,
                timestamp: Date.now()
            });
        }
    });

    // ✅ NEW: Health check endpoint
    this.forwarder.app.get('/api/health', (req, res) => {
        try {
            const uptime = Date.now() - (this.forwarder.globalStats?.application?.uptimeStart || Date.now());
            
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                uptime: uptime,
                uptimeSeconds: Math.floor(uptime / 1000),
                totalInstances: this.forwarder.instances?.size || (this.forwarder.isForwarding ? 1 : 0),
                activeInstances: this.forwarder.activeInstances?.size || (this.forwarder.isForwarding ? 1 : 0),
                autoServers: this.forwarder.autoServers?.size || 0,
                multiInstanceSupport: typeof this.forwarder.startInstance === 'function',
                version: '2.0.0' // Update as needed
            });
        } catch (error) {
            console.error('Health check error:', error);
            res.status(500).json({
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    console.log('✅ Enhanced monitoring routes configured:');
    console.log('   📊 GET  /api/status (with multi-instance support)');
    console.log('   💚 GET  /api/health');
}



}

module.exports = ExpressSetup;
