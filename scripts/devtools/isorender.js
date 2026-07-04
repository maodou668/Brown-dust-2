// 等距实景渲染器 v2: 轮廓软投影(替代硬椭圆) + 地面压暗档 + 重冷调
// 用法: GROUND=<flat.png> DEF=<def.js> OUT=<prefix> [MUL=0.8 MIX=0.12] node isorender.js
const { createCanvas, loadImage } = require('/home/user/Maodou/node_modules/@napi-rs/canvas');
const fs = require('fs');
const A = '/home/user/Maodou/';
(async () => {
  const def = require(process.env.DEF || '/home/user/Maodou/dev/blueprints/town5_def.js');
  const st = def.stage, T = 32;
  const MUL = +(process.env.MUL || 1), MIX = +(process.env.MIX || 0);
  const ground = await loadImage(process.env.GROUND);
  const W0 = ground.width, H0 = ground.height;
  // 地面压暗
  const gc = createCanvas(W0, H0), gctx = gc.getContext('2d');
  gctx.drawImage(ground, 0, 0);
  if (MUL !== 1 || MIX > 0) {
    const gd = gctx.getImageData(0, 0, W0, H0), p = gd.data, G = [72, 86, 84];
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      for (let k = 0; k < 3; k++) p[i + k] = Math.round(p[i + k] * MUL * (1 - MIX) + G[k] * MIX);
    }
    gctx.putImageData(gd, 0, 0);
  }
  const W = W0 + H0, H = (W0 + H0) / 2;
  const cv = createCanvas(W, H), ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#181f1a'; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(1, 0.5, -1, 0.5, H0, 0);
  ctx.drawImage(gc, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const iso = (tx, ty) => [tx * T - ty * T + H0, (tx * T + ty * T) / 2];
  // 轮廓剪影缓存
  const silCache = new Map();
  const silOf = (im) => {
    if (silCache.has(im)) return silCache.get(im);
    const c = createCanvas(im.width, im.height), x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#0b1210'; x.fillRect(0, 0, im.width, im.height);
    silCache.set(im, c); return c;
  };
  // 阴天软投影: 剪影压扁30%+右下斜切, 3次微偏移叠出软边
  const softShadow = (im, sx, sy, s) => {
    const sil = silOf(im), w = im.width * s, h = im.height * s;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.transform(1, 0.12, 0.55, 0.30, 0, 0);   // 斜向右下压扁
    for (const [ox, oy, a] of [[0, 0, 0.10], [2, 1, 0.07], [-2, -1, 0.07]])
      { ctx.globalAlpha = a; ctx.drawImage(sil, -w / 2 + ox, -h + oy, w, h); }
    ctx.restore(); ctx.globalAlpha = 1;
  };
  const items = [];
  for (const pr of st.props) {
    const im = await loadImage(A + pr.img);
    const [sx, sy] = iso(pr.x, pr.y);
    items.push({ sy: pr.flat ? sy - 1 : sy, draw: () => {
      const s = pr.s || 1;
      if (pr.flat) {
        // 贴地件: 随地面一起等距投影
        const wx = pr.x * T, wy = pr.y * T;
        ctx.save();
        ctx.setTransform(1, 0.5, -1, 0.5, H0, 0);
        ctx.drawImage(im, Math.round(wx - im.width * s / 2), Math.round(wy - im.height * s / 2), im.width * s, im.height * s);
        ctx.restore();
        return;
      }
      softShadow(im, sx, sy, s);
      ctx.drawImage(im, Math.round(sx - im.width * s / 2), Math.round(sy - im.height * s), im.width * s, im.height * s);
    } });
  }
  const chars = [['teried', 21, 11.8], ['garcia', 22.8, 13.6], ['lecliss', 20.6, 16.8]];
  for (const [cid, tx, ty] of chars) {
    const im = await loadImage(A + `art/05_pixellab/${cid}_field/idle/south/00.png`);
    const [sx, sy] = iso(tx, ty);
    items.push({ sy, draw: () => {
      softShadow(im, sx, sy + 10, 1.33);
      ctx.drawImage(im, Math.round(sx - im.width * 1.33 / 2), Math.round(sy - im.height * 1.33 + 10), im.width * 1.33, im.height * 1.33);
    } });
  }
  items.sort((a, b) => a.sy - b.sy).forEach(i => i.draw());
  // 灯光(唯一暖色)
  for (const pr of st.props) {
    if (!pr.glow) continue;
    const [sx, sy] = iso(pr.x, pr.y - 1.2);
    const rg = ctx.createRadialGradient(sx, sy, 3, sx, sy, 84);
    rg.addColorStop(0, 'rgba(255,186,96,.55)'); rg.addColorStop(0.5, 'rgba(255,166,72,.20)'); rg.addColorStop(1, 'rgba(255,166,72,0)');
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rg;
    ctx.fillRect(sx - 84, sy - 84, 168, 168);
    ctx.globalCompositeOperation = 'source-over';
  }
  // 重冷调(压抑档): 降饱和+冷灰绿乘算+青蓝罩+暗角
  ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,0.22)'; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(186,198,194)'; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(36,56,64,.12)'; ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(4,8,10,.38)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  const OUT = process.env.OUT || 'iso_out';
  const full = createCanvas(1400, 700), fctx = full.getContext('2d');
  fctx.imageSmoothingEnabled = false;
  fctx.drawImage(cv, 0, 0, W, H, 0, 0, 1400, 700);
  fs.writeFileSync(OUT + '_full.png', full.toBuffer('image/png'));
  const [cx, cy] = iso(21, 12);
  const crop = createCanvas(960, 520);
  crop.getContext('2d').drawImage(cv, cx - 480, cy - 300, 960, 520, 0, 0, 960, 520);
  fs.writeFileSync(OUT + '_view.png', crop.toBuffer('image/png'));
  console.log('isorender ok', OUT);
})();
