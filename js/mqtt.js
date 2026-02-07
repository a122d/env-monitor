/**
 * MQTT 配置、登录与客户端逻辑 (合并自 mqtt-config.js + mqtt-client.js)
 */

// 提供MQTT连接配置和用户登录弹窗功能

// ============ 应用版本号 ============
// 统一版本号管理
const APP_VERSION = 'V6.4.1';

// 暴露全局版本号
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

// ============ 用户角色配置 ============
window.USER_ROLES = {
    ADMIN: 'admin',
    USER: 'user'
};

// 当前登录用户信息（初始为空，只有用户登录后才设置）
window.currentUser = {
    username: null,
    role: null,
    isAdmin: function() {
        return this.role === window.USER_ROLES.ADMIN;
    }
};

// ============ MQTT全局配置（供mqtt-client.js使用） ============
window.MQTT_DEFAULT_CONFIG = {
    host: 'wss://mb67e10b.ala.cn-hangzhou.emqxsl.cn:8084/mqtt',  // MQTT服务器地址
    clientId: 'env-monitor-' + Math.random().toString(16).substr(2, 8),
    topic: 'environment/data',
    username: 'WEB',  // 默认用户名
    password: '',  // 不再硬编码密码 - 必须由用户在UI中输入
    keepalive: 30,
    clean: true,
    
    // 🤖 AI API 主题配置
    aiRequestTopic: 'Get/AI_API',        // 📤 发送AI请求的主题（包含clientId）
    aiResponseTopic: 'Set/AI_API',       // 📥 接收API响应的主题（应用层ClientID过滤）
    aiLocalOnly: true,                   // ✅ 仅允许本地客户端模式
    
    // 📊 历史数据主题配置
    historySetTopic: 'environment/set',      // 📤 发送历史数据请求的主题
    historyDataTopic: 'environment/history'  // 📥 接收历史数据的主题
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
    const passwordToggle = document.getElementById('passwordToggle');

    // 本地引用全局配置
    const DEFAULT_CONFIG = window.MQTT_DEFAULT_CONFIG;

    // 初始化登录界面
    function initLogin() {
        mqttUsername.value = '';
        mqttPassword.value = '';
    }
    
    // 识别用户角色
    function identifyUserRole(username) {
        // 管理员判断：用户名为 'admin' (不区分大小写)
        if (username.toLowerCase() === 'admin') {
            return window.USER_ROLES.ADMIN;
        }
        return window.USER_ROLES.USER;
    }
    
    // 确保currentUser对象完整性
    function ensureCurrentUser() {
        if (!window.currentUser || typeof window.currentUser.isAdmin !== 'function') {
            window.currentUser = {
                username: null,
                role: null,
                isAdmin: function() {
                    return this.role === window.USER_ROLES.ADMIN;
                }
            };
        }
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
        
        // 确保对象完整
        ensureCurrentUser();

        // 识别用户角色
        const userRole = identifyUserRole(login.username);
        window.currentUser.username = login.username;
        window.currentUser.role = userRole;
        
        // 显示用户角色信息
        const roleText = userRole === window.USER_ROLES.ADMIN ? '管理员' : '普通用户';
        console.log(`👤 用户登录: ${login.username} (${roleText})`);
        
        // 禁用登录按钮，防止重复点击
        applyConfigBtn.disabled = true;
        applyConfigBtn.innerHTML = '<span class="btn-text">登录中...</span>';
        
        // 设置连接成功回调，连接成功后自动关闭弹窗
        window.onMQTTConnectSuccess = function() {
            // 恢复按钮状态
            applyConfigBtn.disabled = false;
            applyConfigBtn.innerHTML = '<span class="btn-text">登录系统</span><svg class="btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            
            // 显示欢迎信息
            const roleText = window.currentUser.isAdmin() ? '管理员' : '用户';
            const welcomeMsg = `✅ 登录成功！欢迎您，${roleText}：${window.currentUser.username}`;
            if (window.ToastAlert) {
                ToastAlert.show(welcomeMsg);
            }
            
            // 更新用户信息显示
            updateUserInfoDisplay();
            
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
            applyConfigBtn.innerHTML = '<span class="btn-text">登录系统</span><svg class="btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            
            // 显示错误提示
            ToastAlert.show('❌ 登录失败：' + (errorMessage || '用户名或密码错误'));
            
            // 清除回调
            window.onMQTTConnectFailure = null;
        };
        
        // 使用凭证初始化 MQTT 连接
        if (window.connectMQTTWithCredentials && typeof window.connectMQTTWithCredentials === 'function') {
            window.connectMQTTWithCredentials(login);
        } else {
            console.error('❌ 未找到 MQTT 登录函数');
            applyConfigBtn.disabled = false;
            applyConfigBtn.innerHTML = '<span class="btn-text">登录系统</span><svg class="btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            ToastAlert.show('登录失败：未找到MQTT初始化函数');
        }
    }
    
    // 切换密码可见性
    function togglePasswordVisibility() {
        const eyeIcon = passwordToggle.querySelector('.eye-icon');
        const eyeOffIcon = passwordToggle.querySelector('.eye-off-icon');
        
        if (mqttPassword.type === 'password') {
            mqttPassword.type = 'text';
            eyeIcon.classList.add('is-hidden');
            eyeOffIcon.classList.remove('is-hidden');
        } else {
            mqttPassword.type = 'password';
            eyeIcon.classList.remove('is-hidden');
            eyeOffIcon.classList.add('is-hidden');
        }
    }
    
    // 更新用户信息显示
    function updateUserInfoDisplay() {
        const userName = document.getElementById('user-name');
        const statusText = document.getElementById('status-text');
        
        // 只有在用户真正登录后才显示用户名（window.currentUser.username存在且不为空）
        if (window.currentUser && window.currentUser.username && window.currentUser.username.trim()) {
            // 显示用户名（管理员添加图标） - 增加安全检查
            const isAdmin = window.currentUser.isAdmin && typeof window.currentUser.isAdmin === 'function' 
                ? window.currentUser.isAdmin() 
                : (window.currentUser.role === window.USER_ROLES.ADMIN);
                
            const displayName = isAdmin ? 
                `👑 ${window.currentUser.username}` : 
                window.currentUser.username;
            userName.textContent = displayName;
            userName.classList.remove('is-hidden');
            // 隐藏"未登录"文字
            if (statusText) statusText.classList.add('is-hidden');
        } else {
            // 未登录或使用默认配置，不显示用户名
            userName.classList.add('is-hidden');
            // 显示"未登录"文字
            if (statusText) statusText.classList.remove('is-hidden');
        }
    }

    // 关闭弹窗
    function closeModal() {
        if (window.ModalHelper) {
            window.ModalHelper.close(mqttConfigModal);
        }
        mqttPassword.value = '';
    }

    // 事件绑定（优化版 - 减少监听器数量）
    function bindEvents() {
        // 关闭按钮
        modalClose.addEventListener('click', closeModal, { passive: true });
        
        // 点击遮罩层关闭弹窗
        mqttConfigModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-mask')) {
                closeModal();
            }
        });
        
        // 回车登录
        mqttPassword.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                loginMQTT();
            }
        });
        
        mqttUsername.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                mqttPassword.focus();
            }
        });
        
        // 密码可见性切换
        passwordToggle.addEventListener('click', togglePasswordVisibility);
        
        applyConfigBtn.addEventListener('click', loginMQTT);
        mqttConfigForm.addEventListener('submit', (e) => e.preventDefault());
    }

    // 初始化
    initLogin();
    bindEvents();
    
    // 暴露全局更新用户信息方法
    window.updateUserInfoDisplay = updateUserInfoDisplay;
    
    // 为状态指示器添加点击事件
    function initStatusClickHandler() {
        const statusElement = document.getElementById('combined-status');
        if (statusElement) {
            statusElement.addEventListener('click', function() {
                // 未登录时点击打开登录弹窗
                if (!window.currentUser || !window.currentUser.username) {
                    window.openMqttConfig();
                }
            });
            statusElement.style.cursor = 'pointer';
        }
    }
    
    // 初始化用户状态显示
    setTimeout(() => {
        updateUserInfoDisplay();
        initStatusClickHandler();
    }, 0);

    // 暴露全局打开弹窗方法
    window.openMqttConfig = () => {
        if (window.ModalHelper) {
            window.ModalHelper.open(mqttConfigModal);
        }
        mqttUsername.focus();
    };
});

