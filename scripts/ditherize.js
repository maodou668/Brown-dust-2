// 笔触归一滤镜 v2: 确定性伪随机颗粒(打散棋盘感) + 亮区加强/描边保护
const { createCanvas, loadImage } = require('/home/user/Maodou/node_modules/@napi-rs/canvas');
const fs = require('fs');
const hash = (x, y) => { let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
(async () => {
  const [src, dst, ampArg] = process.argv.slice(2);
  const amp = +(ampArg || 12);
  const im = await loadImage(src);
  const cv = createCanvas(im.width, im.height), ctx = cv.getContext('2d');
  ctx.drawImage(im, 0, 0);
  const img = ctx.getImageData(0, 0, im.width, im.height), d = img.data;
  for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) {
    const i = (y * im.width + x) * 4;
    if (d[i + 3] < 8) continue;
    const mx = Math.max(d[i], d[i+1], d[i+2]);
    if (mx < 40) continue;
    const t = (hash(x, y) - 0.5) * 2 * amp;
    for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, d[i + c] + t));
  }
  ctx.putImageData(img, 0, 0);
  fs.writeFileSync(dst, cv.toBuffer('image/png'));
  console.log('ditherize2', dst.split('/').pop(), 'amp=' + amp);
})();
