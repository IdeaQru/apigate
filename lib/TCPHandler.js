const TCPClientHandler = require('../utils/tcpClient');
const TCPServerHandler = require('../utils/tcpServer');
const TCPOutputClient = require('../utils/tcpOutputClient');

class TCPHandler {
    constructor(forwarder) {
        this.forwarder = forwarder;
    }

    async startIPForwarding() {
        try {
            console.log(`🌐 Starting IP forwarding: ${this.forwarder.currentConfig.ipHost}:${this.forwarder.currentConfig.ipPort}`);
            console.log(`🔧 Connection mode: ${this.forwarder.currentConfig.connectionMode}`);
            console.log(`📤 TCP Output: ${this.forwarder.currentConfig.tcpOutHost}:${this.forwarder.currentConfig.tcpOutPort}`);

            // Validate configuration
            if (!this.forwarder.currentConfig.ipHost || !this.forwarder.currentConfig.ipPort) {
                throw new Error('Invalid IP configuration: Missing host or port');
            }

            // Start TCP output client first
            if (this.forwarder.currentConfig.tcpOutHost && this.forwarder.currentConfig.tcpOutPort) {
                this.forwarder.tcpOutputClient = new TCPOutputClient({
                    host: this.forwarder.currentConfig.tcpOutHost,
                    port: this.forwarder.currentConfig.tcpOutPort
                });

                try {
                    await this.forwarder.tcpOutputClient.connect();
                    console.log(`✅ TCP Output client connected to ${this.forwarder.currentConfig.tcpOutHost}:${this.forwarder.currentConfig.tcpOutPort}`);
                    this.forwarder.messageStats.tcpOutputStatus = 'connected';
                } catch (error) {
                    console.warn(`⚠️ TCP Output connection failed: ${error.message}`);
                    this.forwarder.messageStats.tcpOutputStatus = 'failed';
                    // Continue anyway - queuing will handle this
                }
            }

            // Start appropriate connection mode
            if (this.forwarder.currentConfig.connectionMode === 'client') {
                await this.startTCPClient();
            } else {
                await this.startTCPServer();
            }

            this.forwarder.isForwarding = true;
            console.log(`✅ IP forwarding started successfully`);

        } catch (error) {
            console.error('❌ IP forwarding error:', error);
            this.forwarder.globalStats.session.errorCount++;
            throw error;
        }
    }

    async startTCPClient() {
        try {
            console.log(`🔗 Starting TCP Client: ${this.forwarder.currentConfig.ipHost}:${this.forwarder.currentConfig.ipPort}`);

            this.forwarder.tcpClientHandler = new TCPClientHandler({
                ipHost: this.forwarder.currentConfig.ipHost,
                ipPort: this.forwarder.currentConfig.ipPort
            });

            // Setup event listeners
            this.forwarder.tcpClientHandler.on('connected', () => {
                console.log('🌐 TCP Client connected successfully');
                this.forwarder.lastActivityTime = Date.now();
            });

            this.forwarder.tcpClientHandler.on('disconnected', () => {
                console.log('🌐 TCP Client disconnected');
                this.forwarder.globalStats.session.reconnectCount++;
            });

            this.forwarder.tcpClientHandler.on('reconnecting', (attempt) => {
                console.log(`🔄 TCP Client reconnecting... (attempt ${attempt})`);
            });

            this.forwarder.tcpClientHandler.on('message', (message) => {
                console.log(`📡 TCP Client RX: ${message}`);
                this.processReceivedMessage(message);
            });

            this.forwarder.tcpClientHandler.on('error', (error) => {
                console.error('❌ TCP Client error:', error.message);
                this.forwarder.globalStats.session.errorCount++;
            });

            // Connect to remote server
            await this.forwarder.tcpClientHandler.connect();

        } catch (error) {
            console.error('❌ TCP Client start error:', error);
            this.forwarder.globalStats.session.errorCount++;
            throw error;
        }
    }

