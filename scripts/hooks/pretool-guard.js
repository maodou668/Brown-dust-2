#!/usr/bin/env node
// ============================================================
//  pretool-guard.js —— PreToolUse 硬防线（harness 在每次工具调用前强制执行，
//  与模型记性无关）。stdin 收 {tool_name, tool_input} JSON；
//  违规 → 输出 permissionDecision:"deny" + 原因，调用被直接拦截。
//  规则来源：本项目血泪教训（每条都对应一次真实返工）。
//  配套注册：.claude/settings.json > hooks > PreToolUse（随仓库提交，新会话自动生效）。
// ============================================================
const { execSync } = require('child_process');

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

let raw = '';
try { raw = require('fs').readFileSync(0, 'utf8'); } catch (e) { process.exit(0); }
let input = {};
try { input = JSON.parse(raw || '{}'); } catch (e) { process.exit(0); }
const tool = input.tool_name || '';
const ti = input.tool_input || {};

// ── 规则1：动画禁用模板，一律 v3 ───────────────────────────────
// 教训：walking/breathing-idle 模板在背向掉身份(画成别的角色)、侧向长辫子+串配色
// (Olstein·圣盾 2026-07 连环返工)。v3 锚定角色自己的旋转图，从没出过事。
if (tool === 'mcp__pixellab__animate_character') {
  if (ti.template_animation_id) {
    deny('🚫铁律：动画禁用 template_animation_id（模板会掉身份/长辫子/串色，Olstein·圣盾返工教训）。' +
      '一律 mode="v3" + action_description；idle 用 v3 真呼吸(锁脚提示词)。见说明书·美术 A.3。');
  }
  if (ti.mode === 'template' || ti.mode === 'pro') {
    deny('🚫铁律：animate_character 只许 mode="v3"（template 掉身份；pro 未经用户确认成本）。');
  }
}

// ── 规则5：立绘/半身像禁「正面证件照」——描述必须显式带角度 ─────────
// 教训：2026-07 三套服装半身像里两套出成正面证件照返工（姿势由 description 文字
// 驱动，不写角度词默认正对镜头）。硬性三件套见说明书·美术 §F：身份 + 角度 + 性格 pose。
if (tool === 'mcp__pixellab__create_1_direction_object') {
  const d = String(ti.description || '');
  if (/portrait|bust|half[- ]body|头像|半身/i.test(d)
    && !/three[- ]quarter|3\/4|turned|angled|side view|profile|looking (to|over|aside|into)/i.test(d)) {
    deny('🚫闸门：半身像/立绘的 description 缺角度措辞（three-quarter / head turned / angled…）。' +
      '正面证件照死板禁用——必须带角度 + 按角色性格配 pose。见说明书·美术 §F 硬性三件套。');
  }
}

if (tool === 'Bash') {
  const cmd = String(ti.command || '');

  // ── 规则2：禁止绕过数值闸门（限定"真的在调 build 且带该旗"，避免误伤写文档提到这个词）──
  if (/build\.js[^\n]*--no-validate|--no-validate[^\n]*build\.js/.test(cmd)) {
    deny('🚫铁律：禁止用 --no-validate 绕过数值闸门。先让 balance-validate 过再构建。');
  }

  // ── 规则3：美术 field 变更未过 artgate 禁止 push ───────────────
  // 机制：artgate PASS 时会在该 field 目录写 .artgate_pass 戳；push 范围里若有
  // 某 field 目录的 png 变更，同范围必须也包含该目录的 .artgate_pass 变更
  // （= 改完美术后重新跑过闸门并把戳一起提交）。基于 git 内容，不怕 mtime/回滚。
  if (/\bgit\s+push\b/.test(cmd)) {
    try {
      const fake = process.env.GUARD_FAKE_CHANGED;
      const changed = (fake != null ? fake
        : execSync('git diff --name-only @{u}..HEAD 2>/dev/null || true', { encoding: 'utf8', cwd: process.cwd() })
      ).split('\n').filter(Boolean);
      const dirs = new Set();
      for (const f of changed) {
        const m = f.match(/^(art\/05_pixellab\/[^/]+_field)\/.*\.png$/);
        if (m && !/\/_artgate_/.test(f)) dirs.add(m[1]);
      }
      const missing = [...dirs].filter(d => !changed.includes(d + '/.artgate_pass'));
      if (missing.length) {
        deny('🚫闸门：以下 field 美术有变更但未重跑 artgate（缺同批次的 .artgate_pass 戳）：\n' +
          missing.join('\n') +
          '\n先 `node scripts/artgate.js <char>` 过闸（PASS 会写戳），git add 该目录后再 push。');
      }
      // ── 规则4：守卫规则变更必须同步进说明书第 0 章（内嵌的可移植副本）──────
      // 防"守卫在长大、可移植启动章停在旧版"。同步命令：node scripts/make-bootstrap.js
      if (changed.includes('scripts/hooks/pretool-guard.js')
        && require('fs').existsSync('dev/游戏开发说明书.md')
        && !changed.some(f => /游戏开发说明书\.md$/.test(f))) {
        deny('🚫同步闸门：守卫规则变了但说明书第 0 章（内嵌副本）没同步。\n' +
          '跑 `node scripts/make-bootstrap.js` 再 git add dev/游戏开发说明书.md 后 push。');
      }
    } catch (e) { /* git 不可用等情况放行，不误伤 */ }
  }
}

process.exit(0);
