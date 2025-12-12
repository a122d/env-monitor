/**
 * MQTT客户端核心逻辑（稳定长连接+数据÷10处理）
 */
let mqttClient = null;
let reconnectTimer = null;
const RECONNECT_INTERVAL = 5000;
let baseClientId = 'env-monitor-' + Math.random().toString(16).substr(2, 8);

// 温度统计数据（增强版）
let temperatureStats = {
    current: 0,
    max: -Infinity,
    min: Infinity,
    sum: 0,
    count: 0,
    history: [],           // 保存最近10次数据用于趋势计算
    lastUpdateTime: null,  // 上次更新时间
    changeRate: 0          // 变化速率（℃/分钟）
};

// 湿度统计数据
let humidityStats = {
    current: 0,
    max: -Infinity,
    min: Infinity,
    sum: 0,
    count: 0,
    history: [],
    lastUpdateTime: null,
    changeRate: 0
};

// 风速统计数据
let windSpeedStats = {
    current: 0,
    max: -Infinity,
    min: Infinity,
    sum: 0,
    count: 0,
    history: [],
    lastUpdateTime: null,
    changeRate: 0
};

// 光照强度统计数据
let illuminationStats = {
    current: 0,
    max: -Infinity,
    min: Infinity,
    sum: 0,
    count: 0,
    history: [],
    lastUpdateTime: null,
    changeRate: 0
};

// 获取温度等级描述
function getTempLevel(temp) {
    if (temp < 0) return '❄️ 严寒';
    if (temp < 7) return '🥶 寒冷';
    if (temp < 16) return '❄️ 冷';
    if (temp < 20) return '🌤️ 凉爽';
    if (temp < 25) return '😊 舒适';
    if (temp < 30) return '☀️ 温暖';
    if (temp < 35) return '🔥 炎热';
    return '🌋 酷热';
}

// 计算温度变化趋势
function calculateTempTrend() {
    const history = temperatureStats.history;
    if (history.length < 2) {
        return { trend: '→', rate: 0 };
    }
    
    // 计算最近变化
    const current = history[history.length - 1];
    const previous = history[Math.max(0, history.length - 5)];
    const change = current - previous;
    
    // 计算变化速率（℃/分钟）
    let rate = 0;
    if (temperatureStats.lastUpdateTime) {
        const timeDiff = (Date.now() - temperatureStats.lastUpdateTime) / 60000; // 转换为分钟
        if (timeDiff > 0) {
            rate = (change / timeDiff);
        }
    }
    
    let trend = '→';
    if (change > 0.1) trend = '↑';
    if (change < -0.1) trend = '↓';
    
    return { trend, rate };
}

// 默认配置（优先从本地存储加载）
let mqttConfig = JSON.parse(localStorage.getItem('mqttConfig')) || {
    host: 'wss://mb67e10b.ala.cn-hangzhou.emqxsl.cn:8084/mqtt',
    clientId: baseClientId,
    topic: 'environment/data',
    username: 'WEB',
    password: '123456',
    keepalive: 30,
    clean: true
};

// 解析MQTT URL（提取host/port/path/SSL）
function parseMqttUrl(url) {
    const parsed = new URL(url);
    return {
        host: parsed.hostname,
        port: parseInt(parsed.port),
        path: parsed.pathname || '/mqtt',
        useSSL: parsed.protocol === 'wss:'
    };
}

// 生成唯一ClientId（防重复）
function generateUniqueClientId() {
    baseClientId = 'env-monitor-' + Math.random().toString(16).substr(2, 8);
    return baseClientId;
}

// 重连配置
const RECONNECT_CONFIG = {
    baseInterval: 1000,      // 初始延迟 1s
    maxInterval: 30000,      // 最大延迟 30s
    multiplier: 1.5,         // 指数退避系数
    maxRetries: 10,          // 最大重试 10 次
    jitter: 0.1              // 抖动 10%
};

let reconnectCount = 0;

