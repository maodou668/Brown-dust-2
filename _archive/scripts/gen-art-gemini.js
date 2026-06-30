#!/usr/bin/env node
/**
 * 角色/场景美术生成 —— Google Nano Banana Pro (Gemini 3 Pro Image)
 *   断层领先画质 + 角色一致性（参考图锁定同一角色的脸/设定）。
 *
 * 用法：
 *   GEMINI_API_KEY=xxx node scripts/gen-art-gemini.js [idFilter]
 *   FORCE=1 覆盖已存在文件
 *
 * 流程：
 *   1) 每个角色先出一张「定妆立绘」(master) → assets/art/<id>.png
 *   2) 之后服装/表情/场景变体，把 master 作为参考图传入 → 保持同一角色一致
 *      (REF=assets/art/<id>.png 时自动附参考图)
 *
 * 安全：API key 仅从环境变量读取，绝不写入文件 / 仓库。
 */
const fs = require('fs'), path = require('path'), https = require('https');
const ROOT = path.resolve(__dirname, '..');
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('✗ 缺少 GEMINI_API_KEY'); process.exit(1); }
const MODEL = process.env.GEMINI_MODEL || 'gemini-3-pro-image'; // Nano Banana Pro
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json'), 'utf8'));
const idFilter = process.argv[2] || '';

// —— 统一画风（BD2 风动漫 gacha 立绘，非像素）——
const STYLE = 'high quality anime gacha character illustration, BD2 style, clean crisp lineart, soft cel shading, vibrant but limited palette, dramatic soft lighting, full body, standing, facing front, isolated on plain flat light-gray background, masterpiece, highly detailed';
const NEG = 'avoid: pixel art, low resolution, chibi, deformed, extra limbs, bad hands, blurry, messy, watermark, text';

function gen(prompt, refImages) {
  const parts = [{ text: prompt + '. ' + NEG }];
  for (const b64 of (refImages || [])) parts.push({ inline_data: { mime_type: 'image/png', data: b64 } });
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], responseFormat: { image: { aspectRatio: '2:3', imageSize: '2K' } } },
  });
  return new Promise((res, rej) => {
    const r = https.request(`https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY, 'Content-Length': Buffer.byteLength(body) }, timeout: 120000 },
      x => { let b = ''; x.on('data', c => b += c); x.on('end', () => res({ s: x.statusCode, b })); });
    r.on('timeout', () => { r.destroy(); rej(new Error('timeout')); });
    r.on('error', rej); r.write(body); r.end();
  });
}
function extractImage(resp) {
  const j = JSON.parse(resp.b);
  const parts = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts || [];
  for (const p of parts) { const d = p.inline_data || p.inlineData; if (d && d.data) return d.data; }
  return null;
}
const sleep = ms => new Promise(s => setTimeout(s, ms));

async function main() {
  const list = manifest.assets.filter(a => a.type === 'character' && (!idFilter || a.id.includes(idFilter)));
  console.log(`Nano Banana Pro 生成 ${list.length} 角色立绘（model=${MODEL}）\n`);
  fs.mkdirSync(path.join(ROOT, 'assets/art'), { recursive: true });
  let ok = 0, fail = 0;
  for (const a of list) {
    const out = path.join(ROOT, 'assets/art', a.id + '.png');
    if (fs.existsSync(out) && !process.env.FORCE) { console.log(`· 跳过 ${a.id}`); continue; }
    try {
      const r = await gen(`${a.prompt}. ${STYLE}`);
      if (r.s !== 200) { console.log(`✗ ${a.id} HTTP ${r.s} ${r.b.slice(0, 160)}`); fail++; await sleep(800); continue; }
      const img = extractImage(r);
      if (!img) { console.log(`✗ ${a.id} 无图像（${r.b.slice(0, 160)}）`); fail++; continue; }
      fs.writeFileSync(out, Buffer.from(img, 'base64'));
      console.log(`✓ ${a.id} → assets/art/${a.id}.png`);
      ok++;
    } catch (e) { console.log(`✗ ${a.id} ${e.message}`); fail++; }
    await sleep(800);
  }
  console.log(`\n完成：成功 ${ok} · 失败 ${fail}`);
}
main();
