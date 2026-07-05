// 大图物件抠图流水线：按 bigmap-objects.def.js 把物件从底图抠成透明精灵
// 输出: art/06_story/bigmap/obj/<name>.png + 打印 bigmap.js objects 配置段 + 验收拼版图
// 用法: NODE_PATH=<repo>/node_modules node scripts/devtools/bigmap-cutout.js [验收图输出目录]
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs'), path = require('path');
const DEFS = require('./bigmap-objects.def.js');

(async () => {
  const root = path.join(__dirname, '../../');
  const outdir = process.argv[2] || '.';
  const img = await loadImage(path.join(root, 'art/06_story/bigmap/town_day.png'));
  const objdir = path.join(root, 'art/06_story/bigmap/obj');
  fs.mkdirSync(objdir, { recursive: true });

  const cfg = [];
  for (const d of DEFS) {
    let x0 = 9e9, y0 = 9e9, x1 = -9e9, y1 = -9e9;
    for (const [x, y] of d.poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.ceil(x1); y1 = Math.ceil(y1);
    const w = x1 - x0, h = y1 - y0;
    const cv = createCanvas(w, h), ctx = cv.getContext('2d');
    ctx.drawImage(img, x0, y0, w, h, 0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    d.poly.forEach(([x, y], i) => i ? ctx.lineTo(x - x0, y - y0) : ctx.moveTo(x - x0, y - y0));
    ctx.closePath(); ctx.fill();
    fs.writeFileSync(path.join(objdir, d.name + '.png'), cv.toBuffer('image/png'));
    cfg.push({ img: d.name, px: x0, py: y0, y: d.base, foot: d.foot });
  }
  fs.writeFileSync(path.join(outdir, 'objects_config.json'), JSON.stringify(cfg));
  console.log('抠出', cfg.length, '件 → art/06_story/bigmap/obj/');

  // 验收图1: 底图压暗40% + 精灵原位回摆(物件应"亮起", 边缘无缺肉)
  const c1 = createCanvas(1792 * 0.7, 1024 * 0.7), x1c = c1.getContext('2d');
  x1c.drawImage(img, 0, 0, c1.width, c1.height);
  x1c.fillStyle = 'rgba(0,0,0,.55)'; x1c.fillRect(0, 0, c1.width, c1.height);
  for (const c of cfg) {
    const sp = await loadImage(path.join(objdir, c.img + '.png'));
    x1c.drawImage(sp, c.px * 0.7, c.py * 0.7, sp.width * 0.7, sp.height * 0.7);
  }
  fs.writeFileSync(path.join(outdir, 'cutout_check.png'), c1.toBuffer('image/png'));
  console.log('验收图 → cutout_check.png');
})();
