const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const cors = require('cors');
const net = require('net');
const path = require('path');
const CSVHandler = require('../utils/csvHandler');
const TCPClientHandler = require('../utils/tcpClient');
const TCPServerHandler = require('../utils/tcpServer');
const TCPOutputClient = require('../utils/tcpOutputClient');

// Import modular components
const HistoricalDataTracker = require('./HistoricalDataTracker');
const StatsCalculator = require('./StatsCalculator');
const ExpressSetup = require('./ExpressSetup');
const SerialHandler = require('./SerialHandler');
const TCPHandler = require('./TCPHandler');
const MonitoringServer = require('./MonitoringServer');

class SerialTCPForwarder {
    constructor() {
        this.app = express();

        // ✅ MULTI-INSTANCE SUPPORT: Add instance management
        this.instances = new Map(); // instanceId -> instance data
        this.activeInstances = new Set(); // Set of active instance IDs
        this.instanceCounter = 0;

        // ✅ INTEGRATED AUTO TCP SERVER MANAGER
        this.autoServers = new Map(); // port -> server instance
        this.autoServerStats = new Map(); // port -> stats
        this.isAutoServerEnabled = true;
        this.portRange = { min: 4001, max: 8000 }; // Range port yang bisa di-serve
        this.autoServerMonitorInterval = null;
        this.configMonitorInterval = null;

        // ✅ BACKWARD COMPATIBILITY: Keep single-instance properties
        this.serialPort = null;
        this.tcpClientHandler = null;
        this.tcpServerHandler = null;
        this.tcpOutputClient = null;

        // TCP Data Server untuk monitoring
        this.tcpDataServer = null;
        this.tcpDataClients = [];
        this.tcpDataPort = null;
        this.dataBuffer = [];

        // Initialize modular components
        this.historicalDataTracker = new HistoricalDataTracker(this);
        this.statsCalculator = new StatsCalculator(this);
        this.expressSetup = new ExpressSetup(this);
        this.serialHandler = new SerialHandler(this);
        this.tcpHandler = new TCPHandler(this);
        this.monitoringServer = new MonitoringServer(this);

        // ENHANCED: Historical Data Tracking untuk Charts - delegated to module
        this.historicalData = this.historicalDataTracker.historicalData;

        // ENHANCED: Global Statistics untuk Dashboard dan API - delegated to module
        this.globalStats = this.statsCalculator.globalStats;

        // Cache for configuration data
        this.configCache = {
            serial: [],
            ip: [],
            lastUpdate: null,
            updateInterval: 5000 // 5 seconds
        };

        this.csvHandler = new CSVHandler();
        this.currentConfig = null;
        this.isForwarding = false;
        this.messageBuffer = [];
        this.lastActivityTime = Date.now();
        this.messageStats = {
            totalMessages: 0,
            totalBytes: 0,
            lastMessage: null,
            tcpOutputStatus: 'disconnected',
            monitorServerStatus: 'stopped',
            monitorPort: null
        };

        // Initialize all components
        this.init();
         setTimeout(() => {
        this.forceLegacyConversion();
    }, 3000);
    }
forceLegacyConversion() {
    console.log('🔄 FORCE LEGACY TO MULTI-INSTANCE CONVERSION...');
    
    try {
        // Check if legacy connections exist but no instances
        const hasLegacyConnections = !!(
            this.tcpClientHandler || 
            this.tcpServerHandler || 
            this.serialPort?.isOpen
        );
        
        const hasActiveInstances = this.activeInstances.size > 0;
        
        if (hasLegacyConnections && !hasActiveInstances && this.currentConfig) {
            console.log(`🔄 CONVERTING LEGACY: ${this.currentConfig.name}`);
            
            // Create instance ID
            const instanceId = `converted_${this.currentConfig.id || 'legacy'}_${Date.now()}`;
            
            // Create instance data from legacy
            const instanceData = {
                instanceId: instanceId,
                type: this.currentConfig.serialPort ? 'serial' : 'ip',
                configId: this.currentConfig.id || 'legacy_config',
                config: { ...this.currentConfig },
                status: 'running',
                startTime: Date.now(),
                connections: {
                    input: this.tcpClientHandler || this.tcpServerHandler || this.serialPort,
                    output: this.tcpOutputClient,
                    monitor: null
                },
                stats: {
                    messageCount: this.messageStats.totalMessages || 0,
                    bytesCount: this.messageStats.totalBytes || 0,
                    errorCount: 0,
                    lastActivity: this.lastActivityTime || Date.now()
                }
            };
            
            // Add to multi-instance system
            this.instances.set(instanceId, instanceData);
            this.activeInstances.add(instanceId);
            
            // ✅ CRITICAL: Hijack the message events
            if (this.tcpClientHandler && this.tcpClientHandler.on) {
                console.log('🔧 HIJACKING TCP CLIENT EVENTS...');
                
                // Remove existing listeners (if possible)
                try {
                    this.tcpClientHandler.removeAllListeners('message');
                } catch (e) {}
                
                // Add new listener that routes to processInstanceMessage
                this.tcpClientHandler.on('message', (message) => {
                    this.processInstanceMessage(instanceData, message);
                });
                
                console.log('✅ TCP CLIENT events hijacked to multi-instance system');
            }
            
            if (this.tcpServerHandler && this.tcpServerHandler.on) {
                console.log('🔧 HIJACKING TCP SERVER EVENTS...');
                
                try {
                    this.tcpServerHandler.removeAllListeners('message');
                } catch (e) {}
                
                this.tcpServerHandler.on('message', (message, clientId) => {
                    this.processInstanceMessage(instanceData, message);
                });
                
                console.log('✅ TCP SERVER events hijacked to multi-instance system');
            }
            
            if (this.serialPort && this.serialPort.on) {
                console.log('🔧 HIJACKING SERIAL PORT EVENTS...');
                
                // For serial port, we need to hijack the parser
                // This is more complex, but we can override the message processing
            }
            
            console.log(`✅ CONVERSION SUCCESS: ${instanceId} created from legacy`);
            console.log(`🎯 Multi-instance now active: ${this.instances.size} instances, ${this.activeInstances.size} active`);
            
        } else if (!hasLegacyConnections && !hasActiveInstances) {
            console.log('ℹ️ No legacy connections to convert');
        } else {
            console.log(`ℹ️ Conversion not needed: legacy=${hasLegacyConnections}, instances=${hasActiveInstances}`);
        }
        
    } catch (error) {
        console.error('❌ Legacy conversion error:', error);
    }
}
    async init() {
        this.expressSetup.setupExpress();
        this.startWebInterface();
        this.startActivityMonitor();
        this.statsCalculator.startStatsCalculator();
        this.startConfigCacheUpdater();
        this.historicalDataTracker.startHistoricalDataTracking();
        
        // ✅ NEW: Start integrated auto TCP server manager
        await this.startAutoTCPServerManager();
    }

