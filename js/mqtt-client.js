// MQTT配置（请确认参数正确）
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

// 状态更新：连接中/成功/失败
function updateMQTTStatus(statusType) {
    const statusElement = document.getElementById('mqtt-status');
    const statusText = statusElement.querySelector('.status-text');
    
    // 重置所有class
    statusElement.classList.remove('connecting', 'connected', 'failed');
    
    switch(statusType) {
        case 'connecting':
            statusText.textContent = "连接中...";
            statusElement.classList.add('connecting');
            break;
        case 'success':
            statusText.textContent = "连接成功";
            statusElement.classList.add('connected');
            break;
        case 'failed':
            statusText.textContent = "连接失败";
            statusElement.classList.add('failed');
            break;
    }
}

// MQTT消息接收回调
function onMQTTMessageArrived(message) {
    try {
        console.log('✅ 收到MQTT消息：', message.payloadString);
        const data = JSON.parse(message.payloadString);
        
        // 更新页面数值
        const tempDom = document.getElementById('temperature');
        const humDom = document.getElementById('humidity');
        const windDom = document.getElementById('windSpeed');
        const lightDom = document.getElementById('illumination');
        
        if (tempDom) tempDom.textContent = data.temperature?.toFixed(1) || '--';
        if (humDom) humDom.textContent = data.humidity?.toFixed(1) || '--';
        if (windDom) windDom.textContent = data.windSpeed?.toFixed(1) || '--';
        if (lightDom) lightDom.textContent = data.illumination || '--';

        // 更新图表
        if (window.updateChartData) {
            window.updateChartData(data);
        }
    } catch (error) {
        console.error('❌ 解析消息失败：', error);
    }
}

// 连接断开回调
function onMQTTConnectionLost(responseObject) {
    updateMQTTStatus('failed'); // 断开=连接失败
    console.error('❌ MQTT连接断开：', responseObject);
    
    // 自动重连
    if (MQTT_CONFIG.reconnect && reconnectAttempts < MQTT_CONFIG.maxReconnectAttempts) {
        reconnectAttempts++;
        updateMQTTStatus('connecting'); // 重连时显示连接中
        setTimeout(initMQTTClient, MQTT_CONFIG.reconnectDelay);
    }
}

// 连接成功回调
function onMQTTConnectSuccess() {
    reconnectAttempts = 0;
    updateMQTTStatus('success'); // 连接成功
    console.log('✅ MQTT连接成功');

    // 订阅Topic
    window.mqttClient.subscribe(MQTT_CONFIG.topic, {
        onSuccess: () => {
            console.log(`✅ 订阅Topic成功：${MQTT_CONFIG.topic}`);
        },
        onFailure: (err) => {
            console.error('❌ 订阅Topic失败：', err);
        }
    });
}

// 连接失败回调
function onMQTTConnectFailed(error) {
    updateMQTTStatus('failed'); // 连接失败
    console.error('❌ MQTT连接失败：', error);
}

// 初始化MQTT客户端
window.initMQTTClient = function() {
    // 验证Paho库
    if (typeof Paho === 'undefined') {
        updateMQTTStatus('failed');
        console.error('❌ Paho MQTT库未找到！');
        return;
    }

    // 显示连接中
    updateMQTTStatus('connecting');

    // 销毁旧连接
    if (window.mqttClient) {
        try {
            window.mqttClient.disconnect();
        } catch (e) {}
    }

    // 创建客户端
    try {
        window.mqttClient = new Paho.MQTT.Client(
            MQTT_CONFIG.broker,
            MQTT_CONFIG.clientId
        );
        console.log('✅ MQTT客户端创建成功');
    } catch (e) {
        updateMQTTStatus('failed');
        console.error('❌ 创建客户端失败：', e);
        return;
    }

    // 绑定回调
    window.mqttClient.onConnectionLost = onMQTTConnectionLost;
    window.mqttClient.onMessageArrived = onMQTTMessageArrived;

    // 连接选项
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

    // 发起连接
    try {
        window.mqttClient.connect(connectOptions);
    } catch (error) {
        updateMQTTStatus('failed');
        console.error('❌ 连接抛出异常：', error);
    }
};

// DOM加载完成后初始化
window.addEventListener('DOMContentLoaded', function() {
    console.log('=== 页面初始化 ===');
    initMQTTClient();
});