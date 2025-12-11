// 核心：动态计算状态点位置
function setStatusDotPosition() {
    const lastChar = document.querySelector('.last-char');
    const status = document.getElementById('mqtt-status');
    const titleContainer = document.getElementById('titleContainer');
    
    if (!lastChar || !status || !titleContainer) return;

    const lastCharRect = lastChar.getBoundingClientRect();
    const containerRect = titleContainer.getBoundingClientRect();
    const dotMargin = getComputedStyle(document.documentElement).getPropertyValue('--dot-margin').trim();
    
    // 水平：控字右侧空白
    const left = (lastCharRect.left - containerRect.left) + lastCharRect.width + parseInt(dotMargin);
    // 垂直：控字中心点
    const top = (lastCharRect.top - containerRect.top) + (lastCharRect.height / 2);

    status.style.left = `${left}px`;
    status.style.top = `${top}px`;
    status.style.opacity = 1;
}

// MQTT状态更新逻辑
function updateMQTTStatus(statusType) {
    const statusElement = document.getElementById('mqtt-status');
    const statusText = statusElement.querySelector('.status-text');
    if (!statusElement || !statusText) return;
    
    statusElement.classList.remove('connecting', 'connected', 'failed', 'disconnected');
    
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

// 页面初始化逻辑
window.addEventListener('load', () => {
    const isAndroid = /Android/i.test(navigator.userAgent);
    // 安卓端延长初始化延迟，确保容器尺寸稳定
    const delay = isAndroid ? 500 : 200;
    
    setTimeout(() => {
        // 初始化MQTT和图表
        if (typeof initMQTTClient === 'function') initMQTTClient();
        if (typeof initCharts === 'function') initCharts();
        
        // 计算状态点位置
        setStatusDotPosition();
        
        // 安卓端额外延迟刷新图表，确保高度生效
        setTimeout(() => {
            if (window.mainChart) window.mainChart.resize();
            if (window.lightChart) window.lightChart.resize();
        }, isAndroid ? 800 : 100);
    }, delay);
});

// 窗口变化监听
window.addEventListener('resize', () => {
    setStatusDotPosition();
    if (window.mainChart) window.mainChart.resize();
    if (window.lightChart) window.lightChart.resize();
});
window.addEventListener('orientationchange', () => {
    setStatusDotPosition();
    setTimeout(() => {
        if (window.mainChart) window.mainChart.resize();
        if (window.lightChart) window.lightChart.resize();
    }, 300);
});

// 页面卸载逻辑
window.onbeforeunload = function() {
    if (window.mqttClient && window.mqttClient.isConnected()) {
        window.mqttClient.disconnect();
    }
};