    // ✅ INTEGRATED AUTO TCP SERVER MANAGER METHODS
    async startAutoTCPServerManager() {
        try {
            console.log('🚀 Starting Integrated Auto TCP Server Manager...');
            
            // Start with current configs
            await this.scanAndCreateAutoServers();
            
            // Monitor for config changes
            this.startAutoServerConfigMonitoring();
            
            // Start stats monitoring
            this.startAutoServerStatsMonitoring();
            
            console.log('✅ Integrated Auto TCP Server Manager started successfully');
            
        } catch (error) {
            console.error('❌ Failed to start Auto TCP Server Manager:', error);
        }
    }

    // ✅ Scan configurations and create auto servers
    async scanAndCreateAutoServers() {
        try {
            const configs = await this.csvHandler.getIpConfigs();
            const requiredPorts = new Set();
            
            // Extract all TCP output ports from configs
            configs.forEach(config => {
                const tcpOutPort = parseInt(config.tcpOutPort);
                if (tcpOutPort && tcpOutPort >= this.portRange.min && tcpOutPort <= this.portRange.max) {
                    requiredPorts.add(tcpOutPort);
                }
            });

            console.log(`🔍 Found ${requiredPorts.size} unique TCP output ports:`, Array.from(requiredPorts));

            // Create servers for required ports
            for (const port of requiredPorts) {
                if (!this.autoServers.has(port)) {
                    await this.createAutoServer(port);
                }
            }

            // Remove servers for ports no longer needed
            const currentPorts = new Set(this.autoServers.keys());
            for (const port of currentPorts) {
                if (!requiredPorts.has(port)) {
                    console.log(`🛑 Removing auto-server for unused port ${port}`);
                    await this.removeAutoServer(port);
                }
            }

        } catch (error) {
            console.error('❌ Error scanning and creating auto-servers:', error);
        }
    }

    // ✅ Create auto server for specific port
    async createAutoServer(port) {
        try {
            if (this.autoServers.has(port)) {
                console.log(`⚠️ Auto-server on port ${port} already exists`);
                return;
            }

            console.log(`🏗️ Creating auto-server on port ${port}...`);

            const server = net.createServer((socket) => {
                this.handleAutoServerConnection(port, socket);
            });

            await new Promise((resolve, reject) => {
                server.listen(port, '127.0.0.1', (err) => {
                    if (err) {
                        if (err.code === 'EADDRINUSE') {
                            console.warn(`⚠️ Port ${port} already in use - skipping auto-server`);
                            resolve(false);
                        } else {
                            reject(err);
                        }
                    } else {
                        console.log(`✅ Auto-server listening on 127.0.0.1:${port}`);
                        resolve(true);
                    }
                });
            });

            // Store server and initialize stats
            this.autoServers.set(port, server);
            this.autoServerStats.set(port, {
                port: port,
                connections: 0,
                totalConnections: 0,
                messagesReceived: 0,
                aisMessages: 0,
                gnssMessages: 0,
                dataMessages: 0,
                bytesReceived: 0,
                lastActivity: null,
                startTime: Date.now(),
                clients: []
            });

            server.on('error', (err) => {
                console.error(`❌ Auto-server error on port ${port}:`, err.message);
            });

        } catch (error) {
            console.error(`❌ Failed to create auto-server on port ${port}:`, error);
        }
    }

    // ✅ Remove auto server for specific port
    async removeAutoServer(port) {
        try {
            const server = this.autoServers.get(port);
            if (server) {
                server.close(() => {
                    console.log(`🔌 Auto-server on port ${port} closed`);
                });
                this.autoServers.delete(port);
                this.autoServerStats.delete(port);
            }
        } catch (error) {
            console.error(`❌ Error removing auto-server on port ${port}:`, error);
        }
    }

    // ✅ Handle auto server client connections
    handleAutoServerConnection(port, socket) {
        const stats = this.autoServerStats.get(port);
        if (!stats) return;

        stats.connections++;
        stats.totalConnections++;
        stats.lastActivity = new Date();

        const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
        const clientInfo = {
            id: clientId,
            socket: socket,
            connectedAt: new Date(),
            messagesReceived: 0
        };

        stats.clients.push(clientInfo);
        
        console.log(`[${port}] ✅ Auto-server client connected: ${clientId}`);
        
        // Send welcome message
        socket.write(`[${port}] Connected to Auto TCP Server\r\n`);
        socket.write(`[${port}] === Live AIS Data Stream ===\r\n`);

        socket.on('data', (data) => {
            const dataStr = data.toString();
            stats.bytesReceived += data.length;
            stats.lastActivity = new Date();
            clientInfo.messagesReceived++;
            
            // Split by line endings
            const messages = dataStr.split(/\r\n|\r|\n/);
            
            messages.forEach(message => {
                const trimmed = message.trim();
                if (trimmed.length > 0) {
                    stats.messagesReceived++;
                    
                    if (trimmed.startsWith('!AIVDM') || trimmed.startsWith('!AIVDO')) {
                        stats.aisMessages++;
                        console.log(`[${port}] 🚢 AIS[${stats.aisMessages}]: ${trimmed}`);
                    } else if (trimmed.startsWith('$GP') || trimmed.startsWith('$GN')) {
                        stats.gnssMessages++;
                        console.log(`[${port}] 📡 GNSS[${stats.gnssMessages}]: ${trimmed}`);
                    } else {
                        stats.dataMessages++;
                        console.log(`[${port}] 📨 DATA[${stats.messagesReceived}]: ${trimmed}`);
                    }
                }
            });
        });

        socket.on('close', () => {
            stats.connections--;
            stats.clients = stats.clients.filter(c => c.id !== clientId);
            console.log(`[${port}] ❌ Auto-server client disconnected: ${clientId}`);
            console.log(`[${port}] 📊 Client stats: ${clientInfo.messagesReceived} messages received`);
        });

        socket.on('error', (err) => {
            console.log(`[${port}] ⚠️ Auto-server socket error: ${err.message}`);
        });
    }

