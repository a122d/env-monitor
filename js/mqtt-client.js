/**
 * MQTT客户端核心逻辑（稳定长连接+数据÷10处理）
 */
let mqttClient = null;
let reconnectTimer = null;
const RECONNECT_INTERVAL = 5000;
let baseClientId = 'env-monitor-' + Math.random().toString(16).substr(2, 8);

// 默认配置（优先从本地存储加载）
let mqttConfig = JSON.parse(localStorage.getItem('mqttConfig')) || {
    host: 'wss://mb67e10b.ala.cn-hangzhou.emqxsl.cn:8084/mqtt',
    port: 8084,
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
    // 温度：÷10保留1位小数
    if (data.temperature !== undefined) {
        const tempValue = (parseFloat(data.temperature) / 10).toFixed(1);
        updateDataValue('temperature', tempValue);
    }
    // 湿度：÷10保留1位小数
    if (data.humidity !== undefined) {
        const humiValue = (parseFloat(data.humidity) / 10).toFixed(1);
        updateDataValue('humidity', humiValue);
    }
    // 风速：÷10保留1位小数
    if (data.windSpeed !== undefined) {
        const windValue = (parseFloat(data.windSpeed) / 10).toFixed(1);
        updateDataValue('windSpeed', windValue);
    }
    // 光照：保持整数
    if (data.illumination !== undefined) {
        updateDataValue('illumination', parseInt(data.illumination));
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
            },
            onFailure: function(res) {
                console.error('❌ MQTT连接失败：', res.errorMessage);
                updateMQTTStatus('failed');
                alert('连接失败：' + res.errorMessage);
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
            },
            onFailure: function(res) {
                console.error('❌ MQTT连接失败：', res.errorMessage);
                updateMQTTStatus('failed');
                alert('连接失败：' + res.errorMessage);
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