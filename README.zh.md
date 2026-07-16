# 年轮经营桌宠

年轮经营桌宠（NianLun Desktop Pet）直接基于开源 [CoPet](https://github.com/ChanceYu/CoPet) 二次开发。它既是可点击、可拖动、始终置顶的普通桌面宠物，也是年轮经营后台的小助手：双击宠物即可在桌面应用内打开“问年轮”窗口，不跳转浏览器。

macOS 与 Windows 使用同一套 React + Tauri 代码、同一套问答逻辑和同一套配置结构，不复制两份业务代码。

[English](README.md) | [年轮后台接入协议](docs/nianlun-agent-integration.md) | [V1 任务清单](docs/nianlun-v1-checklist.md)

## 基于 CoPet 保留的能力

- 透明无边框宠物窗口、现有宠物素材和宠物选择。
- 宠物动画、单击互动、双击、拖动、始终置顶。
- 原生右键菜单、系统托盘、设置中心、本地配置、错误处理和 Windows 打包。
- 原有 Codex、Claude Code、Cursor 等 Agent Hook 架构没有被删除，但本产品默认不自动安装、不展示其运行状态；用户主动启用后才恢复。

## 第一版能力

- 单击仍是普通桌宠互动；双击在宠物旁打开“问年轮”。
- 独立半透明问答窗口，默认约 `420×560`，可拖动、调整大小，并限制在当前显示器内。
- Enter 发送、Shift+Enter 换行、停止、失败重试、复制、清空、收起、自动滚动和连续追问。
- 安全的基础 Markdown；链接受限，代码和表格横向滚动，不执行原始 HTML。
- 内置 Mock Adapter 与可独立启动的 Mock HTTP/SSE Server。
- 普通 HTTP、SSE、流式失败自动回退、超时、取消、断流、非 JSON、空回答和离线错误。
- 最多保留最近 10 个本地会话；历史损坏时自动降级，不保存内部过程、工具参数或 Token。
- Token 通过 Rust 平台层保存到 macOS Keychain 或 Windows Credential Manager，不进入普通配置文件。

## 共用架构

```text
src/
  NianLunWindow.tsx                共用 React 问答窗口
  services/nianlun/                配置、Adapter、Normalizer、错误与会话
  platform/                        前端薄平台适配
src-tauri/src/
  platform/                        凭据、路径、窗口位置、退出行为
  window_placement.rs              复用 CoPet 窗口与 DPI 逻辑
examples/mock-nianlun-server/      独立 HTTP/SSE Mock Server
.github/workflows/build-desktop.yml
```

问答、会话、宠物状态和配置全部共用；只有系统能力放在少量平台适配代码中。

## 安全边界

客户端发送的 `super_readonly` 只是请求声明，不能当作真实权限。正式版必须由年轮服务端完成身份认证、数据范围控制、只读校验和工具权限判断，并拒绝 SQL、写入和后台管理操作。第一版只用于可信测试环境。

不得提交真实 Token、生产地址、内网地址或签名证书。Token 不进入日志、错误提示、截图、普通配置和会话历史。

## 年轮连接配置

本地用户设置优先于环境变量，环境变量优先于开发默认值。

```dotenv
NIANLUN_AGENT_BASE_URL=http://localhost:8000
NIANLUN_AGENT_CHAT_PATH=/api/agent/chat
NIANLUN_AGENT_HEALTH_PATH=/api/health
```

在 **设置 > 年轮连接** 中配置后台地址、接口路径、流式响应、超时、内置 Mock、本地历史和可选访问 Token。代码中不硬编码生产后台地址。

## macOS

### 环境准备

- Apple Silicon 优先，同时保留 Intel 源码兼容。
- 安装 Xcode Command Line Tools：`xcode-select --install`。
- 安装 Node.js 22、pnpm 10.28 和 Rust stable。

```bash
corepack enable
corepack prepare pnpm@10.28.0 --activate
rustup toolchain install stable
pnpm install
pnpm exec playwright install chromium
```

### 开发启动

```bash
pnpm tauri:dev
```

要验证真实 HTTP 链路，先启动独立 Mock Server：

```bash
pnpm mock:nianlun
```

然后在设置中关闭“使用内置 Mock 模式”，后台地址保持 `http://localhost:8000`。

### 测试命令

```bash
pnpm typecheck
pnpm lint
pnpm test:frontend
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

### 生产构建

```bash
pnpm tauri:build
```

DMG 位于 `src-tauri/target/release/bundle/dmg/`，`.app` 位于 `src-tauri/target/release/bundle/macos/`。

### 安装方法

打开 DMG，将应用拖入“应用程序”。第一版未签名包可能出现 macOS 安全提示。在可信测试环境中，核对源码和产物后可右键应用选择“打开”，或到“系统设置 > 隐私与安全性”选择“仍要打开”。正式发布必须配置 Developer ID、Hardened Runtime、Apple 公证和对应 CI 密钥。

### macOS 常见问题

- 宠物空白：确认内置宠物资源存在，然后重新启动开发模式。
- 后台离线：启用内置 Mock，或启动 `pnpm mock:nianlun` 后点击“测试连接”。
- Token 无法保存：确认登录钥匙串已解锁。
- Intel 安装包：正式发布前需要 Intel runner 或增加 x86_64 target 并生成 Universal 包。

## Windows 10 / Windows 11 x64

### 环境准备

- Windows 10/11 x64 与最新 WebView2 Runtime。
- Visual Studio 2022 Build Tools，勾选“使用 C++ 的桌面开发”和 Windows SDK。
- Node.js 22、pnpm 10.28、Rust stable MSVC。

```powershell
corepack enable
corepack prepare pnpm@10.28.0 --activate
rustup default stable-msvc
rustup target add x86_64-pc-windows-msvc
pnpm install
pnpm exec playwright install chromium
```

### 开发启动

```powershell
pnpm tauri:dev
```

### 测试命令

```powershell
pnpm typecheck
pnpm lint
pnpm test:frontend
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

### 生产构建

```powershell
pnpm tauri:build
```

NSIS 安装程序位于 `src-tauri\target\release\bundle\nsis\`；启用 MSI target 后也可生成 MSI。

### 安装方法

运行生成的安装程序。未签名测试包可能触发 Windows SmartScreen。在可信测试环境中，核对产物后选择“更多信息 > 仍要运行”。正式发布需要 Authenticode 代码签名证书、可信时间戳和受保护的 CI 签名密钥；建议使用 EV 证书积累信誉。

### Windows 常见问题

- 窗口空白或不出现：安装或更新 Microsoft Edge WebView2 Runtime。
- 链接/编译错误：补装 MSVC C++ 工作负载与 Windows SDK，并重新打开终端。
- 125%/150% DPI 模糊：保持 Windows 每显示器缩放开启，并记录显示器布局和 DPI 反馈。
- 退出后仍有进程：使用托盘“退出程序”，不要只隐藏宠物。
- SmartScreen 警告：未签名测试包属于预期；正式包必须签名。

## 独立 Mock Server

```bash
pnpm mock:nianlun
```

- `GET http://localhost:8000/api/health`
- `POST http://localhost:8000/api/agent/chat`
- 请求头添加 `Accept: text/event-stream` 可验证 SSE。

Mock 回答始终明确标注“模拟数据”，支持第一版五类问题和同一会话追问，不连接数据库。

## GitHub Actions

`.github/workflows/build-desktop.yml` 包含真实 macOS 与 Windows x64 构建任务：安装 Node、pnpm、Rust，执行类型检查、Lint、前端测试、Rust fmt/clippy/测试、Tauri 生产构建，并上传 DMG/app 或 NSIS/MSI 产物。

第一版允许上传未签名安装包。正式发布时必须在 GitHub Secrets 中增加签名材料并完善 Tauri 签名配置，禁止把证书和密码写入仓库。

## 开源说明

本项目是 CoPet 的二次开发，继续保留上游署名、许可证和宠物资源约束。
