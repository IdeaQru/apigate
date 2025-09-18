// Serial Page Management - ENHANCED with STOP + PERSISTENT STATE
class SerialPageManager {
    constructor() {
        this.configs = [];
        this.availablePorts = [];
        this.lockedStates = new Map(); // ✅ NEW: Lock state management
        this.isInitialized = false;
        this.isLoading = false;
        this.namespace = 'serial';
        this.statusUpdateInterval = null; // ✅ NEW: Status monitoring
        this.debugMode = true; // ✅ NEW: Debug logging
        this.init();
    }

    init() {
        // ✅ PERSISTENCE: Load saved states first
        this.loadPersistentStates();
        
        this.setupEventListeners();
        this.startEnhancedMonitoring();
        
        window.addEventListener('tabChanged', (e) => {
            if (e.detail.tab === 'serial') {
                this.onSerialPageActivated();
            }
        });
        
        // ✅ PERSISTENCE: Save states before page unload
        window.addEventListener('beforeunload', () => {
            this.savePersistentStates();
        });
        
        this.isInitialized = true;
        this.log('🔌 Serial Manager initialized with PERSISTENT STATE + STOP functionality');
    }

    // ✅ DEBUG LOGGING
    log(message, ...args) {
        if (this.debugMode) {
            console.log(`[SerialManager] ${message}`, ...args);
        }
    }

    // ✅ PERSISTENCE: Save lock states to localStorage
    savePersistentStates() {
        try {
            const lockData = Array.from(this.lockedStates.entries()).map(([id, info]) => [id, {
                ...info,
                timestamp: Date.now(),
                persistent: true
            }]);
            
            localStorage.setItem('serialManager_lockStates', JSON.stringify(lockData));
            localStorage.setItem('serialManager_lastSave', Date.now().toString());
            
            this.log(`💾 Saved ${lockData.length} persistent states`);
        } catch (error) {
            console.warn('⚠️ Failed to save persistent states:', error);
        }
    }

    // ✅ PERSISTENCE: Load lock states from localStorage
    loadPersistentStates() {
        try {
            const lockData = localStorage.getItem('serialManager_lockStates');
            const lastSave = localStorage.getItem('serialManager_lastSave');
            
            if (lockData && lastSave) {
                const saveTime = parseInt(lastSave);
                const timeDiff = Date.now() - saveTime;
                
                // Only restore if saved recently (within 2 hours)
                if (timeDiff < 7200000) { // 2 hours
                    const parsed = JSON.parse(lockData);
                    this.lockedStates = new Map(parsed);
                    
                    this.log(`💾 Restored ${this.lockedStates.size} persistent states (${Math.round(timeDiff / 1000)}s ago)`);
                    
                    if (this.lockedStates.size > 0) {
                        this.log('🔒 RESTORED SERIAL STATES:');
                        this.lockedStates.forEach((info, configId) => {
                            this.log(`  ${info.configName}: ${info.state} (${info.reason})`);
                        });
                    }
                    return true;
                } else {
                    this.log('⏰ Saved states too old, clearing...');
                    this.clearPersistentStates();
                }
            }
        } catch (error) {
            console.warn('⚠️ Failed to load persistent states:', error);
            this.clearPersistentStates();
        }
        return false;
    }

    clearPersistentStates() {
        try {
            localStorage.removeItem('serialManager_lockStates');
            localStorage.removeItem('serialManager_lastSave');
            this.log('🧹 Cleared persistent states');
        } catch (error) {
            console.warn('⚠️ Failed to clear persistent states:', error);
        }
    }

    // ✅ ENHANCED MONITORING
    startEnhancedMonitoring() {
        this.statusUpdateInterval = setInterval(async () => {
            try {
                await this.performEnhancedStatusCheck();
            } catch (error) {
                console.warn('⚠️ Serial enhanced monitoring error:', error);
            }
        }, 15000); // Every 15 seconds
        
        this.log('📊 Enhanced monitoring started');
    }

