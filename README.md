# NianLun Desktop Pet

NianLun Desktop Pet (年轮经营桌宠) is a cross-platform business Q&A desktop pet built directly on [CoPet](https://github.com/ChanceYu/CoPet). It remains an interactive always-on-top pet, while a double-click opens a compact desktop Q&A window for the NianLun business agent.

The same React and Tauri codebase supports macOS (Apple Silicon first, Intel-compatible source/build configuration) and Windows 10/11 x64. There is no duplicated business implementation per operating system.

[中文说明](README.zh.md) | [Agent integration protocol](docs/nianlun-agent-integration.md) | [V1 checklist](docs/nianlun-v1-checklist.md)

## What is retained from CoPet

- Transparent, borderless desktop pet window and existing pet assets.
- Pet selection, sprite animation, click reactions, dragging, and always-on-top behavior.
- Native context menu, system tray, settings center, local configuration, error handling, and Windows bundling.
- Existing optional Codex, Claude Code, Cursor, and related Agent Hooks. They are not removed, but automatic installation and runtime display are disabled by default for this product.

## NianLun V1

- Single-click keeps the ordinary pet interaction; double-click opens `问年轮` beside the pet.
- Independent translucent `420 x 560` Q&A window, resizable and clamped to the active monitor.
- Enter to send, Shift+Enter for a new line, stop, retry, copy, clear, collapse, auto-scroll, and continuing questions.
- Safe basic Markdown rendering with constrained links, scrollable code blocks/tables, and no raw HTML injection.
- Built-in Mock Adapter and a separately runnable Mock HTTP/SSE server.
- Ordinary HTTP and SSE, automatic stream-to-HTTP fallback, timeout, cancellation, malformed response handling, and offline errors.
- Local conversation history, limited to the latest 10 conversations and resilient to corrupted storage.
- Access tokens stored in macOS Keychain or Windows Credential Manager through the Rust platform layer, never in conversation history or the normal config file.

## Shared architecture

```text
src/
  NianLunWindow.tsx                shared React Q&A window
  services/nianlun/                config, adapters, normalizer, errors, sessions
  platform/                        thin frontend platform facade
src-tauri/src/
  platform/                        credentials, paths, window placement, lifecycle
  window_placement.rs              retained CoPet pet-window/DPI behavior
examples/mock-nianlun-server/      standalone HTTP/SSE compatibility server
.github/workflows/build-desktop.yml
```

All Q&A, session, pet feedback, and configuration logic is shared. Platform-specific code is intentionally limited to system integration.

## Security boundary

Requests declare `super_readonly`, but this client value is not an authorization boundary. The NianLun server must authenticate the caller, enforce read-only access and data scope, validate every tool action, and reject SQL or write operations. V1 is intended for a trusted test environment.

Never commit a real token, private URL, certificate, or internal host. Tokens are omitted from logs, errors, screenshots, config JSON, and local history.

## Configuration

Copy `.env.example` only when environment defaults are useful. User settings in the Settings Center take precedence over environment variables, which take precedence over development defaults.

```dotenv
NIANLUN_AGENT_BASE_URL=http://localhost:8000
NIANLUN_AGENT_CHAT_PATH=/api/agent/chat
NIANLUN_AGENT_HEALTH_PATH=/api/health
```

Open **Settings > NianLun Connection** to configure the URL, paths, streaming, timeout, built-in Mock mode, history, and optional access token. Production endpoints are not hard-coded.

## macOS

### Prerequisites

- macOS on Apple Silicon or Intel.
- Xcode Command Line Tools: `xcode-select --install`.
- Node.js 22, pnpm 10.28, and the stable Rust toolchain.
- WebKit is provided by macOS.

```bash
corepack enable
corepack prepare pnpm@10.28.0 --activate
rustup toolchain install stable
pnpm install
pnpm exec playwright install chromium
```

### Development

```bash
pnpm tauri:dev
```

To exercise the real HTTP path instead of the built-in adapter:

```bash
pnpm mock:nianlun
```

Then disable built-in Mock mode in Settings and test `http://localhost:8000`.

### Tests

```bash
pnpm typecheck
pnpm lint
pnpm test:frontend
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

### Production build

```bash
pnpm tauri:build
```

The DMG is generated below `src-tauri/target/release/bundle/dmg/`; the `.app` is below `src-tauri/target/release/bundle/macos/`.

### Installing an unsigned test build

Open the DMG and drag the app to Applications. An unsigned first build may show a macOS security warning. In a trusted test environment, right-click the app and choose **Open**, or use **System Settings > Privacy & Security > Open Anyway** after reviewing the source and artifact. Formal releases require Developer ID signing, hardened runtime entitlements, and Apple notarization.

### macOS troubleshooting

- Blank pet: confirm bundled assets exist and restart `pnpm tauri:dev`.
- Agent appears offline: enable built-in Mock mode or start `pnpm mock:nianlun`, then use **Test Connection**.
- Token cannot be saved: unlock the login Keychain and retry.
- Intel delivery: build on an Intel runner or add an x86_64 target and produce a universal binary before release.

## Windows 10/11 x64

### Prerequisites

- Windows 10 or Windows 11 x64 with current WebView2 Runtime.
- Visual Studio 2022 Build Tools with **Desktop development with C++** and Windows SDK.
- Node.js 22, pnpm 10.28, and stable Rust MSVC (`x86_64-pc-windows-msvc`).

```powershell
corepack enable
corepack prepare pnpm@10.28.0 --activate
rustup default stable-msvc
rustup target add x86_64-pc-windows-msvc
pnpm install
pnpm exec playwright install chromium
```

### Development

```powershell
pnpm tauri:dev
```

### Tests

```powershell
pnpm typecheck
pnpm lint
pnpm test:frontend
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

### Production build

```powershell
pnpm tauri:build
```

The NSIS installer is generated below `src-tauri\target\release\bundle\nsis\`. Tauri may also generate MSI output when that target is enabled.

### Installing an unsigned test build

Run the generated installer. Windows SmartScreen can warn about an unsigned first build. In a trusted test environment, verify the artifact source, select **More info**, then **Run anyway**. Formal releases require an Authenticode code-signing certificate (preferably EV for reputation), timestamping, and protected CI signing secrets.

### Windows troubleshooting

- Blank or missing window: install/update Microsoft Edge WebView2 Runtime.
- Build-link errors: add the MSVC C++ workload and Windows SDK, then open a new terminal.
- Blurry UI at 125%/150% DPI: keep Windows per-monitor scaling enabled and report monitor layout/DPI with the CI version.
- Process remains after exit: use the tray **Exit** action; do not only hide the pet.
- SmartScreen warning: expected only for unsigned test artifacts; production builds must be signed.

## Standalone Mock server

```bash
pnpm mock:nianlun
```

Endpoints:

- `GET http://localhost:8000/api/health`
- `POST http://localhost:8000/api/agent/chat`
- Add `Accept: text/event-stream` to exercise SSE.

It returns clearly marked simulated business data for the five V1 questions and same-conversation follow-ups. It never connects to a database.

## GitHub Actions

`.github/workflows/build-desktop.yml` contains real macOS and Windows x64 jobs. Each job installs Node, pnpm and Rust, runs type checking, lint/front-end tests, Rust fmt/clippy/tests, performs a Tauri production build, and uploads DMG/app or NSIS/MSI artifacts.

Unsigned artifacts are accepted for the first test release. For a formal release, add protected signing secrets and Tauri signing configuration; never place certificates or passwords in the repository.

## License and upstream

This repository is a derivative of CoPet and retains its existing license and attribution. Pet assets and CoPet internals remain subject to the upstream repository's terms.