// 计算退避延迟
function getReconnectDelay() {
    if (reconnectCount >= RECONNECT_CONFIG.maxRetries) {
        console.warn('❌ 重连次数已达上限，停止重连');
        return null;
    }
    
    let delay = RECONNECT_CONFIG.baseInterval * 
        Math.pow(RECONNECT_CONFIG.multiplier, reconnectCount);
    delay = Math.min(delay, RECONNECT_CONFIG.maxInterval);
    
    // 加入抖动，避免同时重连
    const jitterRange = delay * RECONNECT_CONFIG.jitter;
    delay += Math.random() * jitterRange;
    
    console.log(`🔄 第 ${reconnectCount + 1} 次重连，延迟 ${Math.round(delay)}ms`);
    return delay;
}

// 手动重连（全覆盖逻辑）
function reconnect() {
    if (reconnectTimer || (mqttClient && mqttClient.isConnected())) return;
    
    const delay = getReconnectDelay();
    if (delay === null) {
        updateMQTTStatus('failed');
        return;
    }
    
    reconnectCount++;
    reconnectTimer = setTimeout(() => {
        initMQTTClient();
        reconnectTimer = null;
    }, delay);
}

// 更新MQTT连接状态（需在main-utils.js或页面中实现DOM）
function updateMQTTStatus(status) {
    const statusEl = document.getElementById('mqtt-status');
    if (!statusEl) return;
    switch(status) {
        case 'connecting':
            statusEl.textContent = '连接中...';
            statusEl.style.color = '#ff9800';
            break;
        case 'success':
            statusEl.textContent = '已连接';
            statusEl.style.color = '#4caf50';
            break;
        case 'failed':
            statusEl.textContent = '连接失败';
            statusEl.style.color = '#f44336';
            break;
    }
}

// 更新数据卡片（温/湿/风÷10保留1位小数）
function updateDataCards(data) {
    // 温度：÷10保留1位小数，更新统计信息和颜色
    if (data.temperature !== undefined) {
        const tempValue = (parseFloat(data.temperature) / 10).toFixed(1);
        updateTemperatureCard(tempValue);
        updateDataValue('temperature', tempValue);
    }
    // 湿度：÷10保留1位小数
    if (data.humidity !== undefined) {
        const humiValue = (parseFloat(data.humidity) / 10).toFixed(1);
        updateHumidityCard(humiValue);
        updateDataValue('humidity', humiValue);
    }
    // 风速：÷10保留1位小数
    if (data.windSpeed !== undefined) {
        const windValue = (parseFloat(data.windSpeed) / 10).toFixed(1);
        updateWindSpeedCard(windValue);
        updateDataValue('windSpeed', windValue);
    }
    // 光照：保持整数
    if (data.illumination !== undefined) {
        const illuminationValue = parseInt(data.illumination);
        updateIlluminationCard(illuminationValue);
        updateDataValue('illumination', illuminationValue);
    }
}

// 更新温度卡片（增强版）
function updateTemperatureCard(tempValue) {
    const tempNum = parseFloat(tempValue);
    const card = document.getElementById('temperatureCard');
    if (!card) return;
    
    // 保存上次更新时间
    temperatureStats.lastUpdateTime = Date.now();
    
    // 更新历史数据（最多保留10个）
    temperatureStats.history.push(tempNum);
    if (temperatureStats.history.length > 10) {
        temperatureStats.history.shift();
    }
    
    // 更新温度统计
    temperatureStats.current = tempNum;
    if (temperatureStats.count === 0) {
        temperatureStats.max = tempNum;
        temperatureStats.min = tempNum;
    } else {
        temperatureStats.max = Math.max(temperatureStats.max, tempNum);
        temperatureStats.min = Math.min(temperatureStats.min, tempNum);
    }
    temperatureStats.sum += tempNum;
    temperatureStats.count++;
    
    // 更新颜色类
    card.classList.remove('temp-cold', 'temp-normal', 'temp-hot');
    if (tempNum < 7) {
        card.classList.add('temp-cold');
    } else if (tempNum > 25) {
        card.classList.add('temp-hot');
    } else {
        card.classList.add('temp-normal');
    }
    
    // 更新温度图标和等级
    const icon = card.querySelector('.temp-icon');
    if (tempNum < 7) {
        icon.textContent = '❄️';
    } else if (tempNum > 25) {
        icon.textContent = '🔥';
    } else {
        icon.textContent = '🌡️';
    }
    
    // 更新温度等级标签
    const levelEl = card.querySelector('.temp-level');
    if (levelEl) {
        levelEl.textContent = getTempLevel(tempNum);
    }
    
    // 更新温度进度条
    updateProgressBar(tempNum);
    
    // 更新趋势显示
    const trendData = calculateTempTrend();
    const trendEl = card.querySelector('.temp-trend');
    if (trendEl) {
        trendEl.textContent = trendData.trend;
        trendEl.classList.remove('up', 'down', 'stable');
        if (trendData.trend === '↑') {
            trendEl.classList.add('up');
        } else if (trendData.trend === '↓') {
            trendEl.classList.add('down');
        } else {
            trendEl.classList.add('stable');
        }
    }
    temperatureStats.changeRate = trendData.rate;
    
    // 更新详细信息
    updateTemperatureDetails();
}

