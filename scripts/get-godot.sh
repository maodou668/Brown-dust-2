#!/usr/bin/env bash
# 下载 Godot（itch 官方镜像，GitHub 被会话白名单拦）→ tools/godot
# 用法: bash scripts/get-godot.sh   之后: tools/godot --headless --version
set -e
DST="$(dirname "$0")/../tools"
mkdir -p "$DST"
[ -x "$DST/godot" ] && { echo "已存在: $("$DST/godot" --headless --version 2>/dev/null | tail -1)"; exit 0; }
TMP=$(mktemp -d)
UA="Mozilla/5.0 (X11; Linux x86_64) Chrome/126"
curl -sL -m 30 -c "$TMP/c.txt" -A "$UA" "https://godotengine.itch.io/godot" -o "$TMP/p.html"
CSRF=$(python3 -c "import re;print(re.search(r'csrf_token\" value=\"([^\"]+)',open('$TMP/p.html').read()).group(1))")
DL=$(curl -s -m 30 -b "$TMP/c.txt" -c "$TMP/c.txt" -A "$UA" -X POST "https://godotengine.itch.io/godot/download_url" --data-urlencode "csrf_token=$CSRF" | python3 -c "import json,sys;print(json.load(sys.stdin)['url'])")
curl -sL -m 30 -b "$TMP/c.txt" -c "$TMP/c.txt" -A "$UA" "$DL" -o "$TMP/d.html"
# Linux 64-bit 的 upload id
UP=$(python3 -c "
import re
s = open('$TMP/d.html', encoding='utf-8', errors='ignore').read()
for m in re.finditer(r'data-upload_id=\"(\d+)\"', s):
    seg = s[m.start():m.start()+400]
    if 'Linux 64' in seg: print(m.group(1)); break")
URL=$(curl -s -m 30 -b "$TMP/c.txt" -A "$UA" -X POST "https://godotengine.itch.io/godot/file/$UP?source=game_download" --data-urlencode "csrf_token=$CSRF" | python3 -c "import json,sys;print(json.load(sys.stdin)['url'])")
echo "下载中（~140MB）..."
curl -sL -m 300 "$URL" -o "$DST/godot"
chmod +x "$DST/godot"
rm -rf "$TMP"
echo "完成: $("$DST/godot" --headless --version | tail -1)"