    async startTCPServer() {
        try {
            console.log(`🏢 Starting TCP Server: ${this.forwarder.currentConfig.ipHost}:${this.forwarder.currentConfig.ipPort}`);

            this.forwarder.tcpServerHandler = new TCPServerHandler({
                ipHost: this.forwarder.currentConfig.ipHost,
                ipPort: this.forwarder.currentConfig.ipPort
            });

            // Setup event listeners
            this.forwarder.tcpServerHandler.on('listening', () => {
                console.log(`🌐 TCP Server listening on ${this.forwarder.currentConfig.ipHost}:${this.forwarder.currentConfig.ipPort}`);
                this.forwarder.lastActivityTime = Date.now();
            });

            this.forwarder.tcpServerHandler.on('clientConnected', (clientInfo) => {
                console.log(`🌐 TCP Server: Client connected from ${clientInfo.remoteAddress}:${clientInfo.remotePort}`);
                this.forwarder.lastActivityTime = Date.now();
            });

            this.forwarder.tcpServerHandler.on('clientDisconnected', (clientId) => {
                console.log(`🌐 TCP Server: Client ${clientId} disconnected`);
            });

            this.forwarder.tcpServerHandler.on('message', (message, clientId, socket) => {
                console.log(`📡 TCP Server RX from ${clientId}: ${message}`);
                this.processReceivedMessage(message, clientId, socket);
            });

            this.forwarder.tcpServerHandler.on('error', (error) => {
                console.error('❌ TCP Server error:', error.message);
                this.forwarder.globalStats.session.errorCount++;
            });

            // Start listening
            await this.forwarder.tcpServerHandler.start();

        } catch (error) {
            console.error('❌ TCP Server start error:', error);
            this.forwarder.globalStats.session.errorCount++;
            throw error;
        }
    }

    processReceivedMessage(message, clientId = null, socket = null) {
        try {
            const trimmedMessage = message.trim();
            if (trimmedMessage.length === 0) return;

            // Update activity timestamp
            this.forwarder.lastActivityTime = Date.now();

            // Log message details
            console.log(`📨 Processing message: "${trimmedMessage}" (${trimmedMessage.length} chars)`);
            if (clientId) {
                console.log(`📨 From client: ${clientId}`);
            }

            // Process message for statistics and type detection
            this.updateMessageStatistics(trimmedMessage);

            // Validate message format if needed
            if (this.isNMEAMessage(trimmedMessage)) {
                console.log(`✅ Valid NMEA message: ${trimmedMessage}`);
                this.processNMEAMessage(trimmedMessage);
            } else {
                console.log(`📊 Raw data message: ${trimmedMessage.substring(0, 50)}...`);
                this.forwarder.globalStats.session.messageTypes.DATA++;
            }

            // Forward to TCP output
            this.forwarder.forwardToTCP(trimmedMessage);

        } catch (error) {
            console.error('❌ Message processing error:', error);
            this.forwarder.globalStats.session.errorCount++;
        }
    }

    updateMessageStatistics(message) {
        // Update global statistics
        this.forwarder.globalStats.session.messageCount++;
        this.forwarder.globalStats.session.bytesCount += Buffer.byteLength(message, 'ascii');
        this.forwarder.globalStats.session.uniqueMessages.add(message);

        // Update last activity
        this.forwarder.globalStats.application.lastActivity = new Date();

        // Store for real-time analytics
        const now = Date.now();
        this.forwarder.globalStats.session.lastMinuteMessages.push(now);

        // Clean old entries (keep only last minute)
        this.forwarder.globalStats.session.lastMinuteMessages = 
            this.forwarder.globalStats.session.lastMinuteMessages.filter(time => now - time <= 60000);

        // Update message stats
        this.forwarder.messageStats.totalMessages++;
        this.forwarder.messageStats.totalBytes += Buffer.byteLength(message, 'ascii');
        this.forwarder.messageStats.lastMessage = {
            content: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
            timestamp: new Date().toISOString(),
            size: Buffer.byteLength(message, 'ascii')
        };
    }

    isNMEAMessage(message) {
        // Check if message looks like NMEA
        return message.startsWith('!') || message.startsWith('$') || 
               message.startsWith('!AIVDM') || message.startsWith('!AIVDO');
    }

    processNMEAMessage(message) {
        try {
            // Detect message type
            if (message.startsWith('!AIVDM') || message.startsWith('!AIVDO')) {
                console.log(`🚢 AIS Message via IP: ${message}`);
                this.forwarder.globalStats.session.messageTypes.AIS++;
                
                // Parse AIS payload untuk analytics
                this.parseAISMessage(message);
                
            } else if (message.startsWith('$GP') || message.startsWith('$GN') || 
                      message.startsWith('$GL') || message.startsWith('$GB')) {
                console.log(`📍 GNSS Message via IP: ${message}`);
                this.forwarder.globalStats.session.messageTypes.GNSS++;
                
            } else if (message.startsWith('!') || message.startsWith('$')) {
                console.log(`📡 NMEA Message via IP: ${message}`);
                this.forwarder.globalStats.session.messageTypes.SERIAL++;
            }

        } catch (error) {
            console.error('⚠️ NMEA processing error:', error);
            this.forwarder.globalStats.session.errorCount++;
        }
    }