// 更新进度条位置
function updateProgressBar(tempNum) {
    const progressFill = document.getElementById('tempProgress');
    if (!progressFill) return;
    
    // 将温度映射到0-100%
    // 0℃ = 0%, 32℃ = 100%
    const percentage = Math.max(0, Math.min(100, (tempNum / 32) * 100));
    progressFill.style.width = percentage + '%';
}

// 更新温度详细信息（增强版）
function updateTemperatureDetails() {
    const detailsContainer = document.getElementById('tempDetails');
    if (!detailsContainer) return;
    
    const avg = temperatureStats.count > 0 ? (temperatureStats.sum / temperatureStats.count).toFixed(1) : '--';
    const max = temperatureStats.max !== -Infinity ? temperatureStats.max.toFixed(1) : '--';
    const min = temperatureStats.min !== Infinity ? temperatureStats.min.toFixed(1) : '--';
    
    document.getElementById('tempCurrent').textContent = temperatureStats.current.toFixed(1) || '--';
    document.getElementById('tempMax').textContent = max;
    document.getElementById('tempMin').textContent = min;
    document.getElementById('tempAvg').textContent = avg;
    
    // 更新变化速率
    const changeRateEl = document.getElementById('tempChangeRate');
    if (changeRateEl) {
        if (temperatureStats.changeRate === undefined || isNaN(temperatureStats.changeRate)) {
            changeRateEl.textContent = '--℃/min';
        } else {
            const rateText = temperatureStats.changeRate > 0 
                ? '+' + temperatureStats.changeRate.toFixed(2) 
                : temperatureStats.changeRate.toFixed(2);
            changeRateEl.textContent = rateText + '℃/min';
        }
    }
}

// 更新湿度卡片
function updateHumidityCard(humidityValue) {
    const humidityNum = parseFloat(humidityValue);
    const card = document.getElementById('humidityCard');
    if (!card) return;
    
    humidityStats.lastUpdateTime = Date.now();
    humidityStats.history.push(humidityNum);
    if (humidityStats.history.length > 10) {
        humidityStats.history.shift();
    }
    
    humidityStats.current = humidityNum;
    if (humidityStats.count === 0) {
        humidityStats.max = humidityNum;
        humidityStats.min = humidityNum;
    } else {
        humidityStats.max = Math.max(humidityStats.max, humidityNum);
        humidityStats.min = Math.min(humidityStats.min, humidityNum);
    }
    humidityStats.sum += humidityNum;
    humidityStats.count++;
    
    // 更新湿度等级标签
    const levelEl = card.querySelector('.card-level');
    if (levelEl) {
        if (humidityNum < 30) {
            levelEl.textContent = '干燥';
        } else if (humidityNum < 70) {
            levelEl.textContent = '舒适';
        } else {
            levelEl.textContent = '潮湿';
        }
    }
    
    // 更新进度条
    const progressFill = card.querySelector('.card-progress-bar .progress-fill');
    if (progressFill) {
        const percentage = Math.max(0, Math.min(100, humidityNum));
        progressFill.style.width = percentage + '%';
    }
    
    // 更新趋势
    updateCardTrend(card, humidityStats, '.card-trend');
    
    // 更新详细信息
    updateHumidityDetails();
}

