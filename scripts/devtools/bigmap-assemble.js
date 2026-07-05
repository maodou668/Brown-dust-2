// 拼装器：物件库 + 布局定义 → 合成预览图 + bigmap.js 配置段(objects/decals/glows/parts/critters)
// 用法: NODE_PATH=<repo>/node_modules node scripts/devtools/bigmap-assemble.js <输出目录>
// 镜像件(_m 后缀)自动烘焙进 lib/
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs'), path = require('path');
const DEF = require('./bigmap-assemble.def.js');

const root = path.join(__dirname, '../../');
const libdir = path.join(root, 'art/06_story/bigmap/lib');
const manifest = JSON.parse(fs.readFileSync(path.join(libdir, 'manifest.json'), 'utf8'));

async function ensureMirror(name) {
  const base = name.slice(0, -2);
  if (manifest[name] || !name.endsWith('_m') || !manifest[base]) return;
  const im = await loadImage(path.join(libdir, base + '.png'));
  const cv = createCanvas(im.width, im.height), ctx = cv.getContext('2d');
  ctx.translate(im.width, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0);
  fs.writeFileSync(path.join(libdir, name + '.png'), cv.toBuffer('image/png'));
  const m = manifest[base];
  manifest[name] = { w: m.w, h: m.h, decal: m.decal,
    foot: m.foot ? m.foot.map(([x, y]) => [m.w - x, y]) : null };
}

(async () => {
  const outdir = process.argv[2] || '.';
  for (const o of DEF.objects) await ensureMirror(o.img);
  fs.writeFileSync(path.join(libdir, 'manifest.json'), JSON.stringify(manifest));

  // 生成配置段
  // 面片边缘碎化(硬菱形边 → 不规则蚀边+渐隐), 烘出 _e 版本
  async function erodeDecal(name) {
    if (manifest[name + '_e']) return name + '_e';
    const im = await loadImage(path.join(libdir, name + '.png'));
    const cv = createCanvas(im.width, im.height), ctx = cv.getContext('2d');
    ctx.drawImage(im, 0, 0);
    const idd = ctx.getImageData(0, 0, im.width, im.height);
    const W = im.width, H = im.height, d2 = idd.data;
    // 距边界的alpha距离场近似: 多轮腐蚀, 每轮把边界像素按噪声概率削掉
    let a = new Uint8Array(W * H);
    for (let p = 0; p < W * H; p++) a[p] = d2[p * 4 + 3];
    const rnd = (x, y, k) => { const v = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
    for (let k = 0; k < 14; k++) {
      const b = new Uint8Array(a);
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const p = y * W + x;
        if (a[p] > 0 && (a[p - 1] === 0 || a[p + 1] === 0 || a[p - W] === 0 || a[p + W] === 0)) {
          if (rnd(x, y, k) < 0.55) b[p] = 0;
          else b[p] = Math.min(b[p], Math.round(40 + rnd(y, x, k) * 120));
        }
      }
      a = b;
    }
    for (let p = 0; p < W * H; p++) d2[p * 4 + 3] = Math.min(d2[p * 4 + 3], a[p]);
    ctx.putImageData(idd, 0, 0);
    fs.writeFileSync(path.join(libdir, name + '_e.png'), cv.toBuffer('image/png'));
    manifest[name + '_e'] = { w: im.width, h: im.height, decal: true, foot: null };
    return name + '_e';
  }
  const decals = [];
  for (const d of DEF.decals) {
    const nm = await erodeDecal(d.img);
    const m = manifest[nm];
    decals.push({ img: nm, px: Math.round(d.ax - m.w / 2), py: Math.round(d.ay - m.h / 2) });
  }
  const objects = DEF.objects.map(o => {
    const m = manifest[o.img];
    const sc = o.s || 1;
    const px = Math.round(o.ax - m.w * sc / 2), py = Math.round(o.ay - m.h * sc);
    let foot;
    if (o.foot) foot = o.foot.map(p => p.map(([dx, dy]) => [o.ax + dx, o.ay + dy]));
    else if (m.foot) {
      // 底带 bbox + 按类别向上挤出深度 → 矩形脚印(防从背后穿楼)
      const xs = m.foot.map(p => p[0]), ys = m.foot.map(p => p[1]);
      const x0 = Math.min(...xs) * sc + px, x1 = Math.max(...xs) * sc + px;
      const y0 = Math.min(...ys) * sc + py, y1 = Math.max(...ys) * sc + py;
      const nm = o.img;
      const thin = /^(pal_|fence_|maingate)/.test(nm) ? 18
        : /^(dtree|gtree|lamp|graves|cart|logs)/.test(nm) ? 24
        : Math.min(130, Math.max(44, (x1 - x0) * 0.30));
      foot = [[[Math.round(x0), Math.round(y0 - thin)], [Math.round(x1), Math.round(y0 - thin)],
               [Math.round(x1), Math.round(y1)], [Math.round(x0), Math.round(y1)]]];
    }
    else foot = [];
    const rec = { img: o.img, px, py, y: o.ay, foot };
    if (sc !== 1) rec.s = sc;
    return rec;
  });
  const glows = [];
  for (const o of DEF.objects) if (o.glow) glows.push([Math.round(o.ax + o.glow[0]), Math.round(o.ay + o.glow[1]), o.glow[2]]);
  for (const g of DEF.glows) glows.push(g);
  const out = {
    decals, objects, glows,
    parts: DEF.smoke.map(p => ({ type: 'smoke', px: p })).concat([{ type: 'leaves', n: 8 }]),
    critters: DEF.critters,
  };
  fs.writeFileSync(path.join(outdir, 'assembled.json'), JSON.stringify(out, null, 1));

  // 合成预览
  const ground = await loadImage(path.join(root, 'art/06_story/bigmap/ground_day.png'));
  const cv = createCanvas(ground.width, ground.height), ctx = cv.getContext('2d');
  ctx.drawImage(ground, 0, 0);
  for (const d of decals) {
    const im = await loadImage(path.join(libdir, d.img + '.png'));
    ctx.drawImage(im, d.px, d.py);
  }
  for (const o of [...objects].sort((a, b) => a.y - b.y)) {
    const im = await loadImage(path.join(libdir, o.img + '.png'));
    ctx.drawImage(im, o.px, o.py, im.width * (o.s || 1), im.height * (o.s || 1));
  }
  fs.writeFileSync(path.join(outdir, 'assembled_full.png'), cv.toBuffer('image/png'));
  const half = createCanvas(Math.round(cv.width * 0.52), Math.round(cv.height * 0.52));
  half.getContext('2d').drawImage(cv, 0, 0, half.width, half.height);
  fs.writeFileSync(path.join(outdir, 'assembled_view.png'), half.toBuffer('image/png'));
  console.log('拼装', objects.length, '件物件 +', decals.length, '面片 → assembled_view.png / assembled.json');
})();
