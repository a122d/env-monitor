// 核心：动态计算状态点位置（左侧与菜单对称）
function setStatusDotPosition() {
    const status = document.getElementById('mqtt-status');
    const titleContainer = document.getElementById('titleContainer');
    
    if (!status || !titleContainer) return;

    const containerRect = titleContainer.getBoundingClientRect();
    const dotMargin = getComputedStyle(document.documentElement).getPropertyValue('--dot-margin').trim();
    
    // 左侧：与菜单按钮对称（菜单在右侧 40px 位置，状态点在左侧）
    const left = parseInt(dotMargin);
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
        loader.style.display = 'flex';
    }
}

// 隐藏加载指示器
function hideLoadingIndicator() {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
        loader.style.display = 'none';
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
    const isAndroid = /Android/i.test(navigator.userAgent);
    // 安卓端延长初始化延迟，确保容器尺寸稳定
    const delay = isAndroid ? 500 : 200;
    
    // 显示加载指示器
    showLoadingIndicator();
    
    setTimeout(() => {
        console.log('⏱️ 初始化延迟完成，准备初始化 MQTT 和图表...');
        // 初始化MQTT和图表
        if (typeof initMQTTClient === 'function') {
            console.log('🔌 初始化 MQTT 客户端...');
            initMQTTClient();
        } else {
            console.warn('⚠️ initMQTTClient 函数未定义');
        }
        
        if (typeof initCharts === 'function') {
            console.log('📊 初始化图表...');
            initCharts();
        } else {
            console.warn('⚠️ initCharts 函数未定义');
        }
        
        // 计算状态点位置
        setStatusDotPosition();
        
        // 为数据卡片添加动画
        const dataCards = document.querySelectorAll('.data-card');
        dataCards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
            card.style.animation = 'slideInUp 0.5s ease-out backwards';
        });
        
        // 安卓端额外延迟刷新图表，确保高度生效
        setTimeout(() => {
            console.log('🔄 调整图表尺寸...');
            if (window.mainChart) window.mainChart.resize();
            if (window.lightChart) window.lightChart.resize();
            
            // 隐藏加载指示器
            hideLoadingIndicator();
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