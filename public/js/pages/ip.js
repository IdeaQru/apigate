// IP Page Management - COMPLETE PERSISTENT STATE + BACKEND SYNC
class IPPageManager {
    constructor() {
        this.configs = [];
        this.lockedStates = new Map();
        this.isInitialized = false;
        this.isLoading = false;
        this.namespace = 'ip';
        this.statusUpdateInterval = null;
        this.verificationRetries = new Map();
        this.debugMode = true; // Enable debug logging
        
        this.init();
    }

    init() {
        // ✅ PERSISTENCE: Load saved states first
        this.loadPersistentStates();
        
        this.setupEventListeners();
        this.startEnhancedMonitoring();
        
        window.addEventListener('tabChanged', (e) => {
            if (e.detail.tab === 'ip') {
                this.onIPPageActivated();
            }
        });
        
        // ✅ PERSISTENCE: Save states before page unload
        window.addEventListener('beforeunload', () => {
            this.savePersistentStates();
        });
        
        this.isInitialized = true;
        this.log('🔒 IP Manager initialized with COMPLETE PERSISTENT STATE');
    }

    // ✅ DEBUG LOGGING
    log(message, ...args) {
        if (this.debugMode) {
            console.log(`[IPManager] ${message}`, ...args);
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
            
            localStorage.setItem('ipManager_lockStates', JSON.stringify(lockData));
            localStorage.setItem('ipManager_lastSave', Date.now().toString());
            
            this.log(`💾 Saved ${lockData.length} persistent states`);
        } catch (error) {
            console.warn('⚠️ Failed to save persistent states:', error);
        }
    }

