// Modal Management System
class ModalManager {
    constructor() {
        this.openModals = new Set();
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Close modal on backdrop click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.close(modal.id);
                }
            }
        });

        // Close modal on close button click
        document.addEventListener('click', (e) => {
            if (e.target.closest('.modal-close')) {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.close(modal.id);
                }
            }
        });

        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAll();
            }
        });

        // Prevent modal content clicks from closing modal
        document.addEventListener('click', (e) => {
            if (e.target.closest('.modal-content')) {
                e.stopPropagation();
            }
        });
    }

    open(modalId, options = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal ${modalId} not found`);
            return false;
        }

        console.log(`🎭 Opening modal: ${modalId}`);

        // Prevent body scroll
        document.body.style.overflow = 'hidden';

        // Show modal
        modal.style.display = 'block';
        this.openModals.add(modalId);

        // Add entrance animation
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.style.transform = 'scale(0.8) translateY(-50px)';
            content.style.opacity = '0';
            
            requestAnimationFrame(() => {
                content.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
                content.style.transform = 'scale(1) translateY(0)';
                content.style.opacity = '1';
            });
        }

        // Focus first input
        setTimeout(() => {
            const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }, 200);

        // Set up modal body scrolling
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.style.maxHeight = 'calc(90vh - 200px)';
            modalBody.style.overflowY = 'auto';
        }

        // Handle options
        if (options.data) {
            this.populateForm(modal, options.data);
        }

        return true;
    }

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal || !this.openModals.has(modalId)) return false;

        console.log(`🎭 Closing modal: ${modalId}`);

        const content = modal.querySelector('.modal-content');
        if (content) {
            content.style.transition = 'all 0.3s ease-out';
            content.style.transform = 'scale(0.8) translateY(-30px)';
            content.style.opacity = '0';
            
            setTimeout(() => {
                modal.style.display = 'none';
                content.style.transition = '';
                content.style.transform = '';
                content.style.opacity = '';
                
                // Restore body scroll if no modals are open
                this.openModals.delete(modalId);
                if (this.openModals.size === 0) {
                    document.body.style.overflow = '';
                }
            }, 300);
        } else {
            modal.style.display = 'none';
            this.openModals.delete(modalId);
            if (this.openModals.size === 0) {
                document.body.style.overflow = '';
            }
        }

        // Clear form
        this.clearForm(modal);

        return true;
    }

    closeAll() {
        [...this.openModals].forEach(modalId => this.close(modalId));
    }

    isOpen(modalId) {
        return this.openModals.has(modalId);
    }

    populateForm(modal, data) {
        const form = modal.querySelector('form');
        if (!form) return;

        Object.entries(data).forEach(([key, value]) => {
            const field = form.querySelector(`[name="${key}"]`);
            if (field) {
                field.value = value;
            }
        });

        // Set edit mode
        form.dataset.editId = data.id;

        // Update modal title for edit mode
        const titleElement = modal.querySelector('.modal-title-text h3');
        if (titleElement && titleElement.textContent.includes('Configuration')) {
            titleElement.textContent = titleElement.textContent.replace('Configuration', 'Edit Configuration');
        }
    }

    clearForm(modal) {
        const form = modal.querySelector('form');
        if (!form) return;

        form.reset();
        delete form.dataset.editId;

        // Reset modal title
        const titleElement = modal.querySelector('.modal-title-text h3');
        if (titleElement && titleElement.textContent.includes('Edit')) {
            titleElement.textContent = titleElement.textContent.replace('Edit ', '');
        }
    }

    confirm(title, message, onConfirm, onCancel) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            if (!modal) {
                resolve(false);
                return;
            }

            // Set content
            const titleEl = modal.querySelector('#confirmTitle');
            const messageEl = modal.querySelector('#confirmMessage');
            const okBtn = modal.querySelector('#confirmOkBtn');

            if (titleEl) titleEl.textContent = title;
            if (messageEl) messageEl.textContent = message;

            // Set up handlers
            const handleConfirm = () => {
                this.close('confirmModal');
                if (onConfirm) onConfirm();
                resolve(true);
            };

            const handleCancel = () => {
                this.close('confirmModal');
                if (onCancel) onCancel();
                resolve(false);
            };

            // Remove existing event listeners
            const newOkBtn = okBtn.cloneNode(true);
            okBtn.parentNode.replaceChild(newOkBtn, okBtn);

            // Add new event listeners
            newOkBtn.addEventListener('click', handleConfirm);

            // Open modal
            this.open('confirmModal');
        });
    }
}

// Initialize modal manager
window.modalManager = new ModalManager();