// ===== MQTT 客户端核心逻辑 (原 mqtt-client.js) =====

/**
 * MQTT客户端核心逻辑（稳定长连接+数据÷10处理）
 */
let mqttClient = null;
let reconnectTimer = null;
const RECONNECT_INTERVAL = 5000;
let baseClientId = 'env-monitor-' + Math.random().toString(16);

// ===== 传感器统计数据工厂 =====
function createSensorStats() {
    return { current: 0, sum: 0, count: 0, history: [], lastUpdateTime: null };
}

const sensorStats = {
    temperature: createSensorStats(),
    humidity: createSensorStats(),
    windSpeed: createSensorStats(),
    illumination: createSensorStats(),
    pm25: createSensorStats(),
    sunray: createSensorStats(),
    pressure: createSensorStats(),
    altitude: createSensorStats()
};

// ===== 通用阈值分类函数 =====
// rules: [{ max, ... }, ...] — 值 < max 则命中该规则，最后一条为兜底
function classifyValue(value, rules) {
    for (const rule of rules) {
        if (value < rule.max) return rule;
    }
    return rules[rules.length - 1];
}

// ===== 传感器卡片配置表 =====
const SENSOR_CARD_CONFIG = {
    temperature: {
        cardId: 'temperatureCard',
        stateRules: [
            { max: 7, cls: 'temp-cold' },
            { max: 25.1, cls: 'temp-normal' },
            { max: Infinity, cls: 'temp-hot' }
        ],
        levelRules: [
            { max: 0, label: '严寒' },
            { max: 7, label: '寒冷' },
            { max: 16, label: '冷' },
            { max: 20, label: '凉爽' },
            { max: 25, label: '舒适' },
            { max: 30, label: '温暖' },
            { max: 35, label: '炎热' },
            { max: Infinity, label: '酷热' }
        ],
        levelSelector: '.temp-level',
        trendSelector: '.temp-trend',
        progressById: 'tempProgress',
        progressFn: val => ((val + 10) / 46) * 100,
        iconConfig: {
            selector: '.temp-icon',
            rules: [
                { max: 7, icon: '❄️' },
                { max: 28.1, icon: '🌡️' },
                { max: Infinity, icon: '🔥' }
            ]
        },
        useRAF: true
    },
    humidity: {
        cardId: 'humidityCard',
        stateRules: [
            { max: 30, cls: 'humidity-dry' },
            { max: 70, cls: 'humidity-comfort' },
            { max: Infinity, cls: 'humidity-wet' }
        ],
        levelRules: [
            { max: 30, label: '干燥' },
            { max: 70, label: '舒适' },
            { max: Infinity, label: '潮湿' }
        ],
        progressFn: val => val
    },
    windSpeed: {
        cardId: 'windSpeedCard',
        stateRules: [
            { max: 5.4, cls: 'wind-calm' },
            { max: 10.8, cls: 'wind-moderate' },
            { max: Infinity, cls: 'wind-strong' }
        ],
        levelRules: [
            { max: 2, label: '平静' },
            { max: 5.4, label: '温和' },
            { max: 10.8, label: '较强' },
            { max: 17.2, label: '强风' },
            { max: Infinity, label: '狂风' }
        ],
        progressFn: val => val * 5
    },
    illumination: {
        cardId: 'illuminationCard',
        stateRules: [
            { max: 200, cls: 'illumination-dim' },
            { max: 500, cls: 'illumination-moderate' },
            { max: Infinity, cls: 'illumination-bright' }
        ],
        levelRules: [
            { max: 10, label: '黑暗' },
            { max: 50, label: '微弱' },
            { max: 200, label: '稍暗' },
            { max: 500, label: '适中' },
            { max: 1000, label: '明亮' },
            { max: Infinity, label: '强光' }
        ],
        progressFn: val => val / 10
    },
    pm25: {
        cardId: 'PM2card',
        stateRules: [
            { max: 36, cls: 'pm25-excellent' },
            { max: 76, cls: 'pm25-good' },
            { max: 116, cls: 'pm25-mild' },
            { max: 151, cls: 'pm25-moderate' },
            { max: Infinity, cls: 'pm25-heavy' }
        ],
        levelRules: [
            { max: 36, label: '优' },
            { max: 76, label: '良' },
            { max: 116, label: '轻度污染', extraClass: 'pollution-level' },
            { max: 151, label: '中度污染', extraClass: 'pollution-level' },
            { max: Infinity, label: '重度污染', extraClass: 'pollution-level' }
        ],
        progressFn: val => (val / 3) * 2
    },
    sunray: {
        cardId: 'sunrayCard',
        stateRules: [
            { max: 3, cls: 'uvi-weak' },
            { max: 6, cls: 'uvi-moderate' },
            { max: 8, cls: 'uvi-strong' },
            { max: Infinity, cls: 'uvi-very-strong' }
        ],
        levelRules: [
            { max: 3, label: '弱' },
            { max: 6, label: '中等' },
            { max: 8, label: '强' },
            { max: 11, label: '很强' },
            { max: Infinity, label: '极强' }
        ],
        progressFn: val => val * 10
    },
    pressure: {
        cardId: 'pressureCard',
        stateRules: [
            { max: 100, cls: 'pressure-low' },
            { max: 103, cls: 'pressure-normal' },
            { max: Infinity, cls: 'pressure-high' }
        ],
        levelRules: [
            { max: 100, label: '偏低' },
            { max: 103, label: '正常' },
            { max: Infinity, label: '偏高' }
        ],
        progressFn: val => ((val - 90) / 20) * 100,
        valueFormat: val => val.toFixed(2)
    },
    altitude: {
        cardId: 'altitudeCard',
        stateRules: [
            { max: 500, cls: 'altitude-low' },
            { max: 1500, cls: 'altitude-medium' },
            { max: Infinity, cls: 'altitude-high' }
        ],
        levelRules: [
            { max: 500, label: '低海拔' },
            { max: 1500, label: '中海拔' },
            { max: 3000, label: '高海拔' },
            { max: Infinity, label: '超高海拔' }
        ],
        progressFn: val => (val / 3000) * 100,
        valueFormat: val => val.toFixed(1)
    }
};

