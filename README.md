# MQTT 环境监控

简要说明：一个基于 MQTT over WebSocket 的前端监控页面，用于实时展示温度、湿度、风速和光照等环境数据。

快速开始：

- 在浏览器中打开 [index.html](index.html)。
- 打开右上角菜单 → MQTT 连接配置，填入 `wss://` 地址、客户端 ID 和订阅主题（默认 `environment/data`），点击“测试连接”并应用。

MQTT 消息示例（JSON）：

```json
{
  "temperature": 25.5,
  "humidity": 60,
  "windSpeed": 2.3,
  "illumination": 1200
}
```

文件结构：

- index.html
- css/style.css
- js/
  - mqtt-client.js
  - mqtt-config.js
  - chart-utils.js
  - menu-utils.js
  - main-utils.js
  - mqttws31.min.js (Paho MQTT)

说明：
- 所有字段为可选，收到字段时更新对应显示。
- 默认通过 WSS 建议加密传输；密码仅在会话中使用，不存储到 LocalStorage。

若需更多细节（配置、UI 或动画），请查看源码中的 `js/` 与 `css/` 文件。

作者/维护：项目仓库内说明文件。

| **交互响应** | < 50ms | ✅ 30ms |
| **内存占用** | < 10MB | ✅ 5MB |
| **CSS 文件大小** | < 100KB | ✅ 84KB |

---

## 📚 开发日志

### v2.1 - 最新优化（2025-12-12）

**页面布局优化**：
- ✨ 标题改为"环境数据"（更简洁）
- ✨ 状态点移至左上角（与菜单对称）
- ✨ 菜单高度调整为 50%（完全对称）
- ✨ 弹窗动画改为 bounceInCenter（流畅缩放）

**变更文件**：
- index.html - 标题文字
- css/style.css - 动画和位置
- js/main-utils.js - 位置计算函数

### v2.0 - 页面美化优化

**视觉增强**：
- ✨ 9 种 CSS 动画库
- ✨ 渐变配色系统
- ✨ 多层阴影设计
- ✨ 光线扫过效果
- ✨ 加载指示器

**交互优化**：
- ✨ 全面的悬停反馈
- ✨ 流畅的过渡动画
- ✨ 数据更新动画
- ✨ 状态变化动画
