// 菜单交互核心逻辑

// CSV导出工具函数
function exportDataToCSV() {
    try {
        const data = window.chartData;
        if (!data || !data.time || data.time.length === 0) {
            ToastAlert.show('暂无数据可导出');
            return;
        }

        // 构建CSV内容
        const headers = ['时间', '温度(°C)', '湿度(%)', '风速(m/s)', '光照(lux)', 'PM2.5(μg/m³)', '紫外线强度'];
        let csvContent = headers.join(',') + '\n';

        // 添加数据行
        for (let i = 0; i < data.time.length; i++) {
            const row = [
                data.time[i] || '',
                data.temperature[i] !== undefined ? data.temperature[i] : '',
                data.humidity[i] !== undefined ? data.humidity[i] : '',
                data.windSpeed[i] !== undefined ? data.windSpeed[i] : '',
                data.illumination[i] !== undefined ? data.illumination[i] : '',
                data.PM2[i] !== undefined ? data.PM2[i] : '',
                data.sunray[i] !== undefined ? data.sunray[i] : ''
            ];
            csvContent += row.join(',') + '\n';
        }

        // 创建Blob并触发下载
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        // 生成文件名（包含当前时间）
        const now = new Date();
        const filename = `环境监测数据_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.csv`;
        
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        ToastAlert.show('数据导出成功');
    } catch (error) {
        console.error('导出CSV失败:', error);
        ToastAlert.show('导出失败，请稍后重试');
    }
}

// 滚动穿透控制工具
const ScrollLock = {
    scrollTop: 0,
    lock() {
        this.scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        document.body.classList.add('modal-open');
        document.body.style.top = `-${this.scrollTop}px`;
    },
    unlock() {
        document.body.classList.remove('modal-open');
        document.body.style.top = '';
        window.scrollTo(0, this.scrollTop);
    }
};

// 导出供其他模块使用
window.ScrollLock = ScrollLock;

// ===== 环境设备控制面板 =====

// 设备控制状态缓存
let deviceControlState = {
    auto: null,
    light: null,
    lastUpdate: null
};

// 初始化设备控制面板
function initDeviceControlPanel() {
    const deviceControlModal = document.getElementById('deviceControlModal');
    if (!deviceControlModal) return;
    
    // 使用新的按钮类名
    const controlBtns = deviceControlModal.querySelectorAll('.control-toggle-btn');
    const closeBtn = document.getElementById('deviceControlCloseBtn');
    const deviceControlClose = document.getElementById('deviceControlClose');
    
    // 同步全局状态
    if (window.deviceControlState) {
        deviceControlState.auto = window.deviceControlState.Auto;
        deviceControlState.light = window.deviceControlState.Light;
    }
    
    // 关闭按钮事件
    window.ModalHelper.bindCloseBtn(closeBtn, deviceControlModal);
    window.ModalHelper.bindCloseBtn(deviceControlClose, deviceControlModal);

    // 点击遮罩关闭 + 内容区阻止冒泡
    window.ModalHelper.bindBackdropClose(deviceControlModal);
    
    // 控制按钮事件处理
    controlBtns.forEach(btn => {
        btn.addEventListener('click', handleDeviceControlClick);
    });
    
    // 初始化状态显示
    updateAllButtonStates();
}

// 处理设备控制按钮点击
function handleDeviceControlClick(e) {
    const btn = e.currentTarget;
    const controlType = btn.dataset.control;
    const controlValue = parseInt(btn.dataset.value);
    
    if (!controlType) {
        console.error('❌ 设备控制类型未定义');
        return;
    }
    
    // 显示加载状态
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = '⏳ 发送...';
    
    // 发送控制命令（sendDeviceControl会自动处理Auto=0逻辑）
    const success = window.sendDeviceControl(controlType, controlValue);
    
    // 恢复按钮状态
    setTimeout(() => {
        btn.disabled = false;
        btn.textContent = originalText;
        
        if (success) {
            // 从全局状态同步到本地
            if (window.deviceControlState) {
                deviceControlState.auto = window.deviceControlState.Auto;
                deviceControlState.light = window.deviceControlState.Light;
            }
            
            // 更新所有按钮的UI状态
            updateAllButtonStates();
        }
    }, 300);
}

// 更新所有按钮的显示状态
function updateAllButtonStates() {
    const deviceControlModal = document.getElementById('deviceControlModal');
    if (!deviceControlModal) return;
    
    // 更新自动控制按钮状态
    updateButtonActiveState('auto', deviceControlState.auto);
    // 更新灯光控制按钮状态
    updateButtonActiveState('light', deviceControlState.light);
    // 更新状态文本
    updateControlStatusText();
}

