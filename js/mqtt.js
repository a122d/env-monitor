/**
 * MQTT 配置、登录与客户端逻辑 (合并自 mqtt-config.js + mqtt-client.js)
 */

// 提供MQTT连接配置和用户登录弹窗功能

// ============ 应用版本号 ============
// 统一版本号管理
const APP_VERSION = 'V6.3.1';

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

// 温度统计数据
let temperatureStats = {
    current: 0,
    sum: 0,
    count: 0,
    history: [],           // 保存最近10次数据用于趋势计算
    lastUpdateTime: null  // 上次更新时间
};

// 湿度统计数据
let humidityStats = {
    current: 0,
    sum: 0,
    count: 0,
    history: [],
    lastUpdateTime: null
};

// 风速统计数据
let windSpeedStats = {
    current: 0,
    sum: 0,
    count: 0,
    history: [],
    lastUpdateTime: null
};

// 光照强度统计数据
let illuminationStats = {
    current: 0,
    sum: 0,
    count: 0,
    history: [],
    lastUpdateTime: null
};

// PM2.5统计数据
let pm25Stats = {
    current: 0,
    sum: 0,
    count: 0,
    history: [],
    lastUpdateTime: null
};

// 紫外线强度统计数据
let sunrayStats = {
    current: 0,
    sum: 0,
    count: 0,
    history: [],
    lastUpdateTime: null
};

// 大气压强统计数据
let pressureStats = {
    current: 0,
    sum: 0,
    count: 0,
    history: [],
    lastUpdateTime: null
};

// 海拔高度统计数据
let altitudeStats = {
    current: 0,
    sum: 0,
    count: 0,
    history: [],
    lastUpdateTime: null
};

// 获取温度等级描述
function getTempLevel(temp) {
    if (temp < 0) return '严寒';
    if (temp < 7) return '寒冷';
    if (temp < 16) return '冷';
    if (temp < 20) return '凉爽';
    if (temp < 25) return '舒适';
    if (temp < 30) return '温暖';
    if (temp < 35) return '炎热';
    return '酷热';
}

// 计算温度变化趋势
function calculateTempTrend() {
    const history = temperatureStats.history;
    if (history.length < 2) {
        return { trend: '→'};
    }
    
    // 计算最近变化
    const current = history[history.length - 1];
    const previous = history[Math.max(0, history.length - 5)];
    const change = current - previous;
    
    let trend = '→';
    if (change > 0.1) trend = '↑';
    if (change < -0.1) trend = '↓';
    
    return { trend };
}

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
let lastCardStates = {
    temperature: null,
    humidity: null,
    windSpeed: null,
    illumination: null,
    pm25: null,
    sunray: null
};

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

// 更新数据卡片
// 温/湿/风/海拔÷10保留1位小数  大气压÷10000保留3位小数
function updateDataCards(data) {
    // 保存完整数据到全局变量供其他功能使用（如设备版本显示）
    if (!window.latestData) {
        window.latestData = {};
    }
    Object.assign(window.latestData, data);
    
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
    // PM2.5：保持整数
    if (data.pm25 !== undefined) {
        const pm25Value = parseInt(data.pm25);
        updateDataValue('PM2', pm25Value);
        updatePM25Card(pm25Value);
    }
    // 紫外线强度：÷10保留1位小数 UVI
    if (data.sunray !== undefined) {
        const sunrayValue = (parseFloat(data.sunray) / 10).toFixed(1);
        updateDataValue('sunray', sunrayValue);
        updateSunrayCard(sunrayValue);
    }
    // 大气压强：÷1000保留3位小数，单位KPa
    if (data.pressure !== undefined) {
        const pressureValue = (parseFloat(data.pressure) / 1000).toFixed(3);
        updatePressureCard(pressureValue);
    }
    // 海拔高度：÷10保留1位小数，单位m
    if (data.altitude !== undefined) {
        const altitudeValue = (parseFloat(data.altitude) / 10).toFixed(1);
        updateAltitudeCard(altitudeValue);
    }
}

