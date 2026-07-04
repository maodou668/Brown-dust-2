#!/bin/bash
# 容器重建自动恢复：云容器从旧快照(v178)重建时，把工作区自动恢复到远端分支最新
# 安全护栏：只在 (1)远程环境 (2)工作区干净 (3)本地落后于远端 时才动
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

BR="claude/brown-dust-2-dev-ma6cog"
cd "$CLAUDE_PROJECT_DIR"

git config user.email noreply@anthropic.com
git config user.name Claude

# 带重试的 fetch（网络抖动兜底）
for i in 1 2 3; do
  git fetch origin "$BR" && break || sleep $((i*2))
done

DIRTY=$(git status --porcelain | head -1)
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BR" 2>/dev/null || echo "$LOCAL")

if [ -z "$DIRTY" ] && [ "$LOCAL" != "$REMOTE" ] && git merge-base --is-ancestor "$LOCAL" "$REMOTE"; then
  git checkout -B "$BR" "origin/$BR"
  echo "已自动恢复到远端最新: $(git log --oneline -1)"
else
  echo "无需恢复 (dirty=${DIRTY:+yes} local=$(git log --oneline -1 | cut -c1-30))"
fi
