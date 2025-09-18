/**
 * API IP Configuration Methods
 * Handles all network/IP configuration related API calls
 */

class ApiIpConfig {
    constructor(core) {
        this.core = core;
    }

    // IP CONFIGURATIONS API - ENHANCED
    async getIpConfigs() {
        try {
            console.log('🌐 Loading IP configurations...');
            const configs = await this.core.get('/api/ip-configs');
            
            if (!Array.isArray(configs)) {
                throw new Error('Invalid response format: expected array');
            }
            
            console.log(`✅ IP configs loaded: ${configs.length} configurations`);
            
            // Validate and enhance configs
            configs.forEach((config, index) => {
                if (!config.id) {
                    console.warn(`⚠️ IP config at index ${index} missing ID:`, config);
                }
                if (!config.name) {
                    console.warn(`⚠️ IP config at index ${index} missing name:`, config);
                }
                if (!config.ipHost) {
                    console.warn(`⚠️ IP config at index ${index} missing ipHost:`, config);
                }
                
                // Set defaults
                config.ipHost = config.ipHost || '127.0.0.1';
                config.ipPort = config.ipPort || 3001;
                config.connectionMode = config.connectionMode || 'server';
                config.tcpOutHost = config.tcpOutHost || '127.0.0.1';
                config.tcpOutPort = config.tcpOutPort || 4001;
                config.active = Boolean(config.active);
            });
            
            return configs;
        } catch (error) {
            console.error('❌ Failed to load IP configurations:', error);
            // Return empty array to prevent UI crashes
            return [];
        }
    }

    async createIpConfig(config) {
        try {
            console.log('➕ Creating IP configuration:', config.name);
            
            // Validate required fields
            const requiredFields = ['name', 'ipHost', 'ipPort', 'tcpOutHost', 'tcpOutPort'];
            const missingFields = requiredFields.filter(field => !config[field]);
            
            if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }
            
            // Validate data types and ranges
            if (typeof config.ipPort !== 'number' || config.ipPort < 1 || config.ipPort > 65535) {
                throw new Error('IP Port must be a number between 1 and 65535');
            }
            
            if (typeof config.tcpOutPort !== 'number' || config.tcpOutPort < 1 || config.tcpOutPort > 65535) {
                throw new Error('TCP Output Port must be a number between 1 and 65535');
            }
            
            // Validate connection mode
            if (config.connectionMode && !['client', 'server'].includes(config.connectionMode)) {
                throw new Error('Connection mode must be either "client" or "server"');
            }
            
            // Validate IP addresses
            if (!this.isValidHost(config.ipHost)) {
                throw new Error('Invalid IP host format');
            }
            
            if (!this.isValidHost(config.tcpOutHost)) {
                throw new Error('Invalid TCP output host format');
            }
            
            // Set defaults
            const enhancedConfig = {
                connectionMode: 'server',
                ...config,
                active: false // New configs start as inactive
            };
            
            const result = await this.core.post('/api/ip-configs', enhancedConfig);
            console.log('✅ IP configuration created successfully:', result);
            
            // Clear relevant caches
            this.core.clearConfigCache();
            
            return result;
        } catch (error) {
            console.error('❌ Failed to create IP configuration:', error);
            throw this.core.enhanceError(error, 'CREATE_IP_CONFIG');
        }
    }

    async updateIpConfig(id, config) {
        try {
            if (!id) {
                throw new Error('Configuration ID is required for update');
            }
            
            console.log(`📝 Updating IP configuration: ${id}`);
            
            // Validate if any fields are being updated
            if (config.ipPort !== undefined) {
                if (typeof config.ipPort !== 'number' || config.ipPort < 1 || config.ipPort > 65535) {
                    throw new Error('IP Port must be a number between 1 and 65535');
                }
            }
            
            if (config.tcpOutPort !== undefined) {
                if (typeof config.tcpOutPort !== 'number' || config.tcpOutPort < 1 || config.tcpOutPort > 65535) {
                    throw new Error('TCP Output Port must be a number between 1 and 65535');
                }
            }
            
            if (config.connectionMode !== undefined) {
                if (!['client', 'server'].includes(config.connectionMode)) {
                    throw new Error('Connection mode must be either "client" or "server"');
                }
            }
            
            if (config.ipHost !== undefined) {
                if (!this.isValidHost(config.ipHost)) {
                    throw new Error('Invalid IP host format');
                }
            }
            
            if (config.tcpOutHost !== undefined) {
                if (!this.isValidHost(config.tcpOutHost)) {
                    throw new Error('Invalid TCP output host format');
                }
            }
            
            const result = await this.core.put(`/api/ip-configs/${id}`, config);
            console.log('✅ IP configuration updated successfully');
            
            // Clear caches
            this.core.clearConfigCache();
            
            return result;
        } catch (error) {
            console.error('❌ Failed to update IP configuration:', error);
            throw this.core.enhanceError(error, 'UPDATE_IP_CONFIG');
        }
    }

    async deleteIpConfig(id) {
        try {
            if (!id) {
                throw new Error('Configuration ID is required for deletion');
            }
            
            console.log(`🗑 Deleting IP configuration: ${id}`);
            
            const result = await this.core.delete(`/api/ip-configs/${id}`);
            console.log('✅ IP configuration deleted successfully');
            
            // Clear caches
            this.core.clearConfigCache();
            
            return result;
        } catch (error) {
            console.error('❌ Failed to delete IP configuration:', error);
            throw this.core.enhanceError(error, 'DELETE_IP_CONFIG');
        }
    }

    // Host validation helper
    isValidHost(host) {
        if (!host || typeof host !== 'string') return false;
        
        // Allow localhost variations
        if (['localhost', '127.0.0.1', '0.0.0.0'].includes(host)) return true;
        
        // Basic IP address validation (IPv4)
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (ipv4Regex.test(host)) return true;
        
        // Basic hostname validation
        const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (hostnameRegex.test(host)) return true;
        
        return false;
    }

    // Configuration validation
    validateIpConfig(config) {
        const errors = [];
        
        if (!config.name || typeof config.name !== 'string') {
            errors.push('Name is required and must be a string');
        }
        
        if (!config.ipHost || typeof config.ipHost !== 'string') {
            errors.push('IP host is required and must be a string');
        } else if (!this.isValidHost(config.ipHost)) {
            errors.push('IP host must be a valid IP address or hostname');
        }
        
        if (typeof config.ipPort !== 'number' || config.ipPort < 1 || config.ipPort > 65535) {
            errors.push('IP port must be a number between 1 and 65535');
        }
        
        if (!config.tcpOutHost || typeof config.tcpOutHost !== 'string') {
            errors.push('TCP output host is required and must be a string');
        } else if (!this.isValidHost(config.tcpOutHost)) {
            errors.push('TCP output host must be a valid IP address or hostname');
        }
        
        if (typeof config.tcpOutPort !== 'number' || config.tcpOutPort < 1 || config.tcpOutPort > 65535) {
            errors.push('TCP output port must be a number between 1 and 65535');
        }
        
        if (config.connectionMode && !['client', 'server'].includes(config.connectionMode)) {
            errors.push('Connection mode must be either "client" or "server"');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// Export for use in other modules
window.ApiIpConfig = ApiIpConfig;
