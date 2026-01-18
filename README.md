 # 出入库管理 — 开发与发布说明

 本仓库为桌面客户端（Tauri + React + TypeScript）。此文档覆盖本地开发、构建与在 GitHub Actions 上为 Windows 生成安装器（NSIS/.exe 和 WiX/.msi）的流程。

 目录概览
 - 源码：`app/`
 - Tauri 原生层：`src-tauri/`
 - Windows 打包 workflow：`.github/workflows/tauri-windows-build.yml`

 快速开始（本机开发）

 1. 安装依赖：

 ```bash
 pnpm install
 ```

 2. 开发模式（前端 + Tauri）：

 ```bash
 pnpm dev         # 或 pnpm tauri dev（项目配置会先运行前端 dev）
 ```

 3. 生产构建（生成前端静态资源并构建本机包）

 ```bash
 pnpm build
 pnpm tauri build
 ```

 注意：`tauri build` 会根据 `src-tauri/tauri.conf.json` 的 `build.frontendDist` 查找前端产物，若出现 "Unable to find your web assets" 错误，请先确认 `pnpm build` 成功并且输出目录与配置一致。

 在 Windows 本机生成安装器（方法3，推荐在 Windows 环境执行）

 先决条件（Windows）
 - Node.js + pnpm
 - Visual Studio Build Tools（含 MSVC）或等价的 MSVC toolchain
 - Rust + MSVC target (`rustup target add x86_64-pc-windows-msvc`)
 - NSIS（生成 `.exe`）或 WiX Toolset（生成 `.msi`）

 命令：

 ```powershell
 pnpm install
 pnpm build
 # 生成 NSIS .exe
 pnpm tauri build --target nsis
 # 生成 MSI（需 WiX）
 pnpm tauri build --target msi
 ```

 产物位置
 - macOS: `src-tauri/target/release/bundle/macos/`
 - Windows: `src-tauri/target/release/bundle/windows/`

 在 GitHub Actions 上生成 Windows 安装器（已集成）

 仓库已包含 workflow：`.github/workflows/tauri-windows-build.yml`，功能如下：
 - 在 `windows-latest` runner 上安装 Node、pnpm、Rust、WiX、NSIS
 - 构建前端并执行 `pnpm tauri build --target nsis` 与 `--target msi`
 - 上传构建产物为 workflow artifacts
 - 可选：使用仓库 Secrets 自动签名并创建 GitHub Release（需要添加 `WINDOWS_SIGNING_PFX` 与 `WINDOWS_SIGNING_PASSWORD`）

 发布与签名（CI）
 - 若需要签名：在 GitHub 仓库设置 Secrets：
	 - `WINDOWS_SIGNING_PFX`：Base64 编码的 PFX 内容
	 - `WINDOWS_SIGNING_PASSWORD`：PFX 密码
 - Workflow 会在存在以上 Secrets 时解码证书并使用 `signtool` 对 `.exe`/`.msi` 签名，然后创建 Release 并上传安装器。

 图标与应用名
 - 图标位于：`src-tauri/icons/`（占位 `icon.svg`，可从该 SVG 生成 `icon.ico` / `icon.icns`，文档见 `docs/icons.md`）
 - 应用显示名由 `src-tauri/tauri.conf.json` 的 `productName` 控制（已设为 `出入库管理`）。生成的 `.app` / 安装器会显示该名称；可执行文件名由 `src-tauri/Cargo.toml` 的 `package.name` 决定。

 常见问题排查
 - "Unable to find your web assets": 先运行 `pnpm build`，确认前端输出目录与 `tauri.conf.json` 中的 `frontendDist` 一致。
 - Windows 打包失败：请在 Windows runner 上运行（缺少 WiX/NSIS 或 MSVC 会导致失败）。

 联系我们
 - 如需我代为触发 CI、添加签名证书，或在本地运行构建并贴日志，请回复要我执行的动作。

 ---
 简短更新记录：将应用名改为 `出入库管理`，已添加 Windows CI workflow 并提供签名/Release 步骤。