    parseAISMessage(nmeaSentence) {
        try {
            const parts = nmeaSentence.split(',');
            if (parts.length >= 6) {
                const messageType = parts[0]; // !AIVDM or !AIVDO
                const totalFragments = parseInt(parts[1]);
                const fragmentNumber = parseInt(parts[2]);
                const sequentialMessageId = parts[3];
                const channel = parts[4];
                const payload = parts[5];
                
                console.log(`🚢 AIS Details via IP:`, {
                    type: messageType,
                    fragments: `${fragmentNumber}/${totalFragments}`,
                    channel: channel,
                    payloadLength: payload.length,
                    payload: payload.substring(0, 20) + '...'
                });

                // Additional AIS analytics could go here
                // e.g., vessel tracking, collision detection, etc.
            }
        } catch (error) {
            console.warn('⚠️ AIS parsing error:', error.message);
        }
    }

    // Utility methods
    getConnectionStatus() {
        const status = {
            isActive: this.forwarder.isForwarding,
            connectionMode: this.forwarder.currentConfig?.connectionMode || 'unknown',
            tcpClient: null,
            tcpServer: null,
            tcpOutput: null
        };

        if (this.forwarder.tcpClientHandler) {
            status.tcpClient = {
                isConnected: this.forwarder.tcpClientHandler.isConnected,
                host: this.forwarder.tcpClientHandler.config?.ipHost,
                port: this.forwarder.tcpClientHandler.config?.ipPort,
                reconnectAttempts: this.forwarder.tcpClientHandler.reconnectAttempts || 0
            };
        }

        if (this.forwarder.tcpServerHandler) {
            status.tcpServer = {
                isListening: this.forwarder.tcpServerHandler.isListening,
                host: this.forwarder.tcpServerHandler.config?.ipHost,
                port: this.forwarder.tcpServerHandler.config?.ipPort,
                connectedClients: this.forwarder.tcpServerHandler.getConnectedClientCount()
            };
        }

        if (this.forwarder.tcpOutputClient) {
            status.tcpOutput = {
                isConnected: this.forwarder.tcpOutputClient.isConnected,
                host: this.forwarder.tcpOutputClient.config?.host,
                port: this.forwarder.tcpOutputClient.config?.port,
                queueSize: this.forwarder.tcpOutputClient.getQueueSize()
            };
        }

        return status;
    }

    async stopAll() {
        console.log('🛑 Stopping all TCP handlers...');

        const stopPromises = [];

        // Stop TCP client
        if (this.forwarder.tcpClientHandler) {
            try {
                this.forwarder.tcpClientHandler.disconnect();
                this.forwarder.tcpClientHandler.removeAllListeners();
                this.forwarder.tcpClientHandler = null;
                console.log('✅ TCP client stopped');
            } catch (error) {
                console.error('❌ Error stopping TCP client:', error);
            }
        }

        // Stop TCP server
        if (this.forwarder.tcpServerHandler) {
            try {
                stopPromises.push(this.forwarder.tcpServerHandler.stop());
                this.forwarder.tcpServerHandler.removeAllListeners();
                this.forwarder.tcpServerHandler = null;
                console.log('✅ TCP server stopped');
            } catch (error) {
                console.error('❌ Error stopping TCP server:', error);
            }
        }

        // Stop TCP output client
        if (this.forwarder.tcpOutputClient) {
            try {
                await this.forwarder.tcpOutputClient.disconnect();
                this.forwarder.tcpOutputClient.removeAllListeners();
                this.forwarder.tcpOutputClient = null;
                console.log('✅ TCP output client stopped');
                this.forwarder.messageStats.tcpOutputStatus = 'disconnected';
            } catch (error) {
                console.error('❌ Error stopping TCP output client:', error);
            }
        }

        await Promise.all(stopPromises);
        console.log('✅ All TCP handlers stopped');
    }
}

module.exports = TCPHandler;
