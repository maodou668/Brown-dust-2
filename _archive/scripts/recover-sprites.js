#!/usr/bin/env node
/**
 * 恢复已生成的 10 个小人（按描述映射 id）+ 生成剩余 6 个。
 * 正确的就绪判定：轮询时实际下载 south.png，HTTP 200 才算就绪（URL 存在≠图就绪）。
 * 严格串行：每个角色等其任务完成再开下一个，远低于 Tier2 的 10 并发上限。
 */
const fs = require('fs'), path = require('path'), https = require('https');
const ROOT = path.resolve(__dirname, '..');
const KEY = process.env.PIXELLAB_API_KEY;
if (!KEY) { console.error('缺 PIXELLAB_API_KEY'); process.exit(1); }
const palette = fs.readFileSync(path.join(ROOT, 'assets/style/master_palette.png')).toString('base64');
const PROPORTIONS = { type: 'custom', head_size: 1.45, legs_length: 0.85, arms_length: 0.9, shoulder_width: 0.95 };

// 已生成的 10 个：characterId → 我们的角色 id
const RECOVER = {
  '15f032ad-239f-452e-b76d-ebc23125b797': 'mina',
  '24ad5817-0c24-4090-bd1b-09b9809bec37': 'lia',
  '8b944700-bf40-49e0-8b16-f8874cdbc0e4': 'teried',
  'e9ffd099-1c54-4166-b467-efcc0aa10d7c': 'garcia',
  '983ba4c6-52aa-4f61-9dfb-3e2460ce2f5a': 'diana',
  '4a4880d6-8b1f-4612-897a-a3daeda2a346': 'helena',
  'cd420a75-dfdf-4abe-95b5-e17f452a3be1': 'rou',
  '4e4d3dda-c132-4ad3-9d94-6476a0bdae08': 'seir',
  '57b26368-9e47-42a5-8d50-0436e5160780': 'justia',
  '9df0dc0a-59cb-4ec4-955c-84af0383cf5c': 'lecliss',
};
// 剩余 6 个：需要重新生成
const REMAIN = {
  refithea: 'holy saint girl, floor-length flowing white hair and white robe, holding a glowing lantern, gentle resolute, warm white gold tones',
  rigenette: 'young sky knight captain girl, sleek silver armor, a fast thin blade, sharp confident, pale cyan tones',
  olstein: 'old veteran guardian man, scarred heavy armor, an immovable great shield, silent steadfast, weathered amber tones',
  glacia: 'quiet ice mage girl, northern snow fur attire, swirling frost magic, reserved cold, icy light blue tones',
  liatris: 'confident crimson sniper girl, light fiery outfit, a great bow with flame-feather arrows, smug sharp, fiery red orange tones',
  loen: 'earnest dawn knight rookie boy, light golden armor, a knight sword, upright hot-blooded, dawn gold tones',
};

function req(method, ep, body) {
  return new Promise((res, rej) => {
    const d = body ? JSON.stringify(body) : null;
    const o = { method, headers: { 'Authorization': 'Bearer ' + KEY }, timeout: 60000 };
    if (d) { o.headers['Content-Type'] = 'application/json'; o.headers['Content-Length'] = Buffer.byteLength(d); }
    const r = https.request('https://api.pixellab.ai/v2/' + ep, o, x => { let b = ''; x.on('data', c => b += c); x.on('end', () => res({ s: x.statusCode, b })); });
    r.on('timeout', () => { r.destroy(); rej(new Error('timeout')); });
    r.on('error', rej); if (d) r.write(d); r.end();
  });
}
function dl(url, file) {
  return new Promise(res => {
    const r = https.get(url, { timeout: 40000 }, x => {
      if (x.statusCode !== 200) { x.resume(); return res(false); }
      const ch = []; x.on('data', c => ch.push(c)); x.on('end', () => { fs.writeFileSync(file, Buffer.concat(ch)); res(true); });
    });
    r.on('timeout', () => { r.destroy(); res(false); });
    r.on('error', () => res(false));
  });
}
const sleep = ms => new Promise(s => setTimeout(s, ms));

// 轮询直到 south 真正可下载，然后存 4 方向
async function fetchChar(cid, id) {
  const dir = path.join(ROOT, 'assets/sprites', id);
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 60; i++) {
    let c = await req('GET', 'characters/' + cid);
    if (c.s === 200) {
      const urls = JSON.parse(c.b).rotation_urls;
      if (urls && urls.south) {
        const ok = await dl(urls.south, path.join(dir, 'south.png'));
        if (ok) {
          fs.copyFileSync(path.join(dir, 'south.png'), path.join(ROOT, 'assets/sprites', id + '.png'));
          for (const d of ['north', 'east', 'west']) if (urls[d]) await dl(urls[d], path.join(dir, d + '.png'));
          console.log(`✓ ${id}`);
          return true;
        }
      }
    }
    await sleep(5000);
  }
  console.log(`✗ ${id} 超时`);
  return false;
}

async function main() {
  console.log('=== 恢复已生成的 10 个 ===');
  for (const [cid, id] of Object.entries(RECOVER)) {
    if (fs.existsSync(path.join(ROOT, 'assets/sprites', id + '.png')) && !process.env.FORCE) { console.log(`· 跳过 ${id}`); continue; }
    await fetchChar(cid, id);
  }
  console.log('\n=== 生成剩余 6 个 ===');
  for (const [id, desc] of Object.entries(REMAIN)) {
    if (fs.existsSync(path.join(ROOT, 'assets/sprites', id + '.png')) && !process.env.FORCE) { console.log(`· 跳过 ${id}`); continue; }
    let seed = 0; for (const c of id) seed = (seed * 31 + c.charCodeAt(0)) >>> 0; seed %= 100000;
    let p = await req('POST', 'create-character-with-4-directions', {
      description: desc, image_size: { width: 96, height: 96 }, async_mode: true,
      proportions: PROPORTIONS, color_image: { base64: palette }, view: 'side',
      outline: 'single color black outline', shading: 'basic shading', detail: 'medium detail', seed,
    });
    if (p.s !== 200) { console.log(`✗ ${id} POST ${p.s} ${p.b.slice(0, 100)}`); await sleep(3000); continue; }
    await fetchChar(JSON.parse(p.b).character_id, id);
  }
  console.log('\n完成。sprites:', fs.readdirSync(path.join(ROOT, 'assets/sprites')).filter(f => f.endsWith('.png')).length);
}
main();
