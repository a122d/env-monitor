// ===== 工具函数  =====

// 弹窗管理工具 - 基于原生 <dialog> 元素
const ModalHelper = {
    /**
     * 打开弹窗
     * @param {HTMLDialogElement} dialog
     */
    open(dialog) {
        if (!dialog || dialog.open) return;
        dialog.showModal();
        // 下一帧添加动画类，确保 opacity 过渡生效
        requestAnimationFrame(() => dialog.classList.add('show'));
        ScrollLock.lock();
    },
    /**
     * 关闭弹窗（带过渡动画）
     * @param {HTMLDialogElement} dialog
     */
    close(dialog) {
        if (!dialog || !dialog.open) return;
        dialog.classList.remove('show');
        ScrollLock.unlock();
        // 等待 CSS 过渡完成后关闭 dialog
        setTimeout(() => { if (dialog.open) dialog.close(); }, 350);
    },
    /**
     * 绑定点击遮罩关闭 + 内容区阻止冒泡
     * @param {HTMLDialogElement} dialog
     * @param {string} [contentSelector='.modal-content'] 内容区选择器
     */
    bindBackdropClose(dialog, contentSelector = '.modal-content') {
        if (!dialog) return;
        dialog.addEventListener('click', () => ModalHelper.close(dialog));
        const content = dialog.querySelector(contentSelector);
        if (content) content.addEventListener('click', e => e.stopPropagation());
    },
    /**
     * 绑定关闭按钮
     * @param {HTMLElement} btn
     * @param {HTMLDialogElement} dialog
     */
    bindCloseBtn(btn, dialog) {
        if (btn && dialog) btn.addEventListener('click', () => ModalHelper.close(dialog));
    },
    /**
     * 初始化所有 dialog 的原生 Escape 键拦截
     */
    initAll() {
        document.querySelectorAll('dialog').forEach(dialog => {
            dialog.addEventListener('cancel', (e) => {
                e.preventDefault();
                ModalHelper.close(dialog);
            });
        });
    }
};
window.ModalHelper = ModalHelper;

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

// 批量DOM更新调度器 - 优化重绘性能
const DOMScheduler = {
    _writes: [],
    _scheduled: false,
    
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
        const writes = this._writes;
        this._writes = [];
        this._scheduled = false;
        
        writes.forEach(fn => fn());
    }
};

// 设备检测 
const DeviceDetector = {
    isMobile: () => window.innerWidth <= 767,
    isAndroid: () => /Android/i.test(navigator.userAgent),
    isIOS: () => /iPhone|iPad|iPod/i.test(navigator.userAgent),
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
        // 初始化所有 dialog 的 Escape 键拦截
        ModalHelper.initAll();

        if (typeof initCharts === 'function') {
            initCharts();
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

// 统一图表尺寸调整函数
function resizeAllCharts() {
    requestAnimationFrame(() => {
        // 使用实际存在的 combinedChart
        if (window.combinedChart && typeof window.combinedChart.resize === 'function') {
            window.combinedChart.resize();
        }
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