// ============================================================
//  artgate.js —— 美术资产【强制闸门】总入口（一条命令跑完所有闸门 + 贴数字 + 出图）
//  用法: node scripts/artgate.js <char_field_prefix> [driftThreshold=1.5]
//  作用: 读 art/05_pixellab/<char>_field/ 的 idle/run/cast 帧，跑：
//        ① idle 脚漂移闸门(全 8 向像素数, >阈值=抽腿=FAIL)
//        ② run 脚漂移(参考) + 生成 idle/run 朝向对照拼图(逐向目视)
//        ③ cast 动作存在性
//        打印 PASS/FAIL 表 + 写拼图 _artgate_*.png；有 FAIL 则退出码 1。
//  规矩(CLAUDE.md 铁律)：任何美术资产【接入前必须跑本命令并把输出原样贴给用户】；
//        没有本命令的输出 = 没做闸门 = 不接入。禁止"我看着行"。
// ============================================================
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'art', '05_pixellab');
const char = process.argv[2];
const THRESH = parseFloat(process.argv[3] || '1.5');
const DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
if (!char) { console.error('usage: node scripts/artgate.js <char_field_prefix> [driftThreshold=1.5]'); process.exit(2); }
const FIELD = path.join(ROOT, char + '_field');
if (!fs.existsSync(FIELD)) { console.error('找不到目录:', FIELD); process.exit(2); }

async function footDrift(anim) {
  const res = {};
  for (const dir of DIRS) {
    const base = path.join(FIELD, anim, dir);
    if (!fs.existsSync(base)) { res[dir] = null; continue; }
    const files = fs.readdirSync(base).filter(f => /\.png$/.test(f)).sort();
    if (files.length < 2) { res[dir] = 0; continue; }
    const cents = [];
    for (const f of files) {
      const img = await loadImage(path.join(base, f));
      const c = createCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, img.width, img.height).data, H = img.height, W = img.width;
      let maxY = 0; for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) if (d[(y * W + X) * 4 + 3] > 40 && y > maxY) maxY = y;
      const band = Math.max(0, maxY - Math.round(H * 0.12)); let sx = 0, n = 0;
      for (let y = band; y <= maxY; y++) for (let X = 0; X < W; X++) if (d[(y * W + X) * 4 + 3] > 40) { sx += X; n++; }
      if (n) cents.push(sx / n);
    }
    res[dir] = cents.length ? +(Math.max(...cents) - Math.min(...cents)).toFixed(1) : 0;
  }
  return res;
}

async function montage(anim, frame, outName) {
  const S = 124, pad = 4;
  const c = createCanvas(8 * (S + pad), S + 22), x = c.getContext('2d');
  x.fillStyle = '#2a2a3a'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = false;
  for (let i = 0; i < 8; i++) {
    const p = path.join(FIELD, anim, DIRS[i], String(frame).padStart(2, '0') + '.png');
    x.fillStyle = '#fff'; x.font = '11px sans-serif'; x.fillText(DIRS[i], i * (S + pad) + 2, 12);
    if (fs.existsSync(p)) { const im = await loadImage(p); x.drawImage(im, i * (S + pad), 18, S, S); }
  }
  fs.writeFileSync(path.join(FIELD, outName), c.toBuffer('image/png'));
}

(async () => {
  let fail = false; const L = [];
  const anims = fs.readdirSync(FIELD).filter(a => { try { return fs.statSync(path.join(FIELD, a)).isDirectory() && !a.startsWith('_'); } catch (e) { return false; } });
  L.push(`== ARTGATE ${char}  (脚漂移阈值 ${THRESH}px) ==`);
  L.push(`动画: ${anims.join(', ') || '(无)'}`);

  if (anims.includes('idle')) {
    const d = await footDrift('idle');
    const bad = DIRS.filter(k => d[k] != null && d[k] > THRESH);
    L.push('idle 脚漂移: ' + DIRS.map(k => `${k}=${d[k] == null ? '-' : d[k]}`).join('  '));
    L.push('  → ' + (bad.length ? `❌FAIL 抽腿向: ${bad.join(',')} (背向斜角最常见)` : '✅PASS 全向≤阈值'));
    if (bad.length) fail = true;
    await montage('idle', 0, '_artgate_idle.png');
  } else { L.push('idle: ❌缺失'); fail = true; }

  if (anims.includes('run')) {
    const d = await footDrift('run');
    L.push('run 脚漂移(参考): ' + DIRS.map(k => `${k}=${d[k] == null ? '-' : d[k]}`).join('  '));
    await montage('run', 3, '_artgate_run.png');
    L.push('  → 朝向闸门：目视 _artgate_run.png(下) 对照 _artgate_idle.png(上)，每向朝向须一致');
  } else { L.push('run: ⚠️缺失(未做)'); }

  const casts = anims.filter(a => a.indexOf('cast') === 0);
  L.push('cast 动作: ' + (casts.length ? casts.join(',') : '⚠️无'));

  L.push(fail ? '\n结论: ❌ 有闸门未过 —— 禁止接入，先修再来。' : '\n结论: ✅ 脚漂移闸门通过；仍须打开 _artgate_idle/run.png 逐向目视朝向。');
  console.log(L.join('\n'));
  process.exit(fail ? 1 : 0);
})();
