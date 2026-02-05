 # 出入库管理 — 开发与发布说明

本仓库为桌面客户端（Tauri + React + TypeScript）。此文档覆盖本地开发、构建与在 GitHub Actions 上为 Windows 生成安装器（NSIS/.exe 和 WiX/.msi）的流程。

## 目录概览
- 源码：`app/`
- Tauri 原生层：`src-tauri/`
- 自动化脚本：`scripts/`
- Windows 打包 workflow：`.github/workflows/tauri-windows-build.yml`

## 快速开始（本机开发）

### 1. 安装依赖

```bash
pnpm install
```

### 2. 开发模式（前端 + Tauri）

```bash
pnpm dev         # 或 pnpm tauri dev（项目配置会先运行前端 dev）
```

### 3. 生产构建（生成前端静态资源并构建本机包）

```bash
pnpm build
pnpm tauri build
```

**注意**：`tauri build` 会根据 `src-tauri/tauri.conf.json` 的 `build.frontendDist` 查找前端产物，若出现 "Unable to find your web assets" 错误，请先确认 `pnpm build` 成功并且输出目录与配置一致。

## 脚本工具（scripts/）

项目内置了多个自动化脚本，位于 `scripts/` 目录，简化常见开发任务。

### 版本管理（bump-version.js）

使用仓库自带脚本同步更新所有版本字段：

```bash
# 指定版本号
pnpm run bump 1.2.3        # 将所有位置的 version 更新为 1.2.3

# 语义化版本自动递增
pnpm run bump:patch        # 按 patch 递增（0.1.4 -> 0.1.5）
pnpm run bump:minor        # 按 minor 递增（0.1.4 -> 0.2.0）
pnpm run bump:major        # 按 major 递增（0.1.4 -> 1.0.0）

# 或使用通用脚本传递 flag
pnpm run bump -- --patch
pnpm run bump -- --minor
pnpm run bump -- --major
```

脚本会自动更新以下文件中的版本号：
- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

### 变更日志生成（changelog.js）

根据 Git 提交历史生成或更新 `CHANGELOG.md`：

```bash
# 使用 package.json 中的版本号生成变更日志
node scripts/changelog.js

# 指定版本号
node scripts/changelog.js --version 1.2.3

# 指定日期
node scripts/changelog.js --version 1.2.3 --date 2024-01-01

# 指定 Git 标签范围
node scripts/changelog.js --from-tag v1.0.0 --to-ref HEAD

# 仅输出单个版本条目（不合并到 CHANGELOG.md）
node scripts/changelog.js --out-entry entry.md

# 演示模式（不写入文件）
node scripts/changelog.js --dry-run
```

**功能特性**：
- 自动分析 Git 提交历史
- 按类型分组提交（feat、fix、docs、refactor 等）
- 支持增量更新已有 CHANGELOG.md
- 可直接用作 GitHub Release body

### 分支同步（sync-dev-to-main.sh）

自动将开发分支合并到主分支并推送：

```bash
# 将 dev 分支合并到 main
./scripts/sync-dev-to-main.sh

# 自定义分支名称
./scripts/sync-dev-to-main.sh --main master --target develop

# 指定远程仓库名称
./scripts/sync-dev-to-main.sh --remote upstream

# 演示模式（显示命令但不执行）
./scripts/sync-dev-to-main.sh --dry-run

# 查看帮助
./scripts/sync-dev-to-main.sh --help
```

**使用场景**：
- 开发分支完成测试后合并到主分支
- 自动化发布流程中的分支管理
- 多人协作时保持主分支同步

### 代码签名证书生成（generate_pfx_and_set_secrets.sh）

生成自签名 PFX 证书并可选上传到 GitHub Secrets：

```bash
# 仅生成证书到 .secrets 目录
./scripts/generate_pfx_and_set_secrets.sh --password 'YourStrongPassword'

# 指定输出目录
./scripts/generate_pfx_and_set_secrets.sh --password 'YourPass' --out-dir .certs

# 生成并上传到 GitHub Secrets（需要 gh CLI 并已登录）
./scripts/generate_pfx_and_set_secrets.sh --password 'YourPass' --upload owner/repo
```

**安全提示**：
- 脚本输出的 `.secrets` 目录已在 `.gitignore` 中忽略
- 请勿将 PFX 或 Base64 内容提交到代码仓库
- 生产环境建议使用受信任的 CA 颁发的证书
- 上传 Secrets 需要 GitHub 仓库写权限

## 在 Windows 本机生成安装器

### 先决条件（Windows）
- Node.js + pnpm
- Visual Studio Build Tools（含 MSVC）或等价的 MSVC toolchain
- Rust + MSVC target (`rustup target add x86_64-pc-windows-msvc`)
- NSIS（生成 `.exe`）或 WiX Toolset（生成 `.msi`）

### 构建命令

```powershell
pnpm install
pnpm build

# 生成 NSIS .exe
pnpm tauri build --target nsis

# 生成 MSI（需 WiX）
pnpm tauri build --target msi
```

### 产物位置
- macOS: `src-tauri/target/release/bundle/macos/`
- Windows: `src-tauri/target/release/bundle/windows/`

## 在 GitHub Actions 上生成 Windows 安装器

仓库已包含 workflow：`.github/workflows/tauri-windows-build.yml`

### 功能特性
- 在 `windows-latest` runner 上安装 Node、pnpm、Rust、WiX、NSIS
- 构建前端并执行 `pnpm tauri build --target nsis` 与 `--target msi`
- 上传构建产物为 workflow artifacts
- 可选：使用仓库 Secrets 自动签名并创建 GitHub Release

### 发布与签名配置

若需要代码签名，在 GitHub 仓库设置以下 Secrets：

| Secret 名称 | 说明 |
|------------|------|
| `WINDOWS_SIGNING_PFX` | Base64 编码的 PFX 证书内容 |
| `WINDOWS_SIGNING_PASSWORD` | PFX 证书密码 |

Workflow 会在存在以上 Secrets 时自动解码证书并使用 `signtool` 对 `.exe`/`.msi` 签名，然后创建 Release 并上传安装器。

**如何生成签名证书**：参见上方"代码签名证书生成"章节，使用 `scripts/generate_pfx_and_set_secrets.sh` 脚本。

## 图标与应用名

### 应用图标
- 图标位于：`src-tauri/icons/`
- 占位图标：`icon.svg`
- 可从 SVG 生成平台特定图标：`icon.ico`（Windows）/ `icon.icns`（macOS）
- 详细文档：`docs/icons.md`

### 应用名称
- **显示名称**：由 `src-tauri/tauri.conf.json` 的 `productName` 控制（已设为 `出入库管理`）
- **可执行文件名**：由 `src-tauri/Cargo.toml` 的 `package.name` 决定
- 生成的 `.app` / 安装器会显示 `productName`

## 常见问题排查

### "Unable to find your web assets"
先运行 `pnpm build`，确认前端输出目录与 `tauri.conf.json` 中的 `frontendDist` 一致。

### Windows 打包失败
请在 Windows runner 上运行，缺少 WiX/NSIS 或 MSVC 会导致失败。

### 版本号不一致
使用 `pnpm run bump:patch` 等脚本自动同步所有配置文件中的版本号。

### 分支合并冲突
使用 `./scripts/sync-dev-to-main.sh --dry-run` 先预览合并操作。

## 联系我们

如需我代为触发 CI、添加签名证书，或在本地运行构建并贴日志，请回复要我执行的动作。