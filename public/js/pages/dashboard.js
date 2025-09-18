// Dashboard Page Management - INTEGRATED WITH COMPLETE FEATURES
class DashboardManager {
    constructor() {
        this.speedStats = {
            currentSpeed: 0,
            averageSpeed: 0,
            peakSpeed: 0,
            totalMessages: 0,
            speedHistory: [],
            messageTypes: {
                AIS: 0,
                GNSS: 0,
                SERIAL: 0,
                DATA: 0
            }
        };
        this.availablePorts = [];
        this.isContentLoaded = false;
        this.performanceTimer = null;
        this.chartTimer = null;
        this.retryCount = 0;
        this.maxRetries = 10;
        this.previousStats = {}; // For trend calculation
        this.currentMissionTab = 'overview'; // Track current mission tab
        
        // Wait for content to be loaded
        this.waitForContent();
    }

    async waitForContent() {
        console.log('📊 Dashboard waiting for content...');
        
        // Wait for content loaded event
        window.addEventListener('contentLoaded', () => {
            console.log('📊 Dashboard content loaded via event');
            this.handleContentLoaded();
        });

        // Also check periodically
        const checkInterval = setInterval(() => {
            if (document.getElementById('missionOverviewTab')) {
                console.log('📊 Dashboard content found');
                clearInterval(checkInterval);
                this.handleContentLoaded();
            }
        }, 100);

        // Stop checking after 10 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!this.isContentLoaded) {
                console.error('❌ Dashboard content never loaded');
            }
        }, 10000);
    }

    handleContentLoaded() {
        if (this.isContentLoaded) return;
        
        this.isContentLoaded = true;
        console.log('📊 Dashboard content ready, initializing...');
        
        this.init();
        
        // Load data if we're on dashboard tab
        if (window.navigationManager?.getCurrentTab() === 'dashboard') {
            this.onDashboardActivated();
        }
    }

    init() {
        this.setupEventListeners();
        this.initializeChartManager();
        
        // Listen for main tab changes
        window.addEventListener('tabChanged', (e) => {
            if (e.detail.tab === 'dashboard') {
                console.log('📊 Dashboard tab activated');
                this.onDashboardActivated();
            }
        });
    }

    setupEventListeners() {
        // Mission tab navigation
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.mission-tab-btn');
            if (!btn) return;

            const tab = btn.dataset.missionTab;
            if (tab) {
                this.switchMissionTab(tab);
            }
        });

        // Command buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('#refreshPortsCmd, #refreshPortsDashboard')) {
                this.refreshDashboardPorts();
            }
        });

        // Quick actions
        document.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('.quick-action-btn');
            if (!actionBtn) return;

            const action = actionBtn.id;
            this.handleQuickAction(action);
        });

        // Chart controls
        document.addEventListener('click', (e) => {
            const chartBtn = e.target.closest('.chart-control-btn');
            if (!chartBtn) return;

            this.handleChartControl(chartBtn);
        });
    }

    switchMissionTab(tabName) {
        // Remove active class from all tabs
        document.querySelectorAll('.mission-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.mission-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Add active class to selected tab
        const selectedBtn = document.querySelector(`[data-mission-tab="${tabName}"]`);
        const selectedContent = document.getElementById(`mission${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);

        if (selectedBtn && selectedContent) {
            selectedBtn.classList.add('active');
            selectedContent.classList.add('active');
            this.currentMissionTab = tabName;

            console.log(`📊 Switched to mission tab: ${tabName}`);

            // Handle tab-specific initialization
            switch (tabName) {
                case 'overview':
                    this.initializeMiniChart();
                    break;
                case 'performance':
                    this.initializePerformanceChart();
                    this.refreshPerformanceData();
                    break;
                case 'commands':
                    this.refreshPortScanner();
                    break;
            }

            // Dispatch custom event
            window.dispatchEvent(new CustomEvent('missionTabChanged', {
                detail: { tab: tabName }
            }));
        }
    }

    initializeChartManager() {
        // Wait for chart manager to be ready
        if (!window.chartManager) {
            setTimeout(() => this.initializeChartManager(), 100);
            return;
        }

        console.log('📊 Chart manager ready, initializing charts...');
        
        // Initialize charts based on current tab
        if (this.currentMissionTab === 'overview') {
            this.initializeMiniChart();
        } else if (this.currentMissionTab === 'performance') {
            this.initializePerformanceChart();
        }
    }

    initializeMiniChart() {
        setTimeout(() => {
            const canvas = document.getElementById('miniSpeedChart');
            if (canvas && window.chartManager) {
                console.log('📈 Initializing mini speed chart...');
                window.chartManager.initMiniSpeedChart();
                
                // Load current speed data
                this.loadAndUpdateMiniChart();
            }
        }, 200);
    }

    initializePerformanceChart() {
        setTimeout(() => {
            const canvas = document.getElementById('speedChart');
            if (canvas && window.chartManager) {
                console.log('📈 Initializing performance speed chart...');
                window.chartManager.initSpeedChart();
                
                // Load current speed data
                this.loadAndUpdatePerformanceChart();
            }
        }, 200);
    }

    async onDashboardActivated() {
        console.log('📊 Dashboard activated');
        
        // Verify elements exist
        const overviewTab = document.getElementById('missionOverviewTab');
        const performanceTab = document.getElementById('missionPerformanceTab');
        const commandsTab = document.getElementById('missionCommandsTab');
        
        if (!overviewTab || !performanceTab || !commandsTab) {
            this.retryCount++;
            if (this.retryCount < this.maxRetries) {
                console.warn(`⚠️ Dashboard elements not found, retry ${this.retryCount}/${this.maxRetries}`);
                setTimeout(() => this.onDashboardActivated(), 500);
                return;
            } else {
                console.error('❌ Dashboard elements never found after max retries');
                this.showContentError();
                return;
            }
        }
        
        console.log('✅ Dashboard elements verified, loading data...');
        this.retryCount = 0;
        
        await this.loadDashboardData();
        this.startPerformanceMonitoring();
        this.startChartUpdates();
        this.initializeChartManager();
    }

    showContentError() {
        const dashboardTab = document.getElementById('dashboardTab');
        if (dashboardTab) {
            dashboardTab.innerHTML = `
                <div class="content-error">
                    <h3>⚠️ Dashboard Content Error</h3>
                    <p>Dashboard HTML content is not properly loaded.</p>
                    <p>Please check if <code>pages/dashboard.html</code> exists and is accessible.</p>
                    <button onclick="window.navigationManager?.loadPageContent()" class="btn btn-primary">
                        🔄 Reload Content
                    </button>
                </div>
            `;
        }
    }

    async loadDashboardData() {
        try {
            console.log('📊 Loading comprehensive dashboard data...');
            
            this.showLoadingState();
            
            // Load all dashboard data in parallel
            const [dashboardStats, chartData, availablePorts, status] = await Promise.all([
                window.apiService.getDashboardStats().catch(e => {
                    console.warn('Failed to load dashboard stats:', e);
                    return this.getDefaultDashboardStats();
                }),
                window.apiService.getChartData().catch(e => {
                    console.warn('Failed to load chart data:', e);
                    return { data: null };
                }),
                window.apiService.getSerialPorts().catch(e => {
                    console.warn('Failed to load serial ports:', e);
                    return [];
                }),
                window.apiService.getStatus().catch(e => {
                    console.warn('Failed to load status:', e);
                    return {};
                })
            ]);

            console.log('📊 Data loaded successfully:', {
                dashboardStats: !!dashboardStats,
                chartData: !!chartData.data,
                ports: availablePorts.length,
                status: !!status
            });

            this.availablePorts = availablePorts;

            // Update all sections
            await this.updateAllSections(dashboardStats, chartData, status);
            
            this.hideLoadingState();
            
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            window.toastManager?.error('Failed to load dashboard data');
            this.hideLoadingState();
        }
    }

    async updateAllSections(dashboardStats, chartData, status) {
        // Update hero stats
        if (dashboardStats.heroStats) {
            this.updateHeroStats(dashboardStats.heroStats);
        }

        // Update speed overview cards
        if (dashboardStats.performanceStats) {
            this.updateSpeedOverviewCards(dashboardStats.performanceStats);
        }

        // Update system health
        if (dashboardStats.systemHealth) {
            this.updateSystemHealth(dashboardStats.systemHealth, status);
        }

        // Update performance stats (detailed)
        if (dashboardStats.performanceStats) {
            this.updatePerformanceStats(dashboardStats.performanceStats);
        }

        // Update message type breakdown
        if (dashboardStats.messageTypes) {
            this.updateMessageTypeBreakdown(dashboardStats.messageTypes);
        }

        // Update configuration summary
        if (dashboardStats.configSummary) {
            this.updateConfigurationSummary(dashboardStats.configSummary);
        }

        // Update charts
        if (chartData.data) {
            this.updateAllCharts(chartData.data);
        }

        // Update port scanner
        this.renderPortScanner();
    }

    getDefaultDashboardStats() {
        return {
            heroStats: { serialCount: 0, ipCount: 0, activeCount: 0, messageCount: 0 },
            performanceStats: { currentSpeed: 0, averageSpeed: 0, peakSpeed: 0, totalMessages: 0 },
            configSummary: { serialTotal: 0, serialActive: 0, ipTotal: 0, ipActive: 0 },
            systemHealth: { isForwarding: false, hasActiveConfig: false, uptimeSeconds: 0 },
            messageTypes: { AIS: 0, GNSS: 0, SERIAL: 0, DATA: 0 }
        };
    }

    showLoadingState() {
        // Show loading for all stat elements
        const statElements = [
            'serialCount', 'ipCount', 'activeCount', 'messageCount',
            'speedCurrent', 'speedAverage', 'speedPeak', 'msgTotal',
            'currentSpeed', 'averageSpeed', 'peakSpeed', 'totalMessages',
            'aisCount', 'gnssCount', 'serialDataCount', 'dataCount'
        ];
        
        statElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = '...';
                element.dataset.raw = '0';
            }
        });

        // Show loading for port scanner
        const portsContainer = document.getElementById('dashboardPortsList');
        if (portsContainer) {
            portsContainer.innerHTML = `
                <div class="port-scanner-loading">
                    <span class="loading-icon">🔍</span>
                    <span>Scanning ports...</span>
                </div>
            `;
        }

        this.updateScannerStatus('Loading...', true);
    }

    hideLoadingState() {
        this.updateScannerStatus(`Found ${this.availablePorts?.length || 0} ports`, true);
    }

    // HERO STATS UPDATE
    updateHeroStats(heroStats) {
        console.log('📊 Updating hero stats:', heroStats);

        this.animateCounter('serialCount', heroStats.serialCount || 0);
        this.animateCounter('ipCount', heroStats.ipCount || 0);
        this.animateCounter('activeCount', heroStats.activeCount || 0);
        this.animateCounter('messageCount', heroStats.messageCount || 0);

        // Update progress bars
        this.updateProgressBar('.stat-card:nth-child(1) .stat-progress-bar', (heroStats.serialCount / 10) * 100);
        this.updateProgressBar('.stat-card:nth-child(2) .stat-progress-bar', (heroStats.ipCount / 10) * 100);
        this.updateProgressBar('.stat-card:nth-child(3) .stat-progress-bar', (heroStats.activeCount / 5) * 100);
        this.updateProgressBar('.stat-card:nth-child(4) .stat-progress-bar', Math.min((heroStats.messageCount / 1000) * 100, 100));
    }

    // SPEED OVERVIEW CARDS UPDATE
    updateSpeedOverviewCards(performanceStats) {
        console.log('📊 Updating speed overview cards:', performanceStats);
        
        // Store previous values for trend calculation
        const prevCurrent = this.speedStats.currentSpeed;
        const prevAverage = this.speedStats.averageSpeed;
        const prevPeak = this.speedStats.peakSpeed;
        const prevTotal = this.speedStats.totalMessages;
        
        // Update stored stats
        this.speedStats = { ...this.speedStats, ...performanceStats };

        // Update speed cards with animation
        this.animateCounter('speedCurrent', performanceStats.currentSpeed || 0);
        this.animateCounter('speedAverage', performanceStats.averageSpeed || 0);
        this.animateCounter('speedPeak', performanceStats.peakSpeed || 0);
        this.animateCounter('msgTotal', performanceStats.totalMessages || 0);

        // Update trend indicators
        this.updateSpeedTrend('speedCurrentTrend', performanceStats.currentSpeed, prevCurrent);
        this.updateSpeedTrend('speedAverageTrend', performanceStats.averageSpeed, prevAverage, 'Session');
        this.updateSpeedTrend('speedPeakTrend', performanceStats.peakSpeed, prevPeak, 'Best');
        this.updateSpeedTrend('msgTotalTrend', performanceStats.totalMessages, prevTotal, 'Session');
    }

    // PERFORMANCE STATS UPDATE (for performance tab)
    updatePerformanceStats(performanceStats) {
        // Update detailed performance cards
        this.animateCounter('currentSpeed', performanceStats.currentSpeed || 0);
        this.animateCounter('averageSpeed', performanceStats.averageSpeed || 0);
        this.animateCounter('peakSpeed', performanceStats.peakSpeed || 0);
        this.animateCounter('totalMessages', performanceStats.totalMessages || 0);

        // Update progress bars
        const maxSpeed = Math.max(performanceStats.peakSpeed || 0, 100);
        this.updateProgressBar('#currentSpeedBar', ((performanceStats.currentSpeed || 0) / maxSpeed) * 100);
        this.updateProgressBar('#averageSpeedBar', ((performanceStats.averageSpeed || 0) / maxSpeed) * 100);
        this.updateProgressBar('#peakSpeedBar', 100); // Peak is always 100%
        this.updateProgressBar('#totalMessagesBar', Math.min(((performanceStats.totalMessages || 0) / 1000) * 100, 100));
    }

    // MESSAGE TYPE BREAKDOWN UPDATE
    updateMessageTypeBreakdown(messageTypes) {
        console.log('📊 Updating message type breakdown:', messageTypes);
        
        const total = Object.values(messageTypes).reduce((sum, count) => sum + count, 0);
        
        const types = [
            { count: 'aisCount', percentage: 'aisPercentage', progress: 'aisProgress', value: messageTypes.AIS || 0 },
            { count: 'gnssCount', percentage: 'gnssPercentage', progress: 'gnssProgress', value: messageTypes.GNSS || 0 },
            { count: 'serialDataCount', percentage: 'serialDataPercentage', progress: 'serialDataProgress', value: messageTypes.SERIAL || 0 },
            { count: 'dataCount', percentage: 'dataPercentage', progress: 'dataProgress', value: messageTypes.DATA || 0 }
        ];

        types.forEach(type => {
            const percentage = total > 0 ? (type.value / total) * 100 : 0;
            
            this.animateCounter(type.count, type.value);
            
            const percentElement = document.getElementById(type.percentage);
            if (percentElement) {
                percentElement.textContent = `${percentage.toFixed(1)}%`;
            }
            
            this.updateProgressBar(`#${type.progress}`, percentage);
        });
    }

    // SYSTEM HEALTH UPDATE
    updateSystemHealth(systemHealth, status) {
        // Update connection status
        const statusEl = document.getElementById('connectionHealthStatus');
        if (statusEl) {
            const dot = statusEl.querySelector('.status-dot');
            const text = statusEl.querySelector('span:last-child');
            
            if (dot && text) {
                const isOnline = systemHealth.hasActiveConfig && systemHealth.isForwarding;
                dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
                text.textContent = isOnline ? 'Online' : 'Offline';
            }
        }

        // Update connection details
        this.updateConnectionDetails(status);

        // Update system metrics
        this.updateSystemMetrics(systemHealth);
    }

    updateConnectionDetails(status) {
        const detailsEl = document.getElementById('activeConnectionDetails');
        
        if (!detailsEl) return;

        if (status.isForwarding && status.currentConfig) {
            const config = status.currentConfig;
            const type = config.serialPort ? 'Serial Bridge' : 'Network Bridge';
            const source = config.serialPort || `${config.ipHost}:${config.ipPort}`;
            const target = `${config.tcpOutHost}:${config.tcpOutPort}`;

            detailsEl.innerHTML = `
                <div class="health-item">
                    <span class="health-label">Bridge Type:</span>
                    <span class="health-value">${type}</span>
                </div>
                <div class="health-item">
                    <span class="health-label">Source:</span>
                    <span class="health-value">${source}</span>
                </div>
                <div class="health-item">
                    <span class="health-label">TCP Output:</span>
                    <span class="health-value">${target}</span>
                </div>
            `;
        } else {
            detailsEl.innerHTML = `
                <div class="health-item">
                    <span class="health-label">Bridge Type:</span>
                    <span class="health-value">None</span>
                </div>
                <div class="health-item">
                    <span class="health-label">Source:</span>
                    <span class="health-value">Not connected</span>
                </div>
                <div class="health-item">
                    <span class="health-label">Target:</span>
                    <span class="health-value">Not configured</span>
                </div>
            `;
        }
    }

    updateSystemMetrics(systemHealth) {
        // Update session uptime
        if (systemHealth.sessionStartTime) {
            const sessionUptime = this.formatUptime(Date.now() - new Date(systemHealth.sessionStartTime).getTime());
            const sessionElement = document.getElementById('sessionUptime');
            if (sessionElement) sessionElement.textContent = sessionUptime;
        }

        // Update system uptime
        if (systemHealth.uptimeSeconds) {
            const systemUptime = this.formatUptime(systemHealth.uptimeSeconds * 1000);
            const systemElement = document.getElementById('systemUptime');
            if (systemElement) systemElement.textContent = systemUptime;
        }

        // Update last activity
        if (systemHealth.lastActivity) {
            const lastActivity = this.formatLastActivity(systemHealth.lastActivity);
            const activityElement = document.getElementById('lastActivity');
            if (activityElement) activityElement.textContent = lastActivity;
        }

        // Update error counts
        this.animateCounter('errorCount', systemHealth.errorCount || 0);
        this.animateCounter('reconnectCount', systemHealth.reconnectCount || 0);
        this.animateCounter('uniqueMessages', systemHealth.uniqueMessages || 0);
    }

    // CONFIGURATION SUMMARY UPDATE
    updateConfigurationSummary(configSummary) {
        this.animateCounter('serialConfigsTotal', configSummary.serialTotal || 0);
        this.animateCounter('serialConfigsActive', configSummary.serialActive || 0);
        this.animateCounter('ipConfigsTotal', configSummary.ipTotal || 0);
        this.animateCounter('ipConfigsActive', configSummary.ipActive || 0);
    }

    // ENHANCED COUNTER ANIMATION
    animateCounter(elementId, targetValue, options = {}) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`⚠️ Element ${elementId} not found for counter animation`);
            return;
        }

        const {
            duration = 1000,
            easing = 'easeOutCubic',
            formatNumber = true,
            decimals = 0
        } = options;

        const startValue = parseFloat(element.dataset.raw || 0);
        const endValue = parseFloat(targetValue) || 0;
        
        if (startValue === endValue) return;

        const startTime = performance.now();
        const valueChange = endValue - startValue;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easedProgress = this.easeOutCubic(progress);
            const currentValue = startValue + (valueChange * easedProgress);

            element.dataset.raw = currentValue;
            
            if (formatNumber) {
                const formattedValue = currentValue.toLocaleString(undefined, {
                    maximumFractionDigits: decimals,
                    minimumFractionDigits: decimals
                });
                element.textContent = formattedValue;
            } else {
                element.textContent = Math.round(currentValue);
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.dataset.raw = endValue;
                const finalFormatted = endValue.toLocaleString(undefined, {
                    maximumFractionDigits: decimals,
                    minimumFractionDigits: decimals
                });
                element.textContent = finalFormatted;
                
                // Add glow effect
                element.style.textShadow = '0 0 20px var(--pink-neon)';
                setTimeout(() => {
                    element.style.textShadow = '';
                }, 1000);
            }
        };

        requestAnimationFrame(animate);
    }

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    updateSpeedTrend(elementId, current, previous, staticText = null) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const iconElement = element.querySelector('.trend-icon');
        const textElement = element.querySelector('.trend-text');

        if (staticText) {
            if (iconElement) iconElement.textContent = this.getTrendIcon(staticText);
            if (textElement) textElement.textContent = staticText;
            element.className = element.className.replace(/trend-(positive|negative|neutral)/g, '') + ' trend-neutral';
            return;
        }

        const trend = this.calculateTrend(current, previous);
        
        if (iconElement) iconElement.textContent = trend.icon;
        if (textElement) textElement.textContent = trend.text;
        
        element.className = element.className.replace(/trend-(positive|negative|neutral)/g, '') + ` trend-${trend.type}`;
    }

    getTrendIcon(staticText) {
        const icons = {
            'Session': '📊',
            'Best': '🏆',
            'Total': '✅'
        };
        return icons[staticText] || '📊';
    }

    calculateTrend(current, previous) {
        if (!previous || previous === 0) {
            return { icon: '📈', text: 'New', type: 'neutral' };
        }

        const change = current - previous;
        const percentChange = Math.abs((change / previous) * 100);

        if (change > 0) {
            return { 
                icon: '📈', 
                text: `+${percentChange.toFixed(1)}%`, 
                type: 'positive' 
            };
        } else if (change < 0) {
            return { 
                icon: '📉', 
                text: `-${percentChange.toFixed(1)}%`, 
                type: 'negative' 
            };
        } else {
            return { 
                icon: '➖', 
                text: '0%', 
                type: 'neutral' 
            };
        }
    }

    updateProgressBar(selector, percentage) {
        const element = document.querySelector(selector);
        if (!element) return;

        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        element.style.width = `${clampedPercentage}%`;
    }

    // CHART MANAGEMENT
    updateAllCharts(chartData) {
        try {
            // Update mini chart (overview tab)
            if (chartData.realtimeSpeed && window.chartManager) {
                window.chartManager.updateMiniSpeedChart(chartData.realtimeSpeed.datasets[0].data.map((value, index) => ({
                    timestamp: Date.now() - (chartData.realtimeSpeed.labels.length - 1 - index) * 60000,
                    speed: value
                })));
            }

            // Update performance chart (performance tab)
            if (chartData.speedHistory && window.chartManager) {
                window.chartManager.updateSpeedChart(chartData.speedHistory.datasets[0].data.map((value, index) => ({
                    timestamp: Date.now() - (chartData.speedHistory.labels.length - 1 - index) * 60000,
                    speed: value
                })));
            }

            console.log('📈 All charts updated successfully');
        } catch (error) {
            console.error('Error updating charts:', error);
        }
    }

    async loadAndUpdateMiniChart() {
        try {
            const speedStats = await window.apiService.getSpeedStats();
            if (speedStats.speedHistory && window.chartManager) {
                window.chartManager.updateMiniSpeedChart(speedStats.speedHistory);
            }
        } catch (error) {
            console.error('Error loading mini chart data:', error);
        }
    }

    async loadAndUpdatePerformanceChart() {
        try {
            const speedStats = await window.apiService.getSpeedStats();
            if (speedStats.speedHistory && window.chartManager) {
                window.chartManager.updateSpeedChart(speedStats.speedHistory);
            }
        } catch (error) {
            console.error('Error loading performance chart data:', error);
        }
    }

    refreshPerformanceData() {
        // Reload performance-specific data
        this.loadDashboardData();
    }

    refreshPortScanner() {
        this.refreshDashboardPorts();
    }

    handleChartControl(button) {
        // Remove active class from siblings
        button.parentElement.querySelectorAll('.chart-control-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');

        const period = button.dataset.period;
        const chart = button.dataset.chart;

        if (period) {
            this.changeChartPeriod(period);
        }

        if (chart) {
            this.changeChartType(chart);
        }
    }

    changeChartPeriod(period) {
        console.log('📊 Changing chart period to:', period);
        
        // Update chart title
        const chartTitle = document.querySelector('.mini-chart-container .chart-header h4');
        if (chartTitle) {
            const periodText = {
                '5min': 'Last 5 Minutes',
                '1hour': 'Last Hour', 
                '1day': 'Last Day'
            };
            
            chartTitle.innerHTML = `
                <span class="chart-icon">📈</span>
                Speed Trend (${periodText[period] || 'Last 5 Minutes'})
            `;
        }
        
        // Reload chart data for new period
        this.loadAndUpdateMiniChart();
    }

    changeChartType(chartType) {
        console.log('📊 Changing chart type to:', chartType);
        // Implement chart type change logic based on the type
        // For now, just reload the current data
        if (this.currentMissionTab === 'performance') {
            this.loadAndUpdatePerformanceChart();
        }
    }

    // PORT SCANNER METHODS
    renderPortScanner() {
        const container = document.getElementById('dashboardPortsList');
        if (!container) {
            console.warn('⚠️ Dashboard ports container not found');
            return;
        }

        container.innerHTML = '';

        if (!this.availablePorts || this.availablePorts.length === 0) {
            container.innerHTML = `
                <div class="port-scanner-empty">
                    <div class="empty-icon">🔌</div>
                    <div class="empty-text">
                        <strong>No Serial Ports Found</strong>
                        <p>Connect a serial device and click refresh</p>
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="window.dashboardManager?.refreshDashboardPorts()">
                        <span class="btn-icon">🔄</span>
                        <span>Scan Again</span>
                    </button>
                </div>
            `;
            
            this.updateScannerStatus('No ports found', false);
            return;
        }

        this.updateScannerStatus(`Found ${this.availablePorts.length} ports`, true);

        this.availablePorts.forEach((port, index) => {
            const portElement = this.createPortElement(port, index);
            container.appendChild(portElement);
        });

        console.log(`✅ Rendered ${this.availablePorts.length} ports in dashboard`);
    }

    createPortElement(port, index) {
        const div = document.createElement('div');
        div.className = 'port-item dashboard-port-item';
        div.style.animationDelay = `${index * 0.1}s`;
        
        div.innerHTML = `
            <div class="port-header">
                <div class="port-info-main">
                    <strong class="port-path">🔌 ${port.path}</strong>
                    <div class="port-manufacturer">${port.manufacturer || 'Unknown Device'}</div>
                </div>
                <div class="port-actions">
                    <button class="btn btn-sm btn-primary" onclick="window.dashboardManager?.quickCreateSerial('${port.path}')">
                        <span class="btn-icon">⚡</span>
                        <span>Quick Setup</span>
                    </button>
                </div>
            </div>
            ${port.vendorId || port.productId ? `
            <div class="port-details">
                ${port.vendorId ? `<small class="port-info">🆔 VID: ${port.vendorId}</small>` : ''}
                ${port.productId ? `<small class="port-info">📦 PID: ${port.productId}</small>` : ''}
            </div>
            ` : ''}
        `;
        
        return div;
    }

    updateScannerStatus(message, success) {
        const statusElement = document.querySelector('.scanner-status span:last-child');
        const dotElement = document.querySelector('.scanner-dot');
        
        if (statusElement) {
            statusElement.textContent = message;
        }
        
        if (dotElement) {
            dotElement.className = `scanner-dot ${success ? 'success' : 'error'}`;
        }
    }

    async quickCreateSerial(portPath) {
        try {
            const config = {
                name: `Serial Bridge - ${portPath}`,
                serialPort: portPath,
                baudRate: 9600,
                tcpOutHost: '127.0.0.1',
                tcpOutPort: 4001
            };

            await window.apiService.createSerialConfig(config);
            window.toastManager?.success(`🚀 Quick serial bridge created for ${portPath}!`);
            
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Quick create serial error:', error);
            window.toastManager?.error('❌ Failed to create serial bridge');
        }
    }

    async refreshDashboardPorts() {
        try {
            console.log('🔄 Refreshing dashboard ports...');
            
            this.updateScannerStatus('Scanning...', true);
            
            const portsContainer = document.getElementById('dashboardPortsList');
            if (portsContainer) {
                portsContainer.innerHTML = `
                    <div class="port-scanner-loading">
                        <span class="loading-icon scanning">🔍</span>
                        <span>Scanning for ports...</span>
                    </div>
                `;
            }
            
            const ports = await window.apiService.getSerialPorts();
            this.availablePorts = ports;
            this.renderPortScanner();
            
            window.toastManager?.success(`🔍 Found ${ports.length} serial ports`);
            
        } catch (error) {
            console.error('Dashboard port refresh error:', error);
            window.toastManager?.error('❌ Port scanning failed');
            this.updateScannerStatus('Scan failed', false);
        }
    }

    // QUICK ACTIONS
    async handleQuickAction(action) {
        switch (action) {
            case 'emergencyStopBtn':
                await this.emergencyStop();
                break;
            case 'restartAllBtn':
                await this.restartAll();
                break;
            case 'clearLogsBtn':
                this.clearLogs();
                break;
            case 'exportDataBtn':
                this.exportData();
                break;
        }
    }

    async emergencyStop() {
        try {
            await window.apiService.stopForwarding();
            window.toastManager?.success('🛑 Emergency stop executed');
            await this.loadDashboardData();
        } catch (error) {
            console.error('Emergency stop failed:', error);
            window.toastManager?.error('Emergency stop failed');
        }
    }

    async restartAll() {
        const confirmed = await window.modalManager?.confirm(
            'Restart All Bridges',
            'This will stop all active bridges and restart them. Continue?'
        );

        if (confirmed) {
            try {
                await window.apiService.stopForwarding();
                window.toastManager?.info('🔄 All bridges restarted');
                await this.loadDashboardData();
            } catch (error) {
                console.error('Restart failed:', error);
                window.toastManager?.error('Restart failed');
            }
        }
    }

    clearLogs() {
        if (window.app && window.app.clearLogs) {
            window.app.clearLogs();
        }
        window.toastManager?.success('🗑 Logs cleared');
    }

    exportData() {
        // Create and download CSV with current dashboard data
        const data = {
            timestamp: new Date().toISOString(),
            heroStats: this.speedStats,
            availablePorts: this.availablePorts
        };
        
        const csvContent = "data:text/csv;charset=utf-8," + 
            "Timestamp,Current Speed,Average Speed,Peak Speed,Total Messages\n" +
            `${data.timestamp},${this.speedStats.currentSpeed},${this.speedStats.averageSpeed},${this.speedStats.peakSpeed},${this.speedStats.totalMessages}`;
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `dashboard-export-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        window.toastManager?.success('📥 Dashboard data exported');
    }

    // UTILITY METHODS
    formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    formatLastActivity(timestamp) {
        if (!timestamp) return 'Never';
        
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(timestamp).toLocaleString();
    }

    // PERFORMANCE MONITORING
    startPerformanceMonitoring() {
        if (this.performanceTimer) {
            clearInterval(this.performanceTimer);
        }

        this.performanceTimer = setInterval(async () => {
            if (window.navigationManager?.getCurrentTab() === 'dashboard') {
                try {
                    const [speedStats, dashboardStats] = await Promise.all([
                        window.apiService.getSpeedStats().catch(e => ({})),
                        window.apiService.getDashboardStats().catch(e => ({}))
                    ]);
                    
                    // Update current tab data only
                    if (this.currentMissionTab === 'overview') {
                        if (dashboardStats.performanceStats) {
                            this.updateSpeedOverviewCards(dashboardStats.performanceStats);
                        }
                    } else if (this.currentMissionTab === 'performance') {
                        if (dashboardStats.performanceStats) {
                            this.updatePerformanceStats(dashboardStats.performanceStats);
                        }
                        if (dashboardStats.messageTypes) {
                            this.updateMessageTypeBreakdown(dashboardStats.messageTypes);
                        }
                        if (dashboardStats.systemHealth) {
                            this.updateSystemMetrics(dashboardStats.systemHealth);
                        }
                    }
                    
                } catch (error) {
                    console.error('Failed to update performance stats:', error);
                }
            }
        }, 5000); // Update every 5 seconds
    }

    startChartUpdates() {
        if (this.chartTimer) {
            clearInterval(this.chartTimer);
        }

        this.chartTimer = setInterval(async () => {
            if (window.navigationManager?.getCurrentTab() === 'dashboard') {
                try {
                    const chartData = await window.apiService.getChartData();
                    if (chartData.data) {
                        this.updateAllCharts(chartData.data);
                    }
                } catch (error) {
                    console.error('Failed to update charts:', error);
                }
            }
        }, 10000); // Update every 10 seconds
    }

    // STATUS AND DEBUGGING
    getStatus() {
        return {
            isContentLoaded: this.isContentLoaded,
            currentMissionTab: this.currentMissionTab,
            availablePortsCount: this.availablePorts?.length || 0,
            performanceMonitoringActive: !!this.performanceTimer,
            chartTimerActive: !!this.chartTimer,
            speedStats: this.speedStats,
            chartsInitialized: !!(window.chartManager)
        };
    }

    destroy() {
        if (this.performanceTimer) {
            clearInterval(this.performanceTimer);
            this.performanceTimer = null;
        }
        if (this.chartTimer) {
            clearInterval(this.chartTimer);
            this.chartTimer = null;
        }
        console.log('📊 Dashboard manager destroyed');
    }
}

// Initialize dashboard manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('📊 Initializing Enhanced Dashboard Manager...');
    window.dashboardManager = new DashboardManager();
});

// Debug helper functions
window.debugDashboard = function() {
    console.log('=== DASHBOARD DEBUG ===');
    console.log('Dashboard manager:', window.dashboardManager);
    console.log('Status:', window.dashboardManager?.getStatus());
    console.log('Current mission tab:', window.dashboardManager?.currentMissionTab);
    console.log('Elements check:');
    console.log('- Overview tab:', !!document.getElementById('missionOverviewTab'));
    console.log('- Performance tab:', !!document.getElementById('missionPerformanceTab'));
    console.log('- Commands tab:', !!document.getElementById('missionCommandsTab'));
    console.log('- Mini chart canvas:', !!document.getElementById('miniSpeedChart'));
    console.log('- Speed chart canvas:', !!document.getElementById('speedChart'));
    console.log('Chart manager:', window.chartManager);
    console.log('Navigation manager:', window.navigationManager);
    console.log('Current tab:', window.navigationManager?.getCurrentTab());
    console.log('========================');
};

window.testDashboardData = function() {
    console.log('🧪 Testing dashboard with sample data...');
    
    const sampleStats = {
        heroStats: { serialCount: 3, ipCount: 2, activeCount: 1, messageCount: 1250 },
        performanceStats: { currentSpeed: 25, averageSpeed: 18, peakSpeed: 45, totalMessages: 1250 },
        messageTypes: { AIS: 800, GNSS: 200, SERIAL: 150, DATA: 100 },
        systemHealth: { isForwarding: true, hasActiveConfig: true, uptimeSeconds: 3600 }
    };
    
    if (window.dashboardManager) {
        window.dashboardManager.updateAllSections(sampleStats, { data: null }, { isForwarding: true });
        console.log('✅ Sample data applied to dashboard');
    }
};

window.forceDashboardRefresh = function() {
    console.log('🔄 Force refreshing dashboard...');
    if (window.dashboardManager) {
        window.dashboardManager.loadDashboardData();
    }
};

console.log('📊 Enhanced Dashboard Manager loaded with full integration');
