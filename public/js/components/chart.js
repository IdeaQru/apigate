// Chart Manager for Dashboard - COMPLETE WITH ALL METHODS
class ChartManager {
    constructor() {
        this.charts = new Map();
        this.isInitialized = false;
        this.canvasContext = new Map();
        
        console.log('📊 ChartManager initializing...');
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupEventListeners();
            });
        } else {
            this.setupEventListeners();
        }

        this.isInitialized = true;
        console.log('✅ ChartManager initialized successfully');
    }

    setupEventListeners() {
        // Listen for mission tab changes
        window.addEventListener('missionTabChanged', (e) => {
            console.log(`📊 Mission tab changed to: ${e.detail.tab}`);
            this.handleTabChange(e.detail.tab);
        });

        // Listen for main tab changes
        window.addEventListener('tabChanged', (e) => {
            if (e.detail.tab === 'dashboard') {
                console.log('📊 Dashboard tab activated');
                setTimeout(() => {
                    this.initializeAllCharts();
                }, 300);
            }
        });

        // Listen for content loaded
        window.addEventListener('contentLoaded', () => {
            console.log('📊 Content loaded, checking for charts...');
            setTimeout(() => {
                this.initializeAllCharts();
            }, 500);
        });
    }

    handleTabChange(tab) {
        switch (tab) {
            case 'overview':
                setTimeout(() => this.initMiniSpeedChart(), 200);
                break;
            case 'performance':
                setTimeout(() => this.initSpeedChart(), 200);
                break;
        }
    }

    initializeAllCharts() {
        console.log('📊 Initializing all available charts...');
        
        // Try to initialize mini chart
        if (document.getElementById('miniSpeedChart')) {
            this.initMiniSpeedChart();
        }

        // Try to initialize main speed chart
        if (document.getElementById('speedChart')) {
            this.initSpeedChart();
        }
    }

    // MINI SPEED CHART METHODS
    initMiniSpeedChart() {
        const canvas = document.getElementById('miniSpeedChart');
        if (!canvas) {
            console.warn('⚠️ Mini speed chart canvas not found');
            return false;
        }

        if (this.charts.has('miniSpeedChart')) {
            console.log('📈 Mini speed chart already initialized');
            return true;
        }

        console.log('🎨 Initializing mini speed chart...');

        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('❌ Failed to get 2D context for mini chart');
                return false;
            }

            // Store chart info
            this.charts.set('miniSpeedChart', { 
                canvas, 
                ctx, 
                data: [],
                lastUpdate: Date.now(),
                type: 'mini'
            });
            
            this.canvasContext.set('miniSpeedChart', ctx);
            
            // Setup canvas size
            this.setupCanvasSize(canvas, 800, 200);
            
            // Draw empty chart initially
            this.drawMiniSpeedChart([]);
            
            console.log('✅ Mini speed chart initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Error initializing mini speed chart:', error);
            return false;
        }
    }

    updateMiniSpeedChart(speedHistory) {
        const chart = this.charts.get('miniSpeedChart');
        if (!chart) {
            console.warn('⚠️ Mini speed chart not initialized, attempting to initialize...');
            if (!this.initMiniSpeedChart()) {
                return false;
            }
            // Get updated chart reference
            const updatedChart = this.charts.get('miniSpeedChart');
            if (!updatedChart) return false;
        }

        const chartData = this.charts.get('miniSpeedChart');
        console.log('📈 Updating mini speed chart with data:', speedHistory?.length || 0, 'points');
        
        chartData.data = speedHistory || [];
        chartData.lastUpdate = Date.now();
        
        this.drawMiniSpeedChart(speedHistory || []);
        return true;
    }

    drawMiniSpeedChart(speedHistory) {
        const chart = this.charts.get('miniSpeedChart');
        if (!chart) return;

        const { canvas, ctx } = chart;
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas with dark background
        ctx.fillStyle = '#0f0f1a';
        ctx.fillRect(0, 0, width, height);

        if (!speedHistory || speedHistory.length === 0) {
            this.drawMiniChartEmpty(ctx, width, height);
            return;
        }

        // Chart dimensions with padding
        const padding = 30;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        // Find data bounds
        const speeds = speedHistory.map(h => h.speed || h.currentSpeed || 0);
        const maxSpeed = Math.max(...speeds, 10); // Minimum 10 for scale
        const minTime = Math.min(...speedHistory.map(h => h.timestamp || Date.now()));
        const maxTime = Math.max(...speedHistory.map(h => h.timestamp || Date.now()));
        const timeDiff = maxTime - minTime || 1;

        // Draw background grid
        this.drawMiniChartGrid(ctx, width, height, padding, chartWidth, chartHeight);

        // Draw area fill
        this.drawMiniAreaFill(ctx, speedHistory, padding, chartWidth, chartHeight, maxSpeed, minTime, timeDiff);

        // Draw data line
        this.drawMiniDataLine(ctx, speedHistory, padding, chartWidth, chartHeight, maxSpeed, minTime, timeDiff);

        // Draw data points
        this.drawMiniDataPoints(ctx, speedHistory, padding, chartWidth, chartHeight, maxSpeed, minTime, timeDiff);

        // Draw labels
        this.drawMiniChartLabels(ctx, width, height, padding, maxSpeed);
    }

    drawMiniChartEmpty(ctx, width, height) {
        // Draw empty state
        ctx.fillStyle = '#666';
        ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No speed data available', width / 2, height / 2 - 15);
        
        ctx.fillStyle = '#555';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText('Data will appear when bridge is active', width / 2, height / 2 + 15);

        // Draw placeholder icon
        ctx.font = '24px sans-serif';
        ctx.fillStyle = '#444';
        ctx.fillText('📈', width / 2, height / 2 - 40);
    }

    drawMiniChartGrid(ctx, width, height, padding, chartWidth, chartHeight) {
        ctx.strokeStyle = 'rgba(255, 109, 167, 0.1)';
        ctx.lineWidth = 1;

        // Horizontal grid lines
        for (let i = 0; i <= 4; i++) {
            const y = padding + (chartHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
        }

        // Vertical grid lines
        for (let i = 0; i <= 6; i++) {
            const x = padding + (chartWidth / 6) * i;
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, height - padding);
            ctx.stroke();
        }
    }

    drawMiniAreaFill(ctx, speedHistory, padding, chartWidth, chartHeight, maxSpeed, minTime, timeDiff) {
        if (speedHistory.length < 2) return;

        // Create gradient for area fill
        const gradient = ctx.createLinearGradient(0, padding, 0, padding + chartHeight);
        gradient.addColorStop(0, 'rgba(255, 109, 167, 0.3)');
        gradient.addColorStop(0.5, 'rgba(255, 109, 167, 0.15)');
        gradient.addColorStop(1, 'rgba(255, 109, 167, 0.05)');

        ctx.beginPath();
        ctx.fillStyle = gradient;

        // Start from bottom left
        const firstPoint = speedHistory[0];
        const firstX = padding + ((firstPoint.timestamp - minTime) / timeDiff) * chartWidth;
        ctx.moveTo(firstX, padding + chartHeight);

        // Draw line to each data point
        speedHistory.forEach((point) => {
            const x = padding + ((point.timestamp - minTime) / timeDiff) * chartWidth;
            const y = padding + chartHeight - ((point.speed || point.currentSpeed || 0) / maxSpeed) * chartHeight;
            ctx.lineTo(x, y);
        });

        // Close path at bottom
        const lastPoint = speedHistory[speedHistory.length - 1];
        const lastX = padding + ((lastPoint.timestamp - minTime) / timeDiff) * chartWidth;
        ctx.lineTo(lastX, padding + chartHeight);
        ctx.lineTo(firstX, padding + chartHeight);
        ctx.closePath();
        ctx.fill();
    }

    drawMiniDataLine(ctx, speedHistory, padding, chartWidth, chartHeight, maxSpeed, minTime, timeDiff) {
        if (speedHistory.length < 2) return;

        ctx.strokeStyle = '#ff6da7';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        speedHistory.forEach((point, index) => {
            const x = padding + ((point.timestamp - minTime) / timeDiff) * chartWidth;
            const y = padding + chartHeight - ((point.speed || point.currentSpeed || 0) / maxSpeed) * chartHeight;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
    }

    drawMiniDataPoints(ctx, speedHistory, padding, chartWidth, chartHeight, maxSpeed, minTime, timeDiff) {
        if (speedHistory.length === 0) return;

        ctx.fillStyle = '#ff6da7';
        ctx.shadowColor = '#ff6da7';
        ctx.shadowBlur = 6;

        speedHistory.forEach((point) => {
            const x = padding + ((point.timestamp - minTime) / timeDiff) * chartWidth;
            const y = padding + chartHeight - ((point.speed || point.currentSpeed || 0) / maxSpeed) * chartHeight;

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        });

        // Reset shadow
        ctx.shadowBlur = 0;
    }

    drawMiniChartLabels(ctx, width, height, padding, maxSpeed) {
        ctx.fillStyle = '#888';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        
        // Y-axis labels
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        
        for (let i = 0; i <= 4; i++) {
            const y = padding + (height - padding * 2) * i / 4;
            const value = Math.round(maxSpeed * (4 - i) / 4);
            ctx.fillText(value.toString(), padding - 8, y);
        }

        // Chart title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('Speed (msg/min)', padding, 8);
    }

    // MAIN SPEED CHART METHODS
    initSpeedChart() {
        const canvas = document.getElementById('speedChart');
        if (!canvas) {
            console.warn('⚠️ Speed chart canvas not found');
            return false;
        }

        if (this.charts.has('speedChart')) {
            console.log('📈 Speed chart already initialized');
            return true;
        }

        console.log('🎨 Initializing main speed chart...');

        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('❌ Failed to get 2D context for speed chart');
                return false;
            }

            // Store chart info
            this.charts.set('speedChart', { 
                canvas, 
                ctx, 
                data: [],
                lastUpdate: Date.now(),
                type: 'main'
            });
            
            this.canvasContext.set('speedChart', ctx);
            
            // Setup canvas size
            this.setupCanvasSize(canvas, 800, 400);
            
            // Draw empty chart initially
            this.drawSpeedChart([]);
            
            console.log('✅ Main speed chart initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Error initializing main speed chart:', error);
            return false;
        }
    }

    updateSpeedChart(speedHistory) {
        const chart = this.charts.get('speedChart');
        if (!chart) {
            console.warn('⚠️ Speed chart not initialized, attempting to initialize...');
            if (!this.initSpeedChart()) {
                return false;
            }
        }

        const chartData = this.charts.get('speedChart');
        console.log('📈 Updating main speed chart with data:', speedHistory?.length || 0, 'points');
        
        chartData.data = speedHistory || [];
        chartData.lastUpdate = Date.now();
        
        this.drawSpeedChart(speedHistory || []);
        return true;
    }

    drawSpeedChart(speedHistory) {
        const chart = this.charts.get('speedChart');
        if (!chart) return;

        const { canvas, ctx } = chart;
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.fillStyle = '#0f0f1a';
        ctx.fillRect(0, 0, width, height);

        if (!speedHistory || speedHistory.length === 0) {
            this.drawMainChartEmpty(ctx, width, height);
            return;
        }

        // Chart dimensions
        const padding = 60;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        // Find data bounds
        const speeds = speedHistory.map(h => h.speed || h.currentSpeed || 0);
        const maxSpeed = Math.max(...speeds, 10);
        const minTime = Math.min(...speedHistory.map(h => h.timestamp || Date.now()));
        const maxTime = Math.max(...speedHistory.map(h => h.timestamp || Date.now()));
        const timeDiff = maxTime - minTime || 1;

        // Draw background and grid
        this.drawMainChartGrid(ctx, width, height, padding, chartWidth, chartHeight, maxSpeed);

        // Draw area fill
        this.drawMainAreaFill(ctx, speedHistory, padding, chartWidth, chartHeight, maxSpeed, minTime, timeDiff);

        // Draw data line
        this.drawMainDataLine(ctx, speedHistory, padding, chartWidth, chartHeight, maxSpeed, minTime, timeDiff);

        // Draw data points
        this.drawMainDataPoints(ctx, speedHistory, padding, chartWidth, chartHeight, maxSpeed, minTime, timeDiff);

        // Draw axes and labels
        this.drawMainChartLabels(ctx, speedHistory, padding, chartWidth, chartHeight, maxSpeed, minTime, timeDiff);
    }

    drawMainChartEmpty(ctx, width, height) {
        // Draw empty state for main chart
        ctx.fillStyle = '#666';
        ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No Performance Data Available', width / 2, height / 2 - 20);
        
        ctx.fillStyle = '#555';
        ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText('Start a bridge to see real-time performance analytics', width / 2, height / 2 + 20);

        // Draw placeholder chart outline
        const padding = 60;
        ctx.strokeStyle = 'rgba(255, 109, 167, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(padding, padding, width - padding * 2, height - padding * 2);
    }

    drawMainChartGrid(ctx, width, height, padding, chartWidth, chartHeight, maxSpeed) {
        ctx.strokeStyle = 'rgba(255, 109, 167, 0.15)';
        ctx.lineWidth = 1;

        // Horizontal grid lines
        for (let i = 0; i <= 6; i++) {
            const y = padding + (chartHeight / 6) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
        }

        // Vertical grid lines
        for (let i = 0; i <= 10; i++) {
            const x = padding + (chartWidth / 10) * i;
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, height - padding);
            ctx.stroke();
        }
    }

    drawMainAreaFill(ctx, speedHistory, padding, chartWidth, chartHeight, maxSpeed, minTime, timeDiff) {
        if (speedHistory.length < 2) return;

        const gradient = ctx.createLinearGradient(0, padding, 0, padding + chartHeight);
        gradient.addColorStop(0, 'rgba(255, 109, 167, 0.4)');
        gradient.addColorStop(0.3, 'rgba(255, 109, 167, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 109, 167, 0.05)');

        ctx.beginPath();
        ctx.fillStyle = gradient;

        const firstPoint = speedHistory[0];
        const firstX = padding + ((firstPoint.timestamp - minTime) / timeDiff) * chartWidth;
        ctx.moveTo(firstX, padding + chartHeight);

        speedHistory.forEach((point) => {
            const x = padding + ((point.timestamp - minTime) / timeDiff) * chartWidth;
            const y = padding + chartHeight - ((point.speed || point.currentSpeed || 0) / maxSpeed) * chartHeight;
            ctx.lineTo(x, y);
        });

        const lastPoint = speedHistory[speedHistory.length - 1];
        const lastX = padding + ((lastPoint.timestamp - minTime) / timeDiff) * chartWidth;
        ctx.lineTo(lastX, padding + chartHeight);
        ctx.lineTo(firstX, padding + chartHeight);
        ctx.closePath();
        ctx.fill();
    }

    drawMainDataLine(ctx, speedHistory, padding, chartWidth, chartHeight, maxSpeed, minTime, timeDiff) {
        if (speedHistory.length < 2) return;

        ctx.strokeStyle = '#ff6da7';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Add glow effect
        ctx.shadowColor = '#ff6da7';
        ctx.shadowBlur = 8;

        ctx.beginPath();
        speedHistory.forEach((point, index) => {
            const x = padding + ((point.timestamp - minTime) / timeDiff) * chartWidth;
            const y = padding + chartHeight - ((point.speed || point.currentSpeed || 0) / maxSpeed) * chartHeight;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        
        // Reset shadow
        ctx.shadowBlur = 0;
    }

    drawMainDataPoints(ctx, speedHistory, padding, chartWidth, chartHeight, maxSpeed, minTime, timeDiff) {
        ctx.fillStyle = '#ff6da7';
        ctx.shadowColor = '#ff6da7';
        ctx.shadowBlur = 10;

        speedHistory.forEach((point) => {
            const x = padding + ((point.timestamp - minTime) / timeDiff) * chartWidth;
            const y = padding + chartHeight - ((point.speed || point.currentSpeed || 0) / maxSpeed) * chartHeight;

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();

            // Inner white dot
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = '#ff6da7';
        });

        ctx.shadowBlur = 0;
    }

    drawMainChartLabels(ctx, speedHistory, padding, chartWidth, chartHeight, maxSpeed, minTime, timeDiff) {
        // Y-axis labels
        ctx.fillStyle = '#888';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        for (let i = 0; i <= 6; i++) {
            const y = padding + (chartHeight / 6) * i;
            const value = Math.round(maxSpeed * (6 - i) / 6);
            ctx.fillText(value.toString(), padding - 10, y);
        }

        // X-axis labels (time)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const labelCount = Math.min(speedHistory.length, 8);
        for (let i = 0; i < labelCount; i++) {
            const pointIndex = Math.floor((speedHistory.length - 1) * i / (labelCount - 1));
            const point = speedHistory[pointIndex];
            
            if (point) {
                const x = padding + (chartWidth * i / (labelCount - 1));
                const time = new Date(point.timestamp).toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit'
                });
                ctx.fillText(time, x, chartHeight + padding + 15);
            }
        }

        // Chart title and axis labels
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('Message Speed Analytics', padding, 15);

        // Y-axis label
        ctx.save();
        ctx.translate(15, padding + chartHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#888';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText('Messages per Minute', 0, 0);
        ctx.restore();

        // X-axis label
        ctx.fillStyle = '#888';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Time', padding + chartWidth / 2, height - 15);
    }

    // UTILITY METHODS
    setupCanvasSize(canvas, width, height) {
        // Set actual size in memory
        canvas.width = width;
        canvas.height = height;
        
        // Set display size (CSS)
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.maxWidth = width + 'px';
        canvas.style.maxHeight = height + 'px';
    }

    // Force refresh all charts
    forceRefreshAll() {
        console.log('🔄 Force refreshing all charts...');
        
        this.charts.forEach((chart, chartId) => {
            if (chart.data && chart.data.length > 0) {
                if (chartId === 'miniSpeedChart') {
                    this.drawMiniSpeedChart(chart.data);
                } else if (chartId === 'speedChart') {
                    this.drawSpeedChart(chart.data);
                }
            }
        });
    }

    // Get chart status for debugging
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            availableCharts: Array.from(this.charts.keys()),
            chartData: Object.fromEntries(
                Array.from(this.charts.entries()).map(([key, value]) => [
                    key, 
                    {
                        hasData: value.data && value.data.length > 0,
                        dataPoints: value.data ? value.data.length : 0,
                        lastUpdate: value.lastUpdate,
                        type: value.type
                    }
                ])
            )
        };
    }

    // Destroy all charts
    destroy() {
        this.charts.clear();
        this.canvasContext.clear();
        console.log('📊 ChartManager destroyed');
    }
}

