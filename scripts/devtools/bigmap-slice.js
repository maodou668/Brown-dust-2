// 灰底物件表切件器：色键抠图 + 连通域拆件 + 自动碰撞脚印 + 物件库清单
// 用法: NODE_PATH=<repo>/node_modules node scripts/devtools/bigmap-slice.js <sheetA路径> <sheetB路径> <验收图目录>
// 输出: art/06_story/bigmap/lib/<name>.png + lib/manifest.json + 验收拼版 contact_*.png
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs'), path = require('path');
const DEFS = require('./bigmap-slice.def.js');

const root = path.join(__dirname, '../../');
const libdir = path.join(root, 'art/06_story/bigmap/lib');
fs.mkdirSync(libdir, { recursive: true });

// 色键: 与背景色距离 → alpha (软边)
function keyOut(data, w, h, bg) {
  const a = new Uint8Array(w * h);
  for (let i = 0, p = 0; p < w * h; p++, i += 4) {
    const d = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
    a[p] = d <= 14 ? 0 : d >= 34 ? 255 : Math.round((d - 14) / 20 * 255);
  }
  return a;
}
// 去小岛(网尘/字母): 连通域 < minArea 的清零; 返回保留域的标记图
function components(a, w, h, minArea) {
  const lab = new Int32Array(w * h).fill(-1);
  const comps = [];
  const qx = new Int32Array(w * h), qy = new Int32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    if (a[p] < 40 || lab[p] >= 0) continue;
    const id = comps.length;
    let head = 0, tail = 0, n = 0, x0 = x, x1 = x, y0 = y, y1 = y;
    qx[tail] = x; qy[tail] = y; tail++; lab[p] = id;
    while (head < tail) {
      const cx = qx[head], cy = qy[head]; head++; n++;
      if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const np = ny * w + nx;
        if (a[np] >= 40 && lab[np] < 0) { lab[np] = id; qx[tail] = nx; qy[tail] = ny; tail++; }
      }
    }
    comps.push({ id, n, x0, x1, y0, y1 });
  }
  return { lab, comps: comps.filter(c => c.n >= (minArea || 30)) };
}
// 底缘碰撞脚印: 取 alpha 底部条带的左右包络 → 简化多边形(相对精灵左上角)
function footFrom(a, w, h) {
  let yMax = 0;
  for (let p = 0; p < w * h; p++) if (a[p] >= 120) yMax = Math.max(yMax, Math.floor(p / w));
  const band = Math.min(Math.round(h * 0.18), 64);
  const y0 = Math.max(0, yMax - band);
  const rows = [];
  for (let y = y0; y <= yMax; y += Math.max(4, Math.floor(band / 6))) {
    let L = -1, R = -1;
    for (let x = 0; x < w; x++) if (a[y * w + x] >= 120) { if (L < 0) L = x; R = x; }
    if (L >= 0) rows.push([y, L, R]);
  }
  if (!rows.length) return null;
  const poly = [];
  for (const [y, L] of rows) poly.push([L, y]);
  for (let i = rows.length - 1; i >= 0; i--) poly.push([rows[i][2], rows[i][0]]);
  return poly;
}

(async () => {
  const [, , fA, fB, outdir] = process.argv;
  const manifest = {};
  for (const [sheetKey, file] of [['sheetA', fA], ['sheetB', fB]]) {
    const img = await loadImage(file);
    const full = createCanvas(img.width, img.height).getContext('2d');
    full.drawImage(img, 0, 0);
    const bgd = full.getImageData(3, 3, 4, 4).data;
    const bg = [bgd[0], bgd[1], bgd[2]];
    for (const def of DEFS[sheetKey]) {
      const [bx, by, bw, bh] = def.box;
      const id = full.getImageData(bx, by, bw, bh);
      const alpha = keyOut(id.data, bw, bh, bg);
      let { lab, comps } = components(alpha, bw, bh, def.minArea || 60);
      // 标签文字剔除: 矮小的横条域(表上白字), 物件本体不会这么矮
      comps = comps.filter(c => !((c.y1 - c.y0) < 48 && c.n < 8000));
      if (def.largest) comps = [comps.sort((a2, b2) => b2.n - a2.n)[0]].filter(Boolean);
      const emit = (name, keepIds, x0, y0, x1, y1) => {
        const w = x1 - x0 + 1, h = y1 - y0 + 1;
        const cv = createCanvas(w, h), ctx = cv.getContext('2d');
        const od = ctx.createImageData(w, h);
        const A = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const sp = (y + y0) * bw + (x + x0), dp = (y * w + x) * 4;
          const keep = lab[sp] >= 0 && keepIds.has(lab[sp]);
          const av = keep ? alpha[sp] : 0;
          od.data[dp] = id.data[sp * 4]; od.data[dp + 1] = id.data[sp * 4 + 1];
          od.data[dp + 2] = id.data[sp * 4 + 2]; od.data[dp + 3] = av;
          A[y * w + x] = av;
        }
        ctx.putImageData(od, 0, 0);
        fs.writeFileSync(path.join(libdir, name + '.png'), cv.toBuffer('image/png'));
        manifest[name] = { w, h, decal: !!def.decal,
          foot: (def.decal || def.skipFoot) ? null : footFrom(A, w, h) };
      };
      if (def.split) {
        comps.sort((c1, c2) => (c1.y0 - c2.y0) || (c1.x0 - c2.x0));
        comps.forEach((c, i) => emit(`${def.name}_${i}`, new Set([c.id]), c.x0, c.y0, c.x1, c.y1));
        console.log(sheetKey, def.name, '→', comps.length, '件');
      } else {
        if (!comps.length) { console.log('⚠️ 空件:', def.name); continue; }
        const keep = new Set(comps.map(c => c.id));
        const x0 = Math.min(...comps.map(c => c.x0)), x1 = Math.max(...comps.map(c => c.x1));
        const y0 = Math.min(...comps.map(c => c.y0)), y1 = Math.max(...comps.map(c => c.y1));
        emit(def.name, keep, x0, y0, x1, y1);
      }
    }
  }
  fs.writeFileSync(path.join(libdir, 'manifest.json'), JSON.stringify(manifest));
  // 验收拼版: 黑底摆开看边缘
  const names = Object.keys(manifest);
  const cols = 8, cell = 300;
  const cv = createCanvas(cols * cell, Math.ceil(names.length / cols) * cell);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0c2010'; ctx.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < names.length; i++) {
    const im = await loadImage(path.join(libdir, names[i] + '.png'));
    const s = Math.min(1, (cell - 20) / Math.max(im.width, im.height));
    ctx.drawImage(im, (i % cols) * cell + 10, Math.floor(i / cols) * cell + 16, im.width * s, im.height * s);
    ctx.fillStyle = '#ffe066'; ctx.font = '12px sans-serif';
    ctx.fillText(names[i] + ` ${im.width}x${im.height}`, (i % cols) * cell + 10, Math.floor(i / cols) * cell + 12);
  }
  fs.writeFileSync(path.join(outdir || '.', 'contact.png'), cv.toBuffer('image/png'));
  console.log('物件库', names.length, '件 → art/06_story/bigmap/lib/  验收图 contact.png');
})();