// ===== 数据解析配置表（÷10等处理规则） =====
const DATA_PARSE_CONFIG = [
    { key: 'temperature', parse: v => (parseFloat(v) / 10).toFixed(1), displayId: 'temperature' },
    { key: 'humidity',    parse: v => (parseFloat(v) / 10).toFixed(1), displayId: 'humidity' },
    { key: 'windSpeed',   parse: v => (parseFloat(v) / 10).toFixed(1), displayId: 'windSpeed' },
    { key: 'illumination', parse: v => parseInt(v),                     displayId: 'illumination' },
    { key: 'pm25',        parse: v => parseInt(v),                      displayId: 'PM2' },
    { key: 'sunray',      parse: v => (parseFloat(v) / 10).toFixed(1), displayId: 'sunray' },
    { key: 'pressure',    parse: v => (parseFloat(v) / 1000).toFixed(3) },
    { key: 'altitude',    parse: v => (parseFloat(v) / 10).toFixed(1) }
];

// MQTT配置（优先从本地存储加载，否则使用全局默认配置）
let mqttConfig = (() => {
    // 确保全局默认配置已定义
    if (!window.MQTT_DEFAULT_CONFIG) {
        console.warn('⚠️ 全局MQTT配置未定义，使用内置默认值');
        window.MQTT_DEFAULT_CONFIG = {
            host: 'wss://mb67e10b.ala.cn-hangzhou.emqxsl.cn:8084/mqtt',
            topic: 'environment/data',
            username: 'WEB',
            password: '',
            keepalive: 30,
            clean: true
        };
    }
    
    const savedConfig = localStorage.getItem('mqttConfig');
    if (savedConfig) {
        try {
            const config = JSON.parse(savedConfig);
            // 补充缺失的字段（从全局默认配置）
            return Object.assign({}, window.MQTT_DEFAULT_CONFIG, config, {
                password: window.MQTT_DEFAULT_CONFIG.password,
                clientId: config.clientId || baseClientId
            });
        } catch (e) {
            console.error('❌ 加载MQTT配置失败：', e);
            localStorage.removeItem('mqttConfig');
        }
    }
    return {
        ...window.MQTT_DEFAULT_CONFIG,
        clientId: baseClientId
    };
})();



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
    maxRetries: 3,          // 最大重试 3 次
    jitter: 0.1              // 抖动 10%
};

