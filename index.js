const SerialTCPForwarder = require('./lib/SerialTCPForwarder');

// Start the application
const forwarder = new SerialTCPForwarder();

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = forwarder;