// 更新风速卡片
function updateWindSpeedCard(windSpeedValue) {
    const windNum = parseFloat(windSpeedValue);
    const card = document.getElementById('windSpeedCard');
    if (!card) return;
    
    windSpeedStats.lastUpdateTime = Date.now();
    windSpeedStats.history.push(windNum);
    if (windSpeedStats.history.length > 10) {
        windSpeedStats.history.shift();
    }
    
    windSpeedStats.current = windNum;
    if (windSpeedStats.count === 0) {
        windSpeedStats.max = windNum;
        windSpeedStats.min = windNum;
    } else {
        windSpeedStats.max = Math.max(windSpeedStats.max, windNum);
        windSpeedStats.min = Math.min(windSpeedStats.min, windNum);
    }
    windSpeedStats.sum += windNum;
    windSpeedStats.count++;
    
    // 更新风速等级标签
    const levelEl = card.querySelector('.card-level');
    if (levelEl) {
        if (windNum < 2) {
            levelEl.textContent = '平静';
        } else if (windNum < 5) {
            levelEl.textContent = '温和';
        } else if (windNum < 8) {
            levelEl.textContent = '较强';
        } else {
            levelEl.textContent = '强风';
        }
    }
    
    // 更新进度条
    const progressFill = card.querySelector('.card-progress-bar .progress-fill');
    if (progressFill) {
        const percentage = Math.max(0, Math.min(100, (windNum / 10) * 100));
        progressFill.style.width = percentage + '%';
    }
    
    // 更新趋势
    updateCardTrend(card, windSpeedStats, '.card-trend');
    
    // 更新详细信息
    updateWindSpeedDetails();
}

// 更新光照强度卡片
function updateIlluminationCard(illuminationValue) {
    const illuminationNum = parseFloat(illuminationValue);
    const card = document.getElementById('illuminationCard');
    if (!card) return;
    
    illuminationStats.lastUpdateTime = Date.now();
    illuminationStats.history.push(illuminationNum);
    if (illuminationStats.history.length > 10) {
        illuminationStats.history.shift();
    }
    
    illuminationStats.current = illuminationNum;
    if (illuminationStats.count === 0) {
        illuminationStats.max = illuminationNum;
        illuminationStats.min = illuminationNum;
    } else {
        illuminationStats.max = Math.max(illuminationStats.max, illuminationNum);
        illuminationStats.min = Math.min(illuminationStats.min, illuminationNum);
    }
    illuminationStats.sum += illuminationNum;
    illuminationStats.count++;
    
    // 更新光照等级标签
    const levelEl = card.querySelector('.card-level');
    if (levelEl) {
        if (illuminationNum < 100) {
            levelEl.textContent = '黑暗';
        } else if (illuminationNum < 1000) {
            levelEl.textContent = '微弱';
        } else if (illuminationNum < 5000) {
            levelEl.textContent = '适中';
        } else if (illuminationNum < 10000) {
            levelEl.textContent = '明亮';
        } else {
            levelEl.textContent = '极亮';
        }
    }
    
    // 更新进度条
    const progressFill = card.querySelector('.card-progress-bar .progress-fill');
    if (progressFill) {
        const percentage = Math.max(0, Math.min(100, (illuminationNum / 10000) * 100));
        progressFill.style.width = percentage + '%';
    }
    
    // 更新趋势
    updateCardTrend(card, illuminationStats, '.card-trend');
    
    // 更新详细信息
    updateIlluminationDetails();
}

// 通用卡片趋势更新函数
function updateCardTrend(card, stats, trendSelector) {
    const history = stats.history;
    if (history.length < 2) return;
    
    const current = history[history.length - 1];
    const previous = history[Math.max(0, history.length - 5)];
    const change = current - previous;
    
    let trend = '→';
    if (change > 0.1) trend = '↑';
    if (change < -0.1) trend = '↓';
    
    const trendEl = card.querySelector(trendSelector);
    if (trendEl) {
        trendEl.textContent = trend;
        trendEl.classList.remove('up', 'down', 'stable');
        if (trend === '↑') {
            trendEl.classList.add('up');
        } else if (trend === '↓') {
            trendEl.classList.add('down');
        } else {
            trendEl.classList.add('stable');
        }
    }
}