// 更新按钮显示状态
function updateButtonActiveState(controlType, controlValue) {
    const deviceControlModal = document.getElementById('deviceControlModal');
    if (!deviceControlModal) return;
    
    // 使用新的按钮类名
    const relevantBtns = deviceControlModal.querySelectorAll(`.control-toggle-btn[data-control="${controlType}"]`);
    
    relevantBtns.forEach(btn => {
        const btnValue = parseInt(btn.dataset.value);
        if (btnValue === controlValue) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// 更新设备状态显示（简化版，不再有状态文本区域）
function updateDeviceControlStatus() {
    // 从全局状态同步（仅更新存在的字段）
    if (window.deviceControlState) {
        if (window.deviceControlState.Auto !== undefined) deviceControlState.auto = window.deviceControlState.Auto;
        if (window.deviceControlState.Light !== undefined) deviceControlState.light = window.deviceControlState.Light;
    }
    
    // 更新按钮active状态（根据 auto/light 值）
    updateAllButtonStates();
}

// 更新状态文本显示（保留但简化）
function updateControlStatusText() {
    // 新版UI不需要状态文本，直接通过按钮active状态显示
}

// 导出全局
window.initDeviceControlPanel = initDeviceControlPanel;
window.updateDeviceControlStatus = updateDeviceControlStatus;
window.updateAllButtonStates = updateAllButtonStates;

// 更新用户中心显示
function updateUserCenterDisplay() {
    const userInfoSection = document.getElementById('userInfoSection');
    const userLoginPrompt = document.getElementById('userLoginPrompt');
    const userCenterUsername = document.getElementById('userCenterUsername');
    const userCenterRole = document.getElementById('userCenterRole');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginPromptBtn = document.getElementById('loginPromptBtn');
    
    if (!userInfoSection || !userLoginPrompt) return;
    
    // 检查用户是否已登录
    if (window.currentUser && window.currentUser.username) {
        // 已登录，显示用户信息
        userInfoSection.classList.remove('is-hidden');
        userLoginPrompt.classList.add('is-hidden');
        if (logoutBtn) logoutBtn.classList.remove('is-hidden');
        if (loginPromptBtn) loginPromptBtn.classList.add('is-hidden');
        
        if (userCenterUsername) {
            userCenterUsername.textContent = window.currentUser.username;
        }
        
        if (userCenterRole) {
            const roleText = window.currentUser.role === window.USER_ROLES.ADMIN 
                ? '👑 管理员 ' + window.currentUser.username 
                : '👤 用户 ' + window.currentUser.username;
            userCenterRole.textContent = roleText;
        }
    } else {
        // 未登录，显示登录提示
        userInfoSection.classList.add('is-hidden');
        userLoginPrompt.classList.remove('is-hidden');
        if (logoutBtn) logoutBtn.classList.add('is-hidden');
        if (loginPromptBtn) loginPromptBtn.classList.remove('is-hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const mqttConfigModal = document.getElementById('mqttConfigModal');
    const aboutModal = document.getElementById('aboutModal');
    const aboutModalClose = document.getElementById('aboutModalClose');
    const deviceVersionModal = document.getElementById('deviceVersionModal');
    const deviceVersionModalClose = document.getElementById('deviceVersionModalClose');
    const userCenterModal = document.getElementById('userCenterModal');
    const userCenterClose = document.getElementById('userCenterClose');
    const loginPromptBtn = document.getElementById('loginPromptBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // 用户中心登录提示按钮
    if (loginPromptBtn) {
        loginPromptBtn.addEventListener('click', () => {
            // 关闭用户中心弹窗
            window.ModalHelper.close(userCenterModal);
            // 打开登录弹窗
            if (window.openMqttConfig && typeof window.openMqttConfig === 'function') {
                window.openMqttConfig();
            }
        });
    }

    // 退出登录按钮
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            // 使用自定义确认弹窗而非浏览器默认confirm
            const confirmLogout = document.createElement('dialog');
            confirmLogout.className = 'toast-alert-modal';
            confirmLogout.innerHTML = `
                <div class="modal-mask"></div>
                <div class="toast-alert-content">
                    <div class="toast-alert-body">
                        <p style="margin: 0; font-size: 16px; line-height: 1.6;">
                            确定要退出登录吗？
                        </p>
                    </div>
                    <div class="toast-alert-footer" style="display: flex; gap: 12px; justify-content: center;">
                        <button type="button" class="btn btn-test" style="min-width: 100px;">取消</button>
                        <button type="button" class="btn btn-save" style="min-width: 100px;">确定退出</button>
                    </div>
                </div>
            `;
            document.body.appendChild(confirmLogout);
            confirmLogout.showModal();
            requestAnimationFrame(() => confirmLogout.classList.add('show'));
            
            const cancelBtn = confirmLogout.querySelector('.btn-test');
            const confirmBtn = confirmLogout.querySelector('.btn-save');
            
            cancelBtn.addEventListener('click', () => {
                confirmLogout.close();
                confirmLogout.remove();
            });
            
            confirmBtn.addEventListener('click', () => {
                confirmLogout.close();
                confirmLogout.remove();
                location.reload();
            });
            
            // 点击遮罩关闭
            confirmLogout.querySelector('.modal-mask').addEventListener('click', () => {
                confirmLogout.close();
                confirmLogout.remove();
            });
        });
    }

    // 点击用户中心弹窗背景关闭
    window.ModalHelper.bindBackdropClose(userCenterModal);

    // 用户中心关闭按钮
    window.ModalHelper.bindCloseBtn(userCenterClose, userCenterModal);

    // 关闭汉堡菜单工具函数
    function closeHamburgerMenu() {
        hamburgerMenu.classList.remove('active');
        dropdownMenu.classList.remove('show');
    }

    // 点击汉堡菜单切换显隐
    hamburgerMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        hamburgerMenu.classList.toggle('active');
        dropdownMenu.classList.toggle('show');
    });

    // 点击页面其他区域关闭菜单
    document.addEventListener('click', closeHamburgerMenu);

    // 关闭按钮 + 遮罩关闭
    window.ModalHelper.bindCloseBtn(aboutModalClose, aboutModal);
    window.ModalHelper.bindCloseBtn(deviceVersionModalClose, deviceVersionModal);
    window.ModalHelper.bindBackdropClose(deviceVersionModal);
    window.ModalHelper.bindBackdropClose(aboutModal);

    // 历史数据时间设置弹窗交互绑定
    const dataTimeModal = document.getElementById('dataTimeModal');
    if (dataTimeModal) {
        const dataTimeClose = document.getElementById('dataTimeClose');
        const dataTimeSaveBtn = document.getElementById('dataTimeSaveBtn');
        const dataTimeRange = document.getElementById('dataTimeRange');

        function loadDataTimeSettings() {
            try {
                const saved = localStorage.getItem('dataTimeRange');
                if (saved && dataTimeRange) {
                    dataTimeRange.value = saved;
                } else if (dataTimeRange) {
                    dataTimeRange.value = '1day';  // 默认一天内
                }
            } catch (e) { console.warn('加载数据时间设置失败', e); }
        }

        window.ModalHelper.bindCloseBtn(dataTimeClose, dataTimeModal);
        window.ModalHelper.bindBackdropClose(dataTimeModal);

        if (dataTimeSaveBtn) dataTimeSaveBtn.addEventListener('click', () => {
            const selectedRange = dataTimeRange ? dataTimeRange.value : '6hours';
            try { 
                localStorage.setItem('dataTimeRange', selectedRange); 
                
                // 📤 发送历史数据请求到 MQTT
                if (window.sendHistoryDataRequest) {
                    const sent = window.sendHistoryDataRequest(selectedRange);
                    if (sent) {
                        ToastAlert.show('正在获取历史数据...');
                    } else {
                        ToastAlert.show('数据时间范围已保存（MQTT未连接）');
                    }
                } else {
                    ToastAlert.show('数据时间范围已保存');
                }
            } catch (e) { 
                console.warn('保存数据时间设置失败', e); 
            }
            window.ModalHelper.close(dataTimeModal);
        });

        // 初始化时填充表单
        loadDataTimeSettings();
    }

    // 图表设置弹窗交互绑定
    const chartSettingsModal = document.getElementById('chartSettingsModal');
    if (chartSettingsModal) {
    const chartSettingsClose = document.getElementById('chartSettingsClose');
    const chartSettingsSaveBtn = document.getElementById('chartSettingsSaveBtn');

        function loadChartSettings() {
            try {
                const raw = localStorage.getItem('chartSettings');
                let cfg = null;
                if (raw) {
                    cfg = JSON.parse(raw);
                } else {
                    // 默认设置：平滑曲线
                    cfg = { smooth: true };
                }
                const smooth = document.getElementById('chartSmoothToggle');
                if (smooth) smooth.checked = cfg.smooth !== false; // 默认为true
            } catch (e) { console.warn('加载图表设置失败', e); }
        }

        function gatherChartSettings() {
            const smooth = document.getElementById('chartSmoothToggle');
            return {
                chartType: 'line',
                smooth: smooth ? !!smooth.checked : false
            };
        }

        window.ModalHelper.bindCloseBtn(chartSettingsClose, chartSettingsModal);
        window.ModalHelper.bindBackdropClose(chartSettingsModal);

        if (chartSettingsSaveBtn) chartSettingsSaveBtn.addEventListener('click', () => {
            const settings = gatherChartSettings();
            try { localStorage.setItem('chartSettings', JSON.stringify(settings)); } catch (e) { console.warn('保存图表设置失败', e); }
            if (window.applyChartSettings && typeof window.applyChartSettings === 'function') {
                try { window.applyChartSettings(settings); } catch (e) { console.warn('applyChartSettings 调用失败', e); }
            }
            window.ModalHelper.close(chartSettingsModal);
        });

        // 初始化时填充表单
        loadChartSettings();
    }

    // 菜单项点击事件处理
    dropdownMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetItem = e.target.closest('.dropdown-item');
        if (targetItem) {
            const action = targetItem.dataset.action;
            
            switch(action) {
                case 'user-center':
                    // 打开用户中心弹窗
                    const userCenterModal = document.getElementById('userCenterModal');
                    if (userCenterModal) {
                        updateUserCenterDisplay();
                        window.ModalHelper.open(userCenterModal);
                    } else {
                        ToastAlert.show('用户中心尚未就绪');
                    }
                    closeHamburgerMenu();
                    break;
                case 'device-control':
                    // 仅管理员可见
                    if (!window.currentUser || !window.currentUser.isAdmin || !window.currentUser.isAdmin()) {
                        ToastAlert.show('❌ 此功能仅限管理员使用');
                        closeHamburgerMenu();
                        break;
                    }
                    const deviceControlModal = document.getElementById('deviceControlModal');
                    if (deviceControlModal) {
                        window.ModalHelper.open(deviceControlModal);
                        initDeviceControlPanel();
                    } else {
                        ToastAlert.show('设备控制弹窗尚未就绪');
                    }
                    closeHamburgerMenu();
                    break;
                case 'mqtt-config':
                    if (window.mqttClient && window.mqttClient.isConnected && window.mqttClient.isConnected()) {
                        ToastAlert.show('MQTT已成功连接\\n\\n若需更换用户请刷新页面后重新登录\\n');
                        break;
                    }
                    if (window.openMqttConfig && typeof window.openMqttConfig === 'function') {
                        window.openMqttConfig();
                    }
                    closeHamburgerMenu();
                    break;
                case 'data-time':
                    const dataTimeModal = document.getElementById('dataTimeModal');
                    if (dataTimeModal) {
                        window.ModalHelper.open(dataTimeModal);
                    } else {
                        ToastAlert.show('历史数据时间设置尚未就绪');
                    }
                    closeHamburgerMenu();
                    break;
                case 'chart-setting':
                    const chartSettingsModal = document.getElementById('chartSettingsModal');
                    if (chartSettingsModal) {
                        window.ModalHelper.open(chartSettingsModal);
                    } else {
                        ToastAlert.show('图表显示设置尚未就绪');
                    }
                    closeHamburgerMenu();
                    break;
                case 'data-export':
                    exportDataToCSV();
                    closeHamburgerMenu();
                    break;
                case 'device-version':
                    if (deviceVersionModal) {
                        window.ModalHelper.open(deviceVersionModal);
                        updateDeviceVersionDisplay();
                    } else {
                        ToastAlert.show('设备版本弹窗尚未就绪');
                    }
                    closeHamburgerMenu();
                    break;
                case 'about':
                    window.ModalHelper.open(aboutModal);
                    closeHamburgerMenu();
                    break;
            }
        }
    });
});

// 更新设备版本显示函数
function updateDeviceVersionDisplay() {
    // 从全局数据中获取版本信息
    const stm32Ver = window.latestData?.stm_ver;
    const esp32Ver = window.latestData?.esp_ver;
    
    const stm32VersionEl = document.getElementById('stm32Version');
    const esp32VersionEl = document.getElementById('esp32Version');
    const lastUpdateTimeEl = document.getElementById('lastUpdateTime');
    
    if (stm32VersionEl) {
        stm32VersionEl.textContent = stm32Ver ? stm32Ver : '--';
    }
    
    if (esp32VersionEl) {
        esp32VersionEl.textContent = esp32Ver ? esp32Ver : '--';
    }
    
    if (lastUpdateTimeEl) {
        if (window.latestData?.stm_ver || window.latestData?.esp_ver) {
            const now = new Date();
            const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
            lastUpdateTimeEl.textContent = timeStr;
        } else {
            lastUpdateTimeEl.textContent = '--';
        }
    }
}

// 暴露给全局作用域
window.updateDeviceVersionDisplay = updateDeviceVersionDisplay;