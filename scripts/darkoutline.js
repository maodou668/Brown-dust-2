#!/usr/bin/env node
// 描边加深：把与透明区相邻的不透明轮廓像素压暗（确定性，不花生成费）
// 用法: node scripts/darkoutline.js <in.png> <out.png> [轮廓圈数=1] [压暗系数=0.35]
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
(async () => {
  const [src, dst, ringArg, kArg] = process.argv.slice(2);
  const rings = +(ringArg || 1), k = +(kArg || 0.35);
  const im = await loadImage(src);
  const W = im.width, H = im.height;
  const cv = createCanvas(W, H), ctx = cv.getContext('2d');
  ctx.drawImage(im, 0, 0);
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  const a = i => d[i * 4 + 3] > 8;
  let edge = new Set();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!a(i)) continue;
    const nb = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx < 0 || ny < 0 || nx >= W || ny >= H || !a(ny * W + nx);
    });
    if (nb) edge.add(i);
  }
  for (let r = 0; r < rings; r++) {
    for (const i of edge) { d[i*4] = Math.round(d[i*4]*k); d[i*4+1] = Math.round(d[i*4+1]*k); d[i*4+2] = Math.round(d[i*4+2]*k); }
    if (r + 1 < rings) {
      const next = new Set();
      for (const i of edge) {
        const x = i % W, y = (i / W) | 0;
        for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x+dx, ny = y+dy;
          if (nx>=0 && ny>=0 && nx<W && ny<H) { const j = ny*W+nx; if (a(j) && !edge.has(j)) next.add(j); }
        }
      }
      edge = next;
    }
  }
  ctx.putImageData(img, 0, 0);
  fs.writeFileSync(dst, cv.toBuffer('image/png'));
  console.log(`darkoutline ${rings}圈 k=${k} → ${dst}`);
})();