// 更新湿度详细信息
function updateHumidityDetails() {
    const avg = humidityStats.count > 0 ? (humidityStats.sum / humidityStats.count).toFixed(1) : '--';
    const max = humidityStats.max !== -Infinity ? humidityStats.max.toFixed(1) : '--';
    const min = humidityStats.min !== Infinity ? humidityStats.min.toFixed(1) : '--';
    
    document.getElementById('humidityCurrent').textContent = humidityStats.current.toFixed(1) || '--';
    document.getElementById('humidityMax').textContent = max;
    document.getElementById('humidityMin').textContent = min;
    document.getElementById('humidityAvg').textContent = avg;
    
    const changeRateEl = document.getElementById('humidityChangeRate');
    if (changeRateEl) {
        const history = humidityStats.history;
        let rate = 0;
        if (history.length >= 2 && humidityStats.lastUpdateTime) {
            const change = history[history.length - 1] - history[Math.max(0, history.length - 5)];
            const timeDiff = (Date.now() - humidityStats.lastUpdateTime) / 60000;
            if (timeDiff > 0) rate = change / timeDiff;
        }
        
        if (isNaN(rate) || rate === 0) {
            changeRateEl.textContent = '--%/min';
        } else {
            const rateText = rate > 0 ? '+' + rate.toFixed(2) : rate.toFixed(2);
            changeRateEl.textContent = rateText + '%/min';
        }
    }
}

// 更新风速详细信息
function updateWindSpeedDetails() {
    const avg = windSpeedStats.count > 0 ? (windSpeedStats.sum / windSpeedStats.count).toFixed(1) : '--';
    const max = windSpeedStats.max !== -Infinity ? windSpeedStats.max.toFixed(1) : '--';
    const min = windSpeedStats.min !== Infinity ? windSpeedStats.min.toFixed(1) : '--';
    
    document.getElementById('windSpeedCurrent').textContent = windSpeedStats.current.toFixed(1) || '--';
    document.getElementById('windSpeedMax').textContent = max;
    document.getElementById('windSpeedMin').textContent = min;
    document.getElementById('windSpeedAvg').textContent = avg;
    
    const changeRateEl = document.getElementById('windSpeedChangeRate');
    if (changeRateEl) {
        const history = windSpeedStats.history;
        let rate = 0;
        if (history.length >= 2 && windSpeedStats.lastUpdateTime) {
            const change = history[history.length - 1] - history[Math.max(0, history.length - 5)];
            const timeDiff = (Date.now() - windSpeedStats.lastUpdateTime) / 60000;
            if (timeDiff > 0) rate = change / timeDiff;
        }
        
        if (isNaN(rate) || rate === 0) {
            changeRateEl.textContent = '--m/s/min';
        } else {
            const rateText = rate > 0 ? '+' + rate.toFixed(2) : rate.toFixed(2);
            changeRateEl.textContent = rateText + 'm/s/min';
        }
    }
}

// 更新光照强度详细信息
function updateIlluminationDetails() {
    const avg = illuminationStats.count > 0 ? (illuminationStats.sum / illuminationStats.count).toFixed(1) : '--';
    const max = illuminationStats.max !== -Infinity ? illuminationStats.max.toFixed(1) : '--';
    const min = illuminationStats.min !== Infinity ? illuminationStats.min.toFixed(1) : '--';
    
    document.getElementById('illuminationCurrent').textContent = illuminationStats.current.toFixed(1) || '--';
    document.getElementById('illuminationMax').textContent = max;
    document.getElementById('illuminationMin').textContent = min;
    document.getElementById('illuminationAvg').textContent = avg;
    
    const changeRateEl = document.getElementById('illuminationChangeRate');
    if (changeRateEl) {
        const history = illuminationStats.history;
        let rate = 0;
        if (history.length >= 2 && illuminationStats.lastUpdateTime) {
            const change = history[history.length - 1] - history[Math.max(0, history.length - 5)];
            const timeDiff = (Date.now() - illuminationStats.lastUpdateTime) / 60000;
            if (timeDiff > 0) rate = change / timeDiff;
        }
        
        if (isNaN(rate) || rate === 0) {
            changeRateEl.textContent = '--lux/min';
        } else {
            const rateText = rate > 0 ? '+' + rate.toFixed(2) : rate.toFixed(2);
            changeRateEl.textContent = rateText + 'lux/min';
        }
    }
}

