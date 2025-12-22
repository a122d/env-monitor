/**
 * AI环境分析助手
 * 使用火山方舟豆包 API 或本地MQTT客户端处理
 */

const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

let aiConfig = {
    apiKey: '',
    model: 'doubao-seed-1-6-flash-250828'
};

// 对话历史（限制最大条数防止内存溢出）
let chatHistory = [];
const MAX_CHAT_HISTORY = 20;

// 定时器ID（用于清理）
let aiDataDisplayInterval = null;

// DOM元素
let aiSidebar, aiChatContainer, aiInput, aiSendBtn;
let aiConfigModal, aiApiKey, aiModel, aiModalApiBtn;

// MQTT 连接检查
function isMQTTConnected() {
    return window.mqttClient && window.mqttClient.isConnected && window.mqttClient.isConnected();
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 获取DOM元素
    aiSidebar = document.getElementById('aiSidebar');
    aiChatContainer = document.getElementById('aiChatContainer');
    aiInput = document.getElementById('aiInput');
    aiSendBtn = document.getElementById('aiSendBtn');
    aiConfigModal = document.getElementById('aiConfigModal');
    aiApiKey = document.getElementById('aiApiKey');
    aiModel = document.getElementById('aiModel');
    aiModalApiBtn = document.getElementById('aiModalApiBtn');

    // 加载保存的配置
    loadAIConfig();

    // 绑定事件
    bindAIEvents();

    // 更新环境数据显示（保存定时器ID以便清理）
    if (aiDataDisplayInterval) {
        clearInterval(aiDataDisplayInterval);
    }
    aiDataDisplayInterval = setInterval(updateAIDataDisplay, 2000);
});

// 加载AI配置
function loadAIConfig() {
    const saved = localStorage.getItem('aiConfig');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            aiConfig.apiKey = parsed.apiKey || aiConfig.apiKey;
            aiConfig.model = parsed.model || aiConfig.model;
        } catch (e) {
            console.error('❌ 加载AI配置失败：', e);
            localStorage.removeItem('aiConfig');
        }
    }
    // 同步到输入框
    if (aiApiKey) aiApiKey.value = aiConfig.apiKey;
    if (aiModel) aiModel.value = aiConfig.model;
}

// 保存AI配置
function saveAIConfig() {
    aiConfig = {
        apiKey: aiApiKey.value,
        model: aiModel.value
    };
    localStorage.setItem('aiConfig', JSON.stringify(aiConfig));
    // 注：不在这里更新按键状态，避免不必要的 DOM 变化导致闪烁
}

// 绑定事件
function bindAIEvents() {
    // 打开/关闭侧边栏
    const aiBtn = document.getElementById('aiAssistantBtn');
    const closeBtn = document.getElementById('aiCloseBtn');
    
    aiBtn?.addEventListener('click', () => {
        aiSidebar.classList.add('show');
        // AI侧边栏不锁定背景滚动，允许用户查看左侧内容
        updateAIDataDisplay();
    });
    
    closeBtn?.addEventListener('click', () => {
        aiSidebar.classList.remove('show');
    });

    // 设置按钮
    const settingsBtn = document.getElementById('aiSettingsBtn');
    const configClose = document.getElementById('aiConfigClose');
    
    settingsBtn?.addEventListener('click', () => {
        aiConfigModal.classList.add('show');
        // 打开时不更新状态，避免不必要的 DOM 变化导致闪烁
    });
    
    configClose?.addEventListener('click', () => {
        aiConfigModal.classList.remove('show');
    });

    // 点击遮罩关闭
    aiConfigModal?.querySelector('.modal-mask')?.addEventListener('click', () => {
        aiConfigModal.classList.remove('show');
    });

    // 保存配置
    document.getElementById('aiSaveBtn')?.addEventListener('click', () => {
        saveAIConfig();
        if (window.ToastAlert) {
            ToastAlert.show('配置已保存！');
        }
        aiConfigModal.classList.remove('show');
    });

    // 测试连接
    document.getElementById('aiTestBtn')?.addEventListener('click', testAIConnection);

    // 发送消息
    aiSendBtn?.addEventListener('click', sendMessage);
    
    // 获取API（从配置模态框中的按键）
    aiModalApiBtn?.addEventListener('click', getAPIFromModal);
    
    aiInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 自动调整输入框高度
    aiInput?.addEventListener('input', () => {
        aiInput.style.height = 'auto';
        aiInput.style.height = Math.min(aiInput.scrollHeight, 120) + 'px';
    });

    // 快捷按钮
    document.querySelectorAll('.ai-quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            handleQuickAction(action);
        });
    });
}

