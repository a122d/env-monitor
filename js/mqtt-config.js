// 统一版本号管理
const APP_VERSION = 'V-3.6.3';
//const APP_VERSION = 'beta-3.6.2-1';
window.APP_VERSION = APP_VERSION;

// 将版本写入页面中的 #appVersion 元素（DOM 安全处理）
(function(){
    function setAppVersion(){
        try{
            var el = document.getElementById('appVersion');
            if (el) el.textContent = window.APP_VERSION;
        }catch(e){
            // 忽略错误
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setAppVersion);
    } else {
        setAppVersion();
    }
})();

// ============ MQTT全局配置（供mqtt-client.js使用） ============
// ⚠️ 安全提示：不要在代码中硬编码密码和敏感凭证
window.MQTT_DEFAULT_CONFIG = {
    host: 'wss://mb67e10b.ala.cn-hangzhou.emqxsl.cn:8084/mqtt',  // MQTT服务器地址
    clientId: 'env-monitor-' + Math.random().toString(16).substr(2, 8),
    topic: 'environment/data',
    username: 'WEB',  // 默认用户名
    password: '',  // ❌ 不再硬编码密码 - 必须由用户在UI中输入
    keepalive: 30,
    clean: true,
    
    // 🤖 AI API 主题配置（仅本地运行）
    aiRequestTopic: 'Get/AI_API',        // 📤 发送AI请求的主题（包含clientId）
    aiResponseTopic: 'Set/AI_API',       // 📥 接收API响应的主题（应用层ClientID过滤）
    aiLocalOnly: true                    // ✅ 仅允许本地客户端模式
};

// 解析MQTT URL（提取host/port/path/SSL）
window.parseMqttUrl = function(url) {
    const parsed = new URL(url);
    return {
        host: parsed.hostname,
        port: parseInt(parsed.port),
        path: parsed.pathname || '/mqtt',
        useSSL: parsed.protocol === 'wss:'
    };
};

// ============ 用户登录弹窗逻辑 ============
document.addEventListener('DOMContentLoaded', () => {
    // DOM元素获取
    const mqttConfigModal = document.getElementById('mqttConfigModal');
    const modalClose = document.getElementById('modalClose');
    const mqttConfigForm = document.getElementById('mqttConfigForm');
    const applyConfigBtn = document.getElementById('applyConfigBtn');
    
    // 登录表单域
    const mqttUsername = document.getElementById('mqttUsername');
    const mqttPassword = document.getElementById('mqttPassword');

    // 本地引用全局配置
    const DEFAULT_CONFIG = window.MQTT_DEFAULT_CONFIG;

    // 初始化登录界面（从本地存储加载用户名，默认为 WEB）
    function initLogin() {
        const savedUsername = localStorage.getItem('mqtt_username');
        mqttUsername.value = savedUsername || 'WEB';
    }

    // 获取登录配置
    function getLoginConfig() {
        return {
            username: mqttUsername.value.trim(),
            password: mqttPassword.value.trim()
        };
    }

    // 表单验证
    function validateForm() {
        if (!mqttUsername.value.trim()) {
            ToastAlert.show('请输入用户名', () => {
                mqttUsername.focus();
            });
            return false;
        }
        
        if (!mqttPassword.value.trim()) {
            ToastAlert.show('请输入密码', () => {
                mqttPassword.focus();
            });
            return false;
        }
        
        return true;
    }

    // 登录MQTT
    function loginMQTT() {
        if (!validateForm()) return;
        
        const login = getLoginConfig();
        
        // 保存用户名到本地存储（不保存密码）
        localStorage.setItem('mqtt_username', login.username);
        
        // 禁用登录按钮，防止重复点击
        applyConfigBtn.disabled = true;
        applyConfigBtn.textContent = '登录中...';
        
        // 设置连接成功回调，连接成功后自动关闭弹窗
        window.onMQTTConnectSuccess = function() {
            // 恢复按钮状态
            applyConfigBtn.disabled = false;
            applyConfigBtn.textContent = '登录 MQTT';
            // 关闭弹窗
            closeModal();
            // 清除回调
            window.onMQTTConnectSuccess = null;
        };
        
        // 同时设置连接失败处理
        window.onMQTTConnectFailure = function(errorMessage) {
            console.error('❌ MQTT 连接失败:', errorMessage);
            // 恢复按钮状态
            applyConfigBtn.disabled = false;
            applyConfigBtn.textContent = '登录 MQTT';
            // 显示错误提示
            ToastAlert.show('❌ MQTT连接失败：' + (errorMessage || '未知错误'));
            // 清除回调
            window.onMQTTConnectFailure = null;
        };
        
        // 使用凭证初始化 MQTT 连接
        if (window.connectMQTTWithCredentials && typeof window.connectMQTTWithCredentials === 'function') {
            window.connectMQTTWithCredentials(login);
        } else {
            console.error('❌ 未找到 MQTT 登录函数');
            applyConfigBtn.disabled = false;
            applyConfigBtn.textContent = '登录 MQTT';
            ToastAlert.show('登录失败：未找到MQTT初始化函数');
        }
    }

    // 关闭弹窗
    function closeModal() {
        // 隐藏弹窗
        mqttConfigModal.classList.remove('show');
        // 解锁背景滚动
        if (window.ScrollLock) window.ScrollLock.unlock();
        // 清空密码字段
        mqttPassword.value = '';
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
        
        // 回车登录
        mqttPassword.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                loginMQTT();
            }
        });
        
        applyConfigBtn.addEventListener('click', loginMQTT);
        mqttConfigForm.addEventListener('submit', (e) => e.preventDefault());
    }

    // 初始化
    initLogin();
    bindEvents();

    // 暴露全局打开弹窗方法
    window.openMqttConfig = () => {
        mqttConfigModal.classList.add('show');
        if (window.ScrollLock) window.ScrollLock.lock();
        mqttUsername.focus();
    };
});