// 更新单个卡片值（带动画）
function updateDataValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('changed');
    void el.offsetWidth; // 强制重绘
    el.textContent = value;
    el.classList.add('changed');
    setTimeout(() => el.classList.remove('changed'), 800);
}

/**
 * 初始化MQTT客户端（核心：稳定长连接）
 */
window.initMQTTClient = function(newConfig) {
    mqttConfig = newConfig || mqttConfig;
    
    // 清理旧连接和定时器
    if (mqttClient) {
        try {
            mqttClient.disconnect();
        } catch (e) { console.warn('清理旧连接失败：', e); }
        mqttClient = null;
    }
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    updateMQTTStatus('connecting');

    try {
        const urlInfo = parseMqttUrl(mqttConfig.host);
        
        // Paho库正确写法：host, port, path, clientId
        const client = new Paho.MQTT.Client(
            urlInfo.host,
            urlInfo.port,
            urlInfo.path,
            mqttConfig.clientId
        );

        // 连接断开回调（全覆盖重连）
        client.onConnectionLost = function(responseObject) {
            const errMsg = responseObject.errorMessage || '无错误信息';
            console.error(`🔌 MQTT连接断开 [${responseObject.errorCode}]：${errMsg}`);
            updateMQTTStatus('failed');
            reconnect(); // 无论是否有错误码，都重连
        };

        // 消息接收回调
        client.onMessageArrived = function(message) {
            console.log('📥 收到MQTT消息：', message.destinationName, message.payloadString);
            try {
                const data = JSON.parse(message.payloadString);
                updateDataCards(data);
                // 触发图表更新
                if (window.updateChartData) window.updateChartData(data);
            } catch (e) {
                console.error('❌ 消息解析失败：', e);
            }
        };

        // 连接配置（仅保留Paho支持的属性）
        const connectOptions = {
            userName: mqttConfig.username,
            password: mqttConfig.password,
            keepAliveInterval: mqttConfig.keepalive,  // Paho 自动发 PING
            timeout: 10000,
            useSSL: urlInfo.useSSL,
            cleanSession: true,
            onSuccess: function() {
                console.log(`✅ MQTT连接成功（ClientId：${mqttConfig.clientId}）`);
                updateMQTTStatus('success');
                reconnectCount = 0; // 连接成功时重置计数

                client.subscribe(mqttConfig.topic, {
                    onSuccess: () => console.log(`✅ 订阅主题成功：${mqttConfig.topic}`),
                    onFailure: (res) => {
                        console.error('❌ 订阅主题失败：', res.errorMessage);
                        alert('订阅失败：' + res.errorMessage);
                    }
                });
                
                // 触发连接成功的全局事件，供配置界面使用
                if (window.onMQTTConnectSuccess) {
                    console.log('🔔 触发连接成功回调事件');
                    window.onMQTTConnectSuccess();
                }
            },
            onFailure: function(res) {
                console.error('❌ MQTT连接失败：', res.errorMessage);
                updateMQTTStatus('failed');
                
                // 触发连接失败的全局事件，供配置界面使用
                if (window.onMQTTConnectFailure) {
                    console.log('🔔 触发连接失败回调事件');
                    window.onMQTTConnectFailure(res.errorMessage);
                }
                
                // 如果不是来自应用配置界面的连接，弹出提示
                if (!window.onMQTTConnectSuccess) {
                    alert('连接失败：' + res.errorMessage);
                }
                
                reconnect();
            }
        };

        // 发起连接
        client.connect(connectOptions);
        mqttClient = client;

    } catch (e) {
        console.error('❌ MQTT初始化失败：', e);
        updateMQTTStatus('failed');
        alert('初始化失败：' + e.message);
        reconnect();
    }

    window.mqttClient = mqttClient;
};

