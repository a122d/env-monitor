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
    const mqttClientId = document.getElementById('mqttClientId');
    const mqttTopic = document.getElementById('mqttTopic');
    const mqttUsername = document.getElementById('mqttUsername');
    const mqttPassword = document.getElementById('mqttPassword');
    const mqttKeepalive = document.getElementById('mqttKeepalive');

    // 默认配置
    const DEFAULT_CONFIG = {
        host: 'wss://mb67e10b.ala.cn-hangzhou.emqxsl.cn:8084/mqtt',
        clientId: 'env-monitor-' + Math.random().toString(16).substr(2, 8),
        topic: 'environment/data',
        username: '',
        password: '',
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
        
        // 添加主题校验（防止订阅系统主题）
        const topic = mqttTopic.value.trim();
        if (!topic) {
            alert('请输入订阅主题');
            mqttTopic.focus();
            return false;
        }
        
        // 白名单校验：仅允许特定前缀的主题
        const allowedTopicPattern = /^[a-zA-Z0-9_\-\/]+$/;  // 仅允许字母数字、下划线、连字符、斜杠
        if (!allowedTopicPattern.test(topic)) {
            alert('主题格式不合法，仅允许字母、数字、_ 、 - 、 / ');
            mqttTopic.focus();
            return false;
        }
        
        // 禁用系统主题
        if (topic.startsWith('$') || topic === '#' || topic === '+') {
            alert('不允许订阅系统主题或通配符');
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
        
        let testTimeoutId = null;
        let isConnected = false;

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
                if (isConnected) {
                    // 已连接后断开，说明是正常断开
                    console.log('✅ 测试连接已正常断开');
                    return;
                }
                const errMsg = responseObject.errorMessage || '未知错误';
                console.error('❌ 测试连接断开：', errMsg);
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
                    isConnected = true;
                    console.log('✅ 测试连接成功');
                    // 清除超时定时器
                    if (testTimeoutId) clearTimeout(testTimeoutId);
                    alert('连接成功！');
                    try {
                        testClient.disconnect();
                    } catch (e) {
                        console.warn('测试客户端断开时出错：', e);
                    }
                    testConnectBtn.disabled = false;
                    testConnectBtn.textContent = '测试连接';
                },
                onFailure: function(response) {
                    console.error('❌ 测试连接失败：', response.errorMessage);
                    // 清除超时定时器
                    if (testTimeoutId) clearTimeout(testTimeoutId);
                    alert(`连接失败：${response.errorMessage}`);
                    try {
                        testClient.disconnect();
                    } catch (e) {
                        console.warn('测试客户端断开时出错：', e);
                    }
                    testConnectBtn.disabled = false;
                    testConnectBtn.textContent = '测试连接';
                }
            };

            testClient.connect(connectOptions);

            // 超时兜底
            testTimeoutId = setTimeout(() => {
                if (!isConnected && testClient.isConnected() !== true) {
                    console.error('❌ 测试连接超时');
                    alert('连接超时，请检查配置或网络');
                    try {
                        testClient.disconnect();
                    } catch (e) {
                        console.warn('测试客户端断开时出错：', e);
                    }
                    testConnectBtn.disabled = false;
                    testConnectBtn.textContent = '测试连接';
                }
            }, 6000);  // 略长于连接超时时间

        } catch (err) {
            console.error('❌ 测试连接配置错误：', err.message);
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
        console.log('📋 验证通过，保存配置:', config);
        
        // 保存到本地存储
        localStorage.setItem('mqttConfig', JSON.stringify(config));
        console.log('💾 配置已保存到本地存储');
        
        // 禁用应用按钮，防止重复点击
        applyConfigBtn.disabled = true;
        applyConfigBtn.textContent = '应用中...';
        
        // 设置连接成功回调，连接成功后自动关闭弝窗
        window.onMQTTConnectSuccess = function() {
            console.log('✅ MQTT 连接成功，关闭配置界面');
            // 恢复按钮状态
            applyConfigBtn.disabled = false;
            applyConfigBtn.textContent = '应用配置';
            // 关闭弹窗
            closeModal();
            // 清除回调，避免其他连接时也触发
            window.onMQTTConnectSuccess = null;
        };
        
        // 同时设置连接失败处理
        window.onMQTTConnectFailure = function(errorMessage) {
            console.error('❌ MQTT 连接失败:', errorMessage);
            // 恢复按钮状态
            applyConfigBtn.disabled = false;
            applyConfigBtn.textContent = '应用配置';
            // 清除回调
            window.onMQTTConnectFailure = null;
        };
        
        // 初始化 MQTT 客户端，传入新配置
        if (window.MQTTApp && typeof window.MQTTApp.init === 'function') {
            console.log('🚀 调用 MQTT 初始化函数...');
            window.MQTTApp.init(config);
        } else {
            console.error('❌ 未找到 MQTT 初始化函数');
            applyConfigBtn.disabled = false;
            applyConfigBtn.textContent = '应用配置';
            alert('配置已保存，但未找到MQTT初始化函数');
        }
    }

    // 关闭弹窗（恢复到上次保存的配置，不保存当前修改）
    function closeModal() {
        console.log('关闭 MQTT 配置弹窗，恢复上次保存的配置');
        // 重置表单内容为已保存的配置
        initConfig();
        // 隐藏弹窗
        mqttConfigModal.classList.remove('show');
    }

    // 事件绑定
    function bindEvents() {
        // 关闭按钮
        modalClose.addEventListener('click', closeModal);
        
        // 点击空白区域（modal-mask）关闭弹窗
        const modalMask = document.querySelector('.modal-mask');
        if (modalMask) {
            modalMask.addEventListener('click', closeModal);
        }
        
        // 防止点击弹窗内容时关闭
        const modalContent = document.querySelector('.modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        // 按 Escape 键关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mqttConfigModal.classList.contains('show')) {
                closeModal();
            }
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