// ===== 工具函数 =====

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// requestAnimationFrame 节流 - 用于动画相关操作
function rafThrottle(callback) {
    let requestId = null;
    return function(...args) {
        if (requestId === null) {
            requestId = requestAnimationFrame(() => {
                callback.apply(this, args);
                requestId = null;
            });
        }
    };
}

// 设备检测
const DeviceDetector = {
    isMobile: () => window.innerWidth <= 767,
    isAndroid: () => /Android/i.test(navigator.userAgent),
    isIOS: () => /iPhone|iPad|iPod/i.test(navigator.userAgent)
};

// 核心：动态计算状态点位置（使用flex布局）
function setStatusDotPosition() {
    const status = document.getElementById('combined-status') || document.getElementById('mqtt-status');
    if (!status) return;
    status.style.opacity = 1;
}

// 缓存上次MQTT状态，避免重复动画
let lastMQTTStatus = null;

// MQTT状态更新逻辑 - 性能优化版
function updateMQTTStatus(statusType) {
    const statusElement = document.getElementById('combined-status') || document.getElementById('mqtt-status');
    if (!statusElement) return;
    
    // 如果状态没有变化，跳过更新（避免重复动画）
    if (lastMQTTStatus === statusType) return;
    
    lastMQTTStatus = statusType;
    
    statusElement.classList.remove('connecting', 'connected', 'failed', 'disconnected');
    
    // 只在状态改变时添加一次动画
    statusElement.style.animation = 'none';
    requestAnimationFrame(() => {
        statusElement.style.animation = 'float 0.6s ease-in-out';
    });
    
    switch(statusType) {
        case 'connecting':
            statusElement.classList.add('connecting');
            break;
        case 'success':
            statusElement.classList.add('connected');
            break;
        case 'failed':
            statusElement.classList.add('failed', 'disconnected');
            // MQTT断开时清空用户信息，显示"未登录"
            window.currentUser = { username: null, role: null };
            if (window.updateUserInfoDisplay) {
                window.updateUserInfoDisplay();
            }
            break;
    }
    setStatusDotPosition();
}

// 显示加载指示器
function showLoadingIndicator() {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
        loader.classList.remove('hidden');
        loader.style.display = 'flex';
    }
}

// 隐藏加载指示器
function hideLoadingIndicator() {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
        loader.classList.add('hidden');
        // 延迟隐藏，等待过渡动画完成
        setTimeout(() => {
            loader.style.display = 'none';
        }, 300);
    }
}



// 页面初始化逻辑
window.addEventListener('load', () => {
    proceedWithInit();
});

function proceedWithInit() {
    const isMobileDevice = DeviceDetector.isMobile() || DeviceDetector.isAndroid() || DeviceDetector.isIOS();
    const delay = isMobileDevice ? 400 : 150;
    
    showLoadingIndicator();
    
    setTimeout(() => {
        if (typeof initCharts === 'function') {
            initCharts();
        } else {
            console.warn('⚠️ initCharts 函数未定义');
        }
        
        setStatusDotPosition();
        
        setTimeout(() => {
            if (window.openMqttConfig && typeof window.openMqttConfig === 'function') {
                window.openMqttConfig();
            }
        }, 100);
        
        // 为数据卡片添加动画
        const dataCards = document.querySelectorAll('.data-card');
        dataCards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.08}s`;
            card.style.animation = 'slideInUp 0.4s ease-out backwards';
        });
        
        const resizeDelay = isMobileDevice ? 600 : 80;
        setTimeout(() => {
            resizeAllCharts();
            hideLoadingIndicator();
        }, resizeDelay);
    }, delay);
}

// 统一图表尺寸调整函数
function resizeAllCharts() {
    // 使用 requestAnimationFrame 确保在下一帧渲染前调整
    requestAnimationFrame(() => {
        if (window.tempChart) window.tempChart.resize();
        if (window.humidityChart) window.humidityChart.resize();
        if (window.windChart) window.windChart.resize();
        if (window.lightChart) window.lightChart.resize();
        if (window.PM2Chart) window.PM2Chart.resize();
        if (window.sunrayChart) window.sunrayChart.resize();
    });
}

// 防抖版本的图表尺寸调整
const debouncedResize = debounce(() => {
    setStatusDotPosition();
    resizeAllCharts();
}, 150);

// 窗口变化监听 - 使用 passive 提升滚动性能
window.addEventListener('resize', debouncedResize, { passive: true });

// 方向改变监听（移动端）
window.addEventListener('orientationchange', () => {
    setStatusDotPosition();
    // 方向改变后需要较长延迟等待布局稳定
    setTimeout(resizeAllCharts, 350);
});

// 视觉视口变化监听（适配虚拟键盘等）
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', debouncedResize);
}