// 菜单交互核心逻辑

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

document.addEventListener('DOMContentLoaded', () => {
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const mqttConfigModal = document.getElementById('mqttConfigModal');
    const aboutModal = document.getElementById('aboutModal');
    const aboutModalClose = document.getElementById('aboutModalClose');

    // 点击汉堡菜单切换显隐
    hamburgerMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        hamburgerMenu.classList.toggle('active');
        dropdownMenu.classList.toggle('show');
    });

    // 点击页面其他区域关闭菜单
    document.addEventListener('click', () => {
        hamburgerMenu.classList.remove('active');
        dropdownMenu.classList.remove('show');
    });

    // 关于系统弹窗 关闭按钮
    if (aboutModalClose) {
        aboutModalClose.addEventListener('click', () => {
            aboutModal.classList.remove('show');
            ScrollLock.unlock();
        });
    }

    // 图表设置弹窗交互绑定
    const chartSettingsModal = document.getElementById('chartSettingsModal');
    if (chartSettingsModal) {
    const chartSettingsClose = document.getElementById('chartSettingsClose');
    const chartSettingsSaveBtn = document.getElementById('chartSettingsSaveBtn');
    const chartResetDefaultsBtn = document.getElementById('chartResetDefaultsBtn');

        function loadChartSettings() {
            try {
                const raw = localStorage.getItem('chartSettings');
                if (!raw) return;
                const cfg = JSON.parse(raw);
                const sel = document.getElementById('chartTimeRangeSelect');
                if (sel && cfg.timeRange) sel.value = cfg.timeRange;
                const hist = document.getElementById('chartHistoryMode');
                if (hist) hist.checked = !!cfg.historyMode;
                const smooth = document.getElementById('chartSmoothToggle');
                if (smooth) smooth.checked = !!cfg.smooth;
                const markers = document.getElementById('chartMarkersToggle');
                if (markers) markers.checked = !!cfg.markers;
                const seriesChecks = document.querySelectorAll('.series-checkbox');
                seriesChecks.forEach(cb => {
                    const name = cb.dataset.series;
                    cb.checked = !(cfg.series && cfg.series[name] === false);
                });
            } catch (e) { console.warn('加载图表设置失败', e); }
        }

        function gatherChartSettings() {
            const sel = document.getElementById('chartTimeRangeSelect');
            const hist = document.getElementById('chartHistoryMode');
            const smooth = document.getElementById('chartSmoothToggle');
            const markers = document.getElementById('chartMarkersToggle');
            const seriesChecks = document.querySelectorAll('.series-checkbox');
            const series = {};
            seriesChecks.forEach(cb => { series[cb.dataset.series] = !!cb.checked; });
            return {
                timeRange: sel ? sel.value : '5m',
                historyMode: hist ? !!hist.checked : false,
                smooth: smooth ? !!smooth.checked : false,
                markers: markers ? !!markers.checked : false,
                series
            };
        }

        if (chartSettingsClose) chartSettingsClose.addEventListener('click', () => { chartSettingsModal.classList.remove('show'); ScrollLock.unlock(); });

        if (chartSettingsSaveBtn) chartSettingsSaveBtn.addEventListener('click', () => {
            const settings = gatherChartSettings();
            try { localStorage.setItem('chartSettings', JSON.stringify(settings)); } catch (e) { console.warn('保存图表设置失败', e); }
            if (window.applyChartSettings && typeof window.applyChartSettings === 'function') {
                try { window.applyChartSettings(settings); } catch (e) { console.warn('applyChartSettings 调用失败', e); }
            }
            chartSettingsModal.classList.remove('show');
            ScrollLock.unlock();
        });

        if (chartResetDefaultsBtn) chartResetDefaultsBtn.addEventListener('click', () => {
            // 清除 localStorage 中的设置并重置表单为默认
            try { localStorage.removeItem('chartSettings'); } catch (e) { console.warn('重置默认失败', e); }
            // 恢复表单默认值
            const sel = document.getElementById('chartTimeRangeSelect'); if (sel) sel.value = '5m';
            const hist = document.getElementById('chartHistoryMode'); if (hist) hist.checked = false;
            const smooth = document.getElementById('chartSmoothToggle'); if (smooth) smooth.checked = false;
            const markers = document.getElementById('chartMarkersToggle'); if (markers) markers.checked = false;
            const seriesChecks = document.querySelectorAll('.series-checkbox');
            seriesChecks.forEach(cb => cb.checked = true);
            ToastAlert.show('已重置为默认设置');
        });

        // 点击遮罩关闭
        const chartSettingsContent = chartSettingsModal.querySelector('.modal-content');
        chartSettingsModal.addEventListener('click', () => { chartSettingsModal.classList.remove('show'); ScrollLock.unlock(); });
        if (chartSettingsContent) chartSettingsContent.addEventListener('click', (e) => e.stopPropagation());

        // 初始化时填充表单
        loadChartSettings();
    }

    // 点击背景关闭弹窗
    if (aboutModal) {
        aboutModal.addEventListener('click', () => {
            aboutModal.classList.remove('show');
            ScrollLock.unlock();
        });
    }
    // 点击关于系统弹窗内容区域阻止关闭
    const aboutModalContent = aboutModal.querySelector('.modal-content');
    if (aboutModalContent) {
        aboutModalContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // 菜单项点击事件处理
    dropdownMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetItem = e.target.closest('.dropdown-item');
        if (targetItem) {
            const action = targetItem.dataset.action;
            
            switch(action) {
                case 'mqtt-config':
                    // 检查是否已连接，如果已连接则不允许重新登录
                    if (window.mqttClient && window.mqttClient.isConnected && window.mqttClient.isConnected()) {
                        ToastAlert.show('MQTT已成功连接\\n\\n若需更换用户请刷新页面后重新登录\\n');
                        break;
                    }
                    // 打开MQTT登录弹窗
                    if (window.openMqttConfig && typeof window.openMqttConfig === 'function') {
                        window.openMqttConfig();
                    }
                    // 关闭汉堡菜单
                    hamburgerMenu.classList.remove('active');
                    dropdownMenu.classList.remove('show');
                    break;
                case 'data-clear':
                    if (confirm('确定要清空所有历史监控数据吗？')) {
                        console.log('清空历史数据');
                        clearChartData(); // 预留函数
                    }
                    break;
                case 'chart-setting':
                    // 打开图表显示设置弹窗
                    const chartSettingsModal = document.getElementById('chartSettingsModal');
                    if (chartSettingsModal) {
                        chartSettingsModal.classList.add('show');
                        ScrollLock.lock();
                    } else {
                        ToastAlert.show('图表显示设置尚未就绪');
                    }
                    // 关闭汉堡菜单
                    hamburgerMenu.classList.remove('active');
                    dropdownMenu.classList.remove('show');
                    break;
                case 'data-export':
                    ToastAlert.show('即将导出监控数据为Excel（暂定）');
                    break;
                case 'about':
                    // 打开关于系统弹窗
                    aboutModal.classList.add('show');
                    ScrollLock.lock();
                    // 关闭汉堡菜单
                    hamburgerMenu.classList.remove('active');
                    dropdownMenu.classList.remove('show');
                    break;
            }
        }
    });
});