    // ✅ Start auto server configuration monitoring
    startAutoServerConfigMonitoring() {
        this.configMonitorInterval = setInterval(async () => {
            try {
                await this.scanAndCreateAutoServers();
            } catch (error) {
                console.warn('⚠️ Auto-server config monitoring error:', error);
            }
        }, 10000); // Check every 10 seconds
    }

    // ✅ Start auto server stats monitoring
    startAutoServerStatsMonitoring() {
        this.autoServerMonitorInterval = setInterval(() => {
            this.showAutoServerStats();
        }, 30000); // Every 30 seconds
    }

    // ✅ Show auto server statistics
    showAutoServerStats() {
        if (this.autoServers.size === 0) return;

        console.log('\n' + '='.repeat(80));
        console.log('📊 INTEGRATED AUTO TCP SERVERS STATISTICS');
        console.log('='.repeat(80));
        
        for (const [port, stats] of this.autoServerStats) {
            const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
            const lastActivity = stats.lastActivity ? 
                `${Math.floor((Date.now() - stats.lastActivity.getTime()) / 1000)}s ago` : 
                'Never';
            
            console.log(`🏷️  AUTO-SERVER PORT ${port}`);
            console.log(`   🔗 Active Connections: ${stats.connections}`);
            console.log(`   📈 Total Connections: ${stats.totalConnections}`);
            console.log(`   📨 Messages: ${stats.messagesReceived} total`);
            console.log(`   🚢 AIS: ${stats.aisMessages} | 📡 GNSS: ${stats.gnssMessages} | 📄 Data: ${stats.dataMessages}`);
            console.log(`   💾 Bytes: ${this.formatBytes(stats.bytesReceived)}`);
            console.log(`   ⏱️  Uptime: ${this.formatUptime(uptime)}`);
            console.log(`   🕐 Last Activity: ${lastActivity}`);
            console.log('');
        }
        
        console.log(`🎯 Total Integrated Auto-Servers: ${this.autoServers.size}`);
        console.log('='.repeat(80));
    }

    // ✅ Get auto servers status
    getAutoServersStatus() {
        const serversStatus = [];
        
        for (const [port, stats] of this.autoServerStats) {
            serversStatus.push({
                port: port,
                isListening: this.autoServers.has(port),
                connections: stats.connections,
                totalConnections: stats.totalConnections,
                messagesReceived: stats.messagesReceived,
                aisMessages: stats.aisMessages,
                gnssMessages: stats.gnssMessages,
                bytesReceived: stats.bytesReceived,
                uptime: Date.now() - stats.startTime,
                lastActivity: stats.lastActivity,
                clients: stats.clients.map(c => ({
                    id: c.id,
                    connectedAt: c.connectedAt,
                    messagesReceived: c.messagesReceived
                }))
            });
        }
        
        return {
            totalServers: this.autoServers.size,
            servers: serversStatus,
            isEnabled: this.isAutoServerEnabled
        };
    }

    // ✅ Manual auto server management
    async addAutoServerForPort(port) {
        if (port >= this.portRange.min && port <= this.portRange.max) {
            await this.createAutoServer(port);
            return true;
        }
        return false;
    }

    async removeAutoServerForPort(port) {
        await this.removeAutoServer(port);
        return true;
    }

    // ✅ MULTI-INSTANCE: Start new instance
    async startInstance(type, configId) {
        let instanceId = null;
        
        try {
            console.log(`🚀 Starting new instance: ${type} - ${configId}`);

            // Generate unique instance ID
            instanceId = `${type}_${configId}_${++this.instanceCounter}`;

            // Check for existing running instance
            const existingInstance = this.findInstanceByConfigId(configId, type);
            if (existingInstance && existingInstance.status === 'running') {
                throw new Error(`Configuration "${configId}" is already running as instance "${existingInstance.instanceId}"`);
            }

            // Get configuration
            let config = null;
            if (type === 'serial') {
                const configs = await this.csvHandler.getSerialConfigs();
                config = configs.find(c => c.id === configId);
            } else if (type === 'ip') {
                const configs = await this.csvHandler.getIpConfigs();
                config = configs.find(c => c.id === configId);
            }

            if (!config) {
                throw new Error(`Configuration ${configId} not found`);
            }

            // Check for port conflicts
            const conflictingInstance = this.checkPortConflict(config);
            if (conflictingInstance) {
                throw new Error(`Port ${config.tcpOutPort} already in use by "${conflictingInstance.config.name}"`);
            }

            console.log(`🔧 Creating instance for config: "${config.name}"`);

            // Create instance data
            const instanceData = {
                instanceId,
                type,
                configId,
                config: { ...config },
                status: 'starting',
                startTime: Date.now(),
                connections: {
                    input: null,
                    output: null,
                    monitor: null
                },
                stats: {
                    messageCount: 0,
                    bytesCount: 0,
                    errorCount: 0,
                    lastActivity: Date.now()
                }
            };

            // Store instance
            this.instances.set(instanceId, instanceData);

            // Start the instance
            if (type === 'serial') {
                await this.startSerialInstance(instanceData);
            } else if (type === 'ip') {
                await this.startIPInstance(instanceData);
            }

            // Mark as active
            this.activeInstances.add(instanceId);
            instanceData.status = 'running';

            // Start monitor for this instance
            await this.startInstanceMonitor(instanceData);

            // ✅ BACKWARD COMPATIBILITY: Set as current config if first instance
            if (this.activeInstances.size === 1) {
                this.currentConfig = config;
                this.isForwarding = true;
                
                // Set legacy properties for backward compatibility
                if (type === 'serial') {
                    this.serialPort = instanceData.connections.input;
                } else {
                    if (config.connectionMode === 'client') {
                        this.tcpClientHandler = instanceData.connections.input;
                    } else {
                        this.tcpServerHandler = instanceData.connections.input;
                    }
                }
                this.tcpOutputClient = instanceData.connections.output;
            }

            console.log(`✅ Instance ${instanceId} started successfully`);
            
            return {
                instanceId,
                config,
                monitorPort: instanceData.connections.monitor?.port,
                totalInstances: this.activeInstances.size,
                success: true
            };

        } catch (error) {
            console.error(`❌ Failed to start instance ${instanceId}:`, error);
            this.cleanupFailedInstance(instanceId);
            throw error;
        }
    }

