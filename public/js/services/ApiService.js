/**
 * API Service Main Class - Enhanced with Individual Instance Control
 * Coordinates all API modules and provides unified interface
 */

class ApiService {
    constructor() {
        // Initialize core and utilities
        this.core = new ApiCore();
        this.utils = new ApiUtils();
        
        // Initialize API modules
        this.serialConfig = new ApiSerialConfig(this.core);
        this.ipConfig = new ApiIpConfig(this.core);
        this.systemInfo = new ApiSystemInfo(this.core);
        this.controlOps = new ApiControlOps(this.core);
        
        // Enhance core with utils
        this.core.enhanceError = this.utils.enhanceError.bind(this.utils);
        this.core.clearConfigCache = this.clearConfigCache.bind(this);
        
        console.log('🌐 ApiService fully initialized with individual instance control');
    }

    // SERIAL CONFIGURATION METHODS (unchanged)
    async getSerialConfigs() {
        return this.serialConfig.getSerialConfigs();
    }

    async createSerialConfig(config) {
        return this.serialConfig.createSerialConfig(config);
    }

    async updateSerialConfig(id, config) {
        return this.serialConfig.updateSerialConfig(id, config);
    }

    async deleteSerialConfig(id) {
        return this.serialConfig.deleteSerialConfig(id);
    }

    // IP CONFIGURATION METHODS (unchanged)
    async getIpConfigs() {
        return this.ipConfig.getIpConfigs();
    }

    async createIpConfig(config) {
        return this.ipConfig.createIpConfig(config);
    }

    async updateIpConfig(id, config) {
        return this.ipConfig.updateIpConfig(id, config);
    }

    async deleteIpConfig(id) {
        return this.ipConfig.deleteIpConfig(id);
    }

    // SYSTEM INFORMATION METHODS (unchanged)
    async getSerialPorts() {
        return this.systemInfo.getSerialPorts();
    }

    async getDashboardStats() {
        return this.systemInfo.getDashboardStats();
    }

    async getStatus() {
        return this.systemInfo.getStatus();
    }

    async getMonitorInfo() {
        return this.systemInfo.getMonitorInfo();
    }

    async getSpeedStats() {
        return this.systemInfo.getSpeedStats();
    }

    async getChartData() {
        return this.systemInfo.getChartData();
    }

    // CONTROL OPERATIONS METHODS (existing)
    async startForwarding(type, configId) {
        return this.controlOps.startForwarding(type, configId);
    }

    async stopForwarding() {
        return this.controlOps.stopForwarding();
    }

    async sendTestMessage(message) {
        return this.controlOps.sendTestMessage(message);
    }

    async emergencyStop() {
        return this.controlOps.emergencyStop();
    }

    // ✅ NEW: Individual Instance Control Methods
    async stopInstance(instanceId) {
        console.log(`🛑 ApiService: Stopping individual instance: ${instanceId}`);
        
        try {
            return await this.controlOps.stopInstance(instanceId);
        } catch (error) {
            if (error.code === 'INDIVIDUAL_STOP_NOT_SUPPORTED') {
                console.log('⚠️ Individual stop not supported, falling back to global stop');
                return await this.controlOps.stopForwarding();
            }
            throw error;
        }
    }

    async getInstance(instanceId) {
        console.log(`🔍 ApiService: Getting individual instance: ${instanceId}`);
        return this.controlOps.getInstance(instanceId);
    }

    async getAllInstances() {
        console.log('📋 ApiService: Getting all instances');
        return this.controlOps.getAllInstances();
    }

    async restartInstance(instanceId) {
        console.log(`🔄 ApiService: Restarting individual instance: ${instanceId}`);
        return this.controlOps.restartInstance(instanceId);
    }

