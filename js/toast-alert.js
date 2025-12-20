/**
 * 自定义提示弹窗工具函数
 * 替代浏览器 alert()，支持点击空白处关闭
 */

window.ToastAlert = (function() {
    'use strict';
    
    // 获取弹窗元素
    const modal = document.getElementById('toastAlertModal');
    const modalMask = modal ? modal.querySelector('.modal-mask') : null;
    const messageEl = document.getElementById('toastAlertMessage');
    const confirmBtn = document.getElementById('toastAlertBtn');
    
    let isShown = false;
    let onConfirmCallback = null;
    
    /**
     * 显示提示弹窗
     * @param {string} message - 提示消息
     * @param {function} onConfirm - 点击确定时的回调
     */
    function show(message, onConfirm = null) {
        if (!modal) return;
        
        // 设置消息
        if (messageEl) {
            messageEl.innerHTML = message.replace(/\\n/g, '<br>');
        }
        
        // 保存回调
        onConfirmCallback = onConfirm;
        
        // 显示弹窗
        modal.classList.add('show');
        isShown = true;
        
        // 禁用背景滚动
        if (window.ScrollLock) {
            window.ScrollLock.lock();
        }
        
        // 获焦到确定按钮
        if (confirmBtn) {
            confirmBtn.focus();
        }
    }
    
    /**
     * 关闭提示弹窗
     */
    function close() {
        if (!modal) return;
        
        // 隐藏弹窗
        modal.classList.remove('show');
        isShown = false;
        
        // 恢复背景滚动
        if (window.ScrollLock) {
            window.ScrollLock.unlock();
        }
        
        // 执行回调
        if (typeof onConfirmCallback === 'function') {
            onConfirmCallback();
        }
        
        onConfirmCallback = null;
    }
    
    /**
     * 初始化事件绑定
     */
    function init() {
        if (!modal) return;
        
        // 确定按钮点击
        if (confirmBtn) {
            confirmBtn.addEventListener('click', close);
        }
        
        // 点击空白区域关闭
        if (modalMask) {
            modalMask.addEventListener('click', close);
        }
        
        // 防止点击弹窗内容时关闭
        const alertContent = modal.querySelector('.toast-alert-content');
        if (alertContent) {
            alertContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        // Escape 键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isShown) {
                close();
            }
        });
    }
    
    // DOM 加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // 暴露公共接口
    return {
        show,
        close,
        isShown: () => isShown
    };
})();