    async performEnhancedStatusCheck() {
        try {
            const lockedCount = this.lockedStates.size;
            
            // Get backend status
            const status = await window.apiService.getStatus();
            
            this.log('📊 STATUS CHECK:', {
                lockedStates: lockedCount,
                backendInstances: status.totalInstances,
                backendActive: status.activeInstances,
                instancesArray: status.instances?.length || 0
            });

            // Check for unknown instances
            if (status.instances && status.instances.length > 0 && lockedCount === 0) {
                this.log('🚨 BACKEND HAS INSTANCES BUT FRONTEND HAS NO LOCKS - Syncing...');
                await this.syncUnknownInstances(status.instances);
            }

            // Regular sync for unlocked configs
            this.configs.forEach(config => {
                if (this.lockedStates.has(config.id)) {
                    return; // Skip locked configs
                }
                
                const backendRunning = status.instances && 
                    status.instances.some(inst => 
                        inst.configId === config.id && 
                        inst.type === 'serial' && 
                        inst.status === 'running'
                    );
                
                const currentButtonState = this.getButtonState(config.id);
                const expectedState = backendRunning ? 'running' : 'stopped';
                
                if (currentButtonState !== expectedState) {
                    this.log(`🔄 SYNC: ${config.name} ${currentButtonState} → ${expectedState}`);
                    this.setButtonState(config.id, expectedState);
                }
            });
            
            // Auto-save persistent states
            if (lockedCount > 0) {
                this.savePersistentStates();
            }
            
        } catch (error) {
            console.error('❌ Enhanced status check error:', error);
        }
    }

    // ✅ SYNC: Handle unknown backend instances
    async syncUnknownInstances(backendInstances) {
        this.log('🔄 SYNCING UNKNOWN SERIAL INSTANCES:', backendInstances.length);
        
        for (const instance of backendInstances) {
            if (instance.type === 'serial' && instance.status === 'running') {
                const config = this.configs.find(c => c.id === instance.configId);
                if (config && !this.lockedStates.has(config.id)) {
                    this.log(`🔒 AUTO-LOCKING discovered serial instance: ${config.name}`);
                    this.lockState(config.id, 'running', 'auto_discovered');
                }
            }
        }
    }

    // ✅ LOCK STATE MANAGEMENT
    lockState(configId, state, reason = 'user_action') {
        const config = this.configs.find(c => c.id === configId);
        const configName = config?.name || configId;
        
        this.log(`🔒 LOCKING: ${configName} → ${state} (${reason})`);
        
        this.lockedStates.set(configId, {
            state: state,
            reason: reason,
            timestamp: Date.now(),
            configName: configName,
            locked: true,
            persistent: true
        });
        
        this.savePersistentStates();
        this.setButtonState(configId, state);
    }

    unlockState(configId, reason = 'user_action') {
        const lockInfo = this.lockedStates.get(configId);
        if (lockInfo) {
            this.log(`🔓 UNLOCKING: ${lockInfo.configName} (${reason})`);
            this.lockedStates.delete(configId);
            this.savePersistentStates();
        }
    }

    // ✅ GET CURRENT BUTTON STATE
    getButtonState(configId) {
        const element = document.getElementById(`serial-config-${configId}`);
        if (!element) return 'unknown';
        
        const launchBtn = element.querySelector('.serial-launch-btn, .serial-start-btn');
        const stopBtn = element.querySelector('.serial-stop-btn');
        
        if (stopBtn && stopBtn.style.display !== 'none') {
            if (stopBtn.disabled) {
                if (stopBtn.innerHTML.includes('Stopping')) return 'stopping';
                if (stopBtn.innerHTML.includes('Verifying')) return 'verifying';
                return 'starting';
            }
            return 'running';
        } else if (launchBtn) {
            if (launchBtn.disabled) return 'starting';
            return 'stopped';
        }
        
        return 'unknown';
    }

