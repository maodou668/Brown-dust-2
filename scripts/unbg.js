// basic 模式灰底去除：四角均值色 + 边界 BFS 泛洪 (tol)
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
(async () => {
  const [src, dst, tolArg] = process.argv.slice(2);
  const tol = +(tolArg || 28);
  const im = await loadImage(src);
  const W = im.width, H = im.height;
  const cv = createCanvas(W, H), ctx = cv.getContext('2d');
  ctx.drawImage(im, 0, 0);
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  const corners = [[0,0],[W-1,0],[0,H-1],[W-1,H-1]];
  let cr=0,cg=0,cb=0;
  for (const [x,y] of corners) { const i=(y*W+x)*4; cr+=d[i]; cg+=d[i+1]; cb+=d[i+2]; }
  cr/=4; cg/=4; cb/=4;
  const near = i => Math.abs(d[i*4]-cr)<=tol && Math.abs(d[i*4+1]-cg)<=tol && Math.abs(d[i*4+2]-cb)<=tol;
  const seen = new Uint8Array(W*H);
  const q = [];
  for (let x=0;x<W;x++){ q.push(x, (H-1)*W+x); }
  for (let y=0;y<H;y++){ q.push(y*W, y*W+W-1); }
  while (q.length) {
    const i = q.pop();
    if (seen[i] || !near(i)) continue;
    seen[i]=1; d[i*4+3]=0;
    const x=i%W, y=(i/W)|0;
    if (x>0) q.push(i-1); if (x<W-1) q.push(i+1);
    if (y>0) q.push(i-W); if (y<H-1) q.push(i+W);
  }
  ctx.putImageData(img,0,0);
  fs.writeFileSync(dst, cv.toBuffer('image/png'));
  console.log('unbg ok', src.split('/').pop());
})();