// 更新温度卡片（增强版 + 性能优化）
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
    temperatureStats.sum += tempNum;
    temperatureStats.count++;
    
    // 确定新状态
    let newState;
    if (tempNum < 7) {
        newState = 'temp-cold';
    } else if (tempNum > 25) {
        newState = 'temp-hot';
    } else {
        newState = 'temp-normal';
    }
    
    // 使用RAF批量更新DOM，避免多次重排
    requestAnimationFrame(() => {
        // 只在状态变化时才更新类名
        if (lastCardStates.temperature !== newState) {
            card.classList.remove('temp-cold', 'temp-normal', 'temp-hot');
            card.classList.add(newState);
            lastCardStates.temperature = newState;
        }
        
        // 缓存DOM元素引用
        const icon = card.querySelector('.temp-icon');
        const levelEl = card.querySelector('.temp-level');
        const trendEl = card.querySelector('.temp-trend');
        
        // 更新温度图标和等级
        if (icon) {
            if (tempNum < 7) {
                icon.textContent = '❄️';
            } else if (tempNum > 28) {
                icon.textContent = '🔥';
            } else {
                icon.textContent = '🌡️';
            }
        }
        
        if (levelEl) {
            levelEl.textContent = getTempLevel(tempNum);
        }
        
        // 更新进度条
        updateProgressBar(tempNum);
        
        // 更新趋势显示
        if (trendEl) {
            const trendData = calculateTempTrend();
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
        
    });
}

// 更新进度条位置
function updateProgressBar(tempNum) {
    const progressFill = document.getElementById('tempProgress');
    if (!progressFill) return;
    
    // 将温度映射到0-100%
    // -10℃ = 0%, 13℃ = 50%, 36℃ = 100%
    const percentage = Math.max(0, Math.min(100, ((tempNum + 10) / 46) * 100));
    progressFill.style.width = percentage + '%';
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
    humidityStats.sum += humidityNum;
    humidityStats.count++;
    
    // 更新颜色类
    card.classList.remove('humidity-dry', 'humidity-comfort', 'humidity-wet');
    if (humidityNum < 30) {
        card.classList.add('humidity-dry');
    } else if (humidityNum < 70) {
        card.classList.add('humidity-comfort');
    } else {
        card.classList.add('humidity-wet');
    }
    
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
    windSpeedStats.sum += windNum;
    windSpeedStats.count++;
    
    // 更新颜色类
    card.classList.remove('wind-calm', 'wind-moderate', 'wind-strong');
    if (windNum < 5.4) {
        card.classList.add('wind-calm');
    } else if (windNum < 10.8) {
        card.classList.add('wind-moderate');
    } else {
        card.classList.add('wind-strong');
    }
    
    // 更新风速等级标签
    const levelEl = card.querySelector('.card-level');
    if (levelEl) {
        if (windNum < 2) {
            levelEl.textContent = '平静';
        } else if (windNum < 5.4) {
            levelEl.textContent = '温和';
        } else if (windNum < 10.8) {
            levelEl.textContent = '较强';
        } else if (windNum < 17.2) {
            levelEl.textContent = '强风';
        } else {
            levelEl.textContent = '狂风';
        }
    }
    
    // 更新进度条
    const progressFill = card.querySelector('.card-progress-bar .progress-fill');
    if (progressFill) {
        const percentage = Math.max(0, Math.min(100, windNum * 5));
        progressFill.style.width = percentage + '%';
    }
    
    // 更新趋势
    updateCardTrend(card, windSpeedStats, '.card-trend');
    
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
    illuminationStats.sum += illuminationNum;
    illuminationStats.count++;
    
    // 更新颜色类
    card.classList.remove('illumination-dim', 'illumination-moderate', 'illumination-bright');
    if (illuminationNum < 200) {
        card.classList.add('illumination-dim');
    } else if (illuminationNum < 500) {
        card.classList.add('illumination-moderate');
    } else {
        card.classList.add('illumination-bright');
    }
    
    // 更新光照等级标签
    const levelEl = card.querySelector('.card-level');
    if (levelEl) {
        if (illuminationNum < 10) {
            levelEl.textContent = '黑暗';
        } else if (illuminationNum < 50) {
            levelEl.textContent = '微弱';
        } else if (illuminationNum < 200) {
            levelEl.textContent = '稍暗';
        } else if (illuminationNum < 500) {
            levelEl.textContent = '适中';
        } else if (illuminationNum < 1000) {
            levelEl.textContent = '明亮';
        } else {
            levelEl.textContent = '强光';
        }
    }
    // 更新进度条
    const progressFill = card.querySelector('.card-progress-bar .progress-fill');
    if (progressFill) {
        const percentage = Math.max(0, Math.min(100, illuminationNum / 10));
        progressFill.style.width = percentage + '%';
    }
    // 更新趋势
    updateCardTrend(card, illuminationStats, '.card-trend');
}


