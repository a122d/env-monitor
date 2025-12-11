const MQTT_CONFIG = {
    broker: 'wss://mb67e10b.ala.cn-hangzhou.emqxsl.cn:8084/mqtt',
    clientId: 'web-client-' + Math.random().toString(16).substring(2, 8),
    topic: 'environment/data',
    username: 'WEB',
    password: '123456',
    reconnect: true,
    reconnectDelay: 3000,
    maxReconnectAttempts: 10
};

window.mqttClient = null;
let reconnectAttempts = 0;

// 初始值全为0
let currentValues = {
    temperature: '0',
    humidity: '0',
    windSpeed: '0',
    illumination: '0'
};

function updateMQTTStatus(statusType) {
    const statusElement = document.getElementById('mqtt-status');
    const statusText = statusElement.querySelector('.status-text');
    
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
}

// 核心：温湿度风速÷10保留1位小数，光照强制整数
function updateDataValue(id, value) {
    const dom = document.getElementById(id);
    if (!dom || value === undefined || value === null) return;

    let processedValue;
    // 温湿度风速：原始值÷10，保留1位小数
    if (['temperature', 'humidity', 'windSpeed'].includes(id)) {
        processedValue = (Number(value) / 10).toFixed(1);
    } else if (id === 'illumination') {
        // 光照：强制整数，无小数
        processedValue = Math.round(Number(value)).toString();
    } else {
        processedValue = '0';
    }

    // 对比数值是否变化
    const oldValue = currentValues[id];
    const newValue = processedValue || '0';
    
    if (oldValue !== newValue) {
        dom.textContent = newValue;
        dom.classList.add('changed');
        setTimeout(() => {
            dom.classList.remove('changed');
        }, 800);
        currentValues[id] = newValue;
    }
}

// MQTT消息接收回调（处理原始数据）
function onMQTTMessageArrived(message) {
    try {
        console.log('✅ 收到MQTT消息：', message.payloadString);
        const data = JSON.parse(message.payloadString);
        
        // 更新数值（温湿度风速自动÷10）
        updateDataValue('temperature', data.temperature);
        updateDataValue('humidity', data.humidity);
        updateDataValue('windSpeed', data.windSpeed);
        updateDataValue('illumination', data.illumination);

        if (window.updateChartData) {
            // 图表数据同步处理
            const chartData = {
                temperature: Number((Number(data.temperature || 0) / 10).toFixed(1)),
                humidity: Number((Number(data.humidity || 0) / 10).toFixed(1)),
                windSpeed: Number((Number(data.windSpeed || 0) / 10).toFixed(1)),
                illumination: Math.round(Number(data.illumination || 0))
            };
            window.updateChartData(chartData);
        }
    } catch (error) {
        console.error('❌ 解析MQTT消息失败：', error);
    }
}

function onMQTTConnectionLost(responseObject) {
    updateMQTTStatus('failed');
    console.error('❌ MQTT连接断开：', responseObject);
    
    if (MQTT_CONFIG.reconnect && reconnectAttempts < MQTT_CONFIG.maxReconnectAttempts) {
        reconnectAttempts++;
        updateMQTTStatus('connecting');
        setTimeout(initMQTTClient, MQTT_CONFIG.reconnectDelay);
    }
}

function onMQTTConnectSuccess() {
    reconnectAttempts = 0;
    updateMQTTStatus('success');
    console.log('✅ MQTT连接成功');

    window.mqttClient.subscribe(MQTT_CONFIG.topic, {
        onSuccess: () => {
            console.log(`✅ 订阅Topic成功：${MQTT_CONFIG.topic}`);
        },
        onFailure: (err) => {
            console.error('❌ 订阅Topic失败：', err);
        }
    });
}

function onMQTTConnectFailed(error) {
    updateMQTTStatus('failed');
    console.error('❌ MQTT连接失败：', error);
}

window.initMQTTClient = function() {
    if (typeof Paho === 'undefined') {
        updateMQTTStatus('failed');
        console.error('❌ Paho MQTT库未找到！请检查mqttws31.min.js路径');
        return;
    }

    updateMQTTStatus('connecting');

    if (window.mqttClient) {
        try {
            window.mqttClient.disconnect();
        } catch (e) {}
    }

    try {
        window.mqttClient = new Paho.MQTT.Client(
            MQTT_CONFIG.broker,
            MQTT_CONFIG.clientId
        );
        console.log('✅ MQTT客户端创建成功');
    } catch (e) {
        updateMQTTStatus('failed');
        console.error('❌ 创建MQTT客户端失败：', e);
        return;
    }

    window.mqttClient.onConnectionLost = onMQTTConnectionLost;
    window.mqttClient.onMessageArrived = onMQTTMessageArrived;

    const connectOptions = {
        userName: MQTT_CONFIG.username,
        password: MQTT_CONFIG.password,
        useSSL: true,
        cleanSession: true,
        keepAliveInterval: 60,
        timeout: 10,
        onSuccess: onMQTTConnectSuccess,
        onFailure: onMQTTConnectFailed
    };

    try {
        window.mqttClient.connect(connectOptions);
    } catch (error) {
        updateMQTTStatus('failed');
        console.error('❌ MQTT连接抛出异常：', error);
    }
};

window.addEventListener('DOMContentLoaded', function() {
    console.log('=== 页面DOM初始化完成 ===');
    initMQTTClient();
});