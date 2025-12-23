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

// 节流函数 - 限制函数执行频率
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
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
    isTablet: () => window.innerWidth > 767 && window.innerWidth <= 1023,
    isDesktop: () => window.innerWidth > 1023,
    isAndroid: () => /Android/i.test(navigator.userAgent),
    isIOS: () => /iPhone|iPad|iPod/i.test(navigator.userAgent),
    isTouchDevice: () => 'ontouchstart' in window || navigator.maxTouchPoints > 0
};

// 核心：动态计算状态点位置（左侧与菜单对称）
function setStatusDotPosition() {
    const status = document.getElementById('mqtt-status');
    const titleContainer = document.getElementById('titleContainer');
    
    if (!status || !titleContainer) return;

    const containerRect = titleContainer.getBoundingClientRect();
    const dotMargin = getComputedStyle(document.documentElement).getPropertyValue('--dot-margin').trim();
    
    // 左侧：与菜单按钮对称（菜单在右侧位置，状态点在左侧）
    const left = parseInt(dotMargin) || 15;
    // 垂直：容器中心点
    const top = (containerRect.height / 2);

    status.style.left = `${left}px`;
    status.style.top = `${top}px`;
    status.style.opacity = 1;
}

// MQTT状态更新逻辑 - 增强动画效果
function updateMQTTStatus(statusType) {
    const statusElement = document.getElementById('mqtt-status');
    const statusText = statusElement.querySelector('.status-text');
    if (!statusElement || !statusText) return;
    
    statusElement.classList.remove('connecting', 'connected', 'failed', 'disconnected');
    
    // 添加反弹动画
    statusElement.style.animation = 'none';
    setTimeout(() => {
        statusElement.style.animation = 'float 0.6s ease-in-out';
    }, 10);
    
    switch(statusType) {
        case 'connecting':
            statusText.textContent = "连接中...";
            statusElement.classList.add('connecting');
            break;
        case 'success':
            statusText.textContent = "已连接";
            statusElement.classList.add('connected');
            break;
        case 'failed':
            statusText.textContent = "已断开";
            statusElement.classList.add('failed', 'disconnected');
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

// 添加数据卡片动画效果
function animateDataCard(cardElement) {
    cardElement.style.animation = 'none';
    setTimeout(() => {
        cardElement.classList.add('data-card-animate');
        cardElement.style.animation = 'fadeIn 0.4s ease-out';
    }, 10);
}

// 页面初始化逻辑
window.addEventListener('load', () => {
    console.log('📖 页面加载完成，开始初始化...');
    proceedWithInit();
});

function proceedWithInit() {
    console.log('📖 开始应用初始化...');
    const isMobileDevice = DeviceDetector.isMobile() || DeviceDetector.isAndroid() || DeviceDetector.isIOS();
    // 移动端延长初始化延迟，确保容器尺寸稳定
    const delay = isMobileDevice ? 400 : 150;
    
    // 显示加载指示器
    showLoadingIndicator();
    
    setTimeout(() => {
        console.log('⏱️ 初始化延迟完成，准备初始化图表...');
        // MQTT 初始化已在 mqtt-client.js 的 DOMContentLoaded 中处理
        
        if (typeof initCharts === 'function') {
            console.log('📊 初始化图表...');
            initCharts();
        } else {
            console.warn('⚠️ initCharts 函数未定义');
        }
        
        // 计算状态点位置
        setStatusDotPosition();
        
        // 🔐 自动打开登录弹窗，等待用户登录
        setTimeout(() => {
            if (window.openMqttConfig && typeof window.openMqttConfig === 'function') {
                console.log('🔐 打开用户登录弹窗...');
                window.openMqttConfig();
            }
        }, 100);
        
        // 为数据卡片添加动画
        const dataCards = document.querySelectorAll('.data-card');
        dataCards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.08}s`;
            card.style.animation = 'slideInUp 0.4s ease-out backwards';
        });
        
        // 移动端额外延迟刷新图表，确保高度生效
        const resizeDelay = isMobileDevice ? 600 : 80;
        setTimeout(() => {
            console.log('🔄 调整图表尺寸...');
            resizeAllCharts();
            
            // 隐藏加载指示器
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

// RAF 节流版本 - 用于高频率事件
const rafResize = rafThrottle(() => {
    setStatusDotPosition();
});

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