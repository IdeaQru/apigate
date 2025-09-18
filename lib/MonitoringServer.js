const net = require('net');

class MonitoringServer {
    constructor(forwarder) {
        this.forwarder = forwarder;
    }

    async startTCPMonitoringServer(port) {
        try {
            // Stop existing server if running
            await this.stopTCPMonitoringServer();
            
            console.log(`📡 Starting TCP monitoring server on port ${port}...`);

            this.forwarder.tcpDataServer = net.createServer((socket) => {
                this.handleMonitoringClient(socket);
            });

            // Handle server errors with port retry logic
            this.forwarder.tcpDataServer.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.error(`❌ Monitoring port ${port} in use! Trying ${port + 1}...`);
                    setTimeout(() => {
                        this.startTCPMonitoringServer(port + 1);
                    }, 1000);
                } else {
                    console.error('📡 Monitoring server error:', error);
                }
            });

            // Start listening
            return new Promise((resolve) => {
                this.forwarder.tcpDataServer.listen(port, () => {
                    this.forwarder.tcpDataPort = port;
                    this.forwarder.messageStats.monitorServerStatus = 'running';
                    this.forwarder.messageStats.monitorPort = port;
                    
                    console.log(`📡 TCP monitoring server listening on port ${port}`);
                    console.log(`📡 Connect with: telnet localhost ${port}`);
                    resolve();
                });
            });
            
        } catch (error) {
            console.error('❌ Failed to start monitoring server:', error);
            this.forwarder.globalStats.session.errorCount++;
            throw error;
        }
    }

    handleMonitoringClient(socket) {
        const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
        console.log(`📡 Monitor client connected: ${clientId}`);

        const client = {
            socket: socket,
            id: clientId,
            connectedAt: new Date()
        };

        this.forwarder.tcpDataClients.push(client);

        // Send welcome message
        this.sendWelcomeMessage(socket);

        // Send recent messages
        this.sendRecentMessages(socket);

        // Handle client events
        socket.on('close', () => {
            console.log(`📡 Monitor client disconnected: ${clientId}`);
            this.forwarder.tcpDataClients = this.forwarder.tcpDataClients.filter(c => c.id !== clientId);
        });

        socket.on('error', (error) => {
            console.error(`📡 Monitor client error ${clientId}:`, error);
            this.forwarder.tcpDataClients = this.forwarder.tcpDataClients.filter(c => c.id !== clientId);
        });
    }

    sendWelcomeMessage(socket) {
        const welcomeMsg = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                      🚢 AIS DATA MONITOR - CLEAN OUTPUT                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ 📡 Monitor Port: ${this.forwarder.tcpDataPort.toString().padEnd(50)} ║
║ ⏰ Connected at: ${new Date().toLocaleString().padEnd(49)} ║
║ 🔄 Status: AIS FILTERING ACTIVE                                             ║
╚═══════════════════════════════════════════════════════════════════════════════╝

┌─ AIS LIVE STREAM ──────────────────────────────────────────────────────────────┐
│ Format: [Count] Time AIS_Message                                              │
│ Filter: Only !AIVDM and !AIVDO messages are displayed                        │
└─────────────────────────────────────────────────────────────────────────────────┘

`;

        socket.write(welcomeMsg);
    }

    sendRecentMessages(socket) {
        if (this.forwarder.dataBuffer.length > 0) {
            socket.write('\n┌─ RECENT MESSAGES (LAST 5) ─────────────────────────────────────────────────────┐\n');
            
            this.forwarder.dataBuffer.slice(-5).forEach(msg => {
                const countStr = (msg.messageNumber || 0).toString().padStart(4, '0');
                socket.write(`│ [${countStr}] ${msg.timestamp} ${msg.data.substring(0, 65).padEnd(65)} │\n`);
            });
            
            socket.write('└─────────────────────────────────────────────────────────────────────────────────┘\n\n');
        }
    }

    // ✅ CLEAN OUTPUT: Broadcast hanya AIS ke monitoring clients
    broadcastAISToMonitorClients(aisMessage) {
        if (this.forwarder.tcpDataClients.length === 0) return;

        // Update AIS statistics
        this.forwarder.globalStats.session.messageCount++;
        this.forwarder.globalStats.session.bytesCount += Buffer.byteLength(aisMessage, 'ascii');
        this.forwarder.globalStats.session.lastMinuteMessages.push(Date.now());
        this.forwarder.globalStats.session.messageTypes.AIS++;

        const timestamp = new Date().toLocaleTimeString();
        const countStr = this.forwarder.globalStats.session.messageTypes.AIS.toString().padStart(4, '0');
        
        // ✅ FORMAT CLEAN: Hanya tampilkan info penting
        const formattedMessage = `[${countStr}] ${timestamp} ${aisMessage}\r\n`;

        // Save to buffer
        this.forwarder.dataBuffer.push({
            data: aisMessage,
            timestamp: timestamp,
            receivedAt: new Date(),
            messageNumber: this.forwarder.globalStats.session.messageTypes.AIS,
            type: 'AIS',
            length: Buffer.byteLength(aisMessage, 'ascii')
        });

        // Keep only last 100 AIS messages
        if (this.forwarder.dataBuffer.length > 100) {
            this.forwarder.dataBuffer = this.forwarder.dataBuffer.slice(-100);
        }

        // Broadcast ke semua clients
        this.forwarder.tcpDataClients.forEach(client => {
            try {
                client.socket.write(formattedMessage);
            } catch (error) {
                console.error(`📡 [Monitor] Error writing to client ${client.id}:`, error.message);
            }
        });

        console.log(`🚢 [${countStr}] AIS broadcasted to ${this.forwarder.tcpDataClients.length} clients`);
    }

    broadcastToMonitorClients(message) {
        if (!message || this.forwarder.tcpDataClients.length === 0) return;

        const trimmedMessage = message.trim();
        
        // ✅ Hanya broadcast pesan AIS
        if (!trimmedMessage.startsWith('!AIVDM') && !trimmedMessage.startsWith('!AIVDO')) {
            return; // Skip non-AIS messages
        }

        // Delegate to AIS-specific broadcaster
        this.broadcastAISToMonitorClients(trimmedMessage);
    }

    async stopTCPMonitoringServer() {
        if (!this.forwarder.tcpDataServer) return;

        try {
            console.log('📡 Stopping TCP monitoring server...');

            // Send final message to clients
            const finalStats = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                            📊 SESSION ENDED                                  ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ Session Duration: ${this.formatSessionDuration()}                                           ║
║ Total Messages: ${this.forwarder.globalStats.session.messageCount.toString().padStart(8)}                                             ║
║ AIS Messages: ${this.forwarder.globalStats.session.messageTypes.AIS.toString().padStart(10)}                                             ║
║ Peak Rate: ${this.forwarder.globalStats.session.peakRate.toString().padStart(13)} msg/min                                     ║
║ Average Rate: ${this.forwarder.globalStats.session.averageRate.toString().padStart(10)} msg/min                                     ║
╚═══════════════════════════════════════════════════════════════════════════════╝

📡 Monitor session ended. Thank you for using AIS Bridge! 🚀

`;

            this.forwarder.tcpDataClients.forEach(client => {
                try {
                    client.socket.write(finalStats);
                    setTimeout(() => client.socket.end(), 1000);
                } catch (error) {
                    console.error('Error closing client:', error);
                }
            });

            // Clear clients after delay
            setTimeout(() => {
                this.forwarder.tcpDataClients = [];
            }, 2000);

            // Close server
            return new Promise((resolve) => {
                this.forwarder.tcpDataServer.close(() => {
                    console.log('📡 TCP monitoring server stopped');
                    this.forwarder.tcpDataServer = null;
                    this.forwarder.tcpDataPort = null;
                    this.forwarder.messageStats.monitorServerStatus = 'stopped';
                    this.forwarder.messageStats.monitorPort = null;
                    resolve();
                });
            });
            
        } catch (error) {
            console.error('❌ Error stopping monitoring server:', error);
            throw error;
        }
    }

    formatSessionDuration() {
        if (!this.forwarder.globalStats.session.startTime) return 'Unknown';
        
        const duration = Date.now() - this.forwarder.globalStats.session.startTime.getTime();
        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        
        return `${hours}h ${minutes}m ${seconds}s`;
    }

    getMonitoringStatus() {
        return {
            isRunning: !!this.forwarder.tcpDataServer,
            port: this.forwarder.tcpDataPort,
            connectedClients: this.forwarder.tcpDataClients.length,
            totalMessages: this.forwarder.dataBuffer.length,
            recentMessages: this.forwarder.dataBuffer.slice(-5),
            telnetCommand: this.forwarder.tcpDataPort ? 
                `telnet localhost ${this.forwarder.tcpDataPort}` : 'No active monitoring server'
        };
    }
}

module.exports = MonitoringServer;
