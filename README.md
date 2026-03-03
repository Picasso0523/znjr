## 安逸花官网示例项目

### 结构

- `index.html`：官网首页（静态 HTML）。
- `about.html`：关于我们页面（公司简介 + 发展历史骨架）。
- `styles.css`：全站样式，支持首页和关于我们。
- `app.js`：前端交互逻辑（风险提示展开、AI 客服弹窗、调用后端 `/api/chat`）。
- `backend/`：Node.js 后端，负责数据同步和 Coze 转发。

### 本地预览前端

直接双击 `index.html` 用浏览器打开即可预览静态页面。

如需使用 AI 客服能力和数据接口，需要同时启动后端。

### 启动后端（需要 Node.js 18+）

```bash
cd backend
npm install
npm start
```

默认监听 `http://localhost:3001`，可通过反向代理或静态服务器将 `/api/*` 请求转发到该端口。

### Coze 配置

后端当前默认使用占位的 token 和 appId，可以通过环境变量覆盖：

- `COZE_TOKEN`
- `COZE_APP_ID`

前端调用 `/api/chat` 时会自动携带 `user_id`（保存在浏览器 `localStorage` 中）和 `user_query`，后端将其映射到 Coze 工作流的 `{{user_id}}` 与 `{{user_query}}`。

