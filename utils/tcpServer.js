const net = require('net');
const EventEmitter = require('events');

class TCPServerHandler extends EventEmitter {
    constructor(config) {
        super();
        
        // ✅ FIX: Validate and normalize config
        if (!config) {
            throw new Error('TCP Server config is required');
        }

        // ✅ FIX: Handle different config formats and ensure proper types
        this.config = {
            host: config.ipHost || config.host || '0.0.0.0',
            port: parseInt(config.ipPort || config.port) || 3001
        };

        // ✅ FIX: Validate required parameters
        if (!this.config.host || this.config.host.trim() === '') {
            this.config.host = '0.0.0.0'; // Default to listen on all interfaces
        }

        if (!this.config.port || isNaN(this.config.port) || this.config.port < 1 || this.config.port > 65535) {
            throw new Error(`TCP Server port must be a valid number (1-65535), got: ${config.ipPort || config.port}`);
        }

        console.log(`🏢 TCP Server initialized:`, {
            host: this.config.host,
            port: this.config.port,
            type: typeof this.config.port
        });

        this.server = null;
        this.clients = new Map();
        this.isListening = false;
        this.clientIdCounter = 0;
    }

    async start() {
        return new Promise((resolve, reject) => {
            try {
                console.log(`🏢 TCP Server starting on ${this.config.host}:${this.config.port}...`);

                this.server = net.createServer((socket) => {
                    this.handleClientConnection(socket);
                });

                // ✅ FIX: Enhanced error handling
                this.server.on('listening', () => {
                    this.isListening = true;
                    const address = this.server.address();
                    console.log(`✅ TCP Server listening on ${address.address}:${address.port}`);
                    this.emit('listening');
                    resolve();
                });

                this.server.on('error', (error) => {
                    console.error(`❌ TCP Server error:`, error.message);
                    
                    if (error.code === 'EADDRINUSE') {
                        const errorMessage = `Port ${this.config.port} is already in use`;
                        console.error(`❌ ${errorMessage}`);
                        this.emit('error', new Error(errorMessage));
                        reject(new Error(errorMessage));
                    } else if (error.code === 'EACCES') {
                        const errorMessage = `Permission denied to bind port ${this.config.port}`;
                        console.error(`❌ ${errorMessage}`);
                        this.emit('error', new Error(errorMessage));
                        reject(new Error(errorMessage));
                    } else {
                        this.emit('error', error);
                        reject(error);
                    }
                });

                this.server.on('close', () => {
                    this.isListening = false;
                    console.log('🏢 TCP Server closed');
                    this.emit('closed');
                });

                // ✅ FIX: Start listening with proper options
                this.server.listen({
                    port: this.config.port,
                    host: this.config.host
                });

            } catch (error) {
                console.error(`❌ TCP Server setup error:`, error);
                reject(error);
            }
        });
    }

    handleClientConnection(socket) {
        const clientId = `client_${++this.clientIdCounter}`;
        const clientInfo = {
            id: clientId,
            socket: socket,
            connectedAt: new Date(),
            remoteAddress: socket.remoteAddress,
            remotePort: socket.remotePort
        };

        console.log(`🏢 TCP Server: Client connected ${clientId} from ${socket.remoteAddress}:${socket.remotePort}`);
        
        this.clients.set(clientId, clientInfo);
        this.emit('clientConnected', clientInfo);

        // Set socket encoding and options
        socket.setEncoding('ascii');
        socket.setKeepAlive(true, 30000); // Keep alive for 30 seconds

        socket.on('data', (data) => {
            try {
                const dataStr = data.toString('ascii');
                const messages = dataStr.split('\r\n');
                messages.forEach(message => {
                    if (message.trim().length > 0) {
                        this.emit('message', message.trim(), clientId, socket);
                    }
                });
            } catch (error) {
                console.error(`❌ TCP Server data processing error from ${clientId}:`, error);
            }
        });

        socket.on('close', () => {
            console.log(`🏢 TCP Server: Client disconnected ${clientId}`);
            this.clients.delete(clientId);
            this.emit('clientDisconnected', clientId);
        });

        socket.on('error', (error) => {
            console.error(`❌ TCP Server: Client error ${clientId}:`, error.message);
            this.clients.delete(clientId);
            this.emit('clientError', clientId, error);
        });

        socket.on('timeout', () => {
            console.log(`⏰ TCP Server: Client timeout ${clientId}`);
            socket.destroy();
        });
    }

    broadcast(data) {
        let successCount = 0;
        for (const [clientId, client] of this.clients) {
            try {
                client.socket.write(data);
                successCount++;
            } catch (error) {
                console.error(`❌ TCP Server: Broadcast error to ${clientId}:`, error.message);
                this.clients.delete(clientId);
            }
        }
        return successCount;
    }

    sendToClient(clientId, data) {
        const client = this.clients.get(clientId);
        if (client) {
            try {
                client.socket.write(data);
                return true;
            } catch (error) {
                console.error(`❌ TCP Server: Send error to ${clientId}:`, error.message);
                this.clients.delete(clientId);
                return false;
            }
        }
        return false;
    }

    async stop() {
        if (!this.server) return;

        console.log('🏢 TCP Server stopping...');

        // Close all client connections
        for (const [clientId, client] of this.clients) {
            try {
                client.socket.end();
            } catch (error) {
                console.error(`❌ Error closing client ${clientId}:`, error);
            }
        }
        this.clients.clear();

        // Close server
        return new Promise((resolve) => {
            this.server.close(() => {
                this.isListening = false;
                console.log('✅ TCP Server stopped');
                resolve();
            });
        });
    }

    getConnectedClientCount() {
        return this.clients.size;
    }

    getClientList() {
        return Array.from(this.clients.values()).map(client => ({
            id: client.id,
            remoteAddress: client.remoteAddress,
            remotePort: client.remotePort,
            connectedAt: client.connectedAt
        }));
    }

    getStatus() {
        return {
            isListening: this.isListening,
            host: this.config.host,
            port: this.config.port,
            clientCount: this.clients.size,
            clients: this.getClientList()
        };
    }
}

module.exports = TCPServerHandler;
