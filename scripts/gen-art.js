#!/usr/bin/env node
/**
 * 美术批量生成管线 —— 严格遵循 assets/ART_BIBLE.md
 *
 * 用法：
 *   PIXELLAB_API_KEY=xxxx node scripts/gen-art.js [idFilter]
 *   - 仅生成 manifest 中 id 含 idFilter 的资产（省略则全部）
 *   - 已存在的输出文件自动跳过（断点续传 / 省额度）
 *   - 强制使用母版调色板 color_image + 统一风格参数（防风格漂移）
 *
 * 安全：API key 只从环境变量读取，绝不写入任何文件 / 仓库。
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const KEY = process.env.PIXELLAB_API_KEY;
if (!KEY) { console.error('✗ 缺少环境变量 PIXELLAB_API_KEY'); process.exit(1); }

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json'), 'utf8'));
const style = manifest.style;
const filter = process.argv[2] || '';

const paletteB64 = fs.readFileSync(path.join(ROOT, style.palette)).toString('base64');

function api(endpoint, body) {
  return new Promise((res, rej) => {
    const data = JSON.stringify(body);
    const req = https.request('https://api.pixellab.ai/v2/' + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + KEY,
        'Content-Length': Buffer.byteLength(data),
      },
    }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res({ status: r.statusCode, body: b })); });
    req.on('error', rej);
    req.write(data); req.end();
  });
}

// 简单 hash → 稳定 seed（便于一致地重生成）
function seedOf(id) { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 100000; }

async function genPixflux(a) {
  const body = {
    description: `${a.prompt}, ${style.suffix}`,
    image_size: { width: a.size[0], height: a.size[1] },
    text_guidance_scale: style.text_guidance_scale,
    outline: style.outline,
    shading: style.shading,
    detail: style.detail,
    color_image: { base64: paletteB64 },
    no_background: !!a.transparent,
    seed: seedOf(a.id),
  };
  return api('create-image-pixflux', body);
}

async function main() {
  const list = manifest.assets.filter(a => !filter || a.id.includes(filter));
  console.log(`照 ART_BIBLE 生成 ${list.length} 项（已存在自动跳过）…\n`);
  let done = 0, skip = 0, fail = 0, credits = 0;
  for (const a of list) {
    const out = path.join(ROOT, a.out);
    if (fs.existsSync(out)) { console.log(`· 跳过 ${a.id}（已存在）`); skip++; continue; }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    let ok = false;
    for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
      try {
        const r = await genPixflux(a);
        if (r.status === 200) {
          const j = JSON.parse(r.body);
          const b64 = (j.image && (j.image.base64 || j.image)) || null;
          if (b64) {
            fs.writeFileSync(out, Buffer.from(b64, 'base64'));
            credits += (j.usage && j.usage.generations) || 1;
            console.log(`✓ ${a.id} → ${a.out}`);
            ok = true;
          } else { console.log(`✗ ${a.id} 无图像数据`); }
        } else {
          console.log(`✗ ${a.id} HTTP ${r.status}: ${r.body.slice(0, 160)}${attempt < 2 ? '（重试）' : ''}`);
          await new Promise(s => setTimeout(s, 1500));
        }
      } catch (e) { console.log(`✗ ${a.id} ${e.message}`); }
    }
    ok ? done++ : fail++;
    await new Promise(s => setTimeout(s, 600)); // 轻微限速
  }
  console.log(`\n完成：成功 ${done} · 跳过 ${skip} · 失败 ${fail} · 本次消耗约 ${credits} 次额度`);
}
main();