    // ✅ SET BUTTON STATE
    setButtonState(configId, state) {
        const element = document.getElementById(`serial-config-${configId}`);
        if (!element) return;
        
        const launchBtn = element.querySelector('.serial-launch-btn, .serial-start-btn');
        const stopBtn = element.querySelector('.serial-stop-btn');
        const statusBadge = element.querySelector('.status-badge');
        
        this.log(`🔧 Setting button: ${configId} → ${state}`);
        
        if (launchBtn && stopBtn) {
            switch (state) {
                case 'stopped':
                    launchBtn.style.display = 'inline-flex';
                    launchBtn.disabled = false;
                    launchBtn.innerHTML = '<span class="btn-icon">▶️</span><span>Launch Serial</span>';
                    
                    stopBtn.style.display = 'none';
                    
                    element.classList.remove('active', 'running');
                    if (statusBadge) {
                        statusBadge.innerHTML = '⚪ OFFLINE';
                        statusBadge.className = 'status-badge status-inactive';
                    }
                    break;
                    
                case 'starting':
                    launchBtn.style.display = 'inline-flex';
                    launchBtn.disabled = true;
                    launchBtn.innerHTML = '<span class="btn-icon">⏳</span><span>Starting...</span>';
                    
                    stopBtn.style.display = 'none';
                    
                    element.classList.add('active');
                    if (statusBadge) {
                        statusBadge.innerHTML = '🟡 STARTING';
                        statusBadge.className = 'status-badge status-warning';
                    }
                    break;
                    
                case 'running':
                    launchBtn.style.display = 'none';
                    
                    stopBtn.style.display = 'inline-flex';
                    stopBtn.disabled = false;
                    stopBtn.innerHTML = '<span class="btn-icon">⏹️</span><span>Stop Serial</span>';
                    
                    element.classList.add('active', 'running');
                    if (statusBadge) {
                        statusBadge.innerHTML = '🟢 RUNNING';
                        statusBadge.className = 'status-badge status-active';
                    }
                    break;
                    
                case 'stopping':
                    launchBtn.style.display = 'none';
                    
                    stopBtn.style.display = 'inline-flex';
                    stopBtn.disabled = true;
                    stopBtn.innerHTML = '<span class="btn-icon">⏳</span><span>Stopping...</span>';
                    
                    element.classList.add('active');
                    if (statusBadge) {
                        statusBadge.innerHTML = '🟡 STOPPING';
                        statusBadge.className = 'status-badge status-warning';
                    }
                    break;
                    
                case 'verifying':
                    launchBtn.style.display = 'none';
                    
                    stopBtn.style.display = 'inline-flex';
                    stopBtn.disabled = true;
                    stopBtn.innerHTML = '<span class="btn-icon">🔍</span><span>Verifying...</span>';
                    
                    if (statusBadge) {
                        statusBadge.innerHTML = '🔍 VERIFYING';
                        statusBadge.className = 'status-badge status-warning';
                    }
                    break;
            }
        }
    }

