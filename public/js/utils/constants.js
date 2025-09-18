// Application Constants
window.APP_CONSTANTS = {
    // API Endpoints
    API: {
        BASE_URL: '',
        SERIAL_CONFIGS: '/api/serial-configs',
        IP_CONFIGS: '/api/ip-configs',
        SERIAL_PORTS: '/api/serial-ports',
        STATUS: '/api/status',
        SPEED_STATS: '/api/speed-stats',
        START_FORWARDING: '/api/start-forwarding',
        STOP_FORWARDING: '/api/stop-forwarding',
        SEND_TEST: '/api/send-test'
    },
    
    // UI Constants
    UI: {
        LOADING_DELAY: 2000,
        TOAST_DURATION: 5000,
        TOAST_MAX_COUNT: 3,
        STATUS_POLL_INTERVAL: 2000,
        SPEED_UPDATE_INTERVAL: 10000,
        LOG_MAX_LINES: 100,
        CHART_MAX_POINTS: 10
    },
    
    // Default Values
    DEFAULTS: {
        SERIAL_BAUD_RATE: 9600,
        TCP_OUTPUT_HOST: '127.0.0.1',
        TCP_OUTPUT_PORT: 4001,
        IP_PORT: 3001,
        CONNECTION_MODE: 'server'
    },
    
    // Status Types
    STATUS: {
        OFFLINE: 'offline',
        ONLINE: 'online',
        CONNECTING: 'connecting',
        ERROR: 'error'
    },
    
    // Message Types
    MESSAGE_TYPES: {
        INFO: 'info',
        SUCCESS: 'success',
        WARNING: 'warning',
        ERROR: 'error'
    },
    
    // Tab Names
    TABS: {
        DASHBOARD: 'dashboard',
        SERIAL: 'serial',
        IP: 'ip',
        MONITOR: 'monitor'
    },
    
    // Mission Control Tabs
    MISSION_TABS: {
        OVERVIEW: 'overview',
        PERFORMANCE: 'performance',
        COMMANDS: 'commands'
    },
    
    // Animation Durations
    ANIMATIONS: {
        FAST: 150,
        SMOOTH: 300,
        SLOW: 600
    },
    
    // Validation Rules
    VALIDATION: {
        PORT_MIN: 1,
        PORT_MAX: 65535,
        NAME_MIN_LENGTH: 3,
        NAME_MAX_LENGTH: 50,
        IP_REGEX: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    },
    
    // Chart Configuration
    CHART: {
        COLORS: {
            PRIMARY: '#ff6da7',
            SECONDARY: '#00f0ff',
            SUCCESS: '#00ff88',
            WARNING: '#ffff00',
            DANGER: '#ff4757'
        },
        GRID_COLOR: 'rgba(255, 109, 167, 0.2)',
        BACKGROUND: 'transparent'
    }
};

// Freeze constants to prevent modification
Object.freeze(window.APP_CONSTANTS);