// PM2.5卡片更新
function updatePM25Card(pm25Value) {
    const pm25Num = parseInt(pm25Value);
    const card = document.getElementById('PM2card');
    if (!card) return;
    
    pm25Stats.lastUpdateTime = Date.now();
    pm25Stats.history.push(pm25Num);
    if (pm25Stats.history.length > 10) {
        pm25Stats.history.shift();
    }
    pm25Stats.current = pm25Num;
    pm25Stats.sum += pm25Num;
    pm25Stats.count++;
    
    // 更新颜色类
    card.classList.remove('pm25-excellent', 'pm25-good', 'pm25-mild', 'pm25-moderate', 'pm25-heavy');
    if (pm25Num <= 35) {
        card.classList.add('pm25-excellent');
    } else if (pm25Num <= 75) {
        card.classList.add('pm25-good');
    } else if (pm25Num <= 115) {
        card.classList.add('pm25-mild');
    } else if (pm25Num <= 150) {
        card.classList.add('pm25-moderate');
    } else {
        card.classList.add('pm25-heavy');
    }
    
    // 更新PM2.5等级标签
    const levelEl = card.querySelector('.card-level');
    if (levelEl) {
        if (pm25Num <= 35) {
            levelEl.textContent = '优';
        } else if (pm25Num <= 75) {
            levelEl.textContent = '良';
        } else if (pm25Num <= 115) {
            levelEl.textContent = '轻度污染';
            levelEl.classList.add('pollution-level');
        } else if (pm25Num <= 150) {
            levelEl.textContent = '中度污染';
            levelEl.classList.add('pollution-level');
        } else {
            levelEl.textContent = '重度污染';
            levelEl.classList.add('pollution-level');
        }
    }
    // 更新进度条
    const progressFill = card.querySelector('.card-progress-bar .progress-fill');
    if (progressFill) {
        const percentage = Math.max(0, Math.min(100, (pm25Num / 3) * 2));
        progressFill.style.width = percentage + '%';
    }
    // 更新趋势
    updateCardTrend(card, pm25Stats, '.card-trend');
}


// 更新紫外线强度卡片
function updateSunrayCard(sunrayValue) {
    const sunrayNum = parseFloat(sunrayValue);
    const card = document.getElementById('sunrayCard');
    if (!card) return;

    sunrayStats.lastUpdateTime = Date.now();
    sunrayStats.history.push(sunrayNum);
    if (sunrayStats.history.length > 10) {
        sunrayStats.history.shift();
    }
    sunrayStats.current = sunrayNum;
    sunrayStats.sum += sunrayNum;
    sunrayStats.count++;
    
    // 更新颜色类
    card.classList.remove('uvi-weak', 'uvi-moderate', 'uvi-strong', 'uvi-very-strong');
    if (sunrayNum < 3) {
        card.classList.add('uvi-weak');
    } else if (sunrayNum < 6) {
        card.classList.add('uvi-moderate');
    } else if (sunrayNum < 8) {
        card.classList.add('uvi-strong');
    } else {
        card.classList.add('uvi-very-strong');
    }
    
    // 更新紫外线等级标签
    const levelEl = card.querySelector('.card-level');
    if (levelEl) {
        if (sunrayNum < 3) {
            levelEl.textContent = '弱';
        } else if (sunrayNum < 6) {
            levelEl.textContent = '中等';
        } else if (sunrayNum < 8) {
            levelEl.textContent = '强';
        } else if (sunrayNum < 11) {
            levelEl.textContent = '很强';
        } else {
            levelEl.textContent = '极强';
        }
    }
    // 更新进度条
    const progressFill = card.querySelector('.card-progress-bar .progress-fill');
    if (progressFill) {
        const percentage = Math.max(0, Math.min(100, sunrayNum * 10));
        progressFill.style.width = percentage + '%';
    }
    // 更新趋势
    updateCardTrend(card, sunrayStats, '.card-trend');
}


