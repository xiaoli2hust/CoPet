# 年轮经营后台接入说明

## 1. 调用链

```text
问年轮 React 窗口
  -> NianLunClient
  -> MockNianLunAdapter / StreamNianLunAdapter / HttpNianLunAdapter
  -> response normalizer
  -> 共用消息与会话状态
  -> 宠物状态映射与窗口展示
```

React 组件不直接发送后台请求。所有网络、错误、回退和 Schema 兼容都位于 `src/services/nianlun/`。

## 2. 配置优先级

1. 设置中心保存的本地用户配置。
2. 环境变量。
3. 开发默认值。

```dotenv
NIANLUN_AGENT_BASE_URL=http://localhost:8000
NIANLUN_AGENT_CHAT_PATH=/api/agent/chat
NIANLUN_AGENT_HEALTH_PATH=/api/health
```

后台地址必须使用 `http://` 或 `https://`，路径会统一补齐前导斜杠并避免重复斜杠。生产地址不得写入仓库。

## 3. 健康检查

```http
GET /api/health
Accept: application/json
X-Client-Type: nianlun-desktop-pet
X-Permission-Mode: super-readonly
```

兼容响应示例：

```json
{
  "status": "ok",
  "version": "2026.07"
}
```

`status` 为 `ok`、`healthy` 或等价可用状态即可。非 2xx、超时和网络错误会显示为离线，不使应用崩溃。

## 4. 普通 HTTP 问答

```http
POST /api/agent/chat
Content-Type: application/json
Accept: application/json
Authorization: Bearer <optional-token>
X-Client-Type: nianlun-desktop-pet
X-Permission-Mode: super-readonly
```

请求：

```json
{
  "conversationId": "conv_local_uuid",
  "message": "华东区本月签单为什么下降？",
  "client": "nianlun-desktop-pet",
  "context": {
    "permissionMode": "super_readonly",
    "responseMode": "desktop_compact"
  }
}
```

推荐响应：

```json
{
  "requestId": "req_123",
  "conversationId": "conv_local_uuid",
  "answer": "完整经营回答",
  "summary": "适合桌宠展示的核心结论",
  "status": "completed",
  "evidence": [
    {
      "title": "华东区经营月报",
      "source": "CRM",
      "time": "2026-07-13 10:00:00"
    }
  ],
  "actions": []
}
```

后台不必完全使用这一 Schema。Normalizer 会兼容常见的 camelCase/snake_case 标识、字符串回答和证据字段；无法识别、空回答或非法 JSON 会变成明确错误，不把原始敏感响应直接展示给用户。

## 5. SSE 流式问答

桌宠仍向问答路径发起 POST，但使用：

```http
Accept: text/event-stream
```

每个事件使用标准 SSE `data:` 行，事件之间以空行分隔：

```text
data: {"type":"status","status":"understanding"}

data: {"type":"status","status":"querying"}

data: {"type":"delta","delta":"华东区本月签单"}

data: {"type":"evidence","evidence":[{"title":"经营月报","source":"CRM","time":"2026-07-13"}]}

data: {"type":"completed","requestId":"req_123","conversationId":"conv_local_uuid"}

```

支持的语义事件为 `status`、`delta`、`evidence`、`completed`、`error`。桌面仅展示以下过程文案：

- 正在理解问题
- 正在查询经营数据
- 正在生成回答
- 回答完成
- 请求失败

不会展示模型内部思维、隐藏提示词或完整工具参数。

当 SSE 返回不支持、建立失败或中断且未完成时，客户端会回退普通 HTTP。用户点击“停止”时使用 AbortController 终止当前请求。

## 6. 超时、重试与异常

- 默认超时 30 秒，可在设置中心调整。
- 非 2xx 会保留安全、简短的状态信息。
- 非 JSON、无效 Schema、空回答和超长回答分别归一化处理。
- 网络不可达显示“年轮后台离线或网络不可达”。
- 失败消息保留“重试”，重试沿用当前 `conversationId`。
- 同一时刻只允许一个发送请求，避免重复提交。
- 长回答在桌面窗口内部滚动；回答有防护上限。

## 7. Token 处理

Token 默认为空。配置后：

- macOS 保存到 Keychain。
- Windows 保存到 Credential Manager。
- 不写入普通 JSON、本地历史、日志、错误信息和调试面板。
- 仅用于可信测试阶段的 Bearer Token。

客户端声明 `super_readonly` 不是安全权限。正式权限必须由服务端基于真实身份、租户、角色、数据范围和工具白名单判断。

## 8. 会话与隐私

本地只保存 `conversationId`、用户问题、最终回答、创建时间和更新时间，默认最多 10 个会话。可关闭历史并清空全部记录。不会保存模型内部过程、Token 或完整工具参数。第一版不做跨设备同步。

## 9. Mock 模式

### 内置 Mock Adapter

在设置中心打开“使用 Mock 模式”。网络请求完全不会发出，回答顶部明确显示“模拟数据”。

### 独立 Mock HTTP Server

```bash
pnpm mock:nianlun
```

实现：

- `GET /api/health`
- `POST /api/agent/chat`
- JSON 与 SSE 两种响应
- 五个第一版经营问题和同会话追问

这条链路用于验证桌宠真实 HTTP 行为，而不是把内置假数据混入真实模式。

## 10. 后台快速兼容

最小 Node.js 逻辑如下；仓库中的 `examples/mock-nianlun-server/server.mjs` 是可直接运行的完整版本。

```js
import http from "node:http";

http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/api/health") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  }

  if (req.method === "POST" && req.url === "/api/agent/chat") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const input = JSON.parse(body);
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({
      requestId: crypto.randomUUID(),
      conversationId: input.conversationId,
      answer: "兼容接口回答",
      summary: "核心结论",
      status: "completed",
      evidence: [],
      actions: []
    }));
  }

  res.writeHead(404).end();
}).listen(8000);
```

## 11. 替换为真实年轮接口

1. 启动真实年轮兼容接口。
2. 在设置中心关闭内置 Mock。
3. 填写后台地址、问答路径和健康检查路径。
4. 如需要，在系统安全存储中保存测试 Token。
5. 点击“测试连接”。
6. 先验证普通 HTTP，再开启 SSE。
7. 服务端必须实施真实只读权限，不得信任客户端请求头。

如果真实返回结构不同，只修改 Normalizer 或新增 Adapter，不应把服务端字段判断写进 React 组件。