// 更新AI面板的环境数据显示
function updateAIDataDisplay() {
    const tempEl = document.getElementById('aiTemp');
    const humidityEl = document.getElementById('aiHumidity');
    const windEl = document.getElementById('aiWind');
    const lightEl = document.getElementById('aiLight');
    const pm25El = document.getElementById('aiPM25');
    const uvEl = document.getElementById('aiUV');

    // 从页面获取当前数据
    const temp = document.getElementById('temperature')?.textContent || '--';
    const humidity = document.getElementById('humidity')?.textContent || '--';
    const wind = document.getElementById('windSpeed')?.textContent || '--';
    const light = document.getElementById('illumination')?.textContent || '--';
    const pm25 = document.getElementById('PM2')?.textContent || '--';
    const uv = document.getElementById('sunray')?.textContent || '--';

    if (tempEl) tempEl.textContent = temp;
    if (humidityEl) humidityEl.textContent = humidity;
    if (windEl) windEl.textContent = wind;
    if (lightEl) lightEl.textContent = light;
    if (pm25El) pm25El.textContent = pm25;
    if (uvEl) uvEl.textContent = uv;
}

// 获取当前环境数据
function getCurrentEnvironmentData() {
    const temp = document.getElementById('temperature')?.textContent || '未知';
    const humidity = document.getElementById('humidity')?.textContent || '未知';
    const wind = document.getElementById('windSpeed')?.textContent || '未知';
    const light = document.getElementById('illumination')?.textContent || '未知';
    const pm25 = document.getElementById('PM2')?.textContent || '未知';
    const uv = document.getElementById('sunray')?.textContent || '未知';
    
    const tempMax = document.getElementById('tempMax')?.textContent || '未知';
    const tempMin = document.getElementById('tempMin')?.textContent || '未知';
    const humidityMax = document.getElementById('humidityMax')?.textContent || '未知';
    const humidityMin = document.getElementById('humidityMin')?.textContent || '未知';
    const pm25Max = document.getElementById('PM2Max')?.textContent || '未知';
    const pm25Min = document.getElementById('PM2Min')?.textContent || '未知';
    const uvMax = document.getElementById('sunrayMax')?.textContent || '未知';
    const uvMin = document.getElementById('sunrayMin')?.textContent || '未知';

    return {
        current: { temp, humidity, wind, light, pm25, uv },
        stats: { tempMax, tempMin, humidityMax, humidityMin, pm25Max, pm25Min, uvMax, uvMin },
        time: new Date().toLocaleString('zh-CN')
    };
}

// 构建系统提示词
function buildSystemPrompt() {
    const envData = getCurrentEnvironmentData();
    
    return `
    你是一个专业的环境监测分析助手，专门分析校园环境数据并提供专业建议。

    当前校园环境（室外）数据：
    - 温度：${envData.current.temp}℃（最高：${envData.stats.tempMax}℃，最低：${envData.stats.tempMin}℃）
    - 湿度：${envData.current.humidity}%（最高：${envData.stats.humidityMax}%，最低：${envData.stats.humidityMin}%）
    - 风速：${envData.current.wind} m/s
    - 光照强度：${envData.current.light} lux
    - PM2.5浓度：${envData.current.pm25} μg/m³（最高：${envData.stats.pm25Max} μg/m³，最低：${envData.stats.pm25Min} μg/m³）
    - 紫外线强度：${envData.current.uv} UVI（最高：${envData.stats.uvMax} UVI，最低：${envData.stats.uvMin} UVI）
    - 数据时间：${envData.time}

    你的职责：
    1. 首先结合所有环境数据（包括时间）进行综合分析
    2. 分析环境数据的合理性和舒适度
    3. 识别潜在的环境问题或异常
    4. 提供专业、实用的改善建议
    5. 使用简洁明了的语言，必要时使用emoji增强可读性
    6. 回答要简洁，控制在300字以内

    若用户未询问环境相关问题，请礼貌提醒用户你专注于环境数据分析。

    注意：所有分析和建议均基于上述提供的环境数据。
    回答时务必结合当前提供的环境数据，切勿凭空编造数据或信息。

    请基于以上内容回答用户的问题。
    `;
}

// 处理快捷操作
function handleQuickAction(action) {
    const prompts = {
        analyze: '请分析当前的环境数据，给出综合评估。',
        comfort: '当前环境的舒适度如何？适合学习和工作吗？',
        advice: '基于当前环境数据，有什么改善建议？'
    };
    
    const prompt = prompts[action];
    if (prompt) {
        aiInput.value = prompt;
        sendMessage();
    }
}

