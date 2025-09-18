const net = require('net');

class TCPOutputClient {
    constructor(config) {
        // ✅ FIX: Validate and normalize config
        if (!config) {
            throw new Error('TCP Output Client config is required');
        }

        this.config = {
            host: config.host || config.tcpOutHost || 'localhost',
            port: parseInt(config.port || config.tcpOutPort) || 4001
        };

        // ✅ FIX: Validate required parameters
        if (!this.config.host || this.config.host.trim() === '') {
            throw new Error('TCP Output Client host is required and cannot be empty');
        }

        if (!this.config.port || isNaN(this.config.port) || this.config.port < 1 || this.config.port > 65535) {
            throw new Error(`TCP Output Client port must be a valid number (1-65535), got: ${config.port || config.tcpOutPort}`);
        }

        console.log(`📤 TCP Output Client initialized:`, {
            host: this.config.host,
            port: this.config.port,
            type: typeof this.config.port
        });

        this.client = null;
        this.isConnected = false;
        this.queue = [];
        this.maxQueueSize = 10000; // ✅ INCREASED: 10x bigger queue
        this.reconnectInterval = 3000; // 3 seconds
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 999; // ✅ UNLIMITED: Keep trying forever
        this.reconnectTimer = null;
        this.connectionTimeout = 5000; // 5 seconds
        this.queueCleanupInterval = null;
        
        // ✅ NEW: Start queue cleanup
        this.startQueueCleanup();
    }

    // ✅ NEW: Queue cleanup to prevent memory leaks
    startQueueCleanup() {
        this.queueCleanupInterval = setInterval(() => {
            if (this.queue.length > this.maxQueueSize) {
                const dropped = this.queue.length - this.maxQueueSize;
                this.queue = this.queue.slice(-this.maxQueueSize); // Keep only latest messages
                console.log(`🧹 TCP Output: Dropped ${dropped} old messages, keeping latest ${this.maxQueueSize}`);
            }
        }, 10000); // Check every 10 seconds
    }

    async connect() {
        return new Promise((resolve, reject) => {
            try {
                console.log(`📤 TCP Output connecting to ${this.config.host}:${this.config.port}...`);

                // ✅ FIX: Reset connection state
                this.isConnected = false;
                if (this.client) {
                    this.client.destroy();
                    this.client = null;
                }

                const connectionOptions = {
                    host: this.config.host,
                    port: this.config.port
                };

                console.log('📤 TCP Output connection options:', connectionOptions);

                this.client = net.createConnection(connectionOptions);

                // ✅ SHORTER TIMEOUT: Fail fast and queue
                const timeoutHandle = setTimeout(() => {
                    console.warn(`📤 TCP Output connection timeout to ${this.config.host}:${this.config.port} - will queue messages`);
                    if (this.client) {
                        this.client.destroy();
                    }
                    this.isConnected = false;
                    this.attemptReconnect();
                    resolve(); // ✅ RESOLVE anyway - allow queuing
                }, this.connectionTimeout);

                this.client.on('connect', () => {
                    clearTimeout(timeoutHandle);
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    console.log(`✅ TCP Output connected successfully to ${this.config.host}:${this.config.port}`);
                    
                    // Send queued messages
                    this.flushQueue();
                    resolve();
                });

                this.client.on('close', () => {
                    clearTimeout(timeoutHandle);
                    this.isConnected = false;
                    console.log(`📤 TCP Output connection closed: ${this.config.host}:${this.config.port}`);
                    this.attemptReconnect();
                });

                this.client.on('error', (error) => {
                    clearTimeout(timeoutHandle);
                    this.isConnected = false;
                    console.warn(`⚠️ TCP Output connection error: ${this.config.host}:${this.config.port}`, error.message);
                    
                    // ✅ ALWAYS RESOLVE - allow queuing
                    this.attemptReconnect();
                    resolve();
                });

            } catch (error) {
                console.error(`❌ TCP Output setup error:`, error);
                // ✅ ALWAYS RESOLVE - allow queuing
                this.isConnected = false;
                resolve();
            }
        });
    }

    send(data) {
        if (this.isConnected && this.client) {
            try {
                this.client.write(data);
                return true;
            } catch (error) {
                console.error('❌ TCP Output write error:', error.message);
                this.isConnected = false;
                return false;
            }
        } else {
            // ✅ SMART QUEUING: Drop oldest messages if queue is full
            if (this.queue.length >= this.maxQueueSize) {
                const dropped = this.queue.shift(); // Remove oldest
                console.log(`📦 TCP Output: Queue full, dropped oldest message: "${dropped.substring(0, 30)}..."`);
            }
            
            this.queue.push(data);
            
            // ✅ LESS VERBOSE: Only log occasionally
            if (this.queue.length % 100 === 0) {
                console.log(`📦 TCP Output: Message queued (${this.queue.length}/${this.maxQueueSize}) - attempting reconnect...`);
            }
            
            return true;
        }
    }

    flushQueue() {
        if (this.queue.length > 0 && this.isConnected) {
            console.log(`📤 TCP Output: Flushing ${this.queue.length} queued messages`);
            let flushedCount = 0;
            
            while (this.queue.length > 0 && this.isConnected) {
                const data = this.queue.shift();
                try {
                    this.client.write(data);
                    flushedCount++;
                } catch (error) {
                    console.error('❌ TCP Output: Error flushing queue:', error.message);
                    // Put message back at front of queue
                    this.queue.unshift(data);
                    this.isConnected = false;
                    break;
                }
            }
            
            if (flushedCount > 0) {
                console.log(`✅ TCP Output: Successfully flushed ${flushedCount} messages`);
            }
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            
            // ✅ LESS VERBOSE: Only log every 10 attempts
            if (this.reconnectAttempts % 10 === 1) {
                console.log(`🔄 TCP Output: Reconnecting... (attempt ${this.reconnectAttempts}) - ${this.queue.length} messages queued`);
            }
            
            this.reconnectTimer = setTimeout(() => {
                this.connect().catch(error => {
                    // Silently continue - already handled in connect()
                });
            }, this.reconnectInterval);
        }
    }

    async disconnect() {
        console.log('📤 TCP Output disconnecting...');
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.queueCleanupInterval) {
            clearInterval(this.queueCleanupInterval);
            this.queueCleanupInterval = null;
        }
        
        if (this.client) {
            this.client.destroy();
            this.client = null;
            this.isConnected = false;
        }
    }

    getQueueSize() {
        return this.queue.length;
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            host: this.config.host,
            port: this.config.port,
            queueSize: this.queue.length,
            maxQueueSize: this.maxQueueSize,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts
        };
    }

    // ✅ NEW: Clear queue manually
    clearQueue() {
        const cleared = this.queue.length;
        this.queue = [];
        console.log(`🧹 TCP Output: Manually cleared ${cleared} queued messages`);
        return cleared;
    }

    // ✅ NEW: Get queue info
    getQueueInfo() {
        return {
            size: this.queue.length,
            maxSize: this.maxQueueSize,
            utilization: Math.round((this.queue.length / this.maxQueueSize) * 100),
            oldestMessage: this.queue[0]?.substring(0, 50) + '...' || null,
            newestMessage: this.queue[this.queue.length - 1]?.substring(0, 50) + '...' || null
        };
    }
}

module.exports = TCPOutputClient;