    // ✅ PERSISTENCE: Load lock states from localStorage
    loadPersistentStates() {
        try {
            const lockData = localStorage.getItem('ipManager_lockStates');
            const lastSave = localStorage.getItem('ipManager_lastSave');
            
            if (lockData && lastSave) {
                const saveTime = parseInt(lastSave);
                const timeDiff = Date.now() - saveTime;
                
                // Only restore if saved recently (within 2 hours)
                if (timeDiff < 7200000) { // 2 hours
                    const parsed = JSON.parse(lockData);
                    this.lockedStates = new Map(parsed);
                    
                    this.log(`💾 Restored ${this.lockedStates.size} persistent states (${Math.round(timeDiff / 1000)}s ago)`);
                    
                    if (this.lockedStates.size > 0) {
                        this.log('🔒 RESTORED STATES:');
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
            localStorage.removeItem('ipManager_lockStates');
            localStorage.removeItem('ipManager_lastSave');
            this.log('🧹 Cleared persistent states');
        } catch (error) {
            console.warn('⚠️ Failed to clear persistent states:', error);
        }
    }

    // ✅ ENHANCED MONITORING with backend sync
    startEnhancedMonitoring() {
        this.statusUpdateInterval = setInterval(async () => {
            try {
                await this.performEnhancedStatusCheck();
            } catch (error) {
                console.warn('⚠️ Enhanced monitoring error:', error);
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

            // ✅ CRITICAL: Check if backend has instances but frontend doesn't know
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
                        inst.type === 'ip' && 
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
        this.log('🔄 SYNCING UNKNOWN INSTANCES:', backendInstances.length);
        
        for (const instance of backendInstances) {
            if (instance.type === 'ip' && instance.status === 'running') {
                const config = this.configs.find(c => c.id === instance.configId);
                if (config && !this.lockedStates.has(config.id)) {
                    this.log(`🔒 AUTO-LOCKING discovered instance: ${config.name}`);
                    this.lockState(config.id, 'running', 'auto_discovered');
                }
            }
        }
    }

    // ✅ GET CURRENT BUTTON STATE
    getButtonState(configId) {
        const element = document.getElementById(`ip-config-${configId}`);
        if (!element) return 'unknown';
        
        const startBtn = element.querySelector('.ip-start-btn');
        const stopBtn = element.querySelector('.ip-stop-btn');
        
        if (stopBtn && stopBtn.style.display !== 'none') {
            if (stopBtn.disabled) {
                if (stopBtn.innerHTML.includes('Stopping')) return 'stopping';
                if (stopBtn.innerHTML.includes('Verifying')) return 'verifying';
                return 'starting';
            }
            return 'running';
        } else if (startBtn) {
            if (startBtn.disabled) return 'starting';
            return 'stopped';
        }
        
        return 'unknown';
    }

    // ✅ ENHANCED: Lock state with auto-save
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
            this.verificationRetries.delete(configId);
            this.savePersistentStates();
        }
    }

    setButtonState(configId, state) {
        const element = document.getElementById(`ip-config-${configId}`);
        if (!element) return;
        
        const startBtn = element.querySelector('.ip-start-btn');
        const stopBtn = element.querySelector('.ip-stop-btn');
        const statusBadge = element.querySelector('.status-badge');
        
        this.log(`🔧 Setting button: ${configId} → ${state}`);
        
        if (startBtn && stopBtn) {
            switch (state) {
                case 'stopped':
                    startBtn.style.display = 'inline-flex';
                    startBtn.disabled = false;
                    startBtn.innerHTML = '<span>▶️ Start</span>';
                    
                    stopBtn.style.display = 'none';
                    
                    element.classList.remove('active', 'running');
                    if (statusBadge) {
                        statusBadge.innerHTML = '⚪ OFFLINE';
                        statusBadge.className = 'status-badge status-inactive';
                    }
                    break;
                    
                case 'starting':
                    startBtn.style.display = 'inline-flex';
                    startBtn.disabled = true;
                    startBtn.innerHTML = '<span>⏳ Starting...</span>';
                    
                    stopBtn.style.display = 'none';
                    
                    element.classList.add('active');
                    if (statusBadge) {
                        statusBadge.innerHTML = '🟡 STARTING';
                        statusBadge.className = 'status-badge status-warning';
                    }
                    break;
                    
                case 'running':
                    startBtn.style.display = 'none';
                    
                    stopBtn.style.display = 'inline-flex';
                    stopBtn.disabled = false;
                    stopBtn.innerHTML = '<span>⏹️ Stop</span>';
                    
                    element.classList.add('active', 'running');
                    if (statusBadge) {
                        statusBadge.innerHTML = '🟢 RUNNING';
                        statusBadge.className = 'status-badge status-active';
                    }
                    break;
                    
                case 'stopping':
                    startBtn.style.display = 'none';
                    
                    stopBtn.style.display = 'inline-flex';
                    stopBtn.disabled = true;
                    stopBtn.innerHTML = '<span>⏳ Stopping...</span>';
                    
                    element.classList.add('active');
                    if (statusBadge) {
                        statusBadge.innerHTML = '🟡 STOPPING';
                        statusBadge.className = 'status-badge status-warning';
                    }
                    break;
                    
                case 'verifying':
                    startBtn.style.display = 'none';
                    
                    stopBtn.style.display = 'inline-flex';
                    stopBtn.disabled = true;
                    stopBtn.innerHTML = '<span>🔍 Verifying...</span>';
                    
                    if (statusBadge) {
                        statusBadge.innerHTML = '🔍 VERIFYING';
                        statusBadge.className = 'status-badge status-warning';
                    }
                    break;
            }
        }
    }

    setupEventListeners() {
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'ipConfigForm') {
                e.preventDefault();
                this.saveIPConfig();
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.id === 'connectionMode') {
                this.updateConnectionModeHelp(e.target.value);
            }
        });

        document.addEventListener('click', async (e) => {
            const currentTab = window.navigationManager?.getCurrentTab();
            if (currentTab !== 'ip') return;

            const configItem = e.target.closest('.config-item');
            if (!configItem || !configItem.classList.contains('ip-config-item')) return;

            e.preventDefault();
            e.stopPropagation();

            const configId = this.getConfigIdFromElement(configItem);
            if (!configId) return;

            const config = this.configs.find(c => c.id === configId);
            if (!config) return;

            const action = this.determineAction(e.target);
            if (!action) return;

            try {
                await this.executeAction(action, configId);
            } catch (error) {
                console.error(`❌ Action error:`, error);
                window.toastManager?.error(`Failed to ${action}: ${error.message}`);
            }
        });
    }

    determineAction(target) {
        if (target.closest('.ip-start-btn')) return 'start';
        if (target.closest('.ip-stop-btn')) return 'stop';
        if (target.closest('.ip-edit-btn')) return 'edit';
        if (target.closest('.ip-delete-btn')) return 'delete';
        return null;
    }

    async executeAction(action, configId) {
        switch (action) {
            case 'start': await this.startInstance(configId); break;
            case 'stop': await this.stopInstanceWithVerification(configId); break;
            case 'edit': this.editConfig(configId); break;
            case 'delete': await this.deleteConfig(configId); break;
        }
    }

    // ✅ ENHANCED: Start instance with persistence
    async startInstance(configId) {
        try {
            const config = this.configs.find(c => c.id === configId);
            if (!config) {
                window.toastManager?.error('Configuration not found');
                return;
            }

            const currentLock = this.lockedStates.get(configId);
            if (currentLock && (currentLock.state === 'running' || currentLock.state === 'starting')) {
                window.toastManager?.warning(`${config.name} is already running or starting`);
                return;
            }

            this.log(`🚀 STARTING: ${config.name}`);
            this.lockState(configId, 'starting', 'start_requested');

            try {
                // ✅ CRITICAL: Request with persistence
                const result = await window.apiService.startForwarding('ip', configId, {
                    persistent: true,
                    autoRestore: true
                });
                
                this.log('✅ Start API success:', result);

                this.lockState(configId, 'running', 'start_successful');
                window.toastManager?.success(`🚀 ${config.name} started and PERSISTED!`);

                // Verify after delay
                setTimeout(() => this.verifyInstanceState(configId, 'running'), 3000);

            } catch (apiError) {
                console.error('❌ Start API error:', apiError);
                this.unlockState(configId, 'start_failed');
                this.setButtonState(configId, 'stopped');
                window.toastManager?.error(`❌ Failed to start: ${apiError.message}`);
            }

        } catch (error) {
            console.error('❌ Start instance error:', error);
            this.unlockState(configId, 'start_error');
            this.setButtonState(configId, 'stopped');
            window.toastManager?.error(`❌ Start error: ${error.message}`);
        }
    }

    // ✅ ENHANCED: Stop with complete verification
    async stopInstanceWithVerification(configId) {
        try {
            const config = this.configs.find(c => c.id === configId);
            if (!config) {
                window.toastManager?.error('Configuration not found');
                return;
            }

            const currentLock = this.lockedStates.get(configId);
            if (!currentLock || currentLock.state !== 'running') {
                window.toastManager?.warning(`${config.name} is not in locked running state`);
                return;
            }

            this.log(`🛑 STOPPING WITH VERIFICATION: ${config.name}`);
            this.lockState(configId, 'stopping', 'stop_requested');

            let stopSuccess = false;
            const stopMethods = [
                { name: 'Individual Stop', method: () => window.apiService.stopInstance(`ip_${configId}`) },
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
                this.showVerificationFailedActions(configId);
            }

        } catch (error) {
            console.error('❌ Stop with verification error:', error);
            this.lockState(configId, 'running', 'stop_error');
            window.toastManager?.error(`❌ Stop error: ${error.message}`);
        }
    }

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
                        inst.type === 'ip' && 
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

    async verifyInstanceState(configId, expectedState) {
        try {
            const status = await window.apiService.getStatus();
            const instance = status.instances && 
                status.instances.find(inst => 
                    inst.configId === configId && 
                    inst.type === 'ip'
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

    showVerificationFailedActions(configId) {
        const element = document.getElementById(`ip-config-${configId}`);
        if (!element) return;
        
        const config = this.configs.find(c => c.id === configId);
        const configName = config?.name || configId;
        
        let verificationNotice = element.querySelector('.verification-failed-notice');
        if (!verificationNotice) {
            verificationNotice = document.createElement('div');
            verificationNotice.className = 'verification-failed-notice alert alert-warning';
            verificationNotice.innerHTML = `
                <div style="margin-bottom: 10px;">
                    <strong>⚠️ Stop Verification Failed</strong><br>
                    <small>${configName} may still be running</small>
                </div>
                <div class="verification-actions">
                    <button class="btn btn-danger btn-sm" onclick="window.ipPageManager.forceKillInstance('${configId}')">
                        🔥 Force Kill
                    </button>
                    <button class="btn btn-warning btn-sm" onclick="window.ipPageManager.retryStopVerification('${configId}')">
                        🔄 Retry Stop
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window.ipPageManager.ignoreVerificationFailure('${configId}')">
                        ➡️ Ignore
                    </button>
                </div>
            `;
            
            element.appendChild(verificationNotice);
        }
    }

    async forceKillInstance(configId) {
        const config = this.configs.find(c => c.id === configId);
        const configName = config?.name || configId;
        
        this.log(`🔥 FORCE KILLING: ${configName}`);
        
        try {
            const forceMethods = [
                () => window.apiService.emergencyStop(),
                () => fetch('/api/force-kill-all', { method: 'POST' }),
                () => fetch('/api/restart-backend', { method: 'POST' })
            ];
            
            for (const method of forceMethods) {
                try {
                    await method();
                    this.log('✅ Force method executed');
                } catch (error) {
                    this.log('⚠️ Force method failed:', error);
                }
            }
            
            setTimeout(async () => {
                const verified = await this.verifyInstanceStopped(configId, 1);
                if (verified) {
                    this.unlockState(configId, 'force_killed');
                    this.setButtonState(configId, 'stopped');
                    this.removeVerificationNotice(configId);
                    window.toastManager?.success(`🔥 ${configName} force killed!`);
                }
            }, 3000);
            
        } catch (error) {
            console.error('❌ Force kill error:', error);
            window.toastManager?.error(`❌ Force kill failed: ${error.message}`);
        }
    }

    async retryStopVerification(configId) {
        const config = this.configs.find(c => c.id === configId);
        const configName = config?.name || configId;
        
        this.log(`🔄 RETRYING STOP: ${configName}`);
        
        this.lockState(configId, 'verifying', 'retry_verification');
        
        try {
            await window.apiService.emergencyStop();
            
            const verified = await this.verifyInstanceStopped(configId, 2);
            if (verified) {
                this.unlockState(configId, 'retry_successful');
                this.setButtonState(configId, 'stopped');
                this.removeVerificationNotice(configId);
                window.toastManager?.success(`🔄 ${configName} retry successful!`);
            } else {
                this.lockState(configId, 'running', 'retry_failed');
                window.toastManager?.error(`❌ Retry still failed`);
            }
            
        } catch (error) {
            console.error('❌ Retry stop error:', error);
            this.lockState(configId, 'running', 'retry_error');
            window.toastManager?.error(`❌ Retry failed: ${error.message}`);
        }
    }

    ignoreVerificationFailure(configId) {
        const config = this.configs.find(c => c.id === configId);
        const configName = config?.name || configId;
        
        this.log(`➡️ IGNORING VERIFICATION FAILURE: ${configName}`);
        
        this.unlockState(configId, 'verification_ignored');
        this.setButtonState(configId, 'stopped');
        this.removeVerificationNotice(configId);
        
        window.toastManager?.warning(`⚠️ ${configName} verification ignored`);
    }

    removeVerificationNotice(configId) {
        const element = document.getElementById(`ip-config-${configId}`);
        if (element) {
            const notice = element.querySelector('.verification-failed-notice');
            if (notice) {
                notice.remove();
            }
        }
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
                        inst.type === 'ip' && 
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
                        this.showSyncInconsistency(config.id, 'locked_running_backend_stopped');
                    } else if (lockInfo.state === 'stopped' && backendRunning) {
                        this.log(`⚠️ INCONSISTENCY: ${config.name} locked stopped but backend running`);
                        this.showSyncInconsistency(config.id, 'locked_stopped_backend_running');
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

    showSyncInconsistency(configId, type) {
        // Implementation similar to previous version
        this.log(`⚠️ SYNC INCONSISTENCY: ${configId} - ${type}`);
    }

    async loadIPData() {
        if (this.isLoading) return;

        try {
            this.isLoading = true;
            const configs = await window.apiService.getIpConfigs();
            this.configs = configs || [];
            this.log(`📋 Loaded ${this.configs.length} configs`);
            
            this.renderConfigs();
            
            setTimeout(() => {
                this.syncWithBackendAfterLoad();
            }, 1000);
            
        } catch (error) {
            console.error('❌ Load configs error:', error);
            window.toastManager?.error('Failed to load configurations');
        } finally {
            this.isLoading = false;
        }
    }

    async onIPPageActivated() {
        this.log('🌐 IP page activated');
        await this.loadIPData();
    }

    renderConfigs() {
        const container = document.getElementById('ipConfigList');
        if (!container) return;

        if (this.configs.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
            return;
        }

        container.innerHTML = '';
        this.configs.forEach((config, index) => {
            const configElement = this.createConfigElement(config, index);
            container.appendChild(configElement);

            const lockedState = this.lockedStates.get(config.id);
            if (lockedState) {
                this.setButtonState(config.id, lockedState.state);
            }
        });

        this.log(`✅ Rendered ${this.configs.length} configs`);

        if (this.lockedStates.size > 0) {
            this.showLockStatusSummary(container);
        }
    }

    createConfigElement(config, index) {
        const div = document.createElement('div');
        div.className = 'config-item ip-config-item';
        div.style.animationDelay = `${index * 0.1}s`;
        
        div.dataset.configId = config.id;
        div.dataset.configType = 'ip';
        div.setAttribute('data-config-id', config.id);
        div.setAttribute('data-config-type', 'ip');
        div.setAttribute('id', `ip-config-${config.id}`);

        const safeName = (config.name || 'Unnamed').replace(/[<>&"]/g, '');
        const isLocked = this.lockedStates.has(config.id);
        const lockInfo = isLocked ? this.lockedStates.get(config.id) : null;

        div.innerHTML = `
            <div class="config-info">
                <h4>
                    🌐 ${safeName}
                    <span class="status-badge status-inactive">⚪ OFFLINE</span>
                    ${isLocked ? `<span class="lock-indicator">🔒 ${lockInfo.state.toUpperCase()}</span>` : ''}
                </h4>
                <p><strong>🌐 Target:</strong> ${config.ipHost || '127.0.0.1'}:${config.ipPort || 3001}</p>
                <p><strong>🌉 TCP Out:</strong> ${config.tcpOutHost || '127.0.0.1'}:${config.tcpOutPort || 4001}</p>
                <p><strong>🔗 Mode:</strong> ${config.connectionMode === 'client' ? 'TCP Client' : 'TCP Server'}</p>
                ${isLocked ? `<p><strong>🔒 State:</strong> ${lockInfo.state.toUpperCase()} (${lockInfo.reason}) - PERSISTENT</p>` : ''}
                <p><strong>💾 Persistence:</strong> Survives refresh + backend sync</p>
                <p><strong>🔍 Enhanced:</strong> Complete verification + auto-sync</p>
            </div>
            <div class="config-actions">
                <button class="btn btn-success btn-sm ip-start-btn" 
                        onclick="window.ipPageManager.startInstance('${config.id}')"
                        title="Start with PERSISTENCE">
                    <span>▶️ Start</span>
                </button>
                <button class="btn btn-warning btn-sm ip-stop-btn" 
                        onclick="window.ipPageManager.stopInstanceWithVerification('${config.id}')"
                        title="Stop with VERIFICATION"
                        style="display: none;">
                    <span>⏹️ Stop</span>
                </button>
                <button class="btn btn-primary btn-sm ip-edit-btn" 
                        onclick="window.ipPageManager.editConfig('${config.id}')"
                        title="Edit">
                    <span>✏️ Edit</span>
                </button>
                <button class="btn btn-danger btn-sm ip-delete-btn" 
                        onclick="window.ipPageManager.deleteConfig('${config.id}')"
                        title="Delete">
                    <span>🗑 Delete</span>
                </button>
            </div>
        `;

        return div;
    }

    showLockStatusSummary(container) {
        const lockSummary = Array.from(this.lockedStates.entries()).map(([configId, lockInfo]) => {
            const emoji = lockInfo.state === 'running' ? '🟢' : 
                         lockInfo.state === 'starting' ? '🟡' : 
                         lockInfo.state === 'stopping' ? '🟠' : 
                         lockInfo.state === 'verifying' ? '🔍' : '⚪';
            const timeDiff = Math.round((Date.now() - lockInfo.timestamp) / 1000);
            return `${emoji} ${lockInfo.configName}: ${lockInfo.state.toUpperCase()} (${timeDiff}s)`;
        }).join('<br>');

        const summaryHTML = `
            <div class="lock-status-summary alert alert-info">
                <h5>💾 Enhanced Persistent Manager</h5>
                <div style="font-family: monospace; font-size: 0.9em;">
                    ${lockSummary}
                </div>
                <p><small>💾 Persistent states | 🔄 Auto-sync | 🔍 Complete verification</small></p>
            </div>
        `;

        const existingSummary = container.querySelector('.lock-status-summary');
        if (existingSummary) {
            existingSummary.outerHTML = summaryHTML;
        } else {
            container.insertAdjacentHTML('afterbegin', summaryHTML);
        }
    }

    // ✅ Keep existing edit/delete/validation methods
    editConfig(configId) {
        const config = this.configs.find(c => c.id === configId);
        if (!config) {
            window.toastManager?.error('Configuration not found');
            return;
        }

        if (this.lockedStates.has(configId)) {
            const lockInfo = this.lockedStates.get(configId);
            window.toastManager?.warning(`Cannot edit ${config.name} - locked in ${lockInfo.state} state`);
            return;
        }

        window.modalManager?.open('ipConfigModal', { data: config });
        setTimeout(() => {
            this.updateConnectionModeHelp(config.connectionMode || 'server');
        }, 100);
    }

    async deleteConfig(configId) {
        const config = this.configs.find(c => c.id === configId);
        if (!config) {
            window.toastManager?.error('Configuration not found');
            return;
        }

        const lockInfo = this.lockedStates.get(configId);
        if (lockInfo && lockInfo.state === 'running') {
            const confirmed = await window.modalManager?.confirm(
                'Stop and Delete Configuration',
                `"${config.name}" is LOCKED in running state. Stop and delete it?`
            );

            if (confirmed) {
                await this.stopInstanceWithVerification(configId);
                setTimeout(() => this.deleteConfig(configId), 2000);
            }
            return;
        }

        const confirmed = await window.modalManager?.confirm(
            'Delete Configuration',
            `Delete "${config.name}"? This cannot be undone.`
        );

        if (!confirmed) return;

        try {
            await window.apiService.deleteIpConfig(configId);
            this.unlockState(configId, 'config_deleted');
            window.toastManager?.success(`🗑 ${config.name} deleted!`);
            await this.loadIPData();
        } catch (error) {
            console.error('❌ Delete error:', error);
            window.toastManager?.error(`❌ Delete failed: ${error.message}`);
        }
    }

    updateConnectionModeHelp(mode) {
        const helpText = document.getElementById('ipHostHelp');
        if (!helpText) return;

        if (mode === 'client') {
            helpText.textContent = 'Client mode: Enter the IP address of the remote server to connect to.';
            helpText.style.color = 'var(--cyan-neon)';
        } else {
            helpText.textContent = 'Server mode: IP to listen on (use 0.0.0.0 for all interfaces).';
            helpText.style.color = 'var(--text-muted)';
        }
    }

    async saveIPConfig() {
        const form = document.getElementById('ipConfigForm');
        if (!form) return;

        const formData = new FormData(form);
        const config = {
            name: formData.get('name')?.trim(),
            ipHost: formData.get('ipHost')?.trim() || '127.0.0.1',
            ipPort: parseInt(formData.get('ipPort')) || 3001,
            connectionMode: formData.get('connectionMode') || 'server',
            tcpOutHost: formData.get('tcpOutHost')?.trim() || '127.0.0.1',
            tcpOutPort: parseInt(formData.get('tcpOutPort')) || 4001
        };

        if (!this.validateIPConfig(config)) return;

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalHTML = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span>⏳ Saving...</span>';
        submitBtn.disabled = true;

        try {
            const isEdit = form.dataset.editId;
            if (isEdit) {
                await window.apiService.updateIpConfig(isEdit, config);
                window.toastManager?.success(`🌐 ${config.name} updated!`);
            } else {
                await window.apiService.createIpConfig(config);
                window.toastManager?.success(`🌐 ${config.name} created!`);
            }

            window.modalManager?.close('ipConfigModal');
            await this.loadIPData();

        } catch (error) {
            console.error('❌ Save config error:', error);
            window.toastManager?.error(`❌ Save failed: ${error.message}`);
        } finally {
            submitBtn.innerHTML = originalHTML;
            submitBtn.disabled = false;
        }
    }

    validateIPConfig(config) {
        const errors = [];

        if (!config.name || config.name.length < 3) {
            errors.push('Name required (min 3 characters)');
        }
        if (!config.ipHost) {
            errors.push('IP host required');
        }
        if (!config.ipPort || config.ipPort < 1 || config.ipPort > 65535) {
            errors.push('Valid IP port required (1-65535)');
        }
        if (!config.tcpOutHost) {
            errors.push('TCP output host required');
        }
        if (!config.tcpOutPort || config.tcpOutPort < 1 || config.tcpOutPort > 65535) {
            errors.push('Valid TCP output port required (1-65535)');
        }

        if (errors.length > 0) {
            window.toastManager?.error(`❌ Validation: ${errors.join(', ')}`);
            return false;
        }
        return true;
    }

    getConfigIdFromElement(element) {
        return element.dataset.configId ||
            element.getAttribute('data-config-id') ||
            element.closest('[data-config-id]')?.dataset.configId;
    }

    getEmptyStateHTML() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">🌐</div>
                <h3>No Network Bridges Configured</h3>
                <p>Create bridges with enhanced persistent state management</p>
                <p><small>💾 Persistent states | 🔄 Backend sync | 🔍 Complete verification</small></p>
                <button class="btn btn-primary btn-pulse" onclick="window.modalManager?.open('ipConfigModal')">
                    <span class="btn-icon">🚀</span>
                    <span>Create Enhanced Bridge</span>
                </button>
            </div>
        `;
    }

    getStatus() {
        return {
            namespace: this.namespace,
            isInitialized: this.isInitialized,
            configsCount: this.configs.length,
            lockedStatesCount: this.lockedStates.size,
            persistentStatesCount: Array.from(this.lockedStates.values()).filter(info => info.persistent).length,
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
            verificationEnabled: true
        };
    }

    forceUnlock(configId) {
        const lockInfo = this.lockedStates.get(configId);
        if (lockInfo) {
            this.log(`🔓 FORCE UNLOCK: ${lockInfo.configName}`);
            this.unlockState(configId, 'force_unlock');
            this.setButtonState(configId, 'stopped');
            this.removeVerificationNotice(configId);
            return true;
        }
        return false;
    }

    destroy() {
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
        }
        
        this.savePersistentStates();
        
        this.lockedStates.clear();
        this.verificationRetries.clear();
    }
}

// Initialize enhanced IP manager
window.ipPageManager = new IPPageManager();

// ✅ DEBUG HELPERS
window.debugIP = function () {
    const status = window.ipPageManager?.getStatus();
    console.log('=== ENHANCED PERSISTENT IP MANAGER ===');
    console.log('Status:', status);
    console.log('Persistent states:', localStorage.getItem('ipManager_lockStates'));
    console.log('========================================');
};

window.clearAllStates = function() {
    if (window.ipPageManager) {
        window.ipPageManager.clearPersistentStates();
        window.ipPageManager.lockedStates.clear();
        console.log('🧹 All states cleared');
    }
};

window.forceSync = async function() {
    if (window.ipPageManager) {
        console.log('🔄 Force syncing with backend...');
        await window.ipPageManager.syncWithBackendAfterLoad();
    }
};

window.forceKillAll = async function() {
    console.log('🔥 FORCE KILLING ALL...');
    
    try {
        await window.apiService.emergencyStop();
        
        if (window.ipPageManager) {
            window.ipPageManager.configs.forEach(config => {
                window.ipPageManager.forceUnlock(config.id);
            });
        }
        
        console.log('🔥 Force kill completed');
    } catch (error) {
        console.error('❌ Force kill error:', error);
    }
};

console.log('💾 ENHANCED PERSISTENT IP Manager loaded - Complete backend sync + verification enabled');
