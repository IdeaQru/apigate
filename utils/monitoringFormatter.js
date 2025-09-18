class MonitoringFormatter {
    constructor() {
        this.sessionStats = {
            startTime: null,
            messageCount: 0,
            bytesCount: 0,
            messagesPerMinute: 0,
            lastMinuteMessages: [],
            uniqueMessages: new Set(),
            messageTypes: {
                AIS: 0,
                GNSS: 0,
                SERIAL: 0,
                DATA: 0
            }
        };
    }

    // Reset session statistics
    resetSession() {
        this.sessionStats = {
            startTime: new Date(),
            messageCount: 0,
            bytesCount: 0,
            messagesPerMinute: 0,
            lastMinuteMessages: [],
            uniqueMessages: new Set(),
            messageTypes: {
                AIS: 0,
                GNSS: 0,
                SERIAL: 0,
                DATA: 0
            }
        };
    }

    // Get session statistics
    getSessionStats() {
        return { ...this.sessionStats };
    }

    // Get message count
    getMessageCount() {
        return this.sessionStats.messageCount;
    }

    // Calculate messages per minute
    calculateMessagesPerMinute() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        
        this.sessionStats.lastMinuteMessages = this.sessionStats.lastMinuteMessages.filter(
            timestamp => timestamp > oneMinuteAgo
        );
        
        this.sessionStats.messagesPerMinute = this.sessionStats.lastMinuteMessages.length;
    }

    // Detect message type
    detectMessageType(message) {
        if (message.startsWith('!AI')) {
            return 'AIS';
        } else if (message.startsWith('$GP') || message.startsWith('$GN') || message.startsWith('$GL')) {
            return 'GNSS';
        } else if (/^[A-Z0-9_]+[:=]/.test(message)) {
            return 'SERIAL';
        } else {
            return 'DATA';
        }
    }

    // Extract message info based on type
    extractMessageInfo(message, type) {
        let info = '';
        
        switch (type) {
            case 'AIS':
                const aisParts = message.split(',');
                if (aisParts.length >= 5) {
                    const channel = aisParts[4] || '?';
                    const msgType = aisParts[0] ? aisParts[0].substring(1) : '?';
                    info = ` [${msgType}:${channel}]`;
                }
                break;
                
            case 'GNSS':
                const gnssParts = message.split(',');
                if (gnssParts[0]) {
                    const msgType = gnssParts[0].substring(1);
                    const time = gnssParts[1] ? gnssParts[1].substring(0, 6) : '';
                    info = ` [${msgType}${time ? ':' + time : ''}]`;
                }
                break;
                
            case 'SERIAL':
                const match = message.match(/^([A-Z0-9_]+)[:=]/);
                if (match) {
                    info = ` [${match[1]}]`;
                }
                break;
                
            default:
                // Try to detect JSON or key-value pairs
                if (message.includes('=') && message.includes(',')) {
                    const pairs = message.split(',').length;
                    info = ` [${pairs}fields]`;
                }
                break;
        }
        
        return info;
    }

    // Process incoming message
    processMessage(message) {
        const trimmedMessage = message.trim();
        if (!trimmedMessage) return null;

        // Update statistics
        this.sessionStats.messageCount++;
        this.sessionStats.bytesCount += Buffer.byteLength(trimmedMessage, 'utf8');
        this.sessionStats.lastMinuteMessages.push(Date.now());
        this.sessionStats.uniqueMessages.add(trimmedMessage);

        // Detect message type
        const type = this.detectMessageType(trimmedMessage);
        this.sessionStats.messageTypes[type]++;

        // Extract additional info
        const info = this.extractMessageInfo(trimmedMessage, type);

        return {
            original: trimmedMessage,
            timestamp: new Date().toLocaleTimeString(),
            count: this.sessionStats.messageCount,
            length: Buffer.byteLength(trimmedMessage, 'utf8'),
            type: type,
            info: info
        };
    }

    // Format output line for telnet display
    formatOutputLine(formatted) {
        const countStr = formatted.count.toString().padStart(4, '0');
        const typeStr = formatted.type.padEnd(6);
        const lengthStr = `${formatted.length}B`.padEnd(5);
        
        // Truncate long messages for display
        let displayMessage = formatted.original;
        const maxLength = 80;
        if (displayMessage.length > maxLength) {
            displayMessage = displayMessage.substring(0, maxLength - 3) + '...';
        }

        return `[${countStr}] [${formatted.timestamp}] [${typeStr}]${formatted.info} ${displayMessage} [${lengthStr}]\n`;
    }

    // Create welcome header
    createWelcomeHeader(port, config) {
        const startTime = new Date().toLocaleString();
        const configInfo = config ? `
┌─ BRIDGE CONFIGURATION ─────────────────────────────────────────────────────┐
│ Name: ${config.name.padEnd(67)} │
│ Type: ${(config.serialPort ? 'Serial Bridge' : 'Network Bridge').padEnd(67)} │
│ Source: ${(config.serialPort || `${config.ipHost}:${config.ipPort}`).padEnd(65)} │
│ TCP Out: ${`${config.tcpOutHost}:${config.tcpOutPort}`.padEnd(64)} │
└─────────────────────────────────────────────────────────────────────────────┘` : `
┌─ BRIDGE CONFIGURATION ─────────────────────────────────────────────────────┐
│ Status: No active bridge configuration                                    │
└─────────────────────────────────────────────────────────────────────────────┘`;

        return `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       🚀 TCP BRIDGE DATA MONITOR                           ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ 📡 Monitor Port: ${port.toString().padEnd(50)} ║
║ ⏰ Session Start: ${startTime.padEnd(49)} ║
║ 🔄 Status: LISTENING & READY                                              ║
╚═══════════════════════════════════════════════════════════════════════════════╝
${configInfo}

┌─ LIVE DATA STREAM ─────────────────────────────────────────────────────────────┐
│ Format: [Count] [Time] [Type] Message [Length]                               │
│ Types: AIS=Maritime, GNSS=GPS, SERIAL=Sensor, DATA=Generic                   │
│ Info: Channel/MessageType details in brackets                                │
└─────────────────────────────────────────────────────────────────────────────────┘

`;
    }

    // Format recent messages
    formatRecentMessages(recentBuffer) {
        if (!recentBuffer.length) return '';

        let output = '\n┌─ RECENT MESSAGES (LAST 5) ─────────────────────────────────────────────────────┐\n';
        
        recentBuffer.forEach((msg, index) => {
            const formatted = {
                count: msg.originalCount || index + 1,
                timestamp: msg.timestamp,
                type: msg.type || 'DATA',
                info: this.extractMessageInfo(msg.data, msg.type || 'DATA'),
                original: msg.data,
                length: msg.length || Buffer.byteLength(msg.data, 'utf8')
            };

            const countStr = formatted.count.toString().padStart(4, '0');
            const typeStr = formatted.type.padEnd(6);
            const lengthStr = `${formatted.length}B`.padEnd(5);
            
            let displayMessage = formatted.original;
            if (displayMessage.length > 50) {
                displayMessage = displayMessage.substring(0, 47) + '...';
            }

            output += `│ [${countStr}] [${formatted.timestamp}] [${typeStr}]${formatted.info} ${displayMessage.padEnd(50)} [${lengthStr}] │\n`;
        });
        
        output += '└─────────────────────────────────────────────────────────────────────────────────┘\n\n';
        return output;
    }

    // Create statistics update
    createStatsUpdate() {
        const uptime = this.sessionStats.startTime ? 
            Math.floor((Date.now() - this.sessionStats.startTime.getTime()) / 1000) : 0;
        
        const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`;
        this.calculateMessagesPerMinute();

        // Calculate percentages
        const total = this.sessionStats.messageCount;
        const aisPercent = total > 0 ? Math.round((this.sessionStats.messageTypes.AIS / total) * 100) : 0;
        const gnssPercent = total > 0 ? Math.round((this.sessionStats.messageTypes.GNSS / total) * 100) : 0;
        const serialPercent = total > 0 ? Math.round((this.sessionStats.messageTypes.SERIAL / total) * 100) : 0;
        const dataPercent = total > 0 ? Math.round((this.sessionStats.messageTypes.DATA / total) * 100) : 0;

        return `
┌─ SESSION STATISTICS ───────────────────────────────────────────────────────────┐
│ Messages: ${this.sessionStats.messageCount.toString().padEnd(10)} │ Bytes: ${this.sessionStats.bytesCount.toString().padEnd(12)} │ Rate: ${this.sessionStats.messagesPerMinute.toString().padEnd(8)}/min    │
│ Unique: ${this.sessionStats.uniqueMessages.size.toString().padEnd(12)} │ Uptime: ${uptimeFormatted.padEnd(20)} │                      │
├─ MESSAGE BREAKDOWN ────────────────────────────────────────────────────────────┤
│ AIS: ${this.sessionStats.messageTypes.AIS.toString().padEnd(6)} (${aisPercent.toString().padStart(2)}%) │ GNSS: ${this.sessionStats.messageTypes.GNSS.toString().padEnd(6)} (${gnssPercent.toString().padStart(2)}%) │ SERIAL: ${this.sessionStats.messageTypes.SERIAL.toString().padEnd(6)} (${serialPercent.toString().padStart(2)}%) │ DATA: ${this.sessionStats.messageTypes.DATA.toString().padEnd(6)} (${dataPercent.toString().padStart(2)}%) │
└─────────────────────────────────────────────────────────────────────────────────┘

`;
    }

    // Create session summary
    createSessionSummary() {
        const duration = this.sessionStats.startTime ? 
            Math.floor((Date.now() - this.sessionStats.startTime.getTime()) / 1000) : 0;

        const avgRate = duration > 0 ? Math.round(this.sessionStats.messageCount / (duration / 60)) : 0;
        const avgBytes = this.sessionStats.messageCount > 0 ? Math.round(this.sessionStats.bytesCount / this.sessionStats.messageCount) : 0;

        return `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                            📊 SESSION SUMMARY                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ Total Messages: ${this.sessionStats.messageCount.toString().padEnd(54)} ║
║ Total Bytes: ${this.sessionStats.bytesCount.toString().padEnd(57)} ║
║ Unique Messages: ${this.sessionStats.uniqueMessages.size.toString().padEnd(51)} ║
║ Session Duration: ${duration.toString().padEnd(49)} seconds ║
║ Average Rate: ${avgRate.toString().padEnd(53)} msg/min ║
║ Average Size: ${avgBytes.toString().padEnd(53)} bytes   ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ Message Type Breakdown:                                                      ║
║ • AIS Maritime Data: ${this.sessionStats.messageTypes.AIS.toString().padEnd(46)} messages ║
║ • GNSS GPS Data: ${this.sessionStats.messageTypes.GNSS.toString().padEnd(50)} messages ║
║ • Serial Sensor Data: ${this.sessionStats.messageTypes.SERIAL.toString().padEnd(45)} messages ║
║ • Generic Data: ${this.sessionStats.messageTypes.DATA.toString().padEnd(51)} messages ║
╚═══════════════════════════════════════════════════════════════════════════════╝

📡 [Monitor] Bridge monitoring session ended.
🔄 Connection will be closed in 3 seconds...

Thank you for using TCP Bridge Monitor! 🚀

`;
    }
}

module.exports = MonitoringFormatter;
