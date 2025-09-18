/**
 * API Control Operations Module - Complete Individual Instance Control
 * Handles starting, stopping, and controlling individual instances
 */

class ApiControlOps {
    constructor(core) {
        this.core = core;
    }

    // ✅ EXISTING: Start forwarding (unchanged)
    async startForwarding(type, configId) {
        console.log(`🚀 Starting ${type} forwarding for config: ${configId}`);

        if (!this.validateStartForwardingParams(type, configId)) {
            throw new Error('Invalid start forwarding parameters');
        }

        try {
            const result = await this.core.request('/api/start-forwarding', {
                method: 'POST',
                body: JSON.stringify({ type, configId })
            });

            console.log(`✅ ${type} forwarding started successfully for config: ${configId}`);
            return result;
        } catch (error) {
            const enhanced = this.core.enhanceError(error, 'start forwarding');
            console.error(`❌ Failed to start ${type} forwarding:`, enhanced.message);
            throw enhanced;
        }
    }

    // ✅ EXISTING: Global stop forwarding (unchanged)
    async stopForwarding() {
        console.log('🛑 Stopping all forwarding...');

        try {
            const result = await this.core.request('/api/stop-forwarding', {
                method: 'POST'
            });

            console.log('✅ Global forwarding stopped successfully');
            return result;
        } catch (error) {
            const enhanced = this.core.enhanceError(error, 'stop forwarding');
            console.error('❌ Failed to stop global forwarding:', enhanced.message);
            throw enhanced;
        }
    }

