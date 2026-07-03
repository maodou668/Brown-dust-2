#!/usr/bin/env node
// 场景物件配色闸门：物件调色与锚点瓦片集(art/06_story/tiles/road_grass.png)的色距
// 用法: node scripts/scenegate.js <prop.png> [阈值=28]
// 指标: 物件不透明像素到锚点调色板(去重色)的平均最近 RGB 距离。超阈值 exit 1。
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const REFS = [
  path.join(__dirname, '../art/06_story/tiles/road_grass.png'),
  path.join(__dirname, '../art/06_story/props/house_timber.png'),   // 已验收锚点物件
];

(async () => {
  const [propPath, thArg] = process.argv.slice(2);
  const TH = +(thArg || 28);
  const pix = async p => {
    const im = await loadImage(p);
    const cv = createCanvas(im.width, im.height);
    const ctx = cv.getContext('2d'); ctx.drawImage(im, 0, 0);
    return { d: ctx.getImageData(0, 0, im.width, im.height).data, n: im.width * im.height };
  };
  // 锚点调色板（瓦片集+已验收物件）：量化 3bit/通道去重
  const pal = new Set();
  for (const rp of REFS) {
    const a = await pix(rp);
    for (let i = 0; i < a.n; i++) if (a.d[i * 4 + 3] > 128)
      pal.add(((a.d[i * 4] >> 5) << 6) | ((a.d[i * 4 + 1] >> 5) << 3) | (a.d[i * 4 + 2] >> 5));
  }
  const cols = [...pal].map(k => [((k >> 6) & 7) * 36 + 18, ((k >> 3) & 7) * 36 + 18, (k & 7) * 36 + 18]);

  const o = await pix(propPath);
  let sum = 0, cnt = 0;
  for (let i = 0; i < o.n; i += 2) {   // 隔像素采样
    if (o.d[i * 4 + 3] < 128) continue;
    const r = o.d[i * 4], g = o.d[i * 4 + 1], b = o.d[i * 4 + 2];
    let best = 1e9;
    for (const c of cols) {
      const dd = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
      if (dd < best) best = dd;
    }
    sum += Math.sqrt(best); cnt++;
  }
  const score = sum / cnt;
  // 信号2: 深描边占比（A 风格厚描边 → 暗像素显著）
  let dark = 0, tot = 0;
  for (let i = 0; i < o.n; i++) { if (o.d[i * 4 + 3] < 128) continue; tot++;
    if (Math.max(o.d[i * 4], o.d[i * 4 + 1], o.d[i * 4 + 2]) < 56) dark++; }
  const darkPct = dark / tot * 100;
  const ok = score <= TH && darkPct >= 14;
  console.log(`${path.basename(propPath)} 色距=${score.toFixed(1)}(阈${TH}) 描边暗色=${darkPct.toFixed(1)}%(需≥14) → ${ok ? 'PASS' : 'FAIL'}`);
  process.exit(ok ? 0 : 1);
})();
