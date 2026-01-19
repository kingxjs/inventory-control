#!/usr/bin/env bash
# 生成自签名 PFX 并输出 Base64，可选上传为 GitHub Secrets
# 使用环境：macOS / Linux
# 作者：Copilot（脚本注释为中文）

set -euo pipefail

# 默认参数
OUT_PFX="cert.pfx"
OUT_BASE64="cert.pfx.base64"
KEY="key.pem"
CRT="cert.pem"
OUT_DIR=".secrets"
PASSWORD=""
SUBJ="/CN=Inventory Control (Self-Signed)"
DAYS=365
UPLOAD_TO_GITHUB=false
GITHUB_REPO="" # 格式 owner/repo

usage() {
  cat <<EOF
用法: $0 [--password <pfx-password>] [--out <cert.pfx>] [--subject <openssl-subj>] [--days <days>] [--upload <owner/repo>]

示例：
  # 交互式生成自签名并产生 Base64 文件
  $0 --password mypass

  # 生成并自动上传到 GitHub Secrets（需要 gh 已登录且有权限）
  $0 --password mypass --upload myuser/myrepo

注意：脚本不会在控制台输出敏感内容，上传前会检查 gh 命令。
EOF
}

# 解析参数
while [[ $# -gt 0 ]]; do
  case "$1" in
    --password|-p)
      PASSWORD="$2"; shift 2;;
    --out)
      OUT_PFX="$2"; shift 2;;
    --out-dir)
      OUT_DIR="$2"; shift 2;;
    --subject)
      SUBJ="$2"; shift 2;;
    --days)
      DAYS="$2"; shift 2;;
    --upload)
      UPLOAD_TO_GITHUB=true; GITHUB_REPO="$2"; shift 2;;
    --help|-h)
      usage; exit 0;;
    *)
      echo "未知参数: $1" >&2; usage; exit 2;;
  esac
done

if [ -z "$PASSWORD" ]; then
  echo "请输入 PFX 密码（建议使用强密码），或使用 --password 参数传入。" >&2
  exit 1
fi

# 清理函数
cleanup() {
  # 清理临时生成的私钥与证书文件（PFX 与 Base64 默认保留在 OUT_DIR）
  rm -f "${OUT_DIR}/${KEY}" "${OUT_DIR}/${CRT}"
}
trap cleanup EXIT

echo "生成私钥和自签名证书..."
mkdir -p "$OUT_DIR"

# 将临时私钥与证书放到输出目录下
KEY_PATH="$OUT_DIR/$KEY"
CRT_PATH="$OUT_DIR/$CRT"
OUT_PFX_PATH="$OUT_DIR/$OUT_PFX"
OUT_BASE64_PATH="$OUT_DIR/$OUT_BASE64"

openssl req -x509 -newkey rsa:2048 -nodes -keyout "$KEY_PATH" -out "$CRT_PATH" -days "$DAYS" -subj "$SUBJ"

echo "导出为 PFX -> ${OUT_PFX_PATH} ..."
openssl pkcs12 -export -out "$OUT_PFX_PATH" -inkey "$KEY_PATH" -in "$CRT_PATH" -passout pass:"$PASSWORD"

echo "生成单行 Base64 -> ${OUT_BASE64_PATH} ..."
# 使用 openssl base64 -A 保证单行
if openssl base64 -A -in "$OUT_PFX_PATH" -out "$OUT_BASE64_PATH" 2>/dev/null; then
  :
else
  # 兼容没有 -A 的系统（降级到 tr）
  base64 "$OUT_PFX_PATH" | tr -d '\n' > "$OUT_BASE64_PATH"
fi

echo "生成完成："
echo "  PFX 文件: ${OUT_PFX_PATH}"
echo "  Base64 文件: ${OUT_BASE64_PATH}"

if [ "$UPLOAD_TO_GITHUB" = true ]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "错误：未找到 gh CLI，无法上传 Secrets。请安装并通过 'gh auth login' 登录。" >&2
    exit 3
  fi
  if [ -z "$GITHUB_REPO" ]; then
    echo "错误：未指定 GitHub 仓库（owner/repo）。" >&2
    exit 4
  fi

  echo "开始上传到 GitHub Secrets 到仓库 ${GITHUB_REPO}（不会在控制台输出密文）..."
  # 设置 WINDOWS_SIGNING_PFX
  gh secret set WINDOWS_SIGNING_PFX --repo "$GITHUB_REPO" --body "$(cat "$OUT_BASE64_PATH")"
  # 设置 WINDOWS_SIGNING_PASSWORD
  gh secret set WINDOWS_SIGNING_PASSWORD --repo "$GITHUB_REPO" --body "$PASSWORD"
  echo "上传完成。请在 GitHub 仓库设置中确认 Secrets 已创建。"
fi

# 温馨提示
cat <<EOF
操作建议：
- 请把 ${OUT_PFX_PATH} 与 ${OUT_BASE64_PATH} 安全存储或删除（不要提交到仓库）。
- CI 中只需使用 ${OUT_BASE64_PATH} 的值写入 Secret，无需上传 PFX 文件本身。
- 若上传到 GitHub，脚本使用 gh CLI（需登录并有 repo 权限）。
EOF

exit 0
