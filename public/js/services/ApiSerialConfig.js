/**
 * API Serial Configuration Methods
 * Handles all serial port configuration related API calls
 */

class ApiSerialConfig {
    constructor(core) {
        this.core = core;
    }

    // SERIAL CONFIGURATIONS API - ENHANCED
    async getSerialConfigs() {
        try {
            console.log('🔌 Loading serial configurations...');
            const configs = await this.core.get('/api/serial-configs');
            
            if (!Array.isArray(configs)) {
                throw new Error('Invalid response format: expected array');
            }
            
            console.log(`✅ Serial configs loaded: ${configs.length} configurations`);
            
            // Validate and enhance configs
            configs.forEach((config, index) => {
                if (!config.id) {
                    console.warn(`⚠️ Serial config at index ${index} missing ID:`, config);
                }
                if (!config.name) {
                    console.warn(`⚠️ Serial config at index ${index} missing name:`, config);
                }
                if (!config.serialPort) {
                    console.warn(`⚠️ Serial config at index ${index} missing serialPort:`, config);
                }
                
                // Set defaults
                config.baudRate = config.baudRate || 9600;
                config.tcpOutHost = config.tcpOutHost || '127.0.0.1';
                config.tcpOutPort = config.tcpOutPort || 4001;
                config.active = Boolean(config.active);
            });
            
            return configs;
        } catch (error) {
            console.error('❌ Failed to load serial configurations:', error);
            // Return empty array to prevent UI crashes
            return [];
        }
    }

    async createSerialConfig(config) {
        try {
            console.log('➕ Creating serial configuration:', config.name);
            
            // Validate required fields
            const requiredFields = ['name', 'serialPort', 'tcpOutHost', 'tcpOutPort'];
            const missingFields = requiredFields.filter(field => !config[field]);
            
            if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }
            
            // Validate data types
            if (typeof config.tcpOutPort !== 'number' || config.tcpOutPort < 1 || config.tcpOutPort > 65535) {
                throw new Error('TCP Output Port must be a number between 1 and 65535');
            }
            
            if (config.baudRate && (typeof config.baudRate !== 'number' || config.baudRate <= 0)) {
                throw new Error('Baud Rate must be a positive number');
            }
            
            // Set defaults
            const enhancedConfig = {
                baudRate: 9600,
                ...config,
                active: false // New configs start as inactive
            };
            
            const result = await this.core.post('/api/serial-configs', enhancedConfig);
            console.log('✅ Serial configuration created successfully:', result);
            
            // Clear relevant caches
            this.core.clearConfigCache();
            
            return result;
        } catch (error) {
            console.error('❌ Failed to create serial configuration:', error);
            throw this.core.enhanceError(error, 'CREATE_SERIAL_CONFIG');
        }
    }

    async updateSerialConfig(id, config) {
        try {
            if (!id) {
                throw new Error('Configuration ID is required for update');
            }
            
            console.log(`📝 Updating serial configuration: ${id}`);
            
            // Validate if any required fields are being updated
            if (config.tcpOutPort !== undefined) {
                if (typeof config.tcpOutPort !== 'number' || config.tcpOutPort < 1 || config.tcpOutPort > 65535) {
                    throw new Error('TCP Output Port must be a number between 1 and 65535');
                }
            }
            
            if (config.baudRate !== undefined) {
                if (typeof config.baudRate !== 'number' || config.baudRate <= 0) {
                    throw new Error('Baud Rate must be a positive number');
                }
            }
            
            const result = await this.core.put(`/api/serial-configs/${id}`, config);
            console.log('✅ Serial configuration updated successfully');
            
            // Clear caches
            this.core.clearConfigCache();
            
            return result;
        } catch (error) {
            console.error('❌ Failed to update serial configuration:', error);
            throw this.core.enhanceError(error, 'UPDATE_SERIAL_CONFIG');
        }
    }

    async deleteSerialConfig(id) {
        try {
            if (!id) {
                throw new Error('Configuration ID is required for deletion');
            }
            
            console.log(`🗑 Deleting serial configuration: ${id}`);
            
            const result = await this.core.delete(`/api/serial-configs/${id}`);
            console.log('✅ Serial configuration deleted successfully');
            
            // Clear caches
            this.core.clearConfigCache();
            
            return result;
        } catch (error) {
            console.error('❌ Failed to delete serial configuration:', error);
            throw this.core.enhanceError(error, 'DELETE_SERIAL_CONFIG');
        }
    }

    // Configuration validation
    validateSerialConfig(config) {
        const errors = [];
        
        if (!config.name || typeof config.name !== 'string') {
            errors.push('Name is required and must be a string');
        }
        
        if (!config.serialPort || typeof config.serialPort !== 'string') {
            errors.push('Serial port is required and must be a string');
        }
        
        if (!config.tcpOutHost || typeof config.tcpOutHost !== 'string') {
            errors.push('TCP output host is required and must be a string');
        }
        
        if (typeof config.tcpOutPort !== 'number' || config.tcpOutPort < 1 || config.tcpOutPort > 65535) {
            errors.push('TCP output port must be a number between 1 and 65535');
        }
        
        if (config.baudRate && (typeof config.baudRate !== 'number' || config.baudRate <= 0)) {
            errors.push('Baud rate must be a positive number');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// Export for use in other modules
window.ApiSerialConfig = ApiSerialConfig;
