// 给一个视频生成"全时间线缩略图"：每隔 step 帧取一帧，自动抠掉绿幕、裁到角色，
// 标注[帧号|秒]，平铺成网格。用来"看清"10s 视频里到底发生了什么、哪段干净可用。
// 用法: node scripts/contact-sheet.js <video> <out.png> [stepFrames=8] [cols=6]
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const FF = process.env.FFMPEG || 'ffmpeg';

const video = process.argv[2], out = process.argv[3], step = +(process.argv[4] || 8), cols = +(process.argv[5] || 6);
const FPS = 24, THUMB_H = 200;     // 角色裁切后的目标高度
const tmp = path.join('/tmp', 'cs_' + path.basename(video).replace(/\W/g, '').slice(0, 12));
fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
execFileSync(FF, ['-i', video, '-vf', `fps=${FPS}`, '-y', path.join(tmp, 'f%03d.png')], { stdio: 'ignore' });
const all = fs.readdirSync(tmp).filter(f => f.endsWith('.png')).sort();
const picks = all.filter((_, i) => i % step === 0);

// 绿幕：非绿像素的包围盒
function cropChar(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  let a = w, b = 0, c = h, e = 0;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const i = (y * w + x) * 4, R = d[i], G = d[i + 1], B = d[i + 2];
    const green = G > 90 && G > R * 1.25 && G > B * 1.25;   // 绿幕判定
    if (!green) { if (x < a) a = x; if (x > b) b = x; if (y < c) c = y; if (y > e) e = y; }
  }
  if (b <= a || e <= c) return null;
  return { x: a, y: c, w: b - a, h: e - c };
}

(async () => {
  const cells = [];
  for (const p of picks) {
    const im = await loadImage(path.join(tmp, p));
    const c0 = createCanvas(im.width, im.height), x0 = c0.getContext('2d');
    x0.drawImage(im, 0, 0);
    let bb = cropChar(x0, im.width, im.height);
    if (!bb) bb = { x: 0, y: 0, w: im.width, h: im.height };
    const pad = Math.round(bb.h * 0.06);
    bb = { x: Math.max(0, bb.x - pad), y: Math.max(0, bb.y - pad), w: bb.w + pad * 2, h: bb.h + pad * 2 };
    const fnum = all.indexOf(p), sec = (fnum / FPS).toFixed(2);
    cells.push({ im, bb, fnum, sec });
  }
  const tw = Math.round(THUMB_H * 0.75), lab = 16, cellH = THUMB_H + lab;
  const rows = Math.ceil(cells.length / cols);
  const cv = createCanvas(tw * cols, cellH * rows), g = cv.getContext('2d');
  g.fillStyle = '#101018'; g.fillRect(0, 0, cv.width, cv.height);
  cells.forEach((ce, i) => {
    const c = i % cols, r = Math.floor(i / cols), ox = c * tw, oy = r * cellH;
    // 等比放进 tw x THUMB_H
    const s = Math.min(tw / ce.bb.w, THUMB_H / ce.bb.h);
    const dw = ce.bb.w * s, dh = ce.bb.h * s, dx = ox + (tw - dw) / 2, dy = oy + lab + (THUMB_H - dh) / 2;
    g.fillStyle = '#1c5c2c'; g.fillRect(ox, oy + lab, tw, THUMB_H);   // 绿底，便于看抠像
    g.drawImage(ce.im, ce.bb.x, ce.bb.y, ce.bb.w, ce.bb.h, dx, dy, dw, dh);
    g.fillStyle = '#000'; g.fillRect(ox, oy, tw, lab);
    g.fillStyle = '#ffd86b'; g.font = 'bold 12px sans-serif'; g.textAlign = 'left';
    g.fillText(`#${ce.fnum} ${ce.sec}s`, ox + 3, oy + 12);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.strokeRect(ox, oy, tw, cellH);
  });
  fs.writeFileSync(out, cv.toBuffer('image/png'));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('->', out, `(${cells.length} frames, step=${step}, ${cols}x${rows})`);
})();
