# 年轮经营桌宠 V1 任务清单

## 基线审查

- [x] 从 `ChanceYu/CoPet` v0.1.9 建立隔离开发分支。
- [x] 在 Apple Silicon macOS 上安装依赖并实际启动原始 CoPet。
- [x] 确认原有宠物窗口、透明无边框、拖动、点击/双击、托盘、设置中心和本地事件服务可用。
- [x] 记录首次 Cargo Git 拉取需要 `CARGO_NET_GIT_FETCH_WITH_CLI=true`。

## V1 实现

- [x] 产品名称和默认橘猫。
- [x] 独立问答窗口及双击、右键菜单、托盘入口。
- [x] 年轮 Mock、HTTP、SSE 适配层与自动回退。
- [x] 本地会话、取消、重试、安全 Markdown。
- [x] 年轮连接设置与系统安全凭据存储。
- [x] 独立 Mock HTTP Server。
- [x] macOS/Windows 平台窗口与退出适配。
- [x] 跨平台 GitHub Actions 工作流。

## 验收证据

- [ ] 前端类型检查、ESLint 与 Playwright 全量通过。
- [ ] Rust fmt、clippy 与测试全量通过。
- [ ] macOS 开发运行、Mock 闭环和 HTTP 闭环人工验证。
- [ ] macOS 生产构建及 DMG。
- [ ] Windows x64 GitHub Actions 构建及 EXE 上传。
- [ ] 真实 Windows 10/11 桌面人工验收。
