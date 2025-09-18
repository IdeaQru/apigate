/**
 * API Core - Enhanced Request Handling with Retry Logic
 * Core functionality for HTTP requests, caching, and error handling
 */

class ApiCore {
    constructor() {
        this.baseURL = this.getBaseURL();
        this.requestTimeout = 15000; // 15 seconds timeout
        this.debugMode = window.location.hostname === 'localhost'; // Auto-enable debug on localhost
        this.retryCount = 3; // Number of retries for failed requests
        this.requestId = 0; // For request tracking
        this.cache = new Map(); // Simple cache for GET requests
        this.cacheTimeout = 5000; // 5 seconds cache timeout
        
        console.log('🌐 ApiCore initialized:', {
            baseURL: this.baseURL,
            debugMode: this.debugMode,
            timeout: this.requestTimeout,
            retries: this.retryCount
        });
    }

    getBaseURL() {
        // Multiple fallback strategies for base URL
        if (window.APP_CONSTANTS?.API?.BASE_URL !== undefined) {
            return window.APP_CONSTANTS.API.BASE_URL;
        }
        
        // Use current origin for same-origin requests
        if (typeof window !== 'undefined' && window.location) {
            return ''; // Empty string for same origin
        }
        
        // Default fallback
        return '';
    }

    // Generate unique request ID for tracking
    generateRequestId() {
        return ++this.requestId;
    }

    // Cache management
    setCacheValue(key, value) {
        this.cache.set(key, {
            data: value,
            timestamp: Date.now()
        });
    }

    getCacheValue(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    clearCache() {
        this.cache.clear();
        if (this.debugMode) {
            console.log('🧹 API cache cleared');
        }
    }

    // Generic request method with enhanced error handling and retry logic
    async request(url, options = {}) {
        const requestId = this.generateRequestId();
        const config = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Request-ID': requestId.toString(),
                ...options.headers
            },
            ...options
        };

        // Remove our custom timeout option since fetch doesn't accept it
        const { timeout, useCache, ...fetchConfig } = config;
        
        const fullURL = this.baseURL + url;
        const cacheKey = `${config.method}:${fullURL}`;

        // Check cache for GET requests
        if (config.method === 'GET' && useCache !== false) {
            const cached = this.getCacheValue(cacheKey);
            if (cached) {
                if (this.debugMode) {
                    console.log(`💾 Cache hit for ${fullURL} [${requestId}]`);
                }
                return cached;
            }
        }

        if (this.debugMode) {
            console.log(`🌐 API Request [${requestId}]: ${config.method} ${fullURL}`);
            if (fetchConfig.body) {
                try {
                    const parsedBody = JSON.parse(fetchConfig.body);
                    console.log('📤 Request body:', parsedBody);
                } catch (e) {
                    console.log('📤 Request body (raw):', fetchConfig.body);
                }
            }
        }

        let lastError;
        
        // Retry logic with exponential backoff
        for (let attempt = 1; attempt <= this.retryCount; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                    controller.abort();
                }, this.requestTimeout);

                const startTime = performance.now();
                
                const response = await fetch(fullURL, {
                    ...fetchConfig,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                
                const endTime = performance.now();
                const duration = Math.round(endTime - startTime);

                if (this.debugMode) {
                    console.log(`📡 API Response [${requestId}]: ${response.status} ${response.statusText} (${duration}ms, attempt ${attempt})`);
                }

                if (!response.ok) {
                    let errorData;
                    let errorMessage;
                    
                    try {
                        const errorText = await response.text();
                        try {
                            errorData = JSON.parse(errorText);
                            errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
                        } catch (parseError) {
                            errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
                            errorData = { error: errorMessage };
                        }
                    } catch (textError) {
                        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                        errorData = { error: errorMessage };
                    }
                    
                    console.error(`❌ API Error [${requestId}]:`, {
                        status: response.status,
                        statusText: response.statusText,
                        url: fullURL,
                        method: config.method,
                        error: errorData
                    });
                    
                    const error = new Error(errorMessage);
                    error.status = response.status;
                    error.response = errorData;
                    error.url = fullURL;
                    error.method = config.method;
                    error.requestId = requestId;
                    
                    // Don't retry client errors (4xx) except for specific cases
                    if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
                        throw error;
                    }
                    
                    throw error;
                }

                // Parse response
                let data;
                const contentType = response.headers.get('content-type');
                
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    const text = await response.text();
                    try {
                        data = JSON.parse(text);
                    } catch (e) {
                        data = { message: text, success: true };
                    }
                }
                
                if (this.debugMode) {
                    console.log(`📥 API Data [${requestId}]:`, data);
                }

                // Cache successful GET requests
                if (config.method === 'GET' && useCache !== false) {
                    this.setCacheValue(cacheKey, data);
                }

                return data;
                
            } catch (error) {
                lastError = error;
                
                if (error.name === 'AbortError') {
                    console.error(`⏰ Request timeout [${requestId}] (attempt ${attempt}/${this.retryCount}):`, fullURL);
                    
                    if (attempt === this.retryCount) {
                        const timeoutError = new Error(`Request timeout after ${this.retryCount} attempts`);
                        timeoutError.type = 'timeout';
                        timeoutError.requestId = requestId;
                        throw timeoutError;
                    }
                } else if (this.shouldRetry(error, attempt)) {
                    const delay = this.getRetryDelay(attempt);
                    console.warn(`🔄 Retrying request [${requestId}] in ${delay}ms (attempt ${attempt + 1}/${this.retryCount}):`, error.message);
                    
                    // Wait before retry
                    await this.sleep(delay);
                } else {
                    // Don't retry or final attempt
                    console.error(`💥 Request failed [${requestId}]:`, {
                        error: error.message,
                        url: fullURL,
                        method: config.method,
                        attempt,
                        stack: error.stack
                    });
                    
                    // Enhance error with additional context
                    error.requestId = requestId;
                    error.url = fullURL;
                    error.method = config.method;
                    error.attempt = attempt;
                    
                    throw error;
                }
            }
        }
        
        // If we get here, all retries failed
        lastError.requestId = requestId;
        lastError.url = fullURL;
        lastError.method = config.method;
        lastError.retriesExhausted = true;
        throw lastError;
    }

    // Determine if request should be retried
    shouldRetry(error, attempt) {
        if (attempt >= this.retryCount) return false;
        
        // Retry on network errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) return true;
        
        // Retry on specific HTTP status codes
        if (error.status >= 500) return true; // Server errors
        if (error.status === 408) return true; // Request timeout
        if (error.status === 429) return true; // Too many requests
        
        // Retry on timeout
        if (error.name === 'AbortError') return true;
        
        return false;
    }

    // Calculate retry delay with exponential backoff
    getRetryDelay(attempt) {
        const baseDelay = 1000; // 1 second
        const maxDelay = 10000; // 10 seconds
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 0.1 * delay;
        return Math.floor(delay + jitter);
    }

    // Sleep utility
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // HTTP method helpers with enhanced logging
    async get(url, options = {}) {
        return this.request(url, { method: 'GET', ...options });
    }

    async post(url, data, options = {}) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data),
            ...options
        });
    }

    async put(url, data, options = {}) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data),
            ...options
        });
    }

    async delete(url, options = {}) {
        return this.request(url, { method: 'DELETE', ...options });
    }
}

// Export for use in other modules
window.ApiCore = ApiCore;
