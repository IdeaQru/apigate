const net = require('net');
const EventEmitter = require('events');

class TCPClientHandler extends EventEmitter {
    constructor(config) {
        super();

        // ✅ FIX: Validate and normalize config
        if (!config) {
            throw new Error('TCP Client config is required');
        }

        // ✅ FIX: Handle different config formats and ensure proper types
        this.config = {
            host: config.ipHost || config.host || 'localhost',
            port: parseInt(config.ipPort || config.port) || 3001
        };

        // ✅ FIX: Validate required parameters
        if (!this.config.host || this.config.host.trim() === '') {
            throw new Error('TCP Client host is required and cannot be empty');
        }

        if (!this.config.port || isNaN(this.config.port) || this.config.port < 1 || this.config.port > 65535) {
            throw new Error(`TCP Client port must be a valid number (1-65535), got: ${config.ipPort || config.port}`);
        }

        console.log(`🔗 TCP Client initialized:`, {
            host: this.config.host,
            port: this.config.port,
            type: typeof this.config.port
        });

        this.client = null;
        this.isConnected = false;
        this.reconnectInterval = 5000; // 5 seconds
        this.maxReconnectAttempts = 10;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.connectionTimeout = 10000; // 10 seconds
    }

    async connect() {
        return new Promise((resolve, reject) => {
            try {
                console.log(`🔗 TCP Client connecting to ${this.config.host}:${this.config.port}...`);

                // ✅ FIX: Ensure proper connection options
                const connectionOptions = {
                    host: this.config.host,
                    port: this.config.port,
                    timeout: this.connectionTimeout
                };

                console.log('🔗 Connection options:', connectionOptions);

                // ✅ FIX: Create connection with validated options
                this.client = net.createConnection(connectionOptions);

                // Set up timeout
                const timeoutHandle = setTimeout(() => {
                    console.error(`🔗 TCP Client connection timeout to ${this.config.host}:${this.config.port}`);
                    if (this.client) {
                        this.client.destroy();
                    }
                    reject(new Error(`Connection timeout to ${this.config.host}:${this.config.port}`));
                }, this.connectionTimeout);

                this.client.on('connect', () => {
                    clearTimeout(timeoutHandle);
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    console.log(`✅ TCP Client connected to ${this.config.host}:${this.config.port}`);
                    this.emit('connected');
                    resolve();
                });

                this.client.on('data', (data) => {
                    try {
                        const dataStr = data.toString('ascii');
                        console.log(`🔗 TCP Client received ${dataStr.length} bytes:`, dataStr.substring(0, 100) + '...');

                        // ✅ FIX: Handle different line endings
                        const messages = dataStr.split(/\r\n|\r|\n/);

                        messages.forEach(message => {
                            const trimmed = message.trim();
                            if (trimmed.length > 0) {
                                console.log(`📨 TCP Client emitting message: "${trimmed}"`);
                                this.emit('message', trimmed);
                            }
                        });
                    } catch (error) {
                        console.error('🔗 TCP Client data processing error:', error);
                        this.emit('error', error);
                    }
                });


                this.client.on('close', () => {
                    clearTimeout(timeoutHandle);
                    this.isConnected = false;
                    console.log(`🔗 TCP Client connection closed: ${this.config.host}:${this.config.port}`);
                    this.emit('disconnected');
                    this.attemptReconnect();
                });

                this.client.on('timeout', () => {
                    clearTimeout(timeoutHandle);
                    console.error(`🔗 TCP Client connection timeout: ${this.config.host}:${this.config.port}`);
                    this.client.destroy();
                });

                this.client.on('error', (error) => {
                    clearTimeout(timeoutHandle);
                    console.error(`❌ TCP Client error: ${this.config.host}:${this.config.port}`, error.message);

                    this.emit('error', error);

                    if (!this.isConnected) {
                        reject(new Error(`Failed to connect to ${this.config.host}:${this.config.port}: ${error.message}`));
                    }
                });

            } catch (error) {
                console.error(`❌ TCP Client setup error:`, error);
                reject(error);
            }
        });
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 TCP Client reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.emit('reconnecting', this.reconnectAttempts);

            this.reconnectTimer = setTimeout(() => {
                this.connect().catch(error => {
                    console.error('❌ TCP Client reconnect failed:', error.message);
                });
            }, this.reconnectInterval);
        } else {
            console.error('❌ TCP Client: Maximum reconnect attempts reached');
            this.emit('maxReconnectsReached');
        }
    }

    disconnect() {
        console.log('🔗 TCP Client disconnecting...');

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.client) {
            this.client.destroy();
            this.client = null;
            this.isConnected = false;
        }
    }

    send(data) {
        if (this.isConnected && this.client) {
            try {
                console.log(`📤 TCP Output sending: "${data.substring(0, 50)}..."`);
                this.client.write(data);
                return true;
            } catch (error) {
                console.error('❌ TCP Output write error:', error.message);
                this.isConnected = false;
                return false;
            }
        } else {
            // Queue message if not connected
            if (this.queue.length < this.maxQueueSize) {
                this.queue.push(data);
                console.log(`📦 TCP Output: Message queued (${this.queue.length}/${this.maxQueueSize}): "${data.substring(0, 30)}..."`);
                return true;
            } else {
                console.warn('⚠️ TCP Output: Queue full, dropping message');
                return false;
            }
        }
    }


    getStatus() {
        return {
            isConnected: this.isConnected,
            host: this.config.host,
            port: this.config.port,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts
        };
    }
}

module.exports = TCPClientHandler;
