/**
 * MQTT客户端核心逻辑（稳定长连接+数据÷10处理）
 */
let mqttClient = null;
let reconnectTimer = null;
const RECONNECT_INTERVAL = 5000;
let baseClientId = 'env-monitor-' + Math.random().toString(16).substr(2, 8);

// 温度统计数据
let temperatureStats = {
    current: 0,
    max: -Infinity,
    min: Infinity,
    sum: 0,
    count: 0,
    history: [],           // 保存最近10次数据用于趋势计算
    lastUpdateTime: null,  // 上次更新时间
    changeRate: 0          // 变化速率
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

// 确保 parseMqttUrl 函数可用（备用定义）
if (!window.parseMqttUrl) {
    window.parseMqttUrl = function(url) {
        const parsed = new URL(url);
        return {
            host: parsed.hostname,
            port: parseInt(parsed.port),
            path: parsed.pathname || '/mqtt',
            useSSL: parsed.protocol === 'wss:'
        };
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
    maxRetries: 5,          // 最大重试 5 次
    jitter: 0.1              // 抖动 10%
};

let reconnectCount = 0;

// 计算退避延迟
function getReconnectDelay() {
    if (reconnectCount >= RECONNECT_CONFIG.maxRetries) {
        return null;
    }
    
    let delay = RECONNECT_CONFIG.baseInterval * 
        Math.pow(RECONNECT_CONFIG.multiplier, reconnectCount);
    delay = Math.min(delay, RECONNECT_CONFIG.maxInterval);
    
    // 加入抖动，避免同时重连
    const jitterRange = delay * RECONNECT_CONFIG.jitter;
    delay += Math.random() * jitterRange;
    
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
    // 大气压强：÷1000保留2位小数，单位kPa
    if (data.pressure !== undefined) {
        const pressureValue = (parseFloat(data.pressure) / 1000).toFixed(2);
        updatePressureCard(pressureValue);
        updateDataValue('pressure', pressureValue);
    }
    // 海拔高度：÷10保留1位小数，单位m
    if (data.altitude !== undefined) {
        const altitudeValue = (parseFloat(data.altitude) / 10).toFixed(1);
        updateAltitudeCard(altitudeValue);
        updateDataValue('altitude', altitudeValue);
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
    // 检查必要的DOM元素
    const tempMaxEl = document.getElementById('tempMax');
    const tempMinEl = document.getElementById('tempMin');
    if (!tempMaxEl || !tempMinEl) return;
    
    const max = temperatureStats.max !== -Infinity ? temperatureStats.max.toFixed(1) : '--';
    const min = temperatureStats.min !== Infinity ? temperatureStats.min.toFixed(1) : '--';
    
    tempMaxEl.textContent = max;
    tempMinEl.textContent = min;
    
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

// 更新大气压强卡片
function updatePressureCard(pressureValue) {
    const pressureNum = parseFloat(pressureValue);
    const card = document.getElementById('pressureCard');
    if (!card) return;
    // 只更新数值部分
    const valueEl = card.querySelector('.card-value');
    if (valueEl) {
        valueEl.textContent = pressureNum.toFixed(2);
    }
}

// 更新海拔高度卡片
function updateAltitudeCard(altitudeValue) {
    const altitudeNum = parseFloat(altitudeValue);
    const card = document.getElementById('altitudeCard');
    if (!card) return;
    // 只更新数值部分
    const valueEl = card.querySelector('.card-value');
    if (valueEl) {
        valueEl.textContent = altitudeNum.toFixed(1);
    }
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
    const max = humidityStats.max !== -Infinity ? humidityStats.max.toFixed(1) : '--';
    const min = humidityStats.min !== Infinity ? humidityStats.min.toFixed(1) : '--';

    const maxEl = document.getElementById('humidityMax');
    if (maxEl) maxEl.textContent = max;

    const minEl = document.getElementById('humidityMin');
    if (minEl) minEl.textContent = min;
}

// 更新风速详细信息
function updateWindSpeedDetails() {
    const max = windSpeedStats.max !== -Infinity ? windSpeedStats.max.toFixed(1) : '--';
    const min = windSpeedStats.min !== Infinity ? windSpeedStats.min.toFixed(1) : '--';

    const maxEl = document.getElementById('windSpeedMax');
    if (maxEl) maxEl.textContent = max;

    const minEl = document.getElementById('windSpeedMin');
    if (minEl) minEl.textContent = min;
}

// 更新光照强度详细信息
function updateIlluminationDetails() {
    const max = illuminationStats.max !== -Infinity ? illuminationStats.max.toFixed(1) : '--';
    const min = illuminationStats.min !== Infinity ? illuminationStats.min.toFixed(1) : '--';

    const maxEl = document.getElementById('illuminationMax');
    if (maxEl) maxEl.textContent = max;

    const minEl = document.getElementById('illuminationMin');
    if (minEl) minEl.textContent = min;
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
            try {
                const data = JSON.parse(payload);
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
            keepAliveInterval: mqttConfig.keepalive,
            timeout: 10000,
            useSSL: urlInfo.useSSL,
            cleanSession: true,
            onSuccess: function() {
                updateMQTTStatus('success');
                reconnectCount = 0;

                // 订阅环境数据主题
                client.subscribe(mqttConfig.topic, {
                    onFailure: (res) => {
                        console.error('❌ 订阅主题失败：', res.errorMessage);
                        ToastAlert.show('订阅失败：' + res.errorMessage);
                    }
                });
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
                if (window.onMQTTConnectFailure) {
                    window.onMQTTConnectFailure(res.errorMessage);
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
        ToastAlert.show('初始化失败：' + e.message);
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
    console.log('🔐 用户登录，更新MQTT凭证...');
    
    // 验证传入参数
    if (!credentials || !credentials.username || !credentials.password) {
        console.error('❌ 无效的登录凭证');
        if (window.onMQTTConnectFailure) {
            window.onMQTTConnectFailure('登录凭证不完整');
        }
        return;
    }
    
    // 更新MQTT配置中的凭证
    mqttConfig.username = credentials.username;
    mqttConfig.password = credentials.password;
    
    console.log('✅ MQTT凭证已更新');
    console.log('📋 新凭证信息:', {
        username: mqttConfig.username,
        password: '***',
        host: mqttConfig.host,
        topic: mqttConfig.topic,
        clientId: mqttConfig.clientId
    });
    
    // 使用更新后的配置进行连接
    console.log('🚀 开始连接到MQTT服务器...');
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