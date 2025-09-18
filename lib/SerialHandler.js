const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

class SerialHandler {
    constructor(forwarder) {
        this.forwarder = forwarder;
    }

    // ✅ LEGACY SUPPORT: Keep existing method for backward compatibility
    async startSerialForwarding() {
        return new Promise((resolve, reject) => {
            try {
                console.log(`🔌 LEGACY: Opening serial port: ${this.forwarder.currentConfig.serialPort} @ ${this.forwarder.currentConfig.baudRate} baud`);
                
                this.forwarder.serialPort = new SerialPort({
                    path: this.forwarder.currentConfig.serialPort,
                    baudRate: this.forwarder.currentConfig.baudRate,
                    dataBits: 8,
                    parity: 'none',
                    stopBits: 1,
                    flowControl: false,
                    autoOpen: false
                });

                const parser = this.forwarder.serialPort.pipe(new ReadlineParser({
                    delimiter: '\r\n',
                    encoding: 'ascii',
                    includeDelimiter: false
                }));

                this.forwarder.serialPort.on('open', () => {
                    this.forwarder.isForwarding = true;
                    this.forwarder.lastActivityTime = Date.now();
                    this.forwarder.resetSessionStats();
                    
                    console.log(`✅ LEGACY: Serial port opened successfully`);
                    resolve();
                });

                // ✅ LEGACY: Route to processInstanceMessage if multi-instance active
                parser.on('data', (rawLine) => {
                    try {
                        const message = rawLine.toString('ascii').trim();
                        if (message.length === 0) return;
                        
                        console.log(`📡 LEGACY RX: "${message}" (${message.length} chars)`);
                        
                        // ✅ CRITICAL: Check if we should route to multi-instance
                        const legacyInstance = this.findLegacySerialInstance();
                        if (legacyInstance) {
                            console.log(`🔄 ROUTING to multi-instance: ${legacyInstance.instanceId}`);
                            this.forwarder.processInstanceMessage(legacyInstance, message);
                        } else {
                            // Legacy processing
                            this.processNMEAMessage(message);
                            this.forwarder.forwardToTCP(message + '\r\n');
                        }
                        
                        this.forwarder.lastActivityTime = Date.now();
                        
                    } catch (error) {
                        console.error(`❌ LEGACY data processing error:`, error.message);
                        this.forwarder.globalStats.session.errorCount++;
                    }
                });

                this.forwarder.serialPort.on('error', (error) => {
                    this.forwarder.isForwarding = false;
                    this.forwarder.globalStats.session.errorCount++;
                    console.error('❌ LEGACY serial port error:', error.message);
                    reject(error);
                });

                this.forwarder.serialPort.on('close', () => {
                    this.forwarder.isForwarding = false;
                    console.log('🔌 LEGACY serial port closed');
                });

                this.forwarder.serialPort.open((err) => {
                    if (err) {
                        console.error('❌ LEGACY failed to open serial port:', err.message);
                        reject(err);
                    }
                });

            } catch (error) {
                this.forwarder.isForwarding = false;
                this.forwarder.globalStats.session.errorCount++;
                console.error('❌ LEGACY startSerialForwarding error:', error.message);
                reject(error);
            }
        });
    }

