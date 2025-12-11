/**
 * MQTT配置弹窗核心逻辑（适配Paho MQTT库）
 */
document.addEventListener('DOMContentLoaded', () => {
    // DOM元素获取
    const mqttConfigModal = document.getElementById('mqttConfigModal');
    const modalClose = document.getElementById('modalClose');
    const mqttConfigForm = document.getElementById('mqttConfigForm');
    const testConnectBtn = document.getElementById('testConnectBtn');
    const saveConfigBtn = document.getElementById('saveConfigBtn');
    const applyConfigBtn = document.getElementById('applyConfigBtn');
    
    // 配置项DOM
    const mqttHost = document.getElementById('mqttHost');
    const mqttPort = document.getElementById('mqttPort');
    const mqttClientId = document.getElementById('mqttClientId');
    const mqttTopic = document.getElementById('mqttTopic');
    const mqttUsername = document.getElementById('mqttUsername');
    const mqttPassword = document.getElementById('mqttPassword');
    const mqttKeepalive = document.getElementById('mqttKeepalive');

    // 默认配置
    const DEFAULT_CONFIG = {
        host: 'wss://mb67e10b.ala.cn-hangzhou.emqxsl.cn:8084/mqtt',
        port: 8084,
        clientId: 'env-monitor-' + Math.random().toString(16).substr(2, 8),
        topic: 'environment/data',
        username: 'WEB',
        password: '123456',
        keepalive: 30
    };

    // 解析MQTT URL
    function parseMqttUrl(url) {
        const parsed = new URL(url);
        return {
            host: parsed.hostname,
            port: parseInt(parsed.port),
            path: parsed.pathname || '/mqtt',
            useSSL: parsed.protocol === 'wss:'
        };
    }

    // 初始化配置（从本地存储加载）
    function initConfig() {
        const savedConfig = localStorage.getItem('mqttConfig');
        const config = savedConfig ? JSON.parse(savedConfig) : DEFAULT_CONFIG;
        
        mqttHost.value = config.host || DEFAULT_CONFIG.host;
        mqttPort.value = config.port || DEFAULT_CONFIG.port;
        mqttClientId.value = config.clientId || DEFAULT_CONFIG.clientId;
        mqttTopic.value = config.topic || DEFAULT_CONFIG.topic;
        mqttUsername.value = config.username || '';
        mqttPassword.value = config.password || '';
        mqttKeepalive.value = config.keepalive || DEFAULT_CONFIG.keepalive;
    }

    // 获取表单配置
    function getFormConfig() {
        return {
            host: mqttHost.value.trim(),
            port: parseInt(mqttPort.value),
            clientId: mqttClientId.value.trim() || DEFAULT_CONFIG.clientId,
            topic: mqttTopic.value.trim(),
            username: mqttUsername.value.trim(),
            password: mqttPassword.value.trim(),
            keepalive: parseInt(mqttKeepalive.value),
            clean: true
        };
    }

    // 表单验证
    function validateForm() {
        if (!mqttHost.value.trim()) {
            alert('请输入完整的服务器地址（如：wss://xxx:8084/mqtt）');
            mqttHost.focus();
            return false;
        }
        try {
            new URL(mqttHost.value.trim());
        } catch (err) {
            alert('服务器地址格式错误，请输入合法的URL');
            mqttHost.focus();
            return false;
        }
        if (!mqttTopic.value.trim()) {
            alert('请输入订阅主题');
            mqttTopic.focus();
            return false;
        }
        if (!mqttKeepalive.value || isNaN(mqttKeepalive.value) || mqttKeepalive.value < 10 || mqttKeepalive.value > 300) {
            alert('心跳间隔请输入10-300之间的数字');
            mqttKeepalive.focus();
            return false;
        }
        return true;
    }

    // 测试连接
    function testConnect() {
        if (!validateForm()) return;
        
        const config = getFormConfig();
        testConnectBtn.disabled = true;
        testConnectBtn.textContent = '测试中...';

        try {
            const urlInfo = parseMqttUrl(config.host);
            // 测试用ClientId（加-test后缀，防重复）
            const testClientId = config.clientId + '-test';
            const testClient = new Paho.MQTT.Client(
                urlInfo.host,
                urlInfo.port,
                urlInfo.path,
                testClientId
            );

            // 连接断开回调
            testClient.onConnectionLost = function(responseObject) {
                const errMsg = responseObject.errorMessage || '未知错误';
                alert(`连接断开：${errMsg}`);
                testClient.disconnect();
                testConnectBtn.disabled = false;
                testConnectBtn.textContent = '测试连接';
            };

            // 连接配置
            const connectOptions = {
                userName: config.username,
                password: config.password,
                keepAliveInterval: config.keepalive,
                timeout: 5000,
                useSSL: urlInfo.useSSL,
                cleanSession: true,
                onSuccess: function() {
                    alert('连接成功！');
                    testClient.disconnect();
                    testConnectBtn.disabled = false;
                    testConnectBtn.textContent = '测试连接';
                },
                onFailure: function(response) {
                    alert(`连接失败：${response.errorMessage}`);
                    testClient.disconnect();
                    testConnectBtn.disabled = false;
                    testConnectBtn.textContent = '测试连接';
                }
            };

            testClient.connect(connectOptions);

            // 超时兜底
            setTimeout(() => {
                if (testClient.isConnected() !== true) {
                    alert('连接超时，请检查配置或网络');
                    testClient.disconnect();
                    testConnectBtn.disabled = false;
                    testConnectBtn.textContent = '测试连接';
                }
            }, 5000);

        } catch (err) {
            alert(`配置错误：${err.message}`);
            testConnectBtn.disabled = false;
            testConnectBtn.textContent = '测试连接';
        }
    }

    // 保存配置
    function saveConfig() {
        if (!validateForm()) return;
        const config = getFormConfig();
        localStorage.setItem('mqttConfig', JSON.stringify(config));
        alert('配置保存成功！');
    }

    // 应用配置
    function applyConfig() {
        if (!validateForm()) return;
        const config = getFormConfig();
        localStorage.setItem('mqttConfig', JSON.stringify(config));
        
        // 断开旧连接，重新初始化
        if (window.mqttClient && window.mqttClient.isConnected()) {
            window.mqttClient.disconnect();
        }
        if (window.initMQTTClient) {
            window.initMQTTClient(config);
            alert('配置已应用，正在重新连接MQTT...');
            mqttConfigModal.classList.remove('show');
        } else {
            alert('配置已保存，但未找到MQTT初始化函数');
        }
    }

    // 关闭弹窗
    function closeModal() {
        mqttConfigModal.classList.remove('show');
    }

    // 事件绑定
    function bindEvents() {
        modalClose.addEventListener('click', closeModal);
        mqttConfigModal.addEventListener('click', (e) => {
            if (e.target === mqttConfigModal) closeModal();
        });
        testConnectBtn.addEventListener('click', testConnect);
        saveConfigBtn.addEventListener('click', saveConfig);
        applyConfigBtn.addEventListener('click', applyConfig);
        mqttConfigForm.addEventListener('submit', (e) => e.preventDefault());
    }

    // 初始化
    initConfig();
    bindEvents();

    // 暴露全局打开弹窗方法
    window.openMqttConfig = () => {
        mqttConfigModal.classList.add('show');
        initConfig();
    };
});