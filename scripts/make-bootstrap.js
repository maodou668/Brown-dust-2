#!/usr/bin/env node
// ============================================================
//  make-bootstrap.js —— 把 scripts/hooks/pretool-guard.js（单一事实源）
//  同步进《游戏开发说明书》第 0 章内嵌的安装脚本副本（GUARD_EOF 标记之间）。
//  守卫规则每次变更后必须跑本命令（pretool-guard R4 会在 push 时强制检查）。
// ============================================================
const fs = require('fs');
const GUARD = 'scripts/hooks/pretool-guard.js';
const DOC = 'dev/游戏开发说明书.md';
const guard = fs.readFileSync(GUARD, 'utf8').trimEnd();
if (/^GUARD_EOF$/m.test(guard)) { console.error('守卫脚本内不许出现整行 GUARD_EOF（heredoc 分隔符冲突）'); process.exit(1); }
const doc = fs.readFileSync(DOC, 'utf8');
const re = /(cat > scripts\/hooks\/pretool-guard\.js <<'GUARD_EOF'\n)[\s\S]*?^GUARD_EOF$/m;
if (!re.test(doc)) { console.error(`没找到同步标记：${DOC} 里应有 cat > ... <<'GUARD_EOF' ... GUARD_EOF 块`); process.exit(1); }
const out = doc.replace(re, (_, a) => a + guard + '\nGUARD_EOF');
fs.writeFileSync(DOC, out);
console.log(`✅ 已同步 ${GUARD}（${guard.split('\n').length} 行）→ ${DOC} 第 0 章内嵌副本`);
