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

// —— 身份/配色离群检测：模板动画会把某个方向画成别的角色(掉身份)或串入别人的配色
// (紫斗篷/红裙)。干净角色 8 向配色一致；被污染的向会冒出别向没有的「饱和色」。
// 做法：每向取「饱和像素的色相直方图」(12 桶)，与全向均值比 L1 距离，强离群 = FAIL。
function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0; if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return { h, s: mx ? d / mx : 0, v: mx };
}
async function colorSig(anim) {
  const sig = {};
  for (const dir of DIRS) {
    const base = path.join(FIELD, anim, dir);
    if (!fs.existsSync(base)) { sig[dir] = null; continue; }
    const files = fs.readdirSync(base).filter(f => /\.png$/.test(f)).sort();
    const H = new Array(12).fill(0); let opaque = 0;
    for (const f of files) {
      const img = await loadImage(path.join(base, f));
      const c = createCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, img.width, img.height).data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] <= 40) continue; opaque++;
        const { h, s, v } = rgb2hsv(d[i], d[i + 1], d[i + 2]);
        if (s > 0.35 && v > 0.2) H[Math.min(11, Math.floor(h / 30))]++;   // 只记「有颜色」的像素
      }
    }
    sig[dir] = opaque ? H.map(n => n / opaque) : null;   // 归一到「占该向不透明像素的比例」
  }
  return sig;
}
function colorOutliers(sig) {
  const dirs = DIRS.filter(k => sig[k]);
  if (dirs.length < 4) return { bad: [], dist: {} };
  const mean = new Array(12).fill(0);
  dirs.forEach(k => sig[k].forEach((v, i) => mean[i] += v / dirs.length));
  const dist = {}; dirs.forEach(k => dist[k] = +sig[k].reduce((a, v, i) => a + Math.abs(v - mean[i]), 0).toFixed(3));
  const vals = dirs.map(k => dist[k]).sort((a, b) => a - b);
  const med = vals[Math.floor(vals.length / 2)];
  // 强离群：L1 距离 > max(绝对地板 0.10, 2.5×中位数)。绝对地板挡「串了 10%+ 别人配色」。
  const thr = Math.max(0.10, med * 2.5);
  const bad = dirs.filter(k => dist[k] > thr);
  return { bad, dist, thr: +thr.toFixed(3) };
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

  // 身份/配色离群闸门。idle 用「相对离群」(某向偏离其它向)；run 额外用「对照 idle」
  // ——idle 是从旋转母图合成的、身份为真，故 run 任一向偏离同向 idle 配色 = 串色/掉身份，
  // 即便整套 run 全坏(无干净基线)也能抓到。任一命中即 FAIL。
  const REF_THR = 0.10;   // run vs idle 同向 L1 阈值
  let idleSigCache = null;
  async function colorGate(anim, refSig) {
    const sig = await colorSig(anim);
    if (anim === 'idle') idleSigCache = sig;
    const o = colorOutliers(sig);
    L.push(`${anim} 配色离群: ` + DIRS.map(k => `${k}=${o.dist[k] == null ? '-' : o.dist[k]}`).join('  ') + `  (相对阈值 ${o.thr})`);
    const badSet = new Set(o.bad);
    if (refSig) {   // 对照参考(idle)：同向 L1
      const rd = {}; DIRS.forEach(k => { rd[k] = (sig[k] && refSig[k]) ? +sig[k].reduce((a, v, i) => a + Math.abs(v - refSig[k][i]), 0).toFixed(3) : null; });
      L.push(`  ${anim} vs idle 同向配色差: ` + DIRS.map(k => `${k}=${rd[k] == null ? '-' : rd[k]}`).join('  ') + `  (阈值 ${REF_THR})`);
      DIRS.forEach(k => { if (rd[k] != null && rd[k] > REF_THR) badSet.add(k); });
    }
    const bad = [...badSet];
    if (bad.length) { L.push(`  → ❌FAIL 身份/配色离群向: ${bad.join(',')} (模板掉身份/串色最常见——放大目视这些向)`); fail = true; }
    else L.push('  → ✅PASS 全向配色一致');
  }

  if (anims.includes('idle')) {
    const d = await footDrift('idle');
    const bad = DIRS.filter(k => d[k] != null && d[k] > THRESH);
    L.push('idle 脚漂移: ' + DIRS.map(k => `${k}=${d[k] == null ? '-' : d[k]}`).join('  '));
    L.push('  → ' + (bad.length ? `❌FAIL 抽腿向: ${bad.join(',')} (背向斜角最常见)` : '✅PASS 全向≤阈值'));
    if (bad.length) fail = true;
    await colorGate('idle');
    await montage('idle', 0, '_artgate_idle.png');
  } else { L.push('idle: ❌缺失'); fail = true; }

  if (anims.includes('run')) {
    const d = await footDrift('run');
    L.push('run 脚漂移(参考): ' + DIRS.map(k => `${k}=${d[k] == null ? '-' : d[k]}`).join('  '));
    await colorGate('run', idleSigCache);
    await montage('run', 3, '_artgate_run.png');
    L.push('  → 朝向闸门：目视 _artgate_run.png(下) 对照 _artgate_idle.png(上)，每向朝向须一致');
  } else { L.push('run: ⚠️缺失(未做)'); }

  const casts = anims.filter(a => a.indexOf('cast') === 0);
  L.push('cast 动作: ' + (casts.length ? casts.join(',') : '⚠️无'));

  L.push(fail ? '\n结论: ❌ 有闸门未过 —— 禁止接入，先修再来。' : '\n结论: ✅ 脚漂移闸门通过；仍须打开 _artgate_idle/run.png 逐向目视朝向。');
  // PASS → 写通行戳（pretool-guard 的 push 闸门凭此放行：field png 变更须携带同批次的戳变更）
  if (!fail) fs.writeFileSync(path.join(FIELD, '.artgate_pass'), new Date().toISOString() + ' PASS ' + char + '\n');
  else { try { fs.unlinkSync(path.join(FIELD, '.artgate_pass')); } catch (e) {} }
  console.log(L.join('\n'));
  process.exit(fail ? 1 : 0);
})();