    setupEventListeners() {
        // Refresh ports button - SPECIFIC SCOPE
        document.addEventListener('click', (e) => {
            if (e.target.closest('#refreshPortsSerial, #refreshPortsCmd')) {
                this.log('🔌 Refresh ports clicked');
                this.refreshPorts();
            }
        });

        // Serial config form submission - SPECIFIC SCOPE
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'serialConfigForm') {
                e.preventDefault();
                this.log('🔌 Form submission intercepted');
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

            this.log('🔌 Button clicked for config:', configId);

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

            this.log('✅ Config found:', config.name);

            // Determine action with namespace check
            const action = this.determineAction(e.target);
            this.log('🎬 Action determined:', action);

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
        // ✅ ENHANCED: Include stop action
        if (target.closest('[data-action="launch"][data-config-type="serial"]')) return 'launch';
        if (target.closest('[data-action="stop"][data-config-type="serial"]')) return 'stop';
        if (target.closest('[data-action="edit"][data-config-type="serial"]')) return 'edit';
        if (target.closest('[data-action="delete"][data-config-type="serial"]')) return 'delete';

        // Check Serial-specific button classes
        if (target.closest('.serial-launch-btn, .serial-start-btn')) return 'launch';
        if (target.closest('.serial-stop-btn')) return 'stop';
        if (target.closest('.serial-edit-btn')) return 'edit';
        if (target.closest('.serial-delete-btn')) return 'delete';

        // Fallback with Serial context check
        if (target.closest('.btn-success') && target.closest('.serial-config-item')) return 'launch';
        if (target.closest('.btn-warning') && target.closest('.serial-config-item')) return 'stop';
        if (target.closest('.btn-primary') && target.closest('.serial-config-item')) return 'edit';
        if (target.closest('.btn-danger') && target.closest('.serial-config-item')) return 'delete';

        return null;
    }

