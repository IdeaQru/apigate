// Serial Page Management - SCOPED EVENT HANDLERS
class SerialPageManager {
    constructor() {
        this.configs = [];
        this.availablePorts = [];
        this.isInitialized = false;
        this.isLoading = false;
        this.namespace = 'serial'; // Namespace identifier
        this.init();
    }

    init() {
        this.setupEventListeners();
        window.addEventListener('tabChanged', (e) => {
            if (e.detail.tab === 'serial') {
                this.onSerialPageActivated();
            }
        });
        this.isInitialized = true;
        console.log('🔌 Serial Page Manager initialized with namespace:', this.namespace);
    }

    setupEventListeners() {
        // Refresh ports button - SPECIFIC SCOPE
        document.addEventListener('click', (e) => {
            if (e.target.closest('#refreshPortsSerial, #refreshPortsCmd')) {
                console.log('🔌 Serial: Refresh ports clicked');
                this.refreshPorts();
            }
        });

        // Serial config form submission - SPECIFIC SCOPE
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'serialConfigForm') {
                e.preventDefault();
                console.log('🔌 Serial: Form submission intercepted');
                this.saveSerialConfig();
            }
        });

        // SCOPED: Config actions - ONLY for Serial configurations
        document.addEventListener('click', async (e) => {
            // CRITICAL: Check if we're in Serial tab and handling Serial elements
            const currentTab = window.navigationManager?.getCurrentTab();
            if (currentTab !== 'serial') {
                return; // Exit immediately if not in Serial tab
            }

            const configItem = e.target.closest('.config-item');
            if (!configItem) return;

            // ADDITIONAL SCOPE CHECK: Verify this is a Serial config container
            const serialConfigList = document.getElementById('serialConfigList');
            if (!serialConfigList || !serialConfigList.contains(configItem)) {
                return; // Not a Serial config item
            }

            // NAMESPACE CHECK: Verify element has Serial identifier
            if (!configItem.classList.contains('serial-config-item') && 
                !configItem.hasAttribute('data-config-type')) {
                return;
            }

            e.preventDefault();
            e.stopPropagation(); // Prevent event bubbling

            const configId = this.getConfigIdFromElement(configItem);
            if (!configId) {
                console.warn('⚠️ Serial: No config ID found');
                return;
            }

            console.log('🔌 Serial: Button clicked for config:', configId);

            // Ensure data sync
            await this.ensureDataSync();

            // Verify config exists
            const config = this.configs.find(c => c.id === configId);
            if (!config) {
                console.error(`❌ Serial: Config ${configId} not found`);
                window.toastManager?.error('Serial Configuration not found. Refreshing...');
                await this.loadSerialData();
                return;
            }

            console.log('✅ Serial: Config found:', config.name);

            // Determine action with namespace check
            const action = this.determineAction(e.target);
            console.log('🎬 Serial: Action determined:', action);

            if (!action) {
                console.warn('⚠️ Serial: No action determined');
                return;
            }

            // Execute action
            try {
                await this.executeAction(action, configId);
            } catch (error) {
                console.error(`❌ Serial: Error executing ${action}:`, error);
                window.toastManager?.error(`Failed to ${action} Serial configuration: ${error.message}`);
                await this.loadSerialData();
            }
        });
    }

    determineAction(target) {
        // Check for Serial-specific action attributes
        if (target.closest('[data-action="launch"][data-config-type="serial"]')) return 'launch';
        if (target.closest('[data-action="edit"][data-config-type="serial"]')) return 'edit';
        if (target.closest('[data-action="delete"][data-config-type="serial"]')) return 'delete';

        // Check Serial-specific button classes
        if (target.closest('.serial-launch-btn')) return 'launch';
        if (target.closest('.serial-edit-btn')) return 'edit';
        if (target.closest('.serial-delete-btn')) return 'delete';

        // Fallback with Serial context check
        if (target.closest('.btn-success') && target.closest('.serial-config-item')) return 'launch';
        if (target.closest('.btn-primary') && target.closest('.serial-config-item')) return 'edit';
        if (target.closest('.btn-danger') && target.closest('.serial-config-item')) return 'delete';

        return null;
    }

    async executeAction(action, configId) {
        console.log(`🎬 Serial: Executing ${action} for config ${configId}`);
        
        switch (action) {
            case 'launch':
                await this.startForwardingSerial(configId);
                break;
            case 'edit':
                this.editConfig(configId);
                break;
            case 'delete':
                await this.deleteConfig(configId);
                break;
            default:
                throw new Error(`Unknown Serial action: ${action}`);
        }
    }

    async ensureDataSync() {
        if (this.isLoading) {
            console.log('⏳ Serial: Already loading, waiting...');
            while (this.isLoading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return;
        }

        const now = Date.now();
        if (this.lastDataLoad && (now - this.lastDataLoad) < 5000) {
            console.log('📊 Serial: Data is recent');
            return;
        }

        console.log('🔄 Serial: Syncing data...');
        await this.loadSerialData();
    }

    async onSerialPageActivated() {
        console.log('🔌 Serial page activated');
        await this.loadSerialData();
    }

    async loadSerialData() {
        if (this.isLoading) return;

        try {
            this.isLoading = true;
            console.log('🔌 Serial: Loading data...');
            
            const [configs, ports] = await Promise.all([
                window.apiService.getSerialConfigs(),
                window.apiService.getSerialPorts()
            ]);

            console.log('🔌 Serial: Data loaded:', {
                configs: configs.length,
                ports: ports.length
            });

            this.configs = configs || [];
            this.availablePorts = ports || [];
            this.lastDataLoad = Date.now();

            this.renderConfigs();
            this.renderAvailablePorts();
            this.updatePortOptions();
            
        } catch (error) {
            console.error('❌ Serial: Failed to load data:', error);
            window.toastManager?.error('Failed to load serial configurations');
        } finally {
            this.isLoading = false;
        }
    }

    renderConfigs() {
        const container = document.getElementById('serialConfigList');
        if (!container) {
            console.warn('⚠️ Serial: Config list container not found');
            return;
        }

        if (this.configs.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
            return;
        }

        container.innerHTML = '';
        this.configs.forEach((config, index) => {
            try {
                const configElement = this.createConfigElement(config, index);
                container.appendChild(configElement);
            } catch (error) {
                console.error('❌ Serial: Error creating config element:', error, config);
            }
        });

        console.log(`✅ Serial: Rendered ${this.configs.length} configurations`);
    }

    createConfigElement(config, index) {
        const div = document.createElement('div');
        // NAMESPACE CLASSES for clear identification
        div.className = `config-item serial-config-item ${config.active ? 'active' : ''}`;
        div.style.animationDelay = `${index * 0.1}s`;
        
        // NAMESPACE ATTRIBUTES
        div.dataset.configId = config.id;
        div.dataset.configType = 'serial';
        div.dataset.namespace = this.namespace;
        div.setAttribute('data-config-id', config.id);
        div.setAttribute('data-config-type', 'serial');
        div.setAttribute('id', `serial-config-${config.id}`);

        const createdDate = config.createdAt ? new Date(config.createdAt).toLocaleString() : 'Unknown';
        const statusEmoji = config.active ? '🟢' : '⚪';
        const statusText = config.active ? 'ONLINE' : 'OFFLINE';

        const safeName = config.name ? config.name.replace(/[<>&"]/g, (c) => ({
            '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;'
        }[c])) : 'Unnamed Configuration';
        const safeSerialPort = config.serialPort || 'Unknown Port';
        const safeBaudRate = (config.baudRate || 9600).toLocaleString();
        const safeTcpOutHost = config.tcpOutHost || '127.0.0.1';
        const safeTcpOutPort = config.tcpOutPort || 4001;

        div.innerHTML = `
            <div class="config-info">
                <h4>
                    🔌 ${safeName}
                    <span class="status-badge ${config.active ? 'status-active' : 'status-inactive'}">
                        ${statusEmoji} ${statusText}
                    </span>
                </h4>
                <p><strong>🔌 Port:</strong> ${safeSerialPort} @ ${safeBaudRate} baud</p>
                <p><strong>🌉 TCP Out:</strong> ${safeTcpOutHost}:${safeTcpOutPort}</p>
                <p><strong>📅 Created:</strong> ${createdDate}</p>
                <p><strong>🆔 ID:</strong> <code title="${config.id}">${config.id.substring(0, 8)}...</code></p>
            </div>
            <div class="config-actions">
                <button class="btn btn-success btn-sm serial-launch-btn" 
                        data-action="launch" 
                        data-config-id="${config.id}"
                        data-config-type="serial"
                        data-namespace="serial"
                        title="Start serial forwarding">
                    <span class="btn-icon">▶️</span>
                    <span>Launch Serial</span>
                </button>
                <button class="btn btn-primary btn-sm serial-edit-btn" 
                        data-action="edit" 
                        data-config-id="${config.id}"
                        data-config-type="serial"
                        data-namespace="serial"
                        title="Edit serial configuration">
                    <span class="btn-icon">✏️</span>
                    <span>Edit</span>
                </button>
                <button class="btn btn-danger btn-sm serial-delete-btn" 
                        data-action="delete" 
                        data-config-id="${config.id}"
                        data-config-type="serial"
                        data-namespace="serial"
                        title="Delete serial configuration">
                    <span class="btn-icon">🗑</span>
                    <span>Delete</span>
                </button>
            </div>
        `;

        return div;
    }

    renderAvailablePorts() {
        const container = document.getElementById('availablePortsList');
        if (!container) {
            console.warn('⚠️ Serial: Available ports container not found');
            return;
        }

        container.innerHTML = '';

        if (this.availablePorts.length === 0) {
            container.innerHTML = `
                <div class="port-scanner-loading">
                    <span class="loading-icon">🔍</span>
                    No serial ports detected - Check connections
                </div>
            `;
            return;
        }

        this.availablePorts.forEach(port => {
            const portElement = this.createPortElement(port);
            container.appendChild(portElement);
        });

        console.log(`✅ Serial: Rendered ${this.availablePorts.length} available ports`);
    }

    createPortElement(port) {
        const div = document.createElement('div');
        div.className = 'port-item serial-port-item';
        div.innerHTML = `
            <strong>${port.path || 'Unknown Path'}</strong>
            <small>📱 ${port.manufacturer || 'Unknown Device'}</small>
            ${port.vendorId ? `<small>🆔 VID: ${port.vendorId}</small>` : ''}
            ${port.productId ? `<small>📦 PID: ${port.productId}</small>` : ''}
        `;
        return div;
    }

    updatePortOptions() {
        const select = document.getElementById('serialPortSelect');
        if (!select) {
            console.warn('⚠️ Serial: Port select element not found');
            return;
        }

        const currentValue = select.value;
        select.innerHTML = '<option value="">🔍 Select a port...</option>';

        this.availablePorts.forEach(port => {
            const option = document.createElement('option');
            option.value = port.path;
            option.textContent = `${port.path} - ${port.manufacturer || 'Unknown Device'}`;
            select.appendChild(option);
        });

        if (currentValue && this.availablePorts.find(p => p.path === currentValue)) {
            select.value = currentValue;
        }
    }

    async saveSerialConfig() {
        const form = document.getElementById('serialConfigForm');
        if (!form) {
            console.error('❌ Serial: Config form not found');
            return;
        }

        const formData = new FormData(form);
        const config = {
            name: formData.get('name')?.trim(),
            serialPort: formData.get('serialPort'),
            baudRate: parseInt(formData.get('baudRate')) || 9600,
            tcpOutHost: formData.get('tcpOutHost')?.trim() || '127.0.0.1',
            tcpOutPort: parseInt(formData.get('tcpOutPort')) || 4001
        };

        console.log('💾 Serial: Saving config:', config);

        if (!this.validateSerialConfig(config)) return;

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalHTML = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="btn-icon">⏳</span><span>Saving...</span>';
        submitBtn.disabled = true;

        try {
            const isEdit = form.dataset.editId;
            let result;

            if (isEdit) {
                console.log(`📝 Serial: Updating config: ${isEdit}`);
                result = await window.apiService.updateSerialConfig(isEdit, config);
                window.toastManager?.success(`🔌 Serial bridge "${config.name}" updated successfully!`);
            } else {
                console.log('➕ Serial: Creating new config');
                result = await window.apiService.createSerialConfig(config);
                window.toastManager?.success(`🔌 Serial bridge "${config.name}" created successfully!`);
            }

            window.modalManager?.close('serialConfigModal');
            await this.loadSerialData();

        } catch (error) {
            console.error('❌ Serial: Save config error:', error);
            window.toastManager?.error(`❌ Failed to save Serial configuration: ${error.message}`);
        } finally {
            submitBtn.innerHTML = originalHTML;
            submitBtn.disabled = false;
        }
    }

    validateSerialConfig(config) {
        const errors = [];

        if (!config.name || config.name.length < 3 || config.name.length > 50) {
            errors.push('Configuration name is required (3-50 characters)');
        }
        if (!config.serialPort) {
            errors.push('Serial port selection is required');
        }
        if (!config.tcpOutHost) {
            errors.push('TCP output host is required');
        }
        if (!config.tcpOutPort || config.tcpOutPort < 1 || config.tcpOutPort > 65535) {
            errors.push('Valid TCP output port (1-65535) is required');
        }

        if (errors.length > 0) {
            console.error('❌ Serial: Validation errors:', errors);
            window.toastManager?.error(`❌ Serial Validation Error: ${errors.join(', ')}`);
            return false;
        }
        return true;
    }

    editConfig(configId) {
        const config = this.configs.find(c => c.id === configId);
        if (!config) {
            console.error(`❌ Serial: Config ${configId} not found for editing`);
            window.toastManager?.error('❌ Serial Configuration not found');
            return;
        }

        console.log('✏️ Serial: Editing config:', config);
        window.modalManager?.open('serialConfigModal', { data: config });
    }

    async deleteConfig(configId) {
        const config = this.configs.find(c => c.id === configId);
        if (!config) {
            console.error(`❌ Serial: Config ${configId} not found for deletion`);
            window.toastManager?.error('❌ Serial Configuration not found');
            return;
        }

        const confirmed = await window.modalManager?.confirm(
            'Delete Serial Configuration',
            `Are you sure you want to delete "${config.name}"? This action cannot be undone and will stop any active forwarding.`
        );

        if (!confirmed) return;

        try {
            console.log(`🗑 Serial: Deleting config: ${configId}`);
            await window.apiService.deleteSerialConfig(configId);
            window.toastManager?.success(`🗑 Serial bridge "${config.name}" deleted successfully!`);
            await this.loadSerialData();
        } catch (error) {
            console.error('❌ Serial: Delete config error:', error);
            window.toastManager?.error(`❌ Failed to delete Serial configuration: ${error.message}`);
        }
    }

    async startForwardingSerial(configId) {
        try {
            console.log(`🎯 Serial: Starting forwarding for: ${configId}`);
            
            const config = this.configs.find(c => c.id === configId);
            if (!config) {
                throw new Error(`Serial Configuration ${configId} not found`);
            }

            console.log(`🚀 Serial: Starting forwarding for: ${config.name} (${configId})`);
            console.log('🔧 Serial: Config details:', {
                name: config.name,
                serialPort: config.serialPort,
                baudRate: config.baudRate,
                tcpOutHost: config.tcpOutHost,
                tcpOutPort: config.tcpOutPort
            });

            // Validation
            if (!config.serialPort) {
                throw new Error('Invalid Serial configuration: Missing serial port');
            }

            if (!config.tcpOutHost || !config.tcpOutPort) {
                throw new Error('Invalid Serial configuration: Missing TCP output');
            }

            // API call with Serial namespace
            const result = await window.apiService.startForwarding('serial', configId);
            console.log('✅ Serial: Forwarding started:', result);

            window.toastManager?.success(`🚀 Serial Bridge "${config.name}" launched successfully!`);
            
            await this.loadSerialData();
            
        } catch (error) {
            console.error('❌ Serial: Start forwarding error:', error);
            
            let errorMessage = 'Failed to launch Serial bridge';
            
            if (error.message.includes('Configuration not found')) {
                errorMessage = 'Serial Configuration not found on server. Refreshing...';
                await this.loadSerialData();
            } else if (error.message.includes('EADDRINUSE')) {
                errorMessage = 'Port already in use. Check TCP output port.';
            } else if (error.message.includes('ENOENT')) {
                errorMessage = 'Serial port not found. Check if device is connected.';
            } else {
                errorMessage = `Failed to launch Serial bridge: ${error.message}`;
            }
            
            window.toastManager?.error(`❌ ${errorMessage}`);
        }
    }

    async refreshPorts() {
        try {
            console.log('🔄 Serial: Refreshing ports...');
            const ports = await window.apiService.getSerialPorts();
            this.availablePorts = ports || [];
            this.renderAvailablePorts();
            this.updatePortOptions();
            window.toastManager?.success(`🔄 Found ${this.availablePorts.length} serial ports`);
        } catch (error) {
            console.error('❌ Serial: Port refresh error:', error);
            window.toastManager?.error('❌ Serial port scanning failed');
        }
    }

    getConfigIdFromElement(element) {
        const configId = element.dataset.configId || 
                        element.getAttribute('data-config-id') ||
                        element.closest('[data-config-id][data-config-type="serial"]')?.dataset.configId ||
                        element.closest('.serial-config-item')?.dataset.configId;

        console.log('🔍 Serial: Extracted config ID:', configId);
        return configId;
    }

    getEmptyStateHTML() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">🔌</div>
                <h3>No Serial Bridges Configured</h3>
                <p>Create your first serial port bridge to start forwarding data from hardware devices</p>
                <button class="btn btn-primary btn-pulse" onclick="window.modalManager?.open('serialConfigModal')">
                    <span class="btn-icon">⚡</span>
                    <span>Create Serial Bridge</span>
                </button>
            </div>
        `;
    }

    getStatus() {
        return {
            namespace: this.namespace,
            isInitialized: this.isInitialized,
            isLoading: this.isLoading,
            configsCount: this.configs.length,
            portsCount: this.availablePorts.length,
            lastDataLoad: this.lastDataLoad,
            configs: this.configs.map(c => ({ 
                id: c.id, 
                name: c.name, 
                active: c.active,
                serialPort: c.serialPort,
                baudRate: c.baudRate,
                tcpOutHost: c.tcpOutHost,
                tcpOutPort: c.tcpOutPort
            }))
        };
    }
}

// Initialize serial page manager
window.serialPageManager = new SerialPageManager();

// Namespaced debug helper
window.debugSerial = function() {
    console.log('=== SERIAL DEBUG ===');
    console.log('Serial manager:', window.serialPageManager);
    console.log('Status:', window.serialPageManager?.getStatus());
    
    // Debug DOM vs local data sync
    const serialConfigItems = document.querySelectorAll('.serial-config-item');
    const domConfigIds = Array.from(serialConfigItems).map(el => el.dataset.configId);
    const localConfigIds = window.serialPageManager?.configs?.map(c => c.id) || [];
    
    console.log('DOM Serial config IDs:', domConfigIds);
    console.log('Local Serial config IDs:', localConfigIds);
    console.log('Serial configs in sync:', JSON.stringify(domConfigIds.sort()) === JSON.stringify(localConfigIds.sort()));
    console.log('===================');
};

console.log('🔌 Namespaced Serial Page Manager loaded');
