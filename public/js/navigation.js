// Navigation Management - COMPLETE VERSION
class NavigationManager {
    constructor() {
        this.currentTab = 'dashboard';
        this.currentMissionTab = 'overview';
        this.init();
    }

    async init() {
        console.log('🎯 Navigation Manager initializing...');
        this.setupMainNavigation();
        this.setupMissionNavigation();
        
        // Load content dari file HTML
        await this.loadPageContent();
        
        // Trigger content loaded event
        window.dispatchEvent(new CustomEvent('contentLoaded'));
        console.log('🎯 Navigation Manager initialized and content loaded');
    }

    setupMainNavigation() {
        console.log('🎯 Setting up main navigation...');
        
        // Main sidebar navigation
        const sidebarNav = document.querySelector('.sidebar-nav');
        if (sidebarNav) {
            sidebarNav.addEventListener('click', (e) => {
                const navItem = e.target.closest('.nav-item[data-tab]');
                if (!navItem) return;
                
                e.preventDefault();
                const tabName = navItem.dataset.tab;
                this.switchMainTab(tabName);
            });
            console.log('✅ Main navigation events attached');
        } else {
            console.warn('⚠️ Sidebar navigation not found');
        }
    }

    setupMissionNavigation() {
        console.log('🎯 Setting up mission navigation...');
        
        // Mission control sub-navigation - will be set up after content loads
        document.addEventListener('click', (e) => {
            const missionBtn = e.target.closest('.mission-tab-btn[data-mission-tab]');
            if (!missionBtn) return;
            
            e.preventDefault();
            const missionTab = missionBtn.dataset.missionTab;
            this.switchMissionTab(missionTab);
        });
        console.log('✅ Mission navigation events attached');
    }

    async loadPageContent() {
        console.log('🔄 Loading page content from HTML files...');
        
        try {
            // Load semua file HTML secara parallel
            const [dashboardResponse, serialResponse, ipResponse, monitorResponse, modalsResponse] = await Promise.allSettled([
                fetch('pages/dashboard.html'),
                fetch('pages/serial.html'), 
                fetch('pages/ip.html'),
                fetch('pages/monitor.html'),
                fetch('pages/modals.html')
            ]);

            // Load dashboard content
            if (dashboardResponse.status === 'fulfilled' && dashboardResponse.value.ok) {
                const dashboardHTML = await dashboardResponse.value.text();
                const dashboardContainer = document.getElementById('dashboardTab');
                if (dashboardContainer) {
                    dashboardContainer.innerHTML = dashboardHTML;
                    console.log('✅ Dashboard content loaded from dashboard.html');
                }
            } else {
                console.warn('⚠️ Failed to load dashboard.html, using fallback');
                this.loadDashboardFallback();
            }

            // Load serial content
            if (serialResponse.status === 'fulfilled' && serialResponse.value.ok) {
                const serialHTML = await serialResponse.value.text();
                const serialContainer = document.getElementById('serialTab');
                if (serialContainer) {
                    serialContainer.innerHTML = serialHTML;
                    console.log('✅ Serial content loaded from serial.html');
                }
            } else {
                console.warn('⚠️ Failed to load serial.html, using fallback');
                this.loadSerialFallback();
            }

            // Load IP content
            if (ipResponse.status === 'fulfilled' && ipResponse.value.ok) {
                const ipHTML = await ipResponse.value.text();
                const ipContainer = document.getElementById('ipTab');
                if (ipContainer) {
                    ipContainer.innerHTML = ipHTML;
                    console.log('✅ IP content loaded from ip.html');
                }
            } else {
                console.warn('⚠️ Failed to load ip.html, using fallback');
                this.loadIPFallback();
            }

            // Load monitor content
            if (monitorResponse.status === 'fulfilled' && monitorResponse.value.ok) {
                const monitorHTML = await monitorResponse.value.text();
                const monitorContainer = document.getElementById('monitorTab');
                if (monitorContainer) {
                    monitorContainer.innerHTML = monitorHTML;
                    console.log('✅ Monitor content loaded from monitor.html');
                }
            } else {
                console.warn('⚠️ Failed to load monitor.html, using fallback');
                this.loadMonitorFallback();
            }

            // Load modals
            if (modalsResponse.status === 'fulfilled' && modalsResponse.value.ok) {
                const modalsHTML = await modalsResponse.value.text();
                const modalsContainer = document.getElementById('modalsContainer');
                if (modalsContainer) {
                    modalsContainer.innerHTML = modalsHTML;
                    console.log('✅ Modals content loaded from modals.html');
                }
            } else {
                console.warn('⚠️ Failed to load modals.html, using fallback');
                this.loadModalsFallback();
            }
            
        } catch (error) {
            console.error('❌ Error loading page content:', error);
            this.loadAllFallbacks();
        }
    }

