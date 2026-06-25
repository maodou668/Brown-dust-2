// 把 lecliss 的 6 个 SD 序列帧，各取一代表帧，按"头宽"归一化、脚底对齐，
// 拼成一张对比图，用于人工判断一致性。输出 art/03_sprite/_consistency.png
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const dir = path.resolve(__dirname, '../art/03_sprite');
const CLIPS = [
  ['idle', '待机'], ['walk_dr', '走·右下'], ['walk_ur', '走·右上'],
  ['attack', '攻击'], ['skill', '技能'], ['hit', '受击'],
];

// 取某帧的像素 alpha 包围盒 + 顶部头宽
function analyze(ctx, fw, fh) {
  const d = ctx.getImageData(0, 0, fw, fh).data;
  let minX = fw, maxX = 0, minY = fh, maxY = 0;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      if (d[(y * fw + x) * 4 + 3] > 40) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const h = maxY - minY, w = maxX - minX;
  // 头宽：从头顶往下扫前 22% 高度，取该带内最大水平像素跨度
  const band = Math.max(2, Math.round(h * 0.22));
  let headW = 0;
  for (let y = minY; y < minY + band; y++) {
    let lo = fw, hi = 0;
    for (let x = 0; x < fw; x++) if (d[(y * fw + x) * 4 + 3] > 40) { if (x < lo) lo = x; if (x > hi) hi = x; }
    if (hi > lo) headW = Math.max(headW, hi - lo);
  }
  return { minX, maxX, minY, maxY, w, h, headW, cx: (minX + maxX) / 2, feet: maxY };
}

(async () => {
  const data = [];
  for (const [key] of CLIPS) {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, `lecliss_sd_${key}.json`), 'utf8'));
    const img = await loadImage(path.join(dir, meta.sheet));
    const f = meta.loop ? Math.floor(meta.frames / 2) : Math.floor(meta.frames * 0.5);
    const sx = (f % meta.cols) * meta.fw, sy = Math.floor(f / meta.cols) * meta.fh;
    const c = createCanvas(meta.fw, meta.fh); const cx = c.getContext('2d');
    cx.drawImage(img, sx, sy, meta.fw, meta.fh, 0, 0, meta.fw, meta.fh);
    const a = analyze(cx, meta.fw, meta.fh);
    data.push({ key, meta, img, frame: f, a });
    console.log(`${key.padEnd(9)} 身高=${a.h}px 头宽=${a.headW}px 头身比≈${(a.h / a.headW).toFixed(2)}`);
  }

  // 以"头宽"为不变量归一化：目标头宽 = 各 clip 头宽中位数
  const heads = data.map(d => d.a.headW).slice().sort((x, y) => x - y);
  const targetHead = heads[Math.floor(heads.length / 2)];
  console.log('目标头宽(中位)=', targetHead);

  const COLW = 240, COLH = 420, PAD = 10, baseY = COLH - 46;
  const W = COLW * data.length, H = COLH;
  const cv = createCanvas(W, H); const g = cv.getContext('2d');
  g.fillStyle = '#181320'; g.fillRect(0, 0, W, H);
  data.forEach((d, i) => {
    const ox = i * COLW;
    // 基线
    g.strokeStyle = 'rgba(255,255,255,.10)'; g.beginPath(); g.moveTo(ox, baseY); g.lineTo(ox + COLW, baseY); g.stroke();
    const s = targetHead / d.a.headW;        // 头宽归一化缩放
    const { fw, fh } = d.meta;
    const dw = fw * s, dh = fh * s;
    // 脚底对齐到 baseY，角色水平中心对齐列中心
    const dx = ox + COLW / 2 - (d.a.cx * s);
    const dy = baseY - (d.a.feet * s);
    const sx = (d.frame % d.meta.cols) * fw, sy = Math.floor(d.frame / d.meta.cols) * fh;
    g.drawImage(d.img, sx, sy, fw, fh, dx, dy, dw, dh);
    g.fillStyle = '#cdbfe0'; g.font = 'bold 16px sans-serif'; g.textAlign = 'center';
    g.fillText(CLIPS[i][1], ox + COLW / 2, H - 14);
    g.fillStyle = '#7a6e8c'; g.font = '11px sans-serif';
    g.fillText(`头身≈${(d.a.h / d.a.headW).toFixed(2)}`, ox + COLW / 2, H - 30);
  });
  const out = path.join(dir, '_consistency.png');
  fs.writeFileSync(out, cv.toBuffer('image/png'));
  console.log('已输出', out);
})();
