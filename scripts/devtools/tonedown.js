// 地面压暗压灰(D2定档: MUL=0.68 MIX=0.20): node tonedown.js <in> <out> [mul] [mix]
const { createCanvas, loadImage } = require('/home/user/Maodou/node_modules/@napi-rs/canvas');
const fs = require('fs');
(async () => {
  const [src, dst, mulA, mixA] = process.argv.slice(2);
  const mul = +(mulA || 0.68), mix = +(mixA || 0.20), G = [72, 86, 84];
  const im = await loadImage(src);
  const c = createCanvas(im.width, im.height), ctx = c.getContext('2d');
  ctx.drawImage(im, 0, 0);
  const d = ctx.getImageData(0, 0, im.width, im.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    for (let k = 0; k < 3; k++) p[i + k] = Math.round(p[i + k] * mul * (1 - mix) + G[k] * mix);
  }
  ctx.putImageData(d, 0, 0);
  fs.writeFileSync(dst, c.toBuffer('image/png'));
  console.log('toned', dst, mul, mix);
})();