    loadDashboardFallback() {
        console.log('🔧 Loading dashboard fallback content...');
        const dashboardContainer = document.getElementById('dashboardTab');
        if (dashboardContainer) {
            dashboardContainer.innerHTML = `
                <div class="mission-control-container">
                    <div class="content-error">
                        <h3>⚠️ Dashboard Content Loading Error</h3>
                        <p>Unable to load dashboard.html. Using fallback content.</p>
                        <div class="hero-stats">
                            <div class="stat-card stat-primary">
                                <div class="stat-icon">🔌</div>
                                <div class="stat-content">
                                    <div class="stat-number" id="serialCount">0</div>
                                    <div class="stat-label">Serial Bridges</div>
                                </div>
                            </div>
                            <div class="stat-card stat-success">
                                <div class="stat-icon">🌐</div>
                                <div class="stat-content">
                                    <div class="stat-number" id="ipCount">0</div>
                                    <div class="stat-label">Network Configs</div>
                                </div>
                            </div>
                            <div class="stat-card stat-warning">
                                <div class="stat-icon">⚡</div>
                                <div class="stat-content">
                                    <div class="stat-number" id="activeCount">0</div>
                                    <div class="stat-label">Active Streams</div>
                                </div>
                            </div>
                            <div class="stat-card stat-info">
                                <div class="stat-icon">📨</div>
                                <div class="stat-content">
                                    <div class="stat-number" id="messageCount">0</div>
                                    <div class="stat-label">Messages Today</div>
                                </div>
                            </div>
                        </div>
                        <button onclick="window.navigationManager.loadPageContent()" class="btn btn-primary">
                            🔄 Retry Loading
                        </button>
                    </div>
                </div>
            `;
        }
    }

    loadSerialFallback() {
        const serialContainer = document.getElementById('serialTab');
        if (serialContainer) {
            serialContainer.innerHTML = `
                <div class="content-error">
                    <h3>⚠️ Serial Content Loading Error</h3>
                    <p>Unable to load serial.html. Please check if the file exists.</p>
                    <div id="serialConfigList" class="config-grid">
                        <div class="config-loading">Loading serial configurations...</div>
                    </div>
                </div>
            `;
        }
    }

    loadIPFallback() {
        const ipContainer = document.getElementById('ipTab');
        if (ipContainer) {
            ipContainer.innerHTML = `
                <div class="content-error">
                    <h3>⚠️ IP Content Loading Error</h3>
                    <p>Unable to load ip.html. Please check if the file exists.</p>
                    <div id="ipConfigList" class="config-grid">
                        <div class="config-loading">Loading IP configurations...</div>
                    </div>
                </div>
            `;
        }
    }

    loadMonitorFallback() {
        const monitorContainer = document.getElementById('monitorTab');
        if (monitorContainer) {
            monitorContainer.innerHTML = `
                <div class="content-error">
                    <h3>⚠️ Monitor Content Loading Error</h3>
                    <p>Unable to load monitor.html. Please check if the file exists.</p>
                    <div id="logContainer" class="terminal-content">
                        <div class="terminal-line">
                            <span class="terminal-prompt">[00:00:00]</span>
                            <span class="terminal-type info">INFO</span>
                            <span class="terminal-message">Monitor fallback loaded...</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    loadModalsFallback() {
        const modalsContainer = document.getElementById('modalsContainer');
        if (modalsContainer) {
            modalsContainer.innerHTML = `
                <!-- Basic Serial Config Modal -->
                <div id="serialConfigModal" class="modal">
                    <div class="modal-backdrop"></div>
                    <div class="modal-container">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h3>Serial Configuration</h3>
                                <button class="modal-close" type="button">×</button>
                            </div>
                            <div class="modal-body">
                                <p>Serial configuration form would be here.</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Basic IP Config Modal -->
                <div id="ipConfigModal" class="modal">
                    <div class="modal-backdrop"></div>
                    <div class="modal-container">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h3>IP Configuration</h3>
                                <button class="modal-close" type="button">×</button>
                            </div>
                            <div class="modal-body">
                                <p>IP configuration form would be here.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    loadAllFallbacks() {
        console.log('🔧 Loading all fallback content...');
        this.loadDashboardFallback();
        this.loadSerialFallback();
        this.loadIPFallback();
        this.loadMonitorFallback();
        this.loadModalsFallback();
    }

    switchMainTab(tabName) {
        if (tabName === this.currentTab) return;

        console.log(`🎯 Switching to ${tabName} tab`);
        
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(nav => {
            const isActive = nav.dataset.tab === tabName;
            nav.classList.toggle('active', isActive);
            
            if (isActive) {
                // Add activation animation
                nav.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    nav.style.transform = '';
                }, 200);
            }
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            const isActive = content.id === `${tabName}Tab`;
            
            if (content.classList.contains('active') && !isActive) {
                // Fade out
                content.style.opacity = '0';
                setTimeout(() => {
                    content.classList.remove('active');
                }, 150);
            } else if (!content.classList.contains('active') && isActive) {
                // Fade in
                content.style.opacity = '0';
                content.classList.add('active');
                setTimeout(() => {
                    content.style.opacity = '1';
                }, 50);
            }
        });

        // Update breadcrumb
        this.updateBreadcrumb(tabName);
        
        // Update current tab
        this.currentTab = tabName;

        // Trigger tab change event
        window.dispatchEvent(new CustomEvent('tabChanged', { 
            detail: { tab: tabName } 
        }));
    }