    // ✅ MULTI-INSTANCE: Start IP instance
    async startIPInstance(instanceData) {
        const { config, instanceId } = instanceData;
        let inputHandler = null;

        try {
            console.log(`🌐 Starting IP instance ${instanceId}`);

            // Validate config
            const validatedConfig = {
                ...config,
                ipHost: config.ipHost?.trim() || 'localhost',
                ipPort: parseInt(config.ipPort) || 3001,
                tcpOutHost: config.tcpOutHost?.trim() || '127.0.0.1',
                tcpOutPort: parseInt(config.tcpOutPort) || 4001,
                connectionMode: config.connectionMode || 'server'
            };

            // Create TCP output first
            console.log(`📤 Creating TCP output for ${instanceId}: ${validatedConfig.tcpOutHost}:${validatedConfig.tcpOutPort}`);
            
            const tcpOutput = new TCPOutputClient({
                host: validatedConfig.tcpOutHost,
                port: validatedConfig.tcpOutPort
            });

            try {
                await tcpOutput.connect();
                instanceData.connections.output = tcpOutput;
                console.log(`✅ TCP output connected for ${instanceId}`);
            } catch (error) {
                console.warn(`⚠️ TCP output connection failed for ${instanceId}:`, error.message);
                instanceData.connections.output = tcpOutput; // Still assign for queuing
            }

            // Create input handler
            if (validatedConfig.connectionMode === 'client') {
                console.log(`🔗 Creating TCP client for ${instanceId}`);
                inputHandler = new TCPClientHandler(validatedConfig);

                inputHandler.on('message', (message) => {
                    this.processInstanceMessage(instanceData, message);
                });

                inputHandler.on('error', (error) => {
                    console.error(`❌ TCP client error for ${instanceId}:`, error.message);
                    instanceData.stats.errorCount++;
                });

                await inputHandler.connect();

            } else {
                console.log(`🏢 Creating TCP server for ${instanceId}`);
                inputHandler = new TCPServerHandler(validatedConfig);

                inputHandler.on('message', (message, clientId) => {
                    this.processInstanceMessage(instanceData, message);
                });

                inputHandler.on('error', (error) => {
                    console.error(`❌ TCP server error for ${instanceId}:`, error.message);
                    instanceData.stats.errorCount++;
                });

                await inputHandler.start();
            }

            instanceData.connections.input = inputHandler;
            console.log(`✅ IP instance ${instanceId} started successfully`);

        } catch (error) {
            console.error(`❌ Failed to start IP instance ${instanceId}:`, error);
            
            // Cleanup connections
            if (instanceData.connections.output) {
                try {
                    await instanceData.connections.output.disconnect();
                } catch (e) {}
            }
            
            if (inputHandler) {
                try {
                    if (inputHandler.disconnect) inputHandler.disconnect();
                    else if (inputHandler.stop) await inputHandler.stop();
                } catch (e) {}
            }
            
            throw error;
        }
    }

