// 走路朝向闸门(walk-facing gate)渲染器。
// 用法: node scripts/rundiag.js <char> [outPng]
// 输出一张横条: 上排=各向 idle 首帧, 下排=各向 run 第3帧。
// 逐列目视: 每个方向 run 的朝向必须和 idle 一致(无东接西/SE↔SW 互换、east/west 正侧面)。
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs'), path = require('path');
const ch = process.argv[2];
if (!ch) { console.error('usage: node scripts/rundiag.js <char> [outPng]'); process.exit(1); }
const ROOT = path.join(__dirname, '..', 'art', '05_pixellab', ch + '_field');
const OUT = process.argv[3] || (ch + '_rundiag.png');
const dirs = ['south','south-east','east','north-east','north','north-west','west','south-west'];
(async () => {
  const S = 130, pad = 4;
  const c = createCanvas(8 * (S + pad), 2 * (S + pad) + 18), x = c.getContext('2d');
  x.fillStyle = '#33384a'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = false;
  for (let r = 0; r < 2; r++) {
    const anim = ['idle', 'run'][r];
    for (let i = 0; i < 8; i++) {
      const d = dirs[i], fr = anim === 'run' ? 3 : 0;
      const p = path.join(ROOT, anim, d, String(fr).padStart(2, '0') + '.png');
      const X = i * (S + pad), Y = r * (S + pad) + 18;
      x.fillStyle = '#fff'; x.font = '12px sans-serif'; if (r === 0) x.fillText(d, X + 2, 12);
      if (fs.existsSync(p)) { const img = await loadImage(p); x.drawImage(img, 0, 0, img.width, img.height, X, Y, S, S); }
      x.fillStyle = '#9cf'; x.fillText(anim, X + 2, Y + S + 14);
    }
  }
  fs.writeFileSync(OUT, c.toBuffer('image/png'));
  console.log('wrote', OUT);
})();