    // ✅ COMPLETE: Stop individual instance
    async stopInstance(instanceId) {
        console.log(`🛑 Stopping individual instance: ${instanceId}`);

        if (!instanceId) {
            throw new Error('Instance ID is required for individual stop');
        }

        if (typeof instanceId !== 'string' || instanceId.trim().length === 0) {
            throw new Error('Invalid instance ID format');
        }

        try {
            const result = await this.core.request('/api/stop-instance', {
                method: 'POST',
                body: JSON.stringify({ instanceId: instanceId.trim() })
            });

            console.log(`✅ Individual instance stopped successfully: ${instanceId}`);
            return result;
        } catch (error) {
            // Check if endpoint doesn't exist (404) or method not implemented
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                const notSupportedError = new Error('Individual instance stop not supported by backend');
                notSupportedError.code = 'INDIVIDUAL_STOP_NOT_SUPPORTED';
                throw notSupportedError;
            }

            const enhanced = this.core.enhanceError(error, 'stop individual instance');
            console.error(`❌ Failed to stop individual instance ${instanceId}:`, enhanced.message);
            throw enhanced;
        }
    }

    // ✅ COMPLETE: Get individual instance details
    async getInstance(instanceId) {
        console.log(`🔍 Getting individual instance details: ${instanceId}`);

        if (!instanceId) {
            throw new Error('Instance ID is required');
        }

        if (typeof instanceId !== 'string' || instanceId.trim().length === 0) {
            throw new Error('Invalid instance ID format');
        }

        try {
            const result = await this.core.request(`/api/instance/${instanceId.trim()}`, {
                method: 'GET'
            });

            console.log(`✅ Individual instance details retrieved: ${instanceId}`);
            return result;
        } catch (error) {
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                const notFoundError = new Error(`Individual instance not found: ${instanceId}`);
                notFoundError.code = 'INSTANCE_NOT_FOUND';
                throw notFoundError;
            }

            const enhanced = this.core.enhanceError(error, 'get individual instance');
            console.error(`❌ Failed to get individual instance ${instanceId}:`, enhanced.message);
            throw enhanced;
        }
    }

    // ✅ COMPLETE: List all instances
    async getAllInstances() {
        console.log('📋 Getting all instances...');

        try {
            const result = await this.core.request('/api/instances', {
                method: 'GET'
            });

            console.log(`✅ All instances retrieved (${result.instances?.length || 0} instances)`);
            return result;
        } catch (error) {
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                console.log('⚠️ Instances endpoint not available, using status endpoint fallback');
                
                // Fallback to status endpoint
                try {
                    const statusResult = await this.core.request('/api/status', { method: 'GET' });
                    return {
                        instances: statusResult.instances || [],
                        totalInstances: statusResult.totalInstances || 0,
                        activeInstances: statusResult.activeInstances || 0
                    };
                } catch (statusError) {
                    throw new Error('Both instances and status endpoints failed');
                }
            }

            const enhanced = this.core.enhanceError(error, 'get all instances');
            console.error('❌ Failed to get all instances:', enhanced.message);
            throw enhanced;
        }
    }

    // ✅ COMPLETE: Restart individual instance
    async restartInstance(instanceId) {
        console.log(`🔄 Restarting individual instance: ${instanceId}`);

        if (!instanceId) {
            throw new Error('Instance ID is required for restart');
        }

        try {
            const result = await this.core.request('/api/restart-instance', {
                method: 'POST',
                body: JSON.stringify({ instanceId: instanceId.trim() })
            });

            console.log(`✅ Individual instance restarted successfully: ${instanceId}`);
            return result;
        } catch (error) {
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                throw new Error('Individual restart not supported by backend');
            }

            const enhanced = this.core.enhanceError(error, 'restart individual instance');
            console.error(`❌ Failed to restart individual instance ${instanceId}:`, enhanced.message);
            throw enhanced;
        }
    }

    // ✅ EXISTING: Send test message (unchanged)
    async sendTestMessage(message) {
        console.log('📤 Sending test message...');

        if (!this.validateTestMessage(message)) {
            throw new Error('Invalid test message');
        }

        try {
            const result = await this.core.request('/api/send-test', {
                method: 'POST',
                body: JSON.stringify({ message })
            });

            console.log('✅ Test message sent successfully');
            return result;
        } catch (error) {
            const enhanced = this.core.enhanceError(error, 'send test message');
            console.error('❌ Failed to send test message:', enhanced.message);
            throw enhanced;
        }
    }

    // ✅ EXISTING: Emergency stop (unchanged)
    async emergencyStop() {
        console.log('🚨 Executing emergency stop...');

        try {
            const result = await this.core.request('/api/emergency-stop', {
                method: 'POST'
            });

            console.log('✅ Emergency stop executed successfully');
            return result;
        } catch (error) {
            const enhanced = this.core.enhanceError(error, 'emergency stop');
            console.error('❌ Failed to execute emergency stop:', enhanced.message);
            throw enhanced;
        }
    }

    // ✅ VALIDATION METHODS
    validateStartForwardingParams(type, configId) {
        if (!type || typeof type !== 'string') {
            console.error('❌ Invalid type parameter');
            return false;
        }

        if (!configId || typeof configId !== 'string') {
            console.error('❌ Invalid configId parameter');
            return false;
        }

        const validTypes = ['serial', 'ip'];
        if (!validTypes.includes(type.toLowerCase())) {
            console.error('❌ Invalid forwarding type. Must be "serial" or "ip"');
            return false;
        }

        return true;
    }

    validateTestMessage(message) {
        if (!message || typeof message !== 'string') {
            console.error('❌ Invalid test message');
            return false;
        }

        if (message.trim().length === 0) {
            console.error('❌ Test message cannot be empty');
            return false;
        }

        if (message.length > 1000) {
            console.error('❌ Test message too long (max 1000 characters)');
            return false;
        }

        return true;
    }

    validateInstanceId(instanceId) {
        if (!instanceId || typeof instanceId !== 'string') {
            console.error('❌ Invalid instance ID');
            return false;
        }

        if (instanceId.trim().length === 0) {
            console.error('❌ Instance ID cannot be empty');
            return false;
        }

        return true;
    }

    debugInstanceControl() {
        console.log('=== COMPLETE INDIVIDUAL INSTANCE CONTROL DEBUG ===');
        console.log('Available methods:');
        console.log('  stopInstance():', typeof this.stopInstance);
        console.log('  getInstance():', typeof this.getInstance);
        console.log('  getAllInstances():', typeof this.getAllInstances);
        console.log('  restartInstance():', typeof this.restartInstance);
        console.log('  validateInstanceId():', typeof this.validateInstanceId);
        console.log('');
        console.log('Existing methods:');
        console.log('  startForwarding():', typeof this.startForwarding);
        console.log('  stopForwarding():', typeof this.stopForwarding);
        console.log('  sendTestMessage():', typeof this.sendTestMessage);
        console.log('  emergencyStop():', typeof this.emergencyStop);
        console.log('===================================================');
    }
}

// Export class
window.ApiControlOps = ApiControlOps;

console.log('🎮 COMPLETE ApiControlOps loaded with full individual instance control');
