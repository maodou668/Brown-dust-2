#!/usr/bin/env node
/**
 * 角色双轨美术生成 —— 遵循 ART_BIBLE + 用户拍板的方案
 *   立绘（精致优先）：pixflux 200x300 + 统一比例规范 → remove-background 抠透明
 *                     → assets/portraits/<id>.png
 *   小人（严格锁比例）：create-character-with-4-directions（异步）+ 固定 proportions
 *                     → 下载 4 方向 → assets/sprites/<id>/{south,north,east,west}.png
 *                     → 正面帧复制为 assets/sprites/<id>.png（战斗用）
 *
 * 用法：PIXELLAB_API_KEY=xxx node scripts/gen-chars.js [idFilter] [portrait|sprite]
 *       FORCE=1 覆盖已存在文件
 * 安全：key 仅从环境变量读取，绝不写入文件。
 */
const fs = require('fs'), path = require('path'), https = require('https');
const ROOT = path.resolve(__dirname, '..');
const KEY = process.env.PIXELLAB_API_KEY;
if (!KEY) { console.error('✗ 缺少 PIXELLAB_API_KEY'); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json'), 'utf8'));
const palette = fs.readFileSync(path.join(ROOT, manifest.style.palette)).toString('base64');
const idFilter = process.argv[2] || '';
const trackFilter = process.argv[3] || '';

// —— 统一规范 ——
const PORTRAIT_PROP = 'tall slender elegant proportions, about 7.5 heads tall, full body head to toe, standing straight, facing front, detailed anime character illustration, gacha splash art, clean dark outline, soft lighting from upper left, limited palette, dark fantasy';
const NEG = 'chibi, super deformed, big head, short body, childish, bent weapon, warped weapon, melted, blurry, cropped, extra limbs, deformed hands';
const PROPORTIONS = { type: 'custom', head_size: 1.45, legs_length: 0.85, arms_length: 0.9, shoulder_width: 0.95 }; // 全角色固定

function req(method, ep, body) {
  return new Promise((res, rej) => {
    const d = body ? JSON.stringify(body) : null;
    const o = { method, headers: { 'Authorization': 'Bearer ' + KEY }, timeout: 90000 };
    if (d) { o.headers['Content-Type'] = 'application/json'; o.headers['Content-Length'] = Buffer.byteLength(d); }
    const r = https.request('https://api.pixellab.ai/v2/' + ep, o, x => { let b = ''; x.on('data', c => b += c); x.on('end', () => res({ s: x.statusCode, b })); });
    r.on('timeout', () => { r.destroy(); rej(new Error('TIMEOUT ' + ep)); });
    r.on('error', rej); if (d) r.write(d); r.end();
  });
}
function dl(url, file) {
  return new Promise((res) => {
    const r = https.get(url, { timeout: 60000 }, x => {
      if (x.statusCode !== 200) { x.resume(); return res(false); }
      const chunks = []; x.on('data', c => chunks.push(c)); x.on('end', () => { fs.writeFileSync(file, Buffer.concat(chunks)); res(true); });
    });
    r.on('timeout', () => { r.destroy(); res(false); });
    r.on('error', () => res(false));
  });
}
const sleep = ms => new Promise(s => setTimeout(s, ms));
function seedOf(id) { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 100000; }
function imgB64(r) { const j = JSON.parse(r.b); return j.image && (j.image.base64 || j.image); }

async function genPortrait(a) {
  const out = path.join(ROOT, 'assets/portraits', a.id + '.png');
  if (fs.existsSync(out) && !process.env.FORCE) { console.log(`· 立绘跳过 ${a.id}`); return; }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // 1) 生成
  let g = await req('POST', 'create-image-pixflux', {
    description: `${a.prompt}, ${PORTRAIT_PROP}`, negative_description: NEG,
    image_size: { width: 200, height: 300 }, color_image: { base64: palette }, no_background: true,
    outline: 'single color black outline', shading: 'medium shading', detail: 'highly detailed',
    text_guidance_scale: 8, seed: seedOf(a.id),
  });
  if (g.s !== 200) { console.log(`✗ 立绘 ${a.id} gen HTTP ${g.s} ${g.b.slice(0, 120)}`); return; }
  let b64 = imgB64(g);
  // 2) 抠透明背景
  let rb = await req('POST', 'remove-background', { image: { base64: b64 }, image_size: { width: 200, height: 300 } });
  if (rb.s === 200) b64 = imgB64(rb); else console.log(`! 立绘 ${a.id} 抠图失败(${rb.s})，保留原图`);
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log(`✓ 立绘 ${a.id}`);
}

async function genSprite(a) {
  const mainOut = path.join(ROOT, 'assets/sprites', a.id + '.png');
  if (fs.existsSync(mainOut) && !process.env.FORCE) { console.log(`· 小人跳过 ${a.id}`); return; }
  const dir = path.join(ROOT, 'assets/sprites', a.id);
  fs.mkdirSync(dir, { recursive: true });
  let p = await req('POST', 'create-character-with-4-directions', {
    description: a.prompt, image_size: { width: 96, height: 96 }, async_mode: true,
    proportions: PROPORTIONS, color_image: { base64: palette }, view: 'side',
    outline: 'single color black outline', shading: 'basic shading', detail: 'medium detail', seed: seedOf(a.id),
  });
  if (p.s !== 200) { console.log(`✗ 小人 ${a.id} POST HTTP ${p.s} ${p.b.slice(0, 120)}`); return; }
  const cid = JSON.parse(p.b).character_id;
  // 轮询：等 south 帧就绪
  let urls = null;
  for (let i = 0; i < 45; i++) {
    await sleep(4000);
    let c = await req('GET', 'characters/' + cid);
    if (c.s !== 200) continue;
    const j = JSON.parse(c.b);
    if (j.rotation_urls && j.rotation_urls.south) { urls = j.rotation_urls; break; }
  }
  if (!urls) { console.log(`✗ 小人 ${a.id} 超时未就绪`); return; }
  let okAny = false;
  for (const d of ['south', 'north', 'east', 'west']) {
    if (urls[d]) { const ok = await dl(urls[d], path.join(dir, d + '.png')); if (ok && d === 'south') { fs.copyFileSync(path.join(dir, 'south.png'), mainOut); okAny = true; } }
  }
  console.log(okAny ? `✓ 小人 ${a.id}（4 方向）` : `✗ 小人 ${a.id} 下载失败`);
}

async function main() {
  const list = manifest.assets.filter(a => a.type === 'character' && (!idFilter || a.id.includes(idFilter)));
  console.log(`角色双轨生成 ${list.length} 人（FORCE=${!!process.env.FORCE}）\n`);
  if (trackFilter !== 'sprite') { console.log('=== 立绘（精致优先） ==='); for (const a of list) { try { await genPortrait(a); } catch (e) { console.log(`✗ 立绘 ${a.id} ${e.message}`); } await sleep(400); } }
  if (trackFilter !== 'portrait') { console.log('\n=== 小人（严格锁比例 + 4 方向） ==='); for (const a of list) { try { await genSprite(a); } catch (e) { console.log(`✗ 小人 ${a.id} ${e.message}`); } await sleep(400); } }
  console.log('\n全部完成。');
}
main();