let totalAttempts = 0; // 包含首次连接在内的总尝试次数

// 计算退避延迟
function getReconnectDelay() {
    // 如果已达到最大尝试次数（包含首次连接），停止重连
    if (totalAttempts >= RECONNECT_CONFIG.maxRetries) {
        return null;
    }

    // 使用指数退避，基于已完成的尝试次数计算下一次延迟
    // 注意：此处使用 totalAttempts 作为指数基数（首次失败后 totalAttempts>=1）
    let delay = RECONNECT_CONFIG.baseInterval * Math.pow(RECONNECT_CONFIG.multiplier, Math.max(0, totalAttempts));
    delay = Math.min(delay, RECONNECT_CONFIG.maxInterval);

    // 加入抖动
    const jitterRange = delay * RECONNECT_CONFIG.jitter;
    delay += Math.random() * jitterRange;

    return delay;
}

// 手动重连（全覆盖逻辑）
function reconnect() {
    if (reconnectTimer || (mqttClient && mqttClient.isConnected && mqttClient.isConnected())) return;

    const delay = getReconnectDelay();
    if (delay === null) {
        updateMQTTStatus('failed');
        if (typeof ToastAlert !== 'undefined' && ToastAlert.show) {
            ToastAlert.show('已达到最大重连次数，停止尝试连接。');
        }
        return;
    }

    reconnectTimer = setTimeout(() => {
        // 发起下一次连接（init 会增加 totalAttempts）
        initMQTTClient();
        reconnectTimer = null;
    }, delay);
}

// 缓存上次状态避免重复更新
let lastCardStates = {};

// 重置所有数据卡片为未连接状态（显示--）
function resetAllDataCards() {
    // 重置温度
    const tempEl = document.getElementById('temperature');
    if (tempEl) tempEl.textContent = '--';
    const tempLevelEl = document.getElementById('tempLevel');
    if (tempLevelEl) tempLevelEl.textContent = '--';
    const tempTrendEl = document.getElementById('tempTrend');
    if (tempTrendEl) tempTrendEl.textContent = '→';
    const tempProgress = document.getElementById('tempProgress');
    if (tempProgress) tempProgress.style.width = '0%';
    
    // 重置湿度
    const humidityEl = document.getElementById('humidity');
    if (humidityEl) humidityEl.textContent = '--';
    const humidityLevelEl = document.getElementById('humidityLevel');
    if (humidityLevelEl) humidityLevelEl.textContent = '--';
    const humidityTrendEl = document.getElementById('humidityTrend');
    if (humidityTrendEl) humidityTrendEl.textContent = '→';
    const humidityProgress = document.getElementById('humidityProgress');
    if (humidityProgress) humidityProgress.style.width = '0%';
    
    // 重置风速
    const windSpeedEl = document.getElementById('windSpeed');
    if (windSpeedEl) windSpeedEl.textContent = '--';
    const windSpeedLevelEl = document.getElementById('windSpeedLevel');
    if (windSpeedLevelEl) windSpeedLevelEl.textContent = '--';
    const windSpeedTrendEl = document.getElementById('windSpeedTrend');
    if (windSpeedTrendEl) windSpeedTrendEl.textContent = '→';
    const windSpeedProgress = document.getElementById('windSpeedProgress');
    if (windSpeedProgress) windSpeedProgress.style.width = '0%';
    
    // 重置光照
    const illuminationEl = document.getElementById('illumination');
    if (illuminationEl) illuminationEl.textContent = '--';
    const illuminationLevelEl = document.getElementById('illuminationLevel');
    if (illuminationLevelEl) illuminationLevelEl.textContent = '--';
    const illuminationTrendEl = document.getElementById('illuminationTrend');
    if (illuminationTrendEl) illuminationTrendEl.textContent = '→';
    const illuminationProgress = document.getElementById('illuminationProgress');
    if (illuminationProgress) illuminationProgress.style.width = '0%';
    
    // 重置PM2.5
    const pm2El = document.getElementById('PM2');
    if (pm2El) pm2El.textContent = '--';
    const pm2LevelEl = document.getElementById('PM2Level');
    if (pm2LevelEl) pm2LevelEl.textContent = '--';
    const pm2TrendEl = document.getElementById('PM2Trend');
    if (pm2TrendEl) pm2TrendEl.textContent = '→';
    const pm2Progress = document.getElementById('PM2Progress');
    if (pm2Progress) pm2Progress.style.width = '0%';
    
    // 重置紫外线
    const sunrayEl = document.getElementById('sunray');
    if (sunrayEl) sunrayEl.textContent = '--';
    const sunrayLevelEl = document.getElementById('sunrayLevel');
    if (sunrayLevelEl) sunrayLevelEl.textContent = '--';
    const sunrayTrendEl = document.getElementById('sunrayTrend');
    if (sunrayTrendEl) sunrayTrendEl.textContent = '→';
    const sunrayProgress = document.getElementById('sunrayProgress');
    if (sunrayProgress) sunrayProgress.style.width = '0%';
    
    // 重置大气压强
    const pressureEl = document.getElementById('pressure');
    if (pressureEl) pressureEl.textContent = '--';
    
    // 重置海拔高度
    const altitudeEl = document.getElementById('altitude');
    if (altitudeEl) altitudeEl.textContent = '--';
}