// Initialize ChartManager
console.log('📊 Creating ChartManager instance...');
window.chartManager = new ChartManager();

// Debug functions
window.debugCharts = function() {
    console.log('=== CHART MANAGER DEBUG ===');
    console.log('Chart Manager:', window.chartManager);
    console.log('Status:', window.chartManager?.getStatus());
    console.log('Available methods:', Object.getOwnPropertyNames(ChartManager.prototype));
    console.log('Mini chart canvas:', document.getElementById('miniSpeedChart'));
    console.log('Speed chart canvas:', document.getElementById('speedChart'));
    console.log('============================');
};

window.testMiniChart = function() {
    console.log('🧪 Testing mini chart with sample data...');
    const sampleData = [];
    const now = Date.now();
    
    for (let i = 0; i < 8; i++) {
        sampleData.push({
            timestamp: now - (7 - i) * 60000,
            speed: Math.random() * 40 + 10
        });
    }
    
    if (window.chartManager && window.chartManager.updateMiniSpeedChart) {
        window.chartManager.updateMiniSpeedChart(sampleData);
        console.log('✅ Mini chart test data applied');
    } else {
        console.error('❌ Mini chart method not available');
    }
};

window.testSpeedChart = function() {
    console.log('🧪 Testing speed chart with sample data...');
    const sampleData = [];
    const now = Date.now();
    
    for (let i = 0; i < 12; i++) {
        sampleData.push({
            timestamp: now - (11 - i) * 300000, // 5 minute intervals
            speed: Math.random() * 60 + 5
        });
    }
    
    if (window.chartManager && window.chartManager.updateSpeedChart) {
        window.chartManager.updateSpeedChart(sampleData);
        console.log('✅ Speed chart test data applied');
    } else {
        console.error('❌ Speed chart method not available');
    }
};

window.initAllCharts = function() {
    console.log('🔄 Force initializing all charts...');
    if (window.chartManager) {
        window.chartManager.initializeAllCharts();
    }
};

console.log('✅ ChartManager module loaded successfully');
