#!/usr/bin/env bash
set -euo pipefail

REMOTE=origin
MAIN=main
TARGET=dev
REBASE=false
FORCE=false
DRY_RUN=false

usage() {
  cat <<EOF
Usage: $0 [--rebase] [--force] [--dry-run] [--remote <name>] [--main <branch>] [--target <branch>]

Options:
  --rebase        Use rebase (git rebase main) instead of merge
  --force         When rebase is used and push required, force push with --force-with-lease
  --dry-run       Show commands but don't execute
  --remote NAME   Git remote (default: origin)
  --main BRANCH   Main branch name (default: main)
  --target BRANCH Target branch to update (default: build)
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
    --rebase) REBASE=true; shift ;;
    --force) FORCE=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --remote) REMOTE="$2"; shift 2 ;;
    --main) MAIN="$2"; shift 2 ;;
    --target) TARGET="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

echo "REMOTE=$REMOTE, MAIN=$MAIN, TARGET=$TARGET, REBASE=$REBASE, FORCE=$FORCE, DRY_RUN=$DRY_RUN"

# fetch updates
run git fetch "$REMOTE"

# ensure local MAIN exists and is up-to-date
if git show-ref --verify --quiet "refs/heads/$MAIN"; then
  run git checkout "$MAIN"
  run git pull "$REMOTE" "$MAIN"
else
  # try to create local main from remote
  if git ls-remote --exit-code --heads "$REMOTE" "$MAIN" >/dev/null 2>&1; then
    run git checkout -b "$MAIN" "$REMOTE/$MAIN"
  else
    echo "Remote branch $REMOTE/$MAIN not found" >&2
    exit 3
  fi
fi

# prepare TARGET branch: checkout existing local, or track remote, or create from MAIN
if git show-ref --verify --quiet "refs/heads/$TARGET"; then
  run git checkout "$TARGET"
else
  if git ls-remote --exit-code --heads "$REMOTE" "$TARGET" >/dev/null 2>&1; then
    run git checkout -b "$TARGET" "$REMOTE/$TARGET"
  else
    echo "Creating local $TARGET from remote $REMOTE/$MAIN"
    run git checkout -b "$TARGET" "$REMOTE/$MAIN"
  fi
fi

# perform merge or rebase
if [ "$REBASE" = true ]; then
  echo "Rebasing $TARGET onto $MAIN"
  if [ "$DRY_RUN" = false ]; then
    set +e
    git rebase "$REMOTE/$MAIN"
    rc=$?
    set -e
    if [ $rc -ne 0 ]; then
      echo "Rebase failed. Resolve conflicts, then run 'git rebase --continue' or abort with 'git rebase --abort'" >&2
      exit $rc
    fi
  else
    echo "DRY RUN: git rebase $MAIN"
  fi
else
  echo "Merging $MAIN into $TARGET"
  if [ "$DRY_RUN" = false ]; then
    set +e
    git merge --no-edit "$REMOTE/$MAIN"
    rc=$?
    set -e
    if [ $rc -ne 0 ]; then
      echo "Merge reported conflicts or failed (exit $rc). Resolve conflicts, then 'git add' and 'git commit' to finish the merge." >&2
      exit $rc
    fi
  else
    echo "DRY RUN: git merge --no-edit $MAIN"
  fi
fi

# push changes
if [ "$DRY_RUN" = false ]; then
  if [ "$REBASE" = true ] && [ "$FORCE" = true ]; then
    echo "Pushing with --force-with-lease"
    git push --force-with-lease "$REMOTE" "$TARGET"
  else
    git push "$REMOTE" "$TARGET"
  fi

  # after successful push, switch back to MAIN
  echo "Switching back to $MAIN"
  run git checkout "$MAIN"
else
  echo "DRY RUN: Would push $TARGET to $REMOTE"
  echo "DRY RUN: git checkout $MAIN"
fi
# push changes and create a PR from TARGET -> MAIN using gh CLI
if [ "$DRY_RUN" = false ]; then
  if [ "$REBASE" = true ] && [ "$FORCE" = true ]; then
    echo "Pushing with --force-with-lease"
    git push --force-with-lease "$REMOTE" "$TARGET"
  else
    git push "$REMOTE" "$TARGET"
  fi

  # attempt to create a PR from TARGET to MAIN using gh (if available)
  if command -v gh >/dev/null 2>&1; then
    set +e
    pr_number=$(gh pr list --head "$TARGET" --base "$MAIN" --json number --jq '.[0].number' 2>/dev/null || true)
    set -e
    if [ -z "$pr_number" ]; then
      echo "Creating PR: $TARGET -> $MAIN"
      gh pr create --head "$TARGET" --base "$MAIN" --title "Merge $TARGET into $MAIN" --body "Automated PR from $TARGET to $MAIN"
    else
      echo "PR already exists: #$pr_number"
    fi
  else
    echo "gh CLI not found; skipping PR creation" >&2
  fi

  # after push/PR, switch back to MAIN
  echo "Switching back to $MAIN"
  run git checkout "$MAIN"
else
  echo "DRY RUN: Would push $TARGET to $REMOTE"
  echo "DRY RUN: gh pr create --head $TARGET --base $MAIN --title 'Merge $TARGET into $MAIN' --body 'Automated PR from $TARGET to $MAIN'"
  echo "DRY RUN: git checkout $MAIN"
fi

echo "Done. If there were conflicts, resolve them locally and push when ready."
