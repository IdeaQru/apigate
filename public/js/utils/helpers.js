// Utility Helper Functions
window.AppHelpers = {
    // DOM Utilities
    dom: {
        $(selector) {
            return document.querySelector(selector);
        },
        
        $$(selector) {
            return document.querySelectorAll(selector);
        },
        
        createElement(tag, className, innerHTML) {
            const element = document.createElement(tag);
            if (className) element.className = className;
            if (innerHTML) element.innerHTML = innerHTML;
            return element;
        },
        
        addClass(element, className) {
            if (element) element.classList.add(className);
        },
        
        removeClass(element, className) {
            if (element) element.classList.remove(className);
        },
        
        toggleClass(element, className) {
            if (element) element.classList.toggle(className);
        },
        
        hasClass(element, className) {
            return element ? element.classList.contains(className) : false;
        }
    },
    
    // String Utilities
    string: {
        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        
        truncate(str, length = 50) {
            if (!str) return '';
            return str.length > length ? str.substring(0, length) + '...' : str;
        },
        
        capitalize(str) {
            if (!str) return '';
            return str.charAt(0).toUpperCase() + str.slice(1);
        },
        
        slugify(str) {
            return str
                .toLowerCase()
                .trim()
                .replace(/[^\w\s-]/g, '')
                .replace(/[\s_-]+/g, '-')
                .replace(/^-+|-+$/g, '');
        }
    },
    
    // Number Utilities
    number: {
        format(num, decimals = 0) {
            return Number(num).toLocaleString(undefined, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        },
        
        clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        },
        
        random(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        },
        
        percentage(value, total) {
            return total > 0 ? Math.round((value / total) * 100) : 0;
        }
    },
    
    // Time Utilities
    time: {
        formatUptime(milliseconds) {
            const seconds = Math.floor(milliseconds / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            
            return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
        },
        
        formatTimestamp(date = new Date()) {
            return date.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        },
        
        formatDate(date = new Date()) {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        },
        
        formatDateTime(date = new Date()) {
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
        },
        
        timeAgo(timestamp) {
            const now = Date.now();
            const diff = now - timestamp;
            
            if (diff < 60000) return 'Just now';
            if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
            if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
            return new Date(timestamp).toLocaleDateString();
        }
    },
    
    // Validation Utilities
    validate: {
        port(port) {
            const num = parseInt(port);
            return !isNaN(num) && num >= window.APP_CONSTANTS.VALIDATION.PORT_MIN && num <= window.APP_CONSTANTS.VALIDATION.PORT_MAX;
        },
        
        ip(ip) {
            return window.APP_CONSTANTS.VALIDATION.IP_REGEX.test(ip);
        },
        
        name(name) {
            if (!name || typeof name !== 'string') return false;
            const length = name.trim().length;
            return length >= window.APP_CONSTANTS.VALIDATION.NAME_MIN_LENGTH && 
                   length <= window.APP_CONSTANTS.VALIDATION.NAME_MAX_LENGTH;
        },
        
        required(value) {
            return value !== null && value !== undefined && value !== '';
        }
    },
    
    // Animation Utilities
    animate: {
        fadeIn(element, duration = 300) {
            if (!element) return Promise.resolve();
            
            return new Promise(resolve => {
                element.style.opacity = '0';
                element.style.transition = `opacity ${duration}ms ease-out`;
                
                requestAnimationFrame(() => {
                    element.style.opacity = '1';
                    setTimeout(resolve, duration);
                });
            });
        },
        
        fadeOut(element, duration = 300) {
            if (!element) return Promise.resolve();
            
            return new Promise(resolve => {
                element.style.transition = `opacity ${duration}ms ease-out`;
                element.style.opacity = '0';
                setTimeout(resolve, duration);
            });
        },
        
        slideIn(element, direction = 'up', duration = 300) {
            if (!element) return Promise.resolve();
            
            const transforms = {
                up: 'translateY(20px)',
                down: 'translateY(-20px)',
                left: 'translateX(20px)',
                right: 'translateX(-20px)'
            };
            
            return new Promise(resolve => {
                element.style.transform = transforms[direction];
                element.style.opacity = '0';
                element.style.transition = `all ${duration}ms ease-out`;
                
                requestAnimationFrame(() => {
                    element.style.transform = 'translate(0)';
                    element.style.opacity = '1';
                    setTimeout(resolve, duration);
                });
            });
        },
        
        pulse(element, duration = 600) {
            if (!element) return;
            
            element.style.transform = 'scale(1.05)';
            element.style.transition = `transform ${duration / 2}ms ease-out`;
            
            setTimeout(() => {
                element.style.transform = 'scale(1)';
            }, duration / 2);
        }
    },
    
    // Storage Utilities
    storage: {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.warn('Storage set failed:', error);
                return false;
            }
        },
        
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.warn('Storage get failed:', error);
                return defaultValue;
            }
        },
        
        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.warn('Storage remove failed:', error);
                return false;
            }
        },
        
        clear() {
            try {
                localStorage.clear();
                return true;
            } catch (error) {
                console.warn('Storage clear failed:', error);
                return false;
            }
        }
    },
    
    // Debounce and Throttle
    debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    },
    
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // Event Utilities
    events: {
        on(element, event, handler, options = {}) {
            if (element && typeof handler === 'function') {
                element.addEventListener(event, handler, options);
            }
        },
        
        off(element, event, handler, options = {}) {
            if (element && typeof handler === 'function') {
                element.removeEventListener(event, handler, options);
            }
        },
        
        once(element, event, handler, options = {}) {
            if (element && typeof handler === 'function') {
                const onceHandler = (e) => {
                    handler(e);
                    element.removeEventListener(event, onceHandler, options);
                };
                element.addEventListener(event, onceHandler, options);
            }
        },
        
        trigger(element, eventType, detail = {}) {
            if (element) {
                const event = new CustomEvent(eventType, { detail });
                element.dispatchEvent(event);
            }
        }
    }
};

// Make helpers immutable
Object.freeze(window.AppHelpers);