    // UTILITY METHODS (unchanged)
    clearConfigCache() {
        // Clear specific cache entries related to configurations
        const cacheKeys = Array.from(this.core.cache.keys());
        const configKeys = cacheKeys.filter(key => 
            key.includes('/api/serial-configs') || 
            key.includes('/api/ip-configs') ||
            key.includes('/api/dashboard-stats')
        );
        
        configKeys.forEach(key => this.core.cache.delete(key));
        
        if (this.core.debugMode && configKeys.length > 0) {
            console.log(`🧹 Cleared ${configKeys.length} config cache entries`);
        }
    }

    clearAllCache() {
        this.core.clearCache();
    }

    // VALIDATION METHODS (enhanced)
    validateSerialConfig(config) {
        return this.serialConfig.validateSerialConfig(config);
    }

    validateIpConfig(config) {
        return this.ipConfig.validateIpConfig(config);
    }

    validateStartForwardingParams(type, configId) {
        return this.controlOps.validateStartForwardingParams(type, configId);
    }

    validateTestMessage(message) {
        return this.controlOps.validateTestMessage(message);
    }

    // ✅ NEW: Validate instance ID
    validateInstanceId(instanceId) {
        return this.controlOps.validateInstanceId(instanceId);
    }

    // FORMATTING METHODS (unchanged)
    formatBytes(bytes) {
        return this.utils.formatBytes(bytes);
    }

    formatDuration(seconds) {
        return this.utils.formatDuration(seconds);
    }

    formatRate(rate) {
        return this.utils.formatRate(rate);
    }

    // ERROR HANDLING (unchanged)
    createUserErrorMessage(error) {
        return this.utils.createUserErrorMessage(error);
    }

    // ✅ ENHANCED: Diagnostic methods with individual instance control
    getApiStatus() {
        return {
            initialized: true,
            modules: {
                core: !!this.core,
                utils: !!this.utils,
                serialConfig: !!this.serialConfig,
                ipConfig: !!this.ipConfig,
                systemInfo: !!this.systemInfo,
                controlOps: !!this.controlOps
            },
            individualInstanceControl: {
                stopInstance: typeof this.stopInstance === 'function',
                getInstance: typeof this.getInstance === 'function',
                getAllInstances: typeof this.getAllInstances === 'function',
                restartInstance: typeof this.restartInstance === 'function',
                validateInstanceId: typeof this.validateInstanceId === 'function'
            },
            cache: {
                size: this.core.cache.size,
                keys: Array.from(this.core.cache.keys())
            },
            settings: {
                baseURL: this.core.baseURL,
                timeout: this.core.requestTimeout,
                debugMode: this.core.debugMode,
                retryCount: this.core.retryCount
            }
        };
    }

    // ✅ NEW: Debug individual instance control
    debugInstanceControl() {
        console.log('=== API SERVICE INDIVIDUAL CONTROL DEBUG ===');
        console.log('Main ApiService methods:');
        console.log('  stopInstance():', typeof this.stopInstance);
        console.log('  getInstance():', typeof this.getInstance);
        console.log('  getAllInstances():', typeof this.getAllInstances);
        console.log('  restartInstance():', typeof this.restartInstance);
        console.log('  validateInstanceId():', typeof this.validateInstanceId);
        console.log('');
        
        if (this.controlOps && typeof this.controlOps.debugInstanceControl === 'function') {
            this.controlOps.debugInstanceControl();
        } else {
            console.log('❌ ControlOps debug method not available');
        }
        console.log('==============================================');
    }

    // HEALTH CHECK (unchanged)
    async healthCheck() {
        try {
            const startTime = performance.now();
            await this.getStatus();
            const endTime = performance.now();
            
            return {
                healthy: true,
                responseTime: Math.round(endTime - startTime),
                individualInstanceControl: true,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                individualInstanceControl: false,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// Initialize global API service
window.apiService = new ApiService();

// Export for use in modules
window.ApiService = ApiService;

console.log('🌐 Enhanced Modular API Service fully loaded with individual instance control');
