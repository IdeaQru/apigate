// Toast Notification System
class ToastManager {
    constructor() {
        this.toasts = [];
        this.maxToasts = window.APP_CONSTANTS?.UI?.TOAST_MAX_COUNT || 3;
        this.defaultDuration = window.APP_CONSTANTS?.UI?.TOAST_DURATION || 5000;
        this.container = null;
        this.init();
    }

    init() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            this.createContainer();
        }
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'toastContainer';
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = this.defaultDuration) {
        const toast = this.createToast(message, type, duration);
        this.addToast(toast);
        return toast;
    }

    createToast(message, type, duration) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: '💡'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${icons[type] || icons.info}</span>
                <span class="toast-message">${window.AppHelpers.string.escapeHtml(message)}</span>
            </div>
            <button class="toast-close" type="button">&times;</button>
        `;

        // Add close event
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.hide(toast));

        // Auto-hide
        if (duration > 0) {
            setTimeout(() => this.hide(toast), duration);
        }

        return toast;
    }

    addToast(toast) {
        // Remove excess toasts
        while (this.toasts.length >= this.maxToasts) {
            this.hide(this.toasts[0]);
        }

        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Trigger entrance animation
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0) scale(1)';
        });
    }

    hide(toast) {
        if (!toast || !toast.parentNode) return;

        // Exit animation
        toast.style.transform = 'translateX(100%) scale(0.8)';
        toast.style.opacity = '0';

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            
            const index = this.toasts.indexOf(toast);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
        }, 300);
    }

    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }

    clear() {
        [...this.toasts].forEach(toast => this.hide(toast));
    }
}

// Initialize toast manager
window.toastManager = new ToastManager();