    // ✅ NEW: Multi-instance serial setup
    async setupInstanceSerial(instanceData) {
        return new Promise((resolve, reject) => {
            try {
                const { config, instanceId } = instanceData;
                
                console.log(`🔌 INSTANCE: Setting up serial for ${instanceId}: ${config.serialPort} @ ${config.baudRate} baud`);
                
                // Create serial port for this instance
                const serialPort = new SerialPort({
                    path: config.serialPort,
                    baudRate: parseInt(config.baudRate) || 9600,
                    dataBits: 8,
                    parity: 'none',
                    stopBits: 1,
                    flowControl: false,
                    autoOpen: false
                });

                // Create parser for this instance
                const parser = serialPort.pipe(new ReadlineParser({
                    delimiter: '\r\n',
                    encoding: 'ascii',
                    includeDelimiter: false
                }));

                // Setup event handlers
                serialPort.on('open', () => {
                    console.log(`✅ INSTANCE: Serial port opened for ${instanceId}`);
                    instanceData.status = 'running';
                    instanceData.connections.input = serialPort;
                    resolve(serialPort);
                });

                // ✅ CRITICAL: Route data to processInstanceMessage
                parser.on('data', (rawLine) => {
                    try {
                        const message = rawLine.toString('ascii').trim();
                        if (message.length === 0) return;
                        
                        console.log(`📡 INSTANCE [${instanceId}] RX: "${message}" (${message.length} chars)`);
                        
                        // ✅ Validate NMEA checksum
                        if (this.validateNMEAChecksum(message)) {
                            console.log(`✅ INSTANCE [${instanceId}] Valid NMEA: ${message}`);
                        } else {
                            console.log(`⚠️ INSTANCE [${instanceId}] Invalid checksum: ${message}`);
                        }
                        
                        // ✅ CRITICAL: Route to multi-instance message processor
                        this.forwarder.processInstanceMessage(instanceData, message);
                        
                    } catch (error) {
                        console.error(`❌ INSTANCE [${instanceId}] data processing error:`, error.message);
                        instanceData.stats.errorCount++;
                    }
                });

                serialPort.on('error', (error) => {
                    console.error(`❌ INSTANCE [${instanceId}] serial error:`, error.message);
                    instanceData.stats.errorCount++;
                    instanceData.status = 'error';
                    reject(error);
                });

                serialPort.on('close', () => {
                    console.log(`🔌 INSTANCE [${instanceId}] serial port closed`);
                    instanceData.status = 'stopped';
                    instanceData.connections.input = null;
                });

                // Open the port
                serialPort.open((err) => {
                    if (err) {
                        console.error(`❌ INSTANCE [${instanceId}] failed to open serial port:`, err.message);
                        reject(err);
                    }
                });

            } catch (error) {
                console.error(`❌ INSTANCE [${instanceId}] setup error:`, error.message);
                instanceData.stats.errorCount++;
                reject(error);
            }
        });
    }

    // ✅ HELPER: Find legacy serial instance for routing
    findLegacySerialInstance() {
        if (!this.forwarder.instances) return null;
        
        for (const [instanceId, instanceData] of this.forwarder.instances) {
            if (instanceData.type === 'serial' && 
                instanceData.status === 'running' &&
                instanceData.connections.input === this.forwarder.serialPort) {
                return instanceData;
            }
        }
        return null;
    }

    // ✅ ENHANCED: NMEA checksum validation
    validateNMEAChecksum(sentence) {
        try {
            if (!sentence.includes('*')) {
                return true; // No checksum present
            }
            
            const parts = sentence.split('*');
            if (parts.length !== 2) return false;
            
            const sentenceData = parts[0].substring(1); // Remove leading ! or $
            const receivedChecksum = parts[1].substring(0, 2);
            
            let calculatedChecksum = 0;
            for (let i = 0; i < sentenceData.length; i++) {
                calculatedChecksum ^= sentenceData.charCodeAt(i);
            }
            
            const expectedChecksum = calculatedChecksum.toString(16).toUpperCase().padStart(2, '0');
            const isValid = receivedChecksum.toUpperCase() === expectedChecksum;
            
            if (!isValid) {
                console.warn(`⚠️ Checksum mismatch: expected ${expectedChecksum}, got ${receivedChecksum}`);
            }
            
            return isValid;
            
        } catch (error) {
            console.warn('⚠️ Checksum validation error:', error.message);
            return true;
        }
    }