    switchMissionTab(missionTab) {
        if (missionTab === this.currentMissionTab) return;

        console.log(`🚀 Switching to mission ${missionTab} tab`);

        // Update mission navigation
        document.querySelectorAll('.mission-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.missionTab === missionTab);
        });

        // Update mission content
        document.querySelectorAll('.mission-tab-content').forEach(content => {
            const isActive = content.id === `mission${missionTab.charAt(0).toUpperCase() + missionTab.slice(1)}Tab`;
            content.classList.toggle('active', isActive);
        });

        this.currentMissionTab = missionTab;

        // Trigger mission tab change event
        window.dispatchEvent(new CustomEvent('missionTabChanged', { 
            detail: { tab: missionTab } 
        }));
    }

    updateBreadcrumb(tabName) {
        const pageNames = {
            dashboard: { title: 'Mission Control', icon: '🎯' },
            serial: { title: 'Serial Command Center', icon: '🔌' },
            ip: { title: 'Network Operations', icon: '🌐' },
            monitor: { title: 'Live Intelligence', icon: '📡' }
        };
        
        const currentPageElement = document.getElementById('currentPage');
        const breadcrumbIcon = document.querySelector('.breadcrumb-icon');
        
        if (currentPageElement && pageNames[tabName]) {
            currentPageElement.textContent = pageNames[tabName].title;
            if (breadcrumbIcon) {
                breadcrumbIcon.textContent = pageNames[tabName].icon;
                // Add icon animation
                breadcrumbIcon.style.transform = 'scale(1.2) rotate(10deg)';
                setTimeout(() => {
                    breadcrumbIcon.style.transform = '';
                }, 300);
            }
        }
    }

    getCurrentTab() {
        return this.currentTab;
    }

    getCurrentMissionTab() {
        return this.currentMissionTab;
    }

    // Method untuk force reload content
    async reloadContent() {
        console.log('🔄 Force reloading all content...');
        await this.loadPageContent();
        window.dispatchEvent(new CustomEvent('contentLoaded'));
    }

    // Method untuk get navigation status
    getStatus() {
        return {
            currentTab: this.currentTab,
            currentMissionTab: this.currentMissionTab,
            contentLoaded: {
                dashboard: !!document.getElementById('missionOverviewTab'),
                serial: !!document.getElementById('serialConfigList'),
                ip: !!document.getElementById('ipConfigList'),
                monitor: !!document.getElementById('logContainer'),
                modals: !!document.getElementById('serialConfigModal')
            }
        };
    }
}

// Initialize navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOM loaded, initializing navigation...');
    
    // Delay initialization slightly to ensure all elements are ready
    setTimeout(() => {
        window.navigationManager = new NavigationManager();
        
        // Debug helper
        window.debugNavigation = function() {
            console.log('=== NAVIGATION DEBUG ===');
            console.log('Navigation manager:', window.navigationManager);
            console.log('Status:', window.navigationManager?.getStatus());
            console.log('========================');
        };
        
        console.log('🎯 Navigation Manager initialized');
    }, 100);
});

console.log('🎯 Navigation module loaded');