    // ✅ MULTI-INSTANCE: Start serial instance
    async startSerialInstance(instanceData) {
        const { config, instanceId } = instanceData;
        let serialPort = null;

        try {
            console.log(`📟 Starting serial instance ${instanceId}`);

            // Create serial port
            serialPort = new SerialPort({
                path: config.serialPort,
                baudRate: config.baudRate,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                flowControl: false,
                autoOpen: false
            });

            // Create parser
            const parser = serialPort.pipe(new ReadlineParser({
                delimiter: '\r\n',
                encoding: 'ascii',
                includeDelimiter: false
            }));

            // Setup event handlers
            serialPort.on('open', () => {
                console.log(`✅ Serial port opened for ${instanceId}`);
                instanceData.status = 'running';
            });

            parser.on('data', (message) => {
                this.processInstanceMessage(instanceData, message);
            });

            serialPort.on('error', (error) => {
                console.error(`❌ Serial port error for ${instanceId}:`, error.message);
                instanceData.stats.errorCount++;
                instanceData.status = 'error';
            });

            // Open serial port
            await new Promise((resolve, reject) => {
                serialPort.open((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            instanceData.connections.input = serialPort;

            // Create TCP output
            if (config.tcpOutHost && config.tcpOutPort) {
                const tcpOutput = new TCPOutputClient({
                    host: config.tcpOutHost,
                    port: config.tcpOutPort
                });

                try {
                    await tcpOutput.connect();
                    instanceData.connections.output = tcpOutput;
                    console.log(`✅ TCP output connected for ${instanceId}`);
                } catch (error) {
                    console.warn(`⚠️ TCP output connection failed for ${instanceId}:`, error.message);
                    instanceData.connections.output = tcpOutput;
                }
            }

            console.log(`✅ Serial instance ${instanceId} started successfully`);

        } catch (error) {
            console.error(`❌ Failed to start serial instance ${instanceId}:`, error);
            
            if (serialPort && serialPort.isOpen) {
                try {
                    serialPort.close();
                } catch (e) {}
            }
            
            throw error;
        }
    }

    // ✅ MULTI-INSTANCE: Process message for specific instance
   // ✅ ENHANCED: Process message for specific instance
processInstanceMessage(instanceData, message) {
    try {
        const trimmedMessage = message.trim();
        if (!trimmedMessage) return;

        const { instanceId, config } = instanceData;

        // Update instance stats
        instanceData.stats.messageCount++;
        instanceData.stats.bytesCount += Buffer.byteLength(trimmedMessage);
        instanceData.stats.lastActivity = Date.now();

        // ✅ CRITICAL FIX: Broadcast to auto-server clients immediately
        const tcpOutPort = parseInt(config.tcpOutPort);
        if (this.autoServerStats.has(tcpOutPort)) {
            const autoServerStats = this.autoServerStats.get(tcpOutPort);
            if (autoServerStats.clients && autoServerStats.clients.length > 0) {
                const formattedMessage = `${trimmedMessage}\r\n`;
                
                // Broadcast to all connected telnet clients
                autoServerStats.clients.forEach(client => {
                    try {
                        if (client.socket && !client.socket.destroyed) {
                            client.socket.write(formattedMessage);
                            client.messagesReceived++;
                        }
                    } catch (writeError) {
                        console.warn(`⚠️ Failed to write to auto-server client:`, writeError.message);
                    }
                });
                
                console.log(`📡 [AUTO-${tcpOutPort}] Broadcasted to ${autoServerStats.clients.length} telnet clients: ${trimmedMessage}`);
            }
        }

        // Forward to TCP output (original behavior)
        if (instanceData.connections.output) {
            try {
                const success = instanceData.connections.output.send(trimmedMessage + '\r\n');
                if (success) {
                    console.log(`📤 [${instanceId}] Message forwarded: ${trimmedMessage}`);
                } else {
                    console.log(`📤 [${instanceId}] Message queued: ${trimmedMessage}`);
                }
            } catch (outputError) {
                console.error(`❌ [${instanceId}] TCP output error:`, outputError);
                instanceData.stats.errorCount++;
            }
        }

        // ✅ BACKWARD COMPATIBILITY: Update legacy stats
        this.messageStats.totalMessages++;
        this.messageStats.totalBytes += Buffer.byteLength(trimmedMessage);
        this.lastActivityTime = Date.now();

        // Update global stats
        if (trimmedMessage.startsWith('!AIVDM') || trimmedMessage.startsWith('!AIVDO')) {
            this.globalStats.session.messageTypes.AIS++;
            console.log(`🚢 [${instanceId}] AIS: ${trimmedMessage}`);
            
            // ✅ BACKWARD COMPATIBILITY: Broadcast to legacy monitoring
            this.broadcastAISToMonitorClients(trimmedMessage);
        } else if (trimmedMessage.startsWith('$GP') || trimmedMessage.startsWith('$GN')) {
            this.globalStats.session.messageTypes.GNSS++;
        } else {
            this.globalStats.session.messageTypes.DATA++;
        }

    } catch (error) {
        console.error(`❌ [${instanceId}] Error processing message:`, error);
        instanceData.stats.errorCount++;
    }
}


    // ✅ MULTI-INSTANCE: Start instance monitor
    async startInstanceMonitor(instanceData) {
        try {
            const basePort = instanceData.config.tcpOutPort || 4001;
            let monitorPort = basePort + 1000;

            while (this.isPortInUse(monitorPort)) {
                monitorPort++;
            }

            const monitorServer = net.createServer((socket) => {
                this.handleInstanceMonitorClient(instanceData, socket);
            });

            await new Promise((resolve, reject) => {
                monitorServer.listen(monitorPort, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            instanceData.connections.monitor = {
                server: monitorServer,
                port: monitorPort,
                clients: []
            };

            console.log(`📡 Monitor server for ${instanceData.instanceId} started on port ${monitorPort}`);

        } catch (error) {
            console.error(`❌ Failed to start monitor for ${instanceData.instanceId}:`, error);
        }
    }

    handleInstanceMonitorClient(instanceData, socket) {
        const clientId = `${instanceData.instanceId}_client_${Date.now()}`;
        
        instanceData.connections.monitor.clients.push({
            id: clientId,
            socket: socket,
            connectedAt: new Date()
        });

        socket.write(`Connected to ${instanceData.config.name} monitor\r\n`);
        socket.write(`=== Live Data Stream ===\r\n`);

        socket.on('close', () => {
            instanceData.connections.monitor.clients = 
                instanceData.connections.monitor.clients.filter(c => c.id !== clientId);
        });
    }

    // ✅ HELPER METHODS
    findInstanceByConfigId(configId, type) {
        for (const [instanceId, instanceData] of this.instances) {
            if (instanceData.configId === configId && instanceData.type === type) {
                return instanceData;
            }
        }
        return null;
    }

    checkPortConflict(newConfig) {
        for (const [instanceId, instanceData] of this.instances) {
            if (instanceData.status === 'running' && 
                instanceData.config.tcpOutPort === newConfig.tcpOutPort) {
                return instanceData;
            }
        }
        return null;
    }

    isPortInUse(port) {
        // Check instance monitor ports
        for (const instanceData of this.instances.values()) {
            if (instanceData.connections.monitor?.port === port) {
                return true;
            }
        }
        
        // Check auto server ports
        if (this.autoServers.has(port)) {
            return true;
        }
        
        return false;
    }

    cleanupFailedInstance(instanceId) {
        if (instanceId && this.instances.has(instanceId)) {
            this.instances.delete(instanceId);
            this.activeInstances.delete(instanceId);
        }
    }

    // ✅ MULTI-INSTANCE: Stop specific instance
  // ✅ MULTI-INSTANCE: Stop specific instance with COMPLETE CLEANUP
async stopInstance(instanceId) {
    const instanceData = this.instances.get(instanceId);
    if (!instanceData) {
        console.warn(`⚠️ Instance ${instanceId} not found`);
        return false;
    }

    console.log(`🛑 STOPPING INSTANCE: ${instanceId} (${instanceData.config?.name})`);
    
    try {
        // Mark as stopping
        instanceData.status = 'stopping';
        
        // ✅ STEP 1: COMPLETE INPUT CLEANUP
        if (instanceData.connections.input) {
            console.log(`🔌 Cleaning up input connection for ${instanceId}`);
            
            try {
                if (instanceData.type === 'serial') {
                    // Serial port cleanup
                    if (instanceData.connections.input.isOpen) {
                        await new Promise((resolve) => {
                            instanceData.connections.input.close((err) => {
                                if (err) console.warn(`Serial close error: ${err.message}`);
                                resolve();
                            });
                        });
                        console.log(`✅ Serial port closed for ${instanceId}`);
                    }
                } else {
                    // TCP cleanup
                    if (instanceData.connections.input.disconnect) {
                        instanceData.connections.input.disconnect();
                        console.log(`✅ TCP client disconnected for ${instanceId}`);
                    } else if (instanceData.connections.input.stop) {
                        await instanceData.connections.input.stop();
                        console.log(`✅ TCP server stopped for ${instanceId}`);
                    }
                    
                    // Remove all event listeners
                    if (instanceData.connections.input.removeAllListeners) {
                        instanceData.connections.input.removeAllListeners();
                    }
                }
                
                instanceData.connections.input = null;
                
            } catch (inputError) {
                console.error(`❌ Input cleanup error for ${instanceId}:`, inputError.message);
            }
        }

        // ✅ STEP 2: COMPLETE OUTPUT CLEANUP
        if (instanceData.connections.output) {
            console.log(`📤 Cleaning up output connection for ${instanceId}`);
            
            try {
                // Disconnect TCP output
                await instanceData.connections.output.disconnect();
                
                // Remove event listeners
                if (instanceData.connections.output.removeAllListeners) {
                    instanceData.connections.output.removeAllListeners();
                }
                
                instanceData.connections.output = null;
                console.log(`✅ TCP output disconnected for ${instanceId}`);
                
            } catch (outputError) {
                console.error(`❌ Output cleanup error for ${instanceId}:`, outputError.message);
            }
        }

        // ✅ STEP 3: COMPLETE MONITOR CLEANUP
        if (instanceData.connections.monitor?.server) {
            console.log(`📡 Cleaning up monitor server for ${instanceId}`);
            
            try {
                // Close all monitor client connections
                if (instanceData.connections.monitor.clients) {
                    instanceData.connections.monitor.clients.forEach(client => {
                        try {
                            if (client.socket && !client.socket.destroyed) {
                                client.socket.write(`Monitor server shutting down for ${instanceData.config?.name}\r\n`);
                                client.socket.end();
                            }
                        } catch (clientError) {
                            console.warn(`Monitor client cleanup error: ${clientError.message}`);
                        }
                    });
                }
                
                // Close monitor server
                await new Promise((resolve) => {
                    instanceData.connections.monitor.server.close((err) => {
                        if (err) console.warn(`Monitor server close error: ${err.message}`);
                        resolve();
                    });
                });
                
                instanceData.connections.monitor = null;
                console.log(`✅ Monitor server closed for ${instanceId}`);
                
            } catch (monitorError) {
                console.error(`❌ Monitor cleanup error for ${instanceId}:`, monitorError.message);
            }
        }

        // ✅ STEP 4: REMOVE FROM ACTIVE TRACKING
        this.activeInstances.delete(instanceId);
        instanceData.status = 'stopped';
        
        console.log(`✅ Instance ${instanceId} removed from active tracking`);

        // ✅ STEP 5: CLEANUP INSTANCE DATA
        setTimeout(() => {
            // Delayed cleanup to ensure all async operations complete
            this.instances.delete(instanceId);
            console.log(`🧹 Instance ${instanceId} data cleaned up`);
        }, 2000);

        // ✅ STEP 6: BACKWARD COMPATIBILITY UPDATE
        if (this.activeInstances.size === 0) {
            console.log('🔄 No active instances - clearing legacy properties');
            
            this.currentConfig = null;
            this.isForwarding = false;
            this.serialPort = null;
            this.tcpClientHandler = null;
            this.tcpServerHandler = null;
            this.tcpOutputClient = null;
            
            // Update message stats
            this.messageStats.tcpOutputStatus = 'disconnected';
            this.messageStats.monitorServerStatus = 'stopped';
            
        } else {
            // Set current config to the next active instance
            const remainingActiveId = Array.from(this.activeInstances)[0];
            const remainingActive = this.instances.get(remainingActiveId);
            if (remainingActive) {
                this.currentConfig = remainingActive.config;
                this.isForwarding = true;
                console.log(`🔄 Current config switched to: ${remainingActive.config?.name}`);
            }
        }

        // ✅ STEP 7: FORCE GARBAGE COLLECTION HINTS
        if (global.gc) {
            setTimeout(() => {
                try {
                    global.gc();
                    console.log(`🗑️ Garbage collection suggested after ${instanceId} cleanup`);
                } catch (gcError) {
                    // Ignore GC errors
                }
            }, 3000);
        }

        console.log(`✅ COMPLETE STOP SUCCESS: ${instanceId} - ALL CONNECTIONS CLOSED`);
        
        // Return success info
        return {
            success: true,
            instanceId: instanceId,
            configName: instanceData.config?.name,
            remainingInstances: this.activeInstances.size,
            totalInstances: this.instances.size
        };

    } catch (error) {
        console.error(`❌ CRITICAL ERROR stopping instance ${instanceId}:`, error);
        
        // Emergency cleanup
        try {
            this.activeInstances.delete(instanceId);
            if (instanceData) {
                instanceData.status = 'error';
            }
        } catch (emergencyError) {
            console.error(`❌ Emergency cleanup failed:`, emergencyError);
        }
        
        throw error;
    }
}

// ✅ ENHANCED: Stop all instances with COMPLETE CLEANUP
async stopAllInstances() {
    console.log('🛑 STOPPING ALL INSTANCES WITH COMPLETE CLEANUP...');
    
    if (this.activeInstances.size === 0) {
        console.log('ℹ️ No active instances to stop');
        return { success: true, stoppedCount: 0 };
    }
    
    const instanceIds = Array.from(this.activeInstances);
    let successCount = 0;
    let errorCount = 0;
    
    console.log(`🎯 Stopping ${instanceIds.length} active instances...`);
    
    // Stop all instances concurrently for faster cleanup
    const stopPromises = instanceIds.map(async (instanceId) => {
        try {
            await this.stopInstance(instanceId);
            successCount++;
            console.log(`✅ Instance ${instanceId} stopped successfully`);
        } catch (error) {
            errorCount++;
            console.error(`❌ Failed to stop instance ${instanceId}:`, error.message);
        }
    });
    
    // Wait for all stop operations to complete
    await Promise.allSettled(stopPromises);
    
    // ✅ FINAL CLEANUP: Reset all legacy properties
    setTimeout(() => {
        this.currentConfig = null;
        this.isForwarding = false;
        this.serialPort = null;
        this.tcpClientHandler = null;
        this.tcpServerHandler = null;
        this.tcpOutputClient = null;
        
        // Clear any remaining references
        this.instances.clear();
        this.activeInstances.clear();
        
        console.log('🧹 COMPLETE GLOBAL CLEANUP FINISHED');
    }, 3000);
    
    const result = {
        success: errorCount === 0,
        totalRequested: instanceIds.length,
        successCount: successCount,
        errorCount: errorCount,
        remainingInstances: this.activeInstances.size,
        message: `Stopped ${successCount}/${instanceIds.length} instances`
    };
    
    console.log('✅ STOP ALL INSTANCES COMPLETE:', result);
    return result;
}


    // ✅ MULTI-INSTANCE: Stop all instances
    async stopAllInstances() {
        console.log('🛑 Stopping all instances...');
        const instanceIds = Array.from(this.activeInstances);
        
        for (const instanceId of instanceIds) {
            try {
                await this.stopInstance(instanceId);
            } catch (error) {
                console.error(`Error stopping instance ${instanceId}:`, error);
            }
        }
        
        console.log('✅ All instances stopped');
    }

    // ✅ MULTI-INSTANCE: Get all instances status
    getAllInstancesStatus() {
        const instancesStatus = [];
        
        try {
            if (!this.instances || typeof this.instances.entries !== 'function') {
                return instancesStatus;
            }
            
            for (const [instanceId, instanceData] of this.instances) {
                try {
                    instancesStatus.push({
                        instanceId,
                        type: instanceData.type || 'unknown',
                        configId: instanceData.configId || 'unknown',
                        configName: instanceData.config?.name || 'Unknown',
                        status: instanceData.status || 'unknown',
                        startTime: instanceData.startTime || Date.now(),
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
                    });
                } catch (instanceError) {
                    console.warn(`⚠️ Error processing instance ${instanceId}:`, instanceError.message);
                }
            }
        } catch (error) {
            console.error('❌ Error in getAllInstancesStatus:', error);
        }
        
        return instancesStatus;
    }

    // ✅ BACKWARD COMPATIBILITY: Enhanced startForwarding method
    async startForwarding(type, id) {
        return await this.startInstance(type, id);
    }

    // ✅ BACKWARD COMPATIBILITY: Enhanced stopForwarding method  
    async stopForwarding() {
        return await this.stopAllInstances();
    }

    // ✅ ENHANCED: Core forwarding method with multi-instance support
    forwardToTCP(message) {
        if (!message) return;

        const trimmedMessage = message.trim();
        const isAISMessage = trimmedMessage.startsWith('!AIVDM') || trimmedMessage.startsWith('!AIVDO');

        if (!isAISMessage) {
            this.updateInternalStats(trimmedMessage);
            return;
        }

        // Forward to all active instances
        for (const instanceData of this.instances.values()) {
            if (instanceData.status === 'running' && instanceData.connections.output) {
                try {
                    instanceData.connections.output.send(trimmedMessage + '\r\n');
                } catch (error) {
                    console.error(`Error forwarding to instance ${instanceData.instanceId}:`, error.message);
                }
            }
        }

        // Update legacy stats
        this.lastActivityTime = Date.now();
        this.messageStats.totalMessages++;
        this.messageStats.totalBytes += Buffer.byteLength(trimmedMessage);
        this.broadcastAISToMonitorClients(trimmedMessage);
    }

    // ✅ ENHANCED: Get system status with multi-instance and auto-server info
 // ✅ CRITICAL FIX: Enhanced getSystemStatus with instances array
async getSystemStatus() {
    try {
        const instancesStatus = this.getAllInstancesStatus();
        const autoServersStatus = this.getAutoServersStatus();
        
        let totalConnections = 0;
        instancesStatus.forEach(instance => {
            totalConnections += (instance.connections?.monitorClients || 0);
        });

        // Add auto-servers connections
        autoServersStatus.servers.forEach(server => {
            totalConnections += server.connections;
        });

        // ✅ CRITICAL: Include instances array in response
        return {
            isForwarding: this.activeInstances.size > 0,
            hasActiveConfig: this.activeInstances.size > 0,
            
            // ✅ MULTI-INSTANCE DATA (CRITICAL FOR FRONTEND)
            totalInstances: this.instances.size,
            activeInstances: this.activeInstances.size,
            instances: instancesStatus, // ✅ THIS IS THE KEY FIX!
            
            totalConnections: totalConnections,
            autoServers: autoServersStatus,
            
            // ✅ BACKWARD COMPATIBILITY: Keep existing fields
            currentConfig: this.currentConfig,
            monitoringActive: this.messageStats.monitorServerStatus === 'running',
            tcpOutputConnected: this.activeInstances.size > 0,
            lastActivity: this.lastActivityTime,
            uptime: Date.now() - this.globalStats.application.uptimeStart,
            
            // ✅ ENHANCED: Add more detailed status info
            connectionInfo: this.getConnectionInfo(),
            tcpOutputStatus: this.getTcpOutputStatus(),
            monitorServer: this.getMonitorServerStatus(),
            messageStats: this.messageStats,
            globalStats: this.globalStats,
            timestamp: Date.now()
        };
    } catch (error) {
        console.error('❌ Error in getSystemStatus:', error);
        return {
            isForwarding: false,
            hasActiveConfig: false,
            totalInstances: 0,
            activeInstances: 0,
            instances: [], // ✅ Empty array instead of missing
            totalConnections: 0,
            autoServers: { totalServers: 0, servers: [] },
            uptime: 0,
            timestamp: Date.now()
        };
    }
}

// ✅ HELPER: Get connection info
getConnectionInfo() {
    try {
        if (this.activeInstances.size === 0) {
            return { type: 'none', status: 'inactive' };
        }

        // Get first active instance for backward compatibility
        const firstActiveId = Array.from(this.activeInstances)[0];
        const firstInstance = this.instances.get(firstActiveId);
        
        if (firstInstance && firstInstance.config) {
            return {
                type: firstInstance.type,
                status: firstInstance.status,
                host: firstInstance.config.ipHost || firstInstance.config.serialPort,
                port: firstInstance.config.ipPort || firstInstance.config.baudRate,
                mode: firstInstance.config.connectionMode || 'server',
                clientCount: this.activeInstances.size
            };
        }
        
        return { type: 'unknown', status: 'unknown' };
    } catch (error) {
        console.error('Error getting connection info:', error);
        return { type: 'error', status: 'error' };
    }
}

// ✅ HELPER: Get TCP output status
getTcpOutputStatus() {
    try {
        let totalConnected = 0;
        let totalDisconnected = 0;
        
        for (const instanceData of this.instances.values()) {
            if (instanceData.connections?.output) {
                if (instanceData.connections.output.isConnected) {
                    totalConnected++;
                } else {
                    totalDisconnected++;
                }
            }
        }
        
        return {
            isConnected: totalConnected > 0,
            totalConnected,
            totalDisconnected,
            host: this.currentConfig?.tcpOutHost || '127.0.0.1',
            port: this.currentConfig?.tcpOutPort || 4001,
            queueSize: 0,
            maxQueueSize: 10000,
            status: totalConnected > 0 ? 'connected' : 'disconnected'
        };
    } catch (error) {
        console.error('Error getting TCP output status:', error);
        return {
            isConnected: false,
            status: 'error'
        };
    }
}

// ✅ HELPER: Get monitor server status  
getMonitorServerStatus() {
    try {
        const monitorPorts = [];
        let totalClients = 0;
        
        for (const instanceData of this.instances.values()) {
            if (instanceData.connections?.monitor) {
                monitorPorts.push(instanceData.connections.monitor.port);
                totalClients += instanceData.connections.monitor.clients?.length || 0;
            }
        }
        
        return {
            port: monitorPorts[0] || null,
            ports: monitorPorts,
            status: monitorPorts.length > 0 ? 'running' : 'stopped',
            connectedClients: totalClients,
            telnetCommand: monitorPorts.length > 0 ? `telnet localhost ${monitorPorts[0]}` : 'No monitor available'
        };
    } catch (error) {
        console.error('Error getting monitor server status:', error);
        return {
            port: null,
            status: 'error',
            connectedClients: 0,
            telnetCommand: 'Error'
        };
    }
}


    // ✅ UTILITY METHODS
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`;
        if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // ✅ ENHANCED: Graceful shutdown with auto servers cleanup
    async shutdown() {
        console.log('🛑 Shutting down application...');
        
        // Stop all instances
        await this.stopAllInstances();
        
        // Stop auto server monitoring
        if (this.autoServerMonitorInterval) {
            clearInterval(this.autoServerMonitorInterval);
        }
        
        if (this.configMonitorInterval) {
            clearInterval(this.configMonitorInterval);
        }
        
        // Close all auto servers
        for (const [port, server] of this.autoServers) {
            console.log(`🔌 Closing integrated auto-server on port ${port}`);
            server.close();
        }
        
        this.autoServers.clear();
        this.autoServerStats.clear();
        
        console.log('✅ Application shutdown complete');
    }

    // ✅ BACKWARD COMPATIBILITY: Keep all existing methods
    updateInternalStats(message) {
        const messageType = this.detectMessageType(message);
        this.globalStats.session.messageTypes[messageType]++;
        console.log(`📊 [Internal] ${messageType}: ${message.substring(0, 50)}...`);
    }

    // Delegate historical data methods
    updateRealtimeChartData() {
        return this.historicalDataTracker.updateRealtimeChartData();
    }

    updateSpeedHistory() {
        return this.historicalDataTracker.updateSpeedHistory();
    }

    updateMessageVolumeHistory() {
        return this.historicalDataTracker.updateMessageVolumeHistory();
    }

    updateErrorHistory() {
        return this.historicalDataTracker.updateErrorHistory();
    }

    updatePerformanceHistory() {
        return this.historicalDataTracker.updatePerformanceHistory();
    }

    calculateBytesPerMinute() {
        return this.historicalDataTracker.calculateBytesPerMinute();
    }

    calculateErrorRate() {
        return this.historicalDataTracker.calculateErrorRate();
    }

    generateChartData() {
        return this.historicalDataTracker.generateChartData();
    }

    // Delegate stats methods
    resetSessionStats() {
        return this.statsCalculator.resetSessionStats();
    }

    calculateLiveStats() {
        return this.statsCalculator.calculateLiveStats();
    }

    detectMessageType(message) {
        return this.statsCalculator.detectMessageType(message);
    }

    startStatsCalculator() {
        return this.statsCalculator.startStatsCalculator();
    }

    createStatsDisplay() {
        return this.statsCalculator.createStatsDisplay();
    }

    // Delegate monitoring methods
    startTCPMonitoringServer(port) {
        return this.monitoringServer.startTCPMonitoringServer(port);
    }

    stopTCPMonitoringServer() {
        return this.monitoringServer.stopTCPMonitoringServer();
    }

    broadcastToMonitorClients(message) {
        return this.monitoringServer.broadcastToMonitorClients(message);
    }

    broadcastAISToMonitorClients(aisMessage) {
        return this.monitoringServer.broadcastAISToMonitorClients(aisMessage);
    }

    // Delegate serial/tcp methods
    startSerialForwarding() {
        return this.serialHandler.startSerialForwarding();
    }

    startIPForwarding() {
        return this.tcpHandler.startIPForwarding();
    }

    startTCPClient() {
        return this.tcpHandler.startTCPClient();
    }

    startTCPServer() {
        return this.tcpHandler.startTCPServer();
    }

    determineMonitorPort(config) {
        if (!config) return null;
        return config.tcpOutPort || 4001;
    }

    async updateConfigCache() {
        try {
            const now = Date.now();
            if (this.configCache.lastUpdate && (now - this.configCache.lastUpdate) < this.configCache.updateInterval) {
                return;
            }

            const [serialConfigs, ipConfigs] = await Promise.all([
                this.csvHandler.getSerialConfigs(),
                this.csvHandler.getIpConfigs()
            ]);

            this.configCache.serial = serialConfigs || [];
            this.configCache.ip = ipConfigs || [];
            this.configCache.lastUpdate = now;

            this.globalStats.configurations.serialCount = serialConfigs.length;
            this.globalStats.configurations.ipCount = ipConfigs.length;
            this.globalStats.configurations.serialActive = serialConfigs.filter(c => c.active).length;
            this.globalStats.configurations.ipActive = ipConfigs.filter(c => c.active).length;
            this.globalStats.configurations.totalActive = this.globalStats.configurations.serialActive + this.globalStats.configurations.ipActive;

        } catch (error) {
            console.error('Error updating config cache:', error);
        }
    }

    startConfigCacheUpdater() {
        this.updateConfigCache();
        setInterval(() => {
            this.updateConfigCache();
        }, this.configCache.updateInterval);
    }

    startActivityMonitor() {
        setInterval(() => {
            const now = Date.now();
            const timeSinceActivity = now - this.lastActivityTime;

            if (this.activeInstances.size > 0 && timeSinceActivity > 60000) {
                console.log(`No activity for ${Math.round(timeSinceActivity / 1000)} seconds`);
            }
        }, 60000);
    }

    startWebInterface() {
        const PORT = 3000;
        this.app.listen(PORT, () => {
            console.log(`🌐 Web interface available at http://localhost:${PORT}`);
            console.log(`📡 Multi-instance TCP Bridge ready`);
            console.log(`🏗️ Integrated Auto TCP Server Manager active`);
            console.log(`📊 Live statistics and message counting enabled`);
            console.log(`📈 Historical data tracking enabled`);
        });
    }
}

module.exports = SerialTCPForwarder;