    // ✅ ENHANCED: NMEA message processing with detailed logging
    processNMEAMessage(message) {
        try {
            // Detect and log message type
            if (message.startsWith('!AIVDM') || message.startsWith('!AIVDO')) {
                console.log(`🚢 AIS Message: ${message}`);
                this.forwarder.globalStats.session.messageTypes.AIS++;
                this.parseAISMessage(message);
                
            } else if (message.startsWith('$GP') || message.startsWith('$GN') || 
                      message.startsWith('$GL') || message.startsWith('$GB')) {
                console.log(`📍 GNSS Message: ${message}`);
                this.forwarder.globalStats.session.messageTypes.GNSS++;
                this.parseGNSSMessage(message);
                
            } else if (message.startsWith('$') || message.startsWith('!')) {
                console.log(`📡 NMEA Message: ${message}`);
                this.forwarder.globalStats.session.messageTypes.SERIAL++;
                
            } else if (message.length > 0) {
                console.log(`📨 Serial Data: ${message}`);
                this.forwarder.globalStats.session.messageTypes.DATA++;
            }

            // Update global statistics
            this.updateMessageStatistics(message);

        } catch (error) {
            console.error('⚠️ NMEA processing error:', error);
            this.forwarder.globalStats.session.errorCount++;
        }
    }

    // ✅ ENHANCED: Update message statistics
    updateMessageStatistics(message) {
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
    }

    // ✅ ENHANCED: AIS message parsing with more details
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
                
                console.log(`🚢 AIS Details:`, {
                    type: messageType,
                    fragments: `${fragmentNumber}/${totalFragments}`,
                    msgId: sequentialMessageId || 'none',
                    channel: channel,
                    payloadLength: payload.length,
                    payload: payload.substring(0, 20) + (payload.length > 20 ? '...' : '')
                });

                // ✅ Multi-fragment message handling
                if (totalFragments > 1) {
                    console.log(`📦 Multi-fragment AIS: Part ${fragmentNumber}/${totalFragments}${sequentialMessageId ? ` (ID: ${sequentialMessageId})` : ''}`);
                }

