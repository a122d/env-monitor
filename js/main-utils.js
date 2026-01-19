// ===== 工具函数  =====

// 防抖函数 - 用于减少频繁触发的操作
function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const context = this;
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

// requestAnimationFrame 节流 - 用于动画相关操作
function rafThrottle(callback) {
    let requestId = null;
    let lastArgs = null;
    
    const later = () => {
        requestId = null;
        callback.apply(null, lastArgs);
    };
    
    return function(...args) {
        lastArgs = args;
        if (requestId === null) {
            requestId = requestAnimationFrame(later);
        }
    };
}

// 批量DOM更新调度器 - 优化重绘性能
const DOMScheduler = {
    _reads: [],
    _writes: [],
    _scheduled: false,
    
    read(fn) {
        this._reads.push(fn);
        this._schedule();
    },
    
    write(fn) {
        this._writes.push(fn);
        this._schedule();
    },
    
    _schedule() {
        if (!this._scheduled) {
            this._scheduled = true;
            requestAnimationFrame(() => this._flush());
        }
    },
    
    _flush() {
        // 先执行所有读取操作
        const reads = this._reads;
        const writes = this._writes;
        this._reads = [];
        this._writes = [];
        this._scheduled = false;
        
        reads.forEach(fn => fn());
        writes.forEach(fn => fn());
    }
};

// 设备检测 
const DeviceDetector = {
    isMobile: () => window.innerWidth <= 767,
    isAndroid: () => /Android/i.test(navigator.userAgent),
    isIOS: () => /iPhone|iPad|iPod/i.test(navigator.userAgent),
    // 检测是否支持触摸
    hasTouch: () => 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    // 检测是否开启了减少动效
    prefersReducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
};

// 核心：动态计算状态点位置（使用flex布局）
function setStatusDotPosition() {
    const status = document.getElementById('combined-status') || document.getElementById('mqtt-status');
    if (!status) return;
    DOMScheduler.write(() => {
        status.style.opacity = 1;
    });
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
    
    // 使用DOMScheduler批量处理DOM更新
    DOMScheduler.write(() => {
        statusElement.classList.remove('connecting', 'connected', 'failed', 'disconnected');
        
        // 只在非减少动效模式下播放动画
        if (!DeviceDetector.prefersReducedMotion()) {
            statusElement.style.animation = 'none';
            // 强制重排以重启动画
            void statusElement.offsetWidth;
            statusElement.style.animation = 'float 0.5s var(--ease-out-expo)';
        }
        
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
                if (window.currentUser) {
                    window.currentUser.username = null;
                    window.currentUser.role = null;
                }
                if (window.updateUserInfoDisplay) {
                    window.updateUserInfoDisplay();
                }
                break;
        }
    });
    
    setStatusDotPosition();
}

// 显示加载指示器 - 优化动画性能
function showLoadingIndicator() {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
        DOMScheduler.write(() => {
            loader.classList.remove('hidden');
            loader.style.display = 'flex';
        });
    }
}

// 隐藏加载指示器 - 优化过渡
function hideLoadingIndicator() {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
        DOMScheduler.write(() => {
            loader.classList.add('hidden');
        });
        // 使用较短延迟，等待过渡动画完成
        setTimeout(() => {
            DOMScheduler.write(() => {
                loader.style.display = 'none';
            });
        }, 280);
    }
}



// 页面初始化逻辑 - 优化版
window.addEventListener('load', () => {
    proceedWithInit();
});

function proceedWithInit() {
    const isMobileDevice = DeviceDetector.isMobile() || DeviceDetector.isAndroid() || DeviceDetector.isIOS();
    const reducedMotion = DeviceDetector.prefersReducedMotion();
    const delay = isMobileDevice ? 300 : 100;
    
    showLoadingIndicator();
    
    // 使用requestIdleCallback优化初始化时机（如果支持）
    const scheduleInit = window.requestIdleCallback || ((cb) => setTimeout(cb, delay));
    
    scheduleInit(() => {
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
        }, 80);
        
        // 为数据卡片添加动画 - 优化版
        if (!reducedMotion) {
            const dataCards = document.querySelectorAll('.data-card');
            dataCards.forEach((card, index) => {
                DOMScheduler.write(() => {
                    card.style.animationDelay = `${index * 0.05}s`;
                    card.style.animation = 'slideInUp 0.4s var(--ease-out-expo) backwards';
                });
            });
        }
        
        const resizeDelay = isMobileDevice ? 400 : 60;
        setTimeout(() => {
            resizeAllCharts();
            hideLoadingIndicator();
        }, resizeDelay);
    }, { timeout: 200 });
}

// 统一图表尺寸调整函数 - 优化版
function resizeAllCharts() {
    // 使用 requestAnimationFrame 确保在下一帧渲染前调整
    requestAnimationFrame(() => {
        const charts = [
            window.tempChart,
            window.humidityChart,
            window.windChart,
            window.lightChart,
            window.PM2Chart,
            window.sunrayChart
        ];
        
        // 批量调整图表大小
        charts.forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
            }
        });
    });
}

// 防抖版本的图表尺寸调整 - 优化响应速度
const debouncedResize = debounce(() => {
    setStatusDotPosition();
    resizeAllCharts();
}, 120);

// 窗口变化监听 - 使用 passive 提升滚动性能
window.addEventListener('resize', debouncedResize, { passive: true });

// 方向改变监听（移动端）- 优化延迟
window.addEventListener('orientationchange', () => {
    setStatusDotPosition();
    // 方向改变后需要较长延迟等待布局稳定
    setTimeout(resizeAllCharts, 300);
});

// 视觉视口变化监听（适配虚拟键盘等）
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', debouncedResize, { passive: true });
}

// 导出DOMScheduler供其他模块使用
window.DOMScheduler = DOMScheduler;
window.DeviceDetector = DeviceDetector;