    async executeAction(action, configId) {
        this.log(`🎬 Executing ${action} for config ${configId}`);
        
        switch (action) {
            case 'launch':
                await this.startForwardingSerial(configId);
                break;
            case 'stop':
                await this.stopForwardingSerial(configId);
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
            this.log('⏳ Already loading, waiting...');
            while (this.isLoading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return;
        }

        const now = Date.now();
        if (this.lastDataLoad && (now - this.lastDataLoad) < 5000) {
            this.log('📊 Data is recent');
            return;
        }

        this.log('🔄 Syncing data...');
        await this.loadSerialData();
    }

    async onSerialPageActivated() {
        this.log('🔌 Serial page activated');
        await this.loadSerialData();
        await this.syncWithBackendAfterLoad();
    }

    // ✅ SYNC: Backend sync after page load
    async syncWithBackendAfterLoad() {
        try {
            this.log('🔄 SYNCING with backend after load...');
            
            const status = await window.apiService.getStatus();
            this.log('📊 Backend status:', {
                totalInstances: status.totalInstances,
                activeInstances: status.activeInstances,
                instancesCount: status.instances?.length || 0
            });
            
            this.configs.forEach(config => {
                const lockInfo = this.lockedStates.get(config.id);
                const backendRunning = status.instances && 
                    status.instances.some(inst => 
                        inst.configId === config.id && 
                        inst.type === 'serial' && 
                        inst.status === 'running'
                    );
                
                this.log(`🔍 SYNC: ${config.name}`, {
                    locked: lockInfo?.state || 'none',
                    backend: backendRunning
                });
                
                if (lockInfo) {
                    this.setButtonState(config.id, lockInfo.state);
                    
                    if (lockInfo.state === 'running' && !backendRunning) {
                        this.log(`⚠️ INCONSISTENCY: ${config.name} locked running but backend stopped`);
                    } else if (lockInfo.state === 'stopped' && backendRunning) {
                        this.log(`⚠️ INCONSISTENCY: ${config.name} locked stopped but backend running`);
                    }
                } else {
                    const uiState = backendRunning ? 'running' : 'stopped';
                    this.setButtonState(config.id, uiState);
                }
            });
            
            this.log('✅ SYNC COMPLETE');
            
        } catch (error) {
            console.error('❌ Sync after load error:', error);
        }
    }

    async loadSerialData() {
        if (this.isLoading) return;

        try {
            this.isLoading = true;
            this.log('🔌 Loading data...');
            
            const [configs, ports] = await Promise.all([
                window.apiService.getSerialConfigs(),
                window.apiService.getSerialPorts()
            ]);

            this.log('🔌 Data loaded:', {
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

                // Apply lock state if exists
                const lockedState = this.lockedStates.get(config.id);
                if (lockedState) {
                    this.setButtonState(config.id, lockedState.state);
                }
            } catch (error) {
                console.error('❌ Serial: Error creating config element:', error, config);
            }
        });

        this.log(`✅ Rendered ${this.configs.length} configurations`);

        // Show lock status summary if any locks exist
        if (this.lockedStates.size > 0) {
            this.showLockStatusSummary(container);
        }
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

        // Check if locked
        const isLocked = this.lockedStates.has(config.id);
        const lockInfo = isLocked ? this.lockedStates.get(config.id) : null;

        div.innerHTML = `
            <div class="config-info">
                <h4>
                    🔌 ${safeName}
                    <span class="status-badge ${config.active ? 'status-active' : 'status-inactive'}">
                        ${statusEmoji} ${statusText}
                    </span>
                    ${isLocked ? `<span class="lock-indicator">🔒 ${lockInfo.state.toUpperCase()}</span>` : ''}
                </h4>
                <p><strong>🔌 Port:</strong> ${safeSerialPort} @ ${safeBaudRate} baud</p>
                <p><strong>🌉 TCP Out:</strong> ${safeTcpOutHost}:${safeTcpOutPort}</p>
                <p><strong>📅 Created:</strong> ${createdDate}</p>
                ${isLocked ? `<p><strong>🔒 State:</strong> ${lockInfo.state.toUpperCase()} (${lockInfo.reason}) - PERSISTENT</p>` : ''}
                <p><strong>💾 Persistence:</strong> Survives refresh + backend sync</p>
                <p><strong>🆔 ID:</strong> <code title="${config.id}">${config.id.substring(0, 8)}...</code></p>
            </div>
            <div class="config-actions">
                <button class="btn btn-success btn-sm serial-launch-btn serial-start-btn" 
                        data-action="launch" 
                        data-config-id="${config.id}"
                        data-config-type="serial"
                        data-namespace="serial"
                        title="Start serial forwarding with PERSISTENCE">
                    <span class="btn-icon">▶️</span>
                    <span>Launch Serial</span>
                </button>
                <button class="btn btn-warning btn-sm serial-stop-btn" 
                        data-action="stop" 
                        data-config-id="${config.id}"
                        data-config-type="serial"
                        data-namespace="serial"
                        title="Stop serial forwarding"
                        style="display: none;">
                    <span class="btn-icon">⏹️</span>
                    <span>Stop Serial</span>
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

    // ✅ SHOW LOCK STATUS SUMMARY
    showLockStatusSummary(container) {
        const lockSummary = Array.from(this.lockedStates.entries()).map(([configId, lockInfo]) => {
            const emoji = lockInfo.state === 'running' ? '🟢' : 
                         lockInfo.state === 'starting' ? '🟡' : 
                         lockInfo.state === 'stopping' ? '🟠' : 
                         lockInfo.state === 'verifying' ? '🔍' : '⚪';
            const timeDiff = Math.round((Date.now() - lockInfo.timestamp) / 1000);
            return `${emoji} ${lockInfo.configName}: ${lockInfo.state.toUpperCase()} (${timeDiff}s)`;
        }).join('<br>');

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

        this.log(`✅ Rendered ${this.availablePorts.length} available ports`);
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

        this.log('💾 Saving config:', config);

        if (!this.validateSerialConfig(config)) return;

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalHTML = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="btn-icon">⏳</span><span>Saving...</span>';
        submitBtn.disabled = true;

        try {
            const isEdit = form.dataset.editId;
            let result;

            if (isEdit) {
                this.log(`📝 Updating config: ${isEdit}`);
                result = await window.apiService.updateSerialConfig(isEdit, config);
                window.toastManager?.success(`🔌 Serial bridge "${config.name}" updated successfully!`);
            } else {
                this.log('➕ Creating new config');
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

        // Check if locked
        if (this.lockedStates.has(configId)) {
            const lockInfo = this.lockedStates.get(configId);
            window.toastManager?.warning(`Cannot edit ${config.name} - locked in ${lockInfo.state} state`);
            return;
        }

        this.log('✏️ Editing config:', config);
        window.modalManager?.open('serialConfigModal', { data: config });
    }

    async deleteConfig(configId) {
        const config = this.configs.find(c => c.id === configId);
        if (!config) {
            console.error(`❌ Serial: Config ${configId} not found for deletion`);
            window.toastManager?.error('❌ Serial Configuration not found');
            return;
        }

        // Check if locked and running
        const lockInfo = this.lockedStates.get(configId);
        if (lockInfo && lockInfo.state === 'running') {
            const confirmed = await window.modalManager?.confirm(
                'Stop and Delete Configuration',
                `"${config.name}" is LOCKED in running state. Stop and delete it?`
            );

            if (confirmed) {
                await this.stopForwardingSerial(configId);
                setTimeout(() => this.deleteConfig(configId), 2000);
            }
            return;
        }

        const confirmed = await window.modalManager?.confirm(
            'Delete Serial Configuration',
            `Are you sure you want to delete "${config.name}"? This action cannot be undone and will stop any active forwarding.`
        );

        if (!confirmed) return;

        try {
            this.log(`🗑 Deleting config: ${configId}`);
            await window.apiService.deleteSerialConfig(configId);
            this.unlockState(configId, 'config_deleted');
            window.toastManager?.success(`🗑 Serial bridge "${config.name}" deleted successfully!`);
            await this.loadSerialData();
        } catch (error) {
            console.error('❌ Serial: Delete config error:', error);
            window.toastManager?.error(`❌ Failed to delete Serial configuration: ${error.message}`);
        }
    }

    // ✅ START FORWARDING with PERSISTENCE
    async startForwardingSerial(configId) {
        try {
            this.log(`🎯 Starting forwarding for: ${configId}`);
            
            const config = this.configs.find(c => c.id === configId);
            if (!config) {
                throw new Error(`Serial Configuration ${configId} not found`);
            }

            // Check if already locked
            const currentLock = this.lockedStates.get(configId);
            if (currentLock && (currentLock.state === 'running' || currentLock.state === 'starting')) {
                window.toastManager?.warning(`${config.name} is already running or starting`);
                return;
            }

            this.log(`🚀 Starting forwarding for: ${config.name} (${configId})`);
            this.log('🔧 Config details:', {
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

            // Lock as starting
            this.lockState(configId, 'starting', 'start_requested');

            try {
                // API call with Serial namespace and persistence
                const result = await window.apiService.startForwarding('serial', configId, {
                    persistent: true,
                    autoRestore: true
                });
                
                this.log('✅ Forwarding started:', result);

                // Lock as running
                this.lockState(configId, 'running', 'start_successful');
                window.toastManager?.success(`🚀 Serial Bridge "${config.name}" launched and PERSISTED!`);
                
                // Verify after delay
                setTimeout(() => this.verifyInstanceState(configId, 'running'), 3000);

            } catch (apiError) {
                console.error('❌ Start API error:', apiError);
                this.unlockState(configId, 'start_failed');
                this.setButtonState(configId, 'stopped');
                throw apiError;
            }
            
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

    // ✅ NEW: STOP FORWARDING with VERIFICATION
    async stopForwardingSerial(configId) {
        try {
            const config = this.configs.find(c => c.id === configId);
            if (!config) {
                window.toastManager?.error('Serial Configuration not found');
                return;
            }

            const currentLock = this.lockedStates.get(configId);
            if (!currentLock || currentLock.state !== 'running') {
                window.toastManager?.warning(`${config.name} is not in locked running state`);
                return;
            }

            this.log(`🛑 STOPPING with verification: ${config.name}`);
            this.lockState(configId, 'stopping', 'stop_requested');

            let stopSuccess = false;
            const stopMethods = [
                { name: 'Individual Stop', method: () => window.apiService.stopInstance(`serial_${configId}`) },
                { name: 'Global Stop', method: () => window.apiService.stopForwarding() },
                { name: 'Emergency Stop', method: () => window.apiService.emergencyStop() }
            ];

            for (const stopMethod of stopMethods) {
                try {
                    this.log(`🧪 Trying: ${stopMethod.name}`);
                    await stopMethod.method();
                    this.log(`✅ ${stopMethod.name} successful`);
                    stopSuccess = true;
                    break;
                } catch (methodError) {
                    this.log(`⚠️ ${stopMethod.name} failed:`, methodError.message);
                    continue;
                }
            }

            if (!stopSuccess) {
                throw new Error('All stop methods failed');
            }

            this.log(`🔍 VERIFYING STOP: ${config.name}`);
            this.lockState(configId, 'verifying', 'stop_verifying');

            const isStoppedVerified = await this.verifyInstanceStopped(configId, 3);

            if (isStoppedVerified) {
                this.unlockState(configId, 'stop_verified');
                this.setButtonState(configId, 'stopped');
                window.toastManager?.success(`🛑 ${config.name} stopped and VERIFIED!`);
                this.log(`✅ COMPLETE STOP VERIFIED: ${config.name}`);
            } else {
                console.error(`❌ STOP VERIFICATION FAILED: ${config.name}`);
                this.lockState(configId, 'running', 'stop_verification_failed');
                window.toastManager?.error(`❌ ${config.name} stop verification failed`);
            }

        } catch (error) {
            console.error('❌ Stop forwarding error:', error);
            this.lockState(configId, 'running', 'stop_error');
            window.toastManager?.error(`❌ Stop error: ${error.message}`);
        }
    }

    // ✅ VERIFY INSTANCE STOPPED
    async verifyInstanceStopped(configId, maxRetries = 3) {
        const config = this.configs.find(c => c.id === configId);
        const configName = config?.name || configId;
        
        for (let retry = 1; retry <= maxRetries; retry++) {
            try {
                this.log(`🔍 Verification ${retry}/${maxRetries}: ${configName}`);
                
                await new Promise(resolve => setTimeout(resolve, 2000 * retry));
                
                const status = await window.apiService.getStatus();
                
                const stillRunning = status.instances && 
                    status.instances.some(inst => 
                        inst.configId === configId && 
                        inst.type === 'serial' && 
                        inst.status === 'running'
                    );
                
                if (!stillRunning) {
                    this.log(`✅ VERIFICATION SUCCESS: ${configName} stopped`);
                    return true;
                }
                
                this.log(`⚠️ VERIFICATION RETRY ${retry}: ${configName} still running`);
                
                if (retry < maxRetries) {
                    try {
                        await window.apiService.emergencyStop();
                    } catch (additionalStopError) {
                        this.log('Additional stop failed:', additionalStopError.message);
                    }
                }
                
            } catch (verifyError) {
                console.error(`❌ Verification attempt ${retry} failed:`, verifyError);
            }
        }
        
        console.error(`❌ VERIFICATION FAILED: ${configName}`);
        return false;
    }

    // ✅ VERIFY INSTANCE STATE
    async verifyInstanceState(configId, expectedState) {
        try {
            const status = await window.apiService.getStatus();
            const instance = status.instances && 
                status.instances.find(inst => 
                    inst.configId === configId && 
                    inst.type === 'serial'
                );
            
            const config = this.configs.find(c => c.id === configId);
            const configName = config?.name || configId;
            
            if (instance && instance.status === expectedState) {
                this.log(`✅ STATE VERIFICATION: ${configName} is ${expectedState}`);
            } else {
                this.log(`⚠️ STATE VERIFICATION: ${configName} expected ${expectedState}, got ${instance?.status || 'not found'}`);
            }
            
        } catch (error) {
            console.error('❌ State verification error:', error);
        }
    }

    async refreshPorts() {
        try {
            this.log('🔄 Refreshing ports...');
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

        this.log('🔍 Extracted config ID:', configId);
        return configId;
    }

    getEmptyStateHTML() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">🔌</div>
                <h3>No Serial Bridges Configured</h3>
                <p>Create your first serial bridge with enhanced persistent state management</p>
                <p><small>💾 Persistent states | 🔄 Backend sync | 🔍 Complete verification</small></p>
                <button class="btn btn-primary btn-pulse" onclick="window.modalManager?.open('serialConfigModal')">
                    <span class="btn-icon">⚡</span>
                    <span>Create Enhanced Serial Bridge</span>
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
            lockedStatesCount: this.lockedStates.size,
            persistentStatesCount: Array.from(this.lockedStates.values()).filter(info => info.persistent).length,
            lastDataLoad: this.lastDataLoad,
            lockedConfigs: Array.from(this.lockedStates.entries()).map(([id, info]) => ({
                configId: id,
                configName: info.configName,
                state: info.state,
                reason: info.reason,
                persistent: info.persistent || false,
                timestamp: info.timestamp,
                age: Math.round((Date.now() - info.timestamp) / 1000)
            })),
            enhanced: true,
            persistenceEnabled: true,
            backendSyncEnabled: true,
            verificationEnabled: true,
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

    // ✅ FORCE UNLOCK
    forceUnlock(configId) {
        const lockInfo = this.lockedStates.get(configId);
        if (lockInfo) {
            this.log(`🔓 FORCE UNLOCK: ${lockInfo.configName}`);
            this.unlockState(configId, 'force_unlock');
            this.setButtonState(configId, 'stopped');
            return true;
        }
        return false;
    }

    // ✅ DESTROY
    destroy() {
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
        }
        
        this.savePersistentStates();
        
        this.lockedStates.clear();
    }
}

// Initialize enhanced serial page manager
window.serialPageManager = new SerialPageManager();

// ✅ ENHANCED DEBUG HELPERS
window.debugSerial = function() {
    const status = window.serialPageManager?.getStatus();
    console.log('=== ENHANCED SERIAL DEBUG ===');
    console.log('Status:', status);
    console.log('Persistent states:', localStorage.getItem('serialManager_lockStates'));
    
    // Debug DOM vs local data sync
    const serialConfigItems = document.querySelectorAll('.serial-config-item');
    const domConfigIds = Array.from(serialConfigItems).map(el => el.dataset.configId);
    const localConfigIds = window.serialPageManager?.configs?.map(c => c.id) || [];
    
    console.log('DOM Serial config IDs:', domConfigIds);
    console.log('Local Serial config IDs:', localConfigIds);
    console.log('Serial configs in sync:', JSON.stringify(domConfigIds.sort()) === JSON.stringify(localConfigIds.sort()));
    console.log('==============================');
};

window.clearSerialStates = function() {
    if (window.serialPageManager) {
        window.serialPageManager.clearPersistentStates();
        window.serialPageManager.lockedStates.clear();
        console.log('🧹 All serial states cleared');
    }
};

window.forceSerialSync = async function() {
    if (window.serialPageManager) {
        console.log('🔄 Force syncing serial with backend...');
        await window.serialPageManager.syncWithBackendAfterLoad();
    }
};

window.forceKillAllSerial = async function() {
    console.log('🔥 FORCE KILLING ALL SERIAL...');
    
    try {
        await window.apiService.emergencyStop();
        
        if (window.serialPageManager) {
            window.serialPageManager.configs.forEach(config => {
                window.serialPageManager.forceUnlock(config.id);
            });
        }
        
        console.log('🔥 Force kill serial completed');
    } catch (error) {
        console.error('❌ Force kill serial error:', error);
    }
};

console.log('🔌 ENHANCED Serial Page Manager loaded with STOP + PERSISTENT STATE');