                // ✅ Additional AIS analytics
                this.analyzeAISPayload(payload, messageType);
            }
        } catch (error) {
            console.warn('⚠️ AIS parsing error:', error.message);
        }
    }

    // ✅ NEW: GNSS message parsing
    parseGNSSMessage(nmeaSentence) {
        try {
            const parts = nmeaSentence.split(',');
            const messageType = parts[0];
            
            console.log(`📍 GNSS Details:`, {
                type: messageType,
                fields: parts.length,
                data: parts.slice(1, 4).join(',') + (parts.length > 4 ? '...' : '')
            });

            // Specific GNSS message types
            if (messageType === '$GPRMC' || messageType === '$GNRMC') {
                console.log(`🧭 RMC: Recommended Minimum Course data`);
            } else if (messageType === '$GPGGA' || messageType === '$GNGGA') {
                console.log(`📍 GGA: Global Positioning System Fix data`);
            } else if (messageType === '$GPVTG' || messageType === '$GNVTG') {
                console.log(`🎯 VTG: Track Made Good and Ground Speed`);
            }

        } catch (error) {
            console.warn('⚠️ GNSS parsing error:', error.message);
        }
    }

    // ✅ NEW: Analyze AIS payload for message type
    analyzeAISPayload(payload, messageType) {
        try {
            if (payload.length === 0) return;
            
            // Decode first 6 bits to get AIS message type
            const firstChar = payload.charAt(0);
            const sixBitValue = this.decodeAISChar(firstChar);
            const aisMessageType = (sixBitValue >> 0) & 0x3F; // Get message type from first 6 bits
            
            console.log(`🔍 AIS Payload Analysis:`, {
                nmeaType: messageType,
                aisMessageType: aisMessageType,
                payloadFirstChar: firstChar,
                sixBitValue: sixBitValue,
                description: this.getAISMessageDescription(aisMessageType)
            });

        } catch (error) {
            console.warn('⚠️ AIS payload analysis error:', error.message);
        }
    }

    // ✅ HELPER: Decode AIS character to 6-bit value
    decodeAISChar(char) {
        const charCode = char.charCodeAt(0);
        if (charCode >= 48 && charCode <= 87) {
            return charCode - 48;
        } else if (charCode >= 96 && charCode <= 119) {
            return charCode - 56;
        }
        return 0;
    }

    // ✅ HELPER: Get AIS message type description
    getAISMessageDescription(messageType) {
        const descriptions = {
            1: 'Position Report (Class A)',
            2: 'Position Report (Class A, Assigned schedule)',
            3: 'Position Report (Class A, Response to interrogation)',
            4: 'Base Station Report',
            5: 'Static and Voyage Related Data',
            6: 'Binary Addressed Message',
            7: 'Binary Acknowledge',
            8: 'Binary Broadcast Message',
            9: 'Standard SAR Aircraft Position Report',
            10: 'UTC and Date Inquiry',
            11: 'UTC and Date Response',
            12: 'Addressed Safety Related Message',
            13: 'Safety Related Acknowledgment',
            14: 'Safety Related Broadcast Message',
            15: 'Interrogation',
            16: 'Assignment Mode Command',
            17: 'DGNSS Binary Broadcast Message',
            18: 'Standard Class B CS Position Report',
            19: 'Extended Class B Equipment Position Report',
            20: 'Data Link Management',
            21: 'Aid-to-Navigation Report',
            22: 'Channel Management',
            23: 'Group Assignment Command',
            24: 'Static Data Report',
            25: 'Single Slot Binary Message',
            26: 'Multiple Slot Binary Message',
            27: 'Position Report For Long-Range Applications'
        };
        
        return descriptions[messageType] || `Unknown Type ${messageType}`;
    }

    // ✅ DIAGNOSTIC: Get serial port status
    getSerialPortStatus() {
        const status = {
            legacy: {
                exists: !!this.forwarder.serialPort,
                isOpen: this.forwarder.serialPort?.isOpen || false,
                path: this.forwarder.serialPort?.path || null,
                baudRate: this.forwarder.serialPort?.baudRate || null
            },
            instances: []
        };

        // Check instances
        if (this.forwarder.instances) {
            this.forwarder.instances.forEach((instanceData, instanceId) => {
                if (instanceData.type === 'serial') {
                    status.instances.push({
                        instanceId,
                        configName: instanceData.config?.name,
                        port: instanceData.config?.serialPort,
                        baudRate: instanceData.config?.baudRate,
                        status: instanceData.status,
                        isOpen: instanceData.connections?.input?.isOpen || false
                    });
                }
            });
        }

        return status;
    }

    // ✅ CLEANUP: Close serial connections
    async closeSerialConnections() {
        const promises = [];

        // Close legacy serial port
        if (this.forwarder.serialPort && this.forwarder.serialPort.isOpen) {
            console.log('🔌 Closing legacy serial port...');
            promises.push(new Promise((resolve) => {
                this.forwarder.serialPort.close((err) => {
                    if (err) console.warn('⚠️ Legacy serial close error:', err.message);
                    resolve();
                });
            }));
        }

        // Close instance serial ports
        if (this.forwarder.instances) {
            this.forwarder.instances.forEach((instanceData, instanceId) => {
                if (instanceData.type === 'serial' && 
                    instanceData.connections?.input?.isOpen) {
                    console.log(`🔌 Closing serial port for instance ${instanceId}...`);
                    promises.push(new Promise((resolve) => {
                        instanceData.connections.input.close((err) => {
                            if (err) console.warn(`⚠️ Instance ${instanceId} serial close error:`, err.message);
                            resolve();
                        });
                    }));
                }
            });
        }

        await Promise.all(promises);
        console.log('✅ All serial connections closed');
    }
}

module.exports = SerialHandler;
