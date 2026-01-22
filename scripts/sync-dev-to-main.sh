#!/usr/bin/env bash
set -euo pipefail

# 脚本用途：将指定的 TARGET 分支（默认为 dev）合并到 MAIN（默认为 main），
# 并将合并结果推送到远程。脚本支持 --dry-run 用于演示命令而不执行。
# 使用示例：
#   ./scripts/sync-dev-to-main.sh --dry-run --remote origin --main main --target dev

REMOTE=origin
MAIN=main
TARGET=dev
DRY_RUN=false
REBASE=false
FORCE=false

usage() {
  cat <<EOF
Usage: $0 [--dry-run] [--remote <name>] [--main <branch>] [--target <branch>]

Options:
  --dry-run       Show commands but don't execute
  --remote NAME   Git remote (default: origin)
  --main BRANCH   Main branch name (default: main)
  --target BRANCH Target branch to merge into main (default: dev)
  -h, --help      Show this help
EOF
}

run() {
  echo "+ $*"
  if [ "$DRY_RUN" = false ]; then
    eval "$@"
  fi
}

# parse args
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --remote) REMOTE="$2"; shift 2 ;;
    --main) MAIN="$2"; shift 2 ;;
    --target) TARGET="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

echo "REMOTE=$REMOTE, MAIN=$MAIN, TARGET=$TARGET, REBASE=$REBASE, FORCE=$FORCE, DRY_RUN=$DRY_RUN"

# 拉取远程更新以确保分支信息是最新的
run git fetch "$REMOTE"

# 确保本地存在并切换到 MAIN（例如 main），然后从远程拉取最新内容
if git show-ref --verify --quiet "refs/heads/$MAIN"; then
  # 切换到本地 main 并拉取远程更新
  run git checkout "$MAIN"
  run git pull "$REMOTE" "$MAIN"
else
  # 如果本地不存在 main，则尝试从远程创建本地分支
  if git ls-remote --exit-code --heads "$REMOTE" "$MAIN" >/dev/null 2>&1; then
    run git checkout -b "$MAIN" "$REMOTE/$MAIN"
  else
    echo "Remote branch $REMOTE/$MAIN not found" >&2
    exit 3
  fi
fi

# 确保 TARGET（如 dev）存在：优先使用本地分支，否则尝试从远程创建本地分支
if git show-ref --verify --quiet "refs/heads/$TARGET"; then
  echo "Using local branch $TARGET"
else
  if git ls-remote --exit-code --heads "$REMOTE" "$TARGET" >/dev/null 2>&1; then
    echo "Creating local $TARGET from $REMOTE/$TARGET"
    run git checkout -b "$TARGET" "$REMOTE/$TARGET"
    # 创建完本地 TARGET 后切回 MAIN 以便后续合并操作遵循官方步骤
    run git checkout "$MAIN"
  else
    echo "Target branch $TARGET not found locally or on remote" >&2
    exit 4
  fi
fi

# 按官方推荐步骤：在 MAIN 上合并 TARGET
echo "Merging $TARGET into $MAIN"
if [ "$DRY_RUN" = false ]; then
  set +e
  # 如果本地存在 TARGET，则直接合并本地分支；否则合并远程分支
  if git show-ref --verify --quiet "refs/heads/$TARGET"; then
    git merge --no-edit "$TARGET"
  else
    git merge --no-edit "$REMOTE/$TARGET"
  fi
  rc=$?
  set -e
  if [ $rc -ne 0 ]; then
    echo "Merge reported conflicts or failed (exit $rc). Resolve conflicts, then 'git add' and 'git commit' to finish the merge." >&2
    exit $rc
  fi
else
  echo "DRY RUN: git merge --no-edit $TARGET"
fi

# 推送 MAIN 到远程
if [ "$DRY_RUN" = false ]; then
  run git push -u "$REMOTE" "$MAIN"
  # 推送完成后切回 TARGET（dev），恢复开发分支上下文
  echo "切换回 $TARGET"
  run git checkout "$TARGET"
else
  echo "DRY RUN: git push -u $REMOTE $MAIN"
  echo "DRY RUN: git checkout $TARGET"
fi

echo "完成。如果发生冲突，请在本地解决并在解决后推送。"
