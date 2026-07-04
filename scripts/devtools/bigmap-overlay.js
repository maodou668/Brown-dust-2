// 大图标定覆盖图：把 js/bigmap.js 的 walk/block/occ 画在原图上目视校验。
// 用法: NODE_PATH=<repo>/node_modules node scripts/devtools/bigmap-overlay.js town_day <outdir>
// 输出: overlay_full.png + 四象限 1.6x（绿=可走 红=block 黄框=遮挡件 青线=脚线baseY）
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs'), path = require('path');

global.window = {};
require(path.join(__dirname, '../../js/bigmap.js'));

const key = process.argv[2] || 'town_day';
const outdir = process.argv[3] || '.';
const BM = window.BIGMAPS[key];

function paintMask(ctx, s) {   // s = 输出缩放
  // walk
  ctx.fillStyle = ctx.strokeStyle = 'rgba(80,255,120,.30)';
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const st of BM.walk.strokes) {
    ctx.lineWidth = st.w * s;
    ctx.beginPath();
    st.pts.forEach(([x, y], i) => i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s));
    ctx.stroke();
  }
  for (const p of BM.walk.polys) {
    ctx.beginPath();
    p.forEach(([x, y], i) => i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s));
    ctx.closePath(); ctx.fill();
  }
  // block
  ctx.fillStyle = 'rgba(255,60,60,.38)';
  for (const [x, y, r] of BM.block.circles || []) { ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, 7); ctx.fill(); }
  for (const [x, y, w, h] of BM.block.rects || []) ctx.fillRect(x * s, y * s, w * s, h * s);
  for (const p of BM.block.polys || []) {
    ctx.beginPath();
    p.forEach(([x, y], i) => i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s));
    ctx.closePath(); ctx.fill();
  }
  // occ
  ctx.lineWidth = Math.max(1, 2 * s);
  for (const [x, y, w, h, by] of BM.occ || []) {
    ctx.strokeStyle = 'rgba(255,220,60,.85)'; ctx.strokeRect(x * s, y * s, w * s, h * s);
    ctx.strokeStyle = 'rgba(80,230,255,.9)';
    ctx.beginPath(); ctx.moveTo(x * s, by * s); ctx.lineTo((x + w) * s, by * s); ctx.stroke();
  }
  // spawn
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(BM.spawn[0] * s, BM.spawn[1] * s, 5 * s + 3, 0, 7); ctx.fill();
}

(async () => {
  const img = await loadImage(path.join(__dirname, '../../', BM.img));
  const full = createCanvas(Math.round(BM.w * 0.85), Math.round(BM.h * 0.85));
  let cx = full.getContext('2d');
  cx.drawImage(img, 0, 0, full.width, full.height);
  paintMask(cx, 0.85);
  fs.writeFileSync(path.join(outdir, 'overlay_full.png'), full.toBuffer('image/png'));
  const quads = { nw: [0, 0], ne: [896, 0], sw: [0, 512], se: [896, 512] };
  for (const q in quads) {
    const [sx, sy] = quads[q];
    const cv = createCanvas(Math.round(896 * 1.6), Math.round(512 * 1.6));
    cx = cv.getContext('2d');
    cx.drawImage(img, sx, sy, 896, 512, 0, 0, cv.width, cv.height);
    cx.translate(-sx * 1.6, -sy * 1.6);
    paintMask(cx, 1.6);
    fs.writeFileSync(path.join(outdir, `overlay_${q}.png`), cv.toBuffer('image/png'));
  }
  console.log('overlay done →', outdir);
})();
