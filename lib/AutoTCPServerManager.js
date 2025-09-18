// lib/AutoTCPServerManager.js
const net = require('net');
const path = require('path');

class AutoTCPServerManager {
    constructor() {
        this.servers = new Map(); // port -> server instance
        this.stats = new Map(); // port -> stats
        this.isEnabled = true;
        this.portRange = { min: 4001, max: 8000 }; // Range port yang bisa di-serve
        this.monitorInterval = null;
        this.csvHandler = null; // Will be injected
        
        console.log('🏗️ AutoTCPServerManager initialized');
    }

    // ✅ Inject dependencies
    injectDependencies(csvHandler) {
        this.csvHandler = csvHandler;
    }

    // ✅ Start auto server management
    async start() {
        try {
            console.log('🚀 Starting Auto TCP Server Manager...');
            
            // Start with current configs
            await this.scanAndCreateServers();
            
            // Monitor for config changes
            this.startConfigMonitoring();
            
            // Start stats monitoring
            this.startStatsMonitoring();
            
            console.log('✅ Auto TCP Server Manager started successfully');
            
        } catch (error) {
            console.error('❌ Failed to start Auto TCP Server Manager:', error);
        }
    }

    // ✅ Scan configurations and create servers
    async scanAndCreateServers() {
        try {
            if (!this.csvHandler) {
                console.warn('⚠️ No CSV handler available, skipping auto-server creation');
                return;
            }

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
                if (!this.servers.has(port)) {
                    await this.createServer(port);
                }
            }

            // Remove servers for ports no longer needed
            const currentPorts = new Set(this.servers.keys());
            for (const port of currentPorts) {
                if (!requiredPorts.has(port)) {
                    console.log(`🛑 Removing server for unused port ${port}`);
                    await this.removeServer(port);
                }
            }

        } catch (error) {
            console.error('❌ Error scanning and creating servers:', error);
        }
    }

    // ✅ Create server for specific port
    async createServer(port) {
        try {
            if (this.servers.has(port)) {
                console.log(`⚠️ Server on port ${port} already exists`);
                return;
            }

            console.log(`🏗️ Creating auto-server on port ${port}...`);

            const server = net.createServer((socket) => {
                this.handleConnection(port, socket);
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
            this.servers.set(port, server);
            this.stats.set(port, {
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
            console.error(`❌ Failed to create server on port ${port}:`, error);
        }
    }

    // ✅ Remove server for specific port
    async removeServer(port) {
        try {
            const server = this.servers.get(port);
            if (server) {
                server.close(() => {
                    console.log(`🔌 Auto-server on port ${port} closed`);
                });
                this.servers.delete(port);
                this.stats.delete(port);
            }
        } catch (error) {
            console.error(`❌ Error removing server on port ${port}:`, error);
        }
    }

    // ✅ Handle client connections
    handleConnection(port, socket) {
        const stats = this.stats.get(port);
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

    // ✅ Start configuration monitoring
    startConfigMonitoring() {
        this.configMonitorInterval = setInterval(async () => {
            try {
                await this.scanAndCreateServers();
            } catch (error) {
                console.warn('⚠️ Config monitoring error:', error);
            }
        }, 10000); // Check every 10 seconds
    }

    // ✅ Start stats monitoring
    startStatsMonitoring() {
        this.monitorInterval = setInterval(() => {
            this.showStats();
        }, 30000); // Every 30 seconds
    }

    // ✅ Show server statistics
    showStats() {
        if (this.servers.size === 0) return;

        console.log('\n' + '='.repeat(80));
        console.log('📊 AUTO TCP SERVERS STATISTICS');
        console.log('='.repeat(80));
        
        for (const [port, stats] of this.stats) {
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
        
        console.log(`🎯 Total Auto-Servers: ${this.servers.size}`);
        console.log('='.repeat(80));
    }

    // ✅ Get all servers status
    getServersStatus() {
        const serversStatus = [];
        
        for (const [port, stats] of this.stats) {
            serversStatus.push({
                port: port,
                isListening: this.servers.has(port),
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
            totalServers: this.servers.size,
            servers: serversStatus,
            isEnabled: this.isEnabled
        };
    }

    // ✅ Manual server management
    async addServerForPort(port) {
        if (port >= this.portRange.min && port <= this.portRange.max) {
            await this.createServer(port);
            return true;
        }
        return false;
    }

    async removeServerForPort(port) {
        await this.removeServer(port);
        return true;
    }

    // ✅ Utility methods
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

    // ✅ Graceful shutdown
    async shutdown() {
        console.log('\n🛑 Shutting down Auto TCP Server Manager...');
        
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }
        
        if (this.configMonitorInterval) {
            clearInterval(this.configMonitorInterval);
        }
        
        // Close all servers
        for (const [port, server] of this.servers) {
            console.log(`🔌 Closing auto-server on port ${port}`);
            server.close();
        }
        
        this.servers.clear();
        this.stats.clear();
        
        console.log('✅ All auto-servers stopped');
    }
}

module.exports = AutoTCPServerManager;
