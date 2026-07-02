// ============================================================
//  npcvariant.js —— NPC「换了里面的人」差分生成器（圣经 v2 §2.1）
//  对立绘/帧做 2 处像素级改动：①嘴角各端上提 1px ②瞳孔行复制 1px（眼睁大）。
//  用法: NODE_PATH=<repo>/node_modules node scripts/npcvariant.js <in.png> <out.png> [faceBox: x,y,w,h]
//  faceBox 限定脸部区域（默认整图中上 1/2），避免误改衣服暗线。
// ============================================================
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');

const [inFile, outFile, boxArg] = process.argv.slice(2);
if (!inFile || !outFile) { console.error('用法: npcvariant.js <in.png> <out.png> [x,y,w,h]'); process.exit(1); }

(async () => {
  const img = await loadImage(inFile);
  const W = img.width, H = img.height;
  const box = boxArg ? boxArg.split(',').map(Number) : [Math.round(W * 0.25), Math.round(H * 0.15), Math.round(W * 0.5), Math.round(H * 0.45)];
  const [bx, by, bw, bh] = box;
  const cv = createCanvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  const lum = (x, y) => { const i = (y * W + x) * 4; return d[i + 3] < 100 ? 999 : 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; };
  const copyPx = (sx, sy, tx, ty) => { const s = (sy * W + sx) * 4, t = (ty * W + tx) * 4; d[t] = d[s]; d[t + 1] = d[s + 1]; d[t + 2] = d[s + 2]; d[t + 3] = d[s + 3]; };

  // 1) 脸区内找最暗的横向短线段（3-8px）当嘴线：两端各上提 1px
  let best = null;
  for (let y = by + Math.round(bh * 0.55); y < by + bh; y++) {
    let run = 0, sx = 0;
    for (let x = bx; x < bx + bw; x++) {
      if (lum(x, y) < 70) { if (!run) sx = x; run++; }
      else {
        if (run >= 3 && run <= 9 && (!best || y > best.y)) best = { y, x0: sx, x1: x - 1 };
        run = 0;
      }
    }
  }
  if (best) {
    copyPx(best.x0, best.y, best.x0, best.y - 1);   // 左嘴角上提
    copyPx(best.x1, best.y, best.x1, best.y - 1);   // 右嘴角上提
    console.log(`嘴线 y=${best.y} x=${best.x0}..${best.x1} 两端上提`);
  } else console.log('⚠️ 没找到嘴线（调 faceBox）');

  // 2) 脸区上半找两处最暗像素簇当瞳孔：其最暗行向上复制 1px（眼睁大）
  const pupils = [];
  for (let y = by; y < by + Math.round(bh * 0.5); y++)
    for (let x = bx; x < bx + bw; x++)
      if (lum(x, y) < 45) pupils.push({ x, y });
  if (pupils.length) {
    const left = pupils.filter(p => p.x < bx + bw / 2), right = pupils.filter(p => p.x >= bx + bw / 2);
    [left, right].forEach(side => {
      if (!side.length) return;
      const top = side.reduce((a, p) => (p.y < a.y ? p : a));
      copyPx(top.x, top.y, top.x, top.y - 1);
    });
    console.log(`瞳孔簇 ${pupils.length}px，左右各上扩 1px`);
  } else console.log('⚠️ 没找到瞳孔');

  ctx.putImageData(id, 0, 0);
  fs.writeFileSync(outFile, await cv.encode('png'));
  console.log('→', outFile);
})();
