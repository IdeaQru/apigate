/**
 * API Utilities and Helpers
 * Common utilities, error handling, and helper functions
 */

class ApiUtils {
    constructor() {
        this.retryDelays = [1000, 2000, 5000]; // Retry delays in milliseconds
        this.maxRetries = 3;
    }

    // ERROR HANDLING UTILITIES
    enhanceError(error, operation) {
        const enhancedError = new Error(error.message || 'Unknown error occurred');
        
        // Copy original error properties
        enhancedError.originalError = error;
        enhancedError.operation = operation;
        enhancedError.timestamp = new Date().toISOString();
        
        // Enhance based on error type
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            enhancedError.type = 'NETWORK_ERROR';
            enhancedError.userMessage = 'Network connection failed. Please check your internet connection.';
        } else if (error.status >= 400 && error.status < 500) {
            enhancedError.type = 'CLIENT_ERROR';
            enhancedError.userMessage = error.message || 'Invalid request. Please check your input.';
        } else if (error.status >= 500) {
            enhancedError.type = 'SERVER_ERROR';
            enhancedError.userMessage = 'Server error occurred. Please try again later.';
        } else if (error.name === 'AbortError') {
            enhancedError.type = 'TIMEOUT_ERROR';
            enhancedError.userMessage = 'Request timed out. Please try again.';
        } else {
            enhancedError.type = 'UNKNOWN_ERROR';
            enhancedError.userMessage = error.message || 'An unexpected error occurred.';
        }
        
        return enhancedError;
    }

    // Create user-friendly error message
    createUserErrorMessage(error) {
        if (error.userMessage) {
            return error.userMessage;
        }
        
        switch (error.type) {
            case 'NETWORK_ERROR':
                return 'Unable to connect to the server. Please check your network connection.';
            case 'TIMEOUT_ERROR':
                return 'The request took too long to complete. Please try again.';
            case 'CLIENT_ERROR':
                return error.message || 'There was an issue with your request.';
            case 'SERVER_ERROR':
                return 'The server encountered an error. Please try again later.';
            default:
                return error.message || 'An unexpected error occurred.';
        }
    }

    // CACHING UTILITIES
    createCacheKey(method, url, params = {}) {
        const paramString = Object.keys(params).length > 0 ? 
            '?' + new URLSearchParams(params).toString() : '';
        return `${method.toUpperCase()}:${url}${paramString}`;
    }

    isCacheValid(cacheEntry, maxAge = 5000) {
        if (!cacheEntry || !cacheEntry.timestamp) return false;
        return Date.now() - cacheEntry.timestamp < maxAge;
    }

    // VALIDATION UTILITIES
    isValidUrl(url) {
        try {
            new URL(url, window.location.origin);
            return true;
        } catch {
            return false;
        }
    }

    isValidPort(port) {
        const portNum = parseInt(port, 10);
        return !isNaN(portNum) && portNum >= 1 && portNum <= 65535;
    }

    isValidIpAddress(ip) {
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipv4Regex.test(ip) || ip === 'localhost';
    }

    isValidHostname(hostname) {
        if (!hostname || typeof hostname !== 'string') return false;
        if (hostname === 'localhost') return true;
        if (this.isValidIpAddress(hostname)) return true;
        
        const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return hostnameRegex.test(hostname);
    }

    // FORMATTING UTILITIES
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${remainingSeconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            return `${remainingSeconds}s`;
        }
    }

    formatRate(rate) {
        if (rate < 1000) {
            return `${rate}/min`;
        } else if (rate < 1000000) {
            return `${(rate / 1000).toFixed(1)}K/min`;
        } else {
            return `${(rate / 1000000).toFixed(1)}M/min`;
        }
    }

    // ASYNC UTILITIES
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async withTimeout(promise, timeoutMs) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
        });
        
        return Promise.race([promise, timeoutPromise]);
    }

    async retry(operation, maxRetries = this.maxRetries, delays = this.retryDelays) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                if (attempt === maxRetries) {
                    throw error;
                }
                
                const delay = delays[attempt - 1] || delays[delays.length - 1];
                console.warn(`Operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`, error.message);
                await this.sleep(delay);
            }
        }
        
        throw lastError;
    }

    // LOGGING UTILITIES
    logApiCall(method, url, duration, status) {
        const logData = {
            method: method.toUpperCase(),
            url,
            duration: `${duration}ms`,
            status,
            timestamp: new Date().toISOString()
        };
        
        if (status >= 200 && status < 300) {
            console.log('📡 API Success:', logData);
        } else if (status >= 400) {
            console.error('❌ API Error:', logData);
        } else {
            console.warn('⚠️ API Warning:', logData);
        }
    }

    logError(error, context = '') {
        const errorData = {
            message: error.message,
            type: error.type || 'Unknown',
            operation: error.operation || context,
            timestamp: error.timestamp || new Date().toISOString(),
            stack: error.stack
        };
        
        console.group(`❌ API Error: ${error.operation || context}`);
        console.error('Error details:', errorData);
        if (error.originalError) {
            console.error('Original error:', error.originalError);
        }
        console.groupEnd();
    }

    // DEBOUNCING UTILITY
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // THROTTLING UTILITY
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Export for use in other modules
window.ApiUtils = ApiUtils;