// 发送消息（直接调用AI API）
async function sendMessage() {
    const message = aiInput.value.trim();
    if (!message) return;

    // MQTT 未连接时直接提示并不发送
    if (!isMQTTConnected()) {
        addMessage('assistant', '⚠️ MQTT 未连接，请先登录 MQTT 后再使用 AI 功能。');
        return;
    }

    // 检查API配置
    if (!aiConfig.apiKey) {
        addMessage('assistant', '⚠️ 请先配置 API Key！点击右上角 ⚙️ 按钮，在设置中点击"🔗 获取API"按键获取配置。');
        return;
    }

    // 清空输入框
    aiInput.value = '';
    aiInput.style.height = 'auto';

    // 添加用户消息
    addMessage('user', message);

    // 添加加载指示
    const loadingId = addLoadingMessage();

    try {
        const response = await callAI(message);
        removeMessage(loadingId);
        addMessage('assistant', response);
    } catch (error) {
        removeMessage(loadingId);
        addMessage('assistant', `❌ 请求失败：${error.message}`);
    }
}

// 🔗 从配置模态框中获取API
function getAPIFromModal() {
    // 检查MQTT是否已连接
    if (!window.sendAIAPIRequest || typeof window.sendAIAPIRequest !== 'function') {
        ToastAlert.show('⚠️ MQTT未连接，请先完成登录。');
        return;
    }

    // 检查是否已有API Key
    if (aiApiKey.value.trim()) {
        ToastAlert.show('⚠️ 已检测到已有API Key，无需重复获取。');
        return;
    }

    const client = window.mqttClient;
    if (!client || !client.isConnected || !client.isConnected()) {
        ToastAlert.show('⚠️ MQTT未连接，请先完成登录。');
        return;
    }

    aiModalApiBtn.disabled = true;
    const originalText = aiModalApiBtn.innerHTML;
    aiModalApiBtn.innerHTML = '<span>⏳ 处理中...</span>';
    // 显示loading遮罩
    const loadingMask = document.getElementById('aiConfigLoadingMask');
    if (loadingMask) loadingMask.style.display = 'flex';

    const topic = (window.MQTT_DEFAULT_CONFIG && window.MQTT_DEFAULT_CONFIG.aiResponseTopic) || 'Set/AI_API';
    let timeoutId = null;
    let cleaned = false;
    // 统一取消订阅与收尾
    function cleanup() {
        if (cleaned) return;
        cleaned = true;
        try {
            client.unsubscribe(topic, {
                onSuccess: () => {},
                onFailure: () => {}
            });
        } catch (_) {}
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        window.onAPIModalResponse = null;
        aiModalApiBtn.disabled = false;
        aiModalApiBtn.innerHTML = originalText;
        // 隐藏loading遮罩
        const loadingMask = document.getElementById('aiConfigLoadingMask');
        if (loadingMask) loadingMask.style.display = 'none';
    }

    try {
        // 先按需订阅响应主题
        client.subscribe(topic, {
            qos: 1,
            onSuccess: () => {
                // 订阅成功后再发送请求
                const requestId = window.sendAIAPIRequest('__API_CALL__');
                if (!requestId) {
                    cleanup();
                    ToastAlert.show('❌ 请求发送失败，请检查MQTT连接');
                    return;
                }

                // 设置超时：3秒，超时后取消订阅
                timeoutId = setTimeout(() => {
                    cleanup();
                    ToastAlert.show('⏱️ 请求超时，请稍后重试。');
                }, 3000);

                // 监听一次性响应
                window.onAPIModalResponse = function(response) {
                    cleanup();
                    if (response && response.success && response.result) {
                        aiApiKey.value = response.result;
                        saveAIConfig();
                        ToastAlert.show('✅ API Key 获取成功，已自动填入并保存！');
                    } else {
                        ToastAlert.show(`❌ ${response && response.error ? response.error : 'API调用失败'}`);
                    }
                };
            },
            onFailure: (res) => {
                cleanup();
                ToastAlert.show('❌ 订阅响应主题失败：' + (res && res.errorMessage ? res.errorMessage : '未知错误'));
            }
        });
    } catch (error) {
        cleanup();
        ToastAlert.show(`❌ 调用失败：${error.message}`);
    }
}