// 创建命名空间对象
window.MQTTApp = window.MQTTApp || {};

// 仅暴露必要的公共 API
window.MQTTApp.init = function(newConfig) {
    mqttConfig = newConfig || mqttConfig;
    
    // 清理旧连接和定时器
    if (mqttClient) {
        try {
            mqttClient.disconnect();
        } catch (e) { console.warn('清理旧连接失败：', e); }
        mqttClient = null;
    }
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    updateMQTTStatus('connecting');

    try {
        const urlInfo = parseMqttUrl(mqttConfig.host);
        
        // Paho库正确写法：host, port, path, clientId
        const client = new Paho.MQTT.Client(
            urlInfo.host,
            urlInfo.port,
            urlInfo.path,
            mqttConfig.clientId
        );

        // 连接断开回调（全覆盖重连）
        client.onConnectionLost = function(responseObject) {
            const errMsg = responseObject.errorMessage || '无错误信息';
            console.error(`🔌 MQTT连接断开 [${responseObject.errorCode}]：${errMsg}`);
            updateMQTTStatus('failed');
            reconnect(); // 无论是否有错误码，都重连
        };

        // 消息接收回调
        client.onMessageArrived = function(message) {
            console.log('📥 收到MQTT消息：', message.destinationName, message.payloadString);
            try {
                const data = JSON.parse(message.payloadString);
                updateDataCards(data);
                // 触发图表更新
                if (window.updateChartData) window.updateChartData(data);
            } catch (e) {
                console.error('❌ 消息解析失败：', e);
            }
        };

        // 连接配置（仅保留Paho支持的属性）
        const connectOptions = {
            userName: mqttConfig.username,
            password: mqttConfig.password,
            keepAliveInterval: mqttConfig.keepalive,  // Paho 自动发 PING
            timeout: 10000,
            useSSL: urlInfo.useSSL,
            cleanSession: true,
            onSuccess: function() {
                console.log(`✅ MQTT连接成功（ClientId：${mqttConfig.clientId}）`);
                updateMQTTStatus('success');
                reconnectCount = 0; // 连接成功时重置计数

                client.subscribe(mqttConfig.topic, {
                    onSuccess: () => console.log(`✅ 订阅主题成功：${mqttConfig.topic}`),
                    onFailure: (res) => {
                        console.error('❌ 订阅主题失败：', res.errorMessage);
                        alert('订阅失败：' + res.errorMessage);
                    }
                });
                
                // 触发连接成功的全局事件，供配置界面使用
                if (window.onMQTTConnectSuccess) {
                    console.log('🔔 触发连接成功回调事件');
                    window.onMQTTConnectSuccess();
                }
            },
            onFailure: function(res) {
                console.error('❌ MQTT连接失败：', res.errorMessage);
                updateMQTTStatus('failed');
                
                // 触发连接失败的全局事件，供配置界面使用
                if (window.onMQTTConnectFailure) {
                    console.log('🔔 触发连接失败回调事件');
                    window.onMQTTConnectFailure(res.errorMessage);
                }
                
                // 如果不是来自应用配置界面的连接，弹出提示
                if (!window.onMQTTConnectSuccess) {
                    alert('连接失败：' + res.errorMessage);
                }
                
                reconnect();
            }
        };

        // 发起连接
        client.connect(connectOptions);
        mqttClient = client;

    } catch (e) {
        console.error('❌ MQTT初始化失败：', e);
        updateMQTTStatus('failed');
        alert('初始化失败：' + e.message);
        reconnect();
    }

    window.mqttClient = mqttClient;
};

window.MQTTApp.getStatus = function() {
    return mqttClient ? mqttClient.isConnected() : false;
};

window.MQTTApp.disconnect = function() {
    if (mqttClient && mqttClient.isConnected()) {
        mqttClient.disconnect();
    }
};

// 页面加载初始化
document.addEventListener('DOMContentLoaded', () => {
    mqttConfig.clientId = generateUniqueClientId();
    window.MQTTApp.init();
});

// 页面卸载时断开连接（防残留）
window.addEventListener('beforeunload', () => {
    if (mqttClient && mqttClient.isConnected()) {
        mqttClient.disconnect();
    }
});