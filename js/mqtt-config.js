// 提供MQTT连接配置和用户登录弹窗功能

// ============ 应用版本号 ============
// 统一版本号管理
const APP_VERSION = 'V5.4.6';

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
// ⚠️ 安全提示：不要在代码中硬编码密码和敏感凭证
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
            eyeIcon.style.display = 'none';
            eyeOffIcon.style.display = 'block';
        } else {
            mqttPassword.type = 'password';
            eyeIcon.style.display = 'block';
            eyeOffIcon.style.display = 'none';
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
            userName.style.display = 'inline';
            // 隐藏"未登录"文字
            if (statusText) statusText.style.display = 'none';
        } else {
            // 未登录或使用默认配置，不显示用户名
            userName.style.display = 'none';
            // 显示"未登录"文字
            if (statusText) statusText.style.display = 'inline';
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

    // 事件绑定（优化版 - 减少监听器数量）
    function bindEvents() {
        // 关闭按钮
        modalClose.addEventListener('click', closeModal, { passive: true });
        
        // 使用事件委托处理弹窗点击
        mqttConfigModal.addEventListener('click', (e) => {
            // 点击空白区域（modal-mask）关闭弹窗
            if (e.target.classList.contains('modal-mask')) {
                closeModal();
            }
        }, { passive: true });
        
        // 按 Escape 键关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mqttConfigModal.classList.contains('show')) {
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
        mqttConfigModal.classList.add('show');
        if (window.ScrollLock) window.ScrollLock.lock();
        mqttUsername.focus();
    };
});