// 更新数据卡片（配置驱动）
function updateDataCards(data) {
    if (!window.latestData) window.latestData = {};
    Object.assign(window.latestData, data);

    for (const cfg of DATA_PARSE_CONFIG) {
        if (data[cfg.key] === undefined) continue;
        const value = cfg.parse(data[cfg.key]);
        updateSensorCard(cfg.key, value);
        if (cfg.displayId) updateDataValue(cfg.displayId, value);
    }
}

// ===== 通用传感器卡片更新函数 =====
function updateSensorCard(sensorKey, value) {
    const config = SENSOR_CARD_CONFIG[sensorKey];
    if (!config) return;

    const num = parseFloat(value);
    const card = document.getElementById(config.cardId);
    if (!card) return;

    // 更新统计数据
    const stats = sensorStats[sensorKey];
    stats.lastUpdateTime = Date.now();
    stats.history.push(num);
    if (stats.history.length > 10) stats.history.shift();
    stats.current = num;
    stats.sum += num;
    stats.count++;

    // DOM 更新逻辑（可选 RAF 包裹）
    const applyUpdate = () => {
        // 状态类名（仅在变化时更新）
        const stateRule = classifyValue(num, config.stateRules);
        if (lastCardStates[sensorKey] !== stateRule.cls) {
            card.classList.remove(...config.stateRules.map(r => r.cls));
            card.classList.add(stateRule.cls);
            lastCardStates[sensorKey] = stateRule.cls;
        }

        // 图标更新（仅温度等配置了 iconConfig 的卡片）
        if (config.iconConfig) {
            const iconEl = card.querySelector(config.iconConfig.selector);
            if (iconEl) {
                const iconRule = classifyValue(num, config.iconConfig.rules);
                iconEl.textContent = iconRule.icon;
            }
        }

        // 等级标签
        const levelSelector = config.levelSelector || '.card-level';
        const levelEl = card.querySelector(levelSelector);
        if (levelEl) {
            const levelRule = classifyValue(num, config.levelRules);
            levelEl.textContent = levelRule.label;
            if (levelRule.extraClass) levelEl.classList.add(levelRule.extraClass);
        }

        // 数值显示（大气压/海拔等需要格式化的卡片）
        if (config.valueFormat) {
            const valueEl = card.querySelector('.card-value');
            if (valueEl) valueEl.textContent = config.valueFormat(num);
        }

        // 进度条
        const progressFill = config.progressById
            ? document.getElementById(config.progressById)
            : card.querySelector('.card-progress-bar .progress-fill');
        if (progressFill) {
            const pct = Math.max(0, Math.min(100, config.progressFn(num)));
            progressFill.style.width = pct + '%';
        }

        // 趋势
        const trendSelector = config.trendSelector || '.card-trend';
        updateCardTrend(card, stats, trendSelector);
    };

    config.useRAF ? requestAnimationFrame(applyUpdate) : applyUpdate();
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



// 缓存DOM元素引用，避免重复查询
const domCache = new Map();
function getCachedElement(id) {
    if (!domCache.has(id)) {
        domCache.set(id, document.getElementById(id));
    }
    return domCache.get(id);
}

// 更新单个卡片值（带动画）- 暴露到全局供其他模块使用
window.updateDataValue = function(id, value) {
    const el = getCachedElement(id);
    if (!el) return;
    
    // 只在值变化时更新DOM，减少不必要的重绘
    const currentValue = el.textContent;
    if (currentValue === String(value)) return;
    
    // 使用 requestAnimationFrame 优化渲染
    requestAnimationFrame(() => {
        el.classList.remove('changed');
        el.textContent = value;
        // 强制重排以重启动画
        void el.offsetWidth;
        el.classList.add('changed');
    });
    
    // 移除动画类
    setTimeout(() => el.classList.remove('changed'), 800);
};

// 内部快捷引用
const updateDataValue = window.updateDataValue;

// 创建命名空间对象
window.MQTTApp = window.MQTTApp || {};

// 仅暴露必要的公共 API
window.MQTTApp.init = function(newConfig) {
    mqttConfig = newConfig || mqttConfig;
    
    // 检查是否已达到最大尝试次数（包含首次连接）
    if (totalAttempts >= RECONNECT_CONFIG.maxRetries) {
        updateMQTTStatus('failed');
        if (typeof ToastAlert !== 'undefined' && ToastAlert.show) {
            ToastAlert.show('已达到最大重连次数，停止尝试连接。');
        }
        return;
    }

    // 增加总尝试计数（首次调用 init 也计为一次尝试）
    totalAttempts++;

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
        const urlInfo = window.parseMqttUrl(mqttConfig.host);
        
        // 检查Paho库是否已加载
        if (!window.Paho || !window.Paho.MQTT) {
            throw new Error('❌ Paho MQTT库未加载。请检查CDN连接。');
        }
        
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
            resetAllDataCards(); // 重置所有数据显示为--
            reconnect(); // 无论是否有错误码，都重连
        };

        // 消息接收回调
        client.onMessageArrived = function(message) {
            const topic = message.destinationName;
            const payload = message.payloadString;
            
            // 处理AI API响应主题消息（应用层ClientID过滤）
            if (topic === mqttConfig.aiResponseTopic) {
                try {
                    const responseData = JSON.parse(payload);
                    
                    // 🔐 关键验证：检查ClientID是否匹配（防止消息混淆）
                    if (responseData.clientId && responseData.clientId !== mqttConfig.clientId) {
                        return;  // 忽略不属于本客户端的消息
                    }
                    
                    // 区分请求类型：检查requestId是否为API调用标记
                    if (responseData.requestId && responseData.requestId.includes('__API_CALL__')) {
                        if (window.onAPIModalResponse) {
                            window.onAPIModalResponse(responseData);
                        }
                    } else {
                        // 普通AI请求响应
                        if (window.onAIRequestResponse) {
                            window.onAIRequestResponse(responseData);
                        }
                    }
                } catch (e) {
                    console.error('❌ AI响应消息解析失败：', e);
                }
                return;
            }
            
            // 处理环境数据主题消息
            if (topic === mqttConfig.topic) {
                try {
                    const data = JSON.parse(payload);
                    updateDataCards(data);
                    // 触发图表更新
                    if (window.updateChartData) window.updateChartData(data);
                } catch (e) {
                    console.error('❌ 消息解析失败：', e);
                }
            }
            
            // 📊 处理历史数据主题消息
            if (topic === mqttConfig.historyDataTopic) {
                try {
                    const historyData = JSON.parse(payload);
                    
                    // 验证ClientID是否匹配
                    if (historyData.clientId && historyData.clientId !== mqttConfig.clientId) {
                        return;  // 忽略不属于本客户端的消息
                    }
                    
                    console.log('📊 收到历史数据：', historyData);
                    
                    // 处理历史数据并更新图表
                    if (window.processHistoryData) {
                        window.processHistoryData(historyData);
                    }
                } catch (e) {
                    console.error('❌ 历史数据消息解析失败：', e);
                }
            }

            // 处理设备控制状态消息（来自设备或管理员）
            if (topic === 'environment/con') {
                try {
                    const controlData = JSON.parse(payload);
                    console.log('📥 收到设备控制状态：', controlData);

                    if (controlData.DriveStatus == 0) {
                        if (controlData.Auto !== undefined) window.deviceControlState.Auto = controlData.Auto;
                        if (controlData.Light !== undefined) window.deviceControlState.Light = controlData.Light;

                        if (window.updateDeviceControlStatus) {
                            window.updateDeviceControlStatus();
                        }
                    }
                } catch (e) {
                    console.error('❌ 设备控制消息解析失败：', e);
                }
            }
            
        };

        // 连接配置（仅保留Paho支持的属性）
        const connectOptions = {
            userName: mqttConfig.username,
            password: mqttConfig.password,
            keepAliveInterval: mqttConfig.keepalive,
            timeout: 10000,
            useSSL: urlInfo.useSSL,
            cleanSession: true,
            onSuccess: function() {
                updateMQTTStatus('success');
                // 连接成功后重置尝试计数
                totalAttempts = 0;

                // 订阅环境数据主题
                client.subscribe(mqttConfig.topic, {
                    onFailure: (res) => {
                        console.error('❌ 订阅主题失败：', res.errorMessage);
                        ToastAlert.show('订阅失败：' + res.errorMessage);
                    }
                });
                
                // 📊 订阅历史数据主题
                if (mqttConfig.historyDataTopic) {
                    client.subscribe(mqttConfig.historyDataTopic, {
                        onSuccess: () => {
                            console.log('✅ 已订阅历史数据主题：', mqttConfig.historyDataTopic);
                            
                            // 连接成功后发送默认历史数据请求（根据本地存储的设置）
                            setTimeout(() => {
                                window.sendHistoryDataRequest();
                            }, 500);
                        },
                        onFailure: (res) => {
                            console.warn('⚠️ 订阅历史数据主题失败：', res.errorMessage);
                        }
                    });
                }
                
                // 如果是管理员，订阅设备控制主题
                if (window.currentUser && window.currentUser.isAdmin && window.currentUser.isAdmin()) {
                    const deviceControlTopic = 'environment/con';
                    client.subscribe(deviceControlTopic, {
                        onFailure: (res) => {
                            console.warn('⚠️ 订阅设备控制主题失败：', res.errorMessage);
                        }
                    });
                    console.log('✅ 管理员：已订阅设备控制主题 environment/con');
                    
                    // 显示设备控制菜单项
                    const menuDeviceControl = document.getElementById('menuDeviceControl');
                    if (menuDeviceControl) {
                        menuDeviceControl.classList.remove('is-hidden');
                    }
                }
                
                // 不在全局连接时订阅 AI 响应主题，改为按需订阅

                // 禁用登录菜单项（连接成功后不允许重新登录）
                const mqttConfigMenuItem = document.querySelector('[data-action="mqtt-config"]');
                if (mqttConfigMenuItem) {
                    mqttConfigMenuItem.classList.add('disabled');
                    mqttConfigMenuItem.style.opacity = '0.5';
                    mqttConfigMenuItem.style.cursor = 'not-allowed';
                }
                
                // 触发连接成功的全局事件
                if (window.onMQTTConnectSuccess) {
                    window.onMQTTConnectSuccess();
                }
            },
            onFailure: function(res) {
                console.error('❌ MQTT连接失败：', res.errorMessage);
                updateMQTTStatus('failed');
                
                // 触发连接失败的全局事件
                // 如果存在全局回调，说明是用户手动触发的登录
                // 这种情况下，不要自动重连，而是等待用户再次手动操作
                if (window.onMQTTConnectFailure) {
                    window.onMQTTConnectFailure(res.errorMessage);
                    return; 
                }
                
                // 如果不是来自应用配置界面的连接，弹出提示
                if (!window.onMQTTConnectSuccess) {
                    ToastAlert.show('连接失败：' + res.errorMessage);
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
        
        // 触发连接失败的全局事件（确保UI能响应）
        if (window.onMQTTConnectFailure) {
            window.onMQTTConnectFailure(e.message);
        } else {
             ToastAlert.show('初始化失败：' + e.message);
        }
        
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

// 🔐 使用用户凭证登录MQTT（用户登录界面调用）
window.connectMQTTWithCredentials = function(credentials) {
    if (!credentials || !credentials.username || !credentials.password) {
        console.error('❌ 无效的登录凭证');
        if (window.onMQTTConnectFailure) {
            window.onMQTTConnectFailure('登录凭证不完整');
        }
        return;
    }
    
    // 重置尝试计数器，允许在此次手动登录中重新尝试
    totalAttempts = 0;
    
    // 生成新的ClientId，避免旧连接未完全断开导致的冲突
    mqttConfig.clientId = generateUniqueClientId();

    mqttConfig.username = credentials.username;
    mqttConfig.password = credentials.password;
    
    window.MQTTApp.init(mqttConfig);
};

// 兼容旧的初始化接口
window.initMQTTClient = function(newConfig) {
    window.MQTTApp.init(newConfig);
};

// 🤖 发送AI API请求到本地客户端（通过MQTT）
window.sendAIAPIRequest = function(userMessage) {
    if (!mqttClient || !mqttClient.isConnected()) {
        return false;
    }
    
    // 判断是否为API调用请求
    const isAPICall = userMessage === '__API_CALL__';
    
    // 生成requestId：如果是API调用，包含特殊标记
    const requestId = isAPICall 
        ? '__API_CALL__-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
        : 'ai-req-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    const requestPayload = {
        timestamp: new Date().toISOString(),
        clientId: mqttConfig.clientId,
        message: userMessage,
        requestId: requestId
    };
    
    try {
        const message = new Paho.MQTT.Message(JSON.stringify(requestPayload));
        message.destinationName = mqttConfig.aiRequestTopic;
        message.qos = 1;
        
        mqttClient.send(message);
        return requestId;
    } catch (err) {
        console.error('❌ 发送AI请求失败：', err);
        return false;
    }
};

// ===== 环境设备控制 =====

// 设备控制状态（全局状态缓存）
window.deviceControlState = {
    Auto: 0,
    Light: 0,
    // 设备上报的 DriveStatus（null 表示未知）
    DriveStatus: null
};

// 发送完整设备控制消息（仅管理员可用）
window.sendDeviceControlMessage = function(autoValue, lightValue) {
    // 权限检查：仅管理员可操作
    if (!window.currentUser || !window.currentUser.isAdmin || !window.currentUser.isAdmin()) {
        console.warn('⚠️ 您无权操作设备控制');
        return false;
    }
    
    // 验证MQTT连接状态
    if (!mqttClient || !mqttClient.isConnected()) {
        console.error('❌ MQTT未连接');
        return false;
    }
    
    // 构建完整控制消息（包含 DriveStatus: 1，表示网页发出的控制命令，仅作方向标记，不代表设备状态）
    const messagePayload = {
        Auto: autoValue,
        Light: lightValue,
        DriveStatus: 1
    };
    
    try {
        const message = new Paho.MQTT.Message(JSON.stringify(messagePayload));
        message.destinationName = 'environment/con';
        message.qos = 1;
        message.retained = false;
        
        mqttClient.send(message);
        console.log(`✅ 发送设备控制命令:`, messagePayload);
        
        window.deviceControlState.Auto = autoValue;
        window.deviceControlState.Light = lightValue;
        
        return true;
    } catch (err) {
        console.error('❌ 发送设备控制命令失败：', err);
        return false;
    }
};

// 兼容旧版调用 - 发送单独控制（会自动处理Auto逻辑）
window.sendDeviceControl = function(controlType, value) {
    // 权限检查：仅管理员可操作
    if (!window.currentUser || !window.currentUser.isAdmin || !window.currentUser.isAdmin()) {
        console.warn('⚠️ 您无权操作设备控制');
        return false;
    }
    
    // 验证MQTT连接状态
    if (!mqttClient || !mqttClient.isConnected()) {
        console.error('❌ MQTT未连接');
        return false;
    }
    
    // 获取当前状态
    let autoValue = window.deviceControlState.Auto;
    let lightValue = window.deviceControlState.Light;
    
    // 根据控制类型更新相应值
    if (controlType === 'auto') {
        autoValue = value;
    } else if (controlType === 'light') {
        lightValue = value;
        // 手动控制灯光时，自动将Auto设为0（手动模式）
        if (value === 1 || value === 0) {
            autoValue = 0;
        }
    } else {
        console.error('❌ 未知的控制类型：', controlType);
        return false;
    }
    
    // 发送完整消息
    return window.sendDeviceControlMessage(autoValue, lightValue);
};

// ===== 📊 历史数据请求与处理 =====

// 将时间范围转换为 number 值
function getHistoryNumber(timeRange) {
    switch (timeRange) {
        case '6hours':
            return 6;
        case '1day':
            return 24;
        case '1week':
            return 7;   // 一周数据发送 number: 7
        default:
            return 24;
    }
}

// 发送历史数据请求
window.sendHistoryDataRequest = function(timeRange) {
    if (!mqttClient || !mqttClient.isConnected()) {
        console.warn('⚠️ MQTT未连接，无法发送历史数据请求');
        return false;
    }
    
    // 如果未指定时间范围，从本地存储获取
    if (!timeRange) {
        try {
            timeRange = localStorage.getItem('dataTimeRange') || '1day';
        } catch (e) {
            timeRange = '1day';
        }
    }
    
    const number = getHistoryNumber(timeRange);
    
    const requestPayload = {
        clientId: mqttConfig.clientId,
        number: number
    };
    
    try {
        const message = new Paho.MQTT.Message(JSON.stringify(requestPayload));
        message.destinationName = mqttConfig.historySetTopic;
        message.qos = 1;
        
        mqttClient.send(message);
        console.log(`📤 发送历史数据请求：${timeRange} (number: ${number})`, requestPayload);
        return true;
    } catch (err) {
        console.error('❌ 发送历史数据请求失败：', err);
        return false;
    }
};

// 处理历史数据并更新图表
window.processHistoryData = function(historyData) {
    if (!historyData || !historyData.data || !Array.isArray(historyData.data)) {
        console.warn('⚠️ 无效的历史数据格式');
        return;
    }
    
    const dataArray = historyData.data;
    console.log(`📊 处理 ${dataArray.length} 条历史数据`);
    
    // 📊 保存当前的实时数据（保存最后一条，如果存在的话）
    let savedRealtimeData = null;
    if (window.chartData && window.chartData.time && window.chartData.time.length > 0) {
        const lastIdx = window.chartData.time.length - 1;
        // 检查最后一条是否是实时数据（时间格式不同于历史数据的 MM-DD HH:00 格式）
        const lastTime = window.chartData.time[lastIdx];
        // 实时数据的时间格式类似 "18:30:45"，历史数据是 "01-19 17:00"
        if (lastTime && !lastTime.includes('-')) {
            savedRealtimeData = {
                time: lastTime,
                temperature: window.chartData.temperature[lastIdx],
                humidity: window.chartData.humidity[lastIdx],
                windSpeed: window.chartData.windSpeed[lastIdx],
                illumination: window.chartData.illumination[lastIdx],
                PM2: window.chartData.PM2[lastIdx],
                sunray: window.chartData.sunray[lastIdx]
            };
            console.log('📊 保留实时数据：', savedRealtimeData.time);
        }
    }
    
    // 清空现有图表数据
    window.chartData = {
        time: [],
        temperature: [],
        humidity: [],
        windSpeed: [],
        illumination: [],
        PM2: [],
        sunray: []
    };
    
    // 历史数据是按时间降序排列的（最新的在前），需要反转为升序
    const sortedData = [...dataArray].reverse();
    
    // 遍历历史数据并填充图表数据
    sortedData.forEach(item => {
        // 构建时间标签
        // 小时数据格式：date: "20260119", hour: 17 => "01-19 17:00"
        // 一周数据格式：date: "20260119" (无hour字段) => "01-19"
        let timeLabel = '';
        if (item.date) {
            const dateStr = String(item.date);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            
            if (item.hour !== undefined) {
                // 小时级别数据，显示 "MM-DD HH:00"
                const hourStr = String(item.hour).padStart(2, '0');
                timeLabel = `${month}-${day} ${hourStr}:00`;
            } else {
                // 一周/天级别数据，只显示 "MM-DD"
                timeLabel = `${month}-${day}`;
            }
        } else {
            timeLabel = new Date().toLocaleTimeString();
        }
        
        window.chartData.time.push(timeLabel);
        
        // 温度：原始值÷10保留1位小数
        const tempVal = item.temperature !== undefined ? 
            parseFloat((item.temperature / 10).toFixed(1)) : 0;
        window.chartData.temperature.push(tempVal);
        
        // 湿度：原始值÷10保留1位小数
        const humVal = item.humidity !== undefined ? 
            parseFloat((item.humidity / 10).toFixed(1)) : 0;
        window.chartData.humidity.push(humVal);
        
        // 风速：原始值÷10保留1位小数
        const windVal = item.windSpeed !== undefined ? 
            parseFloat((item.windSpeed / 10).toFixed(1)) : 0;
        window.chartData.windSpeed.push(windVal);
        
        // 光照：保持整数
        const lightVal = item.illumination !== undefined ? 
            parseInt(item.illumination) : 0;
        window.chartData.illumination.push(lightVal);
        
        // PM2.5：保持整数
        const pm25Val = item.pm25 !== undefined ? 
            parseInt(item.pm25) : 0;
        window.chartData.PM2.push(pm25Val);
        
        // 紫外线：÷10保留1位小数
        const sunrayVal = item.sunray !== undefined ? 
            parseFloat((item.sunray / 10).toFixed(1)) : 0;
        window.chartData.sunray.push(sunrayVal);
    });
    
    // 📊 记录历史数据条数，用于实时数据覆盖逻辑
    window.chartHistoryCount = dataArray.length;
    
    // 📊 恢复之前保存的实时数据
    if (savedRealtimeData) {
        window.chartData.time.push(savedRealtimeData.time);
        window.chartData.temperature.push(savedRealtimeData.temperature);
        window.chartData.humidity.push(savedRealtimeData.humidity);
        window.chartData.windSpeed.push(savedRealtimeData.windSpeed);
        window.chartData.illumination.push(savedRealtimeData.illumination);
        window.chartData.PM2.push(savedRealtimeData.PM2);
        window.chartData.sunray.push(savedRealtimeData.sunray);
        console.log('✅ 已恢复实时数据');
    }
    
    // 更新图表显示
    if (window.refreshChartFromData) {
        window.refreshChartFromData();
    }
    
    console.log('✅ 历史数据已加载到图表');
    // 已移除弹窗提示，仅保留控制台日志
};

// 页面加载初始化
document.addEventListener('DOMContentLoaded', () => {
    mqttConfig.clientId = generateUniqueClientId();
});

// 页面卸载时断开连接
window.addEventListener('beforeunload', () => {
    if (mqttClient && mqttClient.isConnected()) {
        mqttClient.disconnect();
    }
});