// 更新大气压强卡片
function updatePressureCard(pressureValue) {
    const pressureNum = parseFloat(pressureValue);
    const card = document.getElementById('pressureCard');
    if (!card) return;
    
    pressureStats.lastUpdateTime = Date.now();
    pressureStats.history.push(pressureNum);
    if (pressureStats.history.length > 10) {
        pressureStats.history.shift();
    }
    
    pressureStats.current = pressureNum;
    pressureStats.sum += pressureNum;
    pressureStats.count++;
    
    // 更新颜色类
    card.classList.remove('pressure-low', 'pressure-normal', 'pressure-high');
    if (pressureNum < 100) {
        card.classList.add('pressure-low');
    } else if (pressureNum < 103) {
        card.classList.add('pressure-normal');
    } else {
        card.classList.add('pressure-high');
    }
    
    // 更新等级标签
    const levelEl = card.querySelector('.card-level');
    if (levelEl) {
        if (pressureNum < 100) {
            levelEl.textContent = '偏低';
        } else if (pressureNum < 103) {
            levelEl.textContent = '正常';
        } else {
            levelEl.textContent = '偏高';
        }
    }
    
    // 更新数值
    const valueEl = card.querySelector('.card-value');
    if (valueEl) {
        valueEl.textContent = pressureNum.toFixed(2);
    }
    
    // 更新进度条 (90-110 KPa)
    const progressFill = card.querySelector('.card-progress-bar .progress-fill');
    if (progressFill) {
        const percentage = Math.max(0, Math.min(100, ((pressureNum - 90) / 20) * 100));
        progressFill.style.width = percentage + '%';
    }
    
    // 更新趋势
    updateCardTrend(card, pressureStats, '.card-trend');
}

// 更新海拔高度卡片
function updateAltitudeCard(altitudeValue) {
    const altitudeNum = parseFloat(altitudeValue);
    const card = document.getElementById('altitudeCard');
    if (!card) return;
    
    altitudeStats.lastUpdateTime = Date.now();
    altitudeStats.history.push(altitudeNum);
    if (altitudeStats.history.length > 10) {
        altitudeStats.history.shift();
    }
    
    altitudeStats.current = altitudeNum;
    altitudeStats.sum += altitudeNum;
    altitudeStats.count++;
    
    // 更新颜色类
    card.classList.remove('altitude-low', 'altitude-medium', 'altitude-high');
    if (altitudeNum < 500) {
        card.classList.add('altitude-low');
    } else if (altitudeNum < 1500) {
        card.classList.add('altitude-medium');
    } else {
        card.classList.add('altitude-high');
    }
    
    // 更新等级标签
    const levelEl = card.querySelector('.card-level');
    if (levelEl) {
        if (altitudeNum < 500) {
            levelEl.textContent = '低海拔';
        } else if (altitudeNum < 1500) {
            levelEl.textContent = '中海拔';
        } else if (altitudeNum < 3000) {
            levelEl.textContent = '高海拔';
        } else {
            levelEl.textContent = '超高海拔';
        }
    }
    
    // 更新数值
    const valueEl = card.querySelector('.card-value');
    if (valueEl) {
        valueEl.textContent = altitudeNum.toFixed(1);
    }
    
    // 更新进度条 (0-3000m)
    const progressFill = card.querySelector('.card-progress-bar .progress-fill');
    if (progressFill) {
        const percentage = Math.max(0, Math.min(100, (altitudeNum / 3000) * 100));
        progressFill.style.width = percentage + '%';
    }
    
    // 更新趋势
    updateCardTrend(card, altitudeStats, '.card-trend');
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