// 调用AI API
async function callAI(userMessage) {
    const systemPrompt = buildSystemPrompt();
    
    // 构建消息历史
    const messages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.slice(-6), // 保留最近6条对话
        { role: 'user', content: userMessage }
    ];

    // 构建请求体
    const requestBody = {
        model: aiConfig.model,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
    };

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiConfig.apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || '无响应内容';

    // 保存到历史（限制最大条数）
    chatHistory.push({ role: 'user', content: userMessage });
    chatHistory.push({ role: 'assistant', content: assistantMessage });
    
    // 超过上限时删除最早的记录
    while (chatHistory.length > MAX_CHAT_HISTORY) {
        chatHistory.shift();
    }

    return assistantMessage;
}

// 测试AI连接
async function testAIConnection() {
    const testBtn = document.getElementById('aiTestBtn');
    const originalText = testBtn.textContent;
    
    testBtn.disabled = true;
    testBtn.textContent = '测试中...';

    if (!isMQTTConnected()) {
        ToastAlert.show('⚠️ MQTT 未连接，请先登录 MQTT 后再测试。');
        testBtn.disabled = false;
        testBtn.textContent = originalText;
        return;
    }

    // 临时保存配置
    const tempConfig = { ...aiConfig };
    aiConfig = {
        apiKey: aiApiKey.value,
        model: aiModel.value
    };

    try {
        const response = await callAI('你好，请简单回复"连接成功"四个字。');
        ToastAlert.show('✅ 连接成功！\n\nAI回复：' + response);
    } catch (error) {
        ToastAlert.show('❌ 连接失败：' + error.message);
        aiConfig = tempConfig;
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = originalText;
    }
}

// 添加消息到聊天界面
function addMessage(role, content) {
    const messageId = 'msg-' + Date.now();
    const messageDiv = document.createElement('div');
    messageDiv.id = messageId;
    messageDiv.className = `ai-message ${role}-message`;
    
    const avatar = role === 'user' ? '👤' : '🤖';
    
    messageDiv.innerHTML = `
        <div class="ai-avatar">${avatar}</div>
        <div class="ai-message-content">
            <div class="message-text">${formatMessage(content)}</div>
        </div>
    `;
    
    aiChatContainer.appendChild(messageDiv);
    aiChatContainer.scrollTop = aiChatContainer.scrollHeight;
    
    return messageId;
}

// 添加加载消息
function addLoadingMessage() {
    const messageId = 'loading-' + Date.now();
    const messageDiv = document.createElement('div');
    messageDiv.id = messageId;
    messageDiv.className = 'ai-message assistant-message loading-message';
    
    messageDiv.innerHTML = `
        <div class="ai-avatar">🤖</div>
        <div class="ai-message-content">
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    
    aiChatContainer.appendChild(messageDiv);
    aiChatContainer.scrollTop = aiChatContainer.scrollHeight;
    
    return messageId;
}

// 移除消息
function removeMessage(messageId) {
    const el = document.getElementById(messageId);
    if (el) el.remove();
}

// 格式化消息（简单Markdown支持，防XSS）
function formatMessage(content) {
    // 先转义HTML特殊字符防止XSS
    const escaped = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    // 再应用Markdown格式化
    return escaped
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>')
        .replace(/`(.*?)`/g, '<code>$1</code>');
}

// 清空对话历史
window.clearAIChat = function() {
    chatHistory = [];
    aiChatContainer.innerHTML = `
        <div class="ai-welcome-message">
            <div class="ai-avatar">🤖</div>
            <div class="ai-message-content">
                <p>👋 你好！我是AI环境分析助手。</p>
                <p>我可以帮你分析当前环境数据，提供专业建议。</p>
                <div class="ai-quick-actions">
                    <button class="ai-quick-btn" data-action="analyze">📊 分析当前环境</button>
                    <button class="ai-quick-btn" data-action="comfort">🌡️ 舒适度评估</button>
                    <button class="ai-quick-btn" data-action="advice">💡 环境建议</button>
                </div>
            </div>
        </div>
    `;
    
    // 重新绑定快捷按钮事件（使用事件委托避免重复绑定）
    bindQuickButtons();
};

// 绑定快捷按钮（独立函数，避免重复绑定）
function bindQuickButtons() {
    const container = aiChatContainer.querySelector('.ai-quick-actions');
    if (!container) return;
    
    // 使用事件委托，只在容器上绑定一次
    container.onclick = (e) => {
        const btn = e.target.closest('.ai-quick-btn');
        if (btn) {
            const action = btn.dataset.action;
            handleQuickAction(action);
        }
    };
}
